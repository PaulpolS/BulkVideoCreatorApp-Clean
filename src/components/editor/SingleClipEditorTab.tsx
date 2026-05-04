import React, { useState, useEffect, useRef } from 'react';
import { NumInput } from '../ui/NumInput';
import { Card } from '../ui/Card';
import { TEMPLATES, buildBashScript, EffectConfig, SingleClipConfig } from '../../utils/ffmpegBuilder';

const DEFAULT_EFFECTS = {
  fade_in: { var: true, label: "Fade In (ค่อยๆ เปิด)" },
  sharpen: { var: true, label: "Sharpen (เพิ่มความคม)" },
  vignette: { var: false, label: "Vignette (ขอบมืด)" },
  glow: { var: false, label: "Glow / Bloom (แสงเรือง)" },
  grain: { var: false, label: "Film Grain (เม็ดฟิล์ม)" },
  chroma_ab: { var: false, label: "Chromatic Aberration" },
  color_grade: { var: false, label: "Color Grade (โทนอุ่น)" },
  zoom: { var: false, label: "Ken Burns Zoom" },
  phonk_flash: { var: false, label: "💥 Phonk Flash" },
  phonk_shake: { var: false, label: "🫨 Phonk Shake" },
  phonk_invert: { var: false, label: "🔄 Phonk Invert" },
  fr_cartoon: { var: false, label: "🎨 Cartoon (frei0r)" },
  fr_glitch: { var: false, label: "📺 Glitch (frei0r)" }
};

const bgmModules = import.meta.glob('/public/BG_music/*.{mp3,wav,m4a,aac}', { eager: true });
const BG_MUSIC_OPTIONS = Object.keys(bgmModules).map(path => path.split('/').pop() || '');
const ABSOLUTE_BGM_DIR = "/Users/macos/Desktop/ทดสอบว่าทำได้มั้ย/BulkVideoCreatorApp/public/BG_music";

export const SingleClipEditorTab: React.FC = () => {
  const [clipPath, setClipPath] = useState('/Users/macos/Desktop/Done/example.mp4');
  const [outputPath, setOutputPath] = useState('/Users/macos/Desktop/Done/example_output.mp4');
  
  // Scene 1
  const [s1Start, setS1Start] = useState(0.0);
  const [s1End, setS1End] = useState(8.0);
  
  // Scene 2 Jump Cuts
  const [templateKey, setTemplateKey] = useState(Object.keys(TEMPLATES)[0]);
  const [nCuts, setNCuts] = useState(8);
  const [cutDur, setCutDur] = useState(0.5);
  const [s2Total, setS2Total] = useState(4.0);
  
  // Audio Config
  const [bgmPath, setBgmPath] = useState('');
  const [bgmVol, setBgmVol] = useState(0.2);
  const [bgmRamp, setBgmRamp] = useState(0.0);
  const [transDur, setTransDur] = useState(1.0);
  const [transType, setTransType] = useState('fade');
  
  // Effects
  const [scEffects, setScEffects] = useState<{ [key: string]: EffectConfig }>(JSON.parse(JSON.stringify(DEFAULT_EFFECTS)));
  const [scEffectsS2, setScEffectsS2] = useState<{ [key: string]: EffectConfig }>(() => {
    let ef = JSON.parse(JSON.stringify(DEFAULT_EFFECTS));
    Object.keys(ef).forEach(k => ef[k].var = false);
    return ef;
  });

  // Run-directly state
  const [isRunning, setIsRunning] = useState(false);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const abortRef = useRef<(() => void) | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Sync nCuts * cutDur with s2Total
  useEffect(() => {
    setS2Total(parseFloat((nCuts * cutDur).toFixed(2)));
  }, [nCuts, cutDur]);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [runLog]);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    setTemplateKey(key);
    const tmpl = TEMPLATES[key];
    if (tmpl) {
      setNCuts(tmpl.n_cuts);
      setCutDur(tmpl.cut_dur);
    }
  };

  const calculateCuts = (totalClipAssume: number = 30) => {
    // mathematical approximation of Python's _regen
    const tmpl = TEMPLATES[templateKey];
    let cuts: {ts: number, dur: number}[] = [];
    
    if (templateKey.includes("Custom") || !tmpl) {
      // Simplistic custom: just split sequentially
      const sec = totalClipAssume / nCuts;
      for (let i = 0; i < nCuts; i++) {
        cuts.push({ ts: i * sec, dur: cutDur });
      }
      return cuts;
    }

    const section = totalClipAssume / nCuts;
    let durs = [];
    if (tmpl.dynamic) {
      const beats = [0.3, 0.7, 0.4, 0.8, 0.5, 0.6, 0.3, 0.7];
      for(let i=0; i<nCuts; i++) durs.push(beats[i % beats.length]);
    } else {
      for(let i=0; i<nCuts; i++) durs.push(cutDur);
    }

    for (let i = 0; i < nCuts; i++) {
      let di = durs[i];
      let lo = i * section;
      let hi = (i + 1) * section - di;
      if (hi <= lo) hi = lo + 0.01;
      let ts = lo + ((hi - lo) / 2); // default to middle (without true random for determinism)
      ts = Math.max(0, Math.min(ts, totalClipAssume - di));
      cuts.push({ ts, dur: di });
    }
    return cuts;
  };

  const getCutTimelineDuration = () => {
    const sceneEnd = Number.isFinite(s1End) && s1End > 0 ? s1End : 30;
    return Math.max(sceneEnd, cutDur, 0.1);
  };

  const handleGenerateScript = () => {
    if (!clipPath || !outputPath) return alert("Please specify clip path and output path");
    const cuts = calculateCuts(getCutTimelineDuration());

    const config: SingleClipConfig = {
      clipPath,
      outputPath,
      scene1Start: s1Start,
      scene1End: s1End,
      cutsPreview: cuts,
      bgmPath,
      bgmVolStart: bgmVol,
      bgmRampAt: bgmRamp,
      scEffects,
      scEffectsS2,
      transType,
      transDur,
    };

    const bashScript = buildBashScript(config);
    
    // Download logic
    const blob = new Blob([bashScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `render_singleclip_${Date.now()}.command`; // .command makes it double-clickable on Mac
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRun = async () => {
    if (!clipPath || !outputPath) return alert("กรุณาเลือกโฟลเดอร์ต้นฉบับและโฟลเดอร์ Output ก่อน");

    // List video files in source folder
    let videoFiles: string[] = [];
    try {
      const res = await fetch('/api/list-folder-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: clipPath }),
      });
      const data = await res.json();
      videoFiles = data.files || [];
    } catch (e) {
      return alert("เกิดข้อผิดพลาดในการอ่านไฟล์ในโฟลเดอร์");
    }

    if (videoFiles.length === 0) {
      return alert("ไม่พบไฟล์วิดีโอในโฟลเดอร์ที่เลือก");
    }

    // Build combined bash script for all files
    const scriptParts: string[] = [
      `#!/bin/bash`,
      `set -euo pipefail`,
      `export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"`,
      `mkdir -p "${outputPath}"`,
      `echo "=== เริ่มประมวลผล ${videoFiles.length} ไฟล์ ==="`,
    ];

    for (let i = 0; i < videoFiles.length; i++) {
      const filename = videoFiles[i];
      const basename = filename.replace(/\.[^/.]+$/, ''); // strip extension
      const filePath = clipPath + '/' + filename;
      const outFilePath = outputPath + '/' + basename + '_output.mp4';

      const cuts = calculateCuts(getCutTimelineDuration());
      const config: SingleClipConfig = {
        clipPath: filePath,
        outputPath: outFilePath,
        scene1Start: s1Start,
        scene1End: s1End,
        cutsPreview: cuts,
        bgmPath,
        bgmVolStart: bgmVol,
        bgmRampAt: bgmRamp,
        scEffects,
        scEffectsS2,
        transType,
        transDur,
      };

      const individualScript = buildBashScript(config)
        .replace(/^#!.*\n/, '')         // strip shebang
        .replace(/^#.*\n/gm, '');       // strip comment lines

      scriptParts.push(individualScript.trim());
      scriptParts.push(`echo "--- เสร็จไฟล์ที่ ${i + 1}: ${filename} ---"`);
    }

    scriptParts.push(`echo "=== ทำเสร็จทั้งหมด! ==="`);
    const combinedScript = scriptParts.join('\n');

    // Start running
    setIsRunning(true);
    setRunLog([]);
    setRunStatus('running');

    let aborted = false;
    const controller = new AbortController();
    abortRef.current = () => {
      aborted = true;
      controller.abort();
    };

    try {
      const response = await fetch('/api/run-bash-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: combinedScript }),
        signal: controller.signal,
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.type === 'log') {
                setRunLog(prev => [...prev.slice(-99), payload.text]);
              } else if (payload.type === 'done') {
                setRunStatus('done');
                setIsRunning(false);
              } else if (payload.type === 'error') {
                setRunLog(prev => [...prev.slice(-99), '[ERROR] ' + payload.text]);
                setRunStatus('error');
                setIsRunning(false);
              }
            } catch {}
          }
        }
      }
    } catch (e: any) {
      if (!aborted) {
        setRunLog(prev => [...prev, '[ERROR] ' + e.message]);
        setRunStatus('error');
      } else {
        setRunLog(prev => [...prev, '[ หยุดการทำงาน ]']);
        setRunStatus('idle');
      }
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
  };

  const toggleEffect = (scene: 1 | 2, key: string) => {
    if (scene === 1) {
      setScEffects(prev => ({ ...prev, [key]: { ...prev[key], var: !prev[key].var } }));
    } else {
      setScEffectsS2(prev => ({ ...prev, [key]: { ...prev[key], var: !prev[key].var } }));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto dark:text-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          🎬 โหมดตัดต่อคลิปเดียว (Single Clip Editor)
        </h1>
        <div className="flex gap-2 items-center">
          <button
            onClick={handleGenerateScript}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg shadow transition-colors text-sm"
          >
            💾 สร้างสคริปต์ .command
          </button>
          {runStatus === 'done' ? (
            <button
              onClick={() => { setRunStatus('idle'); setRunLog([]); }}
              className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg shadow text-sm"
            >
              ✅ เสร็จแล้ว — รันอีกครั้ง?
            </button>
          ) : isRunning ? (
            <button
              onClick={handleStop}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg shadow transition-colors"
            >
              ⛔ หยุด
            </button>
          ) : (
            <button
              onClick={handleRun}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow transition-colors"
            >
              ▶ ตัดต่อเลย!
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <Card>
            <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 font-bold text-lg">📂 เลือกไฟล์ต้นฉบับ</div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">โฟลเดอร์ไฟล์ต้นฉบับ <span className="text-xs text-gray-500">(จะทำทุกไฟล์วิดีโอในโฟลเดอร์)</span></label>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={async () => {
                      const res = await fetch('/api/pick-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'เลือกโฟลเดอร์ไฟล์วิดีโอต้นฉบับ' }) });
                      const data = await res.json();
                      if (data.success) setClipPath(data.dir);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-all whitespace-nowrap"
                  >
                    📁 เลือกโฟลเดอร์
                  </button>
                  <span className="font-mono text-xs text-gray-400 truncate flex-1 bg-gray-800/60 rounded px-2 py-2 border border-gray-700">
                    {clipPath || 'ยังไม่ได้เลือก...'}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-2">โฟลเดอร์ Output</label>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={async () => {
                      const res = await fetch('/api/pick-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'เลือกโฟลเดอร์สำหรับบันทึกไฟล์ Output' }) });
                      const data = await res.json();
                      if (data.success) setOutputPath(data.dir);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-all whitespace-nowrap"
                  >
                    📁 เลือกโฟลเดอร์
                  </button>
                  <span className="font-mono text-xs text-gray-400 truncate flex-1 bg-gray-800/60 rounded px-2 py-2 border border-gray-700">
                    {outputPath || 'ยังไม่ได้เลือก...'}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 font-bold text-lg">🎬 Scene 1 (คลิปเปิดแบบยาว)</div>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm mb-1">เริ่มที่วินาที</label>
                  <NumInput step={0.5} value={s1Start} onChange={setS1Start} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm mb-1">จบที่วินาที</label>
                  <NumInput step={0.5} value={s1End} onChange={setS1End} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" />
                </div>
              </div>
              
              <div className="pt-2">
                <label className="block text-sm font-bold text-purple-400 mb-2">⚡ Effects (Scene 1)</label>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {Object.entries(scEffects).map(([key, eq]) => (
                    <label key={key} className="flex items-start gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={eq.var} onChange={() => toggleEffect(1, key)} className="mt-0.5" />
                      <span>{eq.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 font-bold text-lg">🎵 เสียงเพลง BGM</div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">ไฟล์เพลง BGM</label>
                <div className="space-y-2">
                  <select
                    value={bgmPath.startsWith(ABSOLUTE_BGM_DIR) ? bgmPath : (bgmPath ? 'custom' : '')}
                    onChange={e => {
                      if (e.target.value && e.target.value !== 'custom') setBgmPath(e.target.value);
                      else if (e.target.value === '') setBgmPath('');
                    }}
                    className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 font-mono text-sm"
                  >
                    <option value="">[ ไม่ใช้เพลง ]</option>
                    {BG_MUSIC_OPTIONS.map(opt => (
                      <option key={opt} value={`${ABSOLUTE_BGM_DIR}/${opt}`}>🎵 {opt}</option>
                    ))}
                    <option value="custom">📂 เลือกไฟล์จากเครื่อง...</option>
                  </select>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={async () => {
                        const res = await fetch('/api/pick-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'เลือกไฟล์เพลง BGM (mp3, m4a, wav, aac)' }) });
                        const data = await res.json();
                        if (data.success) setBgmPath(data.file);
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-lg transition-all whitespace-nowrap"
                    >
                      🎵 เลือกไฟล์เพลง
                    </button>
                    <span className="font-mono text-xs text-gray-400 truncate flex-1 bg-gray-800/60 rounded px-2 py-2 border border-gray-700">
                      {bgmPath ? bgmPath.split('/').pop() : 'ยังไม่ได้เลือก...'}
                    </span>
                    {bgmPath && (
                      <button onClick={() => setBgmPath('')} className="text-xs px-2 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-all">✕</button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm mb-1">ความดัง (0.0-1.0)</label>
                  <NumInput step={0.05} min={0} max={1} value={bgmVol} onChange={setBgmVol} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm mb-1">Ramp Up ที่วิ</label>
                  <NumInput step={0.5} value={bgmRamp} onChange={setBgmRamp} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <Card>
            <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 font-bold text-lg">✂️ Scene 2 (Jump Cuts จังหวะนรก)</div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">🔥 สไตล์ Template</label>
                <select value={templateKey} onChange={handleTemplateChange} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 font-mono text-sm">
                  {Object.keys(TEMPLATES).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm mb-1">จำนวน Cuts</label>
                  <NumInput min={1} value={nCuts} onChange={setNCuts} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm mb-1">ความยาวต่อ Cut (วิ)</label>
                  <NumInput step={0.1} min={0.1} value={cutDur} onChange={setCutDur} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm mb-1">เวลารวม (วิ)</label>
                  <input type="number" disabled value={s2Total} className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-900 dark:border-gray-700 opacity-50" />
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-sm font-bold text-purple-400 mb-2">⚡ Effects (Scene 2)</label>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {Object.entries(scEffectsS2).map(([key, eq]) => (
                    <label key={key} className="flex items-start gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={eq.var} onChange={() => toggleEffect(2, key)} className="mt-0.5" />
                      <span>{eq.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 font-bold text-lg">✨ การกั้นรอยต่อ (Transition)</div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm mb-1">Transition Type</label>
                <select value={transType} onChange={e => setTransType(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 font-mono text-sm">
                  {["fade", "dissolve", "wipeleft", "wiperight", "slideleft", "slideright", "circleopen", "radial"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex-[0.5]">
                <label className="block text-sm mb-1">Duration (วิ)</label>
                <NumInput step={0.1} min={0} value={transDur} onChange={setTransDur} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" />
              </div>
            </div>
          </Card>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-200">
            <strong>💡 คำแนะนำ:</strong><br />
            1. ตั้งค่าการตัดคลิป Effect แบบละเอียดยิบในหน้านี้ (ไม่ต้องใช้การ์ดจอแรง)<br />
            2. กดปุ่ม "ตัดต่อเลย!" เพื่อรัน ffmpeg โดยตรง หรือ "สร้างสคริปต์ .command" เพื่อดาวน์โหลดไฟล์รันเอง<br />
            3. ดับเบิ้ลคลิกไฟล์ .command บน Desktop หรือ Terminal ได้เลย FFmpeg จะจัดการทุกอย่างจนจบ!
          </div>
        </div>
      </div>

      {/* Log Panel */}
      {runLog.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-bold text-sm text-gray-300">📋 Log Output</span>
            {runStatus === 'running' && (
              <span className="flex items-center gap-1 text-xs text-amber-400 font-mono animate-pulse">
                ● กำลังประมวลผล...
              </span>
            )}
            {runStatus === 'done' && (
              <span className="text-xs text-green-400 font-mono">● เสร็จเรียบร้อย</span>
            )}
            {runStatus === 'error' && (
              <span className="text-xs text-red-400 font-mono">● เกิดข้อผิดพลาด</span>
            )}
            <button
              onClick={() => setRunLog([])}
              className="ml-auto text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-400 rounded transition-all"
            >
              ล้าง
            </button>
          </div>
          <div className="bg-black/80 rounded-lg p-4 font-mono text-xs text-green-300 h-64 overflow-y-auto border border-gray-700">
            {runLog.map((line, i) => (
              <div key={i} className="leading-5 whitespace-pre-wrap break-all">{line}</div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};
