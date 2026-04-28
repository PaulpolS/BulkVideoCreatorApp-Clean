import React, { useState, useEffect } from 'react';
import { NumInput } from '../ui/NumInput';
import { Card } from '../ui/Card';

const MODELS = [
  { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', desc: 'ถูกที่สุด! เร็วมาก ภาษาไทยลื่น ($0.10/1M)', price: '💚 ถูกมาก', emoji: '⚡' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'สมดุลที่สุด เร็ว+ฉลาด ($0.30/1M)', price: '💚 ถูก', emoji: '🚀' },
  { id: 'deepseek/deepseek-chat-v3.1', name: 'DeepSeek V3.1', desc: 'ราคาถูก เก่งภาษาไทยดี ($0.15/1M)', price: '💚 ถูก', emoji: '🐋' },
  { id: 'openai/gpt-5.4-nano', name: 'GPT-5.4 Nano', desc: 'เล็กสุดของ OpenAI ไวมากๆ ($0.20/1M)', price: '💚 ถูก', emoji: '💰' },
  { id: 'openai/gpt-5.4-mini', name: 'GPT-5.4 Mini', desc: 'เวอร์ชันประหยัด คุ้มค่า ($0.75/1M)', price: '🟡 ปานกลาง', emoji: '🤖' },
  { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', desc: 'ไวปานสายฟ้า เก่งเขียน Content ($1.00/1M)', price: '🟡 ปานกลาง', emoji: '✍️' },
  { id: 'openai/gpt-5.4', name: 'GPT-5.4', desc: 'รุ่นท็อป ครีเอทีฟสูง ($2.50/1M)', price: '🔴 แพง', emoji: '🌟' },
  { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', desc: 'ฉลาดสุด โครงสร้างเป๊ะ ($3.00/1M)', price: '🔴 แพง', emoji: '🧠' },
];

export function AIContentGenerator({ onContentGenerated }: { onContentGenerated: (data: any[]) => void }) {
  const [apiKey, setApiKey] = useState('');
  const [newKeyInput, setNewKeyInput] = useState('');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [savedKeys, setSavedKeys] = useState<{label: string, key: string}[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddKey, setShowAddKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[1].id);
  const [quantity, setQuantity] = useState(5);
  const [theme, setTopicTheme] = useState('ความรู้ AI เพื่อรายได้');
  const [category, setCategory] = useState('AI');
  const [isLoading, setIsLoading] = useState(false);

  // Load saved keys on mount
  useEffect(() => {
    const raw = localStorage.getItem('openrouter_keys');
    if (raw) {
      try {
        const keys = JSON.parse(raw) as {label: string, key: string}[];
        setSavedKeys(keys);
        // Auto-select the first key
        if (keys.length > 0) {
          setApiKey(keys[0].key);
        } else {
          setShowSettings(true);
          setShowAddKey(true);
        }
      } catch {
        setShowSettings(true);
        setShowAddKey(true);
      }
    } else {
      // Migrate old single key if exists
      const oldKey = localStorage.getItem('openrouter_key');
      if (oldKey) {
        const migrated = [{ label: 'My Key', key: oldKey }];
        setSavedKeys(migrated);
        setApiKey(oldKey);
        localStorage.setItem('openrouter_keys', JSON.stringify(migrated));
        localStorage.removeItem('openrouter_key');
      } else {
        setShowSettings(true);
        setShowAddKey(true);
      }
    }
  }, []);

  const handleAddKey = () => {
    if (!newKeyInput.trim()) return;
    const label = newKeyLabel.trim() || `Key ${savedKeys.length + 1}`;
    const updated = [...savedKeys, { label, key: newKeyInput.trim() }];
    setSavedKeys(updated);
    setApiKey(newKeyInput.trim());
    localStorage.setItem('openrouter_keys', JSON.stringify(updated));
    setNewKeyInput('');
    setNewKeyLabel('');
    setShowAddKey(false);
  };

  const handleSelectKey = (key: string) => {
    setApiKey(key);
  };

  const handleDeleteKey = (index: number) => {
    const updated = savedKeys.filter((_, i) => i !== index);
    setSavedKeys(updated);
    localStorage.setItem('openrouter_keys', JSON.stringify(updated));
    if (updated.length > 0) {
      setApiKey(updated[0].key);
    } else {
      setApiKey('');
      setShowAddKey(true);
    }
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      alert('กรุณาใส่ OpenRouter API Key ก่อนสร้างเนื้อหานะครับ');
      setShowSettings(true);
      return;
    }

    setIsLoading(true);
    try {
        const prompt = `
คุณคือผู้เชี่ยวชาญทำคลิปสั้น TikTok/Reels ที่แจก Prompt เด็ดๆ ให้คนดู
เรื่อง: "${theme}" (หมวด: ${category})
สร้าง ${quantity} คลิป

รูปแบบ: 1 คลิป = 1 Prompt เด็ดๆ
- "topic" = พาดหัว Clickbait ภาษาไทย ดึงดูดมาก (ไม่เกิน 50 ตัวอักษร)
- "body" = Array มี 1 ข้อ คือ Prompt เต็มๆ ที่ใช้งานได้จริง
  - ต้องเป็นภาษาไทย
  - ต้องมีรายละเอียดพอที่คนดู copy ไปวางใส่ ChatGPT/AI ได้เลย
  - ความยาว 2-4 บรรทัด (ไม่สั้นจนไม่มีประโยชน์ ไม่ยาวจนล้นจอ)
  - เขียนให้เหมือนสั่ง AI จริงๆ

ตัวอย่างที่ถูกต้อง:
{
  "topic": "Prompt AI ช่วยเขียนแคปชั่นขายของ!",
  "body": ["ช่วยเขียนแคปชั่นขายสินค้า [ใส่ชื่อสินค้า] ให้น่าดึงดูด เน้นจุดเด่น 3 ข้อ ใส่อีโมจิให้น่าอ่าน พร้อม CTA ปิดท้ายกระตุ้นให้สั่งซื้อทันที"]
}

ตอบ JSON Array เท่านั้น ห้ามอธิบายเพิ่ม:
[{ "topic": "...", "body": ["Prompt เดียวเด็ดๆ..."] }]
        `;

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:5173', 
                'X-Title': 'Bulk Video Creator AI',
            },
            body: JSON.stringify({
                model: selectedModel,
                messages: [
                    { role: 'user', content: prompt }
                ]
            })
        });

        if(!res.ok) {
            const errorBody = await res.json().catch(() => ({}));
            const errorMsg = errorBody?.error?.message || errorBody?.message || `HTTP ${res.status}`;
            throw new Error(`API Error: ${errorMsg}`);
        }

        const data = await res.json();
        
        if (!data.choices || !data.choices[0]) {
            throw new Error('API ตอบกลับมาแต่ไม่มีข้อมูล choices');
        }
        
        const contentString = data.choices[0].message.content;
        
        let parsedData = [];
        try {
            const cleaned = contentString.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleaned);
            // Handle different JSON structures AI might return
            if(!Array.isArray(parsedData)) {
                // Try to find array in nested keys
                const keys = Object.keys(parsedData);
                for (const key of keys) {
                    if (Array.isArray(parsedData[key])) {
                        parsedData = parsedData[key];
                        break;
                    }
                }
            }
            if(!Array.isArray(parsedData)) {
                throw new Error('Response is not an array');
            }
        } catch(e) {
             console.error("Failed to parse JSON:", contentString);
             throw new Error('AI ตอบกลับมาแต่ไม่สามารถแปลงเป็น JSON ได้ ลองอีกครั้ง');
        }

        // Attach category to each item
        const withCategory = parsedData.map((item: any) => ({ ...item, category }));
        onContentGenerated(withCategory);
        alert(`🎉 สร้างสำเร็จ ${withCategory.length} หัวข้อ! ดูได้ในแท็บ Content Stock`);

    } catch (e: any) {
        console.error('Generate error:', e);
        alert('❌ เกิดข้อผิดพลาด:\n\n' + e.message);
    } finally {
        setIsLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-main)',
    borderColor: 'var(--border-color)',
    color: 'var(--text-main)',
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-muted)',
  };

  return (
    <Card className="flex flex-col gap-4 relative overflow-hidden">
        {/* BG Glow */}
        <div className="absolute top-[-50px] right-[-50px] w-32 h-32 blur-3xl rounded-full pointer-events-none" style={{ backgroundColor: 'var(--accent)', opacity: 0.15 }}></div>

      <div className="flex justify-between items-center relative z-10">
        <h2 className="text-xl font-semibold flex items-center gap-2">
            <span style={{ color: 'var(--accent)' }}>✨</span>
            AI Content Generator
        </h2>
        <button onClick={() => setShowSettings(!showSettings)} className="hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>
            ⚙️
        </button>
      </div>

      {showSettings && (
        <div className="p-4 rounded-xl space-y-3 relative z-10 border" style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}>
            
            {/* Saved API Keys Dropdown */}
            <div>
                <label className="block text-xs font-medium mb-1 flex justify-between items-center" style={labelStyle}>
                    <span>🔑 API Key ที่บันทึกไว้</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--accent)', color: '#fff', opacity: 0.8 }}>
                        {savedKeys.length} keys
                    </span>
                </label>
                {savedKeys.length > 0 ? (
                    <div className="space-y-1.5">
                        {savedKeys.map((sk, i) => (
                            <div 
                                key={i} 
                                className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all"
                                style={{
                                    borderColor: apiKey === sk.key ? 'var(--accent)' : 'var(--border-color)',
                                    backgroundColor: apiKey === sk.key ? 'var(--bg-card)' : 'transparent',
                                    boxShadow: apiKey === sk.key ? '0 0 0 1px var(--accent)' : 'none'
                                }}
                                onClick={() => handleSelectKey(sk.key)}
                            >
                                <span className="text-sm">{apiKey === sk.key ? '🟢' : '⚪'}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{sk.label}</p>
                                    <p className="text-[10px] font-mono truncate" style={labelStyle}>
                                        {sk.key.slice(0, 12)}...{sk.key.slice(-4)}
                                    </p>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteKey(i); }}
                                    className="text-red-400 hover:text-red-300 text-xs p-1 rounded hover:bg-red-500/10 transition-colors"
                                    title="ลบ key นี้"
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs italic py-2" style={labelStyle}>ยังไม่มี API Key - เพิ่มด้านล่าง ⬇️</p>
                )}
            </div>

            {/* Add New Key */}
            {!showAddKey ? (
                <button 
                    onClick={() => setShowAddKey(true)}
                    className="w-full text-xs py-2 rounded-lg border border-dashed hover:opacity-80 transition-opacity flex items-center justify-center gap-1"
                    style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                    ➕ เพิ่ม API Key ใหม่
                </button>
            ) : (
                <div className="p-3 rounded-lg border space-y-2" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-card)' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--accent)' }}>➕ เพิ่ม API Key ใหม่</p>
                    <input 
                        type="text"
                        value={newKeyLabel}
                        onChange={e => setNewKeyLabel(e.target.value)}
                        placeholder="ชื่อ Key (เช่น Work, Personal)"
                        className="w-full text-sm p-2 rounded-lg border outline-none"
                        style={inputStyle}
                    />
                    <input 
                        type="password" 
                        value={newKeyInput}
                        onChange={e => setNewKeyInput(e.target.value)}
                        placeholder="sk-or-v1-..."
                        className="w-full text-sm p-2 rounded-lg border outline-none"
                        style={inputStyle}
                    />
                    <div className="flex gap-2">
                        <button 
                            onClick={handleAddKey}
                            className="flex-1 text-xs py-2 rounded-lg text-white font-medium"
                            style={{ backgroundColor: 'var(--accent)' }}
                        >
                            💾 บันทึก
                        </button>
                        <button 
                            onClick={() => { setShowAddKey(false); setNewKeyInput(''); setNewKeyLabel(''); }}
                            className="text-xs py-2 px-3 rounded-lg border"
                            style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                        >
                            ยกเลิก
                        </button>
                    </div>
                </div>
            )}

        </div>
      )}

      {/* Model Selection - ALWAYS VISIBLE */}
      <div className="relative z-10">
          <label className="block text-xs font-medium mb-1" style={labelStyle}>🤖 เลือก Model AI</label>
          <select 
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="w-full text-sm p-2.5 rounded-lg border outline-none"
              style={inputStyle}
          >
              {MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.emoji} {m.name} ({m.price})</option>
              ))}
          </select>
          <p className="text-xs mt-1" style={labelStyle}>💡 {MODELS.find(m => m.id === selectedModel)?.desc}</p>
      </div>

      <div className="space-y-3 relative z-10">
        <div>
            <label className="block text-xs font-medium mb-1" style={labelStyle}>📂 หมวดหมู่ (Category)</label>
            <input 
                type="text" 
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="เช่น AI, การเงิน, Self-improvement"
                className="w-full text-sm p-2.5 rounded-lg border outline-none"
                style={inputStyle}
            />
        </div>
        <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={labelStyle}>ธีมเนื้อหา (Topic Theme)</label>
                <input 
                    type="text" 
                    value={theme}
                    onChange={e => setTopicTheme(e.target.value)}
                    placeholder="เช่น ความรู้ AI เพื่อรายได้"
                    className="w-full text-sm p-2.5 rounded-lg border outline-none"
                    style={inputStyle}
                />
            </div>
            <div className="col-span-1">
                <label className="block text-xs font-medium mb-1" style={labelStyle}>จำนวน</label>
                <NumInput min={1} max={20} value={quantity} onChange={setQuantity} className="w-full text-sm p-2.5 rounded-lg border outline-none" />
            </div>
        </div>

        <button 
            disabled={isLoading}
            onClick={handleGenerate}
            className="w-full py-3 text-white rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-wait"
            style={{ background: `linear-gradient(135deg, var(--accent), var(--accent-hover))` }}
        >
            {isLoading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    กำลังให้ AI ใช้สมอง...
                </>
            ) : (
                <>
                    ✨ หมุนวงล้อคิดคอนเทนต์
                </>
            )}
        </button>
      </div>
    </Card>
  );
}
