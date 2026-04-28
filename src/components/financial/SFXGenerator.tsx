import React, { useState, useEffect } from 'react';
import { NumInput } from '../ui/NumInput';
import { useKieTTS } from '../../hooks/useKieTTS';

interface GeneratedSFX {
  url: string;
  name: string;
}

interface SFXIdea {
  id: string;
  prompt: string;
  fileName: string;
  selected?: boolean;
  result?: GeneratedSFX;
  isGenerating?: boolean;
}

interface ApiKeyProfile {
  id: string;
  name: string;
  key: string;
}

const SFX_TEMPLATES = [
  { prompt: "Cinematic whoosh for fast video transition", name: "whoosh-fast" },
  { prompt: "Deep bass hit or impact for dramatic reveal", name: "bass-impact" },
  { prompt: "Cash register cha-ching money sound", name: "cash-register" },
  { prompt: "Digital tech beep for data chart appearing", name: "tech-beep" },
  { prompt: "Heartbeat pounding fast for tension", name: "heartbeat-tension" },
  { prompt: "Paper sliding on a wooden desk", name: "paper-slide" },
  { prompt: "Crisp and clear computer mouse click", name: "mouse-click" },
  { prompt: "Magical fairy twinkle for success moment", name: "success-twinkle" },
  { prompt: "Low frequency rumble for cinematic buildup", name: "low-rumble" },
  { prompt: "Keyboard typing fast mechanical switches", name: "keyboard-typing" },
  { prompt: "Swoosh sound effect for text appearing", name: "swoosh-text" },
  { prompt: "Soft bell ding for notification", name: "bell-ding" },
  { prompt: "Glitch sound effect for edgy transition", name: "glitch-transition" },
  { prompt: "Camera shutter click sound", name: "camera-shutter" },
  { prompt: "Coin dropping on table", name: "coin-drop" }
];

export function SFXGenerator() {
  const [apiKeys, setApiKeys] = useState<ApiKeyProfile[]>(() => {
    try { return JSON.parse(localStorage.getItem('api_key_profiles') || '[]'); } 
    catch(e) { return []; }
  });
  const [selectedKeyId, setSelectedKeyId] = useState(() => localStorage.getItem('selected_api_key_id') || '');
  
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');

  const apiKey = apiKeys.find(p => p.id === selectedKeyId)?.key || '';

  useEffect(() => {
    localStorage.setItem('api_key_profiles', JSON.stringify(apiKeys));
    localStorage.setItem('selected_api_key_id', selectedKeyId);
  }, [apiKeys, selectedKeyId]);

  const handleSaveKeyProfile = () => {
    if (!newKeyName.trim() || !newKeyValue.trim()) return;
    const newProfile = { id: `key-${Date.now()}`, name: newKeyName, key: newKeyValue };
    setApiKeys(prev => [...prev, newProfile]);
    setSelectedKeyId(newProfile.id);
    setIsAddingKey(false);
    setNewKeyName('');
    setNewKeyValue('');
  };

  const handleRemoveProfile = (id: string) => {
    setApiKeys(prev => prev.filter(k => k.id !== id));
    if (selectedKeyId === id) setSelectedKeyId('');
  };

  const [model, setModel] = useState('eleven_sound_effects');
  
  // Manual State
  const [prompt, setPrompt] = useState('');
  const [fileName, setFileName] = useState('');
  const [latestSFX, setLatestSFX] = useState<GeneratedSFX | null>(null);
  
  // Auto Idea State
  const [ideaCount, setIdeaCount] = useState(5);
  const [ideas, setIdeas] = useState<SFXIdea[]>([]);
  
  const [logs, setLogs] = useState<{ time: string; message: string; type: 'info' | 'success' | 'error' }[]>([]);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
    setLogs(prev => [...prev, { time, message, type }]);
  };

  const { generateSFX, isGenerating, error } = useKieTTS();

  const handleManualGenerate = async () => {
    if (!prompt.trim() || !fileName.trim()) {
      addLog('กรุณากรอกข้อความ Prompt และตั้งชื่อไฟล์ให้ครบถ้วน', 'error');
      alert('กรุณากรอกข้อความ Prompt และตั้งชื่อไฟล์ให้ครบถ้วน');
      return;
    }
    if (!apiKey) {
      addLog('กรุณาเลือก API Key ก่อนครับ', 'error');
      alert('กรุณาเลือกหรือเพิ่ม API Key ก่อนครับ');
      return;
    }

    addLog(`กำลังส่งคำสั่งสร้างเสียง (Manual): "${prompt}" [Model: ${model}]`, 'info');
    const result = await generateSFX({ prompt, apiKey, model });
    if (result && result.audioUrl) {
      const finalName = fileName.endsWith('.mp3') ? fileName : `${fileName}.mp3`;
      setLatestSFX({ url: result.audioUrl, name: finalName });
      addLog(`✅ สร้างเสียงสำเร็จ: ${finalName}`, 'success');
    } else {
      const errMsg = result?.error || error || 'เกิดข้อผิดพลาดจาก API';
      addLog(`❌ ล้มเหลว: ${errMsg}`, 'error');
      alert(`ไม่สามารถสร้างเสียงได้: ${errMsg}`);
    }
  };

  const handleGenerateIdeas = () => {
    const shuffled = [...SFX_TEMPLATES].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(ideaCount, SFX_TEMPLATES.length));
    
    setIdeas(selected.map((item, index) => ({
      id: `idea-${Date.now()}-${index}`,
      prompt: item.prompt,
      fileName: item.name,
      selected: true
    })));
    addLog(`✨ สุ่มไอเดีย SFX ขึ้นมาให้ทั้งหมด ${selected.length} รายการ`, 'info');
  };

  const toggleSelect = (id: string) => {
    setIdeas(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };
  
  const toggleSelectAll = () => {
    const allSelected = ideas.every(i => i.selected);
    setIdeas(prev => prev.map(item => ({ ...item, selected: !allSelected })));
  };

  const handleGenerateIdeaAudio = async (id: string, ideaPrompt: string, ideaFileName: string) => {
    setIdeas(prev => prev.map(item => item.id === id ? { ...item, isGenerating: true } : item));
    addLog(`กำลังส่งคำสั่ง: "${ideaPrompt}" [Model: ${model}]`, 'info');
    
    const result = await generateSFX({ prompt: ideaPrompt, apiKey, model });
    
    if (result && result.error) {
      addLog(`❌ ล้มเหลวสำหรับ "${ideaFileName}": ${result.error}`, 'error');
    } else if (result && result.audioUrl) {
      addLog(`✅ สร้างเสียงสำเร็จ: ${ideaFileName}.mp3`, 'success');
    }

    setIdeas(prev => prev.map(item => item.id === id ? { 
      ...item, 
      isGenerating: false,
      result: (result && result.audioUrl) ? {
        url: result.audioUrl,
        name: ideaFileName.endsWith('.mp3') ? ideaFileName : `${ideaFileName}.mp3`
      } : item.result
    } : item));
  };

  const handleGenerateSelected = async () => {
    if (!apiKey) {
      addLog('กรุณาเลือก API Key ก่อนครับ', 'error');
      alert('กรุณาเลือกหรือเพิ่ม API Key ก่อนครับ');
      return;
    }

    const toGenerate = ideas.filter(i => i.selected && !i.result && !i.isGenerating);
    if (toGenerate.length === 0) return;

    addLog(`เตรียมสร้างเสียงแบบกลุ่มจำนวน ${toGenerate.length} รายการ...`, 'info');
    for (const idea of toGenerate) {
      await handleGenerateIdeaAudio(idea.id, idea.prompt, idea.fileName);
    }
    addLog(`✨ ดำเนินการสร้างข้อความกลุ่มเสร็จสิ้น!`, 'success');
  };

  const handleSaveAllFinished = async () => {
    const toSave = ideas.filter(i => i.selected && i.result);
    if (toSave.length === 0) return;

    addLog(`กำลังเริ่มบันทึกไฟล์กลุ่มจำนวน ${toSave.length} รายการ...`, 'info');
    for (const idea of toSave) {
       await handleSaveToProject(idea.result!.url, idea.result!.name, idea.prompt);
    }
    addLog(`✨ ดำเนินการบันทึกไฟล์ลงคลังทั้งหมด ${toSave.length} รายการเรียบร้อย!`, 'success');
  };

  const handleSaveToProject = async (url: string, name: string, usedPrompt: string) => {
    addLog(`กำลังบันทึกไฟล์ลงคลังโปรเจกต์...`, 'info');
    try {
      const res = await fetch('/api/save-audio', {
         method: 'POST',
         body: JSON.stringify({ url, fileName: name, prompt: usedPrompt, tags: ['sfx', 'ai-generated'] })
      });
      const data = await res.json();
      if (res.ok) {
         addLog(`💾 บันทึก ${data.fileName} ลงคลัง Sound_stock สำเร็จ (อัปเดต Metadata.json แล้ว!)`, 'success');
      } else {
         addLog(`❌ บันทึกไฟล์ล้มเหลว: ${data.error}`, 'error');
      }
    } catch(e: any) {
       addLog(`❌ ไฟล์เซฟเออเร่อ: ${e.message}`, 'error');
    }
  };

  const selectedPendingCount = ideas.filter(i => i.selected && !i.result).length;
  const selectedFinishedCount = ideas.filter(i => i.selected && i.result).length;
  const isBulkGenerating = ideas.some(i => i.isGenerating);

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span>🔊</span> AI SFX Generator (สร้างเสียงเอฟเฟค)
      </h3>

      <div className="space-y-6">
        
        {/* --- Setup Key Area --- */}
        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-2 bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)]">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
              <span className="text-sm font-medium whitespace-nowrap">🔑 เลือกโปรไฟล์ API:</span>
              
              {!isAddingKey ? (
                <div className="flex w-full overflow-hidden items-center gap-2">
                  <select 
                    value={selectedKeyId}
                    onChange={(e) => {
                      if (e.target.value === 'new') setIsAddingKey(true);
                      else setSelectedKeyId(e.target.value);
                    }}
                    className="text-sm px-3 py-2 flex-1 rounded-lg border border-[var(--border-color)] bg-transparent focus:ring-1 focus:outline-none cursor-pointer"
                  >
                    <option value="" disabled>-- กรุณาเลือกบัญชี API Key --</option>
                    {apiKeys.map(k => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                    <option value="new" className="font-bold text-blue-500">+ เพิ่ม API Key ใหม่...</option>
                  </select>
                  {selectedKeyId && (
                    <button onClick={() => handleRemoveProfile(selectedKeyId)} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded bg-red-100 dark:bg-red-900/30">ลบ</button>
                  )}
                </div>
              ) : (
                <div className="flex w-full items-center gap-2 flex-wrap sm:flex-nowrap">
                  <input type="text" placeholder="ชื่อ (เช่น บัญชีออฟฟิศ)" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none" />
                  <input type="password" placeholder="sk-..." value={newKeyValue} onChange={e => setNewKeyValue(e.target.value)} className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none" />
                  <button onClick={handleSaveKeyProfile} className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium">บันทึก</button>
                  <button onClick={() => setIsAddingKey(false)} className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium">ยกเลิก</button>
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 border-t border-[var(--border-color)] pt-3 mt-1">
              <span className="text-sm font-medium whitespace-nowrap">🧠 โมเดลเสียงสังเคราะห์:</span>
              <select 
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="text-sm px-3 py-2 flex-1 rounded-lg border border-[var(--border-color)] bg-transparent focus:ring-1 focus:outline-none cursor-pointer"
              >
                <option value="eleven_sound_effects">ElevenLabs SFX Engine (แนะนำ)</option>
                <option value="audio-craft-gen">AudioCraft (Meta)</option>
                <option value="stable-audio-open">Stable Audio</option>
              </select>
            </div>
          </div>
        </div>

        {/* --- Auto Idea Section --- */}
        <div className="p-4 border border-blue-500/30 bg-blue-50 dark:bg-blue-900/10 rounded-xl space-y-4">
          <div className="flex items-end gap-4">
            <div className="w-32">
              <label className="block text-sm font-medium mb-1 text-blue-800 dark:text-blue-300">💡 จำนวนที่อยากคิด</label>
              <NumInput min={1} max={200} value={ideaCount} onChange={setIdeaCount} className="w-full px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button 
              onClick={() => {
                let generated = [...SFX_TEMPLATES];
                
                if (ideaCount > SFX_TEMPLATES.length) {
                  const prefixes = ["Cinematic", "Digital", "Retro", "Echoing", "Sharp", "Muffled", "Heavy", "Quick", "Modern", "Sci-Fi", "Subtle", "Loud"];
                  const bases = ["whoosh", "bass hit", "bell ding", "mouse click", "glitch", "camera shutter", "coin drop", "paper swipe", "low rumble", "keyboard typing", "riser", "impact", "swoosh"];
                  const suffixes = ["for transition", "for tension buildup", "for dramatic reveal", "for tech interface", "for success moment", "in empty room", "for typography animation", "for logo reveal"];
                  
                  let attempts = 0;
                  while (generated.length < ideaCount && attempts < 2000) {
                    attempts++;
                    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
                    const b = bases[Math.floor(Math.random() * bases.length)];
                    const s = suffixes[Math.floor(Math.random() * suffixes.length)];
                    
                    const prompt = `${p} ${b} ${s}`;
                    const name = `${b.replace(' ', '-')}-${p.toLowerCase()}-${Math.floor(Math.random() * 1000)}`;
                    
                    if (!generated.find(g => g.prompt === prompt)) {
                      generated.push({ prompt, name });
                    }
                  }
                }
                
                const shuffled = generated.sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, Math.min(ideaCount, generated.length)); // Added protection length bound
                
                setIdeas(selected.map((item, index) => ({
                  id: `idea-${Date.now()}-${index}`,
                  prompt: item.prompt,
                  fileName: item.name,
                  selected: true
                })));
                addLog(`✨ สุ่มไอเดีย SFX ขึ้นมาให้ทั้งหมด ${selected.length} รายการ`, 'info');
              }}
              className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
            >
              ✨ คิด Prompt SFX ให้หน่อย (Auto Idea)
            </button>
          </div>

          {ideas.length > 0 && (
            <div className="mt-4 border-t border-blue-200 dark:border-blue-800 pt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 px-1 gap-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={ideas.every(i => i.selected)}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  เลือกทั้งหมด
                </label>
                
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button 
                    onClick={handleSaveAllFinished}
                    disabled={selectedFinishedCount === 0 || isBulkGenerating}
                    className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:from-emerald-900 disabled:to-emerald-900 flex items-center justify-center gap-1"
                  >
                    <span>💾</span> เซฟกลุ่มที่เสร็จ ({selectedFinishedCount})
                  </button>
                  <button 
                    onClick={handleGenerateSelected}
                    disabled={selectedPendingCount === 0 || isBulkGenerating}
                    className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:from-blue-900 disabled:to-blue-900"
                  >
                    ⚡ สร้างกลุ่มที่รอ ({selectedPendingCount})
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                {ideas.map((idea) => (
                  <div key={idea.id} className={`p-3 border rounded-lg flex flex-col sm:flex-row gap-3 justify-between items-center transition-colors ${idea.selected ? 'bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-700' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 opacity-60'}`}>
                    
                    <div className="flex items-center gap-3 w-full">
                      <input 
                        type="checkbox"
                        checked={idea.selected || false}
                        onChange={() => toggleSelect(idea.id)}
                        className="w-4 h-4 rounded text-blue-600 shrink-0"
                      />
                      <div className="flex-1">
                        <input 
                          type="text" 
                          value={idea.prompt}
                          onChange={(e) => setIdeas(prev => prev.map(img => img.id === idea.id ? {...img, prompt: e.target.value} : img))}
                          className="w-full text-sm font-medium mb-1 bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 focus:outline-none"
                          placeholder="Prompt"
                        />
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>📁</span>
                          <input 
                            type="text" 
                            value={idea.fileName}
                            onChange={(e) => setIdeas(prev => prev.map(img => img.id === idea.id ? {...img, fileName: e.target.value} : img))}
                            className="bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 w-full max-w-[200px]"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {idea.result ? (
                      <div className="flex items-center gap-3 shrink-0 bg-emerald-50 dark:bg-emerald-900/10 p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 w-full sm:w-auto mt-2 sm:mt-0">
                        <audio controls src={idea.result.url} className="h-8 w-full sm:w-32 md:w-40" />
                        <button 
                          onClick={() => handleSaveToProject(idea.result!.url, idea.result!.name, idea.prompt)}
                          className="p-1 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-sm transition-colors flex gap-1 items-center shrink-0"
                          title="บันทึกลงคลังเสียง"
                        >
                          💾 เซฟเก็บ
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          if (!apiKey) {
                            addLog('กรุณาเลือก API Key ก่อนครับ', 'error');
                            alert('กรุณาเลือก API Key ก่อนครับ');
                          } else {
                            handleGenerateIdeaAudio(idea.id, idea.prompt, idea.fileName);
                          }
                        }}
                        disabled={idea.isGenerating}
                        className="shrink-0 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-sm rounded-lg font-medium transition-all disabled:opacity-50"
                      >
                        {idea.isGenerating ? 'รอสักครู่...' : '⚡ สร้าง 1 อัน'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-[var(--border-color)]"></div>
          <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">หรือ สร้างเองทีละสเต็ป (Manual)</span>
          <div className="flex-grow border-t border-[var(--border-color)]"></div>
        </div>

        {/* --- Manual Section --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">ต้องการเสียงอะไร? (Prompt)</label>
            <input 
              type="text" 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="เช่น เสียงคลิกเม้าส์, whoosh สั้นๆ, กระดิ่ง..."
              className="w-full px-4 py-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ตั้งชื่อไฟล์ (File Name)</label>
            <input 
              type="text" 
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="เช่น click-01, transition-whoosh"
              className="w-full px-4 py-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <button 
          onClick={handleManualGenerate}
          disabled={isGenerating || !prompt.trim() || !fileName.trim()}
          className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-medium transition-all focus:outline-none disabled:opacity-50"
        >
          {isGenerating ? 'กำลังสังเคราะห์เสียง...' : 'สร้างเสียง (Manual)'}
        </button>

        {latestSFX && (
          <div className="mt-4 p-4 border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="w-full">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2">
                  ✅ สร้างเสียงสำเร็จ: {latestSFX.name}
                </p>
                <audio controls className="w-full h-8" src={latestSFX.url} />
              </div>
              
              <button 
                onClick={() => handleSaveToProject(latestSFX.url, latestSFX.name, prompt)}
                className="whitespace-nowrap px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                <span>💾</span> เซฟเก็บลงคลัง
              </button>
            </div>
          </div>
        )}

        {/* --- Console Log Section --- */}
        <div className="mt-8 pt-6 border-t border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <span>🖥️</span> Terminal Logs
            </h4>
            <button 
              onClick={() => setLogs([])}
              className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition"
            >
              ล้าง Log
            </button>
          </div>
          <div className="bg-[#1e1e1e] text-gray-300 p-4 rounded-xl font-mono text-xs h-48 overflow-y-auto shadow-inner border border-gray-800">
            {logs.length === 0 ? (
              <p className="text-gray-600 italic">...รอรับคำสั่ง...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-1">
                  <span className="text-gray-500">[{log.time}]</span>{' '}
                  <span className={
                    log.type === 'error' ? 'text-red-400 font-bold' : 
                    log.type === 'success' ? 'text-emerald-400 font-bold' : 'text-blue-300'
                  }>
                    {log.type === 'error' ? '[ERROR]' : log.type === 'success' ? '[SUCCESS]' : '[INFO]'}
                  </span>{' '}
                  {log.message}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
