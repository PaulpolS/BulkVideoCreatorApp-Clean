import React, { useMemo, useState } from 'react';
import { AlertCircle, Bot, Camera, Check, ClipboardList, Copy, Film, Play, ShieldCheck } from 'lucide-react';
import { getOpenRouterKeyCandidates } from '../hooks/useApiSettings';
import { buildStoryboardExportText, buildStoryboardScenes, StoryboardScene } from '../lib/prompt-engine';

const DEFAULT_CONTEXT = 'นิทานสั้นเกี่ยวกับตัวละครตัวเล็กที่อยากช่วยเพื่อนในวันที่ฝนตก แล้วได้เรียนรู้ว่าความใจดีทำให้โลกสว่างขึ้น';
const DEFAULT_MODEL = 'google/gemini-2.5-flash';

const AI_MODEL_OPTIONS = [
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { id: 'google/gemini-2.0-flash-lite-001', label: 'Gemini 2.0 Flash Lite' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
];

const STORYBOARD_MODEL_FALLBACKS = [
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.0-flash-lite-001',
  'openai/gpt-4o-mini',
  'google/gemini-2.5-flash',
];

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

function PromptField({ title, text, icon }: { title: string; text: string; icon: React.ReactNode }) {
  return (
    <div className="sa-output p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="sa-muted flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
          {icon}
          {title}
        </div>
        <CopyButton text={text} label="Copy" />
      </div>
      <p className="whitespace-pre-wrap text-sm leading-7">{text}</p>
    </div>
  );
}

function SceneCard({ scene }: { scene: StoryboardScene }) {
  return (
    <article className="sa-panel p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">Scene {scene.sceneNumber}</div>
          <h3 className="sa-title mt-1 text-lg font-bold">{scene.timecode} / 8 seconds</h3>
        </div>
        <CopyButton
          text={[
            scene.thaiScript,
            scene.imagePrompt,
            scene.videoMotionPrompt,
          ].join('\n\n')}
          label="Copy Scene"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <PromptField
          title="Thai Script / Dialogue"
          text={scene.thaiScript}
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <PromptField
          title="Video Motion Prompt"
          text={scene.videoMotionPrompt}
          icon={<Film className="h-4 w-4" />}
        />
        <PromptField
          title="Image Prompt"
          text={scene.imagePrompt}
          icon={<Camera className="h-4 w-4" />}
        />
      </div>
    </article>
  );
}

function BatchPromptPanel({
  text,
  title,
  description,
  icon,
  copyLabel,
}: {
  text: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  copyLabel: string;
}) {
  return (
    <div className="sa-panel p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="sa-muted flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
            {icon}
            {title}
          </div>
          <p className="sa-muted mt-1 text-xs">
            {description}
          </p>
        </div>
        <CopyButton text={text} label={copyLabel} />
      </div>
      <textarea
        readOnly
        value={text}
        className="sa-input min-h-[260px] w-full resize-y p-4 font-mono text-xs leading-6"
      />
    </div>
  );
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

function normalizeAiScenes(payload: unknown, sceneCount: number): StoryboardScene[] {
  const rawScenes = Array.isArray((payload as { scenes?: unknown[] })?.scenes)
    ? (payload as { scenes: unknown[] }).scenes
    : [];

  const scenes = rawScenes.map((item, index) => {
    const scene = item as Partial<StoryboardScene>;
    const sceneNumber = Number(scene.sceneNumber) || index + 1;
    const startSecond = (sceneNumber - 1) * 8;
    const endSecond = startSecond + 8;
    const legacyScene = scene as Partial<StoryboardScene> & {
      startImagePrompt?: string;
      endImagePrompt?: string;
    };

    return {
      id: `scene-${sceneNumber}`,
      sceneNumber,
      timecode: String(scene.timecode || `${startSecond}-${endSecond}s`),
      thaiScript: String(scene.thaiScript || '').trim(),
      imagePrompt: String(scene.imagePrompt || legacyScene.startImagePrompt || '').trim(),
      videoMotionPrompt: String(scene.videoMotionPrompt || '').trim(),
    };
  }).filter(scene =>
    scene.thaiScript &&
    scene.imagePrompt &&
    scene.videoMotionPrompt
  );

  if (scenes.length === 0) throw new Error('AI ตอบกลับมาแต่ไม่มี scene ที่ใช้ได้');
  return scenes.slice(0, sceneCount);
}

function buildAiStoryboardPrompt(storyContext: string, sceneCount: number) {
  return `คุณคือ AI Storyboard Architect สำหรับงาน Image-to-Video / Google Flow

โจทย์เรื่อง:
${storyContext}

สร้าง storyboard จำนวน ${sceneCount} scenes โดยแต่ละ scene ยาว 8 วินาที และ 1 scene ต้องมี:
- imagePrompt: prompt รูป 1 รูปสำหรับใช้เป็นภาพตั้งต้นของ scene นั้น
- videoMotionPrompt: prompt วีดีโอ 1 อันสำหรับ animate รูปนั้นเป็นเวลา 8 วินาที

กฎสำคัญมาก:
1. คิดเนื้อเรื่องจริงจากโจทย์ ไม่ใช้ข้อความ generic และห้ามวนแพทเทิร์นซ้ำ ๆ
2. thaiScript ต้องเป็นบท/คำบรรยายภาษาไทยที่เล่าเรื่องต่อเนื่อง มีเหตุการณ์เฉพาะของเรื่องนั้น
3. imagePrompt และ videoMotionPrompt ต้องเป็นภาษาอังกฤษ พร้อมนำไปใช้กับ image-to-video ได้ทันที
4. ห้ามบรรยายรูปลักษณ์ตัวละครโดยตรง เช่น เสื้อผ้า หน้า ผม รูปร่าง สายพันธุ์ อายุ สี ลักษณะกายวิภาค เพราะจะใช้ uploaded character reference image เป็นตัวคุม identity
5. ใช้คำว่า "the referenced character" เมื่อพูดถึงตัวละครหลัก
6. โฟกัส behavior, blocking, location, props, atmosphere, camera, action, physics, timing, continuity
7. imagePrompt ต้องเป็นภาพตั้งต้นที่ชัดเจนพอให้ videoMotionPrompt ขยับต่อได้ และต้องต่อเนื่องระหว่าง scene
8. ไม่มี text on screen, ไม่มี watermark, ไม่มี subtitle
9. ห้ามตอบ markdown ห้ามอธิบายเพิ่ม

ตอบกลับเป็น JSON เท่านั้น ตาม schema นี้:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "timecode": "0-8s",
      "thaiScript": "ฉากที่ 1: ...",
      "imagePrompt": "Scene 1 source image prompt for an 8-second image-to-video shot. ...",
      "videoMotionPrompt": "8-second image-to-video motion for Scene 1: ..."
    }
  ]
}`;
}

async function callOpenRouterStoryboard(storyContext: string, sceneCount: number, model: string) {
  const candidates = await getOpenRouterKeyCandidates();
  if (candidates.length === 0) throw new Error('ไม่พบ OpenRouter API Key — กรุณาตั้งค่า API Key ก่อน');

  const modelsToTry = Array.from(new Set([
    model,
    ...STORYBOARD_MODEL_FALLBACKS,
  ].filter(Boolean)));
  const prompt = buildAiStoryboardPrompt(storyContext, sceneCount);
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
            'X-Title': 'Bulk Video Creator - Storyboard Architect',
          },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: Math.min(5200, Math.max(1200, sceneCount * 430)),
            response_format: { type: 'json_object' },
          }),
        });
        const data = await response.json();
        if (response.ok && !data.error) {
          const content = data.choices?.[0]?.message?.content || '';
          return {
            model: modelId,
            scenes: normalizeAiScenes(extractJsonPayload(content), sceneCount),
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

  if (creditErrors > 0 && timeoutErrors > 0) {
    throw new Error('OpenRouter ใช้ไม่ได้ตอนนี้: API key บางตัวเครดิตหมด และโมเดล fallback บางตัว timeout ลองเติมเครดิตหรือเปลี่ยนโปรไฟล์ API Key แล้วกด Build with AI อีกครั้ง');
  }
  if (creditErrors > 0) {
    throw new Error('OpenRouter API key เครดิตไม่พอ กรุณาเติมเครดิตหรือเปลี่ยนโปรไฟล์ API Key');
  }
  if (timeoutErrors > 0) {
    throw new Error('OpenRouter/model timeout ชั่วคราว ลองกด Build with AI อีกครั้ง หรือเลือก Gemini 2.0 Flash Lite / GPT-4o mini');
  }

  throw new Error(triedErrors.slice(-2).join(' | ') || 'OpenRouter error');
}

export function StoryboardModule() {
  const [storyContext, setStoryContext] = useState(DEFAULT_CONTEXT);
  const [sceneCount, setSceneCount] = useState(6);
  const [hasBuilt, setHasBuilt] = useState(false);
  const [model, setModel] = useState(() => localStorage.getItem('storyboard_ai_model') || DEFAULT_MODEL);
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastModelUsed, setLastModelUsed] = useState('');

  const exportText = buildStoryboardExportText(scenes);
  const imageBatchText = scenes
    .map(scene => scene.imagePrompt)
    .join('\n\n');
  const videoBatchText = scenes
    .map(scene => scene.videoMotionPrompt)
    .join('\n\n');
  const normalizedSceneCount = useMemo(
    () => Math.min(Math.max(Math.round(sceneCount || 1), 1), 24),
    [sceneCount],
  );

  const handleModelChange = (nextModel: string) => {
    setModel(nextModel);
    localStorage.setItem('storyboard_ai_model', nextModel);
  };

  const handleBuild = async () => {
    if (!storyContext.trim()) {
      setErrorMsg('กรุณาใส่ Story Context ก่อน');
      return;
    }
    setIsGenerating(true);
    setErrorMsg('');
    setHasBuilt(false);
    try {
      const result = await callOpenRouterStoryboard(storyContext.trim(), normalizedSceneCount, model);
      setScenes(result.scenes);
      setLastModelUsed(result.model);
      setHasBuilt(true);
    } catch (error: any) {
      setScenes([]);
      setLastModelUsed('');
      setErrorMsg(error?.message || 'สร้าง storyboard ด้วย AI ไม่สำเร็จ');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTemplateFallback = () => {
    setScenes(buildStoryboardScenes(storyContext, normalizedSceneCount));
    setLastModelUsed('Template fallback');
    setErrorMsg('');
    setHasBuilt(true);
  };

  return (
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
      <div className="sa-panel p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
            <Film className="h-5 w-5" />
          </div>
          <div>
            <h2 className="sa-title text-xl font-bold">Storyboard Generator</h2>
            <p className="sa-muted text-sm">Step 2: สร้าง scene cards สำหรับ Image-to-Video</p>
          </div>
        </div>

        <label className="sa-label mt-6 block text-sm font-bold" htmlFor="story-context">
          Story Context
        </label>
        <textarea
          id="story-context"
          value={storyContext}
          onChange={(event) => setStoryContext(event.target.value)}
          className="sa-input mt-2 min-h-[220px] w-full resize-y p-4 text-sm leading-6"
          placeholder="เล่า context นิทานสั้นเป็นภาษาไทย"
        />

        <label className="sa-label mt-4 block text-sm font-bold" htmlFor="scene-count">
          Number of scenes
        </label>
        <input
          id="scene-count"
          type="number"
          min={1}
          max={24}
          value={sceneCount}
          onChange={(event) => setSceneCount(Number(event.target.value))}
          className="sa-input mt-2 h-11 w-full px-4 text-sm font-semibold"
        />

        <label className="sa-label mt-4 block text-sm font-bold" htmlFor="storyboard-model">
          AI Model
        </label>
        <select
          id="storyboard-model"
          value={model}
          onChange={(event) => handleModelChange(event.target.value)}
          className="sa-input mt-2 h-11 w-full px-4 text-sm font-semibold"
        >
          {AI_MODEL_OPTIONS.map(option => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] xl:grid-cols-1">
          <button
            type="button"
            onClick={handleBuild}
            disabled={isGenerating}
            className="sa-primary-button disabled:cursor-wait disabled:opacity-70"
          >
            {isGenerating ? <Bot className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
            {isGenerating ? 'AI is thinking...' : 'Build with AI'}
          </button>
          <CopyButton text={exportText} label="Copy All Scenes" />
        </div>

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

        {hasBuilt && lastModelUsed && (
          <div className="sa-ai-status mt-4 flex items-center gap-2 p-3 text-xs font-semibold">
            <Bot className="h-4 w-4" />
            Generated by {lastModelUsed}
          </div>
        )}

        <div className="sa-note mt-5 p-4 text-sm leading-6">
          <div className="mb-1 flex items-center gap-2 font-bold text-[var(--success)]">
            <ShieldCheck className="h-4 w-4" />
            Reference-safe prompt logic
          </div>
          Storyboard prompts จะใช้ reference image จากเครื่องมือภายนอกเป็นตัวกำหนดตัวละคร และห้ามเพิ่มรายละเอียดเสื้อผ้า หน้า ผม รูปร่าง หรือสีใน prompt ของแต่ละฉาก
        </div>
      </div>

      <div className="sa-workspace min-h-[420px] p-4">
        {scenes.length > 0 ? (
          <div className="space-y-4">
            <BatchPromptPanel
              text={imageBatchText}
              title="Batch Image Prompts"
              description="เรียง image prompt ฉากละ 1 อัน เว้นบรรทัดสำหรับส่ง batch"
              icon={<Camera className="h-4 w-4" />}
              copyLabel="Copy Image Batch"
            />
            <BatchPromptPanel
              text={videoBatchText}
              title="Batch Video Prompts"
              description="เรียง video prompt ฉากละ 1 อัน ตามลำดับรูปด้านบน"
              icon={<Film className="h-4 w-4" />}
              copyLabel="Copy Video Batch"
            />
            {scenes.map(scene => <SceneCard key={scene.id} scene={scene} />)}
          </div>
        ) : (
          <div className="sa-empty flex min-h-[380px] flex-col items-center justify-center p-8 text-center">
            <Film className="h-10 w-10 opacity-50" />
            <h3 className="sa-title mt-3 text-lg font-bold">Scene cards will appear here</h3>
            <p className="sa-muted mt-1 max-w-md text-sm leading-6">
              ใส่ context นิทานและจำนวนฉาก ระบบจะสร้าง card ละ 8 วินาที พร้อม image prompt และ video prompt
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
