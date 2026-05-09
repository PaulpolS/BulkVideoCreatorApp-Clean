import React, { useState, useEffect } from 'react';
import { NumInput } from '../ui/NumInput';
import { globalTaskStore } from '../../hooks/useBackgroundTasks';

interface YTChannel {
  id: string;
  name: string;
  url: string;
  description: string;
  subscribers: number | null;
  logoUrl: string;
  savedAt: string;
  videos?: YTVideo[];
  lastScannedAt?: string;
}

interface YTVideo {
  id: string;
  title: string;
  url: string;
  views: number | null;
  description: string;
  uploadedAt: string;
  thumbnail: string;
  duration: number | null;
  channelName?: string;
  channelUrl?: string;
  channelLogoUrl?: string;
  subscribers?: number | null;
  viralScore?: number | null;
  evergreenScore?: number | null;
}

interface AIChannelSuggestion {
  name: string;
  url: string;
  description: string;
  whyMatch: string;
}

import { checkOpenRouterCredits, getActiveOpenRouterKeyAsync as getOpenRouterKey } from '../../hooks/useApiSettings';

const FREE_FALLBACK_MODEL = 'google/gemma-3-27b-it:free';

function formatSubs(n: number | null): string {
  if (n == null) return '-';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatViews(n: number | null): string {
  if (n == null) return '-';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export function YoutubeChannelFinder() {
  const [exampleChannels, setExampleChannels] = useState<string[]>(['']);
  const [prompt, setPrompt] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<AIChannelSuggestion[]>([]);
  const [savedChannels, setSavedChannels] = useState<YTChannel[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scanLimit, setScanLimit] = useState(30);
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('radar_selected_model') || 'google/gemini-2.5-flash');
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Record<string, Set<string>>>({});
  const [keyword, setKeyword] = useState('');
  const [isKeywordSearching, setIsKeywordSearching] = useState(false);
  const [keywordResult, setKeywordResult] = useState<YTChannel | null>(null);
  const savedChannelsRef = React.useRef<YTChannel[]>([]);

  useEffect(() => {
    fetch('/api/get-app-data?key=youtube_channels')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSavedChannels(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    savedChannelsRef.current = savedChannels;
  }, [savedChannels]);

  const persistChannels = (channels: YTChannel[]) => {
    savedChannelsRef.current = channels;
    fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'youtube_channels', data: channels }),
    }).catch(console.error);
    setSavedChannels(channels);
  };

  const addExampleField = () => setExampleChannels(prev => [...prev, '']);
  const removeExampleField = (i: number) => setExampleChannels(prev => prev.filter((_, idx) => idx !== i));
  const updateExample = (i: number, val: string) => setExampleChannels(prev => prev.map((v, idx) => idx === i ? val : v));

  const handleAISearch = async () => {
    const examples = exampleChannels.filter(e => e.trim());
    if (!examples.length && !prompt.trim()) {
      alert('กรุณาใส่ตัวอย่างช่องหรือ Prompt อย่างน้อยหนึ่งอย่าง');
      return;
    }
    const apiKey = await getOpenRouterKey();
    if (!apiKey) { alert('❌ ยังไม่ได้ใส่ OpenRouter API Key ในตั้งค่า'); return; }

    setIsSearching(true);
    setSuggestions([]);

    const systemPrompt = `คุณคือผู้เชี่ยวชาญแนะนำ YouTube Channels
ตอบเป็น JSON เท่านั้น รูปแบบ: { "channels": [ { "name": "ชื่อช่อง", "url": "https://www.youtube.com/@handle", "description": "รายละเอียดช่อง", "whyMatch": "เหตุผลที่แนะนำ" } ] }
แนะนำ 5-8 ช่อง ที่มีอยู่จริงบน YouTube เท่านั้น`;

    const userMsg = [
      examples.length ? `ตัวอย่างช่องที่ชอบ: ${examples.join(', ')}` : '',
      prompt.trim() ? `ความต้องการ: ${prompt.trim()}` : '',
    ].filter(Boolean).join('\n');

    const callOpenRouter = async (model: string, messages: object[]) => {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Bulk Video Creator',
        },
        body: JSON.stringify({ model, response_format: { type: 'json_object' }, messages }),
      });
      if (!res.ok) {
        let detail = '';
        try { const err = await res.json(); detail = err?.error?.message || err?.message || ''; } catch {}
        const error: any = new Error(detail || `API Error ${res.status}`);
        error.status = res.status;
        throw error;
      }
      return res.json();
    };

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ];

    try {
      let data: any;
      try {
        data = await callOpenRouter(selectedModel, messages);
      } catch (e: any) {
        if (e.status !== 402) throw e;
        // 402 on paid model → auto-retry with free model
        if (selectedModel === FREE_FALLBACK_MODEL) throw e;
        data = await callOpenRouter(FREE_FALLBACK_MODEL, messages);
        alert(`⚠️ โมเดล "${selectedModel}" ต้องใช้เครดิต แต่บัญชีคุณอาจไม่มีเครดิตหรือ key ไม่ได้เปิดใช้โมเดลนี้\n✅ สลับมาใช้ "${FREE_FALLBACK_MODEL}" แทนสำเร็จแล้ว`);
      }
      const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
      setSuggestions(Array.isArray(parsed.channels) ? parsed.channels : []);
    } catch (e: any) {
      if (e.status === 402) {
        let creditText = '';
        try {
          const info = await checkOpenRouterCredits(apiKey);
          if (info.valid) {
            const usageStr = `ใช้ไปแล้ว $${Number(info.usage).toFixed(4)}`;
            const limitStr = info.limit !== null ? ` / ลิมิต $${Number(info.limit).toFixed(2)}` : ' (ไม่ได้ตั้ง spending limit)';
            const tierStr = info.isFreeTier ? ' · Free Tier' : '';
            creditText = `\n📊 สถานะ Key: ${usageStr}${limitStr}${tierStr}`;
          }
        } catch {}
        alert(
          `❌ ค้นหาล้มเหลว: OpenRouter ปฏิเสธคำขอ (402)${creditText}\n\n` +
          `สาเหตุที่เป็นไปได้:\n` +
          `• เครดิตฟรีหมดแล้ว → ต้องเติมเงินที่ openrouter.ai\n` +
          `• โมเดล "${selectedModel}" ต้องใช้เครดิต → เลือกโมเดล 🆓 ฟรีแทน\n` +
          `• API Key ผิด profile → เช็คในปุ่มตั้งค่าว่าเลือก profile ถูกต้อง`
        );
      } else {
        alert(`❌ ค้นหาล้มเหลว: ${e.message}`);
      }
    }
    setIsSearching(false);
  };

  const handleSaveChannel = (ch: AIChannelSuggestion) => {
    const alreadySaved = savedChannels.some(s => s.url === ch.url || s.name === ch.name);
    if (alreadySaved) { alert('บันทึกไว้แล้ว'); return; }
    const newChannel: YTChannel = {
      id: Date.now().toString(),
      name: ch.name,
      url: ch.url,
      description: ch.description,
      subscribers: null,
      logoUrl: '',
      savedAt: new Date().toISOString(),
    };
    persistChannels([...savedChannels, newChannel]);
  };

  const handleAddManual = () => {
    const url = window.prompt('ใส่ URL ช่อง YouTube:')?.trim() || '';
    if (!url) return;
    const name = url.split('@')[1]?.split('/')[0] || url;
    const newChannel: YTChannel = {
      id: Date.now().toString(),
      name,
      url,
      description: '',
      subscribers: null,
      logoUrl: '',
      savedAt: new Date().toISOString(),
    };
    persistChannels([...savedChannels, newChannel]);
  };

  const handleRemoveChannel = (id: string) => {
    if (!confirm('ลบช่องนี้ออก?')) return;
    persistChannels(savedChannels.filter(c => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleScanVideos = async (channel: YTChannel) => {
    const taskId = `yt_scan_${channel.id}_${Date.now()}`;
    globalTaskStore.enqueueTask({
      id: taskId,
      title: `YouTube Scan: ${channel.name}`,
      category: 'youtube',
      progress: `รอคิวสแกน ${scanLimit} คลิปจาก ${channel.name}`,
    }, async (task) => {
      setScanningId(channel.id);
      task.log(`กำลังสแกน ${scanLimit} คลิปจาก ${channel.url}`);
      try {
        const res = await fetch('/api/youtube-channel-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelUrl: channel.url, limit: scanLimit }),
          signal: task.signal,
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Unknown error');
        if (task.isCancelled()) return;

        const currentChannels = savedChannelsRef.current;
        const updated = currentChannels.map(c => c.id === channel.id ? {
          ...c,
          name: data.channelInfo?.name || c.name,
          description: data.channelInfo?.description || c.description,
          subscribers: data.channelInfo?.subscribers ?? c.subscribers,
          logoUrl: data.channelInfo?.logoUrl || c.logoUrl,
          videos: data.videos || [],
          lastScannedAt: new Date().toISOString(),
        } : c);
        persistChannels(updated);
        setExpandedId(channel.id);
        task.update({ progress: `สแกนสำเร็จ พบ ${data.videos?.length || 0} คลิป`, status: 'completed' });
      } finally {
        setScanningId(null);
      }
    });
  };

  const handleKeywordSearch = async () => {
    const q = keyword.trim();
    if (!q) {
      alert('กรุณาใส่ Keyword ที่ต้องการค้นหา');
      return;
    }

    setIsKeywordSearching(true);
    setKeywordResult(null);
    const taskId = `yt_keyword_${Date.now()}`;
    globalTaskStore.addTask({
      id: taskId,
      title: `ค้นหา YouTube Keyword: ${q}`,
      category: 'youtube',
      progress: 'กำลังค้นหา YouTube จริงจาก keyword ในช่วง 30 วัน',
      status: 'running',
    });

    try {
      const res = await fetch('/api/youtube-keyword-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: q,
          limit: 30,
          days: 30,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Search failed');

      const resultChannel: YTChannel = {
        id: `keyword:${q}`,
        name: `Keyword: ${q}`,
        url: '',
        description: 'คลิปยอดวิวสูงสุดใน 30 วันที่ผ่านมา จากการค้นหา YouTube จริง',
        subscribers: null,
        logoUrl: '',
        savedAt: new Date().toISOString(),
        videos: data.videos || [],
        lastScannedAt: new Date().toISOString(),
      };
      setKeywordResult(resultChannel);
      setSelectedVideoIds(prev => ({ ...prev, [resultChannel.id]: new Set((resultChannel.videos || []).map(v => v.id)) }));
      globalTaskStore.updateTask(taskId, { progress: `พบ ${data.videos?.length || 0} คลิปจาก YouTube Keyword "${q}"`, status: 'completed' });
    } catch (err: any) {
      globalTaskStore.updateTask(taskId, { progress: `Error: ${err?.message || String(err)}`, status: 'error' });
      alert(`❌ ค้นหาไม่สำเร็จ: ${err?.message || String(err)}`);
    } finally {
      setIsKeywordSearching(false);
    }
  };

  const handleScoreVideosAI = async (channel: YTChannel) => {
    const apiKey = await getOpenRouterKey();
    if (!apiKey) { alert('❌ ยังไม่ได้ใส่ OpenRouter API Key'); return; }
    if (!channel.videos?.length) { alert('ยังไม่มีคลิป กรุณาสแกนก่อน'); return; }

    const unscored = channel.videos.filter(v => v.viralScore == null || v.evergreenScore == null);
    if (unscored.length === 0) { alert('✅ ทุกคลิปมีคะแนนแล้ว'); return; }
    if (!confirm(`AI จะให้คะแนน ${unscored.length} คลิปที่ยังไม่มีคะแนน ดำเนินการ?`)) return;

    // Set scoring state immediately for visual feedback
    setScoringId(channel.id);

    const taskId = `yt_score_${channel.id}_${Date.now()}`;
    globalTaskStore.addTask({
      id: taskId,
      title: `AI Score YouTube: ${channel.name}`,
      category: 'youtube',
      progress: `เริ่มให้คะแนน ${unscored.length} คลิป...`,
      status: 'running',
    });

    // Run immediately (not queued) so it doesn't wait behind other tasks
    (async () => {
      const BATCH = 10;
      let videos = [...(savedChannelsRef.current.find(c => c.id === channel.id)?.videos || channel.videos || [])];

      const systemPrompt = `คุณคือผู้เชี่ยวชาญวิเคราะห์ YouTube
ให้คะแนนแต่ละคลิป 2 มิติ:
1. "viral_score" (0-10): ดึงดูด แชร์ง่าย เร้าใจ เป็นกระแสแค่ไหน
2. "evergreen_score" (0-10): มีคุณค่าระยะยาว ดูได้ตลอดเวลาแค่ไหน
ตอบ JSON: { "results": [ { "id": 1, "viral_score": 8, "evergreen_score": 5 } ] }`;

      try {
        const totalBatches = Math.ceil(unscored.length / BATCH);
        let scoringModel = selectedModel;
        for (let i = 0; i < unscored.length; i += BATCH) {
          const batch = unscored.slice(i, i + BATCH);
          const batchNo = Math.floor(i / BATCH) + 1;
          globalTaskStore.updateTask(taskId, { progress: `กำลังให้คะแนน batch ${batchNo}/${totalBatches} (${i + batch.length}/${unscored.length} คลิป)` });
          const input = batch.map((v, idx) => ({ id: idx + 1, title: v.title, views: v.views }));
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': window.location.origin, 'X-Title': 'Bulk Video Creator' },
            body: JSON.stringify({ model: scoringModel, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: JSON.stringify(input) }] }),
          });
          if (!res.ok) {
            if (res.status === 402 && scoringModel !== FREE_FALLBACK_MODEL) {
              scoringModel = FREE_FALLBACK_MODEL;
              globalTaskStore.updateTask(taskId, { progress: `Batch ${batchNo}: โมเดลต้องใช้เครดิต → สลับไปโมเดลฟรี (${FREE_FALLBACK_MODEL}) แล้วลองใหม่` });
              i -= BATCH; // retry this batch with free model
              continue;
            }
            globalTaskStore.updateTask(taskId, { progress: `Batch ${batchNo} error: HTTP ${res.status}` });
            continue;
          }
          const data = await res.json();
          if (data.error) {
            globalTaskStore.updateTask(taskId, { progress: `Batch ${batchNo} error: ${data.error?.message || JSON.stringify(data.error)}` });
            continue;
          }
          const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
          if (Array.isArray(parsed.results)) {
            parsed.results.forEach((r: any) => {
              const vid = batch[r.id - 1]; // id is 1-indexed within each batch
              if (vid) {
                videos = videos.map(v => v.id === vid.id ? { ...v, viralScore: r.viral_score, evergreenScore: r.evergreen_score } : v);
              }
            });
          }

          // Save progressively after each batch so partial results aren't lost
          const updated = savedChannelsRef.current.map(c => c.id === channel.id ? { ...c, videos } : c);
          persistChannels(updated);
          globalTaskStore.updateTask(taskId, { progress: `Batch ${batchNo}/${totalBatches} เสร็จแล้ว ✅` });
        }

        globalTaskStore.updateTask(taskId, { progress: `ให้คะแนนสำเร็จ ${unscored.length} คลิป ✅`, status: 'completed' });
      } catch (err: any) {
        globalTaskStore.updateTask(taskId, { progress: `Error: ${err?.message || String(err)}`, status: 'error' });
      } finally {
        setScoringId(null);
      }
    })();
  };

  const toggleVideoSelect = (channelId: string, videoId: string) => {
    setSelectedVideoIds(prev => {
      const current = new Set(prev[channelId] || []);
      current.has(videoId) ? current.delete(videoId) : current.add(videoId);
      return { ...prev, [channelId]: current };
    });
  };

  const selectAllVideos = (channel: YTChannel) => {
    setSelectedVideoIds(prev => ({ ...prev, [channel.id]: new Set((channel.videos || []).map(v => v.id)) }));
  };

  const clearVideoSelection = (channelId: string) => {
    setSelectedVideoIds(prev => ({ ...prev, [channelId]: new Set() }));
  };

  const normalizeUploadedAt = (uploadedAt: string) => {
    if (/^\d{8}$/.test(uploadedAt)) {
      return `${uploadedAt.slice(0, 4)}-${uploadedAt.slice(4, 6)}-${uploadedAt.slice(6, 8)}T00:00:00.000Z`;
    }
    if (uploadedAt && !Number.isNaN(new Date(uploadedAt).getTime())) {
      return new Date(uploadedAt).toISOString();
    }
    return new Date().toISOString();
  };

  const handleSaveSelectedVideosToStock = async (channel: YTChannel) => {
    const selected = selectedVideoIds[channel.id] || new Set<string>();
    const videos = (channel.videos || []).filter(v => selected.has(v.id));
    if (videos.length === 0) return;

    const taskId = `yt_stock_${channel.id}_${Date.now()}`;
    globalTaskStore.enqueueTask({
      id: taskId,
      title: `บันทึก YouTube เข้าคลัง: ${channel.name}`,
      category: 'article-stock',
      progress: `รอคิวบันทึก ${videos.length} คลิป`,
    }, async (task) => {
      task.log(`เตรียมส่ง ${videos.length} คลิปเข้าคลังบทความ`);
      const items = videos.map(v => ({
        title: v.title,
        rawArticle: [v.title, v.description].filter(Boolean).join('\n\n'),
        sourceUrl: v.url,
        newsScore: v.viralScore ?? 0,
        evergreenScore: v.evergreenScore ?? 0,
        tags: ['youtube', channel.name].filter(Boolean),
        domain: 'youtube.com',
        createdAt: normalizeUploadedAt(v.uploadedAt),
        sourceType: 'youtube',
        channelName: v.channelName || channel.name,
        channelLogoUrl: v.channelLogoUrl || channel.logoUrl || '',
        subscriberCount: v.subscribers ?? channel.subscribers ?? 0,
        thumbnail: v.thumbnail,
        images: v.thumbnail ? [v.thumbnail] : [],
        fbViews: v.views ?? 0,
        ytExtracted: true,
      }));

      const res = await fetch('/api/article-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-batch', items }),
        signal: task.signal,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      clearVideoSelection(channel.id);
      task.update({ progress: `บันทึกสำเร็จ เพิ่ม ${data.added ?? 0} คลิป (ซ้ำ ${data.duplicates ?? 0})`, status: 'completed' });
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--accent)' }}>▶️ ค้นหาช่อง YouTube ที่น่าติดตาม</h3>

        {/* Example Channels */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary, #aaa)' }}>ช่องตัวอย่างที่ชอบ (ใส่ได้หลายช่อง)</label>
            <button onClick={addExampleField} className="text-xs px-2 py-1 rounded font-bold" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
              + เพิ่มช่อง
            </button>
          </div>
          <div className="space-y-2">
            {exampleChannels.map((ex, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={ex}
                  onChange={e => updateExample(i, e.target.value)}
                  placeholder={`เช่น "@mkbhd" หรือ "Fireship" หรือ URL ช่อง`}
                  className="flex-1 px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
                />
                {exampleChannels.length > 1 && (
                  <button onClick={() => removeExampleField(i)} className="px-2 py-1 text-red-500 hover:bg-red-500/10 rounded text-sm">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Prompt */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary, #aaa)' }}>บอกว่าอยากได้ช่องแบบไหน (Prompt)</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={3}
            placeholder="เช่น: ช่อง Tech ที่อธิบายเรื่อง AI ได้เข้าใจง่าย มีคนดูเยอะ เนื้อหา Evergreen ไม่เกาะกระแสสั้น..."
            className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
          />
        </div>

        {/* Model + Search */}
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={selectedModel}
            onChange={e => { setSelectedModel(e.target.value); localStorage.setItem('radar_selected_model', e.target.value); }}
            className="px-3 py-2 rounded-lg border bg-transparent text-sm outline-none cursor-pointer"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
          >
            <option value="google/gemini-2.5-flash">Gemini 2.5 Flash (แนะนำ)</option>
            <option value="google/gemini-3-flash-preview">Gemini 3 Flash Preview</option>
            <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
            <option value="openai/gpt-4o">GPT-4o</option>
            <option value="openai/gpt-oss-20b:free">🆓 GPT OSS 20B (ฟรี!)</option>
            <option value="google/gemma-3-27b-it:free">🆓 Gemma 3 27B (ฟรี!)</option>
          </select>
          <button
            onClick={handleAISearch}
            disabled={isSearching}
            className={`px-5 py-2 rounded-lg font-bold text-white text-sm flex items-center gap-2 ${isSearching ? 'opacity-60 cursor-not-allowed bg-indigo-500' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {isSearching ? '⏳ กำลังค้นหา...' : '🔍 ให้ AI หาช่องมาให้'}
          </button>
          <button
            onClick={handleAddManual}
            className="px-4 py-2 rounded-lg font-semibold text-sm border"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted, #888)' }}
          >
            + เพิ่มช่องด้วยตัวเอง
          </button>
        </div>
      </div>

      <div className="p-5 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--text-main)' }}>
              🔥 ค้นหาคลิปจาก Keyword บน YouTube จริง
            </h4>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleKeywordSearch()}
              placeholder="เช่น AI agent, Sora, การเงิน, รีวิวเครื่องมือ..."
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
            />
          </div>
          <button
            onClick={handleKeywordSearch}
            disabled={isKeywordSearching || !keyword.trim()}
            className={`mt-6 rounded-lg px-4 py-2 text-sm font-bold text-white ${isKeywordSearching ? 'cursor-not-allowed bg-gray-500 opacity-70' : 'bg-red-600 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40'}`}
          >
            {isKeywordSearching ? '⏳ กำลังค้นหา...' : '🔥 หา Top 30 ใน 1 เดือน'}
          </button>
        </div>
        <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted, #888)' }}>
          จะค้นหา YouTube จาก keyword โดยตรง กรองคลิปใน 30 วันที่ผ่านมา แล้วเรียงตามยอดวิวสูงสุด
        </p>
      </div>

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div className="p-5 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <h4 className="font-bold mb-3 text-sm" style={{ color: 'var(--text-secondary, #aaa)' }}>💡 ผลลัพธ์จาก AI ({suggestions.length} ช่อง) — กดบันทึกช่องที่สนใจ</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestions.map((ch, i) => {
              const alreadySaved = savedChannels.some(s => s.name === ch.name || s.url === ch.url);
              return (
                <div key={i} className="p-4 rounded-xl border flex flex-col gap-2" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>▶️ {ch.name}</div>
                      <a href={ch.url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline break-all">{ch.url}</a>
                    </div>
                    <button
                      onClick={() => handleSaveChannel(ch)}
                      disabled={alreadySaved}
                      className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${alreadySaved ? 'opacity-50 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                    >
                      {alreadySaved ? '✅ บันทึกแล้ว' : '💾 บันทึก'}
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted, #888)' }}>{ch.description}</p>
                  {ch.whyMatch && (
                    <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
                      💡 {ch.whyMatch}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Saved Channels */}
      {savedChannels.length > 0 && (
        <div className="p-5 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h4 className="font-bold" style={{ color: 'var(--text-main)' }}>📌 ช่อง YouTube ที่บันทึกไว้ ({savedChannels.length})</h4>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--text-muted, #888)' }}>จำนวนคลิป:</label>
              <NumInput min={5} max={200} value={scanLimit} onChange={setScanLimit} className="w-16 px-2 py-1 rounded border text-xs text-center bg-transparent outline-none" />
            </div>
          </div>

          {keywordResult?.videos && keywordResult.videos.length > 0 && (
            <div className="mb-4 overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                <span className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>
                  🔥 Top 30 Keyword: {keywordResult.name.replace('Keyword: ', '')}
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                  เลือกแล้ว {selectedVideoIds[keywordResult.id]?.size || 0}/{keywordResult.videos.length}
                </span>
                <button onClick={() => selectAllVideos(keywordResult)} className="rounded border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted, #888)' }}>
                  เลือกทั้งหมด
                </button>
                <button onClick={() => clearVideoSelection(keywordResult.id)} className="rounded border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted, #888)' }}>
                  ยกเลิก
                </button>
                <button
                  onClick={() => handleSaveSelectedVideosToStock(keywordResult)}
                  disabled={(selectedVideoIds[keywordResult.id]?.size || 0) === 0}
                  className="ml-auto rounded px-3 py-1.5 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ backgroundColor: '#0891b2' }}
                >
                  📦 ส่งเข้าคลังบทความ
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <th className="px-3 py-2 text-center font-semibold" style={{ color: 'var(--text-muted, #888)' }}>เลือก</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted, #888)' }}>#</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted, #888)' }}>ชื่อคลิป</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted, #888)' }}>ช่อง</th>
                      <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-muted, #888)' }}>ยอดวิว</th>
                      <th className="px-3 py-2 text-center font-semibold" style={{ color: 'var(--text-muted, #888)' }}>วันที่ลง</th>
                      <th className="px-3 py-2 text-center font-semibold" style={{ color: 'var(--text-muted, #888)' }}>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywordResult.videos.map((v, idx) => (
                      <tr key={v.id} className="border-b last:border-0 transition-colors hover:bg-white/5" style={{ borderColor: 'var(--border-color)' }}>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!selectedVideoIds[keywordResult.id]?.has(v.id)}
                            onChange={() => toggleVideoSelect(keywordResult.id, v.id)}
                            className="h-4 w-4 cursor-pointer accent-cyan-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-center" style={{ color: 'var(--text-muted, #888)' }}>{idx + 1}</td>
                        <td className="px-3 py-2">
                          <div className="max-w-xs truncate font-medium" style={{ color: 'var(--text-main)' }} title={v.title}>{v.title}</div>
                          {v.description && <div className="mt-0.5 max-w-xs truncate text-[10px]" style={{ color: 'var(--text-muted, #888)' }}>{v.description}</div>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="max-w-[160px] truncate" style={{ color: 'var(--text-secondary, #aaa)' }}>{v.channelName || '-'}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold" style={{ color: '#f97316' }}>{formatViews(v.views)}</td>
                        <td className="px-3 py-2 text-center" style={{ color: 'var(--text-muted, #888)' }}>
                          {v.uploadedAt ? new Date(normalizeUploadedAt(v.uploadedAt)).toLocaleDateString('th-TH') : '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <a href={v.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">🔗</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {savedChannels.map(channel => (
              <div key={channel.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                {/* Channel Row */}
                <div className="flex items-center gap-4 p-4" style={{ backgroundColor: 'var(--bg-main)' }}>
                  {/* Logo */}
                  <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden border flex items-center justify-center text-xl" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                    {channel.logoUrl ? (
                      <img src={channel.logoUrl} alt={channel.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : '▶️'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate" style={{ color: 'var(--text-main)' }}>{channel.name}</div>
                    <a href={channel.url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">{channel.url}</a>
                    {channel.subscribers != null && (
                      <span className="ml-2 text-xs font-semibold" style={{ color: '#22c55e' }}>👥 {formatSubs(channel.subscribers)}</span>
                    )}
                    {channel.description && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted, #888)' }}>{channel.description}</p>
                    )}
                    {channel.lastScannedAt && (
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted, #888)' }}>
                        สแกนล่าสุด: {new Date(channel.lastScannedAt).toLocaleDateString('th-TH')} · {channel.videos?.length || 0} คลิป
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleScanVideos(channel)}
                      disabled={scanningId === channel.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1 ${scanningId === channel.id ? 'bg-gray-500 cursor-not-allowed animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      {scanningId === channel.id ? '⏳ กำลังสแกน...' : '🔍 สแกนคลิป'}
                    </button>
                    {channel.videos && channel.videos.length > 0 && (
                      <>
                        <button
                          onClick={() => handleSaveSelectedVideosToStock(channel)}
                          disabled={(selectedVideoIds[channel.id]?.size || 0) === 0}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ backgroundColor: '#0891b2' }}
                          title="บันทึกคลิปที่เลือกเข้าคลังบทความ โซน YouTube"
                        >
                          📦 เก็บคลิป ({selectedVideoIds[channel.id]?.size || 0})
                        </button>
                        <button
                          onClick={() => handleScoreVideosAI(channel)}
                          disabled={scoringId === channel.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${scoringId === channel.id ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-80'}`}
                          style={{ backgroundColor: 'rgba(168,85,247,0.15)', color: '#a855f7' }}
                        >
                          {scoringId === channel.id ? '⏳ AI กำลังให้คะแนน...' : '🤖 AI ให้คะแนน'}
                        </button>
                        <button
                          onClick={() => setExpandedId(expandedId === channel.id ? null : channel.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted, #888)' }}
                        >
                          {expandedId === channel.id ? '▲ ซ่อน' : `▼ ดูคลิป (${channel.videos.length})`}
                        </button>
                      </>
                    )}
                    <button onClick={() => handleRemoveChannel(channel.id)} className="text-red-500 text-xs px-2 py-1 hover:bg-red-500/10 rounded">✕</button>
                  </div>
                </div>

                {/* Video List (expanded) */}
                {expandedId === channel.id && channel.videos && channel.videos.length > 0 && (
                  <div className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                      <span className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>เลือกคลิปเก็บเข้าคลังบทความ</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(8,145,178,0.15)', color: '#22d3ee' }}>
                        เลือกแล้ว {selectedVideoIds[channel.id]?.size || 0}/{channel.videos.length}
                      </span>
                      <button onClick={() => selectAllVideos(channel)} className="text-[10px] px-2 py-1 rounded border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted, #888)' }}>
                        เลือกทั้งหมด
                      </button>
                      <button onClick={() => clearVideoSelection(channel.id)} className="text-[10px] px-2 py-1 rounded border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted, #888)' }}>
                        ยกเลิก
                      </button>
                      <button
                        onClick={() => handleSaveSelectedVideosToStock(channel)}
                        disabled={(selectedVideoIds[channel.id]?.size || 0) === 0}
                        className="ml-auto text-[10px] px-3 py-1.5 rounded font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#0891b2' }}
                      >
                        📦 ส่งเข้าคลังบทความ
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-card)' }}>
                          <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                            <th className="py-2 px-3 text-center font-semibold" style={{ color: 'var(--text-muted, #888)' }}>เลือก</th>
                            <th className="py-2 px-3 text-left font-semibold" style={{ color: 'var(--text-muted, #888)' }}>#</th>
                            <th className="py-2 px-3 text-left font-semibold" style={{ color: 'var(--text-muted, #888)' }}>ชื่อคลิป</th>
                            <th className="py-2 px-3 text-right font-semibold" style={{ color: 'var(--text-muted, #888)' }}>ยอดวิว</th>
                            <th className="py-2 px-3 text-center font-semibold" style={{ color: 'var(--text-muted, #888)' }}>🔥ไวรัล</th>
                            <th className="py-2 px-3 text-center font-semibold" style={{ color: 'var(--text-muted, #888)' }}>🌲Evergreen</th>
                            <th className="py-2 px-3 text-center font-semibold" style={{ color: 'var(--text-muted, #888)' }}>Link</th>
                          </tr>
                        </thead>
                        <tbody>
                          {channel.videos.map((v, idx) => (
                            <tr key={v.id} className="border-b last:border-0 hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={!!selectedVideoIds[channel.id]?.has(v.id)}
                                  onChange={() => toggleVideoSelect(channel.id, v.id)}
                                  className="w-4 h-4 accent-cyan-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-3 text-center" style={{ color: 'var(--text-muted, #888)' }}>{idx + 1}</td>
                              <td className="py-2 px-3">
                                <div className="font-medium truncate max-w-xs" style={{ color: 'var(--text-main)' }} title={v.title}>{v.title}</div>
                                {v.description && <div className="text-[10px] truncate max-w-xs mt-0.5" style={{ color: 'var(--text-muted, #888)' }}>{v.description}</div>}
                              </td>
                              <td className="py-2 px-3 text-right font-semibold" style={{ color: '#f97316' }}>
                                {formatViews(v.views)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {v.viralScore != null ? (
                                  <span className={`px-2 py-0.5 rounded font-bold ${v.viralScore >= 7 ? 'bg-red-500/20 text-red-400' : v.viralScore >= 4 ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                    {v.viralScore}
                                  </span>
                                ) : <span style={{ color: 'var(--text-muted, #888)' }}>-</span>}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {v.evergreenScore != null ? (
                                  <span className={`px-2 py-0.5 rounded font-bold ${v.evergreenScore >= 7 ? 'bg-green-500/20 text-green-400' : v.evergreenScore >= 4 ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                    {v.evergreenScore}
                                  </span>
                                ) : <span style={{ color: 'var(--text-muted, #888)' }}>-</span>}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <a href={v.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">🔗</a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
