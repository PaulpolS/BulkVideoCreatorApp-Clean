import React, { useEffect, useMemo, useState } from 'react';
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
  const hasOpenRouterKey = Boolean(activeProfile?.openRouterKey);
  const hasDropboxAuth = Boolean(activeProfile?.dropboxKey || activeProfile?.dropboxRefreshToken);
  const runnableCount = totalQueuedTopics || topics.length;

  useEffect(() => {
    fetch('/api/get-app-data?key=api_profiles')
      .then(res => res.json())
      .then((serverProfiles: ApiProfile[]) => {
        const localProfiles = JSON.parse(localStorage.getItem('api_global_profiles') || '[]');
        const loaded = Array.isArray(serverProfiles) && serverProfiles.length > 0 ? serverProfiles : localProfiles;
        setProfiles(loaded);
        const activeId = localStorage.getItem('api_global_active_id') || loaded[0]?.id || '';
        setSettings(prev => ({ ...prev, profileId: prev.profileId || activeId }));
      })
      .catch(() => {
        try {
          const loaded = JSON.parse(localStorage.getItem('api_global_profiles') || '[]');
          setProfiles(loaded);
          setSettings(prev => ({ ...prev, profileId: prev.profileId || localStorage.getItem('api_global_active_id') || loaded[0]?.id || '' }));
        } catch {}
      });
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
    localStorage.setItem(OUTPUT_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!selectedPage) return;
    setSettings(prev => ({
      ...prev,
      dropboxFolderPath: prev.dropboxFolderPath || selectedPage.dropbox_path,
    }));
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
    if (!activeProfile?.openRouterKey) throw new Error('ไม่พบ OpenRouter API Key');
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${activeProfile.openRouterKey}`,
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
        <h1>📮 ทำStockลงเพจ</h1>
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
    </div>
  );
}
