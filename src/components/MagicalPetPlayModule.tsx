import React, { useMemo, useState } from 'react';
import { AlertCircle, Bot, Camera, Check, Copy, Film, ImagePlus, Play, Sparkles } from 'lucide-react';
import { getOpenRouterKeyCandidates } from '../hooks/useApiSettings';

const DEFAULT_MODEL = 'google/gemini-2.5-flash';
const MAX_PROMPT_COUNT = 40;

const AI_MODEL_OPTIONS = [
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { id: 'google/gemini-2.0-flash-lite-001', label: 'Gemini 2.0 Flash Lite' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
];

const MODEL_FALLBACKS = [
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.0-flash-lite-001',
  'openai/gpt-4o-mini',
  'google/gemini-2.5-flash',
];

type UploadedReference = {
  name: string;
  dataUrl: string;
};

type MagicalPetPrompt = {
  id: string;
  shotNumber: number;
  location: string;
  imagePrompt: string;
  videoPrompt: string;
};

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!text}
      className="sa-copy-button disabled:cursor-not-allowed disabled:opacity-50"
      title={copied ? 'Copied' : label}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('โหลดรูปไม่สำเร็จ'));
      img.onload = () => {
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('เตรียมรูปไม่สำเร็จ'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function extractJsonPayload(text: string) {
  const clean = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI ไม่ได้ตอบกลับเป็น JSON');
    return JSON.parse(match[0]);
  }
}

function buildTemplatePrompts(count: number, extraDetails: string): MagicalPetPrompt[] {
  const setups = [
    ['kitchen counter', 'a human hand offers a small snack while the referenced magical animal curiously sniffs it'],
    ['living room sofa', 'a human hand gently pats the cushion and the referenced magical animal hops closer'],
    ['wooden dining table', 'two human hands playfully tap the table while the referenced magical animal reacts'],
    ['small garden path', 'a human hand rolls a soft ball across the grass toward the referenced magical animal'],
    ['bedroom duvet', 'a human hand slowly reaches toward the referenced magical animal resting on the blanket'],
    ['home office desk', 'the referenced magical animal investigates a laptop keyboard beside human hands'],
    ['balcony with plants', 'a human hand waters a plant while the referenced magical animal watches the droplets'],
    ['camping table in a garden', 'two human fists playfully wait as the referenced magical animal jumps toward the table'],
  ];
  const detailLine = extraDetails.trim() ? ` Extra behavior notes: ${extraDetails.trim()}.` : '';
  return Array.from({ length: count }, (_, index) => {
    const [location, action] = setups[index % setups.length];
    const shotNumber = index + 1;
    return {
      id: `template-${shotNumber}`,
      shotNumber,
      location,
      imagePrompt: `Realistic mobile phone POV image, ${location}, natural household lighting, ${action}. Use the uploaded reference image as the identity of the referenced magical animal. Human hands or forearms may be visible in the foreground. Cozy everyday setting, natural colors, shallow depth of field, no text, no watermark.${detailLine}`,
      videoPrompt: `8-second image-to-video motion for shot ${shotNumber}: handheld smartphone footage, slight natural camera shake, the human hand interacts gently with the referenced magical animal, subtle body movement, believable contact, small focus shifts, realistic indoor or garden ambience, no sudden cuts.${detailLine}`,
    };
  });
}

function normalizePrompts(payload: unknown, count: number): MagicalPetPrompt[] {
  const rawShots = Array.isArray((payload as { shots?: unknown[] })?.shots)
    ? (payload as { shots: unknown[] }).shots
    : [];

  const shots = rawShots.map((item, index) => {
    const shot = item as Partial<MagicalPetPrompt>;
    const shotNumber = Number(shot.shotNumber) || index + 1;
    return {
      id: `magic-pet-${shotNumber}`,
      shotNumber,
      location: String(shot.location || '').trim() || 'home setting',
      imagePrompt: String(shot.imagePrompt || '').trim(),
      videoPrompt: String(shot.videoPrompt || '').trim(),
    };
  }).filter(shot => shot.imagePrompt && shot.videoPrompt);

  if (shots.length === 0) throw new Error('AI ตอบกลับมาแต่ไม่มี prompt ที่ใช้ได้');
  return shots.slice(0, count);
}

function buildMagicPetPrompt(count: number, extraDetails: string) {
  return `คุณคือ prompt director สำหรับคลิป Image-to-Video แนวคนเล่นกับสัตว์วิเศษแบบสมจริง

ผู้ใช้แนบรูป Magical Animal REF มา 1 รูป:
- รูปนี้คือ identity หลักของสัตว์วิเศษ ให้เรียกว่า "the referenced magical animal"
- ห้ามเปลี่ยน species, shape, color, face, body, texture, wings/horns/tail จากรูป REF
- ห้ามสร้างสัตว์ตัวใหม่ ห้ามทำให้เป็นคน ห้ามทำเป็นการ์ตูน

รายละเอียดเพิ่มเติมจากผู้ใช้:
${extraDetails.trim() || 'ไม่มี ให้สร้างกิจกรรมเล่นกับสัตว์วิเศษแบบหลากหลาย ใช้ในบ้านและสวนเป็นหลัก'}

สร้าง prompt จำนวน ${count} ชุด สำหรับคลิปสั้น 8 วินาที โดยแต่ละชุดต้องมี:
- imagePrompt: ใช้สร้างรูปตั้งต้น 1 รูป
- videoPrompt: ใช้กำกับรูปนั้นให้กลายเป็นคลิป 8 วินาที

สไตล์ที่ต้องการ:
1. สมจริงเหมือนถ่ายจากกล้องมือถือ ไม่ใช่ cinematic fantasy trailer
2. มุม POV / handheld / human camera operator เป็นหลัก
3. มีมือคน แขนคน โต๊ะ โซฟา เตียง เคาน์เตอร์ครัว สวน ระเบียง สนามหญ้า หรือของใช้ในบ้านได้
4. เน้นคนกำลังเล่นกับ the referenced magical animal เช่น แหย่เล่น ลูบหัว ป้อนขนม โยนบอล ซ่อนหา แตะโต๊ะ ยื่นมือให้ดม จับเบา ๆ อ่านหนังสือข้าง ๆ ทำงานที่โต๊ะแล้วสัตว์มาป่วน
5. สถานที่ควรหมุนเวียน: indoor living room, kitchen, bedroom, home office, dining table, balcony, garden, backyard, camping table in a garden
6. Prompt ต้องพร้อมนำไปใช้ทันที และไม่ต้องมีคำอธิบายเพิ่ม
7. ห้ามใส่ subtitle, text on screen, watermark, logo
8. ห้ามใช้ "the referenced magical animal's hands" ให้มือในเฟรมเป็น human hand / person's hand / camera operator's hand
9. imagePrompt และ videoPrompt ต้องเป็นภาษาอังกฤษ

ตอบกลับเป็น JSON เท่านั้น:
{
  "shots": [
    {
      "shotNumber": 1,
      "location": "kitchen counter",
      "imagePrompt": "...",
      "videoPrompt": "..."
    }
  ]
}`;
}

async function callMagicPetAI(refImageDataUrl: string, count: number, extraDetails: string, model: string) {
  const candidates = await getOpenRouterKeyCandidates();
  if (candidates.length === 0) throw new Error('ไม่พบ OpenRouter API Key — กรุณาตั้งค่า API Key ก่อน');

  const modelsToTry = Array.from(new Set([model, ...MODEL_FALLBACKS].filter(Boolean)));
  const prompt = buildMagicPetPrompt(count, extraDetails);
  const triedErrors: string[] = [];
  let creditErrors = 0;
  let timeoutErrors = 0;

  for (const candidate of candidates) {
    for (const modelId of modelsToTry) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${candidate.key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Bulk Video Creator - Magical Pet POV Prompts',
          },
          body: JSON.stringify({
            model: modelId,
            messages: [
              {
                role: 'system',
                content: 'You generate realistic smartphone POV image-to-video prompts. The uploaded animal reference image defines the single magical animal identity. Never replace it with a different creature.',
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: refImageDataUrl } },
                ],
              },
            ],
            temperature: 0.72,
            max_tokens: Math.min(9000, Math.max(1800, count * 430)),
            response_format: { type: 'json_object' },
          }),
        });
        const data = await response.json();
        if (response.ok && !data.error) {
          return {
            model: modelId,
            prompts: normalizePrompts(extractJsonPayload(data.choices?.[0]?.message?.content || ''), count),
          };
        }

        const message = data.error?.message || `OpenRouter error ${response.status}`;
        triedErrors.push(`${candidate.label} + ${modelId}: ${message}`);
        if (/credits|afford|402|payment|required/i.test(message) || response.status === 402) {
          creditErrors += 1;
          continue;
        }
        if (/timeout|timed out|overloaded|temporarily unavailable/i.test(message) || response.status === 408 || response.status === 504) {
          timeoutErrors += 1;
          continue;
        }
        break;
      } catch (error: any) {
        const message = error?.message || 'Network error';
        triedErrors.push(`${candidate.label} + ${modelId}: ${message}`);
        if (/timeout|timed out|network/i.test(message)) {
          timeoutErrors += 1;
          continue;
        }
        break;
      }
    }
  }

  if (creditErrors > 0) throw new Error('OpenRouter API key เครดิตไม่พอ กรุณาเติมเครดิตหรือเปลี่ยนโปรไฟล์ API Key');
  if (timeoutErrors > 0) throw new Error('OpenRouter/model timeout ชั่วคราว ลองกด Generate อีกครั้ง');
  throw new Error(triedErrors.slice(-2).join(' | ') || 'OpenRouter error');
}

export function MagicalPetPlayModule() {
  const [animalRef, setAnimalRef] = useState<UploadedReference | null>(null);
  const [extraDetails, setExtraDetails] = useState('');
  const [promptCount, setPromptCount] = useState(18);
  const [model, setModel] = useState(() => localStorage.getItem('magic_pet_ai_model') || DEFAULT_MODEL);
  const [prompts, setPrompts] = useState<MagicalPetPrompt[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastModelUsed, setLastModelUsed] = useState('');

  const normalizedCount = useMemo(
    () => Math.min(Math.max(Math.round(promptCount || 1), 1), MAX_PROMPT_COUNT),
    [promptCount],
  );
  const imageBatchText = prompts.map(item => item.imagePrompt).join('\n\n');
  const videoBatchText = prompts.map(item => item.videoPrompt).join('\n\n');

  const handleUpload = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('กรุณาเลือกไฟล์รูปภาพสำหรับ REF สัตว์วิเศษ');
      return;
    }
    try {
      setErrorMsg('');
      setAnimalRef({
        name: file.name,
        dataUrl: await readImageFileAsDataUrl(file),
      });
    } catch (error: any) {
      setErrorMsg(error?.message || 'อ่านรูป REF ไม่สำเร็จ');
    }
  };

  const handleModelChange = (nextModel: string) => {
    setModel(nextModel);
    localStorage.setItem('magic_pet_ai_model', nextModel);
  };

  const handleGenerate = async () => {
    if (!animalRef) {
      setErrorMsg('กรุณาแนบรูป REF สัตว์วิเศษก่อน');
      return;
    }
    setIsGenerating(true);
    setErrorMsg('');
    setLastModelUsed('');
    try {
      const result = await callMagicPetAI(animalRef.dataUrl, normalizedCount, extraDetails, model);
      setPrompts(result.prompts);
      setLastModelUsed(result.model);
    } catch (error: any) {
      setPrompts([]);
      setErrorMsg(error?.message || 'สร้าง prompt ไม่สำเร็จ');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTemplateFallback = () => {
    setPrompts(buildTemplatePrompts(normalizedCount, extraDetails));
    setLastModelUsed('Template fallback');
    setErrorMsg('');
  };

  return (
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
      <div className="sa-panel p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="sa-title text-xl font-bold">Magical Pet POV Clips</h2>
            <p className="sa-muted text-sm">เล่นกับสัตว์วิเศษแบบถ่ายมือถือ สมจริง ในบ้าน/สวน</p>
          </div>
        </div>

        <label className="sa-label mt-6 block text-sm font-bold">
          Magical Animal REF <span className="text-red-400">*</span>
        </label>
        <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-color)] bg-black/10 px-4 py-3 text-sm font-bold transition hover:border-[var(--accent)]">
          <ImagePlus className="h-4 w-4 text-[var(--accent)]" />
          {animalRef ? 'เปลี่ยนรูป REF สัตว์วิเศษ' : 'อัปรูป REF สัตว์วิเศษ 1 รูป'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={event => {
              handleUpload(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </label>
        {animalRef && (
          <div className="mt-3 rounded-xl border border-[var(--accent)] bg-black/10 p-3">
            <div className="flex items-center gap-3">
              <img src={animalRef.dataUrl} alt="" className="h-24 w-28 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold">{animalRef.name}</p>
                <p className="sa-muted text-xs leading-5">รูปนี้คือ identity ของ the referenced magical animal</p>
              </div>
              <button type="button" onClick={() => setAnimalRef(null)} className="sa-secondary-button px-3 py-2 text-xs">
                ลบ
              </button>
            </div>
          </div>
        )}

        <label className="sa-label mt-4 block text-sm font-bold" htmlFor="magic-pet-details">
          รายละเอียดเพิ่มเติม
        </label>
        <textarea
          id="magic-pet-details"
          value={extraDetails}
          onChange={event => setExtraDetails(event.target.value)}
          className="sa-input mt-2 min-h-[150px] w-full resize-y p-4 text-sm leading-6"
          placeholder="เช่น ให้ขี้เล่นมาก ๆ กระโดดขึ้นโต๊ะ ชอบให้ลูบหัว เล่นซ่อนหา กลัวลูกบอลนิด ๆ หรืออยากให้เน้นในสวนมากกว่าในบ้าน"
        />

        <label className="sa-label mt-4 block text-sm font-bold" htmlFor="magic-pet-count">
          จำนวน prompt
        </label>
        <input
          id="magic-pet-count"
          type="number"
          min={1}
          max={MAX_PROMPT_COUNT}
          value={promptCount}
          onChange={event => setPromptCount(Number(event.target.value))}
          className="sa-input mt-2 h-11 w-full px-4 text-sm font-semibold"
        />

        <label className="sa-label mt-4 block text-sm font-bold" htmlFor="magic-pet-model">
          AI Model
        </label>
        <select
          id="magic-pet-model"
          value={model}
          onChange={event => handleModelChange(event.target.value)}
          className="sa-input mt-2 h-11 w-full px-4 text-sm font-semibold"
        >
          {AI_MODEL_OPTIONS.map(option => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="sa-primary-button mt-4 w-full disabled:cursor-wait disabled:opacity-70"
        >
          {isGenerating ? <Bot className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
          {isGenerating ? 'AI is writing...' : `Generate ${normalizedCount} Prompts`}
        </button>

        {errorMsg && (
          <div className="sa-error mt-4 p-4 text-sm leading-6">
            <div className="mb-2 flex items-center gap-2 font-bold">
              <AlertCircle className="h-4 w-4" />
              AI generation failed
            </div>
            <p>{errorMsg}</p>
            <button type="button" onClick={handleTemplateFallback} className="sa-secondary-button mt-3">
              Use template fallback
            </button>
          </div>
        )}

        {lastModelUsed && (
          <div className="sa-ai-status mt-4 flex items-center gap-2 p-3 text-xs font-semibold">
            <Bot className="h-4 w-4" />
            Generated by {lastModelUsed}
          </div>
        )}
      </div>

      <div className="sa-workspace min-h-[420px] p-4">
        {prompts.length > 0 ? (
          <div className="space-y-4">
            <div className="sa-panel p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="sa-muted flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                    <Camera className="h-4 w-4" />
                    Batch Image Prompts
                  </div>
                  <p className="sa-muted mt-1 text-xs">รูปตั้งต้นฉากละ 1 prompt เว้นบรรทัดสำหรับส่ง batch</p>
                </div>
                <CopyButton text={imageBatchText} label="Copy Image Batch" />
              </div>
              <textarea readOnly value={imageBatchText} className="sa-input min-h-[240px] w-full resize-y p-4 font-mono text-xs leading-6" />
            </div>

            <div className="sa-panel p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="sa-muted flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                    <Film className="h-4 w-4" />
                    Batch Video Prompts
                  </div>
                  <p className="sa-muted mt-1 text-xs">ใช้กำกับรูปด้านบนตามลำดับ ฉากละ 8 วินาที</p>
                </div>
                <CopyButton text={videoBatchText} label="Copy Video Batch" />
              </div>
              <textarea readOnly value={videoBatchText} className="sa-input min-h-[240px] w-full resize-y p-4 font-mono text-xs leading-6" />
            </div>

            {prompts.map(item => (
              <article key={item.id} className="sa-panel p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">Shot {item.shotNumber}</div>
                    <h3 className="sa-title mt-1 text-base font-bold">{item.location}</h3>
                  </div>
                  <CopyButton text={`${item.imagePrompt}\n\n${item.videoPrompt}`} label="Copy Shot" />
                </div>
                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                  <div className="sa-output p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="sa-muted flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                        <Camera className="h-4 w-4" />
                        Image Prompt
                      </div>
                      <CopyButton text={item.imagePrompt} label="Copy" />
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-7">{item.imagePrompt}</p>
                  </div>
                  <div className="sa-output p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="sa-muted flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                        <Film className="h-4 w-4" />
                        Video Prompt
                      </div>
                      <CopyButton text={item.videoPrompt} label="Copy" />
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-7">{item.videoPrompt}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="sa-empty flex min-h-[380px] flex-col items-center justify-center p-8 text-center">
            <Sparkles className="h-10 w-10 opacity-50" />
            <h3 className="sa-title mt-3 text-lg font-bold">Magical pet prompts will appear here</h3>
            <p className="sa-muted mt-1 max-w-md text-sm leading-6">
              อัป REF สัตว์วิเศษ ใส่รายละเอียดเพิ่ม แล้วกด Generate เพื่อสร้าง prompt รูปและ prompt วิดีโอแบบ batch
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
