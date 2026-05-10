import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../ui/Card';
import { globalTaskStore } from '../../hooks/useBackgroundTasks';
import { getActiveDropboxCreds, getOpenRouterKeyCandidates } from '../../hooks/useApiSettings';
import { DEFAULT_3_LINE_PACK, useHeadlinePacks } from '../../hooks/useHeadlinePacks';

interface CelebrityImage {
  name: string;
  url: string;
  sizeBytes?: number;
}

interface CelebrityFolder {
  name: string;
  path: string;
  imageCount: number;
  images: CelebrityImage[];
  outputs: CelebrityImage[];
  tags?: string[];
  categorySummary?: string;
}

interface GeneratedCopy {
  headline: string;
  postText: string;
}

interface CelebritySavedResult {
  id: string;
  personName: string;
  headline: string;
  article: string;
  imageUrl: string;
  localImageUrl?: string;
  dropboxUrl?: string;
  dropboxPath?: string;
  tags?: string[];
  selectedTag?: string;
  categorySummary?: string;
  createdAt: string;
  exportedToDropboxAt?: string;
}

interface CelebrityArticleJob {
  id: string;
  personName: string;
  selectedTag: string;
  imageUrl: string;
  imageName: string;
  headline: string;
  postText: string;
  createdAt: string;
}

interface CelebrityTeachingsTabProps {
  onLog: (message: string) => void;
}

interface CelebrityTagResult {
  name: string;
  tags: string[];
  categorySummary: string;
}

interface CelebrityTemplate {
  id: string;
  name: string;
  description: string;
  accent: string;
  preview: 'bottom-bar' | 'poster' | 'split' | 'quote-card' | 'diagonal' | 'magazine';
}

interface CelebrityFontTheme {
  id: string;
  name: string;
  base: string;
  accent: string;
  highlight: string;
  muted: string;
  panel: string;
  textBg: string;
  shadow: string;
}

const DEFAULT_NAMES = 'Albert Einstein\nWarren Buffett\nSteve Jobs';
const CANVAS_SIZE = 1080;
const IMAGE_AREA_HEIGHT = 690;
const OUTPUT_FOLDER = 'public/app_data/celebrity_teachings';
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const CELEBRITY_TEMPLATES: CelebrityTemplate[] = [
  {
    id: 'bottom-bar',
    name: 'แถบดำล่าง',
    description: 'รูปใหญ่ด้านบน ข้อความ 3 บรรทัดด้านล่าง',
    accent: '#22d3ee',
    preview: 'bottom-bar',
  },
  {
    id: 'poster',
    name: 'โปสเตอร์เต็มภาพ',
    description: 'ใช้รูปเต็มเฟรม วางข้อความบนกล่องโปร่ง',
    accent: '#f59e0b',
    preview: 'poster',
  },
  {
    id: 'split',
    name: 'คำสอนครึ่งภาพ',
    description: 'ภาพบุคคลด้านขวา คำสอนอ่านง่ายด้านซ้าย',
    accent: '#10b981',
    preview: 'split',
  },
  {
    id: 'quote-card',
    name: 'การ์ดคำคม',
    description: 'รูปวงกลมเด่นกลางภาพ พร้อมคำสอนแบบ quote',
    accent: '#a855f7',
    preview: 'quote-card',
  },
  {
    id: 'diagonal',
    name: 'เส้นเฉียงพลัง',
    description: 'ภาพเต็มพร้อมแผงข้อความเฉียง ดูดุดันขึ้น',
    accent: '#ef4444',
    preview: 'diagonal',
  },
  {
    id: 'magazine',
    name: 'ปกแมกกาซีน',
    description: 'ภาพใหญ่แบบปกนิตยสาร มีหัวเรื่องชัด',
    accent: '#38bdf8',
    preview: 'magazine',
  },
];

const CELEBRITY_FONT_THEMES: CelebrityFontTheme[] = [
  {
    id: 'gold-cyan',
    name: 'ทอง + ฟ้า',
    base: '#ffffff',
    accent: '#ffd166',
    highlight: '#7df9ff',
    muted: '#cbd5e1',
    panel: 'rgba(0,0,0,0.72)',
    textBg: 'rgba(3,7,18,0.82)',
    shadow: 'rgba(0,0,0,0.72)',
  },
  {
    id: 'white-red',
    name: 'ขาว + แดง',
    base: '#ffffff',
    accent: '#ff4d4d',
    highlight: '#ffe45e',
    muted: '#e5e7eb',
    panel: 'rgba(15,15,18,0.78)',
    textBg: 'rgba(127,29,29,0.72)',
    shadow: 'rgba(0,0,0,0.76)',
  },
  {
    id: 'mint-violet',
    name: 'มิ้นต์ + ม่วง',
    base: '#f8fafc',
    accent: '#5eead4',
    highlight: '#c084fc',
    muted: '#dbeafe',
    panel: 'rgba(12,18,28,0.76)',
    textBg: 'rgba(49,46,129,0.62)',
    shadow: 'rgba(0,0,0,0.7)',
  },
  {
    id: 'mono-lime',
    name: 'ขาวดำ + เขียว',
    base: '#f9fafb',
    accent: '#bef264',
    highlight: '#ffffff',
    muted: '#d1d5db',
    panel: 'rgba(0,0,0,0.82)',
    textBg: 'rgba(20,83,45,0.66)',
    shadow: 'rgba(0,0,0,0.78)',
  },
];

const splitNames = (text: string) => {
  return text
    .split(/[\n,;]+/)
    .map(name => name.trim())
    .filter(Boolean)
    .filter((name, index, arr) => arr.findIndex(n => n.toLowerCase() === name.toLowerCase()) === index);
};

const cleanJsonText = (text: string) => {
  return String(text || '').replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
};

const parseAiCopy = (raw: string, fallbackName: string): GeneratedCopy => {
  try {
    const parsed = JSON.parse(cleanJsonText(raw));
    return {
      headline: String(parsed.headline || parsed['พาดหัว'] || '').trim(),
      postText: String(parsed.postText || parsed.article || parsed['บทความ'] || '').trim(),
    };
  } catch {
    const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
    return {
      headline: lines.slice(0, 3).join('\n') || `บทเรียนจาก ${fallbackName}\nคิดให้ไกลกว่าคนอื่น\nแล้วลงมือทำให้จริง`,
      postText: raw.trim(),
    };
  }
};

const normalizeTagList = (value: unknown) => {
  if (Array.isArray(value)) return value.map(tag => String(tag).trim()).filter(Boolean).slice(0, 8);
  if (typeof value === 'string') return value.split(/[,，、|/]/).map(tag => tag.trim()).filter(Boolean).slice(0, 8);
  return [];
};

const fallbackTagsForName = (name: string): CelebrityTagResult => {
  const lower = name.toLowerCase();
  if (/buffett|munger|soros|lynch|dalio|graham|bogle/.test(lower)) {
    return { name, tags: ['การเงิน', 'การลงทุน', 'ธุรกิจ'], categorySummary: 'นักลงทุน/นักธุรกิจ เหมาะกับคอนเทนต์การเงิน การลงทุน และวิธีคิดระยะยาว' };
  }
  if (/einstein|newton|tesla|hawking|curie|feynman/.test(lower)) {
    return { name, tags: ['วิทยาศาสตร์', 'ความคิดสร้างสรรค์', 'การเรียนรู้'], categorySummary: 'นักวิทยาศาสตร์/นักคิด เหมาะกับบทเรียนเรื่องความคิด การเรียนรู้ และการมองโลก' };
  }
  if (/jobs|musk|gates|bezos|zuckerberg|branson/.test(lower)) {
    return { name, tags: ['ธุรกิจ', 'เทคโนโลยี', 'นวัตกรรม'], categorySummary: 'ผู้ประกอบการ/ผู้นำเทคโนโลยี เหมาะกับบทเรียนธุรกิจ นวัตกรรม และการสร้างสิ่งใหม่' };
  }
  return { name, tags: ['แรงบันดาลใจ', 'วิธีคิด', 'บทเรียนชีวิต'], categorySummary: 'บุคคลน่าสนใจ เหมาะกับคอนเทนต์บทเรียนชีวิต วิธีคิด และแรงบันดาลใจ' };
};

const parseTagResults = (raw: string, names: string[]): CelebrityTagResult[] => {
  try {
    const parsed = JSON.parse(cleanJsonText(raw));
    const rawResults = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.results) ? parsed.results : [];
    const mapped = rawResults.map((item: any, index: number) => ({
      name: String(item?.name || item?.ชื่อ || names[index] || '').trim(),
      tags: normalizeTagList(item?.tags || item?.แท็ก || item?.categories || item?.หมวดหมู่),
      categorySummary: String(item?.categorySummary || item?.summary || item?.คำอธิบาย || '').trim(),
    })).filter((item: CelebrityTagResult) => item.name && item.tags.length > 0);
    if (mapped.length > 0) return mapped;
  } catch {}
  return names.map(fallbackTagsForName);
};

const fallbackCopy = (name: string): GeneratedCopy => ({
  headline: `บทเรียนจาก ${name}\nไม่ได้ชนะเพราะเก่งกว่าใคร\nแต่ชนะเพราะคิดลึกกว่าเดิม`,
  postText: `สิ่งที่เราเรียนรู้จาก ${name} คือความสำเร็จไม่ได้เกิดจากแรงฮึดแค่วันเดียว แต่เกิดจากวิธีคิดที่ทำซ้ำจนกลายเป็นนิสัย\n\n• เลือกโฟกัสสิ่งสำคัญก่อนเสียงรบกวน\n• ยอมเรียนรู้จากความผิดพลาดเร็วขึ้น\n• ทำเรื่องเล็กให้ดีพอ จนกลายเป็นผลลัพธ์ใหญ่\n\nบทเรียนนี้ใช้ได้กับคนทำงาน คนสร้างธุรกิจ และคนที่กำลังพัฒนาตัวเอง เพราะสุดท้ายแล้วชีวิตไม่ได้เปลี่ยนจากคำพูดสวย ๆ แต่เปลี่ยนจากการลงมือทำที่สม่ำเสมอ\n\n#บทเรียนชีวิต #แรงบันดาลใจ #คำสอนจากคนดัง`,
});

const FREE_FALLBACK_MODELS = ['openai/gpt-oss-20b:free', 'google/gemma-3-27b-it:free'];

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('โหลดรูปไม่สำเร็จ'));
  img.src = src;
});

const drawCoverImage = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  focusX = 0.5,
  focusY = 0.35,
) => {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = Math.max(0, Math.min(img.naturalWidth - sw, (img.naturalWidth - sw) * focusX));
  const sy = Math.max(0, Math.min(img.naturalHeight - sh, (img.naturalHeight - sh) * focusY));
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const drawHeadlineLine = (
  ctx: CanvasRenderingContext2D,
  line: string,
  y: number,
  maxWidth: number,
  baseColor: string,
  accentColor: string,
) => {
  const segments = line.split(/("[^"]+"|“[^”]+”|‘[^’]+’)/g).filter(Boolean);
  const widths = segments.map(segment => ctx.measureText(segment).width);
  let x = (CANVAS_SIZE - Math.min(maxWidth, widths.reduce((sum, width) => sum + width, 0))) / 2;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isAccent = /^["“‘].*["”’]$/.test(segment);
    ctx.fillStyle = isAccent ? accentColor : baseColor;
    ctx.fillText(segment, x, y);
    x += widths[i];
  }
};

const getTemplateById = (id: string) => CELEBRITY_TEMPLATES.find(template => template.id === id) || CELEBRITY_TEMPLATES[0];
const getFontThemeById = (id: string) => CELEBRITY_FONT_THEMES.find(theme => theme.id === id) || CELEBRITY_FONT_THEMES[0];

const headlineLines = (copy: GeneratedCopy) => copy.headline.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 3);

const fitFontSize = (ctx: CanvasRenderingContext2D, lines: string[], maxWidth: number, start = 66, min = 38) => {
  let fontSize = start;
  while (fontSize > min) {
    ctx.font = `900 ${fontSize}px Kanit, "Noto Sans Thai", sans-serif`;
    const longest = Math.max(...lines.map(line => ctx.measureText(line).width), 0);
    if (longest <= maxWidth) break;
    fontSize -= 2;
  }
  return fontSize;
};

const drawPageLabel = (ctx: CanvasRenderingContext2D, label: string, x: number, y: number, align: CanvasTextAlign = 'right') => {
  ctx.save();
  ctx.font = 'bold 30px Kanit, "Noto Sans Thai", sans-serif';
  const labelWidth = Math.min(480, Math.max(240, ctx.measureText(label).width + 58));
  const boxX = align === 'right' ? x - labelWidth : x;
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(boxX, y, labelWidth, 58);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  ctx.fillText(label, align === 'right' ? x - 28 : x + 28, y + 29);
  ctx.restore();
};

const fillRoundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
};

const drawHeadlineText = (
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  color: string,
  align: CanvasTextAlign,
  useTextBg: boolean,
  bgColor: string,
) => {
  const text = wrapText(ctx, line, maxWidth).slice(0, 1)[0] || line;
  const width = Math.min(maxWidth, ctx.measureText(text).width);
  const drawX = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  if (useTextBg) {
    ctx.save();
    ctx.fillStyle = bgColor;
    fillRoundRect(ctx, drawX - 20, y - fontSize * 0.9, width + 40, fontSize * 1.18, 16);
    ctx.restore();
  }
  ctx.textAlign = align;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
};

const drawHeadlineBlock = (
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  colors: string[][],
  centered = true,
) => {
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 6;
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  lines.forEach((line, index) => {
    const wrapped = wrapText(ctx, line, maxWidth).slice(0, 1);
    const text = wrapped[0] || line;
    const drawY = y + index * lineHeight;
    if (centered) {
      const width = ctx.measureText(text).width;
      ctx.strokeText(text, x + (maxWidth - width) / 2, drawY);
      const originalCanvasSize = CANVAS_SIZE;
      drawHeadlineLine(ctx, text, drawY, originalCanvasSize, colors[index]?.[0] || '#ffffff', colors[index]?.[1] || '#ffd166');
    } else {
      ctx.strokeText(text, x, drawY);
      ctx.fillStyle = colors[index]?.[0] || '#ffffff';
      ctx.fillText(text, x, drawY);
    }
  });
  ctx.shadowBlur = 0;
};

export function CelebrityTeachingsTab({ onLog }: CelebrityTeachingsTabProps) {
  const { packs } = useHeadlinePacks();
  const [namesText, setNamesText] = useState(DEFAULT_NAMES);
  const [rootFolder, setRootFolder] = useState(() => localStorage.getItem('celebrity_teachings_root_folder') || '');
  const [folders, setFolders] = useState<CelebrityFolder[]>([]);
  const [selectedFolderNames, setSelectedFolderNames] = useState<Set<string>>(new Set());
  const [selectedName, setSelectedName] = useState('');
  const [pageName, setPageName] = useState(() => localStorage.getItem('celebrity_teachings_page_name') || 'Mindset Daily');
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => localStorage.getItem('celebrity_teachings_template_id') || 'bottom-bar');
  const [selectedFontThemeId, setSelectedFontThemeId] = useState(() => localStorage.getItem('celebrity_teachings_font_theme_id') || 'gold-cyan');
  const [useTextBg, setUseTextBg] = useState(() => localStorage.getItem('celebrity_teachings_text_bg') !== 'false');
  const [useFontAccent, setUseFontAccent] = useState(() => localStorage.getItem('celebrity_teachings_font_accent') !== 'false');
  const [imageCountText, setImageCountText] = useState('6');
  const [isCreating, setIsCreating] = useState(false);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [taggingNames, setTaggingNames] = useState(false);
  const [isScanningPortraits, setIsScanningPortraits] = useState(false);
  const [scanningTarget, setScanningTarget] = useState('');
  const [selectedContentTag, setSelectedContentTag] = useState('');
  const [tagPickCountText, setTagPickCountText] = useState('30');
  const [isBatchWriting, setIsBatchWriting] = useState(false);
  const [isBatchRendering, setIsBatchRendering] = useState(false);
  const [loadingFolder, setLoadingFolder] = useState('');
  const [writingName, setWritingName] = useState('');
  const [renderingName, setRenderingName] = useState('');
  const [selectedImageByName, setSelectedImageByName] = useState<Record<string, string>>({});
  const [copyByName, setCopyByName] = useState<Record<string, GeneratedCopy>>({});
  const [articleJobs, setArticleJobs] = useState<CelebrityArticleJob[]>([]);
  const [savedResults, setSavedResults] = useState<CelebritySavedResult[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
  const [dropboxFolderPath, setDropboxFolderPath] = useState(() => localStorage.getItem('celebrity_dropbox_folder') || '/Apps/CelebrityTeachings');
  const [dropboxUploadLog, setDropboxUploadLog] = useState('');
  const [isUploadingResults, setIsUploadingResults] = useState(false);
  const [isDeletingResults, setIsDeletingResults] = useState(false);
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  const selectedFolder = useMemo(() => folders.find(folder => folder.name === selectedName) || folders[0], [folders, selectedName]);
  const selectedInputNames = splitNames(namesText);
  const noImageFolders = useMemo(() => folders.filter(folder => folder.imageCount === 0), [folders]);
  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    folders.forEach(folder => (folder.tags || []).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [folders]);
  const headlineExamples = (packs.length > 0 ? packs : [DEFAULT_3_LINE_PACK])
    .flatMap(pack => pack.headlines)
    .slice(0, 5)
    .join('\n---\n');
  const getImageCount = () => Math.max(1, Math.min(30, Number(imageCountText) || 6));
  const getTagPickCount = () => Math.max(1, Math.min(200, Number(tagPickCountText) || 30));
  const articleQueueCount = selectedContentTag ? getTagPickCount() : (articleJobs.length || selectedFolderNames.size);
  const selectedImageForFolder = (folder: CelebrityFolder) => selectedImageByName[folder.name] || folder.images[0]?.url || '';
  const selectedImageNameForFolder = (folder: CelebrityFolder) => {
    const url = selectedImageForFolder(folder);
    return folder.images.find(image => image.url === url)?.name || folder.images[0]?.name || '';
  };
  const folderByName = (name: string) => folders.find(folder => folder.name === name);
  const makeJobId = () => `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const imageForJob = (folder: CelebrityFolder, occurrenceIndex: number) => {
    const images = folder.images || [];
    if (images.length === 0) return { imageUrl: '', imageName: '' };
    const image = images[occurrenceIndex % images.length];
    return { imageUrl: image.url, imageName: image.name };
  };

  const parsePortraitScan = (raw: string) => {
    try {
      const parsed = JSON.parse(cleanJsonText(raw));
      return {
        keep: Boolean(parsed.keep),
        reason: String(parsed.reason || parsed.เหตุผล || '').trim(),
        confidence: Number(parsed.confidence || 0),
      };
    } catch {
      const lower = raw.toLowerCase();
      return {
        keep: /\bkeep\b|เก็บ/.test(lower) && !/\bdelete\b|ลบ|ไม่ใช่/.test(lower),
        reason: raw.slice(0, 180),
        confidence: 0,
      };
    }
  };

  useEffect(() => {
    localStorage.setItem('celebrity_teachings_page_name', pageName);
  }, [pageName]);

  useEffect(() => {
    localStorage.setItem('celebrity_teachings_template_id', selectedTemplateId);
  }, [selectedTemplateId]);

  useEffect(() => {
    localStorage.setItem('celebrity_teachings_font_theme_id', selectedFontThemeId);
  }, [selectedFontThemeId]);

  useEffect(() => {
    localStorage.setItem('celebrity_teachings_text_bg', String(useTextBg));
  }, [useTextBg]);

  useEffect(() => {
    localStorage.setItem('celebrity_teachings_font_accent', String(useFontAccent));
  }, [useFontAccent]);

  useEffect(() => {
    if (rootFolder.trim()) localStorage.setItem('celebrity_teachings_root_folder', rootFolder.trim());
    else localStorage.removeItem('celebrity_teachings_root_folder');
  }, [rootFolder]);

  useEffect(() => {
    refreshFolders();
    loadSavedResults();
  }, []);

  useEffect(() => {
    loadSavedResults();
  }, [rootFolder]);

  useEffect(() => {
    localStorage.setItem('celebrity_dropbox_folder', dropboxFolderPath);
  }, [dropboxFolderPath]);

  useEffect(() => {
    if (!selectedName && folders.length > 0) setSelectedName(folders[0].name);
  }, [folders, selectedName]);

  useEffect(() => {
    setSelectedFolderNames(prev => {
      const valid = new Set(folders.map(folder => folder.name));
      return new Set([...prev].filter(name => valid.has(name)));
    });
  }, [folders]);

  const log = (message: string) => {
    onLog(message);
  };

  const callOpenRouterWithProfiles = async (body: Record<string, unknown>) => {
    const candidates = await getOpenRouterKeyCandidates();
    if (candidates.length === 0) throw new Error('ไม่พบ OpenRouter API Key ในโปรไฟล์');

    const preferredModel = String(body.model || 'google/gemini-2.5-flash');
    const models = [preferredModel, ...FREE_FALLBACK_MODELS.filter(model => model !== preferredModel)];
    let lastError = '';

    for (const candidate of candidates) {
      for (const model of models) {
        try {
          log(`🔑 ลองใช้ ${candidate.label} (${model})`);
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${candidate.key}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': window.location.origin,
              'X-Title': 'Bulk Video Creator - Celebrity Teachings',
            },
            body: JSON.stringify({ ...body, model }),
          });
          const data = await res.json();
          if (res.ok && !data.error) {
            return { data, keyLabel: candidate.label, model };
          }

          const message = data.error?.message || `OpenRouter error ${res.status}`;
          lastError = `${candidate.label}: ${message}`;
          if (/insufficient credits|more credits|can only afford/i.test(message)) {
            log(`⚠️ ${candidate.label} เครดิตไม่พอ → ลองโปรไฟล์ถัดไป`);
            break;
          }
          if (/not a valid model/i.test(message) && model === preferredModel) {
            log(`⚠️ Model ${model} ใช้ไม่ได้ → ลอง fallback model`);
            continue;
          }
          if (/Provider returned error|Provider routing failed|rate limit|timeout/i.test(message)) {
            log(`⚠️ ${candidate.label} + ${model}: ${message} → ลองตัวถัดไป`);
            continue;
          }
          throw new Error(lastError);
        } catch (e: any) {
          lastError = `${candidate.label}: ${e.message || 'Network error'}`;
          if (/Failed to fetch|NetworkError|timeout/i.test(lastError)) continue;
          if (/insufficient credits|more credits|can only afford/i.test(lastError)) break;
        }
      }
    }

    throw new Error(lastError || 'OpenRouter error — ลองตรวจโปรไฟล์ API Key อีกครั้ง');
  };

  const refreshFolders = async (folder = rootFolder) => {
    const params = folder.trim() ? `?parentFolder=${encodeURIComponent(folder.trim())}` : '';
    const res = await fetch(`/api/celebrity-folders${params}`);
    const data = await res.json();
    setFolders(data.folders || []);
  };

  const celebrityResultsBody = (extra: Record<string, unknown>) => ({
    parentFolder: rootFolder.trim() || undefined,
    ...extra,
  });

  const loadSavedResults = async (folder = rootFolder) => {
    const params = folder.trim() ? `?parentFolder=${encodeURIComponent(folder.trim())}` : '';
    const res = await fetch(`/api/celebrity-results${params}`);
    const data = await res.json();
    setSavedResults(data.results || []);
    setSelectedResultIds(prev => {
      const valid = new Set((data.results || []).map((item: CelebritySavedResult) => item.id));
      return new Set([...prev].filter(id => valid.has(id)));
    });
  };

  const addSavedResult = async (item: CelebritySavedResult) => {
    const res = await fetch('/api/celebrity-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(celebrityResultsBody({ action: 'add', item })),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'บันทึกผลลัพธ์ไม่สำเร็จ');
    setSavedResults(data.results || []);
    setSelectedResultIds(prev => new Set([...prev, item.id]));
  };

  const updateSavedResult = async (id: string, changes: Partial<CelebritySavedResult>) => {
    const res = await fetch('/api/celebrity-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(celebrityResultsBody({ action: 'update', id, changes })),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'อัปเดตผลลัพธ์ไม่สำเร็จ');
    setSavedResults(data.results || []);
  };

  const deleteSavedResult = async (id: string) => {
    const res = await fetch('/api/celebrity-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(celebrityResultsBody({ action: 'delete', id })),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'ลบผลลัพธ์ไม่สำเร็จ');
    setSavedResults(data.results || []);
    setSelectedResultIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const deleteSelectedResults = async () => {
    const ids = [...selectedResultIds].filter(id => savedResults.some(result => result.id === id));
    if (ids.length === 0) return alert('เลือกรายการที่จะลบก่อนครับ');
    if (!confirm(`ลบผลลัพธ์ที่เลือก ${ids.length} รายการใช่ไหมครับ?\n\nระบบจะลบรายการออกจากผลลัพธ์ และลบไฟล์รูปโพสต์ที่สร้างไว้ในโฟลเดอร์ด้วย`)) return;
    setIsDeletingResults(true);
    setDropboxUploadLog(`กำลังลบผลลัพธ์ที่เลือก ${ids.length} รายการ...`);
    try {
      const res = await fetch('/api/celebrity-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(celebrityResultsBody({ action: 'delete-many', ids })),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'ลบผลลัพธ์ที่เลือกไม่สำเร็จ');
      setSavedResults(data.results || []);
      setSelectedResultIds(new Set());
      setDropboxUploadLog(`✅ ลบผลลัพธ์ที่เลือกแล้ว ${data.deleted ?? ids.length} รายการ`);
      log(`🗑️ ลบผลลัพธ์ที่เลือกแล้ว ${data.deleted ?? ids.length} รายการ`);
    } catch (e: any) {
      setDropboxUploadLog(`❌ ${e.message}`);
      alert(`ลบไม่สำเร็จ: ${e.message}`);
    } finally {
      setIsDeletingResults(false);
    }
  };

  const toggleResultSelection = (id: string) => {
    setSelectedResultIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllResults = () => setSelectedResultIds(new Set(savedResults.map(result => result.id)));
  const clearSelectedResults = () => setSelectedResultIds(new Set());

  const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('อ่านรูปเพื่ออัปโหลดไม่สำเร็จ'));
    reader.readAsDataURL(blob);
  });

  const getImageAsBase64 = async (url: string) => {
    if (url.startsWith('data:image')) return url;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`โหลดรูปสำหรับ Dropbox ไม่สำเร็จ: HTTP ${res.status}`);
    return blobToDataUrl(await res.blob());
  };

  const safeDropboxFileName = (value: string) => {
    const clean = (value || 'celebrity_post').replace(/[<>:"/\\|?*\n\r]/g, '_').slice(0, 90);
    return `${clean}_${Date.now()}.jpg`;
  };

  const uploadSavedResultToDropbox = async (result: CelebritySavedResult) => {
    const creds = getActiveDropboxCreds();
    if (!creds.accessToken && !creds.refreshToken) throw new Error('ยังไม่ได้ตั้งค่า Dropbox API ใน Profile');
    const sourceUrl = result.localImageUrl || result.imageUrl || result.dropboxUrl || '';
    if (!sourceUrl) throw new Error('รายการนี้ยังไม่มีรูปสำหรับอัปโหลด');
    const base64Data = await getImageAsBase64(sourceUrl);
    const res = await fetch('/api/dropbox-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: '',
        base64Data,
        fileName: safeDropboxFileName(result.personName || result.headline || result.id),
        folderPath: dropboxFolderPath,
        ...creds,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Dropbox upload failed');
    const directUrl = (data.directUrl || data.url || '').replace('dl=0', 'dl=1');
    await updateSavedResult(result.id, {
      dropboxUrl: directUrl,
      dropboxPath: data.dropboxPath || dropboxFolderPath,
      exportedToDropboxAt: new Date().toISOString(),
    });
    return directUrl;
  };

  const uploadSelectedResultsToDropbox = async () => {
    const selected = savedResults.filter(result => selectedResultIds.has(result.id));
    if (selected.length === 0) return alert('เลือกรายการที่จะอัปโหลด Dropbox ก่อนครับ');
    setIsUploadingResults(true);
    try {
      let done = 0;
      for (const result of selected) {
        setDropboxUploadLog(`กำลังอัปโหลด ${done + 1}/${selected.length}: ${result.personName}`);
        await uploadSavedResultToDropbox(result);
        done++;
      }
      await loadSavedResults();
      setDropboxUploadLog(`✅ อัปโหลด Dropbox สำเร็จ ${done}/${selected.length} รายการ`);
    } catch (e: any) {
      setDropboxUploadLog(`❌ ${e.message}`);
      alert(`อัปโหลดไม่สำเร็จ: ${e.message}`);
    } finally {
      setIsUploadingResults(false);
    }
  };

  const exportSelectedCsv = async () => {
    const ids = selectedResultIds.size > 0 ? [...selectedResultIds] : savedResults.map(result => result.id);
    const selected = savedResults.filter(result => ids.includes(result.id));
    const missingDropbox = selected.filter(result => !result.dropboxUrl);
    if (missingDropbox.length > 0) {
      if (!dropboxFolderPath.trim()) {
        alert('กรอก Dropbox Upload Path ก่อนครับ เช่น /Apps/CelebrityTeachings');
        return;
      }
      setIsUploadingResults(true);
      try {
        let done = 0;
        for (const result of missingDropbox) {
          setDropboxUploadLog(`CSV ต้องมี Dropbox: กำลังอัปโหลด ${done + 1}/${missingDropbox.length}: ${result.personName}`);
          await uploadSavedResultToDropbox(result);
          done++;
        }
        await loadSavedResults();
        setDropboxUploadLog(`✅ อัปโหลด Dropbox ครบก่อนบันทึก CSV (${done}/${missingDropbox.length})`);
      } catch (e: any) {
        setDropboxUploadLog(`❌ อัปโหลด Dropbox ก่อนทำ CSV ไม่สำเร็จ: ${e.message}`);
        alert(`ต้องอัปโหลด Dropbox ให้สำเร็จก่อน CSV จะมีลิงก์ Dropbox: ${e.message}`);
        setIsUploadingResults(false);
        return;
      } finally {
        setIsUploadingResults(false);
      }
    }
    const pickRes = await fetch('/api/pick-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'เลือกโฟลเดอร์สำหรับบันทึก CSV ผลลัพธ์คนดัง' }),
    });
    const pickData = await pickRes.json();
    if (!pickData.success) {
      if (!pickData.cancelled) alert('เลือกโฟลเดอร์บันทึก CSV ไม่สำเร็จ');
      return;
    }
    const res = await fetch('/api/celebrity-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(celebrityResultsBody({ action: 'export-csv', ids, outputFolder: pickData.dir })),
    });
    const data = await res.json();
    if (data.success) setDropboxUploadLog(`✅ บันทึก CSV แล้ว: ${data.csvPath}`);
    else alert(data.error || 'บันทึก CSV ไม่สำเร็จ');
  };

  const pickRootFolder = async () => {
    log('📂 กำลังเปิดหน้าต่างเลือกโฟลเดอร์หลักสำหรับเก็บรูปคนดัง...');
    const res = await fetch('/api/pick-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'เลือกโฟลเดอร์หลักสำหรับเก็บรูปคนดัง' }),
    });
    const data = await res.json();
    if (!data.success) {
      if (!data.cancelled) log('❌ เลือกโฟลเดอร์หลักไม่สำเร็จ');
      return;
    }
    setRootFolder(data.dir);
    setSelectedName('');
    setSelectedFolderNames(new Set());
    await refreshFolders(data.dir);
    await loadSavedResults(data.dir);
    log(`✅ ตั้งโฟลเดอร์หลักแล้ว และอ่าน subfolder จาก: ${data.dir}`);
  };

  const toggleFolderSelect = (name: string) => {
    setSelectedFolderNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAllFolders = () => setSelectedFolderNames(new Set(folders.map(folder => folder.name)));
  const clearFolderSelection = () => setSelectedFolderNames(new Set());

  const saveTagResults = async (items: CelebrityTagResult[]) => {
    if (items.length === 0) return;
    const res = await fetch('/api/celebrity-save-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentFolder: rootFolder.trim() || undefined, items }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'บันทึก Tag ไม่สำเร็จ');
    setFolders(data.folders || []);
  };

  const tagCelebritiesWithAi = async (names: string[]) => {
    const targets = names.map(name => name.trim()).filter(Boolean);
    if (targets.length === 0) return [];
    const prompt = `คุณคือบรรณาธิการคอนเทนต์ภาษาไทย ช่วยจัด Tag ให้รายชื่อคนดังต่อไปนี้ เพื่อให้ผู้ใช้รู้ว่าคนนี้เกี่ยวกับหมวดอะไร

รายชื่อ:
${targets.map((name, index) => `${index + 1}. ${name}`).join('\n')}

ตอบเป็น JSON เท่านั้น:
{
  "results": [
    {
      "name": "ชื่อเดิม",
      "tags": ["แท็กไทยสั้นๆ 2-5 แท็ก เช่น การเงิน, การลงทุน, ธุรกิจ"],
      "categorySummary": "คำอธิบายภาษาไทยสั้นๆ ว่าคนนี้เกี่ยวกับอะไร เหมาะทำคอนเทนต์แนวไหน"
    }
  ]
}

กติกา:
- tags ต้องเป็นภาษาไทย กระชับ ไม่เกิน 5 แท็กต่อคน
- ถ้าเป็นนักลงทุน เช่น Warren Buffett ให้มี การเงิน/การลงทุน
- ถ้าเป็นนักวิทยาศาสตร์ เช่น Albert Einstein ให้มี วิทยาศาสตร์/การเรียนรู้
- ถ้าเป็นผู้ประกอบการ/เทคโนโลยี เช่น Steve Jobs ให้มี ธุรกิจ/เทคโนโลยี/นวัตกรรม`;

    const { data, keyLabel, model } = await callOpenRouterWithProfiles({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });
    const results = parseTagResults(data.choices?.[0]?.message?.content || '', targets);
    log(`🏷️ AI Tag สำเร็จ ${results.length}/${targets.length} คน ด้วย ${keyLabel} (${model})`);
    return results;
  };

  const generateAndSaveTags = async (names: string[]) => {
    const targets = names.map(name => name.trim()).filter(Boolean);
    if (targets.length === 0) return;
    setTaggingNames(true);
    const taskId = `celebrity_tags_${Date.now()}`;
    globalTaskStore.addTask({ id: taskId, title: `AI Tag คนดัง ${targets.length} คน`, category: 'celebrity', progress: 'กำลังให้ AI จัดหมวดหมู่...', status: 'running' });
    log(`🏷️ กำลังให้ AI จัด Tag ให้ ${targets.length} คน`);
    try {
      let results: CelebrityTagResult[] = [];
      try {
        results = await tagCelebritiesWithAi(targets);
      } catch (e: any) {
        log(`⚠️ AI Tag ไม่สำเร็จ ใช้ Tag สำรองก่อน: ${e.message}`);
        results = targets.map(fallbackTagsForName);
      }
      await saveTagResults(results);
      globalTaskStore.updateTask(taskId, { progress: `บันทึก Tag แล้ว ${results.length}/${targets.length} คน`, status: 'completed' });
      log(`✅ บันทึก Tag แล้ว: ${results.map(item => `${item.name} (${item.tags.join(', ')})`).join(' · ')}`);
    } catch (e: any) {
      globalTaskStore.updateTask(taskId, { progress: e.message, status: 'error' });
      log(`❌ บันทึก Tag ไม่สำเร็จ: ${e.message}`);
    } finally {
      setTaggingNames(false);
    }
  };

  const createFolders = async () => {
    const names = selectedInputNames;
    if (names.length === 0) return alert('ใส่ชื่อคนดังอย่างน้อย 1 คนก่อนครับ');
    setIsCreating(true);
    const taskId = `celebrity_create_${Date.now()}`;
    globalTaskStore.addTask({ id: taskId, title: `สร้างโฟลเดอร์คนดัง ${names.length} คน`, category: 'celebrity', progress: 'กำลังสร้างโฟลเดอร์...', status: 'running' });
    log(`📁 เริ่มสร้างโฟลเดอร์ ${names.length} คน: ${names.join(', ')}`);
    try {
      const res = await fetch('/api/celebrity-create-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names, parentFolder: rootFolder.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'สร้างโฟลเดอร์ไม่สำเร็จ');
      await refreshFolders();
      setSelectedName(data.created?.[0]?.name || names[0]);
      setSelectedFolderNames(new Set(data.created?.map((item: { name: string }) => item.name) || names));
      log(`✅ สร้าง/ตรวจโฟลเดอร์ครบแล้ว ${data.created?.length || names.length} รายการ`);
      globalTaskStore.updateTask(taskId, { progress: 'สร้างโฟลเดอร์ครบแล้ว', status: 'completed' });
      await generateAndSaveTags(data.created?.map((item: { name: string }) => item.name) || names);
    } catch (e: any) {
      log(`❌ สร้างโฟลเดอร์ล้มเหลว: ${e.message}`);
      globalTaskStore.updateTask(taskId, { progress: e.message, status: 'error' });
    } finally {
      setIsCreating(false);
    }
  };

  const downloadImages = async (name: string) => {
    setLoadingFolder(name);
    const taskId = `celebrity_images_${Date.now()}`;
    globalTaskStore.addTask({ id: taskId, title: `ค้นหารูป ${name}`, category: 'celebrity', progress: 'กำลังค้นหา Wikimedia/Wikipedia...', status: 'running' });
    log(`🔍 ค้นหารูปชัด ๆ ของ ${name} และกำลังดาวน์โหลดเข้าโฟลเดอร์...`);
    try {
      const res = await fetch('/api/celebrity-download-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, count: getImageCount(), parentFolder: rootFolder.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'โหลดรูปไม่สำเร็จ');
      await refreshFolders();
      setSelectedName(name);
      if (data.images?.[0]?.url) setSelectedImageByName(prev => ({ ...prev, [name]: data.images[0].url }));
      log(`✅ โหลดรูป ${name} สำเร็จ ${data.images?.length || 0} รูป (พบ candidate ${data.candidatesCount ?? '-'} รายการ, โหลดไม่ได้ ${data.failedCount ?? 0})`);
      if (data.downloadErrors?.length) log(`ℹ️ ${name}: บาง URL โหลดไม่ได้ เช่น ${data.downloadErrors.slice(0, 2).join(' / ')}`);
      globalTaskStore.updateTask(taskId, { progress: `โหลดสำเร็จ ${data.images?.length || 0} รูป`, status: 'completed' });
    } catch (e: any) {
      log(`❌ โหลดรูป ${name} ล้มเหลว: ${e.message}`);
      globalTaskStore.updateTask(taskId, { progress: e.message, status: 'error' });
    } finally {
      setLoadingFolder('');
    }
  };

  const downloadImagesForNames = async (names: string[]) => {
    const targets = names.filter(Boolean);
    if (targets.length === 0) return alert('เลือกคนดังอย่างน้อย 1 คนก่อนครับ');
    setIsBatchLoading(true);
    const taskId = `celebrity_batch_images_${Date.now()}`;
    globalTaskStore.addTask({ id: taskId, title: `ค้นหารูปคนดัง ${targets.length} คน`, category: 'celebrity', progress: `กำลังเริ่ม 0/${targets.length}...`, status: 'running' });
    let success = 0;
    const requestedCount = getImageCount();
    log(`🚀 เริ่มค้นหาและโหลดรูปแบบชุด ${targets.length} คน (คนละ ${requestedCount} รูป)`);
    try {
      for (let i = 0; i < targets.length; i++) {
        const name = targets[i];
        setLoadingFolder(name);
        globalTaskStore.updateTask(taskId, { progress: `กำลังโหลด ${i + 1}/${targets.length}: ${name}` });
        log(`🔍 [${i + 1}/${targets.length}] ค้นหารูป ${name}`);
        try {
          const res = await fetch('/api/celebrity-download-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, count: requestedCount, parentFolder: rootFolder.trim() || undefined }),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'โหลดรูปไม่สำเร็จ');
          success++;
          log(`✅ ${name}: โหลดเพิ่ม ${data.images?.length || 0} รูป (พบ candidate ${data.candidatesCount ?? '-'} รายการ, โหลดไม่ได้ ${data.failedCount ?? 0})`);
          if (data.downloadErrors?.length) log(`ℹ️ ${name}: ข้าม URL ที่โหลดไม่ได้ ${data.downloadErrors.length} รายการ`);
        } catch (e: any) {
          log(`❌ ${name}: ${e.message}`);
        }
        if (i < targets.length - 1) await wait(700);
      }
      await refreshFolders();
      globalTaskStore.updateTask(taskId, { progress: `เสร็จ ${success}/${targets.length} คน`, status: success > 0 ? 'completed' : 'error' });
      log(`🎯 โหลดรูปแบบชุดเสร็จแล้ว สำเร็จ ${success}/${targets.length} คน`);
    } finally {
      setLoadingFolder('');
      setIsBatchLoading(false);
    }
  };

  const downloadImagesForNoImageFolders = async () => {
    const names = noImageFolders.map(folder => folder.name);
    if (names.length === 0) {
      log('✅ ไม่มีโฟลเดอร์ที่รูปเป็น 0 แล้ว');
      return;
    }
    log(`🧩 เจอโฟลเดอร์ที่ยังไม่มีรูป ${names.length} คน กำลังเริ่มค้นหาให้ทั้งหมด`);
    await downloadImagesForNames(names);
  };

  const shuffle = <T,>(items: T[]) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const buildJobsByTag = (tag: string) => {
    const cleanTag = tag.trim();
    if (!cleanTag) return [];
    const matches = folders.filter(folder => (folder.tags || []).some(item => item === cleanTag));
    if (matches.length === 0) return [];
    const wanted = getTagPickCount();
    const picked: CelebrityFolder[] = [];
    let round = shuffle(matches);
    while (picked.length < wanted) {
      if (round.length === 0) round = shuffle(matches);
      picked.push(round.shift()!);
    }
    const occurrences = new Map<string, number>();
    const jobs = picked.map(folder => {
      const occurrence = occurrences.get(folder.name) || 0;
      occurrences.set(folder.name, occurrence + 1);
      const image = imageForJob(folder, occurrence);
      return {
        id: makeJobId(),
        personName: folder.name,
        selectedTag: cleanTag,
        ...image,
        headline: '',
        postText: '',
        createdAt: new Date().toISOString(),
      };
    });
    return jobs;
  };

  const selectRandomByTag = (tag: string) => {
    const cleanTag = tag.trim();
    if (!cleanTag) return alert('เลือก Tag ก่อนครับ');
    const matches = folders.filter(folder => (folder.tags || []).some(item => item === cleanTag));
    if (matches.length === 0) return alert(`ยังไม่มีคนดังใน Tag: ${cleanTag}`);
    const wanted = getTagPickCount();
    const jobs = buildJobsByTag(cleanTag);
    setSelectedContentTag(cleanTag);
    setSelectedFolderNames(new Set(jobs.map(job => job.personName)));
    setSelectedName(jobs[0]?.personName || selectedName);
    setArticleJobs(jobs);
    log(`🎲 เตรียมคิวจาก Tag "${cleanTag}" แล้ว ${jobs.length} บทความ จากคนดัง ${matches.length} คน${wanted > matches.length ? ' (มีคนซ้ำและวนรูปไม่ให้ซ้ำก่อน)' : ''}`);
  };

  const getCurrentArticleQueue = () => {
    if (selectedContentTag) {
      const wanted = getTagPickCount();
      if (articleJobs.length !== wanted || articleJobs.some(job => job.selectedTag !== selectedContentTag)) {
        const jobs = buildJobsByTag(selectedContentTag);
        if (jobs.length > 0) {
          setArticleJobs(jobs);
          setSelectedFolderNames(new Set(jobs.map(job => job.personName)));
          log(`🔁 ปรับคิวจาก Tag "${selectedContentTag}" เป็น ${jobs.length} บทความตามเลขล่าสุด`);
          return jobs;
        }
      }
    }
    return articleJobs;
  };

  const deleteCelebrityImage = async (folderName: string, imageName: string) => {
    const res = await fetch('/api/celebrity-delete-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: folderName, file: imageName, parentFolder: rootFolder.trim() || undefined }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'ลบรูปไม่สำเร็จ');
    return data;
  };

  const scanAndDeleteBadPortraits = async (names: string[]) => {
    const targets = names.filter(Boolean);
    if (targets.length === 0) return alert('เลือกคนดังอย่างน้อย 1 คนก่อนครับ');
    if (!confirm(`ให้ AI สแกนและลบรูปที่ไม่ใช่หน้าคนใน ${targets.length} โฟลเดอร์ใช่ไหมครับ?\n\nระบบจะลบไฟล์ portrait ที่ AI ประเมินว่าใช้ทำโพสต์ไม่ได้ออกจากโฟลเดอร์จริง`)) return;

    setIsScanningPortraits(true);
    const taskId = `celebrity_scan_faces_${Date.now()}`;
    globalTaskStore.addTask({ id: taskId, title: `สแกนลบรูปที่ไม่ใช่หน้าคน ${targets.length} คน`, category: 'celebrity', progress: 'กำลังเริ่มสแกน...', status: 'running' });
    let scanned = 0;
    let deleted = 0;
    let kept = 0;
    log(`🧠 เริ่มให้ AI สแกนรูป portrait ${targets.length} โฟลเดอร์ เพื่อลบรูปที่ไม่ใช่หน้าคน`);

    try {
      for (let i = 0; i < targets.length; i++) {
        const name = targets[i];
        const folder = folders.find(item => item.name === name);
        setScanningTarget(name);
        globalTaskStore.updateTask(taskId, { progress: `กำลังสแกน ${i + 1}/${targets.length}: ${name}` });

        if (!folder || folder.images.length === 0) {
          log(`ℹ️ ${name}: ไม่มีรูปให้สแกน`);
          continue;
        }

        log(`🔎 ${name}: สแกน ${folder.images.length} รูป`);
        for (const image of folder.images) {
          scanned++;
          try {
            const base64 = await getImageAsBase64(image.url);
            const { data, model } = await callOpenRouterWithProfiles({
              model: 'google/gemini-2.5-flash',
              messages: [{
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `ประเมินรูปนี้สำหรับใช้เป็นภาพ portrait ของ "${name}" ในโพสต์คำสอนคนดัง

ตอบ JSON เท่านั้น:
{"keep":true/false,"confidence":0-1,"reason":"เหตุผลสั้นๆ ภาษาไทย"}

เก็บ (keep=true) ถ้า:
- เห็นหน้าคนหรือศีรษะ/ครึ่งตัวของมนุษย์ชัดพอใช้เป็นรูปประกอบโพสต์ได้
- เป็นภาพขาวดำหรือภาพเก่าก็เก็บได้ ถ้ายังเห็นหน้าคนชัด

ลบ (keep=false) ถ้า:
- ไม่ใช่รูปคน, เป็นเอกสาร, โลโก้, กราฟ, ปกหนังสือ, ภาพข้อความ, วัตถุ, ภาพเสีย/แตก
- เป็นรูปหมู่ที่ไม่มีหน้าหลักชัดเจน
- เห็นคนเล็กมาก/หันหลัง/หน้าถูกบังจนใช้เป็น portrait ไม่ได้

ห้ามเดาตัวตนจากภาพ ให้ประเมินแค่ว่าเป็นรูปหน้าคนที่ใช้ได้หรือไม่`,
                  },
                  { type: 'image_url', image_url: { url: base64 } },
                ],
              }],
              temperature: 0,
            });
            const raw = data.choices?.[0]?.message?.content || '';
            const verdict = parsePortraitScan(raw);
            if (!verdict.keep) {
              await deleteCelebrityImage(name, image.name);
              deleted++;
              setSelectedImageByName(prev => prev[name] === image.url ? { ...prev, [name]: '' } : prev);
              log(`🗑️ ${name}/${image.name}: ลบแล้ว (${verdict.reason || 'AI ประเมินว่าไม่ใช่หน้าคนที่ใช้ได้'})`);
            } else {
              kept++;
              log(`✅ ${name}/${image.name}: เก็บไว้ (${verdict.reason || `ผ่านการประเมินด้วย ${model}`})`);
            }
          } catch (e: any) {
            log(`⚠️ ${name}/${image.name}: สแกนไม่ได้ เลยยังไม่ลบ (${e.message})`);
          }
          await wait(450);
        }
      }

      await refreshFolders();
      globalTaskStore.updateTask(taskId, { progress: `สแกน ${scanned} รูป, ลบ ${deleted}, เก็บ ${kept}`, status: 'completed' });
      log(`🎯 สแกนรูปเสร็จแล้ว: ตรวจ ${scanned} รูป, ลบ ${deleted} รูป, เก็บ ${kept} รูป`);
    } catch (e: any) {
      globalTaskStore.updateTask(taskId, { progress: e.message, status: 'error' });
      log(`❌ สแกนลบรูปไม่สำเร็จ: ${e.message}`);
    } finally {
      setScanningTarget('');
      setIsScanningPortraits(false);
    }
  };

  const generateCopy = async (name: string) => {
    setWritingName(name);
    const taskId = `celebrity_copy_${Date.now()}`;
    globalTaskStore.addTask({ id: taskId, title: `เขียนบทความ ${name}`, category: 'celebrity', progress: 'กำลังให้ AI เขียนบทความ...', status: 'running' });
    log(`✍️ กำลังเขียนบทความและพาดหัว 3 บรรทัดสำหรับ ${name}`);
    try {
      const keyCandidates = await getOpenRouterKeyCandidates();
      if (keyCandidates.length === 0) {
        const copy = fallbackCopy(name);
        setCopyByName(prev => ({ ...prev, [name]: copy }));
        log(`⚠️ ไม่พบ OpenRouter Key เลยใช้บทความตัวอย่างให้ ${name} ก่อน`);
        globalTaskStore.updateTask(taskId, { progress: 'ใช้บทความตัวอย่าง เพราะไม่มี OpenRouter Key', status: 'completed' });
        return copy;
      }

      const prompt = `คุณคือนักเขียนโพสต์ Facebook ภาษาไทยสายแรงบันดาลใจ/บทเรียนชีวิต
เขียนคอนเทนต์หัวข้อ "คำสอนจากคนดัง" ของบุคคล: ${name}

ข้อกำหนด:
- ตอบเป็น JSON เท่านั้น: {"headline":"...", "postText":"..."}
- headline ต้องมี 3 บรรทัด คั่นด้วย \\n สไตล์ Hook-Method-Result คล้ายตัวอย่างนี้:
${headlineExamples}
- postText ภาษาไทย อ่านง่าย แชร์ง่าย มี bullet 3-5 ข้อ และแฮชแท็กท้ายโพสต์
- ห้ามแต่งคำคมแบบใส่เครื่องหมายอัญประกาศว่าเป็นคำพูดจริง ถ้าไม่มั่นใจว่าเป็น quote จริง
- เน้น "บทเรียน/วิธีคิด" ของ ${name} มากกว่าประวัติยาว ๆ
- น้ำเสียงใกล้เคียงบทความตัวอย่าง: เล่าเป็นมิตร ชัด กระแทกใจ แต่ไม่เว่อร์`;

      const { data, keyLabel, model } = await callOpenRouterWithProfiles({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.75,
      });
      const copy = parseAiCopy(data.choices?.[0]?.message?.content || '', name);
      setCopyByName(prev => ({ ...prev, [name]: copy }));
      log(`✅ เขียนบทความ ${name} เสร็จแล้ว ด้วย ${keyLabel} (${model})`);
      globalTaskStore.updateTask(taskId, { progress: `เขียนบทความเสร็จแล้ว ด้วย ${keyLabel}`, status: 'completed' });
      return copy;
    } catch (e: any) {
      const copy = fallbackCopy(name);
      setCopyByName(prev => ({ ...prev, [name]: copy }));
      log(`⚠️ AI เขียน ${name} ไม่สำเร็จ ใช้บทความสำรองแทน: ${e.message}`);
      globalTaskStore.updateTask(taskId, { progress: e.message, status: 'error' });
      return copy;
    } finally {
      setWritingName('');
    }
  };

  const generateCopyForSelectedFolders = async () => {
    const queue = getCurrentArticleQueue();
    const targets = queue.length > 0
      ? queue
      : folders.filter(folder => selectedFolderNames.has(folder.name)).map(folder => {
          const image = imageForJob(folder, 0);
          return {
            id: makeJobId(),
            personName: folder.name,
            selectedTag: selectedContentTag,
            ...image,
            headline: '',
            postText: '',
            createdAt: new Date().toISOString(),
          };
        });
    if (targets.length === 0) return alert('เลือกคนดังที่จะสร้างบทความก่อนครับ');
    if (queue.length === 0) setArticleJobs(targets);
    setIsBatchWriting(true);
    const taskId = `celebrity_batch_copy_${Date.now()}`;
    globalTaskStore.addTask({ id: taskId, title: `สร้างบทความคนดัง ${targets.length} รายการ`, category: 'celebrity', progress: 'กำลังเริ่ม...', status: 'running' });
    let done = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        const job = targets[i];
        globalTaskStore.updateTask(taskId, { progress: `เขียน ${i + 1}/${targets.length}: ${job.personName}` });
        const copy = await generateCopy(job.personName);
        setArticleJobs(prev => prev.map(item => item.id === job.id ? { ...item, headline: copy.headline, postText: copy.postText } : item));
        done++;
        await wait(500);
      }
      globalTaskStore.updateTask(taskId, { progress: `เขียนเสร็จ ${done}/${targets.length}`, status: 'completed' });
      log(`✅ สร้างบทความชุดเสร็จแล้ว ${done}/${targets.length} รายการ`);
    } finally {
      setIsBatchWriting(false);
    }
  };

  const renderCanvas = async (folderName: string, imageUrl: string, copy: GeneratedCopy, selectedTag = selectedContentTag) => {
    if (!imageUrl) return alert('เลือกรูปก่อนครับ');
    if (!copy?.headline) return alert('สร้างหรือกรอกพาดหัวก่อนครับ');
    setRenderingName(folderName);
    const taskId = `celebrity_render_${Date.now()}`;
    globalTaskStore.addTask({ id: taskId, title: `สร้างรูปโพสต์ ${folderName}`, category: 'celebrity', progress: 'กำลังจัดวาง Canvas 1:1...', status: 'running' });
    const template = getTemplateById(selectedTemplateId);
    log(`🎨 กำลังสร้างรูป 1:1 ของ ${folderName} ด้วย Template: ${template.name}`);
    try {
      const img = await loadImage(imageUrl);
      const canvas = previewRef.current || document.createElement('canvas');
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context ไม่พร้อม');

      const label = pageName.trim() || 'Mindset Daily';
      const rawLines = headlineLines(copy);
      const fontTheme = getFontThemeById(selectedFontThemeId);
      const lineColors = useFontAccent
        ? [fontTheme.accent, fontTheme.base, fontTheme.highlight]
        : [fontTheme.base, fontTheme.base, fontTheme.base];

      if (template.id === 'poster') {
        ctx.fillStyle = '#080808';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        drawCoverImage(ctx, img, 0, 0, CANVAS_SIZE, CANVAS_SIZE, 0.5, 0.22);
        const overlay = ctx.createLinearGradient(0, 0, 0, CANVAS_SIZE);
        overlay.addColorStop(0, 'rgba(0,0,0,0.18)');
        overlay.addColorStop(0.48, 'rgba(0,0,0,0.25)');
        overlay.addColorStop(1, 'rgba(0,0,0,0.92)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        drawPageLabel(ctx, label, CANVAS_SIZE - 34, 30, 'right');

        if (useTextBg) {
          ctx.fillStyle = fontTheme.panel;
          ctx.fillRect(54, 628, 972, 360);
        }
        ctx.fillStyle = fontTheme.accent;
        ctx.fillRect(54, 628, 12, 360);
        const fontSize = fitFontSize(ctx, rawLines, 900, 62, 40);
        ctx.font = `900 ${fontSize}px Kanit, "Noto Sans Thai", sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = fontTheme.shadow;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = fontTheme.shadow;
        ctx.lineWidth = 7;
        rawLines.forEach((line, index) => {
          const y = 728 + index * Math.round(fontSize * 1.24);
          drawHeadlineText(ctx, line, 94, y, 860, fontSize, lineColors[index] || fontTheme.base, 'left', false, fontTheme.textBg);
        });
        ctx.shadowBlur = 0;
      } else if (template.id === 'split') {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        drawCoverImage(ctx, img, 470, 0, 610, CANVAS_SIZE, 0.5, 0.22);
        const sideFade = ctx.createLinearGradient(430, 0, 720, 0);
        sideFade.addColorStop(0, '#050505');
        sideFade.addColorStop(1, 'rgba(5,5,5,0)');
        ctx.fillStyle = sideFade;
        ctx.fillRect(430, 0, 330, CANVAS_SIZE);
        drawPageLabel(ctx, label, 44, 34, 'left');

        ctx.fillStyle = fontTheme.accent;
        ctx.fillRect(58, 198, 116, 10);
        ctx.fillStyle = fontTheme.muted;
        ctx.font = 'bold 28px Kanit, "Noto Sans Thai", sans-serif';
        ctx.fillText('คำสอนจากคนดัง', 58, 270);
        const fontSize = fitFontSize(ctx, rawLines, 390, 58, 38);
        ctx.font = `900 ${fontSize}px Kanit, "Noto Sans Thai", sans-serif`;
        ctx.textAlign = 'left';
        ctx.strokeStyle = fontTheme.shadow;
        ctx.lineWidth = 7;
        ctx.shadowColor = fontTheme.shadow;
        ctx.shadowBlur = 7;
        rawLines.forEach((line, index) => {
          drawHeadlineText(ctx, line, 58, 370 + index * Math.round(fontSize * 1.24), 390, fontSize, lineColors[index] || fontTheme.base, 'left', useTextBg, fontTheme.textBg);
        });
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        ctx.fillRect(58, 790, 330, 2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = fontTheme.muted;
        ctx.font = 'bold 30px Kanit, "Noto Sans Thai", sans-serif';
        ctx.fillText(folderName, 58, 855);
      } else if (template.id === 'quote-card') {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        drawCoverImage(ctx, img, 0, 0, CANVAS_SIZE, CANVAS_SIZE, 0.5, 0.24);
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        drawPageLabel(ctx, label, CANVAS_SIZE - 34, 30, 'right');

        ctx.save();
        ctx.beginPath();
        ctx.arc(540, 250, 168, 0, Math.PI * 2);
        ctx.clip();
        drawCoverImage(ctx, img, 372, 82, 336, 336, 0.5, 0.2);
        ctx.restore();
        ctx.lineWidth = 10;
        ctx.strokeStyle = fontTheme.accent;
        ctx.beginPath();
        ctx.arc(540, 250, 172, 0, Math.PI * 2);
        ctx.stroke();

        if (useTextBg) {
          ctx.fillStyle = fontTheme.panel;
          fillRoundRect(ctx, 84, 492, 912, 390, 28);
        }
        ctx.fillStyle = fontTheme.accent;
        ctx.font = '900 94px Kanit, "Noto Sans Thai", sans-serif';
        ctx.fillText('“', 106, 586);
        const fontSize = fitFontSize(ctx, rawLines, 810, 58, 38);
        ctx.font = `900 ${fontSize}px Kanit, "Noto Sans Thai", sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.strokeStyle = fontTheme.shadow;
        ctx.lineWidth = 8;
        ctx.shadowColor = fontTheme.shadow;
        ctx.shadowBlur = 8;
        rawLines.forEach((line, index) => {
          drawHeadlineText(ctx, line, 540, 620 + index * Math.round(fontSize * 1.22), 810, fontSize, lineColors[index] || fontTheme.base, 'center', false, fontTheme.textBg);
        });
        ctx.shadowBlur = 0;
        ctx.fillStyle = fontTheme.muted;
        ctx.font = 'bold 32px Kanit, "Noto Sans Thai", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(folderName, 540, 930);
      } else if (template.id === 'diagonal') {
        ctx.fillStyle = '#060606';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        drawCoverImage(ctx, img, 0, 0, CANVAS_SIZE, CANVAS_SIZE, 0.5, 0.22);
        const shade = ctx.createLinearGradient(0, 260, 0, CANVAS_SIZE);
        shade.addColorStop(0, 'rgba(0,0,0,0.08)');
        shade.addColorStop(1, 'rgba(0,0,0,0.86)');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.fillStyle = useTextBg ? fontTheme.panel : 'rgba(0,0,0,0.46)';
        ctx.beginPath();
        ctx.moveTo(0, 555);
        ctx.lineTo(CANVAS_SIZE, 430);
        ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE);
        ctx.lineTo(0, CANVAS_SIZE);
        ctx.closePath();
        ctx.fill();
        drawPageLabel(ctx, label, CANVAS_SIZE - 34, 30, 'right');

        ctx.fillStyle = fontTheme.accent;
        ctx.fillRect(74, 596, 168, 12);
        const fontSize = fitFontSize(ctx, rawLines, 850, 64, 40);
        ctx.font = `900 ${fontSize}px Kanit, "Noto Sans Thai", sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.strokeStyle = fontTheme.shadow;
        ctx.lineWidth = 9;
        ctx.shadowColor = fontTheme.shadow;
        ctx.shadowBlur = 8;
        rawLines.forEach((line, index) => {
          drawHeadlineText(ctx, line, 82, 700 + index * Math.round(fontSize * 1.22), 850, fontSize, lineColors[index] || fontTheme.base, 'left', false, fontTheme.textBg);
        });
        ctx.shadowBlur = 0;
        ctx.fillStyle = fontTheme.muted;
        ctx.font = 'bold 30px Kanit, "Noto Sans Thai", sans-serif';
        ctx.fillText(folderName, 82, 980);
      } else if (template.id === 'magazine') {
        ctx.fillStyle = '#090909';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        drawCoverImage(ctx, img, 0, 0, CANVAS_SIZE, CANVAS_SIZE, 0.5, 0.22);
        const magazineShade = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        magazineShade.addColorStop(0, 'rgba(0,0,0,0.78)');
        magazineShade.addColorStop(0.45, 'rgba(0,0,0,0.2)');
        magazineShade.addColorStop(1, 'rgba(0,0,0,0.72)');
        ctx.fillStyle = magazineShade;
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        drawPageLabel(ctx, label, 44, 30, 'left');

        ctx.fillStyle = fontTheme.accent;
        ctx.fillRect(64, 170, 10, 680);
        ctx.font = '900 46px Kanit, "Noto Sans Thai", sans-serif';
        ctx.fillStyle = fontTheme.base;
        ctx.fillText('LESSON', 98, 222);
        ctx.fillStyle = fontTheme.muted;
        ctx.font = 'bold 26px Kanit, "Noto Sans Thai", sans-serif';
        ctx.fillText(folderName, 98, 266);
        const fontSize = fitFontSize(ctx, rawLines, 760, 72, 42);
        ctx.font = `900 ${fontSize}px Kanit, "Noto Sans Thai", sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.strokeStyle = fontTheme.shadow;
        ctx.lineWidth = 9;
        ctx.shadowColor = fontTheme.shadow;
        ctx.shadowBlur = 8;
        rawLines.forEach((line, index) => {
          drawHeadlineText(ctx, line, 98, 650 + index * Math.round(fontSize * 1.2), 760, fontSize, lineColors[index] || fontTheme.base, 'left', useTextBg, fontTheme.textBg);
        });
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#080808';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        drawCoverImage(ctx, img, 0, 0, CANVAS_SIZE, IMAGE_AREA_HEIGHT, 0.5, 0.18);

        const gradient = ctx.createLinearGradient(0, IMAGE_AREA_HEIGHT - 120, 0, IMAGE_AREA_HEIGHT + 20);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.92)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, IMAGE_AREA_HEIGHT - 120, CANVAS_SIZE, 140);
        drawPageLabel(ctx, label, CANVAS_SIZE - 34, 30, 'right');

        ctx.fillStyle = '#020202';
        ctx.fillRect(0, IMAGE_AREA_HEIGHT, CANVAS_SIZE, CANVAS_SIZE - IMAGE_AREA_HEIGHT);

        const fontSize = fitFontSize(ctx, rawLines, 960, 66, 42);
        ctx.font = `900 ${fontSize}px Kanit, "Noto Sans Thai", sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = fontTheme.shadow;
        ctx.shadowBlur = 6;
        ctx.lineWidth = 9;
        ctx.strokeStyle = fontTheme.shadow;
        const lineHeight = Math.round(fontSize * 1.28);
        const startY = IMAGE_AREA_HEIGHT + 105;
        rawLines.forEach((line, index) => {
          const wrapped = wrapText(ctx, line, 960).slice(0, 1);
          const y = startY + index * lineHeight;
          drawHeadlineText(ctx, wrapped[0] || line, CANVAS_SIZE / 2, y, 960, fontSize, lineColors[index] || fontTheme.base, 'center', useTextBg, fontTheme.textBg);
        });
        ctx.shadowBlur = 0;
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
      const res = await fetch('/api/celebrity-save-canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: folderName, base64Data: dataUrl, fileName: `${folderName}_post_${Date.now()}.jpg`, parentFolder: rootFolder.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'บันทึกรูปไม่สำเร็จ');
      const folderMeta = folders.find(folder => folder.name === folderName);
      await addSavedResult({
        id: `celebrity_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        personName: folderName,
        headline: copy.headline,
        article: copy.postText,
        imageUrl: data.url,
        localImageUrl: data.url,
        tags: folderMeta?.tags || [],
        selectedTag: selectedTag || '',
        categorySummary: folderMeta?.categorySummary || '',
        createdAt: new Date().toISOString(),
      });
      await refreshFolders();
      log(`✅ สร้างรูปเสร็จและเก็บลงผลลัพธ์แล้ว: ${data.url}`);
      globalTaskStore.updateTask(taskId, { progress: 'สร้างรูปและบันทึกไฟล์เสร็จแล้ว', status: 'completed' });
    } catch (e: any) {
      log(`❌ สร้างรูป ${folderName} ล้มเหลว: ${e.message}`);
      globalTaskStore.updateTask(taskId, { progress: e.message, status: 'error' });
    } finally {
      setRenderingName('');
    }
  };

  const renderSelectedFolders = async () => {
    const queue = getCurrentArticleQueue();
    const targets = queue.length > 0
      ? queue
      : folders.filter(folder => selectedFolderNames.has(folder.name)).map(folder => {
          const image = imageForJob(folder, 0);
          const copy = copyByName[folder.name] || fallbackCopy(folder.name);
          return {
            id: makeJobId(),
            personName: folder.name,
            selectedTag: selectedContentTag,
            ...image,
            headline: copy.headline,
            postText: copy.postText,
            createdAt: new Date().toISOString(),
          };
        });
    if (targets.length === 0) return alert('เลือกคนดังที่จะสร้างรูปก่อนครับ');
    setIsBatchRendering(true);
    const taskId = `celebrity_batch_render_${Date.now()}`;
    globalTaskStore.addTask({ id: taskId, title: `สร้างรูปโพสต์คนดัง ${targets.length} รายการ`, category: 'celebrity', progress: 'กำลังเริ่ม...', status: 'running' });
    let done = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        const job = targets[i];
        if (!job.imageUrl) {
          log(`⚠️ ${job.personName}: ข้ามสร้างรูป เพราะยังไม่มีรูป portrait`);
          continue;
        }
        globalTaskStore.updateTask(taskId, { progress: `สร้างรูป ${i + 1}/${targets.length}: ${job.personName}` });
        let copy = { headline: job.headline, postText: job.postText };
        if (!copy.headline || !copy.postText) {
          copy = await generateCopy(job.personName) || fallbackCopy(job.personName);
          setArticleJobs(prev => prev.map(item => item.id === job.id ? { ...item, headline: copy.headline, postText: copy.postText } : item));
        }
        await renderCanvas(job.personName, job.imageUrl, copy, job.selectedTag || selectedContentTag);
        done++;
        await wait(700);
      }
      await loadSavedResults();
      globalTaskStore.updateTask(taskId, { progress: `สร้างรูปเสร็จ ${done}/${targets.length}`, status: 'completed' });
      log(`✅ สร้างรูปชุดเสร็จแล้ว ${done}/${targets.length} รายการ`);
    } finally {
      setIsBatchRendering(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-100">คำสอนจากคนดัง</h2>
            <p className="text-xs text-gray-400 mt-1">สร้างโฟลเดอร์หลายคน ค้นหารูปชัด ๆ แล้วทำภาพโพสต์ 1:1 พร้อมบทความสำหรับ Facebook</p>
          </div>
          <div className="min-w-[260px] space-y-2">
            <label className="text-xs font-bold text-gray-400 block mb-1">ชื่อเพจมุมขวาบน</label>
            <input value={pageName} onChange={e => setPageName(e.target.value)} className="input-field text-sm w-full" placeholder="เช่น Mindset Daily" />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-gray-700/60 bg-gray-900/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <label className="text-xs font-bold text-gray-300 block">Template รูปโพสต์</label>
              <p className="text-[10px] text-gray-500 mt-0.5">เลือกหน้าตาก่อนกดสร้างรูป ต่อไปเพิ่ม Template ใหม่แล้วจะมาอยู่ตรงนี้</p>
            </div>
            <span className="text-[10px] text-cyan-300">กำลังใช้: {getTemplateById(selectedTemplateId).name}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {CELEBRITY_TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplateId(template.id)}
                className={`text-left rounded-xl border p-3 transition-all ${selectedTemplateId === template.id ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/10' : 'border-gray-700 bg-black/20 hover:border-gray-500'}`}
              >
                <div className="flex gap-3">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-950 border border-gray-700 shrink-0">
                    {template.preview === 'bottom-bar' && (
                      <>
                        <div className="absolute inset-x-0 top-0 h-[62%] bg-gradient-to-br from-gray-300 via-gray-600 to-gray-900" />
                        <div className="absolute inset-x-0 bottom-0 h-[38%] bg-black" />
                        <div className="absolute left-2 right-2 bottom-5 h-1.5 rounded bg-amber-300" />
                        <div className="absolute left-2 right-4 bottom-3 h-1 rounded bg-white" />
                        <div className="absolute left-2 right-6 bottom-1.5 h-1 rounded bg-cyan-300" />
                      </>
                    )}
                    {template.preview === 'poster' && (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-700 to-black" />
                        <div className="absolute inset-x-2 bottom-2 h-8 bg-black/70 border-l-4 border-amber-400" />
                        <div className="absolute left-4 right-4 bottom-6 h-1.5 rounded bg-amber-300" />
                        <div className="absolute left-4 right-5 bottom-4 h-1 rounded bg-white" />
                      </>
                    )}
                    {template.preview === 'split' && (
                      <>
                        <div className="absolute inset-y-0 right-0 w-[52%] bg-gradient-to-br from-gray-200 via-gray-600 to-gray-950" />
                        <div className="absolute inset-y-0 left-0 w-[58%] bg-black" />
                        <div className="absolute left-2 top-4 w-7 h-1 rounded" style={{ background: template.accent }} />
                        <div className="absolute left-2 right-9 top-8 h-1.5 rounded bg-white" />
                        <div className="absolute left-2 right-12 top-12 h-1 rounded bg-amber-300" />
                      </>
                    )}
                    {template.preview === 'quote-card' && (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-gray-950 to-black" />
                        <div className="absolute left-6 top-3 w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-700 border-2 border-violet-300" />
                        <div className="absolute left-3 right-3 bottom-3 h-8 rounded bg-black/70" />
                        <div className="absolute left-5 right-5 bottom-7 h-1.5 rounded bg-violet-300" />
                        <div className="absolute left-5 right-7 bottom-5 h-1 rounded bg-white" />
                      </>
                    )}
                    {template.preview === 'diagonal' && (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-300 via-gray-700 to-black" />
                        <div className="absolute -left-2 right-[-8px] bottom-[-6px] h-11 bg-black/80 rotate-[-7deg]" />
                        <div className="absolute left-3 bottom-8 w-8 h-1 rounded bg-red-400" />
                        <div className="absolute left-3 right-4 bottom-5 h-1.5 rounded bg-white" />
                        <div className="absolute left-3 right-8 bottom-3 h-1 rounded bg-red-300" />
                      </>
                    )}
                    {template.preview === 'magazine' && (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-700 to-sky-950" />
                        <div className="absolute left-2 top-3 bottom-3 w-1 rounded bg-sky-300" />
                        <div className="absolute left-4 top-4 w-9 h-1.5 rounded bg-white" />
                        <div className="absolute left-4 right-3 bottom-7 h-1.5 rounded bg-sky-300" />
                        <div className="absolute left-4 right-6 bottom-5 h-1 rounded bg-white" />
                        <div className="absolute left-4 right-8 bottom-3 h-1 rounded bg-white" />
                      </>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-gray-100 text-sm">{template.name}</div>
                    <div className="text-[10px] text-gray-400 leading-snug mt-1">{template.description}</div>
                    {selectedTemplateId === template.id && <div className="mt-2 text-[10px] text-cyan-300">เลือกอยู่</div>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-700/60 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label className="text-xs font-bold text-gray-300 block">ชุดสี Font</label>
                <span className="text-[10px] text-gray-500">ใช้กับพาดหัวตอนสร้างรูป</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {CELEBRITY_FONT_THEMES.map(theme => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedFontThemeId(theme.id)}
                    className={`rounded-lg border p-2 text-left transition-all ${selectedFontThemeId === theme.id ? 'border-amber-300 bg-amber-400/10' : 'border-gray-700 bg-black/20 hover:border-gray-500'}`}
                  >
                    <div className="flex gap-1 mb-2">
                      <span className="h-5 flex-1 rounded" style={{ background: theme.base }} />
                      <span className="h-5 flex-1 rounded" style={{ background: theme.accent }} />
                      <span className="h-5 flex-1 rounded" style={{ background: theme.highlight }} />
                    </div>
                    <div className="text-[11px] font-bold text-gray-100">{theme.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-700/70 bg-black/20 p-3">
              <label className="text-xs font-bold text-gray-300 block mb-2">รูปแบบตัวอักษร</label>
              <div className="space-y-2">
                <label className="flex items-center justify-between gap-3 rounded-lg bg-gray-900/70 px-3 py-2 text-xs font-bold text-gray-200">
                  <span>ถมสีด้านหลัง Font</span>
                  <input type="checkbox" checked={useTextBg} onChange={e => setUseTextBg(e.target.checked)} className="w-5 h-5 accent-cyan-500" />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-lg bg-gray-900/70 px-3 py-2 text-xs font-bold text-gray-200">
                  <span>เน้นสี Font</span>
                  <input type="checkbox" checked={useFontAccent} onChange={e => setUseFontAccent(e.target.checked)} className="w-5 h-5 accent-amber-500" />
                </label>
              </div>
              <div className="mt-3 rounded-lg border border-gray-700 bg-gray-950 p-3">
                <div className="text-[10px] text-gray-500 mb-1">ตัวอย่างสี</div>
                <div className="text-sm font-black leading-tight" style={{ color: useFontAccent ? getFontThemeById(selectedFontThemeId).accent : getFontThemeById(selectedFontThemeId).base }}>
                  คิดให้ลึกกว่าเดิม
                </div>
                <div className="text-sm font-black leading-tight" style={{ color: getFontThemeById(selectedFontThemeId).base }}>
                  แล้วลงมือทำให้จริง
                </div>
                <div className="text-sm font-black leading-tight" style={{ color: useFontAccent ? getFontThemeById(selectedFontThemeId).highlight : getFontThemeById(selectedFontThemeId).base }}>
                  จนผลลัพธ์เปลี่ยน
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-gray-700/60 bg-gray-900/30 p-4">
          <label className="text-xs font-bold text-gray-400 block mb-2">โฟลเดอร์หลักสำหรับเก็บรูปคนดัง</label>
          <div className="flex flex-wrap gap-2">
            <input
              value={rootFolder}
              onChange={e => setRootFolder(e.target.value)}
              className="input-field text-sm flex-1 min-w-[260px]"
              placeholder={OUTPUT_FOLDER}
            />
            <button onClick={pickRootFolder} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-lg">
              เลือกโฟลเดอร์
            </button>
            <button onClick={() => refreshFolders()} className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold rounded-lg">
              อ่าน Subfolder
            </button>
          </div>
          <p className="mt-2 text-[10px] text-gray-500 break-all">ถ้าเว้นว่าง จะใช้ค่าเริ่มต้น: {OUTPUT_FOLDER}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3 mt-5">
          <textarea
            value={namesText}
            onChange={e => setNamesText(e.target.value)}
            className="input-field min-h-[120px] text-sm"
            placeholder="ใส่ชื่อคนดังทีละบรรทัด หรือคั่นด้วย comma"
          />
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 block">จำนวนรูปต่อคน</label>
            <input
              type="number"
              min={1}
              max={30}
              value={imageCountText}
              onChange={e => {
                const value = e.target.value;
                if (/^\d{0,2}$/.test(value)) setImageCountText(value);
              }}
              onBlur={() => setImageCountText(String(getImageCount()))}
              className="input-field text-sm w-full"
            />
            <button onClick={createFolders} disabled={isCreating || selectedInputNames.length === 0} className="w-full px-4 py-2.5 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg">
              {isCreating ? 'กำลังสร้าง...' : `สร้างโฟลเดอร์ ${selectedInputNames.length} คน`}
            </button>
            <div className="text-[10px] text-gray-500 break-all">เก็บที่ {rootFolder.trim() || OUTPUT_FOLDER}</div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="h-fit">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-gray-200">โฟลเดอร์คนดัง</h3>
              <p className="text-[10px] text-gray-500">เลือกคนไม่ซ้ำ {selectedFolderNames.size}/{folders.length} · คิวบทความ {articleJobs.length}</p>
            </div>
            <button onClick={() => refreshFolders()} className="text-xs px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg">รีเฟรช</button>
          </div>
          {folders.length > 0 && (
            <div className="mb-3 space-y-3 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[150px]">
                  <label className="text-[10px] text-gray-400 block mb-1">จำนวนบทความจาก Tag</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={tagPickCountText}
                    onChange={e => {
                      const value = e.target.value;
                      if (/^\d{0,3}$/.test(value)) setTagPickCountText(value);
                    }}
                    onBlur={() => setTagPickCountText(String(getTagPickCount()))}
                    className="input-field text-xs w-full"
                  />
                </div>
                <div className="flex-1 min-w-[240px]">
                  <div className="text-[10px] text-gray-400 mb-1">เลือก Tag เพื่อสุ่มคนดัง</div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.length === 0 ? (
                      <span className="text-[10px] text-gray-500">ยังไม่มี Tag กด AI Tag ก่อนครับ</span>
                    ) : availableTags.map(([tag, count]) => (
                      <button
                        key={tag}
                        onClick={() => selectRandomByTag(tag)}
                        className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${selectedContentTag === tag ? 'bg-amber-500 text-black border-amber-300' : 'bg-amber-500/15 text-amber-200 border-amber-500/30 hover:bg-amber-500/25'}`}
                      >
                        #{tag} ({count})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
              <button onClick={selectAllFolders} className="text-[10px] px-2.5 py-1 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg">เลือกทั้งหมด</button>
              <button onClick={clearFolderSelection} className="text-[10px] px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg">ยกเลิก</button>
              <button
                onClick={() => downloadImagesForNames([...selectedFolderNames])}
                disabled={isBatchLoading || selectedFolderNames.size === 0}
                className="text-[10px] px-2.5 py-1 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg"
              >
                ค้นหารูปที่เลือก
              </button>
              <button
                onClick={() => downloadImagesForNames(folders.map(folder => folder.name))}
                disabled={isBatchLoading}
                className="text-[10px] px-2.5 py-1 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg"
              >
                ค้นหารูปทั้งหมด
              </button>
              <button
                onClick={downloadImagesForNoImageFolders}
                disabled={isBatchLoading || noImageFolders.length === 0}
                className="text-[10px] px-2.5 py-1 bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg"
              >
                ค้นหาคนที่ยังไม่มีรูป ({noImageFolders.length})
              </button>
              <button
                onClick={() => generateAndSaveTags([...selectedFolderNames])}
                disabled={taggingNames || selectedFolderNames.size === 0}
                className="text-[10px] px-2.5 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg"
              >
                AI Tag ที่เลือก
              </button>
              <button
                onClick={() => generateAndSaveTags(folders.map(folder => folder.name))}
                disabled={taggingNames}
                className="text-[10px] px-2.5 py-1 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg"
              >
                AI Tag ทั้งหมด
              </button>
              <button
                onClick={generateCopyForSelectedFolders}
                disabled={isBatchWriting || (articleJobs.length === 0 && selectedFolderNames.size === 0)}
                className="text-[10px] px-2.5 py-1 bg-fuchsia-700 hover:bg-fuchsia-600 disabled:opacity-50 text-white rounded-lg"
              >
                {isBatchWriting ? 'กำลังสร้างบทความ...' : `สร้างบทความจากคิว (${articleQueueCount})`}
              </button>
              <button
                onClick={renderSelectedFolders}
                disabled={isBatchRendering || (articleJobs.length === 0 && selectedFolderNames.size === 0)}
                className="text-[10px] px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg"
              >
                {isBatchRendering ? 'กำลังสร้างรูป...' : `สร้างรูปจากคิว (${articleQueueCount})`}
              </button>
              <button
                onClick={() => scanAndDeleteBadPortraits([...selectedFolderNames])}
                disabled={isScanningPortraits || selectedFolderNames.size === 0}
                className="text-[10px] px-2.5 py-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg"
              >
                AI ลบรูปไม่ใช่หน้าคน
              </button>
              </div>
              {selectedContentTag && (
                <div className="text-[10px] text-amber-200">Tag ชุดงานปัจจุบัน: #{selectedContentTag} จะถูกบันทึกลง CSV ในคอลัมน์ selected_tag</div>
              )}
            </div>
          )}
          {isBatchLoading && (
            <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              กำลังโหลดรูปแบบชุด... ตอนนี้ทำที่ {loadingFolder || 'เตรียมคิว'}
            </div>
          )}
          {taggingNames && (
            <div className="mb-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
              กำลังให้ AI จัด Tag คนดัง...
            </div>
          )}
          {isScanningPortraits && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              กำลังให้ AI สแกนรูปที่ไม่ใช่หน้าคน... ตอนนี้ทำที่ {scanningTarget || 'เตรียมคิว'}
            </div>
          )}
          {(isBatchWriting || isBatchRendering) && (
            <div className="mb-3 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-200">
              {isBatchWriting ? 'กำลังสร้างบทความจากรายการที่เลือก...' : 'กำลังสร้างรูปโพสต์จากรายการที่เลือก...'}
            </div>
          )}
          <div className="text-[10px] text-gray-500 break-all mb-3">
            โฟลเดอร์หลัก: {rootFolder.trim() || OUTPUT_FOLDER}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 max-h-[720px] overflow-y-auto custom-scrollbar pr-1">
            {folders.length === 0 ? (
              <p className="text-sm text-gray-500">ยังไม่มีโฟลเดอร์ สร้างจากรายชื่อด้านบน หรือกด “อ่าน Subfolder” หลังตั้งโฟลเดอร์หลัก</p>
            ) : folders.map(folder => (
              <div
                key={folder.name}
                className={`w-full text-left rounded-xl border p-3 transition-all ${selectedFolder?.name === folder.name ? 'border-cyan-500 bg-cyan-500/10' : 'border-gray-700/60 bg-gray-900/20 hover:border-gray-500'}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedFolderNames.has(folder.name)}
                    onChange={() => toggleFolderSelect(folder.name)}
                    className="w-4 h-4 accent-cyan-500 shrink-0"
                  />
                  <button
                    onClick={() => {
                      setSelectedName(folder.name);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <strong className="block text-sm text-gray-100 truncate">{folder.name}</strong>
                    <span className="text-[10px] text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full">{folder.imageCount} รูป</span>
                  </button>
                </div>
                {folder.tags && folder.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {folder.tags.map(tag => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-500/20">
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-[10px] text-gray-500">ยังไม่มี Tag</div>
                )}
                {folder.categorySummary && (
                  <p className="mt-1 text-[10px] leading-snug text-gray-400">{folder.categorySummary}</p>
                )}
                <div className="mt-2 flex gap-1.5">
                  {folder.images.slice(0, 4).map(image => <img key={image.url} src={image.url} alt="" className="w-12 h-12 rounded object-cover border border-gray-700" />)}
                </div>
                <button
                  onClick={() => downloadImages(folder.name)}
                  disabled={loadingFolder === folder.name || isBatchLoading}
                  className="mt-2 w-full text-[10px] px-2.5 py-1.5 bg-blue-700/60 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
                >
                  {loadingFolder === folder.name ? 'กำลังค้นหารูป...' : 'ค้นหารูปคนนี้'}
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-100">คิวบทความ / บทความที่สร้างแล้ว ({articleJobs.length})</h3>
              <p className="text-xs text-gray-500">ตรวจพาดหัว บทความ และรูปที่เลือก ก่อนกดสร้างรูปโพสต์</p>
            </div>
            <button
              onClick={renderSelectedFolders}
              disabled={isBatchRendering || (articleJobs.length === 0 && selectedFolderNames.size === 0)}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
            >
              {isBatchRendering ? 'กำลังสร้างรูป...' : `สร้างรูปจากคิว (${articleQueueCount})`}
            </button>
          </div>

          {articleJobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-sm text-gray-500">
              ยังไม่มีบทความ กด “สร้างบทความที่เลือก” แล้วผลลัพธ์จะขึ้นเป็นการ์ดตรงนี้
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {articleJobs.map((job, index) => {
                const folder = folderByName(job.personName);
                const copy = { headline: job.headline, postText: job.postText };
                const pickedImageUrl = job.imageUrl;
                const pickedImageName = job.imageName;
                return (
                  <div key={job.id} className="rounded-xl border border-gray-700/60 bg-black/25 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <h4 className="font-bold text-gray-100">{index + 1}. {job.personName}</h4>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {job.selectedTag && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30">ชุดงาน #{job.selectedTag}</span>}
                          {(folder?.tags || []).slice(0, 4).map(tag => (
                            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-300">#{tag}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            const next = await generateCopy(job.personName);
                            setArticleJobs(prev => prev.map(item => item.id === job.id ? { ...item, headline: next.headline, postText: next.postText } : item));
                          }}
                          disabled={writingName === job.personName}
                          className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg"
                        >
                          {writingName === job.personName ? 'กำลังเขียน...' : 'เขียนใหม่'}
                        </button>
                        <button
                          onClick={() => renderCanvas(job.personName, pickedImageUrl, copy.headline ? copy : fallbackCopy(job.personName), job.selectedTag || selectedContentTag)}
                          disabled={renderingName === job.personName || !pickedImageUrl}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg"
                        >
                          {renderingName === job.personName ? 'กำลังสร้าง...' : 'สร้างรูป'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
                      <div>
                        {pickedImageUrl ? (
                          <div className="relative">
                            <img src={pickedImageUrl} alt={job.personName} className="w-full aspect-square object-cover rounded-lg border border-cyan-500/60" />
                            <span className="absolute left-2 top-2 bg-cyan-500 text-white text-[10px] px-2 py-0.5 rounded">รูปที่เลือก</span>
                            <span className="absolute right-2 bottom-2 bg-black/75 text-gray-100 text-[10px] px-2 py-0.5 rounded">{pickedImageName}</span>
                          </div>
                        ) : (
                          <div className="aspect-square rounded-lg border border-dashed border-gray-700 flex items-center justify-center text-xs text-gray-500">
                            ยังไม่มีรูป
                          </div>
                        )}
                        <div className="mt-2 grid grid-cols-4 gap-1.5">
                          {(folder?.images || []).slice(0, 12).map(image => (
                            <button
                              key={image.url}
                              onClick={() => setArticleJobs(prev => prev.map(item => item.id === job.id ? { ...item, imageUrl: image.url, imageName: image.name } : item))}
                              className={`relative aspect-square rounded overflow-hidden border-2 ${pickedImageUrl === image.url ? 'border-cyan-400' : 'border-gray-700 hover:border-gray-500'}`}
                              title={image.name}
                            >
                              <img src={image.url} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">พาดหัว 3 บรรทัดบนรูป</label>
                          <textarea
                            value={copy.headline}
                            placeholder="ยังไม่ได้สร้างพาดหัว"
                            onChange={e => setArticleJobs(prev => prev.map(item => item.id === job.id ? { ...item, headline: e.target.value } : item))}
                            className="input-field text-sm min-h-[96px] w-full"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">บทความสำหรับโพสต์</label>
                          <textarea
                            value={copy.postText}
                            placeholder="ยังไม่ได้สร้างบทความ"
                            onChange={e => setArticleJobs(prev => prev.map(item => item.id === job.id ? { ...item, postText: e.target.value } : item))}
                            className="input-field text-sm min-h-[220px] w-full"
                          />
                        </div>
                        {folder && folder.outputs.length > 0 && (
                          <div>
                            <div className="text-xs font-bold text-gray-400 mb-2">รูปที่สร้างไว้แล้ว</div>
                            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                              {folder.outputs.slice(0, 8).map(output => (
                                <a key={output.url} href={output.url} target="_blank" rel="noreferrer" className="shrink-0">
                                  <img src={output.url} alt="" className="w-16 h-16 object-cover rounded border border-gray-700" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <canvas ref={previewRef} width={CANVAS_SIZE} height={CANVAS_SIZE} className="hidden" />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-purple-300">📚 ผลลัพท์ที่เก็บไว้ ({savedResults.length})</h2>
            <p className="text-xs text-gray-500 mt-1">รูปและบทความที่สร้างแล้วจะถูกเก็บในโฟลเดอร์หลักนี้ พร้อมอัปโหลด Dropbox ได้ทีละหลายรายการ</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={uploadSelectedResultsToDropbox}
              disabled={isUploadingResults || isDeletingResults || selectedResultIds.size === 0}
              className="px-3 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
            >
              ☁️ อัปโหลดที่เลือก ({selectedResultIds.size})
            </button>
            <button
              onClick={deleteSelectedResults}
              disabled={isDeletingResults || selectedResultIds.size === 0}
              className="px-3 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
            >
              🗑 ลบที่เลือก ({selectedResultIds.size})
            </button>
            <button onClick={exportSelectedCsv} disabled={savedResults.length === 0} className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg">
              💾 บันทึก CSV
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-950/20 p-4">
          <label className="text-xs font-bold text-blue-200 block mb-2">Dropbox Upload Path</label>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={dropboxFolderPath}
              onChange={e => setDropboxFolderPath(e.target.value)}
              className="input-field text-sm flex-1 min-w-[280px]"
              placeholder="/Apps/CelebrityTeachings"
              title="Dropbox folder path"
            />
            <span className="text-[10px] text-gray-400">
              CSV จะอัปโหลดรูปที่ยังไม่มี Dropbox ไปที่ path นี้ก่อน แล้วใส่ลิงก์ในคอลัมน์ dropbox_dl1_url
            </span>
          </div>
        </div>

        {dropboxUploadLog && (
          <div className="mb-3 text-xs text-blue-300 bg-blue-900/20 border border-blue-500/20 rounded-lg px-3 py-2">
            {dropboxUploadLog}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 bg-black/20 border border-gray-700/50 rounded-lg px-3 py-2 mb-4">
          <button onClick={selectAllResults} className="text-xs bg-blue-700/50 hover:bg-blue-700 text-blue-200 px-3 py-1.5 rounded font-bold transition-all">
            ☑ เลือกทั้งหมด
          </button>
          <button onClick={clearSelectedResults} className="text-xs bg-gray-700/50 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded font-bold transition-all">
            ☐ ยกเลิกทั้งหมด
          </button>
          <button
            onClick={deleteSelectedResults}
            disabled={isDeletingResults || selectedResultIds.size === 0}
            className="text-xs bg-red-700/50 hover:bg-red-700 disabled:opacity-50 text-red-100 px-3 py-1.5 rounded font-bold transition-all"
          >
            🗑 ลบทั้งหมดที่เลือก
          </button>
          <span className="text-xs text-gray-400">เลือกอยู่ {selectedResultIds.size}/{savedResults.length} รายการ</span>
        </div>

        {savedResults.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-sm text-gray-500">
            ยังไม่มีผลลัพธ์ กด “สร้างรูปโพสต์” แล้วรายการจะลงมาเก็บไว้ตรงนี้
          </div>
        ) : (
          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1 custom-scrollbar">
            {savedResults.map(result => (
              <div key={result.id} className={`bg-black/30 rounded-xl border p-4 transition-all group ${selectedResultIds.has(result.id) ? 'border-blue-500 bg-blue-900/10' : 'border-gray-700/50 hover:border-purple-500/30'}`}>
                <div className="flex gap-4">
                  <label className="flex-shrink-0 pt-9 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedResultIds.has(result.id)}
                      onChange={() => toggleResultSelection(result.id)}
                      className="w-5 h-5 accent-blue-500"
                    />
                  </label>
                  <div className="flex-shrink-0">
                    <img
                      src={result.localImageUrl || result.imageUrl || result.dropboxUrl}
                      alt=""
                      className="w-24 h-24 object-cover rounded-lg shadow-lg border border-gray-700"
                    />
                    <div className="mt-1 flex gap-1">
                      <button
                        onClick={async () => {
                          try {
                            setDropboxUploadLog(`กำลังอัปโหลด: ${result.personName}`);
                            const url = await uploadSavedResultToDropbox(result);
                            await loadSavedResults();
                            setDropboxUploadLog(`✅ อัปโหลดแล้ว: ${url}`);
                          } catch (e: any) {
                            setDropboxUploadLog(`❌ ${e.message}`);
                          }
                        }}
                        className="bg-blue-700 hover:bg-blue-600 text-white px-1.5 py-1 rounded text-xs"
                        title="อัปโหลด Dropbox"
                      >
                        ☁️
                      </button>
                      <button
                        onClick={() => deleteSavedResult(result.id)}
                        className="bg-red-700/70 hover:bg-red-700 text-white px-1.5 py-1 rounded text-xs"
                        title="ลบรายการ"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-amber-300 truncate">{result.headline || result.personName}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{result.personName} · {new Date(result.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {(result.tags || []).map(tag => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-500/20">#{tag}</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                      {(result.article || '').substring(0, 240)}{(result.article || '').length > 240 ? '...' : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {result.dropboxUrl && (
                        <a href={result.dropboxUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 hover:border-blue-500/50">
                          📦 Dropbox dl=1
                        </a>
                      )}
                      {result.dropboxPath && (
                        <span className="text-[10px] text-gray-500 bg-gray-800/60 px-2 py-0.5 rounded border border-gray-700/50">{result.dropboxPath}</span>
                      )}
                      {(result.localImageUrl || result.imageUrl) && (
                        <a href={result.localImageUrl || result.imageUrl} target="_blank" rel="noreferrer" className="text-[10px] text-cyan-400 hover:underline">
                          เปิดรูป
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
