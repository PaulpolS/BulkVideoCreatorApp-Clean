import React, { useState, useRef, useEffect } from 'react';
import { useCloneGallery, CloneStyle } from '../../hooks/useCloneGallery';
import { useHeadlinePacks, HeadlinePack } from '../../hooks/useHeadlinePacks';
import { useWritingStyles, WritingStyle } from '../../hooks/useWritingStyles';
import { globalTaskStore } from '../../hooks/useBackgroundTasks';

interface SavedBrain {
  id: string;
  name: string;
  content: string;
  timestamp: string;
  outputType?: string; // legacy, kept for backward compatibility with saved data
  shortAnalysis?: ShortClipAnalysis;
  sourceUrl?: string;
}

interface ShortClipReference {
  id: string;
  name: string;
  url: string;
  thumbnail?: string;
  note: string;
}

interface ShortClipElement {
  id: string;
  label: string;
  detail: string;
  checked: boolean;
}

interface ShortClipAnalysis {
  channelScore: number;
  blockRiskScore: number;
  creativityScore: number;
  summary: string;
  scenes: string[];
  cameraAngles: string[];
  mainCharacters: string[];
  openingPatterns: string[];
  thumbnailPatterns: string[];
  repetitionRisks: string[];
  creativeOpportunities: string[];
  promptBrain: string;
  elements: ShortClipElement[];
}

interface ShortClipReferenceSet {
  id: string;
  name: string;
  sourceUrl: string;
  coverLimit: number;
  clipLimit: number;
  coverImages: string[];
  clipRefs: ShortClipReference[];
  analysis?: ShortClipAnalysis | null;
  createdAt: string;
  updatedAt: string;
}

interface SoraModifier {
  id: string;
  label: string;
  value: string;
  desc: string;
}

const SIZE_PRESETS = [
  { id: '9:16',    label: '📱 9:16',     desc: 'Story/Reel' },
  { id: '1:1',     label: '⬛ 1:1',     desc: 'Square Post' },
  { id: '4:5',     label: '📷 4:5',     desc: 'Instagram' },
  { id: '16:9',    label: '🖥️ 16:9',    desc: 'Landscape' },
  { id: '1.91:1',  label: '📘 1.91:1',  desc: 'Facebook' },
];

const CINEMATIC_FILTERS = [
  "Moody Blue/Cyan cinematic tone",
  "Warm Amber and Gold lighting",
  "Teal and Orange cinematic color grading",
  "Desaturated Matrix-style green undertone",
  "Vibrant Cyberpunk neon lighting (pink/purple/blue)",
  "Vintage film look with sepia wash and heavy grain",
  "High-contrast monochromatic with stark shadows",
  "Cool steel-grey and icy blue grading",
  "Rich crimson red and deep contrasting blacks",
  "Soft pastel cinematic wash with glowing highlights"
];

const TEXT_MODELS = [
  { id: 'openai/gpt-4o', label: 'GPT-4o (ฉลาดสุด, ภาษาธรรมชาติ)' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (เร็ว, ประหยัด)' },
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6 (เซียนภาษาไทย)' },
  { id: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku (เร็ว, คุยเก่ง)' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (เร็วมาก)' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (วิเคราะห์ลึก)' },
  { id: 'minimax/minimax-m2.7', label: 'MiniMax M2.7 (เก่งฝั่งเอเชีย)' },
  { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B (Open Source ตัวตึง)' }
];

const SORA_MODIFIERS: SoraModifier[] = [
  { id: 'raw', label: '1. Raw Footage', value: 'Raw unedited amateur footage, mundane everyday recording, zero cinematic post-processing', desc: 'ลบความเนี๊ยบ CGI ให้เหมือนคลิปจริง' },
  { id: 'lens', label: '2. Auto-Focus Hunting', value: 'slightly out of focus, aggressive auto-focus hunting algorithm struggling to lock onto subject', desc: 'โฟกัสวืดไปมาแบบกล้องจริง' },
  { id: 'light', label: '3. Harsh Natural Light', value: 'badly lit, harsh overexposed natural lighting, blown out highlights, completely flat shadows', desc: 'แสงธรรมชาติไม่เป๊ะเกินจริง' },
  { id: 'sensor', label: '4. Dead Pixels', value: 'damaged digital sensor, random dead purple and green pixels scattered organically, digital artifacting', desc: 'พิกเซลแตก/เซนเซอร์มีตำหนิ' },
  { id: 'shake', label: '5. Shaky Panic', value: 'unpredictable shaky hands, non-stabilized erratic camera movement, sudden panicked whipping pan', desc: 'กล้องมือถือสั่นและแพนกระชาก' },
  { id: 'shutter', label: '6. Jello Effect', value: 'extreme rolling shutter effect, physical jello artifact during fast movements', desc: 'ภาพย้วยเวลาขยับเร็ว' },
  { id: 'dirty', label: '7. Dirty Lens', value: 'thick layer of dust and smudges on the camera lens, micro scratches catching the light irregularly', desc: 'เลนส์มีฝุ่น รอยนิ้วมือ รอยขีด' },
  { id: 'water', label: '8. Droplets', value: 'multiple blurry water droplets directly on the camera lens heavily refracting the background', desc: 'หยดน้ำบนเลนส์ทำให้ภาพบิด' },
  { id: 'cctv', label: '9. CCTV Bitrate Drop', value: 'security camera footage, aggressive h264 compression artifacts, heavy macro-blocking when subject moves fast', desc: 'บิตเรตตก มีบล็อค compression' },
  { id: 'iso', label: '10. Extreme ISO Noise', value: 'shot in near total darkness, ridiculously high ISO setting, aggressive colorful digital noise grain', desc: 'นอยส์หยาบเหมือนถ่ายแสงน้อย' },
  { id: 'flare', label: '11. Cheap Lens Flare', value: 'cheap uncoated plastic lens flare, massive ugly light leak from the side of the frame', desc: 'แฟลร์และแสงรั่วแบบเลนส์ถูก' },
  { id: 'fps', label: '12. Dropped Frames', value: 'inconsistent frame pacing, stuttering framerate momentarily dropping to 12fps during heavy action', desc: 'เฟรมตก/ภาพกระตุกเป็นช่วง' },
  { id: 'dashcam', label: '13. Dirty Windshield', value: 'dashcam perspective shot perfectly through a filthy cracked windshield, dashboard glare reflection on glass', desc: 'มุมกล้องหน้ารถผ่านกระจกสกปรก' },
  { id: 'vhs', label: '14. Analog Tracking', value: 'found footage style analog tracking lines rolling organically up the screen, sudden color degradation', desc: 'เส้นเทป/สีเพี้ยนแบบ found footage' },
  { id: 'flash', label: '15. Phone Flashlight', value: 'lit entirely by a single weak smartphone LED flash, sharp harsh shadow dropoff behind subject, heavy vignetting', desc: 'แสงไฟฉายมือถือแข็งและตกเร็ว' },
];

// ─── CSV download helper ────────────────────────────────────────────
function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Parse CSV text ────────────────────────────────────────────
function parseCSVColumn(text: string, colIndex = 0): string[] {
  const lines = text.trim().split('\n').slice(1); // skip header
  return lines
    .map(l => {
      const parts = l.split(',');
      const val = parts[colIndex]?.trim().replace(/^"|"$/g, '') || '';
      return val;
    })
    .filter(Boolean);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function extractVideoFrame(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(1, Math.max(0, (video.duration || 1) * 0.08));
      } catch {
        video.currentTime = 0;
      }
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 1280;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Cannot read video frame');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('อ่านไฟล์วิดีโอไม่ได้'));
    };
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function imageSourceToJpegDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 720;
        canvas.height = img.naturalHeight || img.height || 1280;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Cannot draw image');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Cannot decode image'));
    img.src = src;
  });
}

async function normalizeVisionImageUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:image/')) {
    if (/^data:image\/(jpeg|png|webp);base64,/i.test(url)) return url;
    try {
      return await imageSourceToJpegDataUrl(url);
    } catch (err) {
      console.warn('Failed to convert data image for vision', err);
      return null;
    }
  }
  const isRemote = /^https?:\/\//i.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(url);
  if (isRemote) return url;
  let objectUrl = '';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`โหลดรูปไม่ได้ (${res.status})`);
    const blob = await res.blob();
    const looksLikeImageFile = /\.(jpe?g|png|webp|gif|svg)(\?|#|$)/i.test(url);
    if (blob.type && !blob.type.startsWith('image/') && blob.type !== 'application/octet-stream' && !looksLikeImageFile) {
      throw new Error(`ไฟล์นี้ไม่ใช่รูปภาพ (${blob.type})`);
    }
    const imageBlob = blob.type?.startsWith('image/') ? blob : new Blob([blob], { type: 'image/jpeg' });
    objectUrl = URL.createObjectURL(imageBlob);
    return await imageSourceToJpegDataUrl(objectUrl);
  } catch (err) {
    console.warn('Failed to normalize image for vision', url, err);
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export function CloneTab() {
  const { gallery, saveStyle, deleteStyle } = useCloneGallery();
  const { packs: headlinePacks, savePack: saveHeadlinePack, updatePack: updateHeadlinePack, deletePack: deleteHeadlinePack, persist: persistHeadlinePacks } = useHeadlinePacks();
  const { styles: writingStyles, saveStyle: saveWritingStyleHook, updateStyle: updateWritingStyleHook, deleteStyle: deleteWritingStyleHook, persist: persistWritingStyles } = useWritingStyles();

  // ── Section 1: Image Clone ──────────────────────────────────────
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [extractedPromptBase, setExtractedPromptBase] = useState<string>('');
  const [extractedTraits, setExtractedTraits] = useState<{text: string; checked: boolean}[]>([]);
  const [extractedLayout, setExtractedLayout] = useState<string>('single'); // AI-detected layout
  const [extractedPromptGuide, setExtractedPromptGuide] = useState<string>(''); // AI-generated prompt guide
  const [isSavingWithGuide, setIsSavingWithGuide] = useState(false); // saving + generating guide
  const [promptCount, setPromptCount] = useState<number | string>(5);
  const [promptMode, setPromptMode] = useState<'random'|'custom'>('random');
  const [customCaptions, setCustomCaptions] = useState<string[]>(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('ai_page_brain_mindsets_array') || '[]');
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch(e) {}
    const old = localStorage.getItem('ai_page_brain_mindset');
    return old ? [old] : [''];
  });
  useEffect(() => {
    localStorage.setItem('ai_page_brain_mindsets_array', JSON.stringify(customCaptions));
  }, [customCaptions]);

  const [newPageName, setNewPageName] = useState<string>('');
  const [watermarkPosition, setWatermarkPosition] = useState<string>('random');
  const [selectedKieModel, setSelectedKieModel] = useState<string>('google/nanobanana2');
  const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([]);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<{ id: string, url: string, prompt: string }[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [diversityLevel, setDiversityLevel] = useState<number>(0);
  const [randomNoQuoteCount, setRandomNoQuoteCount] = useState<number | string>(5);
  const [isGeneratingRandomNoQuote, setIsGeneratingRandomNoQuote] = useState(false);
  const [diversityPresets, setDiversityPresets] = useState<{label: string; instruction: string}[]>([]);
  const [diversityPresetsLoading, setDiversityPresetsLoading] = useState(false);
  const lastDiversityBaseRef = useRef<string>('');

  // ── Section 1.5: Short Clip Structure Clone ─────────────────────
  const [shortCoverImages, setShortCoverImages] = useState<string[]>([]);
  const [shortMasterLink, setShortMasterLink] = useState('');
  const [shortReferenceSetName, setShortReferenceSetName] = useState('');
  const [shortReferenceSets, setShortReferenceSets] = useState<ShortClipReferenceSet[]>([]);
  const [shortBatchLoading, setShortBatchLoading] = useState(false);
  const [shortCoverLink, setShortCoverLink] = useState('');
  const [shortCoverLimit, setShortCoverLimit] = useState<number | string>(30);
  const [shortCoverFetching, setShortCoverFetching] = useState(false);
  const [shortCoverCollapsed, setShortCoverCollapsed] = useState(false);
  const [shortClipRefs, setShortClipRefs] = useState<ShortClipReference[]>([]);
  const [shortClipLink, setShortClipLink] = useState('');
  const [shortLatestCount, setShortLatestCount] = useState<number | string>(5);
  const [shortDownloading, setShortDownloading] = useState<'single' | 'latest' | null>(null);
  const [shortAnalysisName, setShortAnalysisName] = useState('');
  const [shortAnalysis, setShortAnalysis] = useState<ShortClipAnalysis | null>(null);
  const [shortAnalyzing, setShortAnalyzing] = useState(false);
  const [shortSavingBrain, setShortSavingBrain] = useState(false);
  const [shortPromptCount, setShortPromptCount] = useState<number | string>(5);
  const [shortPromptMode, setShortPromptMode] = useState<'random' | 'storyboard'>('random');
  const [shortStoryboardSceneCount, setShortStoryboardSceneCount] = useState<number | string>(4);
  const [shortGeneratingPrompts, setShortGeneratingPrompts] = useState(false);
  const [shortGeneratedPrompts, setShortGeneratedPrompts] = useState<string[]>([]);
  const [shortFixCharacters, setShortFixCharacters] = useState(false);
  const [shortSoraMode, setShortSoraMode] = useState(true);
  const [shortActiveSoraMods, setShortActiveSoraMods] = useState<string[]>(['raw', 'lens', 'shake', 'light']);
  const [shortNewCharacter, setShortNewCharacter] = useState('');
  const [shortCharacterImages, setShortCharacterImages] = useState<string[]>([]);
  const [shortCharacterNotes, setShortCharacterNotes] = useState<string[]>([]);
  const shortCoverInputRef = useRef<HTMLInputElement>(null);
  const shortVideoInputRef = useRef<HTMLInputElement>(null);
  const shortCharacterInputRef = useRef<HTMLInputElement>(null);
  const shortWorkspaceLoadedRef = useRef(false);

  // ── Section 3: Headline & Writing Style Studio ──────────────────
  const [hlNewPackName, setHlNewPackName] = useState('');
  const [hlPasteText, setHlPasteText] = useState('');
  const [hlIsAnalyzing, setHlIsAnalyzing] = useState(false);
  const [hlAnalyzedResult, setHlAnalyzedResult] = useState('');
  const [wsNewName, setWsNewName] = useState('');
  const [wsPasteText, setWsPasteText] = useState('');
  const [wsIsAnalyzing, setWsIsAnalyzing] = useState(false);
  const [wsAnalyzedResult, setWsAnalyzedResult] = useState('');
  const hlCsvInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const brainCsvInputRef = useRef<HTMLInputElement>(null);

  // ── Section 2: Brain Studio ─────────────────────────────────────
  const [generatedSystemPrompt, setGeneratedSystemPrompt] = useState<string>('');
  const [isGeneratingSystemPrompt, setIsGeneratingSystemPrompt] = useState(false);
  const [savedBrains, setSavedBrains] = useState<SavedBrain[]>([]);
  // Save Brain Modal state
  const [showSaveBrainModal, setShowSaveBrainModal] = useState(false);
  const [saveBrainName, setSaveBrainName] = useState('');

  useEffect(() => {
    fetch('/api/get-app-data?key=brains')
      .then(res => res.json())
      .then((data: SavedBrain[]) => {
        const localSaved = localStorage.getItem('system_prompts_brain');
        let localData: SavedBrain[] = [];
        try { if (localSaved) localData = JSON.parse(localSaved); } catch(e) {}
        
        // MIGRATION LOGIC: Backend empty, localStorage has data
        if (data.length === 0 && localData.length > 0) {
          console.log('Migrating brains from localStorage to backend...');
          setSavedBrains(localData);
          fetch('/api/save-app-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'brains', data: localData })
          });
        } else {
          setSavedBrains(data);
          localStorage.setItem('system_prompts_brain', JSON.stringify(data));
        }
      })
      .catch(err => {
        console.error('Failed to load brains from backend', err);
        const saved = localStorage.getItem('system_prompts_brain');
        if (saved) { try { setSavedBrains(JSON.parse(saved)); } catch (e) {} }
      });
  }, []);

  const refreshSavedBrains = () => {
    // Rely on state. For a full sync, we could fetch again, but the state is the source of truth here.
  };

  const deleteSavedBrain = (id: string, name: string) => {
    if (!confirm(`🗑️ ยืนยันลบสมอง "${name}" ใช่ไหม?`)) return;
    setSavedBrains(prev => {
      const updated = prev.filter(b => b.id !== id);
      localStorage.setItem('system_prompts_brain', JSON.stringify(updated));
      fetch('/api/save-app-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'brains', data: updated })
      }).catch(console.error);
      return updated;
    });
  };

  const handleSaveBrain = () => {
    if (!saveBrainName.trim()) return alert('กรุณาตั้งชื่อสมองก่อนครับ');
    try {
      setSavedBrains(prev => {
        const saved = [...prev];
        const idx = saved.findIndex((s: SavedBrain) => s.name === saveBrainName.trim());
        const newBrain: SavedBrain = {
          id: Date.now().toString(),
          name: saveBrainName.trim(),
          content: generatedSystemPrompt,
          timestamp: new Date().toISOString(),
        };
        if (idx >= 0) saved[idx] = newBrain; else saved.push(newBrain);
        
        localStorage.setItem('system_prompts_brain', JSON.stringify(saved));
        fetch('/api/save-app-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'brains', data: saved })
        }).catch(console.error);
        
        return saved;
      });
      setShowSaveBrainModal(false);
      setSaveBrainName('');
      alert(`✅ บันทึกสมอง "${saveBrainName.trim()}" สำเร็จ! ถ่ายโอนลงไฟล์เรียบร้อย`);
    } catch { alert('Error saving brain'); }
  };
  // ── Brain Generate Captions/Topics ────────────────────────────────
  const [brainGenerating, setBrainGenerating] = useState<string | null>(null); // brain.id
  const [brainGenResults, setBrainGenResults] = useState<Record<string, string[]>>({}); // brain.id → results[]
  const [brainGenProgress, setBrainGenProgress] = useState<Record<string, string>>({}); // brain.id → progress string
  const [brainGenCount, setBrainGenCount] = useState<number | string>(8); // จำนวนแคปชั่น/หัวข้อที่ต้องการ
  const abortBrainRef = useRef(false);

  const generateFromBrain = async (brain: SavedBrain, count = brainGenCount) => {
    const { openRouterKey } = getApiKeys();
    if (!openRouterKey) return alert('กรุณาใส่ OpenRouter API Key ในแท็บตั้งค่าก่อนครับ');
    setBrainGenerating(brain.id);
    setBrainGenResults(prev => ({ ...prev, [brain.id]: [] }));
    setBrainGenProgress(prev => ({ ...prev, [brain.id]: `0/${Number(count) || 8}` }));
    abortBrainRef.current = false;
    try {
      const systemPrompt = brain.content;
      const numCount = Number(count) || 8;
      const BATCH_SIZE = 10;
      let totalGenerated = 0;
      let allLines: string[] = [];

      while (totalGenerated < numCount) {
        if (abortBrainRef.current) break;
        const toGen = Math.min(BATCH_SIZE, numCount - totalGenerated);
        setBrainGenProgress(prev => ({ ...prev, [brain.id]: `${totalGenerated}/${numCount}` }));

        const userMsg = `จาก System Prompt ข้างล่างนี้ โปรดเขียนคำคม/แคปชั่นภาษาไทยเพจนี้ จำนวน ${toGen} ประโยค

**กฎเหล็กสำหรับการเขียนภาษาไทย (CRITICAL):**
1. เขียนให้เหมือน "คนไทยพิมพ์ลง Facebook จริงๆ" ใช้ภาษาพูด ภาษาสแลง หรือภาษาที่เข้าถึงง่าย
2. ห้ามใช้คำเปรียบเปรยหลงยุค หรือแปลตรงตัวจากภาษาอังกฤษเด็ดขาด (เช่น ห้ามใช้คำว่า "ราวกับไม่มีพรุ่งนี้", "เต้นรำไปกับ...", "รอยยิ้มที่ส่องสว่าง")
3. ภาษาต้องไม่ประดิษฐ์ ไม่ลิเก ไม่ดูเป็นทางการเกินไป ขอแบบเรียลๆ โดนใจคนอ่าน
4. ส่งรายการผลลัพธ์เป็นแค่คำคมล้วนๆ ทีละบรรทัด ไม่ต้องมีตัวเลขนำหน้า ไม่ต้องมี Hashtag ไม่ต้องอธิบาย`;

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedTextModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMsg }
            ]
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        const raw = data.choices[0].message.content.trim();
        const lines = raw.split('\n')
          .map((l: string) => l.replace(/^[\d]+[.\)\-]\s*/, '').replace(/^[•-] /, '').trim())
          .filter((l: string) => l.length > 3);
        
        allLines = [...allLines, ...lines];
        setBrainGenResults(prev => ({ ...prev, [brain.id]: allLines }));
        totalGenerated += lines.length === 0 ? toGen : lines.length; // fallback increment
      }
      setBrainGenProgress(prev => ({ ...prev, [brain.id]: `${totalGenerated}/${numCount}` }));
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setBrainGenerating(null);
      setBrainGenProgress(prev => { const newP = {...prev}; delete newP[brain.id]; return newP; });
    }
  };

  const section4Ref = useRef<HTMLDivElement>(null);
  const [s4SelectedStyleId, setS4SelectedStyleId] = useState<string>(''); // gallery style (ลายเส้น)
  // s4OutputType removed — system auto-detects from traits
  const [s4SizePreset, setS4SizePreset] = useState<string>('9:16');
  const [s4PageName, setS4PageName] = useState<string>(''); // ชื่อเพจ/ลายน้ำ
  const [s4WatermarkSize, setS4WatermarkSize] = useState<string>('small');
  const [s4WatermarkPos, setS4WatermarkPos] = useState<string>('bottom-right');
  const [s4InputMode, setS4InputMode] = useState<'paste'|'csv'>('paste');
  const [s4PasteText, setS4PasteText] = useState<string>('');
  const [s4CsvData, setS4CsvData] = useState<string[]>([]);
  const [s4GeneratedPrompts, setS4GeneratedPrompts] = useState<string[]>([]);
  const [s4IsGenerating, setS4IsGenerating] = useState(false);
  const [s4ProgressText, setS4ProgressText] = useState('');
  const abortS4Ref = useRef(false);
  const [s4StrictThai, setS4StrictThai] = useState(true);
  const [s4EnableRandomFilter, setS4EnableRandomFilter] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedTextModel, setSelectedTextModel] = useState<string>('openai/gpt-4o');

  // ลายเส้น = gallery item (base image prompt)
  const currentStyleFallback = extractedPromptBase ? { id: '__current__', prompt: extractedPromptBase, imageUrl: uploadedImages[0] || '', traits: extractedTraits.filter(t => t.checked).map(t => t.text), layout: extractedLayout, createdAt: 0 } : null;
  const s4Style = s4SelectedStyleId === '__current__'
    ? currentStyleFallback
    : (gallery.find(g => g.id === s4SelectedStyleId) || null);
  const s4BasePrompt = s4Style?.prompt || '';

  // Auto-generate diversity presets when style changes
  React.useEffect(() => {
    if (s4BasePrompt && s4BasePrompt !== lastDiversityBaseRef.current) {
      generateDiversityPresets(s4BasePrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s4BasePrompt]);

  useEffect(() => {
    fetch('/api/get-app-data?key=short_clip_structure_workspace')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          if (Array.isArray(data.shortCoverImages)) setShortCoverImages(data.shortCoverImages);
          if (Array.isArray(data.shortClipRefs)) setShortClipRefs(data.shortClipRefs);
          if (Array.isArray(data.shortCharacterImages)) setShortCharacterImages(data.shortCharacterImages);
          if (Array.isArray(data.shortCharacterNotes)) setShortCharacterNotes(data.shortCharacterNotes);
          if (typeof data.shortMasterLink === 'string') setShortMasterLink(data.shortMasterLink);
          if (typeof data.shortReferenceSetName === 'string') setShortReferenceSetName(data.shortReferenceSetName);
          if (typeof data.shortCoverLink === 'string') setShortCoverLink(data.shortCoverLink);
          if (typeof data.shortClipLink === 'string') setShortClipLink(data.shortClipLink);
          if (typeof data.shortAnalysisName === 'string') setShortAnalysisName(data.shortAnalysisName);
          if (typeof data.shortNewCharacter === 'string') setShortNewCharacter(data.shortNewCharacter);
          if (typeof data.shortFixCharacters === 'boolean') setShortFixCharacters(data.shortFixCharacters);
          if (typeof data.shortSoraMode === 'boolean') setShortSoraMode(data.shortSoraMode);
          if (Array.isArray(data.shortActiveSoraMods)) setShortActiveSoraMods(data.shortActiveSoraMods);
          if (data.shortAnalysis) setShortAnalysis(data.shortAnalysis);
          if (Array.isArray(data.shortGeneratedPrompts)) setShortGeneratedPrompts(data.shortGeneratedPrompts);
          if (data.shortPromptMode === 'random' || data.shortPromptMode === 'storyboard') setShortPromptMode(data.shortPromptMode);
          if (typeof data.shortStoryboardSceneCount === 'number' || typeof data.shortStoryboardSceneCount === 'string') setShortStoryboardSceneCount(data.shortStoryboardSceneCount);
        }
      })
      .catch(console.error)
      .finally(() => { shortWorkspaceLoadedRef.current = true; });

    fetch('/api/get-app-data?key=short_clip_reference_sets')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setShortReferenceSets(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!shortWorkspaceLoadedRef.current) return;
    const timer = setTimeout(() => {
      fetch('/api/save-app-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'short_clip_structure_workspace',
          data: {
            shortCoverImages,
            shortClipRefs,
            shortCharacterImages,
            shortCharacterNotes,
            shortMasterLink,
            shortReferenceSetName,
            shortCoverLink,
            shortClipLink,
            shortAnalysisName,
            shortNewCharacter,
            shortFixCharacters,
            shortSoraMode,
            shortActiveSoraMods,
            shortAnalysis,
            shortGeneratedPrompts,
            shortPromptMode,
            shortStoryboardSceneCount,
            updatedAt: new Date().toISOString(),
          }
        })
      }).catch(console.error);
    }, 600);
    return () => clearTimeout(timer);
  }, [shortCoverImages, shortClipRefs, shortCharacterImages, shortCharacterNotes, shortMasterLink, shortReferenceSetName, shortCoverLink, shortClipLink, shortAnalysisName, shortNewCharacter, shortFixCharacters, shortSoraMode, shortActiveSoraMods, shortAnalysis, shortGeneratedPrompts, shortPromptMode, shortStoryboardSceneCount]);

  // Load traits + layout + guide from selected gallery style
  React.useEffect(() => {
    if (s4SelectedStyleId && s4SelectedStyleId !== '__current__') {
      const style = gallery.find(g => g.id === s4SelectedStyleId);
      if (style?.traits && style.traits.length > 0) {
        setExtractedTraits(style.traits.map(t => ({ text: t, checked: true })));
      }
      if (style?.layout) {
        setExtractedLayout(style.layout);
      }
      if (style?.promptGuide) {
        setExtractedPromptGuide(style.promptGuide);
      } else {
        setExtractedPromptGuide('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s4SelectedStyleId]);

  const getApiKeys = () => {
    let kieApiKey = '';
    try {
      const profiles = JSON.parse(localStorage.getItem('api_key_profiles') || '[]');
      const targetId = localStorage.getItem('selected_api_key_id');
      kieApiKey = profiles.find((p: any) => p.id === targetId)?.key || profiles[0]?.key || '';
    } catch(e) {}
    let openRouterKey = '';
    try {
      const keys = JSON.parse(localStorage.getItem('openrouter_keys') || '[]');
      openRouterKey = keys.find((k: any) => k.isActive)?.key || keys[0]?.key || localStorage.getItem('openrouter_key') || '';
    } catch(e) {}
    return { kieApiKey, openRouterKey };
  };

  const getActiveApifyKey = async (): Promise<string> => {
    try {
      const res = await fetch('/api/get-app-data?key=api_profiles');
      const profiles = await res.json();
      if (Array.isArray(profiles) && profiles.length > 0) {
        const activeId = localStorage.getItem('api_global_active_id') || profiles[0].id;
        const activeProfile = profiles.find((p: any) => p.id === activeId) || profiles[0];
        return activeProfile.apifyKey || '';
      }
    } catch(e) {
      console.error('Failed to load active Apify key', e);
    }
    try {
      const profiles = JSON.parse(localStorage.getItem('api_global_profiles') || '[]');
      const activeId = localStorage.getItem('api_global_active_id') || profiles[0]?.id;
      const activeProfile = profiles.find((p: any) => p.id === activeId) || profiles[0];
      return activeProfile?.apifyKey || '';
    } catch(e) {}
    return '';
  };

  const saveShortAsset = async (base64Data: string, prefix: string) => {
    const res = await fetch('/api/short-asset-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, prefix }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Save asset failed');
    return data.localPath as string;
  };

  const persistShortReferenceSets = (sets: ShortClipReferenceSet[]) => {
    fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'short_clip_reference_sets', data: sets }),
    }).catch(console.error);
  };

  const loadShortReferenceSet = (set: ShortClipReferenceSet) => {
    setShortMasterLink(set.sourceUrl || '');
    setShortCoverLink(set.sourceUrl || '');
    setShortClipLink(set.sourceUrl || '');
    setShortCoverLimit(set.coverLimit || 30);
    setShortLatestCount(set.clipLimit || 5);
    setShortCoverImages(set.coverImages || []);
    setShortClipRefs(set.clipRefs || []);
    setShortAnalysis(set.analysis || null);
    setShortAnalysisName(set.name || '');
    setShortReferenceSetName(set.name || '');
    setShortGeneratedPrompts([]);
    globalTaskStore.addTask({
      id: `clone_short_load_set_${Date.now()}`,
      title: `โหลดชุดอ้างอิง: ${set.name}`,
      category: 'clone',
      progress: `พร้อมใช้ ${set.coverImages?.length || 0} ปก และ ${set.clipRefs?.length || 0} คลิป โดยยังเปลี่ยนตัวละครใหม่ได้`,
      status: 'completed',
    });
  };

  const saveCurrentShortReferenceSet = () => {
    if (shortCoverImages.length === 0 && shortClipRefs.length === 0) {
      return alert('ต้องมีรูปปกหรือคลิปที่โหลดมาก่อน ถึงจะบันทึกเป็นชุดอ้างอิงได้ครับ');
    }
    const name = shortReferenceSetName.trim() || shortAnalysisName.trim() || `ชุดอ้างอิง ${new Date().toLocaleString('th-TH')}`;
    const sourceUrl = shortMasterLink.trim() || shortCoverLink.trim() || shortClipLink.trim();
    const now = new Date().toISOString();
    const item: ShortClipReferenceSet = {
      id: name.toLowerCase(),
      name,
      sourceUrl,
      coverLimit: Math.max(1, Math.min(120, Number(shortCoverLimit) || shortCoverImages.length || 30)),
      clipLimit: Math.max(1, Math.min(30, Number(shortLatestCount) || shortClipRefs.length || 5)),
      coverImages: shortCoverImages,
      clipRefs: shortClipRefs,
      analysis: shortAnalysis,
      createdAt: now,
      updatedAt: now,
    };
    setShortReferenceSets(prev => {
      const existing = prev.find(s => s.name.trim().toLowerCase() === name.toLowerCase());
      const updatedItem = existing ? { ...item, id: existing.id, createdAt: existing.createdAt, updatedAt: now } : { ...item, id: `${Date.now()}_${Math.random().toString(36).slice(2)}` };
      const next = existing ? prev.map(s => s.id === existing.id ? updatedItem : s) : [updatedItem, ...prev];
      persistShortReferenceSets(next);
      return next;
    });
    globalTaskStore.addTask({
      id: `clone_short_save_set_${Date.now()}`,
      title: `บันทึกชุดอ้างอิง: ${name}`,
      category: 'clone',
      progress: `เก็บ ${shortCoverImages.length} ปก และ ${shortClipRefs.length} คลิปไว้ใช้ซ้ำแล้ว`,
      status: 'completed',
    });
  };

  const deleteShortReferenceSet = (id: string, name: string) => {
    if (!confirm(`ลบชุดอ้างอิง "${name}" ใช่ไหม? ไฟล์ที่เคยดึงไว้จะยังอยู่ใน app_data แต่ชุดนี้จะหายจากรายการ`)) return;
    setShortReferenceSets(prev => {
      const next = prev.filter(set => set.id !== id);
      persistShortReferenceSets(next);
      return next;
    });
  };

  const loadShortReferenceBundle = async () => {
    const url = shortMasterLink.trim();
    if (!url) return alert('ใส่ลิงก์ช่อง/โปรไฟล์หลักก่อนครับ');
    const coverLimit = Math.max(1, Math.min(120, Number(shortCoverLimit) || 30));
    const clipLimit = Math.max(1, Math.min(30, Number(shortLatestCount) || 5));
    const taskId = `clone_short_bundle_${Date.now()}`;
    setShortBatchLoading(true);
    setShortCoverFetching(true);
    setShortDownloading('latest');
    setShortCoverLink(url);
    setShortClipLink(url);
    globalTaskStore.addTask({
      id: taskId,
      title: `โหลดชุดอ้างอิง ${coverLimit} ปก + ${clipLimit} คลิปล่าสุด`,
      category: 'clone',
      progress: 'กำลังดึงรูปปกจากลิงก์หลัก...',
      status: 'running',
    });

    try {
      const apifyKey = await getActiveApifyKey();
      const coverRes = await fetch('/api/short-cover-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, limit: coverLimit, apifyKey }),
      });
      const coverData = await coverRes.json();
      if (!coverData.success) throw new Error(coverData.error || 'Fetch covers failed');
      const images = (coverData.covers || []).map((cover: any) => cover.imageUrl).filter(Boolean);
      setShortCoverImages(Array.from(new Set(images)).slice(0, 120));

      globalTaskStore.updateTask(taskId, { progress: `ดึงรูปปกสำเร็จ ${images.length} รูป กำลังโหลดคลิปล่าสุด...` });
      const clipRes = await fetch('/api/short-clip-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode: 'latest', limit: clipLimit, apifyKey }),
      });
      const clipData = await clipRes.json();
      if (!clipData.success) throw new Error(clipData.error || 'Download clips failed');
      const refs: ShortClipReference[] = (clipData.clips || []).map((clip: any) => ({
        id: clip.id || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: clip.name || 'Downloaded clip',
        url: clip.url,
        thumbnail: clip.thumbnail || '',
        note: clip.sourceUrl ? `ดาวน์โหลดจาก: ${clip.sourceUrl}` : '',
      }));
      setShortClipRefs(refs.slice(0, 30));
      if (!shortReferenceSetName.trim()) {
        setShortReferenceSetName(url.replace(/^https?:\/\//, '').replace(/[/?#].*$/, '').slice(0, 50) || 'ชุดอ้างอิงคลิปสั้น');
      }
      globalTaskStore.updateTask(taskId, { progress: `โหลดชุดอ้างอิงสำเร็จ ${images.length} ปก และ ${refs.length} คลิป`, status: 'completed' });
    } catch (e: any) {
      globalTaskStore.updateTask(taskId, { progress: `โหลดชุดอ้างอิงล้มเหลว: ${e.message}`, status: 'error' });
      alert('โหลดชุดอ้างอิงล้มเหลว: ' + e.message);
    } finally {
      setShortBatchLoading(false);
      setShortCoverFetching(false);
      setShortDownloading(null);
    }
  };

  // ── Generate Prompt Guide & Save ──────────────────────────────────
  const generateAndSaveWithGuide = async () => {
    if (!extractedPromptBase) return;
    const { openRouterKey } = getApiKeys();
    if (!openRouterKey) return alert('กรุณาใส่ OpenRouter API Key ในแท็บตั้งค่าก่อนครับ');
    setIsSavingWithGuide(true);
    setLogs(prev => [...prev, '[📖] กำลังสร้างคู่มือ Prompt Guide สำหรับสไตล์นี้...']);

    const checkedTraits = extractedTraits.filter(t => t.checked).map(t => t.text);
    
    try {
      const guidePrompt = `คุณเป็นผู้เชี่ยวชาญด้าน AI Image Prompt Engineering มีหน้าที่เขียน "คู่มือการเขียน Prompt" สำหรับรูปแบบนี้โดยเฉพาะ

คู่มือนี้จะถูกใช้โดย AI ตัวอื่นที่จะสร้าง Prompt ใหม่ในสไตล์นี้ ดังนั้นต้องเขียนให้ชัดเจน ครบถ้วน และไม่คลุมเครือ

━━ ข้อมูลที่มี ━━

**Base Prompt ต้นแบบ:**
"${extractedPromptBase}"

**Layout ที่ตรวจพบ:** ${extractedLayout}

**ลักษณะเด่นที่ต้องบังคับ:**
${checkedTraits.map((t, i) => `${i+1}. ${t}`).join('\n')}

━━ สิ่งที่ต้องเขียนในคู่มือ ━━

เขียนคู่มือเป็นภาษาอังกฤษ โดยครอบคลุมหัวข้อต่อไปนี้ทุกข้อ:

1. **LAYOUT STRUCTURE** — โครงสร้างภาพเป็นยังไง? (หน้าเดียว/แบ่งบนล่าง/แบ่งซ้ายขวา) และ Prompt ต้องเขียนยังไงเพื่อให้ได้ layout นี้
   - เขียนคำสั่งภาษาอังกฤษที่ต้องใส่ใน prompt เพื่อบังคับ layout นี้
   - เขียนสิ่งที่ห้ามใส่ใน prompt เพื่อหลีกเลี่ยง layout ผิด

2. **TEXT PLACEMENT** — ข้อความไทยต้องวางตรงไหน? (บน/กลาง/ล่าง) แบบไหน? (อ่านง่าย/ตัวหนา/สีขาว-ดำ)
   - ถ้าเป็น split-screen ให้เขียนตัวอย่างวิธีแบ่งข้อความ 2 ส่วน (เช่น Part1 ช่องบน, Part2 ช่องล่าง)
   - ถ้าเป็นหน้าเดียว ให้เขียนตัวอย่างวางข้อความทั้งหมดรวมกัน

3. **VISUAL STYLE** — โทนสี แสง บรรยากาศ art style ต้องเป็นแบบไหน?

4. **SCENE/SETTING** — ฉาก/พื้นหลัง/องค์ประกอบอะไรบ้าง?

5. **CHARACTER** (ถ้ามี) — ตัวละครมีหรือไม่? ถ้ามีต้องเขียนยังไง? (ห้ามระบุหน้าตา/เพศเฉพาะ)

6. **TYPOGRAPHY** — ฟอนต์ข้อความเป็นแบบไหน? (หนา/บาง/สีขาว/ดำ)

7. **DO's** — เขียนตัวอย่าง prompt ที่ดี ทำให้ได้รูปตรงตามสไตล์นี้ (2-3 ตัวอย่าง)

8. **DON'Ts** — เขียนตัวอย่าง prompt ที่ผิด/ไม่ตรงสไตล์ (2-3 ตัวอย่าง)

9. **THAI TEXT HANDLING** — วิธีเขียนข้อความไทยใน prompt ที่ถูกต้อง

เขียนคู่มือเป็นภาษาอังกฤษแบบ plain text ไม่ต้องมี markdown ไม่ต้องมี JSON ส่งกลับเป็นข้อความล้วนๆ`;

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-4o',
          messages: [{ role: 'user', content: guidePrompt }]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      const guide = data.choices[0].message.content.trim();
      setExtractedPromptGuide(guide);

      // Save to gallery with guide included
      saveStyle({
        prompt: extractedPromptBase,
        imageUrl: uploadedImages[0] || '',
        traits: checkedTraits,
        layout: extractedLayout,
        promptGuide: guide
      });

      setLogs(prev => [...prev, '[✅] บันทึกแม่พิมพ์ + คู่มือ Prompt Guide สำเร็จ!']);
      alert('✅ บันทึกแม่พิมพ์พร้อมคู่มือ Prompt Guide สำเร็จ!');
    } catch (e: any) {
      alert('สร้างคู่มือล้มเหลว: ' + e.message);
      setLogs(prev => [...prev, `❌ สร้างคู่มือล้มเหลว: ${e.message}`]);
      // Still save without guide as fallback
      saveStyle({
        prompt: extractedPromptBase,
        imageUrl: uploadedImages[0] || '',
        traits: checkedTraits,
        layout: extractedLayout
      });
    } finally {
      setIsSavingWithGuide(false);
    }
  };

  // ── Handlers: Section 1 ─────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const readers = files.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.readAsDataURL(file);
      });
    });

    const results = await Promise.all(readers);
    setUploadedImages(results);
    setExtractedPromptBase('');
    setGeneratedImages([]);
  };

  const handleShortCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const dataUrls = await Promise.all(files.map(readFileAsDataUrl));
    const results: string[] = [];
    for (const dataUrl of dataUrls) {
      try {
        results.push(await saveShortAsset(dataUrl, 'cover_upload'));
      } catch {
        results.push(dataUrl);
      }
    }
    setShortCoverImages(prev => [...prev, ...results].slice(0, 120));
    e.target.value = '';
  };

  const fetchShortCoversFromLink = async () => {
    const url = shortCoverLink.trim();
    if (!url) return alert('ใส่ลิงก์ช่อง/โปรไฟล์ก่อนครับ');
    const limit = Math.max(1, Math.min(120, Number(shortCoverLimit) || 30));
    const taskId = `clone_short_covers_${Date.now()}`;
    setShortCoverFetching(true);
    globalTaskStore.addTask({
      id: taskId,
      title: `ดึงรูปปก ${limit} คลิป`,
      category: 'clone',
      progress: 'กำลังเข้าไปอ่าน thumbnail จากลิงก์ช่อง...',
      status: 'running',
    });

    try {
      const apifyKey = await getActiveApifyKey();
      const res = await fetch('/api/short-cover-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, limit, apifyKey }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Fetch covers failed');
      const images = (data.covers || []).map((cover: any) => cover.imageUrl).filter(Boolean);
      setShortCoverImages(prev => Array.from(new Set([...prev, ...images])).slice(0, 120));
      globalTaskStore.updateTask(taskId, { progress: `ดึงรูปปกสำเร็จ ${images.length} รูป`, status: 'completed' });
    } catch (e: any) {
      globalTaskStore.updateTask(taskId, { progress: `ดึงรูปปกล้มเหลว: ${e.message}`, status: 'error' });
      alert('ดึงรูปปกล้มเหลว: ' + e.message);
    } finally {
      setShortCoverFetching(false);
    }
  };

  const handleShortVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const refs: ShortClipReference[] = [];
    for (const file of files) {
      let thumbnail = '';
      try {
        thumbnail = await extractVideoFrame(file);
      } catch (err) {
        console.warn('Video thumbnail extraction failed', err);
      }
      refs.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: file.name,
        url: URL.createObjectURL(file),
        thumbnail,
        note: '',
      });
    }
    setShortClipRefs(prev => [...prev, ...refs].slice(0, 30));
    e.target.value = '';
  };

  const downloadShortClipsFromLink = async (mode: 'single' | 'latest') => {
    const url = shortClipLink.trim();
    if (!url) return alert('ใส่ลิงก์คลิปหรือช่องก่อนครับ');
    const limit = mode === 'latest' ? Math.max(1, Math.min(30, Number(shortLatestCount) || 5)) : 1;
    const taskId = `clone_short_download_${Date.now()}`;
    setShortDownloading(mode);
    globalTaskStore.addTask({
      id: taskId,
      title: mode === 'latest' ? `โหลด ${limit} คลิปล่าสุด` : 'โหลดคลิปจากลิงก์',
      category: 'clone',
      progress: mode === 'latest' ? `กำลังดาวน์โหลด ${limit} คลิปล่าสุด...` : 'กำลังดาวน์โหลดคลิป...',
      status: 'running',
    });

    try {
      const apifyKey = await getActiveApifyKey();
      const res = await fetch('/api/short-clip-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode, limit, apifyKey }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Download failed');
      const refs: ShortClipReference[] = (data.clips || []).map((clip: any) => ({
        id: clip.id || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: clip.name || 'Downloaded clip',
        url: clip.url,
        thumbnail: clip.thumbnail || '',
        note: clip.sourceUrl ? `ดาวน์โหลดจาก: ${clip.sourceUrl}` : '',
      }));
      setShortClipRefs(prev => [...prev, ...refs].slice(0, 30));
      globalTaskStore.updateTask(taskId, { progress: `ดาวน์โหลดสำเร็จ ${refs.length} คลิป`, status: 'completed' });
    } catch (e: any) {
      globalTaskStore.updateTask(taskId, { progress: `ดาวน์โหลดล้มเหลว: ${e.message}`, status: 'error' });
      alert('ดาวน์โหลดคลิปล้มเหลว: ' + e.message);
    } finally {
      setShortDownloading(null);
    }
  };

  const handleShortCharacterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const validFiles = files.filter(file => {
      const lowerName = file.name.toLowerCase();
      return /image\/(jpeg|jpg|png|webp)/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(lowerName);
    });
    if (validFiles.length !== files.length) {
      alert('มีบางไฟล์เป็นชนิดที่ระบบอ่านไม่ได้ เช่น HEIC/HEIF กรุณาแปลงเป็น JPG, PNG หรือ WebP ก่อนครับ');
    }
    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }
    const dataUrls = await Promise.all(validFiles.map(readFileAsDataUrl));
    const results: string[] = [];
    for (const dataUrl of dataUrls) {
      try {
        results.push(await saveShortAsset(dataUrl, 'character'));
      } catch {
        results.push(dataUrl);
      }
    }
    setShortCharacterImages(prev => [...prev, ...results].slice(0, 6));
    setShortCharacterNotes(prev => [...prev, ...results.map(() => '')].slice(0, 6));
    e.target.value = '';
  };

  const removeShortCharacter = (idx: number) => {
    setShortCharacterImages(prev => prev.filter((_, i) => i !== idx));
    setShortCharacterNotes(prev => prev.filter((_, i) => i !== idx));
  };

  const updateShortCharacterNote = (idx: number, value: string) => {
    setShortCharacterNotes(prev => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const updateShortClipNote = (id: string, note: string) => {
    setShortClipRefs(prev => prev.map(ref => ref.id === id ? { ...ref, note } : ref));
  };

  const toggleShortElement = (id: string) => {
    setShortAnalysis(prev => prev ? {
      ...prev,
      elements: prev.elements.map(el => el.id === id ? { ...el, checked: !el.checked } : el),
    } : prev);
  };

  const parseSavedShortBrain = (brain: SavedBrain): ShortClipAnalysis | null => {
    if (brain.shortAnalysis) return brain.shortAnalysis;
    const text = brain.content || '';
    if (!text.includes('SHORT CLIP STRUCTURE BRAIN')) return null;
    const extractScore = (label: string) => Number(text.match(new RegExp(`${label}:\\s*(\\d+)\\/10`, 'i'))?.[1] || 0);
    const extractSection = (title: string, nextTitles: string[]) => {
      const startLabel = `${title}:\n`;
      const start = text.indexOf(startLabel);
      if (start < 0) return '';
      const from = start + startLabel.length;
      const nextIndexes = nextTitles
        .map(next => text.indexOf(`\n${next}:\n`, from))
        .filter(idx => idx >= 0);
      const end = nextIndexes.length ? Math.min(...nextIndexes) : text.length;
      return text.slice(from, end).trim();
    };
    const parseList = (raw: string) => raw
      .split('\n')
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
    const keepItems = parseList(extractSection('Keep Elements', ['Scenes', 'Camera Angles', 'Main Characters', 'Opening Patterns', 'Thumbnail Patterns', 'Repetition Risks', 'Creative Opportunities', 'Prompt Brain']));
    return {
      channelScore: extractScore('Channel Score'),
      blockRiskScore: extractScore('Block/Repetition Risk'),
      creativityScore: extractScore('Creativity Score'),
      summary: extractSection('Summary', ['Keep Elements']) || brain.name,
      scenes: parseList(extractSection('Scenes', ['Camera Angles', 'Main Characters', 'Opening Patterns', 'Thumbnail Patterns', 'Repetition Risks', 'Creative Opportunities', 'Prompt Brain'])),
      cameraAngles: parseList(extractSection('Camera Angles', ['Main Characters', 'Opening Patterns', 'Thumbnail Patterns', 'Repetition Risks', 'Creative Opportunities', 'Prompt Brain'])),
      mainCharacters: parseList(extractSection('Main Characters', ['Opening Patterns', 'Thumbnail Patterns', 'Repetition Risks', 'Creative Opportunities', 'Prompt Brain'])),
      openingPatterns: parseList(extractSection('Opening Patterns', ['Thumbnail Patterns', 'Repetition Risks', 'Creative Opportunities', 'Prompt Brain'])),
      thumbnailPatterns: parseList(extractSection('Thumbnail Patterns', ['Repetition Risks', 'Creative Opportunities', 'Prompt Brain'])),
      repetitionRisks: parseList(extractSection('Repetition Risks', ['Creative Opportunities', 'Prompt Brain'])),
      creativeOpportunities: parseList(extractSection('Creative Opportunities', ['Prompt Brain'])),
      promptBrain: extractSection('Prompt Brain', []),
      elements: keepItems.map((item, idx) => {
        const [label, ...detailParts] = item.split(':');
        return {
          id: `${brain.id}_${idx}`,
          label: label?.trim() || `องค์ประกอบ ${idx + 1}`,
          detail: detailParts.join(':').trim(),
          checked: true,
        };
      }),
    };
  };

  const loadSavedShortClipBrain = (brain: SavedBrain) => {
    const analysis = parseSavedShortBrain(brain);
    if (!analysis) return alert('สมองนี้ไม่มีข้อมูลโครงสร้างคลิปสั้นที่เรียกกลับมาใช้ได้ครับ');
    setShortAnalysis(analysis);
    setShortAnalysisName(brain.name);
    setShortGeneratedPrompts([]);
    globalTaskStore.addTask({
      id: `clone_short_load_brain_${Date.now()}`,
      title: `เรียกใช้สมอง: ${brain.name}`,
      category: 'clone',
      progress: 'โหลดสมองโครงสร้างคลิปสั้นกลับมาแล้ว เปลี่ยนตัวละครใหม่แล้วสร้าง Prompt ต่อได้เลย',
      status: 'completed',
    });
  };

  const analyzeShortClipStructure = async () => {
    if (shortCoverImages.length === 0 && shortClipRefs.length === 0) {
      return alert('อัปโหลดรูปหน้าปกรวม หรือคลิปตัวอย่างอย่างน้อย 1 อย่างก่อนครับ');
    }
    const { openRouterKey } = getApiKeys();
    if (!openRouterKey) return alert('กรุณาใส่ OpenRouter API Key ในแท็บตั้งค่าก่อนครับ');

    const taskId = `clone_short_analyze_${Date.now()}`;
    setShortAnalyzing(true);
    setShortAnalysis(null);
    setShortGeneratedPrompts([]);
    globalTaskStore.addTask({
      id: taskId,
      title: 'AI แกะโครงสร้างคลิปสั้น',
      category: 'clone',
      progress: `เริ่มวิเคราะห์จาก ${shortCoverImages.length} รูปปก และ ${shortClipRefs.length} คลิปตัวอย่าง`,
      status: 'running',
    });
    try {
      const videoNotes = shortClipRefs.map((clip, i) => (
        `${i + 1}. ${clip.name}${clip.note.trim() ? `\nNote: ${clip.note.trim()}` : '\nNote: ผู้ใช้ยังไม่ได้ใส่ note เพิ่ม'}`
      )).join('\n\n');

      const prompt = `คุณคือผู้กำกับ Creative Strategist สำหรับคลิปสั้น AI Video และผู้เชี่ยวชาญด้าน Pattern Detection ของแพลตฟอร์มวิดีโอสั้น

ผู้ใช้ให้ข้อมูลอ้างอิง 2 แบบ:
1. ภาพรวมหน้าปกคลิปหลายคลิปจากช่องต้นแบบ
2. เฟรมตัวอย่างจากคลิปที่ผู้ใช้อัปโหลด และ note ประกอบแต่ละคลิป

ภารกิจ:
วิเคราะห์ "โครงสร้างคลิปสั้น" ไม่ใช่ลอกตัวละคร/ลอกเรื่องตรงๆ ต้องสกัดเป็นสูตรสร้างสรรค์ที่เอาไปทำคลิปใหม่ได้หลายแบบ โดยลดความเสี่ยงที่แพลตฟอร์มมองว่าแพทเทิร์นซ้ำ

ข้อมูลคลิปตัวอย่าง:
${videoNotes || 'ไม่มีคลิปตัวอย่าง มีเฉพาะภาพหน้าปก'}

ต้องตอบ JSON เท่านั้น ตาม schema นี้:
{
  "channelScore": 0-10,
  "blockRiskScore": 0-10,
  "creativityScore": 0-10,
  "summary": "สรุปคุณภาพช่องและความน่าเอาไปทำต่อเป็นภาษาไทย",
  "scenes": ["ฉาก/สถานการณ์ที่พบ"],
  "cameraAngles": ["มุมกล้อง/ระยะภาพ/การเคลื่อนกล้องที่พบ"],
  "mainCharacters": ["ตัวละครหลัก/สิ่งมีชีวิต/วัตถุเด่นที่พบ แบบทั่วไป ไม่ระบุตัวตนจริง"],
  "openingPatterns": ["แพทเทิร์นการเริ่มคลิป/จังหวะ hook ที่พบ"],
  "thumbnailPatterns": ["สูตรปกคลิป เช่น composition, สี, ตัวละคร, action, text/no text"],
  "repetitionRisks": ["อะไรที่ซ้ำเกินไปและเสี่ยงทำให้คลิปดูแพทเทิร์นเดียว"],
  "creativeOpportunities": ["โอกาสเพิ่มความคิดสร้างสรรค์เพื่อให้ไม่ซ้ำและไม่น่าโดนปิดกั้น"],
  "elements": [
    {"label":"ชื่อองค์ประกอบ", "detail":"รายละเอียดว่าควรเก็บไว้ยังไง"}
  ],
  "promptBrain": "สมองละเอียดสำหรับสร้าง prompt คลิปสั้น: อธิบายโครงสร้างภาพเปิดคลิป, thumbnail/opening shot, scene logic, camera grammar, character behavior, pacing, visual variation rules, anti-repetition rules, และกฎสร้างความต่างทุก prompt"
}

กฎสำคัญ:
- ห้ามแนะนำให้ลอกหน้าตา/ชื่อช่อง/ตัวละครเฉพาะของต้นฉบับ
- ให้คะแนน blockRiskScore สูง = เสี่ยงซ้ำ/เสี่ยงแพทเทิร์นแข็ง
- elements ต้องมี 10-18 ข้อ เพื่อให้ผู้ใช้ติ๊กเลือกว่าจะเก็บอะไรไว้
- promptBrain ต้องละเอียดมากพอให้ใช้เป็นสมองสร้าง prompt ใน Google Flow ได้
- ภาษาไทยทั้งหมด ยกเว้น technical camera terms ใช้อังกฤษปนได้`;

      const content: any[] = [{ type: 'text', text: prompt }];
      globalTaskStore.updateTask(taskId, { progress: 'กำลังเตรียมรูปปกและเฟรมคลิปให้ Vision อ่าน...' });
      const coverVisionImages = await Promise.all(shortCoverImages.slice(0, 8).map(normalizeVisionImageUrl));
      coverVisionImages.filter(Boolean).forEach(img => content.push({ type: 'image_url', image_url: { url: img } }));
      const clipVisionImages = await Promise.all(shortClipRefs.slice(0, 10).map(ref => normalizeVisionImageUrl(ref.thumbnail || '')));
      clipVisionImages.filter(Boolean).forEach(img => content.push({ type: 'image_url', image_url: { url: img } }));
      const imageCount = content.filter(item => item.type === 'image_url').length;
      globalTaskStore.updateTask(taskId, { progress: `ส่งข้อมูลเข้า GPT-4o Vision แล้ว (${imageCount} รูป/เฟรม + note ${shortClipRefs.length} คลิป)` });

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-4o',
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content }]
        })
      });
      const data = await res.json();
      globalTaskStore.updateTask(taskId, { progress: 'ได้รับคำตอบจากโมเดล กำลังจัดรูปแบบเป็นสมองโครงสร้าง...' });
      if (data.error) {
        const detail = data.error.metadata?.raw || data.error.metadata?.provider_name || data.error.message || JSON.stringify(data.error);
        throw new Error(`${data.error.message || 'Provider returned error'}${detail && detail !== data.error.message ? `: ${String(detail).substring(0, 500)}` : ''}`);
      }
      if (!data.choices?.[0]?.message?.content) {
        throw new Error(`OpenRouter ไม่ได้ส่งคำตอบกลับมา: ${JSON.stringify(data).substring(0, 500)}`);
      }
      const raw = data.choices[0].message.content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(raw);
      const elements: ShortClipElement[] = (parsed.elements || []).map((el: any, idx: number) => ({
        id: `${Date.now()}_${idx}`,
        label: el.label || `องค์ประกอบ ${idx + 1}`,
        detail: el.detail || '',
        checked: true,
      }));
      setShortAnalysis({
        channelScore: Number(parsed.channelScore) || 0,
        blockRiskScore: Number(parsed.blockRiskScore) || 0,
        creativityScore: Number(parsed.creativityScore) || 0,
        summary: parsed.summary || '',
        scenes: parsed.scenes || [],
        cameraAngles: parsed.cameraAngles || [],
        mainCharacters: parsed.mainCharacters || [],
        openingPatterns: parsed.openingPatterns || [],
        thumbnailPatterns: parsed.thumbnailPatterns || [],
        repetitionRisks: parsed.repetitionRisks || [],
        creativeOpportunities: parsed.creativeOpportunities || [],
        promptBrain: parsed.promptBrain || '',
        elements,
      });
      globalTaskStore.updateTask(taskId, { progress: `วิเคราะห์สำเร็จ: คะแนนช่อง ${Number(parsed.channelScore) || 0}/10, ความคิดสร้างสรรค์ ${Number(parsed.creativityScore) || 0}/10`, status: 'completed' });
    } catch (e: any) {
      globalTaskStore.updateTask(taskId, { progress: `วิเคราะห์ล้มเหลว: ${e.message}`, status: 'error' });
      alert('วิเคราะห์โครงสร้างคลิปสั้นล้มเหลว: ' + e.message);
    } finally {
      setShortAnalyzing(false);
    }
  };

  const saveShortClipBrain = async () => {
    if (!shortAnalysis) return;
    const name = shortAnalysisName.trim() || `Short Clip Brain ${new Date().toLocaleDateString('th-TH')}`;
    const taskId = `clone_short_save_brain_${Date.now()}`;
    setShortSavingBrain(true);
    globalTaskStore.addTask({
      id: taskId,
      title: `บันทึกสมอง: ${name}`,
      category: 'clone',
      progress: 'กำลังบันทึกลงคลังสมองและไฟล์ app_data...',
      status: 'running',
    });
    const checkedElements = shortAnalysis.elements.filter(el => el.checked);
    const content = [
      `SHORT CLIP STRUCTURE BRAIN: ${name}`,
      '',
      `Source URL: ${shortMasterLink.trim() || shortCoverLink.trim() || shortClipLink.trim() || '-'}`,
      '',
      `Channel Score: ${shortAnalysis.channelScore}/10`,
      `Block/Repetition Risk: ${shortAnalysis.blockRiskScore}/10`,
      `Creativity Score: ${shortAnalysis.creativityScore}/10`,
      '',
      `Summary:\n${shortAnalysis.summary}`,
      '',
      `Keep Elements:\n${checkedElements.map((el, i) => `${i + 1}. ${el.label}: ${el.detail}`).join('\n')}`,
      '',
      `Scenes:\n${shortAnalysis.scenes.map((x, i) => `${i + 1}. ${x}`).join('\n')}`,
      '',
      `Camera Angles:\n${shortAnalysis.cameraAngles.map((x, i) => `${i + 1}. ${x}`).join('\n')}`,
      '',
      `Main Characters:\n${shortAnalysis.mainCharacters.map((x, i) => `${i + 1}. ${x}`).join('\n')}`,
      '',
      `Opening Patterns:\n${shortAnalysis.openingPatterns.map((x, i) => `${i + 1}. ${x}`).join('\n')}`,
      '',
      `Thumbnail Patterns:\n${shortAnalysis.thumbnailPatterns.map((x, i) => `${i + 1}. ${x}`).join('\n')}`,
      '',
      `Repetition Risks:\n${shortAnalysis.repetitionRisks.map((x, i) => `${i + 1}. ${x}`).join('\n')}`,
      '',
      `Creative Opportunities:\n${shortAnalysis.creativeOpportunities.map((x, i) => `${i + 1}. ${x}`).join('\n')}`,
      '',
      `Prompt Brain:\n${shortAnalysis.promptBrain}`,
    ].join('\n');

    try {
      const now = new Date().toISOString();
      const existing = savedBrains.find(b => b.name === name);
      const updated = [...savedBrains.filter(b => b.name !== name), {
        id: existing?.id || Date.now().toString(),
        name,
        content,
        timestamp: now,
        outputType: 'short-video-structure',
        shortAnalysis,
        sourceUrl: shortMasterLink.trim() || shortCoverLink.trim() || shortClipLink.trim(),
      }];
      localStorage.setItem('system_prompts_brain', JSON.stringify(updated));
      const res = await fetch('/api/save-app-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'brains', data: updated })
      });
      if (!res.ok) throw new Error(`บันทึกไฟล์ไม่สำเร็จ (${res.status})`);
      setSavedBrains(updated);
      globalTaskStore.updateTask(taskId, { progress: `บันทึกแล้วใน public/app_data/brains.json ชื่อ "${name}"`, status: 'completed' });
      alert(`✅ บันทึกสมองโครงสร้างคลิปสั้น "${name}" แล้ว`);
    } catch (e: any) {
      globalTaskStore.updateTask(taskId, { progress: `บันทึกสมองล้มเหลว: ${e.message}`, status: 'error' });
      alert('บันทึกสมองล้มเหลว: ' + e.message);
    } finally {
      setShortSavingBrain(false);
    }
  };

  const generateShortClipPrompts = async () => {
    if (!shortAnalysis) return alert('ต้องแกะสมองโครงสร้างก่อนครับ');
    if (shortFixCharacters && shortCharacterImages.length === 0) {
      return alert('เปิด Fix ตัวละครแล้ว กรุณาอัปโหลดรูปตัวละครอย่างน้อย 1 รูปก่อนครับ');
    }
    const { openRouterKey } = getApiKeys();
    if (!openRouterKey) return alert('กรุณาใส่ OpenRouter API Key ในแท็บตั้งค่าก่อนครับ');
    const total = Math.max(1, Math.min(100, Number(shortPromptCount) || 1));
    const storyboardScenes = Math.max(2, Math.min(12, Number(shortStoryboardSceneCount) || 4));
    const secondsPerStoryboardScene = 8;
    const storyboardClipSeconds = storyboardScenes * secondsPerStoryboardScene;
    const storyboardBatchSeconds = storyboardClipSeconds * total;
    const checkedElements = shortAnalysis.elements.filter(el => el.checked);
    const taskId = `clone_short_generate_prompts_${Date.now()}`;
    setShortGeneratingPrompts(true);
    setShortGeneratedPrompts([]);
    globalTaskStore.addTask({
      id: taskId,
      title: `${shortPromptMode === 'storyboard' ? 'สร้างเรื่องจากสมอง' : 'สร้าง Prompt จากสมอง'} ${total} ชุด`,
      category: 'clone',
      progress: `${shortPromptMode === 'storyboard' ? `Storyboard ${storyboardScenes} ฉาก (~${storyboardClipSeconds}s/คลิป)` : 'สุ่มธรรมดา'} · ${shortFixCharacters
        ? `Fix ตัวละคร ${shortCharacterImages.length} ตัว`
        : 'ให้ AI เลือกตัวละครได้'} · ${shortSoraMode ? 'เปิด' : 'ปิด'} SORA-2 Realism`,
      status: 'running',
    });
    try {
      const all: string[] = [];
      const characterVisionImages = (await Promise.all(shortCharacterImages.slice(0, 6).map(normalizeVisionImageUrl))).filter(Boolean);
      if (shortFixCharacters && characterVisionImages.length === 0) {
        throw new Error('รูปตัวละครที่อัปโหลดอ่านไม่ได้ กรุณาลบรูปที่แตกแล้วอัปโหลดใหม่เป็น JPG, PNG หรือ WebP');
      }
      if (shortFixCharacters && characterVisionImages.length !== shortCharacterImages.length) {
        globalTaskStore.updateTask(taskId, { progress: `มีรูปตัวละครบางรูปอ่านไม่ได้ ใช้ได้ ${characterVisionImages.length}/${shortCharacterImages.length} รูป` });
      }
      const characterDescriptions = shortCharacterImages.slice(0, 6).map((_, idx) => {
        const note = (shortCharacterNotes[idx] || '').trim();
        if (note) return `Character ${idx + 1}: ${note}`;
        if (shortNewCharacter.trim() && shortCharacterImages.length === 1) return `Character ${idx + 1}: ${shortNewCharacter.trim()}`;
        return `Character ${idx + 1}: use the uploaded visual anchor only for broad appearance continuity. The user has not written a description, so do not invent species/name; describe it neutrally as Character ${idx + 1}.`;
      });
      const characterBibleText = characterDescriptions.length > 0 ? characterDescriptions.join('\n') : (shortNewCharacter.trim() || 'No fixed character bible provided.');
      const soraModsText = shortSoraMode
        ? SORA_MODIFIERS.filter(mod => shortActiveSoraMods.includes(mod.id)).map(mod => mod.value).join(', ')
        : '';
      const isRefusal = (text: string) => /sorry|can't assist|can't help|cannot assist|identif|recogniz/i.test(text);
      for (let i = 0; i < total; i++) {
        globalTaskStore.updateTask(taskId, {
          progress: shortPromptMode === 'storyboard'
            ? `กำลังสร้างเรื่อง ${i + 1}/${total}: ${storyboardScenes} ฉาก ต่อกัน ~${storyboardClipSeconds}s`
            : `กำลังสร้าง Prompt ${i + 1}/${total} แบบสุ่มธรรมดา...`
        });
        const buildPromptText = (allowImages: boolean) => `ใช้สมองโครงสร้างคลิปสั้นนี้สร้าง${shortPromptMode === 'storyboard' ? 'เรื่องแบบ Storyboard' : ' Prompt'} สำหรับ Google Flow จำนวน 1 ${shortPromptMode === 'storyboard' ? 'เรื่อง' : 'prompt'} เท่านั้น

สมอง:
${shortAnalysis.promptBrain}

องค์ประกอบที่ผู้ใช้เลือกให้เก็บ:
${checkedElements.map((el, idx) => `${idx + 1}. ${el.label}: ${el.detail}`).join('\n')}

ตัวละครใหม่ที่ผู้ใช้อยากใส่ (ไม่บังคับ):
${shortNewCharacter.trim() || 'ไม่ได้ระบุ ให้คิดตัวละครใหม่ที่ต่างจากต้นฉบับและไม่ซ้ำ prompt ก่อนหน้า'}

Character Bible ที่ต้องใช้ในคำตอบ:
${characterBibleText}

โหมด Fix ตัวละคร:
${shortFixCharacters ? `เปิดอยู่ — ${allowImages ? `มีรูป visual anchor ${characterVisionImages.length} รูปแนบมาด้วย` : `ใช้ตัวละครที่ผู้ใช้อัปโหลดไว้เป็น visual anchor ${characterVisionImages.length} ตัว`} ให้ถือว่าเป็นตัวละครหลักทั้งหมดของทุก Prompt
- รูปเป็น fictional/anonymous character consistency reference เท่านั้น ไม่ใช่งานระบุตัวตน
- ห้าม identify, recognize, name, infer identity, owner, location, breed, or private information จากรูป
- ใช้ได้เฉพาะลักษณะที่มองเห็นแบบทั่วไปเพื่อการสร้างสรรค์ เช่น สีหลัก, silhouette, outfit/accessory, ขนาดโดยประมาณ, markings/patterns, posture, mood
- ถ้า Character Bible ระบุว่าเป็นแมวสีขาว/หมาดำ/สิ่งใด ให้เชื่อ Character Bible เป็นหลัก ห้ามเปลี่ยนเป็นสัตว์หรือสิ่งอื่น
- ถ้ามี ${characterVisionImages.length} visual anchor ต้องมีตัวละครหลัก ${characterVisionImages.length} ตัวในทุก Prompt โดยเรียกเป็น Character 1, Character 2, ... ตามลำดับรูป
- ห้ามตัดตัวใดตัวหนึ่งออก ห้ามรวมตัวละครเข้าด้วยกัน ห้ามเปลี่ยนสี/รูปร่าง/ลายเด่น/สัดส่วนหลัก
- ตัวละครอื่นเพิ่มได้แค่ฉากหลัง/ตัวประกอบ และต้องไม่แย่งบทจากตัวละครหลัก
- Opening frame / thumbnail และ Scene action ต้องระบุให้เห็นตัวละครหลักทุกตัวอย่างชัดเจน` : 'ปิดอยู่ — ใช้ข้อความตัวละครใหม่ถ้ามี หรือออกแบบตัวละครใหม่ที่ไม่ลอกต้นฉบับได้'}

โหมดความสมจริง SORA-2:
${shortSoraMode ? `เปิดอยู่ ให้ใส่ realism modifiers เหล่านี้อย่างกลมกลืนใน prompt: ${soraModsText}
- ห้ามเขียนภาพสะอาดเกินจริงแบบ CGI/3D render
- ต้องมีข้อบกพร่องของกล้อง/แสง/โฟกัส/การเคลื่อนไหวที่ทำให้ดูเป็นคลิปจริงจากโลกจริง
- รายละเอียดความสมจริงต้องช่วยฉาก ไม่ใช่ยัด keyword ลอยๆ` : 'ปิดอยู่ ใช้ cinematic realism แบบปกติ ไม่ต้องใส่ความดิบของ SORA-2'}

โหมดรูปแบบ Prompt:
${shortPromptMode === 'storyboard' ? `Storyboard — สร้างเป็นลำดับฉากต่อเนื่อง ${storyboardScenes} ฉากสำหรับ 1 คลิป แต่ต้องส่งออกเป็น PROMPT แยกรายฉาก ไม่ใช่ narrative ก้อนเดียว
- แต่ละฉากประมาณ ${secondsPerStoryboardScene} วินาที
- ความยาวรวมของ 1 คลิปประมาณ ${storyboardClipSeconds} วินาที
- ต้องตอบ JSON เท่านั้น ตาม schema:
{
  "clipTitle": "ชื่อคลิปสั้นๆ",
  "estimatedTotalSeconds": ${storyboardClipSeconds},
  "characterBible": "สรุปรายละเอียดตัวละครหลักแบบชัดเจน ใช้ Character Bible จากผู้ใช้เป็นหลัก",
  "scenes": [
    {
      "sceneNumber": 1,
      "timecode": "0-8s",
      "flowPrompt": "Prompt ภาษาอังกฤษสำหรับ Google Flow ของฉากนี้ฉากเดียวเท่านั้น ยาวพอใช้งานได้ทันที",
      "thaiNote": "อธิบายไทยสั้นๆ ว่าฉากนี้ทำอะไรและต่อจากฉากอื่นยังไง"
    }
  ]
}
- scenes ต้องมี exactly ${storyboardScenes} รายการ
- แต่ละ scene.flowPrompt ต้องเป็น prompt 8 วินาทีที่เอาไปใส่ Google Flow แยกได้ทันที
- ทุก scene.flowPrompt ต้องเริ่มด้วย Character Bible แบบย่อ เพื่อให้ Flow จำตัวละครได้ เช่น "Fixed characters: Character 1 = ..."
- ทุกฉากต้องต่อเนื่องกัน แต่ต้องเป็น prompt แยก ไม่ใช่รวมเป็นคลิปเดียว
- ถ้าเปิด Fix ตัวละคร ตัวละครหลักทุกตัวต้องปรากฏหรือมีบทบาทชัดในทุกฉาก` : `สุ่มธรรมดา — สร้าง prompt เดี่ยว 1 ไอเดียต่อ 1 คลิป
- เน้น Opening frame / thumbnail, Scene action, Camera, Character behavior, Visual style, Anti-repetition note
- ความยาวที่ตั้งใจสำหรับ 1 คลิปประมาณ 8 วินาที`}

Prompt ที่สร้างไปแล้ว ห้ามซ้ำ:
${all.map((p, idx) => `${idx + 1}. ${p.substring(0, 500)}`).join('\n\n') || 'ยังไม่มี'}

ข้อกำหนด:
- สร้าง prompt เดียว คุณภาพสูง ไม่ใช่ list หลายข้อ
- ต้องต่างจาก prompt ก่อนหน้า: เปลี่ยนฉากเปิด, action, camera angle, emotional beat, thumbnail/opening frame
- ${shortPromptMode === 'storyboard' ? `ต้องตอบ JSON พร้อม scenes ${storyboardScenes} รายการ แต่ละรายการคือ Google Flow prompt แยกสำหรับฉาก 8 วินาที` : 'ต้องมีส่วน "Opening frame / thumbnail", "Scene action", "Camera", "Character behavior", "Visual style", "Anti-repetition note"'}
- ห้ามลอกตัวละคร/ชื่อ/แบรนด์จากช่องต้นฉบับ
- ห้ามตอบปฏิเสธเรื่อง identifying/recognizing เพราะงานนี้ไม่ต้องระบุตัวตน ให้เขียน prompt โดยใช้ตัวละครเป็น anonymous Character 1/2/3 เท่านั้น
- ใช้ภาษาอังกฤษสำหรับ prompt หลัก แต่มีคำอธิบายภาษาไทยท้าย prompt ว่าฉากเป็นยังไงและต่างจากแพทเทิร์นเดิมตรงไหน
- เหมาะกับคลิปสั้น 9:16, cinematic, high-retention hook`;

        const runPromptRequest = async (allowImages: boolean) => {
          const content: any[] = [{ type: 'text', text: buildPromptText(allowImages) }];
          if (allowImages) {
            characterVisionImages.forEach(img => content.push({ type: 'image_url', image_url: { url: img } }));
          }
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: allowImages && characterVisionImages.length > 0 ? 'openai/gpt-4o' : (selectedTextModel || 'openai/gpt-4o'),
              ...(shortPromptMode === 'storyboard' ? { response_format: { type: 'json_object' } } : {}),
              messages: [{ role: 'user', content }]
            })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
          return data.choices?.[0]?.message?.content?.trim() || '';
        };

        let prompt = await runPromptRequest(characterVisionImages.length > 0);
        if (isRefusal(prompt)) {
          globalTaskStore.updateTask(taskId, { progress: `โมเดลตอบปฏิเสธ Prompt ${i + 1} กำลัง retry แบบ anonymous character anchors...` });
          prompt = await runPromptRequest(false);
        }
        if (shortPromptMode === 'storyboard' && prompt && !isRefusal(prompt)) {
          try {
            const parsed = JSON.parse(prompt.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
            const scenes = Array.isArray(parsed.scenes) ? parsed.scenes.slice(0, storyboardScenes) : [];
            if (scenes.length > 0) {
              scenes.forEach((scene: any, sceneIdx: number) => {
                const sceneNumber = Number(scene.sceneNumber) || sceneIdx + 1;
                const timecode = scene.timecode || `${sceneIdx * secondsPerStoryboardScene}-${(sceneIdx + 1) * secondsPerStoryboardScene}s`;
                const flowPrompt = scene.flowPrompt || scene.prompt || '';
                const thaiNote = scene.thaiNote || '';
                all.push([
                  `Clip ${i + 1} / Scene ${sceneNumber} (${timecode})`,
                  `Estimated scene duration: ~${secondsPerStoryboardScene} seconds`,
                  `Estimated full clip duration: ~${storyboardClipSeconds} seconds (${storyboardScenes} scenes)`,
                  '',
                  `Character Bible:`,
                  parsed.characterBible || characterBibleText,
                  '',
                  `Google Flow Prompt for this scene:`,
                  flowPrompt,
                  '',
                  thaiNote ? `คำอธิบายไทย: ${thaiNote}` : '',
                ].filter(Boolean).join('\n'));
              });
              setShortGeneratedPrompts([...all]);
              continue;
            }
          } catch (err) {
            console.warn('Storyboard JSON parse failed, using fallback text', err);
            prompt = '';
          }
        }
        if (!prompt || isRefusal(prompt)) {
          prompt = shortPromptMode === 'storyboard'
            ? ''
            : `Opening frame / thumbnail: Character ${Array.from({ length: Math.max(1, characterVisionImages.length) }, (_, idx) => idx + 1).join(' and Character ')} appear as fixed anonymous visual-anchor characters in a fresh short-form scene, all visible in the first frame, with a new hook and non-repeating composition.

Scene action: Build a completely new situation from the saved structure brain without copying the original channel. Keep the fixed characters as the main subjects, changing only the environment, action, emotional beat, and camera blocking.

Camera: vertical 9:16 handheld framing, natural imperfect motion, high-retention opening shot.

Character behavior: The fixed characters remain consistent with the uploaded references as unnamed Character 1/2/etc., not identified or recognized, only used as visual continuity anchors.

Visual style: ${shortSoraMode ? soraModsText : 'cinematic realistic short-video look'}, grounded natural light, believable physical interaction.

Anti-repetition note: Do not reuse the same scene, opening gag, camera angle, or thumbnail composition from previous prompts.

คำอธิบายไทย: โมเดลปฏิเสธการอ่านรูปโดยตรง จึงสร้าง prompt สำรองที่ยัง fix ตัวละครเป็น Character 1/2 ตามรูปอ้างอิง และบังคับเปลี่ยนฉาก/มุมกล้อง/เหตุการณ์ให้ไม่ซ้ำเดิม`;
          if (shortPromptMode === 'storyboard') {
            Array.from({ length: storyboardScenes }, (_, idx) => {
  const start = idx * secondsPerStoryboardScene;
  const end = start + secondsPerStoryboardScene;
              all.push([
                `Clip ${i + 1} / Scene ${idx + 1} (${start}-${end}s)`,
                `Estimated scene duration: ~${secondsPerStoryboardScene} seconds`,
                `Estimated full clip duration: ~${storyboardClipSeconds} seconds (${storyboardScenes} scenes)`,
                '',
                `Character Bible:`,
                characterBibleText,
                '',
                `Google Flow Prompt for this scene:`,
                `Create scene ${idx + 1} of ${storyboardScenes} for a vertical 9:16 short video. Fixed characters: ${characterBibleText}. This is one 8-second Google Flow prompt only. Keep continuity from the previous scene, use a new action beat, a distinct camera movement, realistic imperfect handheld footage, and avoid copying the original channel. ${shortSoraMode ? soraModsText : 'cinematic realistic short-video look'}.`,
                '',
                `คำอธิบายไทย: ฉากที่ ${idx + 1} ของคลิปเดียวกัน ใช้ตัวละครตาม Character Bible และต่อเนื่องกับฉากอื่น รวมคลิปประมาณ ${storyboardClipSeconds} วินาที`,
              ].join('\n'));
            });
            setShortGeneratedPrompts([...all]);
            continue;
          }
        }
        all.push(prompt);
        setShortGeneratedPrompts([...all]);
      }
      globalTaskStore.updateTask(taskId, {
        progress: shortPromptMode === 'storyboard'
          ? `สร้างเรื่องสำเร็จ ${total} เรื่อง · แตกเป็น ${all.length} ฉาก · รวมประมาณ ${storyboardBatchSeconds}s ทั้งหมด`
          : `สร้าง Prompt สำเร็จ ${all.length}/${total} ชุด`,
        status: 'completed'
      });
    } catch (e: any) {
      globalTaskStore.updateTask(taskId, { progress: `${shortPromptMode === 'storyboard' ? 'สร้างเรื่อง' : 'สร้าง Prompt'} ล้มเหลว: ${e.message}`, status: 'error' });
      alert(`${shortPromptMode === 'storyboard' ? 'สร้างเรื่อง' : 'สร้าง Prompt'} ล้มเหลว: ` + e.message);
    } finally {
      setShortGeneratingPrompts(false);
    }
  };

  const analyzeImage = async () => {
    if (uploadedImages.length === 0) return;
    const { openRouterKey } = getApiKeys();
    if (!openRouterKey) return alert('กรุณาใส่ OpenRouter API Key ในแท็บตั้งค่าก่อนครับ');
    setIsAnalyzing(true);
    setExtractedPromptBase('');
    setExtractedTraits([]);
    setExtractedLayout('single');
    setLogs(prev => [...prev, '[1/4] 📸 กำลังส่งรูปภาพให้ AI สแกน...']);
    try {
      const p = `คุณเป็นผู้เชี่ยวชาญระดับสูงด้าน AI Image Prompt Engineering, ศิลปะดิจิทัล และ Layout Design

วิเคราะห์ภาพตัวอย่างเหล่านี้อย่างละเอียดที่สุดเท่าที่จะทำได้ แล้วทำ 3 อย่าง:

⚠️ **กฎสำคัญที่สุด: สกัดเป็น "แม่แบบ/โครงสร้าง" ที่นำไปใช้ซ้ำได้**
- ห้ามดึงข้อความเฉพาะเจาะจงที่อยู่ในรูปมาใส่ (เช่น คำคม, ข้อความสนทนา) → ให้ใช้ placeholder แทน เช่น '[THAI_TEXT]'
- ห้ามระบุหน้าตา/ลักษณะเฉพาะของตัวละคร (เช่น ผมบลอนด์, ผิวขาว) → ให้ระบุแค่โครงสร้าง เช่น "a person in close-up shot"
- เพราะ User จะเปลี่ยนข้อความและปล่อยให้ AI จินตนาการตัวละครเอง

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**งานที่ 1: สกัด Base Prompt (เป็นแม่แบบ)**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
เขียน Image Prompt ภาษาอังกฤษที่ละเอียดมากๆ (ยาว 60-120 คำ) เพื่อสร้างภาพใหม่ที่มี **โครงสร้างและบรรยากาศเหมือน** ต้นฉบับ

ต้องครอบคลุมทุกมิติ:
• **Layout/โครงสร้าง**: ภาพแบ่งกี่ส่วน? split-screen บน-ล่าง? ซ้าย-ขวา? ภาพเดียว?
• **ตัวละคร (แบบทั่วไป)**: มีกี่คน? มุมกล้องอะไร? ท่าทาง/อารมณ์? — **ห้ามระบุหน้าตา สีผม สีผิว เพศ เฉพาะเจาะจง** ให้เขียนแบบกว้างๆ เช่น "a person" หรือ "a character"
• **มุมกล้อง**: close-up? medium shot? wide shot? low angle?
• **แสง/สี/โทน**: warm/cool? dark/bright? cinematic? โทนสีหลัก?
• **บรรยากาศ/ฉาก**: สถานที่? อารมณ์ภาพ? พื้นหลัง?
• **Art Style**: realistic? cinematic? cartoon? anime? 3D render?
• **ตำแหน่งข้อความ**: ข้อความอยู่ตรงไหน? (บน/กลาง/ล่าง/ทับภาพ) สีอะไร? ขนาดไหน?
  **ห้ามเขียนข้อความจริงที่อยู่ในรูป** → ให้ใช้ placeholder:
  with exact Thai text typography saying '[THAI_TEXT]' at the bottom of each panel

**คำเตือนสำคัญ:**
- ไม่ต้องดึงเครดิตเพจ, ลายน้ำ, โลโก้ มาใส่ใน Prompt
- ไม่ต้องระบุคำคม/ข้อความจริงที่เขียนอยู่ในรูป → ใช้ '[THAI_TEXT]' แทนเสมอ
- ไม่ต้องบอกเพศ หน้าตา สีผม สีผิว ของตัวละครแบบเฉพาะเจาะจง
- ห้ามย่อ ห้ามสรุป ต้องละเอียดทุกองค์ประกอบ **ที่เป็นโครงสร้าง**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**งานที่ 2: แยกลักษณะเด่นเป็นข้อๆ (Traits) — เน้นโครงสร้างที่ใช้ซ้ำได้**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
วิเคราะห์ภาพแล้วแยกลักษณะเด่น **ที่เป็นโครงสร้าง/รูปแบบ** ออกมา **8-15 ข้อ** เขียนเป็นภาษาไทยสั้นๆ

**ข้อห้ามสำคัญ:**
- ❌ ห้ามดึงข้อความ/คำคมที่อยู่ในรูปมาเขียน (เช่น ห้ามเขียนว่า "ข้อความว่า 'คุณใช้ภาษี...'")
- ❌ ห้ามระบุหน้าตา/ลักษณะเฉพาะของตัวละคร (เช่น ห้ามเขียนว่า "หญิงสาวผมบลอนด์ ผิวขาว")
- ✅ ให้เขียนแค่โครงสร้าง เช่น "มีตัวละคร 1 คนในช่องบน มุมกล้อง close-up"

ตัวอย่าง Traits ที่ดี:
- "ภาพมีลักษณะหน้าเดียว ไม่มีการแบ่งส่วน"
- "ภาพแบ่งเป็น 2 ส่วน (บน-ล่าง) แบบ split-screen"
- "ข้อความภาษาไทยอยู่ด้านล่างของแต่ละช่องภาพ แบบซับไตเติ้ล"
- "คำคมแบ่ง 2 ส่วน — ประโยคแรกอยู่ช่องบน ประโยคที่สองอยู่ช่องล่าง"
- "โทนภาพ cinematic สีเข้ม warm tone"
- "มีตัวละคร 1 คนในช่องบน มุมกล้อง close-up"
- "มีเครดิตเพจเล็กๆ อยู่มุมขวาบน"
- "ข้อความสีขาว ตัวหนา อ่านง่าย font ใหญ่"
- "พื้นหลังเบลอ (shallow depth of field)"
- "แสง cinematic จากด้านข้าง"

ให้เขียนตรงๆ สั้นๆ อธิบาย **โครงสร้าง** ที่เห็น ไม่ต้องอธิบายเนื้อหา

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**งานที่ 3: ระบุประเภท Layout ของภาพ**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
วิเคราะห์ว่าภาพมี layout แบบไหน แล้วเลือก **1 ค่า** จากตัวเลือกนี้:
- "single" = ภาพเดียว ไม่มีการแบ่งส่วน
- "split-top-bottom" = แบ่ง 2 ส่วนบน-ล่าง (split-screen)
- "split-left-right" = แบ่ง 2 ส่วนซ้าย-ขวา
- "grid" = แบ่งเป็นตาราง 3 ช่องขึ้นไป
- "collage" = ภาพหลายชิ้นวางสลับ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**รูปแบบ Output:** ส่งกลับเป็น JSON เท่านั้น:
{"prompt": "...Base Prompt ภาษาอังกฤษที่ละเอียดมากๆ (ใช้ [THAI_TEXT] แทนข้อความจริง)...", "traits": ["trait 1", "trait 2", ...], "layout": "single" หรือ "split-top-bottom" หรือ "split-left-right" หรือ "grid" หรือ "collage"}

ห้ามมี markdown ครอบ ส่ง JSON ล้วนๆเท่านั้น`;
      
      const imageContents = uploadedImages.map(url => ({ type: 'image_url', image_url: { url } }));
      
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-4o',
          messages: [{ role: 'user', content: [{ type: 'text', text: p }, ...imageContents] }]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      let content = data.choices[0].message.content.trim();
      // Clean markdown fences
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      try {
        const parsed = JSON.parse(content);
        const prompt = (parsed.prompt || '').trim();
        const traits = (parsed.traits || []).map((t: string) => ({ text: t, checked: true }));
        const layout = parsed.layout || 'single';
        setExtractedPromptBase(prompt + ` --ar ${s4SizePreset}`);
        setExtractedTraits(traits);
        setExtractedLayout(layout);
        setLogs(prev => [...prev, `[1.5/4] 📐 Layout ที่ตรวจพบ: ${layout}`]);
      } catch {
        // Fallback: if AI didn't return valid JSON, treat entire output as prompt
        if (content.startsWith('"') && content.endsWith('"')) content = content.slice(1, -1);
        setExtractedPromptBase(content + ` --ar ${s4SizePreset}`);
        setExtractedTraits([]);
      }
      setLogs(prev => [...prev, '[2/4] ✨ แกะแบบแปลนสำเร็จ ได้รับ Prompt แล้ว!']);
    } catch (e: any) {
      alert('วิเคราะห์รูปล้มเหลว: ' + e.message);
      setLogs(prev => [...prev, `❌ Error: ${e.message}`]);
    } finally { setIsAnalyzing(false); }
  };

  // Removed generatePromptVariations and generateVariations as Section 1 is now exclusively for copying the base template.

  // ── Section 2: Brain Studio ─────────────────────────────────────
  const generateSystemPrompt = async () => {
    const validCaps = customCaptions.filter(c => c.trim());
    if (validCaps.length === 0) return;
    const { openRouterKey } = getApiKeys();
    if (!openRouterKey) return alert('กรุณาใส่ OpenRouter API Key ในแท็บตั้งค่าก่อนครับ');
    setIsGeneratingSystemPrompt(true);
    setGeneratedSystemPrompt('');
    try {
      const examplesText = validCaps.map((c, i) => `--- Example ${i+1} ---\n${c.trim()}`).join('\n\n');
      const prompt = `You are an expert AI Prompt Engineer and a native Thai Copywriter. The user will provide a set of "Reference Captions" from a Thai Facebook page below.
Each caption between "---" separators is a SEPARATE, INDEPENDENT post example.

Your task is to DEEPLY ANALYZE these captions and write a comprehensive "System Prompt" (Role/Act As...) for an LLM (to be used in n8n) so that the LLM can generate high-quality Facebook posts in this EXACT SAME style whenever requested.

**CRITICAL RULE FOR THAI COPYWRITING:** The resulting System Prompt MUST strictly instruct the AI to write like a REAL HUMAN. It must prohibit "AI-like" patterns such as being overly polite, too poetic, using cliché transitions (e.g., "อย่างไรก็ตาม", "ดังนั้น", "ทว่า"), or summarizing at the end. The tone must be natural, engaging, and directly matched to the provided examples.

Please strictly use the following structure for your System Prompt output (output in Thai or English is fine, but the instructions to the AI must be crystal clear):
Role: [Define the specific role/persona]
Tone & Voice: [Deep analysis of the tone: e.g., sarcastic, inspiring, casual, professional. How does it sound?]
Vocabulary & Phrasing: [What specific words are used? Are they slang, formal, or emotional? How are sentences structured (short vs long)?]
Post Structure: [Outline the sections of the post, e.g., Hook, Body, Checklist, CTA. Are there emojis? How are line breaks used?]
Strict Rules (Anti-AI Clichés): [List 3-5 negative constraints. E.g., "Do NOT sound like a robot", "Do NOT use formal concluding sentences", "Do NOT be neutral if the prompt is opinionated"]

REFERENCE CAPTIONS:
"""
${examplesText}
"""

Instructions for you:
1. Output ONLY the raw System Prompt text.
2. Do not include conversational filler like "Here is the prompt" or "Understood".`;
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedTextModel, messages: [{ role: 'user', content: prompt }] }) // Using user-selected model
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      let content = data.choices[0].message.content.trim().replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      setGeneratedSystemPrompt(content);
    } catch (e: any) {
      alert('Error generating system prompt: ' + e.message);
    } finally { setIsGeneratingSystemPrompt(false); }
  };

  // ── Section 4: Content Generator from Brain ─────────────────────
  const s4ContentItems: string[] = (() => {
    if (s4InputMode === 'csv') return s4CsvData;
    return s4PasteText.split('\n').map(l => l.trim()).filter(Boolean);
  })();

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const items = parseCSVColumn(text, 0);
      setS4CsvData(items);
    };
    reader.readAsText(file, 'UTF-8');
  };

  // ── Auto-generate contextual diversity presets from Base Prompt ──
  const generateDiversityPresets = async (basePrompt: string) => {
    if (!basePrompt) return;
    const { openRouterKey } = getApiKeys();
    if (!openRouterKey) return alert('กรุณาใส่ OpenRouter API Key ในแท็บตั้งค่าก่อนครับ');
    setDiversityPresetsLoading(true);
    setDiversityPresets([]);
    setDiversityLevel(0);
    lastDiversityBaseRef.current = basePrompt;
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedTextModel,
          messages: [{
            role: 'user',
            content: `คุณเป็นผู้เชี่ยวชาญด้าน AI Image Prompt วิเคราะห์ Base Prompt ด้านล่างนี้แล้วสร้างตัวเลือก "ระดับความหลากหลาย" 8 ระดับ ที่เหมาะสมกับสไตล์ของภาพนี้โดยเฉพาะ

Base Prompt:
"${basePrompt}"

กฎสำคัญ:
- ระดับ 1 ต้อง = "คงเดิมทุกอย่าง 100%" (layout, ตัวละคร, สไตล์, แสง ฯลฯ เปลี่ยนแค่อารมณ์/ท่าทาง)
- ระดับ 2-4 = ค่อยๆ เปลี่ยนตัวละคร (หน้า, ชุด, สัญชาติ) แต่ยังคง layout และ art style เดิม
- ระดับ 5-6 = เปลี่ยน art style (เช่น เปลี่ยนเป็นอนิเมะ, การ์ตูน, 3D, watercolor ฯลฯ) แต่ยังคง layout เดิม
- ระดับ 7-8 = เปลี่ยนทั้ง art style + layout ได้อิสระเต็มพิกัด

สำหรับแต่ละระดับ ให้ส่งกลับเป็น JSON array ที่มี 8 object ในรูปแบบ:
[{"label":"📌 ระดับ 1: (อธิบายภาษาไทยสั้นๆ)","instruction":"(คำสั่งภาษาไทยละเอียดที่จะส่งต่อให้ AI วาดภาพ บอกว่าต้องทำอะไรเหมือนเดิม เปลี่ยนอะไรได้)"},...]

ตัวอย่างที่ดี (สำหรับ split-screen movie still):
- ระดับ 1: "คง layout 2 ช่องบนล่าง + ตัวละครเดิมเป๊ะ เปลี่ยนแค่อารมณ์สีหน้า"
- ระดับ 3: "คง layout 2 ช่องบนล่าง + เปลี่ยนตัวละครเป็นคนหน้าใหม่ สัญชาติใหม่"
- ระดับ 5: "คง layout 2 ช่องบนล่าง + เปลี่ยนสไตล์เป็น Anime/การ์ตูนญี่ปุ่น"
- ระดับ 7: "เปลี่ยน layout + art style ได้อิสระ เช่น เป็น 3 ช่อง, panorama, oil painting"

ส่งกลับเป็น JSON array เท่านั้น ไม่ต้องมีคำอธิบายเพิ่ม ไม่ต้องมี markdown`
          }]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      let raw = data.choices[0].message.content.trim();
      // Clean markdown fences
      raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setDiversityPresets(parsed);
        setDiversityLevel(0);
      }
    } catch (e: any) {
      alert('Error generating diversity presets: ' + e.message);
    } finally {
      setDiversityPresetsLoading(false);
    }
  };

  const generateS4Prompts = async () => {
    if (!s4BasePrompt) return alert('กรุณาเลือกลายเส้น (สไตล์รูป) จากคลังก่อนครับ');
    const { openRouterKey } = getApiKeys();
    if (!openRouterKey) return alert('กรุณาใส่ OpenRouter API Key ในแท็บตั้งค่าก่อนครับ');
    const items = s4ContentItems;
    // Extract checked AND unchecked trait texts
    const checkedTraitTexts = extractedTraits.filter(t => t.checked).map(t => t.text);
    const uncheckedTraitTexts = extractedTraits.filter(t => !t.checked).map(t => t.text);
    // Use AI-detected layout instead of fragile regex matching
    const currentLayout = s4Style?.layout || extractedLayout || 'single';
    const hasSplitScreen = currentLayout === 'split-top-bottom' || currentLayout === 'split-left-right';

    setS4IsGenerating(true);
    setS4GeneratedPrompts([]);
    setS4ProgressText('');
    abortS4Ref.current = false;

    try {
      const basePrompt = s4BasePrompt;
      const arFlag = `--ar ${s4SizePreset}`;
      // ลายน้ำชื่อเพจ (optional)
      let sizeDesc = 'small, subtle';
      if (s4WatermarkSize === 'medium') sizeDesc = 'medium-sized, clearly readable (about 1/4 the size of the main caption)';
      if (s4WatermarkSize === 'large') sizeDesc = 'large-sized, prominent (about half the size of the main caption)';

      let posDesc = 'placed randomly in one of the corners';
      if (s4WatermarkPos === 'top-left') posDesc = 'placed at the top left corner';
      if (s4WatermarkPos === 'top-right') posDesc = 'placed at the top right corner';
      if (s4WatermarkPos === 'bottom-left') posDesc = 'placed at the bottom left corner';
      if (s4WatermarkPos === 'bottom-right') posDesc = 'placed at the bottom right corner';
      if (s4WatermarkPos === 'embedded') posDesc = 'embedded creatively and beautifully anywhere within the picture';

      const watermarkLine = s4PageName.trim()
        ? `\nImportant: include a ${sizeDesc} watermark text saying "${s4PageName.trim()}" ${posDesc} (make sure it fits well and does not cover the main subject).`
        : '';
        
      const selectedPreset = diversityPresets[diversityLevel] || null;
      const diversityLine = selectedPreset
        ? `\nImportant variation logic: ${selectedPreset.instruction}\n`
        : '';


      let aiPrompt = '';

      if (items.length > 0) {
        // มีเนื้อหา → สร้าง prompt ต่อรายการ
        const BATCH_SIZE = 10;
        let allPrompts: string[] = [];
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          if (abortS4Ref.current) break;
          const chunk = items.slice(i, i + BATCH_SIZE);
          setS4ProgressText(`(${Math.min(i + BATCH_SIZE, items.length)}/${items.length})`);
          
          // Use Prompt Guide if available (comprehensive AI-written manual)
          // Falls back to raw Thai traits if no guide exists
          const currentGuide = s4Style?.promptGuide || extractedPromptGuide || '';
          
          const exclusionBlock = uncheckedTraitTexts.length > 0
            ? `\n🚫 **ELEMENTS TO EXCLUDE** (The user has UNCHECKED these traits — you MUST NOT include these elements in your prompt. Actively remove them even if they appear in the Base Template):\n${uncheckedTraitTexts.map((t, idx) => `  ❌ ${idx+1}. "${t}"`).join('\n')}\n\nCRITICAL: Read each Thai description above carefully. If the Base Template mentions anything related to these excluded items (e.g., hearts, icons, specific decorations), you MUST remove those elements from your output prompt.\n`
            : '';

          const styleInstructionBlock = currentGuide
            ? `\n━━━━ PROMPT WRITING GUIDE (FOLLOW THIS MANUAL STRICTLY) ━━━━\n${currentGuide}\n━━━━ END OF GUIDE ━━━━\n${exclusionBlock}`
            : (checkedTraitTexts.length > 0 || uncheckedTraitTexts.length > 0
              ? `${checkedTraitTexts.length > 0 ? `\n**MANDATORY VISUAL TRAITS** (you MUST incorporate ALL of the following characteristics into your prompt. Read each Thai description carefully and translate its meaning into appropriate English prompt keywords):\n${checkedTraitTexts.map((t, idx) => `  ${idx+1}. "${t}"`).join('\n')}\n\nIMPORTANT: Your output prompt must clearly reflect EVERY trait listed above. If a trait says the image should NOT have something (e.g., "ไม่มีการแบ่งส่วน" = no splitting), make sure your prompt does NOT include that element.\n` : ''}${exclusionBlock}`
              : '');

          aiPrompt = `You are an expert Image Prompt engineer who creates prompts for AI image generators.

━━━━ STYLE REFERENCE (COPY ONLY THE ART STYLE, NOT THE SCENE) ━━━━
"${basePrompt}"
━━━━ END STYLE REFERENCE ━━━━

⚠️ CRITICAL UNDERSTANDING: The Style Reference above is ONLY for extracting the VISUAL STYLE:
- Art style (e.g., anime, cartoon, watercolor, realistic, etc.)
- Color palette and lighting mood
- Typography style and text placement method
- General composition approach

🚫 DO NOT COPY the specific scene, poses, actions, or character interactions from the Style Reference.
The Style Reference might show "a couple kissing" but that does NOT mean every image should show kissing.
You must CREATE A COMPLETELY DIFFERENT SCENE for each quote based on its MEANING.

${styleInstructionBlock}
━━━━ TASK ━━━━
Create ${chunk.length} image generation prompt(s) in English. For EACH Thai quote below, you must:
1. READ and UNDERSTAND the quote's meaning in Thai
2. IMAGINE a scene that VISUALLY REPRESENTS that meaning (NOT just a generic romantic scene)
3. Use the SAME art style/palette from the Style Reference, but with a COMPLETELY DIFFERENT scene

${chunk.map((q, idx) => {
  const randomFilter = s4EnableRandomFilter ? CINEMATIC_FILTERS[Math.floor(Math.random() * CINEMATIC_FILTERS.length)] : '';
  return `- Quote ${i + idx + 1}: "${q}"${randomFilter ? ` (Mandatory Color grading for this prompt: ${randomFilter})` : ''}`
}).join('\n')}

━━━━ STRICT RULES ━━━━
1. 🎨 STYLE CLONING: Copy ONLY the art style, color palette, lighting, and visual aesthetic from the Style Reference. The rendered image should look like it was drawn by the same artist.
2. 🎬 SCENE CREATION: For EACH quote, create a UNIQUE scene that matches the quote's MEANING and EMOTION. Examples of good interpretation:
   - Quote about loneliness → a person sitting alone watching rain
   - Quote about hope → a person looking up at a sunrise
   - Quote about missing someone → a person staring at an empty chair / a phone
   - Quote about strength → a person climbing a mountain / standing in a storm
   Do NOT default to "couple kissing/hugging" for every quote!
3. 📝 TEXT PLACEMENT: ${hasSplitScreen ? `✂️ SPLIT TEXT RULE (CRITICAL): 
   - Split each Thai quote exactly into TWO MUTUALLY EXCLUSIVE HALVES (Part 1 and Part 2).
   - NEVER put the entire full quote in a single panel. The two parts must not overlap.
   - Example quote: "ความสำเร็จไม่ได้มาเอง ต้องลุกขึ้นไปหามัน"
     ✅ CORRECT: top panel = 'ความสำเร็จไม่ได้มาเอง', bottom panel = 'ต้องลุกขึ้นไปหามัน'
     ❌ WRONG: top panel = 'ความสำเร็จไม่ได้มาเอง ต้องลุกขึ้นไปหามัน', bottom panel = 'ต้องลุกขึ้นไปหามัน'
   - In your prompt: "with exact Thai text typography saying '[Part 1]' at the bottom of the top panel, and '[Part 2]' at the bottom of the bottom panel"` : `Embed the ACTUAL Thai quote using: with exact Thai text typography saying '[paste the actual Thai quote here]' (Important: Render exact Thai text, do not translate to English or any other language)`}
${checkedTraitTexts.length > 0 ? `4. ✅ MANDATORY TRAITS: Your output prompt MUST accurately reflect ALL the mandatory visual traits listed above.` : '4. Follow the art style from the Style Reference.'}
5. ${diversityLine.trim() || '🌈 VARIETY: Each prompt should have a DIFFERENT scene, setting, character pose, and emotional atmosphere.'}
6. Quality: Masterpiece, Cinematic, Highly Detailed. End with ${arFlag}${watermarkLine}
${s4StrictThai ? '7. ⚠️ HIGHEST PRIORITY: Thai text must appear exactly as written, in Thai script. NEVER translate to English/Chinese/Japanese.' : ''}
${s4EnableRandomFilter ? '8. 🎨 COLOR FILTER RULE: I have placed a "(Mandatory Color grading...)" next to each quote above. You MUST integrate that EXACT color tone smoothly into the stylistic description for EACH prompt so that the images have diverse color atmospheres.' : ''}

🚨 COMMON MISTAKE TO AVOID:
- ❌ WRONG: Making all prompts show "a couple kissing/hugging" with only text changes
- ✅ RIGHT: Each prompt has a DIFFERENT scene that matches the quote's meaning, drawn in the same art style

OUTPUT FORMAT RULES:
- Output ${chunk.length} raw prompt(s) separated by ||| (triple pipe)
- Each prompt must be a COMPLETE, STANDALONE image generation prompt
- Do NOT append metadata, quote splits, or explanations after the prompt
- Do NOT add "| Quote Split:" or any suffix — the prompt must end with the --ar flag${watermarkLine ? ' and watermark instruction' : ''}
- No numbering, no explanation, just raw prompts`;

          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: selectedTextModel, messages: [{ role: 'user', content: aiPrompt }] })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
          let out = data.choices[0].message.content.trim().replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
          const prompts = (out.includes('|||') ? out.split('|||') : out.split('\n'))
            .map((p: string) => p.replace(/^\d+[\./\)]\s*/, '').replace(/^"|"$/g, '').trim())
            .filter((p: string) => p.length > 5);
          
          allPrompts = [...allPrompts, ...prompts];
          setS4GeneratedPrompts(allPrompts);
        }
      }

    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally { 
      setS4IsGenerating(false); 
      setS4ProgressText('');
    }
  };

  // ── Generate random prompts WITHOUT quotes (for page decoration) ──
  const generateRandomNoQuote = async () => {
    if (!s4BasePrompt) return alert('กรุณาเลือกลายเส้น (สไตล์รูป) จากคลังก่อนครับ');
    const { openRouterKey } = getApiKeys();
    if (!openRouterKey) return alert('กรุณาใส่ OpenRouter API Key ในแท็บตั้งค่าก่อนครับ');
    const count = Math.max(1, Math.min(50, Number(randomNoQuoteCount) || 5));
    const checkedTraitTexts = extractedTraits.filter(t => t.checked).map(t => t.text);
    const uncheckedTraitTexts = extractedTraits.filter(t => !t.checked).map(t => t.text);
    
    setIsGeneratingRandomNoQuote(true);
    setS4GeneratedPrompts([]);
    setS4ProgressText('');
    abortS4Ref.current = false;

    try {
      const basePrompt = s4BasePrompt;
      const arFlag = `--ar ${s4SizePreset}`;
      let sizeDesc = 'small, subtle';
      if (s4WatermarkSize === 'medium') sizeDesc = 'medium-sized, clearly readable';
      if (s4WatermarkSize === 'large') sizeDesc = 'large-sized, prominent';
      let posDesc = 'placed randomly in one of the corners';
      if (s4WatermarkPos === 'top-left') posDesc = 'placed at the top left corner';
      if (s4WatermarkPos === 'top-right') posDesc = 'placed at the top right corner';
      if (s4WatermarkPos === 'bottom-left') posDesc = 'placed at the bottom left corner';
      if (s4WatermarkPos === 'bottom-right') posDesc = 'placed at the bottom right corner';
      if (s4WatermarkPos === 'embedded') posDesc = 'embedded creatively within the picture';
      const watermarkLine = s4PageName.trim()
        ? `\nImportant: include a ${sizeDesc} watermark text saying "${s4PageName.trim()}" ${posDesc}.`
        : '';
      const selectedPreset = diversityPresets[diversityLevel] || null;
      const diversityLine = selectedPreset
        ? `\nVariation logic: ${selectedPreset.instruction}\n`
        : '';

      const currentGuide = s4Style?.promptGuide || extractedPromptGuide || '';
      const exclusionBlock = uncheckedTraitTexts.length > 0
        ? `\n🚫 **ELEMENTS TO EXCLUDE** (UNCHECKED by user — MUST NOT appear in prompt. Remove from Base Template if present):\n${uncheckedTraitTexts.map((t, idx) => `  ❌ ${idx+1}. "${t}"`).join('\n')}\n`
        : '';

      const styleInstructionBlock = currentGuide
        ? `\n━━━━ PROMPT WRITING GUIDE (FOLLOW THIS MANUAL STRICTLY) ━━━━\n${currentGuide}\n━━━━ END OF GUIDE ━━━━\n${exclusionBlock}`
        : (checkedTraitTexts.length > 0 || uncheckedTraitTexts.length > 0
          ? `${checkedTraitTexts.length > 0 ? `\n**MANDATORY VISUAL TRAITS** (incorporate ALL of these):\n${checkedTraitTexts.map((t, idx) => `  ${idx+1}. "${t}"`).join('\n')}\n` : ''}${exclusionBlock}`
          : '');

      const BATCH_SIZE = 10;
      let allPrompts: string[] = [];
      for (let i = 0; i < count; i += BATCH_SIZE) {
        if (abortS4Ref.current) break;
        const toGen = Math.min(BATCH_SIZE, count - i);
        setS4ProgressText(`(${Math.min(i + toGen, count)}/${count})`);

        const aiPrompt = `You are an expert Image Prompt engineer.

Here is the Base Style Template (use as a STARTING TEMPLATE — copy its ART STYLE, color palette, mood, lighting, and overall aesthetic):
"${basePrompt}"
${styleInstructionBlock}

🎯 TASK: Create ${toGen} UNIQUE image generation prompt(s) in English.

⚠️ CRITICAL RULES:
1. **NO TEXT IN IMAGE**: These images are for PAGE DECORATION ONLY. Do NOT include ANY text, typography, captions, quotes, or watermarks in the image${watermarkLine ? ' (EXCEPT the page watermark specified below)' : ''}.
2. Remove ALL mentions of '[THAI_TEXT]', text overlays, typography, or caption placements from the base template.
3. Keep the EXACT SAME art style, color palette, mood, lighting, and visual aesthetic from the Base Template.
4. Each prompt should depict a DIFFERENT scene/scenario but in the SAME visual style.
5. Vary the scenes creatively: different activities, emotions, settings, times of day, weather, poses — but all in the same art style.
${s4EnableRandomFilter ? '6. 🎨 For each prompt, randomly apply one of these cinematic color grades: ' + CINEMATIC_FILTERS.join(', ') : ''}
${diversityLine}
7. Quality: Masterpiece, Cinematic, Highly Detailed. End each prompt with ${arFlag}${watermarkLine}

📋 SCENE IDEAS TO VARY (pick different ones for each prompt):
- Different romantic/emotional scenarios
- Various outdoor/indoor settings
- Different times of day (sunrise, golden hour, night, rainy day, etc.)
- Various character poses and interactions
- Different seasonal moods

OUTPUT FORMAT:
- Output ${toGen} raw prompt(s) separated by ||| (triple pipe)
- Each prompt must be a COMPLETE, STANDALONE prompt
- No numbering, no explanation, just raw prompts`;

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: selectedTextModel, messages: [{ role: 'user', content: aiPrompt }] })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        let out = data.choices[0].message.content.trim().replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
        const prompts = (out.includes('|||') ? out.split('|||') : out.split('\n'))
          .map((p: string) => p.replace(/^\d+[\./\)]\s*/, '').replace(/^"|"$/g, '').trim())
          .filter((p: string) => p.length > 5);

        allPrompts = [...allPrompts, ...prompts];
        setS4GeneratedPrompts(allPrompts);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setIsGeneratingRandomNoQuote(false);
      setS4ProgressText('');
    }
  };

  // ─── UI ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in pb-20">

      {/* ── GLOBAL SETTINGS BANNER ── */}
      <div className="flex justify-end mb-4">
        <div className="flex items-center gap-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] px-4 py-2 rounded-xl shadow-sm">
          <span className="font-bold whitespace-nowrap text-indigo-400">🤖 โมเดล AI:</span>
          <select 
            value={selectedTextModel}
            onChange={(e) => setSelectedTextModel(e.target.value)}
            className="bg-transparent font-bold text-white outline-none w-[280px] cursor-pointer"
          >
            {TEXT_MODELS.map(m => <option key={m.id} value={m.id} className="bg-gray-800 text-white truncate">{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── SECTION 1: โคลนนิ่งเพจ ── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-8 shadow-sm">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <span className="text-3xl">🖼️</span> ระบบโคลนรูปอัจฉริยะ (Inverse Image)
        </h2>
        <p className="text-sm opacity-70 mb-6">อัพโหลดรูปภาพต้นแบบ ระบบจะแกะแบบแปลน (สไตล์, เลเยอร์, ฟอนต์) และสร้าง Prompt</p>

        {/* Size Preset Bar */}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs font-bold opacity-60 self-center mr-1">📐 ขนาดรูป:</span>
          {SIZE_PRESETS.map(s => (
            <button
              key={s.id}
              onClick={() => setS4SizePreset(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                s4SizePreset === s.id
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                  : 'border-[var(--border-color)] hover:border-indigo-400 opacity-70 hover:opacity-100'
              }`}
            >
              {s.label} <span className="opacity-60 font-normal">{s.desc}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Left: Upload */}
          <div className="w-full md:w-1/3 flex flex-col gap-4">
            <div
              className="aspect-[9/16] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 relative overflow-hidden group cursor-pointer hover:border-indigo-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadedImages.length > 0 ? (
                <div className={`w-full h-full p-2 grid gap-2 overflow-y-auto custom-scrollbar content-start ${uploadedImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {uploadedImages.map((img, idx) => (
                    <img key={idx} src={img} alt={`Source ${idx}`} className="w-full h-auto object-cover rounded-lg shadow-sm" />
                  ))}
                  <div className="col-span-full py-2 mt-auto text-center text-xs font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    + คลิกเพื่อเลือกรูปใหม่ (แนบได้หลายรูป)
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center opacity-50 group-hover:opacity-100 transition-opacity">
                  <div className="text-4xl mb-2">📸</div>
                  <span className="font-bold">อัพโหลดรูปต้นแบบ</span>
                  <span className="text-xs opacity-70 mt-1">คลิกเพื่อเลือกหลายรูปได้</span>
                </div>
              )}
              <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            </div>
            <button
              onClick={analyzeImage}
              disabled={uploadedImages.length === 0 || isAnalyzing}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md transition-all"
            >
              {isAnalyzing ? '⏳ กำลังให้ AI สแกนเลเยอร์ภาพ...' : '🔍 1. สแกนแกะ Prompt'}
            </button>
            {logs.length > 0 && (
              <div className="w-full bg-[#0f111a] border border-gray-800 rounded-xl p-3 shadow-inner flex flex-col">
                <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-2">
                  <span className="text-gray-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
                    <span className="animate-pulse h-1.5 w-1.5 bg-emerald-500 rounded-full"></span>
                    Process Log
                  </span>
                  <button onClick={() => setLogs([])} className="text-gray-500 hover:text-white text-[10px] bg-white/5 px-2 py-0.5 rounded transition">✕ Clear</button>
                </div>
                <div className="font-mono text-[11px] text-emerald-400/90 max-h-32 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                  {logs.map((log, i) => (
                    <div key={i} className="animate-fade-in border-b border-gray-800/50 pb-1 last:border-0 whitespace-pre-wrap">
                      <span className="text-gray-600 mr-2">❯</span>{log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Prompt & Generate */}
          <div className="w-full md:w-2/3 flex flex-col gap-4">
            <div className="flex-1 bg-white dark:bg-black/20 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="font-bold text-sm text-indigo-700 dark:text-indigo-400">📝 แม่พิมพ์ Prompt พื้นฐาน (Base Template)</label>
                <button
                  onClick={generateAndSaveWithGuide}
                  disabled={!extractedPromptBase || isSavingWithGuide}
                  className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded font-bold hover:bg-indigo-200 disabled:opacity-50"
                >
                  {isSavingWithGuide ? '⏳ กำลังสร้างคู่มือ...' : '📖 บันทึกแม่พิมพ์ + สร้างคู่มือ'}
                </button>
              </div>
              <textarea
                value={extractedPromptBase}
                onChange={(e) => setExtractedPromptBase(e.target.value)}
                placeholder="รอผลสแกนรูปภาพจาก AI... แม่พิมพ์หลักจะปรากฏที่นี่"
                className="h-28 w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg p-3 resize-none outline-none text-sm leading-relaxed focus:border-indigo-500"
              />
              {/* ── Extracted Traits Checklist ── */}
              {extractedTraits.length > 0 && (
                <div className="mt-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <label className="font-bold text-xs text-amber-700 dark:text-amber-400">📋 ลักษณะเด่นที่แกะได้ (ติ๊กเลือกข้อที่ต้องการนำไปใช้)</label>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        extractedLayout === 'single' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        extractedLayout.startsWith('split') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        📐 {extractedLayout === 'single' ? 'หน้าเดียว' : 
                             extractedLayout === 'split-top-bottom' ? 'แบ่งบน-ล่าง' :
                             extractedLayout === 'split-left-right' ? 'แบ่งซ้าย-ขวา' :
                             extractedLayout === 'grid' ? 'ตาราง' :
                             extractedLayout === 'collage' ? 'คอลลาจ' : extractedLayout}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setExtractedTraits(prev => prev.map(t => ({...t, checked: true})))} className="text-[10px] text-amber-600 hover:underline">เลือกทั้งหมด</button>
                      <button onClick={() => setExtractedTraits(prev => prev.map(t => ({...t, checked: false})))} className="text-[10px] text-amber-600 hover:underline">ยกเลิกทั้งหมด</button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {extractedTraits.map((trait, idx) => (
                      <label key={idx} className={`flex items-start gap-2 cursor-pointer p-2 rounded-lg transition-colors text-xs leading-relaxed ${
                        trait.checked
                          ? 'bg-amber-100 dark:bg-amber-800/20 text-amber-900 dark:text-amber-200'
                          : 'bg-gray-100 dark:bg-gray-800/30 text-gray-400 dark:text-gray-600 line-through'
                      }`}>
                        <input
                          type="checkbox"
                          checked={trait.checked}
                          onChange={() => setExtractedTraits(prev => prev.map((t, i) => i === idx ? {...t, checked: !t.checked} : t))}
                          className="mt-0.5 accent-amber-500 shrink-0"
                        />
                        <span>{trait.text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {/* ── Prompt Guide Display ── */}
              {extractedPromptGuide && (
                <details className="mt-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/40 rounded-xl overflow-hidden">
                  <summary className="px-3 py-2 cursor-pointer font-bold text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors">
                    📖 คู่มือ Prompt Guide (คลิกเพื่อดู — AI จะอ่านคู่มือนี้ตอนสร้าง Prompt)
                  </summary>
                  <div className="px-3 pb-3">
                    <pre className="text-[11px] text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap leading-relaxed font-mono max-h-48 overflow-y-auto custom-scrollbar bg-white/50 dark:bg-black/20 rounded-lg p-3 mt-1">{extractedPromptGuide}</pre>
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 1.5: Short Clip Structure Clone ── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <span className="text-3xl">🎬</span> ลอกโครงสร้างคลิปสั้น
            </h2>
            <p className="text-sm opacity-70 max-w-4xl">
              อัปโหลดรูปหน้าปกรวมและคลิปตัวอย่างของช่องต้นแบบ ระบบจะแกะฉาก มุมกล้อง ตัวละคร แพทเทิร์นเปิดคลิป ความเสี่ยงซ้ำ และบันทึกเป็นสมองสำหรับสร้าง Prompt ใหม่ที่ไม่ลอกตรงๆ
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface, transparent)' }}>
            <span className="font-bold text-purple-400">Vision:</span>
            <span>GPT-4o สำหรับแกะภาพ/เฟรมคลิป</span>
          </div>
        </div>

        <div className="rounded-2xl border p-4 mb-5" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <div className="text-xs font-bold text-purple-300 mb-2">ลิงก์หลักชุดอ้างอิง</div>
              <input
                value={shortMasterLink}
                onChange={e => {
                  setShortMasterLink(e.target.value);
                  setShortCoverLink(e.target.value);
                  setShortClipLink(e.target.value);
                }}
                placeholder="ใส่ลิงก์ช่อง/โปรไฟล์ครั้งเดียว แล้วโหลดได้ทั้งรูปปกและคลิปล่าสุด"
                className="w-full px-3 py-2.5 rounded-xl border bg-transparent text-sm outline-none"
                style={{ borderColor: 'var(--border-color)' }}
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[10px] opacity-70">
                จำนวนปก
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={shortCoverLimit}
                  onChange={e => setShortCoverLimit(e.target.value === '' ? '' : Number(e.target.value))}
                  className="block w-20 mt-1 px-2 py-2 rounded-lg border bg-transparent text-center text-xs outline-none"
                  style={{ borderColor: 'var(--border-color)' }}
                />
              </label>
              <label className="text-[10px] opacity-70">
                คลิปล่าสุด
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={shortLatestCount}
                  onChange={e => setShortLatestCount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="block w-20 mt-1 px-2 py-2 rounded-lg border bg-transparent text-center text-xs outline-none"
                  style={{ borderColor: 'var(--border-color)' }}
                />
              </label>
              <button
                onClick={loadShortReferenceBundle}
                disabled={shortBatchLoading || !shortMasterLink.trim()}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white"
              >
                {shortBatchLoading ? 'กำลังโหลดชุด...' : 'โหลดปก + คลิปล่าสุด'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-3 mt-3 items-end">
            <input
              value={shortReferenceSetName}
              onChange={e => setShortReferenceSetName(e.target.value)}
              placeholder="ตั้งชื่อชุดอ้างอิง เช่น ช่องแมวตลกแนวมินิ"
              className="w-full px-3 py-2 rounded-xl border bg-transparent text-sm outline-none"
              style={{ borderColor: 'var(--border-color)' }}
            />
            <button
              onClick={saveCurrentShortReferenceSet}
              disabled={shortCoverImages.length === 0 && shortClipRefs.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white"
            >
              บันทึกชุดนี้ไว้ใช้ทีหลัง
            </button>
          </div>

          {shortReferenceSets.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-bold opacity-70 mb-2">ชุดอ้างอิงที่บันทึกไว้</div>
              <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                {shortReferenceSets.map(set => (
                  <div key={set.id} className="min-w-[260px] rounded-xl border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{set.name}</div>
                        <div className="text-[10px] opacity-55 truncate">{set.sourceUrl || 'ไม่มีลิงก์ต้นทาง'}</div>
                      </div>
                      <button onClick={() => deleteShortReferenceSet(set.id, set.name)} className="text-red-400 text-xs">×</button>
                    </div>
                    <div className="flex -space-x-2 mb-3 h-9">
                      {set.coverImages.slice(0, 4).map((img, idx) => (
                        <img key={idx} src={img} className="w-9 h-9 rounded-lg object-cover border border-black/40" />
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] opacity-60">{set.coverImages.length} ปก · {set.clipRefs.length} คลิป</span>
                      <button onClick={() => loadShortReferenceSet(set)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-cyan-700 hover:bg-cyan-600 text-white">
                        เรียกใช้
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-cyan-400">1. รูปรวมหน้าปกคลิป</h3>
              <div className="flex items-center gap-2">
                {shortCoverImages.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                    {shortCoverImages.length} รูป
                  </span>
                )}
                <button
                  onClick={() => setShortCoverCollapsed(v => !v)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted, #888)' }}
                  title={shortCoverCollapsed ? 'ขยายแถบรูปปก' : 'ย่อแถบรูปปก'}
                >
                  {shortCoverCollapsed ? '▴ ขยาย' : '▾ ย่อ'}
                </button>
                <button onClick={() => shortCoverInputRef.current?.click()} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-700 hover:bg-cyan-600 text-white">
                  อัปโหลดรูป
                </button>
                <input ref={shortCoverInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleShortCoverUpload} />
              </div>
            </div>
            <div className="mb-3 rounded-xl border p-2.5" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
              <input
                value={shortCoverLink}
                onChange={e => setShortCoverLink(e.target.value)}
                placeholder="วางลิงก์ช่อง/โปรไฟล์ เพื่อดึงรูปปกอัตโนมัติ"
                className="w-full px-3 py-2 rounded-lg border bg-transparent text-xs outline-none mb-2"
                style={{ borderColor: 'var(--border-color)' }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] opacity-60">ดึง</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={shortCoverLimit}
                  onChange={e => setShortCoverLimit(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-14 px-1.5 py-1 rounded border bg-transparent text-center text-[11px] outline-none"
                  style={{ borderColor: 'var(--border-color)' }}
                />
                <span className="text-[10px] opacity-60">รูป</span>
                <button
                  onClick={fetchShortCoversFromLink}
                  disabled={shortCoverFetching || !shortCoverLink.trim()}
                  className="ml-auto px-3 py-1.5 rounded-lg text-[11px] font-bold bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white"
                >
                  {shortCoverFetching ? 'กำลังดึง...' : '🔎 ดึงรูปปกจากช่อง'}
                </button>
              </div>
            </div>
            {shortCoverCollapsed && shortCoverImages.length > 0 ? (
              <button
                onClick={() => setShortCoverCollapsed(false)}
                className="w-full rounded-xl border px-3 py-3 text-left hover:border-cyan-500 transition-all"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(8,145,178,0.08)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-cyan-300">แถบรูปปกถูกย่ออยู่</div>
                    <div className="text-xs opacity-60 mt-0.5">มีรูปปก {shortCoverImages.length} รูป พร้อมใช้ให้ AI วิเคราะห์</div>
                  </div>
                  <div className="flex -space-x-2 overflow-hidden max-w-[180px]">
                    {shortCoverImages.slice(0, 5).map((img, idx) => (
                      <img key={idx} src={img} className="w-10 h-10 rounded-lg object-cover border border-black/40" />
                    ))}
                  </div>
                </div>
              </button>
            ) : shortCoverImages.length === 0 ? (
              <div className="aspect-video rounded-xl border-2 border-dashed flex items-center justify-center text-sm opacity-50" style={{ borderColor: 'var(--border-color)' }}>
                วางรูป screenshot หน้าช่อง/หน้าปกรวม หรือดึงจากลิงก์ช่องด้านบน
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(8,145,178,0.08)' }}>
                  <span className="text-xs font-bold text-cyan-300">Preview รูปปกที่ดึงมา</span>
                  <button onClick={() => { if (confirm('ลบรูปปกทั้งหมด?')) setShortCoverImages([]); }} className="text-[10px] text-red-400 hover:underline">
                    ลบทั้งหมด
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto custom-scrollbar p-2">
                  {shortCoverImages.map((img, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden bg-black/20">
                      <img src={img} className="w-full aspect-video object-cover rounded-lg border" style={{ borderColor: 'var(--border-color)' }} />
                      <div className="absolute bottom-1 left-1 text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded">#{idx + 1}</div>
                      <button onClick={() => setShortCoverImages(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-black/70 text-white text-xs rounded px-1 opacity-0 group-hover:opacity-100">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-amber-400">2. คลิปตัวอย่าง</h3>
              <button onClick={() => shortVideoInputRef.current?.click()} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white">
                อัปโหลดคลิป
              </button>
              <input ref={shortVideoInputRef} type="file" accept="video/*" multiple className="hidden" onChange={handleShortVideoUpload} />
            </div>

            <div className="mb-3 rounded-xl border p-2.5" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
              <input
                value={shortClipLink}
                onChange={e => setShortClipLink(e.target.value)}
                placeholder="วางลิงก์คลิป หรือ URL ช่อง/โปรไฟล์"
                className="w-full px-3 py-2 rounded-lg border bg-transparent text-xs outline-none mb-2"
                style={{ borderColor: 'var(--border-color)' }}
              />
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => downloadShortClipsFromLink('single')}
                  disabled={!!shortDownloading || !shortClipLink.trim()}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white"
                >
                  {shortDownloading === 'single' ? 'กำลังโหลด...' : '⬇️ โหลดคลิปจากลิงก์'}
                </button>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] opacity-60">ล่าสุด</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={shortLatestCount}
                    onChange={e => setShortLatestCount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-12 px-1.5 py-1 rounded border bg-transparent text-center text-[11px] outline-none"
                    style={{ borderColor: 'var(--border-color)' }}
                  />
                  <span className="text-[10px] opacity-60">คลิป</span>
                </div>
                <button
                  onClick={() => downloadShortClipsFromLink('latest')}
                  disabled={!!shortDownloading || !shortClipLink.trim()}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white"
                  title="ใช้กับลิงก์ช่อง/โปรไฟล์/playlist แล้วให้ yt-dlp โหลดคลิปล่าสุดตามจำนวน"
                >
                  {shortDownloading === 'latest' ? 'กำลังโหลดล่าสุด...' : '⚡ โหลดคลิปล่าสุด'}
                </button>
              </div>
            </div>

            {shortClipRefs.length === 0 ? (
              <div className="aspect-video rounded-xl border-2 border-dashed flex items-center justify-center text-sm opacity-50" style={{ borderColor: 'var(--border-color)' }}>
                อัปโหลดได้หลายคลิป ระบบจะดึงเฟรมตัวอย่างให้ AI อ่าน
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {shortClipRefs.map((clip, idx) => (
                  <div key={clip.id} className="rounded-xl border p-2" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex gap-2">
                      {clip.thumbnail ? (
                        <img src={clip.thumbnail} className="w-20 h-28 object-cover rounded-lg flex-shrink-0" />
                      ) : (
                        <div className="w-20 h-28 rounded-lg bg-black/30 flex items-center justify-center text-xs opacity-50 flex-shrink-0">no frame</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs font-bold truncate">{idx + 1}. {clip.name}</div>
                          <button onClick={() => setShortClipRefs(prev => prev.filter(c => c.id !== clip.id))} className="text-red-400 text-xs">×</button>
                        </div>
                        <textarea
                          value={clip.note}
                          onChange={e => updateShortClipNote(clip.id, e.target.value)}
                          placeholder="note เพิ่มเติม: เปิดคลิปยังไง ตัวละครทำอะไร มี transition อะไร..."
                          className="mt-2 w-full h-16 rounded-lg border bg-transparent p-2 text-[11px] outline-none resize-none"
                          style={{ borderColor: 'var(--border-color)' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
            <h3 className="font-bold text-sm text-emerald-400 mb-3">3. ตัวละครใหม่ (ไม่บังคับ)</h3>
            <textarea
              value={shortNewCharacter}
              onChange={e => setShortNewCharacter(e.target.value)}
              placeholder="เช่น เด็กผู้ชายไทยอายุ 8 ขวบกับมังกรจิ๋ว, แมวป่าตัวเล็กสมจริง, หุ่นยนต์แม่บ้านยุคอนาคต..."
              className="w-full h-24 rounded-xl border bg-transparent p-3 text-sm outline-none resize-none mb-3"
              style={{ borderColor: 'var(--border-color)' }}
            />
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => shortCharacterInputRef.current?.click()} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white">
                อัปโหลดหน้าตาตัวละคร
              </button>
              <input ref={shortCharacterInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleShortCharacterUpload} />
              <span className="text-[11px] opacity-60">{shortCharacterImages.length}/6 รูป</span>
            </div>
            {shortCharacterImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {shortCharacterImages.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img src={img} className="w-full aspect-square object-cover rounded-lg border" style={{ borderColor: 'var(--border-color)' }} />
                    <button onClick={() => removeShortCharacter(idx)} className="absolute top-1 right-1 bg-black/70 text-white text-xs rounded px-1 opacity-0 group-hover:opacity-100">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <input
            value={shortAnalysisName}
            onChange={e => setShortAnalysisName(e.target.value)}
            placeholder="ตั้งชื่อสมอง เช่น ช่องสัตว์จิ๋วแนวอบอุ่น"
            className="min-w-[260px] flex-1 px-4 py-2 rounded-xl border bg-transparent text-sm outline-none"
            style={{ borderColor: 'var(--border-color)' }}
          />
          <button
            onClick={analyzeShortClipStructure}
            disabled={shortAnalyzing}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold shadow"
          >
            {shortAnalyzing ? 'กำลังแกะสมองโครงสร้าง...' : 'ให้ AI แกะโครงสร้างช่องนี้'}
          </button>
          <button
            onClick={saveShortClipBrain}
            disabled={!shortAnalysis || shortSavingBrain}
            className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold shadow"
          >
            {shortSavingBrain ? 'กำลังบันทึกสมอง...' : 'บันทึกเป็นสมอง'}
          </button>
        </div>

        {savedBrains.filter(brain => brain.outputType === 'short-video-structure').length > 0 && (
          <div className="rounded-xl border p-4 mb-6" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-bold text-sm">สมองคลิปสั้นที่บันทึกไว้</h3>
                <p className="text-[11px] opacity-60 mt-0.5">เก็บอยู่ใน public/app_data/brains.json และเรียกกลับมาใช้สร้าง Prompt ได้จากตรงนี้</p>
              </div>
              <span className="text-[10px] px-2 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                {savedBrains.filter(brain => brain.outputType === 'short-video-structure').length} ชุด
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
              {savedBrains
                .filter(brain => brain.outputType === 'short-video-structure')
                .slice()
                .reverse()
                .map(brain => (
                  <div key={brain.id} className="min-w-[260px] rounded-xl border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{brain.name}</div>
                        <div className="text-[10px] opacity-55">{new Date(brain.timestamp).toLocaleString('th-TH')}</div>
                      </div>
                      <button onClick={() => deleteSavedBrain(brain.id, brain.name)} className="text-red-400 text-xs">×</button>
                    </div>
                    <div className="text-[10px] opacity-60 line-clamp-2 mb-3">
                      {brain.shortAnalysis?.summary || brain.content.split('Summary:\n')[1]?.split('\n\n')[0] || 'สมองโครงสร้างคลิปสั้น'}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => navigator.clipboard.writeText(brain.content)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-700 hover:bg-indigo-600 text-white">
                        ก๊อป
                      </button>
                      <button onClick={() => loadSavedShortClipBrain(brain)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-cyan-700 hover:bg-cyan-600 text-white">
                        เรียกใช้
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {shortAnalysis && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                ['คะแนนช่อง', shortAnalysis.channelScore, '#60a5fa'],
                ['ความคิดสร้างสรรค์', shortAnalysis.creativityScore, '#10b981'],
                ['ความเสี่ยงแพทเทิร์นซ้ำ', shortAnalysis.blockRiskScore, '#ef4444'],
              ].map(([label, score, color]) => (
                <div key={label as string} className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                  <div className="text-xs opacity-60 font-bold">{label}</div>
                  <div className="text-3xl font-black mt-1" style={{ color: color as string }}>{score as number}/10</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
              <h3 className="font-bold mb-2">สรุปช่อง</h3>
              <p className="text-sm opacity-80 leading-relaxed">{shortAnalysis.summary}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[
                ['ฉากที่พบ', shortAnalysis.scenes],
                ['มุมกล้อง', shortAnalysis.cameraAngles],
                ['ตัวละคร/วัตถุหลัก', shortAnalysis.mainCharacters],
                ['สูตรเปิดคลิป', shortAnalysis.openingPatterns],
                ['สูตรหน้าปก', shortAnalysis.thumbnailPatterns],
                ['จุดเสี่ยงซ้ำ', shortAnalysis.repetitionRisks],
                ['โอกาสสร้างสรรค์เพิ่ม', shortAnalysis.creativeOpportunities],
              ].map(([title, items]) => (
                <div key={title as string} className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                  <h4 className="font-bold text-sm mb-2">{title as string}</h4>
                  <div className="space-y-1.5">
                    {(items as string[]).map((item, idx) => (
                      <div key={idx} className="text-xs opacity-80 leading-relaxed">• {item}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">องค์ประกอบที่จะเก็บไว้ในสมอง</h3>
                <div className="flex gap-2">
                  <button onClick={() => setShortAnalysis(prev => prev ? { ...prev, elements: prev.elements.map(el => ({ ...el, checked: true })) } : prev)} className="text-xs text-amber-400 hover:underline">เลือกทั้งหมด</button>
                  <button onClick={() => setShortAnalysis(prev => prev ? { ...prev, elements: prev.elements.map(el => ({ ...el, checked: false })) } : prev)} className="text-xs text-amber-400 hover:underline">ยกเลิกทั้งหมด</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {shortAnalysis.elements.map(el => (
                  <label key={el.id} className={`p-3 rounded-xl border cursor-pointer transition-all ${el.checked ? 'border-amber-500 bg-amber-500/10' : 'border-gray-700 opacity-50'}`}>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" checked={el.checked} onChange={() => toggleShortElement(el.id)} className="mt-1 accent-amber-500" />
                      <div>
                        <div className="text-sm font-bold">{el.label}</div>
                        <div className="text-xs opacity-70 mt-1 leading-relaxed">{el.detail}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">{shortPromptMode === 'storyboard' ? 'สร้างเรื่องจากสมองนี้' : 'สร้าง Prompt จากสมองนี้'}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] opacity-60">{shortPromptMode === 'storyboard' ? 'จำนวนเรื่อง' : 'จำนวน Prompt'}</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={shortPromptCount}
                    onChange={e => setShortPromptCount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-16 px-2 py-1 rounded-lg border bg-transparent text-center text-sm outline-none"
                    style={{ borderColor: 'var(--border-color)' }}
                  />
                  <button onClick={generateShortClipPrompts} disabled={shortGeneratingPrompts || (shortFixCharacters && shortCharacterImages.length === 0)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold">
                    {shortGeneratingPrompts
                      ? `${shortPromptMode === 'storyboard' ? 'กำลังสร้างเรื่อง' : 'กำลังสร้าง'} ${shortGeneratedPrompts.length}/${shortPromptMode === 'storyboard' ? (Number(shortPromptCount) || 1) * Math.max(2, Math.min(12, Number(shortStoryboardSceneCount) || 4)) : (Number(shortPromptCount) || 1)}`
                      : (shortPromptMode === 'storyboard' ? 'สร้างเรื่อง' : 'สร้าง Prompt')}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border p-3 mb-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(0,0,0,0.12)' }}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-sm mb-1">รูปแบบ Prompt</div>
                    <div className="text-[11px] opacity-65">
                      {shortPromptMode === 'storyboard'
                        ? `Storyboard ${Math.max(2, Math.min(12, Number(shortStoryboardSceneCount) || 4))} ฉาก · ประมาณ ${Math.max(2, Math.min(12, Number(shortStoryboardSceneCount) || 4)) * 8} วินาทีต่อคลิป · รวม ${Math.max(2, Math.min(12, Number(shortStoryboardSceneCount) || 4)) * 8 * (Number(shortPromptCount) || 1)} วินาที`
                        : 'สุ่มธรรมดา · prompt เดี่ยวสำหรับคลิปสั้นประมาณ 8 วินาที'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                      <button
                        onClick={() => setShortPromptMode('random')}
                        className={`px-3 py-2 text-xs font-bold ${shortPromptMode === 'random' ? 'bg-indigo-600 text-white' : 'bg-transparent opacity-70'}`}
                      >
                        สุ่มธรรมดา
                      </button>
                      <button
                        onClick={() => setShortPromptMode('storyboard')}
                        className={`px-3 py-2 text-xs font-bold ${shortPromptMode === 'storyboard' ? 'bg-amber-600 text-white' : 'bg-transparent opacity-70'}`}
                      >
                        Storyboard
                      </button>
                    </div>
                    {shortPromptMode === 'storyboard' && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] opacity-60">ฉาก/คลิป</span>
                        <input
                          type="number"
                          min={2}
                          max={12}
                          value={shortStoryboardSceneCount}
                          onChange={e => setShortStoryboardSceneCount(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-16 px-2 py-1.5 rounded-lg border bg-transparent text-center text-sm outline-none"
                          style={{ borderColor: 'var(--border-color)' }}
                        />
                        <span className="text-[11px] opacity-60">ฉากละ ~8s</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-4">
                <div className={`rounded-xl border p-3 ${shortFixCharacters ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-700 bg-black/10'}`}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <div className="font-bold text-sm">Fix ตัวละครหลัก</div>
                      <div className="text-[11px] opacity-65 mt-0.5">เปิดแล้วทุก{shortPromptMode === 'storyboard' ? 'เรื่อง' : ' Prompt'}จะใช้รูปตัวละครที่อัปโหลดเป็นตัวหลักครบทุกตัว</div>
                    </div>
                    <button
                      onClick={() => setShortFixCharacters(v => !v)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${shortFixCharacters ? 'bg-emerald-500' : 'bg-gray-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${shortFixCharacters ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <button onClick={() => shortCharacterInputRef.current?.click()} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white">
                      อัปโหลดรูปตัวละคร
                    </button>
                    <span className="text-[11px] opacity-65">{shortCharacterImages.length}/6 ตัวละคร</span>
                    {shortFixCharacters && shortCharacterImages.length === 0 && (
                      <span className="text-[11px] text-red-300">ต้องมีรูปก่อน{shortPromptMode === 'storyboard' ? 'สร้างเรื่อง' : 'สร้าง Prompt'}</span>
                    )}
                  </div>
                  {shortCharacterImages.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                      {shortCharacterImages.map((img, idx) => (
                        <div key={idx} className="rounded-lg border p-2" style={{ borderColor: 'var(--border-color)' }}>
                          <div className="relative group mb-2">
                            <img src={img} className="w-full aspect-square rounded-lg object-cover border" style={{ borderColor: 'var(--border-color)' }} />
                            <div className="absolute bottom-1 left-1 text-[9px] bg-black/70 text-white px-1 rounded">Character {idx + 1}</div>
                            <button onClick={() => removeShortCharacter(idx)} className="absolute top-1 right-1 bg-black/70 text-white text-xs rounded px-1 opacity-0 group-hover:opacity-100">×</button>
                          </div>
                          <textarea
                            value={shortCharacterNotes[idx] || ''}
                            onChange={e => updateShortCharacterNote(idx, e.target.value)}
                            placeholder={`อธิบาย Character ${idx + 1}: เช่น แมวสีขาว ขนฟู ตาสีฟ้า ตัวเล็ก ใส่ปลอกคอแดง...`}
                            className="w-full h-20 rounded-lg border bg-transparent p-2 text-[10px] outline-none resize-none"
                            style={{ borderColor: 'var(--border-color)' }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`rounded-xl border p-3 ${shortSoraMode ? 'border-cyan-400 bg-cyan-500/10' : 'border-gray-700 bg-black/10'}`}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <div className="font-bold text-sm">โหมดความสมจริง SORA-2</div>
                      <div className="text-[11px] opacity-65 mt-0.5">ใช้ชุด realism modifiers จาก Video Prompt Generator เพื่อให้ภาพดิบและสมจริงขึ้น</div>
                    </div>
                    <button
                      onClick={() => setShortSoraMode(v => !v)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${shortSoraMode ? 'bg-cyan-500' : 'bg-gray-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${shortSoraMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {shortSoraMode && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                      {SORA_MODIFIERS.map(mod => (
                        <label key={mod.id} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer ${shortActiveSoraMods.includes(mod.id) ? 'border-cyan-400 bg-cyan-400/10' : 'border-cyan-400/15 bg-black/20'}`}>
                          <input
                            type="checkbox"
                            checked={shortActiveSoraMods.includes(mod.id)}
                            onChange={e => {
                              if (e.target.checked) setShortActiveSoraMods(prev => Array.from(new Set([...prev, mod.id])));
                              else setShortActiveSoraMods(prev => prev.filter(id => id !== mod.id));
                            }}
                            className="mt-0.5 accent-cyan-400"
                          />
                          <div>
                            <div className="text-[11px] font-bold">{mod.label}</div>
                            <div className="text-[10px] opacity-60 leading-snug">{mod.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {shortGeneratedPrompts.length > 0 && (
                <div className="space-y-3">
                  {shortGeneratedPrompts.map((prompt, idx) => (
                    <div key={idx} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(0,0,0,0.18)' }}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-indigo-300">{shortPromptMode === 'storyboard' ? (prompt.split('\n')[0] || `Scene Prompt #${idx + 1}`) : `Prompt #${idx + 1}`}</span>
                        <button onClick={() => navigator.clipboard.writeText(prompt)} className="text-xs px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white font-bold">คัดลอก</button>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto custom-scrollbar">{prompt}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 2: Brain Studio ── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold flex items-center gap-2"><span className="text-3xl">🧠</span> สร้างสมอง (Brain Studio)</h2>
        </div>
        <p className="text-sm opacity-70 mb-6">วางตัวอย่างแคปชั่นจากเพจ แต่ละกล่องคือตัวอย่างแยกกัน 1 กล่อง = 1 ตัวอย่าง — AI จะแกะสไตล์และสร้าง System Prompt</p>

        <div className="flex flex-col gap-3 mb-4">
          {customCaptions.map((cap, idx) => (
            <div key={idx} className="relative group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 ml-1">📝 ตัวอย่างแคปชั่นที่ {idx + 1}</span>
                {customCaptions.length > 1 && (
                  <button onClick={() => setCustomCaptions(customCaptions.filter((_, i) => i !== idx))} className="text-[11px] px-2 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200 font-bold">✕ ลบ</button>
                )}
              </div>
              <textarea
                value={cap}
                onChange={(e) => { const arr = [...customCaptions]; arr[idx] = e.target.value; setCustomCaptions(arr); }}
                placeholder={`วางตัวอย่างแคปชั่นที่ ${idx + 1} ที่นี่...\nอาจเป็นโพสยาวๆ หรือสั้นๆ ก็ได้ แต่ละกล่องคือตัวอย่างแยกกัน`}
                className="w-full min-h-[100px] bg-gray-50 border border-gray-300 dark:bg-gray-900/50 dark:border-gray-700 rounded-xl p-3 text-sm focus:border-amber-500 outline-none resize-y"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="file"
            accept=".csv"
            ref={brainCsvInputRef}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const text = ev.target?.result as string;
                const items = parseCSVColumn(text, 0);
                if (items.length > 0) {
                  // Filter out empty boxes, append new items
                  const existing = customCaptions.filter(c => c.trim());
                  setCustomCaptions([...existing, ...items]);
                }
              };
              reader.readAsText(file, 'UTF-8');
              e.target.value = ''; // reset
            }}
          />
          <button onClick={() => setCustomCaptions([...customCaptions, ''])} className="px-4 py-2 text-sm font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/10 rounded-xl border border-dashed border-amber-300 transition-all">
            + เพิ่มกล่องตัวอย่างใหม่
          </button>
          <button onClick={() => brainCsvInputRef.current?.click()} className="px-4 py-2 text-sm font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/10 rounded-xl border border-dashed border-blue-300 transition-all">
            📥 อัปโหลด CSV
          </button>
          {customCaptions.length > 1 || customCaptions[0] !== '' ? (
            <button onClick={() => { if(confirm('ยืนยันลบตัวอย่างแคปชั่นทั้งหมด?')) setCustomCaptions(['']); }} className="px-4 py-2 text-sm font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 rounded-xl border border-dashed border-red-300 transition-all">
              🗑️ ลบทั้งหมด
            </button>
          ) : null}
          {customCaptions.filter(c => c.trim()).length > 0 && (
            <button onClick={generateSystemPrompt} disabled={isGeneratingSystemPrompt} className="px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 text-sm font-bold rounded-xl flex items-center gap-2 shadow-md disabled:opacity-50">
              {isGeneratingSystemPrompt ? '⏳ กำลังแกะสูตร...' : '🧠 ให้ AI แกะสูตรแคปชั่นเป็น SystemPrompt'}
            </button>
          )}
        </div>

        {generatedSystemPrompt && (
          <div className="mb-6 bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-gray-300">⚙️ System Prompt ที่ได้</span>
              <div className="flex gap-2">
                <button onClick={() => { setShowSaveBrainModal(true); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg flex items-center gap-1 font-bold">
                  💾 บันทึกสมองไว้ใช้
                </button>
                <button onClick={() => navigator.clipboard.writeText(generatedSystemPrompt)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg flex items-center gap-1 font-bold">
                  📋 คัดลอก
                </button>
              </div>
            </div>
            <textarea readOnly value={generatedSystemPrompt} className="w-full h-48 bg-black/50 text-emerald-400 text-xs font-mono p-3 rounded-lg resize-none outline-none custom-scrollbar border border-gray-800" />
          </div>
        )}

        {/* Saved Brains List */}
        {savedBrains.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base flex items-center gap-2"><span>📚</span> สมองที่บันทึกไว้ ({savedBrains.length} ชุด)</h3>
              <button onClick={refreshSavedBrains} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">🔄 รีเฟรช</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {savedBrains.map((brain) => {
                const isGenerating = brainGenerating === brain.id;
                const genResults = brainGenResults[brain.id] || [];
                return (
                  <div key={brain.id} className="group bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                          🧠 {brain.name}
                        </div>
                        {brain.timestamp && (
                          <div className="text-[10px] text-gray-400 mt-0.5">บันทึกเมื่อ {new Date(brain.timestamp).toLocaleString('th-TH')}</div>
                        )}
                      </div>
                      <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                        {/* Count + Generate button */}
                        <div className="flex items-center gap-1 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={brainGenCount}
                            onChange={(e) => setBrainGenCount(e.target.value === '' ? '' : Number(e.target.value))}
                            onBlur={() => setBrainGenCount(Math.max(1, Math.min(200, Number(brainGenCount) || 1)))}
                            className="w-12 px-1.5 py-1 text-center text-xs font-bold bg-gray-50 dark:bg-gray-800 outline-none border-r border-gray-200 dark:border-gray-700"
                            title="จำนวนแคปชั่น/หัวข้อ"
                          />
                          {isGenerating ? (
                            <button
                              onClick={() => { abortBrainRef.current = true; }}
                              className="px-2.5 py-1 text-[11px] font-bold transition flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white"
                            >
                              🛑 หยุด {brainGenProgress[brain.id]}
                            </button>
                          ) : (
                            <button
                              onClick={() => generateFromBrain(brain)}
                              className="px-2.5 py-1 text-[11px] font-bold transition flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-white"
                            >
                              ✨ สร้างแคปชั่น
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            section4Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition"
                        >
                          🎯 ไปสร้างคอนเทนต์
                        </button>
                        <button onClick={() => navigator.clipboard.writeText(brain.content).then(() => alert(`📋 คัดลอกสมอง "${brain.name}" แล้ว`))} className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-[11px] font-bold hover:bg-indigo-200 transition">📋 ก๊อป</button>
                        <button onClick={() => deleteSavedBrain(brain.id, brain.name)} className="px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-[11px] font-bold hover:bg-red-200 transition" title="ลบ">🗑️</button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">{brain.content.substring(0, 180)}{brain.content.length > 180 ? '...' : ''}</p>

                    {/* Generated results panel */}
                    {genResults.length > 0 && (
                      <div className="mt-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
                            ✨ แคปชั่นที่สร้างได้ ({genResults.length})
                          </span>
                          <div className="flex gap-1.5">
                            {/* Copy all → paste into S4 */}
                            <button
                              onClick={() => {
                                setS4PasteText(genResults.join('\n'));
                                section4Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }}
                              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold"
                            >
                              🚀 โยนไป Section 4
                            </button>
                            <button
                              onClick={() => navigator.clipboard.writeText(genResults.join('\n')).then(() => alert('📋 คัดลอกทั้งหมดแล้ว!'))}
                              className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-[10px] font-bold hover:bg-gray-300 dark:hover:bg-gray-600"
                            >
                              📋 ก๊อปทั้งหมด
                            </button>
                            <button
                              onClick={() => setBrainGenResults(prev => ({ ...prev, [brain.id]: [] }))}
                              className="px-2 py-1 text-gray-400 hover:text-red-500 rounded-lg text-[10px] font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                          {genResults.map((item, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-700/50 group/item hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer"
                              onClick={() => navigator.clipboard.writeText(item).then(() => {})}
                            >
                              <span className="text-[10px] font-bold text-gray-400 shrink-0 mt-0.5 w-5">{i + 1}.</span>
                              <p className="text-xs flex-1 leading-relaxed">{item}</p>
                              <button
                                className="shrink-0 px-2 py-0.5 text-[10px] font-bold text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded opacity-0 group-hover/item:opacity-100 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item); }}
                              >
                                📋
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 3: Headline & Writing Style Studio ── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold flex items-center gap-2"><span className="text-3xl">📰</span> สไตล์พาดหัว & การเขียน (Headline & Writing Style)</h2>
        </div>
        <p className="text-sm opacity-70 mb-6">วางตัวอย่างพาดหัวหรือบทความจากเพจต้นแบบ → AI แกะสูตร → บันทึกไว้ใช้ในหน้า "สร้างรูปลงเพจ AI" (ข้อมูลบันทึกลงไฟล์ Git-syncable)</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ─── ส่วน A: สไตล์พาดหัว ─── */}
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <span>🔥</span> สไตล์พาดหัว (Headline Packs)
            </h3>

            <textarea
              value={hlPasteText}
              onChange={(e) => setHlPasteText(e.target.value)}
              placeholder={`วางตัวอย่างพาดหัวจากเพจต้นแบบ (บรรทัดละ 1 พาดหัว)\nเช่น:\n🚨 ด่วน! แบงก์ชาติหั่นดอกเบี้ย หุ้นพุ่ง!\n💰 3 วิธีออมเงินที่คนรวยไม่เคยบอก\n⚡ Bitcoin ทะลุแสน จะซื้อหรือจะขาย?`}
              className="w-full min-h-[120px] bg-gray-50 border border-gray-300 dark:bg-gray-900/50 dark:border-gray-700 rounded-xl p-3 text-sm focus:border-orange-500 outline-none resize-y mb-3"
            />

            <div className="flex flex-wrap gap-2 mb-4">
              <input type="file" accept=".csv" ref={hlCsvInputRef} className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const text = ev.target?.result as string;
                  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                  if (lines.length > 1) setHlPasteText(prev => prev ? prev + '\n' + lines.slice(1).join('\n') : lines.slice(1).join('\n'));
                };
                reader.readAsText(file, 'UTF-8');
                e.target.value = '';
              }} />
              <button onClick={() => hlCsvInputRef.current?.click()} className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/10 rounded-lg border border-dashed border-blue-300">
                📥 อัปโหลด CSV
              </button>
              <button
                onClick={async () => {
                  const lines = hlPasteText.split('\n').map(l => l.trim()).filter(Boolean);
                  if (lines.length === 0) return alert('กรุณาวางตัวอย่างพาดหัวก่อน');
                  const { openRouterKey } = getApiKeys();
                  if (!openRouterKey) return alert('กรุณาใส่ OpenRouter API Key');
                  setHlIsAnalyzing(true);
                  try {
                    const prompt = `คุณเป็นผู้เชี่ยวชาญด้าน Social Media Copywriting\n\nวิเคราะห์พาดหัวเหล่านี้แล้วสร้าง "คู่มือการเขียนพาดหัว" ที่ AI ตัวอื่นจะใช้เป็นแนวทาง:\n\n${lines.map((l, i) => `${i+1}. ${l}`).join('\n')}\n\nเขียนคู่มือครอบคลุม:\n1. TONE & VOICE — โทนเสียง (จริงจัง/ตลก/ด่วน/ตื่นเต้น?) \n2. STRUCTURE — โครงสร้าง (ขึ้นต้นด้วยอีโมจิ? มีคำถาม? มี CTA?)\n3. WORD CHOICE — คำที่ใช้บ่อย สแลง ระดับภาษา\n4. LENGTH — ความยาวเฉลี่ย\n5. EMOJI USAGE — ใช้อีโมจิแบบไหน กี่ตัว ตรงไหน\n6. DO's — 5 ข้อที่ต้องทำ\n7. DON'Ts — 5 ข้อที่ห้ามทำ\n8. EXAMPLES — ตัวอย่างพาดหัวที่ดี 3 อัน (สร้างใหม่ไม่ซ้ำ)\n\nเขียนเป็นภาษาไทยที่เข้าใจง่าย ส่งกลับเป็นข้อความล้วนๆ ไม่ต้องมี JSON ไม่ต้องมี markdown`;
                    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ model: selectedTextModel, messages: [{ role: 'user', content: prompt }] })
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error.message);
                    const result = data.choices[0].message.content.trim();
                    setHlAnalyzedResult(result);
                  } catch (e: any) { alert('วิเคราะห์ล้มเหลว: ' + e.message); }
                  finally { setHlIsAnalyzing(false); }
                }}
                disabled={hlIsAnalyzing || !hlPasteText.trim()}
                className="px-4 py-1.5 text-xs font-bold bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg shadow disabled:opacity-50"
              >
                {hlIsAnalyzing ? '⏳ AI กำลังแกะสูตร...' : '🤖 AI แกะสูตรพาดหัว'}
              </button>
            </div>

            {hlAnalyzedResult && (
              <div className="mb-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400">📋 ผลการวิเคราะห์สูตรพาดหัว</span>
                  <button onClick={() => navigator.clipboard.writeText(hlAnalyzedResult)} className="text-[10px] px-2 py-1 bg-orange-200 dark:bg-orange-800 rounded font-bold hover:bg-orange-300">📋 ก๊อป</button>
                </div>
                <pre className="text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-300 max-h-48 overflow-y-auto custom-scrollbar">{hlAnalyzedResult}</pre>
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={hlNewPackName}
                onChange={(e) => setHlNewPackName(e.target.value)}
                placeholder="ตั้งชื่อ Headline Pack เช่น: สไตล์ข่าวเงิน"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent text-sm focus:border-orange-500 outline-none"
              />
              <button
                onClick={() => {
                  const lines = hlPasteText.split('\n').map(l => l.trim()).filter(Boolean);
                  if (!hlNewPackName.trim()) return alert('กรุณาตั้งชื่อ Headline Pack');
                  if (lines.length === 0) return alert('กรุณาวางตัวอย่างพาดหัวก่อน');
                  saveHeadlinePack({ name: hlNewPackName.trim(), headlines: lines });
                  setHlNewPackName('');
                  setHlPasteText('');
                  setHlAnalyzedResult('');
                  alert('✅ บันทึก Headline Pack สำเร็จ!');
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold text-sm shadow"
              >
                💾 บันทึก
              </button>
            </div>

            {/* Saved Headline Packs */}
            {headlinePacks.length > 0 && (
              <div>
                <h4 className="text-sm font-bold mb-2 text-gray-600 dark:text-gray-400">📚 Headline Packs ที่บันทึกไว้ ({headlinePacks.length})</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {headlinePacks.map(pack => (
                    <div key={pack.id} className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg p-3 group hover:border-orange-300 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-orange-600 dark:text-orange-400">🔥 {pack.name}</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => navigator.clipboard.writeText(pack.headlines.join('\n')).then(() => alert('📋 คัดลอกแล้ว!'))} className="px-2 py-0.5 text-[10px] font-bold bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300">
                            📋
                          </button>
                          <button onClick={() => { if(confirm(`ลบ "${pack.name}"?`)) deleteHeadlinePack(pack.id); }} className="px-2 py-0.5 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100">
                            🗑️
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">{pack.headlines.slice(0, 3).join(' | ')}{pack.headlines.length > 3 ? ` (+${pack.headlines.length - 3} อื่นๆ)` : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ─── ส่วน B: สไตล์การเขียน ─── */}
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-violet-600 dark:text-violet-400">
              <span>✍️</span> สไตล์การเขียน (Writing Styles)
            </h3>

            <textarea
              value={wsPasteText}
              onChange={(e) => setWsPasteText(e.target.value)}
              placeholder={`วางตัวอย่างบทความ/โพสต์จากเพจต้นแบบ\nAI จะวิเคราะห์สไตล์การเขียนและสร้าง Writing Style Template ให้\n\nหรือพิมพ์คำอธิบายสไตล์เอง เช่น:\n"เขียนแบบเพื่อนมาเล่าให้ฟัง ใช้ภาษาพูด ใส่อีโมจิเยอะ"`}
              className="w-full min-h-[120px] bg-gray-50 border border-gray-300 dark:bg-gray-900/50 dark:border-gray-700 rounded-xl p-3 text-sm focus:border-violet-500 outline-none resize-y mb-3"
            />

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={async () => {
                  if (!wsPasteText.trim()) return alert('กรุณาวางตัวอย่างบทความก่อน');
                  const { openRouterKey } = getApiKeys();
                  if (!openRouterKey) return alert('กรุณาใส่ OpenRouter API Key');
                  setWsIsAnalyzing(true);
                  try {
                    const prompt = `คุณเป็น Expert AI Prompt Engineer และ Native Thai Copywriter\n\nวิเคราะห์ตัวอย่างโพสต์/บทความด้านล่างนี้ แล้วสร้าง "Writing Style Template" ที่ AI ตัวอื่นจะใช้เป็นแนวทางเขียนโพสต์ใหม่:\n\n"""
${wsPasteText}
"""\n\nเขียน Writing Style Template ครอบคลุม:\n1. ROLE — บทบาทที่ AI ต้องสวมบทเป็น\n2. TONE & VOICE — น้ำเสียง (จริงจัง/เป็นกันเอง/ตลก/สอน?)\n3. VOCABULARY — ระดับภาษา คำที่ใช้บ่อย สแลง\n4. POST STRUCTURE — โครงสร้างโพสต์ (Hook → Body → CTA?)\n5. FORMATTING — การใช้ bullet points, อีโมจิ, เว้นบรรทัด\n6. ANTI-AI CLICHÉS — 5 สิ่งที่ห้ามทำ (ห้ามเป็นทางการเกินไป ฯลฯ)\n7. EXAMPLE OUTPUT — ตัวอย่างโพสต์ที่ดี 1 อัน (สร้างใหม่ไม่ซ้ำ)\n\nเขียนเป็นภาษาไทย ส่งกลับเป็นข้อความล้วนๆ`;
                    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ model: selectedTextModel, messages: [{ role: 'user', content: prompt }] })
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error.message);
                    setWsAnalyzedResult(data.choices[0].message.content.trim());
                  } catch (e: any) { alert('วิเคราะห์ล้มเหลว: ' + e.message); }
                  finally { setWsIsAnalyzing(false); }
                }}
                disabled={wsIsAnalyzing || !wsPasteText.trim()}
                className="px-4 py-1.5 text-xs font-bold bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg shadow disabled:opacity-50"
              >
                {wsIsAnalyzing ? '⏳ AI กำลังแกะสูตร...' : '🤖 AI แกะสูตรการเขียน'}
              </button>
            </div>

            {wsAnalyzedResult && (
              <div className="mb-4 bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-violet-600 dark:text-violet-400">📋 Writing Style Template ที่ได้</span>
                  <button onClick={() => navigator.clipboard.writeText(wsAnalyzedResult)} className="text-[10px] px-2 py-1 bg-violet-200 dark:bg-violet-800 rounded font-bold hover:bg-violet-300">📋 ก๊อป</button>
                </div>
                <pre className="text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-300 max-h-48 overflow-y-auto custom-scrollbar">{wsAnalyzedResult}</pre>
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={wsNewName}
                onChange={(e) => setWsNewName(e.target.value)}
                placeholder="ตั้งชื่อ Writing Style เช่น: สไตล์หมอตัน"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent text-sm focus:border-violet-500 outline-none"
              />
              <button
                onClick={() => {
                  if (!wsNewName.trim()) return alert('กรุณาตั้งชื่อ Writing Style');
                  const content = wsAnalyzedResult || wsPasteText;
                  if (!content.trim()) return alert('กรุณาวางตัวอย่าง หรือใช้ AI แกะสูตรก่อน');
                  saveWritingStyleHook({ name: wsNewName.trim(), content: content.trim() });
                  setWsNewName('');
                  setWsPasteText('');
                  setWsAnalyzedResult('');
                  alert('✅ บันทึก Writing Style สำเร็จ!');
                }}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-bold text-sm shadow"
              >
                💾 บันทึก
              </button>
            </div>

            {/* Saved Writing Styles */}
            {writingStyles.length > 0 && (
              <div>
                <h4 className="text-sm font-bold mb-2 text-gray-600 dark:text-gray-400">📚 Writing Styles ที่บันทึกไว้ ({writingStyles.length})</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {writingStyles.map(style => (
                    <div key={style.id} className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg p-3 group hover:border-violet-300 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-violet-600 dark:text-violet-400">✍️ {style.name}</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => navigator.clipboard.writeText(style.content).then(() => alert('📋 คัดลอกแล้ว!'))} className="px-2 py-0.5 text-[10px] font-bold bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300">
                            📋
                          </button>
                          <button onClick={() => { if(confirm(`ลบ "${style.name}"?`)) deleteWritingStyleHook(style.id); }} className="px-2 py-0.5 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100">
                            🗑️
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">{style.content.substring(0, 150)}{style.content.length > 150 ? '...' : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── SECTION 4: Style Gallery ── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-8 shadow-sm">
        <h3 className="text-xl font-bold mb-6">📁 คลังสไตล์ส่วนตัว (Saved Styles)</h3>
        {gallery.length === 0 ? (
          <div className="text-center py-10 opacity-50 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">ยังไม่มีสไตล์ที่บันทึกไว้ ลองโคลนรูปข้างบนดูสิ!</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {gallery.map(item => (
              <div key={item.id} className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 relative group bg-white dark:bg-black">
                <div className="aspect-[9/16] relative">
                  <img src={item.imageUrl} alt="Saved style" className="w-full h-full object-cover" />
                </div>
                <div className="p-2 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center absolute inset-x-0 top-0 bg-black/60 translate-y-[-100%] group-hover:translate-y-0 transition-transform">
                  <button onClick={() => { setExtractedPromptBase(item.prompt); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-xs text-white hover:text-amber-400 font-bold">🚀 โหลดแม่พิมพ์</button>
                </div>
                <div className="p-2 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center absolute inset-x-0 bottom-0 bg-black/80 translate-y-full group-hover:translate-y-0 transition-transform">
                  <button onClick={() => { navigator.clipboard.writeText(item.prompt); alert('คัดลอก Prompt เรียบร้อย!'); }} className="text-xs text-white hover:text-indigo-300 font-medium">📋 ก๊อป Prompt</button>
                  <button onClick={() => deleteStyle(item.id)} className="text-xs text-red-400 hover:text-red-300 font-medium">ลบ</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION 5: สร้างคอนเทนต์จากสไตล์ ── */}
      <div ref={section4Ref} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-8 shadow-sm">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <span className="text-3xl">🎯</span> สร้างคอนเทนต์จากสไตล์ (Content Factory)
        </h2>
        <p className="text-sm opacity-70 mb-6">เลือกลายเส้นจากคลังรูป + เลือกประเภทคอนเทนต์ + กรอกเนื้อหา → AI สร้าง Prompt พร้อมใช้งานทีเดียวหลายรูป</p>

        {/* Step 1: Select Style (gallery image) */}
        <div className="mb-6">
          <label className="font-bold text-sm mb-3 flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            ① เลือกลายเส้น (จากคลังรูปที่บันทึกไว้)
            <span className="font-normal text-xs opacity-60">— สแกนรูปใน Section 1 แล้วกด &quot;บันทึกเก็บสไตล์&quot;</span>
          </label>

          {/* Option: use current scanned base prompt */}
          {extractedPromptBase && (
            <button
              onClick={() => setS4SelectedStyleId('__current__')}
              className={`w-full mb-3 p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${s4SelectedStyleId === '__current__' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-400' : 'border-[var(--border-color)] hover:border-amber-400'}`}
            >
              {uploadedImages.length > 0 && <img src={uploadedImages[0]} alt="" className="w-10 h-14 object-cover rounded-lg shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-amber-600 dark:text-amber-400">🔍 ใช้รูปที่สแกนอยู่ตอนนี้</div>
                <div className="text-[10px] text-gray-500 mt-0.5 truncate">{extractedPromptBase.substring(0, 100)}...</div>
              </div>
              {s4SelectedStyleId === '__current__' && <span className="text-amber-500 text-xl shrink-0">✓</span>}
            </button>
          )}

          {/* Gallery thumbnails — horizontal slider */}
          {gallery.length === 0 && !extractedPromptBase ? (
            <div className="p-6 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-sm opacity-60 text-center">
              ยังไม่มีสไตล์ในคลัง — ไปสแกนรูปใน Section 1 ด้านบน แล้วกด &quot;บันทึกเก็บสไตล์นี้&quot; ก่อนครับ
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory custom-scrollbar" style={{ scrollbarWidth: 'thin' }}>
              {gallery.map(item => {
                const isSelected = s4SelectedStyleId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setS4SelectedStyleId(item.id)}
                    className={`relative flex-shrink-0 w-[180px] sm:w-[200px] rounded-xl overflow-hidden border-2 transition-all snap-start flex flex-col ${
                      isSelected ? 'border-indigo-500 ring-2 ring-indigo-400 scale-[1.02] shadow-lg shadow-indigo-500/20' : 'border-[var(--border-color)] hover:border-indigo-300 hover:shadow-md'
                    }`}
                  >
                    {/* Image */}
                    <div className="relative aspect-[9/14] w-full">
                      <img src={item.imageUrl} alt="Style" className="w-full h-full object-cover" />
                      {isSelected && (
                        <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center">
                          <span className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm shadow-lg">✓</span>
                        </div>
                      )}
                    </div>
                    {/* Traits description */}
                    <div className="p-2 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-700 flex-1">
                      {item.traits && item.traits.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.traits.slice(0, 4).map((t, i) => (
                            <span key={i} className="inline-block px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[9px] rounded-md leading-tight font-medium truncate max-w-full">
                              {t.length > 25 ? t.substring(0, 25) + '…' : t}
                            </span>
                          ))}
                          {item.traits.length > 4 && (
                            <span className="text-[9px] text-gray-400 font-medium">+{item.traits.length - 4}</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[9px] text-gray-400 italic">ไม่มีลักษณะเด่น</div>
                      )}
                      {item.promptGuide && (
                        <div className="mt-1">
                          <span className="inline-block px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[9px] rounded-md font-bold">📖 มีคู่มือ</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected style prompt preview */}
          {s4BasePrompt && s4SelectedStyleId && s4SelectedStyleId !== '__current__' && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] text-gray-500">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">Base Prompt: </span>{s4BasePrompt.substring(0, 150)}...
            </div>
          )}
        </div>

        {s4BasePrompt && (
          <>
            {/* Traits Checklist in Section 4 */}
            {extractedTraits.length > 0 && (
              <div className="mb-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-sm text-amber-700 dark:text-amber-400">📋 ลักษณะเด่นของ Ref (ติ๊กข้อที่ต้องการบังคับใช้)</label>
                  <div className="flex gap-2">
                    <button onClick={() => setExtractedTraits(prev => prev.map(t => ({...t, checked: true})))} className="text-[10px] text-amber-600 hover:underline">เลือกทั้งหมด</button>
                    <button onClick={() => setExtractedTraits(prev => prev.map(t => ({...t, checked: false})))} className="text-[10px] text-amber-600 hover:underline">ยกเลิกทั้งหมด</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {extractedTraits.map((trait, idx) => (
                    <label key={idx} className={`flex items-start gap-2 cursor-pointer p-2 rounded-lg transition-colors text-xs leading-relaxed ${
                      trait.checked
                        ? 'bg-amber-100 dark:bg-amber-800/20 text-amber-900 dark:text-amber-200'
                        : 'bg-gray-100 dark:bg-gray-800/30 text-gray-400 dark:text-gray-600 line-through'
                    }`}>
                      <input
                        type="checkbox"
                        checked={trait.checked}
                        onChange={() => setExtractedTraits(prev => prev.map((t, i) => i === idx ? {...t, checked: !t.checked} : t))}
                        className="mt-0.5 accent-amber-500 shrink-0"
                      />
                      <span>{trait.text}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Size */}
            <div className="mb-6">
              <label className="font-bold text-sm mb-2 block text-indigo-600 dark:text-indigo-400">② ขนาดรูปที่ต้องการ</label>
              <div className="flex flex-wrap gap-2">
                {SIZE_PRESETS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setS4SizePreset(s.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${s4SizePreset === s.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'border-[var(--border-color)] hover:border-indigo-400 opacity-70 hover:opacity-100'}`}
                  >
                    {s.label} <span className="opacity-60 font-normal">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 4: Page Name / Watermark */}
            <div className="mb-6">
              <label className="font-bold text-sm mb-2 block text-indigo-600 dark:text-indigo-400">
                ③ ชื่อเพจ / ลายน้ำ (เครดิต) <span className="font-normal opacity-50 text-xs">(ออปชั่น — สั่ง AI ใส่ชื่อเพจ)</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={s4PageName}
                  onChange={(e) => setS4PageName(e.target.value)}
                  placeholder="เช่น: เสียงกระซิบจากใจ, หมอดูตาดี, ..."
                  className="flex-1 px-4 py-2.5 border border-[var(--border-color)] rounded-xl bg-transparent focus:border-indigo-500 outline-none text-sm"
                />
                <select value={s4WatermarkSize} onChange={(e) => setS4WatermarkSize(e.target.value)} className="sm:w-48 px-3 py-2 border border-[var(--border-color)] rounded-xl bg-[var(--bg-card)] focus:border-indigo-500 outline-none text-xs font-bold text-gray-700 dark:text-gray-300 flex-shrink-0">
                  <option value="small">ไซส์เล็ก (จิ๋วๆ มุมรูป)</option>
                  <option value="medium">ไซส์กลาง (1/4 ของแคปชั่น)</option>
                  <option value="large">ไซส์ใหญ่ (1/2 ของแคปชั่น)</option>
                </select>
                <select value={s4WatermarkPos} onChange={(e) => setS4WatermarkPos(e.target.value)} className="sm:w-56 px-3 py-2 border border-[var(--border-color)] rounded-xl bg-[var(--bg-card)] focus:border-indigo-500 outline-none text-xs font-bold text-gray-700 dark:text-gray-300 flex-shrink-0">
                  <option value="bottom-right">↘️ วางมุมขวาล่าง</option>
                  <option value="bottom-left">↙️ วางมุมซ้ายล่าง</option>
                  <option value="top-right">↗️ วางมุมขวาบน</option>
                  <option value="top-left">↖️ วางมุมซ้ายบน</option>
                  <option value="embedded">✨ สุ่มฝังเนียนๆ สวยๆ ในรูป</option>
                  <option value="random">🎲 สุ่มวางตรงมุมไหนก็ได้</option>
                </select>
              </div>
            </div>

            {/* Step 4: Content Input — always visible */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <label className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                  ④ 💬 ใส่คำคม/เนื้อหา
                  <span className="font-normal text-xs opacity-50 ml-2">— แต่ละบรรทัด = 1 รูป (หรือเว้นว่างเพื่อสร้าง 1 Prompt)</span>
                </label>
                <div className="flex gap-1 ml-auto">
                  <button onClick={() => setS4InputMode('paste')} className={`px-3 py-1 text-xs rounded-lg font-bold transition ${s4InputMode === 'paste' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-indigo-100'}`}>📝 พิมพ์/วาง</button>
                  <button onClick={() => setS4InputMode('csv')} className={`px-3 py-1 text-xs rounded-lg font-bold transition ${s4InputMode === 'csv' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-indigo-100'}`}>📎 CSV</button>
                </div>
              </div>

              {s4InputMode === 'paste' ? (
                <div>
                  <textarea
                    value={s4PasteText}
                    onChange={(e) => setS4PasteText(e.target.value)}
                    placeholder={'วางคำคม/เนื้อหาทีละบรรทัด...\nความสำเร็จไม่ได้มาเอง\nทุกวันคือโอกาสใหม่\nอย่ายอมแพ้ก่อนเริ่ม\n\nหรือเว้นว่างเพื่อสร้าง 1 Prompt จาก Base Prompt'}
                    className="w-full min-h-[150px] bg-gray-50 border border-gray-300 dark:bg-gray-900/50 dark:border-gray-700 rounded-xl p-4 text-sm focus:border-indigo-500 outline-none resize-y"
                  />
                  <div className="mt-2 text-xs text-gray-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div>💡 แต่ละบรรทัด = 1 รูป — พบ <strong>{s4ContentItems.length}</strong> รายการ (เว้นว่าง = สร้าง 1 Prompt จาก Base)</div>
                      <div className="text-amber-600 dark:text-amber-400 mt-1 font-bold">⚠️ แนะนำสร้างสูงสุด 10-15 บรรทัดต่อครั้ง (ป้องกัน AI รวน/ตกหล่น)</div>
                    </div>
                    <button
                      onClick={() => {
                        const csv = 'quote,author,note\n"ความสำเร็จไม่ได้มาเอง...",หมอตัน,\n"ทุกวันคือโอกาสใหม่",ไม่ระบุ,';
                        downloadCSV(csv, 'template_quote.csv');
                      }}
                      className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                    >
                      📥 โหลดเทมเพลต CSV
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 text-center">
                  <input type="file" accept=".csv" className="hidden" ref={csvInputRef} onChange={handleCsvUpload} />
                  {s4CsvData.length > 0 ? (
                    <div>
                      <div className="text-green-600 font-bold mb-1">✅ โหลด CSV สำเร็จ — พบ {s4CsvData.length} รายการ</div>
                      <div className="text-amber-600 dark:text-amber-400 text-[11px] font-bold mb-2">⚠️ แนะนำสร้างสูงสุดครั้งละ 10-15 รายการ (แยกไฟล์) เพื่อป้องกัน AI ทำงานตกหล่น</div>
                      <div className="text-xs text-gray-500 max-h-24 overflow-y-auto custom-scrollbar mb-3 text-left bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
                        {s4CsvData.slice(0, 5).map((item, i) => <div key={i} className="py-0.5 border-b border-gray-200 dark:border-gray-800">• {item}</div>)}
                        {s4CsvData.length > 5 && <div className="text-center opacity-50 pt-1">... และอีก {s4CsvData.length - 5} รายการ</div>}
                      </div>
                      <button onClick={() => setS4CsvData([])} className="text-xs text-red-500 hover:text-red-700 font-bold">✕ ล้างข้อมูล CSV</button>
                    </div>
                  ) : (
                    <>
                      <div className="text-4xl mb-3">📎</div>
                      <button onClick={() => csvInputRef.current?.click()} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 mb-2">เลือกไฟล์ .csv</button>
                      <div className="text-xs text-gray-500 mt-2">
                        Column แรกคือคำคม/เนื้อหา (header row จะถูก skip อัตโนมัติ)
                      </div>
                      <button
                        onClick={() => {
                          const csv = 'quote,author,note\n"ความสำเร็จไม่ได้มาเอง...",หมอตัน,\n"ทุกวันคือโอกาสใหม่",ไม่ระบุ,';
                          downloadCSV(csv, 'template_quote.csv');
                        }}
                        className="mt-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:underline block mx-auto"
                      >
                        📥 โหลดเทมเพลต CSV (ดูชื่อคอลัมน์)
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>


            {/* Smart Diversity Presets (auto-generated from Ref) */}
            <div className="mb-6 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <label className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                  🎨 ระดับความหลากหลาย {diversityPresets.length > 0 && `(${diversityLevel + 1}/${diversityPresets.length})`}
                </label>
                <button
                  onClick={() => generateDiversityPresets(s4BasePrompt)}
                  disabled={diversityPresetsLoading || !s4BasePrompt}
                  className="text-[11px] font-bold px-3 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/50 disabled:opacity-50 transition"
                >
                  {diversityPresetsLoading ? '⏳ กำลังวิเคราะห์...' : '🔄 สร้างตัวเลือกใหม่'}
                </button>
              </div>
              {diversityPresets.length === 0 ? (
                <div className="text-[12px] text-gray-400 dark:text-gray-500 text-center py-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                  {s4BasePrompt ? (
                    diversityPresetsLoading ? '⏳ AI กำลังวิเคราะห์ลายเส้นต้นแบบ...' : '👆 กดปุ่ม "สร้างตัวเลือกใหม่" หรือเลือกลายเส้นต้นแบบเพื่อให้ AI วิเคราะห์'
                  ) : 'กรุณาเลือกลายเส้นต้นแบบก่อน (ขั้นตอน ①)'}
                </div>
              ) : (
                <>
                  <input
                    type="range"
                    min={0}
                    max={diversityPresets.length - 1}
                    step={1}
                    value={diversityLevel}
                    onChange={(e) => setDiversityLevel(Number(e.target.value))}
                    className="w-full accent-indigo-500 mb-2"
                  />
                  <div className="text-[12px] font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-black/30 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-inner">
                    {diversityPresets[diversityLevel]?.label || 'ยังไม่ได้เลือก'}
                  </div>
                </>
              )}
            </div>

            {/* Thai Text Strictness Toggle */}
            <div className="mb-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-orange-200 dark:border-orange-800/40 bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 transition">
                <input
                  type="checkbox"
                  checked={s4StrictThai}
                  onChange={(e) => setS4StrictThai(e.target.checked)}
                  className="w-5 h-5 accent-orange-500 shrink-0"
                />
                <div>
                  <div className="font-bold text-sm text-orange-700 dark:text-orange-400">🇹🇭 จริงจังเรื่องภาษาไทยถูกต้องและปรากฏในรูป</div>
                  <div className="text-[11px] text-orange-600/70 dark:text-orange-400/60 mt-0.5">บังคับ AI ให้แสดงข้อความภาษาไทยในภาพอย่างถูกต้อง ห้ามแปลเป็นภาษาอื่นเด็ดขาด</div>
                </div>
              </label>

              {/* Random Color Filter Toggle */}
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-purple-200 dark:border-purple-800/40 bg-purple-50 dark:bg-purple-900/10 hover:bg-purple-100 dark:hover:bg-purple-900/20 transition">
                <input
                  type="checkbox"
                  checked={s4EnableRandomFilter}
                  onChange={(e) => setS4EnableRandomFilter(e.target.checked)}
                  className="w-5 h-5 accent-purple-500 shrink-0"
                />
                <div>
                  <div className="font-bold text-sm text-purple-700 dark:text-purple-400">🎨 เปิดโหมดฟิลเตอร์ย้อมสีภาพแบบสุ่ม (แก้ไขภาพจำเจ)</div>
                  <div className="text-[11px] text-purple-600/70 dark:text-purple-400/60 mt-0.5">สุ่มฉีดโทนสี Cinematic เด็ดๆ เข้าไปในแต่ละภาพ (เช่น โทน Matrix, โทนส้ม-ฟ้า ฯลฯ) เพื่อให้ภาพแต่ละใบมีสีที่แตกต่างกัน</div>
                </div>
              </label>
            </div>

            {/* Generate */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                {s4ContentItems.length > 0 && (
                  <div className="text-sm font-bold text-gray-500">
                    พบ <span className="text-indigo-600 dark:text-indigo-400 text-lg">{s4ContentItems.length}</span> รายการ → จะสร้าง {s4ContentItems.length} Prompt
                  </div>
                )}
                {s4IsGenerating ? (
                  <button
                    onClick={() => { abortS4Ref.current = true; }}
                    className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-base shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    🛑 หยุด Generate {s4ProgressText}
                  </button>
                ) : (
                  <button
                    onClick={generateS4Prompts}
                    disabled={s4ContentItems.length === 0}
                    className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl font-bold text-base shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    🪄 สร้าง {s4ContentItems.length || '?'} Prompts
                  </button>
                )}
              </div>

              {/* Random No-Quote Generation */}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-teal-200 dark:border-teal-800/40 bg-teal-50 dark:bg-teal-900/10">
                <div className="flex-1">
                  <div className="font-bold text-sm text-teal-700 dark:text-teal-400">🎲 สุ่มสร้างรูปเปล่า (ไม่มีคำคม)</div>
                  <div className="text-[11px] text-teal-600/70 dark:text-teal-400/60 mt-0.5">สร้างรูปในสไตล์เดิมแต่ไม่มีข้อความซ้อน เหมาะกับรูปประกอบเพจ</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={randomNoQuoteCount}
                    onChange={(e) => setRandomNoQuoteCount(e.target.value === '' ? '' : Number(e.target.value))}
                    onBlur={() => setRandomNoQuoteCount(Math.max(1, Math.min(50, Number(randomNoQuoteCount) || 5)))}
                    className="w-14 px-2 py-2 text-center text-sm font-bold bg-white dark:bg-gray-800 border border-teal-300 dark:border-teal-700 rounded-lg outline-none focus:border-teal-500"
                    title="จำนวนรูปที่ต้องการสุ่มสร้าง"
                  />
                  <span className="text-xs text-teal-600 dark:text-teal-400 font-bold">รูป</span>
                  {isGeneratingRandomNoQuote ? (
                    <button
                      onClick={() => { abortS4Ref.current = true; }}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
                    >
                      🛑 หยุด {s4ProgressText}
                    </button>
                  ) : (
                    <button
                      onClick={generateRandomNoQuote}
                      className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
                    >
                      🎲 สุ่มสร้าง
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Output: Generated Prompts */}
            {s4GeneratedPrompts.length > 0 && (
              <div className="mt-6 pt-6 border-t border-[var(--border-color)]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-base text-green-600 dark:text-green-400">✅ Prompts พร้อมใช้งาน ({s4GeneratedPrompts.length} รูปแบบ)</h4>
                  <button
                    onClick={() => navigator.clipboard.writeText(s4GeneratedPrompts.join('\n\n'))}
                    className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-bold rounded-lg text-xs"
                  >
                    📑 Copy ทั้งหมด (เว้นบรรทัด)
                  </button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  {s4GeneratedPrompts.map((p, idx) => (
                    <div
                      key={idx}
                      onClick={() => navigator.clipboard.writeText(p)}
                      className="p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-gray-200 dark:border-gray-700 rounded-lg text-xs cursor-pointer transition-all hover:border-indigo-300"
                    >
                      <div className="font-bold text-[10px] opacity-70 mb-1 text-indigo-600">
                        PROMPT #{idx+1}
                        {s4ContentItems[idx] && <span className="ml-2 opacity-60">← "{s4ContentItems[idx].substring(0, 30)}{s4ContentItems[idx].length > 30 ? '...' : ''}"</span>}
                        <span className="float-right">คลิกเพื่อ Copy</span>
                      </div>
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {!s4BasePrompt && (
          <div className="mt-4 p-6 text-center text-sm opacity-50 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
            ↑ เลือกลายเส้นจากคลังรูปด้านบนก่อน แล้วจะเห็นส่วนเลือกประเภทและปุ่ม Generate
          </div>
        )}
      </div>



      {/* Save Brain Modal */}
      {showSaveBrainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in mx-4">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">💾 บันทึกสมอง (Brain)</h3>

            <label className="font-bold text-sm mb-1 block text-gray-600 dark:text-gray-400">ชื่อสมอง</label>
            <input
              type="text"
              value={saveBrainName}
              onChange={(e) => setSaveBrainName(e.target.value)}
              placeholder="เช่น: สไตล์หมอตัน, อินโฟหมอดู, แคปชั่นรัก..."
              className="w-full px-4 py-2.5 mb-4 border border-gray-300 dark:border-gray-700 rounded-xl bg-transparent focus:border-indigo-500 outline-none text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveBrain(); }}
            />

            <div className="flex gap-3">
              <button onClick={() => setShowSaveBrainModal(false)} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-800">ยกเลิก</button>
              <button onClick={handleSaveBrain} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-md">✅ บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
