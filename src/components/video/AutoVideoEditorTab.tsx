import React, { useState, useEffect } from 'react';
import { FilmIcon, SparklesIcon, CogIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface FileSettings {
    fastCuts: boolean;
    colorGrade: boolean;
    filmGrain: boolean;
    cameraShake: boolean;
}

interface StoryGroup {
  groupName: string;
  files: string[];
  status?: 'pending' | 'processing' | 'done' | 'error' | 'analyzing';
  outputPath?: string;
  errorMessage?: string;
  fileSettings?: FileSettings[];
}

export default function AutoVideoEditorTab() {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sounds, setSounds] = useState<string[]>([]);
  const [selectedBgm, setSelectedBgm] = useState<string>('');
  const [bgmVolume, setBgmVolume] = useState<number>(10);
  const [scriptsData, setScriptsData] = useState<{name: string, content: string}[]>([]);
  const [selectedScript, setSelectedScript] = useState<string>('');
  const [renderLog, setRenderLog] = useState('');

  // Cinematic Post-Processing States
  const [useFastCuts, setUseFastCuts] = useState(false);
  const [useColorGrade, setUseColorGrade] = useState(false);
  const [useFilmGrain, setUseFilmGrain] = useState(false);
  const [useCameraShake, setUseCameraShake] = useState(false);
  
  useEffect(() => {
    fetchFiles();
    fetchSounds();
    fetchScripts();
  }, []);

  const fetchSounds = async () => {
    try {
      const res = await fetch('/api/list-auto-editor-sounds');
      if (res.ok) {
        const data = await res.json();
        setSounds(data || []);
      }
    } catch(e) {}
  };

  const fetchScripts = async () => {
    try {
      const res = await fetch('/api/read-auto-scripts');
      if (res.ok) {
         const data = await res.json();
         setScriptsData(data || []);
      }
    } catch(e) {}
  };

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/list-auto-videos');
      if (res.ok) {
        const data = await res.json();
        setFiles(data || []);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getOpenRouterKey = () => {
    const globalKey = localStorage.getItem('api_global_active_id') 
                      ? JSON.parse(localStorage.getItem('api_global_profiles') || '[]')
                        .find((p: any) => p.id === localStorage.getItem('api_global_active_id'))?.openRouterKey 
                      : null;
    let aiKey = globalKey || localStorage.getItem('openrouter_key');
    if (!aiKey) {
        try {
            const arr = JSON.parse(localStorage.getItem('openrouter_keys') || '[]');
            if(arr.length > 0) aiKey = arr[0].key;
        }catch(e) {}
    }
    return aiKey;
  };

  const runAIGrouping = async () => {
    if (files.length === 0) return alert("ไม่มีไฟล์วิดีโอในโฟลเดอร์ videofootage");
    
    const apiKey = getOpenRouterKey();
    if (!apiKey) return alert("Please set OpenRouter API Key in settings first.");
    
    const selectedModel = localStorage.getItem('selectedAiModel') || "google/gemini-2.5-flash";
    
    setLoading(true);
    try {
      // Fetch scripts to help AI sequence files if available
      let scriptContext = "";
      if (selectedScript) {
         const matchedScript = scriptsData.find(s => s.name === selectedScript);
         if (matchedScript) {
             scriptContext = `\n\nI also have the following script file which acts as the absolute source of truth for the storyline and the correct sequence of the scenes. YOU MUST use this script to figure out the exact chronological order of the filenames:\n\n=== SCRIPT ===\n${matchedScript.content}\n===============\n\nMap the video filenames identically to the sequences found in the script.`;
         }
      }

      const prompt = `Here is a list of video filenames I downloaded. Group them into distinct cohesive short film stories. For each group, order the files chronologically from start to finish. ${scriptContext}
If no scripts are provided, deduce it semantically. Respond ONLY in valid raw JSON array format without backticks, markdown, or introduction text. Do NOT use double quotes (") inside the groupName, use single quotes (') instead. Format exactly like this:
[
  { "groupName": "Story Title A", "files": ["file1.mp4", "file2.mp4"] }
]

Filenames:
${files.join('\n')}`;

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      
      const resData = await res.json();
      if (resData.choices && resData.choices.length > 0) {
        let content = resData.choices[0].message.content.trim();
        // Vigorously remove any markdown block or intro text before array brackets
        content = content.substring(content.indexOf('['));
        if (content.lastIndexOf(']') !== -1) {
            content = content.substring(0, content.lastIndexOf(']') + 1);
        }
        
        const jsonArr = JSON.parse(content);
        if (Array.isArray(jsonArr)) {
          setGroups(jsonArr.map((g: any) => ({ ...g, status: 'pending' })));
        } else {
          alert("AI returned invalid structure.");
        }
      }
    } catch (e: any) {
      console.error(e);
      alert("AI Processing Failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const extractThreeFramesAndDuration = (filename: string): Promise<{duration: number, frames: string[]}> => {
       return new Promise((resolve, reject) => {
           const video = document.createElement('video');
           video.src = `/videofootage/${encodeURIComponent(filename)}`;
           video.crossOrigin = 'anonymous';
           video.muted = true;
           
           const frames: string[] = [];
           let captureCount = 0;
           
           video.onloadeddata = () => {
               if (video.duration > 0) {
                   video.currentTime = Math.min(video.duration, video.duration * 0.2);
               } else {
                   reject("Empty video");
               }
           };
           video.onseeked = () => {
               const canvas = document.createElement('canvas');
               canvas.width = 640;
               canvas.height = 360;
               const ctx = canvas.getContext('2d');
               if (!ctx) return reject("No context");
               ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
               frames.push(canvas.toDataURL('image/jpeg', 0.7));
               
               captureCount++;
               if (captureCount === 1) {
                   video.currentTime = video.duration * 0.5;
               } else if (captureCount === 2) {
                   video.currentTime = Math.max(0, video.duration * 0.8);
               } else {
                   resolve({ duration: video.duration, frames });
               }
           };
           video.onerror = () => reject("Video load error: " + filename);
       });
  };

  const analyzeDynamicScenes = async () => {
       const apiKey = getOpenRouterKey();
       if (!apiKey) return alert("Please set OpenRouter API Key in settings first.");
       
       let currentGroups = [...groups];
       const pendingGroups = currentGroups.filter(g => g.status === 'pending' && !g.fileSettings);
       if (pendingGroups.length === 0) return alert("อเล็กซ์: ไม่มีกลุ่มที่รอการวิเคราะห์ครับ");
       
       setLoading(true);
       
       for (let i = 0; i < currentGroups.length; i++) {
            if (currentGroups[i].status !== 'pending' || currentGroups[i].fileSettings) continue;
            
            try {
                let visionPayload = [];
                let metadataList = [];
                currentGroups[i].status = 'analyzing';
                setGroups([...currentGroups]);
                
                for(const f of currentGroups[i].files) {
                    const data = await extractThreeFramesAndDuration(f);
                    metadataList.push(`ไฟล์: ${f} | ความยาว: ${data.duration.toFixed(2)} วินาที`);
                    for(const b64 of data.frames) {
                        visionPayload.push({
                            type: "image_url",
                            image_url: { url: b64 }
                        });
                    }
                }
                
                const promptText = `คุณคือผู้กำกับตัดต่อโพสต์โปรดักชัน วิเคราะห์ฉากวิดีโอแต่ละไฟล์ที่ส่งไปให้เรียงลำดับ (${currentGroups[i].files.length} ไฟล์ โดยส่งรูป ต้น-กลาง-จบ ของแต่ละคลิปให้ดู)
ข้อมูลความยาวของแต่ละคลิป:
${metadataList.join('\n')}

ประเมินและตัดสินใจใส่ FFMPEG Filters เพื่อลบรอย AI:
- "fastCuts": ใส่ true หากการเคลื่อนไหวน้อย/จืดชืด และคุณ "ต้อง" ระบุเวลาเริ่มตัด (trimStart) และความยาวที่เหลือ (trimDuration) เป็นวินาที (ทศนิยมได้) โฟกัสช่วงที่แอคชั่นชัดเจนที่สุดและสมูทที่สุด
- "colorGrade": ใส่ true หากโทนสีสว่างเกินไป (Plastic Lighting)
- "cameraShake": ใส่ true หากมุมกล้องนิ่งแบนเกินไป
- "filmGrain": ใส่ true หากเนื้อภาพดูคลีนเป็น CGI เกินไป

**ส่งคืนเฉพาะ JSON Array ขนาดเท่ากับ ${currentGroups[i].files.length} ไอเท็มเท่านั้น ห้ามมีตัวอักษรอื่นเด็ดขาด** (ตัวอย่างรูปแบบ):
[
  { "fastCuts": true, "trimStart": 1.2, "trimDuration": 3.0, "colorGrade": false, "filmGrain": true, "cameraShake": false }
]`;

                const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: "google/gemini-2.5-flash",
                         messages: [{
                           role: "user",
                           content: [ { type: "text", text: promptText }, ...visionPayload ]
                        }]
                    })
                });
                
                const resData = await res.json();
                let output = resData.choices[0].message.content.trim();
                
                output = output.substring(output.indexOf('['));
                if (output.lastIndexOf(']') !== -1) {
                    output = output.substring(0, output.lastIndexOf(']') + 1);
                }
                
                const resultArr = JSON.parse(output);
                
                if (Array.isArray(resultArr) && resultArr.length === currentGroups[i].files.length) {
                    currentGroups[i].fileSettings = resultArr;
                    currentGroups[i].status = 'pending';
                } else {
                    throw new Error("Invalid AI array size: " + output);
                }
            } catch(e: any) {
                console.error(e);
                currentGroups[i].status = 'error';
                currentGroups[i].errorMessage = "AI Scene Analysis Error: " + e.message;
            }
            setGroups([...currentGroups]);
       }
       setLoading(false);
  };

  const renderVideos = async () => {
    if (groups.length === 0) return;
    setRendering(true);
    setProgress(0);
    setRenderLog('');
    
    let currentGroups = [...groups];
    
    for (let i = 0; i < currentGroups.length; i++) {
       const group = currentGroups[i];
       if (group.status === 'done') continue;
       
       currentGroups[i].status = 'processing';
       setGroups([...currentGroups]);
       
         try {
           const res = await fetch('/api/concat-auto-videos', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
                ...group, 
                bgmFile: selectedBgm, 
                bgmVolume: bgmVolume / 100,
                cinematicOptions: {
                   fastCuts: useFastCuts,
                   colorGrade: useColorGrade,
                   filmGrain: useFilmGrain,
                   cameraShake: useCameraShake
                },
                fileSettings: group.fileSettings
             })
           });
           
           const reader = res.body?.getReader();
           if (!reader) throw new Error("Stream not supported");
           
           const decoder = new TextDecoder();
           let done = false;
           
           while (!done) {
              const { value, done: doneReading } = await reader.read();
              done = doneReading;
              if (value) {
                 const chunkStr = decoder.decode(value, { stream: true });
                 const lines = chunkStr.split('\n');
                 for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                           const d = JSON.parse(line.substring(6));
                           if (d.log) {
                               const tMatch = d.log.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
                               if (tMatch) setRenderLog(`พาร์ท ${i+1}: วินาทีที่ ${tMatch[1]}`);
                           } else if (d.success) {
                               currentGroups[i].status = 'done';
                               currentGroups[i].outputPath = d.filePath;
                           } else if (d.error) {
                               currentGroups[i].status = 'error';
                               currentGroups[i].errorMessage = d.error + (d.details ? `\n${d.details}` : '');
                           }
                        } catch(e) {}
                    }
                 }
              }
           }
       } catch(e: any) {
         currentGroups[i].status = 'error';
         currentGroups[i].errorMessage = e.message || 'Unknown error';
       }
       
       setGroups([...currentGroups]);
       setProgress(Math.round(((i + 1) / currentGroups.length) * 100));
    }
    
    setRendering(false);
    setRenderLog('');
    alert("การต่อวิดีโอเสร็จสิ้น!");
  };

  const openCompletedFolder = async () => {
    try {
      await fetch('/api/open-folder?type=/Users/macos/Documents/โปรแกรมเทพ/BulkVideoCreatorApp/videofootage/Completed_Films');
    } catch(e) {}
  };

  return (
    <div className="space-y-6 text-white min-h-[500px]">
      <div className="flex justify-between items-center bg-[#1e293b] p-6 rounded-3xl border border-[#334155] shadow-xl">
        <div>
           <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 flex items-center gap-2">
             <FilmIcon className="w-8 h-8 text-blue-400" />
             AI Auto-Video Editor
           </h1>
           <p className="text-gray-400 mt-2">วิเคราะห์ชื่อไฟล์ จับกลุ่ม และตัดต่อต่อกันอัตโนมัติด้วย FFMPEG</p>
        </div>
        <div className="flex gap-4">
            <button onClick={fetchFiles} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold flex items-center gap-2 transition-all">
               <ArrowPathIcon className="w-5 h-5"/> รีเฟรชโฟลเดอร์
            </button>
            <div className="flex flex-col gap-2">
               <select 
                  value={selectedBgm} 
                  onChange={(e) => setSelectedBgm(e.target.value)}
                  className="bg-gray-800 text-white rounded-xl px-4 py-2 text-sm border border-gray-600 outline-none"
               >
                  <option value="">-- ไม่ใส่เสียงประกอบ --</option>
                  {sounds.map((s, i) => <option key={i} value={s}>{s}</option>)}
               </select>
               {selectedBgm && (
                 <div className="flex items-center gap-2 px-2">
                   <span className="text-xs text-gray-400">ความดัง:</span>
                   <input 
                     type="range" min="1" max="100" value={bgmVolume} 
                     onChange={(e) => setBgmVolume(Number(e.target.value))}
                     className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                   />
                   <span className="text-xs font-mono w-4">{bgmVolume}%</span>
                 </div>
               )}
            </div>
            
            <div className="flex flex-col gap-2">
               <select 
                  value={selectedScript} 
                  onChange={(e) => setSelectedScript(e.target.value)}
                  className="bg-gray-800 text-white rounded-xl px-4 py-2 text-sm border border-gray-600 outline-none max-w-[200px]"
               >
                  <option value="">-- ไม่ใช้สคริปต์อ้างอิง --</option>
                  {scriptsData.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
               </select>
            </div>
            
            <button onClick={runAIGrouping} disabled={loading || files.length === 0} className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50">
               <SparklesIcon className="w-5 h-5" /> {loading ? 'AI กำลังวิเคราะห์...' : 'ให้ AI จัดกลุ่มคลิป'}
            </button>
         </div>
      </div>

      {/* Cinematic Post-Processing Preferences */}
      <div className="bg-[#1e293b] p-6 rounded-3xl border border-purple-500/30 shadow-lg relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-3xl pointer-events-none rounded-full"></div>
         <h2 className="text-lg font-bold flex items-center gap-2 text-purple-400 mb-4 relative z-10">
            ✨ Cinematic Post-Processing (ลดความเป็น AI)
         </h2>
         <div className="text-xs text-gray-400 mb-4 relative z-10">ฟีเจอร์เหล่านี้จะรันคำสั่งแก้ไขแบบ Deep Render การรวมคลิปอาจจะใช้เวลาประมวลผลนานขึ้น (Re-encode)</div>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
            <label className="flex items-start gap-3 cursor-pointer group">
               <div className="relative mt-1">
                 <input type="checkbox" className="sr-only" checked={useFastCuts} onChange={(e) => setUseFastCuts(e.target.checked)} />
                 <div className={`block w-10 h-6 rounded-full transition-colors ${useFastCuts ? 'bg-purple-500' : 'bg-gray-700'}`}></div>
                 <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${useFastCuts ? 'transform translate-x-4' : ''}`}></div>
               </div>
               <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-200">✂️ Fast Cuts (2.5s)</span>
                  <span className="text-[10px] text-gray-400">ตัดหัวท้ายคลิปให้กระชับ ไม่ยืดเยื้อจนภาพเริ่มย้วย</span>
               </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
               <div className="relative mt-1">
                 <input type="checkbox" className="sr-only" checked={useColorGrade} onChange={(e) => setUseColorGrade(e.target.checked)} />
                 <div className={`block w-10 h-6 rounded-full transition-colors ${useColorGrade ? 'bg-purple-500' : 'bg-gray-700'}`}></div>
                 <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${useColorGrade ? 'transform translate-x-4' : ''}`}></div>
               </div>
               <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-200">🎨 Dark Teal Grading</span>
                  <span className="text-[10px] text-gray-400">ย้อมสไตล์ฮอลลีวู้ด ลดความสว่างสดใส (Plastic Look)</span>
               </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
               <div className="relative mt-1">
                 <input type="checkbox" className="sr-only" checked={useFilmGrain} onChange={(e) => setUseFilmGrain(e.target.checked)} />
                 <div className={`block w-10 h-6 rounded-full transition-colors ${useFilmGrain ? 'bg-purple-500' : 'bg-gray-700'}`}></div>
                 <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${useFilmGrain ? 'transform translate-x-4' : ''}`}></div>
               </div>
               <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-200">🎞️ Film Grain Noise</span>
                  <span className="text-[10px] text-gray-400">ใส่ Noise ให้เนื้อภาพเพื่อกลบรอยต่อพิกเซลที่ผิดพลาด</span>
               </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
               <div className="relative mt-1">
                 <input type="checkbox" className="sr-only" checked={useCameraShake} onChange={(e) => setUseCameraShake(e.target.checked)} />
                 <div className={`block w-10 h-6 rounded-full transition-colors ${useCameraShake ? 'bg-purple-500' : 'bg-gray-700'}`}></div>
                 <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${useCameraShake ? 'transform translate-x-4' : ''}`}></div>
               </div>
               <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-200">📹 Handheld Shake</span>
                  <span className="text-[10px] text-gray-400">ซูม ครอป และสั่งสั่นกล้องเบาๆ ลบความนิ่งแบบ 100% ออก</span>
               </div>
            </label>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Raw Files */}
         <div className="col-span-1 bg-[#1e293b] p-6 rounded-3xl border border-[#334155]">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-300">
               <FilmIcon className="w-5 h-5" /> ไฟล์ใน videofootage ({files.length})
            </h2>
            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
               {files.length === 0 ? (
                 <div className="text-gray-500 text-sm text-center py-10">ไม่พบไฟล์ .mp4 หรือ .mov</div>
               ) : (
                 files.map((f, i) => (
                   <div key={i} className="text-xs bg-black/30 p-2 rounded-lg text-gray-300 border border-black/20 break-all">
                     {f}
                   </div>
                 ))
               )}
            </div>
         </div>

         {/* AI Grouping Results */}
         <div className="col-span-2 bg-[#1e293b] p-6 rounded-3xl border border-[#334155] flex flex-col">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2 text-purple-400">
                   <SparklesIcon className="w-5 h-5" /> ผลลัพธ์การจับกลุ่มจาก AI ({groups.length} เรื่อง)
                </h2>
                 {groups.length > 0 && (
                   <div className="flex gap-2">
                       {groups.every(g => g.status === 'done') ? (
                          <button 
                            onClick={openCompletedFolder} 
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                          >
                             📁 เปิดโฟลเดอร์ผลลัพธ์
                          </button>
                       ) : (
                          <button 
                            onClick={renderVideos} 
                            disabled={rendering}
                            className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-green-500/20 disabled:opacity-50"
                          >
                             <CogIcon className={`w-5 h-5 ${rendering ? 'animate-spin' : ''}`} />
                             {rendering ? `กำลังเรนเดอร์... ${progress}% ${renderLog ? `[${renderLog}]` : ''}` : 'สั่งตัดรวมร่างทุกเรื่อง (Fast Render)'}
                          </button>
                       )}
                   </div>
                 )}
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                 {groups.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 pt-20">
                       <SparklesIcon className="w-12 h-12 mb-4 opacity-50" />
                       <p>กดป้าย "ให้ AI จัดกลุ่มคลิป" ด้านบนเพื่อเริ่มทำงาน</p>
                    </div>
                 ) : (
                    groups.map((g, i) => (
                       <div key={i} className="bg-black/20 p-4 rounded-2xl border border-purple-500/20 relative overflow-hidden">
                          {g.status === 'processing' && <div className="absolute top-0 left-0 h-1 bg-green-500 animate-pulse w-full"></div>}
                          {g.status === 'done' && <div className="absolute top-0 left-0 h-1 bg-green-500 w-full"></div>}
                          
                          <div className="flex justify-between items-start mb-3">
                             <h3 className="font-bold text-lg text-white">{g.groupName}</h3>
                             <div className="flex items-center gap-2">
                                {g.status === 'pending' && <span className="text-xs bg-gray-700 px-2 py-1 rounded">รอคิว</span>}
                                {g.status === 'processing' && <span className="text-xs bg-yellow-500 text-black font-bold px-2 py-1 rounded">กำลังตัดต่อ...</span>}
                                {g.status === 'done' && <span className="text-xs bg-green-500 text-white font-bold px-2 py-1 flex items-center gap-1 rounded"><CheckCircleIcon className="w-3 h-3"/> เสร็จสมบูรณ์</span>}
                                {g.status === 'error' && <span className="text-xs bg-red-500 text-white font-bold px-2 py-1 rounded">ผิดพลาด</span>}
                             </div>
                          </div>
                          <div className="space-y-1">
                              {g.files.map((file, j) => {
                                const set = g.fileSettings?.[j];
                                return (
                                <div key={j} className="text-xs text-gray-400 flex flex-col gap-1 bg-black/20 p-2 rounded">
                                   <div className="flex items-center gap-2">
                                     <span className="w-5 font-mono text-center bg-gray-800 rounded">{j + 1}</span>
                                     {file}
                                   </div>
                                   {set && (
                                     <div className="flex gap-1 pl-7 flex-wrap">
                                        <span onClick={() => { set.fastCuts=!set.fastCuts; setGroups([...groups])}} className={`cursor-pointer px-1.5 py-0.5 rounded text-[9px] ${set.fastCuts ? "bg-red-900/50 text-red-300" : "border border-gray-700 text-gray-600"}`}>✂️ Cuts</span>
                                        <span onClick={() => { set.colorGrade=!set.colorGrade; setGroups([...groups])}} className={`cursor-pointer px-1.5 py-0.5 rounded text-[9px] ${set.colorGrade ? "bg-blue-900/50 text-blue-300" : "border border-gray-700 text-gray-600"}`}>🎨 Color</span>
                                        <span onClick={() => { set.filmGrain=!set.filmGrain; setGroups([...groups])}} className={`cursor-pointer px-1.5 py-0.5 rounded text-[9px] ${set.filmGrain ? "bg-amber-900/50 text-amber-300" : "border border-gray-700 text-gray-600"}`}>🎞️ Grain</span>
                                        <span onClick={() => { set.cameraShake=!set.cameraShake; setGroups([...groups])}} className={`cursor-pointer px-1.5 py-0.5 rounded text-[9px] ${set.cameraShake ? "bg-purple-900/50 text-purple-300" : "border border-gray-700 text-gray-600"}`}>📹 Shake</span>
                                     </div>
                                   )}
                                </div>
                              )})}
                          </div>
                          {g.status === 'done' && (
                             <div className="mt-4 flex items-center justify-between bg-green-900/20 p-2 rounded-lg border border-green-500/30">
                                <div className="text-xs text-green-400 font-mono">
                                   บันทึกที่: videofootage/Completed_Films/
                                </div>
                                <button onClick={openCompletedFolder} className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded">
                                   เปิดดูไฟล์
                                </button>
                             </div>
                          )}
                          {g.status === 'error' && g.errorMessage && (
                             <div className="mt-3 text-xs bg-red-900/30 text-red-300 p-2 rounded whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                               {g.errorMessage}
                             </div>
                          )}
                       </div>
                    ))
                 )}
             </div>
             
             {groups.some(g => (g.status === 'pending' || g.status === 'analyzing') && !g.fileSettings) && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                   <button 
                     onClick={analyzeDynamicScenes} 
                     disabled={loading}
                     className="w-full py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-pink-500/20 disabled:opacity-50"
                   >
                      <SparklesIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                      {loading ? 'กำลังส่งภาพให้ AI วิเคราะห์ (Scene-by-Scene)...' : '🪄 ให้ AI ตัดสินใจเปลี่ยนฟิลเตอร์ให้แบบเจาะจงรายคลิป (Auto-Director)'}
                   </button>
                   <div className="text-[10px] text-gray-500 text-center mt-2">โหมดผู้กำกับ: AI จะดูเนื้อหาในคลิปแล้วเลือกฟิลเตอร์ลบรอยต่อ AI ที่แมตช์ที่สุดให้แบบรายตัว!</div>
                </div>
             )}
         </div>
      </div>
    </div>
  );
}
