import React, { useState, useRef } from 'react';

const DEFAULT_AI_MODEL = "google/gemini-2.5-flash"; // Excellent vision model

const SYSTEM_PROMPT = `You are an expert AI Image Analyst and Prompt Engineer specializing in Infographic design.

Task: Analyze the provided image completely and reverse-engineer it into a highly detailed, structured JSON format.

Instructions:
1. Analyze layout, color scheme, typography, background, and specific objects.
2. Extract exact Thai or English texts where visible.
3. Break down the content into sections (e.g., if there are 4 zodiac signs, list each separately in content_sections).
4. CRITICAL: ALL text values in the JSON (such as descriptions, themes, layout details, elements, negative prompts, and the final_compiled_prompt) MUST BE WRITTEN IN THE THAI LANGUAGE (ภาษาไทย). The JSON keys must remain in English.
5. Your output MUST be ONLY valid JSON. Do not use Markdown formatting like \`\`\`json or \`\`\` around the output. Just raw JSON text.

Required JSON Structure:
{
  "metadata": {
    "aspect_ratio": "string",
    "resolution": "string",
    "image_type": "Infographic"
  },
  "design_style": {
    "overall_theme": "string",
    "color_scheme": {
      "primary": "string",
      "secondary": "string",
      "accents": ["string"]
    },
    "background": "string",
    "floating_elements": ["string"]
  },
  "typography": {
    "title": {
      "text": "string",
      "font_family": "string",
      "font_style": "string",
      "placement": "string"
    }
  },
  "layout": {
    "structure": "string",
    "arrangement": "string"
  },
  "content_sections": [
    {
      "id": "number",
      "topic": "string",
      "icon_or_character": "string",
      "key_elements": ["string"],
      "text_description": "string"
    }
  ],
  "negative_prompt": ["string"],
  "final_compiled_prompt": "string"
}`;

export function InfographicPromptTab() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [savedStyles, setSavedStyles] = useState<{id: string, name: string, json: string, thumbnail?: string}[]>([]);
  const [isGeneratingNew, setIsGeneratingNew] = useState(false);
  const [generatingStyle, setGeneratingStyle] = useState<any>(null);
  const [bulkTopicsInput, setBulkTopicsInput] = useState('');

  // Load saved styles on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('infographic_saved_styles');
      if (stored) {
        setSavedStyles(JSON.parse(stored));
      }
    } catch(e) {}
  }, []);

  const saveStyle = async () => {
    if (!analysisResult) return;
    const name = window.prompt("ตั้งชื่อสไตล์ Infographic นี้ (เช่น โทนดาร์กมูเตลู, สายการเงินสีทอง):");
    if (!name) return;
    
    let thumbnail = undefined;
    if (imageFile) {
        try {
            thumbnail = await createThumbnailBase64(imageFile);
        } catch(e) {
            console.error("Failed to create thumbnail", e);
        }
    }
    
    const newStyle = {
      id: Date.now().toString(),
      name,
      json: analysisResult,
      thumbnail
    };
    
    const updated = [newStyle, ...savedStyles];
    setSavedStyles(updated);
    localStorage.setItem('infographic_saved_styles', JSON.stringify(updated));
    alert(`✅ บันทึกสไตล์ "${name}" เรียบร้อยแล้ว!`);
  };

  const deleteStyle = (id: string) => {
    if (window.confirm("คุณต้องการลบสไตล์นี้ใช่หรือไม่?")) {
      const updated = savedStyles.filter(s => s.id !== id);
      setSavedStyles(updated);
      localStorage.setItem('infographic_saved_styles', JSON.stringify(updated));
    }
  };

  const copySavedStyle = (json: string) => {
    navigator.clipboard.writeText(json);
    alert('✅ คัดลอก JSON ของสไตล์นี้แล้ว!');
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAnalysisError('กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น');
      return;
    }

    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
    setAnalysisError('');
    setAnalysisResult('');
  };

  const getOpenRouterKey = () => {
    const globalKey = localStorage.getItem('api_global_active_id') 
                      ? JSON.parse(localStorage.getItem('api_global_profiles') || '[]')
                        .find((p: any) => p.id === localStorage.getItem('api_global_active_id'))?.openRouterKey 
                      : null;
    const oldKey = localStorage.getItem('openrouter_key');
    let aiKey = globalKey || oldKey;
    
    if (!aiKey) {
        try {
            const arr = JSON.parse(localStorage.getItem('openrouter_keys') || '[]');
            if(arr.length > 0) aiKey = arr[0].key;
        } catch(e) {}
    }
    return aiKey;
  };

  const compressImageBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1024; // Limit size to 1024px to prevent Payload Too Large
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Cannot get canvas context'));
        
        ctx.fillStyle = '#FFFFFF'; // Add white background just in case of transparency
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // Export as JPEG with 0.8 quality to keep base64 string small
        resolve(canvas.toDataURL('image/jpeg', 0.8));
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = URL.createObjectURL(file);
    });
  };
  const createThumbnailBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 200; // Small size for UI thumbnail
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Cannot get canvas context'));
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.6));
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error('Failed to load image for thumbnail'));
      img.src = URL.createObjectURL(file);
    });
  };

  const executeBulkGeneration = async () => {
    if (!generatingStyle || !bulkTopicsInput.trim()) return;

    const topics = bulkTopicsInput.split('\n').map(t => t.trim()).filter(t => t);
    if (topics.length === 0) return;

    const apiKey = getOpenRouterKey();
    if (!apiKey) {
      setAnalysisError('ไม่พบ OpenRouter API Key กรุณาตั้งค่าก่อน');
      return;
    }

    const styleToUse = generatingStyle;
    setGeneratingStyle(null);
    setBulkTopicsInput('');
    setIsGeneratingNew(true);
    setAnalysisError('');
    setAnalysisResult('');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const GENERATE_PROMPT = `You are an expert Infographic Prompt Engineer.
You have been given a source JSON style template representing an infographic's design, colors, and layout.
Your task is to REWRITE the content parts of the JSON to match a LIST OF NEW TOPICS.
For each topic in the list, you must generate a NEW JSON object based on the source style.

LIST OF NEW TOPICS:
${topics.map((t, i) => `${i+1}. "${t}"`).join('\n')}

Instructions for EACH generated JSON:
1. Keep the overall JSON structure EXACTLY the same as the source JSON.
2. Update "typography.title" to be a catchy title for the current topic. Keep the font styling the same.
3. Completely rewrite "content_sections" to fit the current topic. Generate appropriate topics, icons, key elements, and descriptions.
4. Rewrite the "final_compiled_prompt" to reflect the new topic while strictly incorporating the existing color scheme, layout, and visual theme. Make sure to explicitly wrap the Thai text to be rendered in quotes.
5. CRITICAL: ALL text values in your generated JSON objects (including design descriptions, themes, layout, content elements, negative prompts, and final_compiled_prompt) MUST BE WRITTEN IN THE THAI LANGUAGE (ภาษาไทย). The JSON keys must remain in English.

CRITICAL FORMAT REQUIREMENT:
YOUR OUTPUT MUST BE ONLY A JSON OBJECT containing a single key "prompts", which is an array of your generated JSON objects.
Example:
{
  "prompts": [
    { ...json for topic 1... },
    { ...json for topic 2... }
  ]
}
Do not include markdown formatting like \`\`\`json.

SOURCE JSON:
${styleToUse.json}`;

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'Bulk Video Creator',
        },
        body: JSON.stringify({
          model: DEFAULT_AI_MODEL,
          messages: [
            {
              role: 'user',
              content: GENERATE_PROMPT
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err.error?.message || err.message || `API Error: ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices[0]?.message?.content;
      
      let finalOutput = '';
      try {
        const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.prompts && Array.isArray(parsed.prompts)) {
           finalOutput = parsed.prompts.map((p: any) => JSON.stringify(p, null, 2)).join('\n\n');
        } else if (Array.isArray(parsed)) {
           finalOutput = parsed.map((p: any) => JSON.stringify(p, null, 2)).join('\n\n');
        } else {
           finalOutput = JSON.stringify(parsed, null, 2);
        }
      } catch (e) {
        finalOutput = content;
      }

      setAnalysisResult(finalOutput);

    } catch (e: any) {
      console.error(e);
      setAnalysisError(`เกิดข้อผิดพลาดในการสร้าง: ${e.message}`);
    } finally {
      setIsGeneratingNew(false);
    }
  };
  const analyzeImage = async () => {
    if (!imageFile) return;

    const apiKey = getOpenRouterKey();
    if (!apiKey) {
      setAnalysisError('ไม่พบ OpenRouter API Key กรุณาไปตั้งค่าที่เมนู "ตั้งค่า API" ก่อน');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError('');

    try {
      const frameBase64 = await compressImageBase64(imageFile);

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'Bulk Video Creator',
        },
        body: JSON.stringify({
          model: DEFAULT_AI_MODEL,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: SYSTEM_PROMPT },
                { type: 'image_url', image_url: { url: frameBase64 } }
              ]
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err.error?.message || err.message || `API Error: ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices[0]?.message?.content;
      
      let parsedStr = '';
      try {
        const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        parsedStr = JSON.stringify(parsed, null, 2);
      } catch (e) {
        // Fallback to raw content if parsing fails
        parsedStr = content;
      }

      setAnalysisResult(parsedStr);

    } catch (e: any) {
      console.error(e);
      setAnalysisError(`เกิดข้อผิดพลาด: ${e.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopy = () => {
    if (!analysisResult) return;
    navigator.clipboard.writeText(analysisResult);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-[#ec4899] to-[#f43f5e] text-white shadow-lg shadow-[#ec4899]/30">
          🎨
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Infographic Prompt Extractor</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">อัปโหลดรูปภาพ Infographic เพื่อให้ AI แกะโครงสร้าง Prompt ออกมาเป็น JSON</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload Section */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-sm flex flex-col gap-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">1. อัปโหลดรูปภาพเรฟเฟอเรนซ์</h2>
          
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
          />
          
          {!imagePreviewUrl ? (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-[250px] rounded-2xl border-2 border-dashed border-[#ec4899]/50 hover:bg-[#ec4899]/5 transition-all flex flex-col items-center justify-center gap-3 text-[#ec4899] font-medium"
              >
                <span className="text-4xl">📤</span>
                อัปโหลดรูปภาพ Infographic (JPG / PNG)
              </button>
          ) : (
             <div className="relative w-full h-[250px] rounded-2xl overflow-hidden border border-[var(--border-color)] bg-black/5 group flex items-center justify-center">
                <img 
                  src={imagePreviewUrl} 
                  alt="Preview" 
                  className="max-w-full max-h-full object-contain"
                />
                <button 
                  onClick={() => { setImageFile(null); setImagePreviewUrl(null); setAnalysisError(''); setAnalysisResult(''); }}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-500 transition-colors"
                >
                   ×
                </button>
             </div>
          )}

          {imagePreviewUrl && (
             <button
               disabled={isAnalyzing}
               onClick={analyzeImage}
               className="w-full py-3 bg-[#ec4899] hover:bg-[#db2777] text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait"
             >
               {isAnalyzing ? (
                 <>
                   <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                   กำลังแกะ Prompt โครงสร้างรูปภาพ...
                 </>
               ) : (
                 '✨ ให้ AI แกะ Prompt (Extract to JSON)'
               )}
             </button>
          )}

          {analysisError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm">
              ⚠️ {analysisError}
            </div>
          )}
        </div>

        {/* Result Section */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-sm flex flex-col gap-4 h-[600px]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">2. ผลลัพธ์ (JSON)</h2>
            <div className="flex gap-2">
              <button 
                onClick={saveStyle}
                disabled={!analysisResult}
                className="text-sm px-4 py-1.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 font-medium shadow-sm"
              >
                💾 บันทึกสไตล์
              </button>
              <button 
                onClick={handleCopy}
                disabled={!analysisResult}
                className="text-sm px-4 py-1.5 bg-[var(--bg-neutral)] hover:bg-[#ec4899] hover:text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 font-medium"
              >
                {copyFeedback ? '✅ คัดลอกแล้ว!' : '📋 คัดลอก JSON'}
              </button>
            </div>
          </div>
          
          <div className="flex-1 bg-black/80 rounded-xl p-4 overflow-auto border border-[#333]">
            {isAnalyzing || isGeneratingNew ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                 <svg className="animate-spin h-8 w-8 text-[#ec4899]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 <p>{isGeneratingNew ? 'กำลังคิดเนื้อหาและประกอบร่าง Prompt ใหม่...' : 'กำลังวิเคราะห์รูปภาพ...'}</p>
              </div>
            ) : analysisResult ? (
              <pre className="text-[#a8c7fa] text-xs font-mono whitespace-pre-wrap">
                {analysisResult}
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                <span className="text-3xl">🧩</span>
                <p>รอการวิเคราะห์รูปภาพ หรือสแกนจากสไตล์ที่บันทึกไว้...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saved Styles Section */}
      {savedStyles.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">📚</span>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">สไตล์ที่บันทึกไว้ (Saved Styles)</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {savedStyles.map((style) => (
              <div key={style.id} className="p-4 border border-[var(--border-color)] bg-[var(--bg-neutral)]/30 rounded-2xl flex flex-col gap-3 hover:border-[#ec4899]/50 transition-colors">
                {style.thumbnail ? (
                  <div className="w-full h-40 rounded-xl overflow-hidden border border-[var(--border-color)] bg-black/20 flex items-center justify-center">
                    <img src={style.thumbnail} alt="thumb" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-full h-40 rounded-xl bg-[#ec4899]/5 border border-[#ec4899]/20 flex items-center justify-center text-4xl">
                    🖼️
                  </div>
                )}
                
                <div className="flex items-start justify-between gap-2 mt-1">
                  <h3 className="font-bold text-[var(--text-primary)] truncate text-lg" title={style.name}>{style.name}</h3>
                  <button 
                    onClick={() => deleteStyle(style.id)}
                    className="text-red-400 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors flex-shrink-0"
                    title="ลบ"
                  >
                    🗑️
                  </button>
                </div>
                
                <button
                    onClick={() => setGeneratingStyle(style)}
                    className="w-full py-2 bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] hover:opacity-90 text-white text-xs font-bold rounded-lg transition-all shadow-md mt-1"
                >
                    🪄 สร้างหัวข้อใหม่จากสไตล์นี้ (Bulk)
                </button>
                <div className="flex gap-2 mt-auto pt-2">
                  <button 
                    onClick={() => copySavedStyle(style.json)}
                    className="flex-1 py-1.5 bg-white dark:bg-[#1e293b] text-xs font-bold rounded-lg border border-[var(--border-color)] hover:border-[#ec4899] hover:text-[#ec4899] transition-all"
                  >
                    📋 คัดลอก
                  </button>
                  <button 
                    onClick={() => {
                      // View JSON logic
                      setAnalysisResult(style.json);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex-1 py-1.5 bg-white dark:bg-[#1e293b] text-xs font-bold rounded-lg border border-[var(--border-color)] hover:border-[#8b5cf6] hover:text-[#8b5cf6] transition-all"
                  >
                    👁️ ดูข้อมูล
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Bulk Generation Modal */}
      {generatingStyle && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 w-full max-w-2xl flex flex-col gap-4 shadow-2xl">
               <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  🪄 สร้างหัวข้อใหม่จากสไตล์: {generatingStyle.name}
               </h2>
               <p className="text-sm text-[var(--text-secondary)]">
                  กรุณากรอกหัวข้อที่ต้องการสร้าง (ใส่ได้หลายหัวข้อ บรรทัดละ 1 หัวข้อ) เช่น: <br/>
                  <span className="text-[#ec4899]">5 วิธีประหยัดเงินมนุษย์เงินเดือน<br/>3 ราศีคนดวงเฮงเตรียมรับทรัพย์</span>
               </p>
               <textarea 
                  value={bulkTopicsInput}
                  onChange={(e) => setBulkTopicsInput(e.target.value)}
                  className="w-full h-48 bg-black/40 border border-[var(--border-color)] rounded-xl p-4 text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:border-[#ec4899] resize-none"
                  placeholder="วางรายชื่อหัวข้อที่นี่..."
               />
               <div className="flex gap-3 justify-end mt-2">
                  <button 
                     onClick={() => { setGeneratingStyle(null); setBulkTopicsInput(''); }}
                     className="px-5 py-2.5 rounded-xl font-bold bg-[var(--bg-neutral)] hover:bg-slate-700 transition-colors"
                  >
                     ยกเลิก
                  </button>
                  <button 
                     onClick={executeBulkGeneration}
                     disabled={!bulkTopicsInput.trim()}
                     className="px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] hover:opacity-90 text-white transition-all shadow-md disabled:opacity-50"
                  >
                     🚀 เริ่มสร้าง Bulk Prompts
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
