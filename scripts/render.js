const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const jobPath = process.argv[2];
if (!jobPath || !fs.existsSync(jobPath)) {
  console.error("Job file not found!");
  process.exit(1);
}

const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
const { projectId, topic, scenes, outputPath, subtitles, subtitleStyle } = job;
const basePublicDir = path.resolve(__dirname, '../public');
const fontsDir = path.resolve(__dirname, '../public/Font_stock');
const tempDir = path.resolve(__dirname, '../public/temp_render', projectId.toString());

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[CMD FAILED] ${cmd.substring(0, 200)}...`);
        console.error(stderr?.substring(0, 500));
        reject(error);
      }
      else resolve(stdout);
    });
  });
}

function getAbsolutePath(url) {
  if (!url) return null;
  if (url.startsWith('/')) return path.join(basePublicDir, url);
  return url;
}

async function getFileDuration(filePath) {
  try {
    const result = await runCommand(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`
    );
    const dur = parseFloat(result.trim());
    if (isNaN(dur) || dur <= 0) return null;
    return dur;
  } catch (e) {
    return null;
  }
}

// แปลง transition type จาก UI เป็น ffmpeg xfade transition name
function mapTransition(type) {
  const map = {
    'fade': 'fade',
    'slide-left': 'slideleft',
    'slide-right': 'slideright',
    'zoom-in': 'circleopen',
    'glitch': 'pixelize',
  };
  return map[type] || null;
}

function getAudioSpeechIntervals(audioPath, totalDuration) {
  return new Promise((resolve) => {
    if (!audioPath || !fs.existsSync(audioPath)) {
        // Fallback: speak for the whole duration
        return resolve([{start: 0, end: totalDuration}]);
    }
    const cmd = `ffmpeg -i "${audioPath}" -af silencedetect=noise=-30dB:d=0.15 -f null -`;
    exec(cmd, (error, stdout, stderr) => {
        const lines = stderr.split('\n');
        const silenceStarts = [];
        const silenceEnds = [];
        lines.forEach(line => {
             const startMatch = line.match(/silence_start: ([\d.]+)/);
             if (startMatch) silenceStarts.push(parseFloat(startMatch[1]));
             const endMatch = line.match(/silence_end: ([\d.]+)/);
             if (endMatch) silenceEnds.push(parseFloat(endMatch[1]));
        });

        let speechIntervals = [];
        let currentPos = 0;
        for (let i = 0; i < silenceStarts.length; i++) {
             let sStart = silenceStarts[i];
             let sEnd = silenceEnds[i] || sStart + 0.15; // fallback
             if (sStart > currentPos) {
                 speechIntervals.push({start: currentPos, end: sStart});
             }
             currentPos = sEnd;
        }
        if (currentPos < totalDuration) {
             speechIntervals.push({start: currentPos, end: totalDuration});
        }
        
        // If it failed to detect anything (e.g. noise above -30dB whole time)
        if (speechIntervals.length === 0) {
             speechIntervals.push({start: 0, end: totalDuration});
        }
        resolve(speechIntervals);
    });
  });
}

async function buildAvatarSequence(scene, duration, index, audioPath) {
  if (!scene.avatarCharacter) return null;
  const charDir = path.join(path.resolve(__dirname, '../public/Avatar_stock'), scene.avatarCharacter);
  if (!fs.existsSync(charDir)) return null;

  let animations = {
    talking: ['neutral', 'talking'],
    laughing: ['happy', 'talking'],
    angry_talk: ['angry', 'talking'],
    crying: ['crying', 'sad']
  };
  const animConfigFile = path.join(charDir, 'animations.json');
  if (fs.existsSync(animConfigFile)) {
     try { animations = JSON.parse(fs.readFileSync(animConfigFile, 'utf8')); } catch(e){}
  }

  const expNames = animations[scene.avatarAnimation || 'talking'] || animations['talking'];
  
  const files = fs.readdirSync(charDir).filter(f => f.endsWith('.png'));
  if (files.length === 0) return null;
  
  const getImgPath = (exp) => {
     let f = files.find(f => {
        const parts = f.replace('.png','').split('_');
        const expName = parts.length >= 2 ? parts[1] : parts[0];
        return expName === exp;
     });
     return f ? path.join(charDir, f) : null;
  };
  
  const frameA = getImgPath(expNames[0]) || getImgPath('neutral') || path.join(charDir, files[0]);
  const frameB = getImgPath(expNames[1]) || frameA;

  const animType = scene.avatarAnimation || 'talking';
  
  // Audio-driven lip sync!
  const speechIntervals = await getAudioSpeechIntervals(audioPath, duration);
  
  // Generate concat sequence
  let concatText = '';
  // Time resolution: 0.12 seconds per frame for natural look
  const step = 0.12;
  let currentDur = 0;
  
  while (currentDur < (duration + 0.5)) {
      // Check if current time is within any speech interval
      const isSpeaking = speechIntervals.some(iv => currentDur >= iv.start && currentDur <= iv.end);
      
      let frameFile;
      if (isSpeaking) {
          // Flip-flop between frameA and frameB (if talking)
          const talkCycle = Math.floor(currentDur / step) % 2;
          frameFile = talkCycle === 0 ? frameA : frameB;
      } else {
          // Silent frame (Neutral expression)
          // We always use the 'neutral' equivalent provided as first element
          frameFile = frameA;
      }
      
      concatText += `file '${frameFile}'\n`;
      concatText += `duration ${step}\n`;
      currentDur += step;
  }
  
  concatText += `file '${frameA}'\n`;

  const concatFile = path.join(tempDir, `avatar_scene_${index}.txt`);
  fs.writeFileSync(concatFile, concatText);
  return concatFile;
}

async function renderScene(scene, index) {
  console.log(`[INFO] ========== Scene ${index + 1} ==========`);
  const mediaPath = getAbsolutePath(scene.imageUrl);
  const audioPath = getAbsolutePath(scene.audioUrl);
  const outPath = path.join(tempDir, `scene_${index}.mp4`);

  if (!mediaPath || !fs.existsSync(mediaPath)) {
    throw new Error(`Scene ${index + 1}: ไม่มีไฟล์ media`);
  }

  const isVideo = mediaPath.endsWith('.mp4') || mediaPath.endsWith('.mov') || mediaPath.endsWith('.webm');

  let duration;
  if (audioPath && fs.existsSync(audioPath)) {
    duration = await getFileDuration(audioPath);
    console.log(`[PROBE] เสียงยาว ${duration}s`);
  }
  if (!duration) {
    duration = parseFloat(scene.duration) || 5;
    console.log(`[FALLBACK] ใช้ scene.duration: ${duration}s`);
  }
  
  const avatarConcatFile = await buildAvatarSequence(scene, duration, index, audioPath);

  let bgFilter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1:1,fps=30";
  if (!isVideo && scene.animation) {
    const totalFrames = Math.ceil(duration * 30);
    if (scene.animation === 'zoom-in') bgFilter = `zoompan=z='min(zoom+0.0015,1.5)':d=${totalFrames}:s=1080x1920,setsar=1:1,fps=30`;
    if (scene.animation === 'zoom-out') bgFilter = `zoompan=z='1.5-0.0015*in':d=${totalFrames}:s=1080x1920,setsar=1:1,fps=30`;
  }

  const videoOpts = `-c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.1 -r 30`;
  const loopFlag = isVideo ? '-stream_loop -1' : '-loop 1';
  let cmd = `ffmpeg -y ${loopFlag} -i "${mediaPath}" `;
  
  // Audio Input [1:a]
  if (audioPath && fs.existsSync(audioPath)) {
     cmd += `-i "${audioPath}" `;
  } else {
     cmd += `-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 `;
  }

  // Avatar Input [2:v] (if exists)
  if (avatarConcatFile) {
     cmd += `-f concat -safe 0 -i "${avatarConcatFile}" `;
     
     let posStr = "x=(W-w)/2:y=H-h-120"; // Center Bottom (lifted up 120px to look proper)
     let avScale = 900;
     
     if (scene.avatarPos) {
         avScale = Math.round(900 * (scene.avatarPos.scale || 1));
         const xPx = Math.round(1080 * (scene.avatarPos.x / 100));
         const yPx = Math.round(1920 * (scene.avatarPos.y / 100));
         posStr = `x=${xPx}:y=${yPx}`;
     } else {
         if (scene.avatarPosition === 'bottom-right') posStr = "x=W-w-50:y=H-h-120";
         if (scene.avatarPosition === 'bottom-left') posStr = "x=50:y=H-h-120";
     }

     const filterComplex = `[0:v]${bgFilter}[bg]; [2:v]scale=${avScale}:-1[av]; [bg][av]overlay=${posStr}:format=auto[outv]`;
     
     cmd += `-filter_complex "${filterComplex}" -map "[outv]" -map 1:a ${videoOpts} -c:a aac -b:a 128k -ar 44100 -ac 2 -shortest -t ${duration} "${outPath}"`;
  } else {
     // No avatar, use simple -vf
     cmd += `-map 0:v -map 1:a ${videoOpts} -vf "${bgFilter}" -c:a aac -b:a 128k -ar 44100 -ac 2 -shortest -t ${duration} "${outPath}"`;
  }

  await runCommand(cmd);
  if (avatarConcatFile) {
     try { fs.unlinkSync(avatarConcatFile); } catch(e){}
  }
  console.log(`[OK] Scene ${index + 1} → ${path.basename(outPath)}`);
  return outPath;
}

async function start() {
  try {
    console.log(`[START] Rendering ${scenes.length} scenes...`);

    // Phase 1: สร้างคลิปแต่ละฉากแยกกัน
    const clipPaths = [];
    const clipDurations = [];

    for (let i = 0; i < scenes.length; i++) {
      const outPath = await renderScene(scenes[i], i);
      clipPaths.push(outPath);
      const dur = await getFileDuration(outPath);
      clipDurations.push(dur || 5);
      console.log(`[DURATION] Scene ${i + 1} rendered = ${clipDurations[i].toFixed(2)}s`);
    }

    // Debug: พิมพ์ข้อมูล transition ของทุกฉาก
    for (let i = 0; i < scenes.length; i++) {
      console.log(`[DEBUG] Scene ${i+1}: transitionType="${scenes[i].transitionType || 'none'}" transitionSoundUrl="${scenes[i].transitionSoundUrl || 'ไม่มี'}"`);
    }

    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    const safeTopic = (topic || 'Test').replace(/[^a-zA-Z0-9ก-๙]/g, '_');
    const finalOutPath = path.join(outputPath, `Render_${safeTopic}_${Date.now()}.mp4`);

    // Phase 2: ตรวจว่ามี transition หรือ SFX อะไรบ้าง
    const TRANSITION_DURATION = 0.5;
    let hasAnyTransitionOrSfx = false;
    for (let i = 0; i < scenes.length - 1; i++) {
      if (mapTransition(scenes[i].transitionType) || scenes[i].transitionSoundUrl) {
        hasAnyTransitionOrSfx = true;
        break;
      }
    }

    // ===== ถ้าไม่มี transition หรือ SFX ใดเลย → concat ธรรมดา =====
    if (!hasAnyTransitionOrSfx) {
      console.log(`[INFO] ไม่มี transition/SFX → concat ธรรมดา`);
      const listFile = path.join(tempDir, 'list.txt');
      fs.writeFileSync(listFile, clipPaths.map(f => `file '${f}'`).join('\n') + '\n');
      await runCommand(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${finalOutPath}"`);
      console.log(`[SUCCESS] ✅ Output → ${finalOutPath}`);
      cleanup(clipPaths, [listFile]);
      return;
    }

    // ===== มี transition/SFX → xfade ทีละคู่ =====
    console.log(`[INFO] มี transition/SFX → xfade processing...`);
    let currentClip = clipPaths[0];
    let currentDuration = clipDurations[0];

    for (let i = 0; i < scenes.length - 1; i++) {
      const nextClip = clipPaths[i + 1];
      const nextDuration = clipDurations[i + 1];
      const transType = mapTransition(scenes[i].transitionType);
      const sfxUrl = scenes[i].transitionSoundUrl;
      const sfxPath = sfxUrl ? getAbsolutePath(sfxUrl) : null;
      const hasSfx = sfxPath && fs.existsSync(sfxPath);
      const mergedPath = path.join(tempDir, `merged_${i}.mp4`);

      console.log(`[PAIR ${i}] transType=${transType || 'none'} | sfxPath=${sfxPath || 'none'} | sfxExists=${hasSfx}`);

      if (transType) {
        // ===== มี xfade ภาพ =====
        const offset = Math.max(0, currentDuration - TRANSITION_DURATION);
        console.log(`[XFADE] Scene ${i+1} → ${i+2} | type=${transType} offset=${offset.toFixed(2)}s`);

        let filterComplex = `[0:v][1:v]xfade=transition=${transType}:duration=${TRANSITION_DURATION}:offset=${offset.toFixed(3)}[vout];[0:a][1:a]acrossfade=d=${TRANSITION_DURATION}[aout]`;

        if (hasSfx) {
          console.log(`[SFX] mixing ${path.basename(sfxPath)} at ${offset.toFixed(2)}s`);
          const delayMs = Math.round(offset * 1000);
          const cmd = `ffmpeg -y -i "${currentClip}" -i "${nextClip}" -i "${sfxPath}" -filter_complex "${filterComplex};[aout]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[afmt];[2:a]adelay=${delayMs}|${delayMs},aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=1.5[sfx];[afmt][sfx]amix=inputs=2:duration=first:dropout_transition=2[afinal]" -map "[vout]" -map "[afinal]" -c:v libx264 -pix_fmt yuv420p -r 30 -c:a aac -b:a 128k -ar 44100 -ac 2 "${mergedPath}"`;
          await runCommand(cmd);
        } else {
          const cmd = `ffmpeg -y -i "${currentClip}" -i "${nextClip}" -filter_complex "${filterComplex}" -map "[vout]" -map "[aout]" -c:v libx264 -pix_fmt yuv420p -r 30 -c:a aac -b:a 128k -ar 44100 -ac 2 "${mergedPath}"`;
          await runCommand(cmd);
        }
      } else if (hasSfx) {
        // ===== ไม่มี xfade แต่มี SFX → concat แล้วใส่เสียง SFX ที่รอยต่อ =====
        console.log(`[SFX-ONLY] ใส่เสียง ${path.basename(sfxPath)} ที่ ${currentDuration.toFixed(2)}s (ตัดชน)`);
        const listFile = path.join(tempDir, `pair_${i}.txt`);
        fs.writeFileSync(listFile, `file '${currentClip}'\nfile '${nextClip}'\n`);
        const concatTemp = path.join(tempDir, `concat_temp_${i}.mp4`);
        await runCommand(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${concatTemp}"`);
        
        const delayMs = Math.round(currentDuration * 1000);
        const cmd = `ffmpeg -y -i "${concatTemp}" -i "${sfxPath}" -filter_complex "[1:a]adelay=${delayMs}|${delayMs},aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=1.5[sfx];[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[main];[main][sfx]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 128k -ar 44100 -ac 2 "${mergedPath}"`;
        await runCommand(cmd);
        try { fs.unlinkSync(concatTemp); } catch(e) {}
        try { fs.unlinkSync(listFile); } catch(e) {}
      } else {
        // ===== ไม่มี transition ไม่มี SFX → concat ธรรมดา =====
        console.log(`[CONCAT] Scene ${i+1} → ${i+2} (ตัดชน)`);
        const listFile = path.join(tempDir, `pair_${i}.txt`);
        fs.writeFileSync(listFile, `file '${currentClip}'\nfile '${nextClip}'\n`);
        await runCommand(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${mergedPath}"`);
        try { fs.unlinkSync(listFile); } catch(e) {}
      }

      // อัปเดต currentClip สำหรับรอบถัดไป
      const mergedDur = await getFileDuration(mergedPath);
      currentDuration = mergedDur || (currentDuration + nextDuration - (transType ? TRANSITION_DURATION : 0));
      currentClip = mergedPath;
    }

    // ===== Burn Subtitles if available =====
    if (subtitles) {
      console.log(`[SUBTITLES] 🔤 Burning subtitles into video...`);
      const srtPath = path.join(tempDir, 'subs.srt');
      fs.writeFileSync(srtPath, subtitles);
      
      const subsOutput = path.join(tempDir, 'merged_with_subs.mp4');
      
      // Parse Subtitle Styles
      const st = subtitleStyle || {};
      const fontName = st.fontName || 'Arial';
      const fontSize = st.fontSize || 24;
      const marginV = st.marginV || 30;
      const borderStyle = st.borderStyle !== undefined ? st.borderStyle : 1; // 1=Outline, 3=OpaqueBox
      const outline = st.outlineThickness !== undefined ? st.outlineThickness : 2.5;
      const shadow = st.shadowThickness !== undefined ? st.shadowThickness : 0;
      
      const hexToAss = (hex) => {
         if(!hex) return "&Hffffff";
         const h = hex.replace('#', '');
         if(h.length !== 6) return "&Hffffff";
         return `&H00${h.substring(4,6)}${h.substring(2,4)}${h.substring(0,2)}`;
      };
      
      const priColor = hexToAss(st.primaryColor || '#ffffff');
      const outColor = hexToAss(st.outlineColor || '#000000');
      const backColor = hexToAss(st.shadowColor || '#000000');

      // Use FFmpeg filter to burn subtitles.
      // BackColour controls shadow color (when BorderStyle=1) or Box color (when BorderStyle=3).
      // Note: If BorderStyle is 3 (Opaque Box), OutlineColour controls the box color in some ffmpeg versions 
      // but standard ASS says BackColour is the box. To be safe, we set both OutlineColour and BackColour to `outColor` when BorderStyle=3.
      const finalBackColor = borderStyle === 3 ? outColor : backColor;

      const style = `FontName=${fontName},Bold=1,FontSize=${fontSize},PrimaryColour=${priColor},OutlineColour=${outColor},BackColour=${finalBackColor},BorderStyle=${borderStyle},Outline=${outline},Shadow=${shadow},MarginV=${marginV}`;
      
      // Ensure path is escaped correctly for ffmpeg filter
      const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      const escapedFontsDir = fontsDir.replace(/\\/g, '/').replace(/:/g, '\\:');
      
      const cmd = `ffmpeg -y -i "${currentClip}" -vf "subtitles='${escapedSrtPath}':fontsdir='${escapedFontsDir}':force_style='${style}'" -c:a copy "${subsOutput}"`;
      await runCommand(cmd);
      currentClip = subsOutput;
    }

    // คัดลอกผลลัพธ์สุดท้าย
    fs.copyFileSync(currentClip, finalOutPath);
    console.log(`[SUCCESS] ✅ Output → ${finalOutPath}`);

    // Cleanup
    cleanup(clipPaths, []);
    if (subtitles) {
       try { fs.unlinkSync(path.join(tempDir, 'subs.srt')); } catch(e) {}
       try { fs.unlinkSync(path.join(tempDir, 'merged_with_subs.mp4')); } catch(e) {}
    }
    // ลบ merged files
    for (let i = 0; i < scenes.length - 1; i++) {
      const f = path.join(tempDir, `merged_${i}.mp4`);
      try { fs.unlinkSync(f); } catch(e) {}
    }

  } catch(e) {
    console.error("[ERROR]", e.message);
    process.exit(1);
  }
}

function cleanup(files, extras) {
  files.forEach(f => { try { fs.unlinkSync(f); } catch(e){} });
  extras.forEach(f => { try { fs.unlinkSync(f); } catch(e){} });
  try { fs.rmdirSync(tempDir); } catch(e) {}
}

start();
