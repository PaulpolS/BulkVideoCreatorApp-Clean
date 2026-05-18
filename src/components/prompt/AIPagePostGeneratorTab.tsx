import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NumInput } from '../ui/NumInput';
import { globalTaskStore } from '../../hooks/useBackgroundTasks';
import { useHeadlinePacks } from '../../hooks/useHeadlinePacks';
import { useWritingStyles } from '../../hooks/useWritingStyles';
import { useImagePromptStyles } from '../../hooks/useImagePromptStyles';
import { getOpenRouterKeyCandidates, getActiveOpenRouterKeyAsync, getActiveKieKey, getActiveDropboxCreds, checkOpenRouterCredits } from '../../hooks/useApiSettings';

interface AIPageTemplateFolder { name: string; fileCount: number; }
interface GenerationTask {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  log: string[];
  finalImageUrl?: string;
  finalText?: string;
  commentPostText?: string;
  dropboxUrl?: string;
  rawArticle: string;
  writingStyleId: string;
  headlinePackId: string;
  imagePromptStyleId?: string;
  attachImage: boolean;
  referenceImageUrl: string;
  imageRatio: string;
  bulkHeadline?: string;
  bulkPromptJson?: string;
  bulkSourceUrl?: string;
  bulkRawArticle?: string;
  localYoutubeOverlay?: {
    overlayKind?: 'youtube' | 'ai-news' | 'github' | 'editorial' | 'quote';
    channelName?: string;
    channelLogoUrl?: string;
    subscriberText?: string;
    fontPaletteId?: string;
    markedKeywords?: string[];
    newsBadgeStyleId?: string;
  };
  sourceMeta?: Record<string, any>;
  bulkItemId?: string;
}

interface ClickbaitResult {
  caption1: string;
  caption2: string;
  caption3: string;
  comment1: string;
  comment2: string;
  comment3: string;
  imgLink1: string;
  imgLink2: string;
  imgLink3: string;
}

interface BulkArticleItem {
  id: string;
  title?: string;
  rawArticle: string;
  sourceUrl: string;
  images?: string[];
  sourceType?: string;
  domain?: string;
  channelName?: string;
  channelLogoUrl?: string;
  channelAvatar?: string;
  subscriberCount?: number;
  ytExtracted?: boolean;
  contentFormat: 'classic' | 'editorial' | 'quote';
  imageSourceMode: 'auto' | 'attached' | 'github-random' | 'ai';
  isSelected: boolean;
  writingStyleId: string;
  commentStyleId: string;
  headlinePackId: string;
  cardTextModel: string;
  cardImageRatio: string;
  cardImagePromptStyleId: string;
  articleLength: string;
  fontPaletteId: string;
  useAttachedImage: boolean;
  decorateOriginalPhoto: boolean;
  aiNewsBadgeStyleId: string;
  selectedImageUrl: string;
  generatedArticle: string;
  generatedCommentPost: string;
  articleFeedback: string;
  showArticleFeedback: boolean;
  generatedHeadlines: string[];
  selectedHeadline: string;
  markedKeywords: string[];
  finalPromptJson: string;
  smartConfigNote?: string;
  smartSelectedImageIndex?: number;
  smartSelectedImageReason?: string;
  smartImageHasPerson?: boolean;
  smartImageScores?: {
    index: number;
    score: number;
    hasPerson: boolean;
    note: string;
  }[];
  smartHeadlineNote?: string;
  imageErrorMsg?: string;
  imageQueuedCount: number;
  lastImageQueuedAt?: string;
  status: 'idle' | 'generating-article' | 'article-done' | 'generating-image' | 'queued' | 'error';
  errorMsg: string;
  tags?: string[];
}

const VISION_MODEL = "google/gemini-2.5-pro"; // Excellent for OCR and analysis
const TEXT_MODEL = "google/gemini-2.5-flash"; // Fast for text generation
const OPENROUTER_TIMEOUT_MS = 60_000;
const LOCAL_API_TIMEOUT_MS = 30_000;
const IMAGE_FETCH_TIMEOUT_MS = 20_000;
const GH_FOOTAGE_FOLDER_KEY = 'gh_footage_folder';
const BULK_WORKSPACE_KEY = 'aipage_bulk_article_workspace';
const YOUTUBE_IMAGE_STYLE_ID = '__youtube_image_style__';
const AI_NEWS_IMAGE_STYLE_ID = '__ai_news_image_style__';
const GITHUB_IMAGE_STYLE_ID = '__github_image_style__';
const EDITORIAL_IMAGE_STYLE_ID = '__editorial_card_style__';
const QUOTE_IMAGE_STYLE_ID = '__quote_card_style__';
const CONTENT_FORMAT_OPTIONS = [
  { id: 'classic', label: 'Classic AI Page', hint: 'ใช้ prompt style เดิม เหมาะกับงานที่อยากให้ AI สร้างภาพใหม่' },
  { id: 'editorial', label: 'Editorial แบบ Top Gainers', hint: 'พาดหัวใหญ่ ชุดสีแรง แปะบนรูปข่าว/YouTube/คลังภาพ' },
  { id: 'quote', label: 'Quote / คำสอนคนดัง', hint: 'เหมาะกับคำพูดคนดัง บทเรียน สรุปข้อคิด และ portrait quote card' },
] as const;
const IMAGE_SOURCE_MODE_OPTIONS = [
  { id: 'auto', label: 'Auto', hint: 'ให้ Smart Setup เลือกจากประเภท content' },
  { id: 'attached', label: 'รูปจาก Content', hint: 'ใช้รูปข่าวหรือ YouTube screenshot ที่แนบมา' },
  { id: 'github-random', label: 'สุ่มคลังรูป', hint: 'สุ่มจากคลังรูป GitHub/Assets ที่เลือกไว้' },
  { id: 'ai', label: 'AI สร้างใหม่', hint: 'ไม่ใช้รูปต้นฉบับ ให้ Kie.ai สร้างภาพจาก prompt' },
] as const;
type VisualTemplateId = 'top-gainers-classic' | 'editorial-emerald' | 'quote-card';
const VISUAL_TEMPLATE_PRESETS: Array<{
  id: VisualTemplateId;
  label: string;
  desc: string;
  format: BulkArticleItem['contentFormat'];
  imageMode: BulkArticleItem['imageSourceMode'];
  paletteId: string;
  ratio: string;
  promptStyleId: string;
}> = [
  {
    id: 'top-gainers-classic',
    label: 'Top Gainers Classic',
    desc: 'รูปข่าว/YouTube + พาดหัวแถบใหญ่',
    format: 'editorial',
    imageMode: 'attached',
    paletteId: 'tg-classic',
    ratio: '1:1',
    promptStyleId: EDITORIAL_IMAGE_STYLE_ID,
  },
  {
    id: 'editorial-emerald',
    label: 'Editorial Emerald',
    desc: 'สุ่มคลังรูป + สีเขียวทอง',
    format: 'editorial',
    imageMode: 'github-random',
    paletteId: 'tg-emerald-gold',
    ratio: '1:1',
    promptStyleId: EDITORIAL_IMAGE_STYLE_ID,
  },
  {
    id: 'quote-card',
    label: 'Quote Card',
    desc: 'คำสอนคนดัง/ข้อคิด/บทเรียน',
    format: 'quote',
    imageMode: 'attached',
    paletteId: 'tg-graphite-gold',
    ratio: '1:1',
    promptStyleId: QUOTE_IMAGE_STYLE_ID,
  },
];
const ARTICLE_LENGTH_OPTIONS = [
  { id: 'short', label: 'สั้น', hint: 'ประมาณ 500-800 ตัวอักษร', range: '500-800' },
  { id: 'medium', label: 'กลาง', hint: 'ประมาณ 900-1,300 ตัวอักษร', range: '900-1300' },
  { id: 'long', label: 'ยาว', hint: 'ประมาณ 1,500-2,200 ตัวอักษร', range: '1500-2200' },
  { id: 'deep', label: 'ละเอียด', hint: 'ประมาณ 2,500-3,500 ตัวอักษร', range: '2500-3500' },
];
const YOUTUBE_FONT_PALETTES = [
  { id: 'white-yellow-blue', name: 'ขาว เหลือง น้ำเงิน', primary: '#ffffff', accent: '#ffd12a', block: '#0b84ff', altBlock: '#e11d24', stroke: '#000000' },
  { id: 'white-red-yellow', name: 'ขาว แดง เหลือง', primary: '#ffffff', accent: '#ffe23b', block: '#e11d24', altBlock: '#111827', stroke: '#000000' },
  { id: 'cyan-white-navy', name: 'ฟ้า ขาว กรม', primary: '#e0f7ff', accent: '#38f8d4', block: '#0f3b82', altBlock: '#111827', stroke: '#020617' },
  { id: 'black-yellow-white', name: 'ดำ เหลือง ขาว', primary: '#ffffff', accent: '#ffcc00', block: '#111111', altBlock: '#f59e0b', stroke: '#000000' },
  { id: 'lime-white-green', name: 'เขียว ขาว ดำ', primary: '#ffffff', accent: '#a3ff12', block: '#16a34a', altBlock: '#052e16', stroke: '#000000' },
  { id: 'orange-white-black', name: 'ส้ม ขาว ดำ', primary: '#ffffff', accent: '#ff9f1c', block: '#ea580c', altBlock: '#111111', stroke: '#000000' },
  { id: 'pink-white-purple', name: 'ชมพู ขาว ม่วง', primary: '#ffffff', accent: '#ff4fd8', block: '#7c3aed', altBlock: '#db2777', stroke: '#170021' },
  { id: 'gold-white-red', name: 'ทอง ขาว แดง', primary: '#ffffff', accent: '#fbbf24', block: '#b91c1c', altBlock: '#78350f', stroke: '#000000' },
  { id: 'blue-white-cyan', name: 'น้ำเงิน ขาว ไซแอน', primary: '#ffffff', accent: '#67e8f9', block: '#2563eb', altBlock: '#0891b2', stroke: '#020617' },
  { id: 'mono-white-gray', name: 'ขาว เทา มินิมอล', primary: '#ffffff', accent: '#e5e7eb', block: '#374151', altBlock: '#111827', stroke: '#000000' },
  { id: 'tg-classic', name: 'TopGainers Classic', primary: '#ffffff', accent: '#fff200', block: '#e11d1d', altBlock: '#1688f0', stroke: '#020617' },
  { id: 'tg-emerald-gold', name: 'TopGainers Emerald', primary: '#f8fafc', accent: '#facc15', block: '#059669', altBlock: '#0f766e', stroke: '#022c22' },
  { id: 'tg-orange-teal', name: 'TopGainers Orange Teal', primary: '#ffffff', accent: '#fde047', block: '#f97316', altBlock: '#0891b2', stroke: '#111827' },
  { id: 'tg-rose-cyan', name: 'TopGainers Rose Cyan', primary: '#ffffff', accent: '#22d3ee', block: '#e11d48', altBlock: '#0e7490', stroke: '#111827' },
  { id: 'tg-graphite-gold', name: 'TopGainers Graphite', primary: '#f8fafc', accent: '#fbbf24', block: '#374151', altBlock: '#92400e', stroke: '#030712' },
  { id: 'tg-navy-coral', name: 'TopGainers Navy Coral', primary: '#ffffff', accent: '#fb7185', block: '#1d4ed8', altBlock: '#0f172a', stroke: '#020617' },
];
const AI_NEWS_BADGE_STYLES = [
  { id: 'breaking-red', name: 'แดง Breaking', bg: '#dc2626', fg: '#ffffff', accent: '#facc15', border: '#7f1d1d' },
  { id: 'cyber-blue', name: 'น้ำเงิน Cyber', bg: '#0f172a', fg: '#e0f2fe', accent: '#38bdf8', border: '#2563eb' },
  { id: 'neon-purple', name: 'ม่วง Neon', bg: '#581c87', fg: '#ffffff', accent: '#f0abfc', border: '#a855f7' },
  { id: 'glass-dark', name: 'ดำ Glass', bg: 'rgba(0,0,0,0.78)', fg: '#ffffff', accent: '#22c55e', border: '#ffffff' },
];
const GITHUB_BADGE_STYLES = [
  { id: 'dev-pick', name: 'สายแนะนำ', label: 'ของดีจาก GitHub', subLabel: 'DEV PICK', bg: '#0d1117', fg: '#ffffff', accent: '#58a6ff', border: '#30363d' },
  { id: 'ai-radar', name: 'สายข่าวไว', label: 'AI DEV RADAR', subLabel: 'repo น่าจับตา', bg: '#111827', fg: '#f8fafc', accent: '#22d3ee', border: '#0891b2' },
  { id: 'tool-drop', name: 'สายแจกเครื่องมือ', label: 'เครื่องมือ DEV น่าใช้', subLabel: 'ลองแล้วเวิร์ก', bg: '#052e16', fg: '#f0fdf4', accent: '#39d353', border: '#16a34a' },
  { id: 'hidden-gem', name: 'สายขุดของลับ', label: 'REPO ลับน่าขุด', subLabel: 'hidden gem', bg: '#1e1b4b', fg: '#ffffff', accent: '#c084fc', border: '#7c3aed' },
  { id: 'code-alert', name: 'สายเตือนให้เซฟ', label: 'โค้ดดีควรเซฟ', subLabel: 'GitHub alert', bg: '#1f1400', fg: '#ffffff', accent: '#fbbf24', border: '#d97706' },
];

interface AIPagePostGeneratorProps {
  initialBulkItems?: {
    rawArticle: string;
    sourceUrl: string;
    title: string;
    tags?: string[];
    images?: string[];
    sourceType?: string;
    domain?: string;
    channelName?: string;
    channelLogoUrl?: string;
    channelAvatar?: string;
    subscriberCount?: number;
    ytExtracted?: boolean;
  }[];
  onInitialBulkItemsConsumed?: () => void;
}

export function AIPagePostGeneratorTab({ initialBulkItems, onInitialBulkItemsConsumed }: AIPagePostGeneratorProps = {}) {
  const FREE_FALLBACK_MODELS = ['openai/gpt-oss-20b:free', 'google/gemma-3-27b-it:free'];

  // getOpenRouterKeyCandidates is imported from useApiSettings

  const getOpenRouterKey = async () => {
    return await getActiveOpenRouterKeyAsync();
  };
  
  const getKieKey = () => getActiveKieKey();

  const getDropboxCreds = () => {
    const creds = getActiveDropboxCreds();
    return creds;
  };


  // Shared Hooks (Git-syncable)
  const { prompts: imagePromptStyles, setPrompts: setImagePromptStyles, savePrompt: saveImagePromptHook, deletePrompt: deleteImagePromptHook, persist: persistImagePrompts } = useImagePromptStyles();
  const { packs: headlinePacks, savePack: saveHeadlinePackHook, updatePack: updateHeadlinePackHook, deletePack: deleteHeadlinePackHook, persist: persistHeadlinePacks } = useHeadlinePacks();
  const { styles: writingStyles, setStyles: setWritingStyles, saveStyle: saveWritingStyleHook, updateStyle: updateWritingStyleHook, deleteStyle: deleteWritingStyleHook, persist: persistWritingStyles } = useWritingStyles();

  const [newImagePromptName, setNewImagePromptName] = useState('');
  const [selectedImagePromptId, setSelectedImagePromptId] = useState('');

  // Text Model
  const [textModel, setTextModel] = useState(TEXT_MODEL);
  const [creditCheckResults, setCreditCheckResults] = useState<{label: string; keyPreview: string; valid: boolean; balance: string; usage: string; isFreeTier?: boolean; keyApiLabel?: string; error?: string}[]>([]);
  const [isCheckingCredits, setIsCheckingCredits] = useState(false);

  // Raw Material
  const [rawArticle, setRawArticle] = useState('');

  // Folders & Templates
  const [templateFolders, setTemplateFolders] = useState<AIPageTemplateFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [folderImages, setFolderImages] = useState<{name: string; url: string}[]>([]);
  const [isScanningTemplate, setIsScanningTemplate] = useState(false);

  // Writing Styles (local UI state only)
  const [newStyleName, setNewStyleName] = useState('');
  const [newStyleContent, setNewStyleContent] = useState('');
  const [selectedStyleId, setSelectedStyleId] = useState('');
  const [selectedCommentStyleId, setSelectedCommentStyleId] = useState('');

  // Headlines (local UI state only)
  const [newPackName, setNewPackName] = useState('');
  const [scannedHeadlinesText, setScannedHeadlinesText] = useState('');
  const [selectedPackId, setSelectedPackId] = useState('');
  const [generatedHeadlines, setGeneratedHeadlines] = useState<string[]>([]);
  const [selectedGeneratedHeadline, setSelectedGeneratedHeadline] = useState('');

  const [analyzedPromptJSON, setAnalyzedPromptJSON] = useState('');
  const [analyzedBaseStyle, setAnalyzedBaseStyle] = useState('');
  const [analyzedNegativePrompt, setAnalyzedNegativePrompt] = useState('');
  const [analyzedElements, setAnalyzedElements] = useState<{id: string, description: string, checked: boolean}[]>([]);
  const [additionalPromptText, setAdditionalPromptText] = useState('');

  // Image Generation Settings
  const [attachImage, setAttachImage] = useState(false);
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [imageRatio, setImageRatio] = useState('1:1');

  // Logo Settings
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPosition, setLogoPosition] = useState('bottom-right');
  const [logoSize, setLogoSize] = useState(20);
  const [logoMarginX, setLogoMarginX] = useState(20);
  const [logoMarginY, setLogoMarginY] = useState(20);
  const [savedLogos, setSavedLogos] = useState<{ name: string; url: string }[]>([]);
  const [singleModeCollapsed, setSingleModeCollapsed] = useState(false);

  // New Step-by-Step States
  const [generatedArticle, setGeneratedArticle] = useState('');
  const [generatedCommentPost, setGeneratedCommentPost] = useState('');
  const [finalPromptJson, setFinalPromptJson] = useState('');
  
  // Status Logs
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [processLogStep1, setProcessLogStep1] = useState('');
  
  const [articleFeedback, setArticleFeedback] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  
  // Headline Feedback Loop
  const [headlineFeedback, setHeadlineFeedback] = useState('');
  const [isRewritingHeadline, setIsRewritingHeadline] = useState(false);
  
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [processLogStep2, setProcessLogStep2] = useState('');
  
  // File Upload Refs
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const isQueueProcessingRef = useRef(false);
  const tasksRef = useRef<GenerationTask[]>([]);

  // Queue & Processing
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [completedPosts, setCompletedPosts] = useState<any[]>([]);
  
  // Persistent Results (saved to file, Git-syncable)
  const [savedResults, setSavedResults] = useState<any[]>([]);
  const [aipageDataDir, setAipageDataDir] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [dropboxFolderPath, setDropboxFolderPath] = useState(localStorage.getItem('aipage_dropbox_folder') || '/Apps/YTViralPost');
  const [isUploadingResults, setIsUploadingResults] = useState(false);
  const [dropboxUploadLog, setDropboxUploadLog] = useState('');
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
  const [resultsFilter, setResultsFilter] = useState<'all' | 'script_done' | 'no_script' | 'content_done' | 'no_content'>('all');

  // Article Cache — remember generated content per article
  const [articleCache, setArticleCache] = useState<Record<string, any>>({});
  const [exportedCsvRefs, setExportedCsvRefs] = useState<{ urls: string[]; headlines: string[] }>({ urls: [], headlines: [] });
  const articleKey = (raw: string) => raw.trim().replace(/\s+/g, ' ').slice(0, 250);
  const saveArticleCache = async (raw: string, patch: Record<string, any>) => {
    if (!raw?.trim()) return;
    const hash = articleKey(raw);
    const {
      imageUrl: _imageUrl,
      localImageUrl: _localImageUrl,
      dropboxUrl: _dropboxUrl,
      ...safePatch
    } = patch;
    const data = { rawArticle: raw, ...safePatch, cachedAt: patch.cachedAt || new Date().toISOString() };
    setArticleCache(prev => ({ ...prev, [hash]: { ...(prev[hash] || {}), ...data } }));
    await fetch('/api/article-cache', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert', hash, data }),
    });
    // When content is fully generated, mark the stock article as content-ready
    if (patch.generatedArticle && patch.sourceUrl) {
      fetch('/api/article-stock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-content-ready', sourceUrl: patch.sourceUrl }),
      }).catch(() => {});
    }
  };

  // === Bulk Mode ===
  const [bulkItems, setBulkItems] = useState<BulkArticleItem[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProcessLog, setBulkProcessLog] = useState('');
  const [recoverCacheLimit, setRecoverCacheLimit] = useState(100);
  const [isRecoveringCache, setIsRecoveringCache] = useState(false);
  const [isApplyingGithubDefaults, setIsApplyingGithubDefaults] = useState(false);
  const [newsImageLoadingIds, setNewsImageLoadingIds] = useState<Set<string>>(new Set());
  const [isSmartConfigRunning, setIsSmartConfigRunning] = useState(false);
  const [isPickingKeywords, setIsPickingKeywords] = useState(false);
  const [smartConfigLog, setSmartConfigLog] = useState('');
  const [githubStockFolder, setGithubStockFolder] = useState(() => localStorage.getItem(GH_FOOTAGE_FOLDER_KEY) || '');
  const [githubStockFolderName, setGithubStockFolderName] = useState(() => {
    const saved = localStorage.getItem(GH_FOOTAGE_FOLDER_KEY) || '';
    const parts = saved.split('/').filter(Boolean);
    return parts[parts.length - 1] || saved;
  });
  const [githubStockFolderLog, setGithubStockFolderLog] = useState('');
  const [showGlobalApply, setShowGlobalApply] = useState(false);
  const [previewSeed, setPreviewSeed] = useState(0);
  const [selectedVisualTemplateId, setSelectedVisualTemplateId] = useState<VisualTemplateId>('top-gainers-classic');
  const [visualTemplateSettings, setVisualTemplateSettings] = useState({
    imageMode: 'attached' as BulkArticleItem['imageSourceMode'],
    paletteId: 'tg-classic',
    ratio: '1:1',
    decorateOriginalPhoto: true,
  });
  const [bulkMainSettings, setBulkMainSettings] = useState({
    writingStyleId: '',
    commentStyleId: '',
    headlinePackId: '',
    cardTextModel: TEXT_MODEL,
    articleLength: 'medium',
  });
  const [globalApplySettings, setGlobalApplySettings] = useState<{
    writingStyleId?: string;
    commentStyleId?: string;
    headlinePackId?: string;
    cardTextModel?: string;
    articleLength?: string;
    cardImageRatio?: string;
    cardImagePromptStyleId?: string;
    contentFormat?: BulkArticleItem['contentFormat'];
    imageSourceMode?: BulkArticleItem['imageSourceMode'];
  }>({});
  const consumedBulkSignatureRef = useRef('');
  const bulkWorkspaceLoadedRef = useRef(false);

  const inferContentFormat = (sourceType?: string, tags: string[] = []) => {
    const source = String(sourceType || '').toLowerCase();
    const tagText = tags.join(' ').toLowerCase();
    if (source.includes('celebrity') || source.includes('quote') || tagText.includes('คำสอน') || tagText.includes('quote')) return 'quote' as const;
    if (['youtube', 'rss', 'news', 'github', 'topgainers', 'lazada'].some(key => source.includes(key))) return 'editorial' as const;
    return 'classic' as const;
  };

  const inferImageSourceMode = (sourceType?: string, images: string[] = []) => {
    const source = String(sourceType || '').toLowerCase();
    if (source.includes('github')) return 'github-random' as const;
    if (images.length > 0) return 'attached' as const;
    return 'auto' as const;
  };

  const makeDefaultBulkItem = (overrides: Partial<BulkArticleItem> = {}): BulkArticleItem => ({
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    title: '',
    rawArticle: '',
    sourceUrl: '',
    images: [],
    sourceType: '',
    domain: '',
    channelName: '',
    channelLogoUrl: '',
    channelAvatar: '',
    subscriberCount: undefined,
    ytExtracted: false,
    contentFormat: 'classic',
    imageSourceMode: 'auto',
    isSelected: false,
    writingStyleId: writingStyles.find(s => s.name.trim() === 'AI Trendtech')?.id || '',
    commentStyleId: writingStyles.find(s => s.name.trim() === 'โพสเพจAI')?.id || '',
    headlinePackId: '',
    cardTextModel: TEXT_MODEL,
    cardImageRatio: '1:1',
    cardImagePromptStyleId: '',
    articleLength: 'medium',
    fontPaletteId: 'cyan-white-navy',
    useAttachedImage: false,
    decorateOriginalPhoto: false,
    aiNewsBadgeStyleId: 'breaking-red',
    selectedImageUrl: '',
    generatedArticle: '',
    generatedCommentPost: '',
    articleFeedback: '',
    showArticleFeedback: false,
    generatedHeadlines: [],
    selectedHeadline: '',
    markedKeywords: [],
    finalPromptJson: '',
    smartConfigNote: '',
    smartSelectedImageIndex: undefined,
    smartSelectedImageReason: '',
    smartImageHasPerson: undefined,
    smartImageScores: [],
    smartHeadlineNote: '',
    imageErrorMsg: '',
    imageQueuedCount: 0,
    lastImageQueuedAt: '',
    status: 'idle',
    errorMsg: '',
    tags: [],
    ...overrides,
  });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(BULK_WORKSPACE_KEY) || '[]');
      if (!initialBulkItems?.length && Array.isArray(saved) && saved.length > 0) {
        setBulkItems(saved.map(item => makeDefaultBulkItem(item)));
      }
    } catch {}
    bulkWorkspaceLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!bulkWorkspaceLoadedRef.current) return;
    localStorage.setItem(BULK_WORKSPACE_KEY, JSON.stringify(bulkItems.slice(0, 1000)));
  }, [bulkItems]);

  useEffect(() => {
    if (initialBulkItems && initialBulkItems.length > 0) {
      const signature = initialBulkItems.map(item => `${item.sourceUrl}|${item.title}|${item.rawArticle.length}`).join('::');
      if (consumedBulkSignatureRef.current === signature) return;
      consumedBulkSignatureRef.current = signature;
      const newItems: BulkArticleItem[] = initialBulkItems.map(item => makeDefaultBulkItem({
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        title: item.title,
        rawArticle: item.rawArticle,
        sourceUrl: item.sourceUrl,
        images: item.images || [],
        sourceType: item.sourceType,
        domain: item.domain,
        channelName: item.channelName,
        channelLogoUrl: item.channelLogoUrl,
        channelAvatar: item.channelAvatar,
        subscriberCount: item.subscriberCount,
        ytExtracted: item.ytExtracted,
        contentFormat: inferContentFormat(item.sourceType, item.tags || []),
        imageSourceMode: inferImageSourceMode(item.sourceType, item.images || []),
        cardImagePromptStyleId: inferContentFormat(item.sourceType, item.tags || []) === 'quote'
          ? QUOTE_IMAGE_STYLE_ID
          : inferContentFormat(item.sourceType, item.tags || []) === 'editorial'
          ? EDITORIAL_IMAGE_STYLE_ID
          : '',
        fontPaletteId: inferContentFormat(item.sourceType, item.tags || []) === 'quote' ? 'tg-graphite-gold' : 'tg-classic',
        isSelected: true,
        useAttachedImage: (item.images || []).length > 0,
        decorateOriginalPhoto: (item.images || []).length > 0 && inferContentFormat(item.sourceType, item.tags || []) !== 'classic',
        selectedImageUrl: (item.images || [])[0] || '',
        smartSelectedImageIndex: (item.images || []).length > 0 ? 0 : undefined,
        smartSelectedImageReason: (item.images || []).length > 0 ? 'ค่าเริ่มต้นจากรูปแรก ยังไม่ได้วิเคราะห์ Smart Setup' : '',
        smartConfigNote: (item.images || []).length > 0 ? 'นำเข้าพร้อมรูปแนบ ระบบตั้งรูปแรกไว้ก่อน กด Smart Setup เพื่อให้ AI เลือกรูปคนที่ชัดที่สุด' : '',
        tags: item.tags || [],
      }));
      setBulkItems(prev => {
        const existingKeys = new Set(prev.map(item => item.sourceUrl || `${item.title}|${item.rawArticle.slice(0, 80)}`));
        const uniqueNewItems = newItems.filter(item => !existingKeys.has(item.sourceUrl || `${item.title}|${item.rawArticle.slice(0, 80)}`));
        return [...prev, ...uniqueNewItems];
      });
      onInitialBulkItemsConsumed?.();
    }
  }, [initialBulkItems, onInitialBulkItemsConsumed]);

  const loadSavedLogos = async () => {
    try {
      const res = await fetch('/api/list-logos');
      const data = await res.json();
      setSavedLogos(Array.isArray(data) ? data : []);
    } catch {}
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch('/api/save-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, base64 }),
        });
        const data = await res.json();
        if (data.success) {
          setLogoUrl(data.url);
          loadSavedLogos();
        } else {
          setLogoUrl(base64);
        }
      } catch {
        setLogoUrl(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    // Load logo settings — prefer app_data, fall back to localStorage for migration
    fetch('/api/get-app-data?key=logo_settings')
      .then(r => r.json())
      .then((d: any) => {
        if (d && d.logoUrl) {
          setLogoUrl(d.logoUrl);
          if (d.logoPosition) setLogoPosition(d.logoPosition);
          if (d.logoSize) setLogoSize(d.logoSize);
          if (d.logoMarginX !== undefined) setLogoMarginX(d.logoMarginX);
          if (d.logoMarginY !== undefined) setLogoMarginY(d.logoMarginY);
        } else {
          // Migration from localStorage
          const savedLogo = localStorage.getItem('aipage_logo_url');
          if (savedLogo) setLogoUrl(savedLogo);
          const savedLogoPos = localStorage.getItem('aipage_logo_position');
          if (savedLogoPos) setLogoPosition(savedLogoPos);
          const savedLogoSize = localStorage.getItem('aipage_logo_size');
          if (savedLogoSize) setLogoSize(Number(savedLogoSize));
          const savedLogoMarginX = localStorage.getItem('aipage_logo_marginX');
          if (savedLogoMarginX) setLogoMarginX(Number(savedLogoMarginX));
          const savedLogoMarginY = localStorage.getItem('aipage_logo_marginY');
          if (savedLogoMarginY) setLogoMarginY(Number(savedLogoMarginY));
        }
      })
      .catch(() => {});

    loadSavedLogos();
    loadFolders();
    loadSavedResults();
    loadExportedCsvRefs();
    fetch('/api/aipage-storage-config').then(r => r.json()).then(d => { if (d.dir) setAipageDataDir(d.dir); }).catch(() => {});
    // Load article cache
    fetch('/api/article-cache').then(r => r.json()).then(data => {
      if (data && typeof data === 'object') setArticleCache(data);
    }).catch(() => {});
  }, []);


  const saveImagePromptStyle = () => {
    if (!newImagePromptName.trim() || !analyzedPromptJSON.trim()) return alert('กรุณาตั้งชื่อและวิเคราะห์ Prompt รูปก่อน');
    
    // Build the final core_prompt based on checked elements
    let corePrompt = analyzedBaseStyle;
    const selectedLayouts = analyzedElements.filter(e => e.checked).map(e => e.description);
    if (selectedLayouts.length > 0) {
       corePrompt += " Layout details: " + selectedLayouts.join(". ");
    }
    if (additionalPromptText.trim()) {
       corePrompt += " Additional details: " + additionalPromptText.trim();
    }
    
    const finalPromptObj = {
      core_prompt: corePrompt,
      negative_prompt: analyzedNegativePrompt
    };

    saveImagePromptHook({ name: newImagePromptName, content: JSON.stringify(finalPromptObj, null, 2) });
    setNewImagePromptName('');
    setAdditionalPromptText('');
    alert('บันทึก Image Prompt Style สำเร็จ');
  };

  const loadFolders = async () => {
    try {
      const res = await fetch('/api/aipage-folders');
      const data = await res.json();
      if (data.success) setTemplateFolders(data.folders);
    } catch (e) { console.error(e); }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return alert('กรุณาตั้งชื่อ Folder');
    try {
      const res = await fetch('/api/aipage-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setNewFolderName('');
    
    const savedPrompts = localStorage.getItem('aipage_image_prompts');
    if (savedPrompts) setImagePromptStyles(JSON.parse(savedPrompts));

    loadFolders();
        setSelectedFolder(data.name);
      } else alert('Error: ' + data.error);
    } catch (e) { console.error(e); }
  };

  const handleOpenFolder = async () => {
    if (!selectedFolder) return alert('กรุณาเลือก Folder');
    try {
      await fetch('/api/aipage-open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: selectedFolder })
      });
    } catch (e) { console.error(e); }
  };

  const handleScanFolder = async () => {
    if (!selectedFolder) return alert('กรุณาเลือก Folder');
    try {
      const res = await fetch(`/api/aipage-files?folder=${encodeURIComponent(selectedFolder)}`);
      const data = await res.json();
      if (data.success) {
        setFolderImages(data.files);
        if (data.files.length === 0) alert('ไม่พบรูปภาพใน Folder นี้');
      }
    } catch (e) { console.error(e); }
  };

  const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = OPENROUTER_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new Error(`Request timeout after ${Math.round(timeoutMs / 1000)}s`);
      throw e;
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const normalizeGithubStockKey = (value: string) =>
    String(value || '').toLowerCase().replace(/[^a-z0-9ก-๙]+/g, '');

  const getGithubTopicLabel = (item: BulkArticleItem) => {
    const tags = item.tags || [];
    const topicTag = tags.find(tag => {
      const key = normalizeGithubStockKey(tag);
      return key !== 'github' && !key.includes('top30') && !key.includes('ไม่ต้องใส่keyword');
    });
    if (topicTag) return topicTag;

    const raw = `${item.title || ''} ${item.sourceUrl || ''} ${item.rawArticle || ''}`.toLowerCase();
    if (/claude[-_\s]?code|everything[-_\s]?claude[-_\s]?code/.test(raw)) return 'Claude Code';
    if (/mcp|model context protocol/.test(raw)) return 'MCP Server';
    if (/langchain|langgraph/.test(raw)) return 'LangChain / LangGraph';
    if (/ollama|local llm|local[-_\s]?llm/.test(raw)) return 'Local LLM (รันในเครื่อง)';
    if (/stable diffusion|image generation/.test(raw)) return 'AI Image Generation';
    if (/voice|tts|text to speech/.test(raw)) return 'Voice AI / Voice Cloning';
    if (/rag|retrieval/.test(raw)) return 'RAG (Retrieval Augmented)';
    if (/openai|gpt/.test(raw)) return 'OpenAI / GPT Tools';
    return 'GitHub';
  };

  const resolveGithubStockFolder = async (rootFolder: string, topicLabel: string) => {
    if (!rootFolder) return '';
    const wanted = normalizeGithubStockKey(topicLabel);
    if (!wanted || wanted === 'github') return rootFolder;

    try {
      const res = await fetchWithTimeout('/api/list-footage-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentFolder: rootFolder }),
      }, LOCAL_API_TIMEOUT_MS);
      const data = await res.json();
      const folders = Array.isArray(data.folders) ? data.folders : [];
      const exact = folders.find((f: any) => normalizeGithubStockKey(f.name) === wanted);
      if (exact?.path) return exact.path;
      const partial = folders.find((f: any) => {
        const key = normalizeGithubStockKey(f.name);
        return key.includes(wanted) || wanted.includes(key);
      });
      if (partial?.path) return partial.path;
    } catch {}

    return rootFolder;
  };

  const pickRandomGithubStockImage = async (item: BulkArticleItem) => {
    const rootFolder = githubStockFolder || localStorage.getItem(GH_FOOTAGE_FOLDER_KEY) || '';
    if (!rootFolder) {
      return { imageUrl: '', dataUrl: '', topicLabel: getGithubTopicLabel(item), folder: '', fileName: '', error: 'ยังไม่ได้เลือก Folder คลังรูป GitHub' };
    }
    const topicLabel = getGithubTopicLabel(item);
    const folder = await resolveGithubStockFolder(rootFolder, topicLabel);
    try {
      const res = await fetchWithTimeout('/api/random-stock-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      }, LOCAL_API_TIMEOUT_MS);
      const data = await res.json();
      if (data.success && data.dataUrl) {
        return { imageUrl: String(data.fileUrl || data.dataUrl || ''), dataUrl: data.dataUrl as string, topicLabel, folder, fileName: String(data.fileName || ''), error: '' };
      }
      return { imageUrl: '', dataUrl: '', topicLabel, folder, fileName: '', error: data.error || 'ไม่พบรูปในโฟลเดอร์หัวข้อนี้' };
    } catch (e: any) {
      return { imageUrl: '', dataUrl: '', topicLabel, folder, fileName: '', error: e?.message || 'สุ่มรูป GitHub ไม่สำเร็จ' };
    }
  };

  const urlToBase64 = async (url: string): Promise<string> => {
    const response = await fetchWithTimeout(url, {}, IMAGE_FETCH_TIMEOUT_MS);
    if (!response.ok) throw new Error(`โหลดรูปไม่สำเร็จ (${response.status})`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result); // Contains data:image/...;base64,
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const imageUrlToVisionDataUrl = async (url: string): Promise<string> => {
    if (!url) return '';
    let base64 = url;
    if (!url.startsWith('data:image')) {
      if (url.startsWith('http')) {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        base64 = await urlToBase64(proxyUrl).catch(() => urlToBase64(url));
      } else {
        base64 = await urlToBase64(url);
      }
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const maxDim = 512;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = () => resolve(base64);
      img.src = base64;
    });
  };

  const extractJsonObject = (text: string) => {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
    return cleaned;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setUrlCallback: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setUrlCallback(base64);
    };
    reader.readAsDataURL(file);
  };

  const callOpenRouter = async (messages: any[], model: string = textModel) => {
    const candidates = await getOpenRouterKeyCandidates();
    if (candidates.length === 0) throw new Error('กรุณาตั้งค่า OpenRouter API Key ในหน้าตั้งค่าระบบ');
    const validCandidates = candidates.filter(candidate => /^sk-or-/i.test(String(candidate.key || '').trim()));
    if (validCandidates.length === 0) throw new Error('ไม่พบ OpenRouter API Key ที่ถูกต้องในโปรไฟล์ กรุณาเปิด Global Settings แล้วใส่ key ที่ขึ้นต้นด้วย sk-or-');

    // ── ขั้นตอน: ลอง key แรก + model ที่ผู้ใช้เลือก ก่อนเสมอ ──
    // ถ้าเจอ error ชั่วคราว (Provider returned error, rate limit, timeout) → retry โมเดลเดิม 3 รอบ
    // ถ้าเจอ error เรื่องเครดิต (insufficient credits) → ค่อยสลับ key
    // fallback ไป model ฟรี เฉพาะเมื่อทุก key + model เดิม ไม่ผ่านจริงๆ เท่านั้น

    const MAX_RETRIES = 3;
    let lastError = '';

    // ── Phase 1: ลอง key ทั้งหมดกับ MODEL ที่ผู้ใช้เลือก (retry transient errors) ──
    for (const candidate of validCandidates) {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${candidate.key}`,
              'HTTP-Referer': window.location.origin,
              'X-Title': 'Bulk Video Creator - AI Page Post',
            },
            body: JSON.stringify({ model, messages })
          }, OPENROUTER_TIMEOUT_MS);
          const data = await res.json();
          if (res.ok && !data.error) {
            return data.choices[0].message.content;
          }

          const message = data.error?.message || `OpenRouter error ${res.status}`;
          lastError = `${candidate.label}: ${message}`;

          if (/missing authentication|unauthorized|invalid api key|invalid credentials/i.test(message) || res.status === 401) {
            console.warn(`[AIPage] ${candidate.label} key ใช้ไม่ได้หรือไม่ได้ถูกส่ง → ลอง key ถัดไป`);
            break;
          }

          // เครดิตหมดจริง → ข้าม key นี้ไปเลย ไม่ต้อง retry
          if (/insufficient credits|more credits|can only afford/i.test(message)) {
            console.warn(`[AIPage] ${candidate.label} เครดิตหมด → ลอง key ถัดไป`);
            break;
          }

          // error ชั่วคราว → รอ 1-2 วิ แล้วลองซ้ำกับ model เดิม
          if (/Provider returned error|Provider routing failed|rate limit|timeout/i.test(message)) {
            if (attempt < MAX_RETRIES) {
              const delay = attempt * 1500; // 1.5s, 3s
              console.warn(`[AIPage] ${candidate.label} + ${model} (Error: ${message}) → รอ ${delay}ms แล้วลองซ้ำ (รอบ ${attempt}/${MAX_RETRIES})...`);
              await new Promise(r => setTimeout(r, delay));
              continue; // retry same model
            }
            console.warn(`[AIPage] ${candidate.label} + ${model} ลอง ${MAX_RETRIES} รอบแล้วยังไม่ผ่าน → ลอง key ถัดไป`);
            break;
          }

          // model ไม่ถูกต้อง → ข้ามออกเลย
          if (/not a valid model/i.test(message)) {
            console.warn(`[AIPage] Model ${model} ไม่มีแล้ว`);
            break;
          }

          throw new Error(lastError);
        } catch (fetchErr: any) {
          if (fetchErr.message === lastError) throw fetchErr;
          lastError = `${candidate.label}: ${fetchErr.message || 'Network error'}`;
          break;
        }
      }
    }

    // ── Phase 2 (Last resort): ทุก key ลองกับ model เดิมแล้วไม่ผ่าน → ลอง fallback model ฟรี ──
    const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url'));
    const fallbacks = hasImage
      ? ['google/gemini-2.5-flash:free']
      : ['google/gemma-3-27b-it:free'];

    for (const candidate of validCandidates) {
      for (const fallbackModel of fallbacks) {
        if (fallbackModel === model) continue;
        try {
          console.warn(`[AIPage] ⚠️ Last resort: ${candidate.label} + ${fallbackModel}`);
          const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${candidate.key}`,
              'HTTP-Referer': window.location.origin,
              'X-Title': 'Bulk Video Creator - AI Page Post',
            },
            body: JSON.stringify({ model: fallbackModel, messages })
          }, OPENROUTER_TIMEOUT_MS);
          const data = await res.json();
          if (res.ok && !data.error) {
            return data.choices[0].message.content;
          }
        } catch {}
      }
    }

    if (/missing authentication|unauthorized|invalid api key|invalid credentials/i.test(lastError)) {
      throw new Error('OpenRouter API Key ในโปรไฟล์ใช้ไม่ได้หรือว่างอยู่ กรุณาเปิด Global Settings แล้วบันทึก key ใหม่');
    }

    throw new Error(lastError ? `ลอง OpenRouter key แล้ว ${validCandidates.length} ตัว แต่ยังไม่ผ่าน: ${lastError}` : 'OpenRouter API Error');
  };

  const handleAnalyzePrompt = async () => {
    const apiKey = await getOpenRouterKey();
    if (!apiKey) return alert('กรุณาตั้งค่า OpenRouter API Key ในเมนูตั้งค่า');
    if (folderImages.length === 0) return alert('กรุณา Scan รูปภาพก่อน');
    setIsScanningTemplate(true);
    
    try {
      const contentParts: any[] = [
         {
            type: "text",
            text: `Analyze these images which are typical social media page posts.
Extract the core image generation prompt needed to recreate the MAIN art style, background elements, aesthetic feel, AND TEXT LAYOUT.
Instead of providing one big prompt, separate it into a "base_style" and "layout_elements".
"base_style" should contain the core aesthetic, lighting, and background description.
"layout_elements" should be an array of specific structural elements (e.g. "A channel logo at the top right corner", "A black box with a profile picture on the right side", "The main text overlay in the bottom half").
"negative_prompt" should be standard negative prompts like "watermarks, bad anatomy, bad spelling".
IMPORTANT: Provide ALL descriptions in Thai language (ภาษาไทย) so the user can understand them easily. But make sure the description is good enough to be translated back to english by another AI later.
Return the result as a raw JSON string like this (no markdown blocks):
{
  "base_style": "คำอธิบายสไตล์ศิลปะ แสง และพื้นหลังอย่างละเอียด...",
  "layout_elements": [
    "โลโก้ช่องที่มุมขวาบน",
    "กล่องสี่เหลี่ยมสีดำกรอบขาวพร้อมรูปโปรไฟล์วงกลมด้านขวา",
    "ตัวหนังสือพาดหัวหลักอยู่ครึ่งล่างของภาพ ใช้ฟอนต์ทันสมัย"
  ],
  "negative_prompt": "ลายน้ำ, อวัยวะบิดเบี้ยว, สะกดผิด"
}`
         }
      ];

      for (const img of folderImages.slice(0, 3)) { // Limit to 3 to save context window and speed
         const base64 = await urlToBase64(img.url);
         contentParts.push({
            type: "image_url",
            image_url: { url: base64 }
         });
      }

      const text = await callOpenRouter([{ role: "user", content: contentParts }], VISION_MODEL);
      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      setAnalyzedPromptJSON(cleanedText);
      try {
        const parsed = JSON.parse(cleanedText);
        setAnalyzedBaseStyle(parsed.base_style || '');
        setAnalyzedNegativePrompt(parsed.negative_prompt || '');
        if (parsed.layout_elements && Array.isArray(parsed.layout_elements)) {
           setAnalyzedElements(parsed.layout_elements.map((el: string, idx: number) => ({
             id: `el_${Date.now()}_${idx}`,
             description: el,
             checked: true
           })));
        } else {
           setAnalyzedElements([]);
        }
      } catch(e) {
        console.warn('Could not parse analyzed JSON for elements checklist', e);
        setAnalyzedElements([]);
      }
      alert('วิเคราะห์ Prompt เรียบร้อย');
    } catch (e: any) {
      alert('Error analyzing prompt: ' + e.message);
    } finally {
      setIsScanningTemplate(false);
    }
  };

  const handleAnalyzeOCR = async () => {
    const apiKey = await getOpenRouterKey();
    if (!apiKey) return alert('กรุณาตั้งค่า OpenRouter API Key');
    if (folderImages.length === 0) return alert('กรุณา Scan รูปภาพก่อน');
    setIsScanningTemplate(true);
    
    try {
      const extractedHeadlines: string[] = [];

      for (let i = 0; i < Math.min(folderImages.length, 5); i++) {
         const base64 = await urlToBase64(folderImages[i].url);
         const contentParts = [
            { type: "text", text: "Extract all the text from this image. Only return the main big headline or catchy caption. Do not return small credits or UI elements. Just the raw text." },
            { type: "image_url", image_url: { url: base64 } }
         ];
         const text = await callOpenRouter([{ role: "user", content: contentParts }], VISION_MODEL);
         if (text && text.trim()) extractedHeadlines.push(text.trim());
      }

      setScannedHeadlinesText(extractedHeadlines.join('\n'));
      alert('แกะ Headline สำเร็จ');
    } catch (e: any) {
      alert('Error OCR: ' + e.message);
    } finally {
      setIsScanningTemplate(false);
    }
  };

  const saveWritingStyle = () => {
    if (!newStyleName.trim() || !newStyleContent.trim()) return alert('กรุณากรอกข้อมูลให้ครบ');
    saveWritingStyleHook({ name: newStyleName, content: newStyleContent });
    setNewStyleName('');
    setNewStyleContent('');
  };

  const deleteWritingStyle = (id: string) => {
    deleteWritingStyleHook(id);
  };

  const saveHeadlinePack = () => {
    if (!newPackName.trim() || !scannedHeadlinesText.trim()) return alert('กรุณาตั้งชื่อและ Scan Headline ก่อน');
    saveHeadlinePackHook({ name: newPackName, headlines: scannedHeadlinesText.split('\n').filter(l => l.trim()) });
    setNewPackName('');
    setScannedHeadlinesText('');
  };

  const handleGenerateHeadlineFromPack = async () => {
    const pack = headlinePacks.find(p => p.id === selectedPackId);
    if (!pack) return alert('กรุณาเลือก Headline Pack ที่บันทึกไว้');
    if (!rawArticle.trim()) return alert('⚠️ กรุณาใส่ "บทความดิบ" ก่อน เพื่อให้ AI รู้ว่าพาดหัวควรเกี่ยวกับเรื่องอะไร');
    
    try {
      const prompt = `
You are an expert social media copywriter.
Please read this article content:
"""
${rawArticle}
"""

Based on the article above, generate 5 new, catchy, and viral headlines.
The headlines MUST strictly match the tone, energy, and format of these examples:
${pack.headlines.map(h => `- ${h}`).join('\n')}

Return each headline on a new line. No numbering, no extra text.`;
      
      const text = await callOpenRouter([{ role: "user", content: prompt }], textModel);
      setGeneratedHeadlines(text.split('\n').filter((l: string) => l.trim()));
      alert('สร้าง Headline สำเร็จ กรุณาเลือกในกล่อง');
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleSaveLogoSettings = () => {
    const settings = { logoUrl, logoPosition, logoSize, logoMarginX, logoMarginY };
    fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'logo_settings', data: settings }),
    }).catch(() => {});
    // also keep localStorage as fallback
    localStorage.setItem('aipage_logo_url', logoUrl);
    localStorage.setItem('aipage_logo_position', logoPosition);
    localStorage.setItem('aipage_logo_size', logoSize.toString());
    localStorage.setItem('aipage_logo_marginX', logoMarginX.toString());
    localStorage.setItem('aipage_logo_marginY', logoMarginY.toString());
    alert('บันทึกการตั้งค่า Logo สำเร็จ');
  };

  const handleGenerateArticleAndHeadlines = async () => {
    if (!rawArticle.trim()) return alert('⚠️ กรุณาใส่ "บทความดิบ" ก่อน');
    if (!selectedStyleId) return alert('⚠️ กรุณาเลือกสไตล์เขียนโพสที่แนบรูป');
    if (!selectedCommentStyleId) return alert('⚠️ กรุณาเลือกสไตล์เขียนมีใต้คอมเม้น');
    if (!selectedPackId) return alert('⚠️ กรุณาเลือกสไตล์พาดหัวอ้างอิง');
    
    const style = writingStyles.find(s => s.id === selectedStyleId);
    const commentStyle = writingStyles.find(s => s.id === selectedCommentStyleId);
    const pack = headlinePacks.find(p => p.id === selectedPackId);
    if (!style || !commentStyle || !pack) return alert('ไม่พบสไตล์ที่เลือก');

    setProcessLogStep1('เริ่มกระบวนการ...');
    setIsGeneratingArticle(true);
    
    try {
      // Generate Article
      setProcessLogStep1('กำลังเขียนบทความ...');
      const articlePrompt = `
You are a professional social media content writer.
Write an engaging page post based on this raw article:
"${rawArticle}"

Use the following writing style template for tone and formatting:
"${style.content}"`;

      const commentPostPrompt = buildCommentPostPrompt(rawArticle, commentStyle.content, sourceUrl);

      // Generate Headlines
      setProcessLogStep1('กำลังคิดพาดหัว...');
      const headlinePrompt = `
You are an expert social media copywriter.
Please read this article content:
"""
${rawArticle}
"""

Based on the article above, generate 5 new, catchy, and viral headlines.
The headlines MUST strictly match the tone, energy, and format of these examples:
${pack.headlines.map(h => `- ${h}`).join('\n')}

Return each headline on a new line. No numbering, no extra text.`;
      
      setProcessLogStep1('กำลังส่งคำสั่งไปที่ OpenRouter AI...');
      const [articleText, commentPostText, headlineText] = await Promise.all([
        callOpenRouter([{ role: "user", content: articlePrompt }], textModel),
        callOpenRouter([{ role: "user", content: commentPostPrompt }], textModel),
        callOpenRouter([{ role: "user", content: headlinePrompt }], textModel)
      ]);

      setGeneratedArticle(articleText);
      setGeneratedCommentPost(commentPostText);
      setGeneratedHeadlines(headlineText.split('\n').filter((l: string) => l.trim()));
      setProcessLogStep1('✅ สร้างบทความและพาดหัวสำเร็จ!');
      setTimeout(() => setProcessLogStep1(''), 3000);
    } catch (e: any) {
      setProcessLogStep1('❌ Error: ' + e.message);
      alert('Error: ' + e.message);
    } finally {
      setIsGeneratingArticle(false);
    }
  };

  const handleRewriteArticleWithFeedback = async (saveAsNewStyle: boolean) => {
    if (!generatedArticle.trim() || !articleFeedback.trim()) return alert('⚠️ กรุณาพิมพ์คำแนะนำก่อน');
    const style = writingStyles.find(s => s.id === selectedStyleId);
    if (!style) return alert('ไม่พบสไตล์ที่เลือกอยู่');

    setIsRewriting(true);
    try {
      const prompt = `
You are a professional social media content writer.
I have this article that you previously generated:
"""
${generatedArticle}
"""

The user has given the following feedback/instructions to improve it:
"${articleFeedback}"

Task 1: Rewrite the article applying the user's feedback.
Task 2: Extract a concise writing rule or guideline from the user's feedback that can be used for future articles.

Return the result as a raw JSON string like this (no markdown blocks):
{
  "rewritten_article": "The new improved article text...",
  "extracted_rule": "The new rule extracted from feedback (e.g. 'Use fewer emojis and sound more professional')"
}`;

      const text = await callOpenRouter([{ role: "user", content: prompt }], textModel);
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.rewritten_article) setGeneratedArticle(parsed.rewritten_article);
      
      const extractedRule = parsed.extracted_rule || articleFeedback;
      
      if (saveAsNewStyle) {
         const newStyleName = prompt('ตั้งชื่อสไตล์การเขียนใหม่นี้:', 'สไตล์ใหม่จากคำแนะนำ');
         if (newStyleName) {
            const newContent = `${style.content}\n\n*Additional Rule*: ${extractedRule}`;
            saveWritingStyleHook({ name: newStyleName, content: newContent });
            alert('บันทึกเป็นสไตล์ใหม่สำเร็จ!');
         }
      } else {
         // Update existing style
         const updatedContent = `${style.content}\n\n*Updated Rule*: ${extractedRule}`;
         updateWritingStyleHook(style.id, { content: updatedContent });
         alert('อัปเดตสไตล์ปัจจุบันสำเร็จ!');
      }

      setArticleFeedback('');

    } catch (e: any) {
      alert('Error rewriting article: ' + e.message);
    } finally {
      setIsRewriting(false);
    }
  };

  const handleRewriteHeadlineWithFeedback = async (saveAsNewPack: boolean) => {
    if (!generatedHeadlines.length || !headlineFeedback.trim()) return alert('⚠️ กรุณาพิมพ์คำแนะนำก่อน');
    const pack = headlinePacks.find(p => p.id === selectedPackId);
    if (!pack) return alert('ไม่พบสไตล์พาดหัวที่เลือกอยู่');

    setIsRewritingHeadline(true);
    try {
      const prompt = `
You are an expert social media copywriter.
I previously asked you to generate headlines based on this article:
"""
${rawArticle}
"""

You generated these headlines:
${generatedHeadlines.map(h => `- ${h}`).join('\n')}

The user gave the following feedback/instructions to improve the headlines:
"${headlineFeedback}"

Task: Generate 5 NEW headlines applying the user's feedback.
Return each headline on a new line. No numbering, no extra text.`;

      const text = await callOpenRouter([{ role: "user", content: prompt }], textModel);
      const newHeadlines = text.split('\n').filter((l: string) => l.trim());
      
      setGeneratedHeadlines(newHeadlines);
      setSelectedGeneratedHeadline(''); // Reset selection
      
      if (saveAsNewPack) {
         const newPackName = prompt('ตั้งชื่อสไตล์พาดหัวใหม่นี้:', 'พาดหัวสไตล์ใหม่จากคำแนะนำ');
         if (newPackName) {
            saveHeadlinePackHook({ name: newPackName, headlines: newHeadlines });
            alert('บันทึกเป็นสไตล์พาดหัวใหม่สำเร็จ!');
         }
      } else {
         // Update existing pack
         updateHeadlinePackHook(pack.id, { headlines: newHeadlines });
         alert('อัปเดตสไตล์พาดหัวปัจจุบันสำเร็จ!');
      }

      setHeadlineFeedback('');

    } catch (e: any) {
      alert('Error rewriting headlines: ' + e.message);
    } finally {
      setIsRewritingHeadline(false);
    }
  };

  const handleGeneratePromptJson = async () => {
    if (!selectedGeneratedHeadline) return alert('⚠️ กรุณาเลือกพาดหัวที่ชอบก่อน');
    if (!selectedImagePromptId && !analyzedPromptJSON) return alert('⚠️ กรุณาเลือกสไตล์ภาพประกอบ (Image Prompt)');

    let basePromptJson = analyzedPromptJSON;
    if (selectedImagePromptId) {
       const saved = imagePromptStyles.find(p => p.id === selectedImagePromptId);
       if (saved) basePromptJson = saved.content;
    }

    if (!basePromptJson) return alert('ไม่พบข้อมูล Prompt JSON อ้างอิง');

    setIsGeneratingPrompt(true);
    setProcessLogStep2('เริ่มสังเคราะห์ Prompt JSON...');

    try {
       const prompt = `
You are an expert AI image prompt engineer.
I have a base image generation prompt JSON representing a visual style:
${basePromptJson}

And I have a specific headline for this post:
"${selectedGeneratedHeadline}"

Please return the UPDATED JSON. 
If the 'core_prompt' mentions text overlays or [INSERT_TEXT], replace it with the EXACT headline: "${selectedGeneratedHeadline}".
If it doesn't mention text, explicitly append an instruction to include the headline "${selectedGeneratedHeadline}" in the image typography.
Make sure the headline is wrapped in quotes or explicitly marked so the image generator knows to draw it.
Return ONLY valid JSON format.`;

      setProcessLogStep2('ส่งข้อมูลไปสังเคราะห์ที่ AI...');
      const text = await callOpenRouter([{ role: "user", content: prompt }], VISION_MODEL);
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      setFinalPromptJson(cleanJson);
      setProcessLogStep2('✅ สังเคราะห์ Prompt JSON สำเร็จ!');
      setTimeout(() => setProcessLogStep2(''), 3000);
    } catch (e: any) {
      setProcessLogStep2('❌ Error: ' + e.message);
      alert('Error: ' + e.message);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const addToQueue = () => {
    if (!generatedArticle) return alert('⚠️ กรุณากดสร้างบทความ (Step 1) ก่อน');
    if (!selectedGeneratedHeadline) return alert('⚠️ กรุณาเลือกพาดหัว (Step 1)');
    if (!finalPromptJson) return alert('⚠️ กรุณากดสร้าง Prompt JSON (Step 2) ก่อน');

    const taskId = Date.now().toString();
    globalTaskStore.addTask({
      id: `aipage_${taskId}`,
      title: `AI Page Post ${taskId.slice(-4)}`,
      progress: 'เข้าคิวงานเรียบร้อย...',
      status: 'running'
    });

    const newTask: GenerationTask = {
      id: taskId,
      status: 'pending',
      log: ['เข้าคิวงานเรียบร้อย...'],
      rawArticle: generatedArticle, // Passing final generated article here
      commentPostText: generatedCommentPost,
      writingStyleId: selectedStyleId,
      headlinePackId: selectedPackId,
      imagePromptStyleId: selectedImagePromptId,
      attachImage,
      referenceImageUrl,
      imageRatio,
      finalText: generatedArticle, // Store final text directly
    };

    setTasks(prev => [...prev, newTask]);
    // Optionally keep inputs or clear them
  };

  // Keep tasksRef in sync so processQueue always reads latest
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  useEffect(() => {
    // Background Queue Processor — guard against concurrent runs
    const processQueue = async () => {
      if (isQueueProcessingRef.current) return;
      const currentTasks = tasksRef.current;
      const pendingTask = currentTasks.find(t => t.status === 'pending');
      if (!pendingTask) return;
      isQueueProcessingRef.current = true;

      // Mark as processing
      
      setTasks(prev => prev.map(t => t.id === pendingTask.id ? { ...t, status: 'processing', log: [...t.log, 'เริ่มทำงาน...'] } : t));
      globalTaskStore.updateTask(`aipage_${pendingTask.id}`, { progress: 'กำลังเขียนบทความ...' });

      
      
      const updateLog = (msg: string) => {
        globalTaskStore.updateTask(`aipage_${pendingTask.id}`, { progress: msg });

        setTasks(prev => prev.map(t => t.id === pendingTask.id ? { ...t, log: [...t.log, msg] } : t));
      };

      try {
        const taskHeadline = pendingTask.bulkHeadline || selectedGeneratedHeadline;
        const finalArticle = `${taskHeadline}\n\n${pendingTask.finalText}`;
        updateLog('เตรียมบทความเสร็จสิ้น');

        // 2. Generate Image via Kie.ai
        updateLog(pendingTask.localYoutubeOverlay ? 'กำลังแปะพาดหัวบนรูปเดิม...' : 'กำลังสร้างรูปภาพ...');
        
        let promptData = { core_prompt: '', negative_prompt: '' };
        let finalPromptJsonForTask = pendingTask.bulkPromptJson || finalPromptJson;
        
        try { promptData = JSON.parse(finalPromptJsonForTask); } catch(e){}


        let finalImageUrl = '';
        if (pendingTask.localYoutubeOverlay) {
          finalImageUrl = await renderYoutubeOverlayImage(pendingTask, taskHeadline);
          updateLog('แปะพาดหัวและรายละเอียดบนรูปเดิมสำเร็จ');
        }

        const imgPrompt = `${taskHeadline}. ${promptData.core_prompt || 'beautiful social media illustration'}`;
        const imgModel = pendingTask.attachImage ? 'gpt-image-2-image-to-image' : 'gpt-image-2-text-to-image';
        
        let finalReferenceUrl = pendingTask.referenceImageUrl;

        // If the reference image is a Base64 string, upload to Dropbox first to get a public URL for Kie.ai
        if (pendingTask.attachImage && finalReferenceUrl && finalReferenceUrl.startsWith('data:image')) {
            updateLog('กำลังอัปโหลดรูปภาพต้นแบบไปยัง Dropbox...');
            const creds = getDropboxCreds();
            if (creds.accessToken || creds.refreshToken) {
               try {
                  const dbxRefRes = await fetch('/api/dropbox-upload', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({
                        imageUrl: '',
                        base64Data: finalReferenceUrl,
                        fileName: `ref_${Date.now()}.png`,
                        folderPath: dropboxFolderPath,
                        ...creds
                     })
                  });
                  const dbxRefData = await dbxRefRes.json();
                  if (dbxRefData.success) {
                     finalReferenceUrl = dbxRefData.url.replace('dl=0', 'raw=1');
                  } else {
                     throw new Error(dbxRefData.error || 'Upload failed');
                  }
               } catch (e) {
                  console.warn('Failed to upload ref image to Dropbox, trying Base64 direct...', e);
               }
            } else {
               console.warn('No Dropbox credentials found, sending Base64 directly to Kie.ai...');
            }
        }

        if (!finalImageUrl) {
        let apiPayload: any = {
           apiKey: getKieKey(),
           model: imgModel,
           input: {
              prompt: imgPrompt,
              negative_prompt: promptData.negative_prompt || 'low quality, blurry',
              image_size: pendingTask.imageRatio,
              num_inference_steps: 20,
              guidance_scale: 7
           }
        };

        if (pendingTask.attachImage && finalReferenceUrl) {
           apiPayload.input.image_url = finalReferenceUrl;
        }

        const kieRes = await fetch('/api/kie-create', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(apiPayload)
        });
        
        const kieData = await kieRes.json();
        if (kieData.code !== 200 || !kieData.data?.taskId) {
           throw new Error(kieData.msg || 'Kie.ai Error');
        }

        updateLog('ส่งคำสั่งไป Kie.ai สำเร็จ กำลังรอรูป (taskId: ' + kieData.data.taskId + ')');
        
        // Poll Kie.ai
        const maxPolls = 120;
        for (let i = 0; i < maxPolls; i++) {
           await new Promise(r => setTimeout(r, 5000));
           updateLog(`กำลังตรวจสอบสถานะ... (${i + 1}/${maxPolls})`);
           
           try {
              const pollRes = await fetch(`/api/kie-status?taskId=${kieData.data.taskId}&apiKey=${encodeURIComponent(getKieKey() || '')}`);
              const pollData = await pollRes.json();
              console.log('[KIE-POLL] Raw response:', JSON.stringify(pollData).substring(0, 800));
              
              // Kie.ai response: { code: 200, data: { taskId, state: "success"|"fail"|"waiting"|"generating", resultJson: "..." } }
              const taskData = pollData.data || pollData;
              const state = (taskData.state || taskData.status || '').toLowerCase();
              
              if (state === 'success' || state === 'completed' || state === 'done') {
                 // resultJson is a STRINGIFIED JSON like: {"resultUrls":["https://..."]}
                 const rawResultJson = taskData.resultJson || taskData.result;
                 console.log('[KIE-POLL] Task completed! resultJson:', rawResultJson);
                 
                 let resultObj: any = null;
                 if (typeof rawResultJson === 'string') {
                    if (rawResultJson.startsWith('http')) {
                       finalImageUrl = rawResultJson;
                    } else {
                       try { resultObj = JSON.parse(rawResultJson); } catch(e) { 
                          console.error('[KIE-POLL] Failed to parse resultJson:', e); 
                       }
                    }
                 } else if (typeof rawResultJson === 'object' && rawResultJson !== null) {
                    resultObj = rawResultJson;
                 }
                 
                 if (!finalImageUrl && resultObj) {
                    // Primary: resultUrls array (official Kie.ai format)
                    if (resultObj.resultUrls && resultObj.resultUrls.length > 0) {
                       finalImageUrl = resultObj.resultUrls[0];
                    }
                    // Fallback formats
                    else if (resultObj.images && resultObj.images.length > 0) {
                       const img = resultObj.images[0];
                       finalImageUrl = typeof img === 'string' ? img : (img.url || img.uri || '');
                    } else if (resultObj.image_url) {
                       finalImageUrl = resultObj.image_url;
                    } else if (resultObj.url) {
                       finalImageUrl = resultObj.url;
                    } else if (resultObj.output_url) {
                       finalImageUrl = resultObj.output_url;
                    } else {
                       // Last resort: find any URL string in the object
                       const findUrl = (obj: any): string => {
                          if (!obj || typeof obj !== 'object') return '';
                          for (const key of Object.keys(obj)) {
                             const val = obj[key];
                             if (typeof val === 'string' && val.startsWith('http')) return val;
                             if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string' && val[0].startsWith('http')) return val[0];
                             if (typeof val === 'object') { const f = findUrl(val); if (f) return f; }
                          }
                          return '';
                       };
                       finalImageUrl = findUrl(resultObj);
                    }
                 }
                 
                 if (finalImageUrl) {
                    console.log('[KIE-POLL] ✅ Got image URL:', finalImageUrl);
                    break;
                 } else {
                    console.error('[KIE-POLL] Could not extract image URL. Full data:', JSON.stringify(taskData));
                    updateLog('⚠️ รูปสร้างเสร็จแล้ว แต่ไม่พบลิงก์รูป (ดู Console)');
                 }
              } else if (state === 'fail' || state === 'failed' || state === 'error') {
                 throw new Error('Kie.ai generation failed: ' + (taskData.failMsg || taskData.message || taskData.msg || 'Unknown error'));
              }
              // Otherwise still waiting/queuing/generating, continue loop
           } catch(pollErr: any) {
              if (pollErr.message.includes('Kie.ai generation failed')) throw pollErr;
              console.warn('[KIE-POLL] Poll error (will retry):', pollErr.message);
           }
        }

        if (!finalImageUrl) throw new Error('Timeout waiting for Kie.ai image (10 minutes)');
        updateLog('สร้างรูปสำเร็จ: ' + finalImageUrl);
        }

        // 3. Attach Logo (Client-Side Canvas Simulation & Dropbox Upload)
        updateLog('กำลังประมวลผลลายน้ำและอัพโหลด...');
        let finalDisplayUrl = finalImageUrl;
        let base64Payload = finalImageUrl.startsWith('data:image') ? finalImageUrl : '';
        
        try {
           if (logoUrl) {
              const canvasImage = await new Promise<string>((resolve) => {
                 const img = new Image();
                 img.crossOrigin = 'Anonymous';
                 img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return resolve(finalImageUrl);
                    ctx.drawImage(img, 0, 0);

                    const logoImg = new Image();
                    logoImg.crossOrigin = 'Anonymous';
                    logoImg.onload = () => {
                       const sizePx = (canvas.width * logoSize) / 100;
                       const ratio = logoImg.height / logoImg.width;
                       const hPx = sizePx * ratio;
                       
                       let x = 0, y = 0;
                       if (logoPosition.includes('left')) x = logoMarginX;
                       else x = canvas.width - sizePx - logoMarginX;

                       if (logoPosition.includes('top')) y = logoMarginY;
                       else y = canvas.height - hPx - logoMarginY;

                       ctx.globalAlpha = 0.9;
                       ctx.drawImage(logoImg, x, y, sizePx, hPx);
                       ctx.globalAlpha = 1.0;
                       resolve(canvas.toDataURL('image/png'));
                    };
                    logoImg.onerror = () => resolve(finalImageUrl);
                    logoImg.src = logoUrl;
                 };
                 img.onerror = () => resolve(finalImageUrl);
                 img.src = finalImageUrl; // Ensure we fetch via cors-friendly route if needed. Kie.ai URLs usually allow CORS.
              });
              
              if (canvasImage.startsWith('data:image')) {
                 base64Payload = canvasImage;
                 finalDisplayUrl = canvasImage;
                 updateLog('ใส่ลายน้ำสำเร็จ');
              }
           }
        } catch (e) {
           updateLog('เกิดข้อผิดพลาดในการใส่ Logo');
        }

        // ── Save local copy — always, every image ─────────────────────────
        let localImageUrl = '';
        const localSafeName = `aipage_${Date.now()}.png`;

        // Pass 1: use base64 if available (fastest, no network)
        if (base64Payload && !localImageUrl) {
          try {
            const saveRes = await fetch('/api/aipage-save-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ base64Data: base64Payload, fileName: localSafeName }),
            });
            const saveData = await saveRes.json();
            if (saveData.success) {
              localImageUrl = saveData.localPath;
              finalDisplayUrl = localImageUrl;
              updateLog('บันทึกรูปลง disk แล้ว');
            }
          } catch {}
        }

        // Pass 2: download from CDN URL (server-side, bypasses CORS)
        if (!localImageUrl && finalImageUrl && !finalImageUrl.startsWith('data:image')) {
          try {
            const saveRes = await fetch('/api/aipage-save-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageUrl: finalImageUrl, fileName: localSafeName }),
            });
            const saveData = await saveRes.json();
            if (saveData.success) {
              localImageUrl = saveData.localPath;
              finalDisplayUrl = localImageUrl;
              updateLog('บันทึกรูปลง disk แล้ว');
            }
          } catch {}
        }

        if (!localImageUrl) updateLog('⚠️ บันทึกรูป local ไม่สำเร็จ — ใช้ URL แทน');

        let dropboxUrl = '';

        // Try uploading to dropbox using the middleware
        try {
           const creds = getDropboxCreds();
           const dbxRes = await fetch('/api/dropbox-upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                 imageUrl: base64Payload ? '' : finalImageUrl,
                 base64Data: base64Payload || undefined,
                 fileName: `aipage_${Date.now()}.png`,
                 folderPath: dropboxFolderPath,
                 ...creds
              })
           });
           const dbxData = await dbxRes.json();
           if (dbxData.success) {
              dropboxUrl = (dbxData.directUrl || dbxData.url || '').replace('dl=0', 'dl=1');
              updateLog('อัพโหลด Dropbox สำเร็จ');
           }
        } catch(e: any) {
           updateLog('ข้ามการอัพโหลด Dropbox (ไม่มี Token/ตั้งค่าไม่ครบ)');
        }

        // Finish Task
        
        globalTaskStore.updateTask(`aipage_${pendingTask.id}`, { progress: '🎉 เสร็จสมบูรณ์', status: 'completed' });
        setTasks(prev => prev.map(t => t.id === pendingTask.id ? { 
           ...t, 
           status: 'completed', 
           log: [...t.log, '🎉 เสร็จสมบูรณ์'],

           finalText: finalArticle,
           commentPostText: pendingTask.commentPostText || '',
           finalImageUrl: finalDisplayUrl,
           dropboxUrl
        } : t));

        // Add to temp table
        setCompletedPosts(prev => [...prev, {
           id: pendingTask.id,
           headline: taskHeadline,
           article: finalArticle,
           commentPostText: pendingTask.commentPostText || '',
           imageUrl: finalDisplayUrl,
           dropboxUrl,
           createdAt: new Date().toLocaleString()
        }]);

        // Save to persistent results (file-based, Git-syncable)
        // imageUrl priority: local disk → Dropbox dl=1 → CDN URL
        const resultItem = {
           id: `result_${Date.now()}`,
           headline: taskHeadline,
           article: finalArticle,
           commentPostText: pendingTask.commentPostText || '',
           imageUrl: localImageUrl || dropboxUrl || finalDisplayUrl,
           localImageUrl,
           dropboxUrl,
           sourceUrl: pendingTask.bulkSourceUrl || sourceUrl || '',
           imageRatio: pendingTask.imageRatio,
           imagePromptStyleId: pendingTask.imagePromptStyleId || '',
           dropboxPath: dropboxUrl ? dropboxFolderPath : '',
           sourceMeta: pendingTask.sourceMeta || {},
           createdAt: new Date().toISOString()
        };
        try {
           await fetch('/api/aipage-results', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'add', item: resultItem })
           });
           if (pendingTask.bulkRawArticle) {
              await saveArticleCache(pendingTask.bulkRawArticle, {
                 sourceUrl: resultItem.sourceUrl,
                 selectedHeadline: taskHeadline,
                 resultId: resultItem.id,
                 resultSavedAt: resultItem.createdAt,
                 imageCompletedAt: resultItem.createdAt,
                 resultHasImage: !!resultItem.imageUrl,
              });
           }
           loadSavedResults();
        } catch(e) { console.error('Failed to save result:', e); }

      } catch (err: any) {
        globalTaskStore.updateTask(`aipage_${pendingTask.id}`, { progress: `❌ ข้อผิดพลาด: ${err.message}`, status: 'error' });
        setTasks(prev => prev.map(t => t.id === pendingTask.id ? { ...t, status: 'error', log: [...t.log, '❌ ข้อผิดพลาด: ' + err.message] } : t));
        if (pendingTask.bulkItemId) {
          updateBulkItem(pendingTask.bulkItemId, {
            status: 'article-done',
            imageErrorMsg: err.message || 'สร้างรูปไม่สำเร็จ',
            errorMsg: '',
          });
        }
      } finally {
        isQueueProcessingRef.current = false;
        // Re-trigger queue processing after ref is cleared — fixes race condition
        // where useEffect fires before the ref is reset, causing next task to be skipped
        setTimeout(() => processQueue(), 50);
      }

    };

    processQueue();
  }, [tasks, writingStyles, selectedGeneratedHeadline, analyzedPromptJSON, logoUrl, logoPosition, logoSize]);

  const splitCommentPostForExport = (text: string) => {
     const cleaned = String(text || '').trim();
     const pick = (label: string, nextLabels: string[]) => {
       const start = cleaned.search(new RegExp(`${label}\\s*:`, 'i'));
       if (start < 0) return '';
       const afterLabel = cleaned.slice(start).replace(new RegExp(`^${label}\\s*:\\s*`, 'i'), '');
       const nextPositions = nextLabels
         .map(next => afterLabel.search(new RegExp(`\\n\\s*${next}\\s*:`, 'i')))
         .filter(pos => pos >= 0);
       const end = nextPositions.length ? Math.min(...nextPositions) : afterLabel.length;
       return afterLabel.slice(0, end).trim();
     };
     return {
       caption: pick('(?:แคปชั่น|โพสต์แคปชั่น)', ['ใต้เม้น1', 'ใต้เม้น2', 'ใต้เม้น3']),
       comment1: pick('ใต้เม้น1', ['ใต้เม้น2', 'ใต้เม้น3']),
       comment2: pick('ใต้เม้น2', ['ใต้เม้น3']),
       comment3: pick('ใต้เม้น3', []),
     };
  };

  const fallbackCommentPostForExport = (headline: string, article: string) => {
     const normalized = formatFacebookPostText(article).replace(/\n+/g, ' ').trim();
     const chunkSize = Math.ceil(normalized.length / 3) || 1;
     return {
       caption: headline || '',
       comment1: normalized.slice(0, chunkSize).trim(),
       comment2: normalized.slice(chunkSize, chunkSize * 2).trim(),
       comment3: normalized.slice(chunkSize * 2).trim(),
     };
  };

  const formatFacebookPostText = (text: string) => {
     return String(text || '')
       .replace(/\r\n/g, '\n')
       .replace(/\*\*(.*?)\*\*/g, '$1')
       .replace(/^\s*[-*]\s+/gm, '')
       .replace(/\s+\.\s+/g, '\n\n')
       .replace(/\s+(?=(?:\d+\.|[🔥🚀⭐️💡🎯📌✅])\s*)/g, '\n\n')
       .replace(/[ \t]{2,}/g, ' ')
       .replace(/\n[ \t]+/g, '\n')
       .replace(/\n{3,}/g, '\n\n')
       .trim();
  };

  const exportCSV = () => {
     if (savedResults.length === 0) return alert('ไม่มีข้อมูล');
     const exportResults = savedResults.filter((result: any) => selectedResultIds.has(result.id));
     if (exportResults.length === 0) return alert('กรุณาเลือกรายการที่จะโหลด CSV ก่อน');
     const headers = ['id', 'headline', 'post_text', 'clickbait_caption', 'comment_1', 'comment_2', 'comment_3', 'comment_1_image_url', 'comment_2_image_url', 'comment_3_image_url', 'dropbox_dl1_url', 'image_url', 'source_url', 'source_title', 'source_type', 'channel_name', 'subscriber_count', 'tags', 'image_ratio', 'image_prompt_style_id', 'dropbox_path', 'created_at'];
     const rows = exportResults.map(p => {
       const meta = p.sourceMeta || {};
       const parsedCommentParts = splitCommentPostForExport(p.commentPostText || p.generatedCommentPost || '');
       const commentParts = parsedCommentParts.caption || parsedCommentParts.comment1
         ? parsedCommentParts
         : fallbackCommentPostForExport(p.headline || '', p.article || '');
       const imageLink = p.dropboxUrl || p.imageUrl || '';
       return [
         p.id || '',
         p.headline || '',
         formatFacebookPostText(p.article || ''),
         commentParts.caption,
         commentParts.comment1,
         commentParts.comment2,
         commentParts.comment3,
         imageLink,
         imageLink,
         imageLink,
         p.dropboxUrl || '',
         p.imageUrl || '',
         p.sourceUrl || meta.sourceUrl || '',
         meta.title || '',
         meta.sourceType || '',
         meta.channelName || '',
         meta.subscriberCount ?? '',
         Array.isArray(meta.tags) ? meta.tags.join('|') : '',
         p.imageRatio || '',
         p.imagePromptStyleId || '',
         p.dropboxPath || '',
         p.createdAt || '',
       ];
     });
     const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(",")).join("\n");
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", `aipage_export_${Date.now()}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  const safeCsvFileName = (value: string) => {
    const clean = (value || 'aipage').replace(/[<>:"/\\|?*\n\r]/g, '_').slice(0, 80);
    return `${clean}_${Date.now()}.png`;
  };

  const uploadSavedResultToDropbox = async (result: any) => {
    const creds = getDropboxCreds();
    if (!creds.accessToken && !creds.refreshToken) throw new Error('ยังไม่ได้ตั้งค่า Dropbox API ใน Profile');
    const res = await fetch('/api/dropbox-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: result.imageUrl?.startsWith('data:image') ? '' : result.imageUrl,
        base64Data: result.imageUrl?.startsWith('data:image') ? result.imageUrl : undefined,
        fileName: safeCsvFileName(result.headline || result.id),
        folderPath: dropboxFolderPath,
        ...creds,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Dropbox upload failed');
    const directUrl = (data.directUrl || data.url || '').replace('dl=0', 'dl=1');
    await updateSavedResult(result.id, {
      dropboxUrl: directUrl,
      imageUrl: directUrl,
      dropboxPath: data.dropboxPath || dropboxFolderPath,
      exportedToDropboxAt: new Date().toISOString(),
    });
    return directUrl;
  };

  const [recoveringResultId, setRecoveringResultId] = useState<string | null>(null);

  const tryFetchAsBase64 = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  const handleRecoverAndReuploadImage = async (result: any) => {
    const creds = getDropboxCreds();
    if (!creds.accessToken && !creds.refreshToken) return alert('ยังไม่ได้ตั้งค่า Dropbox API ใน Profile');
    setRecoveringResultId(result.id);
    setDropboxUploadLog(`กำลังกู้รูป: ${result.headline || result.id}`);
    try {
      // Try AI-generated image sources only — do NOT fall back to sourceMeta.selectedReferenceImage (that's the original reference image, not the AI result)
      const toAbsolute = (u: string) => u.startsWith('/') ? window.location.origin + u : u;
      const sources = [
        result.localImageUrl,
        result.imageUrl?.startsWith('/') ? result.imageUrl : null,  // imageUrl stored as local path
        result.dropboxUrl,
        result.imageUrl?.startsWith('http') ? result.imageUrl : null, // imageUrl stored as remote URL
      ].filter((s: any): s is string => !!s).map(toAbsolute);

      let imageBase64: string | null = null;
      for (const src of sources) {
        setDropboxUploadLog(`กำลังโหลดรูปจาก: ${String(src).slice(0, 60)}...`);
        imageBase64 = await tryFetchAsBase64(src);
        if (imageBase64) break;
      }
      if (!imageBase64) throw new Error('ไม่สามารถโหลดรูปได้จากทุกแหล่ง — ต้องสร้างรูปใหม่');

      // Save local copy first
      let newLocalUrl = result.localImageUrl || '';
      try {
        const localName = safeCsvFileName(result.headline || result.id);
        const localRes = await fetch('/api/aipage-save-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data: imageBase64, fileName: localName }),
        });
        const localData = await localRes.json();
        if (localData.success) newLocalUrl = localData.localPath;
      } catch {}

      setDropboxUploadLog('บันทึกรูป local แล้ว กำลังอัปโหลด Dropbox...');
      const fileName = safeCsvFileName(result.headline || result.id);
      const dbxRes = await fetch('/api/dropbox-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: '', base64Data: imageBase64, fileName, folderPath: dropboxFolderPath, ...creds }),
      });
      const dbxData = await dbxRes.json();
      const directUrl = dbxData.success ? (dbxData.directUrl || dbxData.url || '').replace('dl=0', 'dl=1') : '';
      await updateSavedResult(result.id, {
        localImageUrl: newLocalUrl,
        imageUrl: newLocalUrl || directUrl || result.imageUrl,
        dropboxUrl: directUrl || result.dropboxUrl,
        dropboxPath: dbxData.dropboxPath || dropboxFolderPath,
      });
      setDropboxUploadLog(`✅ กู้รูปสำเร็จ${newLocalUrl ? ' (บันทึก local แล้ว)' : ''}`);
      await loadSavedResults();
    } catch (e: any) {
      setDropboxUploadLog(`❌ กู้รูปไม่สำเร็จ: ${e.message}`);
      alert(`กู้รูปไม่สำเร็จ: ${e.message}`);
    } finally {
      setRecoveringResultId(null);
    }
  };

  const toggleResultSelection = (id: string) => {
    setSelectedResultIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllResults = () => setSelectedResultIds(new Set(savedResults.map((p: any) => p.id).filter(Boolean)));
  const clearSelectedResults = () => setSelectedResultIds(new Set());

  const uploadAllSavedResultsToDropbox = async () => {
    if (savedResults.length === 0) return alert('ไม่มีผลลัพธ์ให้อัปโหลด');
    const selected = savedResults.filter((result: any) => selectedResultIds.has(result.id));
    if (selected.length === 0) return alert('กรุณาเลือกรายการที่จะอัปโหลด หรือกดเลือกทั้งหมดก่อน');
    localStorage.setItem('aipage_dropbox_folder', dropboxFolderPath);
    setIsUploadingResults(true);
    try {
      let done = 0;
      for (const result of selected) {
        setDropboxUploadLog(`กำลังอัปโหลด ${done + 1}/${selected.length}: ${result.headline || result.id}`);
        await uploadSavedResultToDropbox(result);
        done++;
      }
      setDropboxUploadLog(`✅ อัปโหลดครบ ${done} รายการ และแปลงลิงก์เป็น dl=1 แล้ว`);
      await loadSavedResults();
      const csvRes = await fetch('/api/aipage-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export-csv', ids: selected.map((item: any) => item.id) }),
      });
      const csvData = await csvRes.json();
      if (csvData.success) {
        await loadExportedCsvRefs();
        setDropboxUploadLog(`✅ อัปโหลดครบ ${done} รายการ + บันทึก CSV: ${csvData.csvPath}`);
      }
    } catch (e: any) {
      setDropboxUploadLog(`❌ ${e.message}`);
      alert(`อัปโหลดไม่สำเร็จ: ${e.message}`);
    } finally {
      setIsUploadingResults(false);
    }
  };

  const saveN8nCsvToDisk = async () => {
    const selected = savedResults.filter((result: any) => selectedResultIds.has(result.id));
    if (selected.length === 0) return alert('กรุณาเลือกรายการที่จะบันทึก CSV n8n ก่อน');
    const res = await fetch('/api/aipage-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export-csv', ids: selected.map((item: any) => item.id) }),
    });
    const data = await res.json();
    if (data.success) {
      await loadExportedCsvRefs();
      setDropboxUploadLog(`✅ บันทึก CSV แล้ว: ${data.csvPath}`);
      const csvText = data.csvContent || '';
      const blobUrl = csvText
        ? URL.createObjectURL(new Blob([csvText], { type: 'text/csv;charset=utf-8;' }))
        : data.csvPath;
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = data.fileName || `aipage_n8n_export_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (csvText) setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }
    else alert(data.error || 'บันทึก CSV ไม่สำเร็จ');
  };

  const handlePickFolder = async () => {
    try {
      const res = await fetch('/api/pick-folder', { method: 'POST' });
      const data = await res.json();
      if (!data.success || data.cancelled) return;
      const saveRes = await fetch('/api/aipage-storage-config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: data.dir }),
      });
      const saveData = await saveRes.json();
      if (saveData.success) {
        setAipageDataDir(saveData.dir);
        alert(`✅ เปลี่ยนโฟลเดอร์เป็น:\n${saveData.dir}\n\nรีสตาร์ท dev server เพื่อให้มีผล`);
      }
    } catch (e: any) { alert('เกิดข้อผิดพลาด: ' + e.message); }
  };

  const handlePickGithubStockFolder = async () => {
    setGithubStockFolderLog('กำลังเปิดเลือก Folder...');
    try {
      const res = await fetchWithTimeout('/api/pick-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'เลือก Folder คลังรูป GitHub ที่มี subfolder ตามหัวข้อ เช่น Claude Code' }),
      }, 65_000);
      const data = await res.json();
      if (!data.success || data.cancelled) {
        setGithubStockFolderLog('');
        return;
      }
      localStorage.setItem(GH_FOOTAGE_FOLDER_KEY, data.dir);
      setGithubStockFolder(data.dir);
      const parts = String(data.dir).split('/').filter(Boolean);
      setGithubStockFolderName(parts[parts.length - 1] || data.dir);
      setGithubStockFolderLog('เลือกคลังรูป GitHub แล้ว');
      setTimeout(() => setGithubStockFolderLog(''), 2500);
    } catch (e: any) {
      setGithubStockFolderLog(e?.message || 'เลือก Folder ไม่สำเร็จ');
    }
  };

  const handleClearCache = async () => {
    if (!confirm('ลบไฟล์รูปที่ไม่ได้ใช้งาน (orphaned images) + CSV export?\n\nรูปที่ผูกกับผลลัพท์จะไม่ถูกลบ')) return;
    try {
      const res = await fetch('/api/aipage-clear-cache', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ลบเสร็จ: ${data.deletedCount} ไฟล์ (${data.freedMB} MB)`);
      } else {
        alert('เกิดข้อผิดพลาด: ' + (data.error || 'unknown'));
      }
    } catch (e: any) { alert('เกิดข้อผิดพลาด: ' + e.message); }
  };

  const loadSavedResults = async () => {
     try {
        const res = await fetch('/api/aipage-results');
        const data = await res.json();
        if (data.success) {
          // Normalize: ensure Dropbox URLs have dl=1 for direct image display
          const results = (data.results || []).map((r: any) => ({
            ...r,
            dropboxUrl: r.dropboxUrl ? r.dropboxUrl.replace(/[?&]dl=0/, '').replace(/(\?[^?]*)$/, '$1').replace(/\?$/, '') + (r.dropboxUrl.includes('?') ? '&dl=1' : '?dl=1') : r.dropboxUrl,
            imageUrl: r.imageUrl?.includes('dropbox.com') && !r.localImageUrl
              ? r.imageUrl.replace('dl=0', 'dl=1')
              : r.imageUrl,
          }));
          setSavedResults(results);
        }
     } catch(e) { console.error('Failed to load saved results:', e); }
  };

  const loadExportedCsvRefs = async () => {
     try {
        const res = await fetch('/api/aipage-export-refs');
        const data = await res.json();
        if (data.success) {
          setExportedCsvRefs({
            urls: Array.isArray(data.urls) ? data.urls : [],
            headlines: Array.isArray(data.headlines) ? data.headlines : [],
          });
        }
     } catch(e) { console.error('Failed to load exported CSV refs:', e); }
  };

  const deleteSavedResult = async (id: string) => {
     if (!confirm('ลบผลลัพท์นี้ถาวรหรือไม่?')) return;
     try {
        await fetch('/api/aipage-results', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ action: 'delete', id })
        });
        loadSavedResults();
     } catch(e) { console.error(e); }
  };

  const updateSavedResult = async (id: string, updates: any) => {
     try {
        await fetch('/api/aipage-results', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ action: 'update', id, item: updates })
        });
        loadSavedResults();
     } catch(e) { console.error(e); }
  };

  const handleDownloadImage = async (imageUrl: string, fileName?: string) => {
    if (!imageUrl) return;
    const dlName = fileName || `aipage_${Date.now()}.png`;
    try {
      // For local paths — fetch as blob to avoid Thai-filename encoding issues
      const isLocal = imageUrl.startsWith('/');
      const isDropbox = imageUrl.includes('dropbox.com');
      // Direct-download URL: local path or Dropbox with dl=1
      const fetchUrl = isDropbox
        ? imageUrl.replace(/dl=0/, 'dl=1').replace(/\?$/, '') + (imageUrl.includes('?') ? '' : '?') + (imageUrl.includes('dl=') ? '' : '&dl=1')
        : imageUrl;
      if (isLocal || isDropbox) {
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = dlName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
      } else {
        // Remote CDN URL — direct link
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = dlName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch(e) { console.error('Download failed:', e); alert('ดาวน์โหลดไม่สำเร็จ ลองกด→เปิดแล้วบันทึกเองนะครับ'); }
  };

  // === Bulk Mode Functions ===
  const addBulkItem = () => {
    setBulkItems(prev => [...prev, makeDefaultBulkItem({ isSelected: false })]);
  };

  const removeBulkItem = (id: string) => setBulkItems(prev => prev.filter(item => item.id !== id));

  const updateBulkItem = (id: string, updates: Partial<BulkArticleItem>) => {
    setBulkItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const buildContentFormatPatch = (
    format: BulkArticleItem['contentFormat'],
    item: BulkArticleItem,
    notePrefix = 'เลือก format',
  ): Partial<BulkArticleItem> => {
    const hasImage = !!(item.selectedImageUrl || item.images?.[0]);
    const selectedImageUrl = item.selectedImageUrl || item.images?.[0] || '';
    if (format === 'editorial') {
      return {
      contentFormat: 'editorial',
      cardImagePromptStyleId: EDITORIAL_IMAGE_STYLE_ID,
      cardImageRatio: item.cardImageRatio || '1:1',
      fontPaletteId: item.fontPaletteId?.startsWith('tg-') ? item.fontPaletteId : 'tg-classic',
        imageSourceMode: item.imageSourceMode === 'ai' ? 'ai' : hasImage ? 'attached' : item.imageSourceMode || 'auto',
        useAttachedImage: hasImage && item.imageSourceMode !== 'ai',
        decorateOriginalPhoto: hasImage && item.imageSourceMode !== 'ai',
        selectedImageUrl,
        smartConfigNote: `${notePrefix} → Editorial แบบ Top Gainers: พาดหัวใหญ่ ชุดสีแรง แปะบนรูปเดิมได้`,
      };
    }
    if (format === 'quote') {
      return {
      contentFormat: 'quote',
      cardImagePromptStyleId: QUOTE_IMAGE_STYLE_ID,
      cardImageRatio: item.cardImageRatio || '1:1',
      fontPaletteId: item.fontPaletteId?.startsWith('tg-') ? item.fontPaletteId : 'tg-graphite-gold',
        imageSourceMode: item.imageSourceMode === 'ai' ? 'ai' : hasImage ? 'attached' : item.imageSourceMode || 'auto',
        useAttachedImage: hasImage && item.imageSourceMode !== 'ai',
        decorateOriginalPhoto: hasImage && item.imageSourceMode !== 'ai',
        selectedImageUrl,
        articleLength: item.articleLength === 'deep' ? 'medium' : item.articleLength,
        smartConfigNote: `${notePrefix} → Quote Card: เหมาะกับคำสอนคนดัง/ข้อคิด/บทเรียน สร้างภาพแนว quote ได้`,
      };
    }
    return {
      contentFormat: 'classic',
      cardImagePromptStyleId: '',
      decorateOriginalPhoto: false,
      smartConfigNote: `${notePrefix} → Classic AI Page: ใช้ Image Prompt เดิมหรือให้ AI สร้างภาพใหม่`,
    };
  };

  const buildImageSourcePatch = (
    mode: BulkArticleItem['imageSourceMode'],
    item: BulkArticleItem,
  ): Partial<BulkArticleItem> => {
    const selectedImageUrl = item.selectedImageUrl || item.images?.[0] || '';
    if (mode === 'ai') {
      return {
        imageSourceMode: 'ai',
        useAttachedImage: false,
        decorateOriginalPhoto: false,
        selectedImageUrl: '',
        smartSelectedImageIndex: undefined,
        smartSelectedImageReason: 'เลือกให้ AI สร้างภาพใหม่ ไม่ใช้รูปต้นทาง',
      };
    }
    if (mode === 'attached') {
      return {
        imageSourceMode: 'attached',
        useAttachedImage: !!selectedImageUrl,
        decorateOriginalPhoto: !!selectedImageUrl && item.contentFormat !== 'classic',
        selectedImageUrl,
        smartSelectedImageIndex: selectedImageUrl ? Math.max(0, (item.images || []).indexOf(selectedImageUrl)) : undefined,
        smartSelectedImageReason: selectedImageUrl ? 'ใช้รูปจาก Content เป็นภาพต้นทาง' : 'ยังไม่มีรูปจาก Content ให้เลือก',
      };
    }
    if (mode === 'github-random') {
      return {
        imageSourceMode: 'github-random',
        useAttachedImage: true,
        decorateOriginalPhoto: item.contentFormat !== 'classic',
        smartSelectedImageReason: 'จะสุ่มจากคลังรูปตอนสร้างภาพ',
        smartConfigNote: 'เลือกภาพต้นทางเป็นสุ่มคลังรูป ระบบจะใช้คลัง GitHub/Assets ที่ตั้งไว้',
      };
    }
    return {
      imageSourceMode: 'auto',
      smartSelectedImageReason: 'ให้ Smart Setup เลือกภาพต้นทางตามประเภท Content',
    };
  };

  const isNewsBulkItem = (item: BulkArticleItem) => {
    const source = (item.sourceType || '').toLowerCase();
    const tags = (item.tags || []).join(' ').toLowerCase();
    return source === 'news' || source === 'rss' || tags.includes('ข่าว');
  };

  const isSpecialImageStyle = (id: string) => id === YOUTUBE_IMAGE_STYLE_ID || id === AI_NEWS_IMAGE_STYLE_ID || id === GITHUB_IMAGE_STYLE_ID || id === EDITORIAL_IMAGE_STYLE_ID || id === QUOTE_IMAGE_STYLE_ID;
  const isOverlayImageStyle = (id: string) => id === YOUTUBE_IMAGE_STYLE_ID || id === AI_NEWS_IMAGE_STYLE_ID || id === GITHUB_IMAGE_STYLE_ID || id === EDITORIAL_IMAGE_STYLE_ID || id === QUOTE_IMAGE_STYLE_ID;
  const getDisplayImageUrl = (url: string) => url.startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(url)}` : url;
  const isGithubStockUrl = (url: string) => url.startsWith('data:image') || url.startsWith('/api/local-stock-image');

  const fetchNewsImages = async (id: string) => {
    const item = bulkItems.find(b => b.id === id);
    if (!item?.sourceUrl) {
      alert('ไม่มีลิงก์ข่าวให้ดูดรูป');
      return;
    }
    setNewsImageLoadingIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    updateBulkItem(id, { imageErrorMsg: '' });
    try {
      const res = await fetch('/api/website-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.sourceUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ดูดรูปข่าวไม่สำเร็จ');
      }
      const mergedImages = Array.from(new Set([...(data.images || []), ...(item.images || [])]))
        .filter((img): img is string => typeof img === 'string' && img.startsWith('http'));
      if (mergedImages.length === 0) {
        throw new Error('ไม่พบรูปประกอบข่าวจากเว็บไซต์นี้');
      }
      const keepSelected = item.selectedImageUrl && mergedImages.includes(item.selectedImageUrl);
      updateBulkItem(id, {
        images: mergedImages,
        sourceType: item.sourceType || 'news',
        useAttachedImage: true,
        selectedImageUrl: keepSelected ? item.selectedImageUrl : mergedImages[0],
        smartSelectedImageIndex: keepSelected ? mergedImages.indexOf(item.selectedImageUrl) : 0,
        smartSelectedImageReason: keepSelected ? item.smartSelectedImageReason || 'ใช้รูปที่เลือกไว้เดิม' : 'ดูดรูปข่าวจากเว็บไซต์และเลือกรูปแรกไว้ก่อน',
        smartConfigNote: `ดูดรูปข่าวจากเว็บไซต์สำเร็จ ${mergedImages.length} รูป เลือกรูปที่เหมาะก่อนสร้างภาพ`,
        imageErrorMsg: '',
      });
    } catch (err: any) {
      const msg = err?.message || 'ดูดรูปข่าวไม่สำเร็จ';
      updateBulkItem(id, { imageErrorMsg: msg, sourceType: item.sourceType || 'news' });
      alert(`ดูดรูปข่าวไม่สำเร็จ: ${msg}`);
    } finally {
      setNewsImageLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleSelectBulk = (id: string) => setBulkItems(prev => prev.map(item => item.id === id ? { ...item, isSelected: !item.isSelected } : item));
  const selectAllBulk = () => setBulkItems(prev => prev.map(item => item.rawArticle.trim() ? { ...item, isSelected: true } : item));
  const deselectAllBulk = () => setBulkItems(prev => prev.map(item => ({ ...item, isSelected: false })));

  const selectedBulkCount = bulkItems.filter(b => b.isSelected).length;
  const recoverableCacheCount = useMemo(
    () => {
      const existingKeys = new Set(bulkItems.map(item => articleKey(item.rawArticle)));
      const completedUrls = new Set(
        [
          ...savedResults.map((result: any) => String(result?.sourceUrl || result?.sourceMeta?.sourceUrl || '').trim()),
          ...exportedCsvRefs.urls.map(url => String(url || '').trim()),
        ].filter(Boolean),
      );
      const completedHeadlines = new Set(
        [
          ...savedResults.map((result: any) => String(result?.headline || result?.selectedHeadline || result?.sourceMeta?.selectedHeadline || '').trim()),
          ...exportedCsvRefs.headlines.map(headline => String(headline || '').trim()),
        ].filter(Boolean),
      );
      return Object.values(articleCache).filter((entry: any) => {
        if (!entry?.rawArticle || !entry?.generatedArticle) return false;
        if (entry.imageUrl || entry.localImageUrl || entry.dropboxUrl) return false;
        if (entry.imageCompletedAt || entry.resultSavedAt || entry.exportedCsvAt) return false;
        if (existingKeys.has(articleKey(entry.rawArticle))) return false;
        const sourceUrl = String(entry.sourceUrl || '').trim();
        const headline = String(entry.selectedHeadline || '').trim();
        if (sourceUrl && completedUrls.has(sourceUrl)) return false;
        if (headline && completedHeadlines.has(headline)) return false;
        return true;
      }).length;
    },
    [articleCache, savedResults, exportedCsvRefs, bulkItems],
  );

  const isGithubBulkItem = (item: Partial<BulkArticleItem>) => {
    const source = String(item.sourceType || '').toLowerCase();
    const tags = (item.tags || []).join(' ').toLowerCase();
    const haystack = `${item.sourceUrl || ''} ${item.rawArticle || ''}`.toLowerCase();
    return source === 'github' || tags.includes('github') || /github\.com/i.test(haystack);
  };

  const randomGithubBadgeStyleId = () =>
    GITHUB_BADGE_STYLES[Math.floor(Math.random() * GITHUB_BADGE_STYLES.length)]?.id || GITHUB_BADGE_STYLES[0].id;

  const buildGithubReadyPatch = async (item: BulkArticleItem, notePrefix = 'กู้คืนจาก cache') => {
    const headline = item.selectedHeadline || item.generatedHeadlines[0] || item.title || '';
    const markedKeywords = pickImpactfulKeywords(headline, 2);
    const fallbackKeywords = markedKeywords.length > 0 ? markedKeywords : getHeadlineKeywordCandidates(headline).slice(0, 2);
    const patch: Partial<BulkArticleItem> = {
      sourceType: item.sourceType || 'github',
      cardImagePromptStyleId: GITHUB_IMAGE_STYLE_ID,
      cardImageRatio: item.cardImageRatio || '1:1',
      useAttachedImage: true,
      decorateOriginalPhoto: true,
      aiNewsBadgeStyleId: randomGithubBadgeStyleId(),
      fontPaletteId: item.fontPaletteId || 'black-yellow-white',
      markedKeywords: fallbackKeywords,
      smartHeadlineNote: headline
        ? buildThaiHeadlineSelectionNote(headline, fallbackKeywords, 1)
        : item.smartHeadlineNote,
    };

    const itemForPick = { ...item, ...patch };
    const picked = await pickRandomGithubStockImage(itemForPick);
    if (picked.imageUrl) {
      const images = [picked.imageUrl, ...(item.images || []).filter(img => img !== picked.imageUrl)];
      patch.images = images;
      patch.selectedImageUrl = picked.imageUrl;
      patch.smartSelectedImageIndex = 0;
      patch.smartSelectedImageReason = `สุ่มจากคลัง GitHub หัวข้อ ${picked.topicLabel}${picked.fileName ? `: ${picked.fileName}` : ''}`;
      patch.smartConfigNote = `${notePrefix} → Github สุ่มรูปจากคลังหัวข้อ ${picked.topicLabel} + สุ่มกรอบซ้ายบน + มาร์กคำสำคัญ`;
    } else {
      patch.selectedImageUrl = item.selectedImageUrl || item.images?.[0] || '';
      patch.smartSelectedImageReason = picked.error || 'ยังสุ่มรูป GitHub ไม่สำเร็จ';
      patch.smartConfigNote = `${notePrefix} → ตั้งเป็น Github แล้ว แต่ยังไม่ได้รูปจากคลัง${picked.topicLabel ? `หัวข้อ ${picked.topicLabel}` : ''}${picked.error ? ` (${picked.error})` : ''}`;
    }
    return patch;
  };

  const applyGithubDefaultsToSelected = async () => {
    const targets = bulkItems.filter(item => item.isSelected && isGithubBulkItem(item));
    if (targets.length === 0) return alert('ไม่เจอรายการ GitHub ที่เลือกไว้');

    setIsApplyingGithubDefaults(true);
    try {
      const patches: Record<string, Partial<BulkArticleItem>> = {};
      for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        setSmartConfigLog(`🧩 (${i + 1}/${targets.length}) เติมค่า GitHub + สุ่มรูป/กรอบ/คำสำคัญ...`);
        patches[item.id] = await buildGithubReadyPatch(item, 'เติมค่า GitHub');
      }
      setBulkItems(prev => prev.map(item => patches[item.id] ? { ...item, ...patches[item.id] } : item));
      setBulkProcessLog(`🧩 เติมค่า GitHub ให้รายการที่เลือกแล้ว ${targets.length} รายการ: สุ่มรูปจากคลัง, สุ่มกรอบซ้ายบน, มาร์กคำสำคัญ`);
      setSmartConfigLog('');
    } catch (e: any) {
      alert(`เติมค่า GitHub ไม่สำเร็จ: ${e.message || 'ไม่ทราบสาเหตุ'}`);
    } finally {
      setIsApplyingGithubDefaults(false);
    }
  };

  const recoverCachedArticlesToBulk = async () => {
    setIsRecoveringCache(true);
    try {
      let cache = articleCache;
      if (Object.keys(cache).length === 0) {
        const res = await fetch('/api/article-cache');
        const data = await res.json();
        if (data && typeof data === 'object') {
          cache = data;
          setArticleCache(data);
        }
      }

      const limit = Math.max(1, Math.min(1000, Number(recoverCacheLimit) || 100));
      const existingKeys = new Set(bulkItems.map(item => articleKey(item.rawArticle)));
      const completedUrls = new Set(
        [
          ...savedResults.map((result: any) => String(result?.sourceUrl || result?.sourceMeta?.sourceUrl || '').trim()),
          ...exportedCsvRefs.urls.map(url => String(url || '').trim()),
        ].filter(Boolean),
      );
      const completedHeadlines = new Set(
        [
          ...savedResults.map((result: any) => String(result?.headline || result?.selectedHeadline || result?.sourceMeta?.selectedHeadline || '').trim()),
          ...exportedCsvRefs.headlines.map(headline => String(headline || '').trim()),
        ].filter(Boolean),
      );
      const entriesToRecover = Object.values(cache)
        .filter((entry: any) => entry?.rawArticle && entry?.generatedArticle)
        .sort((a: any, b: any) =>
          String(b.lastUpdatedAt || b.cachedAt || '').localeCompare(String(a.lastUpdatedAt || a.cachedAt || ''))
        )
        .filter((entry: any) => {
          if (entry.imageUrl || entry.localImageUrl || entry.dropboxUrl) return false;
          if (entry.imageCompletedAt || entry.resultSavedAt || entry.exportedCsvAt) return false;
          if (existingKeys.has(articleKey(entry.rawArticle))) return false;
          const sourceUrl = String(entry.sourceUrl || '').trim();
          const headline = String(entry.selectedHeadline || '').trim();
          if (sourceUrl && completedUrls.has(sourceUrl)) return false;
          if (headline && completedHeadlines.has(headline)) return false;
          return true;
        })
        .slice(0, limit);

      const recovered: BulkArticleItem[] = [];
      for (let i = 0; i < entriesToRecover.length; i++) {
        const entry: any = entriesToRecover[i];
        const generatedHeadlines = Array.isArray(entry.generatedHeadlines)
          ? entry.generatedHeadlines.filter(Boolean)
          : [];
        const selectedHeadline = String(entry.selectedHeadline || generatedHeadlines[0] || '').trim();
        let item = makeDefaultBulkItem({
          title: selectedHeadline || String(entry.sourceUrl || '').replace(/^https?:\/\//, '') || String(entry.rawArticle).slice(0, 80),
          rawArticle: entry.rawArticle,
          sourceUrl: entry.sourceUrl || '',
          generatedArticle: entry.generatedArticle || '',
          generatedCommentPost: entry.generatedCommentPost || entry.commentPostText || '',
          generatedHeadlines,
          selectedHeadline,
          isSelected: true,
          status: 'article-done',
          sourceType: /github\.com/i.test(`${entry.sourceUrl || ''} ${entry.rawArticle || ''}`) ? 'github' : entry.sourceType || '',
          tags: Array.from(new Set(['recovered-cache', ...(entry.tags || []), /github\.com/i.test(`${entry.sourceUrl || ''} ${entry.rawArticle || ''}`) ? 'github' : ''].filter(Boolean))),
          smartConfigNote: `กู้คืนจาก cache เดิม ${entry.lastUpdatedAt || entry.cachedAt || ''}`.trim(),
        });
        const inferredFormat = inferContentFormat(item.sourceType, item.tags || []);
        item = {
          ...item,
          contentFormat: inferredFormat,
          imageSourceMode: inferImageSourceMode(item.sourceType, item.images || []),
          cardImagePromptStyleId: item.cardImagePromptStyleId || (inferredFormat === 'quote' ? QUOTE_IMAGE_STYLE_ID : inferredFormat === 'editorial' ? EDITORIAL_IMAGE_STYLE_ID : ''),
          fontPaletteId: item.fontPaletteId || (inferredFormat === 'quote' ? 'tg-graphite-gold' : 'tg-classic'),
        };
        if (isGithubBulkItem(item)) {
          setBulkProcessLog(`♻️ กู้คืน ${i + 1}/${entriesToRecover.length}: เติมค่า GitHub และสุ่มรูปจากคลัง...`);
          item = { ...item, ...(await buildGithubReadyPatch(item, 'กู้คืนจาก cache')) };
        }
        recovered.push(item);
      }

      if (recovered.length === 0) {
        alert('ยังไม่เจอบทความใน cache ที่ยังไม่ได้อยู่ในกล่องงาน');
        return;
      }

      setBulkItems(prev => [...recovered, ...prev]);
      setBulkProcessLog(`♻️ กู้คืนบทความจาก cache กลับมา ${recovered.length} รายการ เลือกไว้ให้แล้ว พร้อมทยอยกดสร้างรูป`);
    } catch (e: any) {
      alert(`กู้คืนไม่สำเร็จ: ${e.message || 'ไม่ทราบสาเหตุ'}`);
    } finally {
      setIsRecoveringCache(false);
    }
  };

  const attachedPostStyles = writingStyles;
  const commentPostStyles = writingStyles;
  const defaultAttachedPostStyleId = writingStyles.find(s => s.name.trim() === 'AI Trendtech')?.id || writingStyles[0]?.id || '';
  const defaultCommentPostStyleId = writingStyles.find(s => s.name.trim() === 'โพสเพจAI')?.id || writingStyles[0]?.id || '';

  useEffect(() => {
    if (defaultAttachedPostStyleId && !selectedStyleId) {
      setSelectedStyleId(defaultAttachedPostStyleId);
    }
    if (defaultCommentPostStyleId && !selectedCommentStyleId) {
      setSelectedCommentStyleId(defaultCommentPostStyleId);
    }
    if (!defaultAttachedPostStyleId && !defaultCommentPostStyleId) return;
    setBulkItems(prev => prev.map(item => ({
      ...item,
      writingStyleId: item.writingStyleId || defaultAttachedPostStyleId,
      commentStyleId: item.commentStyleId || defaultCommentPostStyleId,
    })));
  }, [defaultAttachedPostStyleId, defaultCommentPostStyleId, selectedStyleId, selectedCommentStyleId]);

  useEffect(() => {
    setBulkMainSettings(prev => ({
      ...prev,
      writingStyleId: prev.writingStyleId || defaultAttachedPostStyleId,
      commentStyleId: prev.commentStyleId || defaultCommentPostStyleId,
    }));
  }, [defaultAttachedPostStyleId, defaultCommentPostStyleId]);

  const getBulkArticleMemory = () => localStorage.getItem('aipage_bulk_article_feedback_memory') || '';
  const saveBulkArticleMemory = (feedback: string) => {
    const prev = getBulkArticleMemory();
    const next = [prev, `- ${feedback.trim()}`].filter(Boolean).join('\n').slice(-4000);
    localStorage.setItem('aipage_bulk_article_feedback_memory', next);
  };

  const getArticleLengthOption = (id: string) => ARTICLE_LENGTH_OPTIONS.find(opt => opt.id === id) || ARTICLE_LENGTH_OPTIONS[1];

  const buildBulkArticlePrompt = (item: BulkArticleItem, styleContent: string, feedback?: string) => {
    const length = getArticleLengthOption(item.articleLength);
    const memory = getBulkArticleMemory();
    const credit = item.sourceUrl?.trim() ? `\n\nต้องใส่เครดิตต้นทางท้ายโพสต์แบบสุภาพ: ที่มา: ${item.sourceUrl.trim()}` : '';
    return `You are a professional Thai social media page writer.
Write an engaging Thai page post based on this raw article:
"${item.rawArticle}"

Use this writing style template for tone and formatting:
"${styleContent}"

Target length: ${length.hint} (${length.range} Thai characters). Keep it natural, not padded.
Formatting rules for Facebook:
- Preserve clean paragraph breaks.
- Use short paragraphs, about 1-3 lines each.
- Put a blank line between major ideas.
- Do not use Markdown formatting such as **bold**, # headings, or bullet asterisks.
- If you need a list, use simple numbered lines like "1." and keep each item readable.
${memory ? `\nPersistent writing feedback to apply from previous edits:\n${memory}\n` : ''}
${feedback ? `\nSpecific feedback for this rewrite:\n${feedback}\n` : ''}
${credit}

Return only the final post text.`;
  };

  const buildCommentPostPrompt = (raw: string, styleContent: string, sourceUrl?: string, feedback?: string) => {
    const credit = sourceUrl?.trim() ? `\n\nถ้ามีลิงก์ต้นทาง ให้ใส่ไว้ในใต้เม้นส่วน 3/3 แบบสุภาพ: ที่มา: ${sourceUrl.trim()}` : '';
    return `You are a professional Thai Facebook clickbait caption writer.
Create a SHORT Facebook post with a comment-thread version from this raw article:
"${raw}"

Use this writing style and examples strictly:
"${styleContent}"

Required output format, matching the CSV examples with columns แคปชั่น, ใต้เม้น1, ใต้เม้น2, ใต้เม้น3:
แคปชั่น:
[write one short catchy caption, 1-3 lines, clickbait style, clearly implying there is more in the comments]

ใต้เม้น1:
[first comment section]

ใต้เม้น2:
[second comment section]

ใต้เม้น3:
[third comment section with CTA/source if available]
${feedback ? `\nSpecific feedback for this rewrite:\n${feedback}\n` : ''}
${credit}

Return only the final Thai text in the required format.`;
  };

  const formatSubscriberCount = (count?: number) => {
    if (typeof count !== 'number' || Number.isNaN(count)) return '';
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1)}M subscribers`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(count >= 10_000 ? 0 : 1)}K subscribers`;
    return `${count.toLocaleString()} subscribers`;
  };

  const validateYoutubeImageStyleRequired = (item: BulkArticleItem) => {
    const missing: string[] = [];
    if (!item.ytExtracted) missing.push('สถานะ "ดึง Script + แคปรูปจาก YouTube แล้ว"');
    if (!item.useAttachedImage || !item.selectedImageUrl) missing.push('รูปคนสำหรับ Image-to-Image');
    return missing;
  };

  const getYoutubeImageStyleWarnings = (item: BulkArticleItem) => {
    const warnings: string[] = [];
    if (!item.channelName?.trim()) warnings.push('ไม่มีชื่อช่อง จะไม่ใส่ชื่อช่องใน channel card');
    if (!item.channelLogoUrl?.trim()) warnings.push('ไม่มีโลโก้ช่อง จะใช้รูปคนที่แนบแทนโลโก้');
    if (typeof item.subscriberCount !== 'number') warnings.push('ไม่มีจำนวนผู้ติดตาม จะไม่ใส่จำนวนผู้ติดตามในรูป');
    return warnings;
  };

  const validateAiNewsImageStyleRequired = (item: BulkArticleItem) => {
    const missing: string[] = [];
    if (!item.useAttachedImage || !item.selectedImageUrl) missing.push('รูปข่าวสำหรับ Image-to-Image');
    return missing;
  };

  const createYoutubeImagePromptJson = (item: BulkArticleItem) => {
    const subscribers = formatSubscriberCount(item.subscriberCount);
    const channelLogoSource = item.channelLogoUrl || item.selectedImageUrl;
    const channelLogoInstruction = item.channelLogoUrl
      ? `Use the real channel logo from this URL: ${item.channelLogoUrl}.`
      : `No real channel logo is available, so use a small cropped circular version of the attached person reference image as the channel avatar/logo fallback.`;
    const channelNameInstruction = item.channelName?.trim()
      ? `Channel name "${item.channelName.trim()}".`
      : 'No channel name is available, so omit channel name text from the channel card.';
    const subscriberInstruction = subscribers
      ? `Subscriber text "${subscribers}".`
      : 'No subscriber count is available, so do not write any subscriber count or placeholder text in the image.';
    const supportingImages = (item.images || []).filter(img => img !== item.selectedImageUrl).slice(0, 4);
    const subjectInstruction = item.decorateOriginalPhoto
      ? [
          'IMPORTANT: Treat the attached reference image as the final base photo, not as loose inspiration.',
          'Keep the original person, face, skin texture, hair, clothes, pose, camera angle, lighting, and room/background as close to the source photo as possible.',
          'Do not beautify, redesign, replace, age-change, outfit-change, or turn the person into an AI portrait.',
          'Only decorate on top of and around the original photo: add readable Thai headline typography, highlight blocks, arrows, channel card, subtle business/AI graphic stickers, glow accents, and framing. The result should still feel like a real screenshot/photo that was edited by a designer.',
        ].join(' ')
      : 'Use the attached reference image as the main human subject: preserve the person identity, face, pose direction, clothing, and realistic lighting as much as possible. Place the person large in the upper center, cinematic crop, sharp facial focus, confident expression, strong depth and soft background blur.';
    const corePrompt = [
      'Create a high-share Thai social media thumbnail/poster inspired by a premium YouTube documentary thumbnail.',
      subjectInstruction,
      `Main Thai headline text must be exactly: "${item.selectedHeadline}".`,
      'Design the headline as bold Thai typography in the lower half with strong hierarchy, white/yellow text, black shadow glow, and selective red/blue rectangular highlight blocks behind only the most important words. Keep the text readable on mobile and do not cover the face.',
      `Add a floating YouTube channel card near the lower-right of the portrait area: ${channelLogoInstruction} Channel avatar/logo source: ${channelLogoSource}. ${channelNameInstruction} ${subscriberInstruction} The card should look like a dark rounded YouTube info badge with white border and subtle shadow.`,
      supportingImages.length > 0 ? `Use these captured YouTube frames as optional visual inspiration/background accents only, not as the main subject: ${supportingImages.join(', ')}` : '',
      'Add tasteful AI/business/digital-product visual elements where relevant: small circular app badges, soft arrows, glow accents, product icons, charts, documents, screens, or money/automation motifs. Keep them premium and not cluttered.',
      'Do not include any top-right brand logo or watermark. Leave the top-right area clean because the creator will add their own logo later.',
      'Overall mood: dramatic, modern, shareable, Thai entrepreneur/AI education page style, high contrast, polished poster composition, realistic person plus graphic overlays, clean professional finish.',
    ].filter(Boolean).join(' ');

    return JSON.stringify({
      core_prompt: corePrompt,
      negative_prompt: item.decorateOriginalPhoto
        ? 'AI portrait look, over-smoothed skin, changed face, changed identity, changed clothes, changed room, changed camera angle, fantasy background, extra watermark, top-right logo, fake creator logo, unreadable text, misspelled Thai text, distorted face, deformed hands, duplicate person, low quality, blurry, messy layout, too much text, text covering eyes or mouth'
        : 'extra watermark, top-right logo, fake creator logo, unreadable text, misspelled Thai text, distorted face, deformed hands, duplicate person, low quality, blurry, messy layout, too much text, text covering eyes or mouth',
      style_name: 'รูปจากyoutube',
      edit_mode: item.decorateOriginalPhoto ? 'decorate_original_photo_only' : 'enhanced_thumbnail_recreation',
      channel_card: {
        channel_name: item.channelName?.trim() || '',
        channel_logo_url: channelLogoSource,
        channel_logo_fallback_used: !item.channelLogoUrl,
        subscribers,
        omit_subscribers: !subscribers,
      },
    }, null, 2);
  };

  const createAiNewsImagePromptJson = (item: BulkArticleItem) => {
    const supportingImages = (item.images || []).filter(img => img !== item.selectedImageUrl).slice(0, 4);
    const badge = AI_NEWS_BADGE_STYLES.find(s => s.id === item.aiNewsBadgeStyleId) || AI_NEWS_BADGE_STYLES[0];
    const subjectInstruction = item.decorateOriginalPhoto
      ? [
          'IMPORTANT: Treat the attached news image as the final base photo.',
          'Keep the original photo, people, object, place, composition, lighting, and news context as close to the source as possible.',
          'Only add editorial design on top: Thai headline, subtle AI/technology visual accents, information blocks, and a top-left "ข่าวAI" label.',
          'Do not replace the main subject, do not invent a different event, and do not turn it into a generic stock illustration.',
        ].join(' ')
      : 'Use the attached news image as the main reference and recreate it as a premium Thai AI-news social poster while preserving the core event/context, subject, composition, and realistic lighting.';
    const corePrompt = [
      'Create a polished Thai AI-news social media poster for Facebook.',
      subjectInstruction,
      `Main Thai headline text must be exactly: "${item.selectedHeadline}".`,
      'Design readable Thai typography with strong hierarchy, editorial news energy, modern AI/tech visual language, and high contrast. Keep the key subject visible and avoid covering important faces or product details.',
      `Add a top-left edge-attached news label that reads exactly "ข่าวAI". Badge style: ${badge.name}, background ${badge.bg}, text ${badge.fg}, accent ${badge.accent}. The label must touch the top-left image edge like a professional newsroom strap.`,
      supportingImages.length > 0 ? `Use these additional news images only as optional context accents: ${supportingImages.join(', ')}` : '',
      'Add subtle AI visual cues only where useful: neural grid lines, tiny chip icons, data glow, scanning frame, or clean tech overlay. Avoid clutter and fake UI overload.',
      'Do not include unrelated logos, fake watermarks, misspelled Thai, unreadable text, or extra headline variations.',
      'Overall mood: credible, urgent but premium, Thai AI news page, clean editorial composition, mobile readable.',
    ].filter(Boolean).join(' ');

    return JSON.stringify({
      core_prompt: corePrompt,
      negative_prompt: item.decorateOriginalPhoto
        ? 'changed event, changed subject, generic stock photo, fake person, fake logo, extra watermark, unreadable Thai text, misspelled Thai, distorted face, deformed hands, low quality, blurry, messy layout, too much text, text covering main subject'
        : 'generic stock photo, unrelated event, fake logo, extra watermark, unreadable Thai text, misspelled Thai, distorted face, deformed hands, low quality, blurry, messy layout, too much text, text covering main subject',
      style_name: 'ข่าวAI',
      edit_mode: item.decorateOriginalPhoto ? 'decorate_original_news_photo_only' : 'ai_news_image_to_image_recreation',
      news_badge: {
        text: 'ข่าวAI',
        style_id: badge.id,
        style_name: badge.name,
        position: 'top-left-edge-attached',
        colors: { bg: badge.bg, fg: badge.fg, accent: badge.accent, border: badge.border },
      },
    }, null, 2);
  };

  const createGithubImagePromptJson = (item: BulkArticleItem) => {
    const badge = GITHUB_BADGE_STYLES.find(s => s.id === item.aiNewsBadgeStyleId) || GITHUB_BADGE_STYLES[0];
    return JSON.stringify({
      core_prompt: [
        'Create a Thai GitHub recommendation social poster using the selected stock image as the base.',
        `Main Thai headline text must be exactly: "${item.selectedHeadline}".`,
        `Add a top-left editorial GitHub strap label "${badge.label}" with secondary label "${badge.subLabel}".`,
        'Keep the image clean, high contrast, mobile readable, and suitable for recommending useful developer tools from GitHub.',
      ].join(' '),
      negative_prompt: 'unreadable Thai text, misspelled Thai, fake watermark, cluttered layout, low quality, blurry',
      style_name: 'Github',
      edit_mode: 'decorate_github_stock_photo_on_canvas',
      github_badge: {
        style_id: badge.id,
        label: badge.label,
        sub_label: badge.subLabel,
        colors: { bg: badge.bg, fg: badge.fg, accent: badge.accent, border: badge.border },
      },
    }, null, 2);
  };

  const createEditorialImagePromptJson = (item: BulkArticleItem) => JSON.stringify({
    core_prompt: [
      'Create a premium Thai social media editorial card inspired by bold financial/news content factories.',
      `Main Thai headline text must be exactly: "${item.selectedHeadline}".`,
      'Use a strong poster layout: large readable Thai headline, 2-4 visual lines, bold color blocks behind key words, high contrast, clean newsroom/commercial design.',
      'If a reference image is attached, preserve the main subject/context and decorate it with typography, gradients, straps, arrows, and subtle data/AI/business accents. If no reference image is attached, create a relevant realistic editorial background from the article.',
      'Use a vivid but professional palette like red/yellow/blue, emerald/gold, graphite/gold, orange/teal, or navy/coral. Keep it mobile readable and avoid clutter.',
      'Do not add fake watermarks, random logos, unreadable Thai, extra headline alternatives, or text covering important faces/products.',
    ].join(' '),
    negative_prompt: 'unreadable Thai text, misspelled Thai, extra watermark, fake logo, cluttered layout, low quality, blurry, distorted face, deformed hands, too much text, text covering eyes',
    style_name: 'Editorial แบบ Top Gainers',
    edit_mode: item.decorateOriginalPhoto ? 'decorate_original_editorial_photo_on_canvas' : 'editorial_text_to_image',
  }, null, 2);

  const createQuoteImagePromptJson = (item: BulkArticleItem) => JSON.stringify({
    core_prompt: [
      'Create a premium Thai quote card / famous-person lesson poster for a Facebook page.',
      `Main Thai quote or headline text must be exactly: "${item.selectedHeadline}".`,
      'Use elegant bold Thai typography with quotation marks, strong hierarchy, generous spacing, and one accent color for the most important phrase.',
      'If a reference portrait/image is attached, keep the person/source image recognizable and add tasteful quote typography on top. If no reference image is attached, create a cinematic portrait/editorial background that matches the article context.',
      'Design mood: credible, inspiring, smart, not cheesy. Good for lessons, business wisdom, AI lessons, creator lessons, and famous-person teaching content.',
      'Do not add fake signatures, random logos, unreadable Thai, extra quote variants, or messy decorative text.',
    ].join(' '),
    negative_prompt: 'unreadable Thai text, misspelled Thai, fake signature, fake watermark, messy layout, low quality, blurry, distorted face, deformed hands, text covering eyes',
    style_name: 'Quote / คำสอนคนดัง',
    edit_mode: item.decorateOriginalPhoto ? 'decorate_original_quote_photo_on_canvas' : 'quote_text_to_image',
  }, null, 2);

  const loadCanvasImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    if (!src) {
      reject(new Error('ไม่มีรูปต้นแบบสำหรับสร้าง Canvas'));
      return;
    }
    const img = new Image();
    if (!src.startsWith('data:image')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // External URL failed directly — retry through server-side proxy (bypasses CORS)
      if (src.startsWith('http')) {
        const proxied = new Image();
        proxied.crossOrigin = 'anonymous';
        proxied.onload = () => resolve(proxied);
        proxied.onerror = () => reject(new Error('โหลดรูปไม่สำเร็จ'));
        proxied.src = `/api/proxy-image?url=${encodeURIComponent(src)}`;
      } else if (src.startsWith('/api/local-stock-image')) {
        const retry = new Image();
        retry.onload = () => resolve(retry);
        retry.onerror = () => reject(new Error('โหลดรูปจากคลัง GitHub ไม่สำเร็จ'));
        retry.src = `${src}${src.includes('?') ? '&' : '?'}t=${Date.now()}`;
      } else {
        reject(new Error(`โหลดรูปไม่สำเร็จ (${src.slice(0, 80)})`));
      }
    };
    img.src = src;
  });

  const wrapCanvasText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    // Character-level break for a single token wider than maxWidth (handles Thai without spaces)
    const breakWord = (word: string): string[] => {
      if (ctx.measureText(word).width <= maxWidth) return [word];
      const parts: string[] = [];
      let chars = '';
      for (const ch of word) {
        const test = chars + ch;
        if (ctx.measureText(test).width > maxWidth && chars) {
          parts.push(chars);
          chars = ch;
        } else {
          chars = test;
        }
      }
      if (chars) parts.push(chars);
      return parts.length ? parts : [word];
    };

    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth) {
        if (line) lines.push(line);
        // If the word itself is too wide, break it character by character
        const broken = breakWord(word);
        broken.slice(0, -1).forEach(part => lines.push(part));
        line = broken[broken.length - 1] || '';
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [text];
  };

  const splitHeadlineForCanvas = (headline: string) => headline
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const fitCanvasHeadlineLayout = (
    ctx: CanvasRenderingContext2D,
    headline: string,
    maxWidth: number,
    maxHeight: number,
    baseFontSize: number,
    minFontSize: number,
    maxVisualLines: number,
  ) => {
    const rawLines = splitHeadlineForCanvas(headline);
    const sourceLines = rawLines.length ? rawLines : [headline.replace(/\s+/g, ' ').trim()];
    const lineHeightRatio = 1.12;
    const fontFor = (size: number) => `900 ${size}px Kanit, Prompt, Arial, sans-serif`;

    // First try hard to preserve the AI headline's intended 3-line structure.
    for (let size = baseFontSize; size >= minFontSize; size -= 2) {
      ctx.font = fontFor(size);
      const fitsWidth = sourceLines.every(line => ctx.measureText(line).width <= maxWidth);
      const fitsHeight = sourceLines.length * size * lineHeightRatio <= maxHeight;
      if (fitsWidth && fitsHeight && sourceLines.length <= maxVisualLines) {
        return {
          lines: sourceLines,
          fontSize: size,
          lineHeight: size * lineHeightRatio,
          truncated: false,
        };
      }
    }

    // If a line is genuinely too long, wrap each source line, then fit the whole block.
    for (let size = Math.min(baseFontSize, Math.max(minFontSize, baseFontSize - 6)); size >= minFontSize; size -= 2) {
      ctx.font = fontFor(size);
      const wrapped = sourceLines.flatMap(line => wrapCanvasText(ctx, line, maxWidth));
      const fitsHeight = wrapped.length * size * lineHeightRatio <= maxHeight;
      if (wrapped.length <= maxVisualLines && fitsHeight) {
        return {
          lines: wrapped,
          fontSize: size,
          lineHeight: size * lineHeightRatio,
          truncated: false,
        };
      }
    }

    ctx.font = fontFor(minFontSize);
    const fallback = sourceLines.flatMap(line => wrapCanvasText(ctx, line, maxWidth));
    const allowedLines = Math.max(1, Math.min(maxVisualLines, Math.floor(maxHeight / (minFontSize * lineHeightRatio))));
    const lines = fallback.slice(0, allowedLines);
    if (fallback.length > allowedLines && lines.length) {
      const last = lines[lines.length - 1];
      let clipped = last;
      while (clipped.length > 1 && ctx.measureText(`${clipped}...`).width > maxWidth) clipped = clipped.slice(0, -1);
      lines[lines.length - 1] = `${clipped}...`;
    }
    return {
      lines,
      fontSize: minFontSize,
      lineHeight: minFontSize * lineHeightRatio,
      truncated: fallback.length > allowedLines,
    };
  };

  const drawRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  };

  const getCanvasSizeForRatio = (ratio: string) => {
    if (ratio === '9:16') return { width: 1080, height: 1920 };
    if (ratio === '16:9') return { width: 1280, height: 720 };
    return { width: 1080, height: 1080 };
  };

  const drawCoverImage = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) => {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(w / iw, h / ih);
    const sw = w / scale;
    const sh = h / scale;
    const sx = Math.max(0, (iw - sw) / 2);
    const sy = Math.max(0, (ih - sh) * 0.34);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  };

  const getHeadlineKeywordCandidates = (headline: string) => {
    const clean = headline.replace(/[“”"!?？,，.:;()]/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = clean.split(' ').map(part => part.trim()).filter(part => part.length >= 2);
    const seen = new Set<string>();
    return parts.filter(part => {
      const normalized = part.replace(/[^\p{L}\p{N}%$฿]/gu, '');
      const key = normalized.toLowerCase();
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return normalized.length >= 2;
    }).slice(0, 14);
  };

  const toggleMarkedKeyword = (itemId: string, keyword: string) => {
    const item = bulkItems.find(b => b.id === itemId);
    if (!item) return;
    const exists = item.markedKeywords.includes(keyword);
    updateBulkItem(itemId, {
      markedKeywords: exists
        ? item.markedKeywords.filter(k => k !== keyword)
        : [...item.markedKeywords, keyword],
    });
  };

  const drawHighlightedTextLine = (
    ctx: CanvasRenderingContext2D,
    line: string,
    x: number,
    y: number,
    fontSize: number,
    maxWidth: number,
    palette: typeof YOUTUBE_FONT_PALETTES[number],
    markedKeywords: string[],
    lineIndex: number,
  ) => {
    const tokens = line.split(/(\s+)/);
    let cursorX = x;
    const marked = markedKeywords.map(k => k.toLowerCase());
    const lineTextWidth = ctx.measureText(line).width;
    const shouldLineBlock = marked.length === 0 && (lineIndex === 1 || /รวย|เงิน|SaaS|AI|ธุรกิจ|ล้าน|ง่าย/.test(line));

    if (shouldLineBlock) {
      ctx.fillStyle = lineIndex % 2 === 0 ? palette.altBlock : palette.block;
      ctx.save();
      ctx.translate(x - 8, y - 2);
      ctx.rotate(lineIndex % 2 === 0 ? -0.015 : 0.012);
      ctx.fillRect(0, 0, Math.min(lineTextWidth + 24, maxWidth + 16), fontSize * 1.04);
      ctx.restore();
    }

    tokens.forEach((token) => {
      const tokenWidth = ctx.measureText(token).width;
      const plain = token.trim().toLowerCase();
      const isMarked = plain && marked.some(k => plain.includes(k) || k.includes(plain));

      if (isMarked) {
        ctx.fillStyle = lineIndex % 2 === 0 ? palette.block : palette.altBlock;
        drawRoundRect(ctx, cursorX - 6, y - 2, tokenWidth + 12, fontSize * 1.04, Math.max(6, fontSize * 0.08));
        ctx.fill();
      }

      ctx.lineWidth = Math.max(5, fontSize * 0.12);
      ctx.strokeStyle = palette.stroke;
      ctx.strokeText(token, cursorX, y);
      ctx.fillStyle = isMarked || /SaaS|AI|\$|เงิน|รวย|ล้าน|สำคัญ|ด่วน/.test(token) ? palette.accent : palette.primary;
      ctx.fillText(token, cursorX, y);
      cursorX += tokenWidth;
    });
  };

  const drawAiNewsBadge = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    styleId?: string,
  ) => {
    const style = AI_NEWS_BADGE_STYLES.find(s => s.id === styleId) || AI_NEWS_BADGE_STYLES[0];
    const badgeH = Math.max(58, Math.min(92, h * 0.085));
    const badgeW = Math.max(210, Math.min(330, w * 0.30));
    const notch = badgeH * 0.34;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(badgeW, 0);
    ctx.lineTo(badgeW + notch, badgeH / 2);
    ctx.lineTo(badgeW, badgeH);
    ctx.lineTo(0, badgeH);
    ctx.closePath();
    ctx.fillStyle = style.bg;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = style.border;
    ctx.lineWidth = Math.max(3, w * 0.003);
    ctx.stroke();
    ctx.fillStyle = style.accent;
    ctx.fillRect(0, badgeH - Math.max(6, badgeH * 0.08), badgeW * 0.74, Math.max(6, badgeH * 0.08));
    ctx.fillStyle = style.fg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.floor(badgeH * 0.42)}px Kanit, Prompt, Arial, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.strokeText('ข่าวAI', badgeH * 0.28, badgeH * 0.50);
    ctx.fillText('ข่าวAI', badgeH * 0.28, badgeH * 0.50);
    ctx.restore();
  };

  const renderYoutubeOverlayImage = async (task: GenerationTask, headline: string) => {
    const base = await loadCanvasImage(task.referenceImageUrl);
    const canvas = document.createElement('canvas');
    const targetSize = getCanvasSizeForRatio(task.imageRatio);
    canvas.width = targetSize.width;
    canvas.height = targetSize.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas ไม่พร้อมใช้งาน');

    const w = canvas.width;
    const h = canvas.height;
    const palette = YOUTUBE_FONT_PALETTES.find(p => p.id === task.localYoutubeOverlay?.fontPaletteId) || YOUTUBE_FONT_PALETTES[0];
    drawCoverImage(ctx, base, w, h);
    const overlayKind = task.localYoutubeOverlay?.overlayKind || 'youtube';
    const isGithubOverlay = overlayKind === 'github';
    const isEditorialOverlay = overlayKind === 'editorial';
    const isQuoteOverlay = overlayKind === 'quote';

    const isPortrait = task.imageRatio === '9:16';
    const isLandscape = task.imageRatio === '16:9';

    // Gradient — deeper on landscape (shorter image needs more contrast coverage)
    const gradStart = isLandscape ? h * 0.28 : isPortrait ? h * 0.45 : isGithubOverlay || isEditorialOverlay || isQuoteOverlay ? h * 0.34 : h * 0.40;
    const bottomGradient = ctx.createLinearGradient(0, gradStart, 0, h);
    bottomGradient.addColorStop(0, 'rgba(0,0,0,0)');
    bottomGradient.addColorStop(0.5, 'rgba(0,0,0,0.60)');
    bottomGradient.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = bottomGradient;
    ctx.fillRect(0, 0, w, h);

    const pad = Math.max(22, w * (isGithubOverlay ? 0.052 : 0.04));
    const headlineMaxW = w - pad * 2;

    // Per-ratio: max lines and initial font size
    const maxLines = isPortrait ? 7 : isLandscape ? 4 : isGithubOverlay || isEditorialOverlay || isQuoteOverlay ? 6 : 5;
    // Max height for text block (reserve bottom zone)
    const maxTextZoneH = isLandscape ? h * 0.50 : isPortrait ? h * 0.42 : isGithubOverlay || isEditorialOverlay || isQuoteOverlay ? h * 0.43 : h * 0.42;

    let fontSize = isPortrait
      ? Math.max(36, Math.floor(w * 0.095))                              // 9:16 → ~102px
      : isLandscape
      ? Math.max(28, Math.floor(Math.min(w * 0.058, h * 0.105)))         // 16:9 → ~74px
      : Math.max(36, Math.floor(w * (isGithubOverlay || isEditorialOverlay || isQuoteOverlay ? 0.065 : 0.072))); // 1:1

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const layout = fitCanvasHeadlineLayout(ctx, headline, headlineMaxW, maxTextZoneH, fontSize, isGithubOverlay ? 34 : 28, maxLines);
    fontSize = layout.fontSize;
    const lines = layout.lines;
    ctx.font = `900 ${fontSize}px Kanit, Prompt, Arial, sans-serif`;

    // Anchor text to bottom, but never let it start above h * 0.52 (keeps image visible)
    const textBlockH = lines.length * layout.lineHeight;
    const minY = isLandscape ? h * 0.38 : isGithubOverlay || isEditorialOverlay || isQuoteOverlay ? h * 0.50 : h * 0.52;
    let y = Math.max(minY, h - pad - textBlockH);
    const panelPad = Math.max(16, fontSize * 0.24);
    if (isGithubOverlay || isEditorialOverlay || isQuoteOverlay) {
      const panelY = Math.max(0, y - panelPad * 0.7);
      const panelH = Math.min(h - panelY, textBlockH + panelPad * 1.65);
      const panelGrad = ctx.createLinearGradient(0, panelY, 0, panelY + panelH);
      panelGrad.addColorStop(0, 'rgba(0,0,0,0.24)');
      panelGrad.addColorStop(0.34, 'rgba(0,0,0,0.68)');
      panelGrad.addColorStop(1, 'rgba(0,0,0,0.90)');
      ctx.fillStyle = panelGrad;
      ctx.fillRect(0, panelY, w, panelH);
      y = Math.min(y, h - pad - textBlockH);
    }

    if (isEditorialOverlay || isQuoteOverlay) {
      const strapLabel = isQuoteOverlay ? 'QUOTE CARD' : 'CONTENT FACTORY';
      const strapSub = isQuoteOverlay ? 'คำสอนคนดัง / บทเรียน' : 'Editorial แบบ Top Gainers';
      const strapH = Math.max(58, Math.min(92, h * 0.085));
      const strapW = Math.max(330, Math.min(540, w * 0.48));
      const strapX = pad;
      const strapY = pad;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 18;
      drawRoundRect(ctx, strapX, strapY, strapW, strapH, 14);
      ctx.fillStyle = isQuoteOverlay ? 'rgba(15,23,42,0.88)' : palette.block;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = Math.max(3, w * 0.003);
      ctx.stroke();
      ctx.fillStyle = palette.accent;
      ctx.fillRect(strapX, strapY + strapH - Math.max(7, strapH * 0.09), strapW * 0.74, Math.max(7, strapH * 0.09));
      ctx.fillStyle = palette.primary;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `900 ${Math.floor(strapH * 0.34)}px Kanit, Prompt, Arial, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeText(strapLabel, strapX + strapH * 0.28, strapY + strapH * 0.48);
      ctx.fillText(strapLabel, strapX + strapH * 0.28, strapY + strapH * 0.48);
      ctx.fillStyle = isQuoteOverlay ? '#cbd5e1' : palette.accent;
      ctx.font = `800 ${Math.floor(strapH * 0.18)}px Kanit, Prompt, Arial, sans-serif`;
      ctx.fillText(strapSub, strapX + strapH * 0.30, strapY + strapH * 0.76);
      if (isQuoteOverlay) {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = palette.accent;
        ctx.font = `900 ${Math.floor(w * 0.34)}px Georgia, serif`;
        ctx.fillText('“', pad, Math.max(h * 0.38, y - fontSize * 0.85));
      }
      ctx.restore();
    }

    if (isEditorialOverlay) {
      const panelH = isLandscape ? h * 0.43 : isPortrait ? h * 0.34 : h * 0.38;
      const panelY = h - panelH;
      const dividerH = Math.max(8, h * 0.008);
      ctx.save();
      const imageShade = ctx.createLinearGradient(0, panelY - h * 0.20, 0, panelY + h * 0.04);
      imageShade.addColorStop(0, 'rgba(0,0,0,0)');
      imageShade.addColorStop(1, 'rgba(0,0,0,0.92)');
      ctx.fillStyle = imageShade;
      ctx.fillRect(0, 0, w, panelY + h * 0.05);
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, panelY, w, panelH);
      ctx.fillStyle = palette.block;
      ctx.fillRect(0, panelY, w, dividerH);

      const editorialLines = lines.length ? lines : splitHeadlineForCanvas(headline);
      const firstLine = editorialLines[0] || headline;
      const restLines = editorialLines.slice(1, 4);
      const headlinePad = Math.max(28, w * 0.045);
      const barH = Math.max(62, Math.min(92, panelH * 0.22));
      const barY = panelY + Math.max(38, panelH * 0.09);
      const barW = Math.min(w - headlinePad * 2, Math.max(w * 0.60, ctx.measureText(firstLine).width + headlinePad * 1.35));
      ctx.fillStyle = palette.altBlock;
      ctx.fillRect((w - barW) / 2, barY, barW, barH);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.max(34, Math.floor(barH * 0.58))}px Kanit, Prompt, Arial, sans-serif`;
      ctx.lineWidth = Math.max(5, barH * 0.075);
      ctx.strokeStyle = palette.stroke;
      ctx.strokeText(firstLine, w / 2, barY + barH * 0.53);
      ctx.fillStyle = palette.primary;
      ctx.fillText(firstLine, w / 2, barY + barH * 0.53);

      let textY = barY + barH + Math.max(36, panelH * 0.10);
      const restMaxW = w - headlinePad * 2;
      restLines.forEach((line, idx) => {
        const size = Math.max(38, Math.min(70, Math.floor(w * 0.062)));
        ctx.font = `900 ${size}px Kanit, Prompt, Arial, sans-serif`;
        const wrapped = wrapCanvasText(ctx, line, restMaxW).slice(0, 2);
        wrapped.forEach((wrappedLine) => {
          const lineW = Math.min(restMaxW, ctx.measureText(wrappedLine).width + 26);
          const useBlock = idx % 2 === 1;
          if (useBlock) {
            ctx.fillStyle = palette.altBlock;
            ctx.fillRect((w - lineW) / 2, textY - size * 0.08, lineW, size * 1.08);
          }
          ctx.lineWidth = Math.max(5, size * 0.11);
          ctx.strokeStyle = '#000000';
          ctx.strokeText(wrappedLine, w / 2, textY + size * 0.50);
          ctx.fillStyle = idx === 0 ? '#ffffff' : palette.primary;
          ctx.fillText(wrappedLine, w / 2, textY + size * 0.50);
          textY += size * 1.22;
        });
      });

      ctx.textAlign = 'center';
      ctx.font = `800 ${Math.max(20, Math.floor(w * 0.026))}px Prompt, Kanit, Arial, sans-serif`;
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('เครดิต: วางแผนเป็น เห็นทางรวย', w / 2, Math.min(h - Math.max(28, h * 0.035), textY + Math.max(22, panelH * 0.08)));
      ctx.restore();
      return canvas.toDataURL('image/png');
    }

    lines.forEach((line, index) => {
      drawHighlightedTextLine(
        ctx,
        line,
        pad,
        y,
        fontSize,
        headlineMaxW,
        palette,
        task.localYoutubeOverlay?.markedKeywords || [],
        index,
      );
      y += layout.lineHeight;
    });

    if (overlayKind === 'ai-news') {
      drawAiNewsBadge(ctx, w, h, task.localYoutubeOverlay?.newsBadgeStyleId);
    }
    if (overlayKind === 'github') {
      const ghStyle = GITHUB_BADGE_STYLES.find(s => s.id === task.localYoutubeOverlay?.newsBadgeStyleId) || GITHUB_BADGE_STYLES[0];
      const badgeH = Math.max(64, Math.min(102, h * 0.096));
      const badgeW = Math.max(300, Math.min(470, w * 0.43));
      const badgeX = pad;
      const badgeY = pad + 10;
      const notch = badgeH * 0.28;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(badgeX + 12, badgeY);
      ctx.lineTo(badgeX + badgeW, badgeY);
      ctx.lineTo(badgeX + badgeW + notch, badgeY + badgeH / 2);
      ctx.lineTo(badgeX + badgeW, badgeY + badgeH);
      ctx.lineTo(badgeX + 12, badgeY + badgeH);
      ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - 12);
      ctx.lineTo(badgeX, badgeY + 12);
      ctx.quadraticCurveTo(badgeX, badgeY, badgeX + 12, badgeY);
      ctx.closePath();
      ctx.fillStyle = ghStyle.bg;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = ghStyle.border;
      ctx.lineWidth = Math.max(2, w * 0.0025);
      ctx.stroke();
      ctx.fillStyle = ghStyle.accent;
      ctx.fillRect(badgeX, badgeY + badgeH - Math.max(7, badgeH * 0.09), badgeW * 0.78, Math.max(7, badgeH * 0.09));
      drawRoundRect(ctx, badgeX + badgeH * 0.20, badgeY + badgeH * 0.24, badgeH * 0.52, badgeH * 0.52, badgeH * 0.12);
      ctx.fillStyle = ghStyle.accent;
      ctx.fill();
      ctx.fillStyle = ghStyle.bg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.floor(badgeH * 0.28)}px Kanit, Prompt, Arial, sans-serif`;
      ctx.fillText('</>', badgeX + badgeH * 0.46, badgeY + badgeH * 0.50);
      ctx.fillStyle = ghStyle.fg;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const titleFont = Math.floor(badgeH * 0.32);
      const subFont = Math.floor(badgeH * 0.17);
      ctx.font = `900 ${titleFont}px Kanit, Prompt, Arial, sans-serif`;
      ctx.fillText(ghStyle.label, badgeX + badgeH * 0.88, badgeY + badgeH * 0.49);
      ctx.fillStyle = ghStyle.accent;
      ctx.font = `800 ${subFont}px Kanit, Prompt, Arial, sans-serif`;
      ctx.fillText(ghStyle.subLabel, badgeX + badgeH * 0.90, badgeY + badgeH * 0.76);
      ctx.restore();
    }


    const meta = task.localYoutubeOverlay;
    if (overlayKind === 'youtube' && meta && (meta.channelName || meta.subscriberText || meta.channelLogoUrl)) {
      const cardW = Math.min(w * 0.42, 420);
      const cardH = Math.max(58, h * 0.11);
      const cardX = w - cardW - pad;
      const cardY = Math.max(pad, h * 0.52 - cardH);
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 18;
      drawRoundRect(ctx, cardX, cardY, cardW, cardH, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.74)';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();

      const avatarSize = cardH * 0.64;
      const avatarX = cardX + cardH * 0.18;
      const avatarY = cardY + (cardH - avatarSize) / 2;
      try {
        const avatar = await loadCanvasImage(meta.channelLogoUrl || task.referenceImageUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
      } catch {}

      const textX = avatarX + avatarSize + cardH * 0.18;
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${Math.max(16, cardH * 0.27)}px Arial, sans-serif`;
      if (meta.channelName) ctx.fillText(meta.channelName, textX, cardY + cardH * 0.22);
      if (meta.subscriberText) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = `600 ${Math.max(12, cardH * 0.2)}px Arial, sans-serif`;
        ctx.fillText(meta.subscriberText, textX, cardY + cardH * 0.56);
      }
    }

    return canvas.toDataURL('image/png');
  };

  const handleCardGenerateArticleAndHeadlines = async (itemId: string) => {
    const item = bulkItems.find(b => b.id === itemId);
    if (!item || !item.rawArticle.trim()) return alert('⚠️ กรุณาใส่บทความดิบก่อน');
    const style = writingStyles.find(s => s.id === item.writingStyleId);
    const commentStyle = writingStyles.find(s => s.id === item.commentStyleId);
    const pack = headlinePacks.find(p => p.id === item.headlinePackId);
    if (!style) return alert('⚠️ กรุณาเลือกสไตล์เขียนโพสที่แนบรูปในกล่องนี้ก่อน');
    if (!commentStyle) return alert('⚠️ กรุณาเลือกสไตล์เขียนมีใต้คอมเม้นในกล่องนี้ก่อน');
    if (!pack) return alert('⚠️ กรุณาเลือกสไตล์พาดหัวในกล่องนี้ก่อน');
    updateBulkItem(itemId, { status: 'generating-article', errorMsg: '' });
    try {
      const articlePrompt = buildBulkArticlePrompt(item, style.content);
      const commentPostPrompt = buildCommentPostPrompt(item.rawArticle, commentStyle.content, item.sourceUrl);
      const headlinePrompt = `คุณเป็นนักเขียนพาดหัว Facebook Page สำหรับคนไทย\nอ่านบทความนี้:\n"""\n${item.rawArticle}\n"""\n\nสร้าง 5 พาดหัวใหม่ให้แมชพลัง/รูปแบบตัวอย่างนี้:\n${pack.headlines.map(h => `- ${h}`).join('\n')}\n\nกติกาบังคับ: ทุกพาดหัวต้องมีภาษาไทย ห้ามอังกฤษล้วน อนุญาตศัพท์อังกฤษเฉพาะชื่อแบรนด์/เทค เช่น AI, AWS, Claude, Cloud ถ้ามีคำไทยประกบ\nตอบพาดหัวละ 1 บรรทัด ไม่ต้องมีเลข ไม่ต้องมีข้อความอื่น`;
      const [articleText, commentPostText, headlineText] = await Promise.all([
        callOpenRouter([{ role: "user", content: articlePrompt }], item.cardTextModel || textModel),
        callOpenRouter([{ role: "user", content: commentPostPrompt }], item.cardTextModel || textModel),
        callOpenRouter([{ role: "user", content: headlinePrompt }], item.cardTextModel || textModel),
      ]);
      const headlineResult = await generateThaiHeadlinesWithRetry(
        item.rawArticle,
        pack,
        item.cardTextModel || textModel,
        headlineText,
      );
      updateBulkItem(itemId, {
        generatedArticle: articleText,
        generatedCommentPost: commentPostText,
        generatedHeadlines: headlineResult.headlines,
        selectedHeadline: headlineResult.selectedHeadline,
        markedKeywords: headlineResult.markedKeywords,
        smartHeadlineNote: headlineResult.note,
        status: 'article-done',
      });
      // Save to article cache
      saveArticleCache(item.rawArticle, {
        sourceUrl: item.sourceUrl,
        generatedArticle: articleText,
        generatedCommentPost: commentPostText,
        generatedHeadlines: headlineResult.headlines,
        selectedHeadline: headlineResult.selectedHeadline,
      });
    } catch (e: any) {
      updateBulkItem(itemId, { status: 'error', errorMsg: e.message });
    }
  };

  const handleCardRegenerateArticle = async (itemId: string) => {
    const item = bulkItems.find(b => b.id === itemId);
    if (!item) return;
    const style = writingStyles.find(s => s.id === item.writingStyleId);
    if (!style) return alert('⚠️ กรุณาเลือกสไตล์เขียนโพสที่แนบรูปก่อน');
    updateBulkItem(itemId, { status: 'generating-article' });
    try {
      const articlePrompt = buildBulkArticlePrompt(item, style.content);
      const text = await callOpenRouter([{ role: "user", content: articlePrompt }], item.cardTextModel || textModel);
      updateBulkItem(itemId, { generatedArticle: text, status: 'article-done' });
    } catch (e: any) {
      updateBulkItem(itemId, { status: 'error', errorMsg: e.message });
    }
  };

  const handleCardRegenerateCommentPost = async (itemId: string) => {
    const item = bulkItems.find(b => b.id === itemId);
    if (!item) return;
    const commentStyle = writingStyles.find(s => s.id === item.commentStyleId);
    if (!commentStyle) return alert('⚠️ กรุณาเลือกสไตล์เขียนมีใต้คอมเม้นก่อน');
    updateBulkItem(itemId, { status: 'generating-article' });
    try {
      const commentPostPrompt = buildCommentPostPrompt(item.rawArticle, commentStyle.content, item.sourceUrl);
      const commentText = await callOpenRouter([{ role: "user", content: commentPostPrompt }], item.cardTextModel || textModel);
      updateBulkItem(itemId, { generatedCommentPost: commentText, status: 'article-done' });
    } catch (e: any) {
      updateBulkItem(itemId, { status: 'error', errorMsg: e.message });
    }
  };

  const handleCardRewriteArticleWithFeedback = async (itemId: string) => {
    const item = bulkItems.find(b => b.id === itemId);
    if (!item || !item.articleFeedback.trim()) return alert('⚠️ กรุณาเขียนคำติชมก่อน');
    const style = writingStyles.find(s => s.id === item.writingStyleId);
    const commentStyle = writingStyles.find(s => s.id === item.commentStyleId);
    if (!style) return alert('⚠️ กรุณาเลือกสไตล์เขียนโพสที่แนบรูปก่อน');
    if (!commentStyle) return alert('⚠️ กรุณาเลือกสไตล์เขียนมีใต้คอมเม้นก่อน');
    saveBulkArticleMemory(item.articleFeedback);
    updateBulkItem(itemId, { status: 'generating-article' });
    try {
      const prompt = buildBulkArticlePrompt(item, style.content, item.articleFeedback);
      const commentPrompt = buildCommentPostPrompt(item.rawArticle, commentStyle.content, item.sourceUrl, item.articleFeedback);
      const [text, commentText] = await Promise.all([
        callOpenRouter([{ role: "user", content: prompt }], item.cardTextModel || textModel),
        callOpenRouter([{ role: "user", content: commentPrompt }], item.cardTextModel || textModel),
      ]);
      updateBulkItem(itemId, {
        generatedArticle: text,
        generatedCommentPost: commentText,
        articleFeedback: '',
        showArticleFeedback: false,
        status: 'article-done',
      });
    } catch (e: any) {
      updateBulkItem(itemId, { status: 'error', errorMsg: e.message });
    }
  };

  const handleCardRegenerateHeadlines = async (itemId: string) => {
    const item = bulkItems.find(b => b.id === itemId);
    if (!item) return;
    const pack = headlinePacks.find(p => p.id === item.headlinePackId);
    if (!pack) return alert('⚠️ กรุณาเลือกสไตล์พาดหัวก่อน');
    updateBulkItem(itemId, { status: 'generating-article' });
    try {
      const headlineResult = await generateThaiHeadlinesWithRetry(item.rawArticle, pack, item.cardTextModel || textModel);
      updateBulkItem(itemId, {
        generatedHeadlines: headlineResult.headlines,
        selectedHeadline: headlineResult.selectedHeadline,
        markedKeywords: headlineResult.markedKeywords,
        smartHeadlineNote: headlineResult.note,
        status: 'article-done',
      });
    } catch (e: any) {
      updateBulkItem(itemId, { status: 'error', errorMsg: e.message });
    }
  };

  const handleCardCreateImage = async (itemId: string) => {
    const item = bulkItems.find(b => b.id === itemId);
    if (!item || !item.selectedHeadline) return alert('⚠️ กรุณาเลือกพาดหัวก่อน');
    const isYoutubeImageStyle = item.cardImagePromptStyleId === YOUTUBE_IMAGE_STYLE_ID;
    const isAiNewsImageStyle = item.cardImagePromptStyleId === AI_NEWS_IMAGE_STYLE_ID;
    const isGithubImageStyle = item.cardImagePromptStyleId === GITHUB_IMAGE_STYLE_ID;
    const isEditorialImageStyle = item.cardImagePromptStyleId === EDITORIAL_IMAGE_STYLE_ID;
    const isQuoteImageStyle = item.cardImagePromptStyleId === QUOTE_IMAGE_STYLE_ID;
    const isOverlayStyle = isOverlayImageStyle(item.cardImagePromptStyleId);
    const isLocalCanvasOnly = isOverlayStyle && item.decorateOriginalPhoto;

    if (isYoutubeImageStyle) {
      const missing = validateYoutubeImageStyleRequired(item);
      if (missing.length > 0) {
        return alert(`⚠️ สไตล์ "รูปจากyoutube" ยังขาดข้อมูล:\n- ${missing.join('\n- ')}\n\nให้กลับไปดึง Script + แคปรูปจาก YouTube ในคลังบทความก่อน แล้วเลือกภาพคนสำหรับ Image-to-Image`);
      }

      const warnings = getYoutubeImageStyleWarnings(item);
      if (warnings.length > 0) {
        const ok = confirm(`⚠️ ข้อมูล YouTube ไม่ครบ แต่ยังสร้างรูปต่อได้:\n- ${warnings.join('\n- ')}\n\nต้องการสร้างต่อไหม?`);
        if (!ok) {
          updateBulkItem(itemId, { status: 'article-done' });
          return;
        }
      }
    }
    if (isAiNewsImageStyle) {
      const missing = validateAiNewsImageStyleRequired(item);
      if (missing.length > 0) {
        return alert(`⚠️ สไตล์ "ข่าวAI" ยังขาดข้อมูล:\n- ${missing.join('\n- ')}\n\nให้กด "ดูดรูปข่าวจากwebsite" แล้วเลือกรูปข่าวก่อน`);
      }
    }

    let basePromptJson = '';
    if (isYoutubeImageStyle) {
      basePromptJson = createYoutubeImagePromptJson(item);
    } else if (isAiNewsImageStyle) {
      basePromptJson = createAiNewsImagePromptJson(item);
    } else if (isGithubImageStyle) {
      basePromptJson = createGithubImagePromptJson(item);
    } else if (isEditorialImageStyle) {
      basePromptJson = createEditorialImagePromptJson(item);
    } else if (isQuoteImageStyle) {
      basePromptJson = createQuoteImagePromptJson(item);
    } else if (item.cardImagePromptStyleId) {
      const saved = imagePromptStyles.find(p => p.id === item.cardImagePromptStyleId);
      if (saved) basePromptJson = saved.content;
    }
    if (!basePromptJson) return alert('⚠️ กรุณาเลือกสไตล์ภาพ (Image Prompt) ในกล่องนี้ก่อน');

    updateBulkItem(itemId, { status: 'generating-image', imageErrorMsg: '', errorMsg: '' });
    try {
      let cleanJson = basePromptJson;
      if (!isOverlayStyle) {
        const promptJson = `You are an expert AI image prompt engineer.\nI have a base image generation prompt JSON:\n${basePromptJson}\n\nAnd a specific headline:\n"${item.selectedHeadline}"\n\nReturn the UPDATED JSON with the headline embedded. Return ONLY valid JSON.`;
        const text = await callOpenRouter([{ role: "user", content: promptJson }], VISION_MODEL);
        cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      }

      const taskId = Date.now().toString() + Math.random().toString(36).slice(2, 6);

      let useImg = isOverlayStyle ? !!item.selectedImageUrl : item.useAttachedImage && !!item.selectedImageUrl;
      let refUrl = useImg ? item.selectedImageUrl : referenceImageUrl;
      if (item.imageSourceMode === 'ai') {
        useImg = false;
        refUrl = '';
      }
      if (isGithubImageStyle || item.imageSourceMode === 'github-random') {
        const alreadyPickedStockImage = item.selectedImageUrl && isGithubStockUrl(item.selectedImageUrl);
        if (alreadyPickedStockImage) {
          refUrl = item.selectedImageUrl;
          useImg = true;
        } else {
          const picked = await pickRandomGithubStockImage(item);
          if (picked.imageUrl) {
            refUrl = picked.imageUrl;
            useImg = true;
            updateBulkItem(itemId, {
              selectedImageUrl: picked.imageUrl,
              images: [picked.imageUrl, ...(item.images || []).filter(img => img !== picked.imageUrl)],
              smartSelectedImageReason: `สุ่มจากคลัง GitHub หัวข้อ ${picked.topicLabel}${picked.fileName ? `: ${picked.fileName}` : ''}`,
              smartConfigNote: `Github (สุ่มรูปจากคลัง) → ${picked.topicLabel}`,
            });
          } else if (picked.error) {
            console.warn(`[AIPage] GitHub stock image not found: ${picked.error}`);
          }
        }
        if (useImg && refUrl) {
          updateBulkItem(itemId, {
            selectedImageUrl: refUrl,
            useAttachedImage: true,
            decorateOriginalPhoto: true,
            cardImagePromptStyleId: isGithubImageStyle ? GITHUB_IMAGE_STYLE_ID : item.cardImagePromptStyleId,
          });
        }
      }
      if (isLocalCanvasOnly && (!useImg || !refUrl)) {
        throw new Error('ไม่มีรูปในคลัง GitHub สำหรับสร้าง Canvas — กด “เลือกคลังรูป GitHub” แล้วใส่รูปไว้ในโฟลเดอร์แม่หรือ subfolder เช่น GitHub/Claude Code');
      }
      globalTaskStore.addTask({ id: `aipage_${taskId}`, title: `AI: ${item.selectedHeadline.substring(0, 25)}...`, progress: 'เข้าคิวงานเรียบร้อย...', status: 'running' });
      const newTask: GenerationTask = {
        id: taskId, status: 'pending', log: ['เข้าคิวจากกล่องบทความ...'],
        rawArticle: item.generatedArticle,
        writingStyleId: item.writingStyleId,
        headlinePackId: item.headlinePackId,
        imagePromptStyleId: item.cardImagePromptStyleId,
        attachImage: useImg,
        referenceImageUrl: useImg ? refUrl : referenceImageUrl,
        imageRatio: item.cardImageRatio || imageRatio,
        finalText: item.generatedArticle,
        commentPostText: item.generatedCommentPost,
        bulkHeadline: item.selectedHeadline,
        bulkPromptJson: cleanJson,
        bulkSourceUrl: item.sourceUrl,
        bulkRawArticle: item.rawArticle,
        localYoutubeOverlay: isOverlayStyle && item.decorateOriginalPhoto ? {
          overlayKind: isGithubImageStyle ? 'github' : isAiNewsImageStyle ? 'ai-news' : isEditorialImageStyle ? 'editorial' : isQuoteImageStyle ? 'quote' : 'youtube',
          channelName: item.channelName?.trim() || '',
          channelLogoUrl: item.channelLogoUrl || '',
          subscriberText: formatSubscriberCount(item.subscriberCount),
          fontPaletteId: item.fontPaletteId,
          markedKeywords: item.markedKeywords,
          newsBadgeStyleId: item.aiNewsBadgeStyleId,
        } : undefined,
        sourceMeta: {
          title: item.title || '',
          sourceUrl: item.sourceUrl,
          tags: item.tags || [],
          sourceType: item.sourceType || '',
          channelName: item.channelName || '',
          channelLogoUrl: item.channelLogoUrl || '',
          subscriberCount: item.subscriberCount,
          ytExtracted: item.ytExtracted,
          selectedReferenceImage: item.selectedImageUrl,
          articleLength: item.articleLength,
          fontPaletteId: item.fontPaletteId,
          markedKeywords: item.markedKeywords,
        },
        bulkItemId: item.id,
      };
      setTasks(prev => [...prev, newTask]);
      updateBulkItem(itemId, {
        finalPromptJson: isLocalCanvasOnly ? '' : cleanJson,
        status: 'article-done',
        imageQueuedCount: (item.imageQueuedCount || 0) + 1,
        lastImageQueuedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      updateBulkItem(itemId, { status: 'error', errorMsg: e.message });
    }
  };

  const handleBulkGenerateArticles = async () => {
    const selected = bulkItems.filter(item => item.isSelected && item.rawArticle.trim());
    if (selected.length === 0) return alert('⚠️ กรุณาเลือกกล่องที่มีบทความดิบอย่างน้อย 1 กล่อง');

    setIsBulkProcessing(true);
    for (let i = 0; i < selected.length; i++) {
      const item = selected[i];
      setBulkProcessLog(`กำลังเขียนบทความ+คิดพาดหัว ${i + 1}/${selected.length}...`);
      await handleCardGenerateArticleAndHeadlines(item.id);
    }
    setBulkProcessLog(''); setIsBulkProcessing(false);
  };

  const handleBulkCreateImages = async () => {
    const selected = bulkItems.filter(item => item.isSelected && item.selectedHeadline && item.status === 'article-done');
    if (selected.length === 0) return alert('⚠️ กรุณาเลือกพาดหัวในแต่ละกล่องก่อน แล้วเลือกกล่องที่ต้องการ');
    setIsBulkProcessing(true);
    for (let i = 0; i < selected.length; i++) {
      const item = selected[i];
      setBulkProcessLog(`กำลังสร้างภาพ ${i + 1}/${selected.length}...`);
      await handleCardCreateImage(item.id);
    }
    setBulkProcessLog(''); setIsBulkProcessing(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Smart Auto-Config: วิเคราะห์รูปทุกรูป + เลือก keyword ที่มีความหมาย
  // ─────────────────────────────────────────────────────────────────────────────
  const thaiCharRatio = (text: string) =>
    !text ? 0 : (text.match(/[฀-๿]/g) || []).length / Math.max(text.length, 1);

  // ส่งรูปทุกรูปให้ Vision AI ให้คะแนนก่อนเลือกภาพที่มีคนชัดสุด
  const analyzeImageGallery = async (imageUrls: string[]): Promise<{
    bestIndex: number;
    hasPerson: boolean;
    reason: string;
    candidates: {
      index: number;
      score: number;
      hasPerson: boolean;
      note: string;
    }[];
  }> => {
    if (imageUrls.length === 0) return { bestIndex: 0, hasPerson: false, reason: 'ไม่มีรูปให้เลือก', candidates: [] };
    const limit = Math.min(imageUrls.length, 6);
    const contentParts: any[] = [{
      type: 'text',
      text: `I will show you ${limit} images (Image 0 to Image ${limit - 1}) extracted from a YouTube video.

Rank every image for use as an Image-to-Image reference for a social media thumbnail.
Choose the image where a real human face is the clearest, largest, and most usable as the main subject.

Scoring rules:
- 10 = clear talking-head presenter, face large, eyes visible, good crop.
- 7-9 = person visible and usable, but less ideal.
- 1-4 = no clear person, screen capture, slide, logo, text-only, UI, or face too tiny/hidden.
- Never choose a slide/screen/logo/text-only image when any usable human face exists.

Respond with ONLY valid JSON, no markdown:
{
  "bestIndex": <0-${limit - 1}>,
  "hasPerson": <true if any image has a clear usable human face>,
  "reason": "short Thai explanation of why this image was selected",
  "candidates": [
    {"index": 0, "score": 1-10, "hasPerson": true/false, "note": "short Thai note"},
    ...
  ]
}`,
    }];
    for (const url of imageUrls.slice(0, limit)) {
      const dataUrl = await imageUrlToVisionDataUrl(url);
      if (!dataUrl) throw new Error('แปลงรูปสำหรับ Vision ไม่สำเร็จ');
      contentParts.push({ type: 'image_url', image_url: { url: dataUrl } });
    }
    const raw = await callOpenRouter([{ role: 'user', content: contentParts }], VISION_MODEL);
    const parsed = JSON.parse(extractJsonObject(raw));
    const candidates = Array.isArray(parsed.candidates)
      ? parsed.candidates.slice(0, limit).map((c: any) => ({
          index: Math.min(Math.max(0, parseInt(String(c.index)) || 0), limit - 1),
          score: Math.min(Math.max(0, Number(c.score) || 0), 10),
          hasPerson: !!c.hasPerson,
          note: String(c.note || '').slice(0, 120),
        }))
      : [];
    return {
      bestIndex: Math.min(Math.max(0, parseInt(String(parsed.bestIndex)) || 0), limit - 1),
      hasPerson: !!parsed.hasPerson,
      reason: String(parsed.reason || '').slice(0, 160),
      candidates,
    };
  };

  // เลือก keyword ที่มีความหมายจริง — ให้คะแนนตามความสำคัญ
  const pickImpactfulKeywords = (headline: string, count: number): string[] => {
    const candidates = getHeadlineKeywordCandidates(headline);
    if (candidates.length === 0) return [];
    const scored = candidates.map(word => {
      const clean = word.replace(/[^\p{L}\p{N}%$฿]/gu, '');
      const lower = clean.toLowerCase();
      let score = 0;
      let reasonWeight = 0;
      // ตัวเลข / เงิน / สถิติ
      if (/[0-9]/.test(clean)) { score += 8; reasonWeight += 3; }
      if (/\$|฿|ล้าน|บาท|ดอลลาร์|K\b|M\b|%/i.test(clean)) { score += 8; reasonWeight += 3; }
      // ชื่อแบรนด์ / เทคโนโลยี (มี uppercase)
      if (/AI|AWS|Claude|ChatGPT|Cloud|Data|Engineer|SaaS|YouTube|ROI|CEO|API/i.test(clean)) { score += 7; reasonWeight += 2; }
      if (/^[A-Z]{2,}/.test(clean)) score += 4;
      if (/[A-Z]/.test(clean) && /[a-z]/.test(clean)) score += 2;
      // คำไทยที่มีพลัง
      if (/รวย|เงิน|ฟรี|ล้าน|สำเร็จ|ปัง|ลับ|ง่าย|เร็ว|ใหม่|พลิก|เปลี่ยน|โกย|กำไร|ซ่อน|จริง|ทำเงิน|รายได้|ประหยัด|ช็อก|พลาด|กับดัก|โอกาส|ระดับโลก|เส้นทาง|ไม่เคยเปิดเผย|ไม่ต้อง|ห้าม|หยุด/.test(clean)) { score += 7; reasonWeight += 2; }
      // คำยาวพอจะเป็น phrase บนภาพได้
      if (clean.length >= 4 && clean.length <= 18) score += 2;
      // หลีกเลี่ยงคำทั่วไปที่ไม่น่าสนใจ
      if (/^(และ|แต่|หรือ|ใน|ที่|ของ|จาก|การ|ว่า|ได้|ให้|เป็น|มี|นี้|นั้น|แล้ว|ก็|กับ|จะ|ไม่|มาก|น้อย|อาจ|สู่|เพื่อ|บน|ไป|มา|แบบ|กว่า|อย่าง|คือ|ถ้า|คุณ|คน|ใคร|ด้วย|โดย)$/.test(lower)) score -= 20;
      if (clean.length <= 2 && !/[0-9]/.test(clean) && !/AI|IT/i.test(clean)) score -= 8;
      return { word: clean, score, reasonWeight };
    });
    scored.sort((a, b) => (b.score - a.score) || (b.reasonWeight - a.reasonWeight) || (b.word.length - a.word.length));
    const strong = scored.filter(s => s.score >= 5).slice(0, count).map(s => s.word);
    if (strong.length > 0) return strong;
    return scored.filter(s => s.score > 0).slice(0, count).map(s => s.word);
  };

  const normalizeKeywordList = (headline: string, rawKeywords: string[], count = 2) => {
    const seen = new Set<string>();
    const stopWords = /^(และ|แต่|หรือ|ใน|ที่|ของ|จาก|การ|ว่า|ได้|ให้|เป็น|มี|นี้|นั้น|แล้ว|ก็|กับ|จะ|ไม่|มาก|น้อย|อาจ|สู่|เพื่อ|บน|ไป|มา|แบบ|กว่า|อย่าง|คือ|ถ้า|คุณ|คน|ใคร|ด้วย|โดย|เอง)$/;
    return rawKeywords
      .map(k => String(k || '').replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim())
      .map(k => k.replace(/\s+/g, ' '))
      .filter(k => k.length >= 2 && headline.includes(k))
      .filter(k => !stopWords.test(k.toLowerCase()))
      .filter(k => {
        const key = k.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, count);
  };

  const pickKeywordsWithAI = async (headline: string, article: string, model: string) => {
    const fallback = pickImpactfulKeywords(headline, 2);
    const candidates = getHeadlineKeywordCandidates(headline);
    const prompt = `คุณเป็น art director ที่เลือกคำ/วลีสำหรับทำสีเด่นบนภาพ thumbnail ภาษาไทย

พาดหัว:
"${headline}"

บริบทบทความ:
${article.slice(0, 1200)}

สไตล์คำที่ชอบ:
- "จากศูนย์สู่ธุรกิจ"
- "เปิดเคล็ดลับ"
- "ลืมสร้าง"
- "เคล็ดลับทำเงินล้านออนไลน์ภายใน"
- "20"
- "ล้านดอลลาร์"
- "AI ทำงานแทนคน"
- "แต่แทนที่"
- "เงินล้าน ในพริบตา!"

ตัวอย่างการเลือก:
- พาดหัว: "โลกธุรกิจเปลี่ยน: AI ทำงานแทนคน ไม่ใช่แค่เสริม แต่แทนที่!"
  keywords ที่ดี: ["AI ทำงานแทนคน", "แต่แทนที่"]
  เหตุผล: เป็นแกน clickbait ที่มีความขัดแย้งและแรงปะทะ ไม่ใช่แค่คำว่า AI หรือ ธุรกิจ
- พาดหัว: "AI Claude Opus 4.6: สร้างดิจิทัลโปรดักส์เงินล้าน ในพริบตา!"
  keywords ที่ดี: ["เงินล้าน ในพริบตา!"]
  เหตุผล: เป็น promise หลัก เงิน + ความเร็ว จึงหยุดสายตาได้แรงกว่าแค่ Claude หรือ Product

เลือก 1-3 คำหรือวลีจากพาดหัวเท่านั้น ต้องเป็น substring ตรงตัวที่มีอยู่ในพาดหัว
เลือกวลี clickbait ที่คนเห็นแล้วอยากหยุดอ่าน: ความกลัวว่าจะถูกแทนที่, คำสัญญาผลลัพธ์ใหญ่, เงิน, ความเร็ว, ความลับ, จุดเปลี่ยน, ความขัดแย้ง, คำเจ็บๆ
ให้ชอบ "วลีสั้น-กลางที่เป็นแกนความหมาย" มากกว่าคำเดี่ยว เช่น เลือก "AI ทำงานแทนคน" ไม่ใช่ "AI"; เลือก "เงินล้าน ในพริบตา!" ไม่ใช่ "เงินล้าน"
ห้ามเลือกคำเชื่อม/คำเดี่ยวอ่อนๆ เช่น สู่, จาก, เพื่อ, คน, เอง, นี้ ยกเว้นอยู่ในวลีที่มีพลัง เช่น "จากศูนย์สู่ธุรกิจ"

candidate ที่แยกจากพาดหัว:
${candidates.map(c => `- ${c}`).join('\n')}

ตอบเป็น JSON เท่านั้น:
{"keywords":["วลีที่ 1","วลีที่ 2"],"reason":"เหตุผลสั้นๆ ภาษาไทย"}`;
    try {
      const raw = await callOpenRouter([{ role: 'user', content: prompt }], model);
      const parsed = JSON.parse(extractJsonObject(raw));
      const aiKeywords = normalizeKeywordList(headline, Array.isArray(parsed.keywords) ? parsed.keywords : [], 3);
      if (aiKeywords.length > 0) {
        return {
          keywords: aiKeywords,
          note: `AI เลือกคำเน้น: ${aiKeywords.join(', ')} เพราะ${parsed.reason ? ` ${String(parsed.reason).slice(0, 160)}` : 'เป็น hook/ผลลัพธ์/ตัวเลขที่ดึงสายตาบนภาพ'}`,
        };
      }
    } catch {}
    return {
      keywords: fallback,
      note: `เลือกคำเน้นสำรอง: ${fallback.join(', ')} เพราะเป็นตัวเลข/แบรนด์/คำ hook ที่เด่นกว่าคำเชื่อมทั่วไป`,
    };
  };

  const thaiCharCount = (text: string) => (text.match(/[฀-๿]/g) || []).length;
  const isThaiReadableHeadline = (headline: string) => {
    const clean = headline.replace(/^[\s\-•\d.)]+/, '').trim();
    if (!clean) return false;
    const thaiCount = thaiCharCount(clean);
    const letters = clean.replace(/[\s\d!?.,:;'"“”‘’()[\]{}+\-=/_|&%$#@<>]/g, '');
    const ratio = thaiCount / Math.max(letters.length, 1);
    // English technical words are allowed, but the hook must contain enough Thai for Thai readers.
    return thaiCount >= 6 || (thaiCount >= 3 && ratio >= 0.22);
  };

  const cleanHeadlineLines = (text: string) => {
    const stripPrefix = (h: string) => h.replace(/^[\s\-•*]+/, '').replace(/^\d+[\).:-]+\s*/, '').replace(/^["“”]+|["“”]+$/g, '').trim();
    if (text.includes('---')) {
      return text.split('---').filter(Boolean).map(stripPrefix).filter(Boolean);
    }
    if (text.includes('\n\n')) {
      return text.split('\n\n').filter(Boolean).map(stripPrefix).filter(Boolean);
    }
    return text.split('\n').filter(Boolean).map(stripPrefix).filter(Boolean);
  };

  const scoreHeadlineForThaiAudience = (headline: string) => {
    let score = thaiCharRatio(headline) * 12;
    if (/[0-9]/.test(headline)) score += 3;
    if (/AI|AWS|Claude|ChatGPT|Cloud|Data|Engineer|SaaS|YouTube/i.test(headline)) score += 2;
    if (/ลับ|ช็อก|พลาด|ประหยัด|เงิน|รายได้|เปลี่ยน|อย่า|ไม่ต้อง|ทำไม|จริง|ปี\s?2026|ชั่วโมง|ล้าน|หลัก/.test(headline)) score += 4;
    if (headline.length >= 22 && headline.length <= 90) score += 2;
    if (headline.length > 120) score -= 4;
    return score;
  };

  const buildThaiHeadlineSelectionNote = (headline: string, markedKeywords: string[], attempts: number) => {
    const keywordText = markedKeywords.length > 0 ? markedKeywords.join(', ') : 'ยังไม่เจอคำที่ควรเน้น';
    const thaiNote = thaiCharRatio(headline) >= 0.45
      ? 'ไทยชัด อ่านรู้เรื่องทันที'
      : 'ไทยปนอังกฤษแต่ยังมีแกนภาษาไทยพอสำหรับคนไทย';
    const retryNote = attempts > 1 ? `ผ่านหลังลองสร้าง ${attempts} รอบ` : 'ผ่านตั้งแต่รอบแรก';
    return `เลือกพาดหัวนี้เพราะ${thaiNote}, hook ตรงกับบทความ และไม่ใช่อังกฤษล้วน (${retryNote}) | เน้นคำ: ${keywordText} เพราะเป็นตัวเลข/แบรนด์/คำแรงที่ดึงสายตาบนภาพ`;
  };

  const makeFallbackThaiHeadlines = (raw: string, rejected: string[] = []) => {
    const thaiSentences = raw
      .replace(/\s+/g, ' ')
      .split(/[.!?\n。]/)
      .map(s => s.trim())
      .filter(s => thaiCharCount(s) >= 8);
    const base = (thaiSentences[0] || raw.replace(/\s+/g, ' ').trim()).slice(0, 90);
    const hasCloud = /cloud|aws|engineer|certificate/i.test(raw);
    const hasAI = /AI|Claude|ChatGPT|automation|agent/i.test(raw);
    const techWord = hasCloud ? 'Cloud' : hasAI ? 'AI' : 'เทค';
    const numberMatch = raw.match(/(?:\d+[,.]?\d*\s?(?:วัน|ชั่วโมง|ล้าน|ตำแหน่ง|%|K|M|\$|บาท|ดอลลาร์|ปี))/i)?.[0] || '';
    const rejectedIdea = rejected.find(h => /[A-Za-z]/.test(h))?.replace(/[!?]+$/g, '').slice(0, 55) || '';
    const fallback = [
      numberMatch ? `${techWord} กำลังเปลี่ยนเกม: ${numberMatch} ที่คนไทยไม่ควรมองข้าม` : `${techWord} กำลังเปลี่ยนเกม: เรื่องนี้คนไทยไม่ควรมองข้าม`,
      `อยากเข้าเส้นทาง ${techWord}? เริ่มจากจุดนี้ก่อนจะเสียเวลาไปผิดทาง`,
      `${techWord} ไม่ได้ยากอย่างที่คิด แต่หลายคนพลาดเพราะเชื่อคำแนะนำเดิมๆ`,
      `${base}${base.length >= 85 ? '...' : ''}`,
      rejectedIdea ? `แปลให้คนไทยเข้าใจ: ${rejectedIdea}` : `โอกาสใหม่ในสาย ${techWord}: คนเริ่มก่อนมีแต้มต่อ`,
    ];
    const seen = new Set<string>();
    return fallback
      .map(h => h.replace(/\s+/g, ' ').trim())
      .filter(h => isThaiReadableHeadline(h))
      .filter(h => {
        const key = h.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5);
  };

  const generateThaiHeadlinesWithRetry = async (
    raw: string,
    pack: any,
    model: string,
    firstResponse = '',
    onRetry?: (attempt: number) => void,
  ): Promise<{ headlines: string[]; selectedHeadline: string; markedKeywords: string[]; note: string; attempts: number }> => {
    const examples = pack?.headlines?.length
      ? pack.headlines.map((h: string) => `[ตัวอย่าง]\n${h}`).join('\n---\n')
      : 'พาดหัวต้องสั้น คม มี hook แบบเพจไทย\nใช้คำอังกฤษเฉพาะศัพท์เทคที่จำเป็น และต้องมีภาษาไทยประกบ';
    const strictPrompt = (attempt: number, previousBad: string[] = []) => `คุณเป็นนักเขียนพาดหัว Facebook Page สำหรับคนไทย
อ่านบทความนี้:
"""
${raw.slice(0, 2400)}
"""

สร้างพาดหัว 5 อัน ให้แมชพลังและรูปแบบจากตัวอย่างนี้:
${examples}

กติกาบังคับ:
- ห้ามแปลเปรียบเปรย (Metaphors) คำคม หรือสำนวนฝรั่งเด็ดขาด (เช่น "ความมืดให้แบรนด์", "หัวใจสูญหาย", "จุดตาย")
- จับประเด็นหลักมาเขียนใหม่เลย ไม่ต้องพยายามแปลล้อตามพาดหัวภาษาอังกฤษเดิม
- เน้นเขียนแบบบอกผลลัพธ์, วิธีแก้ปัญหา, หรือ How-to ที่คนอ่านได้ประโยชน์ตรงๆ เข้าใจง่ายที่สุด
- ใช้ภาษาพูดแบบคนไทย เลี่ยงการแปลตรงตัวหรือรูปประโยคแบบภาษาอังกฤษ
- ทุกพาดหัวต้องมีภาษาไทยเป็นแกนหลัก
- อนุญาตคำอังกฤษเฉพาะชื่อแบรนด์/ศัพท์เทค เช่น AI, AWS, Claude, ChatGPT, Cloud แต่ต้องมีคำไทยนำบริบทให้เข้าใจ
- ห้ามตอบเป็นภาษาอังกฤษล้วนเด็ดขาด
- ตอบเป็น 5 พาดหัว โดยแต่ละพาดหัวให้คั่นด้วยเครื่องหมาย --- เท่านั้น (ห้ามใส่เลขข้อ หรือเครื่องหมาย - นำหน้า)
- บังคับ! พาดหัว 1 อัน ต้องแบ่งจำนวนบรรทัดตามโครงสร้างของตัวอย่างเป๊ะๆ (เช่น ถ้าตัวอย่างเป็น 3 บรรทัดจบ ก็ต้องตอบพาดหัวละ 3 บรรทัด)
${previousBad.length > 0 ? `\nพาดหัวอังกฤษล้วน/สำนวนแปลกๆ จากรอบก่อน ห้ามใช้ซ้ำ:\n${previousBad.map(h => `- ${h}`).join('\n')}` : ''}
${attempt >= 3 ? '\nรอบนี้ให้ rewrite เป็นไทยทันที เน้นอ่านรู้เรื่อง ห้ามเลียนแบบสำนวนฝรั่ง' : ''}`;

    const collected: string[] = [];
    const rejected: string[] = [];
    let attempts = 0;
    const maxAttempts = 5;

    const consume = (text: string) => {
      for (const line of cleanHeadlineLines(text)) {
        if (isThaiReadableHeadline(line)) {
          if (!collected.some(h => h.toLowerCase() === line.toLowerCase())) collected.push(line);
        } else if (!rejected.includes(line)) {
          rejected.push(line);
        }
      }
    };

    if (firstResponse) {
      attempts = 1;
      consume(firstResponse);
    }

    while (collected.length < 5 && attempts < maxAttempts) {
      attempts += 1;
      onRetry?.(attempts);
      const text = await callOpenRouter([{ role: 'user', content: strictPrompt(attempts, rejected.slice(-8)) }], model);
      consume(text);
    }

    if (collected.length === 0 && rejected.length > 0) {
      attempts += 1;
      onRetry?.(attempts);
      const rewritePrompt = `Rewrite these headlines for Thai Facebook readers. Keep brand/tech words in English only when useful, but every headline must contain Thai and must not be English-only. Return one headline per line, no numbering.

${rejected.slice(0, 8).map(h => `- ${h}`).join('\n')}`;
      const rewritten = await callOpenRouter([{ role: 'user', content: rewritePrompt }], model);
      consume(rewritten);
    }

    if (collected.length < 5) {
      for (const fallback of makeFallbackThaiHeadlines(raw, rejected)) {
        if (!collected.some(h => h.toLowerCase() === fallback.toLowerCase())) collected.push(fallback);
      }
    }

    const finalHeadlines = collected.slice(0, 5);
    const selectedHeadline = finalHeadlines.reduce(
      (best, h) => scoreHeadlineForThaiAudience(h) > scoreHeadlineForThaiAudience(best) ? h : best,
      finalHeadlines[0] || '',
    );
    const markedKeywords = pickImpactfulKeywords(selectedHeadline, 2);
    return {
      headlines: finalHeadlines,
      selectedHeadline,
      markedKeywords,
      attempts,
      note: selectedHeadline
        ? buildThaiHeadlineSelectionNote(selectedHeadline, markedKeywords, attempts)
        : 'ยังเลือกพาดหัวไม่ได้ เพราะ AI ยังไม่ส่งพาดหัวภาษาไทยที่ผ่านเกณฑ์',
    };
  };

  const handleSmartAutoConfig = async () => {
    const selectedItems = bulkItems.filter(b => b.isSelected && b.rawArticle.trim());
    if (selectedItems.length === 0) return alert('กรุณาเลือก item ที่ต้องการก่อน');

    setIsSmartConfigRunning(true);

    try {
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        const label = `(${i + 1}/${selectedItems.length})`;
        setSmartConfigLog(`🤖 ${label} ตั้งค่า: ${(item.title || item.rawArticle).slice(0, 30)}...`);

        // ── Detect source type ─────────────────────────────────────────────────
        const isGithub = item.sourceType === 'github'
          || (item.tags || []).some(tag => String(tag).toLowerCase() === 'github')
          || /github\.com/i.test(item.sourceUrl || '');
        const isYoutube = !!item.ytExtracted || item.sourceType === 'youtube';
        const isNews = !isYoutube && !isGithub && (item.sourceType === 'news' || !!item.sourceUrl);

        // ── Step 1: global defaults ──────────────────────────────────────────────
        const THREE_LINE_PACK_ID = 'default-3-line-hook';
        const patch: Partial<BulkArticleItem> = {
          contentFormat: item.contentFormat || inferContentFormat(item.sourceType, item.tags || []),
          imageSourceMode: item.imageSourceMode || inferImageSourceMode(item.sourceType, item.images || []),
          writingStyleId: item.writingStyleId || (isGithub ? (writingStyles.find(s => s.name.trim() === 'AI Trendtech')?.id || '') : selectedStyleId),
          commentStyleId: item.commentStyleId || (isGithub ? (writingStyles.find(s => s.name.trim() === 'AI Trendtech')?.id || '') : selectedCommentStyleId),
          headlinePackId: THREE_LINE_PACK_ID,
          cardTextModel: isGithub ? 'google/gemini-2.5-flash' : (item.cardTextModel || textModel),
          cardImageRatio: isGithub ? '1:1' : (item.cardImageRatio || ''),
          articleLength: isGithub ? 'short' : (item.articleLength || ''),
          fontPaletteId: isGithub ? 'black-yellow-white' : isYoutube ? 'white-yellow-blue' : 'cyan-white-navy',
        };

      // ── Auto-fetch images if none yet (news articles) ─────────────────────
      let allImages = item.images || [];
      if (allImages.length === 0 && isNews && item.sourceUrl) {
        setSmartConfigLog(`📡 ${label} ดูดรูปข่าว ${item.sourceUrl.slice(0, 40)}...`);
        try {
          const res = await fetchWithTimeout('/api/website-extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.sourceUrl }),
          }, LOCAL_API_TIMEOUT_MS);
          const data = await res.json();
          if (res.ok && data.success && data.images?.length > 0) {
            allImages = Array.from(new Set([...(data.images || []), ...(item.images || [])]))
              .filter((img): img is string => typeof img === 'string' && img.startsWith('http'));
            patch.images = allImages;
            setSmartConfigLog(`📡 ${label} ดูดรูปข่าวเจอ ${allImages.length} รูป`);
          }
        } catch {}
      }

      // ── Set image style + Vision analyze ──────────────────────────────────
      if (isGithub) {
        const picked = await pickRandomGithubStockImage(item);
          patch.useAttachedImage = true;
          patch.decorateOriginalPhoto = true;
          patch.cardImagePromptStyleId = GITHUB_IMAGE_STYLE_ID;
          patch.aiNewsBadgeStyleId = GITHUB_BADGE_STYLES[0].id;
        if (picked.imageUrl) {
          allImages = [picked.imageUrl, ...allImages.filter(img => img !== picked.imageUrl)];
          patch.images = allImages;
          patch.selectedImageUrl = picked.imageUrl;
          patch.smartSelectedImageIndex = 0;
          patch.smartSelectedImageReason = `สุ่มจากคลัง GitHub หัวข้อ ${picked.topicLabel}${picked.fileName ? `: ${picked.fileName}` : ''}`;
          patch.smartConfigNote = `Smart Setup (GitHub) → ใช้สไตล์ Github สุ่มรูปจากคลังหัวข้อ ${picked.topicLabel}`;
        } else {
          patch.selectedImageUrl = item.selectedImageUrl || allImages[0] || '';
          patch.smartSelectedImageReason = picked.error || 'ยังสุ่มรูป GitHub ไม่สำเร็จ';
          patch.smartConfigNote = `Smart Setup (GitHub) → ใช้สไตล์ Github แต่ยังไม่ได้รูปจากคลัง${picked.topicLabel ? `หัวข้อ ${picked.topicLabel}` : ''}${picked.error ? ` (${picked.error})` : ''}`;
        }
      } else if (allImages.length > 0) {
        patch.useAttachedImage = true;

        if (item.contentFormat === 'quote') {
          const quoteImageUrl = item.selectedImageUrl || allImages[0];
          patch.decorateOriginalPhoto = true;
          patch.cardImagePromptStyleId = QUOTE_IMAGE_STYLE_ID;
          patch.selectedImageUrl = quoteImageUrl;
          patch.smartSelectedImageIndex = Math.max(0, allImages.indexOf(quoteImageUrl));
          patch.smartSelectedImageReason = 'เลือกรูปสำหรับ Quote Card';
          patch.smartConfigNote = `Smart Setup (Quote) ใช้รูปจาก Content → แปะคำสอน/ข้อคิดลงรูปเดิม`;
        } else if (isYoutube) {
          setSmartConfigLog(`🔍 ${label} วิเคราะห์รูป YouTube ${allImages.length} รูป...`);
          try {
            const { bestIndex, hasPerson, reason, candidates } = await analyzeImageGallery(allImages);
            const bestUrl = allImages[bestIndex] || allImages[0];

            if (hasPerson) {
              patch.decorateOriginalPhoto = true;
              patch.cardImagePromptStyleId = YOUTUBE_IMAGE_STYLE_ID;
              patch.selectedImageUrl = bestUrl;
              patch.smartConfigNote = `Smart Setup (YouTube) เลือกรูป #${bestIndex + 1}${reason ? ` เพราะ${reason}` : ''} → ใช้ img2img คงรูปเดิมตกแต่งเพิ่ม`;
            } else {
              patch.decorateOriginalPhoto = false;
              patch.cardImagePromptStyleId = YOUTUBE_IMAGE_STYLE_ID;
              patch.selectedImageUrl = '';
              patch.smartConfigNote = 'Smart Setup (YouTube) ไม่เจอหน้าคนในรูป → ใช้สไตล์รูป YouTube แต่ไม่คงรูปเดิม';
            }
            patch.smartSelectedImageIndex = bestIndex;
            patch.smartSelectedImageReason = reason || (hasPerson ? 'รูปนี้มีหน้าคนชัดสุด' : 'ไม่พบหน้าคนชัด');
            patch.smartImageHasPerson = hasPerson;
            patch.smartImageScores = candidates;
          } catch (e: any) {
            const fallbackUrl = item.selectedImageUrl || allImages[0] || '';
            patch.decorateOriginalPhoto = !!fallbackUrl;
            patch.cardImagePromptStyleId = YOUTUBE_IMAGE_STYLE_ID;
            patch.selectedImageUrl = fallbackUrl;
            patch.smartSelectedImageIndex = fallbackUrl ? Math.max(0, allImages.indexOf(fallbackUrl)) : undefined;
            patch.smartSelectedImageReason = `Vision วิเคราะห์รูปไม่สำเร็จ: ${e?.message || 'ไม่ทราบสาเหตุ'}`;
            patch.smartConfigNote = fallbackUrl
              ? 'Smart Setup วิเคราะห์รูปไม่สำเร็จ → คงรูปเดิมไว้ ให้เช็คอีกทีก่อนสร้าง'
              : 'Smart Setup วิเคราะห์รูปไม่สำเร็จ และไม่มีรูปเดิม';
          }
        } else {
          // News → ข่าวAI style + คงรูปเดิมตกแต่งเพิ่ม
          patch.decorateOriginalPhoto = true;
          patch.cardImagePromptStyleId = item.contentFormat === 'editorial' ? EDITORIAL_IMAGE_STYLE_ID : AI_NEWS_IMAGE_STYLE_ID;
          patch.selectedImageUrl = allImages[0];
          patch.smartSelectedImageIndex = 0;
          patch.smartSelectedImageReason = 'เลือกรูปแรกจากข่าว ใช้ img2img คงรูปเดิมตกแต่งเพิ่ม';
          patch.smartConfigNote = `Smart Setup (${item.contentFormat === 'editorial' ? 'Editorial' : 'ข่าว'}) ดูดรูปจากเว็บเจอ ${allImages.length} รูป → ใช้ img2img คงรูปเดิมตกแต่งเพิ่ม`;
        }
      } else {
        // No images → AI สร้างภาพประกอบเอง
        patch.useAttachedImage = false;
        patch.decorateOriginalPhoto = false;
        patch.selectedImageUrl = '';
        patch.cardImagePromptStyleId = item.contentFormat === 'quote'
          ? QUOTE_IMAGE_STYLE_ID
          : item.contentFormat === 'editorial'
          ? EDITORIAL_IMAGE_STYLE_ID
          : imagePromptStyles.length > 0 ? imagePromptStyles[0].id : '';
        patch.smartConfigNote = 'Smart Setup ไม่มีรูปแนบ → ใช้ AI สร้างภาพประกอบเอง';
      }

      updateBulkItem(item.id, patch);
      const merged = { ...item, ...patch };

      // ── Step 3: สร้างบทความ + พาดหัว (ถ้ายังไม่มี) ──────────────────────────
      const style = writingStyles.find(s => s.id === merged.writingStyleId);
      const commentStyle = writingStyles.find(s => s.id === merged.commentStyleId);
      const pack = headlinePacks.find(p => p.id === merged.headlinePackId);
      const model = merged.cardTextModel || textModel;

      if (!merged.generatedArticle && style && commentStyle && pack) {
        setSmartConfigLog(`✍️ ${label} สร้างบทความ+พาดหัว...`);
        updateBulkItem(item.id, { status: 'generating-article', errorMsg: '' });
        try {
          const articlePrompt = buildBulkArticlePrompt(merged, style.content);
          const commentPostPrompt = buildCommentPostPrompt(merged.rawArticle, commentStyle.content, merged.sourceUrl);
          const examplesStr = pack?.headlines?.length ? pack.headlines.map((h: string) => `[ตัวอย่าง]\n${h}`).join('\n---\n') : '';
          const headlinePrompt = `คุณเป็นนักเขียน Social Media ชาวไทยมืออาชีพ\nอ่านบทความนี้:\n"""\n${merged.rawArticle.slice(0, 2000)}\n"""\nสร้างพาดหัว 5 อัน ให้แมชสไตล์นี้:\n${examplesStr}\n\nกติกาบังคับ:\n- ห้ามแปลเปรียบเปรย (Metaphors) คำคม หรือสำนวนฝรั่งเด็ดขาด\n- เน้นเขียนแบบบอกผลลัพธ์, วิธีแก้ปัญหา, หรือ How-to ที่คนอ่านได้ประโยชน์ตรงๆ เข้าใจง่ายที่สุด\n- จับประเด็นหลักมาเขียนใหม่เลย ไม่ต้องพยายามแปลล้อตามพาดหัวภาษาอังกฤษเดิม\n- ใช้ภาษาพูดแบบคนไทย เลี่ยงการแปลตรงตัวหรือรูปประโยคแบบภาษาอังกฤษ\n- ทุกพาดหัวต้องมีภาษาไทย ห้ามอังกฤษล้วน\n- ใช้คำอังกฤษอย่าง AI, AWS, Claude ได้ถ้ามีบริบทไทยประกบให้เข้าใจง่าย\n- ตอบเป็น 5 พาดหัว โดยแต่ละพาดหัวให้คั่นด้วยเครื่องหมาย --- เท่านั้น (ห้ามใส่เลขข้อ หรือเครื่องหมาย - นำหน้า)\n- บังคับ! ต้องคงโครงสร้างบรรทัดตามตัวอย่าง (เช่น ตัวอย่างมี 3 บรรทัด ก็ต้องตอบพาดหัวละ 3 บรรทัดเป๊ะๆ)`;

          const [articleText, commentPostText, headlineText] = await Promise.all([
            callOpenRouter([{ role: 'user', content: articlePrompt }], model),
            callOpenRouter([{ role: 'user', content: commentPostPrompt }], model),
            callOpenRouter([{ role: 'user', content: headlinePrompt }], model),
          ]);

          const headlineResult = await generateThaiHeadlinesWithRetry(
            merged.rawArticle,
            pack,
            model,
            headlineText,
            attempt => setSmartConfigLog(`🔄 ${label} หาพาดหัวภาษาไทย รอบ ${attempt}...`),
          );
          setSmartConfigLog(`🎯 ${label} ฟังก์ชัน AI เลือกคำเน้นในพาดหัว...`);
          let smartKeywords: string[] = [];
          try {
            const aiKeywordResult = await pickKeywordsWithAI(headlineResult.selectedHeadline, merged.rawArticle, model);
            smartKeywords = aiKeywordResult.keywords;
            if (smartKeywords.length > 0) {
              updateBulkItem(item.id, { smartHeadlineNote: aiKeywordResult.note });
            }
          } catch {}
          if (smartKeywords.length === 0) {
            smartKeywords = pickImpactfulKeywords(headlineResult.selectedHeadline, 2);
          }
          updateBulkItem(item.id, {
            generatedArticle: articleText, generatedCommentPost: commentPostText,
            generatedHeadlines: headlineResult.headlines,
            selectedHeadline: headlineResult.selectedHeadline,
            markedKeywords: smartKeywords,
            status: 'article-done',
          });
          saveArticleCache(merged.rawArticle, {
            sourceUrl: merged.sourceUrl, generatedArticle: articleText,
            generatedCommentPost: commentPostText,
            generatedHeadlines: headlineResult.headlines,
            selectedHeadline: headlineResult.selectedHeadline,
          });
        } catch (e: any) {
          updateBulkItem(item.id, { status: 'error', errorMsg: e.message });
        }
      } else if ((merged.generatedHeadlines || []).length > 0) {
        // มีบทความแล้ว → กรองอังกฤษล้วนออก ถ้าไม่เหลือให้สร้างใหม่จนมีไทย
        const thaiHeadlines = merged.generatedHeadlines!.filter(isThaiReadableHeadline);
        let headlines = thaiHeadlines;
        let selectedHeadline = headlines.reduce(
          (best: string, h: string) => scoreHeadlineForThaiAudience(h) > scoreHeadlineForThaiAudience(best) ? h : best,
          headlines[0] || '',
        );
        let note = '';
        if (headlines.length === 0) {
          setSmartConfigLog(`🔄 ${label} พาดหัวเดิมเป็นอังกฤษล้วน กำลังสร้างไทยใหม่...`);
          try {
            const headlineResult = await generateThaiHeadlinesWithRetry(
              merged.rawArticle,
              pack,
              model,
              '',
              attempt => setSmartConfigLog(`🔄 ${label} หาพาดหัวภาษาไทย รอบ ${attempt}...`),
            );
            headlines = headlineResult.headlines;
            selectedHeadline = headlineResult.selectedHeadline;
            note = headlineResult.note;
          } catch {}
        }
	        setSmartConfigLog('🎯 ' + label + ' ฟังก์ชัน AI เลือกคำเน้นในพาดหัว...');
	        let smartKeywords = [];
	        try {
	          const aiKeywordResult = await pickKeywordsWithAI(selectedHeadline, merged.rawArticle, model);
	          smartKeywords = aiKeywordResult.keywords;
	          if (smartKeywords.length > 0) { note = aiKeywordResult.note; }
	        } catch {}
	        if (smartKeywords.length === 0) {
	          smartKeywords = pickImpactfulKeywords(selectedHeadline, 2);
	        }
	        updateBulkItem(item.id, {
	          generatedHeadlines: headlines.length > 0 ? headlines : merged.generatedHeadlines,
	          selectedHeadline,
	          markedKeywords: smartKeywords,
	          smartHeadlineNote: note || buildThaiHeadlineSelectionNote(selectedHeadline, smartKeywords, 1),
	        });

      }

        if (i < selectedItems.length - 1) await new Promise(r => setTimeout(r, 300));
      }

      setSmartConfigLog('');
    } catch (e: any) {
      console.error('[AIPage] Smart Setup failed:', e);
      setSmartConfigLog(`❌ Smart Setup หยุด: ${e?.message || 'ไม่ทราบสาเหตุ'}`);
    } finally {
      setIsSmartConfigRunning(false);
    }
  };

  const getWritingStyleName = (id: string) => writingStyles.find(s => s.id === id)?.name || 'ยังไม่เลือก';
  const getHeadlinePackName = (id: string) => headlinePacks.find(p => p.id === id)?.name || 'ยังไม่เลือก';
  const getImagePromptStyleName = (id: string) => {
    if (id === YOUTUBE_IMAGE_STYLE_ID) return 'รูปจากyoutube';
    if (id === AI_NEWS_IMAGE_STYLE_ID) return 'ข่าวAI';
    if (id === GITHUB_IMAGE_STYLE_ID) return 'Github';
    if (id === EDITORIAL_IMAGE_STYLE_ID) return 'Editorial แบบ Top Gainers';
    if (id === QUOTE_IMAGE_STYLE_ID) return 'Quote / คำสอนคนดัง';
    return imagePromptStyles.find(p => p.id === id)?.name || 'ยังไม่เลือก';
  };
  const getArticleLengthLabel = (id: string) => {
    const opt = getArticleLengthOption(id);
    return `${opt.label} (${opt.range})`;
  };
  const getSelectedImageIndex = (item: BulkArticleItem) => {
    const idx = (item.images || []).indexOf(item.selectedImageUrl);
    return idx >= 0 ? idx : undefined;
  };
  const getCardConfigNote = (item: BulkArticleItem) => {
    const selectedImageIndex = getSelectedImageIndex(item);
    const imageNote = item.useAttachedImage
      ? selectedImageIndex !== undefined
        ? `รูปอ้างอิง #${selectedImageIndex + 1}`
        : 'เปิด img2img แต่ยังไม่เลือกรูป'
      : 'ไม่ใช้รูปอ้างอิง';
    return [
      `โพส: ${getWritingStyleName(item.writingStyleId)}`,
      `ใต้เม้น: ${getWritingStyleName(item.commentStyleId)}`,
      `พาดหัว: ${getHeadlinePackName(item.headlinePackId)}`,
      `โมเดล: ${(item.cardTextModel || TEXT_MODEL).replace('google/', '').replace('openai/', '')}`,
      `ความยาว: ${getArticleLengthLabel(item.articleLength)}`,
      `format: ${CONTENT_FORMAT_OPTIONS.find(opt => opt.id === item.contentFormat)?.label || item.contentFormat}`,
      `ภาพต้นทาง: ${IMAGE_SOURCE_MODE_OPTIONS.find(opt => opt.id === item.imageSourceMode)?.label || item.imageSourceMode}`,
      `ภาพ: ${getImagePromptStyleName(item.cardImagePromptStyleId)} / ${item.cardImageRatio} / ${imageNote}`,
    ].join(' | ');
  };

  const compactPreviewText = (text: string, max = 42) => {
    const clean = String(text || '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[“”"*_#`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return '';
    return clean.length > max ? `${clean.slice(0, Math.max(12, max - 1)).trim()}…` : clean;
  };

  const splitPreviewLines = (headline: string, raw: string) => {
    const source = [headline, raw]
      .filter(Boolean)
      .join(' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[“”"*_#`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const pieces = source
      .split(/[\n|.!?。！？:：\-–—]+/)
      .map(part => compactPreviewText(part, 36))
      .filter(part => part.length >= 6);
    const unique = Array.from(new Set(pieces));
    return [
      unique[0] || 'เลือก Content จากคลัง',
      unique[1] || unique[0] || 'แล้วระบบจะทำตัวอย่างจากเรื่องจริง',
      unique[2] || unique[1] || 'พร้อมแปะเป็นหน้าตาภาพให้ดู',
    ];
  };

  const previewContent = useMemo(() => {
    const cacheEntries = Object.values(articleCache)
      .filter((entry: any) => entry?.rawArticle || entry?.generatedArticle || entry?.selectedHeadline)
      .sort((a: any, b: any) => String(b.lastUpdatedAt || b.cachedAt || '').localeCompare(String(a.lastUpdatedAt || a.cachedAt || '')));

    const selectedItems = bulkItems.filter(item => item.isSelected && (item.rawArticle || item.selectedHeadline || item.title));
    const visibleItems = bulkItems.filter(item => item.rawArticle || item.selectedHeadline || item.title);
    const sourceItems = selectedItems.length > 0 ? selectedItems : visibleItems;
    const candidates = [
      ...sourceItems.map((item, index) => ({
        rawArticle: item.rawArticle,
        generatedArticle: item.generatedArticle,
        selectedHeadline: item.selectedHeadline,
        generatedHeadlines: item.generatedHeadlines,
        title: item.title,
        sourceUrl: item.sourceUrl,
        sourceType: item.sourceType,
        channelName: item.channelName,
        tags: item.tags,
        origin: selectedItems.length > 0 ? `กล่องที่เลือก #${index + 1}` : `กล่องงาน #${index + 1}`,
      })),
      ...cacheEntries.map((entry: any, index) => ({
        ...entry,
        origin: `cache #${index + 1}`,
      })),
    ];
    if (candidates.length === 0) return null;
    const item: any = candidates[Math.abs(previewSeed) % candidates.length];
    const headline = String(
      item.selectedHeadline ||
      (Array.isArray(item.generatedHeadlines) ? item.generatedHeadlines[0] : '') ||
      item.title ||
      '',
    ).trim();
    const raw = String(item.generatedArticle || item.rawArticle || item.title || '').trim();
    const lines = splitPreviewLines(headline, raw);
    let domain = '';
    try {
      domain = item.sourceUrl ? new URL(item.sourceUrl).hostname.replace(/^www\./, '') : '';
    } catch {}
    const sourceLabel = compactPreviewText(item.channelName || domain || item.sourceType || item.origin || 'คลัง Content', 34);
    const tagText = Array.isArray(item.tags) && item.tags.length > 0 ? compactPreviewText(item.tags[0], 18) : '';
    return {
      origin: item.origin || 'คลัง Content',
      sourceLabel,
      tagText,
      lines,
      headline: compactPreviewText(headline || lines[0], 54),
      shortTitle: compactPreviewText(item.title || headline || lines[0], 24),
      metric: compactPreviewText(tagText || sourceLabel || 'Content', 16),
    };
  }, [articleCache, bulkItems, previewSeed]);

  const applyVisualTemplateToAllContent = (
    templateId: VisualTemplateId,
    overrides: Partial<typeof visualTemplateSettings> = {},
  ) => {
    const template = VISUAL_TEMPLATE_PRESETS.find(preset => preset.id === templateId) || VISUAL_TEMPLATE_PRESETS[0];
    const nextSettings = {
      imageMode: overrides.imageMode ?? visualTemplateSettings.imageMode ?? template.imageMode,
      paletteId: overrides.paletteId ?? visualTemplateSettings.paletteId ?? template.paletteId,
      ratio: overrides.ratio ?? visualTemplateSettings.ratio ?? template.ratio,
      decorateOriginalPhoto: overrides.decorateOriginalPhoto ?? visualTemplateSettings.decorateOriginalPhoto ?? true,
    };
    setSelectedVisualTemplateId(template.id);
    setVisualTemplateSettings(nextSettings);
    setBulkItems(prev => prev.map(item => {
      const formatPatch = buildContentFormatPatch(template.format, item, 'เลือกต้นแบบหลัก');
      const imagePatch = buildImageSourcePatch(nextSettings.imageMode, { ...item, ...formatPatch });
      return {
        ...item,
        ...formatPatch,
        ...imagePatch,
        cardImagePromptStyleId: template.promptStyleId,
        cardImageRatio: nextSettings.ratio,
        fontPaletteId: nextSettings.paletteId,
        imageSourceMode: nextSettings.imageMode,
        decorateOriginalPhoto: nextSettings.imageMode === 'ai' ? false : nextSettings.decorateOriginalPhoto,
        smartConfigNote: `ต้นแบบหลัก: ${template.label} → ทุก Content ในส่วนนี้พร้อมทำตามแบบนี้แล้ว`,
      };
    }));
  };

  const selectedVisualTemplate = VISUAL_TEMPLATE_PRESETS.find(preset => preset.id === selectedVisualTemplateId) || VISUAL_TEMPLATE_PRESETS[0];

  const applyBulkMainSettings = (updates: Partial<typeof bulkMainSettings>) => {
    const next = { ...bulkMainSettings, ...updates };
    setBulkMainSettings(next);
    setBulkItems(prev => prev.map(item => ({
      ...item,
      ...updates,
      smartConfigNote: item.smartConfigNote || 'ใช้ค่าหลักจากแผงด้านบน',
    })));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">🤖 สร้างContentลงเพจ AI</h1>
            <p className="text-sm opacity-70">สร้างบทความและรูปภาพพร้อมใช้งานแบบ Auto</p>
         </div>
         <button
           onClick={async () => {
             setIsCheckingCredits(true);
             setCreditCheckResults([]);
             try {
               const candidates = await getOpenRouterKeyCandidates();
               if (candidates.length === 0) { setCreditCheckResults([{label: 'ไม่พบ API Key', keyPreview: '-', valid: false, balance: '$0', usage: '$0', error: 'กรุณาตั้งค่า API Key ในหน้าตั้งค่า'}]); setIsCheckingCredits(false); return; }
               const results: typeof creditCheckResults = [];
               for (const c of candidates) {
                 const info = await checkOpenRouterCredits(c.key);
                 const keyPreview = c.key.slice(0, 8) + '...' + c.key.slice(-4);
                 results.push({
                   label: c.label,
                   keyPreview,
                   valid: info.valid,
                   balance: info.balanceFormatted,
                   usage: `$${(Number(info.usage) || 0).toFixed(4)}`,
                   isFreeTier: info.isFreeTier,
                   keyApiLabel: info.keyLabel,
                   error: info.error,
                 });
               }
               setCreditCheckResults(results);
             } catch (e: any) {
               setCreditCheckResults([{label: 'Error', keyPreview: '-', valid: false, balance: '$0', usage: '$0', error: e.message}]);
             }
             setIsCheckingCredits(false);
           }}
           disabled={isCheckingCredits}
           className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
         >
           {isCheckingCredits ? '⚙️ กำลังตรวจ...' : '💰 เช็คเครดิต API'}
         </button>
         <button
           onClick={async () => {
             try {
               const candidates = await getOpenRouterKeyCandidates();
               if (candidates.length === 0) { setCreditCheckResults([{label: 'ไม่พบ API Key', keyPreview: '-', valid: false, balance: '-', usage: '-', error: 'ไม่พบ Key'}]); return; }
               const c = candidates[0];
               const testModel = textModel || 'google/gemini-2.5-flash';
               setCreditCheckResults([{label: `🧪 กำลังทดสอบ ${testModel}...`, keyPreview: c.key.slice(0,8)+'...'+c.key.slice(-4), valid: true, balance: 'กำลังทดสอบ...', usage: '-'}]);
               const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                 method: 'POST',
                 headers: {
                   'Content-Type': 'application/json',
                   'Authorization': `Bearer ${c.key}`,
                   'HTTP-Referer': window.location.origin,
                 },
                 body: JSON.stringify({ model: testModel, messages: [{role:'user',content:'ตอบแค่คำว่า "OK"'}], max_tokens: 5 })
               });
               const data = await res.json();
               if (res.ok && !data.error) {
                 setCreditCheckResults([{label: `✅ ทดสอบ ${testModel} สำเร็จ!`, keyPreview: c.key.slice(0,8)+'...'+c.key.slice(-4), valid: true, balance: `ตอบกลับ: ${data.choices?.[0]?.message?.content || 'OK'}`, usage: `Model: ${data.model || testModel}`}]);
               } else {
                 const errMsg = data.error?.message || JSON.stringify(data.error) || `HTTP ${res.status}`;
                 setCreditCheckResults([{label: `❌ ทดสอบ ${testModel} ล้มเหลว`, keyPreview: c.key.slice(0,8)+'...'+c.key.slice(-4), valid: false, balance: '-', usage: '-', error: errMsg}]);
               }
             } catch (e: any) {
               setCreditCheckResults([{label: 'Error', keyPreview: '-', valid: false, balance: '-', usage: '-', error: e.message}]);
             }
           }}
           className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-bold transition-colors flex items-center gap-2"
         >
           🧪 ทดสอบ API
         </button>
      </div>

      {/* Credit Check Results - inline panel */}
      {creditCheckResults.length > 0 && (
        <div className="card p-4 border-l-4 border-l-emerald-400 bg-gradient-to-br from-[var(--bg-card)] to-emerald-900/10">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-emerald-400">🔑 ผลตรวจ API Keys</h3>
            <button onClick={() => setCreditCheckResults([])} className="text-xs text-gray-500 hover:text-gray-300">✕ ปิด</button>
          </div>
          <div className="space-y-2">
            {creditCheckResults.map((r, i) => (
              <div key={i} className={`p-3 rounded-lg border text-sm ${r.valid ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                <div className="flex items-center gap-2 font-bold">
                  <span>{r.valid ? '✅' : '❌'}</span>
                  <span className={r.valid ? 'text-emerald-300' : 'text-red-300'}>{r.label}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1 ml-6 space-y-0.5">
                  <div>Key: <span className="text-gray-300 font-mono">{r.keyPreview}</span></div>
                  {r.valid ? (
                    <>
                      {r.isFreeTier && <div>⚠️ Tier: <span className="text-amber-300 font-bold">Free Tier (ใช้ได้แค่โมเดลฟรีเท่านั้น!)</span></div>}
                      {!r.isFreeTier && <div>Tier: <span className="text-emerald-300">Paid (ใช้ได้ทุกโมเดล)</span></div>}
                      <div>ลิมิต Key: <span className="text-emerald-300 font-bold">{r.balance}</span></div>
                      <div>ใช้ไปแล้ว (Key นี้): <span className="text-yellow-300">{r.usage}</span></div>
                      <div className="text-[10px] text-gray-500 mt-1">เครดิตจริงของบัญชีดูได้ที่ openrouter.ai/settings/credits</div>
                    </>
                  ) : (
                    <div>Error: <span className="text-red-300">{r.error}</span></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === BASIC SETTINGS (Logo) === */}
      <div className="card p-5 border-l-4 border-l-cyan-400 bg-gradient-to-br from-[var(--bg-card)] to-cyan-900/10">
        <h2 className="text-base font-bold text-cyan-400 mb-3">⚙️ ตั้งค่าพื้นฐาน</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-3">
            <label className="text-sm font-medium text-cyan-400 block">🏷️ ตราประทับ (Logo)</label>
            <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoFileUpload} />
            <button
              onClick={() => logoInputRef.current?.click()}
              className="w-full py-2 px-3 rounded border text-sm flex items-center justify-center gap-2 transition-colors bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300"
            >
              📎 อัพโหลดโลโก้ใหม่
            </button>
            {/* Saved logo picker */}
            {savedLogos.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-500 mb-1">โลโก้ที่บันทึกไว้ — คลิกเพื่อเลือก:</p>
                <div className="flex flex-wrap gap-2">
                  {savedLogos.map(logo => (
                    <div key={logo.name} className="relative group">
                      <button
                        onClick={() => setLogoUrl(logo.url)}
                        className={`w-12 h-12 rounded border-2 p-0.5 transition-all ${logoUrl === logo.url ? 'border-cyan-400 bg-cyan-900/30' : 'border-gray-600 hover:border-gray-400 bg-gray-800'}`}
                        title={logo.name}
                      >
                        <img src={logo.url} alt={logo.name} className="w-full h-full object-contain" />
                      </button>
                      <button
                        onClick={async () => {
                          await fetch('/api/delete-logo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: logo.name }) });
                          if (logoUrl === logo.url) setLogoUrl('');
                          loadSavedLogos();
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-[9px] items-center justify-center hidden group-hover:flex"
                      >✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {logoUrl && (
              <div className="flex items-center gap-2">
                <img src={logoUrl} alt="Logo Preview" className="h-8 object-contain bg-black/50 p-1 rounded" />
                <span className="text-[10px] text-emerald-400">✅ ใช้งานอยู่</span>
                <button onClick={() => setLogoUrl('')} className="text-xs text-red-400 hover:underline ml-auto">เอาออก</button>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">ตำแหน่ง</label>
                <select className="input-field text-xs py-1 w-full" value={logoPosition} onChange={e => setLogoPosition(e.target.value)}>
                  <option value="top-left">บนซ้าย</option>
                  <option value="top-right">บนขวา</option>
                  <option value="bottom-left">ล่างซ้าย</option>
                  <option value="bottom-right">ล่างขวา</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">ขนาด (%)</label>
                <div className="flex items-center gap-1">
                  <input type="range" min="5" max="50" value={logoSize} onChange={e => setLogoSize(Number(e.target.value))} className="flex-1 h-1" />
                  <span className="text-[10px] text-gray-400 w-6 text-right">{logoSize}%</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Margin X (px) — ห่างซ้าย/ขวา</label>
                <NumInput min={0} max={500} value={logoMarginX} onChange={setLogoMarginX} className="input-field text-xs py-1 w-full" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Margin Y (px) — ห่างบน/ล่าง</label>
                <NumInput min={0} max={500} value={logoMarginY} onChange={setLogoMarginY} className="input-field text-xs py-1 w-full" />
              </div>
            </div>
            <button onClick={handleSaveLogoSettings} className="text-[10px] text-cyan-500 hover:text-cyan-400 hover:underline flex items-center gap-1">
              💾 จำค่า Logo นี้ไว้ใช้ครั้งหน้า
            </button>
          </div>
        </div>
      </div>

      {false && (
      /* === SINGLE MODE - HIDDEN: batch/content-library flow is the primary workflow === */
      <div className="card p-5 border-l-4 border-l-amber-500 bg-gradient-to-br from-[var(--bg-card)] to-amber-900/10">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setSingleModeCollapsed(prev => !prev)}
        >
          <div>
            <h2 className="text-lg font-bold text-amber-400 mb-1">📝 โหมดสร้างทีละชิ้น</h2>
            <p className="text-xs text-gray-400">สร้างบทความ+รูปทีละชิ้น ใส่บทความดิบ เลือกสไตล์ แล้วกดสร้าง</p>
          </div>
          <button className="text-xs bg-gray-700/60 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg font-medium transition-all flex-shrink-0 ml-4">
            {singleModeCollapsed ? '▶ ขยาย' : '▼ ซ่อน'}
          </button>
        </div>

        {!singleModeCollapsed && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-5">
            {/* Left Column: Raw Content & Text Models */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">1. วางบทความดิบ (ข้อมูลที่ต้องการสื่อสาร)</label>
                <textarea
                  className="input-field h-32 w-full"
                  placeholder="วางเนื้อหาข้อมูลดิบที่นี่... (เช่น ข่าวใหม่, โปรโมชั่น, ความรู้)"
                  value={rawArticle}
                  onChange={e => setRawArticle(e.target.value)}
                />
                <label className="text-xs font-medium text-gray-500 block mb-1 mt-2">🌐 Website ที่มา (ไม่บังคับ)</label>
                <input type="url" className="input-field w-full text-sm" placeholder="https://example.com/article-url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">2. สไตล์เขียนโพสที่แนบรูป</label>
                  <select className="input-field w-full text-sm" value={selectedStyleId} onChange={e => setSelectedStyleId(e.target.value)}>
                    <option value="">-- เลือก --</option>
                    {attachedPostStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">3. สไตล์เขียนมีใต้คอมเม้น</label>
                  <select className="input-field w-full text-sm" value={selectedCommentStyleId} onChange={e => setSelectedCommentStyleId(e.target.value)}>
                    <option value="">-- เลือก --</option>
                    {commentPostStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-amber-300 block mb-1">4. สไตล์พาดหัว</label>
                  <select className="input-field w-full text-sm" value={selectedPackId} onChange={e => setSelectedPackId(e.target.value)}>
                    <option value="">-- เลือกพาดหัว --</option>
                    {headlinePacks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">5. โมเดล AI</label>
                <select className="input-field w-full text-sm" value={textModel} onChange={e => setTextModel(e.target.value)}>
                  <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
                  <option value="deepseek/deepseek-chat">DeepSeek V4 (ใหม่ล่าสุด+เทพ)</option>
                  <option value="openai/gpt-4o">GPT-4o</option>
                  <option value="openai/gpt-oss-20b:free">🆓 GPT OSS 20B (ฟรี!)</option>
                  <option value="google/gemma-3-27b-it:free">🆓 Gemma 3 27B (ฟรี!)</option>
                </select>
              </div>
              <button
                onClick={handleGenerateArticleAndHeadlines}
                disabled={isGeneratingArticle}
                className="bg-emerald-600 hover:bg-emerald-700 w-full py-3 rounded-lg font-bold shadow-lg transition-colors text-white disabled:opacity-50"
              >
                {isGeneratingArticle ? '⏳ กำลังทำงาน...' : '1️⃣ ให้ AI เขียนบทความ + คิดพาดหัว'}
              </button>
              {processLogStep1 && (
                <div className="text-xs text-emerald-400 bg-emerald-900/30 p-2 rounded text-center animate-pulse border border-emerald-800">
                  {processLogStep1}
                </div>
              )}
            </div>

            {/* Right Column: Results & Queue */}
            <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-gray-700/50">
              <div className="space-y-2">
                <label className="text-sm font-medium text-amber-300">ผลลัพธ์โพสยาวแนบรูป (แก้ไขได้)</label>
                <textarea
                  className="input-field h-32 w-full text-sm"
                  placeholder="บทความที่ AI เขียนจะมาอยู่ตรงนี้..."
                  value={generatedArticle}
                  onChange={e => setGeneratedArticle(e.target.value)}
                />
                <label className="text-sm font-medium text-cyan-300 block pt-2">ผลลัพธ์แคปชั่นสั้น + ใต้คอมเม้น (แก้ไขได้)</label>
                <textarea
                  className="input-field h-32 w-full text-sm"
                  placeholder="โพสต์แคปชั่นสั้นและใต้เม้น 1/3, 2/3, 3/3 จะมาอยู่ตรงนี้..."
                  value={generatedCommentPost}
                  onChange={e => setGeneratedCommentPost(e.target.value)}
                />
                {generatedArticle && (
                  <div className="bg-amber-900/20 p-4 rounded-xl border border-amber-500/30 mt-3 shadow-inner">
                    <label className="text-sm font-semibold text-amber-400 block mb-2">💡 สอน AI ให้เขียนดีขึ้น (ติชม/แนะนำ)</label>
                    <div className="space-y-3">
                      <textarea
                        className="input-field w-full h-20 text-sm resize-none"
                        placeholder="บอกสิ่งที่อยากให้ AI ปรับปรุง เช่น 'เล่าเรื่องให้กระชับขึ้น', 'ลดการใช้อีโมจิลง'..."
                        value={articleFeedback}
                        onChange={e => setArticleFeedback(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button disabled={isRewriting || !articleFeedback.trim()} onClick={() => handleRewriteArticleWithFeedback(false)} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-amber-900/20">
                          {isRewriting ? '⏳ กำลังแก้...' : '🔄 แก้ไข + จำใส่สไตล์เดิม'}
                        </button>
                        <button disabled={isRewriting || !articleFeedback.trim()} onClick={() => handleRewriteArticleWithFeedback(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/20">
                          💾 เซฟแยกเป็นสไตล์ใหม่
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-amber-300">เลือกพาดหัวที่โดนใจ</label>
                <select className="input-field w-full border-amber-500/50" value={selectedGeneratedHeadline} onChange={e => setSelectedGeneratedHeadline(e.target.value)}>
                  <option value="">-- รอให้ AI สร้างและเลือกพาดหัว --</option>
                  {generatedHeadlines.map((h, i) => <option key={i} value={h}>{h}</option>)}
                </select>
                {generatedHeadlines.length > 0 && (
                  <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/30 mt-3 shadow-inner">
                    <label className="text-sm font-semibold text-blue-400 block mb-2">💡 สอน AI ให้เขียนพาดหัวใหม่ (ติชม/แนะนำ)</label>
                    <div className="space-y-3">
                      <textarea
                        className="input-field w-full h-16 text-sm resize-none"
                        placeholder="เช่น 'ขอพาดหัวแบบคลิกเบต', 'ใช้คำศัพท์วัยรุ่น', 'สั้นๆ กระชับ'..."
                        value={headlineFeedback}
                        onChange={e => setHeadlineFeedback(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button disabled={isRewritingHeadline || !headlineFeedback.trim()} onClick={() => handleRewriteHeadlineWithFeedback(false)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-blue-900/20">
                          {isRewritingHeadline ? '⏳ กำลังแก้...' : '🔄 แก้ไข + จำใส่สไตล์พาดหัวเดิม'}
                        </button>
                        <button disabled={isRewritingHeadline || !headlineFeedback.trim()} onClick={() => handleRewriteHeadlineWithFeedback(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/20">
                          💾 เซฟแยกเป็น Pack พาดหัวใหม่
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <hr className="border-gray-700/50 my-4"/>

              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="text-sm font-medium text-emerald-300 block mb-1">สัดส่วนรูปภาพ</label>
                  <select className="input-field w-full text-sm border-emerald-500/50" value={imageRatio} onChange={e => setImageRatio(e.target.value)}>
                    <option value="1:1">1:1 (Square)</option>
                    <option value="16:9">16:9 (Landscape)</option>
                    <option value="9:16">9:16 (Portrait)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-emerald-300 block mb-1">สไตล์ภาพ (Image Prompt)</label>
                  <select className="input-field w-full text-sm border-emerald-500/50" value={selectedImagePromptId} onChange={e => setSelectedImagePromptId(e.target.value)}>
                    <option value="">-- อิงตามสแกนล่าสุด --</option>
                    {imagePromptStyles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={handleGeneratePromptJson}
                disabled={isGeneratingPrompt}
                className="bg-amber-600 hover:bg-amber-700 w-full py-3 rounded-lg font-bold shadow-lg transition-colors text-white disabled:opacity-50"
              >
                {isGeneratingPrompt ? '⏳ กำลังประมวลผล...' : '2️⃣ สังเคราะห์ Prompt วาดรูป (JSON)'}
              </button>
              {processLogStep2 && (
                <div className="mt-2 text-xs text-amber-400 bg-amber-900/30 p-2 rounded text-center animate-pulse border border-amber-800">
                  {processLogStep2}
                </div>
              )}

              {finalPromptJson && (
                <div className="mt-2">
                  <label className="text-[10px] text-gray-500 block mb-1">Prompt JSON (แก้ไขได้)</label>
                  <textarea className="input-field w-full h-24 text-xs font-mono" value={finalPromptJson} onChange={e => setFinalPromptJson(e.target.value)} />
                </div>
              )}

              <button onClick={addToQueue} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 w-full py-4 mt-2 rounded-xl text-lg font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
                3️⃣ 🚀 ส่งเข้าคิวสร้างรูปภาพจริง
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* === BULK MODE PANEL === */}
      <div className="card p-5 space-y-4 border-l-4 border-l-cyan-500 bg-gradient-to-br from-[var(--bg-card)] to-cyan-900/10">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
              📦 สร้างจากคลังบทความ
              {bulkItems.length > 0 && <span className="text-xs bg-cyan-600 text-white px-2 py-0.5 rounded-full">{bulkItems.length} รายการ</span>}
            </h2>
            <p className="text-xs text-gray-400">ถ้าอยากสร้างบทความไหน ให้กดเลือกในคลังบทความ แล้วมันจะมาปรากฏที่นี่ หรือจะกด "เพิ่มกล่องบทความ" เพื่อใส่บทความเองก็ได้ — สร้างได้หลายงานพร้อมกัน เรียงคิวอัตโนมัติ</p>
          </div>
          <button onClick={addBulkItem} className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-1">
            ➕ เพิ่มกล่องบทความ
          </button>
        </div>

        <div className="rounded-xl border border-gray-700/60 bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-gray-100">เลือกต้นแบบหลักสำหรับทุก Content</div>
              <div className="text-[11px] text-gray-500">
                {previewContent
                  ? `กำลังโชว์ตัวอย่างจาก ${previewContent.origin}: ${previewContent.headline}`
                  : 'ยังไม่เจอ content ในกล่อง/cache กดกู้คืนหรือส่งจากคลัง Content มาก่อน'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreviewSeed(prev => prev + 1)}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-bold text-gray-200 transition-colors hover:border-cyan-400 hover:text-cyan-200"
            >
              สุ่มตัวอย่างจากคลัง
            </button>
          </div>
          <div className="mb-3 text-[11px] text-gray-500">
            เลือกต้นแบบแล้วทุก Content ในส่วนนี้จะถูกตั้งค่าตามแบบเดียวกันทันที ไม่ต้องไปตั้งค่าทีละกล่อง
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => applyVisualTemplateToAllContent('top-gainers-classic', {
                imageMode: 'attached',
                paletteId: 'tg-classic',
                ratio: '1:1',
                decorateOriginalPhoto: true,
              })}
              className={`group rounded-lg border bg-slate-950 p-2 text-left transition-all hover:border-rose-400 hover:bg-rose-950/20 ${
                selectedVisualTemplateId === 'top-gainers-classic' ? 'border-cyan-300 ring-2 ring-cyan-400/80 bg-cyan-950/20' : 'border-gray-700'
              }`}
            >
              <div className="aspect-square overflow-hidden rounded-md bg-[#050505] shadow-inner">
                <div className="h-[57%] bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 relative">
                  <div className="absolute left-3 top-3 rounded border border-slate-500 bg-black/85 px-3 py-2">
                    <div className="text-lg font-black leading-none text-white">{previewContent?.shortTitle || 'Content'}</div>
                    <div className="text-[10px] font-bold leading-tight text-slate-300">{previewContent?.sourceLabel || 'คลัง Content'}</div>
                  </div>
                  <div className="absolute right-4 top-5 rounded border border-red-400 bg-black/90 px-3 py-2 text-right">
                    <div className="text-xl font-black leading-none text-red-400">{previewContent?.tagText ? `#${previewContent.tagText}` : 'NEW'}</div>
                    <div className="text-[10px] font-bold text-white">{previewContent?.sourceLabel || 'Content'}</div>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 rounded border border-white/70 bg-black/85 p-3 shadow-lg">
                    <div className="text-sm font-black leading-tight text-[#fff200]">{previewContent?.lines[0] || 'เลือก Content จากคลัง'}</div>
                    <div className="mt-1 text-xs font-bold leading-tight text-white">{previewContent?.lines[1] || 'ระบบจะดึงเรื่องจริงมาโชว์'}</div>
                    <div className="mt-1 text-[9px] font-bold text-slate-300">ที่มา: {previewContent?.sourceLabel || 'คลัง Content'}</div>
                  </div>
                </div>
                <div className="h-[2%] bg-[#ff4747]" />
                <div className="h-[41%] bg-black p-3 text-center">
                  <div className="mx-auto mb-3 bg-[#0f9f82] px-2 py-1 text-[15px] font-black leading-tight text-white">
                    {previewContent?.lines[0] || 'กู้ Content มาใช้เลย'}
                  </div>
                  <div className="mb-3 text-[18px] font-black leading-tight text-white">
                    {previewContent?.lines[1] || 'เลือกจากคลังหรือ cache'}
                  </div>
                  <div className="bg-[#138f83] px-2 py-1 text-[15px] font-black leading-tight text-white">
                    {previewContent?.lines[2] || 'แล้วทำหน้าตาภาพใหม่'}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs font-black text-white">Top Gainers Classic</div>
              <div className="text-[10px] text-gray-500">รูปข่าว/YouTube + พาดหัวแถบใหญ่</div>
            </button>

            <button
              type="button"
              onClick={() => applyVisualTemplateToAllContent('editorial-emerald', {
                imageMode: 'github-random',
                paletteId: 'tg-emerald-gold',
                ratio: '1:1',
                decorateOriginalPhoto: true,
              })}
              className={`group rounded-lg border bg-slate-950 p-2 text-left transition-all hover:border-emerald-400 hover:bg-emerald-950/20 ${
                selectedVisualTemplateId === 'editorial-emerald' ? 'border-emerald-300 ring-2 ring-emerald-400/80 bg-emerald-950/20' : 'border-gray-700'
              }`}
            >
              <div className="aspect-square overflow-hidden rounded-md bg-[#06130f] shadow-inner">
                <div className="h-[60%] bg-gradient-to-br from-emerald-950 via-slate-900 to-yellow-950 relative">
                  <div className="absolute left-4 top-4 rounded bg-emerald-700/90 px-3 py-2">
                    <div className="text-xs font-black text-emerald-50">{previewContent?.sourceLabel || 'EDITORIAL PICK'}</div>
                    <div className="text-[9px] font-bold text-emerald-200">{previewContent?.origin || 'สุ่มจากคลังรูป'}</div>
                  </div>
                  <div className="absolute bottom-5 right-5 rounded border border-yellow-300/50 bg-yellow-300/20 px-3 py-3 text-center">
                    <div className="text-2xl font-black text-yellow-200">{previewContent?.metric || 'PICK'}</div>
                    <div className="text-[9px] font-bold text-yellow-100">จากคลัง</div>
                  </div>
                </div>
                <div className="h-[40%] bg-black p-3">
                  <div className="mb-3 w-[82%] bg-[#059669] px-2 py-1 text-[15px] font-black leading-tight text-white">
                    {previewContent?.lines[0] || 'เลือก Content จากคลัง'}
                  </div>
                  <div className="mb-3 bg-[#facc15] px-2 py-1 text-[16px] font-black leading-tight text-black">
                    {previewContent?.lines[1] || 'แล้วทำภาพใหม่ทันที'}
                  </div>
                  <div className="w-[92%] bg-white px-2 py-1 text-[14px] font-black leading-tight text-slate-950">
                    {previewContent?.lines[2] || 'ไม่ใช้ข้อความตัวอย่างเดิม'}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs font-black text-white">Editorial Emerald</div>
              <div className="text-[10px] text-gray-500">สุ่มคลังรูป + สีเขียวทอง</div>
            </button>

            <button
              type="button"
              onClick={() => applyVisualTemplateToAllContent('quote-card', {
                imageMode: 'attached',
                paletteId: 'tg-graphite-gold',
                ratio: '1:1',
                decorateOriginalPhoto: true,
              })}
              className={`group rounded-lg border bg-slate-950 p-2 text-left transition-all hover:border-amber-400 hover:bg-amber-950/20 ${
                selectedVisualTemplateId === 'quote-card' ? 'border-amber-300 ring-2 ring-amber-400/80 bg-amber-950/20' : 'border-gray-700'
              }`}
            >
              <div className="aspect-square overflow-hidden rounded-md bg-gradient-to-br from-zinc-950 via-slate-900 to-amber-950 p-4 shadow-inner">
                <div className="mb-6 w-36 rounded border border-amber-300/70 bg-black/50 px-3 py-2">
                  <div className="text-xs font-black text-amber-200">{previewContent?.sourceLabel || 'QUOTE CARD'}</div>
                  <div className="text-[9px] font-bold text-slate-300">{previewContent?.origin || 'บทเรียนจากคลัง'}</div>
                </div>
                <div className="mb-1 text-[70px] leading-none text-amber-300/40">“</div>
                <div className="mb-3 text-[19px] font-black leading-tight text-white">
                  {previewContent?.lines[0] || 'เลือกเรื่องจากคลังจริง'}
                </div>
                <div className="mb-3 bg-amber-300 px-2 py-1 text-[16px] font-black leading-tight text-black">
                  {previewContent?.lines[1] || 'แล้วสรุปเป็น Quote Card'}
                </div>
                <div className="text-[12px] font-bold leading-tight text-slate-300">
                  {previewContent?.lines[2] || 'ใช้ข้อความจาก Content ของคุณเอง'}
                </div>
              </div>
              <div className="mt-2 text-xs font-black text-white">Quote Card</div>
              <div className="text-[10px] text-gray-500">คำสอนคนดัง/ข้อคิด/บทเรียน</div>
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-950/10 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-black text-cyan-200">ตั้งค่าแม่แบบ: {selectedVisualTemplate.label}</div>
                <div className="text-[11px] text-gray-500">{selectedVisualTemplate.desc} · ใช้กับทุก Content ในส่วนนี้</div>
              </div>
              <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold text-cyan-200">
                พร้อมใช้ {bulkItems.length} รายการ
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">
                  {selectedVisualTemplate.format === 'quote' ? 'ชุดสี Quote' : 'ชุดสีแบบ Top Gainers'}
                </label>
                <select
                  className="input-field text-xs py-1.5 w-full"
                  value={visualTemplateSettings.paletteId}
                  onChange={e => applyVisualTemplateToAllContent(selectedVisualTemplateId, { paletteId: e.target.value })}
                >
                  {YOUTUBE_FONT_PALETTES
                    .filter(p => p.id.startsWith('tg-'))
                    .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">ภาพต้นทาง</label>
                <select
                  className="input-field text-xs py-1.5 w-full"
                  value={visualTemplateSettings.imageMode}
                  onChange={e => applyVisualTemplateToAllContent(selectedVisualTemplateId, { imageMode: e.target.value as BulkArticleItem['imageSourceMode'] })}
                >
                  {IMAGE_SOURCE_MODE_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">สัดส่วนรูป</label>
                <select
                  className="input-field text-xs py-1.5 w-full"
                  value={visualTemplateSettings.ratio}
                  onChange={e => applyVisualTemplateToAllContent(selectedVisualTemplateId, { ratio: e.target.value })}
                >
                  <option value="1:1">1:1 (Square)</option>
                  <option value="16:9">16:9 (Landscape)</option>
                  <option value="9:16">9:16 (Portrait)</option>
                </select>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-700 bg-black/25 px-3 py-2">
                <span>
                  <span className="block text-[10px] font-bold text-gray-400">คงรูปเดิมไว้</span>
                  <span className="block text-[10px] text-gray-500">แปะพาดหัวทับรูป ไม่ให้ AI วาดใหม่</span>
                </span>
                <button
                  type="button"
                  onClick={() => applyVisualTemplateToAllContent(selectedVisualTemplateId, { decorateOriginalPhoto: !visualTemplateSettings.decorateOriginalPhoto })}
                  disabled={visualTemplateSettings.imageMode === 'ai'}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
                    visualTemplateSettings.decorateOriginalPhoto && visualTemplateSettings.imageMode !== 'ai' ? 'bg-cyan-500' : 'bg-gray-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    visualTemplateSettings.decorateOriginalPhoto && visualTemplateSettings.imageMode !== 'ai' ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </label>
            </div>

            <div className="mt-3 rounded-lg border border-gray-700/70 bg-black/25 p-2 text-[11px] leading-relaxed text-gray-400">
              ใช้สไตล์ภาพ: <span className="font-bold text-cyan-200">{getImagePromptStyleName(selectedVisualTemplate.promptStyleId)}</span>
              {' '}· palette: <span className="font-bold text-white">{YOUTUBE_FONT_PALETTES.find(p => p.id === visualTemplateSettings.paletteId)?.name || visualTemplateSettings.paletteId}</span>
              {' '}· ภาพต้นทาง: <span className="font-bold text-white">{IMAGE_SOURCE_MODE_OPTIONS.find(opt => opt.id === visualTemplateSettings.imageMode)?.label}</span>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-950/10 p-3">
            <div className="mb-3">
              <div className="text-sm font-black text-amber-200">ตั้งค่าการเขียนหลักของงานทั้งหมด</div>
              <div className="text-[11px] text-gray-500">ค่าตรงนี้จะใช้กับทุก Content ในส่วนนี้ทันที แทนการตั้งค่าซ้ำในแต่ละการ์ด</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">สไตล์โพสต์</label>
                <select
                  className="input-field text-xs py-1.5 w-full"
                  value={bulkMainSettings.writingStyleId}
                  onChange={e => applyBulkMainSettings({ writingStyleId: e.target.value })}
                >
                  <option value="">-- เลือก --</option>
                  {attachedPostStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">สไตล์ใต้คอมเม้น</label>
                <select
                  className="input-field text-xs py-1.5 w-full"
                  value={bulkMainSettings.commentStyleId}
                  onChange={e => applyBulkMainSettings({ commentStyleId: e.target.value })}
                >
                  <option value="">-- เลือก --</option>
                  {commentPostStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">สไตล์พาดหัว</label>
                <select
                  className="input-field text-xs py-1.5 w-full"
                  value={bulkMainSettings.headlinePackId}
                  onChange={e => applyBulkMainSettings({ headlinePackId: e.target.value })}
                >
                  <option value="">-- เลือก --</option>
                  {headlinePacks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">โมเดล AI</label>
                <select
                  className="input-field text-xs py-1.5 w-full"
                  value={bulkMainSettings.cardTextModel}
                  onChange={e => applyBulkMainSettings({ cardTextModel: e.target.value })}
                >
                  <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
                  <option value="deepseek/deepseek-chat">DeepSeek V4</option>
                  <option value="openai/gpt-4o">GPT-4o</option>
                  <option value="openai/gpt-oss-20b:free">GPT OSS 20B ฟรี</option>
                  <option value="google/gemma-3-27b-it:free">Gemma 3 27B ฟรี</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">ความยาวบทความ</label>
                <select
                  className="input-field text-xs py-1.5 w-full"
                  value={bulkMainSettings.articleLength}
                  onChange={e => applyBulkMainSettings({ articleLength: e.target.value })}
                >
                  {ARTICLE_LENGTH_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label} ({opt.range})</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-teal-500/25 bg-teal-500/10 p-3">
          <div className="min-w-[220px] flex-1">
            <div className="text-sm font-bold text-teal-200">♻️ กู้บทความที่เคยรันไว้</div>
            <div className="text-xs text-gray-400 mt-1">
              เหลือใน cache <span className="text-white font-bold">{recoverableCacheCount.toLocaleString()}</span> รายการที่ยังไม่อยู่ในผลลัพธ์/export แล้ว เอากลับมากดสร้างรูปต่อได้
            </div>
            {exportedCsvRefs.urls.length > 0 && (
              <div className="text-[11px] text-teal-300 mt-1">
                อ่าน export CSV แล้ว {exportedCsvRefs.urls.length.toLocaleString()} รายการ จะไม่กู้ซ้ำ
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-teal-500/25 bg-black/20 px-3 py-2">
            <span className="text-xs text-gray-400 whitespace-nowrap">กู้ล่าสุด</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={recoverCacheLimit}
              onChange={e => setRecoverCacheLimit(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
              className="w-20 bg-transparent text-center text-sm font-bold text-white outline-none"
            />
            <span className="text-xs text-gray-500">รายการ</span>
          </label>
          <button
            onClick={recoverCachedArticlesToBulk}
            disabled={isRecoveringCache || recoverableCacheCount === 0}
            className="bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all border border-teal-400/30"
          >
            {isRecoveringCache ? '⏳ กำลังกู้...' : '♻️ กู้คืนเข้ากล่องงาน'}
          </button>
        </div>

        {bulkItems.length > 0 && (
          <>
            {/* Selection Controls */}
            <div className="flex flex-wrap items-center gap-2 bg-black/20 p-3 rounded-lg border border-gray-700/50">
              <button onClick={selectAllBulk} className="text-xs bg-cyan-700/50 hover:bg-cyan-700 text-cyan-300 px-3 py-1.5 rounded font-medium transition-all">☑ เลือกทั้งหมด</button>
              <button onClick={deselectAllBulk} className="text-xs bg-gray-700/50 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded font-medium transition-all">☐ ยกเลิกทั้งหมด</button>
              <span className="text-xs text-gray-500 ml-2">เลือกอยู่ {selectedBulkCount}/{bulkItems.length} รายการ</span>
              {bulkItems.length > 0 && (
                <button onClick={() => { if (confirm('ลบกล่องทั้งหมด?')) setBulkItems([]); }} className="text-xs text-red-400/60 hover:text-red-400 ml-auto transition-all">🗑️ ล้างทั้งหมด</button>
              )}
            </div>

            {/* Global Apply Settings Panel */}
            {false && selectedBulkCount > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 overflow-hidden">
                <button
                  onClick={() => setShowGlobalApply(p => !p)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-amber-300 hover:bg-amber-900/20 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    ⚙️ ตั้งค่าพร้อมกันทั้งหมด
                    <span className="text-xs font-normal bg-amber-600/40 text-amber-200 px-2 py-0.5 rounded-full">{selectedBulkCount} รายการที่เลือก</span>
                  </span>
                  <span className="text-xs opacity-60">{showGlobalApply ? '▲ ซ่อน' : '▼ แสดง'}</span>
                </button>

                {showGlobalApply && (
                  <div className="px-4 pb-4 space-y-3 border-t border-amber-500/20">
                    <p className="text-[11px] text-amber-400/70 pt-2">เลือกเฉพาะค่าที่ต้องการเปลี่ยน — ค่าที่ปล่อยว่างไว้จะไม่ถูกแก้ไข</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[9px] text-gray-400 block mb-0.5">สไตล์เขียนโพสที่แนบรูป</label>
                        <select
                          className="input-field text-xs py-1 w-full"
                          value={globalApplySettings.writingStyleId ?? ''}
                          onChange={e => setGlobalApplySettings(p => ({ ...p, writingStyleId: e.target.value || undefined }))}
                        >
                          <option value="">-- ไม่เปลี่ยน --</option>
                          {attachedPostStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400 block mb-0.5">สไตล์เขียนใต้คอมเม้น</label>
                        <select
                          className="input-field text-xs py-1 w-full"
                          value={globalApplySettings.commentStyleId ?? ''}
                          onChange={e => setGlobalApplySettings(p => ({ ...p, commentStyleId: e.target.value || undefined }))}
                        >
                          <option value="">-- ไม่เปลี่ยน --</option>
                          {commentPostStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400 block mb-0.5">สไตล์พาดหัว</label>
                        <select
                          className="input-field text-xs py-1 w-full"
                          value={globalApplySettings.headlinePackId ?? ''}
                          onChange={e => setGlobalApplySettings(p => ({ ...p, headlinePackId: e.target.value || undefined }))}
                        >
                          <option value="">-- ไม่เปลี่ยน --</option>
                          {headlinePacks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400 block mb-0.5">รูปแบบงาน</label>
                        <select
                          className="input-field text-xs py-1 w-full"
                          value={globalApplySettings.contentFormat ?? ''}
                          onChange={e => setGlobalApplySettings(p => ({ ...p, contentFormat: (e.target.value || undefined) as BulkArticleItem['contentFormat'] | undefined }))}
                        >
                          <option value="">-- ไม่เปลี่ยน --</option>
                          {CONTENT_FORMAT_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400 block mb-0.5">ภาพต้นทาง</label>
                        <select
                          className="input-field text-xs py-1 w-full"
                          value={globalApplySettings.imageSourceMode ?? ''}
                          onChange={e => setGlobalApplySettings(p => ({ ...p, imageSourceMode: (e.target.value || undefined) as BulkArticleItem['imageSourceMode'] | undefined }))}
                        >
                          <option value="">-- ไม่เปลี่ยน --</option>
                          {IMAGE_SOURCE_MODE_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400 block mb-0.5">โมเดล AI</label>
                        <select
                          className="input-field text-xs py-1 w-full"
                          value={globalApplySettings.cardTextModel ?? ''}
                          onChange={e => setGlobalApplySettings(p => ({ ...p, cardTextModel: e.target.value || undefined }))}
                        >
                          <option value="">-- ไม่เปลี่ยน --</option>
                          <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                          <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
                          <option value="deepseek/deepseek-chat">DeepSeek V4 (ใหม่ล่าสุด+เทพ)</option>
                          <option value="openai/gpt-4o">GPT-4o</option>
                          <option value="openai/gpt-oss-20b:free">🆓 GPT OSS 20B (ฟรี!)</option>
                          <option value="google/gemma-3-27b-it:free">🆓 Gemma 3 27B (ฟรี!)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400 block mb-0.5">ความยาวบทความ</label>
                        <select
                          className="input-field text-xs py-1 w-full"
                          value={globalApplySettings.articleLength ?? ''}
                          onChange={e => setGlobalApplySettings(p => ({ ...p, articleLength: e.target.value || undefined }))}
                        >
                          <option value="">-- ไม่เปลี่ยน --</option>
                          {ARTICLE_LENGTH_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label} ({opt.range})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400 block mb-0.5">สัดส่วนรูป</label>
                        <select
                          className="input-field text-xs py-1 w-full"
                          value={globalApplySettings.cardImageRatio ?? ''}
                          onChange={e => setGlobalApplySettings(p => ({ ...p, cardImageRatio: e.target.value || undefined }))}
                        >
                          <option value="">-- ไม่เปลี่ยน --</option>
                          <option value="1:1">1:1 (Square)</option>
                          <option value="16:9">16:9 (Landscape)</option>
                          <option value="9:16">9:16 (Portrait)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400 block mb-0.5">สไตล์ภาพ (Prompt)</label>
                        <select
                          className="input-field text-xs py-1 w-full"
                          value={globalApplySettings.cardImagePromptStyleId ?? ''}
                          onChange={e => setGlobalApplySettings(p => ({ ...p, cardImagePromptStyleId: e.target.value || undefined }))}
                        >
                          <option value="">-- ไม่เปลี่ยน --</option>
                          <option value={EDITORIAL_IMAGE_STYLE_ID}>Editorial แบบ Top Gainers</option>
                          <option value={QUOTE_IMAGE_STYLE_ID}>Quote / คำสอนคนดัง</option>
                          <option value={YOUTUBE_IMAGE_STYLE_ID}>รูปจากยูทูป</option>
                          <option value={AI_NEWS_IMAGE_STYLE_ID}>ข่าวAI</option>
<option value={GITHUB_IMAGE_STYLE_ID}>Github (สุ่มรูปจากคลัง)</option>
                          {imagePromptStyles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => {
                          let patch: Partial<BulkArticleItem> = {};
                          if (globalApplySettings.writingStyleId !== undefined) patch.writingStyleId = globalApplySettings.writingStyleId;
                          if (globalApplySettings.commentStyleId !== undefined) patch.commentStyleId = globalApplySettings.commentStyleId;
                          if (globalApplySettings.headlinePackId !== undefined) patch.headlinePackId = globalApplySettings.headlinePackId;
                          if (globalApplySettings.cardTextModel !== undefined) patch.cardTextModel = globalApplySettings.cardTextModel;
                          if (globalApplySettings.articleLength !== undefined) patch.articleLength = globalApplySettings.articleLength;
                          if (globalApplySettings.cardImageRatio !== undefined) patch.cardImageRatio = globalApplySettings.cardImageRatio;
                          if (globalApplySettings.cardImagePromptStyleId !== undefined) patch.cardImagePromptStyleId = globalApplySettings.cardImagePromptStyleId;
                          if (globalApplySettings.cardImagePromptStyleId === EDITORIAL_IMAGE_STYLE_ID) patch.contentFormat = 'editorial';
                          if (globalApplySettings.cardImagePromptStyleId === QUOTE_IMAGE_STYLE_ID) patch.contentFormat = 'quote';
                          if (Object.keys(patch).length === 0 && globalApplySettings.contentFormat === undefined && globalApplySettings.imageSourceMode === undefined) return;
                          setBulkItems(prev => prev.map(item => {
                            if (!item.isSelected) return item;
                            let nextPatch = { ...patch };
                            if (globalApplySettings.contentFormat !== undefined) {
                              nextPatch = { ...nextPatch, ...buildContentFormatPatch(globalApplySettings.contentFormat, { ...item, ...nextPatch }, 'ตั้งค่าพร้อมกัน') };
                            }
                            if (globalApplySettings.imageSourceMode !== undefined) {
                              nextPatch = { ...nextPatch, ...buildImageSourcePatch(globalApplySettings.imageSourceMode, { ...item, ...nextPatch }) };
                            }
                            return { ...item, ...nextPatch };
                          }));
                        }}
                        className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                      >
                        ✅ ใช้กับที่เลือกทั้งหมด ({selectedBulkCount} รายการ)
                      </button>
                      <button
                        onClick={() => setGlobalApplySettings({})}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        ↺ รีเซ็ตค่า
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Smart Auto-Config log */}
            {smartConfigLog && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-900/30 border border-violet-500/40 rounded-xl text-sm text-violet-200">
                <span className="animate-spin text-base">⚙️</span>
                <span>{smartConfigLog}</span>
              </div>
            )}

            {/* Quick Actions for Selected */}
            {selectedBulkCount > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-black/20 rounded-xl border border-gray-700/40">
                <span className="text-xs text-gray-500 self-center shrink-0">⚡ Action ทุกอัน:</span>

                {/* ── Smart Auto-Config ── */}
                <div className="flex flex-col w-full sm:w-auto">
                  <button
                    onClick={handleSmartAutoConfig}
                    disabled={isSmartConfigRunning || isBulkProcessing}
                    className="text-xs bg-violet-700/70 hover:bg-violet-600 disabled:opacity-50 text-violet-100 px-3 py-1.5 rounded-lg font-bold transition-all border border-violet-500/50 flex items-center gap-1.5"
                    title="ตั้งค่าทุกอย่างอัตโนมัติ: ตรวจจับ YouTube/ข่าว, ดูดรูป, เลือกสไตล์ภาพ, วิเคราะห์รูป, เลือกคำสำคัญ, สร้างบทความ+พาดหัว"
                  >
                    {isSmartConfigRunning ? '⏳ กำลัง Smart Setup...' : `🧠 Smart Setup (${selectedBulkCount} อัน)`}
                  </button>
                  <span className="text-[10px] text-violet-400/60 mt-1 max-w-[280px] leading-tight">
                    🔍 ดูดรูปข่าว (ถ้ายังไม่มี) → ตั้งสไตล์ภาพตามประเภท YouTube/ข่าว/GitHub → GitHub สุ่มรูปตามหัวข้อจากคลัง → สร้างบทความ+พาดหัวไทย → เน้นคำสำคัญ
                  </span>
                </div>

                <div className="flex flex-col w-full sm:w-auto">
                  <button
                    onClick={handlePickGithubStockFolder}
                    disabled={isSmartConfigRunning || isBulkProcessing}
                    className="text-xs bg-slate-700/70 hover:bg-slate-600 disabled:opacity-50 text-slate-100 px-3 py-1.5 rounded-lg font-bold transition-all border border-slate-500/50 flex items-center gap-1.5"
                    title="เลือก Folder แม่ของคลังรูป GitHub ระบบจะสุ่มจาก subfolder ตามหัวข้อ เช่น Claude Code"
                  >
                    📁 เลือกคลังรูป GitHub
                  </button>
                  <span className="text-[10px] text-slate-400/70 mt-1 max-w-[240px] leading-tight truncate" title={githubStockFolder || 'ยังไม่ได้เลือก'}>
                    {githubStockFolder ? `ใช้คลัง: ${githubStockFolderName}` : 'ยังไม่ได้เลือกคลังรูป GitHub'}
                  </span>
                  {githubStockFolderLog && (
                    <span className="text-[10px] text-emerald-300/80 mt-0.5 max-w-[240px] leading-tight">
                      {githubStockFolderLog}
                    </span>
                  )}
                </div>

                <button
                  onClick={applyGithubDefaultsToSelected}
                  disabled={isApplyingGithubDefaults || isSmartConfigRunning || isBulkProcessing}
                  className="text-xs bg-sky-700/60 hover:bg-sky-600 text-sky-200 px-3 py-1.5 rounded-lg font-bold transition-all border border-sky-500/30 disabled:opacity-50"
                  title="เติมค่าสำหรับรายการ GitHub ที่เลือก: สุ่มรูปจากคลัง GitHub, สุ่มกรอบซ้ายบน, และมาร์กคำสำคัญจากพาดหัว"
                >
                  {isApplyingGithubDefaults ? '⏳ เติมค่า GitHub...' : '🧩 เติมค่า GitHub ทุกอัน'}
                </button>

                <button
                  onClick={() => {
                    setBulkItems(prev => prev.map(item => item.isSelected ? { ...item, ...buildContentFormatPatch('editorial', item, 'ปุ่มลัด') } : item));
                  }}
                  disabled={isSmartConfigRunning || isBulkProcessing}
                  className="text-xs bg-rose-700/60 hover:bg-rose-600 text-rose-100 px-3 py-1.5 rounded-lg font-bold transition-all border border-rose-500/30 disabled:opacity-50"
                  title="ตั้งรูปแบบงานที่เลือกเป็น Editorial แบบ Top Gainers"
                >
                  🧨 Top Gainers Style ทุกอัน
                </button>

                <button
                  onClick={() => {
                    setBulkItems(prev => prev.map(item => item.isSelected ? { ...item, ...buildContentFormatPatch('quote', item, 'ปุ่มลัด') } : item));
                  }}
                  disabled={isSmartConfigRunning || isBulkProcessing}
                  className="text-xs bg-zinc-700/70 hover:bg-zinc-600 text-zinc-100 px-3 py-1.5 rounded-lg font-bold transition-all border border-zinc-500/30 disabled:opacity-50"
                  title="ตั้งรูปแบบงานที่เลือกเป็น Quote Card / คำสอนคนดัง"
                >
                  “ Quote Card ทุกอัน
                </button>

                {/* Restore cache for all selected */}
                <button
                  onClick={() => {
                    setBulkItems(prev => prev.map(item => {
                      if (!item.isSelected) return item;
                      const cached = articleCache[articleKey(item.rawArticle)];
                      if (!cached?.generatedArticle) return item;
                      const patch: Partial<BulkArticleItem> = { status: 'article-done' };
                      if (cached.generatedArticle) patch.generatedArticle = cached.generatedArticle;
                      if (cached.commentPostText) patch.generatedCommentPost = cached.commentPostText;
                      if (cached.generatedCommentPost) patch.generatedCommentPost = cached.generatedCommentPost;
                      if (cached.generatedHeadlines?.length) patch.generatedHeadlines = cached.generatedHeadlines;
                      if (cached.selectedHeadline) patch.selectedHeadline = cached.selectedHeadline;
                      return { ...item, ...patch };
                    }));
                  }}
                  className="text-xs bg-teal-700/60 hover:bg-teal-600 text-teal-200 px-3 py-1.5 rounded-lg font-bold transition-all border border-teal-500/30"
                  title="นำบทความที่เคยทำไว้กลับมาใส่ทุกอันที่เลือก (เฉพาะอันที่มีประวัติ)"
                >
                  ♻️ นำกลับมาใช้ทุกอัน
                </button>

                {/* Apply YouTube img2img + decorateOriginalPhoto for all selected */}
                <button
                  onClick={() => {
                    setBulkItems(prev => prev.map(item => {
                      if (!item.isSelected) return item;
                      if (!item.images || item.images.length === 0) return item;
                      return {
                        ...item,
                        cardImagePromptStyleId: YOUTUBE_IMAGE_STYLE_ID,
                        useAttachedImage: true,
                        decorateOriginalPhoto: true,
                        selectedImageUrl: item.selectedImageUrl || item.images[0] || '',
                        smartSelectedImageIndex: Math.max(0, item.images.indexOf(item.selectedImageUrl || item.images[0] || '')),
                        smartSelectedImageReason: 'ตั้งค่าจากปุ่ม YouTube+คงรูปเดิม',
                        smartConfigNote: `ตั้งเป็นรูปจาก YouTube + คงรูปเดิม ใช้${item.selectedImageUrl ? 'รูปที่เลือกไว้' : 'รูปแรก'}เป็น img2img`,
                      };
                    }));
                  }}
                  className="text-xs bg-cyan-700/60 hover:bg-cyan-600 text-cyan-200 px-3 py-1.5 rounded-lg font-bold transition-all border border-cyan-500/30"
                  title="ตั้งสไตล์ภาพเป็น รูปจาก YouTube + คงรูปเดิมไว้ แค่ตกแต่งเพิ่ม (เฉพาะอันที่มีรูปแนบมา)"
                >
                  🎬 YouTube+คงรูปเดิม ทุกอัน
                </button>

                {/* AI markedKeywords for all selected */}
                <button
                  onClick={async () => {
                    const targets = bulkItems.filter(item => item.isSelected && item.selectedHeadline && item.decorateOriginalPhoto);
                    if (targets.length === 0) return;
                    setIsPickingKeywords(true);
                    for (let i = 0; i < targets.length; i++) {
                      const item = targets[i];
                      setSmartConfigLog(`🎯 (${i + 1}/${targets.length}) ให้ AI เลือกคำสำคัญ...`);
                      const picked = await pickKeywordsWithAI(item.selectedHeadline, item.generatedArticle || item.rawArticle, item.cardTextModel || textModel);
                      if (picked.keywords.length > 0) {
                        updateBulkItem(item.id, {
                          markedKeywords: picked.keywords,
                          smartHeadlineNote: picked.note,
                        });
                      }
                      if (i < targets.length - 1) await new Promise(r => setTimeout(r, 200));
                    }
                    setSmartConfigLog('');
                    setIsPickingKeywords(false);
                  }}
                  disabled={isPickingKeywords || isSmartConfigRunning || isBulkProcessing}
                  className="text-xs bg-amber-700/60 hover:bg-amber-600 text-amber-200 px-3 py-1.5 rounded-lg font-bold transition-all border border-amber-500/30"
                  title="ให้ AI เลือกคำ/วลีที่ควรทำสีเด่นบนภาพ ตามสไตล์ hook ที่ชอบ (เฉพาะอันที่มีพาดหัว + เปิดคงรูปเดิม)"
                >
                  {isPickingKeywords ? '⏳ AI เลือกคำ...' : '🎯 AI เลือกคำสำคัญ ทุกอัน'}
                </button>
              </div>
            )}

            {/* Bulk Article Cards */}
            <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1 custom-scrollbar">
              {bulkItems.map((item, idx) => {
                const statusColor = item.status === 'idle' ? 'border-gray-700/50' :
                  item.status === 'generating-article' || item.status === 'generating-image' ? 'border-blue-500/50 shadow-blue-500/10 shadow-lg' :
                  item.status === 'article-done' ? 'border-amber-500/40' :
                  item.status === 'queued' ? 'border-purple-500/40' :
                  item.status === 'error' ? 'border-red-500/40' : 'border-gray-700/50';
                const statusLabel = item.status === 'idle' ? '' :
                  item.status === 'generating-article' ? '⏳ กำลังเขียน...' :
                  item.status === 'article-done' ? '✅ บทความพร้อม' :
                  item.status === 'generating-image' ? '⏳ กำลังส่งคิวสร้างภาพ...' :
                  item.status === 'queued' ? '🚀 อยู่ในคิวแล้ว' :
                  item.status === 'error' ? '❌ ผิดพลาด' : '';
                const isNewsItem = isNewsBulkItem(item);
                const isFetchingNewsImages = newsImageLoadingIds.has(item.id);

                return (
                  <div key={item.id} className={`bg-black/30 rounded-xl border ${statusColor} p-4 transition-all`}>
                    <div className="flex items-start gap-3">
                      <label className="mt-1 cursor-pointer flex-shrink-0">
                        <input type="checkbox" checked={item.isSelected} onChange={() => toggleSelectBulk(item.id)} className="w-5 h-5 text-cyan-500 bg-gray-700 border-gray-600 rounded cursor-pointer" />
                      </label>

                      <div className="flex-1 min-w-0 space-y-3">
                        {/* Header */}
                        {(() => {
                          const cached = articleCache[articleKey(item.rawArticle)];
                          const hasCachedPost = !!(cached?.generatedArticle);
                          const hasCachedHeadline = !!(cached?.selectedHeadline);
                          const hasCachedImage = !!(cached?.imageUrl || cached?.localImageUrl);
                          return (
                          <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-300">#{idx + 1}</span>
                            {item.title && <span className="text-xs text-gray-500 truncate max-w-[200px]">{item.title}</span>}
                            {isNewsItem && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-red-600/25 text-red-300 border border-red-500/40">
                                📰 ข่าว
                              </span>
                            )}
                            {statusLabel && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                item.status === 'error' ? 'bg-red-600/30 text-red-400' :
                                item.status === 'queued' ? 'bg-purple-600/30 text-purple-400' :
                                item.status === 'generating-article' || item.status === 'generating-image' ? 'bg-blue-600/30 text-blue-400 animate-pulse' :
                                'bg-amber-600/30 text-amber-400'
                              }`}>{statusLabel}</span>
                            )}
                            {item.imageQueuedCount > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-600/30 text-purple-300">
                                กดสร้างแล้ว {item.imageQueuedCount} ครั้ง
                              </span>
                            )}
                            {/* Cache badge */}
                            {cached && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-800/60 text-teal-300 border border-teal-600/40 flex items-center gap-1" title="เคยทำบทความนี้แล้ว">
                                🔖 เคยทำแล้ว
                                {hasCachedPost && <span className="text-[9px] opacity-70">📝</span>}
                                {hasCachedHeadline && <span className="text-[9px] opacity-70">📌</span>}
                                {hasCachedImage && <span className="text-[9px] opacity-70">🖼️</span>}
                              </span>
                            )}
                            <button onClick={() => removeBulkItem(item.id)} className="text-red-400/40 hover:text-red-400 text-xs transition-all ml-auto">✖</button>
                          </div>

                          {/* Cache restore panel */}
                          {cached && (
                            <div className="bg-teal-950/40 border border-teal-700/30 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-teal-400">🔖 บันทึกจากครั้งก่อน</span>
                                <span className="text-[9px] text-gray-500">{cached.lastUpdatedAt ? new Date(cached.lastUpdatedAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                              </div>
                              {cached.selectedHeadline && (
                                <div className="flex items-start gap-2">
                                  <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">📌 พาดหัว:</span>
                                  <span className="text-[11px] text-amber-300 font-semibold leading-tight">{cached.selectedHeadline}</span>
                                </div>
                              )}
                              {cached.generatedArticle && (
                                <div>
                                  <span className="text-[10px] text-gray-400">📝 โพส: </span>
                                  <span className="text-[10px] text-gray-300">{cached.generatedArticle.slice(0, 120)}...</span>
                                </div>
                              )}
                              {cached.commentPostText && (
                                <div>
                                  <span className="text-[10px] text-gray-400">💬 ใต้เม้น: </span>
                                  <span className="text-[10px] text-gray-300">{cached.commentPostText.slice(0, 80)}...</span>
                                </div>
                              )}
                              {(cached.localImageUrl || cached.imageUrl) && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-400">🖼️ รูป:</span>
                                  <img src={cached.localImageUrl || cached.imageUrl} alt="" className="h-8 w-8 rounded object-cover border border-gray-600" />
                                  <span className="text-[9px] text-emerald-400">{cached.localImageUrl ? 'local' : 'URL'}</span>
                                </div>
                              )}
                              <button
                                onClick={() => {
                                  const patch: Partial<BulkArticleItem> = { status: 'article-done' };
                                  if (cached.generatedArticle) patch.generatedArticle = cached.generatedArticle;
                                  if (cached.commentPostText) patch.generatedCommentPost = cached.commentPostText;
                                  if (cached.generatedHeadlines?.length) patch.generatedHeadlines = cached.generatedHeadlines;
                                  if (cached.selectedHeadline) patch.selectedHeadline = cached.selectedHeadline;
                                  updateBulkItem(item.id, patch);
                                }}
                                className="text-[10px] bg-teal-700 hover:bg-teal-600 text-white px-3 py-1 rounded font-bold transition-colors"
                              >
                                ♻️ นำกลับมาใช้
                              </button>
                            </div>
                          )}
                          </>
                          );
                        })()}

                        {false && (
                        /* Per-card settings - moved to the main controls above */
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-gray-900/50 rounded-lg border border-gray-700/40">
                          <div>
                            <label className="text-[9px] text-gray-500 block mb-0.5">รูปแบบงาน</label>
                            <select
                              className="input-field text-xs py-1 w-full"
                              value={item.contentFormat}
                              onChange={e => {
                                const format = e.target.value as BulkArticleItem['contentFormat'];
                                updateBulkItem(item.id, buildContentFormatPatch(format, item, 'ผู้ใช้เลือก'));
                              }}
                              disabled={item.status === 'queued'}
                            >
                              {CONTENT_FORMAT_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                            </select>
                            <p className="mt-0.5 text-[9px] text-gray-500 leading-tight">
                              {CONTENT_FORMAT_OPTIONS.find(opt => opt.id === item.contentFormat)?.hint}
                            </p>
                          </div>
                          <div>
                            <label className="text-[9px] text-gray-500 block mb-0.5">ภาพต้นทาง</label>
                            <select
                              className="input-field text-xs py-1 w-full"
                              value={item.imageSourceMode}
                              onChange={e => updateBulkItem(item.id, buildImageSourcePatch(e.target.value as BulkArticleItem['imageSourceMode'], item))}
                              disabled={item.status === 'queued'}
                            >
                              {IMAGE_SOURCE_MODE_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                            </select>
                            <p className="mt-0.5 text-[9px] text-gray-500 leading-tight">
                              {IMAGE_SOURCE_MODE_OPTIONS.find(opt => opt.id === item.imageSourceMode)?.hint}
                            </p>
                          </div>
                          <div>
                            <label className="text-[9px] text-gray-500 block mb-0.5">สไตล์เขียนโพสที่แนบรูป</label>
                            <select className="input-field text-xs py-1 w-full" value={item.writingStyleId} onChange={e => updateBulkItem(item.id, { writingStyleId: e.target.value })} disabled={item.status === 'queued'}>
                              <option value="">-- เลือก --</option>
                              {attachedPostStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-gray-500 block mb-0.5">สไตล์เขียนมีใต้คอมเม้น</label>
                            <select className="input-field text-xs py-1 w-full" value={item.commentStyleId} onChange={e => updateBulkItem(item.id, { commentStyleId: e.target.value })} disabled={item.status === 'queued'}>
                              <option value="">-- เลือก --</option>
                              {commentPostStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-gray-500 block mb-0.5">สไตล์พาดหัว</label>
                            <select className="input-field text-xs py-1 w-full" value={item.headlinePackId} onChange={e => updateBulkItem(item.id, { headlinePackId: e.target.value })} disabled={item.status === 'queued'}>
                              <option value="">-- เลือก --</option>
                              {headlinePacks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-gray-500 block mb-0.5">โมเดล AI</label>
                            <select className="input-field text-xs py-1 w-full" value={item.cardTextModel} onChange={e => updateBulkItem(item.id, { cardTextModel: e.target.value })} disabled={item.status === 'queued'}>
                              <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                              <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
                              <option value="openai/gpt-4o">GPT-4o</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-gray-500 block mb-0.5">ความยาวบทความ</label>
                            <select className="input-field text-xs py-1 w-full" value={item.articleLength} onChange={e => updateBulkItem(item.id, { articleLength: e.target.value })} disabled={item.status === 'queued'}>
                              {ARTICLE_LENGTH_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label} ({opt.range})</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-gray-500 block mb-0.5">สัดส่วนรูป</label>
                            <select className="input-field text-xs py-1 w-full" value={item.cardImageRatio} onChange={e => updateBulkItem(item.id, { cardImageRatio: e.target.value })} disabled={item.status === 'queued'}>
                              <option value="1:1">1:1 (Square)</option>
                              <option value="16:9">16:9 (Landscape)</option>
                              <option value="9:16">9:16 (Portrait)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-gray-500 block mb-0.5">สไตล์ภาพ (Prompt)</label>
                            <select
                              className="input-field text-xs py-1 w-full"
                              value={item.cardImagePromptStyleId}
                              onChange={e => {
                                const styleId = e.target.value;
                                updateBulkItem(item.id, {
                                  cardImagePromptStyleId: styleId,
                                  contentFormat: styleId === EDITORIAL_IMAGE_STYLE_ID ? 'editorial' : styleId === QUOTE_IMAGE_STYLE_ID ? 'quote' : item.contentFormat,
                                });
                              }}
                              disabled={item.status === 'queued'}
                            >
                              <option value="">-- เลือกสไตล์ภาพ --</option>
                              <option value={EDITORIAL_IMAGE_STYLE_ID}>Editorial แบบ Top Gainers</option>
                              <option value={QUOTE_IMAGE_STYLE_ID}>Quote / คำสอนคนดัง</option>
                              <option value={YOUTUBE_IMAGE_STYLE_ID}>รูปจากyoutube</option>
                              <option value={AI_NEWS_IMAGE_STYLE_ID}>ข่าวAI</option>
<option value={GITHUB_IMAGE_STYLE_ID}>Github (สุ่มรูปจากคลัง)</option>
                              {imagePromptStyles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </div>
                          {item.images && item.images.length > 0 && (
                            <div className="flex flex-col justify-end">
                              <label className="text-[9px] text-gray-500 block mb-0.5">ใช้รูปที่แนบมา (img2img)</label>
                              <button
                                onClick={() => updateBulkItem(item.id, { useAttachedImage: !item.useAttachedImage })}
                                disabled={item.status === 'queued'}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${item.useAttachedImage ? 'bg-cyan-600' : 'bg-gray-600'}`}
                              >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${item.useAttachedImage ? 'translate-x-4' : 'translate-x-0.5'}`} />
                              </button>
                            </div>
                          )}
                        </div>
                        )}

                        <div className="rounded-lg border border-slate-700/60 bg-slate-950/45 p-2.5 space-y-1.5">
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] font-bold text-cyan-300 shrink-0">Note</span>
                            <p className="text-[10px] leading-relaxed text-slate-300">{getCardConfigNote(item)}</p>
                          </div>
                          {item.smartConfigNote && (
                            <div className="flex items-start gap-2 border-t border-slate-700/50 pt-1.5">
                              <span className="text-[10px] font-bold text-violet-300 shrink-0">Smart</span>
                              <p className="text-[10px] leading-relaxed text-violet-100">{item.smartConfigNote}</p>
                            </div>
                          )}
                          {item.smartHeadlineNote && (
                            <div className="flex items-start gap-2 border-t border-slate-700/50 pt-1.5">
                              <span className="text-[10px] font-bold text-amber-300 shrink-0">พาดหัว</span>
                              <p className="text-[10px] leading-relaxed text-amber-100">{item.smartHeadlineNote}</p>
                            </div>
                          )}
                          {item.smartImageScores && item.smartImageScores.length > 0 && (
                            <div className="flex flex-wrap gap-1 border-t border-slate-700/50 pt-1.5">
                              {item.smartImageScores.map(score => (
                                <span
                                  key={score.index}
                                  className={`text-[9px] px-1.5 py-0.5 rounded border ${
                                    score.hasPerson
                                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                                      : 'bg-gray-700/40 text-gray-400 border-gray-600/40'
                                  }`}
                                  title={score.note}
                                >
                                  #{score.index + 1}: {score.score}/10 {score.hasPerson ? 'มีคน' : 'ไม่มีคนชัด'}{score.note ? ` - ${score.note}` : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {isNewsItem && (
                          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-500/25 bg-red-950/20 p-2.5">
                            <span className="text-[10px] font-bold text-red-300">
                              ข่าวจากเว็บ{item.domain ? `: ${item.domain}` : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => fetchNewsImages(item.id)}
                              disabled={isFetchingNewsImages || item.status === 'queued' || !item.sourceUrl}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-black text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isFetchingNewsImages ? 'กำลังดูดรูป...' : 'ดูดรูปข่าวจากwebsite'}
                            </button>
                            <span className="text-[10px] text-slate-400">
                              {item.images?.length ? `มีรูปให้เลือก ${item.images.length} รูป` : 'ยังไม่มีรูปข่าว กดปุ่มเพื่อดึงจากหน้าเว็บ'}
                            </span>
                          </div>
                        )}

                        {/* Image picker */}
                        {item.useAttachedImage && item.images && item.images.length > 0 && (
                          <div>
                            <label className="text-[9px] text-gray-500 block mb-1">เลือกรูปสำหรับ Image-to-Image (คลิกเพื่อเลือก):</label>
                            <div className="flex gap-1.5 flex-wrap">
                              {item.images.map((img, ii) => {
                                const score = item.smartImageScores?.find(s => s.index === ii);
                                const isSelected = item.selectedImageUrl === img;
                                const isSmartPick = item.smartSelectedImageIndex === ii;
                                return (
                                  <button
                                    key={ii}
                                    onClick={() => updateBulkItem(item.id, {
                                      selectedImageUrl: isSelected ? '' : img,
                                      smartSelectedImageIndex: isSelected ? undefined : ii,
                                      smartSelectedImageReason: isSelected ? '' : 'ผู้ใช้เลือกเอง',
                                      smartConfigNote: isSelected ? item.smartConfigNote : `เลือกรูป #${ii + 1} เองสำหรับ img2img`,
                                    })}
                                    title={score?.note || `รูป #${ii + 1}`}
                                    className={`relative w-24 h-16 rounded border-2 overflow-hidden transition-all bg-black ${
                                      isSelected
                                        ? 'border-cyan-400 shadow-lg shadow-cyan-500/20'
                                        : isSmartPick
                                        ? 'border-violet-400 hover:border-violet-300'
                                        : 'border-gray-600 hover:border-gray-400'
                                    }`}
                                  >
                                    <img src={getDisplayImageUrl(img)} alt={`img ${ii + 1}`} className="w-full h-full object-cover" />
                                    <span className="absolute left-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                      #{ii + 1}
                                    </span>
                                    {score && (
                                      <span className={`absolute right-1 top-1 rounded px-1 py-0.5 text-[8px] font-bold ${score.hasPerson ? 'bg-emerald-500/90 text-black' : 'bg-gray-800/90 text-gray-200'}`}>
                                        {score.score}/10
                                      </span>
                                    )}
                                    {isSmartPick && (
                                      <span className="absolute left-1 bottom-1 rounded bg-violet-600/90 px-1 py-0.5 text-[8px] font-bold text-white">
                                        AI เลือก
                                      </span>
                                    )}
                                    {isSelected && (
                                      <div className="absolute inset-0 bg-cyan-500/20 flex items-center justify-center">
                                        <span className="rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-black text-white">เลือกอยู่</span>
                                      </div>
                                    )}
                                    <a
                                      href={getDisplayImageUrl(img)}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="absolute right-1 bottom-1 rounded bg-black/75 px-1.5 py-0.5 text-[8px] font-bold text-white opacity-80 hover:opacity-100"
                                      title="เปิดดูรูป"
                                    >
                                      ดู
                                    </a>
                                  </button>
                                );
                              })}
                            </div>
                            {item.selectedImageUrl && (
                              <p className="mt-1 text-[10px] text-cyan-300">
                                ใช้{getSelectedImageIndex(item) !== undefined ? `รูป #${getSelectedImageIndex(item)! + 1}` : 'รูปที่เลือก'}: {item.smartSelectedImageReason || 'เลือกรูปนี้สำหรับ Image-to-Image'}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Raw article */}
                        <textarea className="input-field w-full h-20 text-sm resize-y" placeholder="วางบทความดิบที่นี่..." value={item.rawArticle} onChange={e => updateBulkItem(item.id, { rawArticle: e.target.value })} disabled={item.status === 'queued'} />
                        <input type="url" className="input-field w-full text-xs" placeholder="🌐 Website ที่มา (ไม่บังคับ)" value={item.sourceUrl} onChange={e => updateBulkItem(item.id, { sourceUrl: e.target.value })} />

                        {/* Tags */}
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.tags.map((tag, ti) => <span key={ti} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium border border-blue-500/20">#{tag}</span>)}
                          </div>
                        )}

                        {isOverlayImageStyle(item.cardImagePromptStyleId) && (
                          <div className="space-y-2 rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3">
                            <label className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.decorateOriginalPhoto}
                                onChange={e => updateBulkItem(item.id, { decorateOriginalPhoto: e.target.checked })}
                                className="mt-0.5 h-4 w-4 accent-amber-500"
                                disabled={item.status === 'queued'}
                              />
                              <span className="text-xs text-amber-100 leading-snug">
                                คงรูปเดิมไว้ แค่ตกแต่งเพิ่ม
                                <span className="block text-[10px] text-amber-300/80">
                                  {item.cardImagePromptStyleId === AI_NEWS_IMAGE_STYLE_ID
                                    ? 'เหมาะกับรูปข่าวจริง: รักษาเหตุการณ์/วัตถุ/ภาพเดิม แล้วเพิ่มพาดหัวและป้าย ข่าวAI ทับลงไป'
                                    : 'เหมาะกับรูปที่อยากให้ดูจริง: รักษาหน้า เสื้อ ฉาก และแสงเดิม แล้วเพิ่มตัวหนังสือ/กราฟิก/การ์ดช่องทับลงไป'}
                                </span>
                              </span>
                            </label>
                            {item.cardImagePromptStyleId === AI_NEWS_IMAGE_STYLE_ID ? (
                              <div className="space-y-2">
                                <label className="text-[9px] text-gray-500 block">Canvas ป้ายข่าว AI ซ้ายบน</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {AI_NEWS_BADGE_STYLES.map(style => (
                                    <button
                                      key={style.id}
                                      type="button"
                                      onClick={() => updateBulkItem(item.id, { aiNewsBadgeStyleId: style.id })}
                                      className={`rounded-lg border p-2 text-left transition-all ${item.aiNewsBadgeStyleId === style.id ? 'border-red-400 bg-red-500/10' : 'border-gray-700 bg-black/20 hover:border-gray-500'}`}
                                    >
                                      <div className="relative h-12 overflow-hidden rounded bg-gradient-to-br from-slate-800 to-slate-950">
                                        <div
                                          className="absolute left-0 top-0 flex h-7 items-center pr-4 pl-2 text-[11px] font-black shadow-lg"
                                          style={{ backgroundColor: style.bg, color: style.fg, clipPath: 'polygon(0 0, 86% 0, 100% 50%, 86% 100%, 0 100%)' }}
                                        >
                                          ข่าวAI
                                        </div>
                                        <div className="absolute bottom-2 left-2 h-2 w-16 rounded" style={{ backgroundColor: style.accent }} />
                                      </div>
                                      <div className="mt-1 text-[10px] font-bold text-gray-200">{style.name}</div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : item.cardImagePromptStyleId === GITHUB_IMAGE_STYLE_ID ? (
                              <div className="space-y-2">
                                <label className="text-[9px] text-gray-500 block">กรอบพาดหัวซ้ายบน GitHub</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
                                  {GITHUB_BADGE_STYLES.map(style => (
                                    <button
                                      key={style.id}
                                      type="button"
                                      onClick={() => updateBulkItem(item.id, { aiNewsBadgeStyleId: style.id })}
                                      className={`rounded-lg border p-2 text-left transition-all ${item.aiNewsBadgeStyleId === style.id ? 'border-cyan-400 bg-cyan-500/10' : 'border-gray-700 bg-black/20 hover:border-gray-500'}`}
                                    >
                                      <div className="relative h-14 overflow-hidden rounded bg-gradient-to-br from-slate-900 to-black">
                                        <div
                                          className="absolute left-0 top-1 flex h-9 items-center gap-1.5 pr-5 pl-2 shadow-lg"
                                          style={{ backgroundColor: style.bg, color: style.fg, clipPath: 'polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%)' }}
                                        >
                                          <span className="grid h-5 w-5 place-items-center rounded text-[8px] font-black" style={{ backgroundColor: style.accent, color: style.bg }}>
                                            {'</>'}
                                          </span>
                                          <span className="min-w-0">
                                            <span className="block truncate text-[10px] font-black leading-tight">{style.label}</span>
                                            <span className="block truncate text-[8px] font-bold leading-tight" style={{ color: style.accent }}>{style.subLabel}</span>
                                          </span>
                                        </div>
                                        <div className="absolute bottom-1 left-2 h-1.5 w-20 rounded" style={{ backgroundColor: style.accent }} />
                                      </div>
                                      <div className="mt-1 text-[10px] font-bold text-gray-200">{style.name}</div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : item.cardImagePromptStyleId === EDITORIAL_IMAGE_STYLE_ID || item.cardImagePromptStyleId === QUOTE_IMAGE_STYLE_ID ? (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <div className="rounded-lg border border-gray-700 bg-black/20 p-2">
                                  <div className="text-[10px] font-bold text-amber-200">
                                    {item.cardImagePromptStyleId === QUOTE_IMAGE_STYLE_ID ? 'Quote Card' : 'Editorial Card'}
                                  </div>
                                  <p className="mt-1 text-[10px] leading-snug text-gray-400">
                                    {item.cardImagePromptStyleId === QUOTE_IMAGE_STYLE_ID
                                      ? 'ใช้กับคำสอนคนดัง ข้อคิด หรือบทเรียน มี strap ด้านบนและ quote mood'
                                      : 'ใช้กับข่าว คลิป YouTube หรือ Content จากคลัง ให้ฟีลพาดหัวแรงแบบ Top Gainers'}
                                  </p>
                                </div>
                                <div className="rounded-lg border border-gray-700 bg-black/20 p-2">
                                  <div className="text-[10px] font-bold text-cyan-200">ภาพต้นทาง</div>
                                  <p className="mt-1 text-[10px] leading-snug text-gray-400">
                                    {item.selectedImageUrl ? 'พร้อมแปะบนรูปที่เลือก' : 'ยังไม่มีรูป เลือก AI สร้างใหม่หรือดึงรูปจาก Content ก่อน'}
                                  </p>
                                </div>
                                <div className="rounded-lg border border-gray-700 bg-black/20 p-2">
                                  <div className="text-[10px] font-bold text-rose-200">ชุดสี</div>
                                  <p className="mt-1 text-[10px] leading-snug text-gray-400">
                                    เลือก palette ด้านล่างได้ โดยมีชุด TopGainers เพิ่มไว้ให้แล้ว
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <>
                            <div className="flex flex-wrap gap-1.5 text-[9px]">
                              <span className={`px-1.5 py-0.5 rounded border ${item.channelName ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' : 'bg-amber-500/15 text-amber-300 border-amber-500/20'}`}>
                                ช่อง: {item.channelName || 'ไม่ใส่ในรูป'}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded border ${item.channelLogoUrl ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' : 'bg-amber-500/15 text-amber-300 border-amber-500/20'}`}>
                                โลโก้ช่อง: {item.channelLogoUrl ? 'มีแล้ว' : 'ไม่มี - จะใช้รูปคนแทน'}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded border ${typeof item.subscriberCount === 'number' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' : 'bg-amber-500/15 text-amber-300 border-amber-500/20'}`}>
                                ผู้ติดตาม: {formatSubscriberCount(item.subscriberCount) || 'ไม่ใส่ในรูป'}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded border ${item.ytExtracted ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' : 'bg-red-500/15 text-red-300 border-red-500/20'}`}>
                                YouTube extract: {item.ytExtracted ? 'พร้อม' : 'ยังไม่พร้อม'}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <input
                                type="text"
                                className="input-field text-xs py-1"
                                placeholder="กรอกชื่อช่องเอง (ไม่บังคับ)"
                                value={item.channelName || ''}
                                onChange={e => updateBulkItem(item.id, { channelName: e.target.value })}
                              />
                              <input
                                type="url"
                                className="input-field text-xs py-1"
                                placeholder="URL โลโก้ช่อง (ไม่บังคับ)"
                                value={item.channelLogoUrl || ''}
                                onChange={e => updateBulkItem(item.id, { channelLogoUrl: e.target.value })}
                              />
                              <input
                                type="number"
                                min="0"
                                className="input-field text-xs py-1"
                                placeholder="จำนวนผู้ติดตาม (ไม่บังคับ)"
                                value={typeof item.subscriberCount === 'number' ? item.subscriberCount : ''}
                                onChange={e => updateBulkItem(item.id, { subscriberCount: e.target.value === '' ? undefined : Number(e.target.value) })}
                              />
                            </div>
                              </>
                            )}
                            {item.decorateOriginalPhoto && (
                              <div className="space-y-2">
                                <div>
                                  <label className="text-[9px] text-gray-500 block mb-1">ชุดสี Font</label>
                                <select
                                  className="input-field text-xs py-1 w-full"
                                  value={item.fontPaletteId}
                                  onChange={e => updateBulkItem(item.id, { fontPaletteId: e.target.value })}
                                  disabled={item.status === 'queued'}
                                >
                                  {YOUTUBE_FONT_PALETTES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <div className="flex gap-1 mt-1">
                                  {(YOUTUBE_FONT_PALETTES.find(p => p.id === item.fontPaletteId) ? [
                                    YOUTUBE_FONT_PALETTES.find(p => p.id === item.fontPaletteId)!.primary,
                                    YOUTUBE_FONT_PALETTES.find(p => p.id === item.fontPaletteId)!.accent,
                                    YOUTUBE_FONT_PALETTES.find(p => p.id === item.fontPaletteId)!.block,
                                    YOUTUBE_FONT_PALETTES.find(p => p.id === item.fontPaletteId)!.altBlock,
                                  ] : []).map(color => <span key={color} className="h-4 w-8 rounded border border-white/20" style={{ backgroundColor: color }} />)}
                                </div>
                                </div>
                                {item.selectedHeadline && (
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="text-[9px] text-gray-500">มาร์กคำสำคัญในพาดหัว</label>
                                      {item.markedKeywords.length > 0 && (
                                        <button
                                          onClick={() => updateBulkItem(item.id, { markedKeywords: [] })}
                                          className="text-[9px] text-gray-400 hover:text-white"
                                        >
                                          ล้าง
                                        </button>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {Array.from(new Set([...item.markedKeywords, ...getHeadlineKeywordCandidates(item.selectedHeadline)])).map(keyword => {
                                        const checked = item.markedKeywords.includes(keyword);
                                        return (
                                          <button
                                            key={keyword}
                                            type="button"
                                            onClick={() => toggleMarkedKeyword(item.id, keyword)}
                                            className={`text-[10px] px-2 py-1 rounded border transition-all ${checked ? 'bg-amber-500 text-black border-amber-300 font-bold' : 'bg-black/30 text-gray-300 border-gray-600 hover:border-amber-400'}`}
                                          >
                                            {checked ? '✓ ' : ''}{keyword}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Images strip (when not used as reference) */}
                        {item.images && item.images.length > 0 && !item.useAttachedImage && (
                          <div className="flex gap-1 flex-wrap">
                            {item.images.slice(0, 5).map((img, ii) => <img key={ii} src={getDisplayImageUrl(img)} alt="" className="h-8 w-12 object-cover rounded border border-gray-700/50" />)}
                            {item.images.length > 5 && <span className="text-[10px] text-gray-500 self-center">+{item.images.length - 5}</span>}
                          </div>
                        )}

                        {/* Error */}
                        {item.status === 'error' && item.errorMsg && (
                          <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-500/20">{item.errorMsg}</div>
                        )}
                        {item.imageErrorMsg && (
                          <div className="text-xs text-amber-300 bg-amber-900/20 p-2 rounded border border-amber-500/20 flex flex-col gap-2">
                            <span>รูปภาพมีปัญหา: {item.imageErrorMsg}</span>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => handleCardCreateImage(item.id)}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-[10px] font-bold"
                              >
                                🎨 สร้างรูปใหม่
                              </button>
                              <button
                                onClick={() => updateBulkItem(item.id, { imageErrorMsg: '' })}
                                className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded text-[10px]"
                              >
                                ซ่อนแจ้งเตือน
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Generated article */}
                        {item.generatedArticle && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] text-amber-400 font-bold">📝 บทความที่ AI เขียน ({item.generatedArticle.length} ตัวอักษร)</label>
                              <div className="flex gap-2">
                                <button onClick={() => updateBulkItem(item.id, { showArticleFeedback: !item.showArticleFeedback })} disabled={item.status !== 'article-done'} className="text-[10px] text-cyan-400 hover:text-cyan-300 disabled:opacity-40 transition-all">💬 ติชม/แก้ไข</button>
                                <button onClick={() => handleCardRegenerateArticle(item.id)} disabled={item.status !== 'article-done'} className="text-[10px] text-amber-500 hover:text-amber-400 disabled:opacity-40 transition-all flex items-center gap-0.5">🔄 โพสยาวใหม่</button>
                              </div>
                            </div>
                            <textarea className="input-field w-full h-24 text-xs resize-y" value={item.generatedArticle} onChange={e => updateBulkItem(item.id, { generatedArticle: e.target.value })} disabled={item.status === 'queued'} />
                            {item.sourceUrl && <p className="text-[10px] text-gray-500">ระบบจะใส่เครดิตท้ายบทความ: ที่มา: {item.sourceUrl}</p>}
                            {item.generatedCommentPost && (
                              <div className="space-y-1.5 pt-1">
                                <label className="text-[10px] text-cyan-300 font-bold">💬 แคปชั่นสั้น + ใต้คอมเม้น ({item.generatedCommentPost.length} ตัวอักษร)</label>
                                <button onClick={() => handleCardRegenerateCommentPost(item.id)} disabled={item.status !== 'article-done'} className="text-[10px] text-cyan-400 hover:text-cyan-300 disabled:opacity-40 transition-all">🔄 คลิกเบท+ใต้เม้นใหม่</button>
                                <textarea className="input-field w-full h-24 text-xs resize-y" value={item.generatedCommentPost} onChange={e => updateBulkItem(item.id, { generatedCommentPost: e.target.value })} disabled={item.status === 'queued'} />
                              </div>
                            )}
                            {item.showArticleFeedback && (
                              <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-2 space-y-2">
                                <textarea
                                  className="input-field w-full h-16 text-xs resize-none"
                                  placeholder="ติชมว่าควรปรับอะไร เช่น สั้นลง ตรงขึ้น เพิ่มอารมณ์ขาย ลดศัพท์ยาก..."
                                  value={item.articleFeedback}
                                  onChange={e => updateBulkItem(item.id, { articleFeedback: e.target.value })}
                                />
                                <button
                                  onClick={() => handleCardRewriteArticleWithFeedback(item.id)}
                                  disabled={!item.articleFeedback.trim() || item.status !== 'article-done'}
                                  className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded text-xs font-bold disabled:opacity-40"
                                >
                                  ปรับบทความ + จำคำติชมไว้ใช้ครั้งต่อไป
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Headlines */}
                        {item.generatedHeadlines.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] text-amber-300 font-bold">🔥 เลือกพาดหัว (คลิกเลือก 1 อัน)</label>
                              <button onClick={() => handleCardRegenerateHeadlines(item.id)} disabled={item.status !== 'article-done'} className="text-[10px] text-blue-400 hover:text-blue-300 disabled:opacity-40 transition-all">🔄 สร้างใหม่</button>
                            </div>
                            <div className="space-y-1">
                              {item.generatedHeadlines.map((h, i) => (
                                <div key={i} className={`flex flex-col gap-1 p-2 rounded transition-colors border ${item.selectedHeadline === h ? 'bg-amber-900/30 border-amber-500/50' : 'bg-black/20 border-gray-700/50 hover:border-gray-500'}`}>
                                  <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`headline_${item.id}`}
                                      checked={item.selectedHeadline === h}
                                      onChange={() => {
                                        const markedKeywords = pickImpactfulKeywords(h, 2);
                                        const smartHeadlineNote = isThaiReadableHeadline(h)
                                          ? buildThaiHeadlineSelectionNote(h, markedKeywords, 1)
                                          : 'พาดหัวนี้เป็นอังกฤษล้วน/ไทยน้อยเกินไป ไม่ควรใช้กับเพจไทย กดสร้างใหม่หรือเลือกพาดหัวที่มีภาษาไทย';
                                        updateBulkItem(item.id, { selectedHeadline: h, markedKeywords, smartHeadlineNote });
                                        saveArticleCache(item.rawArticle, { selectedHeadline: h });
                                      }}
                                      className="mt-0.5 flex-shrink-0 accent-amber-500"
                                    />
                                    {item.selectedHeadline !== h && (
                                      <span className="min-w-0 text-xs text-gray-200 whitespace-pre-line break-words leading-relaxed">{h}</span>
                                    )}
                                  </label>
                                  {item.selectedHeadline === h && (
                                    <textarea
                                      className="w-full text-xs bg-black/40 text-amber-100 p-2 rounded border border-amber-500/30 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 min-h-[60px] ml-6 resize-none break-words"
                                      style={{ width: 'calc(100% - 1.5rem)' }}
                                      value={h}
                                      onChange={(e) => {
                                        const newText = e.target.value;
                                        const newHeadlines = [...item.generatedHeadlines];
                                        newHeadlines[i] = newText;
                                        const markedKeywords = pickImpactfulKeywords(newText, 2);
                                        updateBulkItem(item.id, { 
                                          generatedHeadlines: newHeadlines, 
                                          selectedHeadline: newText,
                                          markedKeywords 
                                        });
                                      }}
                                      placeholder="พิมพ์แก้ไขพาดหัวตรงนี้ได้เลย..."
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {item.finalPromptJson && !(isOverlayImageStyle(item.cardImagePromptStyleId) && item.decorateOriginalPhoto) && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] text-purple-300 font-bold">Prompt JSON สำหรับ Kie.ai</label>
                              <button
                                onClick={() => navigator.clipboard?.writeText(item.finalPromptJson)}
                                className="text-[10px] text-purple-400 hover:text-purple-300 transition-all"
                              >
                                📋 คัดลอก
                              </button>
                            </div>
                            <textarea
                              className="input-field w-full h-28 text-[10px] font-mono resize-y"
                              value={item.finalPromptJson}
                              onChange={e => updateBulkItem(item.id, { finalPromptJson: e.target.value })}
                              disabled={item.status === 'queued'}
                            />
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 pt-1 border-t border-gray-700/30">
                          {(item.status === 'idle' || item.status === 'error') && (
                            <button onClick={() => handleCardGenerateArticleAndHeadlines(item.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-bold text-xs transition-all shadow-lg shadow-emerald-500/10">
                              ✨ สร้างบทความ/พาดหัว
                            </button>
                          )}
                          {item.status === 'generating-article' && (
                            <div className="flex-1 bg-blue-900/30 text-blue-400 py-2 rounded-lg text-xs text-center animate-pulse border border-blue-500/30">⏳ กำลังสร้าง...</div>
                          )}
                          {item.status === 'article-done' && (
                            <>
                              <button onClick={() => handleCardGenerateArticleAndHeadlines(item.id)} className="bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 px-3 rounded-lg text-xs font-medium transition-all">🔄 สร้างใหม่</button>
                              <button
                                onClick={() => handleCardCreateImage(item.id)}
                                disabled={!item.selectedHeadline || !item.cardImagePromptStyleId}
                                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white py-2 rounded-lg font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-500/10"
                                title={!item.selectedHeadline ? 'เลือกพาดหัวก่อน' : !item.cardImagePromptStyleId ? 'เลือกสไตล์ภาพก่อน' : item.cardImagePromptStyleId === YOUTUBE_IMAGE_STYLE_ID ? 'ต้องมีสถานะ YouTube extract และรูปคนที่เลือกไว้ ส่วนชื่อช่อง/โลโก้/ผู้ติดตามไม่บังคับ' : item.cardImagePromptStyleId === AI_NEWS_IMAGE_STYLE_ID ? 'ต้องมีรูปข่าวที่เลือกไว้สำหรับ Image-to-Image' : ''}
                              >
                                {isOverlayImageStyle(item.cardImagePromptStyleId) && item.decorateOriginalPhoto
                                  ? item.imageQueuedCount > 0 ? '🖼️ แปะ Canvas ใหม่อีกครั้ง' : '🖼️ แปะ Canvas สร้างภาพ'
                                  : item.imageQueuedCount > 0 ? '🎨 สร้างภาพใหม่อีกครั้ง' : '🎨 สร้างภาพ'}
                              </button>
                            </>
                          )}
                          {item.status === 'generating-image' && (
                            <div className="flex-1 bg-purple-900/30 text-purple-400 py-2 rounded-lg text-xs text-center animate-pulse border border-purple-500/30">⏳ กำลังส่งคิวสร้างภาพ...</div>
                          )}
                          {item.status === 'queued' && (
                            <>
                              <div className="flex-1 text-[10px] text-purple-400 bg-purple-900/20 px-2 py-2 rounded border border-purple-500/20 text-center">🚀 ส่งเข้าคิวเรียบร้อย — ดูสถานะที่ระบบ Log กลาง</div>
                              <button
                                onClick={() => updateBulkItem(item.id, { status: 'article-done' })}
                                className="bg-purple-700 hover:bg-purple-600 text-white py-2 px-3 rounded-lg text-xs font-bold transition-all"
                              >
                                สร้างใหม่
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bulk Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700/50">
              <button
                onClick={handleBulkGenerateArticles}
                disabled={isBulkProcessing || selectedBulkCount === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10"
              >
                {isBulkProcessing ? '⏳ กำลังทำงาน...' : `✨ สร้างบทความ+พาดหัว (${selectedBulkCount} รายการ)`}
              </button>
              <button
                onClick={handleBulkCreateImages}
                disabled={isBulkProcessing || selectedBulkCount === 0}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-500/10"
              >
                {isBulkProcessing ? '⏳ กำลังทำงาน...' : `🎨 สร้างภาพทั้งหมด (${selectedBulkCount} รายการ)`}
              </button>
            </div>

            {/* Bulk Processing Log */}
            {bulkProcessLog && (
              <div className="text-sm text-cyan-400 bg-cyan-900/30 p-3 rounded-lg text-center animate-pulse border border-cyan-800 font-medium">
                {bulkProcessLog}
              </div>
            )}
          </>
        )}

        {bulkItems.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <p className="text-3xl mb-2">📝</p>
            <p className="text-sm">กดปุ่ม "➕ เพิ่มกล่องบทความ" เพื่อเริ่มใส่บทความหลายรายการพร้อมกัน</p>
          </div>
        )}
      </div>

      {/* Results Table - Persistent */}
      {savedResults.length > 0 && (
        <div className="card p-5 space-y-4 border-l-4 border-l-purple-500 bg-gradient-to-br from-[var(--bg-card)] to-purple-900/10">
          <div className="flex justify-between items-start border-b border-gray-700/50 pb-3 gap-2">
            <div>
              <h2 className="text-lg font-bold text-purple-400 flex items-center gap-2">
                📚 ผลลัพท์ที่เก็บไว้ ({savedResults.length})
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500 truncate max-w-xs" title={aipageDataDir || 'ยังไม่ได้ตั้งค่า'}>
                  📁 {aipageDataDir || 'ยังไม่ได้ตั้งค่า'}
                </span>
                <button onClick={handlePickFolder} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-0.5 rounded transition-all" title="เลือกโฟลเดอร์ปลายทาง">📂 เลือกFolder</button>
                <button onClick={handleClearCache} className="text-xs bg-orange-900/50 hover:bg-orange-800/60 text-orange-300 px-2 py-0.5 rounded transition-all" title="ลบรูปที่ไม่ได้ใช้">🗑️ เคลียแคช</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                className="input-field text-xs py-1.5 w-64"
                value={dropboxFolderPath}
                onChange={e => setDropboxFolderPath(e.target.value)}
                placeholder="/Apps/YTViralPost"
                title="Dropbox folder path"
              />
              <button
                onClick={uploadAllSavedResultsToDropbox}
                disabled={isUploadingResults}
                className="bg-blue-600/30 hover:bg-blue-600/50 disabled:opacity-50 text-blue-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-blue-500/30"
              >
                {isUploadingResults ? '⏳ กำลังอัปโหลด...' : `☁️ อัปโหลดที่เลือก (${selectedResultIds.size})`}
              </button>
              <button onClick={exportCSV} className="bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-purple-500/30">
                📥 โหลด CSV
              </button>
              <button onClick={saveN8nCsvToDisk} className="bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-emerald-500/30">
                💾 บันทึก CSV n8n
              </button>
              <button
                onClick={async () => {
                  if (selectedResultIds.size === 0) return alert('กรุณาเลือกรายการที่จะลบก่อน');
                  if (!confirm(`ลบ ${selectedResultIds.size} รายการที่เลือกถาวรหรือไม่?`)) return;
                  const ids = [...selectedResultIds];
                  for (const id of ids) {
                    await fetch('/api/aipage-results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) });
                  }
                  setSelectedResultIds(new Set());
                  loadSavedResults();
                }}
                disabled={selectedResultIds.size === 0}
                className="bg-red-600/30 hover:bg-red-600/50 disabled:opacity-40 text-red-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-red-500/30"
                title="ลบรายการที่เลือก"
              >
                🗑️ ลบ ({selectedResultIds.size})
              </button>
              <button
                onClick={async () => {
                  const selected = savedResults.filter((r: any) => selectedResultIds.has(r.id));
                  if (selected.length === 0) return alert('กรุณาเลือกรายการที่จะกู้รูปก่อน');
                  for (const r of selected) {
                    await handleRecoverAndReuploadImage(r);
                  }
                }}
                disabled={isUploadingResults || recoveringResultId !== null || selectedResultIds.size === 0}
                className="bg-amber-600/30 hover:bg-amber-600/50 disabled:opacity-40 text-amber-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-amber-500/30"
                title="ลองโหลดรูปจากทุกแหล่ง แล้วอัพ Dropbox ใหม่"
              >
                🔄 กู้รูป+อัพใหม่ ({selectedResultIds.size})
              </button>
              <button
                onClick={() => fetch('/api/open-folder?type=app_data/aipage_images')}
                className="bg-gray-600/30 hover:bg-gray-600/50 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-gray-500/30"
                title="เปิดโฟลเดอร์รูปที่บันทึกไว้ใน disk"
              >
                📁 เปิดโฟลเดอร์รูป
              </button>
            </div>
          </div>
          {dropboxUploadLog && (
            <div className="text-xs text-blue-300 bg-blue-900/20 border border-blue-500/20 rounded-lg px-3 py-2">
              {dropboxUploadLog}
            </div>
          )}
          {/* Filter bar */}
          {(() => {
            const scriptDoneCount = savedResults.filter((p: any) => p.scriptDone).length;
            const contentDoneCount = savedResults.filter((p: any) => p.contentUsed).length;
            const filters: { key: typeof resultsFilter; label: string; count?: number; color: string }[] = [
              { key: 'all', label: 'ทั้งหมด', count: savedResults.length, color: 'gray' },
              { key: 'no_script', label: '📝 ยังไม่ติ๊ก Script', count: savedResults.length - scriptDoneCount, color: 'yellow' },
              { key: 'script_done', label: '📝 ติ๊ก Script แล้ว', count: scriptDoneCount, color: 'green' },
              { key: 'no_content', label: '🎬 ยังไม่ติ๊ก Content', count: savedResults.length - contentDoneCount, color: 'orange' },
              { key: 'content_done', label: '🎬 ติ๊ก Content แล้ว', count: contentDoneCount, color: 'purple' },
            ];
            const colorMap: Record<string, string> = {
              gray: 'bg-gray-700/50 text-gray-300 border-gray-600/50',
              yellow: 'bg-yellow-900/40 text-yellow-300 border-yellow-600/30',
              green: 'bg-emerald-900/40 text-emerald-300 border-emerald-600/30',
              orange: 'bg-orange-900/40 text-orange-300 border-orange-600/30',
              purple: 'bg-purple-900/40 text-purple-300 border-purple-600/30',
            };
            const activeMap: Record<string, string> = {
              gray: 'bg-gray-600 text-white border-gray-400',
              yellow: 'bg-yellow-600 text-white border-yellow-400',
              green: 'bg-emerald-600 text-white border-emerald-400',
              orange: 'bg-orange-600 text-white border-orange-400',
              purple: 'bg-purple-600 text-white border-purple-400',
            };
            return (
              <div className="flex flex-wrap gap-1.5">
                {filters.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setResultsFilter(f.key)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${resultsFilter === f.key ? activeMap[f.color] : colorMap[f.color]}`}
                  >
                    {f.label} {f.count !== undefined && <span className="ml-0.5 opacity-70">({f.count})</span>}
                  </button>
                ))}
              </div>
            );
          })()}

          <div className="flex flex-wrap items-center gap-2 bg-black/20 border border-gray-700/50 rounded-lg px-3 py-2">
            <button onClick={selectAllResults} className="text-xs bg-blue-700/50 hover:bg-blue-700 text-blue-200 px-3 py-1.5 rounded font-bold transition-all">
              ☑ เลือกทั้งหมด
            </button>
            <button onClick={clearSelectedResults} className="text-xs bg-gray-700/50 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded font-bold transition-all">
              ☐ ยกเลิกทั้งหมด
            </button>
            <span className="text-xs text-gray-400">เลือกอัปโหลด Dropbox อยู่ {selectedResultIds.size}/{savedResults.length} รายการ</span>
          </div>
          {(() => {
            const filteredResults = savedResults.filter((p: any) => {
              if (resultsFilter === 'script_done') return !!p.scriptDone;
              if (resultsFilter === 'no_script') return !p.scriptDone;
              if (resultsFilter === 'content_done') return !!p.contentUsed;
              if (resultsFilter === 'no_content') return !p.contentUsed;
              return true;
            });
            return (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredResults.map((p: any, idx: number) => (
              <div key={p.id || idx} className={`bg-black/30 rounded-xl border p-4 transition-all group ${selectedResultIds.has(p.id) ? 'border-blue-500 bg-blue-900/10' : 'border-gray-700/50 hover:border-purple-500/30'}`}>
                <div className="flex gap-4">
                  <label className="flex-shrink-0 pt-9 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedResultIds.has(p.id)}
                      onChange={() => toggleResultSelection(p.id)}
                      className="w-5 h-5 accent-blue-500"
                    />
                  </label>
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    {p.imageUrl ? (
                      <>
                        <div className="relative w-24 h-24">
                          {(() => {
                            // Ordered fallback sources — prefer local, then Dropbox (dl=1), then remote
                            const imgSources = [
                              p.localImageUrl ? encodeURI(p.localImageUrl) : null,
                              p.dropboxUrl ? p.dropboxUrl.replace(/dl=0/, 'dl=1') + (p.dropboxUrl.includes('dl=') ? '' : (p.dropboxUrl.includes('?') ? '&dl=1' : '?dl=1')) : null,
                              p.imageUrl && !p.imageUrl.startsWith('/') ? p.imageUrl : null,
                            ].filter((u): u is string => !!u);
                            const firstSrc = imgSources[0] || encodeURI(p.imageUrl);
                            return (
                              <img
                                src={firstSrc}
                                alt=""
                                className="w-24 h-24 object-cover rounded-lg shadow-lg"
                                data-fallback={JSON.stringify(imgSources.slice(1))}
                                onError={e => {
                                  const img = e.target as HTMLImageElement;
                                  const remaining: string[] = JSON.parse(img.getAttribute('data-fallback') || '[]');
                                  if (remaining.length > 0) {
                                    img.setAttribute('data-fallback', JSON.stringify(remaining.slice(1)));
                                    img.src = remaining[0];
                                  } else {
                                    img.style.display = 'none';
                                    // Show the sibling fallback div (last child of parent)
                                    const parent = img.parentElement;
                                    if (parent) {
                                      const fallbackDiv = parent.querySelector('.img-broken-fallback') as HTMLElement;
                                      if (fallbackDiv) fallbackDiv.style.display = 'flex';
                                    }
                                  }
                                }}
                              />
                            );
                          })()}
                          {/* Local disk badge */}
                          {p.localImageUrl && (
                            <div className="absolute top-0.5 left-0.5 bg-emerald-600/80 text-white text-[7px] px-1 py-0.5 rounded font-bold z-10">💾</div>
                          )}
                          {/* Broken image fallback */}
                          <div style={{display:'none'}} className="img-broken-fallback w-24 h-24 bg-gray-800 rounded-lg flex-col items-center justify-center gap-1 border border-red-500/30 absolute inset-0">
                            <span className="text-red-400 text-lg">🖼️</span>
                            <span className="text-[8px] text-gray-500">โหลดไม่ได้</span>
                          </div>
                        </div>
                        {/* Action buttons row — below the image */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => handleDownloadImage(p.localImageUrl || p.dropboxUrl || p.imageUrl, `aipage_${p.id}.png`)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-1.5 py-1 rounded text-xs shadow transition-colors"
                            title={`ดาวน์โหลดรูป${p.localImageUrl ? ' (local)' : p.dropboxUrl ? ' (Dropbox)' : ''}`}
                          >
                            ⬇️
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                setDropboxUploadLog(`กำลังอัปโหลด: ${p.headline || p.id}`);
                                const url = await uploadSavedResultToDropbox(p);
                                setDropboxUploadLog(`✅ อัปโหลดแล้ว: ${url}`);
                                await loadSavedResults();
                              } catch (e: any) {
                                setDropboxUploadLog(`❌ ${e.message}`);
                                alert(`อัปโหลดไม่สำเร็จ: ${e.message}`);
                              }
                            }}
                            className="bg-blue-700 hover:bg-blue-600 text-white px-1.5 py-1 rounded text-xs shadow transition-colors"
                            title="อัปโหลด Dropbox"
                          >
                            ☁️
                          </button>
                          <button
                            onClick={() => handleRecoverAndReuploadImage(p)}
                            disabled={recoveringResultId === p.id}
                            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-1.5 py-1 rounded text-xs shadow transition-colors"
                            title="กู้รูป"
                          >
                            {recoveringResultId === p.id ? '⏳' : '🔄'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="w-24 h-24 bg-gray-800 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-600 border border-gray-700/50">
                        <span className="text-2xl">🖼️</span>
                        <button
                          onClick={() => handleRecoverAndReuploadImage(p)}
                          disabled={recoveringResultId === p.id}
                          className="text-[9px] bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-1.5 py-0.5 rounded font-bold"
                        >
                          {recoveringResultId === p.id ? '⏳' : '🔄 กู้รูป'}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-bold text-amber-300 truncate flex-1 mr-2">
                        {p.headline || 'ไม่มีพาดหัว'}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Status toggles */}
                        <button
                          onClick={() => updateSavedResult(p.id, { scriptDone: !p.scriptDone })}
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-medium transition-all ${p.scriptDone ? 'bg-emerald-700 text-emerald-100 border-emerald-500' : 'bg-gray-800 text-gray-500 border-gray-600 hover:border-yellow-500/50 hover:text-yellow-400'}`}
                          title="สลับสถานะ: ทำ Script แล้ว"
                        >
                          📝{p.scriptDone ? '✓' : '–'}
                        </button>
                        <button
                          onClick={() => updateSavedResult(p.id, { contentUsed: !p.contentUsed })}
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-medium transition-all ${p.contentUsed ? 'bg-purple-700 text-purple-100 border-purple-500' : 'bg-gray-800 text-gray-500 border-gray-600 hover:border-orange-500/50 hover:text-orange-400'}`}
                          title="สลับสถานะ: เอาไปสร้าง Content แล้ว"
                        >
                          🎬{p.contentUsed ? '✓' : '–'}
                        </button>
                        <span className="text-[10px] text-gray-500">
                          {new Date(p.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={() => deleteSavedResult(p.id)}
                          className="text-red-400/50 hover:text-red-400 text-xs transition-all opacity-0 group-hover:opacity-100"
                          title="ลบ"
                        >
                          ✖
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                      {(p.article || '').substring(0, 200)}{(p.article || '').length > 200 ? '...' : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {p.dropboxUrl && (
                        <a href={p.dropboxUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 hover:border-blue-500/50 transition-all">
                          📦 Dropbox dl=1
                        </a>
                      )}
                      {p.dropboxPath && (
                        <span className="text-[10px] text-gray-500 bg-gray-800/60 px-2 py-0.5 rounded border border-gray-700/50">
                          {p.dropboxPath}
                        </span>
                      )}
                      <div className="flex-1 min-w-[150px]">
                        <input
                          type="url"
                          className="input-field w-full text-[10px] py-0.5 px-2"
                          placeholder="🌐 ใส่ลิงก์ที่มา..."
                          defaultValue={p.sourceUrl || ''}
                          onBlur={(e) => {
                            if (e.target.value !== (p.sourceUrl || '')) {
                              updateSavedResult(p.id, { sourceUrl: e.target.value });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                        />
                      </div>
                      {p.sourceUrl && (
                        <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-400 hover:underline">
                          ↪ เปิด
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
