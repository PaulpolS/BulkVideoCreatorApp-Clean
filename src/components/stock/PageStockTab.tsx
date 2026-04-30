import React, { useEffect, useMemo, useRef, useState } from 'react';
import workflow from '../../../[All Pages] ทำรูปStock ทุกเพจ.json';
import { globalTaskStore } from '../../hooks/useBackgroundTasks';

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
type PageStockBuilderTab = 'api' | 'prompt' | 'local-image-article' | 'canvas';

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
const LOCAL_IMAGE_PROMPT_KEY = 'page_stock_local_image_article_prompt';
const LOCAL_IMAGE_DROPBOX_PATH_KEY = 'page_stock_local_image_dropbox_path';
const LOCAL_IMAGE_ARTICLE_BRAINS_KEY = 'page_stock_local_image_article_brains';
const LOCAL_IMAGE_ARTICLE_MODEL_KEY = 'page_stock_local_image_article_model';
const MANUAL_BRAIN_MODEL_KEY = 'page_stock_manual_brain_model';
const MANUAL_TOPIC_MODEL_KEY = 'page_stock_manual_topic_model';
const MANUAL_PROMPT_MODEL_KEY = 'page_stock_manual_prompt_model';

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
  return rows
    .map(row => getCsvField(row, ['prompt', 'สร้างรูป', 'image generation']))
    .filter(Boolean)
    .slice(0, 8);
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
  const manualPausedRef = useRef(false);
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

  const getStoredOpenRouterKey = () => {
    const profileKey = activeProfile?.openRouterKey?.trim();
    if (profileKey) return profileKey;

    try {
      const savedProfiles = JSON.parse(localStorage.getItem('api_global_profiles') || '[]');
      const activeId = settings.profileId || localStorage.getItem('api_global_active_id') || '';
      const savedProfile = Array.isArray(savedProfiles)
        ? savedProfiles.find((profile: ApiProfile) => profile.id === activeId) || savedProfiles[0]
        : undefined;
      const savedProfileKey = savedProfile?.openRouterKey?.trim();
      if (savedProfileKey) return savedProfileKey;
    } catch {}

    const legacyKey = localStorage.getItem('openrouter_key')?.trim();
    if (legacyKey) return legacyKey;

    try {
      const keys = JSON.parse(localStorage.getItem('openrouter_keys') || '[]');
      const active = Array.isArray(keys) ? keys.find((key: any) => key.isActive) || keys[0] : undefined;
      return String(active?.key || '').trim();
    } catch {
      return '';
    }
  };

  const openRouterKey = getStoredOpenRouterKey();
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
    fetch(`/api/get-app-data?key=${MANUAL_PROMPT_BRAINS_KEY}`)
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          const normalized = Object.fromEntries(
            Object.entries(data).map(([key, brain]) => [key, normalizeManualBrain(brain as Partial<ManualPromptBrain>, key)]),
          );
          setManualBrains(normalized);
          setManualBrainKey(prev => prev || Object.keys(normalized)[0] || '');
        }
      })
      .catch(() => {
        try {
          const data = JSON.parse(localStorage.getItem(MANUAL_PROMPT_BRAINS_KEY) || '{}');
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            const normalized = Object.fromEntries(
              Object.entries(data).map(([key, brain]) => [key, normalizeManualBrain(brain as Partial<ManualPromptBrain>, key)]),
            );
            setManualBrains(normalized);
            setManualBrainKey(prev => prev || Object.keys(normalized)[0] || '');
          }
        } catch {}
      });
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
    const apiKey = getStoredOpenRouterKey();
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

  const askOpenRouter = async (prompt: string, signal?: AbortSignal, maxTokens = 6000, modelOverride?: string) => {
    const apiKey = getStoredOpenRouterKey();
    if (!apiKey) throw new Error('ไม่พบ OpenRouter API Key');
    const tokenAttempts = Array.from(new Set([
      maxTokens,
      Math.min(maxTokens, 1800),
      Math.min(maxTokens, 1200),
      Math.min(maxTokens, 800),
    ])).filter(tokens => tokens > 0);
    let lastError = '';
    for (const tokens of tokenAttempts) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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
      if (res.ok && !data.error) return data.choices?.[0]?.message?.content?.trim() || '';
      lastError = data.error?.message || `OpenRouter error ${res.status}`;
      const canRetryLowerTokens = /more credits|fewer max_tokens|can only afford|credits/i.test(lastError);
      if (!canRetryLowerTokens) throw new Error(lastError);
    }
    throw new Error(lastError || 'OpenRouter error');
  };

  const saveManualBrains = async (nextBrains: Record<string, ManualPromptBrain>) => {
    setManualBrains(nextBrains);
    localStorage.setItem(MANUAL_PROMPT_BRAINS_KEY, JSON.stringify(nextBrains));
    await fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: MANUAL_PROMPT_BRAINS_KEY, data: nextBrains }),
    }).catch(() => undefined);
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

  const startAnalyzeManualCsv = () => {
    if (!manualCsvText.trim() || !getStoredOpenRouterKey()) return;
    const rows = parseCsvTable(manualCsvText);
    const csvSample = JSON.stringify(rows.slice(0, 80), null, 2).slice(0, 32000);
    const csvPromptExamples = extractPromptExamplesFromRows(rows);
    const trendRows = manualTrendCsvText.trim() ? parseCsvTable(manualTrendCsvText) : [];
    const trendSample = trendRows.length > 0
      ? JSON.stringify(trendRows.slice(0, 120), null, 2).slice(0, 32000)
      : '';
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
      const prompt = `คุณคือ AI strategist ที่เก่งมากในการแกะ pattern คอนเทนต์และ prompt สร้างรูปจากตัวอย่าง CSV

ชื่อสมองเบื้องต้นจากไฟล์: ${brainKey}
สำคัญมาก: อย่าใช้เพจที่เลือกในเมนูซ้ายหรือ config อื่นใดมาตัดสิน ให้ยึดข้อมูลจาก CSV Prompt เป็นหลัก และใช้ CSV เทรนด์เป็นข้อมูลเสริมเท่านั้น

ตัวอย่าง CSV Prompt ที่เคยใช้งานได้ เป็น JSON rows:
${csvSample}

${trendSample ? `ข้อมูล CSV เทรนด์ล่าสุด เป็น JSON rows:
${trendSample}` : 'ไม่มี CSV เทรนด์ล่าสุด'}

งานของคุณ:
1. วิเคราะห์ keyword หลักและ keyword รองที่ควรใช้
2. วิเคราะห์ว่าหัวข้อควรทำแนวไหนบ้าง โดยถ้ามีเทรนด์ ให้บอกว่าจะใช้เทรนด์เลือกหัวข้อยังไง
3. วิเคราะห์สำนวน/น้ำเสียง/วิธีเล่าให้เหมือน pattern ของ CSV Prompt
4. วิเคราะห์ prompt สร้างรูปที่ดีว่าต้องมีโครงสร้างแบบไหน ต้องตรงกับ pattern ตัวอย่างที่แนบ
5. สร้างตัวอย่าง Prompt สร้างรูป 3-5 ตัวอย่าง โดยต้องเหมือน format/pattern ที่มีใน CSV Prompt และพร้อมเอาไปใช้ได้
6. แยกกฎภาพ สี อารมณ์ องค์ประกอบ ฟอนต์ layout และข้อห้าม
7. เขียนคำอธิบายให้เจ้าของเพจอ่านเข้าใจว่า สมองนี้ควรเอาไปใช้อย่างไร

ตอบเป็น JSON เท่านั้น:
{
  "pageName": "ชื่อสมอง/ชื่อเพจที่เหมาะสมจาก CSV",
  "summary": "สรุปสั้นๆ",
  "keywords": ["keyword ที่ควรใช้"],
  "contentAngles": ["แนวหัวข้อที่ควรทำ"],
  "toneGuidelines": ["สำนวน/น้ำเสียงที่ควรใช้"],
  "topicPatterns": ["..."],
  "promptRules": ["..."],
  "visualStyleRules": ["..."],
  "negativeRules": ["..."],
  "trendInsights": ["ถ้ามี CSV เทรนด์ วิเคราะห์ว่าควรจับกระแสอะไร ถ้าไม่มีให้เป็น []"],
  "examplePrompts": ["ต้องเป็น string เท่านั้น ห้ามเป็น object และต้องเป็น prompt เต็มที่พร้อมใช้"]
}`;
      ctx.log(`3/6 ส่งให้ OpenRouter (${manualBrainModel}) วิเคราะห์ CSV Prompt + เทรนด์ และสร้างสมองฉบับสมบูรณ์`);
      const answer = await askOpenRouter(prompt, ctx.signal, 6000, manualBrainModel);
      ctx.log(`4/6 AI วิเคราะห์กลับมาแล้ว (${answer.length.toLocaleString()} ตัวอักษร)`);
      const parsed = extractJsonPayload<any>(answer, {});
      const inferredName = String(parsed.pageName || brainKey).trim() || brainKey;
      const brain: ManualPromptBrain = {
        pageName: inferredName,
        updatedAt: new Date().toISOString(),
        sourceFileName: manualCsvName,
        sourceRowCount: rows.length,
        trendFileName: manualTrendCsvName || '',
        trendRowCount: trendRows.length,
        summary: String(parsed.summary || 'AI วิเคราะห์ไฟล์ CSV แล้ว แต่ไม่ได้ส่ง summary เป็น JSON ชัดเจน'),
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
        contentAngles: Array.isArray(parsed.contentAngles) ? parsed.contentAngles.map(String) : [],
        toneGuidelines: Array.isArray(parsed.toneGuidelines) ? parsed.toneGuidelines.map(String) : [],
        topicPatterns: Array.isArray(parsed.topicPatterns) ? parsed.topicPatterns.map(String) : [],
        promptRules: Array.isArray(parsed.promptRules) ? parsed.promptRules.map(String) : [],
        visualStyleRules: Array.isArray(parsed.visualStyleRules) ? parsed.visualStyleRules.map(String) : [],
        negativeRules: Array.isArray(parsed.negativeRules) ? parsed.negativeRules.map(String) : [],
        trendInsights: Array.isArray(parsed.trendInsights) ? parsed.trendInsights.map(String) : [],
        examplePrompts: asStringArray(parsed.examplePrompts).length > 0
          ? asStringArray(parsed.examplePrompts)
          : csvPromptExamples,
        feedbackNotes: manualBrain?.feedbackNotes || [],
        rawAnalysis: answer,
      };
      ctx.log('5/6 บันทึกสมองเพจลง app_data และ localStorage');
      await saveManualBrains({ ...manualBrains, [brainKey]: brain });
      ctx.log('6/6 สมองเพจพร้อมใช้: มี keyword, topic pattern, style, prompt pattern และตัวอย่าง prompt');
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

  const startGenerateManualTopics = () => {
    if (!manualBrain || !getStoredOpenRouterKey()) return;
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
      const batchSize = 12;
      const nextTopics: string[] = [];
      const brainText = JSON.stringify(manualBrain, null, 2);
      ctx.log(manualBrain.trendRowCount ? `ใช้ข้อมูลเทรนด์จากสมอง: ${manualBrain.trendFileName || 'trend.csv'} (${manualBrain.trendRowCount} แถว)` : 'สมองนี้ไม่มี CSV เทรนด์: ใช้ pattern จาก CSV Prompt เป็นหลัก');
      for (let start = 0; start < total; start += batchSize) {
        if (ctx.isCancelled()) break;
        await waitIfManualPaused(ctx);
        const amount = Math.min(batchSize, total - start);
        ctx.log(`สร้างหัวข้อ batch ${Math.floor(start / batchSize) + 1}: ขอ ${amount} หัวข้อจาก AI`);
        const answer = await askOpenRouter(`จากสมองเพจนี้:\n${brainText}

สร้างหัวข้อใหม่ ${amount} หัวข้อสำหรับ "${manualBrain.pageName}"
ให้ใช้ keyword, contentAngles, topicPatterns และ trendInsights ในสมองเป็นหลัก
ถ้าสมองมี trendInsights ให้เลือกหัวข้อที่ทันกระแส แต่ยังต้องตรงกับ pattern เดิม
ห้ามซ้ำกับรายการนี้:
${[...manualTopics, ...nextTopics].join('\n')}

ตอบเป็น JSON array ของ string เท่านั้น`, ctx.signal, 6000, manualTopicModel);
        const parsed = extractJsonPayload<string[]>(answer, []);
        const clean = parsed.map(item => String(item).trim()).filter(Boolean);
        nextTopics.push(...clean.slice(0, amount));
        const accepted = clean.slice(0, amount);
        setManualTopics(prev => [...prev, ...accepted]);
        setManualTopicsText(prev => [...getTopics(prev), ...accepted].join('\n'));
        ctx.log(`ได้หัวข้อเพิ่ม ${clean.slice(0, amount).length} หัวข้อ รวม ${nextTopics.length}/${total}`);
      }
      ctx.log(`สร้างหัวข้อเสร็จ: ได้ ${nextTopics.length}/${total} หัวข้อ`);
      setManualTaskId('');
    });
    setManualTaskId(taskId);
  };

  const startGenerateManualPrompts = () => {
    const topicsForPrompt = editableManualTopics;
    if (!manualBrain || topicsForPrompt.length === 0 || !getStoredOpenRouterKey()) return;
    const nextTaskId = `manual-prompts-${Date.now()}`;
    const taskId = globalTaskStore.enqueueTask({
      id: nextTaskId,
      title: `🎨 สร้าง Prompt รูป: ${manualBrain.pageName}`,
      category: 'page-stock-manual',
      progress: `เตรียมสร้าง Prompt รูป ${topicsForPrompt.length} หัวข้อ`,
    }, async ctx => {
      setManualTaskId(nextTaskId);
      const existing = new Map(manualPromptResults.map(result => [result.topic, result.imagePrompt]));
      const pendingTopics = topicsForPrompt.filter(topic => !existing.has(topic));
      const batchSize = 6;
      const brainText = JSON.stringify(manualBrain, null, 2);
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
      setManualTaskId('');
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

  const getOpenRouterKeyForLocalImage = () => {
    if (activeProfile?.openRouterKey?.trim()) return activeProfile.openRouterKey.trim();
    const legacyKey = localStorage.getItem('openrouter_key')?.trim();
    if (legacyKey) return legacyKey;
    try {
      const keys = JSON.parse(localStorage.getItem('openrouter_keys') || '[]');
      const active = keys.find((key: any) => key.isActive) || keys[0];
      return String(active?.key || '').trim();
    } catch {
      return '';
    }
  };

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
                  <h3>สมองนี้วิเคราะห์ว่าอะไร</h3>
                  <span>{manualBrain.pageName}</span>
                </div>
                <div className="page-stock-brain-detail-grid">
                  <article>
                    <h4>Keyword ที่ควรใช้</h4>
                    <p>{manualBrain.keywords.length ? manualBrain.keywords.join(', ') : 'ยังไม่มีข้อมูล keyword'}</p>
                  </article>
                  <article>
                    <h4>แนวหัวข้อที่ควรทำ</h4>
                    <ul>{(manualBrain.contentAngles.length ? manualBrain.contentAngles : manualBrain.topicPatterns).slice(0, 8).map((item, index) => <li key={index}>{item}</li>)}</ul>
                  </article>
                  <article>
                    <h4>สำนวนที่ใช้</h4>
                    <ul>{(manualBrain.toneGuidelines.length ? manualBrain.toneGuidelines : ['ยังไม่มีข้อมูลสำนวน']).slice(0, 8).map((item, index) => <li key={index}>{item}</li>)}</ul>
                  </article>
                  <article>
                    <h4>เทรนด์ที่สมองจับได้</h4>
                    <ul>{(manualBrain.trendInsights.length ? manualBrain.trendInsights : ['ไม่มี CSV เทรนด์ หรือ AI ไม่พบ trend insight ชัดเจน']).slice(0, 8).map((item, index) => <li key={index}>{item}</li>)}</ul>
                  </article>
                  <article className="wide">
                    <h4>ตัวอย่าง Prompt ที่ควรสร้าง</h4>
                    <div className="page-stock-example-prompts">
                      {(manualBrain.examplePrompts.length ? manualBrain.examplePrompts : manualBrain.promptRules).slice(0, 5).map((item, index) => <pre key={index}>{item}</pre>)}
                    </div>
                  </article>
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
