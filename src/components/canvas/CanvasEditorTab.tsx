import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getActiveOpenRouterKey } from '../../hooks/useApiSettings';
import { NumInput } from '../ui/NumInput';

interface TextSegment { text: string; color: string; fontSize: number; bold: boolean; }
interface CanvasFolder { name: string; fileCount: number; }
interface CanvasFile { name: string; url: string; }
interface SavedStyle { id: string; name: string; layoutRules: string; }

const DEFAULT_AI_MODEL = "google/gemini-2.5-flash";

export function CanvasEditorTab() {
  // === Folder Management ===
  const [folders, setFolders] = useState<CanvasFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [folderFiles, setFolderFiles] = useState<CanvasFile[]>([]);
  const [newFolderName, setNewFolderName] = useState('');

  // === Canvas Settings ===
  const [rawText, setRawText] = useState('');
  const [segments, setSegments] = useState<TextSegment[]>([]);
  const [bgImage, setBgImage] = useState('');
  const [logoImage, setLogoImage] = useState('');
  const [logoPosition, setLogoPosition] = useState('top-right');
  const [logoScale, setLogoScale] = useState('medium');
  const [canvasWidth, setCanvasWidth] = useState(1080);
  const [canvasHeight, setCanvasHeight] = useState(1080);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // === AI Style Analysis ===
  const [analyzedStyle, setAnalyzedStyle] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [styleName, setStyleName] = useState('');
  const [savedStyles, setSavedStyles] = useState<SavedStyle[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // === Load folders & styles on mount ===
  useEffect(() => { 
    loadFolders(); 
    const saved = localStorage.getItem('canvas_style_presets');
    if (saved) {
      try { setSavedStyles(JSON.parse(saved)); } catch(e) {}
    }
    
    // Auto-load drafted text from YouTube generator
    const draftedText = localStorage.getItem('canvas_draft_text');
    if (draftedText) {
      setRawText(draftedText);
      localStorage.removeItem('canvas_draft_text');
      // Show notification briefly or just let it populate
    }
  }, []);

  const loadFolders = async () => {
    try {
      const res = await fetch('/api/canvas-folders');
      const data = await res.json();
      if (data.success) setFolders(data.folders);
    } catch(e) {}
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) { alert('กรุณาใส่ชื่อ Folder'); return; }
    try {
      const res = await fetch('/api/canvas-folders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() })
      });
      const data = await res.json();
      if (data.success) { setNewFolderName(''); loadFolders(); }
      else alert(data.error);
    } catch(e: any) { alert(e.message); }
  };

  const selectFolder = async (name: string) => {
    setSelectedFolder(name);
    try {
      const res = await fetch('/api/canvas-files?folder=' + encodeURIComponent(name));
      const data = await res.json();
      if (data.success) setFolderFiles(data.files);
    } catch(e) {}
  };

  const openFolderInOS = async (name: string) => {
    try {
      await fetch('/api/canvas-open-folder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: name })
      });
    } catch(e) {}
  };

  const getOpenRouterKey = () => getActiveOpenRouterKey();

  const urlToBase64 = async (url: string): Promise<string> => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const analyzeImages = async () => {
    if (folderFiles.length === 0) return;
    const apiKey = getOpenRouterKey();
    if (!apiKey) { setErrorMsg('กรุณาตั้งค่า OpenRouter API Key'); return; }

    setIsAnalyzing(true);
    setErrorMsg('');
    try {
      console.log('[Analyze] Starting analysis with', folderFiles.length, 'files');
      const urlsToAnalyze = folderFiles.slice(0, 2).map(f => f.url);
      const base64Images = await Promise.all(urlsToAnalyze.map(url => urlToBase64(url)));
      
      console.log('[Analyze] Converted images to base64 successfully');

      const contentArr: any[] = [
        { type: "text", text: "Analyze the layout, text styling, and typography of these images. Explain the text colors, background style, alignment, and headline phrasing style. Format the response as strict instructions for another AI to replicate this text style. Focus heavily on which colors are used for emphasis." }
      ];

      for (const b64 of base64Images) {
        contentArr.push({ type: "image_url", image_url: { url: b64 } });
      }

      console.log('[Analyze] Sending request to OpenRouter (gemini-2.5-flash)...');

      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Authorization': 'Bearer ' + apiKey, 
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'CreatorHub'
        },
        body: JSON.stringify({
          model: DEFAULT_AI_MODEL,
          messages: [{ role: 'user', content: contentArr }]
        })
      });

      const aiData = await resp.json();
      console.log('[Analyze] Raw Response from OpenRouter:', aiData);
      
      if (aiData.error) throw new Error(aiData.error.message || JSON.stringify(aiData.error));
      
      const resultText = aiData.choices?.[0]?.message?.content || '';
      if (!resultText) throw new Error('AI ส่งผลลัพธ์กลับมาว่างเปล่า');
      
      setAnalyzedStyle(resultText);
      console.log('[Analyze] Analysis complete!');
    } catch (e: any) {
      console.error('[Analyze Error]', e);
      setErrorMsg('Analyze Error: ' + e.message);
    }
    setIsAnalyzing(false);
  };

  const saveStyle = () => {
    if (!styleName.trim() || !analyzedStyle.trim()) return;
    const newStyle: SavedStyle = {
      id: Date.now().toString(),
      name: styleName,
      layoutRules: analyzedStyle
    };
    const nextStyles = [...savedStyles, newStyle];
    setSavedStyles(nextStyles);
    localStorage.setItem('canvas_style_presets', JSON.stringify(nextStyles));
    setStyleName('');
    alert('บันทึก Style สำเร็จ!');
  };

  // === AI Text Segmentation ===
  const processTextWithAI = async () => {
    if (!rawText.trim()) { setErrorMsg('กรุณาใส่ข้อความ'); return; }
    const apiKey = getOpenRouterKey();
    if (!apiKey) { setErrorMsg('กรุณาตั้งค่า OpenRouter API Key'); return; }
    setIsProcessing(true);
    setErrorMsg('');
    try {
      // Build context from reference images if selected
      let refContext = '';
      if (selectedStyleId) {
        const style = savedStyles.find(s => s.id === selectedStyleId);
        if (style) {
          refContext = `\n\nCRITICAL STYLE INSTRUCTIONS TO FOLLOW:\n${style.layoutRules}`;
        }
      } else if (selectedFolder && folderFiles.length > 0) {
        refContext = '\n\nREFERENCE: The user has reference images showing a style with bold colored text banners on dark backgrounds. Use vibrant colors like red, yellow, white, cyan for different text segments. Make it look like viral Thai news/social media graphics.';
      }

      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: DEFAULT_AI_MODEL,
          messages: [
            { role: 'system', content: `You are a graphic design text processor. Given Thai text, split it into visual segments for a social media graphic banner.

Rules:
1. Split text into 2-5 meaningful segments (phrases/sentences)
2. Assign each segment a BOLD, VIBRANT color (use hex like #FF0000, #FFD700, #00FFFF, #FFFFFF, #FF6600)
3. Main headline should be largest (48-64px), sub-text smaller (28-40px)
4. Use contrasting colors that pop on dark backgrounds
5. Make it look like viral Thai news graphics with colorful text${refContext}

Return JSON array:
[
  { "text": "segment text", "color": "#hex", "fontSize": 48, "bold": true },
  ...
]

CRITICAL: Return ONLY the JSON array. No markdown.` },
            { role: 'user', content: rawText }
          ],
          response_format: { type: "json_object" }
        })
      });
      const aiData = await resp.json();
      if (aiData.error) throw new Error(aiData.error.message);
      const aiText = aiData.choices?.[0]?.message?.content || '';
      // Try to parse — could be array directly or wrapped in object
      let parsed: any;
      const cleanJson = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJson);
      // If it's an object with a "segments" key or similar, extract the array
      if (!Array.isArray(parsed)) {
        const arrKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
        if (arrKey) parsed = parsed[arrKey];
        else throw new Error('AI did not return an array');
      }
      setSegments(parsed);
    } catch(e: any) {
      console.error('[Canvas AI]', e);
      setErrorMsg('AI Error: ' + e.message);
    }
    setIsProcessing(false);
  };

  // === File to Base64 ===
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsDataURL(file);
    });
  };

  // === Draw Canvas ===
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const drawContent = () => {
      // Draw text segments
      if (segments.length > 0) {
        const totalTextHeight = segments.reduce((acc, s) => acc + s.fontSize * 1.4, 0);
        let y = (canvasHeight - totalTextHeight) / 2 + segments[0].fontSize;

        segments.forEach(seg => {
          ctx.font = `${seg.bold ? 'bold' : 'normal'} ${seg.fontSize}px "Noto Sans Thai", "Sarabun", sans-serif`;
          ctx.fillStyle = seg.color;
          ctx.textAlign = 'center';
          ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          ctx.lineWidth = seg.fontSize * 0.08;
          ctx.strokeText(seg.text, canvasWidth / 2, y);
          ctx.fillText(seg.text, canvasWidth / 2, y);
          y += seg.fontSize * 1.4;
        });
      }

      // Draw logo
      if (logoImage) {
        const logo = new Image();
        logo.onload = () => {
          const scaleMap: Record<string, number> = { small: 0.08, medium: 0.12, large: 0.18 };
          const sc = scaleMap[logoScale] || 0.12;
          const lw = canvasWidth * sc;
          const lh = (logo.height / logo.width) * lw;
          const m = canvasWidth * 0.03;
          let x = m, ly = m;
          if (logoPosition === 'top-right') x = canvasWidth - lw - m;
          else if (logoPosition === 'bottom-left') ly = canvasHeight - lh - m;
          else if (logoPosition === 'bottom-right') { x = canvasWidth - lw - m; ly = canvasHeight - lh - m; }
          else if (logoPosition === 'center') { x = (canvasWidth - lw) / 2; ly = (canvasHeight - lh) / 2; }
          ctx.drawImage(logo, x, ly, lw, lh);
        };
        logo.src = logoImage;
      }
    };

    // Draw background
    if (bgImage) {
      const img = new Image();
      img.onload = () => {
        // Cover mode
        const scale = Math.max(canvasWidth / img.width, canvasHeight / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (canvasWidth - w) / 2, (canvasHeight - h) / 2, w, h);
        // Dark overlay for text readability
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        drawContent();
      };
      img.src = bgImage;
    } else {
      drawContent();
    }
  }, [segments, bgImage, logoImage, logoPosition, logoScale, canvasWidth, canvasHeight]);

  // Redraw when anything changes
  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  // === Download ===
  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Force a clean redraw before download
    setTimeout(() => {
      const link = document.createElement('a');
      link.download = 'canvas_' + Date.now() + '.png';
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 300);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* === Left Panel: Controls === */}
        <div className="lg:col-span-1 space-y-4">

          {/* Folder Management */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 space-y-3">
            <h3 className="font-bold text-pink-400 flex items-center gap-2">📁 Folder รูปต้นแบบ</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ชื่อ Folder ใหม่..."
                className="flex-1 p-2 text-sm bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); }}
              />
              <button onClick={createFolder} className="px-3 py-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-bold rounded-lg shrink-0">+ สร้าง</button>
            </div>
            {folders.length > 0 && (
              <div className="space-y-1.5">
                {folders.map(f => (
                  <button key={f.name}
                    onClick={() => selectFolder(f.name)}
                    className={`w-full text-left p-2 rounded-lg text-sm transition-all ${selectedFolder === f.name ? 'bg-pink-600/20 border border-pink-500' : 'bg-[var(--bg-elevated)] border border-transparent hover:border-white/10'}`}
                  >
                    📂 {f.name} <span className="text-gray-500 text-xs">({f.fileCount} รูป)</span>
                  </button>
                ))}
              </div>
            )}
            {selectedFolder && folderFiles.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500">รูปใน "{selectedFolder}":</p>
                  <button onClick={() => openFolderInOS(selectedFolder)} className="text-[10px] bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded text-white">📂 เปิดใน Mac</button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {folderFiles.map(f => (
                    <img key={f.name} src={f.url} className="w-full aspect-square object-cover rounded border border-[var(--border-color)]" alt={f.name} />
                  ))}
                </div>
                
                {/* AI Analyze Button */}
                <div className="mt-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg space-y-3">
                  <button
                    onClick={analyzeImages}
                    disabled={isAnalyzing}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs disabled:opacity-50 transition-colors"
                  >
                    {isAnalyzing ? '⏳ AI กำลังวิเคราะห์รูป...' : '🤖 ให้ AI วิเคราะห์ Layout & พาดหัวจากรูป'}
                  </button>
                  {analyzedStyle && (
                    <div className="space-y-2 animate-fade-in">
                      <textarea 
                        className="w-full h-32 p-2 text-xs bg-black border border-indigo-500/30 rounded resize-none focus:outline-none focus:border-indigo-500"
                        value={analyzedStyle}
                        onChange={(e) => setAnalyzedStyle(e.target.value)}
                        placeholder="ผลการวิเคราะห์สไตล์..."
                      />
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="ตั้งชื่อ Style นี้..." 
                          className="flex-1 p-2 text-xs bg-black border border-indigo-500/30 rounded focus:outline-none focus:border-indigo-500"
                          value={styleName}
                          onChange={(e) => setStyleName(e.target.value)}
                        />
                        <button onClick={saveStyle} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded">💾 บันทึก</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {selectedFolder && folderFiles.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">📭 ยังไม่มีรูป — ลากรูปต้นแบบไปใส่ใน folder:<br/><code className="text-pink-400">public/app_data/canvas_projects/{selectedFolder}/</code></p>
                <button onClick={() => openFolderInOS(selectedFolder)} className="w-full text-xs bg-gray-700 hover:bg-gray-600 py-1.5 rounded text-white transition-colors">📂 เปิดโฟลเดอร์นี้ใน Mac</button>
              </div>
            )}
          </div>

          {/* Text Input */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-yellow-400 flex items-center gap-2">📝 ข้อความ</h3>
              {savedStyles.length > 0 && (
                <select 
                  className="bg-black text-white p-1 text-[10px] border border-gray-600 rounded max-w-[140px]"
                  value={selectedStyleId}
                  onChange={(e) => setSelectedStyleId(e.target.value)}
                >
                  <option value="">-- ไม่ใช้ Style Preset --</option>
                  {savedStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>
            <textarea
              placeholder={"ใส่ข้อความที่ต้องการทำรูป...\nเช่น: ทรัมป์สั่งลุย! ส่งเรือรบ 3 ลำ ถล่มอิหร่าน!"}
              className="w-full h-28 p-3 text-sm bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg resize-none"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
            <button
              onClick={processTextWithAI}
              disabled={isProcessing}
              className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg text-sm disabled:opacity-50 transition-colors"
            >
              {isProcessing ? '⏳ AI กำลังแบ่งคำ...' : '🤖 ให้ AI แบ่งคำ + ระบายสี'}
            </button>

            {/* Segment Editor */}
            {segments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-bold">แก้ไขสี/ขนาด:</p>
                {segments.map((seg, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[var(--bg-elevated)] p-2 rounded-lg">
                    <input
                      type="color"
                      value={seg.color}
                      onChange={(e) => {
                        const next = [...segments];
                        next[i] = { ...seg, color: e.target.value };
                        setSegments(next);
                      }}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={seg.text}
                      onChange={(e) => {
                        const next = [...segments];
                        next[i] = { ...seg, text: e.target.value };
                        setSegments(next);
                      }}
                      className="flex-1 p-1 text-sm bg-transparent border-b border-[var(--border-color)] focus:outline-none"
                      style={{ color: seg.color }}
                    />
                    <NumInput min={12} max={120} value={seg.fontSize} onChange={n => { const next = [...segments]; next[i] = { ...seg, fontSize: n }; setSegments(next); }} className="w-14 p-1 text-xs bg-black border border-[var(--border-color)] rounded text-center" />
                    <button
                      onClick={() => {
                        const next = [...segments];
                        next[i] = { ...seg, bold: !seg.bold };
                        setSegments(next);
                      }}
                      className={`px-2 py-1 text-xs rounded font-bold ${seg.bold ? 'bg-white text-black' : 'bg-gray-700 text-gray-400'}`}
                    >B</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Background Image */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 space-y-3">
            <h3 className="font-bold text-blue-400 flex items-center gap-2">🖼️ พื้นหลัง</h3>
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) { const b64 = await fileToBase64(f); setBgImage(b64); }
                  e.target.value = '';
                }} />
                <div className="w-full py-2 text-center text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  {bgImage ? '🔄 เปลี่ยนพื้นหลัง' : '📷 อัพรูปพื้นหลัง'}
                </div>
              </label>
              {bgImage && <button onClick={() => setBgImage('')} className="px-3 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded-lg text-sm">ลบ</button>}
            </div>
            {bgImage && <img src={bgImage} className="w-full h-20 object-cover rounded-lg border border-[var(--border-color)]" />}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-gray-500">ความกว้าง</label>
                <select value={canvasWidth + 'x' + canvasHeight} onChange={(e) => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  setCanvasWidth(w); setCanvasHeight(h);
                }} className="w-full bg-black text-white p-1.5 rounded border border-gray-600 text-xs">
                  <option value="1080x1080">1080×1080 (1:1)</option>
                  <option value="1920x1080">1920×1080 (16:9)</option>
                  <option value="1080x1920">1080×1920 (9:16)</option>
                  <option value="1200x628">1200×628 (FB Link)</option>
                  <option value="1080x1350">1080×1350 (IG Portrait)</option>
                </select>
              </div>
            </div>
            <p className="text-[10px] text-gray-600 italic">🔮 อนาคต: จะมีระบบหาพื้นหลังอัตโนมัติ</p>
          </div>

          {/* Logo */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 space-y-3">
            <h3 className="font-bold text-green-400 flex items-center gap-2">🏷️ Logo</h3>
            <div className="flex flex-wrap gap-2 items-end">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) { const b64 = await fileToBase64(f); setLogoImage(b64); }
                  e.target.value = '';
                }} />
                <div className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors">
                  {logoImage ? <><img src={logoImage} className="w-5 h-5 rounded object-contain" />เปลี่ยน</> : '📷 อัพ Logo'}
                </div>
              </label>
              {logoImage && <button onClick={() => setLogoImage('')} className="text-[10px] text-red-400">ลบ</button>}
              <select value={logoPosition} onChange={(e) => setLogoPosition(e.target.value)} className="bg-black text-white p-1.5 rounded border border-gray-600 text-xs">
                <option value="top-left">บน-ซ้าย</option>
                <option value="top-right">บน-ขวา</option>
                <option value="bottom-left">ล่าง-ซ้าย</option>
                <option value="bottom-right">ล่าง-ขวา</option>
                <option value="center">กลาง</option>
              </select>
              <select value={logoScale} onChange={(e) => setLogoScale(e.target.value)} className="bg-black text-white p-1.5 rounded border border-gray-600 text-xs">
                <option value="small">เล็ก</option>
                <option value="medium">กลาง</option>
                <option value="large">ใหญ่</option>
              </select>
            </div>
          </div>
        </div>

        {/* === Right Panel: Canvas Preview === */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-purple-400 flex items-center gap-2">🖼️ Canvas Preview</h3>
              <div className="flex gap-2">
                <button onClick={drawCanvas} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg">🔄 รีเฟรช</button>
                <button onClick={downloadCanvas} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg">📥 Download PNG</button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">{errorMsg}</div>
            )}

            <div className="flex justify-center bg-black/30 rounded-lg p-4 border border-[var(--border-color)]">
              <canvas
                ref={canvasRef}
                className="max-w-full border border-[var(--border-color)] rounded shadow-2xl"
                style={{ maxHeight: '70vh' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
