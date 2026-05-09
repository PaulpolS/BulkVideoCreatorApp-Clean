import React, { useEffect, useMemo, useRef, useState } from 'react';
import workflow from '../../../[All Pages] ทำรูปStock ทุกเพจ.json';
import { globalTaskStore } from '../../hooks/useBackgroundTasks';
import { getActiveOpenRouterKey, getActiveOpenRouterKeyAsync, getOpenRouterKeyCandidates } from '../../hooks/useApiSettings';

interface PageConfig {
  name: string;
  document_id: string;
  sheet_name: string;
  filter_column: string;
  dropbox_path: string;
  item_limit: number;
  image_theme: string;
  image_font: string;
  image_credit: string;
  post_persona: string;
  post_length: string;
  post_hook: string;
}

interface QueueBatch {
  id: string;
  pageName: string;
  topics: string[];
  createdAt: string;
  mode: StockMode;
  imageProvider: ImageProvider;
  postModel: string;
}

type StockMode = 'image-and-post' | 'image-only' | 'post-only';
type ImageProvider = 'kie-gpt-image-2';
type AspectRatio = 'auto' | '1:1' | '9:16' | '16:9' | '4:3' | '3:4';
type ImageResolution = '1K' | '2K' | '4K';
type PageStockBuilderTab = 'api' | 'prompt' | 'local-image-article' | 'clickbait' | 'csv-clickbait' | 'canvas';

interface ApiProfile {
  id: string;
  name: string;
  openRouterKey?: string;
  dropboxKey?: string;
  dropboxAppKey?: string;
  dropboxAppSecret?: string;
  dropboxRefreshToken?: string;
  kieKey?: string;
}

interface OutputSettings {
  profileId: string;
  imageProvider: ImageProvider;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  openRouterModel: string;
  dropboxFolderPath: string;
  localSaveDir: string;
  saveLocal: boolean;
  saveDropbox: boolean;
  saveCsv: boolean;
}

interface PageStockResult {
  id: string;
  created_at: string;
  page_name: string;
  topic: string;
  mode: StockMode;
  status: 'completed' | 'error';
  error?: string;
  image_provider: ImageProvider;
  image_model: string;
  kie_task_id?: string;
  kie_image_url?: string;
  local_image_path?: string;
  dropbox_path?: string;
  dropbox_direct_url?: string;
  post_model: string;
  post_text?: string;
  image_prompt?: string;
  post_prompt?: string;
  sheet_name: string;
  document_id: string;
  aspect_ratio: AspectRatio;
  resolution: ImageResolution;
}

interface ManualPromptBrain {
  pageName: string;
  updatedAt: string;
  sourceFileName?: string;
  sourceRowCount: number;
  trendFileName?: string;
  trendRowCount?: number;
  summary: string;
  keywords: string[];
  contentAngles: string[];
  toneGuidelines: string[];
  topicPatterns: string[];
  promptRules: string[];
  visualStyleRules: string[];
  negativeRules: string[];
  trendInsights: string[];
  examplePrompts: string[];
  feedbackNotes: string[];
  rawAnalysis?: string;
}

interface ManualPromptResult {
  topic: string;
  imagePrompt: string;
}

type ManualBrainEditableField =
  | 'pageName'
  | 'summary'
  | 'keywords'
  | 'contentAngles'
  | 'toneGuidelines'
  | 'topicPatterns'
  | 'promptRules'
  | 'visualStyleRules'
  | 'negativeRules'
  | 'trendInsights'
  | 'examplePrompts'
  | 'feedbackNotes'
  | 'rawAnalysis';

interface LocalImageArticleItem {
  id: string;
  fileName: string;
  dropboxPath: string;
  sharedUrl: string;
  directUrl: string;
  status: 'idle' | 'processing' | 'done' | 'error';
  article: string;
  errorMsg: string;
  selected: boolean;
}

interface LocalImageArticleBrain {
  name: string;
  updatedAt: string;
  sourceFileName?: string;
  sourceRowCount: number;
  summary: string;
  writingPrompt: string;
  audienceInsights: string[];
  toneGuidelines: string[];
  structureRules: string[];
  productSignals: string[];
  captionExamples: string[];
  negativeRules: string[];
  feedbackNotes: string[];
  rawAnalysis?: string;
}

interface StockCanvasImage {
  id: string;
  fileName: string;
  dataUrl: string;
  width: number;
  height: number;
  selected: boolean;
}

interface ClickbaitPostItem {
  id: string;
  topic: string;
  headline: string;
  postText: string;
  comments: [string, string, string];
  status: 'done' | 'error';
  error?: string;
  createdAt: string;
}

const workflowNodes = (workflow as any).nodes ?? [];

function extractPageConfigs(): PageConfig[] {
  const setupNode = workflowNodes.find((node: any) => String(node.name).includes('ตั้งค่าเพจ'));
  const jsCode = setupNode?.parameters?.jsCode ?? '';
  const match = jsCode.match(/const pages = ([\s\S]*?);\s*return pages/);
  if (!match) return [];

  try {
    return Function(`"use strict"; return (${match[1]});`)();
  } catch (error) {
    console.error('Cannot parse page stock workflow config', error);
    return [];
  }
}

const PAGE_CONFIGS = extractPageConfigs();
const OUTPUT_SETTINGS_KEY = 'page_stock_output_settings';
const MANUAL_PROMPT_BRAINS_KEY = 'page_stock_prompt_brains';
const MANUAL_PROMPT_BRAINS_BACKUP_KEY = 'page_stock_prompt_brains_backup';
const LOCAL_IMAGE_PROMPT_KEY = 'page_stock_local_image_article_prompt';
const LOCAL_IMAGE_DROPBOX_PATH_KEY = 'page_stock_local_image_dropbox_path';
const LOCAL_IMAGE_ARTICLE_BRAINS_KEY = 'page_stock_local_image_article_brains';
const LOCAL_IMAGE_ARTICLE_MODEL_KEY = 'page_stock_local_image_article_model';
const MANUAL_BRAIN_MODEL_KEY = 'page_stock_manual_brain_model';
const MANUAL_TOPIC_MODEL_KEY = 'page_stock_manual_topic_model';
const MANUAL_PROMPT_MODEL_KEY = 'page_stock_manual_prompt_model';
const CLICKBAIT_POSTS_KEY = 'page_stock_clickbait_posts';
const CLICKBAIT_INPUT_KEY = 'page_stock_clickbait_input';

const LOCAL_IMAGE_ARTICLE_MODELS = [
  { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite · ถูกสุด', note: '$0.10 / $0.40 ต่อ 1M token' },
  { id: 'google/gemini-2.0-flash-lite-001', label: 'Gemini 2.0 Flash Lite · ประหยัดมาก', note: '$0.075 / $0.30 ต่อ 1M token' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini · เขียนดี ราคากลาง', note: '$0.15 / $0.60 ต่อ 1M token' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash · สมดุล', note: '$0.30 / $2.50 ต่อ 1M token' },
];

const MANUAL_BRAIN_MODELS = [
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro · วิเคราะห์เก่งสุด', note: 'แนะนำสำหรับสร้างสมอง' },
  { id: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4 · เข้าใจ pattern ลึก', note: 'เก่งเรื่อง reasoning & context' },
  { id: 'openai/gpt-4o', label: 'GPT-4o · เขียนไทยแข็งแกร่ง', note: 'สมดุลระหว่างความแม่นและความเร็ว' },
];

const MANUAL_TOPIC_PROMPT_MODELS = [
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash · สมดุล', note: 'แนะนำ — เร็วและคุณภาพดี' },
  { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite · ประหยัด', note: '$0.10 / $0.40 ต่อ 1M token' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini · เขียนไทยดี', note: '$0.15 / $0.60 ต่อ 1M token' },
  { id: 'google/gemini-2.0-flash-lite-001', label: 'Gemini 2.0 Flash Lite · ถูกมาก', note: '$0.075 / $0.30 ต่อ 1M token' },
];

const DEFAULT_LOCAL_IMAGE_ARTICLE_PROMPT = `## สินค้าหยก
Role: คุณคือเจ้าของร้านหยกประสบการณ์สูงที่เน้นการขายแบบ "Short & Sharp" (สั้น กระชับ ได้ใจความ) สไตล์ของคุณคือ ตรงไปตรงมา จริงใจ บอกสเปกชัดเจน และเน้นความคุ้มค่า
Task: ดูข้อมูลรูปภาพสินค้าหยก แล้วเขียนแคปชั่นขายของแบบสั้นๆ (Micro-Content) ที่คนอ่านจบใน 10 วินาทีแล้วอยากทักซื้อทันที

Rules (กฎเหล็ก):
ห้ามมีหัวข้อ: ห้ามใส่คำว่า "Hook:", "Body:", "Price:" หรือหัวข้อใดๆ
ความยาว: ห้ามเกิน 4-5 บรรทัด (รวมเว้นวรรค)
หัวข้อบังคับ:
บรรทัดแรก: จุดเด่น
บรรทัดสอง: สเปก
บรรทัดสาม: ราคาและ CTA

รูปแบบ: เป็นข้อความดิบ ไม่มี markdown ไม่ใช้ markdown bold`;

const NO_AI_PREAMBLE_RULE = `ข้อห้ามสำคัญมาก:
- ห้ามขึ้นต้นด้วยคำเกริ่น เช่น "แน่นอน", "ได้เลย", "ในฐานะ", "ผมคือ", "ฉันคือ", "นี่คือ", "แคปชั่นสำหรับภาพนี้"
- ห้ามบอกว่าตัวเองเป็น AI, Content Strategist, ผู้ช่วย, นักเขียน หรือกำลังวิเคราะห์ภาพ
- ห้ามพูดถึงกระบวนการทำงานหรือ prompt
- เริ่มคำตอบด้วยเนื้อหาโพสต์จริงทันที`;

const DEFAULT_OUTPUT_SETTINGS: OutputSettings = {
  profileId: '',
  imageProvider: 'kie-gpt-image-2',
  aspectRatio: '1:1',
  resolution: '2K',
  openRouterModel: 'google/gemini-2.5-pro',
  dropboxFolderPath: '',
  localSaveDir: '',
  saveLocal: true,
  saveDropbox: true,
  saveCsv: true,
};

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

function parseCsvTable(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);

  const headers = rows.shift()?.map((header, index) => header || `column_${index + 1}`) ?? [];
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function extractJsonPayload<T>(text: string, fallback: T): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const target = fenced || trimmed;
  const start = Math.min(
    ...[target.indexOf('{'), target.indexOf('[')].filter(index => index >= 0),
  );
  if (!Number.isFinite(start)) return fallback;
  const candidate = target.slice(start);
  try {
    return JSON.parse(candidate);
  } catch {
    try {
      const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
      return JSON.parse(candidate.slice(0, end + 1));
    } catch {
      return fallback;
    }
  }
}

function createManualBrainKey(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || `สมอง Prompt ${new Date().toLocaleDateString('th-TH')}`;
}

function stringifyPromptLike(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return String(value ?? '').trim();
  const obj = value as Record<string, unknown>;
  const likelyKeys = [
    'imagePrompt', 'prompt', 'Prompt', 'Prompt (English) สำหรับสร้างรูป',
    'Prompt สำหรับนำไปสร้างรูปภาพ (Image Generation Prompt)', 'examplePrompt',
  ];
  for (const key of likelyKeys) {
    if (typeof obj[key] === 'string' && obj[key]) return String(obj[key]).trim();
  }
  return Object.entries(obj)
    .map(([key, item]) => `${key}: ${typeof item === 'string' ? item : JSON.stringify(item)}`)
    .join('\n')
    .trim();
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(stringifyPromptLike).filter(Boolean) : [];
}

function getCsvField(row: Record<string, string>, keywords: string[]) {
  const entries = Object.entries(row);
  const found = entries.find(([key]) => keywords.some(keyword => key.toLowerCase().includes(keyword.toLowerCase())));
  return found?.[1]?.trim() || '';
}

function extractPromptExamplesFromRows(rows: Record<string, string>[]) {
  const direct = rows
    .map(row => getCsvField(row, ['prompt', 'สร้างรูป', 'image generation']))
    .filter(Boolean)
    .slice(0, 8);
  if (direct.length > 0) return direct;

  return rows
    .flatMap(row => Object.values(row))
    .map(value => String(value || '').trim())
    .filter(value =>
      value.length >= 80 &&
      value.length <= 5000 &&
      /prompt|infographic|1080|สร้างรูป|รูปขนาด|หัวข้อ|รายละเอียด|image/i.test(value)
    )
    .slice(0, 8);
}

function extractTopicExamplesFromRows(rows: Record<string, string>[]) {
  const direct = rows
    .map(row => getCsvField(row, ['topic', 'title', 'headline', 'หัวข้อ', 'ชื่อเรื่อง']))
    .filter(Boolean)
    .slice(0, 30);
  if (direct.length > 0) return direct;

  return rows
    .flatMap(row => Object.values(row))
    .map(value => String(value || '').trim())
    .flatMap(value => {
      const topicFromPrompt = value.match(/หัวข้อ(?:\s*Infographic)?\s*(?:คือ|:)?\s*([^รายละเอียด\n]{8,120})/i)?.[1];
      return topicFromPrompt ? [topicFromPrompt.trim()] : [];
    })
    .slice(0, 30);
}

function extractKeywordsFromText(text: string, limit = 30, mode: 'concept' | 'pain' | 'mixed' = 'mixed') {
  const blocked = /^(AI|CSV|Prompt|Infographic|Facebook|Page|Content|Topic|Title|How|To|Use|Case|Tool|Comparison|Introduction|Giveaway|Listicle|the|and|for|with|คือ|ทำไม|วิธี|สร้าง|รูป|เพจ|หัวข้อ|เขียนกลับ|แกนหลัก|ชอบลอง|อยากเรียนรู้|ไม่อยากเรียน|บ้าคลั่ง|เครียด|ตามไม่ทัน|เกาไม่ถูกที่คัน)$/i;
  const matches = [
    ...String(text || '').matchAll(/['"“”‘’]([^'"“”‘’]{2,48})['"“”‘’]/g),
  ].map(match => match[1]);
  const latin = [...String(text || '').matchAll(/\b[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,3}\b/g)].map(match => match[0]);
  const aiThai = [...String(text || '').matchAll(/(?:AI|เอไอ)\s?[\u0E00-\u0E7FA-Za-z0-9 ]{2,32}|[\u0E00-\u0E7F]{2,18}\s?(?:AI|เอไอ|Prompt|Agent)/g)].map(match => match[0]);
  const painMatches = [...String(text || '').matchAll(/ตามไม่ทัน|เครียด|เกาไม่ถูกที่คัน|กลัวตกเทรนด์|ข้อมูลล้น|เลือกไม่ถูก|ไม่รู้จะเริ่มยังไง|ไม่อยากเรียน|อยากเรียนรู้/g)].map(match => match[0]);
  const candidates = mode === 'pain' ? painMatches : mode === 'concept' ? [...matches, ...latin, ...aiThai] : [...matches, ...latin, ...aiThai, ...painMatches];
  return Array.from(new Set(candidates
    .map(cleanTopicSeed)
    .filter(item => item && item.length > 1 && !blocked.test(item))
    .filter(item => mode !== 'concept' || /AI|Agent|Code|OS|System|Claude|Vibe|Niche|Singularity|Karpathy|Remotion|Sora|Veo|Runway|Midjourney|Notebook|Perplexity|ระบบปฏิบัติการ|สถาปนิก/i.test(item))))
    .slice(0, limit);
}

function createLocalManualBrainFromCsv(params: {
  brainKey: string;
  rows: Record<string, string>[];
  trendRows: Record<string, string>[];
  manualCsvName: string;
  manualTrendCsvName: string;
  csvPromptExamples: string[];
  previousFeedback: string[];
}): ManualPromptBrain {
  const topicExamples = extractTopicExamplesFromRows(params.rows);
  const promptText = params.csvPromptExamples.join('\n\n');
  const topicText = topicExamples.join('\n');
  const trendText = params.trendRows.slice(0, 200).map(row => Object.values(row).join(' ')).join('\n');
  const promptConcepts = extractKeywordsFromText(`${topicText}\n${promptText}`, 24, 'concept');
  const trendConcepts = extractKeywordsFromText(trendText, 30, 'concept');
  const painPoints = extractKeywordsFromText(trendText, 12, 'pain');
  const keywords = Array.from(new Set([
    ...trendConcepts,
    ...promptConcepts,
  ])).slice(0, 36);
  const trendSeeds = trendConcepts.slice(0, 24);
  const topicPatternsFromExamples = topicExamples.slice(0, 10).map(topic => `ตัวอย่างหัวข้อจาก CSV: ${topic}`);

  return normalizeManualBrain({
    pageName: params.brainKey,
    updatedAt: new Date().toISOString(),
    sourceFileName: params.manualCsvName,
    sourceRowCount: params.rows.length,
    trendFileName: params.manualTrendCsvName || '',
    trendRowCount: params.trendRows.length,
    summary: `สมองฐานจาก CSV ${params.rows.length} แถว${params.trendRows.length ? ` และ CSV เทรนด์ ${params.trendRows.length} แถว` : ''} สกัดแบบ local เป็นหลายหมวด: concept/tool, pain point, pattern หัวข้อ, prompt format และ trend seed เพื่อใช้ต่อแม้ OpenRouter ยังไม่พร้อม`,
    keywords: keywords.length ? keywords : ['AI', 'เครื่องมือ AI', params.brainKey],
    contentAngles: [
      'How-to: สอนใช้งานเครื่องมือหรือ workflow แบบทำตามได้',
      'Tool Comparison: เปรียบเทียบเครื่องมือหรือแนวทางที่คล้ายกัน',
      'Tool Introduction: แนะนำเครื่องมือหรือคอนเซปต์ใหม่ที่กำลังเป็นกระแส',
      'Use Case: ย่อยเป็นตัวอย่างการใช้งานจริงในงาน/ธุรกิจ/คอนเทนต์',
      'Prompt Giveaway: แจก prompt หรือ template ที่เอาไปใช้ได้ทันที',
      'Listicle: รวมเครื่องมือ ขั้นตอน หรือ checklist ให้สแกนง่าย',
    ],
    toneGuidelines: [
      'อธิบายเรื่องยากให้เข้าใจง่าย',
      'เน้นใช้ได้จริง ไม่เขียนเชิงทฤษฎียาวเกินไป',
      'หัวข้อควรคม ชัด และมีผลลัพธ์ที่คนอ่านอยากได้',
      'ภาษาไทยอ่านง่าย เหมาะกับ infographic',
      ...(painPoints.length ? [`แตะ pain point ของคนอ่านได้ เช่น ${painPoints.slice(0, 6).join(', ')}`] : []),
    ],
    topicPatterns: [
      'ขึ้นต้นด้วยชื่อเครื่องมือ/คอนเซปต์ แล้วตามด้วยประโยชน์',
      'ใช้รูปแบบ วิธี..., แจก Prompt..., เปรียบเทียบ..., สรุป..., Checklist...',
      'ดึง trend seed ล่าสุดมาผสมกับ pattern เดิมของเพจ',
      'หลีกเลี่ยงหัวข้อกว้างเกินไป เช่น AI คืออะไร ถ้ามี trend seed เฉพาะเจาะจงกว่า',
      ...topicPatternsFromExamples,
    ],
    promptRules: [
      'รักษา format จาก CSV Prompt เดิมให้มากที่สุด',
      'ระบุหัวข้อ infographic เป็นภาษาไทยชัดเจน',
      'คุมภาพเป็น infographic 1080x1080 อ่านง่าย',
      'ใส่รายละเอียด/ไอเดียที่ช่วยให้ภาพเล่าเรื่องได้ครบ',
    ],
    visualStyleRules: [
      'Infographic ภาษาไทย อ่านง่าย',
      'Layout เป็นลำดับขั้น ตาราง เปรียบเทียบ หรือ checklist ตามหัวข้อ',
      'เน้นความชัดของข้อความและ hierarchy',
      'ใช้ภาพประกอบ/ไอคอนที่สัมพันธ์กับเครื่องมือหรือ workflow',
    ],
    negativeRules: [
      'ห้ามลากคำอธิบาย trend/pattern มาเป็นหัวข้อดิบๆ',
      'ห้ามใช้ keyword กว้างซ้ำๆ ถ้ามี trend seed เฉพาะเจาะจง',
      'ห้ามสร้างหัวข้อที่ไม่เกี่ยวกับ CSV Prompt หรือ CSV เทรนด์',
      'ห้ามใส่ field name หรือเศษ JSON เช่น pageName, summary, pattern',
    ],
    trendInsights: trendSeeds.length
      ? [
        ...trendSeeds.map(seed => `Concept/tool trend: ${seed}`),
        ...painPoints.map(point => `Audience pain point: ${point}`),
      ]
      : ['ยังไม่มี trend seed ชัดเจนจาก CSV เทรนด์ ให้ใช้ keyword และ pattern จาก CSV Prompt เป็นหลัก'],
    examplePrompts: params.csvPromptExamples,
    feedbackNotes: params.previousFeedback,
    rawAnalysis: JSON.stringify({
      mode: 'local-chunk-fallback',
      topicExamples,
      promptConcepts,
      keywords,
      trendSeeds,
      painPoints,
      promptExampleCount: params.csvPromptExamples.length,
    }, null, 2),
  }, params.brainKey);
}

function hasUsefulManualBrainPayload(parsed: any) {
  if (!parsed || typeof parsed !== 'object') return false;
  return [
    parsed.keywords,
    parsed.contentAngles,
    parsed.toneGuidelines,
    parsed.topicPatterns,
    parsed.promptRules,
    parsed.visualStyleRules,
    parsed.negativeRules,
    parsed.trendInsights,
    parsed.examplePrompts,
  ].some(value => Array.isArray(value) && value.length > 0);
}

function compactBrainItems(values: unknown[], limit: number) {
  const blocked = /^(AI|Prompt|Content|Topic|Tool|How|To|Use|Case|JSON|CSV|Page|Title|Niche|Pain Point|ให้ AI|ThailandAI)$/i;
  return Array.from(new Set(values
    .flatMap(value => Array.isArray(value) ? value : [value])
    .map(value => cleanTopicSeed(String(value || '')))
    .filter(value =>
      value.length >= 3 &&
      value.length <= 60 &&
      !blocked.test(value) &&
      !/[{}[\]]/.test(value) &&
      !/^คุณต้องการอะไร/.test(value) &&
      !/^อย่าปล่อย/.test(value)
    )))
    .slice(0, limit);
}

function synthesizeManualBrainPayloadFromDeepAnalyses(params: {
  brainKey: string;
  promptAnalyses: any[];
  trendAnalyses: any[];
  csvPromptExamples: string[];
}) {
  const promptRaw = params.promptAnalyses.map(item => [item.raw, item.notes, item.summary].filter(Boolean).join('\n')).join('\n');
  const trendRaw = params.trendAnalyses.map(item => [item.raw, item.notes, item.summary].filter(Boolean).join('\n')).join('\n');
  const trendTools = compactBrainItems([
    ...params.trendAnalyses.flatMap(item => item.trendTools || []),
    ...params.trendAnalyses.flatMap(item => item.trendConcepts || []),
    ...extractKeywordsFromText(trendRaw, 40, 'concept'),
  ], 28);
  const promptKeywords = compactBrainItems([
    ...params.promptAnalyses.flatMap(item => item.keywords || []),
    ...extractKeywordsFromText(promptRaw, 32, 'concept'),
  ], 24);
  const painPoints = compactBrainItems([
    ...params.trendAnalyses.flatMap(item => item.audiencePainPoints || []),
    ...extractKeywordsFromText(trendRaw, 12, 'pain'),
  ], 12);
  const contentAngles = compactBrainItems([
    ...params.promptAnalyses.flatMap(item => item.contentAngles || []),
    ...params.trendAnalyses.flatMap(item => item.topicOpportunities || []),
  ], 18);
  const topicPatterns = compactBrainItems([
    ...params.promptAnalyses.flatMap(item => item.topicPatterns || []),
  ], 18);
  const promptRules = compactBrainItems([
    ...params.promptAnalyses.flatMap(item => item.promptRules || []),
  ], 18);
  const visualStyleRules = compactBrainItems([
    ...params.promptAnalyses.flatMap(item => item.visualStyleRules || []),
  ], 18);
  const negativeRules = compactBrainItems([
    ...params.promptAnalyses.flatMap(item => item.negativeRules || []),
    ...params.trendAnalyses.flatMap(item => item.avoidAsKeywords || []).map((item: string) => `อย่าใช้เป็น keyword หลัก: ${item}`),
  ], 18);
  const examplePrompts = Array.from(new Set([
    ...params.promptAnalyses.flatMap(item => asStringArray(item.examplePrompts)),
    ...params.csvPromptExamples,
  ])).slice(0, 8);

  return {
    pageName: params.brainKey,
    summary: `สมอง Deep Training จากการอ่าน CSV เป็นก้อน ${params.promptAnalyses.length} ชุด และเทรนด์ ${params.trendAnalyses.length} ชุด รวม tool/concept, pattern, prompt rules และ pain point แยกหมวดแล้ว`,
    keywords: compactBrainItems([...trendTools, ...promptKeywords], 36),
    contentAngles: contentAngles.length ? contentAngles : [
      '🔥 พาดหัว 3 บรรทัด (Hook -> Method -> Result) ดึงดูดและเห็นผลลัพธ์ชัดเจน',
      'How-to: สอนใช้งานเครื่องมือหรือ workflow แบบทำตามได้',
      'Tool Introduction: แนะนำเครื่องมือหรือคอนเซปต์ใหม่ที่กำลังเป็นกระแส',
      'Use Case: ย่อยเป็นตัวอย่างการใช้งานจริงในงาน/ธุรกิจ/คอนเทนต์',
      'Tool Comparison: เปรียบเทียบเครื่องมือหรือแนวทางที่คล้ายกัน',
    ],
    toneGuidelines: [
      'อธิบายเรื่องยากให้เข้าใจง่ายและใช้ได้จริง',
      'เน้นหัวข้อคม ชัด และโยงกับผลลัพธ์ที่คนอ่านอยากได้',
      ...(painPoints.length ? [`แตะ pain point ที่พบ: ${painPoints.join(', ')}`] : []),
    ],
    topicPatterns: topicPatterns.length ? topicPatterns : [
      'ขึ้นต้นด้วยชื่อเครื่องมือ/คอนเซปต์ แล้วตามด้วยประโยชน์',
      'ใช้รูปแบบ วิธี..., แจก Prompt..., เปรียบเทียบ..., สรุป..., Checklist...',
      'ดึง trend seed ล่าสุดมาผสมกับ pattern เดิมของเพจ',
    ],
    promptRules: promptRules.length ? promptRules : [
      'รักษา format จาก CSV Prompt เดิมให้มากที่สุด',
      'ระบุหัวข้อ infographic เป็นภาษาไทยชัดเจน',
      'คุมภาพเป็น infographic 1080x1080 อ่านง่าย',
    ],
    visualStyleRules: visualStyleRules.length ? visualStyleRules : [
      'Infographic ภาษาไทย อ่านง่าย',
      'Layout เป็นลำดับขั้น ตาราง เปรียบเทียบ หรือ checklist ตามหัวข้อ',
      'เน้น hierarchy และความชัดของข้อความ',
    ],
    negativeRules: negativeRules.length ? negativeRules : [
      'ห้ามเอา pain point หรือประโยคบ่นมาเป็น keyword หลัก',
      'ห้ามใส่ field name หรือเศษ JSON เช่น pageName, summary, pattern',
      'ห้ามใช้ keyword กว้างซ้ำๆ ถ้ามี trend seed เฉพาะเจาะจงกว่า',
    ],
    trendInsights: [
      ...trendTools.map(item => `Trend tool/concept: ${item}`),
      ...painPoints.map(item => `Audience pain point: ${item}`),
    ].slice(0, 36),
    examplePrompts,
  };
}

function normalizeManualBrain(brain: Partial<ManualPromptBrain> | undefined, fallbackName = 'สมอง Prompt'): ManualPromptBrain {
  return {
    pageName: String(brain?.pageName || fallbackName),
    updatedAt: String(brain?.updatedAt || new Date().toISOString()),
    sourceFileName: brain?.sourceFileName || '',
    sourceRowCount: Number(brain?.sourceRowCount || 0),
    trendFileName: brain?.trendFileName || '',
    trendRowCount: Number(brain?.trendRowCount || 0),
    summary: String(brain?.summary || 'ยังไม่มีสรุปสมอง'),
    keywords: asStringArray(brain?.keywords),
    contentAngles: asStringArray(brain?.contentAngles),
    toneGuidelines: asStringArray(brain?.toneGuidelines),
    topicPatterns: asStringArray(brain?.topicPatterns),
    promptRules: asStringArray(brain?.promptRules),
    visualStyleRules: asStringArray(brain?.visualStyleRules),
    negativeRules: asStringArray(brain?.negativeRules),
    trendInsights: asStringArray(brain?.trendInsights),
    examplePrompts: asStringArray(brain?.examplePrompts),
    feedbackNotes: asStringArray(brain?.feedbackNotes),
    rawAnalysis: brain?.rawAnalysis || '',
  };
}

function normalizeArticleBrain(brain: Partial<LocalImageArticleBrain> | undefined, fallbackName = 'สมองเขียนโพส'): LocalImageArticleBrain {
  const writingPrompt = String(brain?.writingPrompt || DEFAULT_LOCAL_IMAGE_ARTICLE_PROMPT);
  return {
    name: String(brain?.name || fallbackName),
    updatedAt: String(brain?.updatedAt || new Date().toISOString()),
    sourceFileName: brain?.sourceFileName || '',
    sourceRowCount: Number(brain?.sourceRowCount || 0),
    summary: String(brain?.summary || 'ยังไม่มีสรุปสมอง'),
    writingPrompt: writingPrompt.includes('ห้ามขึ้นต้นด้วยคำเกริ่น')
      ? writingPrompt
      : `${writingPrompt.trim()}\n\n${NO_AI_PREAMBLE_RULE}`,
    audienceInsights: asStringArray(brain?.audienceInsights),
    toneGuidelines: asStringArray(brain?.toneGuidelines),
    structureRules: asStringArray(brain?.structureRules),
    productSignals: asStringArray(brain?.productSignals),
    captionExamples: asStringArray(brain?.captionExamples),
    negativeRules: asStringArray(brain?.negativeRules),
    feedbackNotes: asStringArray(brain?.feedbackNotes),
    rawAnalysis: brain?.rawAnalysis || '',
  };
}

function createManualBrainPromptContext(brain: ManualPromptBrain) {
  return JSON.stringify({
    pageName: brain.pageName,
    summary: brain.summary,
    keywords: brain.keywords.slice(0, 24),
    contentAngles: brain.contentAngles.slice(0, 16),
    toneGuidelines: brain.toneGuidelines.slice(0, 12),
    topicPatterns: brain.topicPatterns.slice(0, 16),
    promptRules: brain.promptRules.slice(0, 14),
    visualStyleRules: brain.visualStyleRules,
    negativeRules: brain.negativeRules.slice(0, 12),
    trendInsights: brain.trendInsights.slice(0, 14),
    examplePrompts: brain.examplePrompts.slice(0, 4),
    feedbackNotes: brain.feedbackNotes.slice(-8),
  }, null, 2);
}

function limitText(value: string, maxLength: number) {
  const text = String(value || '').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function createManualTopicBrainContext(brain: ManualPromptBrain) {
  return [
    `ชื่อสมอง: ${brain.pageName}`,
    `สรุป: ${limitText(brain.summary, 420)}`,
    `Keywords: ${brain.keywords.slice(0, 14).join(', ')}`,
    `แนวหัวข้อ: ${brain.contentAngles.slice(0, 7).map(item => `- ${limitText(item, 120)}`).join('\n')}`,
    `Pattern หัวข้อ: ${brain.topicPatterns.slice(0, 7).map(item => `- ${limitText(item, 120)}`).join('\n')}`,
    `Trend ที่ควรใช้: ${brain.trendInsights.slice(0, 7).map(item => `- ${limitText(item, 150)}`).join('\n')}`,
    brain.feedbackNotes.length ? `Feedback เจ้าของเพจ: ${brain.feedbackNotes.slice(-4).map(item => `- ${limitText(item, 120)}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
}

function pickRotatingItems(items: string[], start: number, count: number, maxLength: number) {
  if (items.length === 0) return [];
  return Array.from({ length: Math.min(count, items.length) }, (_, index) => {
    const item = items[(start + index) % items.length];
    return limitText(item, maxLength);
  });
}

function createManualTopicBrainChunkContext(brain: ManualPromptBrain, batchIndex: number, ultraCompact = false) {
  const offset = batchIndex * (ultraCompact ? 2 : 3);
  const keywordCount = ultraCompact ? 10 : 18;
  const keywords = pickRotatingItems(brain.keywords, offset, keywordCount, 80).join(', ');
  const angles = pickRotatingItems(brain.contentAngles, offset, ultraCompact ? 2 : 3, ultraCompact ? 80 : 110);
  const patterns = pickRotatingItems(brain.topicPatterns, offset, ultraCompact ? 2 : 3, ultraCompact ? 80 : 110);
  const trends = pickRotatingItems(brain.trendInsights, offset, ultraCompact ? 2 : 3, ultraCompact ? 90 : 120);

  return [
    `เพจ: ${brain.pageName}`,
    `สรุป: ${limitText(brain.summary, ultraCompact ? 180 : 260)}`,
    keywords ? `Allowed Keywords (ใช้เป็น allowlist ของชื่อ tool/concept): ${keywords}` : '',
    angles.length ? `Angle ชุดนี้:\n${angles.map(item => `- ${item}`).join('\n')}` : '',
    patterns.length ? `Pattern ชุดนี้:\n${patterns.map(item => `- ${item}`).join('\n')}` : '',
    trends.length ? `Trend ชุดนี้:\n${trends.map(item => `- ${item}`).join('\n')}` : '',
    brain.feedbackNotes.length && !ultraCompact ? `Feedback: ${brain.feedbackNotes.slice(-2).map(item => `- ${limitText(item, 90)}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');
}

function extractTopicStrings(answer: string) {
  const parsed = extractJsonPayload<any>(answer, []);
  const values = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.topics)
      ? parsed.topics
      : [];
  const fromJson = values.map((item: unknown) => String(item).trim()).filter(Boolean);
  if (fromJson.length > 0) return fromJson;

  return answer
    .split('\n')
    .map(line => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter(line => line.length > 4 && !/^(json|หัวข้อ|topics|\[|\]|```)/i.test(line));
}

function cleanTopicSeed(value: string) {
  const raw = String(value || '').trim();
  const acronym = raw.match(/\(([A-Z][A-Z0-9]{2,})\)/)?.[1] || '';
  const text = raw
    .split(/[:：]|—|–|- ตัวอย่าง|- กลยุทธ์|เช่น|ได้แก่|จากข้อมูล CSV|จากข้อมูล|กลยุทธ์คือ/i)[0]
    .replace(/\([^)]*\)/g, '')
    .replace(/["'“”‘’]/g, '')
    .replace(/^(?:Tool Comparison|Prompt Giveaway|How-to|Educational|Listicles|เปรียบเทียบ|ฮาวทู)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return acronym || text || '';
}

function extractTrendTopicSeeds(brain: ManualPromptBrain) {
  const trendText = brain.trendInsights.join('\n');
  const patternText = [...brain.contentAngles, ...brain.topicPatterns].join('\n');
  const allText = [trendText, patternText].join('\n');
  const blockedSeeds = /^(AI|ปัญญาประดิษฐ์|เครื่องมือ AI|แจก Prompt|Productivity|How|to|Tool|Comparison|Introduction|Use|Case|Prompt|Giveaway|Listicle|pageName|summary|pattern|CSV|Infographic|Operating|System|Dream|Machine|vs Udio|thailand|com|ย่อย|รีวิว)$/i;
  const normalizeSeeds = (values: string[]) => values
    .map(seed => cleanTopicSeed(seed))
    .filter(seed => seed && !seed.includes('...') && !/[\[\]{}]/.test(seed) && !blockedSeeds.test(seed))
    .filter((seed, index, all) => all.findIndex(item => item.toLowerCase() === seed.toLowerCase()) === index);

  const extractFromText = (text: string) => {
    const seeds = new Set<string>();
    const addSeed = (value: string) => {
      const seed = cleanTopicSeed(value);
      if (!seed || blockedSeeds.test(seed)) return;
      seeds.add(seed);
    };

    const quotedMatches = text.matchAll(/['"“”‘’]([^'"“”‘’]{2,48})['"“”‘’]/g);
    for (const match of quotedMatches) addSeed(match[1]);

    const acronymMatches = text.matchAll(/\(([A-Z][A-Z0-9]{2,})\)/g);
    for (const match of acronymMatches) addSeed(match[1]);

    return normalizeSeeds(Array.from(seeds));
  };

  const trendSeeds = extractFromText(trendText);
  const patternSeeds = extractFromText(patternText);
  const addSeed = (value: string) => {
    const seed = cleanTopicSeed(value);
    return seed && !blockedSeeds.test(seed) ? seed : '';
  };

  const preferred = [
    'AI Agent',
    'AIOS',
    'AI Operating System',
    'Claude Code',
    'Vibe Editing',
    'Vibe Coding',
    'ChatGPT Agent',
    'Google Flow',
    'Remotion',
    'NotebookLM',
    'Perplexity',
    'Sora',
    'Veo',
    'Runway',
    'Midjourney',
    'Nano Banana',
    'ComfyUI',
    'ElevenLabs',
  ];
  const preferredTrendSeeds = preferred
    .filter(seed => trendText.toLowerCase().includes(seed.toLowerCase()))
    .map(addSeed)
    .filter(Boolean);
  const patternExampleSeeds = [
    'Suno',
    'Udio',
    'Suno vs Udio',
    'Luma Dream Machine',
    'AI ช่วยคิดเมนูอาหาร',
    'แจก Prompt ทำโลโก้สไตล์ Minimal',
    'AI ช่วยตัดต่อวิดีโอ',
  ];
  const preferredPatternSeeds = (preferredTrendSeeds.length >= 4 ? [] : patternExampleSeeds)
    .filter(seed => allText.toLowerCase().includes(seed.toLowerCase()))
    .map(addSeed)
    .filter(Boolean);

  return normalizeSeeds([
    ...preferredTrendSeeds,
    ...trendSeeds,
    ...preferredPatternSeeds,
    ...patternSeeds,
  ]).slice(0, 80);
}

function getBrainCapabilityMap(brain: ManualPromptBrain) {
  const trendSeeds = extractTrendTopicSeeds(brain);
  const capabilities = [
    {
      label: 'แตกหัวข้อ',
      value: Math.min(100, Math.round(((brain.keywords.length + brain.contentAngles.length + trendSeeds.length) / 24) * 100)),
      detail: `${brain.keywords.length} keywords · ${brain.contentAngles.length} angles`,
    },
    {
      label: 'จับเทรนด์',
      value: Math.min(100, Math.round(((brain.trendInsights.length + trendSeeds.length) / 14) * 100)),
      detail: `${brain.trendInsights.length} insights · ${trendSeeds.length} seeds`,
    },
    {
      label: 'คุมสไตล์',
      value: Math.min(100, Math.round(((brain.toneGuidelines.length + brain.visualStyleRules.length) / 18) * 100)),
      detail: `${brain.toneGuidelines.length} tone · ${brain.visualStyleRules.length} visual`,
    },
    {
      label: 'สร้าง Prompt',
      value: Math.min(100, Math.round(((brain.promptRules.length + brain.examplePrompts.length) / 18) * 100)),
      detail: `${brain.promptRules.length} rules · ${brain.examplePrompts.length} examples`,
    },
  ];

  return {
    trendSeeds,
    capabilities,
    primaryKeywords: brain.keywords.slice(0, 10),
    primaryPatterns: brain.contentAngles.slice(0, 6),
    promptRules: brain.promptRules.slice(0, 5),
    guardrails: brain.negativeRules.slice(0, 5),
  };
}

function createLocalManualTopics(brain: ManualPromptBrain, count: number, existingTopics: string[], offset = 0) {
  const editedKeywords = Array.from(new Set(brain.keywords.map(cleanTopicSeed).filter(Boolean)));
  const fallbackTrendSeeds = extractTrendTopicSeeds(brain);
  const keywords = editedKeywords.length ? editedKeywords : fallbackTrendSeeds.length ? fallbackTrendSeeds : [brain.pageName];
  const templates = [
    '{keyword} คืออะไร? ทำไมคนทำงานยุค AI ต้องรู้',
    'วิธีเริ่มใช้ {keyword} ให้ช่วยงานได้จริงในวันเดียว',
    'แจก Prompt ใช้ {keyword} วางระบบงานอัตโนมัติ',
    '{keyword} เหมาะกับงานแบบไหน? เช็กก่อนเสียเวลา',
    'เปรียบเทียบ {keyword} กับเครื่องมือ AI เดิม: ต่างกันตรงไหน',
    '5 ไอเดียใช้ {keyword} ทำคอนเทนต์ให้เร็วขึ้น',
    'ข้อผิดพลาดที่มือใหม่มักเจอเมื่อใช้ {keyword}',
    'Workflow ใช้ {keyword} ทำงาน 1 วันให้จบไวขึ้น',
    'อัปเดต {keyword}: เทรนด์นี้กระทบคนทำคอนเทนต์ยังไง',
    'Checklist ก่อนนำ {keyword} ไปใช้กับงานจริง',
    'กรณีใช้งาน {keyword} ที่คนทำเพจเอาไปปรับใช้ได้ทันที',
    '{keyword} จะมาแทนงานส่วนไหน และงานไหนยังต้องใช้คน',
  ];
  const existing = new Set(existingTopics.map(topic => topic.trim().toLowerCase()));
  const topics: string[] = [];
  const createTopic = (cursor: number) => {
    const keyword = cleanTopicSeed(keywords[cursor % keywords.length] || brain.pageName);
    const template = templates[cursor % templates.length];
    return template.replace('{keyword}', keyword).replace(/\s+/g, ' ').slice(0, 120).trim();
  };

  let cursor = offset;
  while (topics.length < count && cursor < offset + count * 200) {
    const topic = createTopic(cursor);
    const fingerprint = topic.toLowerCase();
    if (topic && !existing.has(fingerprint)) {
      existing.add(fingerprint);
      topics.push(topic);
    }
    cursor += 1;
  }

  cursor = offset;
  while (topics.length < count && cursor < offset + count * 200) {
    const topic = createTopic(cursor);
    if (topic && !topics.some(item => item.toLowerCase() === topic.toLowerCase())) {
      topics.push(topic);
    }
    cursor += 1;
  }

  return topics;
}

function getLikelyPostExamples(rows: Record<string, string>[], limit = 12): string[] {
  const priorityKeys = [
    'caption', 'post', 'content', 'article', 'text', 'message', 'copy',
    'แคปชั่น', 'โพส', 'โพสต์', 'เนื้อหา', 'บทความ', 'ข้อความ', 'รายละเอียด',
  ];
  const examples: string[] = [];
  const seen = new Set<string>();

  rows.forEach(row => {
    const entries = Object.entries(row);
    const sorted = [...entries].sort(([aKey, aValue], [bKey, bValue]) => {
      const aScore = priorityKeys.some(key => aKey.toLowerCase().includes(key.toLowerCase())) ? 1000 : 0;
      const bScore = priorityKeys.some(key => bKey.toLowerCase().includes(key.toLowerCase())) ? 1000 : 0;
      return (bScore + String(bValue).length) - (aScore + String(aValue).length);
    });
    const value = sorted
      .map(([, item]) => String(item || '').trim())
      .find(item =>
        item.length >= 24 &&
        item.length <= 1800 &&
        !/^https?:\/\//i.test(item) &&
        !/\.(png|jpe?g|webp|gif|mp4|mov)(\?|$)/i.test(item) &&
        /[ก-๙A-Za-z]/.test(item)
      );
    if (!value) return;
    const clean = value.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    const fingerprint = clean.slice(0, 160);
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);
    examples.push(clean);
  });

  return examples.slice(0, limit);
}

function buildLocalImageWritingPromptFromCsv(params: {
  brainKey: string;
  summary: string;
  audienceInsights: string[];
  toneGuidelines: string[];
  structureRules: string[];
  productSignals: string[];
  captionExamples: string[];
  negativeRules: string[];
}) {
  return `Role: คุณคือคนเขียนโพสต์ประจำเพจนี้ ต้องเขียนให้เหมือนตัวอย่าง CSV ที่เจ้าของเพจแนบมา ไม่ใช่เขียนแบบบทความทั่วไป

บริบท/สรุปเพจ:
${params.summary}

กฎสำคัญ:
- ใช้สำนวน ความยาว จังหวะการขึ้นบรรทัด และโครงสร้างให้ใกล้ตัวอย่าง CSV มากที่สุด
- เขียนเป็นข้อความดิบสำหรับเอาไปโพสต์ทันที
- ห้ามใช้ markdown, ห้ามใช้หัวข้อแบบ Hook:/Body:/CTA:, ห้ามใช้ markdown bold
- ห้ามขึ้นต้นด้วยคำเกริ่น เช่น แน่นอน, ได้เลย, ในฐานะ, ผมคือ, ฉันคือ, นี่คือ, แคปชั่นสำหรับภาพนี้
- ห้ามบอกว่าตัวเองเป็น AI, Content Strategist, ผู้ช่วย, นักเขียน หรือกำลังวิเคราะห์ภาพ
- ห้ามเดาราคา/โปรโมชัน/สเปกที่มองไม่เห็นจากรูป ถ้า CSV เดิมไม่ได้ใช้รูปแบบนั้น
- เริ่มคำตอบด้วยโพสต์จริงทันที

กลุ่มลูกค้า/บริบทที่จับได้:
${params.audienceInsights.map(item => `- ${item}`).join('\n') || '- ยึดจากตัวอย่างโพสต์ใน CSV เป็นหลัก'}

สำนวน/น้ำเสียง:
${params.toneGuidelines.map(item => `- ${item}`).join('\n') || '- เลียนแบบสำนวนจากตัวอย่างโพสต์ด้านล่าง'}

โครงสร้างโพสต์:
${params.structureRules.map(item => `- ${item}`).join('\n') || '- เลียนแบบความยาว จำนวนบรรทัด และลำดับข้อมูลจากตัวอย่างโพสต์ด้านล่าง'}

สิ่งที่ต้องดูจากรูป:
${params.productSignals.map(item => `- ${item}`).join('\n') || '- ดูชนิดสินค้า จุดเด่น สี ทรง วัสดุ ขนาดโดยประมาณ และข้อความที่เห็นในภาพเท่านั้น'}

ข้อห้ามเฉพาะ:
${params.negativeRules.map(item => `- ${item}`).join('\n') || '- ห้ามแต่งข้อมูลที่ไม่มีในภาพ'}

ตัวอย่างโพสต์จริงจาก CSV ที่ต้องเลียนแบบ:
${params.captionExamples.slice(0, 10).map((item, index) => `--- ตัวอย่าง ${index + 1} ---\n${item}`).join('\n\n') || 'ไม่มีตัวอย่างที่อ่านได้ ให้ยึดกฎด้านบนแทน'}

งานของคุณ:
อ่านรูปและชื่อไฟล์ แล้วเขียนโพสต์ใหม่ 1 โพสต์ให้เข้ากับรูปนั้น โดยรักษา pattern จากตัวอย่าง CSV ให้มากที่สุด`;
}

function readLocalApiProfiles(): ApiProfile[] {
  try {
    const profiles = JSON.parse(localStorage.getItem('api_global_profiles') || '[]');
    return Array.isArray(profiles) ? profiles : [];
  } catch {
    return [];
  }
}

function mergeApiProfiles(...profileGroups: ApiProfile[][]): ApiProfile[] {
  const profileMap = new Map<string, ApiProfile>();
  profileGroups.flat().forEach(profile => {
    if (!profile) return;
    const key = String(profile.id || profile.name || Date.now());
    profileMap.set(key, { ...profileMap.get(key), ...profile, id: profile.id || key });
  });
  return Array.from(profileMap.values());
}

function cleanAiPostPreamble(text: string) {
  let output = String(text || '').trim();
  const blockedLinePatterns = [
    /^แน่นอน[^\n]*(?:\n|$)/i,
    /^ได้เลย[^\n]*(?:\n|$)/i,
    /^ในฐานะ[^\n]*(?:\n|$)/i,
    /^(?:ผม|ฉัน|ดิฉัน)คือ[^\n]*(?:\n|$)/i,
    /^นี่คือ(?:แคปชั่น|โพสต์|บทความ)?[^\n]*(?:\n|$)/i,
    /^แคปชั่นสำหรับภาพนี้[^\n]*(?:\n|$)/i,
  ];
  let changed = true;
  while (changed) {
    changed = false;
    const before = output;
    for (const pattern of blockedLinePatterns) {
      output = output.replace(pattern, '').trimStart();
    }
    changed = before !== output;
  }
  return output.trim();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('โหลดรูปไม่สำเร็จ'));
    img.src = src;
  });
}

function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const paragraphs = String(text || '').split('\n');
  const lines: string[] = [];
  paragraphs.forEach(paragraph => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      return;
    }
    let line = '';
    words.forEach(word => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
  });
  return lines;
}

function getTopics(input: string): string[] {
  return input
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function createImagePrompt(page: PageConfig, topic: string) {
  const creditLine = page.image_credit
    ? `Footer: Include the text "${page.image_credit}" at the bottom.`
    : 'No Watermarks/Credits: DO NOT include any footer, credits, or watermark.';

  return `Act as a professional AI Image Prompt Engineer.
Your task is to write a detailed English prompt to generate a high-quality infographic image (1080x1080).

Input Data:
Content Source: "${topic}"

Instructions for the Prompt you will write:

Analyze and Apply the Visual Scene: The core visual aesthetic MUST strictly follow this description: "${page.image_theme}" Do not deviate from this primary visual.

Public Figure / Real Person Safety:
If the Content Source mentions a real person, celebrity, musician, actor, politician, historical figure, or living/deceased public figure, DO NOT request their face, exact likeness, portrait, body, costume replica, signature pose, or photorealistic depiction.
Instead, create a symbolic biographical infographic using safe, non-identifying objects, abstract timeline elements, empty stage lighting, microphone, records, music notes, books, documents, silhouettes with no facial details, archival textures, and mood-based storytelling. The image must not resemble any real person.

Text Generation & Layout (Crucial):
Main Text: Summarize the Content Source into one single, powerful sentence or quote in the THAI LANGUAGE (max 15 words) that captures its essence.
${creditLine}
Font Style: Specify "${page.image_font}" for the text.

Composition:
The text should be placed in a negative space or on a subtle, elegant semi-transparent overlay so it is easy to read against the background.

Output format:
Return ONLY the final image generation prompt text in English. Do not include introductory or concluding remarks.`;
}

function createPolicySafeImagePrompt(page: PageConfig, topic: string) {
  const creditLine = page.image_credit
    ? `Footer: Include the text "${page.image_credit}" at the bottom.`
    : 'No footer, credits, watermark, brand logo, or copyrighted mark.';

  return `Create a safe, non-identifying 1080x1080 Thai infographic about this topic: "${topic}".

Strict safety requirements:
- Do NOT depict any real person, celebrity, public figure, or recognizable likeness.
- Do NOT show faces, portrait resemblance, exact costumes, signature poses, stage persona, or branded/copyrighted elements.
- Use symbolic objects only: empty spotlight stage, vintage microphone, music notes, vinyl record, timeline cards, newspaper clippings without readable real logos, abstract silhouette from behind with no facial features.
- Make it a biographical storytelling infographic, not a portrait.
- Visual style should loosely match: "${page.image_theme}", but prioritize safety and non-identifiability.
- Add one short Thai headline, maximum 15 words, summarizing the topic.
- Font style: "${page.image_font}".
- ${creditLine}

Return only the final image prompt in English.`;
}

function isPolicyFailure(message: string) {
  return /policy|policies|violate|violat|content|safety|not allowed|ไม่อนุญาต/i.test(message);
}

function createPostPrompt(page: PageConfig, topic: string) {
  return `เขียนโพสสั้นๆ ${page.post_persona} ความยาวไม่เกิน ${page.post_length} เป็นภาษาง่ายๆที่อ่านเข้าใจ อธิบายเรื่องนี้ ${topic}
${page.post_hook}
ส่งมาแต่คำตอบที่เป็นบทความโพสเท่านั้น`;
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: Record<string, unknown>[]) {
  const headers = [
    'created_at', 'status', 'page_name', 'topic', 'mode', 'image_provider', 'image_model',
    'aspect_ratio', 'resolution', 'post_model', 'sheet_name', 'document_id',
    'dropbox_path', 'local_save_dir', 'local_image_path', 'kie_task_id', 'kie_image_url',
    'dropbox_direct_url', 'post_text', 'image_prompt', 'post_prompt', 'error',
    'kie_request_json',
  ];
  return [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(',')),
  ].join('\n');
}

function cleanClickbaitText(text: string) {
  return text
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
}

function createFallbackClickbaitPost(topic: string): Omit<ClickbaitPostItem, 'id' | 'createdAt'> {
  const cleanTopic = topic.trim();
  const shortTopic = cleanTopic.replace(/[.!?。]+$/g, '');
  const promptLines = [
    `1. วิเคราะห์ "${shortTopic}" แบบคนไม่มีพื้นฐาน แล้วสรุปเป็นขั้นตอนที่ทำตามได้ภายใน 15 นาที`,
    `2. ทำ checklist ก่อนเริ่มใช้ "${shortTopic}" ว่าต้องเตรียมข้อมูลอะไรบ้าง และอะไรที่ไม่ควรทำ`,
    `3. เขียน prompt ให้ AI ช่วยวางแผน "${shortTopic}" พร้อมตัวอย่าง output ที่ควรได้`,
    `4. แปลง "${shortTopic}" เป็นแผนงาน 7 วัน โดยแบ่งงานรายวันให้ชัดเจนและวัดผลได้`,
    `5. ช่วยหาจุดพลาดที่คนส่วนใหญ่มักมองข้ามเวลาใช้ "${shortTopic}" พร้อมวิธีแก้แบบง่ายๆ`,
  ];
  const secondLines = [
    `6. สร้าง template สำหรับนำ "${shortTopic}" ไปใช้กับงานจริงของฉัน โดยเว้นช่อง [ข้อมูลของฉัน] ให้เติมเอง`,
    `7. เปรียบเทียบวิธีทำ "${shortTopic}" แบบเร็ว vs แบบละเอียด และบอกว่าแบบไหนเหมาะกับสถานการณ์ไหน`,
    `8. ช่วยตั้งคำถาม 10 ข้อเพื่อหาโอกาสใหม่ๆ จาก "${shortTopic}"`,
    `9. สรุป "${shortTopic}" เป็น framework 3 ขั้น: เริ่มต้น / ลงมือ / ปรับปรุง`,
    `10. ทำ prompt สำหรับตรวจคุณภาพผลลัพธ์ของ "${shortTopic}" และให้คะแนนพร้อมคำแนะนำ`,
  ];
  const thirdLines = [
    `11. เอา "${shortTopic}" ไปสร้างไอเดียคอนเทนต์ 30 วัน แยกเป็น Hook / เนื้อหา / CTA`,
    `12. เขียน prompt ให้ AI ทำหน้าที่เป็นที่ปรึกษาเรื่อง "${shortTopic}" และถามกลับก่อนตอบทุกครั้งที่ข้อมูลไม่พอ`,
    `13. สร้าง SOP ใช้งาน "${shortTopic}" สำหรับทีมเล็ก พร้อมบทบาทและขั้นตอนส่งมอบงาน`,
    `14. ทำเวอร์ชันง่ายสุดของ "${shortTopic}" สำหรับมือใหม่ที่มีเวลาแค่วันละ 20 นาที`,
    `15. ช่วยปรับ "${shortTopic}" ให้เหมาะกับธุรกิจ/เพจ/งานของฉัน โดยถามข้อมูลเพิ่ม 5 ข้อก่อน`,
  ];

  return {
    topic: cleanTopic,
    headline: `แจก Prompt ลับ! เปลี่ยน "${shortTopic}" ให้กลายเป็นระบบทำงานที่ใช้ได้จริง (มีต่อ👇)`,
    postText: `ใครกำลังสนใจเรื่อง "${shortTopic}" เก็บโพสต์นี้ไว้ได้เลย\n\nผมรวมชุด Prompt ที่เอาไปคุยกับ AI แล้วต่อยอดเป็นแผน งาน หรือคอนเทนต์ได้ทันที\n\nเริ่มจาก 5 ข้อนี้ก่อน แล้วที่เหลืออยู่ใต้คอมเมนต์ 👇`,
    comments: [
      `1/3\n${promptLines.join('\n')}\n\nต่อใน 2/3 👇`,
      `2/3\n${secondLines.join('\n')}\n\nต่อใน 3/3 👇`,
      `3/3\n${thirdLines.join('\n')}\n\nเซฟไว้ แล้วลองแทนคำว่า "${shortTopic}" ด้วยโจทย์จริงของคุณ`,
    ],
    status: 'done',
  };
}

function normalizeClickbaitPayload(topic: string, rawText: string): Omit<ClickbaitPostItem, 'id' | 'createdAt'> {
  const fallback = createFallbackClickbaitPost(topic);
  const parsed = extractJsonPayload<any>(rawText, null);
  const source = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!source || typeof source !== 'object') return fallback;
  const comments = Array.isArray(source.comments)
    ? source.comments
    : [source.comment_1, source.comment_2, source.comment_3];
  return {
    topic,
    headline: cleanClickbaitText(String(source.headline || fallback.headline)),
    postText: cleanClickbaitText(String(source.postText || source.post_text || fallback.postText)),
    comments: [
      cleanClickbaitText(String(comments[0] || fallback.comments[0])),
      cleanClickbaitText(String(comments[1] || fallback.comments[1])),
      cleanClickbaitText(String(comments[2] || fallback.comments[2])),
    ],
    status: 'done',
  };
}

function createClickbaitPrompt(topic: string) {
  return `คุณคือคนเขียนโพสต์เพจไทยสไตล์แจก Prompt/แจกวิธีทำ แบบหัวข้อ clickbait พอดีๆ ไม่หลอกลวง
ให้สร้างโพสต์ Facebook สำหรับหัวข้อ: "${topic}"

Pattern ที่ต้องเลียนแบบจากตัวอย่าง CSV:
- หัวข้อหลักต้องชวนคลิก มีคำแนว แจก Prompt, ขุมทรัพย์, เซฟไว้, เอาไปใช้ได้ทันที, มีต่อ👇
- โพสต์หลักสั้น ชวนให้อ่านต่อในคอมเมนต์
- ใต้คอมเมนต์ต้องมี 3 ตอนเท่านั้น โดยขึ้นต้นด้วย 1/3, 2/3, 3/3
- แต่ละคอมเมนต์ควรมีรายการ Prompt/วิธีทำ 4-6 ข้อ ใช้เลขลำดับต่อเนื่อง
- ภาษาไทยอ่านง่าย ใช้ได้จริง ไม่ต้องมี markdown, ไม่ต้องใส่คำอธิบายงาน

ส่งกลับเป็น JSON เท่านั้น:
{
  "headline": "...",
  "postText": "...",
  "comments": ["1/3...", "2/3...", "3/3..."]
}`;
}

function createCsvClickbaitPrompt(article: string, sourceUrl?: string) {
  const trimmed = article.slice(0, 6000);
  const urlNote = sourceUrl ? `\n\nLink ที่มาของเนื้อหา: ${sourceUrl} — ให้ใส่ไว้ท้ายคอมเมนต์ 3/3 ด้วย` : '';
  return `คุณคือคนเขียนโพสต์เพจไทยที่เก่งมากในการสรุปบทความให้น่าสนใจ

อ่านเนื้อหาบทความนี้:
"""
${trimmed}
"""${urlNote}

งานของคุณ:
1. เขียน "headline" — โพสต์หลักแบบ clickbait สั้นๆ (1-3 บรรทัด) ที่ชวนคลิกมาก ต้องมี "(มีต่อ👇)" ต่อท้าย
   ตัวอย่าง pattern:
   - เพิ่มประสิทธิภาพการทำธุรกิจด้วย 100 Prompt! วิเคราะห์ธุรกิจ/วางแผนการตลาด/บริหารทีม/จัดการการเงิน (มีต่อ👇)
   - เคยสงสัยไหมว่าทำไมบางคนถึงบริหารธุรกิจได้อย่างเป็นเลิศ? เพราะพวกเขารู้จักใช้ Prompt ที่ทรงพลัง! (มีต่อ👇)
   - ทำไมบางแบรนด์ถึงสร้าง Viral Campaign ได้บ่อยจัง? รวม 120 Prompts ลับสำหรับวิเคราะห์เทรนด์ (มีต่อ👇)
   สำคัญ: ห้ามพูดว่าแจก Prompt ถ้าเนื้อหาไม่ได้แจก ให้ปรับให้ตรงกับเนื้อหาจริง

2. เขียน "postText" — ข้อความสั้น 2-4 บรรทัดชวนให้อ่านต่อในคอมเมนต์

3. เขียน "comments" — 3 คอมเมนต์ เป็นการสรุปเนื้อหาบทความแบ่งเป็น 3 ส่วน:
   - คอมเมนต์แรกขึ้นต้นด้วย "1/3" แล้วสรุปส่วนแรก
   - คอมเมนต์สองขึ้นต้นด้วย "2/3" แล้วสรุปส่วนกลาง
   - คอมเมนต์สามขึ้นต้นด้วย "3/3" แล้วสรุปส่วนท้าย${sourceUrl ? ' พร้อมใส่ link ที่มาตอนท้าย' : ''}
   แต่ละคอมเมนต์ควรมี 4-8 ข้อ/bullet ใช้ emoji ประกอบได้

ภาษาไทยอ่านง่าย ไม่ต้องมี markdown

ส่งกลับเป็น JSON เท่านั้น:
{
  "headline": "...",
  "postText": "...",
  "comments": ["1/3...", "2/3...", "3/3..."]
}`;
}

function createPayload(
  page: PageConfig,
  topics: string[],
  mode: StockMode,
  settings: OutputSettings,
) {
  return topics.map((topic, index) => ({
    created_at: new Date().toISOString(),
    row_number: index + 1,
    page_name: page.name,
    sheet_name: page.sheet_name,
    document_id: page.document_id,
    filter_column: page.filter_column,
    dropbox_path: settings.dropboxFolderPath || page.dropbox_path,
    local_save_dir: settings.localSaveDir,
    topic,
    mode,
    image_provider: settings.imageProvider,
    image_model: 'gpt-image-2-text-to-image',
    aspect_ratio: settings.aspectRatio,
    resolution: settings.resolution,
    post_model: settings.openRouterModel,
    image_prompt: mode !== 'post-only' ? createImagePrompt(page, topic) : '',
    post_prompt: mode !== 'image-only' ? createPostPrompt(page, topic) : '',
    kie_request_json: mode !== 'post-only'
      ? JSON.stringify({
        model: 'gpt-image-2-text-to-image',
        input: {
          prompt: createImagePrompt(page, topic),
          aspect_ratio: settings.aspectRatio,
          resolution: settings.resolution,
        },
      })
      : '',
    openrouter_request_json: mode !== 'image-only'
      ? JSON.stringify({
        model: settings.openRouterModel,
        messages: [{ role: 'user', content: createPostPrompt(page, topic) }],
      })
      : '',
    dropbox_direct_url: '',
  }));
}

function safeFilePart(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\n\r]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'topic';
}

function extractKieImageUrl(taskData: any): string {
  const rawResultJson = taskData?.resultJson || taskData?.result;
  if (typeof rawResultJson === 'string' && rawResultJson.startsWith('http')) return rawResultJson;

  let resultObj: any = rawResultJson;
  if (typeof rawResultJson === 'string') {
    try { resultObj = JSON.parse(rawResultJson); } catch { resultObj = null; }
  }

  const findUrl = (obj: any): string => {
    if (!obj) return '';
    if (typeof obj === 'string' && obj.startsWith('http')) return obj;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = findUrl(item);
        if (found) return found;
      }
      return '';
    }
    if (typeof obj === 'object') {
      for (const key of ['resultUrls', 'images', 'output', 'data']) {
        const found = findUrl(obj[key]);
        if (found) return found;
      }
      for (const key of ['url', 'uri', 'image_url', 'imageUrl', 'output_url']) {
        if (typeof obj[key] === 'string' && obj[key].startsWith('http')) return obj[key];
      }
      for (const value of Object.values(obj)) {
        const found = findUrl(value);
        if (found) return found;
      }
    }
    return '';
  };

  return findUrl(resultObj);
}

export function PageStockTab() {
  const [builderTab, setBuilderTab] = useState<PageStockBuilderTab>('api');
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [selectedPageName, setSelectedPageName] = useState(PAGE_CONFIGS[0]?.name ?? '');
  const [search, setSearch] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [mode, setMode] = useState<StockMode>('image-and-post');
  const [queue, setQueue] = useState<QueueBatch[]>([]);
  const [copied, setCopied] = useState(false);
  const [csvCopied, setCsvCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [completedResults, setCompletedResults] = useState<PageStockResult[]>([]);
  const [manualCsvName, setManualCsvName] = useState('');
  const [manualCsvText, setManualCsvText] = useState('');
  const [manualTrendCsvName, setManualTrendCsvName] = useState('');
  const [manualTrendCsvText, setManualTrendCsvText] = useState('');
  const [manualBrainKey, setManualBrainKey] = useState('');
  const [manualBrains, setManualBrains] = useState<Record<string, ManualPromptBrain>>({});
  const [manualFeedback, setManualFeedback] = useState('');
  const [manualTopicCount, setManualTopicCount] = useState('10');
  const [manualTopicsText, setManualTopicsText] = useState('');
  const [manualTopics, setManualTopics] = useState<string[]>([]);
  const [manualPromptResults, setManualPromptResults] = useState<ManualPromptResult[]>([]);
  const [manualPromptsCopied, setManualPromptsCopied] = useState(false);
  const [manualTaskId, setManualTaskId] = useState('');
  const [manualPaused, setManualPaused] = useState(false);
  const [manualBrainEditingField, setManualBrainEditingField] = useState<ManualBrainEditableField | ''>('');
  const [manualBrainDraft, setManualBrainDraft] = useState('');
  const manualPausedRef = useRef(false);
  const lastOpenRouterKeyLabelRef = useRef('');
  const [localImagePrompt, setLocalImagePrompt] = useState(() => localStorage.getItem(LOCAL_IMAGE_PROMPT_KEY) || DEFAULT_LOCAL_IMAGE_ARTICLE_PROMPT);
  const [localImageDropboxPath, setLocalImageDropboxPath] = useState(() => localStorage.getItem(LOCAL_IMAGE_DROPBOX_PATH_KEY) || '');
  const [localImageModel, setLocalImageModel] = useState(() => localStorage.getItem(LOCAL_IMAGE_ARTICLE_MODEL_KEY) || 'google/gemini-2.5-flash-lite');
  const [manualBrainModel, setManualBrainModel] = useState(() => localStorage.getItem(MANUAL_BRAIN_MODEL_KEY) || 'google/gemini-2.5-pro');
  const [manualTopicModel, setManualTopicModel] = useState(() => localStorage.getItem(MANUAL_TOPIC_MODEL_KEY) || 'google/gemini-2.5-flash');
  const [manualPromptModel, setManualPromptModel] = useState(() => localStorage.getItem(MANUAL_PROMPT_MODEL_KEY) || 'google/gemini-2.5-flash');
  const [localImageItems, setLocalImageItems] = useState<LocalImageArticleItem[]>([]);
  const [localImageBrains, setLocalImageBrains] = useState<Record<string, LocalImageArticleBrain>>({});
  const [localImageBrainKey, setLocalImageBrainKey] = useState('');
  const [localImageBrainCsvName, setLocalImageBrainCsvName] = useState('');
  const [localImageBrainCsvText, setLocalImageBrainCsvText] = useState('');
  const [localImageBrainFeedback, setLocalImageBrainFeedback] = useState('');
  const [localImageRunning, setLocalImageRunning] = useState(false);
  const [localImageScanning, setLocalImageScanning] = useState(false);
  const [localImageBrainAnalyzing, setLocalImageBrainAnalyzing] = useState(false);
  const [localImageCopied, setLocalImageCopied] = useState(false);
  const localImageStopRef = useRef(false);
  const [canvasImages, setCanvasImages] = useState<StockCanvasImage[]>([]);
  const [canvasSelectedImageId, setCanvasSelectedImageId] = useState('');
  const [canvasText, setCanvasText] = useState('คำเตือน การลงทุนมีความเสี่ยง');
  const [canvasTextX, setCanvasTextX] = useState(50);
  const [canvasTextY, setCanvasTextY] = useState(90);
  const [canvasTextSize, setCanvasTextSize] = useState(4.2);
  const [canvasTextColor, setCanvasTextColor] = useState('#ffffff');
  const [canvasAccentColor, setCanvasAccentColor] = useState('#f59e0b');
  const [canvasTextEffect, setCanvasTextEffect] = useState<'shadow' | 'outline' | 'bar' | 'badge' | 'none'>('bar');
  const [canvasActiveLayer, setCanvasActiveLayer] = useState<'text' | 'logo'>('text');
  const [canvasLogoDataUrl, setCanvasLogoDataUrl] = useState('');
  const [canvasLogoX, setCanvasLogoX] = useState(88);
  const [canvasLogoY, setCanvasLogoY] = useState(10);
  const [canvasLogoSize, setCanvasLogoSize] = useState(12);
  const canvasPreviewRef = useRef<HTMLCanvasElement>(null);
  const [clickbaitInput, setClickbaitInput] = useState(() => localStorage.getItem(CLICKBAIT_INPUT_KEY) || '');
  const [clickbaitPosts, setClickbaitPosts] = useState<ClickbaitPostItem[]>(() => {
    try {
      const data = JSON.parse(localStorage.getItem(CLICKBAIT_POSTS_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  });
  const [clickbaitRunning, setClickbaitRunning] = useState(false);
  const [clickbaitCopied, setClickbaitCopied] = useState(false);

  // CSV Clickbait states
  const [csvCbFile, setCsvCbFile] = useState('');
  const [csvCbFileName, setCsvCbFileName] = useState('');
  const [csvCbRows, setCsvCbRows] = useState<{id: string; title: string; content: string; sourceUrl: string}[]>([]);
  const [csvCbResults, setCsvCbResults] = useState<ClickbaitPostItem[]>([]);
  const [csvCbRunning, setCsvCbRunning] = useState(false);
  const [csvCbProgress, setCsvCbProgress] = useState('');
  const [csvCbCopied, setCsvCbCopied] = useState(false);
  const [csvCbPasteMode, setCsvCbPasteMode] = useState(false);
  const [settings, setSettings] = useState<OutputSettings>(() => {
    try {
      return { ...DEFAULT_OUTPUT_SETTINGS, ...JSON.parse(localStorage.getItem(OUTPUT_SETTINGS_KEY) || '{}') };
    } catch {
      return DEFAULT_OUTPUT_SETTINGS;
    }
  });

  const selectedPage = useMemo(
    () => PAGE_CONFIGS.find(page => page.name === selectedPageName) ?? PAGE_CONFIGS[0],
    [selectedPageName],
  );
  const activeProfile = useMemo(
    () => profiles.find(profile => profile.id === settings.profileId) ?? profiles[0],
    [profiles, settings.profileId],
  );
  const topics = useMemo(() => getTopics(topicInput), [topicInput]);
  const filteredPages = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return PAGE_CONFIGS;
    return PAGE_CONFIGS.filter(page =>
      [page.name, page.sheet_name, page.post_persona, page.post_length]
        .some(value => String(value).toLowerCase().includes(keyword)),
    );
  }, [search]);

  const payload = selectedPage ? createPayload(selectedPage, topics, mode, settings) : [];
  const csvRows = completedResults.length > 0 ? completedResults : payload;
  const csvPayload = useMemo(() => toCsv(csvRows as Record<string, unknown>[]), [csvRows]);
  const previewTopic = topics[0] || 'ตัวอย่างหัวข้อ Content';
  const previewImagePrompt = selectedPage ? createImagePrompt(selectedPage, previewTopic) : '';
  const previewPostPrompt = selectedPage ? createPostPrompt(selectedPage, previewTopic) : '';
  const previewKieRequest = selectedPage ? {
    model: 'gpt-image-2-text-to-image',
    input: {
      prompt: previewImagePrompt,
      aspect_ratio: settings.aspectRatio,
      resolution: settings.resolution,
    },
  } : {};
  const totalQueuedTopics = queue.reduce((sum, batch) => sum + batch.topics.length, 0);
  const hasKieKey = Boolean(activeProfile?.kieKey);
  const hasDropboxAuth = Boolean(activeProfile?.dropboxKey || activeProfile?.dropboxRefreshToken);
  const runnableCount = totalQueuedTopics || topics.length;
  const manualBrain = manualBrainKey && manualBrains[manualBrainKey]
    ? normalizeManualBrain(manualBrains[manualBrainKey], manualBrainKey)
    : undefined;
  const manualHasRunningTask = Boolean(manualTaskId);
  const manualTrendRowsCount = useMemo(
    () => manualTrendCsvText.trim() ? parseCsvTable(manualTrendCsvText).length : 0,
    [manualTrendCsvText],
  );
  const manualPromptCsv = useMemo(() => {
    const rows = manualPromptResults.map(result => ({
      'หัวข้อ': result.topic,
      'Prompt สร้างรูป': result.imagePrompt,
    }));
    return [
      'หัวข้อ,Prompt สร้างรูป',
      ...rows.map(row => [csvEscape(row['หัวข้อ']), csvEscape(row['Prompt สร้างรูป'])].join(',')),
    ].join('\n');
  }, [manualPromptResults]);
  const editableManualTopics = useMemo(() => getTopics(manualTopicsText), [manualTopicsText]);
  const manualPromptCopyText = useMemo(
    () => manualPromptResults.map(result => result.imagePrompt).join('\n\n'),
    [manualPromptResults],
  );
  const localImageSelectedCount = useMemo(
    () => localImageItems.filter(item => item.selected).length,
    [localImageItems],
  );
  const localImageDoneCount = useMemo(
    () => localImageItems.filter(item => item.status === 'done').length,
    [localImageItems],
  );
  const localImageCopyText = useMemo(
    () => localImageItems
      .filter(item => item.status === 'done' && item.article.trim())
      .map(item => `${item.fileName}\n${item.article}`)
      .join('\n\n'),
    [localImageItems],
  );
  const localImageBrain = useMemo(
    () => localImageBrainKey && localImageBrains[localImageBrainKey]
      ? normalizeArticleBrain(localImageBrains[localImageBrainKey], localImageBrainKey)
      : undefined,
    [localImageBrainKey, localImageBrains],
  );
  const localImageBrainRowsCount = useMemo(
    () => localImageBrainCsvText.trim() ? parseCsvTable(localImageBrainCsvText).length : 0,
    [localImageBrainCsvText],
  );
  const selectedCanvasImage = useMemo(
    () => canvasImages.find(image => image.id === canvasSelectedImageId) || canvasImages[0],
    [canvasImages, canvasSelectedImageId],
  );
  const canvasSelectedCount = useMemo(
    () => canvasImages.filter(image => image.selected).length,
    [canvasImages],
  );

  const openRouterKey = getActiveOpenRouterKey();
  const hasOpenRouterKey = Boolean(openRouterKey);

  const loadProfiles = () => {
    return fetch('/api/get-app-data?key=api_profiles')
      .then(res => res.json())
      .then((serverProfiles: ApiProfile[]) => {
        const loaded = mergeApiProfiles(
          Array.isArray(serverProfiles) ? serverProfiles : [],
          readLocalApiProfiles(),
        );
        setProfiles(loaded);
        const activeId = localStorage.getItem('api_global_active_id') || loaded[0]?.id || '';
        setSettings(prev => ({ ...prev, profileId: prev.profileId || activeId }));
      })
      .catch(() => {
        const loaded = readLocalApiProfiles();
        setProfiles(loaded);
        setSettings(prev => ({ ...prev, profileId: prev.profileId || localStorage.getItem('api_global_active_id') || loaded[0]?.id || '' }));
      });
  };

  useEffect(() => {
    loadProfiles();
    const handleProfilesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ profiles?: ApiProfile[]; activeProfileId?: string }>).detail;
      if (Array.isArray(detail?.profiles)) {
        setProfiles(detail.profiles);
        if (detail.activeProfileId) setSettings(prev => ({ ...prev, profileId: detail.activeProfileId || prev.profileId }));
      } else {
        loadProfiles();
      }
    };
    window.addEventListener('api-profiles-updated', handleProfilesUpdated);
    return () => window.removeEventListener('api-profiles-updated', handleProfilesUpdated);
  }, []);

  useEffect(() => {
    fetch('/api/get-app-data?key=page_stock_results')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCompletedResults(data);
      })
      .catch(() => {
        try {
          const data = JSON.parse(localStorage.getItem('page_stock_results') || '[]');
          if (Array.isArray(data)) setCompletedResults(data);
        } catch {}
      });
  }, []);

  useEffect(() => {
    const normalizeBrainMap = (data: unknown): Record<string, ManualPromptBrain> | null => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
      const raw = 'brains' in data ? (data as { brains?: unknown }).brains : data;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const normalized = Object.fromEntries(
        Object.entries(raw).map(([key, brain]) => [key, normalizeManualBrain(brain as Partial<ManualPromptBrain>, key)]),
      ) as Record<string, ManualPromptBrain>;
      return Object.keys(normalized).length > 0 ? normalized : null;
    };

    const readLocalBrainMap = (key: string) => {
      try {
        return normalizeBrainMap(JSON.parse(localStorage.getItem(key) || '{}'));
      } catch {
        return null;
      }
    };

    const loadBrainMap = async () => {
      const sources = [
        async () => normalizeBrainMap(await fetch(`/api/get-app-data?key=${MANUAL_PROMPT_BRAINS_KEY}`).then(res => res.json())),
        async () => normalizeBrainMap(await fetch(`/api/get-app-data?key=${MANUAL_PROMPT_BRAINS_BACKUP_KEY}`).then(res => res.json())),
        async () => readLocalBrainMap(MANUAL_PROMPT_BRAINS_KEY),
        async () => readLocalBrainMap(MANUAL_PROMPT_BRAINS_BACKUP_KEY),
      ];

      for (const source of sources) {
        try {
          const normalized = await source();
          if (normalized) {
            setManualBrains(normalized);
            setManualBrainKey(prev => prev || Object.keys(normalized)[0] || '');
            return;
          }
        } catch {}
      }
    };

    loadBrainMap();
  }, []);

  useEffect(() => {
    fetch(`/api/get-app-data?key=${LOCAL_IMAGE_ARTICLE_BRAINS_KEY}`)
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          const normalized = Object.fromEntries(
            Object.entries(data).map(([key, brain]) => [key, normalizeArticleBrain(brain as Partial<LocalImageArticleBrain>, key)]),
          );
          setLocalImageBrains(normalized);
          const firstKey = Object.keys(normalized)[0] || '';
          setLocalImageBrainKey(prev => prev || firstKey);
          if (firstKey && !localStorage.getItem(LOCAL_IMAGE_PROMPT_KEY)) {
            setLocalImagePrompt((normalized as Record<string, LocalImageArticleBrain>)[firstKey].writingPrompt);
          }
        }
      })
      .catch(() => {
        try {
          const data = JSON.parse(localStorage.getItem(LOCAL_IMAGE_ARTICLE_BRAINS_KEY) || '{}');
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            const normalized = Object.fromEntries(
              Object.entries(data).map(([key, brain]) => [key, normalizeArticleBrain(brain as Partial<LocalImageArticleBrain>, key)]),
            );
            setLocalImageBrains(normalized);
            const firstKey = Object.keys(normalized)[0] || '';
            setLocalImageBrainKey(prev => prev || firstKey);
          }
        } catch {}
      });
  }, []);

  useEffect(() => {
    localStorage.setItem(OUTPUT_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(LOCAL_IMAGE_PROMPT_KEY, localImagePrompt);
  }, [localImagePrompt]);

  useEffect(() => {
    localStorage.setItem(LOCAL_IMAGE_DROPBOX_PATH_KEY, localImageDropboxPath);
  }, [localImageDropboxPath]);

  useEffect(() => {
    localStorage.setItem(LOCAL_IMAGE_ARTICLE_MODEL_KEY, localImageModel);
  }, [localImageModel]);

  useEffect(() => {
    localStorage.setItem(MANUAL_BRAIN_MODEL_KEY, manualBrainModel);
  }, [manualBrainModel]);

  useEffect(() => {
    localStorage.setItem(MANUAL_TOPIC_MODEL_KEY, manualTopicModel);
  }, [manualTopicModel]);

  useEffect(() => {
    localStorage.setItem(MANUAL_PROMPT_MODEL_KEY, manualPromptModel);
  }, [manualPromptModel]);

  useEffect(() => {
    localStorage.setItem(CLICKBAIT_INPUT_KEY, clickbaitInput);
  }, [clickbaitInput]);

  useEffect(() => {
    localStorage.setItem(CLICKBAIT_POSTS_KEY, JSON.stringify(clickbaitPosts));
  }, [clickbaitPosts]);

  useEffect(() => {
    if (!selectedPage) return;
    setSettings(prev => ({
      ...prev,
      dropboxFolderPath: prev.dropboxFolderPath || selectedPage.dropbox_path,
    }));
    setLocalImageDropboxPath(prev => prev || selectedPage.dropbox_path || settings.dropboxFolderPath || '');
  }, [selectedPage]);

  const updateSettings = (patch: Partial<OutputSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
  };

  const createCurrentBatch = (): QueueBatch | null => {
    if (!selectedPage || topics.length === 0) return null;
    return {
      id: `${Date.now()}-${selectedPage.name}`,
      pageName: selectedPage.name,
      topics,
      mode,
      imageProvider: settings.imageProvider,
      postModel: settings.openRouterModel,
      createdAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const addToQueue = () => {
    const batch = createCurrentBatch();
    if (!batch) return;
    setQueue(prev => [
      batch,
      ...prev,
    ]);
    setTopicInput('');
  };

  const writePost = async (prompt: string) => {
    const apiKey = await getActiveOpenRouterKeyAsync();
    if (!apiKey) throw new Error('ไม่พบ OpenRouter API Key');
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.openRouterModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.75,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error?.message || `OpenRouter error ${res.status}`);
    return data.choices?.[0]?.message?.content?.trim() || '';
  };

  const getAffordableMaxTokens = (message: string) => {
    const match = message.match(/can only afford\s+(\d+)/i);
    if (!match) return 0;
    return Math.max(32, Math.floor(Number(match[1]) * 0.75));
  };

  const explainOpenRouterError = (message: string) => {
    if (message.startsWith('OpenRouter เครดิตไม่พอ') || message.startsWith('OpenRouter prompt ยาวเกิน')) return message;
    if (/prompt tokens limit exceeded/i.test(message)) {
      return `OpenRouter prompt ยาวเกินเพดานของบัญชี/โมเดลตอนนี้: ${message}`;
    }
    if (/more credits|fewer max_tokens|can only afford|credits/i.test(message)) {
      return `OpenRouter เครดิตไม่พอสำหรับรอบนี้ หรือ max_tokens สูงเกินเครดิตที่เหลือ: ${message}`;
    }
    return message;
  };

  const askOpenRouter = async (prompt: string, signal?: AbortSignal, maxTokens = 6000, modelOverride?: string) => {
    const apiKeys = await getOpenRouterKeyCandidates();
    if (apiKeys.length === 0) throw new Error('ไม่พบ OpenRouter API Key');
    const tokenAttempts = Array.from(new Set([
      maxTokens,
      Math.min(maxTokens, 1800),
      Math.min(maxTokens, 1200),
      Math.min(maxTokens, 800),
      Math.min(maxTokens, 400),
      Math.min(maxTokens, 240),
      Math.min(maxTokens, 160),
      Math.min(maxTokens, 96),
      Math.min(maxTokens, 64),
      Math.min(maxTokens, 40),
    ])).filter(tokens => tokens > 0);
    let lastError = '';
    for (const apiKeyInfo of apiKeys) {
      const attemptsForKey = [...tokenAttempts];
      for (let index = 0; index < attemptsForKey.length; index++) {
        const tokens = attemptsForKey[index];
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          signal,
          headers: {
            'Authorization': `Bearer ${apiKeyInfo.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelOverride || settings.openRouterModel || 'google/gemini-2.5-pro',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.72,
            max_tokens: tokens,
          }),
        });
        const data = await res.json();
        if (res.ok && !data.error) {
          lastOpenRouterKeyLabelRef.current = apiKeyInfo.label;
          return data.choices?.[0]?.message?.content?.trim() || '';
        }
        lastError = `${apiKeyInfo.label}: ${data.error?.message || `OpenRouter error ${res.status}`}`;
        const rawError = data.error?.message || `OpenRouter error ${res.status}`;
        const canRetryLowerTokens = /more credits|fewer max_tokens|can only afford|เครดิตไม่พอ/i.test(rawError);
        const affordableTokens = getAffordableMaxTokens(rawError);
        if (canRetryLowerTokens && affordableTokens > 0 && !attemptsForKey.includes(affordableTokens)) {
          attemptsForKey.splice(index + 1, 0, affordableTokens);
        }
        if (!canRetryLowerTokens) break;
      }
    }
    throw new Error(explainOpenRouterError(lastError || 'OpenRouter error'));
  };

  const askOpenRouterDeep = async (
    prompt: string,
    signal?: AbortSignal,
    maxTokens = 1200,
    preferredModel = manualBrainModel,
  ) => {
    const models = Array.from(new Set([
      preferredModel,
      'google/gemini-2.5-flash',
      'google/gemini-2.5-flash-lite',
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash-lite-001',
    ].filter(Boolean)));
    let lastError = '';
    for (const model of models) {
      try {
        const text = await askOpenRouter(prompt, signal, maxTokens, model);
        return {
          model,
          keyLabel: lastOpenRouterKeyLabelRef.current,
          text,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    throw new Error(lastError || 'OpenRouter deep analysis failed');
  };

  const saveManualBrains = async (nextBrains: Record<string, ManualPromptBrain>) => {
    setManualBrains(nextBrains);
    const backupPayload = { updatedAt: new Date().toISOString(), brains: nextBrains };
    localStorage.setItem(MANUAL_PROMPT_BRAINS_KEY, JSON.stringify(nextBrains));
    localStorage.setItem(MANUAL_PROMPT_BRAINS_BACKUP_KEY, JSON.stringify(backupPayload));
    const persist = async (key: string, data: unknown) => {
      const res = await fetch('/api/save-app-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, data }),
      });
      if (!res.ok) throw new Error(`Save ${key} failed`);
    };
    try {
      await persist(MANUAL_PROMPT_BRAINS_KEY, nextBrains);
      await persist(MANUAL_PROMPT_BRAINS_BACKUP_KEY, backupPayload);
    } catch (error) {
      console.warn('Cannot persist manual prompt brain to app_data; localStorage backup remains available.', error);
    }
  };

  const saveLocalImageBrains = async (nextBrains: Record<string, LocalImageArticleBrain>) => {
    setLocalImageBrains(nextBrains);
    localStorage.setItem(LOCAL_IMAGE_ARTICLE_BRAINS_KEY, JSON.stringify(nextBrains));
    await fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: LOCAL_IMAGE_ARTICLE_BRAINS_KEY, data: nextBrains }),
    }).catch(() => undefined);
  };

  const waitIfManualPaused = async (ctx: { isCancelled: () => boolean; log: (message: string) => void }) => {
    let logged = false;
    while (manualPausedRef.current && !ctx.isCancelled()) {
      if (!logged) {
        ctx.log('Pause: หยุดพักงานไว้ชั่วคราว กด Resume เพื่อทำต่อ');
        logged = true;
      }
      await wait(600);
    }
    if (logged && !ctx.isCancelled()) ctx.log('Resume: กลับมาทำงานต่อ');
  };

  const handleManualCsvUpload = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    const brainKey = createManualBrainKey(file.name);
    setManualCsvName(file.name);
    setManualCsvText(text);
    setManualBrainKey(brainKey);
    setManualPromptResults([]);
    setManualTopics([]);
    setManualTopicsText('');
  };

  const handleManualTrendCsvUpload = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    setManualTrendCsvName(file.name);
    setManualTrendCsvText(text);
  };

  const buildManualBrainFromParsed = (params: {
    parsed: any;
    answer: string;
    brainKey: string;
    rows: Record<string, string>[];
    trendRows: Record<string, string>[];
    csvPromptExamples: string[];
  }): ManualPromptBrain => {
    const inferredName = String(params.parsed.pageName || params.brainKey).trim() || params.brainKey;
    return {
      pageName: inferredName,
      updatedAt: new Date().toISOString(),
      sourceFileName: manualCsvName,
      sourceRowCount: params.rows.length,
      trendFileName: manualTrendCsvName || '',
      trendRowCount: params.trendRows.length,
      summary: String(params.parsed.summary || 'AI วิเคราะห์ไฟล์ CSV แล้ว แต่ไม่ได้ส่ง summary เป็น JSON ชัดเจน'),
      keywords: Array.isArray(params.parsed.keywords) ? params.parsed.keywords.map(String) : [],
      contentAngles: Array.isArray(params.parsed.contentAngles) ? params.parsed.contentAngles.map(String) : [],
      toneGuidelines: Array.isArray(params.parsed.toneGuidelines) ? params.parsed.toneGuidelines.map(String) : [],
      topicPatterns: Array.isArray(params.parsed.topicPatterns) ? params.parsed.topicPatterns.map(String) : [],
      promptRules: Array.isArray(params.parsed.promptRules) ? params.parsed.promptRules.map(String) : [],
      visualStyleRules: Array.isArray(params.parsed.visualStyleRules) ? params.parsed.visualStyleRules.map(String) : [],
      negativeRules: Array.isArray(params.parsed.negativeRules) ? params.parsed.negativeRules.map(String) : [],
      trendInsights: Array.isArray(params.parsed.trendInsights) ? params.parsed.trendInsights.map(String) : [],
      examplePrompts: asStringArray(params.parsed.examplePrompts).length > 0
        ? asStringArray(params.parsed.examplePrompts)
        : params.csvPromptExamples,
      feedbackNotes: manualBrain?.feedbackNotes || [],
      rawAnalysis: params.answer,
    };
  };

  const startAnalyzeManualCsv = () => {
    if (!manualCsvText.trim() || !hasOpenRouterKey) return;
    const rows = parseCsvTable(manualCsvText);
    const csvPromptExamples = extractPromptExamplesFromRows(rows);
    const trendRows = manualTrendCsvText.trim() ? parseCsvTable(manualTrendCsvText) : [];
    const brainKey = manualBrainKey || createManualBrainKey(manualCsvName || 'CSV Prompt');
    setManualBrainKey(brainKey);
    const nextTaskId = `manual-brain-${Date.now()}`;
    const taskId = globalTaskStore.enqueueTask({
      id: nextTaskId,
      title: `🧠 แกะสมอง Prompt: ${brainKey}`,
      category: 'page-stock-manual',
      progress: 'เตรียมส่ง CSV Prompt และ CSV เทรนด์ให้ AI สร้างสมอง',
    }, async ctx => {
      setManualTaskId(ctx.signal.aborted ? '' : nextTaskId);
      try {
      ctx.log(`1/6 อ่าน CSV Prompt: ${manualCsvName || 'ไฟล์อัปโหลด'} (${rows.length} แถว)`);
      if (trendRows.length > 0) {
        ctx.log(`2/6 อ่าน CSV เทรนด์ล่าสุด: ${manualTrendCsvName || 'trend.csv'} (${trendRows.length} แถว)`);
      } else {
        ctx.log('2/6 ไม่มี CSV เทรนด์ล่าสุด: สร้างสมองจาก CSV Prompt อย่างเดียว');
      }
      await waitIfManualPaused(ctx);
      const rowChunks = Array.from({ length: Math.ceil(rows.length / 15) }, (_, index) => rows.slice(index * 15, index * 15 + 15));
      const trendChunks = trendRows.length
        ? Array.from({ length: Math.ceil(trendRows.length / 40) }, (_, index) => trendRows.slice(index * 40, index * 40 + 40))
        : [];
      const promptAnalyses: any[] = [];
      const trendAnalyses: any[] = [];
      ctx.log(`3/6 Deep Brain Training: แบ่ง CSV Prompt ${rowChunks.length} ก้อน และ CSV Trend ${trendChunks.length} ก้อน`);
      const currentCandidates = await getOpenRouterKeyCandidates();
      ctx.log(`OpenRouter keys ที่จะลองใช้: ${currentCandidates.map(item => item.label).join(' → ') || 'ไม่พบ key'}`);

      try {
        for (let index = 0; index < rowChunks.length; index++) {
          if (ctx.isCancelled()) break;
          await waitIfManualPaused(ctx);
          const chunkText = JSON.stringify(rowChunks[index], null, 2).slice(0, 12000);
          ctx.log(`อ่าน Prompt CSV ก้อน ${index + 1}/${rowChunks.length}: วิเคราะห์ pattern/prompt/style`);
          const result = await askOpenRouterDeep(`คุณคือ Content Strategist อ่าน CSV Prompt ก้อนย่อยนี้อย่างละเอียด

ชื่อสมอง: ${brainKey}
ก้อน: ${index + 1}/${rowChunks.length}
ข้อมูล JSON rows:
${chunkText}

แยกให้ชัด:
- tools/concepts ที่เป็นแกนจริง ไม่เอา pain point มาเป็น keyword
- topic patterns ที่เห็นจากหัวข้อจริง
- prompt format/rules ที่ต้องรักษา
- visual style/layout/text rules
- tone/style ของเพจ
- negative rules
- example prompts ที่สมบูรณ์ถ้ามี

ตอบ JSON เท่านั้น:
{"keywords":[],"contentAngles":[],"toneGuidelines":[],"topicPatterns":[],"promptRules":[],"visualStyleRules":[],"negativeRules":[],"examplePrompts":[],"notes":"..."}`, ctx.signal, 1100, manualBrainModel);
          const parsedChunk = extractJsonPayload<any>(result.text, {});
          promptAnalyses.push({ model: result.model, keyLabel: result.keyLabel, ...parsedChunk, raw: result.text.slice(0, 3000) });
          ctx.log(`ได้ผลก้อน Prompt ${index + 1}: ${result.model} · ${result.keyLabel || 'OpenRouter key'}`);
        }

        for (let index = 0; index < trendChunks.length; index++) {
          if (ctx.isCancelled()) break;
          await waitIfManualPaused(ctx);
          const chunkText = JSON.stringify(trendChunks[index], null, 2).slice(0, 12000);
          ctx.log(`อ่าน Trend CSV ก้อน ${index + 1}/${trendChunks.length}: หา trend/tool/pain/opportunity`);
          const result = await askOpenRouterDeep(`คุณคือ Trend Analyst อ่าน CSV เทรนด์ก้อนย่อยนี้อย่างละเอียด

ชื่อสมอง: ${brainKey}
ก้อน: ${index + 1}/${trendChunks.length}
ข้อมูล JSON rows:
${chunkText}

แยกให้ชัด:
- trend tools/concepts หลัก
- trend รอง
- audience pain point
- topic opportunities ที่ควรทำ
- อะไรเป็นแค่คำผ่าน/เสียงบ่น ไม่ใช่ keyword หลัก

ตอบ JSON เท่านั้น:
{"trendTools":[],"trendConcepts":[],"audiencePainPoints":[],"topicOpportunities":[],"avoidAsKeywords":[],"notes":"..."}`, ctx.signal, 1000, manualBrainModel);
          const parsedChunk = extractJsonPayload<any>(result.text, {});
          trendAnalyses.push({ model: result.model, keyLabel: result.keyLabel, ...parsedChunk, raw: result.text.slice(0, 3000) });
          ctx.log(`ได้ผลก้อน Trend ${index + 1}: ${result.model} · ${result.keyLabel || 'OpenRouter key'}`);
        }

        ctx.log('4/6 รวมผลทุกก้อน แล้วให้ AI synthesize เป็นสมองฉบับสุดท้าย');
        const synthesisInput = JSON.stringify({ promptAnalyses, trendAnalyses }, null, 2).slice(0, 60000);
        let result: { model: string; keyLabel?: string; text: string } | null = null;
        let parsed: any = {};
        try {
          result = await askOpenRouterDeep(`คุณคือ Senior AI Brain Architect รวมผลวิเคราะห์หลายก้อนให้กลายเป็นสมองเดียวที่ฉลาดและใช้ได้จริง

ชื่อสมอง: ${brainKey}
ผลวิเคราะห์ย่อย:
${synthesisInput}

กฎสำคัญ:
- keyword ต้องเป็น tool/concept/topic seed ที่เอาไปตั้งหัวข้อได้จริง
- pain point ต้องอยู่ใน trendInsights/tone ไม่ใช่ keywords
- แยก trend หลัก/รองออกจาก pattern เก่า
- examplePrompts ต้องเป็น prompt พร้อมใช้ ไม่ใช่ object
- ห้ามมีเศษ JSON field name, คำเดี่ยวไร้ความหมาย, หรือคำบ่นเป็น keyword

ตอบ JSON เท่านั้น:
{
  "pageName": "${brainKey}",
  "summary": "...",
  "keywords": [],
  "contentAngles": [],
  "toneGuidelines": [],
  "topicPatterns": [],
  "promptRules": [],
  "visualStyleRules": [],
  "negativeRules": [],
  "trendInsights": [],
  "examplePrompts": []
}`, ctx.signal, 1800, manualBrainModel);
          parsed = extractJsonPayload<any>(result.text, {});
        } catch (synthesisError) {
          const message = synthesisError instanceof Error ? synthesisError.message : String(synthesisError);
          ctx.log(`AI synthesize รอบสุดท้ายไม่สำเร็จ: ${explainOpenRouterError(message)} · จะรวมผลจากก้อนย่อยเอง`);
        }
        if (!hasUsefulManualBrainPayload(parsed)) {
          ctx.log('ผล synthesize ไม่มี field ใช้งานได้: รวมสมองจาก raw/parsed ของก้อนย่อยแทน');
          parsed = synthesizeManualBrainPayloadFromDeepAnalyses({
            brainKey,
            promptAnalyses,
            trendAnalyses,
            csvPromptExamples,
          });
        }
        const answer = JSON.stringify({ model: result?.model || 'local-deep-synthesis', promptAnalyses, trendAnalyses, synthesis: parsed }, null, 2);
        const brain = buildManualBrainFromParsed({ parsed, answer, brainKey, rows, trendRows, csvPromptExamples });
        ctx.log(`4.5/6 สร้างสมองด้วย Deep Training สำเร็จ: ${result?.model || 'local-deep-synthesis'} · ${result?.keyLabel || 'รวมจากก้อนย่อย'}`);
        ctx.log(`Keyword: ${brain.keywords.slice(0, 12).join(', ') || 'ไม่มี'}`);
        ctx.log(`Trend: ${brain.trendInsights.slice(0, 6).join(' | ') || 'ไม่มี'}`);
        ctx.log('5/6 บันทึกสมองเพจลง app_data และ localStorage');
        await saveManualBrains({ ...manualBrains, [brainKey]: brain });
        ctx.log('6/6 สมองเพจพร้อมใช้: ผ่านการอ่านเป็นก้อนและ synthesize แล้ว');
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.log(`Deep Training ใช้ AI ไม่สำเร็จ: ${explainOpenRouterError(message)}`);
        ctx.log('สลับเป็นโหมด local fallback แบบแยกหมวด เพื่อให้ยังได้สมองฐานไว้แก้ต่อ');
        const fallbackBrain = createLocalManualBrainFromCsv({
          brainKey,
          rows,
          trendRows,
          manualCsvName,
          manualTrendCsvName,
          csvPromptExamples,
          previousFeedback: manualBrain?.feedbackNotes || [],
        });
        ctx.log(`4/6 สร้างสมองฐานสำเร็จ: keyword ${fallbackBrain.keywords.length} รายการ · trend insight ${fallbackBrain.trendInsights.length} รายการ · example prompt ${fallbackBrain.examplePrompts.length} รายการ`);
        ctx.log(`ตัวอย่าง keyword ที่จับได้: ${fallbackBrain.keywords.slice(0, 12).join(', ') || 'ยังไม่มี'}`);
        ctx.log(`ตัวอย่าง trend insight: ${fallbackBrain.trendInsights.slice(0, 8).join(' | ') || 'ยังไม่มี'}`);
        ctx.log('5/6 บันทึกสมองฐานลง app_data และ localStorage');
        await saveManualBrains({ ...manualBrains, [brainKey]: fallbackBrain });
        ctx.log('6/6 สมองฐานพร้อมใช้: เปิด Brain Map เพื่อตรวจ/แก้ไข แล้วค่อยสร้างหัวข้อหรือ prompt ต่อได้');
        return;
      }
      } finally {
        setManualTaskId('');
      }
    });
    setManualTaskId(taskId);
  };

  const saveManualFeedbackToBrain = async () => {
    if (!manualFeedback.trim()) return;
    const brainKey = manualBrainKey || createManualBrainKey(manualCsvName || 'CSV Prompt');
    setManualBrainKey(brainKey);
    const base: ManualPromptBrain = manualBrain || {
      pageName: brainKey,
      updatedAt: new Date().toISOString(),
      sourceRowCount: 0,
      summary: 'สร้างสมองจาก feedback โดยตรง',
      keywords: [],
      contentAngles: [],
      toneGuidelines: [],
      topicPatterns: [],
      promptRules: [],
      visualStyleRules: [],
      negativeRules: [],
      trendInsights: [],
      examplePrompts: [],
      feedbackNotes: [],
    };
    const nextBrain = {
      ...base,
      updatedAt: new Date().toISOString(),
      feedbackNotes: [...base.feedbackNotes, manualFeedback.trim()],
    };
    await saveManualBrains({ ...manualBrains, [brainKey]: nextBrain });
    setManualFeedback('');
  };

  const manualBrainFieldToText = (brain: ManualPromptBrain, field: ManualBrainEditableField) => {
    const value = brain[field];
    if (Array.isArray(value)) return value.join('\n');
    return String(value ?? '');
  };

  const parseManualBrainField = (field: ManualBrainEditableField, value: string) => {
    if (field === 'pageName' || field === 'summary' || field === 'rawAnalysis') return value.trim();
    const splitter = field === 'keywords' ? /[\n,]+/ : /\n+/;
    return value
      .split(splitter)
      .map(item => item.trim())
      .filter(Boolean);
  };

  const startEditManualBrainField = (field: ManualBrainEditableField) => {
    if (!manualBrain) return;
    setManualBrainEditingField(field);
    setManualBrainDraft(manualBrainFieldToText(manualBrain, field));
  };

  const saveManualBrainField = async () => {
    if (!manualBrain || !manualBrainKey || !manualBrainEditingField) return;
    const nextBrain = normalizeManualBrain({
      ...manualBrain,
      [manualBrainEditingField]: parseManualBrainField(manualBrainEditingField, manualBrainDraft),
      updatedAt: new Date().toISOString(),
    }, manualBrain.pageName || manualBrainKey);
    await saveManualBrains({ ...manualBrains, [manualBrainKey]: nextBrain });
    setManualBrainEditingField('');
    setManualBrainDraft('');
  };

  const cancelEditManualBrainField = () => {
    setManualBrainEditingField('');
    setManualBrainDraft('');
  };

  const startGenerateManualTopics = () => {
    if (!manualBrain || !hasOpenRouterKey) return;
    const total = Number(manualTopicCount);
    if (!Number.isFinite(total) || total <= 0) return;
    const nextTaskId = `manual-topics-${Date.now()}`;
    const taskId = globalTaskStore.enqueueTask({
      id: nextTaskId,
      title: `🧠 สร้างหัวข้อ: ${manualBrain.pageName}`,
      category: 'page-stock-manual',
      progress: `เตรียมสร้างหัวข้อ ${total} หัวข้อ`,
    }, async ctx => {
      setManualTaskId(nextTaskId);
      try {
        const batchSize = 10;
        const totalRounds = Math.ceil(total / batchSize);
        const nextTopics: string[] = [];
        const localTrendSeeds = extractTrendTopicSeeds(manualBrain);
        const editedKeywordCount = manualBrain.keywords.map(cleanTopicSeed).filter(Boolean).length;
        ctx.log(manualBrain.trendRowCount ? `ใช้ข้อมูลเทรนด์จากสมอง: ${manualBrain.trendFileName || 'trend.csv'} (${manualBrain.trendRowCount} แถว)` : 'สมองนี้ไม่มี CSV เทรนด์: ใช้ pattern จาก CSV Prompt เป็นหลัก');
        ctx.log(`ใช้ OpenRouter จาก Profile: ${activeProfile?.name || 'ไม่พบชื่อโปรไฟล์'} · โมเดลสร้างหัวข้อ: ${manualTopicModel}`);
        ctx.log(`Allowed Keywords จากสมองที่บันทึกไว้: ${editedKeywordCount} รายการ · ระบบจะไม่สร้างชื่อ tool/concept นอก list นี้`);
        ctx.log(`Keyword เทรนด์ที่จับได้: ${localTrendSeeds.slice(0, 18).join(', ') || 'ยังจับไม่ได้ จะใช้ keyword หลักของสมอง'}`);
        ctx.log('ทยอยส่งสมองเป็นก้อนเล็กๆ ต่อ batch เพื่อไม่ให้ชน prompt token limit และไม่ได้เทรนใหม่');
        let batchIndex = 0;
        let emptyStreak = 0;
        let forceLocalTopics = false;
        while (nextTopics.length < total) {
          if (ctx.isCancelled()) break;
          await waitIfManualPaused(ctx);
          const amount = Math.min(batchSize, total - nextTopics.length);
          const roundLabel = `${batchIndex + 1}/${totalRounds}`;
          const recentTopics = [...manualTopics, ...nextTopics].slice(-24);
          const buildTopicPrompt = (requestAmount = amount, ultraCompact = false) => `จากสมองเพจชุดย่อยนี้:
${createManualTopicBrainChunkContext(manualBrain, batchIndex, ultraCompact)}

สร้างหัวข้อใหม่ ${requestAmount} หัวข้อสำหรับ "${manualBrain.pageName}"
กติกา:
- ใช้ Allowed Keywords เป็นแหล่งชื่อ tool/concept หลักเท่านั้น
- ห้ามสร้างหรือดึงชื่อ tool/concept ที่ไม่มีใน Allowed Keywords แม้จะอยู่ใน trendInsights หรือ rawAnalysis
- ใช้ angle/pattern/trend เป็นบริบทในการตั้งมุมเล่า ไม่ใช่แหล่ง keyword ใหม่
- หัวข้อต้องทันกระแสแต่ยังตรง pattern เดิม
- ห้ามซ้ำหรือใกล้เคียงกับรายการนี้:
${recentTopics.join('\n') || '- ยังไม่มี'}

ตอบเป็น JSON array ของ string เท่านั้น`;
          ctx.log(`สร้างหัวข้อรอบ ${roundLabel}: ขอ ${amount} หัวข้อ`);
          let answer = '';
          let clean: string[] = [];
          if (forceLocalTopics) {
            clean = createLocalManualTopics(manualBrain, amount, [...manualTopics, ...nextTopics], batchIndex * batchSize);
            ctx.log(`รอบ ${roundLabel}: สร้างจากสมอง local ${clean.length} หัวข้อ`);
          } else {
            try {
              answer = await askOpenRouter(buildTopicPrompt(amount, false), ctx.signal, 700, manualTopicModel);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              if (/insufficient credits/i.test(message)) {
                ctx.log('OpenRouter แจ้ง Insufficient credits: สลับไปสร้างหัวข้อจากสมองที่บันทึกไว้แบบ local ต่อทันที');
                forceLocalTopics = true;
                clean = createLocalManualTopics(manualBrain, amount, [...manualTopics, ...nextTopics], batchIndex * batchSize);
                ctx.log(`รอบ ${roundLabel}: สร้างจากสมอง local ${clean.length} หัวข้อ`);
              } else if (/prompt tokens limit exceeded|prompt ยาวเกิน/i.test(message)) {
                ctx.log('Prompt ยังยาวเกิน: retry ด้วยก้อนสมองฉุกเฉินที่สั้นลงอีก');
                answer = await askOpenRouter(buildTopicPrompt(Math.min(3, amount), true), ctx.signal, 300, manualTopicModel);
              } else if (/more credits|fewer max_tokens|can only afford|เครดิตไม่พอ/i.test(message)) {
                ctx.log('OpenRouter ให้ token ต่อ request ต่ำมาก: retry แบบจิ๋วทีละ 1-3 หัวข้อ');
                const tinyAmount = Math.min(3, amount);
                try {
                  answer = await askOpenRouter(buildTopicPrompt(tinyAmount, true), ctx.signal, 120, manualTopicModel);
                } catch (tinyError) {
                  const tinyMessage = tinyError instanceof Error ? tinyError.message : String(tinyError);
                  if (/insufficient credits/i.test(tinyMessage)) {
                    ctx.log('OpenRouter ยังแจ้ง Insufficient credits: ใช้ local topic generator ต่อจนจบ');
                    forceLocalTopics = true;
                    clean = createLocalManualTopics(manualBrain, amount, [...manualTopics, ...nextTopics], batchIndex * batchSize);
                    ctx.log(`รอบ ${roundLabel}: สร้างจากสมอง local ${clean.length} หัวข้อ`);
                  } else {
                    if (manualTopicModel === 'google/gemini-2.5-flash-lite') throw tinyError;
                    ctx.log('ยังติด token/credit: ลอง fallback เป็น Gemini 2.5 Flash Lite สำหรับ batch นี้');
                    answer = await askOpenRouter(buildTopicPrompt(Math.min(2, amount), true), ctx.signal, 96, 'google/gemini-2.5-flash-lite');
                  }
                }
              } else {
                throw error;
              }
            }
            if (clean.length === 0) clean = extractTopicStrings(answer);
          }
          const accepted = clean.slice(0, amount);
          nextTopics.push(...accepted);
          setManualTopics(prev => [...prev, ...accepted]);
          setManualTopicsText(prev => [...getTopics(prev), ...accepted].join('\n'));
          ctx.log(`ได้หัวข้อเพิ่ม ${clean.slice(0, amount).length} หัวข้อ รวม ${nextTopics.length}/${total}`);
          batchIndex += 1;
          emptyStreak = accepted.length === 0 ? emptyStreak + 1 : 0;
          if (emptyStreak >= 5) throw new Error('AI ตอบกลับมาไม่เป็นหัวข้อ 5 รอบติด ระบบหยุดเพื่อกันวนลูปไม่รู้จบ');
          if (accepted.length === 0) await wait(500);
        }
        ctx.log(`สร้างหัวข้อเสร็จ: ได้ ${nextTopics.length}/${total} หัวข้อ`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.log(explainOpenRouterError(message));
        throw new Error(explainOpenRouterError(message));
      } finally {
        setManualTaskId('');
      }
    });
    setManualTaskId(taskId);
  };

  const startGenerateManualPrompts = () => {
    const topicsForPrompt = editableManualTopics;
    if (!manualBrain || topicsForPrompt.length === 0 || !hasOpenRouterKey) return;
    const nextTaskId = `manual-prompts-${Date.now()}`;
    const taskId = globalTaskStore.enqueueTask({
      id: nextTaskId,
      title: `🎨 สร้าง Prompt รูป: ${manualBrain.pageName}`,
      category: 'page-stock-manual',
      progress: `เตรียมสร้าง Prompt รูป ${topicsForPrompt.length} หัวข้อ`,
    }, async ctx => {
      setManualTaskId(nextTaskId);
      try {
        const existing = new Map(manualPromptResults.map(result => [result.topic, result.imagePrompt]));
        const pendingTopics = topicsForPrompt.filter(topic => !existing.has(topic));
        const batchSize = 6;
        const brainText = createManualBrainPromptContext(manualBrain);
        for (let start = 0; start < pendingTopics.length; start += batchSize) {
          if (ctx.isCancelled()) break;
          await waitIfManualPaused(ctx);
          const batch = pendingTopics.slice(start, start + batchSize);
          ctx.log(`สร้าง Prompt รูป batch ${Math.floor(start / batchSize) + 1}: ${batch.length} หัวข้อ`);
          const answer = await askOpenRouter(`คุณคือ AI ที่มีหน้าที่เขียน Prompt ตาม Pattern เดิมแบบเข้มงวด

ใช้สมองเพจนี้เป็นกฎหลัก:
${brainText}

สร้าง Prompt สร้างรูปสำหรับแต่ละหัวข้อต่อไปนี้ โดยต้องตรง Pattern ตัวอย่างของเพจแบบเป๊ะที่สุด:
${batch.map((topic, index) => `${index + 1}. ${topic}`).join('\n')}

ข้อบังคับสำคัญมาก:
- ต้อง copy style/format จาก examplePrompts ในสมองให้มากที่สุด
- ถ้า examplePrompts เป็นภาษาอังกฤษ เช่น "Infographic square image, 1080x1080..." ให้ตอบเป็นภาษาอังกฤษ format เดียวกัน
- ถ้า examplePrompts เป็นภาษาไทย เช่น "สร้างรูปอินโฟอธิบาย..." ให้ตอบเป็นภาษาไทย format เดียวกัน
- ห้ามเปลี่ยน template ไปเป็นคนละสไตล์เอง
- ห้ามตอบเป็น object ซ้อนใน imagePrompt ให้ imagePrompt เป็น string เท่านั้น
- เปลี่ยนเฉพาะหัวข้อ/รายละเอียดให้เหมาะกับหัวข้อใหม่ ส่วนโครงสร้าง prompt, mood, visual style, size, font, layout ต้องตาม pattern เดิม
- ต้องพร้อมเอาไปใช้ต่อได้ทันที

ตอบเป็น JSON array เท่านั้น:
[{"topic":"หัวข้อเดิม","imagePrompt":"prompt..."}]`, ctx.signal, 6000, manualPromptModel);
          const parsed = extractJsonPayload<ManualPromptResult[]>(answer, []);
          const clean = parsed
            .map(item => ({ topic: String(item.topic || '').trim(), imagePrompt: String(item.imagePrompt || '').trim() }))
            .filter(item => item.topic && item.imagePrompt);
          setManualPromptResults(prev => [...prev, ...clean]);
          ctx.log(`ได้ Prompt รูปเพิ่ม ${clean.length} รายการ รวม ${start + clean.length}/${pendingTopics.length}`);
        }
        ctx.log('สร้าง Prompt รูปเสร็จ: พร้อม Export CSV');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.log(explainOpenRouterError(message));
        throw new Error(explainOpenRouterError(message));
      } finally {
        setManualTaskId('');
      }
    });
    setManualTaskId(taskId);
  };

  const toggleManualPause = () => {
    manualPausedRef.current = !manualPausedRef.current;
    setManualPaused(manualPausedRef.current);
    if (manualTaskId) {
      globalTaskStore.logTask(manualTaskId, manualPausedRef.current ? 'Pause: ผู้ใช้สั่งหยุดพักงาน' : 'Resume: ผู้ใช้สั่งทำงานต่อ');
    }
  };

  const stopManualTask = () => {
    if (!manualTaskId) return;
    globalTaskStore.removeTask(manualTaskId);
    setManualTaskId('');
    manualPausedRef.current = false;
    setManualPaused(false);
  };

  const deleteManualBrain = async () => {
    if (!manualBrainKey || !manualBrains[manualBrainKey]) return;
    if (!window.confirm(`ลบสมอง "${manualBrains[manualBrainKey].pageName || manualBrainKey}" ใช่ไหม?`)) return;
    const nextBrains = { ...manualBrains };
    delete nextBrains[manualBrainKey];
    await saveManualBrains(nextBrains);
    const nextKey = Object.keys(nextBrains)[0] || '';
    setManualBrainKey(nextKey);
    setManualTopics([]);
    setManualTopicsText('');
    setManualPromptResults([]);
  };

  const copyManualPrompts = async () => {
    if (!manualPromptCopyText) return;
    await navigator.clipboard.writeText(manualPromptCopyText);
    setManualPromptsCopied(true);
    window.setTimeout(() => setManualPromptsCopied(false), 1500);
  };

  const downloadManualPromptCsv = () => {
    if (manualPromptResults.length === 0) return;
    const blob = new Blob(['\uFEFF' + manualPromptCsv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `manual-image-prompts-${manualBrain?.pageName || manualBrainKey || 'page'}-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleLocalImageBrainCsvUpload = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    const brainKey = createManualBrainKey(file.name);
    setLocalImageBrainCsvName(file.name);
    setLocalImageBrainCsvText(text);
    setLocalImageBrainKey(brainKey);
  };

  const applyLocalImageBrain = (key: string) => {
    setLocalImageBrainKey(key);
    const brain = localImageBrains[key];
    if (brain?.writingPrompt) setLocalImagePrompt(brain.writingPrompt);
  };

  const startAnalyzeLocalImageBrainCsv = () => {
    if (!localImageBrainCsvText.trim() || !getOpenRouterKeyForLocalImage() || localImageBrainAnalyzing) return;
    const brainKey = localImageBrainKey || createManualBrainKey(localImageBrainCsvName || 'สมองเขียนโพส');
    const rows = parseCsvTable(localImageBrainCsvText);
    setLocalImageBrainKey(brainKey);
    setLocalImageBrainAnalyzing(true);
    globalTaskStore.enqueueTask({
      id: `local-image-brain-${Date.now()}`,
      title: `🧠 สร้างสมองเขียนโพส: ${brainKey}`,
      category: 'page-stock-local-image',
      progress: 'เตรียมอ่าน CSV ตัวอย่างโพส',
    }, async ctx => {
      try {
        ctx.log(`1/6 อ่าน CSV: ${localImageBrainCsvName || 'ไฟล์อัปโหลด'} (${rows.length} แถวจาก parser, raw ${localImageBrainCsvText.length.toLocaleString()} ตัวอักษร)`);
        const csvPostExamples = getLikelyPostExamples(rows, 14);
        ctx.log(csvPostExamples.length > 0
          ? `จับตัวอย่างโพสต์จริงจาก CSV ได้ ${csvPostExamples.length} ตัวอย่าง จะฝังไว้ในสมอง`
          : 'ยังจับตัวอย่างโพสต์จาก CSV ไม่ได้ชัดเจน จะให้ AI วิเคราะห์จาก raw CSV แทน');
        const shouldChunk = rows.length > 60 || localImageBrainCsvText.length > 45000;
        const chunkSummaries: string[] = [];
        const chunkAnalyses: any[] = [];
        const chunkExtractedExamples: string[] = [];
        if (shouldChunk) {
          const rowChunks = rows.length > 0
            ? Array.from({ length: Math.ceil(rows.length / 30) }, (_, index) => rows.slice(index * 30, index * 30 + 30))
            : Array.from({ length: Math.ceil(localImageBrainCsvText.length / 18000) }, (_, index) => localImageBrainCsvText.slice(index * 18000, index * 18000 + 18000));
          ctx.log(`2/6 CSV ใหญ่: แบ่งให้ AI อ่านละเอียด ${rowChunks.length} ชุด ชุดละประมาณ 30 แถว`);
          for (let index = 0; index < rowChunks.length; index++) {
            if (ctx.isCancelled()) break;
            const chunk = rowChunks[index];
            const chunkText = typeof chunk === 'string'
              ? chunk
              : JSON.stringify(chunk, null, 2).slice(0, 22000);
            const chunkExamples = Array.isArray(chunk) ? getLikelyPostExamples(chunk, 6) : [];
            chunkExtractedExamples.push(...chunkExamples);
            ctx.log(`อ่านชุด ${index + 1}/${rowChunks.length}: วิเคราะห์ pattern + ตัวอย่างโพสต์จากชุดนี้`);
            const chunkAnswer = await askOpenRouter(`คุณคือ Content Analyst ให้สรุป pattern จาก CSV ชุดย่อยนี้เท่านั้น

ชื่อสมอง: ${brainKey}
ชุดที่: ${index + 1}/${rowChunks.length}

ข้อมูล:
${chunkText}

ตัวอย่างโพสต์ที่ระบบสกัดจากชุดนี้:
${chunkExamples.map((item, exampleIndex) => `--- ตัวอย่าง ${exampleIndex + 1} ---\n${item}`).join('\n\n') || 'ไม่มีตัวอย่างที่ระบบสกัดได้ ให้หาเองจากข้อมูลชุดนี้'}

วิเคราะห์ชุดนี้แบบละเอียด แต่อย่าสรุปกว้าง ๆ:
1. โพสต์ในชุดนี้ขาย/เล่าอะไร
2. โครงสร้างจริง เช่น เริ่มด้วยอะไร ต่อด้วยอะไร จบด้วยอะไร จำนวนบรรทัดประมาณไหน
3. คำซ้ำ วลีซ้ำ emoji/สัญลักษณ์/ตัวคั่น ถ้ามี
4. สิ่งที่ดึงจากรูปหรือชื่อไฟล์ไปเขียน
5. สิ่งที่ห้ามเดา
6. ตัวอย่างโพสต์จริงจากชุดนี้ 3-6 ตัวอย่าง

ตอบ JSON เท่านั้น:
{
  "summary": "สรุปชุดนี้",
  "audienceInsights": ["..."],
  "toneGuidelines": ["..."],
  "structureRules": ["..."],
  "productSignals": ["..."],
  "negativeRules": ["..."],
  "captionExamples": ["ตัวอย่างโพสต์จริงจากชุดนี้"]
}`, ctx.signal, 2600, localImageModel);
            const parsedChunk = extractJsonPayload<any>(chunkAnswer, {});
            const chunkAnalysis = {
              summary: String(parsedChunk.summary || chunkAnswer).slice(0, 2500),
              audienceInsights: asStringArray(parsedChunk.audienceInsights),
              toneGuidelines: asStringArray(parsedChunk.toneGuidelines),
              structureRules: asStringArray(parsedChunk.structureRules),
              productSignals: asStringArray(parsedChunk.productSignals),
              negativeRules: asStringArray(parsedChunk.negativeRules),
              captionExamples: Array.from(new Set([...asStringArray(parsedChunk.captionExamples), ...chunkExamples])).slice(0, 8),
            };
            chunkAnalyses.push(chunkAnalysis);
            chunkSummaries.push(JSON.stringify(chunkAnalysis, null, 2));
          }
        } else {
          ctx.log('2/6 CSV ขนาดพอดี: ส่งตัวอย่างตรงให้ AI วิเคราะห์ในรอบเดียว');
        }
        const messySample = shouldChunk
          ? localImageBrainCsvText.slice(0, 10000)
          : localImageBrainCsvText.slice(0, 42000);
        const tableSample = JSON.stringify(rows.slice(0, shouldChunk ? 30 : 120), null, 2).slice(0, shouldChunk ? 12000 : 32000);
        const chunkContext = chunkSummaries.length > 0
          ? `ผลวิเคราะห์ CSV ทีละชุดแบบ structured:
${JSON.stringify(chunkAnalyses, null, 2).slice(0, 70000)}

สรุป raw จากแต่ละชุด:
${chunkSummaries.map((summary, index) => `--- ชุด ${index + 1} ---\n${summary}`).join('\n\n').slice(0, 50000)}`
          : '';
        ctx.log(chunkSummaries.length > 0 ? '3/6 รวมสรุปทุกชุด แล้วให้ AI สร้างสมองสุดท้าย' : '3/6 ให้ AI สร้างสมองสุดท้ายจากตัวอย่าง CSV');
        const answer = await askOpenRouter(`คุณคือ Senior Content Strategist ที่เชี่ยวชาญการสร้าง "สมองเขียนโพสจากรูปสินค้า/รูปคอนเทนต์"

เป้าหมาย:
วิเคราะห์ CSV ตัวอย่างโพสนี้ให้ละเอียด แม้ CSV จะเละ คอลัมน์มั่ว ข้อมูลไม่เป็นระเบียบ หรือมีข้อความปนกัน คุณต้องเดาโครงสร้างและ pattern ให้ดีที่สุด

ชื่อสมองเบื้องต้น: ${brainKey}

${chunkContext}

RAW CSV SAMPLE:
${messySample}

ตัวอย่างโพสต์จริงที่ระบบสกัดจาก CSV:
${Array.from(new Set([...csvPostExamples, ...chunkExtractedExamples])).slice(0, 18).map((item, index) => `--- ตัวอย่าง ${index + 1} ---\n${item}`).join('\n\n') || 'ยังสกัดตัวอย่างไม่ได้ ให้หาเองจาก RAW/PARSED CSV'}

PARSED ROWS SAMPLE:
${tableSample}

งานที่ต้องทำ:
1. อ่านให้ออกว่าไฟล์นี้เป็นคอนเทนต์/สินค้าแนวไหน
2. วิเคราะห์กลุ่มลูกค้า, จุดขาย, ภาษาที่ใช้, ความยาว, โครงสร้างโพส
3. วิเคราะห์ว่าตอน AI เห็นรูป ควรจับสัญญาณอะไรจากภาพเพื่อเอามาเขียน
4. สร้าง System Prompt สำหรับใช้กับ Vision AI ตอนอ่านรูป Dropbox แล้วเขียนโพส ต้องพร้อมนำไปใช้จริงทันที
5. ยกตัวอย่างโพส/แคปชั่นที่น่าจะตรง pattern
6. ใส่ข้อห้าม เช่น ห้ามแต่งราคา, ห้ามกล่าวเกินจริง, ห้ามใช้ markdown ถ้า pattern เดิมไม่ใช้
7. ใน writingPrompt ต้องบังคับชัดเจนว่า ห้ามขึ้นต้นด้วยคำเกริ่น ห้ามบอกว่าเป็น AI/Content Strategist/ผู้ช่วย และต้องเข้าเนื้อหาโพสต์ทันที
8. writingPrompt ต้องมีตัวอย่างโพสต์จริงจาก CSV อย่างน้อย 5 ตัวอย่าง เพื่อให้ตอนเขียนจากรูปเลียนแบบ pattern ได้

ตอบ JSON เท่านั้น ห้าม markdown ห้ามคำอธิบายนอก JSON และต้องกรอกทุก array อย่างน้อย 4-8 ข้อถ้ามีข้อมูล:
{
  "name": "ชื่อสมองสั้นๆ",
  "summary": "สรุปว่าเข้าใจเพจ/สินค้า/สไตล์ยังไงอย่างละเอียด",
  "writingPrompt": "System Prompt เต็มสำหรับให้ AI อ่านรูปแล้วเขียนโพส",
  "audienceInsights": ["..."],
  "toneGuidelines": ["..."],
  "structureRules": ["..."],
  "productSignals": ["สิ่งที่ต้องดูจากรูป"],
  "captionExamples": ["ตัวอย่างโพส"],
  "negativeRules": ["ข้อห้าม", "ห้ามขึ้นต้นด้วยคำเกริ่น เช่น แน่นอน/ได้เลย/ในฐานะ", "ห้ามบอกว่าตัวเองเป็น AI หรือ Content Strategist"]
}`, ctx.signal, 7000, localImageModel);
        ctx.log(`4/6 AI วิเคราะห์กลับมาแล้ว (${answer.length.toLocaleString()} ตัวอักษร)`);
        const parsed = extractJsonPayload<any>(answer, {});
        const parsedCaptionExamples = asStringArray(parsed.captionExamples);
        const chunkCaptionExamples = chunkAnalyses.flatMap(analysis => asStringArray(analysis.captionExamples));
        const captionExamples = Array.from(new Set([...parsedCaptionExamples, ...csvPostExamples, ...chunkExtractedExamples, ...chunkCaptionExamples])).slice(0, 20);
        const summary = String(parsed.summary || '').trim() || [
          `วิเคราะห์จาก CSV ${rows.length} แถว`,
          captionExamples.length > 0 ? `พบตัวอย่างโพสต์จริง ${captionExamples.length} ตัวอย่างและฝังเป็น pattern ให้ใช้ตอนเขียนจากรูป` : 'AI ตอบกลับมาไม่ครบ จึงสร้างสมอง fallback จากข้อมูล CSV ที่อ่านได้',
          chunkSummaries.length > 0 ? `สรุปจาก CSV ที่แบ่งอ่าน ${chunkSummaries.length} ชุด` : '',
        ].filter(Boolean).join(' · ');
        const audienceInsights = Array.from(new Set([...asStringArray(parsed.audienceInsights), ...chunkAnalyses.flatMap(analysis => asStringArray(analysis.audienceInsights))])).slice(0, 16);
        const toneGuidelines = Array.from(new Set([...asStringArray(parsed.toneGuidelines), ...chunkAnalyses.flatMap(analysis => asStringArray(analysis.toneGuidelines))])).slice(0, 16);
        const structureRules = Array.from(new Set([...asStringArray(parsed.structureRules), ...chunkAnalyses.flatMap(analysis => asStringArray(analysis.structureRules))])).slice(0, 16);
        const productSignals = Array.from(new Set([...asStringArray(parsed.productSignals), ...chunkAnalyses.flatMap(analysis => asStringArray(analysis.productSignals))])).slice(0, 16);
        const negativeRules = Array.from(new Set([
          ...asStringArray(parsed.negativeRules),
          ...chunkAnalyses.flatMap(analysis => asStringArray(analysis.negativeRules)),
          'ห้ามใช้ markdown หรือ markdown bold ถ้า CSV เดิมไม่ได้ใช้',
          'ห้ามขึ้นต้นด้วยคำเกริ่น เช่น แน่นอน/ได้เลย/ในฐานะ',
          'ห้ามบอกว่าตัวเองเป็น AI หรือกำลังวิเคราะห์ภาพ',
          'ห้ามเดาราคา/โปรโมชัน/สเปกที่มองไม่เห็นจากรูป',
        ]));
        const writingPrompt = buildLocalImageWritingPromptFromCsv({
          brainKey,
          summary,
          audienceInsights,
          toneGuidelines,
          structureRules,
          productSignals,
          captionExamples,
          negativeRules,
        });
        const brain = normalizeArticleBrain({
          name: String(parsed.name || brainKey),
          updatedAt: new Date().toISOString(),
          sourceFileName: localImageBrainCsvName,
          sourceRowCount: rows.length,
          summary,
          writingPrompt: `${String(parsed.writingPrompt || '').trim() ? `${String(parsed.writingPrompt).trim()}\n\n` : ''}${writingPrompt}\n\n${NO_AI_PREAMBLE_RULE}`,
          audienceInsights,
          toneGuidelines,
          structureRules,
          productSignals,
          captionExamples,
          negativeRules,
          feedbackNotes: localImageBrain?.feedbackNotes || [],
          rawAnalysis: answer,
        }, brainKey);
        ctx.log('5/6 บันทึกสมองเขียนโพสลง app_data และ localStorage');
        await saveLocalImageBrains({ ...localImageBrains, [brainKey]: brain });
        setLocalImagePrompt(brain.writingPrompt);
        ctx.log('6/6 วิเคราะห์เสร็จ: ตั้ง Prompt ให้ใช้สมองใหม่ และเปิดให้ติชมพัฒนาต่อได้');
      } finally {
        setLocalImageBrainAnalyzing(false);
      }
    });
  };

  const saveLocalImageBrainFeedback = async () => {
    if (!localImageBrain || !localImageBrainFeedback.trim()) return;
    const note = localImageBrainFeedback.trim();
    const nextBrain = normalizeArticleBrain({
      ...localImageBrain,
      updatedAt: new Date().toISOString(),
      feedbackNotes: [...localImageBrain.feedbackNotes, note],
      writingPrompt: `${localImageBrain.writingPrompt.trim()}

Additional owner feedback to follow in future runs:
- ${note}`,
    }, localImageBrainKey);
    await saveLocalImageBrains({ ...localImageBrains, [localImageBrainKey]: nextBrain });
    setLocalImagePrompt(nextBrain.writingPrompt);
    setLocalImageBrainFeedback('');
  };

  const deleteLocalImageBrain = async () => {
    if (!localImageBrainKey || !localImageBrains[localImageBrainKey]) return;
    if (!window.confirm(`ลบสมอง "${localImageBrains[localImageBrainKey].name || localImageBrainKey}" ใช่ไหม?`)) return;
    const nextBrains = { ...localImageBrains };
    delete nextBrains[localImageBrainKey];
    await saveLocalImageBrains(nextBrains);
    const nextKey = Object.keys(nextBrains)[0] || '';
    setLocalImageBrainKey(nextKey);
    if (nextKey) setLocalImagePrompt(nextBrains[nextKey].writingPrompt);
  };

  // Always reads from the module cache so it works even before profiles state loads
  const getOpenRouterKeyForLocalImage = () => getActiveOpenRouterKey();

  const getDropboxTokenForLocalImage = async () => {
    if (activeProfile?.dropboxRefreshToken && activeProfile.dropboxAppKey && activeProfile.dropboxAppSecret) {
      const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${activeProfile.dropboxAppKey}:${activeProfile.dropboxAppSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: activeProfile.dropboxRefreshToken,
        }),
      });
      const data = await res.json();
      if (data.access_token) {
        setProfiles(prev => prev.map(profile => profile.id === activeProfile.id ? { ...profile, dropboxKey: data.access_token } : profile));
        try {
          const savedProfiles = JSON.parse(localStorage.getItem('api_global_profiles') || '[]');
          const nextProfiles = savedProfiles.map((profile: ApiProfile) => profile.id === activeProfile.id ? { ...profile, dropboxKey: data.access_token } : profile);
          localStorage.setItem('api_global_profiles', JSON.stringify(nextProfiles));
          localStorage.setItem('dropbox_api_key', data.access_token);
        } catch {}
        return String(data.access_token);
      }
      throw new Error(data.error_description || data.error || 'ต่ออายุ Dropbox token ไม่สำเร็จ');
    }
    const token = activeProfile?.dropboxKey || localStorage.getItem('dropbox_api_key') || '';
    if (!token.trim()) throw new Error('ไม่พบ Dropbox token ใน Profile หรือ Global Settings');
    return token.trim();
  };

  const createDropboxSharedLink = async (path: string, token: string) => {
    const res = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    const url = data.url || data.error?.shared_link_already_exists?.metadata?.url || '';
    if (!url) throw new Error(data.error_summary || data.error?.['.tag'] || 'สร้าง Dropbox shared link ไม่สำเร็จ');
    return {
      sharedUrl: String(url),
      directUrl: String(url).replace('?dl=0', '?raw=1').replace('&dl=0', '&raw=1'),
    };
  };

  const toDropboxDownloadLink = (url: string) => (
    String(url || '')
      .replace('?raw=1', '?dl=1')
      .replace('&raw=1', '&dl=1')
      .replace('?dl=0', '?dl=1')
      .replace('&dl=0', '&dl=1')
  );

  const updateLocalImageItem = (id: string, patch: Partial<LocalImageArticleItem>) => {
    setLocalImageItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const scanLocalImageDropboxFolder = () => {
    const folderPath = localImageDropboxPath.trim();
    if (!folderPath || localImageScanning) return;
    setLocalImageScanning(true);
    globalTaskStore.enqueueTask({
      id: `local-image-dropbox-scan-${Date.now()}`,
      title: `📂 ดึงรูปจาก Dropbox: ${folderPath}`,
      category: 'page-stock-local-image',
      progress: 'เตรียมเชื่อมต่อ Dropbox',
    }, async ctx => {
      try {
        ctx.log(`1/4 ตรวจ Dropbox token และ path: ${folderPath}`);
        const token = await getDropboxTokenForLocalImage();
        ctx.log('2/4 ดึงรายชื่อไฟล์ในโฟลเดอร์ Dropbox');
        const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: folderPath,
            recursive: false,
            include_media_info: false,
            include_deleted: false,
            include_has_explicit_shared_members: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error_summary || JSON.stringify(data));
        const files = (data.entries || [])
          .filter((entry: any) => entry['.tag'] === 'file' && /\.(png|jpe?g|webp|gif)$/i.test(entry.name));
        ctx.log(`3/4 พบไฟล์รูป ${files.length} รูป กำลังสร้าง shared link สำหรับ preview และ AI`);
        const nextItems: LocalImageArticleItem[] = [];
        for (let index = 0; index < files.length; index++) {
          if (ctx.isCancelled()) break;
          const file = files[index];
          ctx.log(`สร้าง link ${index + 1}/${files.length}: ${file.name}`);
          const link = await createDropboxSharedLink(file.path_lower || file.path_display, token);
          nextItems.push({
            id: file.id || `${file.path_lower}-${Date.now()}`,
            fileName: file.name,
            dropboxPath: file.path_lower || file.path_display || '',
            sharedUrl: link.sharedUrl,
            directUrl: link.directUrl,
            status: 'idle',
            article: '',
            errorMsg: '',
            selected: true,
          });
          await wait(120);
        }
        setLocalImageItems(nextItems);
        ctx.log(`4/4 ดึงรูปจาก Dropbox เสร็จ: ${nextItems.length} รูป พร้อมเริ่มเขียนบทความ`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.log(`ล้มเหลว: ${message}`);
        throw error;
      } finally {
        setLocalImageScanning(false);
      }
    });
  };

  const askOpenRouterWithLocalImage = async (item: LocalImageArticleItem, signal?: AbortSignal) => {
    const apiKey = getOpenRouterKeyForLocalImage();
    if (!apiKey) throw new Error('ไม่พบ OpenRouter API Key ใน Profile หรือ Global Settings');
    const imageUrl = item.directUrl || item.sharedUrl;
    if (!imageUrl) throw new Error('รูปนี้ยังไม่มี Dropbox shared link');
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'BulkVideoCreatorApp',
      },
      body: JSON.stringify({
        model: localImageModel || 'google/gemini-2.5-flash-lite',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${localImagePrompt.trim() || DEFAULT_LOCAL_IMAGE_ARTICLE_PROMPT}

${NO_AI_PREAMBLE_RULE}

ข้อมูลไฟล์:
- ชื่อไฟล์: ${item.fileName}
- Dropbox path: ${item.dropboxPath}

ให้วิเคราะห์รูปนี้แล้วเขียนผลลัพธ์ตามกฎด้านบนเท่านั้น ส่งเฉพาะข้อความโพสต์จริงที่จะนำไปลงเพจ`,
            },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        }],
        temperature: 0.72,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error?.message || `OpenRouter error ${res.status}`);
    return cleanAiPostPreamble(String(data.choices?.[0]?.message?.content || ''));
  };

  const startLocalImageArticleRun = () => {
    const targets = localImageItems.filter(item => item.selected);
    if (targets.length === 0 || localImageRunning) return;
    const apiKey = getOpenRouterKeyForLocalImage();
    if (!apiKey) {
      alert('ไม่พบ OpenRouter API Key ใน Profile หรือ Global Settings');
      return;
    }
    if (!localImageDropboxPath.trim()) {
      alert('ใส่ Dropbox Folder Path ก่อนครับ');
      return;
    }
    localImageStopRef.current = false;
    setLocalImageRunning(true);
    const taskId = globalTaskStore.enqueueTask({
      id: `local-image-article-${Date.now()}`,
      title: `🖼️ เขียนบทความจากรูป Dropbox (${targets.length} รูป)`,
      category: 'page-stock-local-image',
      progress: `เตรียมอ่านรูป Dropbox ${targets.length} รูปด้วย ${localImageModel}`,
    }, async ctx => {
      ctx.log(`1/4 เตรียมรูปจาก Dropbox ที่เลือก: ${targets.length} รูป`);
      ctx.log(`2/4 ใช้ Prompt/สมองจากรันบอท Flow (${localImagePrompt.length.toLocaleString()} ตัวอักษร)`);
      for (let index = 0; index < targets.length; index++) {
        const item = targets[index];
        if (ctx.isCancelled() || localImageStopRef.current) {
          ctx.log(`หยุดงานตามคำสั่งผู้ใช้: ทำไปแล้ว ${index}/${targets.length} รูป`);
          break;
        }
        updateLocalImageItem(item.id, { status: 'processing', errorMsg: '' });
        ctx.log(`รูป ${index + 1}/${targets.length}: ส่ง "${item.fileName}" ให้ AI วิเคราะห์และเขียนบทความ`);
        try {
          const article = await askOpenRouterWithLocalImage(item, ctx.signal);
          updateLocalImageItem(item.id, { status: 'done', article, errorMsg: '' });
          ctx.log(`รูป ${index + 1}/${targets.length}: เขียนเสร็จ (${article.length.toLocaleString()} ตัวอักษร)`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          updateLocalImageItem(item.id, { status: 'error', errorMsg: message });
          ctx.log(`รูป ${index + 1}/${targets.length}: ล้มเหลว - ${message}`);
        }
        await wait(350);
      }
      ctx.log('3/4 บันทึกผลลัพธ์ไว้ในหน้านี้แล้ว');
      ctx.log('4/4 พร้อม Copy หรือ Export CSV จากรายการผลลัพธ์');
      setLocalImageRunning(false);
      localImageStopRef.current = false;
    });
    globalTaskStore.logTask(taskId, 'เริ่มงานเขียนบทความจากรูปใน Dropbox');
  };

  const stopLocalImageArticleRun = () => {
    localImageStopRef.current = true;
    setLocalImageRunning(false);
  };

  const copyLocalImageArticles = async () => {
    if (!localImageCopyText) return;
    await navigator.clipboard.writeText(localImageCopyText);
    setLocalImageCopied(true);
    window.setTimeout(() => setLocalImageCopied(false), 1500);
  };

  const downloadLocalImageArticleCsv = () => {
    const rows = localImageItems
      .filter(item => item.status === 'done' || item.status === 'error')
      .map(item => ({
        file_id: item.id,
        file_name: item.fileName,
        article: item.article,
        update_date: `มาใหม่ๆ ${new Date().toLocaleDateString('th-TH')}`,
        publish_status: 'N',
        dropbox_link_dl: toDropboxDownloadLink(item.directUrl || item.sharedUrl),
        formula: '=',
        dropbox_path: item.dropboxPath,
        status: item.status,
        error: item.errorMsg,
        created_at: new Date().toISOString(),
      }));
    if (rows.length === 0) return;
    const headers = ['file_id', 'article', 'update_date', 'publish_status', 'dropbox_link_dl', 'formula', 'file_name', 'dropbox_path', 'status', 'error', 'created_at'];
    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(header => csvEscape(row[header as keyof typeof row])).join(',')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `local-image-articles-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const clickbaitTopics = clickbaitInput
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);

  const runClickbaitGenerator = async () => {
    const uniqueTopics = Array.from(new Set(clickbaitTopics));
    if (uniqueTopics.length === 0 || clickbaitRunning) return;
    setClickbaitRunning(true);
    const generated: ClickbaitPostItem[] = [];
    const hasOpenRouter = hasOpenRouterKey;

    for (const topic of uniqueTopics) {
      try {
        const body = hasOpenRouter
          ? normalizeClickbaitPayload(topic, await askOpenRouter(createClickbaitPrompt(topic), undefined, 1800, manualPromptModel))
          : createFallbackClickbaitPost(topic);
        generated.push({
          ...body,
          id: `clickbait-${Date.now()}-${generated.length}`,
          createdAt: new Date().toISOString(),
        });
      } catch (error: any) {
        const fallback = createFallbackClickbaitPost(topic);
        generated.push({
          ...fallback,
          id: `clickbait-${Date.now()}-${generated.length}`,
          createdAt: new Date().toISOString(),
          status: 'error',
          error: error?.message || String(error),
        });
      }
    }

    setClickbaitPosts(prev => [...generated, ...prev]);
    setClickbaitRunning(false);
  };

  const updateClickbaitPost = (id: string, patch: Partial<ClickbaitPostItem>) => {
    setClickbaitPosts(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const updateClickbaitComment = (id: string, index: number, value: string) => {
    setClickbaitPosts(prev => prev.map(item => {
      if (item.id !== id) return item;
      const comments = [...item.comments] as [string, string, string];
      comments[index] = value;
      return { ...item, comments };
    }));
  };

  const clickbaitCsv = useMemo(() => {
    const headers = ['id', 'topic', 'headline', 'post_text', 'comment_1', 'comment_2', 'comment_3', 'status', 'error', 'created_at'];
    return [
      headers.join(','),
      ...clickbaitPosts.map(item => headers.map(header => {
        const row = {
          id: item.id,
          topic: item.topic,
          headline: item.headline,
          post_text: item.postText,
          comment_1: item.comments[0],
          comment_2: item.comments[1],
          comment_3: item.comments[2],
          status: item.status,
          error: item.error || '',
          created_at: item.createdAt,
        };
        return csvEscape(row[header as keyof typeof row]);
      }).join(',')),
    ].join('\n');
  }, [clickbaitPosts]);

  const clickbaitCopyText = useMemo(() => clickbaitPosts.map(item => [
    item.headline,
    '',
    item.postText,
    '',
    item.comments[0],
    '',
    item.comments[1],
    '',
    item.comments[2],
  ].join('\n')).join('\n\n----------\n\n'), [clickbaitPosts]);

  const copyClickbaitPosts = async () => {
    if (!clickbaitCopyText) return;
    await navigator.clipboard.writeText(clickbaitCopyText);
    setClickbaitCopied(true);
    window.setTimeout(() => setClickbaitCopied(false), 1500);
  };

  const downloadClickbaitCsv = () => {
    if (clickbaitPosts.length === 0) return;
    const blob = new Blob(['\uFEFF' + clickbaitCsv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `clickbait-posts-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ============ CSV Clickbait helpers ============
  const parseCsvClickbaitFile = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headerLine = lines[0];
    // Simple CSV parse (handles quoted fields)
    const splitCsvLine = (line: string) => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          result.push(current); current = '';
        } else {
          current += ch;
        }
      }
      result.push(current);
      return result.map(s => s.trim());
    };
    const headers = splitCsvLine(headerLine).map(h => h.toLowerCase().replace(/["']/g, ''));
    // Auto-detect content column
    const contentIdx = headers.findIndex(h => /^(caption|content|text|article|body|description|post_text|posttext|เนื้อหา)$/.test(h));
    const titleIdx = headers.findIndex(h => /^(title|headline|หัวข้อ|topic)$/.test(h));
    const urlIdx = headers.findIndex(h => /^(url|link|source_url|sourceurl|source|ลิงก์)$/.test(h));
    if (contentIdx < 0) return []; // must have a content column
    const rows: {id: string; title: string; content: string; sourceUrl: string}[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      const content = cols[contentIdx] || '';
      if (!content.trim() || content.length < 20) continue;
      rows.push({
        id: `csvrow-${i}-${Date.now()}`,
        title: (titleIdx >= 0 ? cols[titleIdx] : '') || content.slice(0, 60).replace(/\n/g, ' '),
        content,
        sourceUrl: urlIdx >= 0 ? (cols[urlIdx] || '') : '',
      });
    }
    return rows;
  };

  const handleCsvCbUpload = (file?: File | null) => {
    if (!file) return;
    setCsvCbFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setCsvCbFile(text);
      const rows = parseCsvClickbaitFile(text);
      setCsvCbRows(rows);
      setCsvCbProgress(rows.length > 0 ? `พบ ${rows.length} บทความพร้อมสร้าง` : '❌ ไม่พบคอลัมน์เนื้อหา (caption/content/text/article)');
    };
    reader.readAsText(file);
  };

  const handleCsvCbPaste = (text: string) => {
    setCsvCbFile(text);
    const rows = parseCsvClickbaitFile(text);
    setCsvCbRows(rows);
    setCsvCbProgress(rows.length > 0 ? `พบ ${rows.length} บทความพร้อมสร้าง` : '❌ ไม่พบคอลัมน์เนื้อหา (caption/content/text/article)');
  };

  const runCsvClickbaitGenerator = async () => {
    if (csvCbRows.length === 0 || csvCbRunning) return;
    setCsvCbRunning(true);
    const generated: ClickbaitPostItem[] = [];
    const hasKey = hasOpenRouterKey;
    if (!hasKey) {
      setCsvCbProgress('❌ ไม่พบ OpenRouter API Key');
      setCsvCbRunning(false);
      return;
    }

    for (let i = 0; i < csvCbRows.length; i++) {
      const row = csvCbRows[i];
      setCsvCbProgress(`กำลังสร้าง ${i + 1}/${csvCbRows.length}: ${row.title.slice(0, 40)}...`);
      try {
        const prompt = createCsvClickbaitPrompt(row.content, row.sourceUrl || undefined);
        const raw = await askOpenRouter(prompt, undefined, 2500, manualPromptModel);
        const body = normalizeClickbaitPayload(row.title, raw);
        generated.push({
          ...body,
          topic: row.title,
          id: `csv-cb-${Date.now()}-${i}`,
          createdAt: new Date().toISOString(),
        });
      } catch (error: any) {
        const fallback = createFallbackClickbaitPost(row.title);
        generated.push({
          ...fallback,
          id: `csv-cb-${Date.now()}-${i}`,
          createdAt: new Date().toISOString(),
          status: 'error',
          error: error?.message || String(error),
        });
      }
    }

    setCsvCbResults(prev => [...generated, ...prev]);
    setCsvCbProgress(`✅ สร้างเสร็จ ${generated.length} โพสต์`);
    setCsvCbRunning(false);
  };

  const updateCsvCbPost = (id: string, patch: Partial<ClickbaitPostItem>) => {
    setCsvCbResults(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const updateCsvCbComment = (id: string, index: number, value: string) => {
    setCsvCbResults(prev => prev.map(item => {
      if (item.id !== id) return item;
      const comments = [...item.comments] as [string, string, string];
      comments[index] = value;
      return { ...item, comments };
    }));
  };

  const csvCbCsvText = useMemo(() => {
    const headers = ['id', 'topic', 'headline', 'post_text', 'comment_1', 'comment_2', 'comment_3', 'status', 'error', 'created_at'];
    return [
      headers.join(','),
      ...csvCbResults.map(item => headers.map(header => {
        const row: Record<string, string> = {
          id: item.id, topic: item.topic, headline: item.headline,
          post_text: item.postText, comment_1: item.comments[0],
          comment_2: item.comments[1], comment_3: item.comments[2],
          status: item.status, error: item.error || '', created_at: item.createdAt,
        };
        return csvEscape(row[header]);
      }).join(',')),
    ].join('\n');
  }, [csvCbResults]);

  const csvCbCopyText = useMemo(() => csvCbResults.map(item => [
    item.headline, '', item.postText, '', item.comments[0], '', item.comments[1], '', item.comments[2],
  ].join('\n')).join('\n\n----------\n\n'), [csvCbResults]);

  const copyCsvCbPosts = async () => {
    if (!csvCbCopyText) return;
    await navigator.clipboard.writeText(csvCbCopyText);
    setCsvCbCopied(true);
    window.setTimeout(() => setCsvCbCopied(false), 1500);
  };

  const downloadCsvCbCsv = () => {
    if (csvCbResults.length === 0) return;
    const blob = new Blob(['\uFEFF' + csvCbCsvText], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `csv-clickbait-posts-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleCanvasFolderUpload = async (files?: FileList | null) => {
    if (!files?.length) return;
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    const nextImages = await Promise.all(imageFiles.map(async (file, index) => {
      const dataUrl = await readFileAsDataUrl(file);
      const img = await loadCanvasImage(dataUrl);
      return {
        id: `stock-canvas-${Date.now()}-${index}-${file.name}`,
        fileName: file.name,
        dataUrl,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        selected: true,
      };
    }));
    setCanvasImages(nextImages);
    setCanvasSelectedImageId(nextImages[0]?.id || '');
  };

  const handleCanvasLogoUpload = async (file?: File | null) => {
    if (!file) return;
    setCanvasLogoDataUrl(await readFileAsDataUrl(file));
  };

  const setCanvasTextPreset = (preset: string) => {
    const presets: Record<string, [number, number]> = {
      'top-left': [12, 10],
      'top-center': [50, 10],
      'top-right': [88, 10],
      'center': [50, 50],
      'bottom-left': [12, 90],
      'bottom-center': [50, 90],
      'bottom-right': [88, 90],
    };
    const next = presets[preset];
    if (next) {
      setCanvasTextX(next[0]);
      setCanvasTextY(next[1]);
    }
  };

  const setCanvasLogoPreset = (preset: string) => {
    const presets: Record<string, [number, number]> = {
      'top-left': [10, 10],
      'top-right': [90, 10],
      'bottom-left': [10, 90],
      'bottom-right': [90, 90],
      'center': [50, 50],
    };
    const next = presets[preset];
    if (next) {
      setCanvasLogoX(next[0]);
      setCanvasLogoY(next[1]);
    }
  };

  const renderStockCanvasImage = async (image: StockCanvasImage, targetCanvas?: HTMLCanvasElement) => {
    const canvas = targetCanvas || document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas ไม่พร้อมใช้งาน');
    const base = await loadCanvasImage(image.dataUrl);
    ctx.clearRect(0, 0, image.width, image.height);
    ctx.drawImage(base, 0, 0, image.width, image.height);

    if (canvasText.trim()) {
      const fontSize = Math.max(18, Math.round(image.width * (canvasTextSize / 100)));
      const x = image.width * (canvasTextX / 100);
      const y = image.height * (canvasTextY / 100);
      const maxWidth = image.width * 0.82;
      ctx.font = `700 ${fontSize}px "Noto Sans Thai", "Sarabun", sans-serif`;
      ctx.textAlign = canvasTextX < 25 ? 'left' : canvasTextX > 75 ? 'right' : 'center';
      ctx.textBaseline = 'middle';
      const lines = wrapCanvasLines(ctx, canvasText, maxWidth);
      const lineHeight = fontSize * 1.28;
      const blockH = lines.length * lineHeight;
      const widest = Math.min(maxWidth, Math.max(...lines.map(line => ctx.measureText(line).width), 0));
      const alignOffset = ctx.textAlign === 'left' ? widest / 2 : ctx.textAlign === 'right' ? -widest / 2 : 0;
      if (canvasTextEffect === 'bar' || canvasTextEffect === 'badge') {
        const padX = fontSize * (canvasTextEffect === 'badge' ? 0.9 : 1.1);
        const padY = fontSize * 0.55;
        const bgX = x + alignOffset - widest / 2 - padX;
        const bgY = y - blockH / 2 - padY;
        const bgW = widest + padX * 2;
        const bgH = blockH + padY * 2;
        ctx.fillStyle = canvasTextEffect === 'badge' ? canvasAccentColor : 'rgba(0,0,0,0.68)';
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgW, bgH, canvasTextEffect === 'badge' ? fontSize * 0.45 : 0);
        ctx.fill();
        if (canvasTextEffect === 'bar') {
          ctx.fillStyle = canvasAccentColor;
          ctx.fillRect(bgX, bgY, Math.max(8, image.width * 0.01), bgH);
        }
      }
      lines.forEach((line, index) => {
        const lineY = y - blockH / 2 + lineHeight * index + lineHeight / 2;
        if (canvasTextEffect === 'outline' || canvasTextEffect === 'shadow') {
          ctx.strokeStyle = canvasTextEffect === 'outline' ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.55)';
          ctx.lineWidth = canvasTextEffect === 'outline' ? fontSize * 0.14 : fontSize * 0.08;
          ctx.strokeText(line, x, lineY);
        }
        if (canvasTextEffect === 'shadow') {
          ctx.shadowColor = 'rgba(0,0,0,0.75)';
          ctx.shadowBlur = fontSize * 0.25;
          ctx.shadowOffsetY = fontSize * 0.08;
        }
        ctx.fillStyle = canvasTextColor;
        ctx.fillText(line, x, lineY);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      });
    }

    if (canvasLogoDataUrl) {
      const logo = await loadCanvasImage(canvasLogoDataUrl);
      const logoW = image.width * (canvasLogoSize / 100);
      const logoH = logoW * ((logo.naturalHeight || logo.height) / (logo.naturalWidth || logo.width));
      const x = image.width * (canvasLogoX / 100) - logoW / 2;
      const y = image.height * (canvasLogoY / 100) - logoH / 2;
      ctx.drawImage(logo, x, y, logoW, logoH);
    }

    return canvas.toDataURL('image/png');
  };

  const drawStockCanvasPreview = async () => {
    if (!selectedCanvasImage || !canvasPreviewRef.current) return;
    await renderStockCanvasImage(selectedCanvasImage, canvasPreviewRef.current);
  };

  useEffect(() => {
    drawStockCanvasPreview().catch(() => undefined);
  }, [selectedCanvasImage, canvasText, canvasTextX, canvasTextY, canvasTextSize, canvasTextColor, canvasAccentColor, canvasTextEffect, canvasLogoDataUrl, canvasLogoX, canvasLogoY, canvasLogoSize]);

  const handleCanvasPreviewClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    if (canvasActiveLayer === 'logo') {
      setCanvasLogoX(Math.max(0, Math.min(100, x)));
      setCanvasLogoY(Math.max(0, Math.min(100, y)));
    } else {
      setCanvasTextX(Math.max(0, Math.min(100, x)));
      setCanvasTextY(Math.max(0, Math.min(100, y)));
    }
  };

  const downloadStockCanvasImage = async (image?: StockCanvasImage) => {
    const target = image || selectedCanvasImage;
    if (!target) return;
    const dataUrl = await renderStockCanvasImage(target);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${target.fileName.replace(/\.[^.]+$/, '')}_canvas.png`;
    link.click();
  };

  const downloadAllStockCanvasImages = async () => {
    const targets = canvasImages.filter(image => image.selected);
    for (const image of targets) {
      await downloadStockCanvasImage(image);
      await wait(250);
    }
  };

  const createKieImage = async (prompt: string, log: (message: string) => Promise<void>, label = 'หลัก') => {
    if (!activeProfile?.kieKey) throw new Error('ไม่พบ KIE API Key');
    const createRes = await fetch('/api/kie-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: activeProfile.kieKey,
        model: 'gpt-image-2-text-to-image',
        input: {
          prompt,
          aspect_ratio: settings.aspectRatio,
          resolution: settings.resolution,
        },
      }),
    });
    const createData = await createRes.json();
    const taskId = createData?.data?.taskId || createData?.taskId;
    if (createData.code !== 200 || !taskId) throw new Error(createData.msg || 'KIE ไม่ส่ง taskId กลับมา');

    await log(`ส่ง KIE สำเร็จ (${label}) taskId=${taskId}`);
    const maxPolls = 120;
    for (let i = 0; i < maxPolls; i++) {
      await wait(5000);
      const pollRes = await fetch(`/api/kie-status?taskId=${encodeURIComponent(taskId)}&apiKey=${encodeURIComponent(activeProfile.kieKey)}`);
      const pollData = await pollRes.json();
      const taskData = pollData.data || pollData;
      const state = String(taskData.state || taskData.status || '').toLowerCase();
      await log(`ตรวจ KIE (${label}) ${i + 1}/${maxPolls}: ${state || 'unknown'} (${taskId})`);

      if (state === 'success' || state === 'completed' || state === 'done') {
        const imageUrl = extractKieImageUrl(taskData);
        if (!imageUrl) throw new Error('KIE เสร็จแล้วแต่ไม่พบ URL รูป');
        return { taskId, imageUrl };
      }
      if (state === 'fail' || state === 'failed' || state === 'error') {
        throw new Error(taskData.failMsg || taskData.errorMessage || taskData.msg || 'KIE สร้างรูปล้มเหลว');
      }
    }
    throw new Error('รอ KIE นานเกินกำหนด');
  };

  const saveImageLocal = async (imageUrl: string, page: PageConfig, topic: string) => {
    const fileName = `${Date.now()}_${safeFilePart(topic)}.png`;
    const res = await fetch('/api/page-stock-save-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl,
        fileName,
        saveDir: settings.localSaveDir,
        pageName: page.name,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'บันทึกรูปลงเครื่องไม่สำเร็จ');
    return data.localPath as string;
  };

  const uploadDropbox = async (imageUrl: string, page: PageConfig, topic: string) => {
    const fileName = `${Date.now()}_${safeFilePart(topic)}.png`;
    const res = await fetch('/api/dropbox-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl,
        fileName,
        folderPath: settings.dropboxFolderPath || page.dropbox_path,
        accessToken: activeProfile?.dropboxKey || '',
        refreshToken: activeProfile?.dropboxRefreshToken || '',
        appKey: activeProfile?.dropboxAppKey || '',
        appSecret: activeProfile?.dropboxAppSecret || '',
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'อัปโหลด Dropbox ไม่สำเร็จ');
    return {
      dropboxPath: data.dropboxPath || '',
      directUrl: String(data.directUrl || data.url || '').replace('dl=0', 'dl=1'),
    };
  };

  const persistResults = async (results: PageStockResult[]) => {
    const nextResults = [...results, ...completedResults];
    setCompletedResults(nextResults);
    localStorage.setItem('page_stock_results', JSON.stringify(nextResults));
    await fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'page_stock_results', data: nextResults }),
    }).catch(() => {});

    if (settings.saveCsv || settings.saveLocal) {
      await fetch('/api/page-stock-save-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveDir: settings.localSaveDir,
          results: nextResults,
          csv: settings.saveCsv ? toCsv(nextResults as unknown as Record<string, unknown>[]) : '',
        }),
      }).catch(() => {});
    }
  };

  const startWork = async () => {
    const currentQueue = queue.length > 0 ? queue : (createCurrentBatch() ? [createCurrentBatch() as QueueBatch] : []);
    const currentTopicCount = currentQueue.reduce((sum, batch) => sum + batch.topics.length, 0);
    if (currentTopicCount === 0) {
      alert('ใส่หัวข้อ Content หรือเพิ่มงานเข้าคิวก่อนครับ');
      return;
    }
    const needsImage = currentQueue.some(batch => batch.mode !== 'post-only');
    const needsPost = currentQueue.some(batch => batch.mode !== 'image-only');
    if (needsImage && !hasKieKey) {
      alert('ยังไม่มี KIE API Key ใน Profile ที่เลือกครับ');
      return;
    }
    if (needsPost && !hasOpenRouterKey) {
      alert('ยังไม่มี OpenRouter API Key ใน Profile ที่เลือกครับ');
      return;
    }
    if (settings.saveDropbox && !hasDropboxAuth) {
      alert('ยังไม่มี Dropbox token ใน Profile ที่เลือกครับ');
      return;
    }
    if ((settings.saveLocal || settings.saveCsv) && !settings.localSaveDir.trim()) {
      alert('เลือกโฟลเดอร์ Save ลงเครื่องก่อนครับ เพราะต้องใช้บันทึกรูป/CSV/JSON');
      return;
    }
    if (settings.saveDropbox && !settings.dropboxFolderPath.trim()) {
      alert('ใส่ Dropbox Upload Path ก่อนครับ');
      return;
    }

    if (queue.length === 0) {
      setQueue(currentQueue);
      setTopicInput('');
    }

    const taskId = `page_stock_${Date.now()}`;
    const log = async (message: string) => {
      globalTaskStore.updateTask(taskId, { progress: message });
      await wait(180);
    };

    setIsRunning(true);
    globalTaskStore.addTask({
      id: taskId,
      title: `📮 ทำStockลงเพจ ${currentTopicCount} หัวข้อ`,
      category: 'page-stock',
      progress: 'กำลังเตรียมงาน...',
      status: 'running',
    });

    try {
      const runResults: PageStockResult[] = [];
      let doneCount = 0;

      await log(`1/10 ตรวจคิวงาน: พบ ${currentQueue.length} คิว รวม ${currentTopicCount} หัวข้อ`);
      for (const [batchIndex, batch] of currentQueue.entries()) {
        await log(`คิว ${batchIndex + 1}/${currentQueue.length}: เพจ "${batch.pageName}" · ${batch.topics.length} หัวข้อ · โหมด ${batch.mode}`);
        batch.topics.slice(0, 5).forEach((topic, topicIndex) => {
          globalTaskStore.updateTask(taskId, { progress: `หัวข้อ ${topicIndex + 1}/${batch.topics.length}: ${topic}` });
        });
        if (batch.topics.length > 5) {
          await log(`หัวข้อของคิวนี้ยังมีอีก ${batch.topics.length - 5} รายการ`);
        }
      }

      await log(`2/10 ตรวจ Profile API: ${activeProfile?.name || 'ไม่พบชื่อโปรไฟล์'}`);
      await log(`KIE API Key: ${hasKieKey ? 'พร้อมใช้งาน' : 'ไม่พบ key'} · OpenRouter API Key: ${hasOpenRouterKey ? 'พร้อมใช้งาน' : 'ไม่พบ key'} · Dropbox: ${hasDropboxAuth ? 'พร้อมใช้งาน' : 'ไม่พบ token'}`);

      const needsImage = currentQueue.some(batch => batch.mode !== 'post-only');
      const needsPost = currentQueue.some(batch => batch.mode !== 'image-only');

      if (needsImage) {
        await log(`3/10 ตั้งค่างานรูป: ใช้ KIE.AI model gpt-image-2-text-to-image`);
        await log(`ตั้งค่ารูป: aspect_ratio=${settings.aspectRatio}, resolution=${settings.resolution}`);
        await log('เตรียม request body สำหรับ /api/v1/jobs/createTask: model + input.prompt + input.aspect_ratio + input.resolution');
      } else {
        await log('3/10 ข้ามงานรูป: รอบนี้เลือกเฉพาะโพสต์');
      }

      if (needsPost) {
        await log(`4/10 ตั้งค่างานโพสต์: ใช้ OpenRouter model ${settings.openRouterModel}`);
        await log('เตรียม messages สำหรับเขียนโพสต์ตาม persona, ความยาว, hook และหัวข้อของแต่ละเพจ');
      } else {
        await log('4/10 ข้ามงานโพสต์: รอบนี้เลือกเฉพาะรูป');
      }

      await log('5/10 เริ่มรันจริงทีละหัวข้อ');
      for (const [batchIndex, batch] of currentQueue.entries()) {
        const page = PAGE_CONFIGS.find(item => item.name === batch.pageName) ?? selectedPage;
        for (const [topicIndex, topic] of batch.topics.entries()) {
          const itemNo = doneCount + 1;
          const imagePrompt = createImagePrompt(page, topic);
          const safeImagePrompt = createPolicySafeImagePrompt(page, topic);
          const postPrompt = createPostPrompt(page, topic);
          const resultBase: PageStockResult = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            created_at: new Date().toISOString(),
            page_name: page.name,
            topic,
            mode: batch.mode,
            status: 'completed',
            image_provider: settings.imageProvider,
            image_model: 'gpt-image-2-text-to-image',
            post_model: settings.openRouterModel,
            sheet_name: page.sheet_name,
            document_id: page.document_id,
            aspect_ratio: settings.aspectRatio,
            resolution: settings.resolution,
            dropbox_path: settings.dropboxFolderPath || page.dropbox_path,
            image_prompt: batch.mode !== 'post-only' ? imagePrompt : '',
            post_prompt: batch.mode !== 'image-only' ? postPrompt : '',
          };

          try {
            await log(`เริ่มหัวข้อ ${itemNo}/${currentTopicCount}: "${topic}" (คิว ${batchIndex + 1}/${currentQueue.length}, เพจ ${page.name})`);
            await log(`เตรียม prompt แล้ว: รูป ${imagePrompt.length.toLocaleString()} ตัวอักษร · โพสต์ ${postPrompt.length.toLocaleString()} ตัวอักษร`);

            let postText = '';
            if (batch.mode !== 'image-only') {
              await log(`เขียนโพสต์ด้วย OpenRouter: ${settings.openRouterModel}`);
              postText = await writePost(postPrompt);
              await log(`เขียนโพสต์เสร็จ: ${postText.length.toLocaleString()} ตัวอักษร`);
            } else {
              await log('ข้ามเขียนโพสต์: โหมดเฉพาะรูป');
            }

            let kieTaskId = '';
            let imageUrl = '';
            let finalImagePrompt = imagePrompt;
            if (batch.mode !== 'post-only') {
              await log('ส่งงานสร้างรูปไป KIE.AI');
              let kieResult;
              try {
                kieResult = await createKieImage(imagePrompt, log, 'prompt หลัก');
              } catch (kieError: any) {
                const message = kieError?.message || String(kieError);
                if (!isPolicyFailure(message)) throw kieError;
                await log(`KIE ตีกลับด้วย policy: ${message}`);
                await log('กำลัง retry ด้วย Safe Prompt แบบไม่สร้างใบหน้า/ตัวตน/ความเหมือนคนจริง');
                finalImagePrompt = safeImagePrompt;
                kieResult = await createKieImage(safeImagePrompt, log, 'safe prompt');
              }
              kieTaskId = kieResult.taskId;
              imageUrl = kieResult.imageUrl;
              await log(`KIE สร้างรูปเสร็จ: ${imageUrl}`);
            } else {
              await log('ข้ามสร้างรูป: โหมดเฉพาะโพสต์');
            }

            let localImagePath = '';
            if (settings.saveLocal && imageUrl) {
              await log(`Save รูปลงเครื่อง: ${settings.localSaveDir}`);
              localImagePath = await saveImageLocal(imageUrl, page, topic);
              await log(`Save รูปสำเร็จ: ${localImagePath}`);
            }

            let dropboxPath = '';
            let dropboxDirectUrl = '';
            if (settings.saveDropbox && imageUrl) {
              await log(`อัปโหลด Dropbox ไปที่: ${settings.dropboxFolderPath || page.dropbox_path}`);
              const dbx = await uploadDropbox(imageUrl, page, topic);
              dropboxPath = dbx.dropboxPath;
              dropboxDirectUrl = dbx.directUrl;
              await log(`Dropbox สำเร็จ: ${dropboxDirectUrl}`);
            }

            runResults.push({
              ...resultBase,
              image_prompt: finalImagePrompt,
              post_text: postText,
              kie_task_id: kieTaskId,
              kie_image_url: imageUrl,
              local_image_path: localImagePath,
              dropbox_path: dropboxPath || resultBase.dropbox_path,
              dropbox_direct_url: dropboxDirectUrl,
            });
            doneCount++;
            await log(`เสร็จหัวข้อ ${doneCount}/${currentTopicCount}: "${topic}"`);
          } catch (itemError: any) {
            const message = itemError?.message || String(itemError);
            runResults.push({
              ...resultBase,
              status: 'error',
              error: message,
            });
            doneCount++;
            await log(`หัวข้อ "${topic}" ล้มเหลว: ${message}`);
          }
        }
      }

      if (settings.saveDropbox) {
        await log(`6/10 ตรวจ Dropbox: อัปโหลดครบแล้วสำหรับหัวข้อที่มีรูปสำเร็จ`);
      } else {
        await log('6/10 ข้าม Dropbox: ปิดตัวเลือก Upload Dropbox');
      }

      if (settings.saveLocal) {
        await log(`7/10 ตรวจ Local Save: บันทึกรูปไว้ที่ ${settings.localSaveDir}`);
      } else {
        await log('7/10 ข้าม Save ลงเครื่อง');
      }

      await log('8/10 บันทึกผลลัพธ์ JSON');
      await persistResults(runResults);
      await log(`บันทึกผลลัพธ์แล้ว: ${runResults.length} รายการ`);

      if (settings.saveCsv) {
        await log('9/10 CSV พร้อมใช้งาน: กด Copy CSV หรือ Export CSV เพื่อดึงข้อมูลที่ทำเสร็จแล้ว');
      } else {
        await log('9/10 ข้าม CSV');
      }

      const okCount = runResults.filter(item => item.status === 'completed').length;
      const errorCount = runResults.length - okCount;
      await log(`10/10 สรุปงาน: สำเร็จ ${okCount}/${runResults.length}, ผิดพลาด ${errorCount}`);
      globalTaskStore.updateTask(taskId, {
        status: errorCount > 0 && okCount === 0 ? 'error' : 'completed',
        progress: `ทำStockลงเพจเสร็จ: สำเร็จ ${okCount}/${runResults.length}, ผิดพลาด ${errorCount}`,
      });
    } catch (error: any) {
      const message = `ล้มเหลว: ${error?.message || String(error)}`;
      globalTaskStore.updateTask(taskId, { status: 'error', progress: message });
    } finally {
      setIsRunning(false);
    }
  };

  const copyPayload = async () => {
    if (payload.length === 0) return;
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const downloadPayload = () => {
    if (!selectedPage || payload.length === 0) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `page-stock-${selectedPage.name}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const copyCsv = async () => {
    if (csvRows.length === 0) return;
    await navigator.clipboard.writeText(csvPayload);
    setCsvCopied(true);
    window.setTimeout(() => setCsvCopied(false), 1500);
  };

  const downloadCsv = () => {
    if (!selectedPage || csvRows.length === 0) return;
    const blob = new Blob(['\uFEFF' + csvPayload], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `page-stock-${selectedPage.name}-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const pickLocalFolder = async () => {
    const res = await fetch('/api/pick-folder', { method: 'POST' });
    const data = await res.json();
    if (data?.success && data.dir) updateSettings({ localSaveDir: data.dir });
  };

  const renderManualBrainField = (
    field: ManualBrainEditableField,
    title: string,
    description: string,
    options: { wide?: boolean; mono?: boolean } = {},
  ) => {
    if (!manualBrain) return null;
    const valueText = manualBrainFieldToText(manualBrain, field);
    const isEditing = manualBrainEditingField === field;
    const lines = field === 'pageName' || field === 'summary' || field === 'rawAnalysis'
      ? [valueText || 'ยังไม่มีข้อมูล']
      : valueText.split('\n').filter(Boolean);

    return (
      <article className={options.wide ? 'wide' : ''}>
        <div className="page-stock-brain-field-head">
          <div>
            <h4>{title}</h4>
            <small>{description}</small>
          </div>
          <button
            type="button"
            className="page-stock-mini-button"
            onClick={() => startEditManualBrainField(field)}
            disabled={Boolean(manualBrainEditingField && !isEditing)}
          >
            แก้ไข
          </button>
        </div>
        {isEditing ? (
          <div className="page-stock-brain-editor">
            <textarea
              className="page-stock-textarea"
              value={manualBrainDraft}
              onChange={event => setManualBrainDraft(event.target.value)}
              rows={field === 'summary' || field === 'pageName' ? 4 : field === 'rawAnalysis' ? 12 : 8}
              placeholder={field === 'keywords' ? 'ใส่ keyword คั่นด้วยบรรทัดใหม่หรือ comma' : 'ใส่ข้อมูล บรรทัดละ 1 รายการ'}
            />
            <div>
              <button type="button" className="page-stock-primary" onClick={saveManualBrainField}>บันทึกเข้าสมอง</button>
              <button type="button" onClick={cancelEditManualBrainField}>ยกเลิก</button>
            </div>
          </div>
        ) : field === 'rawAnalysis' ? (
          <pre className="page-stock-brain-raw">{valueText || 'ยังไม่มี raw analysis'}</pre>
        ) : field === 'pageName' || field === 'summary' ? (
          <p>{valueText || 'ยังไม่มีข้อมูล'}</p>
        ) : (
          <ul className={options.mono ? 'page-stock-brain-mono-list' : undefined}>
            {(lines.length ? lines : ['ยังไม่มีข้อมูล']).map((item, index) => <li key={`${field}-${index}`}>{item}</li>)}
          </ul>
        )}
      </article>
    );
  };

  const renderManualBrainInfographic = () => {
    if (!manualBrain) return null;
    const map = getBrainCapabilityMap(manualBrain);
    return (
      <div className="page-stock-brain-map" aria-label="ภาพรวมแกนสมอง">
        <div className="page-stock-brain-map-core">
          <span>Brain Core</span>
          <strong>{manualBrain.pageName}</strong>
          <p>{limitText(manualBrain.summary, 160)}</p>
          <div>
            <b>{manualBrain.sourceRowCount}</b><small>CSV Prompt</small>
            <b>{manualBrain.trendRowCount || 0}</b><small>Trend rows</small>
          </div>
        </div>
        <div className="page-stock-brain-map-panel keywords">
          <h4>Keyword Memory</h4>
          <div className="page-stock-chip-cloud">
            {(map.primaryKeywords.length ? map.primaryKeywords : ['ยังไม่มี keyword']).map(item => <span key={item}>{item}</span>)}
          </div>
        </div>
        <div className="page-stock-brain-map-panel trends">
          <h4>Trend Radar</h4>
          <div className="page-stock-chip-cloud accent">
            {(map.trendSeeds.length ? map.trendSeeds.slice(0, 12) : ['ยังจับ trend seed ไม่ได้']).map(item => <span key={item}>{item}</span>)}
          </div>
        </div>
        <div className="page-stock-brain-map-panel patterns">
          <h4>Content Patterns</h4>
          <ul>{(map.primaryPatterns.length ? map.primaryPatterns : ['ยังไม่มี pattern']).map((item, index) => <li key={index}>{item}</li>)}</ul>
        </div>
        <div className="page-stock-brain-map-panel rules">
          <h4>Prompt Engine</h4>
          <ul>{(map.promptRules.length ? map.promptRules : ['ยังไม่มีกฎ prompt']).map((item, index) => <li key={index}>{item}</li>)}</ul>
        </div>
        <div className="page-stock-brain-map-panel guardrails">
          <h4>Guardrails</h4>
          <ul>{(map.guardrails.length ? map.guardrails : ['ยังไม่มีข้อห้าม']).map((item, index) => <li key={index}>{item}</li>)}</ul>
        </div>
        <div className="page-stock-brain-map-panel meters">
          <h4>Capability Meter</h4>
          {map.capabilities.map(item => (
            <div className="page-stock-brain-meter" key={item.label}>
              <div><span>{item.label}</span><small>{item.detail}</small></div>
              <meter min="0" max="100" value={item.value} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!selectedPage) {
    return (
      <div className="page-stock-empty">
        <h1>📮 สร้างรูปด้วยAPI</h1>
        <p>ยังอ่าน config จากไฟล์ workflow ไม่ได้</p>
      </div>
    );
  }

  return (
    <div className="page-stock">
      <section className="page-stock-hero">
        <div>
          <p className="page-stock-kicker">All Pages Stock Studio</p>
          <h1>📮 ทำStockลงเพจ</h1>
          <p className="page-stock-subtitle">เลือกเพจ วางหัวข้อ แล้วเตรียมคิวสร้างรูป Stock กับโพสต์จาก config เดิมของ n8n</p>
        </div>
        <div className="page-stock-stats">
          <div>
            <strong>{PAGE_CONFIGS.length}</strong>
            <span>เพจ</span>
          </div>
          <div>
            <strong>{topics.length}</strong>
            <span>หัวข้อรอบนี้</span>
          </div>
          <div>
            <strong>{totalQueuedTopics}</strong>
            <span>คิวรวม</span>
          </div>
        </div>
      </section>

      <div className="page-stock-tabs" role="tablist" aria-label="เลือกโหมดทำ Stock ลงเพจ">
        <button
          type="button"
          className={builderTab === 'api' ? 'active' : ''}
          onClick={() => setBuilderTab('api')}
          role="tab"
          aria-selected={builderTab === 'api'}
        >
          สร้างรูปด้วยAPI
        </button>
        <button
          type="button"
          className={builderTab === 'prompt' ? 'active' : ''}
          onClick={() => setBuilderTab('prompt')}
          role="tab"
          aria-selected={builderTab === 'prompt'}
        >
          สร้างรูปเองด้วยPrompt
        </button>
        <button
          type="button"
          className={builderTab === 'local-image-article' ? 'active' : ''}
          onClick={() => setBuilderTab('local-image-article')}
          role="tab"
          aria-selected={builderTab === 'local-image-article'}
        >
          เขียนบทความจากรูป Dropbox
        </button>
        <button
          type="button"
          className={builderTab === 'clickbait' ? 'active' : ''}
          onClick={() => setBuilderTab('clickbait')}
          role="tab"
          aria-selected={builderTab === 'clickbait'}
        >
          สร้าง โพส clickbait
        </button>
        <button
          type="button"
          className={builderTab === 'csv-clickbait' ? 'active' : ''}
          onClick={() => setBuilderTab('csv-clickbait')}
          role="tab"
          aria-selected={builderTab === 'csv-clickbait'}
        >
          CSV → Clickbait
        </button>
        <button
          type="button"
          className={builderTab === 'canvas' ? 'active' : ''}
          onClick={() => setBuilderTab('canvas')}
          role="tab"
          aria-selected={builderTab === 'canvas'}
        >
          Canvas
        </button>
      </div>

      {builderTab === 'api' ? (
      <div className="page-stock-layout">
        <aside className="page-stock-panel page-stock-pages">
          <div className="page-stock-panel-head">
            <h2>เลือกเพจ</h2>
            <span>{filteredPages.length}</span>
          </div>
          <input
            className="page-stock-search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="ค้นหาเพจ"
          />
          <div className="page-stock-page-list">
            {filteredPages.map(page => (
              <button
                key={page.name}
                className={`page-stock-page ${page.name === selectedPage.name ? 'page-stock-page-active' : ''}`}
                onClick={() => setSelectedPageName(page.name)}
              >
                <span>{page.name}</span>
                <small>{page.post_length}</small>
              </button>
            ))}
          </div>
        </aside>

        <main className="page-stock-workspace">
          <section className="page-stock-panel page-stock-settings">
            <div className="page-stock-panel-head">
              <h2>ตั้งค่า API และ Output</h2>
              <span>{activeProfile?.name || 'ยังไม่ได้เลือก Profile'}</span>
            </div>

            <div className="page-stock-settings-grid">
              <label>
                <span>Profile API</span>
                <select
                  value={settings.profileId}
                  onChange={event => updateSettings({ profileId: event.target.value })}
                >
                  {profiles.length === 0 && <option value="">ไม่พบ Profile</option>}
                  {profiles.map(profile => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
                <small className={hasKieKey && hasOpenRouterKey ? 'ok' : 'warn'}>
                  KIE {hasKieKey ? 'พร้อม' : 'ยังไม่มี key'} · OpenRouter {hasOpenRouterKey ? 'พร้อม' : 'ยังไม่มี key'}
                </small>
              </label>

              <label>
                <span>API สร้างรูป</span>
                <select
                  value={settings.imageProvider}
                  onChange={event => updateSettings({ imageProvider: event.target.value as ImageProvider })}
                >
                  <option value="kie-gpt-image-2">KIE.AI · GPT Image-2 Text to Image</option>
                </select>
                <small>endpoint: /api/v1/jobs/createTask</small>
              </label>

              <label>
                <span>โมเดลเขียนโพสต์</span>
                <select
                  value={settings.openRouterModel}
                  onChange={event => updateSettings({ openRouterModel: event.target.value })}
                >
                  <option value="google/gemini-2.5-pro">Gemini 2.5 Pro · เขียนดี</option>
                  <option value="google/gemini-2.5-flash">Gemini 2.5 Flash · เร็ว</option>
                  <option value="openai/gpt-4o">GPT-4o</option>
                </select>
                <small>ใช้ OpenRouter API จาก Profile</small>
              </label>

              <label>
                <span>สัดส่วนรูป</span>
                <select
                  value={settings.aspectRatio}
                  onChange={event => updateSettings({ aspectRatio: event.target.value as AspectRatio })}
                >
                  <option value="1:1">1:1 Facebook Stock</option>
                  <option value="auto">auto</option>
                  <option value="9:16">9:16</option>
                  <option value="16:9">16:9</option>
                  <option value="4:3">4:3</option>
                  <option value="3:4">3:4</option>
                </select>
              </label>

              <label>
                <span>Resolution</span>
                <select
                  value={settings.resolution}
                  onChange={event => updateSettings({ resolution: event.target.value as ImageResolution })}
                >
                  <option value="1K">1K</option>
                  <option value="2K">2K</option>
                  <option value="4K">4K</option>
                </select>
                <small>ถ้าเลือก auto ใช้ 1K จะปลอดภัยสุด</small>
              </label>

              <label className="wide">
                <span>โฟลเดอร์ Save ลงเครื่อง</span>
                <div className="page-stock-folder-row">
                  <input
                    value={settings.localSaveDir}
                    onChange={event => updateSettings({ localSaveDir: event.target.value })}
                    placeholder="เลือกโฟลเดอร์สำหรับเก็บรูปและ CSV"
                  />
                  <button type="button" onClick={pickLocalFolder}>เลือก</button>
                </div>
              </label>

              <label className="wide">
                <span>Dropbox Upload Path</span>
                <input
                  value={settings.dropboxFolderPath}
                  onChange={event => updateSettings({ dropboxFolderPath: event.target.value })}
                  placeholder="/info_ลุงตี่ทุกอัน/ชื่อเพจ"
                />
                <small className={hasDropboxAuth ? 'ok' : 'warn'}>
                  Dropbox {hasDropboxAuth ? 'พร้อมอัปโหลด' : 'ยังไม่มี token ใน Profile'} · ใส่แค่ path โฟลเดอร์ ระบบจะอัปโหลดเข้า path นี้แล้วสร้าง link แบบ dl=1 ให้อัตโนมัติหลังรัน
                </small>
              </label>
            </div>

            <div className="page-stock-checks">
              <label>
                <input type="checkbox" checked={settings.saveLocal} onChange={event => updateSettings({ saveLocal: event.target.checked })} />
                <span>Save รูปลงเครื่อง</span>
              </label>
              <label>
                <input type="checkbox" checked={settings.saveDropbox} onChange={event => updateSettings({ saveDropbox: event.target.checked })} />
                <span>Upload Dropbox และใช้ link dl=1</span>
              </label>
              <label>
                <input type="checkbox" checked={settings.saveCsv} onChange={event => updateSettings({ saveCsv: event.target.checked })} />
                <span>Save CSV รวมข้อมูลสำคัญ</span>
              </label>
            </div>

            <div className="page-stock-runbar">
              <button
                className="page-stock-run-btn"
                disabled={isRunning || runnableCount === 0}
                onClick={startWork}
              >
                {isRunning ? 'กำลังทำงาน...' : `เริ่มทำงาน ${runnableCount} หัวข้อ`}
              </button>
              <span>กดปุ่มนี้เพื่อเริ่มจากคิวด้านขวา ถ้ายังไม่ได้เพิ่มคิว ระบบจะใช้หัวข้อที่พิมพ์อยู่รอบนี้</span>
            </div>
          </section>

          <section className="page-stock-panel page-stock-composer">
            <div className="page-stock-panel-head">
              <h2>{selectedPage.name}</h2>
              <span>{selectedPage.item_limit} งาน/รอบ</span>
            </div>

            <div className="page-stock-meta-grid">
              <div>
                <span>Sheet</span>
                <strong>{selectedPage.sheet_name}</strong>
              </div>
              <div>
                <span>เครดิตรูป</span>
                <strong>{selectedPage.image_credit || 'ไม่มีเครดิต'}</strong>
              </div>
              <div>
                <span>สำนวนโพสต์</span>
                <strong>{selectedPage.post_persona}</strong>
              </div>
            </div>

            <div className="page-stock-mode">
              <button className={mode === 'image-and-post' ? 'active' : ''} onClick={() => setMode('image-and-post')}>รูป + โพสต์</button>
              <button className={mode === 'image-only' ? 'active' : ''} onClick={() => setMode('image-only')}>เฉพาะรูป</button>
              <button className={mode === 'post-only' ? 'active' : ''} onClick={() => setMode('post-only')}>เฉพาะโพสต์</button>
            </div>

            <label className="page-stock-input-label" htmlFor="page-stock-topics">หัวข้อ Content</label>
            <textarea
              id="page-stock-topics"
              className="page-stock-textarea"
              value={topicInput}
              onChange={event => setTopicInput(event.target.value)}
              placeholder={`ใส่หัวข้อละ 1 บรรทัด\nเช่น\n5 บทเรียนชีวิตที่คนวัย 40 ควรรู้\nทำไมการอ่านหนังสือวันละ 10 นาทีถึงเปลี่ยนชีวิตได้`}
            />

            <div className="page-stock-actions">
              <button className="page-stock-primary" disabled={topics.length === 0} onClick={addToQueue}>เพิ่มเข้าคิว</button>
              <button disabled={payload.length === 0} onClick={copyPayload}>{copied ? 'คัดลอกแล้ว' : 'Copy JSON'}</button>
              <button disabled={payload.length === 0} onClick={downloadPayload}>Export JSON</button>
              <button disabled={csvRows.length === 0} onClick={copyCsv}>{csvCopied ? 'คัดลอก CSV แล้ว' : 'Copy CSV'}</button>
              <button disabled={csvRows.length === 0} onClick={downloadCsv}>Export CSV</button>
            </div>
          </section>

          <section className="page-stock-panel page-stock-preview">
            <div className="page-stock-panel-head">
              <h2>Preview</h2>
              <span>{previewTopic}</span>
            </div>
            <div className="page-stock-preview-grid">
              {mode !== 'post-only' && (
                <article>
                  <h3>Prompt รูป</h3>
                  <pre>{previewImagePrompt}</pre>
                </article>
              )}
              {mode !== 'post-only' && (
                <article>
                  <h3>KIE Request</h3>
                  <pre>{JSON.stringify(previewKieRequest, null, 2)}</pre>
                </article>
              )}
              {mode !== 'image-only' && (
                <article>
                  <h3>Prompt โพสต์</h3>
                  <pre>{previewPostPrompt}</pre>
                </article>
              )}
            </div>
          </section>
        </main>

        <aside className="page-stock-panel page-stock-queue">
          <div className="page-stock-panel-head">
            <h2>คิวงาน</h2>
            <button onClick={() => setQueue([])} disabled={queue.length === 0}>ล้าง</button>
          </div>
          <div className="page-stock-queue-start">
            <button disabled={isRunning || runnableCount === 0} onClick={startWork}>
              {isRunning ? 'กำลังทำงาน...' : `เริ่มทำงาน ${runnableCount} หัวข้อ`}
            </button>
          </div>
          {queue.length === 0 ? (
            <div className="page-stock-queue-empty">ยังไม่มีคิว</div>
          ) : (
            <div className="page-stock-queue-list">
              {queue.map(batch => (
                <div key={batch.id} className="page-stock-queue-item">
                  <div>
                    <strong>{batch.pageName}</strong>
                    <span>{batch.topics.length} หัวข้อ · {batch.createdAt}</span>
                  </div>
                  <small>{batch.mode === 'image-and-post' ? 'รูป + โพสต์' : batch.mode === 'image-only' ? 'เฉพาะรูป' : 'เฉพาะโพสต์'} · {batch.postModel}</small>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
      ) : builderTab === 'prompt' ? (
        <section className="page-stock-panel page-stock-manual-prompt">
          <div className="page-stock-panel-head">
            <h2>สร้างรูปเองด้วยPrompt</h2>
            <span>{manualBrain ? `สมอง: ${manualBrain.pageName}` : 'ยังไม่มีสมอง Prompt'}</span>
          </div>
          <div className="page-stock-manual-grid">
            <div className="page-stock-manual-card">
              <h3>1. สร้างสมองจาก CSV</h3>
              <p>อัปโหลด CSV Prompt ที่ใช้งานได้ และเสริมด้วย CSV เทรนด์ล่าสุดได้ถ้ามี เพื่อให้ AI สร้างสมองที่เข้าใจทั้ง pattern เดิมและกระแสตอนนี้</p>
              <label>
                <span>ชื่อสมอง Prompt</span>
                <input
                  className="page-stock-manual-input"
                  value={manualBrainKey}
                  onChange={event => setManualBrainKey(event.target.value)}
                  placeholder="ระบบจะตั้งจากชื่อไฟล์ให้ หรือพิมพ์เองได้"
                />
              </label>
              <label>
                <span>CSV Prompt ที่ใช้งานได้</span>
                <label className="page-stock-upload">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={event => handleManualCsvUpload(event.target.files?.[0])}
                  />
                  <span>{manualCsvName || 'เลือกไฟล์ CSV Prompt'}</span>
                </label>
              </label>
              <label className="page-stock-upload">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={event => handleManualTrendCsvUpload(event.target.files?.[0])}
                />
                <span>{manualTrendCsvName || 'เลือก CSV เทรนด์ล่าสุด (ไม่บังคับ)'}</span>
              </label>
              {manualTrendCsvText.trim() && (
                <div className="page-stock-trend-box">
                  <strong>ใช้เทรนด์นี้ตอนสร้างสมอง</strong>
                  <span>{manualTrendRowsCount} แถว · {manualTrendCsvName}</span>
                </div>
              )}
              <label>
                <span>โมเดลสร้างสมอง</span>
                <select
                  className="page-stock-manual-input"
                  value={manualBrainModel}
                  onChange={event => setManualBrainModel(event.target.value)}
                >
                  {MANUAL_BRAIN_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                {MANUAL_BRAIN_MODELS.find(m => m.id === manualBrainModel) && (
                  <small style={{ color: '#9ca3af', marginTop: 2 }}>
                    {MANUAL_BRAIN_MODELS.find(m => m.id === manualBrainModel)!.note}
                  </small>
                )}
              </label>
              <button
                className="page-stock-primary"
                disabled={!manualCsvText.trim() || !hasOpenRouterKey || manualHasRunningTask}
                onClick={startAnalyzeManualCsv}
              >
                วิเคราะห์ CSV และ Save เป็นสมอง
              </button>
              {manualBrain && (
                <div className="page-stock-brain-box">
                  <strong>{manualBrain.summary}</strong>
                  <span>{manualBrain.sourceRowCount} แถว · เทรนด์ {manualBrain.trendRowCount || 0} แถว · อัปเดต {new Date(manualBrain.updatedAt).toLocaleString('th-TH')}</span>
                </div>
              )}
              {Object.keys(manualBrains).length > 0 && (
                <label>
                  <span>โหลดสมองที่เคย Save</span>
                  <select
                    className="page-stock-manual-input"
                    value={manualBrainKey}
                    onChange={event => setManualBrainKey(event.target.value)}
                  >
                    {Object.entries(manualBrains).map(([key, brain]) => (
                      <option key={key} value={key}>{brain.pageName || key}</option>
                    ))}
                  </select>
                </label>
              )}
              <button
                className="page-stock-danger"
                disabled={!manualBrain}
                onClick={deleteManualBrain}
              >
                ลบสมองนี้
              </button>
            </div>

            <div className="page-stock-manual-card">
              <h3>2. สร้างหัวข้อ</h3>
              <p>ใส่จำนวนที่ต้องการ ระบบจะแบ่งส่งให้ AI ทีละชุด โดยใช้สมองที่มี keyword, trend insight, สำนวน และ pattern prompt แล้ว</p>
              <label>
                <span>โมเดลสร้างหัวข้อ</span>
                <select
                  className="page-stock-manual-input"
                  value={manualTopicModel}
                  onChange={event => setManualTopicModel(event.target.value)}
                >
                  {MANUAL_TOPIC_PROMPT_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </label>
              <div className="page-stock-number-row">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={manualTopicCount}
                  onChange={event => setManualTopicCount(event.target.value)}
                  placeholder="จำนวนหัวข้อ"
                />
                <button
                  className="page-stock-primary"
                  disabled={!manualBrain || !hasOpenRouterKey || manualHasRunningTask || !Number(manualTopicCount)}
                  onClick={startGenerateManualTopics}
                >
                  สร้างหัวข้อ
                </button>
              </div>
              <div className="page-stock-manual-actions">
                <button
                  className="page-stock-danger"
                  disabled={!manualHasRunningTask}
                  onClick={stopManualTask}
                >
                  หยุดสร้างหัวข้อ
                </button>
                <button disabled={!manualHasRunningTask} onClick={toggleManualPause}>
                  {manualPaused ? 'Resume' : 'Pause'}
                </button>
              </div>
            </div>

            {manualBrain && (
              <div className="page-stock-manual-card page-stock-manual-wide">
                <div className="page-stock-manual-headline">
                  <h3>แผงตรวจสมองแบบละเอียด</h3>
                  <span>{manualBrain.pageName} · แก้ไขแล้วบันทึกกลับเข้าสมองได้</span>
                </div>
                <div className="page-stock-brain-audit-summary">
                  <span>ไฟล์ต้นทาง: {manualBrain.sourceFileName || 'ไม่ระบุ'}</span>
                  <span>CSV Prompt {manualBrain.sourceRowCount} แถว</span>
                  <span>CSV Trend {manualBrain.trendRowCount || 0} แถว</span>
                  <span>Trend seeds: {extractTrendTopicSeeds(manualBrain).slice(0, 12).join(', ') || 'ยังจับไม่ได้'}</span>
                  <span>อัปเดต {new Date(manualBrain.updatedAt).toLocaleString('th-TH')}</span>
                </div>
                {renderManualBrainInfographic()}
                <div className="page-stock-brain-detail-grid">
                  {renderManualBrainField('pageName', 'ชื่อสมอง / เพจ', 'ใช้เป็นชื่ออ้างอิงตอนสร้างหัวข้อและ prompt')}
                  {renderManualBrainField('summary', 'สรุปสมอง', 'ภาพรวมที่ AI ถอดได้จาก CSV และ trend', { wide: true })}
                  {renderManualBrainField('keywords', 'Keyword หลักที่สมองจำไว้', 'คำแกนกลางที่ generator ใช้เป็น seed สร้างหัวข้อ')}
                  {renderManualBrainField('contentAngles', 'Pattern / Angle ที่สมองจับได้', 'ประเภทหัวข้อที่ควรทำ เช่น How-to, Comparison, Use Case')}
                  {renderManualBrainField('topicPatterns', 'โครงสร้างหัวข้อ', 'รูปแบบการตั้งหัวข้อที่ควรเลียนแบบจาก CSV เดิม')}
                  {renderManualBrainField('trendInsights', 'เทรนด์ที่สมองจับได้', 'สิ่งที่มาจาก CSV เทรนด์ล่าสุด ควรเป็นหัวใจของหัวข้อใหม่')}
                  {renderManualBrainField('toneGuidelines', 'สำนวนและน้ำเสียง', 'วิธีเล่า ภาษา และบุคลิกของเพจ')}
                  {renderManualBrainField('promptRules', 'กฎการเขียน Prompt รูป', 'โครงสร้าง prompt ที่ต้องรักษาเวลาสร้าง prompt รูป')}
                  {renderManualBrainField('visualStyleRules', 'กฎภาพ / สไตล์ภาพ', 'โทนสี layout ฟอนต์ องค์ประกอบ และสุนทรียศาสตร์ที่ถอดมา')}
                  {renderManualBrainField('negativeRules', 'ข้อห้าม', 'สิ่งที่ไม่ควรทำตอนสร้างหัวข้อหรือ prompt')}
                  {renderManualBrainField('examplePrompts', 'ตัวอย่าง Prompt ที่สมองจำไว้', 'ตัวอย่างที่ใช้เป็น pattern อ้างอิงตอนสร้าง prompt รูป', { wide: true, mono: true })}
                  {renderManualBrainField('feedbackNotes', 'Feedback ที่เจ้าของเพจสอนเพิ่ม', 'โน้ตที่คุณเพิ่มเองและถูกส่งเข้า workflow ต่อไป')}
                  {renderManualBrainField('rawAnalysis', 'Raw Analysis จาก AI', 'คำตอบดิบจากตอนวิเคราะห์สมอง เก็บไว้ตรวจย้อนหลัง', { wide: true, mono: true })}
                </div>
              </div>
            )}

            <div className="page-stock-manual-card page-stock-manual-wide">
              <h3>3. ติชมและสอนสมองเพิ่ม</h3>
              <textarea
                className="page-stock-textarea page-stock-feedback"
                value={manualFeedback}
                onChange={event => setManualFeedback(event.target.value)}
                placeholder="เขียนติชม/แนวทางเพิ่ม เช่น หัวข้อควรคมกว่านี้, ห้ามใช้คำซ้ำ, Prompt ต้องเน้นแสงแบบไหน..."
              />
              <button disabled={!manualFeedback.trim()} onClick={saveManualFeedbackToBrain}>Save Feedback เข้าสมอง</button>
            </div>

            <div className="page-stock-manual-card page-stock-manual-wide">
              <div className="page-stock-manual-headline">
                <h3>หัวข้อที่สร้างแล้ว</h3>
                <span>{editableManualTopics.length} หัวข้อ</span>
              </div>
              <textarea
                className="page-stock-textarea page-stock-topics-editor"
                value={manualTopicsText}
                onChange={event => {
                  setManualTopicsText(event.target.value);
                  setManualTopics(getTopics(event.target.value));
                }}
                placeholder={`พิมพ์หัวข้อเองได้ หัวข้อละ 1 บรรทัด\nหรือกดสร้างหัวข้อ แล้วมาแก้ตรงนี้ก่อนสร้าง Prompt`}
              />
              <label>
                <span>โมเดลสร้าง Prompt รูป</span>
                <select
                  className="page-stock-manual-input"
                  value={manualPromptModel}
                  onChange={event => setManualPromptModel(event.target.value)}
                >
                  {MANUAL_TOPIC_PROMPT_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </label>
              <div className="page-stock-manual-actions">
                <button
                  className="page-stock-primary"
                  disabled={editableManualTopics.length === 0 || !manualBrain || !hasOpenRouterKey || manualHasRunningTask}
                  onClick={startGenerateManualPrompts}
                >
                  สร้างPrompt สร้างรูป
                </button>
                <button
                  className="page-stock-danger"
                  disabled={!manualHasRunningTask}
                  onClick={stopManualTask}
                >
                  หยุดสร้างPrompt
                </button>
              </div>
            </div>

            <div className="page-stock-manual-card page-stock-manual-wide">
              <div className="page-stock-manual-headline">
                <h3>ผลลัพธ์ Prompt รูป</h3>
                <span>{manualPromptResults.length} รายการ</span>
              </div>
              <div className="page-stock-result-list page-stock-prompt-results">
                {manualPromptResults.length === 0 ? (
                  <em>ยังไม่มี Prompt รูป</em>
                ) : manualPromptResults.map((result, index) => (
                  <article key={`${result.topic}-${index}`}>
                    <strong>{index + 1}. {result.topic}</strong>
                    <p>{result.imagePrompt}</p>
                  </article>
                ))}
              </div>
              <div className="page-stock-manual-actions">
                <button disabled={manualPromptResults.length === 0} onClick={copyManualPrompts}>
                  {manualPromptsCopied ? 'คัดลอกแล้ว' : 'คัดลอก Prompt ทั้งหมด'}
                </button>
                <button disabled={manualPromptResults.length === 0} onClick={downloadManualPromptCsv}>
                  Export CSV: หัวข้อ | Prompt สร้างรูป
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : builderTab === 'local-image-article' ? (
        <section className="page-stock-panel page-stock-manual-prompt">
          <div className="page-stock-panel-head">
            <h2>เขียนบทความจากรูป Dropbox</h2>
            <span>{localImageItems.length} รูป · เสร็จ {localImageDoneCount}</span>
          </div>
          <div className="page-stock-manual-grid">
            <div className="page-stock-manual-card">
              <h3>1. ดึงรูปจาก Dropbox</h3>
              <p>ใส่ path โฟลเดอร์ Dropbox เหมือนรันบอท Flow ระบบจะดึงรูป สร้าง shared link และแปลงเป็น dl=1 ใน CSV ให้เอง</p>
              <label>
                <span>Dropbox Folder Path</span>
                <input
                  className="page-stock-manual-input"
                  value={localImageDropboxPath}
                  onChange={event => setLocalImageDropboxPath(event.target.value)}
                  placeholder="/หยก/set3"
                />
              </label>
              <div className="page-stock-manual-actions">
                <button
                  className="page-stock-primary"
                  disabled={localImageScanning || localImageRunning || !localImageDropboxPath.trim() || !hasDropboxAuth}
                  onClick={scanLocalImageDropboxFolder}
                >
                  {localImageScanning ? 'กำลังดึงรูป...' : 'ดึงรูปจาก Dropbox'}
                </button>
                <button
                  disabled={localImageItems.length === 0}
                  onClick={() => setLocalImageItems(prev => prev.map(item => ({ ...item, selected: true })))}
                >
                  เลือกทั้งหมด
                </button>
                <button
                  disabled={localImageItems.length === 0}
                  onClick={() => setLocalImageItems(prev => prev.map(item => ({ ...item, selected: false })))}
                >
                  ยกเลิกทั้งหมด
                </button>
                <button
                  className="page-stock-danger"
                  disabled={localImageRunning || localImageItems.length === 0}
                  onClick={() => setLocalImageItems([])}
                >
                  ล้างรูป
                </button>
              </div>
              <div className="page-stock-brain-box">
                <strong>{hasDropboxAuth ? 'Dropbox พร้อมใช้งาน' : 'ยังไม่พบ Dropbox token'}</strong>
                <span>ใช้ token จาก Profile API ที่เลือกอยู่</span>
              </div>
            </div>

            <div className="page-stock-manual-card">
              <h3>2. Prompt/สมองแบบรันบอท Flow</h3>
              <p>เลือกสมองเขียนโพส หรืออัปโหลด CSV ตัวอย่างให้ AI แกะ pattern แล้วสร้างสมองใหม่ได้</p>
              {Object.keys(localImageBrains).length > 0 && (
                <label>
                  <span>เลือกสมองเขียนโพส</span>
                  <select
                    className="page-stock-manual-input"
                    value={localImageBrainKey}
                    onChange={event => applyLocalImageBrain(event.target.value)}
                  >
                    {Object.entries(localImageBrains).map(([key, brain]) => (
                      <option key={key} value={key}>{brain.name || key}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                <span>สร้างสมองใหม่จาก CSV ตัวอย่างโพส</span>
                <label className="page-stock-upload">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={event => handleLocalImageBrainCsvUpload(event.target.files?.[0])}
                  />
                  <span>{localImageBrainCsvName || 'เลือกไฟล์ CSV ที่เคยใช้เขียนโพส'}</span>
                </label>
              </label>
              {localImageBrainCsvText.trim() && (
                <div className="page-stock-trend-box">
                  <strong>พร้อมวิเคราะห์ CSV</strong>
                  <span>{localImageBrainRowsCount} แถว · {localImageBrainCsvName}</span>
                </div>
              )}
              <div className="page-stock-manual-actions">
                <button
                  className="page-stock-primary"
                  disabled={!localImageBrainCsvText.trim() || !getOpenRouterKeyForLocalImage() || localImageBrainAnalyzing}
                  onClick={startAnalyzeLocalImageBrainCsv}
                >
                  {localImageBrainAnalyzing ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ CSV และ Save เป็นสมอง'}
                </button>
                <button
                  className="page-stock-danger"
                  disabled={!localImageBrain}
                  onClick={deleteLocalImageBrain}
                >
                  ลบสมองนี้
                </button>
              </div>
              {localImageBrain && (
                <div className="page-stock-brain-box">
                  <strong>{localImageBrain.summary}</strong>
                  <span>{localImageBrain.sourceRowCount} แถว · อัปเดต {new Date(localImageBrain.updatedAt).toLocaleString('th-TH')}</span>
                </div>
              )}
              <label>
                <span>โมเดล OpenRouter สำหรับสมอง/เขียนโพส</span>
                <select
                  className="page-stock-manual-input"
                  value={localImageModel}
                  onChange={event => setLocalImageModel(event.target.value)}
                >
                  {LOCAL_IMAGE_ARTICLE_MODELS.map(model => (
                    <option key={model.id} value={model.id}>{model.label}</option>
                  ))}
                </select>
                <small>
                  {LOCAL_IMAGE_ARTICLE_MODELS.find(model => model.id === localImageModel)?.note || localImageModel}
                </small>
              </label>
              <textarea
                className="page-stock-textarea page-stock-feedback"
                value={localImagePrompt}
                onChange={event => setLocalImagePrompt(event.target.value)}
                placeholder="ใส่ System Prompt สำหรับให้ AI อ่านรูปและเขียนบทความ"
              />
              {localImageBrain && (
                <div className="page-stock-brain-detail-grid">
                  <article>
                    <h4>กลุ่มลูกค้า/บริบท</h4>
                    <ul>{(localImageBrain.audienceInsights.length ? localImageBrain.audienceInsights : ['ยังไม่มีข้อมูล']).slice(0, 5).map((item, index) => <li key={index}>{item}</li>)}</ul>
                  </article>
                  <article>
                    <h4>สำนวน</h4>
                    <ul>{(localImageBrain.toneGuidelines.length ? localImageBrain.toneGuidelines : ['ยังไม่มีข้อมูล']).slice(0, 5).map((item, index) => <li key={index}>{item}</li>)}</ul>
                  </article>
                  <article>
                    <h4>โครงสร้างโพส</h4>
                    <ul>{(localImageBrain.structureRules.length ? localImageBrain.structureRules : ['ยังไม่มีข้อมูล']).slice(0, 5).map((item, index) => <li key={index}>{item}</li>)}</ul>
                  </article>
                  <article>
                    <h4>สิ่งที่ต้องดูจากรูป</h4>
                    <ul>{(localImageBrain.productSignals.length ? localImageBrain.productSignals : ['ยังไม่มีข้อมูล']).slice(0, 5).map((item, index) => <li key={index}>{item}</li>)}</ul>
                  </article>
                  <article>
                    <h4>ตัวอย่างโพสต์จาก CSV</h4>
                    <ul>{(localImageBrain.captionExamples.length ? localImageBrain.captionExamples : ['ยังไม่มีข้อมูล']).slice(0, 3).map((item, index) => <li key={index}>{item}</li>)}</ul>
                  </article>
                  <article>
                    <h4>ข้อห้าม</h4>
                    <ul>{(localImageBrain.negativeRules.length ? localImageBrain.negativeRules : ['ยังไม่มีข้อมูล']).slice(0, 5).map((item, index) => <li key={index}>{item}</li>)}</ul>
                  </article>
                </div>
              )}
              <textarea
                className="page-stock-textarea"
                value={localImageBrainFeedback}
                onChange={event => setLocalImageBrainFeedback(event.target.value)}
                placeholder="ติชม/สอนสมองเพิ่ม เช่น ต้องขายนุ่มกว่านี้, ห้ามใส่ราคาเอง, ให้ขึ้นต้นด้วยจุดเด่นจากภาพ..."
              />
              <div className="page-stock-manual-actions">
                <button
                  disabled={!localImageBrain || !localImageBrainFeedback.trim()}
                  onClick={saveLocalImageBrainFeedback}
                >
                  Save Feedback เข้าสมอง
                </button>
                <button
                  className="page-stock-primary"
                  disabled={localImageRunning || localImageSelectedCount === 0 || !getOpenRouterKeyForLocalImage()}
                  onClick={startLocalImageArticleRun}
                >
                  เริ่มเขียนจาก Dropbox {localImageSelectedCount} รูป
                </button>
                <button
                  className="page-stock-danger"
                  disabled={!localImageRunning}
                  onClick={stopLocalImageArticleRun}
                >
                  หยุด
                </button>
              </div>
              <div className="page-stock-brain-box">
                <strong>{getOpenRouterKeyForLocalImage() ? 'OpenRouter พร้อมใช้งาน' : 'ยังไม่พบ OpenRouter API Key'}</strong>
                <span>โมเดล: {localImageModel}</span>
              </div>
            </div>

            <div className="page-stock-manual-card page-stock-manual-wide">
              <div className="page-stock-manual-headline">
                <h3>ผลลัพธ์บทความจากรูป</h3>
                <span>เลือกอยู่ {localImageSelectedCount}/{localImageItems.length}</span>
              </div>
              <div className="page-stock-result-list page-stock-prompt-results">
                {localImageItems.length === 0 ? (
                  <em>ยังไม่มีรูปที่อัปโหลด</em>
                ) : localImageItems.map((item, index) => (
                  <article key={item.id}>
                    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 16, alignItems: 'start' }}>
                      <img
                        src={item.directUrl || item.sharedUrl}
                        alt=""
                        style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,.14)' }}
                      />
                      <div>
                        <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={event => updateLocalImageItem(item.id, { selected: event.target.checked })}
                          />
                          <strong>{index + 1}. {item.fileName}</strong>
                          <span>{item.status === 'idle' ? 'รอทำงาน' : item.status === 'processing' ? 'กำลังเขียน' : item.status === 'done' ? 'เสร็จแล้ว' : 'ผิดพลาด'}</span>
                        </label>
                        {item.status === 'error' ? (
                          <p>{item.errorMsg}</p>
                        ) : (
                          <textarea
                            className="page-stock-textarea"
                            value={item.article}
                            onChange={event => updateLocalImageItem(item.id, { article: cleanAiPostPreamble(event.target.value) })}
                            placeholder={item.status === 'processing' ? 'AI กำลังเขียน...' : 'บทความ/แคปชั่นจะแสดงตรงนี้ และแก้ไขเองได้'}
                          />
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="page-stock-manual-actions">
                <button disabled={!localImageCopyText} onClick={copyLocalImageArticles}>
                  {localImageCopied ? 'คัดลอกแล้ว' : 'คัดลอกบทความทั้งหมด'}
                </button>
                <button disabled={localImageDoneCount === 0} onClick={downloadLocalImageArticleCsv}>
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : builderTab === 'clickbait' ? (
        <section className="page-stock-panel page-stock-manual-prompt">
          <div className="page-stock-panel-head">
            <h2>สร้าง โพส clickbait</h2>
            <span>{clickbaitPosts.length} รายการ</span>
          </div>
          <div className="page-stock-manual-grid">
            <div className="page-stock-manual-card">
              <h3>1. ใส่หัวข้อ</h3>
              <p>ใส่หัวข้อที่อยากทำโพสต์ บรรทัดละ 1 หัวข้อ ระบบจะสร้างโพสต์หลักและคอมเมนต์ 1/3 ถึง 3/3 ให้ทีละหลายอัน</p>
              <label>
                <span>หัวข้อ</span>
                <textarea
                  className="page-stock-textarea"
                  value={clickbaitInput}
                  onChange={event => setClickbaitInput(event.target.value)}
                  rows={10}
                  placeholder={'เช่น\n100 Prompt สำหรับเจ้าของธุรกิจ\nวิธีใช้ AI วางแผนคอนเทนต์ 30 วัน\nPrompt วิเคราะห์คู่แข่ง'}
                />
              </label>
              <label>
                <span>โมเดลเขียนโพสต์</span>
                <select className="page-stock-manual-input" value={manualPromptModel} onChange={event => setManualPromptModel(event.target.value)}>
                  {MANUAL_TOPIC_PROMPT_MODELS.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
                </select>
              </label>
              <div className="page-stock-manual-actions">
                <button className="page-stock-primary" disabled={clickbaitTopics.length === 0 || clickbaitRunning} onClick={runClickbaitGenerator}>
                  {clickbaitRunning ? 'กำลังสร้าง...' : `สร้าง ${clickbaitTopics.length || ''} โพสต์`}
                </button>
                <button disabled={clickbaitInput.trim().length === 0} onClick={() => setClickbaitInput('')}>ล้างหัวข้อ</button>
                <button className="page-stock-danger" disabled={clickbaitPosts.length === 0} onClick={() => setClickbaitPosts([])}>ล้างผลลัพธ์</button>
              </div>
              {!hasOpenRouterKey && (
                <p>ยังไม่พบ OpenRouter key ระบบจะใช้ template local ให้ก่อน พอใส่ key แล้วกดสร้างใหม่จะได้งานที่หลากหลายขึ้น</p>
              )}
            </div>

            <div className="page-stock-manual-card">
              <h3>2. ส่งออก</h3>
              <p>ผลลัพธ์แก้ไขได้ก่อนส่งออก CSV โดยคอลัมน์จะแยก headline, post และ comment 1-3 เพื่อเอาไปใช้ต่อกับ workflow ได้ง่าย</p>
              <div className="page-stock-manual-actions">
                <button disabled={clickbaitPosts.length === 0} onClick={copyClickbaitPosts}>
                  {clickbaitCopied ? 'คัดลอกแล้ว' : 'คัดลอกทั้งหมด'}
                </button>
                <button disabled={clickbaitPosts.length === 0} onClick={downloadClickbaitCsv}>Export CSV</button>
              </div>
              <div className="page-stock-result-list page-stock-prompt-results" style={{ maxHeight: 360, overflow: 'auto' }}>
                {clickbaitPosts.length === 0 ? (
                  <em>ยังไม่มีโพสต์ clickbait</em>
                ) : clickbaitPosts.slice(0, 8).map(item => (
                  <article key={item.id}>
                    <strong>{item.headline}</strong>
                    <p>{item.topic}</p>
                    {item.error && <p>AI error: {item.error} · ใช้ fallback template แล้ว</p>}
                  </article>
                ))}
              </div>
            </div>

            <div className="page-stock-manual-card page-stock-manual-wide">
              <h3>3. ผลลัพธ์ที่แก้ไขได้</h3>
              <div className="page-stock-result-list page-stock-prompt-results">
                {clickbaitPosts.length === 0 ? (
                  <em>กดสร้างโพสต์ก่อน แล้วผลลัพธ์จะขึ้นตรงนี้</em>
                ) : clickbaitPosts.map(item => (
                  <article key={item.id}>
                    <div className="page-stock-panel-head">
                      <h4>{item.topic}</h4>
                      <button className="page-stock-danger" onClick={() => setClickbaitPosts(prev => prev.filter(post => post.id !== item.id))}>ลบ</button>
                    </div>
                    <label>
                      <span>หัวข้อ clickbait</span>
                      <textarea className="page-stock-textarea" value={item.headline} onChange={event => updateClickbaitPost(item.id, { headline: event.target.value })} rows={2} />
                    </label>
                    <label>
                      <span>โพสต์หลัก</span>
                      <textarea className="page-stock-textarea" value={item.postText} onChange={event => updateClickbaitPost(item.id, { postText: event.target.value })} rows={5} />
                    </label>
                    {[0, 1, 2].map(index => (
                      <label key={`${item.id}-comment-${index}`}>
                        <span>ใต้คอมเมนต์ {index + 1}/3</span>
                        <textarea
                          className="page-stock-textarea"
                          value={item.comments[index]}
                          onChange={event => updateClickbaitComment(item.id, index, event.target.value)}
                          rows={7}
                        />
                      </label>
                    ))}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : builderTab === 'csv-clickbait' ? (
        <section className="page-stock-panel page-stock-manual-prompt">
          <div className="page-stock-panel-head">
            <h2>CSV → Clickbait + ใต้เม้น</h2>
            <span>{csvCbResults.length} โพสต์ · {csvCbRows.length} บทความ</span>
          </div>
          <div className="page-stock-manual-grid">
            <div className="page-stock-manual-card">
              <h3>1. นำเข้า CSV บทความ</h3>
              <p>อัปโหลด CSV ที่มีคอลัมน์เนื้อหา (caption/content/text/article) ระบบจะสร้าง Clickbait + ใต้เม้น 1/3-3/3 จากเนื้อหาจริง</p>
              <div className="page-stock-manual-actions">
                <button className={csvCbPasteMode ? '' : 'page-stock-primary'} onClick={() => setCsvCbPasteMode(false)}>อัปโหลดไฟล์</button>
                <button className={csvCbPasteMode ? 'page-stock-primary' : ''} onClick={() => setCsvCbPasteMode(true)}>วางข้อความ</button>
              </div>
              {!csvCbPasteMode ? (
                <label className="page-stock-upload">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={event => handleCsvCbUpload(event.target.files?.[0])}
                  />
                  <span>{csvCbFileName || 'เลือกไฟล์ CSV'}</span>
                </label>
              ) : (
                <textarea
                  className="page-stock-textarea"
                  value={csvCbFile}
                  onChange={event => handleCsvCbPaste(event.target.value)}
                  rows={8}
                  placeholder={'วาง CSV ตรงนี้ เช่น:\ncaption,url\n"เนื้อหาบทความยาวๆ...","https://..."'}
                />
              )}
              {csvCbProgress && <div className="page-stock-brain-box"><strong>{csvCbProgress}</strong></div>}
              {csvCbRows.length > 0 && (
                <div className="page-stock-trend-box">
                  <strong>พร้อมสร้าง {csvCbRows.length} โพสต์</strong>
                  <span>{csvCbRows.slice(0, 5).map(r => r.title.slice(0, 40)).join(' · ')}{csvCbRows.length > 5 ? ' ...' : ''}</span>
                </div>
              )}
              <label>
                <span>โมเดลเขียนโพสต์</span>
                <select className="page-stock-manual-input" value={manualPromptModel} onChange={event => setManualPromptModel(event.target.value)}>
                  {MANUAL_TOPIC_PROMPT_MODELS.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
                </select>
              </label>
              <div className="page-stock-manual-actions">
                <button className="page-stock-primary" disabled={csvCbRows.length === 0 || csvCbRunning} onClick={runCsvClickbaitGenerator}>
                  {csvCbRunning ? 'กำลังสร้าง...' : `สร้าง ${csvCbRows.length || ''} Clickbait`}
                </button>
                <button disabled={csvCbRows.length === 0 || csvCbRunning} onClick={() => { setCsvCbFile(''); setCsvCbFileName(''); setCsvCbRows([]); setCsvCbProgress(''); }}>ล้าง CSV</button>
                <button className="page-stock-danger" disabled={csvCbResults.length === 0} onClick={() => setCsvCbResults([])}>ล้างผลลัพธ์</button>
              </div>
              {!hasOpenRouterKey && (
                <p>⚠️ ยังไม่พบ OpenRouter key กรุณาใส่ key ในหน้าตั้งค่าระบบก่อน</p>
              )}
            </div>

            <div className="page-stock-manual-card">
              <h3>2. ส่งออก</h3>
              <p>ผลลัพธ์แก้ไขได้ก่อนส่งออก CSV โดยคอลัมน์จะแยก headline, post และ comment 1-3</p>
              <div className="page-stock-manual-actions">
                <button disabled={csvCbResults.length === 0} onClick={copyCsvCbPosts}>
                  {csvCbCopied ? 'คัดลอกแล้ว' : 'คัดลอกทั้งหมด'}
                </button>
                <button disabled={csvCbResults.length === 0} onClick={downloadCsvCbCsv}>Export CSV</button>
              </div>
              <div className="page-stock-result-list page-stock-prompt-results" style={{ maxHeight: 360, overflow: 'auto' }}>
                {csvCbResults.length === 0 ? (
                  <em>อัปโหลด CSV แล้วกดสร้าง ผลลัพธ์จะขึ้นตรงนี้</em>
                ) : csvCbResults.slice(0, 8).map(item => (
                  <article key={item.id}>
                    <strong>{item.headline}</strong>
                    <p>{item.topic}</p>
                    {item.error && <p>AI error: {item.error}</p>}
                  </article>
                ))}
              </div>
            </div>

            <div className="page-stock-manual-card page-stock-manual-wide">
              <h3>3. ผลลัพธ์ที่แก้ไขได้</h3>
              <div className="page-stock-result-list page-stock-prompt-results">
                {csvCbResults.length === 0 ? (
                  <em>ยังไม่มีผลลัพธ์</em>
                ) : csvCbResults.map(item => (
                  <article key={item.id}>
                    <div className="page-stock-panel-head">
                      <h4>{item.topic}</h4>
                      <button className="page-stock-danger" onClick={() => setCsvCbResults(prev => prev.filter(post => post.id !== item.id))}>ลบ</button>
                    </div>
                    <label>
                      <span>หัวข้อ clickbait</span>
                      <textarea className="page-stock-textarea" value={item.headline} onChange={event => updateCsvCbPost(item.id, { headline: event.target.value })} rows={2} />
                    </label>
                    <label>
                      <span>โพสต์หลัก</span>
                      <textarea className="page-stock-textarea" value={item.postText} onChange={event => updateCsvCbPost(item.id, { postText: event.target.value })} rows={4} />
                    </label>
                    {[0, 1, 2].map(index => (
                      <label key={`${item.id}-cc-${index}`}>
                        <span>ใต้คอมเมนต์ {index + 1}/3</span>
                        <textarea
                          className="page-stock-textarea"
                          value={item.comments[index]}
                          onChange={event => updateCsvCbComment(item.id, index, event.target.value)}
                          rows={7}
                        />
                      </label>
                    ))}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="page-stock-panel page-stock-manual-prompt">
          <div className="page-stock-panel-head">
            <h2>Canvas</h2>
            <span>{canvasImages.length} รูป · เลือกอยู่ {canvasSelectedCount}</span>
          </div>
          <div className="page-stock-manual-grid">
            <div className="page-stock-manual-card">
              <h3>1. เลือกโฟลเดอร์รูป</h3>
              <p>เลือกรูปที่สร้างเสร็จจากเครื่อง ระบบจะ export เป็น PNG ขนาดเดิมของแต่ละรูป เช่น 1080x1080 ก็ออก 1080x1080</p>
              <label className="page-stock-upload">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  {...({ webkitdirectory: '', directory: '' } as any)}
                  onChange={event => {
                    handleCanvasFolderUpload(event.target.files);
                    event.currentTarget.value = '';
                  }}
                />
                <span>เลือก Folder รูป</span>
              </label>
              <div className="page-stock-manual-actions">
                <button disabled={canvasImages.length === 0} onClick={() => setCanvasImages(prev => prev.map(image => ({ ...image, selected: true })))}>
                  เลือกทั้งหมด
                </button>
                <button disabled={canvasImages.length === 0} onClick={() => setCanvasImages(prev => prev.map(image => ({ ...image, selected: false })))}>
                  ยกเลิกทั้งหมด
                </button>
                <button className="page-stock-danger" disabled={canvasImages.length === 0} onClick={() => { setCanvasImages([]); setCanvasSelectedImageId(''); }}>
                  ล้างรูป
                </button>
              </div>
              <div className="page-stock-result-list page-stock-prompt-results" style={{ maxHeight: 420, overflow: 'auto' }}>
                {canvasImages.length === 0 ? (
                  <em>ยังไม่มีรูปจากโฟลเดอร์</em>
                ) : canvasImages.map(image => (
                  <article key={image.id} onClick={() => setCanvasSelectedImageId(image.id)} style={{ cursor: 'pointer', borderColor: selectedCanvasImage?.id === image.id ? 'var(--accent-color)' : undefined }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 12, alignItems: 'center' }}>
                      <img src={image.dataUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
                      <div>
                        <label style={{ display: 'flex', gap: 10, alignItems: 'center' }} onClick={event => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={image.selected}
                            onChange={event => setCanvasImages(prev => prev.map(item => item.id === image.id ? { ...item, selected: event.target.checked } : item))}
                          />
                          <strong>{image.fileName}</strong>
                        </label>
                        <p>{image.width}x{image.height}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="page-stock-manual-card">
              <h3>2. ข้อความ / Logo</h3>
              <label>
                <span>ข้อความบนรูป</span>
                <textarea
                  className="page-stock-textarea"
                  value={canvasText}
                  onChange={event => setCanvasText(event.target.value)}
                  placeholder="เช่น คำเตือน การลงทุนมีความเสี่ยง"
                />
              </label>
              <div className="page-stock-manual-actions">
                <button className={canvasActiveLayer === 'text' ? 'page-stock-primary' : ''} onClick={() => setCanvasActiveLayer('text')}>วางข้อความ</button>
                <button className={canvasActiveLayer === 'logo' ? 'page-stock-primary' : ''} onClick={() => setCanvasActiveLayer('logo')}>วาง Logo</button>
              </div>
              <label>
                <span>ตำแหน่งข้อความ</span>
                <select className="page-stock-manual-input" onChange={event => setCanvasTextPreset(event.target.value)} defaultValue="bottom-center">
                  <option value="top-left">บนซ้าย</option>
                  <option value="top-center">บนกลาง</option>
                  <option value="top-right">บนขวา</option>
                  <option value="center">กลาง</option>
                  <option value="bottom-left">ล่างซ้าย</option>
                  <option value="bottom-center">ล่างกลาง</option>
                  <option value="bottom-right">ล่างขวา</option>
                </select>
              </label>
              <label><span>X ข้อความ {canvasTextX.toFixed(0)}%</span><input type="range" min="0" max="100" value={canvasTextX} onChange={event => setCanvasTextX(Number(event.target.value))} /></label>
              <label><span>Y ข้อความ {canvasTextY.toFixed(0)}%</span><input type="range" min="0" max="100" value={canvasTextY} onChange={event => setCanvasTextY(Number(event.target.value))} /></label>
              <label><span>ขนาดตัวอักษร {canvasTextSize.toFixed(1)}%</span><input type="range" min="1.6" max="10" step="0.1" value={canvasTextSize} onChange={event => setCanvasTextSize(Number(event.target.value))} /></label>
              <label>
                <span>เอฟเฟกต์ตัวอักษร</span>
                <select className="page-stock-manual-input" value={canvasTextEffect} onChange={event => setCanvasTextEffect(event.target.value as any)}>
                  <option value="bar">แถบดำ + เส้นสี</option>
                  <option value="badge">ป้ายสี</option>
                  <option value="outline">ขอบดำ</option>
                  <option value="shadow">เงา</option>
                  <option value="none">ไม่มี</option>
                </select>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label><span>สีตัวอักษร</span><input type="color" value={canvasTextColor} onChange={event => setCanvasTextColor(event.target.value)} /></label>
                <label><span>สีแถบ/ป้าย</span><input type="color" value={canvasAccentColor} onChange={event => setCanvasAccentColor(event.target.value)} /></label>
              </div>
              <label>
                <span>Logo</span>
                <label className="page-stock-upload">
                  <input type="file" accept="image/*" onChange={event => handleCanvasLogoUpload(event.target.files?.[0])} />
                  <span>{canvasLogoDataUrl ? 'เปลี่ยน Logo' : 'อัปโหลด Logo'}</span>
                </label>
              </label>
              {canvasLogoDataUrl && (
                <>
                  <div className="page-stock-manual-actions">
                    <button onClick={() => setCanvasLogoDataUrl('')}>ลบ Logo</button>
                    <button onClick={() => setCanvasLogoPreset('top-left')}>บนซ้าย</button>
                    <button onClick={() => setCanvasLogoPreset('top-right')}>บนขวา</button>
                    <button onClick={() => setCanvasLogoPreset('bottom-left')}>ล่างซ้าย</button>
                    <button onClick={() => setCanvasLogoPreset('bottom-right')}>ล่างขวา</button>
                  </div>
                  <label><span>X Logo {canvasLogoX.toFixed(0)}%</span><input type="range" min="0" max="100" value={canvasLogoX} onChange={event => setCanvasLogoX(Number(event.target.value))} /></label>
                  <label><span>Y Logo {canvasLogoY.toFixed(0)}%</span><input type="range" min="0" max="100" value={canvasLogoY} onChange={event => setCanvasLogoY(Number(event.target.value))} /></label>
                  <label><span>ขนาด Logo {canvasLogoSize.toFixed(0)}%</span><input type="range" min="3" max="35" value={canvasLogoSize} onChange={event => setCanvasLogoSize(Number(event.target.value))} /></label>
                </>
              )}
            </div>

            <div className="page-stock-manual-card page-stock-manual-wide">
              <div className="page-stock-manual-headline">
                <h3>Preview และ Export</h3>
                <span>{selectedCanvasImage ? `${selectedCanvasImage.width}x${selectedCanvasImage.height}` : 'ยังไม่เลือกรูป'}</span>
              </div>
              <p>คลิกบน Preview เพื่อย้ายตำแหน่ง layer ที่เลือกอยู่: {canvasActiveLayer === 'text' ? 'ข้อความ' : 'Logo'}</p>
              <div style={{ display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,.32)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: 16 }}>
                {selectedCanvasImage ? (
                  <canvas
                    ref={canvasPreviewRef}
                    onClick={handleCanvasPreviewClick}
                    style={{ maxWidth: '100%', maxHeight: '72vh', borderRadius: 8, cursor: 'crosshair' }}
                  />
                ) : (
                  <em>เลือกรูปจากโฟลเดอร์ก่อน</em>
                )}
              </div>
              <div className="page-stock-manual-actions">
                <button disabled={!selectedCanvasImage} onClick={() => downloadStockCanvasImage()}>
                  Export รูปนี้
                </button>
                <button className="page-stock-primary" disabled={canvasSelectedCount === 0} onClick={downloadAllStockCanvasImages}>
                  Export ทั้งหมดที่เลือก ({canvasSelectedCount})
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
