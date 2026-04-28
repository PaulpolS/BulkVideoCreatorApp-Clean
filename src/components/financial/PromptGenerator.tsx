import React, { useState } from 'react';
import { NumInput } from '../ui/NumInput';
import { useStockKeywords } from '../../hooks/useStockKeywords';

export function PromptGenerator() {
  const { keywords } = useStockKeywords();
  const [selectedKeywordId, setSelectedKeywordId] = useState<string>('');
  const [quantity, setQuantity] = useState(3);
  const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    const selectedKeyword = keywords.find(k => k.id === selectedKeywordId);
    if (!selectedKeyword) return;
    
    setIsGenerating(true);
    
    // Google Flow Optimized Prompts (--ar 9:16, cinematic, descriptive)
    const baseTopic = selectedKeyword.name.split(' (')[0]; // Use Thai descriptive directly, or translate implicitly via robust style tokens
    
    const templates = [
      `${baseTopic}, dynamic high angle shot, dramatic volumetric lighting, cinematic color grading, photorealistic, 8k, hyper-detailed, extremely professional financial documentary footage --ar 9:16`,
      `${baseTopic}, slow pan close up, neon futuristic accents, dark moody lighting, highly detailed texture, cinematic aesthetic, vertical orientation, 4k resolution --ar 9:16`,
      `${baseTopic}, blurred background tracking shot, sharp front focus, dramatic shadows, realistic modern business environment, perfect framing, cinematic grading --ar 9:16`,
      `${baseTopic}, time-lapse representation, abstract glowing light trails, bustling energy, high end commercial photography, sharp contrast, 8k --ar 9:16`,
      `${baseTopic}, emotional portrait shot, dramatic side-lighting, realistic skin texture, modern lighting setup, professional documentary style, vertical framing --ar 9:16`
    ];

    const results: string[] = [];
    for (let i = 0; i < quantity; i++) {
        // Just cycle through the specific templates
        const template = templates[i % templates.length];
        results.push(template);
    }

    setTimeout(() => {
        setGeneratedPrompts(results);
        setIsGenerating(false);
        setCopied(false);
    }, 500); 
  };

  const handleCopyAll = () => {
    if (generatedPrompts.length === 0) return;
    
    const textToCopy = generatedPrompts.join('\n\n');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span>✨</span> Google Flow Prompt (9:16) & Stock Manager
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">หมวดหมู่ / Keyword หลัก</label>
          <select 
            value={selectedKeywordId}
            onChange={(e) => setSelectedKeywordId(e.target.value)}
            className="w-full px-4 py-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
          >
            <option value="" disabled>-- เลือก Keyword ที่ต้องการ --</option>
            {keywords.map(kw => (
              <option key={kw.id} value={kw.id}>
                {kw.name} - (มีแล้ว {kw.count} คลิปในโฟลเดอร์ {kw.folderName})
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-500 mt-1">
            *โฟลเดอร์แยกตาม Keyword จะเก็บสต็อคของคุณไว้ใน 📁 public/Video_stock/ชื่อหมวดหมู่
          </div>
        </div>

        <div className="flex gap-4 items-end">
          <div className="w-32">
            <label className="block text-sm font-medium mb-1">จำนวน Prompt</label>
            <NumInput min={1} max={20} value={quantity} onChange={setQuantity} className="w-full px-4 py-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !selectedKeywordId}
            className="flex-1 py-2 px-4 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          >
            {isGenerating ? 'กำลังสร้าง Prompt...' : 'สร้าง Prompt อัตโนมัติ (Google Flow)'}
          </button>
        </div>

        {generatedPrompts.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">ผลลัพธ์ (สัดส่วน 9:16 - คัดลอกไปเจนใน Google Flow ได้เลย)</label>
              <button 
                onClick={handleCopyAll}
                className="text-sm py-1 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {copied ? '✅ คัดลอกแล้ว' : '📋 คัดลอกทั้งหมด'}
              </button>
            </div>
            <textarea 
              readOnly
              value={generatedPrompts.join('\n\n')}
              className="w-full h-48 px-4 py-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] focus:outline-none resize-none font-mono text-xs leading-relaxed"
            />
          </div>
        )}
      </div>
    </div>
  );
}
