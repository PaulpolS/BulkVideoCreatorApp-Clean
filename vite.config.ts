import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

// Three-layer fix for runtime-written data files:
// 1. watch.ignored function (NOT glob string — Vite uses disableGlobbing:true so globs don't work)
// 2. watcher.unwatch() after ready — belt-and-suspenders removal from chokidar
// 3. ws.send interceptor — if a data-dir file change somehow still fires, block the full-reload
// 4. Custom static middleware — serves new files directly from disk, bypassing Vite's static handler
const DATA_STATIC_DIRS: Record<string, string> = {
  '/app_data':    path.resolve(__dirname, 'public/app_data'),
  '/temp_render': path.resolve(__dirname, 'public/temp_render'),
  '/Voice_stock': path.resolve(__dirname, 'public/Voice_stock'),
  '/Image_stock': path.resolve(__dirname, 'public/Image_stock'),
  '/Sound_stock': path.resolve(__dirname, 'public/Sound_stock'),
};
const DATA_MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4',
  '.m4a': 'audio/m4a', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.json': 'application/json', '.csv': 'text/csv', '.txt': 'text/plain',
};

const normDataDirs = Object.values(DATA_STATIC_DIRS).map(d => d.replace(/\\/g, '/'));
const isDataFile = (file: string) => {
  const f = file.replace(/\\/g, '/');
  return normDataDirs.some(d => f === d || f.startsWith(d + '/'));
};

// Configurable storage for aipage results & images (keeps heavy files out of git)
const STORAGE_CONFIG_PATH = path.resolve(__dirname, 'public/app_data/storage_config.json');
function getAipageDataDir(): string {
  try {
    const cfg = JSON.parse(fs.readFileSync(STORAGE_CONFIG_PATH, 'utf-8'));
    if (cfg.aipageDataDir && fs.existsSync(cfg.aipageDataDir)) return cfg.aipageDataDir;
  } catch {}
  return path.resolve(__dirname, 'public/app_data');
}

const dataStaticPlugin = (): Plugin => ({
  name: 'data-static-serve',

  // Inject client script to block auto-reload when WebSocket disconnects.
  // Root cause: if the dev server crashes (unhandled error), the WS drops and
  // Vite's client calls location.reload(). We suppress that with a flag.
  transformIndexHtml() {
    return [
      {
        tag: 'script',
        attrs: { type: 'module' },
        injectTo: 'head-prepend',
        children: `
(function(){
  const _origReload = location.reload.bind(location);
  window.__viteAllowReload = false;
  const _origWS = window.WebSocket;
  window.WebSocket = function(url, proto) {
    const ws = new _origWS(url, proto);
    if (proto === 'vite-hmr') {
      ws.addEventListener('close', function(e) {
        if (!e.wasClean) {
          // Vite is about to call location.reload() after reconnecting.
          // Block it — user keeps their in-progress state.
          const _saved = location.reload;
          Object.defineProperty(location, 'reload', {
            configurable: true,
            get() { return function(){ console.warn('[dev] Auto-reload blocked. Press F5 to reload manually.'); }; },
          });
          setTimeout(function(){
            Object.defineProperty(location, 'reload', { configurable: true, get(){ return _saved; } });
          }, 10000);
        }
      });
    }
    return ws;
  };
  Object.assign(window.WebSocket, _origWS);
  window.WebSocket.prototype = _origWS.prototype;
})();
        `,
      },
    ];
  },

  configureServer(server) {
    // Prevent server crash from unhandled errors in API handlers or streams.
    // Without this, an unhandled rejection crashes Node → WS drops → browser reloads.
    const onUncaught = (err: unknown) => {
      server.config.logger.error(`[data-static] Unhandled error (server kept alive): ${err}`);
    };
    process.on('uncaughtException', onUncaught);
    process.on('unhandledRejection', onUncaught);

    // Layer 2: unwatch data dirs after chokidar is ready
    server.watcher.on('ready', () => {
      for (const dir of Object.values(DATA_STATIC_DIRS)) {
        server.watcher.unwatch(dir);
      }
    });

    // Layer 3: intercept ws.send — block full-reload caused by data dir file changes
    let blockReload = false;
    const markDataChange = (file: string) => {
      if (isDataFile(file)) {
        blockReload = true;
        Promise.resolve().then(() => { blockReload = false; });
      }
    };
    server.watcher.prependListener('add', markDataChange);
    server.watcher.prependListener('change', markDataChange);

    const origSend = server.ws.send.bind(server.ws);
    (server.ws as any).send = (payload: any) => {
      if (blockReload && payload?.type === 'full-reload') {
        blockReload = false;
        server.config.logger.info('[data-static] Blocked full-reload from data dir change');
        return;
      }
      if (payload?.type === 'full-reload') {
        server.config.logger.warn('[data-static] full-reload sent — trigger: ' + (payload.triggeredBy || payload.path || 'unknown'));
      }
      origSend(payload);
    };

    // Layer 4: static file middleware — serves data files directly from disk.
    // For aipage_images / aipage_results, serve from the user-configured data dir.
    // IMPORTANT: pipe() has error handler to avoid crashing the server on read error.
    return () => {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url: string = (req.url || '').split('?')[0];

        // Special case: serve aipage data from configured dir
        let filePath: string | null = null;
        const aipageDir = getAipageDataDir();
        if (url.startsWith('/app_data/aipage_images/')) {
          const rel = url.slice('/app_data/aipage_images/'.length);
          filePath = path.join(aipageDir, 'aipage_images', rel);
        } else if (url === '/app_data/aipage_results.json') {
          filePath = path.join(aipageDir, 'aipage_results.json');
        } else if (url === '/app_data/aipage_n8n_export.csv') {
          filePath = path.join(aipageDir, 'aipage_n8n_export.csv');
        }

        if (!filePath) {
          const prefix = Object.keys(DATA_STATIC_DIRS).find(p => url === p || url.startsWith(p + '/'));
          if (!prefix) return next();
          const rel = url.slice(prefix.length);
          filePath = path.join(DATA_STATIC_DIRS[prefix], rel);
          if (!filePath.startsWith(DATA_STATIC_DIRS[prefix])) return next();
        }

        let stat: ReturnType<typeof fs.statSync> | null = null;
        try { stat = fs.statSync(filePath); } catch { return next(); }
        if (!stat.isFile()) return next();
        const mime = DATA_MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'no-cache');
        const stream = fs.createReadStream(filePath);
        stream.on('error', () => { if (!res.writableEnded) res.end(); });
        stream.pipe(res);
      });
    };
  },
});

const fileSaverPlugin = (): Plugin => ({
  name: 'local-file-saver',
  configureServer(server) {
    server.middlewares.use('/api/mac-tts', (req, res) => {
      // Must be GET request
      if (req.method === 'GET') {
        const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
        const text = urlParams.get('text') || 'ไม่มีข้อความ';
        const rawVoice = urlParams.get('voice') || 'Kanya';
        
        // Anti-injection sanitation for bash execution
        const safeText = text.replace(/["'$`\\]/g, "");
        const voice = rawVoice.replace(/[^A-Za-z0-9]/g, "");

        const stockDir = path.resolve(__dirname, 'public/Voice_stock');
        if (!fs.existsSync(stockDir)) fs.mkdirSync(stockDir, { recursive: true });

        const fileName = `mac-voice-${Date.now()}.m4a`;
        const filePath = path.join(stockDir, fileName);

        // Execute Mac 'say' command
        const { exec } = require('child_process');
        exec(`say -v ${voice} "${safeText}" -o "${filePath}"`, (error: any) => {
          res.setHeader('Content-Type', 'application/json');
          if (error) {
             res.statusCode = 500;
             res.end(JSON.stringify({ error: error.message }));
             return;
          }
          res.end(JSON.stringify({ audioUrl: `/Voice_stock/${fileName}`, duration: Math.max(1, safeText.length / 4) }));
        });
      }
    });

    server.middlewares.use('/api/save-audio', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }

      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          const { url, fileName, prompt, tags = [], folder = 'Sound_stock' } = JSON.parse(body);
          if (!url || !fileName) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Missing url or fileName" }));
            return;
          }

          // Prevent path traversal
          const safeFolder = folder.replace(/[^A-Za-z0-9_-]/g, "");
          const stockDir = path.resolve(__dirname, `public/${safeFolder}`);
          if (!fs.existsSync(stockDir)) {
            fs.mkdirSync(stockDir, { recursive: true });
          }

          const ext = fileName.includes('.') ? '' : (folder === 'Image_stock' ? '.png' : '.mp3');
          const safeName = `${fileName}${ext}`;
          const filePath = path.join(stockDir, safeName);
          
          const protocol = url.startsWith('https') ? https : http;
          const fileStream = fs.createWriteStream(filePath);
          
          protocol.get(url, (response) => {
            response.pipe(fileStream);
            fileStream.on('finish', () => {
              fileStream.close();

              // Update Metadata Catalog
              const catalogPath = path.join(stockDir, 'sfx_catalog.json');
              let catalog: any[] = [];
              if (fs.existsSync(catalogPath)) {
                try {
                  catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
                } catch(e) {}
              }

              const index = catalog.findIndex((c) => c.fileName === safeName);
              const metadata = {
                fileName: safeName,
                prompt: prompt || '',
                tags: tags,
                updatedAt: new Date().toISOString()
              };

              if (index >= 0) {
                catalog[index] = { ...catalog[index], ...metadata };
              } else {
                catalog.push(metadata);
              }

              fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, fileName: safeName, savedTo: `public/${safeFolder}`, url: `/${safeFolder}/${safeName}` }));
            });
          }).on('error', (err) => {
            fs.unlink(filePath, () => {});
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          });

        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    server.middlewares.use('/api/save-project', (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { path: exportPath, data } = JSON.parse(body);
          if (!exportPath) {
             res.statusCode = 400;
             return res.end(JSON.stringify({ error: "Missing output path" }));
          }
          if (!fs.existsSync(exportPath)) {
            fs.mkdirSync(exportPath, { recursive: true });
          }
          const targetFile = path.join(exportPath, `project_assets_${Date.now()}.json`);
          fs.writeFileSync(targetFile, JSON.stringify(data, null, 2));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, filePath: targetFile }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    server.middlewares.use('/api/list-assets', (req, res) => {
      if (req.method !== 'GET') return;
      const result: any[] = [];
      const baseDir = path.resolve(__dirname, 'public');
      
      ['Sound_stock', 'Voice_stock', 'Video_stock', 'Image_stock', 'Font_stock'].forEach(folder => {
        const folderPath = path.join(baseDir, folder);
        if (fs.existsSync(folderPath)) {
           const files = fs.readdirSync(folderPath);
           files.forEach(f => {
              if (f === '.DS_Store' || f === 'sfx_catalog.json' || f === 'catalog.json') return;
              const stat = fs.statSync(path.join(folderPath, f));
              if (stat.isFile()) {
                 result.push({
                    id: `${folder}/${f}`,
                    name: f,
                    type: folder,
                    sizeBytes: stat.size,
                    createdAt: stat.birthtime.toISOString()
                 });
              }
           });
        }
      });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    });

    server.middlewares.use('/api/delete-assets', (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
           const { paths } = JSON.parse(body);
           const baseDir = path.resolve(__dirname, 'public');
           const deleted: string[] = [];
           
           (paths || []).forEach((p: string) => {
              if (p.includes('..')) return;
              const filePath = path.join(baseDir, p);
              if (fs.existsSync(filePath)) {
                 fs.unlinkSync(filePath);
                 deleted.push(p);

                 if (p.startsWith('Sound_stock/') || p.startsWith('Voice_stock/')) {
                    const folderName = p.split('/')[0];
                    const catalogPath = path.join(baseDir, `${folderName}/sfx_catalog.json`);
                    if (fs.existsSync(catalogPath)) {
                       try {
                         let catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
                         const name = p.split('/')[1];
                         catalog = catalog.filter((c: any) => c.fileName !== name);
                         fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
                       } catch(e){}
                    }
                 }
              }
           });
           
           res.setHeader('Content-Type', 'application/json');
           res.end(JSON.stringify({ success: true, deleted }));
        } catch(e: any) {
           res.statusCode = 500;
           res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    server.middlewares.use('/api/count-video-stock', (req, res) => {
      if (req.method !== 'GET') return;
      const baseDir = path.resolve(__dirname, 'public/Video_stock');
      const result: Record<string, number> = {};
      
      if (fs.existsSync(baseDir)) {
        const dirs = fs.readdirSync(baseDir);
        dirs.forEach(dir => {
          const dirPath = path.join(baseDir, dir);
          try {
            const stat = fs.statSync(dirPath);
            if (stat.isDirectory()) {
              const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.mp4') || f.endsWith('.mov') || f.endsWith('.webm'));
              result[dir] = files.length;
            }
          } catch(e) {}
        });
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    });

    server.middlewares.use('/api/list-video-folder', (req, res) => {
      if (req.method !== 'GET') return;
      const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
      const folder = urlParams.get('folder') || '';
      
      if (!folder || folder.includes('..')) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Invalid folder' }));
        return;
      }
      
      const folderPath = path.resolve(__dirname, 'public/Video_stock', folder);
      const result: any[] = [];
      
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath).filter(f => 
          f.endsWith('.mp4') || f.endsWith('.mov') || f.endsWith('.webm')
        );
        files.forEach(f => {
          result.push({
            name: f,
            url: `/Video_stock/${folder}/${f}`,
          });
        });
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    });

    server.middlewares.use('/api/save-avatar', (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { filename, characterName, base64 } = JSON.parse(body);
          if (!filename || !characterName || !base64) throw new Error('Missing data');
          
          const safeCharName = characterName.replace(/[^a-zA-Z0-9ก-๙]/g, '_');
          const avatarDir = path.resolve(__dirname, 'public/Avatar_stock', safeCharName);
          if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
          
          const filePath = path.join(avatarDir, filename);
          const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
          fs.writeFileSync(filePath, base64Data, 'base64');
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, url: `/Avatar_stock/${safeCharName}/${filename}` }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    server.middlewares.use('/api/list-avatars', (req, res) => {
      if (req.method !== 'GET') return;
      
      const stockDir = path.resolve(__dirname, 'public/Avatar_stock');
      const characters: any[] = [];
      
      if (fs.existsSync(stockDir)) {
        const folders = fs.readdirSync(stockDir);
        for (const folder of folders) {
          const dirPath = path.join(stockDir, folder);
          try {
            if (fs.statSync(dirPath).isDirectory()) {
              const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.png'));
              const avatars = files.map(f => {
                const parts = f.replace('.png', '').split('_');
                const expName = parts.length >= 2 ? parts[1] : parts[0];
                return {
                  name: expName,
                  fullName: f,
                  url: `/Avatar_stock/${folder}/${f}`
                };
              });
              
              const animConfigFile = path.join(dirPath, 'animations.json');
              let animations = {};
              if (fs.existsSync(animConfigFile)) {
                 try { animations = JSON.parse(fs.readFileSync(animConfigFile, 'utf8')); } catch(e){}
              } else {
                 // Auto generate default pairings based on typical name
                 animations = {
                    talking: ['neutral', 'talking'],
                    laughing: ['happy', 'talking'],
                    angry_talk: ['angry', 'talking'],
                    crying: ['crying', 'sad']
                 };
                 fs.writeFileSync(animConfigFile, JSON.stringify(animations, null, 2));
              }

              characters.push({
                name: folder,
                avatars,
                animations
              });
            }
          } catch(e) {}
        }
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(characters));
    });

    server.middlewares.use('/api/delete-avatar', (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { characterName, filename } = JSON.parse(body);
          if (!characterName) throw new Error('Missing characterName');
          
          const avatarDir = path.resolve(__dirname, 'public/Avatar_stock', characterName);
          if (fs.existsSync(avatarDir)) {
            if (filename) {
              const filePath = path.join(avatarDir, filename);
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } else {
              // Remove all files in the directory first
              const files = fs.readdirSync(avatarDir);
              for (const file of files) {
                fs.unlinkSync(path.join(avatarDir, file));
              }
              fs.rmdirSync(avatarDir);
            }
          }
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    server.middlewares.use('/api/list-sound-stock', (req, res) => {
      if (req.method !== 'GET') return;
      
      const folderPath = path.resolve(__dirname, 'public/Sound_stock');
      const result: any[] = [];
      
      if (fs.existsSync(folderPath)) {
        const { execSync } = require('child_process');
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.mp3') || f.endsWith('.wav'));
        files.forEach(f => {
          let duration = 0;
          try {
            const dur = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${path.join(folderPath, f)}"`, { encoding: 'utf8' });
            duration = parseFloat(dur.trim()) || 0;
          } catch(e) {}
          result.push({
            name: f,
            url: `/Sound_stock/${f}`,
            duration: Math.round(duration * 10) / 10,
          });
        });
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    });

    server.middlewares.use('/api/render-video', (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString() });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const jobId = Date.now().toString();
          const jobPath = path.resolve(__dirname, 'public/temp_render', `job_${jobId}.json`);
          
          if (!fs.existsSync(path.resolve(__dirname, 'public/temp_render'))) {
            fs.mkdirSync(path.resolve(__dirname, 'public/temp_render'));
          }

          fs.writeFileSync(jobPath, JSON.stringify({...data, projectId: jobId}));

          // Call the external Node script
          const { exec } = require('child_process');
          const scriptPath = path.resolve(__dirname, 'scripts/render.js');
          
          res.setHeader('Content-Type', 'application/json');
          
          // Execute asynchronously. The frontend will wait for it.
          exec(`node "${scriptPath}" "${jobPath}"`, (error: any, stdout: any, stderr: any) => {
            // Cleanup job file
            if (fs.existsSync(jobPath)) fs.unlinkSync(jobPath);
            
            if (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: error.message, details: stderr }));
              return;
            }
            res.end(JSON.stringify({ success: true, logs: stdout }));
          });

        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    server.middlewares.use('/api/open-folder', (req, res) => {
      if (req.method !== 'GET') return;
      const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
      const target = urlParams.get('type') || 'Sound_stock';
      
      if (target.includes('..')) {
         res.statusCode = 400;
         return res.end();
      }

      let folderPath;
      if (target.startsWith('/')) { 
         // Absolute custom Output path
         folderPath = target;
      } else {
         // Relative path in public
         folderPath = path.resolve(__dirname, 'public', target);
      }

      if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

      const { exec } = require('child_process');
      exec(`open "${folderPath}"`, (err: any) => {
         res.setHeader('Content-Type', 'application/json');
         res.end(JSON.stringify({ success: !err }));
      });
    });

    server.middlewares.use('/api/generate-stt', (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { scenes } = JSON.parse(body);


          let finalSRTContent = '';
          let srtIndexCount = 1;

          // Helper to offset times
          const timeToMs = (srtTime: string) => {
            const [h, m, s_ms] = srtTime.split(':');
            const [s, ms] = s_ms.split(',');
            return (parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)) * 1000 + parseInt(ms);
          };
          const msToTime = (ms: number) => {
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            const mx = ms % 1000;
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${mx.toString().padStart(3, '0')}`;
          };

          for (const scene of scenes) {
            if (!scene.audioUrl) continue;
            
            // Map the url to absolute path in public
            const audioPath = path.join(__dirname, 'public', scene.audioUrl.split('?')[0]);
            if (!fs.existsSync(audioPath)) {
               console.warn(`[STT] Audio not found: ${audioPath}`);
               continue;
            }

            const tempId = Date.now() + Math.random().toString(36).slice(2);
            const tempWav = path.join(__dirname, 'public/temp_render', tempId + '.wav');
            const outPrefix = path.join(__dirname, 'public/temp_render', tempId);
            const modelPath = path.join(__dirname, 'public/models', 'ggml-large-v3-turbo-q5_0.bin');

            let sttRes = '';
            try {
               const { execSync } = require('child_process');
               // 1. Convert to 16kHz WAV
               execSync(`ffmpeg -y -i "${audioPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${tempWav}" > /dev/null 2>&1`);
               
               // 2. Run local whisper-cli natively
               execSync(`/opt/homebrew/bin/whisper-cli -m "${modelPath}" -f "${tempWav}" -l th -osrt -of "${outPrefix}" > /dev/null 2>&1`);

               // 3. Read SRT back
               const srtFile = outPrefix + '.srt';
               if (fs.existsSync(srtFile)) {
                  sttRes = fs.readFileSync(srtFile, 'utf8');
               }

               // Cleanup
               try { fs.unlinkSync(tempWav); } catch(e){}
               try { fs.unlinkSync(srtFile); } catch(e){}
            } catch(e) {
               console.error('[LOCAL STT] Failed for scene:', e);
            }

            if (!sttRes) continue;

            // sttRes is the SRT string from local whisper for this chunk
            const blocks = sttRes.trim().split('\n\n');
            let offsetMs = Math.round(scene.offsetMs);
            
            for (const block of blocks) {
               const lines = block.split('\n');
               if (lines.length >= 3) {
                  const match = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
                  if (match) {
                     const newStart = msToTime(timeToMs(match[1]) + offsetMs);
                     const newEnd = msToTime(timeToMs(match[2]) + offsetMs);
                     
                     // Text lines
                     const textLines = lines.slice(2).join('\n');
                     if (textLines.trim()) {
                       finalSRTContent += `${srtIndexCount}\n${newStart} --> ${newEnd}\n${textLines.trim()}\n\n`;
                       srtIndexCount++;
                     }
                  }
               }
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, srt: finalSRTContent }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    server.middlewares.use('/api/get-app-data', (req, res) => {
      if (req.method !== 'GET') return;
      const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
      const key = urlParams.get('key');
      if (!key || key.includes('..') || key.includes('/')) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Invalid key' }));
      }
      const dataDir = path.resolve(__dirname, 'public/app_data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const filePath = path.join(dataDir, `${key}.json`);
      res.setHeader('Content-Type', 'application/json');
      if (!fs.existsSync(filePath)) {
        res.end(JSON.stringify([]));
      } else {
        res.end(fs.readFileSync(filePath, 'utf-8'));
      }
    });

    // === Storage Config: Get/Set the aipage data directory ===
    server.middlewares.use('/api/aipage-storage-config', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET') {
        const dir = getAipageDataDir();
        const imagesDir = path.join(dir, 'aipage_images');
        const imageCount = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir).length : 0;
        const resultsFile = path.join(dir, 'aipage_results.json');
        let resultCount = 0;
        try { resultCount = JSON.parse(fs.readFileSync(resultsFile, 'utf-8')).length; } catch {}
        res.end(JSON.stringify({ dir, imageCount, resultCount }));
        return;
      }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (c: any) => { body += c; });
        req.on('end', () => {
          try {
            const { dir } = JSON.parse(body);
            if (!dir || typeof dir !== 'string') { res.statusCode = 400; res.end(JSON.stringify({ error: 'dir required' })); return; }
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const cfg = fs.existsSync(STORAGE_CONFIG_PATH) ? JSON.parse(fs.readFileSync(STORAGE_CONFIG_PATH, 'utf-8')) : {};
            cfg.aipageDataDir = dir;
            fs.writeFileSync(STORAGE_CONFIG_PATH, JSON.stringify(cfg, null, 2));
            res.end(JSON.stringify({ success: true, dir }));
          } catch (e: any) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
        });
        return;
      }
      res.statusCode = 405; res.end('{}');
    });

    // === Pick Folder via macOS native dialog ===
    server.middlewares.use('/api/pick-folder', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(''); return; }
      res.setHeader('Content-Type', 'application/json');
      const { execSync } = require('child_process');
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        let prompt = 'เลือกโฟลเดอร์';
        try { const parsed = JSON.parse(body); if (parsed.prompt) prompt = parsed.prompt; } catch {}
        const safePrompt = prompt.replace(/'/g, '’');
        try {
          const result = execSync(
            `osascript -e 'POSIX path of (choose folder with prompt "${safePrompt}")'`,
            { encoding: 'utf-8', timeout: 60000 }
          ).trim().replace(/\/$/, '');
          res.end(JSON.stringify({ success: true, dir: result }));
        } catch {
          res.end(JSON.stringify({ success: false, cancelled: true }));
        }
      });
    });

    // === Pick File via macOS native dialog ===
    server.middlewares.use('/api/pick-file', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(''); return; }
      res.setHeader('Content-Type', 'application/json');
      const { execSync } = require('child_process');
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        let prompt = 'เลือกไฟล์';
        try { const parsed = JSON.parse(body); if (parsed.prompt) prompt = parsed.prompt; } catch {}
        const safePrompt = prompt.replace(/'/g, '’');
        try {
          const result = execSync(
            `osascript -e 'POSIX path of (choose file with prompt "${safePrompt}")'`,
            { encoding: 'utf-8', timeout: 60000 }
          ).trim();
          res.end(JSON.stringify({ success: true, file: result }));
        } catch {
          res.end(JSON.stringify({ success: false, cancelled: true }));
        }
      });
    });

    // === List video files in a folder ===
    server.middlewares.use('/api/list-folder-videos', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(''); return; }
      res.setHeader('Content-Type', 'application/json');
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { folder } = JSON.parse(body);
          if (!folder) { res.end(JSON.stringify({ files: [] })); return; }
          const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.webm'];
          const allFiles = fs.readdirSync(folder);
          const videoFiles = allFiles.filter(f => {
            const ext = path.extname(f).toLowerCase();
            return VIDEO_EXTS.includes(ext);
          });
          res.end(JSON.stringify({ files: videoFiles }));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message, files: [] }));
        }
      });
    });

    // === Run bash script directly via SSE ===
    server.middlewares.use('/api/run-bash-script', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(''); return; }
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const { spawn } = require('child_process');
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        let script = '';
        try { const parsed = JSON.parse(body); script = parsed.script || ''; } catch {}
        if (!script) {
          res.write('data: ' + JSON.stringify({ type: 'error', text: 'No script provided' }) + '\n\n');
          res.end();
          return;
        }
        const tmpFile = `/tmp/singleclip_render_${Date.now()}.sh`;
        try { fs.writeFileSync(tmpFile, script, { mode: 0o755 }); } catch (e: any) {
          res.write('data: ' + JSON.stringify({ type: 'error', text: 'Failed to write temp file: ' + e.message }) + '\n\n');
          res.end();
          return;
        }
        const env = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}` };
        const proc = spawn('bash', [tmpFile], { stdio: ['ignore', 'pipe', 'pipe'], env });
        const cleanup = () => { try { fs.unlinkSync(tmpFile); } catch {} };
        let finished = false;
        const send = (obj: object) => {
          if (!res.writableEnded) { try { res.write('data: ' + JSON.stringify(obj) + '\n\n'); } catch {} }
        };
        proc.stdout.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n');
          for (const line of lines) { if (line.trim()) send({ type: 'log', text: line }); }
        });
        proc.stderr.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n');
          for (const line of lines) { if (line.trim()) send({ type: 'log', text: line }); }
        });
        proc.on('close', (code: number | null) => {
          if (finished) return;
          finished = true;
          cleanup();
          if (code === 0) {
            send({ type: 'done' });
          } else {
            send({ type: 'error', text: code != null ? `ffmpeg exited (code ${code}) — ดู log ด้านบน` : 'Process stopped' });
          }
          if (!res.writableEnded) res.end();
        });
        proc.on('error', (err: Error) => {
          if (finished) return;
          finished = true;
          cleanup();
          send({ type: 'error', text: err.message });
          if (!res.writableEnded) res.end();
        });
        // Use res.on('close') — fires only when the client truly disconnects from SSE
        res.on('close', () => { if (!finished) { proc.kill(); cleanup(); } });
      });
    });

    // === Clear Cache: remove orphaned images not referenced in results ===
    server.middlewares.use('/api/aipage-clear-cache', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(''); return; }
      res.setHeader('Content-Type', 'application/json');
      try {
        const dir = getAipageDataDir();
        const resultsFile = path.join(dir, 'aipage_results.json');
        const imagesDir = path.join(dir, 'aipage_images');

        let referenced = new Set<string>();
        if (fs.existsSync(resultsFile)) {
          try {
            const results: any[] = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
            for (const r of results) {
              // collect all image filenames referenced in results
              const localPath: string = r.localImagePath || r.canvasImagePath || '';
              if (localPath) referenced.add(path.basename(localPath));
              if (Array.isArray(r.images)) {
                for (const img of r.images) referenced.add(path.basename(img));
              }
            }
          } catch {}
        }

        let deletedCount = 0;
        let freedBytes = 0;
        if (fs.existsSync(imagesDir)) {
          for (const f of fs.readdirSync(imagesDir)) {
            if (!referenced.has(f)) {
              const fp = path.join(imagesDir, f);
              try {
                const sz = fs.statSync(fp).size;
                fs.unlinkSync(fp);
                deletedCount++;
                freedBytes += sz;
              } catch {}
            }
          }
        }

        // Also clear the CSV export
        const csvPath = path.join(dir, 'aipage_n8n_export.csv');
        if (fs.existsSync(csvPath)) { fs.unlinkSync(csvPath); }

        res.end(JSON.stringify({ success: true, deletedCount, freedMB: +(freedBytes / 1024 / 1024).toFixed(1) }));
      } catch (e: any) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    });

    // === AI Page Post Results (stored in user-configured data dir) ===
    server.middlewares.use('/api/aipage-results', (req, res) => {
      const aipageDir = getAipageDataDir();
      const resultsFile = path.join(aipageDir, 'aipage_results.json');
      if (!fs.existsSync(aipageDir)) fs.mkdirSync(aipageDir, { recursive: true });

      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        if (!fs.existsSync(resultsFile)) {
          res.end(JSON.stringify({ success: true, results: [] }));
        } else {
          try {
            const data = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
            res.end(JSON.stringify({ success: true, results: data }));
          } catch(e) {
            res.end(JSON.stringify({ success: true, results: [] }));
          }
        }
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { action, item, id, ids } = JSON.parse(body);
            let results: any[] = [];
            if (fs.existsSync(resultsFile)) {
              try { results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8')); } catch(e) { results = []; }
            }

            if (action === 'add' && item) {
              // Dedup: skip if same headline+sourceUrl exists within 120 seconds
              const isDupe = results.some((r: any) =>
                r.headline && r.headline === item.headline &&
                r.sourceUrl === item.sourceUrl &&
                Math.abs(new Date(r.createdAt).getTime() - new Date(item.createdAt).getTime()) < 120000
              );
              if (!isDupe) {
                results.unshift(item); // newest first
                fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, skipped: isDupe }));
            } else if (action === 'delete' && id) {
              results = results.filter((r: any) => r.id !== id);
              fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } else if (action === 'update' && id && item) {
              results = results.map((r: any) => r.id === id ? { ...r, ...item } : r);
              fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } else if (action === 'deduplicate') {
              // Keep newest per (headline + sourceUrl) key
              const seen = new Map<string, any>();
              for (const r of results) {
                const key = `${r.headline || ''}|${r.sourceUrl || ''}`;
                const existing = seen.get(key);
                if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
                  seen.set(key, r);
                }
              }
              const before = results.length;
              results = Array.from(seen.values()).sort((a: any, b: any) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
              fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, removed: before - results.length, remaining: results.length }));
            } else if (action === 'export-csv') {
              const exportResults = Array.isArray(ids) && ids.length > 0
                ? results.filter((r: any) => ids.includes(r.id))
                : results;
              const splitCommentPostForExport = (text: string) => {
                const cleaned = String(text || '').trim();
                const pick = (label: string, nextLabels: string[]) => {
                  const start = cleaned.search(new RegExp(`${label}\\s*:`, 'i'));
                  if (start < 0) return '';
                  const afterLabel = cleaned.slice(start).replace(new RegExp(`^${label}\\s*:\\s*`, 'i'), '');
                  const nextPositions = nextLabels
                    .map(next => afterLabel.search(new RegExp(`\\n\\s*${next}\\s*:`, 'i')))
                    .filter(pos => pos >= 0);
                  const end = nextPositions.length ? Math.min(...nextPositions) : afterLabel.length;
                  return afterLabel.slice(0, end).trim();
                };
                return {
                  caption: pick('(?:แคปชั่น|โพสต์แคปชั่น)', ['ใต้เม้น1', 'ใต้เม้น2', 'ใต้เม้น3']),
                  comment1: pick('ใต้เม้น1', ['ใต้เม้น2', 'ใต้เม้น3']),
                  comment2: pick('ใต้เม้น2', ['ใต้เม้น3']),
                  comment3: pick('ใต้เม้น3', []),
                };
              };
              const formatFacebookPostText = (text: string) => {
                return String(text || '')
                  .replace(/\r\n/g, '\n')
                  .replace(/\*\*(.*?)\*\*/g, '$1')
                  .replace(/^\s*[-*]\s+/gm, '')
                  .replace(/\s+\.\s+/g, '\n\n')
                  .replace(/\s+(?=(?:\d+\.|[🔥🚀⭐️💡🎯📌✅])\s*)/g, '\n\n')
                  .replace(/[ \t]{2,}/g, ' ')
                  .replace(/\n[ \t]+/g, '\n')
                  .replace(/\n{3,}/g, '\n\n')
                  .trim();
              };
              const fallbackCommentPostForExport = (headline: string, article: string) => {
                const normalized = formatFacebookPostText(article).replace(/\n+/g, ' ').trim();
                const chunkSize = Math.ceil(normalized.length / 3) || 1;
                return {
                  caption: headline || '',
                  comment1: normalized.slice(0, chunkSize).trim(),
                  comment2: normalized.slice(chunkSize, chunkSize * 2).trim(),
                  comment3: normalized.slice(chunkSize * 2).trim(),
                };
              };
              const headers = ['id', 'headline', 'post_text', 'clickbait_caption', 'comment_1', 'comment_2', 'comment_3', 'comment_1_image_url', 'comment_2_image_url', 'comment_3_image_url', 'dropbox_dl1_url', 'image_url', 'source_url', 'source_title', 'source_type', 'channel_name', 'subscriber_count', 'tags', 'image_ratio', 'image_prompt_style_id', 'dropbox_path', 'created_at'];
              const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
              const lines = exportResults.map((p: any) => {
                const meta = p.sourceMeta || {};
                const parsedCommentParts = splitCommentPostForExport(p.commentPostText || p.generatedCommentPost || '');
                const commentParts = parsedCommentParts.caption || parsedCommentParts.comment1
                  ? parsedCommentParts
                  : fallbackCommentPostForExport(p.headline || '', p.article || '');
                const imageLink = p.dropboxUrl || p.imageUrl || '';
                return [
                  p.id || '',
                  p.headline || '',
                  formatFacebookPostText(p.article || ''),
                  commentParts.caption,
                  commentParts.comment1,
                  commentParts.comment2,
                  commentParts.comment3,
                  imageLink,
                  imageLink,
                  imageLink,
                  p.dropboxUrl || '',
                  p.imageUrl || '',
                  p.sourceUrl || meta.sourceUrl || '',
                  meta.title || '',
                  meta.sourceType || '',
                  meta.channelName || '',
                  meta.subscriberCount ?? '',
                  Array.isArray(meta.tags) ? meta.tags.join('|') : '',
                  p.imageRatio || '',
                  p.imagePromptStyleId || '',
                  p.dropboxPath || '',
                  p.createdAt || '',
                ].map(esc).join(',');
              });
              const csvBody = headers.join(',') + '\r\n' + lines.join('\r\n');
              const csvContent = '\uFEFF' + csvBody;
              const csvPath = path.join(getAipageDataDir(), 'aipage_n8n_export.csv');
              fs.writeFileSync(csvPath, csvContent);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                csvPath: '/app_data/aipage_n8n_export.csv',
                fileName: `aipage_n8n_export_${Date.now()}.csv`,
                csvContent,
              }));
            } else if (action === 'clear') {
              fs.writeFileSync(resultsFile, JSON.stringify([]));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } else {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid action' }));
            }
          } catch(e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      res.statusCode = 405;
      res.end('Method not allowed');
    });

    // === Article Stock (Persistent Article Library, Git-syncable) ===
    server.middlewares.use('/api/article-stock', (req, res) => {
      const stockFile = path.resolve(__dirname, 'public/app_data/article_stock.json');
      const dataDir = path.resolve(__dirname, 'public/app_data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

      const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      const mergeArticle = (existing: any, incoming: any) => {
        const mergedTags = Array.from(new Set([...(existing.tags || []), ...(incoming.tags || [])].filter(Boolean)));
        const incomingImages = Array.isArray(incoming.images) ? incoming.images.filter(Boolean) : [];
        const existingImages = Array.isArray(existing.images) ? existing.images.filter(Boolean) : [];
        const shouldReplaceImages = incoming.ytExtracted || incomingImages.length > existingImages.length;
        const mergedImages = shouldReplaceImages
          ? incomingImages
          : Array.from(new Set([...existingImages, ...incomingImages]));

        return {
          ...existing,
          ...incoming,
          id: existing.id || genId(),
          createdAt: existing.createdAt || incoming.createdAt || new Date().toISOString(),
          tags: mergedTags,
          images: mergedImages,
          thumbnail: incoming.thumbnail || existing.thumbnail,
          channelLogoUrl: incoming.channelLogoUrl || existing.channelLogoUrl,
          channelAvatar: incoming.channelAvatar || existing.channelAvatar,
          subscriberCount: incoming.subscriberCount ?? existing.subscriberCount,
          rawArticle: incoming.rawArticle || existing.rawArticle,
          updatedAt: new Date().toISOString(),
        };
      };

      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        if (!fs.existsSync(stockFile)) {
          res.end(JSON.stringify({ success: true, articles: [] }));
        } else {
          try {
            let data: any[] = JSON.parse(fs.readFileSync(stockFile, 'utf-8'));
            // Migrate: assign id to any article that's missing one
            let migrated = false;
            data = data.map((a: any) => {
              if (!a.id) { migrated = true; return { ...a, id: genId() }; }
              return a;
            });
            if (migrated) fs.writeFileSync(stockFile, JSON.stringify(data, null, 2));
            res.end(JSON.stringify({ success: true, articles: data }));
          } catch(e) {
            res.end(JSON.stringify({ success: true, articles: [] }));
          }
        }
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { action, item, items, id, ids, sentToAIPageAt, sourceUrl } = JSON.parse(body);
            let articles: any[] = [];
            if (fs.existsSync(stockFile)) {
              try { articles = JSON.parse(fs.readFileSync(stockFile, 'utf-8')); } catch(e) { articles = []; }
            }

            if (action === 'add' && item) {
              // Check duplicate by sourceUrl
              const existingIndex = articles.findIndex((a: any) => a.sourceUrl === item.sourceUrl);
              const exists = existingIndex >= 0;
              if (exists) {
                articles[existingIndex] = mergeArticle(articles[existingIndex], item);
              } else {
                articles.unshift({ id: genId(), ...item });
              }
              fs.writeFileSync(stockFile, JSON.stringify(articles, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, duplicate: exists, updated: exists ? 1 : 0 }));
            } else if (action === 'add-batch' && items && Array.isArray(items)) {
              let added = 0;
              let duplicates = 0;
              let updated = 0;
              for (const it of items) {
                const existingIndex = articles.findIndex((a: any) => a.sourceUrl === it.sourceUrl);
                if (existingIndex < 0) {
                  articles.unshift({ id: genId(), ...it });
                  added++;
                } else {
                  duplicates++;
                  articles[existingIndex] = mergeArticle(articles[existingIndex], it);
                  updated++;
                }
              }
              fs.writeFileSync(stockFile, JSON.stringify(articles, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, added, duplicates, updated }));
            } else if (action === 'update' && id && item) {
              articles = articles.map((a: any) => a.id === id ? { ...a, ...item } : a);
              fs.writeFileSync(stockFile, JSON.stringify(articles, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } else if (action === 'mark-sent' && Array.isArray(ids)) {
              const sentAt = sentToAIPageAt || new Date().toISOString();
              const idSet = new Set(ids);
              articles = articles.map((a: any) => idSet.has(a.id) ? { ...a, sentToAIPageAt: sentAt } : a);
              fs.writeFileSync(stockFile, JSON.stringify(articles, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, updated: ids.length }));
            } else if (action === 'mark-yt-extracted' && Array.isArray(ids)) {
              const idSet = new Set(ids);
              articles = articles.map((a: any) => idSet.has(a.id) ? { ...a, ytExtracted: true } : a);
              fs.writeFileSync(stockFile, JSON.stringify(articles, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, updated: ids.length }));
            } else if (action === 'delete-batch' && Array.isArray(ids)) {
              const idSet = new Set(ids);
              const before = articles.length;
              articles = articles.filter((a: any) => !idSet.has(a.id));
              fs.writeFileSync(stockFile, JSON.stringify(articles, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, deleted: before - articles.length }));
            } else if (action === 'mark-content-ready' && sourceUrl) {
              const now = new Date().toISOString();
              articles = articles.map((a: any) => a.sourceUrl === sourceUrl ? { ...a, contentReadyAt: now } : a);
              fs.writeFileSync(stockFile, JSON.stringify(articles, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } else {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid action' }));
            }
          } catch(e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      res.statusCode = 405;
      res.end('Method not allowed');
    });

    // === YouTube Post Results (Persistent, Git-syncable) ===
    server.middlewares.use('/api/yt-post-results', (req, res) => {
      const resultsFile = path.resolve(__dirname, 'public/app_data/yt_post_results.json');
      const dataDir = path.resolve(__dirname, 'public/app_data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        if (!fs.existsSync(resultsFile)) {
          res.end(JSON.stringify({ success: true, results: [] }));
        } else {
          try {
            const data = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
            res.end(JSON.stringify({ success: true, results: data }));
          } catch(e) {
            res.end(JSON.stringify({ success: true, results: [] }));
          }
        }
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { action, item, id } = JSON.parse(body);
            let results: any[] = [];
            if (fs.existsSync(resultsFile)) {
              try { results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8')); } catch(e) { results = []; }
            }

            if (action === 'add' && item) {
              results.unshift(item);
              fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } else if (action === 'delete' && id) {
              results = results.filter((r: any) => r.id !== id);
              fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } else if (action === 'clear') {
              fs.writeFileSync(resultsFile, JSON.stringify([]));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } else {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid action' }));
            }
          } catch(e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      res.statusCode = 405;
      res.end('Method not allowed');
    });

    // === YouTube Post - Save Image to Disk ===
    server.middlewares.use('/api/yt-save-image', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return; }
      let body = '';
      req.on('data', (chunk: any) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { imageUrl, base64Data, fileName } = JSON.parse(body);
          const saveDir = path.resolve(__dirname, 'public/app_data/yt_post_images');
          if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

          const safeName = (fileName || `img_${Date.now()}.png`).replace(/[<>:"/\\|?*]/g, '_');
          const filePath = path.join(saveDir, safeName);

          if (base64Data) {
            const b64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
            fs.writeFileSync(filePath, b64, 'base64');
          } else if (imageUrl) {
            const client = imageUrl.startsWith('https') ? https : http;
            await new Promise((resolve, reject) => {
              client.get(imageUrl, (response: any) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                  // Follow redirect
                  const redirectUrl = response.headers.location;
                  const rClient = redirectUrl.startsWith('https') ? https : http;
                  rClient.get(redirectUrl, (rRes: any) => {
                    if (rRes.statusCode === 200) {
                      const file = fs.createWriteStream(filePath);
                      rRes.pipe(file);
                      file.on('finish', () => { file.close(); resolve(true); });
                    } else { reject(new Error(`HTTP ${rRes.statusCode}`)); }
                  }).on('error', reject);
                } else if (response.statusCode === 200) {
                  const file = fs.createWriteStream(filePath);
                  response.pipe(file);
                  file.on('finish', () => { file.close(); resolve(true); });
                } else { reject(new Error(`HTTP ${response.statusCode}`)); }
              }).on('error', reject);
            });
          } else {
            throw new Error('No imageUrl or base64Data provided');
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, localPath: `/app_data/yt_post_images/${safeName}`, fileName: safeName }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    // === AI Page Post - Save Image to Disk ===
    server.middlewares.use('/api/aipage-save-image', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return; }
      let body = '';
      req.on('data', (chunk: any) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { imageUrl, base64Data, fileName } = JSON.parse(body);
          const saveDir = path.join(getAipageDataDir(), 'aipage_images');
          if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

          const safeName = (fileName || `img_${Date.now()}.png`).replace(/[<>:"/\\|?*]/g, '_');
          const filePath = path.join(saveDir, safeName);

          if (base64Data) {
            const b64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
            fs.writeFileSync(filePath, b64, 'base64');
          } else if (imageUrl) {
            const https = require('https');
            const http = require('http');
            const client = imageUrl.startsWith('https') ? https : http;
            await new Promise((resolve, reject) => {
              client.get(imageUrl, (response: any) => {
                if (response.statusCode === 200) {
                  const file = fs.createWriteStream(filePath);
                  response.pipe(file);
                  file.on('finish', () => { file.close(); resolve(true); });
                } else { reject(new Error(`HTTP ${response.statusCode}`)); }
              }).on('error', reject);
            });
          } else {
            throw new Error('No imageUrl or base64Data provided');
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, localPath: `/app_data/aipage_images/${safeName}`, fileName: safeName }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    // === Page Stock - Save generated image to a user-selected local folder ===
    server.middlewares.use('/api/page-stock-save-image', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return; }
      let body = '';
      req.on('data', (chunk: any) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { imageUrl, base64Data, fileName, saveDir, pageName } = JSON.parse(body);
          if (!saveDir || typeof saveDir !== 'string') throw new Error('Missing saveDir');
          const safePage = String(pageName || 'PageStock')
            .replace(/[<>:"/\\|?*\n\r]/g, '_')
            .replace(/\s+/g, '_')
            .slice(0, 80);
          const targetDir = path.join(saveDir, safePage);
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

          const safeName = String(fileName || `page_stock_${Date.now()}.png`)
            .normalize('NFKD')
            .replace(/[^\x20-\x7Eก-๙]/g, '')
            .replace(/[<>:"/\\|?*\n\r]/g, '_')
            .replace(/\s+/g, '_')
            .slice(0, 140) || `page_stock_${Date.now()}.png`;
          const filePath = path.join(targetDir, safeName);

          if (base64Data) {
            const b64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(filePath, b64, 'base64');
          } else if (imageUrl) {
            const client = String(imageUrl).startsWith('https') ? https : http;
            await new Promise((resolve, reject) => {
              client.get(imageUrl, (response: any) => {
                if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                  const redirectClient = String(response.headers.location).startsWith('https') ? https : http;
                  redirectClient.get(response.headers.location, (redirectResponse: any) => {
                    if (redirectResponse.statusCode !== 200) return reject(new Error(`HTTP ${redirectResponse.statusCode}`));
                    const file = fs.createWriteStream(filePath);
                    redirectResponse.pipe(file);
                    file.on('finish', () => { file.close(); resolve(true); });
                    file.on('error', reject);
                  }).on('error', reject);
                  return;
                }
                if (response.statusCode === 200) {
                  const file = fs.createWriteStream(filePath);
                  response.pipe(file);
                  file.on('finish', () => { file.close(); resolve(true); });
                  file.on('error', reject);
                } else {
                  reject(new Error(`HTTP ${response.statusCode}`));
                }
              }).on('error', reject);
            });
          } else {
            throw new Error('No imageUrl or base64Data provided');
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, localPath: filePath, fileName: safeName }));
        } catch(e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    // === Page Stock - Save run results JSON/CSV to disk ===
    server.middlewares.use('/api/page-stock-save-results', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return; }
      let body = '';
      req.on('data', (chunk: any) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { saveDir, results = [], csv = '' } = JSON.parse(body);
          if (!saveDir || typeof saveDir !== 'string') throw new Error('Missing saveDir');
          if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          const jsonPath = path.join(saveDir, `page_stock_results_${stamp}.json`);
          const csvPath = path.join(saveDir, `page_stock_results_${stamp}.csv`);
          fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
          if (csv) fs.writeFileSync(csvPath, '\uFEFF' + csv, 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, jsonPath, csvPath: csv ? csvPath : '' }));
        } catch(e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    // === Article Cache — remember generated content per article ===
    server.middlewares.use('/api/article-cache', (req, res) => {
      const cacheFile = path.resolve(__dirname, 'public/app_data/article_cache.json');
      if (!fs.existsSync(cacheFile)) fs.writeFileSync(cacheFile, '{}', 'utf-8');

      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        res.end(fs.readFileSync(cacheFile, 'utf-8'));
        return;
      }
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
      let body = '';
      req.on('data', (chunk: any) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { action, hash, data } = JSON.parse(body);
          const cache: Record<string, any> = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
          if (action === 'upsert') {
            cache[hash] = { ...(cache[hash] || {}), ...data, hash, lastUpdatedAt: new Date().toISOString() };
            fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } else {
            res.statusCode = 400; res.end(JSON.stringify({ error: 'Unknown action' }));
          }
        } catch (e: any) {
          res.statusCode = 500; res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    // === Image Proxy (bypass CORS for canvas) ===
    server.middlewares.use('/api/proxy-image', async (req, res) => {
      const rawUrl = new URLSearchParams((req.url || '').split('?')[1] || '').get('url') || '';
      if (!rawUrl.startsWith('http')) { res.statusCode = 400; res.end('Bad url'); return; }
      try {
        const origin = new URL(rawUrl).origin;
        const upstream = await fetch(rawUrl, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Referer': origin + '/',
          },
        });
        if (!upstream.ok) {
          res.statusCode = upstream.status;
          res.end(`Image fetch failed: ${upstream.status}`);
          return;
        }
        const ct = upstream.headers.get('content-type') || 'image/jpeg';
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.setHeader('Content-Type', ct);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.end(buf);
      } catch (e: any) {
        res.statusCode = 502;
        res.end(e.message);
      }
    });

    // === KIE.AI Proxy (bypass CORS) ===
    server.middlewares.use('/api/kie-create', async (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return; }
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { apiKey, ...payload } = JSON.parse(body);
          const trimmedKey = (apiKey || '').trim();
          const postData = JSON.stringify(payload);
          console.log('[KIE-CREATE] key len:', trimmedKey.length, 'payload len:', postData.length);
          
          const https = require('https');
          const options = {
            hostname: 'api.kie.ai',
            path: '/api/v1/jobs/createTask',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${trimmedKey}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          };
          
          const proxyReq = https.request(options, (proxyRes: any) => {
            let data = '';
            proxyRes.on('data', (chunk: any) => { data += chunk; });
            proxyRes.on('end', () => {
              console.log('[KIE-CREATE] Response:', proxyRes.statusCode, data.substring(0, 200));
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = proxyRes.statusCode;
              res.end(data);
            });
          });
          proxyReq.on('error', (e: any) => {
            console.error('[KIE-CREATE] Request error:', e.message);
            res.statusCode = 500;
            res.end(JSON.stringify({ code: 500, msg: e.message }));
          });
          proxyReq.write(postData);
          proxyReq.end();
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ code: 500, msg: e.message }));
        }
      });
    });

    server.middlewares.use('/api/kie-status', (req, res) => {
      try {
        const urlMod = require('url');
        const parsed = urlMod.parse(req.url || '', true);
        const taskId = parsed.query.taskId as string;
        const apiKey = (parsed.query.apiKey as string || '').trim();
        if (!taskId || !apiKey) { res.statusCode = 400; res.end(JSON.stringify({ code: 400, msg: 'Missing params' })); return; }
        
        const https = require('https');
        const options = {
          hostname: 'api.kie.ai',
          path: `/api/v1/jobs/recordInfo?taskId=${taskId}`,
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` }
        };
        console.log('[KIE-STATUS] Polling taskId:', taskId);
        
        const proxyReq = https.request(options, (proxyRes: any) => {
          let data = '';
          proxyRes.on('data', (chunk: any) => { data += chunk; });
          proxyRes.on('end', () => {
            console.log('[KIE-STATUS] Raw response:', data.substring(0, 500));
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          });
        });
        proxyReq.on('error', (e: any) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ code: 500, msg: e.message }));
        });
        proxyReq.end();
      } catch(e: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ code: 500, msg: e.message }));
      }
    });

    // === Canvas Editor Folder API ===
    server.middlewares.use('/api/canvas-folders', async (req, res) => {
      const canvasDir = path.resolve(__dirname, 'public/app_data/canvas_projects');
      if (!fs.existsSync(canvasDir)) fs.mkdirSync(canvasDir, { recursive: true });

      if (req.method === 'GET') {
        try {
          const folders = fs.readdirSync(canvasDir).filter((f: string) => fs.statSync(path.join(canvasDir, f)).isDirectory());
          const result = folders.map((f: string) => {
            const files = fs.readdirSync(path.join(canvasDir, f)).filter((x: string) => /\.(png|jpg|jpeg|gif|webp)$/i.test(x));
            return { name: f, fileCount: files.length };
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, folders: result }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { name } = JSON.parse(body);
            if (!name || !name.trim()) throw new Error('Folder name required');
            const safeName = name.trim().replace(/[<>:"/\\|?*]/g, '_');
            const folderPath = path.join(canvasDir, safeName);
            if (fs.existsSync(folderPath)) throw new Error('Folder already exists');
            fs.mkdirSync(folderPath, { recursive: true });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, name: safeName }));
          } catch(e: any) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      res.statusCode = 405;
      res.end('Method not allowed');
    });

    server.middlewares.use('/api/canvas-files', async (req, res) => {
      const canvasDir = path.resolve(__dirname, 'public/app_data/canvas_projects');
      const url = new URL(req.url || '', 'http://localhost');
      const folder = url.searchParams.get('folder');

      if (!folder) { res.statusCode = 400; res.end(JSON.stringify({ error: 'folder param required' })); return; }
      const folderPath = path.join(canvasDir, folder);
      if (!fs.existsSync(folderPath)) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Folder not found' })); return; }

      if (req.method === 'GET') {
        try {
          const files = fs.readdirSync(folderPath)
            .filter((f: string) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
            .map((f: string) => ({ name: f, url: '/app_data/canvas_projects/' + folder + '/' + f }));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, files }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      res.statusCode = 405;
      res.end('Method not allowed');
    });

    server.middlewares.use('/api/canvas-open-folder', async (req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
          try {
            const { folder } = JSON.parse(body);
            if (!folder) throw new Error('Folder name required');
            const canvasDir = path.resolve(__dirname, 'public/app_data/canvas_projects');
            const folderPath = path.join(canvasDir, folder);
            if (!fs.existsSync(folderPath)) throw new Error('Folder not found');

            // Open folder on Mac
            require('child_process').exec(`open "${folderPath}"`);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }
      res.statusCode = 405;
      res.end('Method not allowed');
    });

    // === Style Templates Folder APIs ===
    server.middlewares.use('/api/style-folders', async (req, res) => {
      const styleDir = path.resolve(__dirname, 'public/app_data/style_templates');
      if (!fs.existsSync(styleDir)) fs.mkdirSync(styleDir, { recursive: true });

      if (req.method === 'GET') {
        try {
          const folders = fs.readdirSync(styleDir).filter((f: string) => fs.statSync(path.join(styleDir, f)).isDirectory());
          const result = folders.map((f: string) => {
            const files = fs.readdirSync(path.join(styleDir, f)).filter((x: string) => /\.(png|jpg|jpeg|gif|webp)$/i.test(x));
            return { name: f, fileCount: files.length };
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, folders: result }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { name } = JSON.parse(body);
            if (!name || !name.trim()) throw new Error('Folder name required');
            const safeName = name.trim().replace(/[<>:"/\\|?*]/g, '_');
            const folderPath = path.join(styleDir, safeName);
            if (fs.existsSync(folderPath)) throw new Error('Folder already exists');
            fs.mkdirSync(folderPath, { recursive: true });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, name: safeName }));
          } catch(e: any) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      res.statusCode = 405;
      res.end('Method not allowed');
    });

    server.middlewares.use('/api/style-files', async (req, res) => {
      const styleDir = path.resolve(__dirname, 'public/app_data/style_templates');
      const url = new URL(req.url || '', 'http://localhost');
      const folder = url.searchParams.get('folder');

      if (!folder) { res.statusCode = 400; res.end(JSON.stringify({ error: 'folder param required' })); return; }
      const folderPath = path.join(styleDir, folder);
      if (!fs.existsSync(folderPath)) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Folder not found' })); return; }

      if (req.method === 'GET') {
        try {
          const files = fs.readdirSync(folderPath)
            .filter((f: string) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
            .map((f: string) => ({ name: f, url: '/app_data/style_templates/' + folder + '/' + f }));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, files }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      res.statusCode = 405;
      res.end('Method not allowed');
    });

    server.middlewares.use('/api/style-open-folder', async (req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
          try {
            const { folder } = JSON.parse(body);
            if (!folder) throw new Error('Folder name required');
            const styleDir = path.resolve(__dirname, 'public/app_data/style_templates');
            const folderPath = path.join(styleDir, folder);
            if (!fs.existsSync(folderPath)) throw new Error('Folder not found');

            // Open folder on Mac
            require('child_process').exec(`open "${folderPath}"`);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }
      res.statusCode = 405;
      res.end('Method not allowed');
    });

    // === AI Page Templates Folder APIs ===
    server.middlewares.use('/api/aipage-folders', async (req, res) => {
      const aipageDir = path.resolve(__dirname, 'public/app_data/aipage_templates');
      if (!fs.existsSync(aipageDir)) fs.mkdirSync(aipageDir, { recursive: true });

      if (req.method === 'GET') {
        try {
          const folders = fs.readdirSync(aipageDir).filter((f: string) => fs.statSync(path.join(aipageDir, f)).isDirectory());
          const result = folders.map((f: string) => {
            const files = fs.readdirSync(path.join(aipageDir, f)).filter((x: string) => /\.(png|jpg|jpeg|gif|webp)$/i.test(x));
            return { name: f, fileCount: files.length };
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, folders: result }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { name } = JSON.parse(body);
            if (!name || !name.trim()) throw new Error('Folder name required');
            const safeName = name.trim().replace(/[<>:"/\\|?*]/g, '_');
            const folderPath = path.join(aipageDir, safeName);
            if (fs.existsSync(folderPath)) throw new Error('Folder already exists');
            fs.mkdirSync(folderPath, { recursive: true });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, name: safeName }));
          } catch(e: any) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      res.statusCode = 405;
      res.end('Method not allowed');
    });

    server.middlewares.use('/api/aipage-files', async (req, res) => {
      const aipageDir = path.resolve(__dirname, 'public/app_data/aipage_templates');
      const url = new URL(req.url || '', 'http://localhost');
      const folder = url.searchParams.get('folder');

      if (!folder) { res.statusCode = 400; res.end(JSON.stringify({ error: 'folder param required' })); return; }
      const folderPath = path.join(aipageDir, folder);
      if (!fs.existsSync(folderPath)) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Folder not found' })); return; }

      if (req.method === 'GET') {
        try {
          const files = fs.readdirSync(folderPath)
            .filter((f: string) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
            .map((f: string) => ({ name: f, url: '/app_data/aipage_templates/' + folder + '/' + f }));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, files }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      res.statusCode = 405;
      res.end('Method not allowed');
    });

    server.middlewares.use('/api/aipage-open-folder', async (req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
          try {
            const { folder } = JSON.parse(body);
            if (!folder) throw new Error('Folder name required');
            const aipageDir = path.resolve(__dirname, 'public/app_data/aipage_templates');
            const folderPath = path.join(aipageDir, folder);
            if (!fs.existsSync(folderPath)) throw new Error('Folder not found');

            // Open folder on Mac
            require('child_process').exec(`open "${folderPath}"`);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }
      res.statusCode = 405;
      res.end('Method not allowed');
    });

    server.middlewares.use('/api/canvas-save-image-url', async (req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
          try {
            const { folder, imageUrl } = JSON.parse(body);
            if (!folder || !imageUrl) throw new Error('Missing folder or imageUrl');
            
            const canvasDir = path.resolve(__dirname, 'public/app_data/canvas_projects');
            const folderPath = path.join(canvasDir, folder);
            if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

            const fileName = `img_${Date.now()}.png`;
            const filePath = path.join(folderPath, fileName);

            // Fetch image and save
            const https = require('https');
            const http = require('http');
            const client = imageUrl.startsWith('https') ? https : http;
            
            await new Promise((resolve, reject) => {
              client.get(imageUrl, (response: any) => {
                if (response.statusCode === 200) {
                  const file = fs.createWriteStream(filePath);
                  response.pipe(file);
                  file.on('finish', () => { file.close(); resolve(true); });
                } else {
                  reject(new Error(`Failed to fetch image: ${response.statusCode}`));
                }
              }).on('error', reject);
            });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, fileName }));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }
      res.statusCode = 405;
      res.end('Method not allowed');
    });

    server.middlewares.use('/api/dropbox-upload', async (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return; }
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { imageUrl, base64Data, fileName, folderPath, accessToken, refreshToken, appKey, appSecret } = JSON.parse(body);
          let token = accessToken;
          let refreshedToken = '';
          const refreshDropboxAccessToken = async (rt: string, key: string, secret: string) => {
            const postData = `grant_type=refresh_token&refresh_token=${encodeURIComponent(rt)}&client_id=${encodeURIComponent(key)}&client_secret=${encodeURIComponent(secret)}`;
            const refreshRes: string = await new Promise((resolve, reject) => {
              const r = https.request({
                hostname: 'api.dropboxapi.com', path: '/oauth2/token', method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
              }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
              r.on('error', reject); r.write(postData); r.end();
            });
            const rd = JSON.parse(refreshRes);
            if (!rd.access_token) throw new Error(rd.error_description || rd.error || 'Dropbox refresh token failed');
            return rd.access_token;
          };

          const persistRefreshedToken = (newToken: string) => {
            try {
              const profilesPath = path.resolve(__dirname, 'public/app_data/api_profiles.json');
              if (!fs.existsSync(profilesPath)) return;
              const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
              if (!Array.isArray(profiles)) return;
              const idx = profiles.findIndex((p: any) =>
                (accessToken && p.dropboxKey === accessToken) ||
                (refreshToken && p.dropboxRefreshToken === refreshToken)
              );
              if (idx >= 0) {
                profiles[idx].dropboxKey = newToken;
                fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2), 'utf-8');
              }
            } catch(e) {
              console.warn('[DROPBOX] Failed to persist refreshed access token');
            }
          };

          // Refresh token if we have refresh credentials
          if (refreshToken && appKey && appSecret) {
            try {
              refreshedToken = await refreshDropboxAccessToken(refreshToken, appKey, appSecret);
              token = refreshedToken;
              persistRefreshedToken(refreshedToken);
            } catch(e: any) { console.warn('[DROPBOX] Token refresh failed:', e.message); }
          }

          if (!token) throw new Error('No Dropbox access token');

          // Download or construct the image buffer
          const imageBuffer: Buffer = await new Promise((resolve, reject) => {
            if (base64Data) {
              const b64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
              resolve(Buffer.from(b64, 'base64'));
              return;
            }
            if (!imageUrl) {
               return reject(new Error('Missing imageUrl or base64Data'));
            }
            const proto = imageUrl.startsWith('https') ? https : http;
            proto.get(imageUrl, (r: any) => {
              const chunks: Buffer[] = [];
              r.on('data', (c: any) => chunks.push(c));
              r.on('end', () => resolve(Buffer.concat(chunks)));
              r.on('error', reject);
            }).on('error', reject);
          });

          // Upload to Dropbox
          const cleanFolder = (`/${folderPath || 'Apps/YTViralPost'}`)
            .replace(/\/+/g, '/')
            .replace(/\.\./g, '')
            .replace(/\/$/, '');
          const safeDropboxName = String(fileName || `aipage_${Date.now()}.png`)
            .normalize('NFKD')
            .replace(/[^\x20-\x7E]/g, '')
            .replace(/[<>:"/\\|?*\n\r]/g, '_')
            .replace(/\s+/g, '_')
            .slice(0, 120) || `aipage_${Date.now()}.png`;
          const uploadPath = `${cleanFolder}/${safeDropboxName}`;
          const toAsciiHeaderJson = (value: any) => JSON.stringify(value).replace(/[^\x20-\x7E]/g, (ch) =>
            `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
          );
          const dropboxApiArg = toAsciiHeaderJson({ path: uploadPath, mode: 'add', autorename: true, mute: false });
          const uploadToDropbox = async (uploadToken: string): Promise<string> => new Promise((resolve, reject) => {
            const r = https.request({
              hostname: 'content.dropboxapi.com', path: '/2/files/upload', method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + uploadToken,
                'Dropbox-API-Arg': dropboxApiArg,
                'Content-Type': 'application/octet-stream', 'Content-Length': imageBuffer.length
              }
            }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
            r.on('error', reject); r.write(imageBuffer); r.end();
          });

          let uploadData = JSON.parse(await uploadToDropbox(token));
          if (uploadData.error?.['.tag'] === 'expired_access_token' && refreshToken && appKey && appSecret) {
            refreshedToken = await refreshDropboxAccessToken(refreshToken, appKey, appSecret);
            token = refreshedToken;
            persistRefreshedToken(refreshedToken);
            uploadData = JSON.parse(await uploadToDropbox(token));
          }
          if (uploadData.error?.['.tag'] === 'expired_access_token') {
            throw new Error('Dropbox access token หมดอายุ และยังไม่มี refresh token ในโปรไฟล์ กรุณากด “ยืนยันสิทธิ์ Dropbox อัตโนมัติ” อีกครั้งในหน้าตั้งค่า แล้วบันทึกโปรไฟล์');
          }
          if (uploadData.error) throw new Error(JSON.stringify(uploadData.error));
          const filePath = uploadData.path_display || uploadPath;

          // Create shared link
          const shareBody = JSON.stringify({ path: filePath, settings: { requested_visibility: 'public' } });
          const shareRes: string = await new Promise((resolve, reject) => {
            const r = https.request({
              hostname: 'api.dropboxapi.com', path: '/2/sharing/create_shared_link_with_settings', method: 'POST',
              headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(shareBody) }
            }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
            r.on('error', reject); r.write(shareBody); r.end();
          });

          let shareData = JSON.parse(shareRes);

          // If link already exists, get it
          if (shareData.error && shareData.error['.tag'] === 'shared_link_already_exists') {
            const listBody = JSON.stringify({ path: filePath });
            const listRes: string = await new Promise((resolve, reject) => {
              const r = https.request({
                hostname: 'api.dropboxapi.com', path: '/2/sharing/list_shared_links', method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(listBody) }
              }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
              r.on('error', reject); r.write(listBody); r.end();
            });
            const listData = JSON.parse(listRes);
            shareData = listData.links?.[0] || {};
          }

          const sharedUrl = shareData.url || '';
          const directUrl = sharedUrl ? sharedUrl.replace(/\?dl=0$/, '?dl=1').replace(/\?dl=0&/, '?dl=1&') : '';
          if (!directUrl && sharedUrl) { /* fallback */ }
          const finalUrl = directUrl || (sharedUrl ? sharedUrl.split('?')[0] + '?dl=1' : '');

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, dropboxPath: filePath, sharedUrl, directUrl: finalUrl, url: finalUrl }));
        } catch(e: any) {
          console.error('[DROPBOX-UPLOAD] Error:', e.message);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });
    server.middlewares.use('/api/website-extract', async (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { url } = JSON.parse(body);
          if (!url) throw new Error('Missing URL');

          const response = await fetch(url, {
             headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
          });
          const html = await response.text();

          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          const title = titleMatch ? titleMatch[1].trim() : 'Website Post';

          const images = new Set<string>();
          const normalizeImageUrl = (src: string) => {
            let next = (src || '').trim().replace(/&amp;/g, '&');
            if (!next || next.startsWith('data:') || next.startsWith('blob:')) return '';
            if (next.startsWith('//')) next = 'https:' + next;
            else if (next.startsWith('/')) { try { const u = new URL(url); next = u.origin + next; } catch(e){} }
            else if (!next.startsWith('http')) { try { next = new URL(next, url).href; } catch(e){} }
            return next.startsWith('http') ? next : '';
          };
          const addImage = (src: string) => {
            const normalized = normalizeImageUrl(src);
            if (normalized) images.add(normalized);
          };

          const metaImageRegex = /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["'][^>]*content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["'][^>]*>/gi;
          let metaMatch;
          while ((metaMatch = metaImageRegex.exec(html)) !== null) {
            addImage(metaMatch[1] || metaMatch[2] || '');
          }

          const linkImageRegex = /<link[^>]+rel=["'][^"']*(?:image_src|preload)[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
          let linkMatch;
          while ((linkMatch = linkImageRegex.exec(html)) !== null) addImage(linkMatch[1]);

          const imgTagRegex = /<img\b[^>]*>/gi;
          let imgTagMatch;
          while ((imgTagMatch = imgTagRegex.exec(html)) !== null) {
            const tag = imgTagMatch[0];
            const attrRegex = /\b(?:src|data-src|data-original|data-lazy-src|data-url)=["']([^"']+)["']/gi;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(tag)) !== null) addImage(attrMatch[1]);

            const srcsetMatch = tag.match(/\b(?:srcset|data-srcset)=["']([^"']+)["']/i);
            if (srcsetMatch) {
              srcsetMatch[1].split(',').forEach(part => addImage(part.trim().split(/\s+/)[0]));
            }
          }

          let cleanHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
                              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
          let textContent = cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ 
             success: true, 
             title, 
             images: Array.from(images).filter(img => img.startsWith('http')).slice(0, 30),
             content: textContent.substring(0, 15000)
          }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    server.middlewares.use('/api/youtube-channel-scan', async (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { channelUrl, limit = 30 } = JSON.parse(body);
          const scanLimit = Math.max(5, Math.min(200, Number(limit) || 30));
          if (!channelUrl) throw new Error('Missing YouTube channel URL');

          const { execFileSync } = require('child_process');
          const raw = execFileSync('yt-dlp', [
            '--dump-json',
            '--no-warnings',
            '--ignore-errors',
            '--playlist-end',
            String(scanLimit),
            channelUrl,
          ], { timeout: 180000, maxBuffer: 1024 * 1024 * 60 }).toString();

          const rows = raw
            .split('\n')
            .map((line: string) => line.trim())
            .filter(Boolean)
            .map((line: string) => {
              try { return JSON.parse(line); } catch { return null; }
            })
            .filter(Boolean);

          if (rows.length === 0) {
            throw new Error('ไม่พบคลิปจากช่องนี้ หรือ yt-dlp ดึงข้อมูลไม่ได้');
          }

          const first = rows[0] || {};
          const channelInfo = {
            name: first.channel || first.uploader || first.playlist_title || '',
            description: first.channel_description || first.uploader || '',
            subscribers: first.channel_follower_count ?? first.uploader_follower_count ?? null,
            logoUrl: first.channel_thumbnail || first.thumbnail || '',
          };

          const videos = rows.map((v: any) => {
            const videoId = v.id || v.display_id || `${Date.now()}-${Math.random()}`;
            const webpageUrl = v.webpage_url || v.original_url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : channelUrl);
            const thumbnails = Array.isArray(v.thumbnails) ? v.thumbnails : [];
            const bestThumb = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1]?.url : '';

            return {
              id: videoId,
              title: v.title || '(ไม่มีชื่อคลิป)',
              url: webpageUrl,
              views: v.view_count ?? null,
              description: v.description || '',
              uploadedAt: v.upload_date || v.release_date || v.timestamp || '',
              thumbnail: v.thumbnail || bestThumb || '',
              duration: v.duration ?? null,
              viralScore: null,
              evergreenScore: null,
            };
          });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, channelInfo, videos }));
        } catch(e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: e.message || String(e) }));
        }
      });
    });

    server.middlewares.use('/api/short-clip-download', async (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { url, mode = 'single', limit = 5, apifyKey: requestApifyKey = '' } = JSON.parse(body);
          const clipLimit = mode === 'latest' ? Math.max(1, Math.min(30, Number(limit) || 5)) : 1;
          if (!url) throw new Error('Missing clip/channel URL');

          const { execFileSync } = require('child_process');
          const baseDir = path.resolve(__dirname, 'public/short_clip_refs');
          const runId = `run_${Date.now()}`;
          const runDir = path.join(baseDir, runId);
          if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });

          const isFacebook = /(^|\.)facebook\.com|(^|\.)fb\.watch/i.test(url);
          let targetUrls = [url];

          if (isFacebook && mode === 'latest') {
            const profilesPath = path.resolve(__dirname, 'public/app_data/api_profiles.json');
            let apifyKey = String(requestApifyKey || '').trim();
            if (fs.existsSync(profilesPath)) {
              try {
                const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
                if (!apifyKey && Array.isArray(profiles)) {
                  apifyKey = profiles.find((p: any) => p.apifyKey)?.apifyKey || '';
                }
              } catch(e) {}
            }
            if (!apifyKey) {
              throw new Error('ลิงก์ Facebook หน้าโปรไฟล์/แท็บ reels ต้องใช้ Apify API Key เพื่อดึงรายการคลิปล่าสุดก่อน กรุณาใส่ Apify Key ในตั้งค่า หรือใช้ลิงก์ Reel/Video โดยตรง');
            }

            const apifyRes = await fetch(`https://api.apify.com/v2/acts/apify~facebook-posts-scraper/run-sync-get-dataset-items?token=${apifyKey}&timeout=300`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                startUrls: [{ url }],
                resultsLimit: clipLimit,
              }),
            });
            if (!apifyRes.ok) {
              const errText = await apifyRes.text().catch(() => '');
              throw new Error(`Apify ดึงรายการคลิป Facebook ไม่สำเร็จ (${apifyRes.status})${apifyRes.status === 403 ? ' — API key นี้ไม่มีสิทธิ์ใช้ actor facebook-posts-scraper หรือ key ไม่ตรงโปรไฟล์' : ''}${errText ? `: ${errText.substring(0, 180)}` : ''}`);
            }
            const rows: any[] = await apifyRes.json();
            targetUrls = Array.from(new Set(
              (Array.isArray(rows) ? rows : [])
                .map((item: any) => item.url || item.topLevelUrl || item.facebookUrl || item.postUrl)
                .filter((u: string) => typeof u === 'string' && u.includes('facebook.com'))
            )).slice(0, clipLimit);

            if (targetUrls.length === 0) {
              throw new Error('Apify ดึงรายการมาได้ แต่ไม่พบ URL คลิป Facebook ที่ดาวน์โหลดได้');
            }
          }

          const downloadOne = (targetUrl: string, index: number) => {
            const outputDir = targetUrls.length > 1 ? path.join(runDir, String(index + 1).padStart(2, '0')) : runDir;
            if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
            execFileSync('yt-dlp', [
              '--no-warnings',
              '--ignore-errors',
              '--playlist-end',
              '1',
              '-f',
              'bv*[height<=720]+ba/b[height<=720]/best',
              '--merge-output-format',
              'mp4',
              '-o',
              path.join(outputDir, '%(title).80s_%(id)s.%(ext)s'),
              targetUrl,
            ], { timeout: 1000 * 60 * 8, maxBuffer: 1024 * 1024 * 20 });
          };

          const errors: string[] = [];
          for (let i = 0; i < targetUrls.length; i++) {
            try {
              downloadOne(targetUrls[i], i);
            } catch (e: any) {
              errors.push(`${i + 1}. ${e.message || String(e)}`);
            }
          }

          const videoFiles = fs.readdirSync(runDir)
            .flatMap((entry: string) => {
              const entryPath = path.join(runDir, entry);
              if (fs.statSync(entryPath).isDirectory()) {
                return fs.readdirSync(entryPath).map((f: string) => `${entry}/${f}`);
              }
              return [entry];
            })
            .filter((f: string) => /\.(mp4|webm|mov|mkv)$/i.test(f))
            .sort();

          const clips = videoFiles.map((fileName: string, idx: number) => {
            const videoPath = path.join(runDir, fileName);
            const thumbName = `${path.parse(fileName).name}.jpg`;
            const thumbPath = path.join(path.dirname(videoPath), thumbName);
            try {
              execFileSync('ffmpeg', [
                '-y',
                '-ss',
                '00:00:01',
                '-i',
                videoPath,
                '-vframes',
                '1',
                '-q:v',
                '3',
                thumbPath,
              ], { timeout: 30000, stdio: 'ignore' });
            } catch(e) {
              console.warn('[short-clip-download] thumbnail failed', fileName);
            }

            return {
              id: `${runId}_${idx}`,
              name: path.basename(fileName),
              url: `/short_clip_refs/${runId}/${fileName.split('/').map((p: string) => encodeURIComponent(p)).join('/')}`,
              thumbnail: fs.existsSync(thumbPath) ? `/short_clip_refs/${runId}/${fileName.split('/').slice(0, -1).map((p: string) => encodeURIComponent(p)).join('/')}${fileName.includes('/') ? '/' : ''}${encodeURIComponent(thumbName)}` : '',
              sourceUrl: url,
            };
          });

          if (clips.length === 0) {
            const fbHint = isFacebook
              ? 'ถ้าเป็น Facebook profile/reels tab ให้ใช้ปุ่มโหลดคลิปล่าสุดและต้องมี Apify Key หรือวางลิงก์ Reel/Video ตรงๆ'
              : 'ลองตรวจว่าลิงก์เป็นคลิป/ช่องสาธารณะหรือไม่';
            throw new Error(`ดาวน์โหลดไม่สำเร็จ หรือไม่พบไฟล์วิดีโอจากลิงก์นี้ (${fbHint})${errors.length ? `\n${errors.slice(0, 2).join('\n')}` : ''}`);
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, clips }));
        } catch(e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: e.message || String(e) }));
        }
      });
    });

    server.middlewares.use('/api/short-cover-fetch', async (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { url, limit = 30, apifyKey: requestApifyKey = '' } = JSON.parse(body);
          const coverLimit = Math.max(1, Math.min(120, Number(limit) || 30));
          if (!url) throw new Error('Missing channel/profile URL');
          const coverDir = path.resolve(__dirname, 'public/app_data/short_clip_covers');
          if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true });

          const downloadImageToLocal = async (imageUrl: string, idx: number) => {
            const extFromUrl = (() => {
              try {
                const parsed = new URL(imageUrl);
                const ext = path.extname(parsed.pathname).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
              } catch { return '.jpg'; }
            })();
            const fileName = `cover_${Date.now()}_${idx}${extFromUrl}`;
            const filePath = path.join(coverDir, fileName);
            const client = imageUrl.startsWith('https') ? https : http;
            await new Promise((resolve, reject) => {
              const request = client.get(imageUrl, (response: any) => {
                if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                  const redirectUrl = response.headers.location;
                  if (!redirectUrl) return reject(new Error('Image redirect missing location'));
                  const redirectClient = redirectUrl.startsWith('https') ? https : http;
                  redirectClient.get(redirectUrl, (redirectResponse: any) => {
                    if (redirectResponse.statusCode !== 200) return reject(new Error(`Image HTTP ${redirectResponse.statusCode}`));
                    const file = fs.createWriteStream(filePath);
                    redirectResponse.pipe(file);
                    file.on('finish', () => { file.close(); resolve(true); });
                  }).on('error', reject);
                  return;
                }
                if (response.statusCode !== 200) return reject(new Error(`Image HTTP ${response.statusCode}`));
                const file = fs.createWriteStream(filePath);
                response.pipe(file);
                file.on('finish', () => { file.close(); resolve(true); });
              });
              request.setTimeout(30000, () => request.destroy(new Error('Image download timeout')));
              request.on('error', reject);
            });
            return `/app_data/short_clip_covers/${fileName}`;
          };

          const isFacebook = /(^|\.)facebook\.com|(^|\.)fb\.watch/i.test(url);
          let covers: any[] = [];

          if (isFacebook) {
            const profilesPath = path.resolve(__dirname, 'public/app_data/api_profiles.json');
            let apifyKey = String(requestApifyKey || '').trim();
            if (fs.existsSync(profilesPath)) {
              try {
                const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
                if (!apifyKey && Array.isArray(profiles)) {
                  apifyKey = profiles.find((p: any) => p.apifyKey)?.apifyKey || '';
                }
              } catch(e) {}
            }
            if (!apifyKey) {
              throw new Error('การดึงรูปปกจาก Facebook ต้องใช้ Apify API Key กรุณาใส่ Apify Key ในตั้งค่าก่อน');
            }

            const apifyRes = await fetch(`https://api.apify.com/v2/acts/apify~facebook-posts-scraper/run-sync-get-dataset-items?token=${apifyKey}&timeout=300`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                startUrls: [{ url }],
                resultsLimit: coverLimit,
              }),
            });
            if (!apifyRes.ok) {
              const errText = await apifyRes.text().catch(() => '');
              throw new Error(`Apify ดึงรูปปก Facebook ไม่สำเร็จ (${apifyRes.status})${apifyRes.status === 403 ? ' — API key นี้ไม่มีสิทธิ์ใช้ actor facebook-posts-scraper หรือ key ไม่ตรงโปรไฟล์' : ''}${errText ? `: ${errText.substring(0, 180)}` : ''}`);
            }
            const rows: any[] = await apifyRes.json();
            covers = (Array.isArray(rows) ? rows : []).flatMap((item: any, idx: number) => {
              const candidates = [
                item.thumbnail,
                item.thumbnailUrl,
                item.image,
                item.imageUrl,
                item.picture,
                item.fullPicture,
                item.videoThumbnail,
                item.media?.[0]?.thumbnail,
                item.media?.[0]?.thumbnailUrl,
                item.media?.[0]?.url,
                item.media?.[0]?.image,
              ].filter((x: any) => typeof x === 'string' && x.startsWith('http'));
              return candidates.slice(0, 1).map((imageUrl: string) => ({
                id: item.postId || item.facebookId || `${Date.now()}_${idx}`,
                title: item.text?.substring?.(0, 80) || `Facebook cover ${idx + 1}`,
                imageUrl,
                sourceUrl: item.url || item.topLevelUrl || url,
              }));
            });
          } else {
            const { execFileSync } = require('child_process');
            const raw = execFileSync('yt-dlp', [
              '--dump-json',
              '--no-warnings',
              '--ignore-errors',
              '--playlist-end',
              String(coverLimit),
              url,
            ], { timeout: 180000, maxBuffer: 1024 * 1024 * 60 }).toString();

            const rows = raw
              .split('\n')
              .map((line: string) => line.trim())
              .filter(Boolean)
              .map((line: string) => {
                try { return JSON.parse(line); } catch { return null; }
              })
              .filter(Boolean);

            covers = rows.map((item: any, idx: number) => {
              const thumbnails = Array.isArray(item.thumbnails) ? item.thumbnails : [];
              const bestThumb = thumbnails
                .filter((t: any) => t?.url)
                .sort((a: any, b: any) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)))[0]?.url;
              return {
                id: item.id || `${Date.now()}_${idx}`,
                title: item.title || `Cover ${idx + 1}`,
                imageUrl: item.thumbnail || bestThumb || '',
                sourceUrl: item.webpage_url || item.original_url || url,
              };
            }).filter((item: any) => item.imageUrl);
          }

          const unique = Array.from(new Map(covers.map((c: any) => [c.imageUrl, c])).values()).slice(0, coverLimit);
          if (unique.length === 0) {
            throw new Error('ดึงข้อมูลได้ แต่ไม่พบรูปปก/thumbnail จากลิงก์นี้');
          }

          const localized = [];
          for (let i = 0; i < unique.length; i++) {
            const cover: any = unique[i];
            try {
              const localPath = await downloadImageToLocal(cover.imageUrl, i);
              localized.push({ ...cover, remoteImageUrl: cover.imageUrl, imageUrl: localPath });
            } catch(e) {
              console.warn('[short-cover-fetch] save cover failed', cover.imageUrl, e);
              localized.push(cover);
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, covers: localized }));
        } catch(e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: e.message || String(e) }));
        }
      });
    });

    server.middlewares.use('/api/short-asset-save', async (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { base64Data, prefix = 'asset' } = JSON.parse(body);
          if (!base64Data) throw new Error('Missing base64Data');
          const saveDir = path.resolve(__dirname, 'public/app_data/short_clip_assets');
          if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
          const mimeMatch = String(base64Data).match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
          const ext = mimeMatch?.[1]?.includes('png') ? '.png' : mimeMatch?.[1]?.includes('webp') ? '.webp' : '.jpg';
          const safePrefix = String(prefix).replace(/[^a-zA-Z0-9_-]/g, '_');
          const fileName = `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
          const filePath = path.join(saveDir, fileName);
          const b64 = String(base64Data).replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
          fs.writeFileSync(filePath, b64, 'base64');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, localPath: `/app_data/short_clip_assets/${fileName}` }));
        } catch(e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: e.message || String(e) }));
        }
      });
    });

    server.middlewares.use('/api/youtube-extract', async (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { url, time = 30, frameCount = 10 } = JSON.parse(body);
          const numFrames = Math.max(1, Math.min(30, Number(frameCount) || 10));
          if (!url) throw new Error('Missing YouTube URL');

          const { execSync } = require('child_process');

          // === 1. TRANSCRIPT ===
          let transcriptText = '';

          const parseVtt = (vttContent: string): string =>
            vttContent.split('\n')
              .map((l: string) => l.trim())
              .filter((l: string) => l.length > 0)
              .filter((l: string) => !l.match(/^WEBVTT/) && !l.match(/^NOTE/) && !l.match(/-->/) && !l.match(/^\d{2}:\d{2}/) && !l.match(/^[a-zA-Z\-]+:/))
              .map((l: string) => l.replace(/<[^>]+>/g, '').trim())
              .filter((l: string) => l.length > 0)
              .join(' ');

          // Step 1: youtube-transcript library (any lang)
          try {
             const { YoutubeTranscript } = await import('youtube-transcript');
             const t = await YoutubeTranscript.fetchTranscript(url);
             transcriptText = t.map((item: any) => item.text).join(' ');
             console.log('[YT] Transcript via youtube-transcript lib:', transcriptText.length, 'chars');
          } catch(e) {
             console.warn('[YT] youtube-transcript lib failed:', (e as any)?.message);
          }

          // Step 2: yt-dlp auto-subs — try en.* first, then any lang
          if (!transcriptText) {
             const subDir = path.resolve(__dirname, 'public/temp_render');
             if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
             const subTimestamp = 'yt_sub_' + Date.now();
             const subPrefix = path.join(subDir, subTimestamp);

             for (const langs of ['en.*', 'en', 'th,en', 'en,th,zh-Hans,ja']) {
                try {
                   execSync(
                     `yt-dlp --skip-download --write-auto-subs --sub-langs "${langs}" --sub-format "vtt" -o "${subPrefix}" "${url}"`,
                     { timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] }
                   );
                   // Find the specific VTT file created by this run
                   const subFiles = fs.readdirSync(subDir).filter((f: string) => f.startsWith(subTimestamp) && f.endsWith('.vtt'));
                   if (subFiles.length > 0) {
                      const vttContent = fs.readFileSync(path.join(subDir, subFiles[0]), 'utf-8');
                      transcriptText = parseVtt(vttContent);
                      subFiles.forEach((f: string) => { try { fs.unlinkSync(path.join(subDir, f)); } catch(e){} });
                      console.log('[YT] Transcript via yt-dlp subs (', langs, '):', transcriptText.length, 'chars');
                      if (transcriptText.length > 50) break;
                   }
                } catch(e) {
                   console.warn('[YT] yt-dlp subs failed for lang:', langs, (e as any)?.message?.substring(0, 100));
                }
             }
          }

          // Step 3: Whisper fallback — download audio and transcribe locally
          if (!transcriptText) {
             try {
                const whisperBin = execSync('which whisper 2>/dev/null || echo ""').toString().trim();
                if (whisperBin) {
                   console.log('[YT] Trying Whisper fallback...');
                   const audioDir = path.resolve(__dirname, 'public/temp_render');
                   const audioBase = 'yt_audio_' + Date.now();
                   const audioPrefix = path.join(audioDir, audioBase);
                   execSync(`yt-dlp -x --audio-format mp3 --audio-quality 5 -o "${audioPrefix}.%(ext)s" "${url}"`, { timeout: 120000, stdio: 'ignore' });
                   const audioFile = audioPrefix + '.mp3';
                   if (fs.existsSync(audioFile)) {
                      execSync(`whisper "${audioFile}" --output_format txt --output_dir "${audioDir}" --language auto 2>/dev/null`, { timeout: 300000 });
                      const txtFile = path.join(audioDir, audioBase + '.txt');
                      if (fs.existsSync(txtFile)) {
                         transcriptText = fs.readFileSync(txtFile, 'utf-8');
                         fs.unlinkSync(txtFile);
                         console.log('[YT] Transcript via Whisper:', transcriptText.length, 'chars');
                      }
                      fs.unlinkSync(audioFile);
                   }
                } else {
                   console.warn('[YT] Whisper not installed — install with: pip install openai-whisper');
                }
             } catch(e) {
                console.warn('[YT] Whisper fallback failed:', (e as any)?.message?.substring(0, 100));
             }
          }

          // === 2. METADATA (channel, title, thumbnail) ===
          let channelName = '';
          let channelAvatar = '';
          let channelLogoUrl = '';
          let subscriberCount: number | undefined;
          let videoTitle = '';
          let videoDuration = 300;

          try {
             const metaRaw = execSync(`yt-dlp --dump-json "${url}"`, { maxBuffer: 1024 * 1024 * 10 }).toString();
             const meta = JSON.parse(metaRaw);
             channelName = meta.uploader || meta.channel || '';
             videoTitle = meta.title || '';
             channelAvatar = meta.thumbnail || '';
             channelLogoUrl = meta.channel_thumbnail || meta.uploader_thumbnail || meta.channel_avatar || '';
             if (typeof meta.channel_follower_count === 'number') {
               subscriberCount = meta.channel_follower_count;
             }
             if (meta.duration && typeof meta.duration === 'number' && meta.duration > 30) {
               videoDuration = meta.duration;
             }
          } catch(e) {
             console.warn("[YT] Could not fetch metadata", e);
          }

          // === 3. SCREENSHOTS (N frames spread across video) ===
          let screenshotUrls: string[] = [];

          try {
             const safeBase = "yt_snap_" + Date.now();
             const snapDir = path.resolve(__dirname, 'public/Image_stock');
             if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });

             // Download a small/fast video file (720p max, mp4) for reliable frame capture
             const tmpVideoFile = path.join(snapDir, `${safeBase}_tmp.mp4`);
             let videoDownloaded = false;
             try {
                console.log('[YT] Downloading video for screenshots...');
                execSync(`yt-dlp -f "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[ext=mp4]/best" --merge-output-format mp4 -o "${tmpVideoFile}" "${url}" 2>/dev/null`, { maxBuffer: 1024 * 1024 * 50, timeout: 300000 });
                if (fs.existsSync(tmpVideoFile) && fs.statSync(tmpVideoFile).size > 10000) {
                   videoDownloaded = true;
                   console.log('[YT] Video downloaded:', (fs.statSync(tmpVideoFile).size / 1024 / 1024).toFixed(1), 'MB');
                }
             } catch(e) {
                console.warn("[YT] Video download failed, trying stream URL fallback");
             }

             // Fallback: use stream URL directly if download fails
             let videoSource = videoDownloaded ? tmpVideoFile : '';
             if (!videoDownloaded) {
                try {
                   videoSource = execSync(`yt-dlp -g -f "bestvideo[ext=mp4]/bestvideo/best" "${url}" 2>/dev/null`).toString().trim();
                   if (videoSource.includes('\n')) videoSource = videoSource.split('\n')[0];
                } catch(e) {
                   console.warn("[YT] Could not get stream URL either");
                }
             }

             if (videoSource) {
                // Pick N timestamps distributed evenly, skip first/last 5%
                const minSec = Math.floor(videoDuration * 0.05);
                const maxSec = Math.floor(videoDuration * 0.95);
                const segmentSize = (maxSec - minSec) / numFrames;
                const offsets: number[] = [];
                for (let i = 0; i < numFrames; i++) {
                   const segStart = minSec + i * segmentSize;
                   offsets.push(Math.floor(segStart + Math.random() * segmentSize));
                }

                let capturedCount = 0;
                for (const offset of offsets) {
                   const frameName = `${safeBase}_${offset}s.jpg`;
                   const framePath = path.join(snapDir, frameName);
                   try {
                      const ts = `${Math.floor(offset/3600).toString().padStart(2,'0')}:${Math.floor((offset%3600)/60).toString().padStart(2,'0')}:${(offset%60).toString().padStart(2,'0')}`;
                      // For local file, put -ss before -i for fast seeking
                      const inputArg = videoDownloaded ? `"${videoSource}"` : `"${videoSource}"`;
                      execSync(`ffmpeg -y -ss ${ts} -i ${inputArg} -vframes 1 -q:v 2 -update 1 "${framePath}" 2>/dev/null`, { timeout: 30000 });
                      if (fs.existsSync(framePath)) {
                         const stat = fs.statSync(framePath);
                         if (stat.size > 500) {
                            screenshotUrls.push(`/Image_stock/${frameName}`);
                            capturedCount++;
                         } else {
                            try { fs.unlinkSync(framePath); } catch(e){}
                         }
                      }
                   } catch(e) {
                      console.warn(`[YT] ffmpeg frame at ${offset}s failed`);
                   }
                }
                console.log(`[YT] Captured ${capturedCount}/${numFrames} frames`);
             }

             // Cleanup temp video file
             if (videoDownloaded && fs.existsSync(tmpVideoFile)) {
                try { fs.unlinkSync(tmpVideoFile); } catch(e) {}
             }
          } catch(e) {
             console.warn("[YT] Screenshot extraction failed", e);
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ 
             success: true, 
             transcript: transcriptText,
             channelName,
             videoTitle,
             channelAvatar,
             channelLogoUrl,
             subscriberCount,
             screenshotUrls
          }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message || String(e) }));
        }
      });
    });

    server.middlewares.use('/videofootage', (req, res, next) => {
      // Allow playing local mp4 files via frontend UI (for canvas extraction)
      let reqUrl = req.url || '/';
      if (reqUrl.includes('?')) reqUrl = reqUrl.split('?')[0];
      const filePath = path.join(__dirname, 'videofootage', decodeURIComponent(reqUrl));
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          const stream = fs.createReadStream(filePath);
          stream.pipe(res);
      } else {
          next();
      }
    });

    server.middlewares.use('/api/save-app-data', (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString() });
      req.on('end', () => {
        try {
          const { key, data } = JSON.parse(body);
          if (!key || key.includes('..') || key.includes('/')) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Invalid key' }));
          }
          const dataDir = path.resolve(__dirname, 'public/app_data');
          if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
          const filePath = path.join(dataDir, `${key}.json`);
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });
    server.middlewares.use('/api/list-auto-videos', (req, res) => {
      if (req.method !== 'GET') return;
      const videoDir = path.resolve(__dirname, 'videofootage');
      if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir);
      const files = fs.readdirSync(videoDir).filter(f => f.endsWith('.mp4') || f.endsWith('.mov') || f.endsWith('.webm'));
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(files));
    });

    server.middlewares.use('/api/list-auto-editor-sounds', (req, res) => {
      if (req.method !== 'GET') return;
      const soundDir = path.resolve(__dirname, 'videofootage/sound');
      if (!fs.existsSync(soundDir)) fs.mkdirSync(soundDir, { recursive: true });
      const files = fs.readdirSync(soundDir).filter(f => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.m4a'));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(files));
    });

    server.middlewares.use('/api/read-auto-scripts', (req, res) => {
      if (req.method !== 'GET') return;
      const scriptDir = path.resolve(__dirname, 'videofootage/script');
      if (!fs.existsSync(scriptDir)) fs.mkdirSync(scriptDir, { recursive: true });
      const scriptFiles = fs.readdirSync(scriptDir).filter(f => f.endsWith('.txt') || f.endsWith('.md') || f.endsWith('.json') || f.endsWith('.csv'));
      
      const scriptsData = [];
      for(const file of scriptFiles) {
         try {
             const content = fs.readFileSync(path.join(scriptDir, file), 'utf-8');
             scriptsData.push({ name: file, content: content });
         } catch(e) {}
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(scriptsData));
    });

    server.middlewares.use('/api/concat-auto-videos', (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString() });
      req.on('end', () => {
         try {
            const parsedBody = JSON.parse(body);
            const { groupName, files, bgmFile, bgmVolume = 0.1, cinematicOptions = {}, fileSettings } = parsedBody;
            const { fastCuts, colorGrade, filmGrain, cameraShake } = cinematicOptions;
            
            // Re-encode (advanced pipeline) if global options selected OR if AI Auto-Director generated settings
            const hasCinematicFilters = fastCuts || colorGrade || filmGrain || cameraShake || (fileSettings && fileSettings.length > 0);
            
            const videoDir = path.resolve(__dirname, 'videofootage');
            const outDir = path.resolve(__dirname, 'videofootage/Completed_Films');
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            
            const safeName = groupName.replace(/[^ก-๙a-zA-Z0-9_-]/g, "_");
            const outputPath = path.join(outDir, `${safeName}_${Date.now()}.mp4`);
            
            const ffmpegPath = require('ffmpeg-static');
            const { exec } = require('child_process');
            
            let ffmpegCommand = '';
            let listPath = '';
            
            if (!hasCinematicFilters) {
                // Vanilla fast concat demuxer
                listPath = path.join(videoDir, `concat_${Date.now()}.txt`);
                let listContent = '';
                files.forEach((f: string) => {
                   listContent += `file '${path.join(videoDir, f).replace(/'/g, "'\\''")}'\n`;
                });
                fs.writeFileSync(listPath, listContent);
                
                ffmpegCommand = `"${ffmpegPath}" -y -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`;
                
                if (bgmFile) {
                   const bgmPath = path.join(videoDir, 'sound', bgmFile);
                   if (fs.existsSync(bgmPath)) {
                      ffmpegCommand = `"${ffmpegPath}" -y -f concat -safe 0 -i "${listPath}" -stream_loop -1 -i "${bgmPath}" -filter_complex "[0:a]volume=1.0[ao];[1:a]volume=${bgmVolume}[ab];[ao][ab]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 128k "${outputPath}"`;
                   }
                }
            } else {
                // Advanced Cinematic filter_complex pipeline (Scene-by-Scene Intel)
                let inputsStr = '';
                let filterChain = '';
                let concatInputs = '';
                
                let w = 1920;
                let h = 1080;
                
                if (files.length > 0) {
                    try {
                        const { execSync } = require('child_process');
                        const firstFile = path.join(videoDir, files[0]);
                        // Suppress error by throwing output to stdout, ffmpeg -i without output always exits with 1
                        const out = execSync(`"${ffmpegPath}" -i "${firstFile}" 2>&1 || true`, { encoding: 'utf-8' });
                        const match = out.match(/Video: .*, (\d+)x(\d+)/);
                        if (match) {
                            w = parseInt(match[1]);
                            h = parseInt(match[2]);
                        }
                    } catch(e) {}
                }
                
                files.forEach((f: string, i: number) => {
                   const safePath = path.join(videoDir, f);
                   inputsStr += `-i "${safePath}" `;
                   
                   const opts = (fileSettings && fileSettings[i]) || cinematicOptions || {};
                   const { fastCuts, trimStart = 0.0, trimDuration = 2.5, colorGrade, filmGrain, cameraShake } = opts;
                   
                   let hasAudio = false;
                   let clipDuration = trimDuration || 5.0; // fallback duration
                   try {
                       const pOut = require('child_process').execSync(`"${ffmpegPath}" -i "${safePath}" 2>&1 || true`, { encoding: 'utf-8' });
                       if (pOut.includes('Audio:')) hasAudio = true;
                       const durMatch = pOut.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
                       if (durMatch) {
                           clipDuration = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseFloat(durMatch[3]);
                       }
                   } catch(e) {}
                   
                   let vFilter = `[${i}:v]`;
                   
                   if (fastCuts) {
                       vFilter += `trim=start=${trimStart}:duration=${trimDuration},setpts=PTS-STARTPTS,`;
                   }
                   
                   let scaleStr = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
                   if (cameraShake) {
                       scaleStr = `scale=${w}*1.05:-1,crop=${w}:${h}:x='(${w}*0.05)/2+10*sin(t*3)':y='(${h}*0.05)/2+10*cos(t*4)'`;
                   }
                   vFilter += scaleStr;
                   
                   let aestheticEffects = [];
                   if (colorGrade) {
                       aestheticEffects.push(`eq=contrast=1.1:brightness=-0.02:saturation=1.2:gamma=0.95`);
                   }
                   if (filmGrain) {
                       // Changed to lightweight unsharp instead of massive noise injections
                       aestheticEffects.push(`unsharp=3:3:0.3`);
                   }
                   
                   if (aestheticEffects.length > 0) {
                       vFilter += `,` + aestheticEffects.join(',');
                   }
                   
                   vFilter += `,setsar=1,fps=24[v${i}]; `;
                   filterChain += vFilter;
                   
                   let aFilter = '';
                   if (hasAudio) {
                       aFilter = `[${i}:a]`;
                       if (fastCuts) {
                           aFilter += `atrim=start=${trimStart}:duration=${trimDuration},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]; `;
                       } else {
                           aFilter += `aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]; `;
                       }
                   } else {
                       aFilter = `aevalsrc=exprs=0:d=${fastCuts ? trimDuration : clipDuration},aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]; `;
                   }
                   filterChain += aFilter;
                   
                   concatInputs += `[v${i}][a${i}]`;
                });
                
                filterChain += `${concatInputs}concat=n=${files.length}:v=1:a=1[finalv][finala]`;
                
                // Optimized encode parameters: high quality (CRF 22), fast encoding, without file bloat.
                const encodeParams = `-c:v libx264 -preset fast -crf 22 -maxrate 12M -bufsize 24M -r 24 -pix_fmt yuv420p`;
                
                if (bgmFile) {
                   const bgmPath = path.join(videoDir, 'sound', bgmFile);
                   if (fs.existsSync(bgmPath)) {
                      inputsStr += `-stream_loop -1 -i "${bgmPath}" `;
                      filterChain += `; [${files.length}:a]volume=${bgmVolume}[bgm]; [finala][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`;
                      ffmpegCommand = `"${ffmpegPath}" -y ${inputsStr} -filter_complex "${filterChain}" -map "[finalv]" -map "[aout]" ${encodeParams} -c:a aac -b:a 128k -shortest "${outputPath}"`;
                   } else {
                      ffmpegCommand = `"${ffmpegPath}" -y ${inputsStr} -filter_complex "${filterChain}" -map "[finalv]" -map "[finala]" ${encodeParams} -c:a aac -b:a 128k "${outputPath}"`;
                   }
                } else {
                   ffmpegCommand = `"${ffmpegPath}" -y ${inputsStr} -filter_complex "${filterChain}" -map "[finalv]" -map "[finala]" ${encodeParams} -c:a aac -b:a 128k "${outputPath}"`;
                }
            }
            
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            
            const { spawn } = require('child_process');
            const childFfmpeg = spawn(ffmpegCommand, { shell: true });
            
            childFfmpeg.stderr.on('data', (data: any) => {
                const lines = data.toString().split('\n');
                lines.forEach((l: string) => {
                    if (l.trim().length > 0) {
                        res.write(`data: ${JSON.stringify({ log: l.trim() })}\n\n`);
                    }
                });
            });
            
            childFfmpeg.on('close', (code: number) => {
               if (listPath) {
                  try { fs.unlinkSync(listPath); } catch(e){}
               }
               if (code !== 0) {
                  res.write(`data: ${JSON.stringify({ error: `FFMPEG Process exited with code ${code}` })}\n\n`);
               } else {
                  res.write(`data: ${JSON.stringify({ success: true, filePath: outputPath })}\n\n`);
               }
               res.end();
            });
         } catch(e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
         }
      });
    });

    // ── Disk Cleaner APIs ──────────────────────────────────────────────
    server.middlewares.use('/api/scan-disk', (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { categoryId, paths: rawPaths } = JSON.parse(body);
          const { execSync } = require('child_process');
          const os = require('os');
          const expandPath = (p: string) => p.replace(/^~/, os.homedir());

          const duSize = (fp: string): number => {
            try { return parseInt(execSync(`du -sk "${fp}" 2>/dev/null`, { encoding: 'utf8' }).split('\t')[0]) * 1024; } catch(e){ return 0; }
          };

          const scanDir = (dirPath: string, files: any[], skipSelf = false) => {
            if (!fs.existsSync(dirPath)) return 0;
            const stat = fs.statSync(dirPath);
            if (!stat.isDirectory()) {
              files.push({ path: dirPath, name: path.basename(dirPath), size: stat.size, isDir: false });
              return stat.size;
            }
            if (skipSelf) {
              let total = 0;
              try {
                fs.readdirSync(dirPath).forEach((item: string) => {
                  if (item === '.DS_Store') return;
                  const fp = path.join(dirPath, item);
                  try {
                    const s = fs.statSync(fp);
                    const sz = s.isDirectory() ? duSize(fp) : s.size;
                    total += sz;
                    files.push({ path: fp, name: item, size: sz, isDir: s.isDirectory() });
                  } catch(e){}
                });
              } catch(e){}
              return total;
            } else {
              const sz = duSize(dirPath);
              files.push({ path: dirPath, name: path.basename(dirPath), size: sz, isDir: true });
              return sz;
            }
          };

          // .DS_Store: recursive find
          if (categoryId === 'ds_store') {
            try {
              const out = execSync(`find "${os.homedir()}" -maxdepth 8 -name ".DS_Store" -not -path "*/node_modules/*" 2>/dev/null`, { encoding: 'utf8' }).trim();
              const fps = out ? out.split('\n').filter(Boolean) : [];
              let totalSize = 0;
              const files = fps.map((fp: string) => {
                let size = 0; try { size = fs.statSync(fp).size; } catch(e){}
                totalSize += size;
                return { path: fp, name: '.DS_Store', size, isDir: false };
              });
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ files, totalSize }));
            } catch(e) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ files: [], totalSize: 0 })); }
          }

          // Downloads older than 30 days
          if (categoryId === 'downloads_old') {
            try {
              const dlPath = expandPath('~/Downloads');
              const thirtyAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
              const files: any[] = []; let totalSize = 0;
              if (fs.existsSync(dlPath)) {
                for (const item of fs.readdirSync(dlPath)) {
                  if (item === '.DS_Store') continue;
                  const fp = path.join(dlPath, item);
                  try {
                    const stat = fs.statSync(fp);
                    if (stat.mtimeMs < thirtyAgo) {
                      const sz = stat.isDirectory() ? duSize(fp) : stat.size;
                      totalSize += sz; files.push({ path: fp, name: item, size: sz, isDir: stat.isDirectory() });
                    }
                  } catch(e){}
                }
              }
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ files, totalSize }));
            } catch(e) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ files: [], totalSize: 0 })); }
          }

          // Sleep Image (/private/var/vm) — use du on whole dir
          if (categoryId === 'sleep_image') {
            const vmPath = '/private/var/vm';
            let totalSize = 0; const files: any[] = [];
            if (fs.existsSync(vmPath)) {
              try {
                fs.readdirSync(vmPath).forEach((item: string) => {
                  const fp = path.join(vmPath, item);
                  try { const s = fs.statSync(fp); const sz = s.isDirectory() ? duSize(fp) : s.size; totalSize += sz; files.push({ path: fp, name: item, size: sz, isDir: s.isDirectory() }); } catch(e){}
                });
              } catch(e){}
            }
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ files, totalSize }));
          }

          // iOS Simulator Devices — too large, just report total
          if (categoryId === 'ios_simulator') {
            const cachePath = expandPath('~/Library/Developer/CoreSimulator/Caches');
            const devPath = expandPath('~/Library/Developer/CoreSimulator/Devices');
            let totalSize = 0; const files: any[] = [];
            [cachePath, devPath].forEach(p => { if (fs.existsSync(p)) { const sz = duSize(p); totalSize += sz; files.push({ path: p, name: path.basename(p), size: sz, isDir: true }); }});
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ files, totalSize }));
          }

          // iOS Backups — report each backup folder
          if (categoryId === 'ios_backups') {
            const bkPath = expandPath('~/Library/Application Support/MobileSync/Backup');
            let totalSize = 0; const files: any[] = [];
            if (fs.existsSync(bkPath)) {
              try {
                fs.readdirSync(bkPath).forEach((item: string) => {
                  const fp = path.join(bkPath, item);
                  try { const sz = fs.statSync(fp).isDirectory() ? duSize(fp) : fs.statSync(fp).size; totalSize += sz; files.push({ path: fp, name: item, size: sz, isDir: true }); } catch(e){}
                });
              } catch(e){}
            }
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ files, totalSize }));
          }

          // Generic: scan listed paths (shallow top-level listing)
          let totalSize = 0;
          const files: any[] = [];
          for (const rawP of (rawPaths || [])) {
            const expanded = expandPath(rawP);
            totalSize += scanDir(expanded, files, true);
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ files, totalSize }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    server.middlewares.use('/api/clean-disk', (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { categoryId, paths: rawPaths } = JSON.parse(body);
          const { execSync } = require('child_process');
          const os = require('os');
          const expandPath = (p: string) => p.replace(/^~/, os.homedir());
          let freedSize = 0;

          const duSize = (fp: string): number => {
            try { return parseInt(execSync(`du -sk "${fp}" 2>/dev/null`, { encoding: 'utf8' }).split('\t')[0]) * 1024; } catch(e){ return 0; }
          };

          const rmEntry = (fp: string) => {
            try {
              const s = fs.statSync(fp);
              if (s.isDirectory()) { freedSize += duSize(fp); fs.rmSync(fp, { recursive: true, force: true }); }
              else { freedSize += s.size; fs.unlinkSync(fp); }
            } catch(e){}
          };

          // .DS_Store
          if (categoryId === 'ds_store') {
            try {
              const out = execSync(`find "${os.homedir()}" -maxdepth 8 -name ".DS_Store" -not -path "*/node_modules/*" 2>/dev/null`, { encoding: 'utf8' }).trim();
              (out ? out.split('\n').filter(Boolean) : []).forEach((fp: string) => {
                try { freedSize += fs.statSync(fp).size; fs.unlinkSync(fp); } catch(e){}
              });
            } catch(e){}
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, freedSize }));
          }

          // Downloads >30 days
          if (categoryId === 'downloads_old') {
            const dlPath = expandPath('~/Downloads');
            const thirtyAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
            if (fs.existsSync(dlPath)) {
              fs.readdirSync(dlPath).forEach((item: string) => {
                if (item === '.DS_Store') return;
                const fp = path.join(dlPath, item);
                try { if (fs.statSync(fp).mtimeMs < thirtyAgo) rmEntry(fp); } catch(e){}
              });
            }
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, freedSize }));
          }

          // Sleep Image — delete files inside /private/var/vm (needs sudo usually, try anyway)
          if (categoryId === 'sleep_image') {
            const vmPath = '/private/var/vm';
            if (fs.existsSync(vmPath)) {
              fs.readdirSync(vmPath).forEach((item: string) => rmEntry(path.join(vmPath, item)));
            }
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, freedSize }));
          }

          // iOS Simulator
          if (categoryId === 'ios_simulator') {
            [expandPath('~/Library/Developer/CoreSimulator/Caches'), expandPath('~/Library/Developer/CoreSimulator/Devices')].forEach(p => {
              if (fs.existsSync(p)) { freedSize += duSize(p); fs.rmSync(p, { recursive: true, force: true }); }
            });
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, freedSize }));
          }

          // iOS Backups
          if (categoryId === 'ios_backups') {
            const bkPath = expandPath('~/Library/Application Support/MobileSync/Backup');
            if (fs.existsSync(bkPath)) {
              fs.readdirSync(bkPath).forEach((item: string) => rmEntry(path.join(bkPath, item)));
            }
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, freedSize }));
          }

          // Generic: wipe contents of listed paths
          for (const rawP of (rawPaths || [])) {
            const expanded = expandPath(rawP);
            if (!fs.existsSync(expanded)) continue;
            try {
              const stat = fs.statSync(expanded);
              if (stat.isDirectory()) {
                fs.readdirSync(expanded).forEach((item: string) => {
                  if (item === '.DS_Store') return;
                  rmEntry(path.join(expanded, item));
                });
              }
            } catch(e){}
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, freedSize }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });
    // ── Security Scanner APIs ──────────────────────────────────────────
    server.middlewares.use('/api/scan-malware', (req, res) => {
      if (req.method !== 'GET') return;
      try {
        const { execSync } = require('child_process');
        const os = require('os');
        const expandPath = (p: string) => p.replace(/^~/, os.homedir());
        
        const results: any[] = [];
        
        // Target 1: LaunchAgents (User)
        const userLA = expandPath('~/Library/LaunchAgents');
        if (fs.existsSync(userLA)) {
          fs.readdirSync(userLA).forEach((item: string) => {
            if (item.endsWith('.plist')) {
               results.push({ path: path.join(userLA, item), name: item, risk: 'Medium', type: 'LaunchAgent (User)' });
            }
          });
        }
        
        // Target 2: LaunchAgents (System)
        const sysLA = '/Library/LaunchAgents';
        if (fs.existsSync(sysLA)) {
          fs.readdirSync(sysLA).forEach((item: string) => {
            if (item.endsWith('.plist')) {
               results.push({ path: path.join(sysLA, item), name: item, risk: 'Low', type: 'LaunchAgent (System)' });
            }
          });
        }
        
        // Target 3: LaunchDaemons (System)
        const sysLD = '/Library/LaunchDaemons';
        if (fs.existsSync(sysLD)) {
          fs.readdirSync(sysLD).forEach((item: string) => {
            if (item.endsWith('.plist')) {
               results.push({ path: path.join(sysLD, item), name: item, risk: 'Medium', type: 'LaunchDaemon' });
            }
          });
        }
        
        // Target 4: Downloads (Suspicious extensions)
        const dlPath = expandPath('~/Downloads');
        if (fs.existsSync(dlPath)) {
          try {
             // Find .pkg, .dmg, .command, .sh in Downloads
             const files = execSync(`find "${dlPath}" -maxdepth 2 -type f \\( -name "*.pkg" -o -name "*.dmg" -o -name "*.sh" -o -name "*.command" -o -name "*.app" \\) 2>/dev/null`, { encoding: 'utf8' }).trim();
             (files ? files.split('\n').filter(Boolean) : []).forEach((fp: string) => {
                results.push({ path: fp, name: path.basename(fp), risk: 'High', type: 'Suspicious Download' });
             });
          } catch(e){}
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, items: results }));
      } catch(e: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
    });

    server.middlewares.use('/api/remove-malware', (req, res) => {
      if (req.method !== 'POST') return;
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { path: targetPath } = JSON.parse(body);
          if (targetPath && targetPath.includes('/') && fs.existsSync(targetPath)) {
             try {
                const stat = fs.statSync(targetPath);
                if (stat.isDirectory()) {
                  fs.rmSync(targetPath, { recursive: true, force: true });
                } else {
                  fs.unlinkSync(targetPath);
                }
             } catch(e){}
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
        } catch(e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });
    // ── Speed Booster APIs ─────────────────────────────────────────────
    server.middlewares.use('/api/system-stats', (req, res) => {
      if (req.method !== 'GET') return;
      try {
        const os = require('os');
        const freemem = os.freemem();
        const totalmem = os.totalmem();
        const loadavg = os.loadavg();
        
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ 
          success: true, 
          freemem, 
          totalmem, 
          loadavg,
          cpuCount: os.cpus().length
        }));
      } catch(e: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
    });

    server.middlewares.use('/api/speed-boost', (req, res) => {
      if (req.method !== 'POST') return;
      try {
        const { execSync, exec } = require('child_process');
        const os = require('os');
        const fs = require('fs');
        const expandPath = (p: string) => p.replace(/^~/, os.homedir());
        
        let logs: string[] = [];
        
        // 1. Quit inactive applications via AppleScript
        const appleScript = `
          tell application "System Events"
            set activeApp to name of first application process whose frontmost is true
            set openApps to name of every application process whose background only is false
          end tell
          set killedCount to 0
          repeat with appName in openApps
            if appName is not activeApp and appName is not "Finder" then
              try
                tell application appName to quit
                set killedCount to killedCount + 1
              end try
            end if
          end repeat
          return killedCount
        `;
        
        try {
           const killedStr = execSync(`osascript -e '${appleScript}'`, { encoding: 'utf8' }).trim();
           logs.push(`Successfully asked ${killedStr} background applications to quit.`);
        } catch(e: any) {
           logs.push(`Warning: AppleScript execution failed... continuing.`);
        }

        // 2. Clear System Caches
        let cacheFreed = 0;
        const cachePath = expandPath('~/Library/Caches');
        if (fs.existsSync(cachePath)) {
          console.log('Clearing local caches');
          const path = require('path');
          
          try {
            const items = fs.readdirSync(cachePath);
            let deletedCount = 0;
            for (const item of items) {
               if (item.includes('com.apple')) continue; // Skip core apple caches
               const fp = path.join(cachePath, item);
               try {
                  const stat = fs.statSync(fp);
                  // Basic estimation of dir size by just using the top-level items for tracking or 0.
                  const sz = stat.size || 0;
                  if (stat.isDirectory()) {
                     fs.rmSync(fp, { recursive: true, force: true });
                     cacheFreed += sz;
                  } else {
                     fs.unlinkSync(fp);
                     cacheFreed += sz;
                  }
                  deletedCount++;
               } catch(ex) {}
            }
            logs.push(`Cleared ${deletedCount} cache entries.`);
          } catch(e) {}
        }

        // 3. Purge DNS
        try {
           exec(`dscacheutil -flushcache`, () => {});
           logs.push("Flushed application and DNS caches.");
        } catch(e) {}

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, logs }));
      } catch(e: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
    });

    // ── Logo APIs ──────────────────────────────────────────────────────
    server.middlewares.use('/api/save-logo', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method !== 'POST') {
        res.statusCode = 405;
        return res.end(JSON.stringify({ error: 'Method not allowed' }));
      }
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { filename, base64 } = JSON.parse(body);
          if (!filename || !base64) throw new Error('Missing filename or base64');
          const logosDir = path.resolve(__dirname, 'public/logos');
          if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });
          const safeName = filename.replace(/[^a-zA-Z0-9ก-๙._-]/g, '_');
          if (!safeName) throw new Error('Invalid filename');
          const filePath = path.join(logosDir, safeName);
          const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
          fs.writeFileSync(filePath, base64Data, 'base64');
          res.end(JSON.stringify({ success: true, url: `/logos/${safeName}` }));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    server.middlewares.use('/api/list-logos', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method !== 'GET') {
        res.statusCode = 405;
        return res.end(JSON.stringify({ error: 'Method not allowed' }));
      }
      try {
        const logosDir = path.resolve(__dirname, 'public/logos');
        if (!fs.existsSync(logosDir)) { res.end(JSON.stringify([])); return; }
        const files = fs.readdirSync(logosDir).filter((f: string) => /\.(png|jpg|jpeg|svg|webp|gif)$/i.test(f));
        const logos = files.map((f: string) => ({ name: f, url: `/logos/${f}` }));
        res.end(JSON.stringify(logos));
      } catch (e: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
    });

    server.middlewares.use('/api/delete-logo', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method !== 'POST') {
        res.statusCode = 405;
        return res.end(JSON.stringify({ error: 'Method not allowed' }));
      }
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { filename } = JSON.parse(body);
          const logosDir = path.resolve(__dirname, 'public/logos');
          const safeName = path.basename(String(filename || ''));
          if (!safeName || safeName !== filename) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Invalid filename' }));
          }
          const filePath = path.join(logosDir, safeName);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          res.end(JSON.stringify({ success: true }));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });
    // ── End Logo APIs ──────────────────────────────────────────────────

    // ── End Disk Cleaner APIs ──────────────────────────────────────────
  }
});


export default defineConfig({
  plugins: [react(), dataStaticPlugin(), fileSaverPlugin()],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  server: {
    open: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    watch: {
      // Must be a function — Vite sets disableGlobbing:true so string globs don't match
      ignored: (file: string) => isDataFile(file),
    },
  },
})
