import React, { useMemo, useState } from 'react';
import { AlertCircle, Check, Clipboard, Copy, ImagePlus, Sparkles, UserRound, Wand2 } from 'lucide-react';
import { CharacterPromptBlock, generateCharacterReferencePrompts } from '../lib/prompt-engine';
import { getOpenRouterKeyCandidates } from '../hooks/useApiSettings';

const DEFAULT_CHARACTER = 'เป็ดใส่เสื้อฮู้ดสีเทา';
const VISION_MODEL = 'google/gemini-2.5-flash';

interface CopyButtonProps {
  text: string;
  label?: string;
}

function CopyButton({ text, label = 'Copy' }: CopyButtonProps) {
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

function PromptCard({ block }: { block: CharacterPromptBlock }) {
  return (
    <article className="sa-panel p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
            <UserRound className="h-4 w-4" />
            Character Reference
          </div>
          <h3 className="sa-title mt-1 text-lg font-bold">{block.characterLabel}</h3>
          <p className="sa-muted mt-1 text-sm">{block.sourceText}</p>
        </div>
        <CopyButton text={block.prompt} label="Copy Prompt" />
      </div>
      <div className="sa-output p-4">
        <p className="whitespace-pre-wrap text-sm leading-7">{block.prompt}</p>
      </div>
    </article>
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

async function describeCharacterFromImage(imageDataUrl: string) {
  const candidates = await getOpenRouterKeyCandidates();
  if (candidates.length === 0) throw new Error('ไม่พบ OpenRouter API Key — กรุณาใส่ API Key ก่อน');

  const prompt = `Analyze the uploaded character image and write a concise Thai character description for generating a clean character reference sheet.

Focus only on visible character identity details:
- character type/species/person style
- body shape/proportions/silhouette
- face/head/hair/eyes if visible
- clothing/outfit/accessories
- main colors/materials
- overall art style

Do not invent unseen details. Do not write a story. Do not mention camera, background, pose, or image quality unless it defines the character.
Return only one Thai description line, suitable to paste into a character prompt box.`;

  const tried: string[] = [];
  for (const candidate of candidates) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate.key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Bulk Video Creator - Character Reference Vision',
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          }],
          temperature: 0.25,
          max_tokens: 420,
        }),
      });
      const data = await response.json();
      if (response.ok && !data.error) {
        return String(data.choices?.[0]?.message?.content || '').trim();
      }
      tried.push(data.error?.message || `HTTP ${response.status}`);
    } catch (error: any) {
      tried.push(error?.message || 'Network error');
    }
  }

  throw new Error(tried.slice(-2).join(' | ') || 'AI แกะรูปไม่สำเร็จ');
}

export function CharacterModule() {
  const [description, setDescription] = useState(DEFAULT_CHARACTER);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [uploadedImageName, setUploadedImageName] = useState('');
  const [uploadedImagePreview, setUploadedImagePreview] = useState('');
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageError, setImageError] = useState('');

  const promptBlocks = useMemo(
    () => (hasGenerated ? generateCharacterReferencePrompts(description) : []),
    [description, hasGenerated],
  );

  const allPrompts = promptBlocks.map(block => block.prompt).join('\n\n---\n\n');

  const handleGenerate = () => {
    setHasGenerated(true);
  };

  const handleImageUpload = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('กรุณาเลือกไฟล์รูปภาพ');
      return;
    }
    setIsAnalyzingImage(true);
    setImageError('');
    setUploadedImageName(file.name);
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setUploadedImagePreview(dataUrl);
      const analyzed = await describeCharacterFromImage(dataUrl);
      if (analyzed) {
        setDescription(analyzed);
        setHasGenerated(false);
      }
    } catch (error: any) {
      setImageError(error?.message || 'แกะลักษณะตัวละครจากรูปไม่สำเร็จ');
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  return (
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
      <div className="sa-panel p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
            <Wand2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="sa-title text-xl font-bold">Character Reference Creator</h2>
            <p className="sa-muted text-sm">Step 1: สร้าง prompt สำหรับ reference sheet</p>
          </div>
        </div>

        <label className="sa-label mt-6 block text-sm font-bold" htmlFor="character-description">
          Describe your character
        </label>
        <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-color)] bg-black/10 px-4 py-3 text-sm font-bold transition hover:border-[var(--accent)]">
          <ImagePlus className="h-4 w-4 text-[var(--accent)]" />
          {isAnalyzingImage ? 'กำลังแกะลักษณะจากรูป...' : 'อัปโหลดรูปตัวละครให้ AI แกะลักษณะ'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={event => {
              handleImageUpload(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </label>
        {uploadedImagePreview && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-black/10 p-3">
            <img src={uploadedImagePreview} alt="" className="h-16 w-16 rounded-lg object-cover" />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{uploadedImageName}</p>
              <p className="sa-muted text-xs">AI จะเติมลักษณะตัวละครลงช่องด้านล่าง</p>
            </div>
          </div>
        )}
        {imageError && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{imageError}</span>
          </div>
        )}
        <textarea
          id="character-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="sa-input mt-2 min-h-[180px] w-full resize-y p-4 text-sm leading-6"
          placeholder="เช่น เป็ดใส่เสื้อฮู้ดสีเทา หรือใส่หลายตัวละครแยกบรรทัด"
        />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] xl:grid-cols-1">
          <button
            type="button"
            onClick={handleGenerate}
            className="sa-primary-button"
          >
            <Sparkles className="h-4 w-4" />
            Generate Ref Sheet Prompt
          </button>
          <CopyButton text={allPrompts} label="Copy All" />
        </div>

        <div className="sa-note mt-5 p-4 text-sm leading-6">
          แยกตัวละครด้วยบรรทัดใหม่, semicolon, “และ”, “กับ” หรือ “and” เพื่อสร้าง prompt แยกชุด ลดการปนลักษณะตัวละครในภาพเดียวกัน
        </div>
      </div>

      <div className="sa-workspace min-h-[360px] p-4">
        {promptBlocks.length > 0 ? (
          <div className="space-y-4">
            {promptBlocks.map(block => <PromptCard key={block.id} block={block} />)}
          </div>
        ) : (
          <div className="sa-empty flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
            <Clipboard className="h-10 w-10 opacity-50" />
            <h3 className="sa-title mt-3 text-lg font-bold">Prompt output will appear here</h3>
            <p className="sa-muted mt-1 max-w-md text-sm leading-6">
              ใส่รายละเอียดตัวละคร แล้วกด Generate เพื่อสร้าง professional 3D technical model turnaround prompt
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
