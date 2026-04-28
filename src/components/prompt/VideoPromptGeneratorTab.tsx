import React, { useState, useEffect, useRef } from 'react';
import { NumInput } from '../ui/NumInput';

import { Option, SETTINGS, ACTIONS, REACTIONS, CAMERA_STYLES, AESTHETICS, HOOKS } from './promptData';
import { SUBJECT_CATEGORIES, MYTHICAL_CREATURES, FANTASY_CHARACTERS, OTHER_SUBJECTS } from './promptSubjects';
import { DETAIL_CATEGORIES, MONSTER_DETAILS, HUMAN_DETAILS, AURA_DETAILS, PROP_DETAILS, OTHER_DETAILS } from './promptDetails';
import { SHORT_FILM_ARCS, SHORT_FILM_15_ARCS } from './promptShortFilm';
import { DIALOGUES } from './promptDialogues';
import { PROTAGONISTS, MACGUFFIN_PROPS } from './promptContinuity';

// Removed CustomState as part of Library Refactoring

interface AnalysisResult {
  setting: string;
  action: string;
  camera: string;
  aesthetic: string;
}

interface SoraModifier {
  id: string;
  label: string;
  value: string;
  desc: string;
}

const SORA_MODIFIERS: SoraModifier[] = [
  { id: 'raw', label: '1. Raw Footage (ลบความเนี๊ยบ CGI)', value: 'Raw unedited amateur footage, mundane everyday recording, zero cinematic post-processing', desc: 'ทำลายภาพ 3D ให้ดูเป็นคลิปที่ไม่ได้ตัดต่อ' },
  { id: 'lens', label: '2. Auto-Focus Hunting (หลุดโฟกัส)', value: 'slightly out of focus, aggressive auto-focus hunting algorithm struggling to lock onto subject', desc: 'โฟกัสวืดไปมาแบบกล้องหาจุดไม่ค่อยเจอ' },
  { id: 'light', label: '3. Harsh Lighting (แสงธรรมชาติ)', value: 'badly lit, harsh overexposed natural lighting, blown out highlights, completely flat shadows', desc: 'แสงแดดเปรี้ยง มืดไป หรือแสงจ้าล้นเกิน' },
  { id: 'sensor', label: '4. Dead Pixels (พิกเซลแตก/เสีย)', value: 'damaged digital sensor, random dead purple and green pixels scattered organically, digital artifacting', desc: 'เซนเซอร์รับแสงเสียจนเกิดจุดพิกเซลพังๆ' },
  { id: 'shake', label: '5. Shaky Panic (มือสั่น/แพนกระชาก)', value: 'unpredictable shaky hands, non-stabilized erratic camera movement, sudden panicked whipping pan', desc: 'เพิ่มดานมูฟเมนต์การถือที่ตระหนกแบบสมจริง' },
  { id: 'shutter', label: '6. Jello Effect (ภาพย้วย)', value: 'extreme rolling shutter effect, physical jello artifact during fast movements', desc: 'แพนกล้องแล้วภาพย้วยเบี้ยวแบบมือถือเก่า' },
  { id: 'dirty', label: '7. Dirty Lens (เลนส์สกปรก)', value: 'thick layer of dust and smudges on the camera lens, micro scratches catching the light irregularly', desc: 'รอยนิ้วมือและฝุ่นเกาะหน้าเลนส์' },
  { id: 'water', label: '8. Droplets (ละอองน้ำบนเลนส์)', value: 'multiple blurry water droplets directly on the camera lens heavily refracting the background', desc: 'หยดน้ำเกาะเลนส์จนบางจุดในภาพบิดเบี้ยว' },
  { id: 'cctv', label: '9. CCTV Bitrate Drop (บิตเรตตก)', value: 'security camera footage, aggressive h264 compression artifacts, heavy macro-blocking when subject moves fast', desc: 'ภาพเป็นบล็อคสี่เหลี่ยมเวลาวัตถุขยับเร็วๆ' },
  { id: 'iso', label: '10. Extreme ISO Noise (นอยส์หยาบ)', value: 'shot in near total darkness, ridiculously high ISO setting, aggressive colorful digital noise grain', desc: 'ดันแสงกลางคืนจนเกิดขยะพิกเซลสากๆ ทั่วภาพ' },
  { id: 'flare', label: '11. Cheap Lens Flare (แสงแฟลร์ปลอม)', value: 'cheap uncoated plastic lens flare, massive ugly light leak from the side of the frame', desc: 'แสงสว่างเกินแบบกล้องไม่มีฟิลเตอร์กันแสง' },
  { id: 'fps', label: '12. Dropped Frames (เฟรมเรตตก)', value: 'inconsistent frame pacing, stuttering framerate momentarily dropping to 12fps during heavy action', desc: 'ภาพกระตุกเหมือนเมมโมรี่การ์ดเซฟไม่ทัน' },
  { id: 'dashcam', label: '13. Dirty Windshield (ถ่ายหน้ารถ)', value: 'dashcam perspective shot perfectly through a filthy cracked windshield, dashboard glare reflection on glass', desc: 'ถ่ายผ่านกระจกหน้ารถแบบสะท้อนเงาคอนโซลรถ' },
  { id: 'vhs', label: '14. Analog Tracking (เส้นเทป VHS)', value: 'found footage style analog tracking lines rolling organically up the screen, sudden color degradation', desc: 'เทปวิดีโอเก่าภาพสั่นและล้มเป็นเส้นๆ' },
  { id: 'flash', label: '15. Phone Flashlight (แสงแฟลชมือถือ)', value: 'lit entirely by a single weak smartphone LED flash, sharp harsh shadow dropoff behind subject, heavy vignetting', desc: 'เปิดแอปไฟฉายมือถือส่องในที่มืด' },
];

const DEFAULT_AI_MODEL = "google/gemini-2.5-flash"; // Excellent vision model for frame analysis

export function VideoPromptGeneratorTab() {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [activeLibraryTab, setActiveLibraryTab] = useState('settings');

  // --- Video Analyzer States ---
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [cloneBulkCount, setCloneBulkCount] = useState<number>(10);
  const [cloneSubjectCategory, setCloneSubjectCategory] = useState<string>('all');
  const [cloneShortFilmCount, setCloneShortFilmCount] = useState<number>(5);
  const [cloneShortFilmCategory, setCloneShortFilmCategory] = useState<string>('all');
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Sora Mode States ---
  const [isSoraMode, setIsSoraMode] = useState(false);
  const [activeSoraMods, setActiveSoraMods] = useState<string[]>(['raw', 'lens', 'shake']);

  // Bulk Generation State
  const [bulkCount, setBulkCount] = useState<number>(50);
  const [bulkCategory, setBulkCategory] = useState<string>('all');

  // Short Film Generation State
  const [shortFilmCount, setShortFilmCount] = useState<number>(5);
  const [shortFilmCategory, setShortFilmCategory] = useState<string>('all');

  // Dialogue Settings
  const [includeDialogue, setIncludeDialogue] = useState<boolean>(true);

  // Formatting State
  const [outputAsJson, setOutputAsJson] = useState(false);

  // Single-prompt build state removed to minimize clutter.

  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  // ─── Infographic Prompt Generator States ───────────────────────────────────
  const [infogTopic, setInfogTopic] = useState('');
  const [infogStyleId, setInfogStyleId] = useState('modern-chinese');
  const [infogCustomStyle, setInfogCustomStyle] = useState('');
  const [infogCount, setInfogCount] = useState<number | ''>(10);
  const [infogCsvText, setInfogCsvText] = useState('');
  const [infogTopics, setInfogTopics] = useState<string[]>([]);
  const [infogSelectedTopics, setInfogSelectedTopics] = useState<Set<number>>(new Set());
  const [infogPrompts, setInfogPrompts] = useState<string[]>([]);
  const [infogIsGeneratingTopics, setInfogIsGeneratingTopics] = useState(false);
  const [infogIsGeneratingPrompts, setInfogIsGeneratingPrompts] = useState(false);
  const [infogBatchProgress, setInfogBatchProgress] = useState('');
  const [infogCopyFeedback, setInfogCopyFeedback] = useState(false);
  const infogCsvRef = useRef<HTMLInputElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // ─── Infographic Style Presets ──────────────────────────────────────────────
  const INFOG_STYLES = [
    // Chinese / Jade niche
    { id: 'modern-chinese', name: '🏮 Modern Chinese Aesthetic', styleText: 'Modern Chinese aesthetic, sophisticated New Gen style', good: 'หยก, สินค้ามงคล, ความเชื่อจีน, เครื่องรางนำโชค' },
    { id: 'luxury-jade', name: '💎 Luxury Jade Premium', styleText: 'Modern Chinese aesthetic, High Luxury premium look, deep jade green and gold accents', good: 'หยกเกรดพรีเมียม, ของแพง, luxury brand' },
    { id: 'ancient-scroll', name: '📜 Ancient Chinese Scroll', styleText: 'Traditional Chinese scroll painting aesthetic, ink wash style, rice paper texture', good: 'ประวัติศาสตร์, ของโบราณ, ตำนาน' },
    { id: 'feng-shui', name: '☯️ Feng Shui & Energy', styleText: 'Mystical feng shui aesthetic, energy flow visualization, yin-yang balance, glowing aura effects', good: 'ฮวงจุ้ย, ธาตุ 5, ดูดวง, มงคล' },
    // Health & Wellness
    { id: 'medical-clean', name: '🏥 Medical & Healthcare', styleText: 'Clean medical infographic style, white background, flat vector icons, clinical blue and green palette', good: 'สุขภาพ, โรค, ยา, ข้อมูลทางการแพทย์' },
    { id: 'wellness-spa', name: '🧘 Wellness & Spa', styleText: 'Calm wellness aesthetic, soft pastel watercolor textures, natural organic elements, zen minimalism', good: 'สปา, ผ่อนคลาย, โยคะ, สุขภาพจิต' },
    { id: 'nutrition-food', name: '🥗 Nutrition & Food Science', styleText: 'Bright food infographic style, fresh natural colors, illustrated ingredients, clean sans-serif typography', good: 'โภชนาการ, อาหาร, สูตรอาหาร, ไดเอท' },
    { id: 'fitness-sport', name: '💪 Fitness & Sport', styleText: 'Dynamic sports infographic style, bold dark background, neon accent colors, energetic layout with muscle diagrams', good: 'ออกกำลังกาย, กีฬา, ฟิตเนส, โปรแกรมเทรน' },
    // Business & Finance
    { id: 'corporate', name: '💼 Corporate & Business', styleText: 'Professional corporate infographic style, navy blue and white, geometric shapes, clean data visualization', good: 'ธุรกิจ, รายงาน, กลยุทธ์, การตลาด' },
    { id: 'finance-money', name: '💰 Finance & Investment', styleText: 'Financial infographic style, dark green and gold palette, bar charts, upward trend arrows, premium feel', good: 'การเงิน, การลงทุน, หุ้น, คริปโต' },
    { id: 'startup-tech', name: '🚀 Startup & Tech', styleText: 'Modern startup infographic style, bold gradient backgrounds, flat 3D icons, vibrant purple and orange', good: 'Startup, นวัตกรรม, เทคโนโลยี, SaaS' },
    { id: 'e-commerce', name: '🛒 E-Commerce & Retail', styleText: 'Bright e-commerce style, product-focused layout, white background with color accents, shopping elements', good: 'ขายของออนไลน์, Shopee, review สินค้า' },
    // Education & Information
    { id: 'educational', name: '📚 Educational & Academic', styleText: 'Clear educational infographic style, pastel colors, numbered steps, easy-to-follow diagram layout', good: 'สอน, อธิบาย, ขั้นตอน, How-to' },
    { id: 'timeline-history', name: '📅 Timeline & History', styleText: 'Historical timeline infographic style, horizontal or vertical timeline, vintage map textures, sepia tones mixed with color highlights', good: 'ประวัติศาสตร์, timeline, วิวัฒนาการ' },
    { id: 'comparison', name: '⚖️ Comparison / VS', styleText: 'Clean comparison infographic style, split-screen layout, contrasting colors on each side, clear VS divider', good: 'เปรียบเทียบ, VS, ข้อดีข้อเสีย' },
    { id: 'how-to-steps', name: '🔢 Step-by-Step How-To', styleText: 'Sequential step-by-step infographic style, numbered circular icons, connecting arrows, warm instructional palette', good: 'สอนทำ, วิธีใช้, ขั้นตอน, tutorial' },
    // Lifestyle & Social
    { id: 'lifestyle-minimal', name: '🌿 Lifestyle Minimalist', styleText: 'Minimalist lifestyle infographic style, white space heavy, thin elegant typography, muted earth tones', good: 'ไลฟ์สไตล์, minimal, aesthetic, self-care' },
    { id: 'gen-z-bold', name: '⚡ Gen Z Bold & Vibrant', styleText: 'Gen Z bold infographic style, neon pink and electric blue, maximalist layout, meme-inspired callouts, y2k elements', good: 'วัยรุ่น, เทรนด์, Gen Z, social media viral' },
    { id: 'travel-map', name: '✈️ Travel & Tourism', styleText: 'Colorful travel infographic style, illustrated map elements, flag icons, warm wanderlust palette, handwritten accents', good: 'ท่องเที่ยว, แนะนำสถานที่, เส้นทาง' },
    { id: 'beauty-cosmetic', name: '💄 Beauty & Cosmetics', styleText: 'Elegant beauty infographic style, rose gold and cream palette, soft watercolor backgrounds, luxury product showcase', good: 'ความงาม, สกินแคร์, เครื่องสำอาง, ผิวหน้า' },
    // Real Estate & Architecture
    { id: 'real-estate', name: '🏠 Real Estate & Property', styleText: 'Professional real estate infographic style, architectural blueprint accents, dark charcoal and gold, property feature icons', good: 'อสังหาริมทรัพย์, บ้าน, คอนโด, ลงทุนที่ดิน' },
    { id: 'architecture', name: '🏛️ Architecture & Design', styleText: 'Modern architecture infographic style, clean geometric lines, blueprint grid overlay, monochrome with single color accent', good: 'สถาปัตยกรรม, ดีไซน์, interior, พื้นที่' },
    // Tech & Science
    { id: 'data-science', name: '📊 Data Science & Analytics', styleText: 'Data visualization infographic style, dark mode dashboard look, glowing charts, neon blue on black background', good: 'ข้อมูล, สถิติ, กราฟ, AI, Data' },
    { id: 'cyberpunk-tech', name: '🤖 Cyberpunk & Futuristic', styleText: 'Cyberpunk futuristic infographic style, dark background with neon cyan and magenta, holographic UI elements, circuit board textures', good: 'AI, เทคโนโลยี, ไซไฟ, อนาคต' },
    { id: 'science-nature', name: '🔬 Science & Nature', styleText: 'Scientific nature infographic style, botanical illustration elements, accurate diagrams, earthy green and brown palette', good: 'วิทยาศาสตร์, ธรรมชาติ, สิ่งแวดล้อม, ชีววิทยา' },
    // Spiritual & Cultural
    { id: 'thai-traditional', name: '🇹🇭 Thai Traditional', styleText: 'Thai traditional aesthetic infographic style, gold and red palette, Thai floral motifs, temple pattern borders', good: 'วัฒนธรรมไทย, พุทธศาสนา, ประเพณี' },
    { id: 'astrology', name: '🔮 Astrology & Spirituality', styleText: 'Mystical astrology infographic style, deep purple and starry background, zodiac wheel elements, celestial gold accents', good: 'ดูดวง, ราศี, วิถีชีวิต, ความเชื่อ' },
    { id: 'motivational', name: '🌟 Motivational & Inspirational', styleText: 'Bold motivational infographic style, sunrise gradient background, empowering typography, gold star elements', good: 'แรงบันดาลใจ, คำคม, motivation, success' },
    // Marketing & Viral
    { id: 'viral-listicle', name: '📱 Viral Listicle (Social)', styleText: 'Viral social media listicle style, bold numbered list, eye-catching header banner, high contrast colors, shareable layout', good: 'Top 5, 10 วิธี, ลิสต์ที่แชร์เยอะ' },
    { id: 'dark-luxury', name: '🖤 Dark Luxury Premium', styleText: 'Dark luxury infographic style, matte black background, gold and white typography, ultra-premium minimalist layout', good: 'สินค้าหรู, premium brand, ของแพง, exclusive' },
    { id: 'retro-vintage', name: '📻 Retro Vintage', styleText: 'Retro vintage infographic style, aged paper texture, 1970s color palette (mustard, terracotta, olive), hand-drawn icon style', good: 'ของวินเทจ, สไตล์คลาสสิก, ย้อนยุค' },
    { id: 'pastel-kawaii', name: '🌸 Pastel Kawaii', styleText: 'Cute kawaii pastel infographic style, soft pink and mint green, rounded bubble shapes, cute chibi character icons', good: 'สินค้าน่ารัก, เด็ก, ผู้หญิง, แบรนด์น่ารัก' },
    { id: 'environmental', name: '🌍 Environmental & Eco', styleText: 'Eco-friendly infographic style, leaf green and ocean blue, recycling icons, natural textures, sustainability visual language', good: 'สิ่งแวดล้อม, Eco, sustainability, ลดขยะ' },
    { id: 'custom-ai', name: '✨ กำหนดเอง (AI คิดให้)', styleText: '', good: 'กรอกสไตล์เองด้านล่าง' },
  ];

  const callOpenRouterText = async (prompt: string): Promise<string> => {
    const apiKey = getOpenRouterKey();
    if (!apiKey) throw new Error('ไม่พบ OpenRouter API Key');
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  };

  const handleInfogGenerateTopics = async () => {
    if (!infogTopic.trim()) return alert('⚠️ กรุณาใส่หัวข้อ Content ที่ต้องการก่อน');
    const count = Number(infogCount) || 10;
    setInfogIsGeneratingTopics(true);
    try {
      const csvContext = infogCsvText.trim() ? `\n\nข้อมูลหัวข้อ viral จาก CSV ที่ผู้ใช้อัปโหลด (ใช้เป็นแรงบันดาลใจ ดูว่าหัวข้อแนวไหนคนนิยม):\n${infogCsvText.slice(0, 3000)}` : '';
      const prompt = `คุณเป็นนักวางกลยุทธ์ Content สำหรับ Infographic ที่เก่งมาก
ผู้ใช้ต้องการสร้าง Infographic เกี่ยวกับ: "${infogTopic}"
${csvContext}

กรุณาคิดหัวข้อ Infographic ที่น่าสนใจ น่าแชร์ และให้ข้อมูลดี จำนวน ${count} หัวข้อ
แต่ละหัวข้อต้องเป็นภาษาไทย กระชับ ชัดเจน เข้าใจได้ทันที
เหมาะกับการทำเป็น Infographic สี่เหลี่ยม 1080x1080

ตอบเฉพาะหัวข้อเท่านั้น หัวข้อละ 1 บรรทัด ไม่ต้องใส่หมายเลข ไม่ต้องมีคำอธิบาย`;
      const result = await callOpenRouterText(prompt);
      const topics = result.split('\n').map(l => l.trim().replace(/^[-•*\d.]+\s*/, '')).filter(l => l.length > 3);
      setInfogTopics(topics);
      setInfogSelectedTopics(new Set(topics.map((_, i) => i)));
      setInfogPrompts([]);
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    } finally {
      setInfogIsGeneratingTopics(false);
    }
  };

  const INFOG_BATCH_SIZE = 5;

  const handleInfogGeneratePrompts = async () => {
    const selected = infogTopics.filter((_, i) => infogSelectedTopics.has(i));
    if (selected.length === 0) return alert('⚠️ กรุณาเลือกหัวข้ออย่างน้อย 1 อัน');
    const style = INFOG_STYLES.find(s => s.id === infogStyleId);
    let styleText = style?.styleText || '';
    if (infogStyleId === 'custom-ai' || !styleText) {
      if (!infogCustomStyle.trim()) return alert('⚠️ กรุณากรอกสไตล์ที่ต้องการในช่อง "กำหนดสไตล์เอง"');
      styleText = infogCustomStyle.trim();
    }

    setInfogIsGeneratingPrompts(true);
    setInfogPrompts([]);
    setInfogBatchProgress('');

    // Split into batches of INFOG_BATCH_SIZE to maintain quality + show progressive results
    const batches: string[][] = [];
    for (let i = 0; i < selected.length; i += INFOG_BATCH_SIZE) {
      batches.push(selected.slice(i, i + INFOG_BATCH_SIZE));
    }

    const buildBatchPrompt = (topics: string[], startIdx: number) => {
      const topicList = topics.map((t, i) => `${startIdx + i + 1}. ${t}`).join('\n');
      return `คุณเป็น AI Image Prompt Engineer ผู้เชี่ยวชาญ Infographic Design
สร้าง Image Prompt สำหรับ AI ตามแพทเทินนี้อย่างเคร่งครัด

PATTERN:
"Infographic square image, 1080x1080 aspect ratio. [STYLE]. Title at top in Thai: "[THAI_TITLE]". [VISUAL_LAYOUT_IN_ENGLISH]. [COLOR_PALETTE]."

กฎ:
- ขึ้นต้นด้วย "Infographic square image, 1080x1080 aspect ratio." เสมอ
- Style: "${styleText}"
- Title at top in Thai: ชื่อหัวข้อภาษาไทย
- Visual layout เป็นอังกฤษ (icons, panels, arrows, split screens, diagrams, Thai text labels)
- จบด้วย color palette และ mood

หัวข้อ (${topics.length} อัน):
${topicList}

คั่นแต่ละ Prompt ด้วย "---" เท่านั้น ห้ามใส่หมายเลขหรือคำอธิบายเพิ่ม`;
    };

    try {
      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];
        const startIdx = b * INFOG_BATCH_SIZE;
        setInfogBatchProgress(`กำลังสร้าง Prompt ชุดที่ ${b + 1}/${batches.length} (หัวข้อ ${startIdx + 1}–${startIdx + batch.length} จาก ${selected.length})...`);
        try {
          const result = await callOpenRouterText(buildBatchPrompt(batch, startIdx));
          const batchPrompts = result.split('---').map((p: string) => p.trim()).filter((p: string) => p.length > 20);
          // Append batch results immediately so user sees them as they arrive
          setInfogPrompts(prev => [...prev, ...batchPrompts]);
        } catch (e: any) {
          setInfogPrompts(prev => [...prev, `[ชุดที่ ${b + 1} error: ${e.message}]`]);
        }
      }
      setInfogBatchProgress('✅ สร้าง Prompt ครบทุกหัวข้อแล้ว!');
      setTimeout(() => setInfogBatchProgress(''), 3000);
    } finally {
      setInfogIsGeneratingPrompts(false);
    }
  };

  const handleBulkGenerate = () => {
    const getRandomItem = (array: Option[]) => {
      const validOptions = array.filter(opt => opt.value !== 'custom' && opt.value !== '');
      if (validOptions.length === 0) return '';
      return validOptions[Math.floor(Math.random() * validOptions.length)].value;
    };

    const combinedDetails = [...MONSTER_DETAILS, ...HUMAN_DETAILS, ...AURA_DETAILS, ...PROP_DETAILS, ...OTHER_DETAILS];

    const newPrompts = [];
    for (let i = 0; i < bulkCount; i++) {
      let subjectsPool = [];
      if (bulkCategory === 'all') {
        subjectsPool = [...MYTHICAL_CREATURES, ...FANTASY_CHARACTERS, ...OTHER_SUBJECTS];
      } else if (bulkCategory === 'mythical_creatures') {
        subjectsPool = MYTHICAL_CREATURES;
      } else if (bulkCategory === 'fantasy_characters') {
        subjectsPool = FANTASY_CHARACTERS;
      } else {
        subjectsPool = OTHER_SUBJECTS;
      }

      const s = getRandomItem(subjectsPool);
      const sd = getRandomItem(combinedDetails);
      const st = getRandomItem(SETTINGS);
      const h = getRandomItem(HOOKS);
      const a = getRandomItem(ACTIONS);
      const r = getRandomItem(REACTIONS);
      const c = getRandomItem(CAMERA_STYLES);
      const aes = getRandomItem(AESTHETICS);

      const promptParts = [];
      if (isSoraMode && activeSoraMods.length > 0) {
        const activeModsText = SORA_MODIFIERS.filter(m => activeSoraMods.includes(m.id)).map(m => m.value).join(', ');
        promptParts.push(`${activeModsText}. A ${s}`);
      } else {
        promptParts.push(`A hyper-realistic, ${s}`);
      }

      if (sd) promptParts.push(sd);
      if (st) promptParts.push(`, ${st}`);
      
      let middle = '';
      if (h && h.trim() !== '') {
         middle += `. Video starts with an intense 3-second hook: ${h}`;
      }
      if (a || r) {
         middle += (middle !== '' ? '. Then, it ' : '. It ');
         if (a) middle += a;
         if (r) middle += (a ? `, and then ${r}` : r);
      }
      if (middle !== '') middle += '.';
      else middle = '.';

      promptParts.push(middle);

      if (c) promptParts.push(` ${c}`);
      if (aes) promptParts.push(` ${aes}`);

      let finalStr = promptParts.join(' ').replace(/ ,/g, ',').replace(/ \./g, '.').replace(/\s+/g, ' ').trim();
      let dialogueText = null;
      if (includeDialogue) {
        dialogueText = DIALOGUES[Math.floor(Math.random() * DIALOGUES.length)];
        finalStr += ` Dialogue: "${dialogueText}"`;
      }

      if (outputAsJson) {
         newPrompts.push({
            id: i + 1,
            scene_setup: {
               shot_type: c || "Cinematic Shot",
               environment: {
                  location: st || "Unknown Location",
                  lighting: aes || "Cinematic Lighting",
                  atmosphere: isSoraMode ? "Intense panic" : "Mysterious"
               },
               subjects: [
                  {
                     type: "Subject",
                     character: s,
                     appearance: sd || "Highly detailed",
                     action: a || "Moving cautiously",
                     reaction: r || "Reacting to environment"
                  }
               ],
               camera_and_effects: isSoraMode && activeSoraMods.length > 0 ? SORA_MODIFIERS.filter(m => activeSoraMods.includes(m.id)).map(m => m.value) : [],
               dialogue: includeDialogue ? { speaker: "Subject", text: dialogueText } : null
            },
            generated_prompt: finalStr
         });
      } else {
         newPrompts.push(finalStr);
      }
    }

    setGeneratedPrompt(outputAsJson ? newPrompts.map(p => JSON.stringify(p)).join('\n\n') : newPrompts.join('\n\n'));
  };

  const handleShortFilmGenerate = (sceneCount: 5 | 15 = 5) => {
    const getRandomItem = (array: Option[]) => {
      const validOptions = array.filter(opt => opt.value !== 'custom' && opt.value !== '');
      if (validOptions.length === 0) return '';
      return validOptions[Math.floor(Math.random() * validOptions.length)].value;
    };

    const arcsPool = sceneCount === 15 ? SHORT_FILM_15_ARCS : SHORT_FILM_ARCS;
    const newPrompts = [];
    for (let i = 0; i < shortFilmCount; i++) {
      let subjectsPool = [];
      if (shortFilmCategory === 'all') {
        subjectsPool = [...MYTHICAL_CREATURES, ...FANTASY_CHARACTERS, ...OTHER_SUBJECTS];
      } else if (shortFilmCategory === 'mythical_creatures') {
        subjectsPool = MYTHICAL_CREATURES;
      } else if (shortFilmCategory === 'fantasy_characters') {
        subjectsPool = FANTASY_CHARACTERS;
      } else {
        subjectsPool = OTHER_SUBJECTS;
      }

      const s = getRandomItem(subjectsPool);
      const st = getRandomItem(SETTINGS);
      const arc = arcsPool[Math.floor(Math.random() * arcsPool.length)];
      
      const protag = PROTAGONISTS[Math.floor(Math.random() * PROTAGONISTS.length)];
      const mc_prop = MACGUFFIN_PROPS[Math.floor(Math.random() * MACGUFFIN_PROPS.length)];

      let activeModsText = '';
      if (isSoraMode && activeSoraMods.length > 0) {
        activeModsText = SORA_MODIFIERS.filter(m => activeSoraMods.includes(m.id)).map(m => m.value).join(', ') + '. ';
      }

      for (let sIdx = 1; sIdx <= sceneCount; sIdx++) {
         const c = getRandomItem(CAMERA_STYLES);
         const aes = getRandomItem(AESTHETICS);
         const a = getRandomItem(ACTIONS);
         const r = getRandomItem(REACTIONS);

         const applyTemplate = (template: string) => {
           let baseScene = template
             .replace(/\[SUBJECT\]/g, s)
             .replace(/\[SETTING\]/g, st)
             .replace(/\[ACTION\]/g, a)
             .replace(/\[REACTION\]/g, r)
             .replace(/\[CAMERA\]/g, c)
             .replace(/\[AESTHETICS?\]/g, aes)
             .replace(/\[PROTAGONIST\]/g, protag)
             .replace(/\[PROP\]/g, mc_prop);
             
           // Push the user's Sora Modifiers to the back so it acts as camera texture rather than the primary subject,
           // and inject extremely high-end Hollywood keywords to override generic AI behavior.
           let finalScene = `${baseScene} High-end Hollywood blockbuster cinematography, perfect framing, dynamic movement. ${activeModsText}`.replace(/ \./g, '.').replace(/\s+/g, ' ').trim();
           if (includeDialogue) {
             finalScene += ` Dialogue: "${DIALOGUES[Math.floor(Math.random() * DIALOGUES.length)]}"`;
           }
           return finalScene;
         };

         const finalSceneData = applyTemplate((arc.scenes as any)[sIdx]);
         if (outputAsJson) {
            newPrompts.push(JSON.stringify({
              film_id: i + 1,
              film_title: arc.name,
              scene_number: sIdx,
              scene_setup: {
                shot_type: c,
                environment: {
                  location: st,
                  lighting: aes
                },
                subjects: [
                  { type: "Protagonist", character: protag, action: a },
                  { type: "Antagonist", character: s, action: r }
                ],
                prop: mc_prop,
                camera_and_effects: isSoraMode && activeSoraMods.length > 0 ? SORA_MODIFIERS.filter(m => activeSoraMods.includes(m.id)).map(m => m.value) : []
              },
              prompt: finalSceneData
            }));
         } else {
            newPrompts.push(finalSceneData);
         }
      }
    }

    setGeneratedPrompt(newPrompts.join('\n'));
  };

  // --- Video Analyzer Logic ---
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setAnalysisError('กรุณาอัปโหลดไฟล์วิดีโอเท่านั้น');
      return;
    }

    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
    setAnalysisError('');
    setAnalysisResult(null);
  };

  const getOpenRouterKey = () => {
    // Check multiple places for the key
    const globalKey = localStorage.getItem('api_global_active_id') 
                      ? JSON.parse(localStorage.getItem('api_global_profiles') || '[]')
                        .find((p: any) => p.id === localStorage.getItem('api_global_active_id'))?.openRouterKey 
                      : null;
    const oldKey = localStorage.getItem('openrouter_key');
    let aiKey = globalKey || oldKey;
    
    // Also check openrouter_keys array from old AI Generator
    if (!aiKey) {
        try {
            const arr = JSON.parse(localStorage.getItem('openrouter_keys') || '[]');
            if(arr.length > 0) aiKey = arr[0].key;
        }catch(e) {}
    }
    
    return aiKey;
  };

  const extractFrameAndAnalyze = async () => {
    if (!videoRef.current || !videoFile) return;

    const apiKey = getOpenRouterKey();
    if (!apiKey) {
      setAnalysisError('ไม่พบ OpenRouter API Key กรุณาไปตั้งค่าที่เมนู "ตั้งค่า API (คีย์)" หรือ AI Content Generator ก่อน');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError('');

    try {
      const video = videoRef.current;
      
      // Attempt to seek to 1.5 seconds or 20% of the video to avoid black intro frames
      const targetTime = video.duration > 5 ? video.duration * 0.2 : 1.5;
      
      const frameBase64 = await new Promise<string>((resolve, reject) => {
        const handleSeeked = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if(ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              // Max 1MB image target by reducing quality/size if needed
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              resolve(dataUrl);
            } else {
              reject(new Error("Cannot create canvas context"));
            }
          } catch(e) {
            reject(e);
          } finally {
            video.removeEventListener('seeked', handleSeeked);
          }
        };

        video.addEventListener('seeked', handleSeeked);
        // Add a timeout fallback in case seeking fails or hangs
        setTimeout(() => {
           video.removeEventListener('seeked', handleSeeked);
           reject(new Error("Video seeking timed out (Cannot extract frame)"));
        }, 3000);
        
        video.currentTime = targetTime;
      });

      // Prepare Prompt providing the specific options available
      const buildPromptOptions = (arr: Option[]) => arr.filter(o => o.value !== 'custom' && o.value !== '').map((o, i) => `${i+1}. [${o.value}]`).join(',\n');
      
      const systemPrompt = `You are an expert cinematic video analyst. Your task is to look at the provided image (extracted from a video) and map its visual style, camera angle, action, and setting perfectly to our pre-defined options.

Choose the MOST SIMILAR value from the provided lists for each category. 
You must respond ONLY with a raw JSON object containing the exact matched "value" string. Do not use Markdown formatting or code blocks.

AVAILABLE SETTINGS:
${buildPromptOptions(SETTINGS)}

AVAILABLE ACTIONS (What's happening? Focus on POV or action):
${buildPromptOptions(ACTIONS)}

AVAILABLE CAMERA STYLES:
${buildPromptOptions(CAMERA_STYLES)}

AVAILABLE AESTHETICS (Lighting/Color/Resolution):
${buildPromptOptions(AESTHETICS)}

EXPECTED JSON OUTPUT FORMAT:
{
  "setting": "matched value exactly as written in brackets above",
  "action": "matched value exactly as written in brackets above",
  "camera": "matched value exactly as written in brackets above",
  "aesthetic": "matched value exactly as written in brackets above"
}`;

      // Call OpenRouter Vision API (Requires a vision-capable model like gemini-1.5-pro or gpt-4o)
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'Bulk Video Creator',
        },
        body: JSON.stringify({
          model: DEFAULT_AI_MODEL,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: systemPrompt },
                { type: 'image_url', image_url: { url: frameBase64 } }
              ]
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err.error?.message || err.message || `API Error: ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices[0]?.message?.content;
      
      let parsed = null;
      try {
        const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        throw new Error('AI returned an invalid response format.');
      }

      setAnalysisResult({
        setting: parsed.setting || '',
        action: parsed.action || '',
        camera: parsed.camera || '',
        aesthetic: parsed.aesthetic || ''
      });

    } catch (e: any) {
      console.error(e);
      setAnalysisError(`เกิดข้อผิดพลาด: ${e.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCloneBulkGenerate = () => {
    if(!analysisResult) return;
    const getRandomItem = (array: Option[]) => {
      const validOptions = array.filter(opt => opt.value !== 'custom' && opt.value !== '');
      if (validOptions.length === 0) return '';
      return validOptions[Math.floor(Math.random() * validOptions.length)].value;
    };

    const combinedDetails = [...MONSTER_DETAILS, ...HUMAN_DETAILS, ...AURA_DETAILS, ...PROP_DETAILS, ...OTHER_DETAILS];

    const newPrompts = [];
    for (let i = 0; i < cloneBulkCount; i++) {
        let subjectsPool = [];
        if (cloneSubjectCategory === 'all') {
            subjectsPool = [...MYTHICAL_CREATURES, ...FANTASY_CHARACTERS, ...OTHER_SUBJECTS];
        } else if (cloneSubjectCategory === 'mythical_creatures') {
            subjectsPool = MYTHICAL_CREATURES;
        } else if (cloneSubjectCategory === 'fantasy_characters') {
            subjectsPool = FANTASY_CHARACTERS;
        } else {
            subjectsPool = OTHER_SUBJECTS;
        }

        const s = getRandomItem(subjectsPool);
        const sd = getRandomItem(combinedDetails);
        const st = getRandomItem(SETTINGS); // Randomize Setting now
        const h = getRandomItem(HOOKS); // Randomize Hook
        const a = getRandomItem(ACTIONS); // Randomize Action now
        const r = getRandomItem(REACTIONS); // Randomize reaction

        const promptParts = [];
        if (isSoraMode && activeSoraMods.length > 0) {
          const activeModsText = SORA_MODIFIERS.filter(m => activeSoraMods.includes(m.id)).map(m => m.value).join(', ');
          promptParts.push(`${activeModsText}. A ${s}`);
        } else {
          promptParts.push(`A hyper-realistic, ${s}`);
        }

        if (sd) promptParts.push(sd);
        if (st) promptParts.push(`, ${st}`);
        
        let middle = '';
        if (h && h.trim() !== '') {
           middle += `. Video starts with an intense 3-second hook: ${h}`;
        }
        if (a || r) {
           middle += (middle !== '' ? '. Then, it ' : '. It ');
           if (a) middle += a;
           if (r) middle += (a ? `, and then ${r}` : r);
        }
        if (middle !== '') middle += '.';
        else middle = '.';

        promptParts.push(middle);

        if (analysisResult.camera) promptParts.push(` ${analysisResult.camera}`);
        if (analysisResult.aesthetic) promptParts.push(` ${analysisResult.aesthetic}`);

        let finalStr = promptParts.join(' ').replace(/ ,/g, ',').replace(/ \./g, '.').replace(/\s+/g, ' ').trim();
        if (includeDialogue) {
          finalStr += ` Dialogue: "${DIALOGUES[Math.floor(Math.random() * DIALOGUES.length)]}"`;
        }
        newPrompts.push(finalStr);
    }
    setGeneratedPrompt(newPrompts.join('\n\n'));
    alert(`สร้าง ${cloneBulkCount} โพรอมต์ โคลนสไตล์วิดีโอเรียบร้อยแล้ว!`);
  };

  const handleCloneShortFilmGenerate = () => {
    if(!analysisResult) return;
    
    const getRandomItem = (array: Option[]) => {
      const validOptions = array.filter(opt => opt.value !== 'custom' && opt.value !== '');
      if (validOptions.length === 0) return '';
      return validOptions[Math.floor(Math.random() * validOptions.length)].value;
    };

    const newPrompts = [];
    for (let i = 0; i < cloneShortFilmCount; i++) {
        let subjectsPool = [];
        if (cloneShortFilmCategory === 'all') {
            subjectsPool = [...MYTHICAL_CREATURES, ...FANTASY_CHARACTERS, ...OTHER_SUBJECTS];
        } else if (cloneShortFilmCategory === 'mythical_creatures') {
            subjectsPool = MYTHICAL_CREATURES;
        } else if (cloneShortFilmCategory === 'fantasy_characters') {
            subjectsPool = FANTASY_CHARACTERS;
        } else {
            subjectsPool = OTHER_SUBJECTS;
        }

        const s = getRandomItem(subjectsPool);
        const st = getRandomItem(SETTINGS);
        const a = getRandomItem(ACTIONS);
        const r = getRandomItem(REACTIONS);
        const arc = SHORT_FILM_ARCS[Math.floor(Math.random() * SHORT_FILM_ARCS.length)];
        
        const protag = PROTAGONISTS[Math.floor(Math.random() * PROTAGONISTS.length)];
        const mc_prop = MACGUFFIN_PROPS[Math.floor(Math.random() * MACGUFFIN_PROPS.length)];

        let activeModsText = '';
        if (isSoraMode && activeSoraMods.length > 0) {
            activeModsText = SORA_MODIFIERS.filter(m => activeSoraMods.includes(m.id)).map(m => m.value).join(', ') + '. ';
        }

        const applyTemplate = (template: string) => {
            const baseScene = template
                .replace(/\[SUBJECT\]/g, s)
                .replace(/\[SETTING\]/g, st)
                .replace(/\[ACTION\]/g, a)
                .replace(/\[REACTION\]/g, r)
                .replace(/\[CAMERA\]/g, analysisResult.camera)
                .replace(/\[AESTHETICS?\]/g, analysisResult.aesthetic)
                .replace(/\[PROTAGONIST\]/g, protag)
                .replace(/\[PROP\]/g, mc_prop);
            let finalScene = `${activeModsText}${baseScene}`.replace(/ \./g, '.').replace(/\s+/g, ' ').trim();
            if (includeDialogue) {
              finalScene += ` Dialogue: "${DIALOGUES[Math.floor(Math.random() * DIALOGUES.length)]}"`;
            }
            return finalScene;
        };

        newPrompts.push(applyTemplate(arc.scenes[1]));
        newPrompts.push(applyTemplate(arc.scenes[2]));
        newPrompts.push(applyTemplate(arc.scenes[3]));
        newPrompts.push(applyTemplate(arc.scenes[4]));
        newPrompts.push(applyTemplate(arc.scenes[5]));
    }
    setGeneratedPrompt(newPrompts.join('\n'));
    alert(`สร้างหนังสั้น ${cloneShortFilmCount} เรื่อง แบบโคลนสไตล์วิดีโอเรียบร้อยแล้ว!`);
  };

  // renderSelect was removed as manual selection is deprecated

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10">
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Configuration Panel */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] text-white shadow-lg shadow-[#8b5cf6]/30">
            🪄
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">AI Video Prompt Studio</h1>
            <p className="text-[var(--text-secondary)] text-sm mt-1">เครื่องมือสร้าง Prompt แบบเจาะจงมุมกล้อง สำหรับวิดีโอปังๆ</p>
          </div>
        </div>

         {/* --- Sora 2 Realism Mode --- */}
        <div className={`border rounded-3xl p-6 shadow-xl space-y-4 transition-all duration-300 relative overflow-hidden ${isSoraMode ? 'bg-[#0f172a] border-[#38bdf8] shadow-[#38bdf8]/10' : 'bg-[var(--bg-card)] border-[var(--border-color)]'}`}>
          {isSoraMode && <div className="absolute top-0 right-0 w-32 h-32 bg-[#38bdf8] opacity-10 blur-3xl rounded-full pointer-events-none"></div>}
          <div className="flex items-center justify-between">
            <h2 className={`text-lg font-bold flex items-center gap-2 ${isSoraMode ? 'text-[#38bdf8]' : 'text-[var(--text-primary)]'}`}>
              <span>🎥</span> โหมดความสมจริง (SORA-2 Realism Mode)
            </h2>
            <button 
              onClick={() => setIsSoraMode(!isSoraMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isSoraMode ? 'bg-[#38bdf8]' : 'bg-[var(--bg-neutral)]'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSoraMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            ปิดการใช้คำกว้างๆ (เช่น Hyper-realistic) และบังคับใส่คีย์เวิร์ดทำลายความสวยงาม เพื่อให้ AI ผลิตภาพที่ดู "ดิบเถื่อนเหมือนโลกจริง" มากที่สุด (แก้ปัญหา Veo ภาพหน้าเนี้ยบหรือหลอกเกินไป)
          </p>
          
          {isSoraMode && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 animate-fade-in relative z-10">
               {SORA_MODIFIERS.map(mod => (
                 <label key={mod.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${activeSoraMods.includes(mod.id) ? 'bg-[#38bdf8]/10 border-[#38bdf8]/50' : 'border-[#38bdf8]/10 hover:border-[#38bdf8]/30 bg-black/20'}`}>
                    <input 
                      type="checkbox" 
                      className="mt-1 w-4 h-4 accent-[#38bdf8] flex-shrink-0" 
                      checked={activeSoraMods.includes(mod.id)}
                      onChange={(e) => {
                        if(e.target.checked) setActiveSoraMods(prev => [...prev, mod.id]);
                        else setActiveSoraMods(prev => prev.filter(id => id !== mod.id));
                      }}
                    />
                    <div className="flex flex-col">
                      <span className={`text-sm font-semibold ${activeSoraMods.includes(mod.id) ? 'text-[#f8fafc]' : 'text-[var(--text-primary)]'}`}>{mod.label}</span>
                      <span className={`text-xs mt-1 ${activeSoraMods.includes(mod.id) ? 'text-slate-300' : 'text-[var(--text-secondary)]'}`}>{mod.desc}</span>
                    </div>
                 </label>
               ))}
             </div>
          )}

          {/* Dialogue TTS Option */}
          <div className="pt-4 mt-4 border-t border-[var(--border-color)]">
             <label className="flex items-center gap-3 cursor-pointer group">
               <div className="relative">
                 <input 
                   type="checkbox" 
                   className="sr-only"
                   checked={includeDialogue}
                   onChange={(e) => setIncludeDialogue(e.target.checked)}
                 />
                 <div className={`block w-10 h-6 rounded-full transition-colors ${includeDialogue ? 'bg-[#10b981]' : 'bg-[var(--bg-neutral)]'}`}></div>
                 <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${includeDialogue ? 'transform translate-x-4' : ''}`}></div>
               </div>
               <div className="flex flex-col">
                 <span className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                   <span>🎙️</span> ต่อท้ายด้วยบทพูด (TTS Dialogue)
                 </span>
                 <span className="text-xs text-[var(--text-secondary)]">
                   สุ่ม 500 ประโยคตื่นเต้น/คำอุทาน เป็นภาษาอังกฤษต่อท้าย Prompt เช่น `Dialogue: "Oh my god!"`
                 </span>
               </div>
             </label>

             <label className="flex items-center gap-3 cursor-pointer group pt-4">
               <div className="relative">
                 <input 
                   type="checkbox" 
                   className="sr-only"
                   checked={outputAsJson}
                   onChange={(e) => setOutputAsJson(e.target.checked)}
                 />
                 <div className={`block w-10 h-6 rounded-full transition-colors ${outputAsJson ? 'bg-[#f59e0b]' : 'bg-[var(--bg-neutral)]'}`}></div>
                 <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${outputAsJson ? 'transform translate-x-4' : ''}`}></div>
               </div>
               <div className="flex flex-col">
                 <span className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                   <span className="text-[#f59e0b]">{`{}`}</span> Format Output เป็น JSON
                 </span>
                 <span className="text-xs text-[var(--text-secondary)]">
                   รับผลลัพธ์เป็นโครงสร้าง JSON เต็มรูปแบบ เพื่อนำไปทำงานต่อใน Pipeline หรือ API อื่นๆ อย่างแม่นยำ
                 </span>
               </div>
             </label>
          </div>
        </div>

        {/* --- Video Analyzer UI --- */}
        <div className="bg-[var(--bg-card)] border border-[#8b5cf6]/30 rounded-3xl p-6 shadow-xl shadow-[#8b5cf6]/5 space-y-4 relative overflow-hidden">
           <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-[#8b5cf6] opacity-10 blur-3xl rounded-full pointer-events-none"></div>
           <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2 text-[#8b5cf6]">
                <span>👁️</span> AI วิเคราะห์วิดีโอต้นแบบ (Clone Style)
              </h2>
           </div>
           <p className="text-sm text-[var(--text-secondary)]">
             อัปโหลดวิดีโอเรฟเฟอเรนซ์ที่คุณชอบ (พวกคลิปไวรัล TikTok/Reels) แล้วให้ AI สกัดลอกมุมกล้อง แสง และบรรยากาศโดยอัตโนมัติ
           </p>

           <div className="flex flex-col md:flex-row gap-4 items-start">
             <div className="w-full md:w-1/2 flex flex-col gap-2">
                <input 
                  type="file" 
                  accept="video/mp4,video/webm,video/quicktime" 
                  ref={fileInputRef}
                  onChange={handleVideoUpload}
                  className="hidden"
                />
                
                {!videoPreviewUrl ? (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-[150px] rounded-2xl border-2 border-dashed border-[#8b5cf6]/50 hover:bg-[#8b5cf6]/5 transition-all flex flex-col items-center justify-center gap-2 text-[#8b5cf6] font-medium"
                    >
                      <span className="text-2xl">📤</span>
                      อัปโหลดวิดีโอเรฟ (MP4 / MOV)
                    </button>
                ) : (
                   <div className="relative w-full h-[150px] rounded-2xl overflow-hidden border border-[#8b5cf6]/30 bg-black group">
                      <video 
                        ref={videoRef} 
                        src={videoPreviewUrl} 
                        className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                        controls={false}
                        muted
                        playsInline
                      />
                      <button 
                        onClick={() => { setVideoFile(null); setVideoPreviewUrl(null); setAnalysisError(''); }}
                        className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-500 transition-colors pointer-events-auto"
                      >
                         ×
                      </button>
                   </div>
                )}
             </div>

             <div className="w-full md:w-1/2 flex flex-col h-full justify-center">
                {videoPreviewUrl && (
                   <button
                     disabled={isAnalyzing}
                     onClick={extractFrameAndAnalyze}
                     className="w-full py-3 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                   >
                     {isAnalyzing ? (
                       <>
                         <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                         กำลังวิเคราะห์โครงภาพ...
                       </>
                     ) : (
                       '✨ ให้ AI วิเคราะห์สไตล์วิดีโอ'
                     )}
                   </button>
                )}
                 {analysisError && (
                  <p className="mt-2 text-xs text-red-500 font-medium">⚠️ {analysisError}</p>
                )}
             </div>
           </div>

           {analysisResult && (
             <div className="mt-4 p-4 rounded-2xl bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 animate-fade-in relative z-10">
               <h3 className="font-bold text-[#8b5cf6] mb-3 text-sm">✅ AI วิเคราะห์สไตล์วิดีโอสำเร็จ (เข้ากับหมวดหมู่ดังนี้):</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs mb-4">
                 <div className="bg-black/20 p-2 rounded-lg">
                   <span className="text-[#8b5cf6] font-semibold block mb-1">สถานที่ (Setting)</span>
                   <span className="text-[var(--text-secondary)]">{SETTINGS.find(o => o.value === analysisResult.setting)?.label || analysisResult.setting}</span>
                 </div>
                 <div className="bg-black/20 p-2 rounded-lg">
                   <span className="text-[#8b5cf6] font-semibold block mb-1">สิ่งที่เกิด (Action)</span>
                   <span className="text-[var(--text-secondary)]">{ACTIONS.find(o => o.value === analysisResult.action)?.label || analysisResult.action}</span>
                 </div>
                 <div className="bg-black/20 p-2 rounded-lg">
                   <span className="text-[#8b5cf6] font-semibold block mb-1">มุมกล้อง (Camera)</span>
                   <span className="text-[var(--text-secondary)]">{CAMERA_STYLES.find(o => o.value === analysisResult.camera)?.label || analysisResult.camera}</span>
                 </div>
                 <div className="bg-black/20 p-2 rounded-lg">
                   <span className="text-[#8b5cf6] font-semibold block mb-1">สไตล์ภาพ (Aesthetic)</span>
                   <span className="text-[var(--text-secondary)]">{AESTHETICS.find(o => o.value === analysisResult.aesthetic)?.label || analysisResult.aesthetic}</span>
                 </div>
               </div>

               <div className="border-t border-[#8b5cf6]/20 pt-4 mt-2">
                 <h4 className="font-bold text-[var(--text-primary)] text-sm mb-4">⚡ นำสไตล์วิดีโอนี้ไปสร้างเนื้อหาใหม่ (Clone Style)</h4>
                 
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Option 1: Bulk Generation */}
                    <div className="bg-black/20 p-4 rounded-xl border border-[#8b5cf6]/30 flex flex-col justify-between gap-3">
                       <h5 className="font-bold text-[#8b5cf6] text-xs">🔥 สุ่มคลิปเดี่ยวจำนวนมาก (Bulk)</h5>
                       <div className="flex gap-2">
                           <div className="flex-1 flex flex-col gap-1">
                             <label className="text-[10px] text-[var(--text-secondary)]">หมวดหมู่ตัวละคร:</label>
                             <select 
                               value={cloneSubjectCategory} 
                               onChange={(e) => setCloneSubjectCategory(e.target.value)}
                               className="w-full bg-[#1e293b] border border-[#8b5cf6]/30 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]"
                             >
                               <option value="all">ผสมทุกหมวดหมู่ (All)</option>
                               {SUBJECT_CATEGORIES.map((opt) => (
                                 opt.value !== 'custom' && <option key={opt.value} value={opt.value}>{opt.label}</option>
                               ))}
                             </select>
                           </div>
                           <div className="w-[70px] flex flex-col gap-1">
                             <label className="text-[10px] text-[var(--text-secondary)]">จำนวน:</label>
                             <NumInput min={1} max={100} value={cloneBulkCount} onChange={setCloneBulkCount} className="w-full bg-[#1e293b] border border-[#8b5cf6]/30 text-white rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]" />
                           </div>
                       </div>
                       <button
                         onClick={handleCloneBulkGenerate}
                         className="w-full bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] hover:from-[#7c3aed] hover:to-[#db2777] text-white text-xs font-bold py-2 rounded-lg transition-all mt-1"
                       >
                         สร้างแรนด้อม {cloneBulkCount} Prompts ทันที
                       </button>
                    </div>

                    {/* Option 2: Short Film */}
                    <div className="bg-black/20 p-4 rounded-xl border border-[#ef4444]/30 flex flex-col justify-between gap-3">
                       <h5 className="font-bold text-[#ef4444] text-xs">🎬 หนังสั้นต่อเนื่อง 5 ฉาก (Short Film)</h5>
                       <div className="flex gap-2">
                           <div className="flex-1 flex flex-col gap-1">
                             <label className="text-[10px] text-[var(--text-secondary)]">หมวดหมู่ตัวละคร:</label>
                             <select 
                               value={cloneShortFilmCategory} 
                               onChange={(e) => setCloneShortFilmCategory(e.target.value)}
                               className="w-full bg-[#1e293b] border border-[#ef4444]/30 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#ef4444]"
                             >
                               <option value="all">ผสมทุกหมวดหมู่ (All)</option>
                               {SUBJECT_CATEGORIES.map((opt) => (
                                 opt.value !== 'custom' && <option key={opt.value} value={opt.value}>{opt.label}</option>
                               ))}
                             </select>
                           </div>
                           <div className="w-[70px] flex flex-col gap-1">
                             <label className="text-[10px] text-[var(--text-secondary)]">เรื่อง:</label>
                             <NumInput min={1} max={50} value={cloneShortFilmCount} onChange={setCloneShortFilmCount} className="w-full bg-[#1e293b] border border-[#ef4444]/30 text-white rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[#ef4444]" />
                           </div>
                       </div>
                       <button
                         onClick={handleCloneShortFilmGenerate}
                         className="w-full bg-gradient-to-r from-[#ef4444] to-[#f59e0b] hover:from-[#dc2626] hover:to-[#d97706] text-white text-xs font-bold py-2 rounded-lg transition-all mt-1"
                       >
                         สร้างหนังสั้น {cloneShortFilmCount} เรื่อง ทันที
                       </button>
                    </div>
                 </div>
                 <p className="text-[10px] text-[var(--text-secondary)] mt-3 text-center">💡 ระบบจะล็อคมุมกล้องและแสงให้เหมือนเรฟเป๊ะ แล้วสุ่มเนื้อเรื่องกับตัวละครเข้าไปใหม่ในลายเส้นเดิม</p>
               </div>
             </div>
           )}
        </div>

        {/* --- Prompt Option Library (Database) --- */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-xl shadow-black/5 space-y-4">
          <div 
            className="flex items-center justify-between cursor-pointer group"
            onClick={() => setIsLibraryOpen(!isLibraryOpen)}
          >
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2 text-[#f59e0b]">
                <span>📚</span> ฐานข้อมูล Prompt (Prompt Library)
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                คลิกเพื่อดูรายการคำศัพท์ทั้งหมดที่ AI ใช้สุ่ม (สถานที่, ฮุก, แอคชั่น, ทิศทางกล้อง ฯลฯ)
              </p>
            </div>
            <div className={`p-2 rounded-full bg-[var(--bg-elevated)] transition-transform duration-300 ${isLibraryOpen ? 'rotate-180' : ''}`}>
              ▼
            </div>
          </div>
          
          {isLibraryOpen && (
            <div className="pt-4 border-t border-[var(--border-color)] animate-fade-in space-y-6">
              <div className="flex flex-wrap gap-2 mb-4 border-b border-[var(--border-color)] pb-4">
                 <button onClick={() => setActiveLibraryTab('settings')} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${activeLibraryTab === 'settings' ? 'bg-[#8b5cf6] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'}`}>สถานที่ (Settings)</button>
                 <button onClick={() => setActiveLibraryTab('hooks')} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${activeLibraryTab === 'hooks' ? 'bg-[#ec4899] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'}`}>ฮุก (Hooks)</button>
                 <button onClick={() => setActiveLibraryTab('actions')} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${activeLibraryTab === 'actions' ? 'bg-[#f59e0b] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'}`}>สิ่งที่ทำ (Actions)</button>
                 <button onClick={() => setActiveLibraryTab('reactions')} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${activeLibraryTab === 'reactions' ? 'bg-[#10b981] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'}`}>การตอบสนอง (Reactions)</button>
                 <button onClick={() => setActiveLibraryTab('camera')} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${activeLibraryTab === 'camera' ? 'bg-[#3b82f6] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'}`}>งานภาพ (Camera)</button>
                 <button onClick={() => setActiveLibraryTab('subjects')} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${activeLibraryTab === 'subjects' ? 'bg-[#6366f1] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'}`}>ตัวแบบ (Subjects)</button>
                 <button onClick={() => setActiveLibraryTab('shortfilm')} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${activeLibraryTab === 'shortfilm' ? 'bg-[#ef4444] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'}`}>เนื้อเรื่องสั้น (5 ฉาก)</button>
                 <button onClick={() => setActiveLibraryTab('shortfilm15')} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${activeLibraryTab === 'shortfilm15' ? 'bg-purple-600 text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'}`}>เนื้อเรื่องสั้น (15 ฉาก)</button>
                 
                 <button onClick={() => setActiveLibraryTab('protagonists')} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${activeLibraryTab === 'protagonists' ? 'bg-[#14b8a6] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'}`}>ตัวละครหลัก (Protagonists)</button>
                 <button onClick={() => setActiveLibraryTab('props')} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${activeLibraryTab === 'props' ? 'bg-[#84cc16] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'}`}>สิ่งของ (Props)</button>
                 <button onClick={() => setActiveLibraryTab('dialogues')} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${activeLibraryTab === 'dialogues' ? 'bg-[#06b6d4] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'}`}>บทพูด (Dialogues)</button>
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar pr-2 space-y-2">
                 {activeLibraryTab === 'settings' && SETTINGS.map((s, i) => s.value !== 'custom' && s.value !== '' && (
                    <div key={i} className="p-3 bg-[var(--bg-elevated)] rounded-xl text-sm border border-[var(--border-color)]">
                       <span className="font-bold text-[var(--text-primary)] block mb-1">{s.label}</span>
                       <span className="text-xs text-[var(--text-secondary)]">{s.value}</span>
                    </div>
                 ))}
                 
                 {activeLibraryTab === 'hooks' && HOOKS.map((s, i) => s.value !== 'custom' && s.value !== '' && (
                    <div key={i} className="p-3 bg-[var(--bg-elevated)] rounded-xl text-sm border border-[var(--border-color)]">
                       <span className="font-bold text-[#ec4899] block mb-1">{s.label}</span>
                       <span className="text-xs text-[var(--text-secondary)]">{s.value}</span>
                    </div>
                 ))}

                 {activeLibraryTab === 'actions' && ACTIONS.map((s, i) => s.value !== 'custom' && s.value !== '' && (
                    <div key={i} className="p-3 bg-[var(--bg-elevated)] rounded-xl text-sm border border-[var(--border-color)]">
                       <span className="font-bold text-[#f59e0b] block mb-1">{s.label}</span>
                       <span className="text-xs text-[var(--text-secondary)]">{s.value}</span>
                    </div>
                 ))}

                 {activeLibraryTab === 'reactions' && REACTIONS.map((s, i) => s.value !== 'custom' && s.value !== '' && (
                    <div key={i} className="p-3 bg-[var(--bg-elevated)] rounded-xl text-sm border border-[var(--border-color)]">
                       <span className="font-bold text-[#10b981] block mb-1">{s.label}</span>
                       <span className="text-xs text-[var(--text-secondary)]">{s.value}</span>
                    </div>
                 ))}

                 {activeLibraryTab === 'camera' && (
                    <div className="space-y-6">
                       <div>
                         <h3 className="text-sm font-bold text-[#3b82f6] mb-3">📸 ทิศทางกล้อง (Camera Styles)</h3>
                         <div className="space-y-2">
                           {CAMERA_STYLES.map((s, i) => s.value !== 'custom' && s.value !== '' && (
                              <div key={i} className="p-3 bg-[var(--bg-elevated)] rounded-xl text-sm border border-[var(--border-color)]">
                                 <span className="font-bold text-[var(--text-primary)] block mb-1">{s.label}</span>
                                 <span className="text-xs text-[var(--text-secondary)]">{s.value}</span>
                              </div>
                           ))}
                         </div>
                       </div>
                       <div>
                         <h3 className="text-sm font-bold text-[#3b82f6] mb-3">🎨 สไตล์ภาพ & แสง (Aesthetics & Lighting)</h3>
                         <div className="space-y-2">
                           {AESTHETICS.map((s, i) => s.value !== 'custom' && s.value !== '' && (
                              <div key={i} className="p-3 bg-[var(--bg-elevated)] rounded-xl text-sm border border-[var(--border-color)]">
                                 <span className="font-bold text-[var(--text-primary)] block mb-1">{s.label}</span>
                                 <span className="text-xs text-[var(--text-secondary)]">{s.value}</span>
                              </div>
                           ))}
                         </div>
                       </div>
                    </div>
                 )}

                 {activeLibraryTab === 'subjects' && (
                    <div className="space-y-6">
                       <div>
                         <h3 className="text-sm font-bold text-[#6366f1] mb-3">🦄 Mythical Creatures</h3>
                         <div className="flex flex-wrap gap-2">
                           {MYTHICAL_CREATURES.map((s, i) => s.value !== 'custom' && s.value !== '' && (
                              <span key={i} className="px-3 py-2 bg-[var(--bg-elevated)] rounded-xl text-xs border border-[var(--border-color)]">{s.label}</span>
                           ))}
                         </div>
                       </div>
                       <div>
                         <h3 className="text-sm font-bold text-[#6366f1] mb-3">🧙‍♂️ Fantasy Characters</h3>
                         <div className="flex flex-wrap gap-2">
                           {FANTASY_CHARACTERS.map((s, i) => s.value !== 'custom' && s.value !== '' && (
                              <span key={i} className="px-3 py-2 bg-[var(--bg-elevated)] rounded-xl text-xs border border-[var(--border-color)]">{s.label}</span>
                           ))}
                         </div>
                       </div>
                       <div>
                         <h3 className="text-sm font-bold text-[#6366f1] mb-3">👽 Other Subjects</h3>
                         <div className="flex flex-wrap gap-2">
                           {OTHER_SUBJECTS.map((s, i) => s.value !== 'custom' && s.value !== '' && (
                              <span key={i} className="px-3 py-2 bg-[var(--bg-elevated)] rounded-xl text-xs border border-[var(--border-color)]">{s.label}</span>
                           ))}
                         </div>
                       </div>
                    </div>
                 )}

                  {activeLibraryTab === 'shortfilm' && (
                     <div className="space-y-4">
                        {SHORT_FILM_ARCS.map((arc, i) => (
                           <div key={i} className="p-4 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-color)]">
                              <h3 className="font-bold text-[#ef4444] text-base mb-1">{arc.name}</h3>
                              <p className="text-xs text-[var(--text-secondary)] mb-4">{arc.description}</p>
                              <div className="space-y-2">
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 1:</span> {arc.scenes[1]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 2:</span> {arc.scenes[2]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 3:</span> {arc.scenes[3]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 4:</span> {arc.scenes[4]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 5:</span> {arc.scenes[5]}</div>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}

                  {activeLibraryTab === 'shortfilm15' && (
                     <div className="space-y-4">
                        {SHORT_FILM_15_ARCS.map((arc, i) => (
                           <div key={i} className="p-4 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-color)]">
                              <h3 className="font-bold text-purple-400 text-base mb-1">{arc.name}</h3>
                              <p className="text-xs text-[var(--text-secondary)] mb-4">{arc.description}</p>
                              <div className="space-y-2">
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 1:</span> {(arc.scenes as any)[1]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 2:</span> {(arc.scenes as any)[2]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 3:</span> {(arc.scenes as any)[3]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 4:</span> {(arc.scenes as any)[4]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 5:</span> {(arc.scenes as any)[5]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 6:</span> {(arc.scenes as any)[6]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 7:</span> {(arc.scenes as any)[7]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 8:</span> {(arc.scenes as any)[8]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 9:</span> {(arc.scenes as any)[9]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 10:</span> {(arc.scenes as any)[10]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 11:</span> {(arc.scenes as any)[11]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 12:</span> {(arc.scenes as any)[12]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 13:</span> {(arc.scenes as any)[13]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 14:</span> {(arc.scenes as any)[14]}</div>
                                 <div className="text-xs"><span className="font-semibold text-white">Scene 15:</span> {(arc.scenes as any)[15]}</div>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}

                  {activeLibraryTab === 'protagonists' && PROTAGONISTS.map((s, i) => (
                    <div key={i} className="bg-[var(--bg-elevated)] p-4 border border-[var(--border-color)] rounded-xl relative group">
                       <div className="text-sm font-semibold text-[#14b8a6] mb-1">{i + 1}. รูปแบบตัวละครอ้างอิง</div>
                       <div className="text-sm text-[var(--text-primary)]">{s}</div>
                    </div>
                  ))}

                  {activeLibraryTab === 'props' && MACGUFFIN_PROPS.map((s, i) => (
                    <div key={i} className="bg-[var(--bg-elevated)] p-4 border border-[var(--border-color)] rounded-xl relative group">
                       <div className="text-sm font-semibold text-[#84cc16] mb-1">{i + 1}. อุปกรณ์ปริศนาอ้างอิง</div>
                       <div className="text-sm text-[var(--text-primary)]">{s}</div>
                    </div>
                  ))}

                  {activeLibraryTab === 'dialogues' && DIALOGUES.map((s, i) => (
                    <div key={i} className="bg-[var(--bg-elevated)] p-4 border border-[var(--border-color)] rounded-xl relative group">
                       <div className="text-sm font-semibold text-[#06b6d4] mb-1">{i + 1}. ประโยคบทพูดเสริม (Dialogue TTS)</div>
                       <div className="text-sm text-[var(--text-primary)]">{s}</div>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>


        {/* Bulk Generation Section */}
        <div className="bg-[var(--bg-card)] border border-[#ec4899]/30 rounded-3xl p-6 shadow-xl shadow-[#ec4899]/5 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#ec4899] opacity-5 blur-3xl rounded-full pointer-events-none"></div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-[#ec4899]">
            <span>🔥</span> สุ่มสร้าง Prompt (Bulk Generate)
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">สุ่มสร้าง Prompt จำนวนมากในคลิกเดียว (ทุกบรรทัดคือ 1 Prompt ใหม่)</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--text-secondary)]">จำนวน (Prompts)</label>
              <NumInput min={1} max={500} value={bulkCount} onChange={setBulkCount} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ec4899] transition-all" />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--text-secondary)]">สุ่มตัวแบบจากหมวดหมู่ (Subject Category)</label>
              <div className="flex flex-col gap-2 relative">
                <select 
                  value={bulkCategory} 
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-[#ec4899] transition-all cursor-pointer"
                >
                  <option value="all">ผสมทุกหมวดหมู่ (All)</option>
                  {SUBJECT_CATEGORIES.map((opt) => (
                    opt.value !== 'custom' && <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-3.5 pointer-events-none text-[var(--text-secondary)]">▼</div>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleBulkGenerate}
            className="w-full bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] hover:from-[#d946ef] hover:to-[#7c3aed] text-white font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.01] active:scale-95 shadow-lg shadow-[#ec4899]/20"
          >
            สร้างแรนด้อม {bulkCount} Prompts ทันที 🚀
          </button>
        </div>

        {/* Short Film Generation Section */}
        <div className="bg-[var(--bg-card)] border border-[#ef4444]/30 rounded-3xl p-6 shadow-xl shadow-[#ef4444]/5 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#ef4444] opacity-5 blur-3xl rounded-full pointer-events-none"></div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-[#ef4444]">
            <span>🎬</span> หนังสั้นต่อเนื่องกัน (Short Film: 5 / 15 Scenes)
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">สุ่มโพรอมต์ทำหนังสั้นจบในตัว มีความต่อเนื่องกัน หลีกเลี่ยง AI แบนคลิปซ้ำซาก</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--text-secondary)]">จำนวนเรื่อง (Stories)</label>
              <NumInput min={1} max={50} value={shortFilmCount} onChange={setShortFilmCount} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ef4444] transition-all" />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--text-secondary)]">หมวดหมู่ตัวละครหลัก</label>
              <div className="flex flex-col gap-2 relative">
                <select 
                  value={shortFilmCategory} 
                  onChange={(e) => setShortFilmCategory(e.target.value)}
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-[#ef4444] transition-all cursor-pointer"
                >
                  <option value="all">ผสมทุกหมวดหมู่ (All)</option>
                  {SUBJECT_CATEGORIES.map((opt) => (
                    opt.value !== 'custom' && <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-3.5 pointer-events-none text-[var(--text-secondary)]">▼</div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 mt-2">
            <button
              onClick={() => handleShortFilmGenerate(5)}
              className="flex-1 bg-gradient-to-r from-[#ef4444] to-[#f59e0b] hover:from-[#dc2626] hover:to-[#d97706] text-white font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.01] active:scale-95 shadow-lg shadow-[#ef4444]/20"
            >
              สร้าง {shortFilmCount} เรื่อง (แบบ 5 ฉาก) 🎬
            </button>
            <button
              onClick={() => handleShortFilmGenerate(15)}
              className="flex-1 bg-gradient-to-r from-purple-600 to-[#ef4444] hover:from-purple-700 hover:to-[#dc2626] text-white font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.01] active:scale-95 shadow-lg shadow-purple-500/20"
            >
              สร้าง {shortFilmCount} เรื่อง (แบบ 15 ฉาก) 🔥
            </button>
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="lg:w-[450px] flex flex-col gap-6">
        <div className="sticky top-6">
          <div className="bg-gradient-to-b from-[#1e1e2e] to-[#181825] rounded-3xl p-[2px] shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-[#8b5cf6] via-transparent to-[#ec4899] opacity-20 group-hover:opacity-40 transition-opacity duration-500 blur-xl"></div>
            <div className="bg-[var(--bg-card)] h-full rounded-[22px] p-6 relative flex flex-col border border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-[var(--text-primary)] flex items-center gap-2">
                  <span>🎬</span> Prompt Result
                </h3>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20">
                  Ready
                </span>
              </div>
              
              <div className="flex-1 custom-scrollbar">
                <textarea
                  readOnly
                  value={generatedPrompt}
                  className="w-full h-[350px] bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-4 text-[var(--text-primary)] font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]"
                  style={{ backdropFilter: 'blur(10px)' }}
                />
              </div>

              <button
                onClick={handleCopy}
                className="mt-6 w-full relative group overflow-hidden rounded-xl font-bold text-white py-4 transition-all duration-300 hover:scale-[1.02] active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] transition-transform duration-300 group-hover:scale-110"></div>
                <div className="relative flex items-center justify-center gap-2">
                  {copyFeedback ? '✅ คัดลอกสำเร็จ (Copied!)' : '📋 คัดลอก Prompt (Copy)'}
                </div>
              </button>
            </div>
          </div>
          
          <div className="mt-6 p-5 bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 rounded-2xl">
            <h4 className="text-sm font-bold text-[#8b5cf6] mb-2">💡 ทิปส์การนำไปใช้:</h4>
            <ul className="text-xs text-[var(--text-secondary)] space-y-2 list-disc pl-4">
              <li>นำ Prompt นี้ไปใส่ใน <strong>Sora, Pika Labs, หรือ Runway Gen-2</strong></li>
              <li>หากตัวละครขยับเร็วไป ให้ปรับ Camera Style ให้นิ่งขึ้น</li>
              <li>ใช้คำสั่ง Custom เพื่อทดลองใส่ชื่อสินค้าหรือไอเทมของตัวเองในฉากได้</li>
            </ul>
          </div>
        </div>
      </div>

    </div>{/* end flex row */}

      {/* ════════════════════════════════════════════════════════════════════
          🖼️  INFOGRAPHIC PROMPT GENERATOR
          ════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl border border-teal-500/20 bg-gradient-to-br from-[#0d1a1a] to-[#0f172a] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-8 py-6 border-b border-teal-500/20 flex items-center gap-4"
             style={{ background: 'linear-gradient(135deg, rgba(13,148,136,0.15) 0%, rgba(8,145,178,0.08) 100%)' }}>
          <div className="p-3 rounded-2xl text-2xl" style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)', boxShadow: '0 0 20px rgba(13,148,136,0.4)' }}>🖼️</div>
          <div>
            <h2 className="text-2xl font-extrabold text-white">Infographic Prompt Generator</h2>
            <p className="text-sm text-teal-300/70 mt-0.5">AI คิดหัวข้อ → ตรวจสอบ → สร้าง Prompt พร้อมใช้ทันที</p>
          </div>
        </div>

        <div className="p-8 space-y-8">

          {/* ── Row 1: Settings (3 columns) ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* 1. Topic */}
            <div className="md:col-span-1 space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-teal-400 uppercase tracking-widest">
                <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[10px] font-black">1</span>
                Content เกี่ยวกับอะไร
              </label>
              <textarea
                value={infogTopic}
                onChange={e => setInfogTopic(e.target.value)}
                rows={4}
                className="input-field w-full text-sm resize-none"
                placeholder={"เช่น:\nหยกและเครื่องประดับมงคล\nสุขภาพและการออกกำลังกาย\nการลงทุนหุ้น, คริปโต"}
              />
            </div>

            {/* 2+3. Style */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-teal-400 uppercase tracking-widest">
                <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[10px] font-black">2</span>
                สไตล์รูปแบบ
              </label>
              <select
                value={infogStyleId}
                onChange={e => setInfogStyleId(e.target.value)}
                className="input-field w-full text-sm"
              >
                {INFOG_STYLES.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-teal-300/80 bg-teal-900/20 rounded-lg px-3 py-1.5 border border-teal-700/30">
                ✅ เหมาะกับ: {INFOG_STYLES.find(s => s.id === infogStyleId)?.good}
              </p>
              {(infogStyleId === 'custom-ai' || !INFOG_STYLES.find(s => s.id === infogStyleId)?.styleText) && (
                <div className="space-y-1.5 mt-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-black">3</span>
                    กำหนดสไตล์เอง
                  </label>
                  <textarea
                    value={infogCustomStyle}
                    onChange={e => setInfogCustomStyle(e.target.value)}
                    rows={3}
                    className="input-field w-full text-sm resize-none"
                    placeholder="เล่าแนวที่ชอบ เช่น: สไตล์ญี่ปุ่นมินิมอล โทนสีฟ้าขาว มีลายดอกซากุระ..."
                  />
                </div>
              )}
            </div>

            {/* 4+5. Count + CSV */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-teal-400 uppercase tracking-widest">
                  <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[10px] font-black">4</span>
                  จำนวน Prompt
                </label>
                <NumInput
                  value={infogCount}
                  onChange={v => setInfogCount(v)}
                  min={1}
                  max={100}
                  placeholder="กรอกจำนวน..."
                  className="input-field w-full text-sm"
                />
                <p className="text-[10px] text-gray-500">AI คิดหัวข้อจำนวนนี้มาให้ดูก่อน</p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-teal-400 uppercase tracking-widest">
                  <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[10px] font-black">5</span>
                  CSV หัวข้อ Viral
                  <span className="text-[9px] text-gray-500 font-normal normal-case tracking-normal">(ไม่บังคับ)</span>
                </label>
                <button
                  onClick={() => infogCsvRef.current?.click()}
                  className="w-full text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 py-2.5 rounded-xl border border-gray-600/50 transition-colors flex items-center justify-center gap-2"
                >
                  📂 เลือกไฟล์ .csv
                </button>
                {infogCsvText ? (
                  <div className="flex items-center justify-between bg-emerald-900/20 border border-emerald-600/30 rounded-lg px-3 py-1.5">
                    <span className="text-[11px] text-emerald-400">✅ โหลดแล้ว {infogCsvText.split('\n').length} บรรทัด</span>
                    <button onClick={() => setInfogCsvText('')} className="text-[10px] text-red-400 hover:text-red-300">✖</button>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-500">AI วิเคราะห์หัวข้อ viral จาก CSV เพื่อเป็นแรงบันดาลใจ</p>
                )}
                <input ref={infogCsvRef} type="file" accept=".csv,.txt" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setInfogCsvText(ev.target?.result as string || '');
                    reader.readAsText(file, 'utf-8');
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── Generate Topics button ── */}
          <button
            onClick={handleInfogGenerateTopics}
            disabled={infogIsGeneratingTopics || !infogTopic.trim()}
            className="w-full py-4 rounded-2xl font-extrabold text-white text-base transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden group shadow-lg"
            style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)', boxShadow: '0 4px 24px rgba(13,148,136,0.35)' }}
          >
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/8 transition-all" />
            <span className="relative flex items-center justify-center gap-2">
              {infogIsGeneratingTopics
                ? <><span className="animate-spin">⏳</span> AI กำลังคิดหัวข้อ...</>
                : <>✨ AI ช่วยคิดหัวข้อ ({Number(infogCount) || 10} อัน)</>}
            </span>
          </button>

          {/* ── Topic List (step 6+7) ── */}
          {infogTopics.length > 0 && (
            <div className="rounded-2xl border border-teal-600/25 bg-black/30 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-teal-600/20 bg-teal-900/10">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-teal-500 text-white flex items-center justify-center text-[11px] font-black">6</span>
                  <span className="text-sm font-bold text-teal-300">หัวข้อที่คิดมา</span>
                  <span className="text-xs text-gray-400">({infogSelectedTopics.size}/{infogTopics.length} เลือกอยู่)</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setInfogSelectedTopics(new Set(infogTopics.map((_, i) => i)))}
                    className="text-[11px] bg-teal-800/60 hover:bg-teal-700/70 text-teal-200 px-3 py-1 rounded-lg border border-teal-600/30 transition-colors font-semibold">
                    ☑ ทั้งหมด
                  </button>
                  <button onClick={() => setInfogSelectedTopics(new Set())}
                    className="text-[11px] bg-gray-700/60 hover:bg-gray-600/70 text-gray-300 px-3 py-1 rounded-lg border border-gray-600/30 transition-colors font-semibold">
                    ☐ ยกเลิก
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4 max-h-80 overflow-y-auto custom-scrollbar">
                {infogTopics.map((topic, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer ${infogSelectedTopics.has(i) ? 'bg-teal-900/40 border-teal-500/50' : 'bg-gray-900/40 border-gray-700/40 hover:border-gray-500/50'}`}
                    onClick={() => {
                      const next = new Set(infogSelectedTopics);
                      next.has(i) ? next.delete(i) : next.add(i);
                      setInfogSelectedTopics(next);
                    }}
                  >
                    <input type="checkbox" checked={infogSelectedTopics.has(i)} readOnly
                      className="w-3.5 h-3.5 accent-teal-500 flex-shrink-0 pointer-events-none" />
                    <input
                      type="text"
                      value={topic}
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        const updated = [...infogTopics];
                        updated[i] = e.target.value;
                        setInfogTopics(updated);
                      }}
                      className="flex-1 bg-transparent text-xs text-gray-200 outline-none min-w-0"
                    />
                    <button onClick={e => {
                      e.stopPropagation();
                      const updated = infogTopics.filter((_, idx) => idx !== i);
                      setInfogTopics(updated);
                      const next = new Set<number>();
                      infogSelectedTopics.forEach(idx => { if (idx < i) next.add(idx); else if (idx > i) next.add(idx - 1); });
                      setInfogSelectedTopics(next);
                    }} className="text-red-400/40 hover:text-red-400 text-[11px] flex-shrink-0 transition-colors">✖</button>
                  </div>
                ))}
              </div>

              {/* Generate Prompts button + progress */}
              <div className="px-4 pb-4 space-y-2">
                {infogBatchProgress && (
                  <div className="flex items-center gap-2 text-[11px] text-teal-300 bg-teal-900/20 border border-teal-600/30 rounded-lg px-3 py-2">
                    {infogIsGeneratingPrompts && <span className="animate-spin text-sm">⏳</span>}
                    {infogBatchProgress}
                  </div>
                )}
                <button
                  onClick={handleInfogGeneratePrompts}
                  disabled={infogIsGeneratingPrompts || infogSelectedTopics.size === 0}
                  className="w-full py-3.5 rounded-xl font-extrabold text-white text-sm transition-all disabled:opacity-40 hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden group shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)', boxShadow: '0 4px 20px rgba(124,58,237,0.35)' }}
                >
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/8 transition-all" />
                  <span className="relative flex items-center justify-center gap-2">
                    {infogIsGeneratingPrompts
                      ? <>กำลังสร้าง Prompt... (ทีละ {INFOG_BATCH_SIZE} หัวข้อ)</>
                      : <>🎨 สร้าง Prompt ทั้ง {infogSelectedTopics.size} หัวข้อ</>}
                  </span>
                </button>
                {infogSelectedTopics.size > INFOG_BATCH_SIZE && !infogIsGeneratingPrompts && (
                  <p className="text-[10px] text-gray-500 text-center">
                    จะแบ่งส่ง AI ทีละ {INFOG_BATCH_SIZE} หัวข้อ ({Math.ceil(infogSelectedTopics.size / INFOG_BATCH_SIZE)} ชุด) ผลลัพธ์จะทยอยแสดงขณะทำงาน
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Prompt Results ── */}
          {infogPrompts.length > 0 && (
            <div className="rounded-2xl border border-purple-500/25 bg-black/30 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-purple-500/20 bg-purple-900/10">
                <span className="text-sm font-bold text-purple-300">🎨 Prompt ที่สร้างได้ ({infogPrompts.length} อัน)</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(infogPrompts.join('\n\n---\n\n')); setInfogCopyFeedback(true); setTimeout(() => setInfogCopyFeedback(false), 2000); }}
                  className="text-xs bg-purple-700/50 hover:bg-purple-600/60 text-purple-200 px-4 py-1.5 rounded-lg border border-purple-500/30 transition-colors font-semibold"
                >
                  {infogCopyFeedback ? '✅ คัดลอกแล้ว!' : '📋 คัดลอกทั้งหมด'}
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                {infogPrompts.map((prompt, i) => (
                  <div key={i} className="bg-gray-900/60 border border-purple-500/15 rounded-xl p-4 space-y-2 hover:border-purple-400/30 transition-colors group">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded-full">#{i + 1}</span>
                      <button onClick={() => navigator.clipboard.writeText(prompt)}
                        className="text-[10px] text-gray-500 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 px-2 py-0.5 rounded transition-all opacity-0 group-hover:opacity-100">
                        📋 copy
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed font-mono">{prompt}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {infogTopics.length === 0 && infogPrompts.length === 0 && (
            <div className="py-12 flex flex-col items-center gap-4 text-center rounded-2xl border border-dashed border-teal-700/30">
              <div className="text-5xl opacity-40">🖼️</div>
              <div>
                <p className="text-base font-semibold text-gray-400">กรอกหัวข้อ Content แล้วกด <span className="text-teal-400 font-bold">"✨ AI ช่วยคิดหัวข้อ"</span></p>
                <p className="text-xs text-gray-600 mt-1">AI จะคิดหัวข้อมาให้ตรวจ → เลือก/แก้ไข → กดสร้าง Prompt พร้อมใช้ทันที</p>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
