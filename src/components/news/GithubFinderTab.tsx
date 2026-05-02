import React, { useState, useRef } from 'react';
import { Card } from '../ui/Card';

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

export function GithubFinderTab() {
  const [selectedQuery, setSelectedQuery] = useState(KEYWORDS[0].query);
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

  // ─── OpenRouter helpers (same pattern as NewsScraperTab) ───────────────────
  const getOpenRouterKeyCandidates = () => {
    const candidates: { key: string; label: string }[] = [];
    const addCandidate = (key: unknown, label: string) => {
      const clean = String(key || '').trim();
      if (!clean || candidates.some(c => c.key === clean)) return;
      candidates.push({ key: clean, label });
    };
    try {
      const profiles = JSON.parse(localStorage.getItem('api_global_profiles') || '[]');
      const activeId = localStorage.getItem('api_global_active_id');
      if (Array.isArray(profiles)) {
        const active = profiles.find((p: any) => p.id === activeId);
        addCandidate(active?.openRouterKey, `Profile: ${active?.name || 'active'}`);
        profiles.forEach((p: any, i: number) =>
          addCandidate(p?.openRouterKey, `Profile ${i + 1}: ${p?.name || p?.id}`)
        );
      }
    } catch {}
    addCandidate(localStorage.getItem('openrouter_key'), 'Legacy');
    try {
      const keys = JSON.parse(localStorage.getItem('openrouter_keys') || '[]');
      if (Array.isArray(keys)) {
        const active = keys.find((k: any) => k.isActive);
        addCandidate(active?.key, `OR key: ${active?.name || 'active'}`);
        keys.forEach((k: any, i: number) => addCandidate(k?.key, `OR key ${i + 1}`));
      }
    } catch {}
    return candidates;
  };

  const callOpenRouter = async (messages: { role: string; content: string }[]) => {
    const candidates = getOpenRouterKeyCandidates();
    if (candidates.length === 0) throw new Error('ไม่พบ OpenRouter API Key');
    let lastErr = '';
    for (const cand of candidates) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cand.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages, temperature: 0.9 }),
      });
      const data = await res.json();
      if (res.ok && !data.error) return data.choices?.[0]?.message?.content || '';
      lastErr = data.error?.message || `error ${res.status}`;
      if (/credits|afford/i.test(lastErr)) continue;
      throw new Error(lastErr);
    }
    throw new Error(lastErr || 'OpenRouter error');
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
    if (getOpenRouterKeyCandidates().length === 0) return alert('กรุณาตั้งค่า OpenRouter API Key ก่อน');

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
เขียนให้เหมือนตัวอย่างเหล่านี้ทุกประการ:

ตัวอย่างที่ดี:
• "โกยเงินจาก AI ง่ายๆ! สร้างรายได้หลักแสนต่อเดือนด้วย "Nano Banana" ฟรี! 7 วิธีทำเงิน Side Hustle แบบที่คุณไม่เคยรู้มาก่อน (มีต่อ👇)"
• "สร้างวิดีโอ AI สุดล้ำภายในไม่กี่นาที! ด้วย Claude AI ผสม Remotion ฟรี! ทำได้เองง่ายๆ ประหยัดเวลาไป 99% (มีต่อ👇)"
• "AI มาแรง! หวั่น Cloud Engineer ตกงาน? 😨 ไม่จริง! นี่คือ 5 สกิล AI ที่จะทำให้คุณเป็นที่ต้องการสุดๆ ในปี 2026! (มีต่อ👇)"
• "โอกาสทอง! แค่ใช้ SORA 2 ทำเงินหลักหมื่นต่อเดือน ง่ายกว่าที่คิด ไม่ต้องรอ Invite Code ให้เสียเวลา! (มีต่อ👇)"
• "คนปกติทำไม่ได้! ชายคนนี้ใช้ Claude สร้างแอปพลิเคชันดู MRI ได้เองจาก USB ทั้งที่เครื่องเป็น Mac! (มีต่อ👇)"

กฎของ clickbait_caption:
1. เน้น "ประโยชน์ต่อผู้อ่าน" ไม่ใช่ "มีคนปล่อย/มีคนทำ" → ให้รู้สึกว่า "นี่มันเกี่ยวกับฉัน!"
2. ใส่ตัวเลขที่ฟังดูน่าตื่นเต้น เช่น %, ล้าน, หมื่น, ชั่วโมง, กี่วัน, กี่ขั้นตอน
3. ห้ามเริ่มด้วย 🚨 — ใส่ emoji ได้ 1-2 ตัว แต่ต้องอยู่กลางหรือท้ายประโยค
4. สร้าง FOMO หรือ mystery: "สิ่งที่คุณไม่เคยรู้", "เคล็ดลับ", "โอกาสทอง", "ทำไมคนส่วนใหญ่พลาด"
5. ใส่ชื่อ tool/repo ใน "เครื่องหมายคำพูด" ถ้าชื่อสั้นและจำง่าย
6. 1-3 ประโยคสั้นกระชับ ห้ามยาวเกิน 3 บรรทัด
7. ลงท้ายด้วย (มีต่อ👇) เสมอ

**comment_1** (ความยาวปานกลาง):
- เล่าว่า repo นี้คืออะไร ทำไมถึงน่าสนใจ
- บอก features หลัก 2-3 อย่างในรูปแบบ checkmark ✅
- เขียนเหมือนเพื่อนมาบอกข่าวดี ไม่เป็นทางการ

**comment_2** (ความยาวปานกลาง):
- เล่า use case จริงๆ ว่าใช้ทำอะไรได้บ้าง
- อธิบาย features เพิ่มเติมหรือวิธีใช้งาน
- ใส่ตัวเลข สถิติ หรือ comparison ถ้ามี

**comment_3** (ความยาวปานกลาง):
- สรุปว่าใครควรใช้ / ทำไมถึงต้องสนใจ
- กระตุ้นให้ไปทดลอง
- ลงท้ายด้วย: "👉 ลิงก์ GitHub อยู่ใต้นี้เลยครับ\n${repo.html_url}"

กฎทั้งหมด:
- เขียนภาษาไทยทั้งหมด (ชื่อเทคนิค/ชื่อโปรเจกต์ใช้ภาษาอังกฤษได้)
- ห้ามเป็นทางการ เขียนแบบพูดคุยสนุกๆ
- แต่ละส่วนเขียนให้มีเนื้อหาแน่น ไม่ฟุ้ม

ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:
{
  "clickbait_caption": "...",
  "comment_1": "...",
  "comment_2": "...",
  "comment_3": "..."
}`;
  };

  const parseAIOutput = (raw: string, fallbackUrl: string): Pick<GeneratedPost, 'clickbait_caption' | 'comment_1' | 'comment_2' | 'comment_3'> => {
    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
    try {
      const obj = JSON.parse(clean);
      return {
        clickbait_caption: obj.clickbait_caption || '',
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
            clickbait_caption: obj.clickbait_caption || '',
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

  const selectedKw = KEYWORDS.find(k => k.query === selectedQuery);
  const selectedCount = selectedIds.size;
  const doneCount = generatedPosts.filter(p => p.status === 'done').length;

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
