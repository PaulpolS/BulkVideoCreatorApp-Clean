import React, { useState, useEffect } from 'react';
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

  // Sync nCuts * cutDur with s2Total
  useEffect(() => {
    setS2Total(parseFloat((nCuts * cutDur).toFixed(2)));
  }, [nCuts, cutDur]);

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

  const handleGenerateScript = () => {
    if (!clipPath || !outputPath) return alert("Please specify clip path and output path");
    const cuts = calculateCuts(); // assume 30s source for jump calculation

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
        <button 
          onClick={handleGenerateScript}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow transition-colors"
        >
          ▶ สร้างสคริปต์ .command
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <Card>
            <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 font-bold text-lg">📂 เลือกไฟล์ต้นฉบับ</div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Source Video (Path แบบเต็ม)</label>
                <input type="text" value={clipPath} onChange={e => setClipPath(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 font-mono text-sm" />
              </div>
              <div>
                <label className="block text-sm mb-1">Output Video (Path แบบเต็ม)</label>
                <input type="text" value={outputPath} onChange={e => setOutputPath(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 font-mono text-sm" />
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
                <label className="block text-sm mb-1">ไฟล์เพลง</label>
                <div className="space-y-2">
                  <select 
                    value={bgmPath.startsWith(ABSOLUTE_BGM_DIR) ? bgmPath : (bgmPath ? 'custom' : '')} 
                    onChange={e => {
                      if (e.target.value && e.target.value !== 'custom') {
                        setBgmPath(e.target.value);
                      } else if (e.target.value === '') {
                        setBgmPath('');
                      }
                    }} 
                    className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 font-mono text-sm"
                  >
                    <option value="">[ ไม่ใช้เพลง ]</option>
                    {BG_MUSIC_OPTIONS.map(opt => (
                      <option key={opt} value={`${ABSOLUTE_BGM_DIR}/${opt}`}>
                        🎵 {opt}
                      </option>
                    ))}
                    <option value="custom">✏️ พิมพ์ Path เอง...</option>
                  </select>
                  <input 
                    type="text" 
                    placeholder="ป้อน Path แบบเต็มด้วยตัวเอง..." 
                    value={bgmPath} 
                    onChange={e => setBgmPath(e.target.value)} 
                    className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 font-mono text-sm opacity-70" 
                  />
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
            2. พอกดปุ่ม "สร้างสคริปต์ .command" จะได้ไฟล์ไปรันบนเครื่อง Mac โลคัล<br />
            3. ย้ายไปดับเบิ้ลคลิกไฟล์ .command บน Desktop หรือ Terminal ได้เลย FFmpeg จะจัดการทุกอย่างจนจบ!
          </div>
        </div>
      </div>
    </div>
  );
};
