import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../ui/Card';
import { getOpenRouterKeyCandidates } from '../../hooks/useApiSettings';

const KEYWORDS = [
  { label: 'Claude Code', query: 'claude-code', emoji: '🤖' },
  { label: 'AI Agent / Multi-agent', query: 'topic:ai-agent', emoji: '🕹️' },
  { label: 'Local LLM (รันในเครื่อง)', query: 'topic:local-llm', emoji: '💻' },
  { label: 'Ollama (รัน LLM ในเครื่อง)', query: 'ollama local model', emoji: '🦙' },
  { label: 'Voice AI / Voice Cloning', query: 'topic:voice-cloning', emoji: '🎙️' },
  { label: 'Text to Speech (TTS)', query: 'topic:text-to-speech', emoji: '🔊' },
  { label: 'Gemini AI Tools', query: 'topic:gemini', emoji: '✨' },
  { label: 'Awesome AI (รวม resources)', query: 'topic:awesome-ai', emoji: '📚' },
  { label: 'Awesome LLM', query: 'topic:awesome-llm', emoji: '📖' },
  { label: 'AI x Finance / Trading', query: 'topic:algorithmic-trading', emoji: '📈' },
  { label: 'Quant Finance AI', query: 'topic:quantitative-finance', emoji: '💹' },
  { label: 'PDF & Document AI', query: 'pdf extraction ai markdown', emoji: '📄' },
  { label: 'AI Coding Assistant', query: 'topic:ai-coding-assistant', emoji: '⌨️' },
  { label: 'RAG (Retrieval Augmented)', query: 'topic:rag', emoji: '🧠' },
  { label: 'Knowledge Graph', query: 'topic:knowledge-graph', emoji: '🕸️' },
  { label: 'Prompt Engineering', query: 'topic:prompt-engineering', emoji: '✍️' },
  { label: 'LLM Fine-tuning', query: 'topic:fine-tuning', emoji: '⚙️' },
  { label: 'LoRA / QLoRA', query: 'topic:lora', emoji: '🔧' },
  { label: 'MCP Server', query: 'topic:mcp-server', emoji: '🔌' },
  { label: 'Model Context Protocol', query: 'model-context-protocol', emoji: '🔌' },
  { label: 'AI Education / Roadmap', query: 'topic:roadmap ai learning', emoji: '🎓' },
  { label: 'Open Source AI Tools', query: 'topic:ai-tools', emoji: '🛠️' },
  { label: 'Agentic / Autonomous AI', query: 'topic:agentic-ai', emoji: '🦾' },
  { label: 'LangChain / LangGraph', query: 'topic:langchain', emoji: '⛓️' },
  { label: 'AI Image Generation', query: 'topic:image-generation', emoji: '🎨' },
  { label: 'Stable Diffusion', query: 'topic:stable-diffusion', emoji: '🖼️' },
  { label: 'Obsidian / Notes AI', query: 'obsidian ai plugin', emoji: '🗂️' },
  { label: 'AI Security / Pentest', query: 'topic:penetration-testing ai', emoji: '🔐' },
  { label: 'Browser AI / Web Scraping', query: 'topic:web-scraping ai', emoji: '🌐' },
  { label: 'OpenAI / GPT Tools', query: 'topic:openai', emoji: '💬' },
];

interface GithubFinderProps {
  onSendToAIPage?: (items: { rawArticle: string; sourceUrl: string; title: string; tags?: string[]; images?: string[]; sourceType?: string; domain?: string }[]) => void;
}

interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  updated_at: string;
  owner: { login: string; avatar_url: string };
}

interface GeneratedPost {
  repoId: number;
  full_name: string;
  html_url: string;
  stars: number;
  description: string;
  clickbait_caption: string;
  comment_1: string;
  comment_2: string;
  comment_3: string;
  images: string[];
  status: 'pending' | 'loading' | 'done' | 'error';
  error?: string;
}

function formatStars(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function timeAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return 'วันนี้';
  if (days < 30) return `${days} วันที่แล้ว`;
  if (days < 365) return `${Math.floor(days / 30)} เดือนที่แล้ว`;
  return `${Math.floor(days / 365)} ปีที่แล้ว`;
}

function csvEscape(val: string): string {
  const s = (val ?? '').toString().replace(/"/g, '""');
  return `"${s}"`;
}

function downloadCSV(rows: string[][], filename: string) {
  const content = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const bom = '﻿';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const GH_MODEL_OPTIONS = [
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (แนะนำ/เร็ว/ถูก)' },
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash (ใหม่/เร็ว)' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro (ฉลาด)' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (คุ้มค่า)' },
  { id: 'openai/gpt-oss-20b:free', name: 'GPT OSS 20B (ฟรี!)' },
  { id: 'openai/gpt-4o', name: 'GPT-4o (เก่งสุด)' },
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B (ฟรี!)' },
];

export function GithubFinderTab({ onSendToAIPage }: GithubFinderProps) {
  const [selectedQuery, setSelectedQuery] = useState(KEYWORDS[0].query);
  const selectedKw = KEYWORDS.find(k => k.query === selectedQuery);
  const [count, setCount] = useState('10');
  const [isLoading, setIsLoading] = useState(false);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [rateLimit, setRateLimit] = useState<{ search: { remaining: number; limit: number; reset: number }; core: { remaining: number; limit: number; reset: number } } | null>(null);
  const [isCheckingRate, setIsCheckingRate] = useState(false);
  const [genLog, setGenLog] = useState('');
  const stopRef = useRef(false);
  const [ghModel, setGhModel] = useState<string>(() => localStorage.getItem('gh_finder_model') || GH_MODEL_OPTIONS[0].id);

  // ─── Footage folder management ────────────────────────────────────
  const [footageFolder, setFootageFolder] = useState(() => localStorage.getItem('gh_footage_folder') || '');
  const [subfolders, setSubfolders] = useState<{ name: string; path: string; imageCount: number }[]>([]);
  const [stockCount, setStockCount] = useState('5');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [footageMessage, setFootageMessage] = useState('');
  const [footageFolderName, setFootageFolderName] = useState(() => {
    const saved = localStorage.getItem('gh_footage_folder');
    if (saved) {
      const parts = saved.split('/').filter(Boolean);
      return parts[parts.length - 1] || saved;
    }
    return '';
  });
  const [showFootageSection, setShowFootageSection] = useState(() => localStorage.getItem('gh_footage_folder') ? true : false);

  // Load subfolders on mount if folder was saved
  useEffect(() => {
    const saved = localStorage.getItem('gh_footage_folder');
    if (saved) {
      const parts = saved.split('/').filter(Boolean);
      setFootageFolderName(parts[parts.length - 1] || saved);
      loadSubfolders(saved);
    }
  }, []);

  const pickFootageFolder = async () => {
    try {
      setFootageMessage('⏳ กำลังเปิดเลือก Folder...');
      const res = await fetch('/api/pick-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'เลือก Folder สำหรับเก็บรูป Footage (ภาพประกอบโพส)' }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.cancelled) {
          setFootageMessage('');
        } else {
          setFootageMessage('❌ ไม่สามารถเลือก Folder ได้');
        }
        return;
      }
      setFootageFolder(data.dir);
      localStorage.setItem('gh_footage_folder', data.dir);
      const parts = data.dir.split('/').filter(Boolean);
      setFootageFolderName(parts[parts.length - 1] || data.dir);
      setFootageMessage('');
      setGeneratedPrompt('');
      // Load existing subfolders
      loadSubfolders(data.dir);
    } catch (e: any) {
      setFootageMessage(`❌ ${e.message || 'เกิดข้อผิดพลาด'}`);
    }
  };

  const loadSubfolders = async (parentFolder: string) => {
    try {
      const res = await fetch('/api/list-footage-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentFolder }),
      });
      const data = await res.json();
      setSubfolders(data.folders || []);
    } catch {
      setSubfolders([]);
    }
  };

  const createKeywordSubfolders = async () => {
    const folder = footageFolder;
    if (!folder) return;
    setIsCreatingFolders(true);
    setFootageMessage('');
    try {
      const subfolderNames = KEYWORDS.map(k => k.label);
      const res = await fetch('/api/create-subfolders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentFolder: folder, subfolders: subfolderNames }),
      });
      const data = await res.json();
      if (data.success) {
        setFootageMessage(`✅ สร้าง ${subfolderNames.length} subfolder เรียบร้อย!`);
        await loadSubfolders(folder);
      } else {
        setFootageMessage(`❌ ${data.error || 'เกิดข้อผิดพลาด'}`);
      }
    } catch (e: any) {
      setFootageMessage(`❌ ${e.message || 'เกิดข้อผิดพลาด'}`);
    } finally {
      setIsCreatingFolders(false);
    }
  };

  const handleGenerateStockPrompt = async () => {
    if (!selectedKw) {
      setFootageMessage('❌ กรุณาเลือกหัวข้อที่ต้องการ');
      return;
    }
    const kw = selectedKw;
    const numCount = Math.max(1, Math.min(50, parseInt(stockCount || '5') || 5));
    setIsGeneratingPrompt(true);
    setFootageMessage('');
    setGeneratedPrompt('');
    try {
      const promptText = `คุณคือผู้เชี่ยวชาญด้านการสร้าง Prompt สำหรับ AI Image Generation (เช่น Midjourney, DALL-E, Stable Diffusion)

ฉันต้องการสร้างรูปภาพ "Footage / ภาพประกอบ" สำหรับใช้ในบทความและโพส Facebook เกี่ยวกับ "${kw.label}" (หัวข้อ GitHub: ${kw.query})

สร้าง Prompt ภาษาอังกฤษจำนวน ${numCount} แบบ สำหรับใช้สร้างรูปภาพประกอบเนื้อหา โดยแต่ละ Prompt:
1. อธิบายภาพที่ต้องการอย่างละเอียด ในสไตล์ professional stock photo / modern technology
2. ระบุ mood & lighting: bright, professional, modern, clean background
3. Aspect ratio: 16:9 (suitable for cover images)
4. ไม่มีตัวหนังสือในภาพ
5. ไม่มีคน (หรือมีก็ได้ แต่เป็นมุมมองมือ/ภาพไกลๆ)
6. เน้น visual ที่ดูทันสมัย เป็นสากล
7. ให้เหมาะกับใช้เป็น "ภาพประกอบบทความ" ในโซเชียลมีเดีย

ตอบเป็น JSON array เท่านั้น:
["prompt 1", "prompt 2", ...]`;

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await getOpenRouterKeyCandidates())[0]?.key || ''}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Bulk Video Creator - Footage Prompt',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: promptText }],
          temperature: 0.8,
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || '';

      // Parse JSON array from response
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
      let prompts: string[] = [];
      try {
        prompts = JSON.parse(cleaned);
      } catch {
        const arrMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          try { prompts = JSON.parse(arrMatch[0]); } catch {}
        }
      }

      if (Array.isArray(prompts) && prompts.length > 0) {
        setGeneratedPrompt(prompts.join('\n\n'));
        setFootageMessage(`✅ สร้าง ${prompts.length} Prompt เรียบร้อย!`);
      } else {
        setGeneratedPrompt(raw);
        setFootageMessage('⚠️ ได้ผลลัพธ์มาแล้ว กรุณาตรวจสอบ');
      }
    } catch (e: any) {
      setFootageMessage(`❌ ${e.message || 'เกิดข้อผิดพลาด'}`);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // ─── OpenRouter helpers (ดึง key จาก shared utility) ───────────

  const callOpenRouter = async (messages: { role: string; content: string }[]) => {
    const candidates = await getOpenRouterKeyCandidates();
    if (candidates.length === 0) throw new Error('ไม่พบ OpenRouter API Key — กรุณาไปตั้งค่า API Key ก่อน');
    
    // ลอง model ที่เลือก → ถ้าไม่ได้ fallback ไป model ราคาถูกกว่า
    const modelsToTry = [ghModel, ...GH_MODEL_OPTIONS.map(m => m.id).filter(m => m !== ghModel)];
    let lastErr = '';
    
    for (const cand of candidates) {
      for (const model of modelsToTry) {
        try {
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cand.key}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': window.location.origin,
              'X-Title': 'Bulk Video Creator - GitHub Finder',
            },
            body: JSON.stringify({ model, messages, temperature: 0.9 }),
          });
          const data = await res.json();
          if (res.ok && !data.error) {
            return data.choices?.[0]?.message?.content || '';
          }
          lastErr = data.error?.message || `error ${res.status}`;
          // ถ้าเป็น credits error → ลอง model ถัดไปก่อน
          if (/credits|afford/i.test(lastErr)) {
            console.warn(`[GH Finder] Model ${model} credits error, trying next...`);
            continue;
          }
          // error อื่นๆ → ลอง key ถัดไป
          break;
        } catch (fetchErr: any) {
          lastErr = fetchErr.message || 'Network error';
          break;
        }
      }
    }
    throw new Error(lastErr || 'OpenRouter error — ลองเปลี่ยน model หรือเติม credit');
  };

  // ─── Extract GIF URLs only from README markdown ────────────────────────────
  const extractImages = (markdown: string): string[] => {
    const seen = new Set<string>();
    const gifs: string[] = [];

    const add = (url: string) => {
      try {
        const clean = url.split('?')[0].trim();
        if (!clean.startsWith('http') || seen.has(clean)) return;
        if (!/\.gif$/i.test(clean)) return;
        if (/shields\.io|badge|travis|circleci|codecov/i.test(clean)) return;
        seen.add(clean);
        gifs.push(clean);
      } catch {}
    };

    for (const m of markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g)) add(m[1]);
    for (const m of markdown.matchAll(/<img[^>]+src=["'](https?:\/\/[^"'\s>]+)["']/gi)) add(m[1]);

    // return up to 3 GIFs, pad with '' if fewer
    return [gifs[0] || '', gifs[1] || '', gifs[2] || ''];
  };

  // ─── Fetch GitHub README ────────────────────────────────────────────────────
  const fetchReadme = async (fullName: string): Promise<{ content: string; images: string[] }> => {
    try {
      const res = await fetch(`https://api.github.com/repos/${fullName}/readme`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) return { content: '', images: ['', '', ''] };
      const data = await res.json();
      const decoded = atob(data.content.replace(/\n/g, ''));
      return {
        content: decoded.slice(0, 3500),
        images: extractImages(decoded),
      };
    } catch {
      return { content: '', images: ['', '', ''] };
    }
  };

  // ─── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const kw = KEYWORDS.find(k => k.query === selectedQuery);
    if (!kw) return;
    const numCount = Math.max(1, Math.min(30, parseInt(count) || 10));
    setIsLoading(true);
    setError('');
    setRepos([]);
    setSelectedIds(new Set());
    setGeneratedPosts([]);
    try {
      const res = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(kw.query)}&sort=stars&order=desc&per_page=${numCount}`,
        { headers: { Accept: 'application/vnd.github+json' } }
      );
      if (res.status === 403) throw new Error('Rate limit — รอสักครู่แล้วลองใหม่ (60 req/ชั่วโมง)');
      if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
      const data = await res.json();
      setRepos(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Selection ──────────────────────────────────────────────────────────────
  const toggleSelect = (id: number) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAll = () => setSelectedIds(new Set(repos.map(r => r.id)));
  const deselectAll = () => setSelectedIds(new Set());

  // ─── Download repos CSV ─────────────────────────────────────────────────────
  const downloadReposCSV = () => {
    const selected = repos.filter(r => selectedIds.has(r.id));
    if (!selected.length) return alert('กรุณาเลือก repo ก่อน');
    const rows: string[][] = [['name', 'full_name', 'description', 'stars', 'language', 'topics', 'url']];
    selected.forEach(r =>
      rows.push([r.name, r.full_name, r.description || '', String(r.stargazers_count), r.language || '', r.topics.join(';'), r.html_url])
    );
    downloadCSV(rows, `github_repos_${Date.now()}.csv`);
  };

  // ─── Generate clickbait posts ────────────────────────────────────────────────
  const handleGeneratePosts = async () => {
    const selected = repos.filter(r => selectedIds.has(r.id));
    if (!selected.length) return alert('กรุณาเลือก repo ก่อน');
    const keyCandidates = await getOpenRouterKeyCandidates();
    if (keyCandidates.length === 0) return alert('กรุณาตั้งค่า OpenRouter API Key ก่อน');

    stopRef.current = false;
    setIsGenerating(true);
    setGeneratedPosts(selected.map(r => ({
      repoId: r.id, full_name: r.full_name, html_url: r.html_url,
      stars: r.stargazers_count, description: r.description || '',
      clickbait_caption: '', comment_1: '', comment_2: '', comment_3: '',
      images: [],
      status: 'pending',
    })));

    for (let i = 0; i < selected.length; i++) {
      if (stopRef.current) break;
      const repo = selected[i];
      setGenLog(`[${i + 1}/${selected.length}] 📖 กำลังอ่าน README: ${repo.full_name}`);

      setGeneratedPosts(prev => prev.map(p =>
        p.repoId === repo.id ? { ...p, status: 'loading' } : p
      ));

      try {
        const { content: readme, images } = await fetchReadme(repo.full_name);
        setGenLog(`[${i + 1}/${selected.length}] ✍️ AI กำลังเขียนโพส: ${repo.full_name}`);

        const prompt = buildPrompt(repo, readme);
        const rawOutput = await callOpenRouter([{ role: 'user', content: prompt }]);
        const parsed = parseAIOutput(rawOutput, repo.html_url);

        setGeneratedPosts(prev => prev.map(p =>
          p.repoId === repo.id ? { ...p, ...parsed, images, status: 'done' } : p
        ));
      } catch (err: any) {
        setGeneratedPosts(prev => prev.map(p =>
          p.repoId === repo.id ? { ...p, status: 'error', error: err.message } : p
        ));
      }
    }

    setGenLog('');
    setIsGenerating(false);
  };

  const buildPrompt = (repo: GithubRepo, readme: string): string => {
    const repoInfo = [
      `ชื่อ: ${repo.full_name}`,
      `คำอธิบาย: ${repo.description || '(ไม่มี)'}`,
      `ดาว: ${repo.stargazers_count.toLocaleString()}`,
      `ภาษา: ${repo.language || 'N/A'}`,
      `Topics: ${repo.topics.join(', ') || 'N/A'}`,
      `Link: ${repo.html_url}`,
    ].join('\n');

    return `คุณคือผู้เชี่ยวชาญเขียนโพสภาษาไทยสำหรับเพจ Facebook ที่สอนเรื่อง AI, แชร์ความรู้น่าสนใจ, และเครื่องมือ AI ที่เป็นประโยชน์

ข้อมูล GitHub Repo ที่ต้องเขียนโพสให้:
${repoInfo}

${readme ? `\nเนื้อหา README (ส่วนหนึ่ง):\n${readme}` : ''}

---
สร้างโพส Facebook thread แบบ 4 ส่วน ดังนี้:

**clickbait_caption** (โพสหลัก — สำคัญที่สุด):
เขียนพาดหัวมาให้เลือก 3 แบบ (แต่ละแบบให้มีสไตล์ มุมมอง หรือจุดเน้นที่แตกต่างกัน) โดยอ้างอิงจากตัวอย่างเหล่านี้:

ตัวอย่างสำนวน Clickbait:
• "โกยเงินจาก AI ง่ายๆ! สร้างรายได้หลักแสนต่อเดือนด้วย "Nano Banana" ฟรี! 7 วิธีทำเงิน Side Hustle แบบที่คุณไม่เคยรู้มาก่อน (มีต่อ👇)"
• "พลิกชีวิตจากศูนย์สู่หลักแสนใน 1 เดือน! 🔥 เคล็ดลับ Etsy ที่ไม่เคยมีใครบอกคุณ! ทำไมผมถึงทำเงินหลักหมื่นเหรียญได้หลัง 6 เดือนที่ล้มเหลว (มีต่อ👇)"
• "จากนักศึกษาจนๆ สู่รายได้ 20 ล้านเหรียญ💵ภายใน 5 ปี! 😱 เขาทำได้ยังไง? เคล็ดลับพลิกชีวิตแบบหมดเปลือก (มีต่อ👇)"
• "สร้างธุรกิจพันล้านจากศูนย์! 😲 อดีตเด็กดรอปเรียน เล่าหมดเปลือกเบื้องหลังสร้างบริษัท 800 ล้านดอลล์ใน 13 ปี!"
• "คนธรรมดาก็ทำเงินหลักแสนได้ แค่เลิกคิดแล้วเริ่มลงมือ! เคล็ดลับจาก CEO อายุน้อยกว่า 30 ที่เปลี่ยนความรำคาญให้เป็นโอกาสทอง! (มีต่อ👇)"
• "รวยหลักล้านจาก 28 แอปฯ! นี่คือ Tools ลับที่เจ้าของเขาใช้สร้างรายได้เดือนละ 3 แสนกว่าบาท!! (มีต่อ👇)"
• "สร้างวิดีโอ AI สุดล้ำภายในไม่กี่นาที! ด้วย Claude AI ผสม Remotion ฟรี! ทำได้เองง่ายๆ ประหยัดเวลาไป 99% (มีต่อ👇)"
• "ส่องอาณาจักรนักธุรกิจ #สายมัลติทาส์ก! 🤯 สร้างรายได้ 250,000 เหรียญต่อเดือนจาก 10+ ธุรกิจออนไลน์ที่หลากหลาย! (มีต่อ👇)"
• "AI Agency เตรียมเปลี่ยนโมเดล! 💥 ปี 2026 นี้ Claude Code จะทำให้คุณทำเงินมหาศาลจากลูกค้ารายย่อยได้ยังไง? ห้ามพลาดเด็ดขาด! (มีต่อ👇)"
• "CEO กินหรูอยู่สบาย ไล่พนักงาน 4,000 คนออก! แต่ไม่ใช่อย่างที่คุณคิด นี่คือ "เบื้องหลัง" ที่ AI ไม่ได้เป็นแพะรับบาป (มีต่อ👇)"
• "โอกาสทอง 2026! อยากเป็น Cloud Engineer เงินแสน แต่ทำไมคนส่วนใหญ่ไปไม่ถึง? นี่คือ "กับดัก" ที่ทำให้คุณพลาดโอกาส! (มีต่อ👇)"
• "พลิกชีวิตใน 90 วัน! สร้างรายได้ Passive Income หลักล้านจาก Digital Product (แบบที่คุณไม่เคยรู้มาก่อน) โอกาสนี้ห้ามพลาดเด็ดขาด! (มีต่อ👇)"
• "AI มาแรง! หวั่น Cloud Engineer ตกงาน? 😨 ไม่จริง! นี่คือ 5 สกิล AI ที่จะทำให้คุณเป็นที่ต้องการสุดๆ ในปี 2026! (มีต่อ👇)"

กฎของ clickbait_caption:
1. เน้น "ประโยชน์ต่อผู้อ่าน" ไม่ใช่ "มีคนปล่อย/มีคนทำ" → ให้รู้สึกว่า "นี่มันเกี่ยวกับฉัน!"
2. ใส่ตัวเลขที่ฟังดูน่าตื่นเต้น เช่น %, ล้าน, หมื่น, ชั่วโมง, กี่วัน, กี่ขั้นตอน
3. ห้ามเริ่มด้วย 🚨 — ใส่ emoji ได้ 1-2 ตัว แต่ต้องอยู่กลางหรือท้ายประโยค
4. สร้าง FOMO หรือ mystery: "สิ่งที่คุณไม่เคยรู้", "เคล็ดลับ", "โอกาสทอง", "ทำไมคนส่วนใหญ่พลาด"
5. ใส่ชื่อ tool/repo ใน "เครื่องหมายคำพูด" ถ้าชื่อสั้นและจำง่าย
6. 1-3 ประโยคสั้นกระชับ ห้ามยาวเกิน 3 บรรทัด
7. ลงท้ายด้วย (มีต่อ👇) เสมอ

**comment_1** (ความยาวปานกลาง):
- เกริ่นนำ อธิบายว่าเครื่องมือ/repo นี้คืออะไร และดีอย่างไร ให้ใช้โครงสร้างและสำนวนคล้ายตัวอย่างนี้:
"🔥 [ชื่อเครื่องมือ] คือเครื่องมือ [ทำอะไร] ที่ทำงานกับ [เทคโนโลยี/แนวคิด] เปลี่ยน [ปัญหา] ให้เป็นมืออาชีพในพริบตา! เราจะมาเจาะ [ตัวเลข] วิธีทำเงิน/ใช้งานจาก AI ตัวนี้ ตั้งแต่หลักพันยันหลักแสนต่อเดือน!

✅ 1. [ข้อดี/วิธีที่ 1]: [คำอธิบายรายละเอียด] คุณสามารถใช้ [ชื่อเครื่องมือ] สร้างผลงานสวยๆ ได้ง่ายๆ ภายในไม่กี่วินาที! ทำรายได้จากลูกค้ารายเดือนสบายๆ! ดูตัวอย่างในคลิป!

✅ 2. [ข้อดี/วิธีที่ 2]: [คำอธิบายรายละเอียด] ทำได้หมด! แค่ 5-10 นาทีต่อภาพ รายได้ 10-50 เหรียญ/ภาพ"

**comment_2** (ความยาวปานกลาง):
- อธิบายวิธีใช้งาน หรือฟีเจอร์เด่นๆ ต่อเนื่องจาก comment 1 แบบ bullet ใช้โครงสร้างและสำนวนคล้ายตัวอย่างนี้:
"✅ 3. [ข้อดี/วิธีที่ 3]: เปลี่ยน [สิ่งพื้นๆ] ให้เป็น [สุดอลังการ] ประหยัดเวลาและค่าใช้จ่ายในการจ้างมืออาชีพ! คุณรับงานได้แบบไม่ต้องลงทุนอุปกรณ์ใดๆ!

✅ 4. [ข้อดี/วิธีที่ 4]: [กลุ่มเป้าหมาย] ต่างต้องการ [ผลลัพธ์] และ AI ช่วยสร้างงานที่ดูเป็นธรรมชาติได้! รับงานง่าย รายได้ดี ไม่ต้องจ้างคนจริง!

✅ 5. [ข้อดี/วิธีที่ 5]: สร้างสรรค์ดีไซน์เก๋ๆ ด้วย AI แล้วอัปโหลดขึ้นแพลตฟอร์ม เมื่อมีคนสั่งซื้อ คุณก็ได้ส่วนแบ่งแบบ Passive Income ลงแรงครั้งเดียว เก็บเกี่ยวตลอดไป!

✅ 6. [ข้อดี/วิธีที่ 6]: ตลาดใหญ่มาก! สร้างเนื้อหา ภาพประกอบ สำหรับ [กลุ่มเป้าหมาย] อัปโหลดลงแพลตฟอร์ม รับค่า Royalty เพลินๆ!"

**comment_3** (ความยาวปานกลาง):
- อธิบายฟีเจอร์เด่นข้อสุดท้าย และสรุปปิดท้าย กระตุ้นให้ทดลอง พร้อมแจกวาร์ป (ใส่ลิงก์ GitHub) ใช้โครงสร้างและสำนวนคล้ายตัวอย่างนี้:
"✅ 7. สร้าง [ชิ้นงาน] ขาย! (หลัก 30,000 - 50,000 USD ต่อเดือน!!): โอกาสทองของตลาดดิจิทัล! ออกแบบ [ชิ้นงาน] ที่สวยงาม ใช้งานง่าย มีฟังก์ชันครบถ้วน ด้วย [ชื่อเครื่องมือ] ทั้ง [ส่วนประกอบ] หรือทุกองค์ประกอบ แล้วนำไปขาย คุณสามารถสร้างรายได้ Passive Income มหาศาลกว่าทุกวิธีที่กล่าวมา!

อยากรู้ว่าทำยังไงให้ได้เงินหมื่น-แสนต่อเดือนแบบไม่หลุดเทรนด์? ดูวิธีทำเงิน/วิธีใช้งานทั้ง 7 ข้อแบบละเอียดได้เลย!

👉 ลิงก์ GitHub:
${repo.html_url}"

กฎทั้งหมด:
- เขียนภาษาไทยทั้งหมด (ชื่อเทคนิค/ชื่อโปรเจกต์ใช้ภาษาอังกฤษได้)
- ห้ามเป็นทางการ เขียนแบบพูดคุยสนุกๆ
- แต่ละส่วนเขียนให้มีเนื้อหาแน่น ไม่ฟุ้ม

ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:
{
  "clickbait_caption": [
    "แบบที่ 1...",
    "แบบที่ 2...",
    "แบบที่ 3..."
  ],
  "comment_1": "...",
  "comment_2": "...",
  "comment_3": "..."
}`;
  };

  const parseAIOutput = (raw: string, fallbackUrl: string): Pick<GeneratedPost, 'clickbait_caption' | 'comment_1' | 'comment_2' | 'comment_3'> => {
    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
    const parseCaption = (c: any) => Array.isArray(c) ? c.map((v, i) => `${i + 1}. ${v}`).join('\n\n') : (c || '');
    try {
      const obj = JSON.parse(clean);
      return {
        clickbait_caption: parseCaption(obj.clickbait_caption),
        comment_1: obj.comment_1 || '',
        comment_2: obj.comment_2 || '',
        comment_3: ensureLink(obj.comment_3 || '', fallbackUrl),
      };
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const obj = JSON.parse(match[0]);
          return {
            clickbait_caption: parseCaption(obj.clickbait_caption),
            comment_1: obj.comment_1 || '',
            comment_2: obj.comment_2 || '',
            comment_3: ensureLink(obj.comment_3 || '', fallbackUrl),
          };
        } catch {}
      }
    }
    return { clickbait_caption: '', comment_1: raw, comment_2: '', comment_3: fallbackUrl };
  };

  const ensureLink = (text: string, url: string) =>
    text.includes(url) ? text : `${text}\n\n👉 ${url}`;

  // ─── GitHub Rate Limit ───────────────────────────────────────────────────────
  const checkRateLimit = async () => {
    setIsCheckingRate(true);
    try {
      const res = await fetch('https://api.github.com/rate_limit', {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setRateLimit({
        search: data.resources.search,
        core: data.resources.core,
      });
    } catch {
      setRateLimit(null);
    } finally {
      setIsCheckingRate(false);
    }
  };

  const formatReset = (unixTs: number) => {
    const secs = Math.max(0, unixTs - Math.floor(Date.now() / 1000));
    if (secs < 60) return `${secs} วินาที`;
    return `${Math.ceil(secs / 60)} นาที`;
  };

  // ─── Download posts CSV ─────────────────────────────────────────────────────
  const downloadPostsCSV = () => {
    const done = generatedPosts.filter(p => p.status === 'done');
    if (!done.length) return alert('ยังไม่มีโพสที่สร้างสำเร็จ');
    const headers = [
      'id', 'headline', 'repo_url', 'stars', 'description',
      'clickbait_caption', 'comment_1', 'comment_2', 'comment_3',
      'comment_1_image_url', 'comment_2_image_url', 'comment_3_image_url',
    ];
    const rows: string[][] = [headers];
    done.forEach(p =>
      rows.push([
        `result_${Date.now()}_${p.repoId}`,
        p.full_name,
        p.html_url,
        String(p.stars),
        p.description,
        p.clickbait_caption,
        p.comment_1,
        p.comment_2,
        p.comment_3,
        p.images[0] || '',
        p.images[1] || '',
        p.images[2] || '',
      ])
    );
    downloadCSV(rows, `github_clickbait_posts_${Date.now()}.csv`);
  };

  const selectedCount = selectedIds.size;
  const doneCount = generatedPosts.filter(p => p.status === 'done').length;

  const [sendLog, setSendLog] = useState('');

  const handleSendSelectedToAIPage = async () => {
    if (!onSendToAIPage) return;
    const selected = repos.filter(r => selectedIds.has(r.id));
    if (!selected.length) return alert('กรุณาเลือก repo ก่อน');
    const kw = KEYWORDS.find(k => k.query === selectedQuery);
    const topicLabel = kw?.label || 'GitHub';

    setSendLog('⏳ กำลังดึง README ของ repo ที่เลือก...');
    const items = [];
    for (let i = 0; i < selected.length; i++) {
      const r = selected[i];
      setSendLog(`⏳ [${i + 1}/${selected.length}] ดึง README: ${r.full_name}`);
      let readmeContent = '';
      let gifImages: string[] = [];
      try {
        const result = await fetchReadme(r.full_name);
        readmeContent = result.content;
        gifImages = result.images.filter(Boolean);
      } catch {}
      items.push({
        rawArticle: `[GitHub - ${r.full_name}]
${r.description || ''}
⭐ ${r.stargazers_count.toLocaleString()} | 🍴 ${r.forks_count.toLocaleString()} | 🔵 ${r.language || 'N/A'}
Topics: ${r.topics.join(', ') || 'N/A'}
URL: ${r.html_url}

${readmeContent ? `📖 README (บางส่วน):
${readmeContent}` : ''}`,
        sourceUrl: r.html_url,
        title: r.full_name,
        tags: ['github', topicLabel],
        images: gifImages,
        sourceType: 'github',
        domain: 'github.com',
      });
    }
    setSendLog('');
    onSendToAIPage(items);
  };

  return (
    <Card>
      <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
        <span className="text-2xl">🐙</span> หาของดีจาก GitHub
      </h2>
      <p className="text-xs text-gray-400 mb-5">
        สกัด keyword จากบทความยอดแชร์ → ค้นหา repo → สร้างโพส Clickbait พร้อมโพส
      </p>

      {/* ── Search controls ── */}
      <div className="flex gap-3 flex-wrap items-center mb-4">
        <select
          value={selectedQuery}
          onChange={e => setSelectedQuery(e.target.value)}
          className="input-field flex-1 min-w-[220px] text-sm"
        >
          {KEYWORDS.map(k => (
            <option key={k.query} value={k.query}>{k.emoji} {k.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2">
          <label className="text-xs text-gray-400 whitespace-nowrap">จำนวน</label>
          <input
            type="number"
            value={count}
            onChange={e => setCount(e.target.value)}
            className="w-14 bg-transparent text-sm font-bold text-white text-center outline-none"
            placeholder="10"
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap"
        >
          {isLoading ? '⏳ กำลังค้นหา...' : '🔍 ค้นหา'}
        </button>
      </div>

      {/* ── AI Model Selector ── */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-lg border" style={{ backgroundColor: 'var(--bg-card, #1a1a2e)', borderColor: 'var(--border-color, #333)' }}>
        <span className="text-xs text-gray-400 font-semibold whitespace-nowrap">🤖 โมเดล AI:</span>
        <select
          value={ghModel}
          onChange={e => { setGhModel(e.target.value); localStorage.setItem('gh_finder_model', e.target.value); }}
          className="flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold border-0 outline-none cursor-pointer"
          style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: 'var(--text-main, #fff)' }}
        >
          {GH_MODEL_OPTIONS.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <span className="text-[10px] text-gray-500">ถ้า model ใช้ไม่ได้ ระบบจะ fallback อัตโนมัติ</span>
      </div>

      {/* ── Rate limit checker ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={checkRateLimit}
          disabled={isCheckingRate}
          className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-lg transition-all flex items-center gap-1.5"
        >
          {isCheckingRate ? '⏳ กำลังเช็ค...' : '📊 เช็ค API quota'}
        </button>

        {rateLimit && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {/* Search API — used for repo search */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${
                rateLimit.search.remaining === 0
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : rateLimit.search.remaining <= 3
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-green-500/10 border-green-500/30 text-green-300'
              }`}>
                <span>🔍 ค้นหา</span>
                <span className="font-bold">{rateLimit.search.remaining}/{rateLimit.search.limit}</span>
                {rateLimit.search.remaining === 0
                  ? <span className="text-gray-400">— รีเซ็ตใน {formatReset(rateLimit.search.reset)}</span>
                  : <span className="text-gray-400">ครั้ง/นาที</span>
                }
              </div>

              {/* Core API — used for README fetch */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${
                rateLimit.core.remaining === 0
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : rateLimit.core.remaining <= 10
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-green-500/10 border-green-500/30 text-green-300'
              }`}>
                <span>📖 README</span>
                <span className="font-bold">{rateLimit.core.remaining}/{rateLimit.core.limit}</span>
                {rateLimit.core.remaining === 0
                  ? <span className="text-gray-400">— รีเซ็ตใน {formatReset(rateLimit.core.reset)}</span>
                  : <span className="text-gray-400">ครั้ง/ชั่วโมง</span>
                }
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              🔍 <span className="text-gray-400">ค้นหา</span> = ใช้ตอนกด "ค้นหา" — GitHub อนุญาต <span className="text-white">10 ครั้ง/นาที</span> สำหรับ guest (รีเซ็ตทุกนาที){' '}
              &nbsp;|&nbsp; 📖 <span className="text-gray-400">README</span> = ใช้ตอนสร้างโพส (ดึง README ต่อ repo) — อนุญาต <span className="text-white">60 ครั้ง/ชั่วโมง</span> สำหรับ guest (รีเซ็ตทุกชั่วโมง)
            </p>
          </div>
        )}
      </div>

      {selectedKw && (
        <div className="mb-4 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-lg text-xs text-violet-300">
          🔎 query: <span className="font-mono">{selectedKw.query}</span>
        </div>
      )}

      {/* ── Footage / Stock Image Management ── */}
      <div className="mb-4 border border-gray-700/50 rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card, #1a1a2e)' }}>
        <button
          onClick={() => setShowFootageSection(!showFootageSection)}
          className="w-full flex items-center justify-between p-4 hover:opacity-80 transition-all"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🖼️</span>
            <span className="font-bold text-sm">รูป Footage ประกอบโพส</span>
          </div>
          <span className={`text-xs text-gray-500 transition-transform ${showFootageSection ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {showFootageSection && (
          <div className="px-4 pb-4 space-y-3">
            <p className="text-xs text-gray-400">เลือก folder ที่มีรูปภาพ หรือสร้าง subfolder ตามหัวข้อ Dropbox</p>

            {/* Folder picker */}
            <div className="flex items-center gap-2">
              <button
                onClick={pickFootageFolder}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2"
              >
                📁 เลือก Folder
              </button>
              {footageFolder && (
                <span className="text-xs text-gray-400 truncate flex-1">
                  📂 {footageFolderName}
                </span>
              )}
            </div>

            {footageFolder && subfolders.length === 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs text-amber-300 mb-2">
                  ⚡ Folder นี้ยังไม่มี subfolder — กดสร้าง subfolder ตามหัวข้อทั้งหมด ({KEYWORDS.length} หัวข้อ) เลย!
                </p>
                <button
                  onClick={createKeywordSubfolders}
                  disabled={isCreatingFolders}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-all"
                >
                  {isCreatingFolders ? '⏳ กำลังสร้าง...' : '📂 สร้าง Subfolder ทั้งหมด'}
                </button>
              </div>
            )}

            {subfolders.length > 0 && (
              <>
                {/* Subfolder dropdown — synced with selectedQuery */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedQuery}
                    onChange={e => setSelectedQuery(e.target.value)}
                    className="input-field flex-1 text-sm"
                  >
                    {subfolders.length > 0
                      ? KEYWORDS.filter(k => subfolders.some(sf => sf.name === k.label)).map(k => {
                          const sf = subfolders.find(s => s.name === k.label);
                          return (
                            <option key={k.query} value={k.query}>
                              {k.emoji} {k.label} ({sf?.imageCount ?? 0} รูป)
                            </option>
                          );
                        })
                      : KEYWORDS.map(k => (
                          <option key={k.query} value={k.query}>
                            {k.emoji} {k.label}
                          </option>
                        ))
                    }
                  </select>
                  {(subfolders.length < KEYWORDS.length) && (
                    <button
                      onClick={createKeywordSubfolders}
                      disabled={isCreatingFolders}
                      className="text-xs px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-lg transition-all whitespace-nowrap"
                      title="สร้าง subfolder ที่ยังไม่มีเพิ่ม"
                    >
                      {isCreatingFolders ? '⏳...' : '+ เพิ่ม'}
                    </button>
                  )}
                </div>

                {/* Stock count + generate prompt */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2">
                    <label className="text-xs text-gray-400 whitespace-nowrap">จำนวน Prompt</label>
                    <input
                      type="text"
                      value={stockCount}
                      onChange={e => {
                        const v = e.target.value;
                        if (v === '' || /^\d+$/.test(v)) setStockCount(v);
                      }}
                      onBlur={e => {
                        if (e.target.value === '' || parseInt(e.target.value) < 1) setStockCount('5');
                      }}
                      className="w-14 bg-transparent text-sm font-bold text-white text-center outline-none"
                    />
                  </div>
                  <button
                    onClick={handleGenerateStockPrompt}
                    disabled={isGeneratingPrompt}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap"
                  >
                    {isGeneratingPrompt ? '⏳ กำลังสร้าง...' : '✨ สร้าง Prompt'}
                  </button>
                </div>

                {/* Generated prompt result */}
                {generatedPrompt && (
                  <div className="p-3 bg-black/30 rounded-lg border border-gray-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400 font-medium">📝 Prompt ที่สร้างได้</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedPrompt);
                          setFootageMessage('📋 คัดลอก Prompt แล้ว!');
                          setTimeout(() => setFootageMessage(''), 2000);
                        }}
                        className="text-xs px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-all"
                      >
                        📋 copy ทั้งหมด
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={generatedPrompt}
                      className="w-full bg-gray-900/50 text-gray-200 text-xs font-mono p-2 rounded border border-gray-700/50 outline-none resize-none"
                      rows={Math.min(generatedPrompt.split('\n').length, 12)}
                    />
                  </div>
                )}
              </>
            )}

            {footageMessage && (
              <div className={`text-xs px-3 py-2 rounded-lg ${footageMessage.startsWith('✅') || footageMessage.startsWith('📋')
                ? 'bg-green-500/10 border border-green-500/20 text-green-300'
                : footageMessage.startsWith('❌')
                  ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                  : 'bg-blue-500/10 border border-blue-500/20 text-blue-300'
              }`}>
                {footageMessage}
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4">
          ⚠️ {error}
        </div>
      )}

      {isLoading && (
        <div className="p-4 bg-black/30 rounded-lg border border-gray-700 text-sm text-gray-400 animate-pulse mb-4">
          ⏳ กำลังดึงข้อมูลจาก GitHub...
        </div>
      )}

      {/* ── Results + selection controls ── */}
      {repos.length > 0 && (
        <div>
          {/* Selection bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded font-medium transition-all"
              >
                ☑ เลือกทั้งหมด
              </button>
              <button
                onClick={deselectAll}
                className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded font-medium transition-all"
              >
                ☐ ยกเลิก
              </button>
              <span className="text-xs text-gray-400">เลือก {selectedCount}/{repos.length}</span>
            </div>

            {selectedCount > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={downloadReposCSV}
                  className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-all flex items-center gap-1"
                >
                  ⬇ โหลด CSV (repos)
                </button>
                <button
                  onClick={isGenerating ? () => { stopRef.current = true; } : handleGeneratePosts}
                  className={`text-xs px-3 py-1.5 rounded font-medium transition-all flex items-center gap-1 ${
                    isGenerating
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 text-white'
                  }`}
                >
                  {isGenerating ? '⛔ หยุด' : '✍️ สร้างโพส Clickbait'}
                </button>
                {onSendToAIPage && (
                  <button
                    onClick={handleSendSelectedToAIPage}
                    className="text-xs px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded font-medium transition-all flex items-center gap-1"
                  >
                    📤 ส่งไปสร้างโพสต์ AI
                  </button>
                )}
                {sendLog && (
                  <span className="text-xs text-cyan-300 animate-pulse ml-1">{sendLog}</span>
                )}
              </div>
            )}
          </div>

          {/* Repo list */}
          <div className="space-y-2 mb-4">
            <p className="text-xs text-gray-400">พบ <span className="text-white font-bold">{repos.length}</span> repos — เรียงตาม ⭐ มากสุด</p>
            {repos.map((repo, idx) => {
              const isChecked = selectedIds.has(repo.id);
              return (
                <div
                  key={repo.id}
                  onClick={() => toggleSelect(repo.id)}
                  className={`rounded-xl border p-4 transition-all cursor-pointer ${
                    isChecked
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'hover:border-violet-500/40'
                  }`}
                  style={!isChecked ? { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' } : undefined}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(repo.id)}
                      onClick={e => e.stopPropagation()}
                      className="mt-1 accent-violet-500 w-4 h-4 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-500 text-xs font-mono">#{idx + 1}</span>
                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-violet-400 hover:text-violet-300 font-bold text-sm break-all"
                        >
                          {repo.full_name}
                        </a>
                      </div>
                      {repo.description && (
                        <p className="text-gray-300 text-sm mb-2 leading-relaxed">{repo.description}</p>
                      )}
                      {repo.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {repo.topics.slice(0, 6).map(t => (
                            <span key={t} className="px-2 py-0.5 text-xs rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/20">{t}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {repo.language && <span>🔵 {repo.language}</span>}
                        <span>🍴 {repo.forks_count.toLocaleString()}</span>
                        <span>🕐 {timeAgo(repo.updated_at)}</span>
                      </div>
                    </div>
                    <span className="text-yellow-400 font-bold text-sm shrink-0">⭐ {formatStars(repo.stargazers_count)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isLoading && repos.length === 0 && !error && (
        <div className="text-center py-12 text-gray-500 border border-dashed rounded-xl">
          <p className="text-3xl mb-3">🐙</p>
          <p className="text-sm">เลือก keyword แล้วกด ค้นหา เพื่อดึง repo จาก GitHub</p>
          <p className="text-xs text-gray-600 mt-1">ใช้ GitHub public API (ฟรี 60 req/ชั่วโมง)</p>
        </div>
      )}

      {/* ── Generated posts section ── */}
      {generatedPosts.length > 0 && (
        <div className="mt-6 border-t border-gray-700 pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold flex items-center gap-2">
              ✍️ โพส Clickbait ที่สร้างแล้ว
              <span className="text-xs text-gray-400 font-normal">({doneCount}/{generatedPosts.length})</span>
            </h3>
            {doneCount > 0 && (
              <button
                onClick={downloadPostsCSV}
                className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded font-medium transition-all flex items-center gap-1"
              >
                ⬇ โหลด CSV (posts)
              </button>
            )}
          </div>

          {genLog && (
            <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 animate-pulse">
              {genLog}
            </div>
          )}

          <div className="space-y-4">
            {generatedPosts.map((post, idx) => (
              <div
                key={post.repoId}
                className="rounded-xl border p-4"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-sm text-violet-300">#{idx + 1} {post.full_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    post.status === 'done' ? 'bg-green-500/20 text-green-300' :
                    post.status === 'loading' ? 'bg-amber-500/20 text-amber-300 animate-pulse' :
                    post.status === 'error' ? 'bg-red-500/20 text-red-300' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {post.status === 'done' ? '✅ เสร็จ' :
                     post.status === 'loading' ? '⏳ กำลังสร้าง...' :
                     post.status === 'error' ? '❌ ผิดพลาด' : '⏸ รอ'}
                  </span>
                </div>

                {post.status === 'error' && (
                  <p className="text-red-400 text-xs">{post.error}</p>
                )}

                {post.status === 'done' && (
                  <div className="space-y-3">
                    <PostField label="📢 Clickbait Caption (โพสหลัก)" value={post.clickbait_caption} />
                    <PostField label="💬 Comment 1" value={post.comment_1} imageUrl={post.images[0]} />
                    <PostField label="💬 Comment 2" value={post.comment_2} imageUrl={post.images[1]} />
                    <PostField label="💬 Comment 3 (+ Link)" value={post.comment_3} imageUrl={post.images[2]} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function PostField({ label, value, imageUrl }: { label: string; value: string; imageUrl?: string }) {
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImg, setCopiedImg] = useState(false);
  const [imgError, setImgError] = useState(false);

  const copyText = () => {
    navigator.clipboard.writeText(value);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 1500);
  };

  const copyImgUrl = () => {
    if (!imageUrl) return;
    navigator.clipboard.writeText(imageUrl);
    setCopiedImg(true);
    setTimeout(() => setCopiedImg(false), 1500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400 font-medium">{label}</span>
        <button
          onClick={copyText}
          className="text-xs px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-all"
        >
          {copiedText ? '✅ copied' : '📋 copy'}
        </button>
      </div>
      <div className="bg-black/30 rounded-lg p-3 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed border border-gray-700/50 mb-2">
        {value}
      </div>
      {imageUrl && !imgError && (
        <div className="flex items-start gap-3 p-2 bg-gray-800/40 rounded-lg border border-gray-700/50">
          <img
            src={imageUrl}
            alt="preview"
            className="w-20 h-14 object-cover rounded border border-gray-700 shrink-0 bg-gray-900"
            onError={() => setImgError(true)}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-1">🖼️ Image URL (วางใน Facebook comment ได้เลย)</p>
            <p className="text-xs text-gray-400 font-mono break-all line-clamp-2">{imageUrl}</p>
          </div>
          <button
            onClick={copyImgUrl}
            className="text-xs px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded transition-all shrink-0 whitespace-nowrap"
          >
            {copiedImg ? '✅' : '📋 copy URL'}
          </button>
        </div>
      )}
    </div>
  );
}
