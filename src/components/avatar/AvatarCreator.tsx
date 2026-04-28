import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';

interface AvatarExp {
  name: string;
  fullName: string;
  url: string;
}

interface CharacterGallery {
  name: string;
  avatars: AvatarExp[];
}

export function AvatarCreator() {
  // Navigation & Data
  const [activeMode, setActiveMode] = useState<'create' | 'gallery'>('create');
  const [characters, setCharacters] = useState<CharacterGallery[]>([]);
  const [selectedChar, setSelectedChar] = useState<CharacterGallery | null>(null);

  // Creation State
  const [charName, setCharName] = useState('');
  const [characterDesc, setCharacterDesc] = useState('');
  const [artStyle, setArtStyle] = useState('anime');
  const [imageModel, setImageModel] = useState('seedream/4.5-text-to-image');
  const [isGenerating, setIsGenerating] = useState(false);
  const [log, setLog] = useState('');
  const [logs, setLogs] = useState<{time: string; msg: string; type: 'info'|'success'|'error'}[]>([]);
  const [showRandomPicker, setShowRandomPicker] = useState(false);
  const [removingBgId, setRemovingBgId] = useState<string>('');

  // Extra Expression State
  const [newExp, setNewExp] = useState('angry');

  // Load API Keys
  const [apiKeys] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('api_key_profiles') || '[]'); } 
    catch(e) { return []; }
  });
  const selectedKeyId = localStorage.getItem('selected_api_key_id') || '';
  const apiKey = apiKeys.find((p: any) => p.id === selectedKeyId)?.key || '';

  // Helper: Add timestamped log
  const addLog = (msg: string, type: 'info'|'success'|'error' = 'info') => {
    const time = new Date().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
    setLogs(prev => [...prev.slice(-50), { time, msg, type }]);
    setLog(msg);
  };

  // Dynamic character randomizer
  const [randomChars, setRandomChars] = useState<{name: string; desc: string; emoji: string}[]>([]);

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  const generateRandomChars = (count = 6) => {
    // ALL descriptions in English for best AI results
    const genders = [
      { type: 'girl', label: 'young girl', names: ['น้องส้ม','น้องพิม','น้องมิ้นท์','น้องแก้ม','น้องฟ้า','น้องเมฆ','น้องมะลิ','น้องไอซ์','น้องเค้ก','น้องพีช','น้องโมจิ'], emojis: ['🎀','🌸','💖','🍬','☁️','🌈','🍒','🦋','🧁'] },
      { type: 'boy', label: 'young boy', names: ['น้องกันต์','น้องเก้า','น้องภู','น้องอาร์ม','น้องบอส','น้องต้น','น้องเจ','น้องไฟท์','น้องเจมส์'], emojis: ['⚽','🎮','🔥','⚡','🏀','🎸','🚀','💪'] },
      { type: 'man', label: 'adult man', names: ['พี่ก้อง','พี่หนุ่ย','พี่เจ','ลุงตุ่น','ลุงสม','พี่โอ๊ค','พี่โจ้'], emojis: ['👔','🌺','🧔','💼','🎩','🕶️'] },
      { type: 'woman', label: 'adult woman', names: ['พี่แอน','ครูบัว','ครูนิด','พี่เจน','ป้าแก้ว','พี่จอย'], emojis: ['👩‍🏫','🌺','💅','👑','🌹','💐'] },
      { type: 'creature', label: 'fantasy creature', names: ['แมวเซง','หมาป่อง','กบแตงโม','กระต่ายมูน','โรบอทเซง','เอเลี่ยนจ๋อย','มังกรน้อย','หมีพูห์','ยูนิคอร์น'], emojis: ['🐱','🐶','🐸','🐰','🤖','👽','🐉','🐻','🦄'] },
    ];

    const hairColors = ['black','brown','pink','blue','golden blonde','silver','purple','red','green','orange','rainbow gradient','white'];
    const hairStyles = ['short hair','long straight hair','long curly hair','bob cut','ponytail','twin buns','mushroom cut','braids','fluffy hair','spiky hair','twin tails','buzz cut','bald'];
    const eyeStyles = ['big round eyes','sharp narrow eyes','blue eyes','green eyes','glowing red eyes','golden eyes','cute sparkling eyes','fierce eyes'];
    const outfits = ['Japanese school uniform blue and white','pastel hoodie','cool black and gold warrior outfit','floral kimono','Hawaiian shirt with flower pattern','gray business suit','white chef outfit','silver space suit','pink maid cafe dress','orange tank top','purple princess gown','superhero costume with cape','streetwear fashion','plain t-shirt with jeans','white lab coat','black ninja suit'];
    const accessories = ['wearing round glasses','headphones around neck','plaid scarf','beret hat','holding a microphone','lollipop in mouth','fairy wings','devil horns','cat sitting on shoulder','holding a book','wearing a backpack','holding a guitar','star tattoo on cheek','wearing an apron','bunny ears headband'];
    const personalities = ['cute and bright','cool and mysterious','playful and mischievous','quiet but kind','cheerful and energetic','fierce but gentle','shy','super confident','funny and silly','dreamy and quirky'];

    const results: {name: string; desc: string; emoji: string}[] = [];
    const usedNames = new Set<string>();

    for (let i = 0; i < count; i++) {
      const gender = genders[Math.floor(Math.random() * genders.length)];
      let name = pick(gender.names);
      let tries = 0;
      while (usedNames.has(name) && tries < 20) { name = pick(gender.names); tries++; }
      usedNames.add(name);

      let desc = '';
      if (gender.type === 'creature') {
        const animalDescs = ['round and huggable','tiny and cute','big and chubby','fluffy fur','shiny scales'];
        desc = `${gender.label}, ${pick(animalDescs)}, ${pick(eyeStyles)}, wearing ${pick(outfits)}, ${pick(accessories)}, ${pick(personalities)} personality`;
      } else {
        desc = `${gender.label} with ${pick(hairStyles)} ${pick(hairColors)}, ${pick(eyeStyles)}, wearing ${pick(outfits)}, ${pick(accessories)}, ${pick(personalities)} personality`;
      }

      results.push({ name, desc, emoji: pick(gender.emojis) });
    }
    return results;
  };

  // Initial Load
  useEffect(() => {
    fetchCharacters();
  }, [activeMode]);

  const fetchCharacters = async () => {
    try {
      const res = await fetch('/api/list-avatars');
      const data = await res.json();
      setCharacters(data);
      if (selectedChar) {
         const updated = data.find((c: any) => c.name === selectedChar.name);
         if (updated) setSelectedChar(updated);
      }
    } catch(e) {}
  };

  const handleDeleteCharacter = async (charName: string) => {
    if (!confirm(`⚠️ ต้องการลบตัวละคร "${charName}" ทั้งหมดจริงหรือไม่?\nข้อมูลทั้งหมดจะถูกลบถาวร!`)) return;
    try {
      await fetch('/api/delete-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterName: charName })
      });
      setSelectedChar(null);
      addLog(`🗑️ ลบตัวละคร "${charName}" เรียบร้อย`, 'success');
      await fetchCharacters();
    } catch(e) {
      addLog('ลบไม่สำเร็จ', 'error');
    }
  };

  const executeKieGeneration = async (prompt: string): Promise<string> => {
    if (!apiKey) throw new Error("กรุณาเลือก API Key ในคลังแสง");
    
    addLog(`📡 กำลังส่งคำสั่งถึง Kie AI (โมเดล: ${imageModel})...`, 'info');
    const requestBody = {
      model: imageModel,
      input: { prompt, aspect_ratio: '1:1', quality: 'basic', nsfw_checker: false }
    };
    console.log('[Avatar API Request]', JSON.stringify(requestBody).substring(0, 500));
    const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => '');
      addLog(`❌ API Error: ${createRes.status} - ${errText.substring(0, 200)}`, 'error');
      throw new Error(`API Error: ${createRes.status} ${errText.substring(0, 100)}`);
    }
    const createData = await createRes.json();
    console.log('[Avatar API Response]', JSON.stringify(createData).substring(0, 500));
    const taskId = createData?.data?.taskId || createData?.taskId;
    if (!taskId) {
      addLog(`❌ ไม่ได้รับ Task ID - Response: ${JSON.stringify(createData).substring(0, 200)}`, 'error');
      throw new Error("ไม่ได้รับ Task ID");
    }

    addLog(`🎫 ได้ Task ID: ${taskId.substring(0,8)}... กำลังรอ AI วาดภาพ`, 'info');
    let attempt = 0;
    while (attempt < 60) {
      await new Promise(res => setTimeout(res, 2500));
      addLog(`⏳ กำลังวาดภาพ... (${Math.round(attempt * 2.5)} วินาที)`, 'info');
      try {
        const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const pollData = await pollRes.json();
        const state = pollData?.data?.state?.toLowerCase() || pollData?.state?.toLowerCase();
        console.log('[Avatar Poll]', attempt, 'state:', state, 'data:', JSON.stringify(pollData).substring(0, 500));
        
        if (state === 'success' || state === 'completed') {
            addLog('✅ AI วาดเสร็จแล้ว! กำลังดึงรูปภาพ...', 'success');
            const resultJsonStr = pollData?.data?.resultJson || pollData?.resultJson;
            if (resultJsonStr) {
              try {
                const parsed = typeof resultJsonStr === 'string' ? JSON.parse(resultJsonStr) : resultJsonStr;
                const url = parsed.images?.[0]?.url || parsed.url || parsed.resultUrls?.[0] || parsed.imageUrl || parsed.output?.url;
                if (url) return url;
              } catch(parseErr) {
                console.error('[Avatar Parse Error]', parseErr);
              }
            }
            const directUrl = pollData?.data?.output?.url || pollData?.data?.resultUrl || pollData?.data?.url || pollData?.data?.imageUrl;
            if (directUrl) return directUrl;
            
            const outputImages = pollData?.data?.output?.images || pollData?.data?.images;
            if (outputImages && outputImages.length > 0) {
              const imgUrl = outputImages[0]?.url || outputImages[0];
              if (typeof imgUrl === 'string') return imgUrl;
            }
            
            addLog('⚠️ API สำเร็จแต่ดึง URL ไม่ได้ ดู Console log', 'error');
            break;
        } else if (state === 'failed' || state === 'error') {
            throw new Error("ระบบเจนภาพล้มเหลว");
        }
      } catch(pollErr: any) {
        if (pollErr.message === "ระบบเจนภาพล้มเหลว") throw pollErr;
      }
      attempt++;
    }
    throw new Error("หมดเวลาหรือดึงรูปแบบไม่สำเร็จ");
  };

  const removeBackgroundAI = async (imageUrl: string): Promise<string> => {
    if (!apiKey) throw new Error('กรุณาเลือก API Key');
    addLog('🪄 กำลังส่งรูปไปลบ Background ด้วย AI...', 'info');
    
    const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'recraft/remove-background',
        input: { image: imageUrl }
      })
    });
    if (!createRes.ok) throw new Error(`Remove BG API Error: ${createRes.status}`);
    const createData = await createRes.json();
    const taskId = createData?.data?.taskId || createData?.taskId;
    if (!taskId) throw new Error('ไม่ได้รับ Task ID จาก Remove BG');
    
    addLog(`🎫 Remove BG Task: ${taskId.substring(0, 12)}...`, 'info');
    let attempt = 0;
    while (attempt < 40) {
      await new Promise(res => setTimeout(res, 2000));
      try {
        const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
          method: 'GET', headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const pollData = await pollRes.json();
        const state = pollData?.data?.state?.toLowerCase() || pollData?.state?.toLowerCase();
        
        if (state === 'success' || state === 'completed') {
          const resultJsonStr = pollData?.data?.resultJson || pollData?.resultJson;
          if (resultJsonStr) {
            const parsed = typeof resultJsonStr === 'string' ? JSON.parse(resultJsonStr) : resultJsonStr;
            const url = parsed.images?.[0]?.url || parsed.url || parsed.resultUrls?.[0] || parsed.imageUrl || parsed.output?.url;
            if (url) { addLog('✅ ลบ Background สำเร็จ!', 'success'); return url; }
          }
          const directUrl = pollData?.data?.output?.url || pollData?.data?.resultUrl || pollData?.data?.url;
          if (directUrl) { addLog('✅ ลบ Background สำเร็จ!', 'success'); return directUrl; }
          const outputImages = pollData?.data?.output?.images || pollData?.data?.images;
          if (outputImages?.length > 0) {
            const imgUrl = outputImages[0]?.url || outputImages[0];
            if (typeof imgUrl === 'string') { addLog('✅ ลบ Background สำเร็จ!', 'success'); return imgUrl; }
          }
          throw new Error('ลบ BG สำเร็จ แต่ดึง URL ไม่ได้');
        } else if (state === 'failed' || state === 'error') {
          throw new Error('ลบ Background ล้มเหลว');
        }
      } catch(e: any) {
        if (e.message.includes('ล้มเหลว') || e.message.includes('ดึง URL')) throw e;
      }
      attempt++;
    }
    throw new Error('Remove BG หมดเวลา');
  };

  const handleRemoveBgSingle = async (avatar: AvatarExp, charName: string) => {
    if (!apiKey) return alert('กรุณาเลือก API Key ก่อน');
    setRemovingBgId(avatar.fullName);
    try {
      addLog(`🪄 กำลังลบ Background ของ ${avatar.name}...`, 'info');
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = avatar.url;
      });
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      
      smartRemoveBackground(ctx, img.width, img.height);
      
      const dataUrl = canvas.toDataURL('image/png');
      // Append _nobg to filename
      const newFilename = avatar.fullName.replace('.png', '_nobg.png');
      
      await fetch('/api/save-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: newFilename,
          characterName: charName,
          base64: dataUrl
        })
      });
      
      // Delete old file
      await fetch('/api/delete-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterName: charName,
          filename: avatar.fullName
        })
      });
      
      addLog(`✅ ลบ Background ของ ${avatar.name} สำเร็จ!`, 'success');
      await fetchCharacters();
      const updated = characters.find(c => c.name === charName);
      if (updated) setSelectedChar({...updated});
    } catch(err: any) {
      addLog(`❌ ลบ BG ล้มเหลว: ${err.message}`, 'error');
    } finally {
      setRemovingBgId('');
    }
  };

  const smartRemoveBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const corners = [0, (width - 1) * 4, ((height - 1) * width) * 4, ((height - 1) * width + width - 1) * 4];
    let bgR = 0, bgG = 0, bgB = 0, count = 0;
    for (const pos of corners) {
      bgR += data[pos]; bgG += data[pos + 1]; bgB += data[pos + 2];
      count++;
    }
    bgR = Math.round(bgR / count); bgG = Math.round(bgG / count); bgB = Math.round(bgB / count);
    const tolerance = 60;
    const isBackground = (pos: number) => {
      const dr = Math.abs(data[pos] - bgR);
      const dg = Math.abs(data[pos + 1] - bgG);
      const db = Math.abs(data[pos + 2] - bgB);
      return (dr + dg + db) < tolerance * 3 && data[pos + 3] > 0;
    };
    const visited = new Uint8Array(width * height);
    const stack: [number, number][] = [[0, 0], [width-1, 0], [0, height-1], [width-1, height-1]];
    for (let x = 0; x < width; x += 4) { stack.push([x, 0], [x, height-1]); }
    for (let y = 0; y < height; y += 4) { stack.push([0, y], [width-1, y]); }
    let removed = 0;
    while (stack.length > 0) {
      const curr = stack.pop()!;
      const [x, y] = curr;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const idx = y * width + x;
      if (visited[idx]) continue;
      visited[idx] = 1;
      const pos = idx * 4;
      if (!isBackground(pos)) continue;
      data[pos + 3] = 0;
      removed++;
      stack.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
    }
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] === 0) continue;
        const neighbors = [((y-1) * width + x) * 4, ((y+1) * width + x) * 4, (y * width + x-1) * 4, (y * width + x+1) * 4];
        const transparentNeighbors = neighbors.filter(n => data[n + 3] === 0).length;
        if (transparentNeighbors > 0 && transparentNeighbors < 4) {
          const dr = Math.abs(data[idx] - bgR);
          const dg = Math.abs(data[idx + 1] - bgG);
          const db = Math.abs(data[idx + 2] - bgB);
          const closeness = (dr + dg + db) / (tolerance * 3);
          if (closeness < 1.5) data[idx + 3] = Math.min(255, Math.round(closeness * 255));
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
    addLog(`🧹 ลบ ${removed.toLocaleString()} pixels สำเร็จ`, 'info');
  };

  const handleGenerateBase = async () => {
    if (!apiKey) return alert("กรุณาเลือก API Key");
    if (!charName.trim() || !characterDesc.trim()) return alert("ใส่ชื่อและคำอธิบายด้วยครับ!");

    setIsGenerating(true);
    addLog(`🎨 เริ่มสร้างตัวละคร "${charName}" ...`, 'info');

    try {
      const fullPrompt = `Character design sheet, ${characterDesc}, 4 different facial expressions in a 2x2 grid layout: (top-left: neutral slightly smiling), (top-right: open mouth talking), (bottom-left: very happy laughing), (bottom-right: sad worried). Solid bright green #00FF00 background, no gradient, no shadows, no other objects. flat color, high quality ${artStyle} style, cute character, head and shoulders portrait.`;
      
      const imageUrl = await executeKieGeneration(fullPrompt);
      addLog('✂️ กำลังหั่น Grid 2x2 → 4 อารมณ์...', 'info');

      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = async () => {
        const w = img.width / 2;
        const h = img.height / 2;
        const types = ['neutral', 'talking', 'happy', 'sad'];
        const positions = [ { x: 0, y: 0 }, { x: w, y: 0 }, { x: 0, y: h }, { x: w, y: h } ];
        
        const timestamp = Date.now();
        for (let i = 0; i < 4; i++) {
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          ctx.drawImage(img, positions[i].x, positions[i].y, w, h, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/png');
          
          await fetch('/api/save-avatar', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
                filename: `${charName}_${types[i]}_${timestamp}.png`, 
                characterName: charName.trim(),
                base64: dataUrl 
             })
          });
          addLog(`💾 บันทึก ${types[i]} สำเร็จ!`, 'success');
        }
        
        addLog(`🎉 สร้างตัวละคร "${charName}" เสร็จสมบูรณ์! (4 อารมณ์)`, 'success');
        setActiveMode('gallery');
        await fetchCharacters();
        setIsGenerating(false);
      };
      img.src = imageUrl;
    } catch(err: any) {
      addLog(`❌ ผิดพลาด: ${err.message}`, 'error');
      setIsGenerating(false);
    }
  };

  const handleAddSingleExpression = async () => {
    if (!selectedChar) return;
    setIsGenerating(true);
    addLog(`🎭 สร้างอารมณ์ [${newExp}] ให้ ${selectedChar.name}...`, 'info');

    try {
      const fullPrompt = `Character portrait, head and shoulders, ${characterDesc || selectedChar.name}, specific expression: ${newExp} facial expression. Looking directly at camera. plain solid bright #00FF00 green background, no gradient, no shadows. flat color style, high quality anime cartoon style.`;
      const imageUrl = await executeKieGeneration(fullPrompt);
      addLog('🪄 กำลังลบพื้นหลังด้วย AI...', 'info');

      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = async () => {
        const w = img.width;
        const h = img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          
          await fetch('/api/save-avatar', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
                filename: `${selectedChar.name}_${newExp}_${Date.now()}.png`, 
                characterName: selectedChar.name,
                base64: dataUrl 
             })
          });
        }
        
        await fetchCharacters();
        addLog(`✅ สร้างอารมณ์ [${newExp}] สำเร็จ!`, 'success');
        setIsGenerating(false);
      };
      img.src = imageUrl;
    } catch(err: any) {
      addLog(`❌ ผิดพลาด: ${err.message}`, 'error');
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 dark:bg-black/30 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 backdrop-blur-xl">
         <div className="flex items-center gap-3">
           <div className="p-3 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl shadow-lg shadow-pink-500/20 text-white">
             👨‍🎨
           </div>
           <div>
             <h2 className="text-xl font-bold bg-gradient-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent">PNGTuber Studio</h2>
             <p className="text-xs text-gray-500 font-medium">สตูดิโอจัดการตัวละครอนิเมชัน</p>
           </div>
         </div>
         <div className="flex gap-2">
            <button
               onClick={() => { setActiveMode('create'); setSelectedChar(null); }}
               className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeMode === 'create' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' : 'bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
               ➕ สร้างตัวใหม่
            </button>
            <button
               onClick={() => { setActiveMode('gallery'); setSelectedChar(null); }}
               className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeMode === 'gallery' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
               📂 คลังตัวละคร ({characters.length})
            </button>
         </div>
      </div>

      {/* ========== CREATE MODE ========== */}
      {activeMode === 'create' && (
         <Card className="p-6 md:p-8 bg-white/70 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl overflow-visible">
            <h3 className="text-lg font-bold mb-6 text-gray-800 dark:text-gray-100">สร้างตัวละครใหม่ (ได้หน้าพื้นฐาน 4 อารมณ์)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">ตั้งชื่อตัวละคร</label>
                    <input 
                      type="text"
                      value={charName}
                      onChange={e => setCharName(e.target.value)}
                      placeholder="เช่น น้องมะลิ, ลุงอ้วน"
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-pink-500 outline-none dark:bg-black font-semibold"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">คำบรรยายหน้าตาแบบละเอียด</label>
                      <button
                        onClick={() => { setShowRandomPicker(!showRandomPicker); if (!showRandomPicker) setRandomChars(generateRandomChars(6)); }}
                        className="text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md hover:shadow-lg transition-all hover:scale-105"
                      >
                        🎲 สุ่มตัวละคร
                      </button>
                    </div>

                    {/* Random Character Picker */}
                    {showRandomPicker && (
                      <div className="mb-3 p-3 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-700/50 shadow-inner">
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300">🎲 AI สุ่มตัวละครให้เลือก (กดเลือกเลย!)</div>
                          <button
                            onClick={() => setRandomChars(generateRandomChars(6))}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white hover:bg-amber-600 transition-all"
                          >
                            🔄 สุ่มใหม่
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto">
                          {randomChars.map((preset, idx) => (
                            <button
                              key={`${preset.name}-${idx}`}
                              onClick={() => {
                                setCharName(preset.name);
                                setCharacterDesc(preset.desc);
                                setShowRandomPicker(false);
                                addLog(`🎲 เลือกตัวละคร: ${preset.name}`, 'info');
                              }}
                              className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-black/40 border border-amber-200 dark:border-amber-700/40 hover:border-amber-500 hover:shadow-md transition-all text-left group hover:scale-[1.02]"
                            >
                              <span className="text-2xl group-hover:scale-125 transition-transform">{preset.emoji}</span>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{preset.name}</div>
                                <div className="text-[9px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-tight">{preset.desc}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <textarea 
                      rows={3}
                      value={characterDesc}
                      onChange={e => setCharacterDesc(e.target.value)}
                      placeholder="เช่น เด็กผู้หญิงผมสั้นมัดแกละ ใส่ชุดนักเรียนญี่ปุ่นสีน้ำเงินขาว..."
                      className="w-full text-sm p-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-pink-500 outline-none dark:bg-black resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">สไตล์ภาพ (Art Style)</label>
                    <select 
                      value={artStyle}
                      onChange={e => setArtStyle(e.target.value)}
                      className="w-full text-sm p-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-pink-500 outline-none dark:bg-black"
                    >
                      <option value="anime">Anime (การ์ตูนญี่ปุ่นยุคใหม่)</option>
                      <option value="chibi">Chibi (ตัวเล็กหัวโตน่ารัก)</option>
                      <option value="kid drawing style">Cartoon (ลายเส้นสบายน่ารัก)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">โมเดล AI วาดภาพ</label>
                    <select 
                      value={imageModel}
                      onChange={e => setImageModel(e.target.value)}
                      className="w-full text-sm p-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-pink-500 outline-none dark:bg-black"
                    >
                      <option value="seedream/4.5-text-to-image">🎨 Seedream 4.5 (แนะนำ, คุณภาพสูง)</option>
                      <option value="seedream/5-lite-text-to-image">⚡ Seedream 5.0 Lite (เร็ว)</option>
                      <option value="google/imagen4-fast">🚀 Google Imagen4-fast</option>
                      <option value="flux2/flex-text-to-image">🌊 Flux-2 Flex</option>
                      <option value="z-image">🖼️ Z-Image (โมเดลเดิม)</option>
                      <option value="gpt-image/1.5-text-to-image">🤖 GPT Image 1.5</option>
                    </select>
                  </div>
                  
                  <button
                    onClick={handleGenerateBase}
                    disabled={isGenerating}
                    className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${isGenerating ? 'bg-gray-400 cursor-not-allowed animate-pulse' : 'bg-gradient-to-r from-pink-500 to-indigo-600 hover:opacity-90'}`}
                  >
                    {isGenerating ? 'กำลังสร้างและหั่นรูป...' : '🎨 วาดและบันทึกคอลเลกชันใหม่'}
                  </button>
               </div>

               {/* Log Panel */}
               <div className="flex flex-col gap-3">
                 <div className="bg-gray-900 dark:bg-black rounded-2xl border border-gray-700 shadow-inner flex flex-col overflow-hidden" style={{minHeight: '280px'}}>
                   <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
                     <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                     <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                     <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                     <span className="text-[10px] font-mono text-gray-400 ml-2">📝 Log Console</span>
                     {logs.length > 0 && <button onClick={() => setLogs([])} className="ml-auto text-[9px] text-gray-500 hover:text-red-400 font-bold">ล้าง</button>}
                   </div>
                   <div className="flex-1 overflow-y-auto p-3 max-h-80 font-mono text-[11px] space-y-0.5" ref={(el) => { if(el) el.scrollTop = el.scrollHeight; }}>
                     {logs.length === 0 ? (
                       <div className="text-gray-600 text-center py-8">ยังไม่มี Log...<br/>กดสร้างตัวละครเพื่อเริ่ม</div>
                     ) : logs.map((l, i) => (
                       <div key={i} className={`flex gap-2 ${l.type === 'error' ? 'text-red-400' : l.type === 'success' ? 'text-green-400' : 'text-gray-300'}`}>
                         <span className="text-gray-500 shrink-0">[{l.time}]</span>
                         <span>{l.msg}</span>
                       </div>
                     ))}
                   </div>
                 </div>
                 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center p-4 text-center">
                   <h4 className="font-bold text-gray-600 dark:text-gray-400 mb-1 text-sm">Automated 2x2 Slicer</h4>
                   <p className="text-[10px] text-gray-500">ระบบจะสั่งวาดแบบตาราง 4 ช่อง หั่นแยกออกเป็น 4 อารมณ์ (นิ่ง/พูด/ยิ้ม/เศร้า) จากนั้นคุณสามารถกดเลือกลบพื้นหลังได้ในคลังตัวละคร</p>
                 </div>
               </div>
            </div>
         </Card>
      )}

      {/* ========== GALLERY: Character List ========== */}
      {activeMode === 'gallery' && !selectedChar && (
         <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {characters.map(char => {
               const cover = char.avatars.find(a => a.name.includes('neutral')) || char.avatars[0];
               return (
                  <button 
                     key={char.name}
                     onClick={() => setSelectedChar(char)}
                     className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col items-center text-center overflow-hidden relative"
                  >
                     <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button
                         onClick={(e) => { e.stopPropagation(); handleDeleteCharacter(char.name); }}
                         className="bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 text-[10px] font-bold shadow-lg"
                         title="ลบตัวละครนี้"
                       >
                         ✕
                       </button>
                     </div>
                     <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-black/50 mb-3 overflow-hidden border-2 border-transparent group-hover:border-pink-500 transition-colors">
                        {cover ? <img src={cover.url} className="w-full h-full object-cover" /> : <div className="text-3xl mt-6 font-bold text-gray-400">?</div>}
                     </div>
                     <span className="font-bold text-sm truncate w-full text-gray-800 dark:text-gray-200">{char.name}</span>
                     <span className="text-[10px] text-gray-500 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full mt-1">{char.avatars.length} อารมณ์</span>
                  </button>
               )
            })}
            {characters.length === 0 && (
               <div className="col-span-full py-12 text-center text-gray-500">ยังไม่มีตัวละครในคลัง</div>
            )}
         </div>
      )}

      {/* ========== GALLERY: Character Detail ========== */}
      {activeMode === 'gallery' && selectedChar && (
         <Card className="p-6 bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-800 relative shadow-2xl">
            <button 
               onClick={() => setSelectedChar(null)} 
               className="absolute top-4 right-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
            >
               ✕ ปิด 
            </button>
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
               <div className="w-16 h-16 rounded-full bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center text-2xl font-black text-pink-600">
                  {selectedChar.name[0]}
               </div>
               <div className="flex-1">
                  <h3 className="text-2xl font-black">{selectedChar.name}</h3>
                  <p className="text-xs text-gray-500">เก็บอยู่ในโฟลเดอร์ <code className="text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-1 py-0.5 rounded">Avatar_stock/{selectedChar.name}/</code></p>
               </div>
               <button
                  onClick={() => handleDeleteCharacter(selectedChar.name)}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-1.5"
               >
                  🗑️ ลบตัวละครนี้
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
               <div className="md:col-span-3">
                  <h4 className="font-bold mb-4 text-gray-700 dark:text-gray-300">คอลเลกชันท่าทางที่มี ({selectedChar.avatars.length})</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                     {selectedChar.avatars.map(avatar => (
                        <div key={avatar.fullName} className="bg-gray-50 dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col items-center pt-2 relative group">
                           <div className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm bg-black/10 dark:bg-white/10 text-gray-600 dark:text-gray-300 z-10">
                             {avatar.name.toUpperCase()}
                           </div>
                           <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                             {!avatar.fullName.includes('_nobg') ? (
                               <button
                                 onClick={() => handleRemoveBgSingle(avatar, selectedChar.name)}
                                 disabled={removingBgId === avatar.fullName}
                                 className={`text-[9px] font-bold px-2 py-1 rounded-lg shadow-md transition-all ${
                                   removingBgId === avatar.fullName
                                     ? 'bg-yellow-400 text-yellow-900 animate-pulse cursor-wait'
                                     : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:scale-105'
                                 }`}
                                 title="ลบ Background (AI)"
                               >
                                 {removingBgId === avatar.fullName ? '⏳ ลบ...' : '🪄 ลบ BG'}
                               </button>
                             ) : (
                               <div className="bg-green-500/90 text-white text-[9px] font-bold px-2 py-1 rounded-lg shadow-md">
                                 ✅ ตัดแล้ว
                               </div>
                             )}
                           </div>
                           <img src={avatar.url} className="w-full h-32 object-contain hover:scale-110 transition-transform duration-300 cursor-pointer" style={{background: 'repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 0 0 / 16px 16px'}} />
                           <div className="w-full bg-white dark:bg-black p-2 text-center border-t border-gray-200 dark:border-gray-800">
                             <span className="text-[10px] truncate w-full block text-gray-500">{avatar.fullName}</span>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="md:col-span-1 border-l-0 md:border-l border-gray-100 dark:border-gray-800 md:pl-6 space-y-4">
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                     <h4 className="font-bold text-indigo-800 dark:text-indigo-300 mb-2">✨ สั่งวาดอารมณ์เพิ่ม</h4>
                     <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400 mb-4 leading-tight">โปรแกรมจะให้ AI วาดหน้าเดิมแต่ปรับอารมณ์เป็นภาพเดี่ยว</p>
                     
                     <select 
                       value={newExp}
                       onChange={e => setNewExp(e.target.value)}
                       className="w-full text-xs p-2 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-black outline-none mb-3"
                     >
                        <option value="angry">😠 โกรธ (Angry)</option>
                        <option value="thinking">🤔 คิดสงสัย (Thinking)</option>
                        <option value="shocked">😲 ตกใจช็อค (Shocked)</option>
                        <option value="smug">😏 ยิ้มมุมปาก (Smug)</option>
                        <option value="crying">😭 ร้องไห้ (Crying)</option>
                        <option value="meme face funny">😵 หน้ามีมตลก (Meme)</option>
                        <option value="evil laugh">😈 หัวเราะชั่วร้าย (Evil Laugh)</option>
                        <option value="sleeping">💤 หลับตา (Sleeping)</option>
                     </select>

                     <button
                       onClick={handleAddSingleExpression}
                       disabled={isGenerating}
                       className={`w-full py-2.5 rounded-lg text-xs font-bold text-white shadow-md transition-all ${isGenerating ? 'bg-indigo-300 cursor-not-allowed animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                     >
                       {isGenerating ? 'กำลังเสก...' : '➕ กดสร้างอารมณ์นี้เลย'}
                     </button>
                     {log && <div className="mt-2 text-[10px] text-center font-bold text-indigo-700 dark:text-indigo-300">{log}</div>}
                  </div>
               </div>
            </div>
         </Card>
      )}

    </div>
  );
}
