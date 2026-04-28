import React, { useState } from 'react';
import { NumInput } from '../ui/NumInput';
import { Card } from '../ui/Card';
import { buildHoroscopePngScript, buildHoroscopeCardScript, buildHoroscopeDownloadScript, buildHoroscopeThemeScript } from '../../utils/horoscopeBuilder';

export const HoroscopeTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'png' | 'cards' | 'download' | 'themes'>('png');

  // PNG State
  const [csvName, setCsvName] = useState('ดวงรายวัน ใช้ทำกับ make จบปี 2569 - เมษายน.csv');
  const [theme, setTheme] = useState('1');
  const [cardDir, setCardDir] = useState('');
  const [skipDone, setSkipDone] = useState(true);
  const [rowStart, setRowStart] = useState<number | ''>('');
  const [rowEnd, setRowEnd] = useState<number | ''>('');

  // Cards State
  const [provider, setProvider] = useState<'openrouter' | 'kieai'>('openrouter');
  const [model, setModel] = useState('google/gemini-2.5-flash-image');
  const [apiKey, setApiKey] = useState('');
  const [cardTheme, setCardTheme] = useState('1');
  const [themeDesc, setThemeDesc] = useState('');
  const [cardStart, setCardStart] = useState<number>(1);
  const [cardEnd, setCardEnd] = useState<number>(78);
  const [skipExisting, setSkipExisting] = useState(true);

  // Themes State
  const [customThemeName, setCustomThemeName] = useState('');
  const [customNameEn, setCustomNameEn] = useState('');
  const [customCardDir, setCustomCardDir] = useState('card_images_custom');
  const [customAccent, setCustomAccent] = useState('#d4af37');
  const [customBodyBg, setCustomBodyBg] = useState('#030112');

  const handleDownloadPngScript = () => {
    const scriptContent = buildHoroscopePngScript({
      csvName,
      theme,
      cardDir,
      skipDone,
      rowStart: rowStart === '' ? 0 : rowStart,
      rowEnd: rowEnd === '' ? 0 : rowEnd
    });
    downloadScript('run_horoscope_png.command', scriptContent);
  };

  const handleDownloadCardsScript = () => {
    const scriptContent = buildHoroscopeCardScript({
      provider,
      model,
      apiKey,
      theme: cardTheme,
      themeDesc,
      cardStart,
      cardEnd,
      skipExisting
    });
    downloadScript('run_generate_cards.command', scriptContent);
  };

  const handleDownloadClassicCards = () => {
    const scriptContent = buildHoroscopeDownloadScript();
    downloadScript('run_download_classic_cards.command', scriptContent);
  };

  const handleCreateThemeScript = () => {
    const scriptContent = buildHoroscopeThemeScript({
      themeName: customThemeName || 'Custom Theme',
      nameEn: customNameEn || 'custom_theme',
      cardDir: customCardDir || 'card_images_custom',
      accent: customAccent || '#ffffff',
      bodyBg: customBodyBg || '#000000'
    });
    downloadScript('run_create_theme.command', scriptContent);
  };

  const applyPreset = (preset: string) => {
    switch (preset) {
      case 'A': setCustomAccent('#d4af37'); setCustomBodyBg('#030112'); break; // Mystic
      case 'B': setCustomAccent('#c8860a'); setCustomBodyBg('#0a0400'); break; // Desert Gold
      case 'C': setCustomAccent('#00c8e8'); setCustomBodyBg('#000510'); break; // Deep Ocean
      case 'D': setCustomAccent('#4caf6a'); setCustomBodyBg('#010a02'); break; // Emerald Forest
      case 'E': setCustomAccent('#a8deff'); setCustomBodyBg('#00080f'); break; // Frost
      case 'F': setCustomAccent('#ff8c00'); setCustomBodyBg('#0d0000'); break; // Hellfire
      case 'G': setCustomAccent('#ff80b0'); setCustomBodyBg('#0f0008'); break; // Sakura
    }
  };

  const downloadScript = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('png')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'png' 
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-b-2 border-purple-500' 
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          📸 สร้างรูป
        </button>
        <button
          onClick={() => setActiveSubTab('cards')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'cards' 
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-b-2 border-blue-500' 
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          🎨 สร้างไพ่ AI
        </button>
        <button
          onClick={() => setActiveSubTab('download')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'download' 
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-b-2 border-emerald-500' 
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          ⬇️ โหลดไพ่ดั้งเดิม
        </button>
        <button
          onClick={() => setActiveSubTab('themes')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'themes' 
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-b-2 border-rose-500' 
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          🎭 จัดการธีม
        </button>
      </div>

      {activeSubTab === 'png' && (
        <Card>
          <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 font-bold text-lg">⚙️ ตั้งค่าการสร้างรูปดวงรายวัน</div>
          <div className="space-y-6">
            <div>
              <label className="block text-sm mb-1 font-medium">ไฟล์ CSV อ้างอิง</label>
              <input 
                type="text" 
                value={csvName} 
                onChange={e => setCsvName(e.target.value)} 
                placeholder="เว้นว่างไว้เพื่อใช้ไฟล์ .csv แรกที่เจอ"
                className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 font-mono text-sm" 
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm mb-1 font-medium">✨ ธีม (Theme)</label>
                <select 
                  value={theme} 
                  onChange={e => setTheme(e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
                >
                  <option value="1">1 - Dark mystical (อวกาศมืด)</option>
                  <option value="2">2 - Egyptian (อียิปต์)</option>
                  <option value="3">3 - Celtic forest (ป่าสีเขียว)</option>
                  <option value="4">4 - Cosmic space (เนบิวลาอวกาศ)</option>
                  <option value="5">5 - Dark fantasy fire (ไฟบรรลัยกัลป์)</option>
                  <option value="c1">c1 - Custom Theme 1</option>
                  <option value="c2">c2 - Custom Theme 2</option>
                  <option value="c3">c3 - Custom Theme 3</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm mb-1 font-medium">📁 โฟลเดอร์ไพ่ (ใส่ถ้าไม่ใช้ค่ามาตรฐานธีม)</label>
                <input 
                  type="text" 
                  value={cardDir} 
                  onChange={e => setCardDir(e.target.value)} 
                  placeholder="เช่น card_images_penguin"
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm" 
                />
              </div>
            </div>

            <div className="flex items-center gap-4 border p-3 rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex-1">
                <label className="block text-sm mb-1 font-medium">แถวเริ่มต้น</label>
                <input 
                  type="number" 
                  value={rowStart} 
                  onChange={e => setRowStart(e.target.value ? parseInt(e.target.value) : '')} 
                  placeholder="(ทั้งหมด)"
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm" 
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm mb-1 font-medium">แถวสิ้นสุด</label>
                <input 
                  type="number" 
                  value={rowEnd} 
                  onChange={e => setRowEnd(e.target.value ? parseInt(e.target.value) : '')} 
                  placeholder="(ทั้งหมด)"
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm" 
                />
              </div>
              <div className="flex-1 flex items-center h-full mt-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input 
                    type="checkbox" 
                    checked={skipDone} 
                    onChange={e => setSkipDone(e.target.checked)}
                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                  />
                  ข้ามคอลัมน์ที่เขียนว่า "ทำแล้ว"
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button 
                onClick={handleDownloadPngScript}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-transform hover:scale-[1.01] flex justify-center items-center gap-2"
              >
                <span>💾 ดาวน์โหลดไฟล์ .command และรันการสร้าง PNG</span>
              </button>
            </div>
          </div>
        </Card>
      )}

      {activeSubTab === 'cards' && (
        <Card>
          <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 font-bold text-lg">🎨 ตั้งค่า AI สร้างไพ่ทาโรต์</div>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm mb-1 font-medium">API Provider</label>
                <select 
                  value={provider} 
                  onChange={e => setProvider(e.target.value as 'openrouter' | 'kieai')}
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
                >
                  <option value="openrouter">OpenRouter</option>
                  <option value="kieai">Kie.ai</option>
                </select>
              </div>
              <div className="flex-[2]">
                <label className="block text-sm mb-1 font-medium">Model</label>
                <select 
                  value={model} 
                  onChange={e => setModel(e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
                >
                  {provider === 'openrouter' && (
                    <>
                      <option value="google/gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                      <option value="black-forest-labs/flux.2-pro">FLUX 2 Pro</option>
                      <option value="black-forest-labs/flux-1-schnell">FLUX 1 Schnell</option>
                      <option value="openai/dall-e-3">DALL·E 3</option>
                    </>
                  )}
                  {provider === 'kieai' && (
                    <>
                      <option value="flux-kontext-pro">FLUX Kontext Pro</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1 font-medium">API Key (เว้นว่างไว้ถ้าระบุใน .env ของโปรแกรมดวงแล้ว)</label>
              <input 
                type="password" 
                value={apiKey} 
                onChange={e => setApiKey(e.target.value)} 
                placeholder="sk-or-v1-..."
                className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 font-mono text-sm" 
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm mb-1 font-medium">อิงตามธีมหลัก</label>
                <select 
                  value={cardTheme} 
                  onChange={e => setCardTheme(e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
                >
                  <option value="1">1 - Dark mystical</option>
                  <option value="2">2 - Egyptian</option>
                  <option value="3">3 - Celtic forest</option>
                  <option value="4">4 - Cosmic space</option>
                  <option value="5">5 - Dark fantasy fire</option>
                </select>
              </div>
            </div>

            <div>
                <label className="block text-sm mb-1 font-medium">Prompt เขียนทับสไตล์ (เว้นว่างเพื่อใช้ตามธีม)</label>
                <textarea 
                  value={themeDesc} 
                  onChange={e => setThemeDesc(e.target.value)} 
                  placeholder="เช่น Japanese ukiyo-e woodblock print style..."
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 font-mono text-sm" 
                  rows={2}
                />
            </div>

            <div className="flex items-center gap-4 border p-3 rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex-1">
                <label className="block text-sm mb-1 font-medium">ไพ่ใบที่เริ่ม (1-78)</label>
                <NumInput min={1} max={78} value={cardStart} onChange={setCardStart} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm" />
              </div>
              <div className="flex-1">
                <label className="block text-sm mb-1 font-medium">สิ้นสุดที่ (1-78)</label>
                <NumInput min={1} max={78} value={cardEnd} onChange={setCardEnd} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
                />
              </div>
              <div className="flex-[1.5] flex items-center h-full mt-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input 
                    type="checkbox" 
                    checked={skipExisting} 
                    onChange={e => setSkipExisting(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  ข้ามไพ่ที่มีรูปแล้ว (ลดค่าใช้จ่าย)
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button 
                onClick={handleDownloadCardsScript}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-transform hover:scale-[1.01] flex justify-center items-center gap-2"
              >
                <span>💾 ดาวน์โหลดสคริปต์ รันสร้างรูปไพ่ (เฉพาะใบที่ขาด)</span>
              </button>
            </div>
          </div>
        </Card>
      )}

      {activeSubTab === 'download' && (
        <Card>
          <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 font-bold text-lg">⬇️ โหลดไพ่ Rider-Waite ต้นฉบับ</div>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-300">
              หากต้องการใช้ไพ่ทาโรต์ดั้งเดิม (ไรเดอร์-เวท) แบบครบ 78 ใบ โดยไม่ต้องเสียเวลาสร้างใหม่ สามารถโหลดเก็บไว้ในเครื่องได้เลย
            </p>
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button 
                onClick={handleDownloadClassicCards}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-transform hover:scale-[1.01] flex justify-center items-center gap-2"
              >
                <span>💾 ดาวน์โหลดสคริปต์ โหลดไพ่เข้าเครื่อง</span>
              </button>
            </div>
          </div>
        </Card>
      )}

      {activeSubTab === 'themes' && (
        <Card>
          <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 font-bold text-lg">🎭 จัดการ ธีมปรับแต่งเอง (Custom Themes)</div>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm mb-1 font-medium">ชื่อธีม</label>
                <input 
                  type="text" 
                  value={customThemeName} 
                  onChange={e => setCustomThemeName(e.target.value)} 
                  placeholder="เช่น ไพ่หมีแพนด้า"
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm" 
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm mb-1 font-medium">ภาษาอังกฤษ (สำหรับตั้งชื่อโฟลเดอร์รันไพ่)</label>
                <input 
                  type="text" 
                  value={customNameEn} 
                  onChange={e => setCustomNameEn(e.target.value)} 
                  placeholder="เช่น panda_cards"
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1 font-medium">ชื่อที่จะบันทึกไพ่ (Folder Name)</label>
              <input 
                type="text" 
                value={customCardDir} 
                onChange={e => setCustomCardDir(e.target.value)} 
                placeholder="card_images_custom"
                className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 font-mono text-sm" 
              />
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <label className="block text-sm mb-1 font-medium text-amber-600 dark:text-amber-400">⚡ Presets สำเร็จรูป (แนะนำให้กดเลือกสีเริ่มต้นก่อนปรับเอง)</label>
              <select onChange={e => { if(e.target.value) applyPreset(e.target.value); }} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm">
                <option value="">-- เลือกสี Preset อัตโนมัติ --</option>
                <option value="A">🌙 ดำม่วงลึก (Mystic)</option>
                <option value="B">🏜️ ทองทะเลทราย (Desert Gold)</option>
                <option value="C">🌊 มหาสมุทรลึก (Deep Ocean)</option>
                <option value="D">🌿 ธรรมชาติลึก (Emerald Forest)</option>
                <option value="E">❄️ น้ำแข็งขาว (Frost)</option>
                <option value="F">🔥 เพลิงนรก (Hellfire)</option>
                <option value="G">🌸 ซากุระชมพู (Sakura)</option>
              </select>
            </div>

            <div className="flex gap-4 mt-2">
              <div className="flex-1">
                <label className="block text-sm mb-1 font-medium">สีโครงร่างกรอบ (Accent Color)</label>
                <input 
                  type="color" 
                  value={customAccent} 
                  onChange={e => setCustomAccent(e.target.value)} 
                  className="w-full h-10 p-1 border rounded dark:bg-gray-800 dark:border-gray-700 cursor-pointer" 
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm mb-1 font-medium">สีพื้นหลัง (Body Bg)</label>
                <input 
                  type="color" 
                  value={customBodyBg} 
                  onChange={e => setCustomBodyBg(e.target.value)} 
                  className="w-full h-10 p-1 border rounded dark:bg-gray-800 dark:border-gray-700 cursor-pointer" 
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button 
                onClick={handleCreateThemeScript}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-transform hover:scale-[1.01] flex justify-center items-center gap-2"
              >
                <span>💾 บันทึก ธีมที่สร้างลง custom_themes.json (ผ่าน .command)</span>
              </button>
            </div>
          </div>
        </Card>
      )}

      <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-900 rounded-lg p-4 text-sm text-purple-800 dark:text-purple-300">
        <strong>💡 วิธีใช้งาน:</strong><br />
        ระบบนี้ทำงานส่งผ่านคำสั่ง \`.command\` ไปยังโปรแกรม \`สร้างดวงรายวัน 2\` บนเครื่องของคุณนายช่าง <br/>
        1. <strong>คลิก</strong> ปุ่มบันทึกไฟล์สคริปต์ ระบบจะโหลด \`.command\` <br/>
        2. <strong>ดับเบิ้ลคลิก</strong> ไฟล์นั้นบนเครื่อง เพื่อให้มันสั่งงาน Python ทันที
      </div>
    </div>
  );
};
