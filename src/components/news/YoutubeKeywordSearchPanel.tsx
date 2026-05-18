import React, { useMemo, useState } from 'react';
import { Card } from '../ui/Card';
import { NumInput } from '../ui/NumInput';
import { getActiveOpenRouterKeyAsync } from '../../hooks/useApiSettings';

interface YoutubeDiscoveryVideo {
  id: string;
  title: string;
  url: string;
  views: number | null;
  uploadedAt: string;
  thumbnail: string;
  duration: number | null;
  channelName?: string;
  channelUrl?: string;
}

interface YoutubeKeywordCategory {
  id: string;
  label: string;
  description: string;
  seeds: string[];
}

const YOUTUBE_KEYWORD_CATEGORIES: YoutubeKeywordCategory[] = [
  {
    id: 'ai-success',
    label: 'AI Success Stories',
    description: 'เคสคนใช้ AI/Claude Code แล้วได้ผลลัพธ์จริง เหมาะทำเพจ AI แบบเล่าเรื่องชัยชนะ',
    seeds: [
      'claude code success story',
      'built with claude code',
      'claude code case study',
      'claude code made me',
      'vibe coding success story',
      'ai coding agent success story',
    ],
  },
  {
    id: 'ai-tools',
    label: 'AI Tools ที่คนแชร์',
    description: 'เครื่องมือใหม่ วิธีใช้ และ workflow ที่คนทั่วไปเอาไปลองตามได้',
    seeds: [
      'best ai tools 2026',
      'new ai tools for creators',
      'ai automation workflow',
      'claude code workflow',
      'chatgpt automation case study',
      'openai agents tutorial success',
    ],
  },
  {
    id: 'creator-money',
    label: 'Creator ทำเงิน',
    description: 'คนเอา AI ไปทำเงิน ทำเพจ ทำแอป ทำสินค้า หรือเพิ่มยอดขาย',
    seeds: [
      'made money with ai tools',
      'ai side hustle success story',
      'built an app with ai and made money',
      'ai content business case study',
      'one person ai startup',
      'solo founder ai success story',
    ],
  },
  {
    id: 'before-after',
    label: 'ก่อน-หลัง ใช้ AI',
    description: 'หัวข้อแนว transformation มีดราม่า/ผลลัพธ์ชัด เจอ hook ได้ง่าย',
    seeds: [
      'before and after using ai',
      'i replaced my workflow with ai',
      'how ai changed my business',
      'from zero to app with claude code',
      'i built this in one day with ai',
      'non coder built app with ai',
    ],
  },
  {
    id: 'thai-ai',
    label: 'ตลาดไทย/เอเชีย',
    description: 'ค้นหา keyword ไทยผสมอังกฤษสำหรับคอนเทนต์ที่คนไทยเข้าใจเร็ว',
    seeds: [
      'Claude Code สร้างเว็บ',
      'ใช้ AI เขียนโค้ด',
      'หาเงินด้วย AI',
      'AI ทำเพจ',
      'Claude Code รีวิว',
      'สร้างแอปด้วย AI',
    ],
  },
];

const DEFAULT_YOUTUBE_KEYWORD = 'claude code success story';
const FREE_KEYWORD_MODEL = 'google/gemma-3-27b-it:free';

const parseLooseJson = (text: string): any | null => {
  const cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
};

const formatYtViews = (views: number | null) => {
  if (views == null || Number.isNaN(views)) return '-';
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${Math.round(views / 1_000)}K`;
  return views.toLocaleString();
};

const formatYtDuration = (seconds: number | null) => {
  if (!seconds || seconds < 1) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

const formatYtDate = (value: string) => {
  const raw = String(value || '');
  if (!raw) return '';
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function YoutubeKeywordSearchPanel({
  onAddUrlsToQueue,
  onUseSingleUrl,
  onLog,
}: {
  onAddUrlsToQueue: (urls: string[]) => number;
  onUseSingleUrl: (url: string) => void;
  onLog: (message: string) => void;
}) {
  const [ytKeyword, setYtKeyword] = useState(DEFAULT_YOUTUBE_KEYWORD);
  const [ytKeywordCategoryId, setYtKeywordCategoryId] = useState(YOUTUBE_KEYWORD_CATEGORIES[0].id);
  const [ytKeywordIdeas, setYtKeywordIdeas] = useState<string[]>(YOUTUBE_KEYWORD_CATEGORIES[0].seeds);
  const [ytSearchLimit, setYtSearchLimit] = useState(12);
  const [ytSearchDays, setYtSearchDays] = useState(120);
  const [isYtSearching, setIsYtSearching] = useState(false);
  const [isYtIdeaLoading, setIsYtIdeaLoading] = useState(false);
  const [ytSearchError, setYtSearchError] = useState('');
  const [ytSearchResults, setYtSearchResults] = useState<YoutubeDiscoveryVideo[]>([]);
  const [ytSearchSelectedIds, setYtSearchSelectedIds] = useState<Set<string>>(new Set());
  const [ytLastSearch, setYtLastSearch] = useState('');

  const activeYtKeywordCategory = useMemo(
    () => YOUTUBE_KEYWORD_CATEGORIES.find(cat => cat.id === ytKeywordCategoryId) || YOUTUBE_KEYWORD_CATEGORIES[0],
    [ytKeywordCategoryId],
  );

  const setKeywordCategory = (categoryId: string) => {
    const category = YOUTUBE_KEYWORD_CATEGORIES.find(cat => cat.id === categoryId) || YOUTUBE_KEYWORD_CATEGORIES[0];
    setYtKeywordCategoryId(category.id);
    setYtKeywordIdeas(category.seeds);
    setYtKeyword(category.seeds[0] || '');
  };

  const toggleYtSearchResult = (id: string) => setYtSearchSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectAllYtSearchResults = () => setYtSearchSelectedIds(new Set(ytSearchResults.map(v => v.id)));
  const clearYtSearchSelection = () => setYtSearchSelectedIds(new Set());

  const addDiscoveredVideosToQueue = (videos: YoutubeDiscoveryVideo[]) => {
    const urls = videos.map(v => v.url).filter(Boolean);
    if (urls.length === 0) return;
    const addedCount = onAddUrlsToQueue(urls);
    setYtSearchSelectedIds(new Set());
    onLog(`🎬 เพิ่มลิงก์ YouTube จากผลค้นหาเข้าคิว ${addedCount}/${urls.length} คลิป`);
    if (addedCount === 0) {
      alert('ลิงก์ชุดนี้อยู่ในคิวแล้วทั้งหมด');
    }
  };

  const addSelectedYtSearchToQueue = () => {
    const selected = ytSearchResults.filter(v => ytSearchSelectedIds.has(v.id));
    addDiscoveredVideosToQueue(selected);
  };

  const searchYoutubeByKeyword = async (keywordOverride?: string) => {
    const q = String(keywordOverride ?? ytKeyword).trim();
    if (!q) {
      alert('กรุณาใส่ Keyword ก่อนค้นหา');
      return;
    }

    setYtKeyword(q);
    setIsYtSearching(true);
    setYtSearchError('');
    setYtSearchResults([]);
    setYtSearchSelectedIds(new Set());
    setYtLastSearch(q);
    onLog(`🔎 ค้น YouTube ด้วย keyword: ${q}`);

    try {
      const res = await fetch('/api/youtube-keyword-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: q, limit: ytSearchLimit, days: ytSearchDays }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'ค้นหา YouTube ไม่สำเร็จ');
      const videos: YoutubeDiscoveryVideo[] = Array.isArray(data.videos) ? data.videos : [];
      setYtSearchResults(videos);
      setYtSearchSelectedIds(new Set(videos.slice(0, Math.min(10, videos.length)).map(v => v.id)));
      onLog(`✅ พบคลิป ${videos.length} รายการจาก keyword "${q}"`);
    } catch (e: any) {
      const msg = e?.message || 'เกิดข้อผิดพลาด';
      setYtSearchError(msg);
      onLog(`❌ ค้นหา YouTube ไม่สำเร็จ: ${msg}`);
    } finally {
      setIsYtSearching(false);
    }
  };

  const handleGenerateYtKeywordIdeas = async () => {
    const apiKey = await getActiveOpenRouterKeyAsync();
    if (!apiKey) {
      alert('❌ ยังไม่ได้ใส่ OpenRouter API Key ในตั้งค่า');
      return;
    }

    setIsYtIdeaLoading(true);
    setYtSearchError('');
    onLog(`🧠 ให้ AI แตก keyword สำหรับหมวด ${activeYtKeywordCategory.label}`);

    const systemPrompt = `คุณคือ strategist สำหรับเพจ AI/Tech ภาษาไทย
ต้องช่วยหา YouTube search keywords ที่มีโอกาสเจอคลิป "เรื่องเล่าความสำเร็จ/เคสจริง/คนเอามาอวดผลลัพธ์" เพื่อเอาไปทำคอนเทนต์แชร์ง่าย
ตอบ JSON เท่านั้น: { "keywords": ["keyword 1", "keyword 2"] }
ข้อกำหนด:
- ให้ 12 keywords
- ใช้ภาษาอังกฤษเป็นหลัก เพราะ YouTube มีเคสเยอะกว่า
- ผสม keyword ภาษาไทยได้ไม่เกิน 3 รายการ
- เน้นคำอย่าง success story, case study, built, made, workflow, non coder, solo founder, with Claude Code หรือ AI coding agents ตามบริบท
- หลีกเลี่ยง keyword กว้างเกินไป เช่น "AI" คำเดียว`;

    const userPrompt = [
      `หมวด: ${activeYtKeywordCategory.label}`,
      `คำอธิบายหมวด: ${activeYtKeywordCategory.description}`,
      `keyword ตั้งต้น: ${ytKeyword}`,
      `seed ที่มี: ${activeYtKeywordCategory.seeds.join(', ')}`,
      `บริบทเพจ: ทำเพจ AI ต้องการเรื่องราวน่าแชร์เหมือนหัวข้อ viral CSV เช่น Claude Code, คนธรรมดาใช้ AI แล้วสำเร็จ, มีผลลัพธ์ชัด`,
    ].join('\n');

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Bulk Video Creator',
        },
        body: JSON.stringify({
          model: FREE_KEYWORD_MODEL,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `OpenRouter HTTP ${res.status}`);
      const parsed = parseLooseJson(data?.choices?.[0]?.message?.content || '');
      const rawKeywords = Array.isArray(parsed?.keywords) ? parsed.keywords : Array.isArray(parsed) ? parsed : [];
      const keywords = rawKeywords
        .map((item: any) => String(item || '').trim())
        .filter(Boolean)
        .filter((item: string, index: number, arr: string[]) => arr.findIndex(v => v.toLowerCase() === item.toLowerCase()) === index)
        .slice(0, 16);
      if (keywords.length === 0) throw new Error('AI ไม่ได้ส่ง keyword กลับมา');
      setYtKeywordIdeas(keywords);
      setYtKeyword(keywords[0]);
      onLog(`✅ AI แนะนำ keyword ${keywords.length} คำ`);
    } catch (e: any) {
      const msg = e?.message || 'สร้าง keyword ไม่สำเร็จ';
      setYtSearchError(msg);
      onLog(`❌ สร้าง keyword ไม่สำเร็จ: ${msg}`);
    } finally {
      setIsYtIdeaLoading(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">🔎</span> หา YouTube เรื่องน่าแชร์จาก Keyword
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            ค้นคลิปจริงจาก YouTube แล้วเลือกส่งเข้าคิวดึง Script + รูปภาพได้เลย เหมาะกับเคส AI success story / Claude Code / คนใช้ AI แล้วมีผลลัพธ์ชัด
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2">
          <label className="text-xs text-gray-400 whitespace-nowrap">ช่วงวัน</label>
          <NumInput
            min={1} max={365}
            value={ytSearchDays}
            onChange={setYtSearchDays}
            className="w-16 bg-transparent text-sm font-bold text-white text-center outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        <div className="space-y-2">
          <div className="text-xs font-bold text-gray-300">หมวดหา Keyword</div>
          {YOUTUBE_KEYWORD_CATEGORIES.map(category => {
            const active = category.id === ytKeywordCategoryId;
            return (
              <button
                key={category.id}
                onClick={() => setKeywordCategory(category.id)}
                className={`w-full text-left rounded-lg border px-3 py-2 transition-all ${
                  active
                    ? 'border-red-500/50 bg-red-500/15 text-white'
                    : 'border-gray-700/50 bg-gray-800/35 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="text-xs font-bold">{category.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{category.description}</div>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={ytKeyword}
              onChange={e => setYtKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchYoutubeByKeyword()}
              placeholder="เช่น claude code success story"
              className="input-field flex-1 min-w-[220px] text-sm"
            />
            <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700 rounded-lg px-3">
              <label className="text-xs text-gray-400 whitespace-nowrap">ผลลัพธ์</label>
              <NumInput
                min={5} max={100}
                value={ytSearchLimit}
                onChange={setYtSearchLimit}
                className="w-14 bg-transparent text-sm font-bold text-white text-center outline-none"
              />
            </div>
            <button
              onClick={() => searchYoutubeByKeyword()}
              disabled={isYtSearching || !ytKeyword.trim()}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-all whitespace-nowrap"
            >
              {isYtSearching ? 'กำลังค้น...' : 'ค้นคลิป'}
            </button>
            <button
              onClick={handleGenerateYtKeywordIdeas}
              disabled={isYtIdeaLoading}
              className="px-4 py-2.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-all whitespace-nowrap"
            >
              {isYtIdeaLoading ? 'AI กำลังคิด...' : 'ให้ AI หา Keyword'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {ytKeywordIdeas.map((idea, idx) => (
              <button
                key={`${idea}_${idx}`}
                onClick={() => {
                  setYtKeyword(idea);
                  setYtSearchError('');
                }}
                disabled={isYtSearching}
                className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-all ${
                  idea === ytKeyword
                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40'
                    : 'bg-gray-800/50 text-gray-300 border-gray-700 hover:border-cyan-500/50 hover:text-cyan-200'
                }`}
                title="เลือก keyword นี้ แล้วกดค้นคลิป"
              >
                {idea}
              </button>
            ))}
          </div>

          {ytSearchError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs">
              ❌ {ytSearchError}
            </div>
          )}

          {isYtSearching && (
            <div className="p-4 bg-black/30 rounded-lg border border-gray-700 text-sm text-gray-400 animate-pulse">
              กำลังค้น YouTube จริงจาก keyword นี้ อาจใช้เวลาสักครู่...
            </div>
          )}

          {ytSearchResults.length > 0 && (
            <div className="rounded-xl border border-gray-700/60 bg-black/20 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-gray-700/50">
                <div>
                  <div className="text-sm font-bold text-gray-200">ผลค้นหา: {ytLastSearch}</div>
                  <div className="text-[10px] text-gray-500">เลือกไว้ {ytSearchSelectedIds.size}/{ytSearchResults.length} คลิป เรียงตามยอดวิว</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={selectAllYtSearchResults} className="text-[10px] px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all">เลือกทั้งหมด</button>
                  <button onClick={clearYtSearchSelection} className="text-[10px] px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all">ยกเลิก</button>
                  <button
                    onClick={addSelectedYtSearchToQueue}
                    disabled={ytSearchSelectedIds.size === 0}
                    className="text-[10px] px-3 py-1 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white font-bold rounded-lg transition-all"
                  >
                    เพิ่ม {ytSearchSelectedIds.size} คลิปเข้าคิว
                  </button>
                </div>
              </div>

              <div className="max-h-[520px] overflow-y-auto custom-scrollbar divide-y divide-gray-800">
                {ytSearchResults.map((video, idx) => {
                  const selected = ytSearchSelectedIds.has(video.id);
                  return (
                    <div key={video.id || video.url} className={`p-3 transition-all ${selected ? 'bg-cyan-500/8' : 'hover:bg-white/[0.03]'}`}>
                      <div className="flex gap-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleYtSearchResult(video.id)}
                          className="w-4 h-4 accent-cyan-500 mt-1 cursor-pointer flex-shrink-0"
                        />
                        <a href={video.url} target="_blank" rel="noreferrer" className="relative w-28 sm:w-36 aspect-video flex-shrink-0 rounded-lg overflow-hidden border border-gray-700 bg-gray-900">
                          {video.thumbnail ? (
                            <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">No thumbnail</div>
                          )}
                          {formatYtDuration(video.duration) && (
                            <span className="absolute right-1 bottom-1 bg-black/75 text-white text-[9px] px-1 py-0.5 rounded">
                              {formatYtDuration(video.duration)}
                            </span>
                          )}
                        </a>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-gray-500 w-5 flex-shrink-0">{idx + 1}.</span>
                            <a href={video.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-gray-100 hover:text-cyan-300 line-clamp-2 leading-snug">
                              {video.title}
                            </a>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-gray-400">
                            <span>วิว {formatYtViews(video.views)}</span>
                            {video.uploadedAt && <span>ลงเมื่อ {formatYtDate(video.uploadedAt)}</span>}
                            {video.channelName && <span className="text-gray-300">ช่อง {video.channelName}</span>}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <button
                              onClick={() => addDiscoveredVideosToQueue([video])}
                              className="text-[10px] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-all"
                            >
                              เพิ่มคลิปนี้เข้าคิว
                            </button>
                            <button
                              onClick={() => onUseSingleUrl(video.url)}
                              className="text-[10px] px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-all"
                            >
                              ใส่ในช่องดึงเดี่ยว
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
