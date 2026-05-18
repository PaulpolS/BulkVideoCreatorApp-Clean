import React, { useState, useEffect, useMemo } from 'react';
import { NumInput } from '../ui/NumInput';

interface StockArticle {
  id: string;
  title: string;
  rawArticle: string;
  sourceUrl: string;
  newsScore: number;
  evergreenScore: number;
  tags: string[];
  domain: string;
  createdAt: string;
  sentToAIPageAt?: string;
  contentReadyAt?: string;
  fbLikes?: number;
  fbComments?: number;
  fbShares?: number;
  fbViews?: number;
  images?: string[];
  sourceType?: 'youtube' | 'rss' | 'facebook' | string;
  channelName?: string;
  channelLogoUrl?: string;
  channelAvatar?: string;
  subscriberCount?: number;
  thumbnail?: string;
  ytExtracted?: boolean;
}

type SourceSummary = {
  key: string;
  icon: string;
  label: string;
  className: string;
};

type StatusSummary = {
  key: string;
  icon: string;
  label: string;
  desc: string;
  className: string;
};

interface ArticleStockTabProps {
  onSendToAIPage?: (items: {
    rawArticle: string;
    sourceUrl: string;
    title: string;
    tags?: string[];
    images?: string[];
    sourceType?: string;
    channelName?: string;
    channelLogoUrl?: string;
    channelAvatar?: string;
    subscriberCount?: number;
    ytExtracted?: boolean;
  }[]) => void;
  onNavigateToYoutubeExtract?: (urls: string[]) => void;
}

export function ArticleStockTab({ onSendToAIPage, onNavigateToYoutubeExtract }: ArticleStockTabProps) {
  const [articles, setArticles] = useState<StockArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'newsScore' | 'evergreenScore' | 'fbShares' | 'fbLikes' | 'fbComments'>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showOldNewsOnly, setShowOldNewsOnly] = useState(false);
  const [hasScannedOldNews, setHasScannedOldNews] = useState(false);
  const [isScanningOldNews, setIsScanningOldNews] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [isDeletingDupes, setIsDeletingDupes] = useState(false);
  const [showYoutubeOnly, setShowYoutubeOnly] = useState(false);
  const [showContentReadyOnly, setShowContentReadyOnly] = useState(false);
  const [articleCache, setArticleCache] = useState<Record<string, any>>({});
  const [expandedCacheId, setExpandedCacheId] = useState<string | null>(null);
  const [completedSourceUrls, setCompletedSourceUrls] = useState<Set<string>>(new Set());
  const [completedResultTotal, setCompletedResultTotal] = useState(0);
  const [showCompletedOnly, setShowCompletedOnly] = useState(false);
  const [randomPickCount, setRandomPickCount] = useState(20);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const articleKey = (raw: string) => raw?.trim().replace(/\s+/g, ' ').slice(0, 250) ?? '';
  const getCachedEntry = (article: StockArticle) => {
    const key = articleKey(article.rawArticle);
    const entry = articleCache[key];
    return entry?.generatedArticle ? entry : null;
  };

  const getArticleSource = (article: StockArticle): SourceSummary => {
    const type = String(article.sourceType || '').toLowerCase();
    const tags = (article.tags || []).map(tag => String(tag).toLowerCase());
    const domain = String(article.domain || article.sourceUrl || '').toLowerCase();

    if (type === 'youtube' || tags.includes('youtube') || domain.includes('youtube.com') || domain.includes('youtu.be')) {
      return { key: 'youtube', icon: '▶️', label: 'YouTube', className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
    }
    if (type === 'github' || tags.includes('github') || domain.includes('github.com')) {
      return { key: 'github', icon: '🐙', label: 'GitHub', className: 'bg-violet-500/20 text-violet-300 border-violet-500/30' };
    }
    if (type === 'facebook' || tags.includes('facebook') || domain.includes('facebook.com')) {
      return { key: 'facebook', icon: '📘', label: 'Facebook', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
    }
    if (type === 'lazada' || tags.includes('lazada') || domain.includes('lazada')) {
      return { key: 'lazada', icon: '🛒', label: 'Lazada', className: 'bg-orange-500/20 text-orange-300 border-orange-500/30' };
    }
    if (type === 'topgainers' || type === 'stock' || tags.includes('topgainers') || tags.includes('หุ้น')) {
      return { key: 'market', icon: '📈', label: 'หุ้น/Market', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    }
    if (type === 'rss' || type === 'news' || tags.includes('rss')) {
      return { key: 'rss', icon: '🗞️', label: 'RSS/News', className: 'bg-red-500/20 text-red-300 border-red-500/30' };
    }
    return { key: type || 'manual', icon: '📄', label: type ? type : 'Manual', className: 'bg-gray-500/20 text-gray-300 border-gray-500/30' };
  };

  const getArticleStatus = (article: StockArticle): StatusSummary => {
    const cached = getCachedEntry(article);
    const hasGeneratedContent = !!cached || !!article.contentReadyAt;
    const hasExtractedMaterial =
      !!article.ytExtracted ||
      (Array.isArray(article.images) && article.images.length > 0) ||
      String(article.rawArticle || '').trim().length > 500;

    if (completedSourceUrls.has(article.sourceUrl)) {
      return {
        key: 'completed',
        icon: '✅',
        label: 'สร้างเสร็จแล้ว',
        desc: 'มีผลลัพธ์ใน AI Page แล้ว',
        className: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
      };
    }
    if (hasGeneratedContent) {
      return {
        key: 'ready',
        icon: '📝',
        label: 'บทความพร้อม',
        desc: 'มีบทความ/แคปชั่นที่สร้างไว้แล้ว',
        className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      };
    }
    if (article.sentToAIPageAt) {
      return {
        key: 'sent',
        icon: '🚀',
        label: 'ส่งไปสร้างแล้ว',
        desc: 'ถูกส่งเข้า AI Page แล้ว รอผลลัพธ์',
        className: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      };
    }
    if (hasExtractedMaterial) {
      return {
        key: 'enriched',
        icon: '🔎',
        label: 'ดึงข้อมูลแล้ว',
        desc: 'มี script/readme/รูป/เนื้อหายาวพอใช้ต่อ',
        className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      };
    }
    return {
      key: 'found',
      icon: '📥',
      label: 'เก็บไว้แล้ว',
      desc: 'วัตถุดิบเข้าคลังแล้ว ยังไม่เริ่มผลิต',
      className: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    };
  };

  // Load articles on mount
  useEffect(() => {
    loadArticles();
    fetch('/api/article-cache')
      .then(r => r.json())
      .then(data => { if (data && typeof data === 'object') setArticleCache(data); })
      .catch(() => {});
    loadCompletedResultRefs();
  }, []);

  useEffect(() => {
    const refreshCompletion = () => {
      if (document.visibilityState === 'visible') loadCompletedResultRefs();
    };
    window.addEventListener('focus', loadCompletedResultRefs);
    document.addEventListener('visibilitychange', refreshCompletion);
    return () => {
      window.removeEventListener('focus', loadCompletedResultRefs);
      document.removeEventListener('visibilitychange', refreshCompletion);
    };
  }, []);

  const loadCompletedResultRefs = async () => {
    try {
      const res = await fetch('/api/aipage-results');
      const data = await res.json();
      if (data?.results && Array.isArray(data.results)) {
        const urls = new Set<string>(
          data.results
            .map((r: any) => r.sourceUrl || r.sourceMeta?.sourceUrl)
            .filter(Boolean)
        );
        setCompletedSourceUrls(urls);
        setCompletedResultTotal(data.results.length);
      }
    } catch {}
  };

  const loadArticles = async () => {
    setIsLoading(true);
    try {
      loadCompletedResultRefs();
      const res = await fetch('/api/article-stock');
      const data = await res.json();
      const nextArticles = data.success ? (data.articles || []) : [];
      setArticles(nextArticles);
      return nextArticles as StockArticle[];
    } catch (e) {
      console.error('Failed to load article stock:', e);
      return [] as StockArticle[];
    } finally {
      setIsLoading(false);
    }
  };

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    articles.forEach(a => a.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [articles]);

  // Tag counts
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    articles.forEach(a => a.tags?.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return counts;
  }, [articles]);

  const getArticleAgeDays = (createdAt: string) => {
    const createdTime = new Date(createdAt).getTime();
    if (Number.isNaN(createdTime)) return 0;
    return Math.floor((Date.now() - createdTime) / (1000 * 60 * 60 * 24));
  };

  const isOldNews = (article: StockArticle) =>
    (article.newsScore || 0) >= 8 &&
    (article.evergreenScore || 0) <= 7 &&
    getArticleAgeDays(article.createdAt) >= 7;

  const oldNewsArticles = useMemo(() => articles.filter(isOldNews), [articles]);
  const oldNewsSentCount = useMemo(() => oldNewsArticles.filter(a => a.sentToAIPageAt).length, [oldNewsArticles]);
  const youtubeArticles = useMemo(() => articles.filter(a => a.sourceType === 'youtube' || a.tags?.includes('youtube')), [articles]);
  const sourceSummaries = useMemo(() => {
    const map = new Map<string, SourceSummary & { count: number }>();
    articles.forEach(article => {
      const source = getArticleSource(article);
      const current = map.get(source.key);
      map.set(source.key, { ...source, count: (current?.count || 0) + 1 });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [articles]);

  const statusSummaries = useMemo(() => {
    const order = ['found', 'enriched', 'sent', 'ready', 'completed'];
    const map = new Map<string, StatusSummary & { count: number }>();
    articles.forEach(article => {
      const status = getArticleStatus(article);
      const current = map.get(status.key);
      map.set(status.key, { ...status, count: (current?.count || 0) + 1 });
    });
    return Array.from(map.values()).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }, [articles, articleCache, completedSourceUrls]);

  // Find duplicate groups — grouped by normalized sourceUrl first, then by title
  const duplicateGroups = useMemo(() => {
    const normalizeUrl = (url: string) => url.trim().replace(/\/$/, '').toLowerCase();
    const normalizeTitle = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');

    const urlMap = new Map<string, StockArticle[]>();
    const titleMap = new Map<string, StockArticle[]>();
    const usedIds = new Set<string>();

    // Group by URL
    articles.forEach(a => {
      if (!a.sourceUrl) return;
      const key = normalizeUrl(a.sourceUrl);
      if (!urlMap.has(key)) urlMap.set(key, []);
      urlMap.get(key)!.push(a);
    });

    const groups: { key: string; type: 'url' | 'title'; articles: StockArticle[] }[] = [];

    urlMap.forEach((group, key) => {
      if (group.length > 1) {
        const sorted = [...group].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        groups.push({ key, type: 'url', articles: sorted });
        sorted.forEach(a => usedIds.add(a.id));
      }
    });

    // Group remaining by title
    articles.filter(a => !usedIds.has(a.id)).forEach(a => {
      if (!a.title) return;
      const key = normalizeTitle(a.title);
      if (!titleMap.has(key)) titleMap.set(key, []);
      titleMap.get(key)!.push(a);
    });

    titleMap.forEach((group, key) => {
      if (group.length > 1) {
        const sorted = [...group].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        groups.push({ key, type: 'title', articles: sorted });
      }
    });

    return groups;
  }, [articles]);

  const duplicateCount = useMemo(() => duplicateGroups.reduce((sum, g) => sum + g.articles.length - 1, 0), [duplicateGroups]);

  const handleDeleteDuplicates = async (keepIds?: Set<string>) => {
    // Default: keep newest (index 0 in each group, already sorted newest-first)
    const toDeleteIds: string[] = [];
    duplicateGroups.forEach(g => {
      const keepId = keepIds ? [...keepIds].find(id => g.articles.some(a => a.id === id)) : g.articles[0].id;
      g.articles.forEach(a => {
        if (a.id !== keepId) toDeleteIds.push(a.id);
      });
    });

    if (toDeleteIds.length === 0) return;
    if (!confirm(`จะลบ ${toDeleteIds.length} Content ซ้ำออก (เก็บไว้อันล่าสุดของแต่ละกลุ่ม) ยืนยัน?`)) return;

    setIsDeletingDupes(true);
    try {
      const res = await fetch('/api/article-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-batch', ids: toDeleteIds }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Delete failed');
      setArticles(prev => prev.filter(a => !toDeleteIds.includes(a.id)));
      alert(`✅ ลบ Content ซ้ำสำเร็จ ${toDeleteIds.length} รายการ`);
    } catch (e: any) {
      alert(`❌ ลบไม่สำเร็จ: ${e.message}`);
    } finally {
      setIsDeletingDupes(false);
    }
  };

  // Filtered & sorted articles
  const filteredArticles = useMemo(() => {
    let result = [...articles];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.rawArticle.toLowerCase().includes(q) ||
        a.sourceUrl.toLowerCase().includes(q)
      );
    }

    // Tag filter
    if (filterTag) {
      result = result.filter(a => a.tags?.includes(filterTag));
    }

    if (sourceFilter !== 'all') {
      result = result.filter(a => getArticleSource(a).key === sourceFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter(a => getArticleStatus(a).key === statusFilter);
    }

    if (showOldNewsOnly) {
      result = result.filter(isOldNews);
    }

    if (showYoutubeOnly) {
      result = result.filter(a => a.sourceType === 'youtube' || a.tags?.includes('youtube'));
    }

    if (showContentReadyOnly) {
      result = result.filter(a => {
        const key = articleKey(a.rawArticle);
        return !!(articleCache[key]?.generatedArticle) || !!a.contentReadyAt;
      });
    }

    if (showCompletedOnly) {
      result = result.filter(a => completedSourceUrls.has(a.sourceUrl));
    }

    // Sort
    if (sortBy === 'newsScore') {
      result.sort((a, b) => (b.newsScore || 0) - (a.newsScore || 0));
    } else if (sortBy === 'evergreenScore') {
      result.sort((a, b) => (b.evergreenScore || 0) - (a.evergreenScore || 0));
    } else if (sortBy === 'fbShares') {
      result.sort((a, b) => (b.fbShares ?? 0) - (a.fbShares ?? 0));
    } else if (sortBy === 'fbLikes') {
      result.sort((a, b) => (b.fbLikes ?? 0) - (a.fbLikes ?? 0));
    } else if (sortBy === 'fbComments') {
      result.sort((a, b) => (b.fbComments ?? 0) - (a.fbComments ?? 0));
    }
    // 'newest' is default order from API (already sorted by createdAt desc)

    return result;
  }, [articles, searchQuery, filterTag, sourceFilter, statusFilter, showOldNewsOnly, showYoutubeOnly, showContentReadyOnly, showCompletedOnly, articleCache, completedSourceUrls, sortBy]);

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectAll = () => setSelectedIds(new Set(filteredArticles.map(a => a.id)));
  const deselectAll = () => setSelectedIds(new Set());
  const selectedArticles = useMemo(() => articles.filter(a => selectedIds.has(a.id)), [articles, selectedIds]);
  const selectedYoutubeNotExtracted = selectedArticles.filter(a => (a.sourceType === 'youtube' || a.tags?.includes('youtube')) && !a.ytExtracted);

  const handleScanOldNews = async () => {
    setIsScanningOldNews(true);
    setSearchQuery('');
    setFilterTag('');
    setSourceFilter('all');
    setStatusFilter('all');
    setShowYoutubeOnly(false);
    setSelectedIds(new Set());
    setExpandedId(null);
    await loadArticles();
    setHasScannedOldNews(true);
    setShowOldNewsOnly(true);
    setIsScanningOldNews(false);
  };

  const handleExitOldNewsScan = () => {
    setShowOldNewsOnly(false);
    setSelectedIds(new Set());
  };

  const toggleYoutubeZone = () => {
    setShowYoutubeOnly(v => !v);
    setSourceFilter('all');
    setStatusFilter('all');
    setShowOldNewsOnly(false);
    setSelectedIds(new Set());
  };

  // Bulk-fix: mark all YouTube articles as ytExtracted=true
  const [isFixingYt, setIsFixingYt] = useState(false);
  const youtubeNotExtractedCount = useMemo(() => youtubeArticles.filter(a => !a.ytExtracted).length, [youtubeArticles]);
  const handleFixYoutubeExtracted = async () => {
    const ytIds = youtubeArticles.filter(a => !a.ytExtracted).map(a => a.id);
    if (ytIds.length === 0) { alert('✅ คลิป YouTube ทั้งหมด tag ไว้แล้ว'); return; }
    setIsFixingYt(true);
    try {
      const res = await fetch('/api/article-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-yt-extracted', ids: ytIds }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Update failed');
      setArticles(prev => prev.map(a => ytIds.includes(a.id) ? { ...a, ytExtracted: true } : a));
      alert(`✅ อัปเดตสำเร็จ ${ytIds.length} คลิป พร้อมส่งไปทำโพสต์ได้แล้ว!`);
    } catch (e: any) {
      alert(`❌ อัปเดตไม่สำเร็จ: ${e.message}`);
    } finally {
      setIsFixingYt(false);
    }
  };

  const handleSendSelected = async () => {
    if (selectedIds.size === 0) return;

    // Send all selected articles to AI Page directly (including YouTube clips)
    if (!onSendToAIPage) return;
    onSendToAIPage(selectedArticles.map(a => ({
      rawArticle: a.rawArticle,
      sourceUrl: a.sourceUrl,
      title: a.title,
      tags: a.tags,
      images: a.images || [],
      sourceType: a.sourceType,
      channelName: a.channelName,
      channelLogoUrl: a.channelLogoUrl,
      channelAvatar: a.channelAvatar,
      subscriberCount: a.subscriberCount,
      ytExtracted: true,
    })));

    const sentAt = new Date().toISOString();
    const ids = selectedArticles.map(a => a.id);
    setArticles(prev => prev.map(a => ids.includes(a.id) ? { ...a, sentToAIPageAt: sentAt } : a));
    try {
      await fetch('/api/article-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-sent', ids, sentToAIPageAt: sentAt })
      });
    } catch (e) {
      console.error('Failed to mark articles as sent:', e);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const targetIds = Array.from(selectedIds);
    const confirmed = confirm(`ลบ ${targetIds.length} Content ออกจากคลัง?`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await fetch('/api/article-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-batch', ids: targetIds })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Delete failed');
      setArticles(prev => prev.filter(a => !targetIds.includes(a.id)));
      setSelectedIds(new Set());
    } catch (e: any) {
      alert(`ลบ Content ไม่สำเร็จ: ${e.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const scoreColor = (score: number, type: 'news' | 'evergreen') => {
    if (type === 'news') {
      if (score >= 8) return 'bg-red-500/20 text-red-400 border-red-500/30';
      if (score >= 5) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
    if (score >= 8) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (score >= 5) return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">📦 คลัง Content</h1>
          <p className="text-sm opacity-70">ศูนย์กลางรวมวัตถุดิบจาก Radar, YouTube, RSS, GitHub และแหล่งอื่นๆ ก่อนส่งไปสร้างโพสต์/ภาพ/คลิป</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDuplicates(v => !v)}
            className={`text-xs px-3 py-2 rounded-lg transition-all font-bold flex items-center gap-1.5 ${showDuplicates ? 'bg-orange-600 text-white' : duplicateCount > 0 ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 hover:bg-orange-500/30' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
          >
            🔍 Content ซ้ำ {duplicateCount > 0 && <span className="bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{duplicateCount}</span>}
          </button>
          <button onClick={loadArticles} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-all">
            🔄 รีเฟรช
          </button>
          <div className="text-right">
            <div className="text-2xl font-bold text-cyan-400">{articles.length}</div>
            <div className="text-[10px] text-gray-500">Content ทั้งหมด</div>
          </div>
        </div>
      </div>

      {/* Source Overview */}
      <div className="card p-4 border-l-4 border-l-violet-500 bg-gradient-to-br from-[var(--bg-card)] to-violet-950/20">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div>
            <h2 className="text-lg font-bold text-violet-300 flex items-center gap-2">🧭 แหล่งที่มาของ Content</h2>
            <p className="text-xs text-gray-400 mt-1">
              ใช้หน้านี้เป็นคลังกลาง: อะไรที่หาเจอควรถูกเก็บที่นี่ก่อน แล้วค่อยส่งไปสร้าง Content
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setSourceFilter('all'); setShowYoutubeOnly(false); setShowOldNewsOnly(false); setSelectedIds(new Set()); }}
              className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-all ${sourceFilter === 'all' && !showYoutubeOnly ? 'bg-violet-600 text-white border-violet-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-violet-500'}`}
            >
              ทั้งหมด ({articles.length})
            </button>
            {sourceSummaries.map(source => (
              <button
                key={source.key}
                onClick={() => { setSourceFilter(sourceFilter === source.key ? 'all' : source.key); setShowYoutubeOnly(false); setShowOldNewsOnly(false); setSelectedIds(new Set()); }}
                className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-all ${sourceFilter === source.key ? source.className : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'}`}
                title={`ดูเฉพาะ ${source.label}`}
              >
                {source.icon} {source.label} ({source.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Workflow Status */}
      <div className="card p-4 border-l-4 border-l-emerald-500 bg-gradient-to-br from-[var(--bg-card)] to-emerald-950/20">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div>
            <h2 className="text-lg font-bold text-emerald-300 flex items-center gap-2">✅ สถานะงานในคลัง</h2>
            <p className="text-xs text-gray-400 mt-1">
              ดูทันทีว่า Content ไหนแค่เจอแล้ว, ดึงข้อมูลแล้ว, ส่งไปสร้างแล้ว, มีบทความพร้อมแล้ว หรือสร้างเสร็จจริง
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setStatusFilter('all'); setShowContentReadyOnly(false); setShowCompletedOnly(false); setSelectedIds(new Set()); }}
              className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-all ${statusFilter === 'all' && !showContentReadyOnly && !showCompletedOnly ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-emerald-500'}`}
            >
              ทุกสถานะ ({articles.length})
            </button>
            {statusSummaries.map(status => (
              <button
                key={status.key}
                onClick={() => {
                  setStatusFilter(statusFilter === status.key ? 'all' : status.key);
                  setShowContentReadyOnly(false);
                  setShowCompletedOnly(false);
                  setShowOldNewsOnly(false);
                  setShowYoutubeOnly(false);
                  setSelectedIds(new Set());
                }}
                className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-all ${statusFilter === status.key ? status.className : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'}`}
                title={status.desc}
              >
                {status.icon} {status.label} ({status.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Old News Management */}
      <div className="card p-4 border-l-4 border-l-red-500 bg-gradient-to-br from-[var(--bg-card)] to-red-950/20">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div>
            <h2 className="text-lg font-bold text-red-300 flex items-center gap-2">🧹 จัดการข่าวเก่า</h2>
            <p className="text-xs text-gray-400 mt-1">
              สแกนทั้งคลังเพื่อหา ข่าวคะแนน 8 ขึ้นไป, Evergreen 7 ลงมา, และอยู่ในคลังมาแล้ว 7 วันขึ้นไป
            </p>
            {hasScannedOldNews && (
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs bg-red-500/10 text-red-300 border border-red-500/30 px-2 py-1 rounded">
                  พบ {oldNewsArticles.length} ข่าวเก่า
                </span>
                <span className="text-xs bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2 py-1 rounded">
                  ทำข่าวแล้ว {oldNewsSentCount} ข่าว
                </span>
                <span className="text-xs bg-gray-700/40 text-gray-300 border border-gray-600 px-2 py-1 rounded">
                  สแกนจากทั้งหมด {articles.length} Content
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showOldNewsOnly && (
              <button
                onClick={handleExitOldNewsScan}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 text-sm font-bold rounded-lg transition-all"
              >
                ดู Content ทั้งหมด
              </button>
            )}
            <button
              onClick={handleScanOldNews}
              disabled={isScanningOldNews}
              className="px-5 py-3 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-lg shadow-red-500/20 transition-all"
            >
              {isScanningOldNews ? '⏳ กำลังสแกนทั้งคลัง...' : '🔎 สแกนข่าวเก่าทั้งคลัง'}
            </button>
          </div>
        </div>
      </div>

      {/* YouTube Zone */}
      <div className="card p-4 border-l-4 border-l-cyan-500 bg-gradient-to-br from-[var(--bg-card)] to-cyan-950/20">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div>
            <h2 className="text-lg font-bold text-cyan-300 flex items-center gap-2">▶️ โซน YouTube</h2>
            <p className="text-xs text-gray-400 mt-1">
              คลิปที่เลือกบันทึกจากหน้าเรดาร์ YouTube จะมาอยู่ตรงนี้ แยกจากข่าว RSS/Facebook
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-2 py-1 rounded">
                มี {youtubeArticles.length} คลิปในคลัง
              </span>
              <span className="text-xs bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2 py-1 rounded">
                ทำโพสต์แล้ว {youtubeArticles.filter(a => a.sentToAIPageAt).length} คลิป
              </span>
              {youtubeNotExtractedCount > 0 && (
                <span className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-1 rounded">
                  ⚠️ ยังไม่ tag ว่าดึง Script แล้ว: {youtubeNotExtractedCount} คลิป
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {youtubeNotExtractedCount > 0 && (
              <button
                onClick={handleFixYoutubeExtracted}
                disabled={isFixingYt}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-lg shadow-amber-500/20 transition-all"
              >
                {isFixingYt ? '⏳ กำลังแก้ไข...' : `🔧 แก้ Tag ${youtubeNotExtractedCount} คลิป`}
              </button>
            )}
            <button
              onClick={toggleYoutubeZone}
              className={`px-5 py-3 text-white text-sm font-bold rounded-lg shadow-lg transition-all ${showYoutubeOnly ? 'bg-gray-700 hover:bg-gray-600' : 'bg-cyan-700 hover:bg-cyan-600 shadow-cyan-500/20'}`}
            >
              {showYoutubeOnly ? 'ดู Content ทั้งหมด' : 'ดูเฉพาะ YouTube'}
            </button>
          </div>
        </div>
      </div>

      {/* Duplicate Management Panel */}
      {showDuplicates && (
        <div className="card p-4 border-l-4 border-l-orange-500 bg-gradient-to-br from-[var(--bg-card)] to-orange-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-orange-300 flex items-center gap-2">🔍 จัดการ Content ซ้ำ</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {duplicateGroups.length === 0
                  ? 'ไม่พบ Content ซ้ำในคลัง 🎉'
                  : `พบ ${duplicateGroups.length} กลุ่มซ้ำ — รวม ${duplicateCount} Content ที่ควรลบออก`}
              </p>
            </div>
            {duplicateGroups.length > 0 && (
              <button
                onClick={() => handleDeleteDuplicates()}
                disabled={isDeletingDupes}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2"
              >
                {isDeletingDupes ? '⏳ กำลังลบ...' : `🗑️ ลบซ้ำทั้งหมด (${duplicateCount} รายการ)`}
              </button>
            )}
          </div>

          {duplicateGroups.length > 0 && (
            <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
              {duplicateGroups.map((group, gi) => (
                <div key={gi} className="border border-orange-500/20 rounded-xl overflow-hidden">
                  {/* Group header */}
                  <div className="px-3 py-2 flex items-center gap-2" style={{ backgroundColor: 'rgba(249,115,22,0.1)' }}>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">
                      {group.type === 'url' ? '🔗 URL ซ้ำ' : '📝 ชื่อซ้ำ'}
                    </span>
                    <span className="text-[10px] text-gray-500 flex-1 truncate">{group.key}</span>
                    <span className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                      {group.articles.length} รายการ
                    </span>
                  </div>

                  {/* Articles in group */}
                  {group.articles.map((article, ai) => (
                    <div
                      key={article.id}
                      className={`flex items-start gap-3 px-3 py-2.5 border-t border-orange-500/10 ${ai === 0 ? 'bg-emerald-900/15' : 'bg-red-900/10'}`}
                    >
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${ai === 0 ? 'bg-emerald-600 text-white' : 'bg-red-700/60 text-red-200'}`}>
                        {ai === 0 ? 'เก็บ' : 'ลบ'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-200 truncate">{article.title || '(ไม่มีชื่อ)'}</p>
                        <p className="text-[10px] text-gray-500 truncate">{article.sourceUrl}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-gray-600">
                            {new Date(article.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {article.newsScore > 0 && <span className="text-[9px] text-red-400">🔥 {article.newsScore}/10</span>}
                          {article.evergreenScore > 0 && <span className="text-[9px] text-emerald-400">🌿 {article.evergreenScore}/10</span>}
                          {article.sentToAIPageAt && <span className="text-[9px] text-purple-400">✅ ทำแล้ว</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats & Tags */}
      <div className="card p-4 border-l-4 border-l-cyan-500 bg-gradient-to-br from-[var(--bg-card)] to-cyan-900/10">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm font-bold text-cyan-400">🏷️ หมวดหมู่:</span>
          <button
            onClick={() => setFilterTag('')}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-all border ${!filterTag ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-cyan-500'}`}
          >
            ทั้งหมด ({articles.length})
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-all border ${filterTag === tag ? 'bg-blue-600 text-white border-blue-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-blue-500'}`}
            >
              #{tag} ({tagCounts[tag] || 0})
            </button>
          ))}
        </div>

        {/* Search & Sort */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍 ค้นหา Content..."
            className="input-field flex-1 min-w-[200px] text-sm"
          />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="input-field text-sm w-[200px]"
          >
            <option value="newest">📅 ใหม่ล่าสุด</option>
            <option value="newsScore">🔥 คะแนนข่าวสูงสุด</option>
            <option value="evergreenScore">🌿 คะแนน Evergreen สูงสุด</option>
            <option value="fbShares">🔄 แชร์สูงสุด (FB)</option>
            <option value="fbLikes">❤️ ไลค์สูงสุด (FB)</option>
            <option value="fbComments">💬 คอมเม้นสูงสุด (FB)</option>
          </select>
        </div>
      </div>

      {/* Quick Filters */}
      {(() => {
        const contentReadyCount = articles.filter(a => {
          const key = articleKey(a.rawArticle);
          return !!(articleCache[key]?.generatedArticle) || !!a.contentReadyAt;
        }).length;
        const completedCount = articles.filter(a => completedSourceUrls.has(a.sourceUrl)).length;
        const outsideStockCount = Math.max(0, completedResultTotal - completedCount);
        if (contentReadyCount === 0 && completedCount === 0) return null;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">กรอง:</span>
            {contentReadyCount > 0 && (
              <button
                onClick={() => { setShowContentReadyOnly(v => !v); setShowCompletedOnly(false); setStatusFilter('all'); setShowOldNewsOnly(false); setShowYoutubeOnly(false); }}
                className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-all ${showContentReadyOnly ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'}`}
              >
                📝 บทความพร้อม ({contentReadyCount})
              </button>
            )}
            {completedCount > 0 && (
              <button
                onClick={() => { setShowCompletedOnly(v => !v); setShowContentReadyOnly(false); setStatusFilter('all'); setShowOldNewsOnly(false); setShowYoutubeOnly(false); }}
                className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-all ${showCompletedOnly ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-500/20' : 'bg-violet-500/10 text-violet-300 border-violet-500/30 hover:bg-violet-500/20'}`}
              >
                ✅ ทำเสร็จทุกอย่างแล้ว ({completedCount})
              </button>
            )}
            {outsideStockCount > 0 && (
              <span
                className="text-[10px] text-gray-400 bg-gray-800/60 border border-gray-700 px-2 py-1 rounded"
                title="มีผลลัพธ์ในหน้าผลลัพธ์ที่หา sourceUrl ตรงกับ Content ในคลังไม่เจอ จึงไม่นับในปุ่มกรองของคลัง"
              >
                ผลลัพธ์รวม {completedResultTotal} / ตรงกับคลัง {completedCount} / นอกคลัง {outsideStockCount}
              </span>
            )}
          </div>
        );
      })()}

      {/* Selection Controls */}
      {filteredArticles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-black/20 p-3 rounded-lg border border-gray-700/50">
          <button onClick={selectAll} className="text-xs bg-cyan-700/50 hover:bg-cyan-700 text-cyan-300 px-3 py-1.5 rounded font-medium transition-all">☑ เลือกทั้งหมด</button>
          <button onClick={deselectAll} className="text-xs bg-gray-700/50 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded font-medium transition-all">☐ ยกเลิก</button>
          {(() => {
            const readyNotDone = filteredArticles.filter(a => {
              const key = articleKey(a.rawArticle);
              const hasContent = !!(articleCache[key]?.generatedArticle) || !!a.contentReadyAt;
              return hasContent && !completedSourceUrls.has(a.sourceUrl);
            });
            return readyNotDone.length > 0 ? (
              <>
                <button
                  onClick={() => setSelectedIds(new Set(readyNotDone.map(a => a.id)))}
                  className="text-xs bg-emerald-700/60 hover:bg-emerald-600 text-emerald-200 px-3 py-1.5 rounded font-bold transition-all border border-emerald-500/40"
                  title="เลือกเฉพาะ Content ที่มีเนื้อหาพร้อมแล้ว แต่ยังไม่มีผลลัพธ์ในระบบ"
                >
                  📝 เลือกพร้อมแต่ยังไม่เสร็จ ({readyNotDone.length})
                </button>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">🎲 สุ่ม</span>
                  <NumInput
                    min={1}
                    max={readyNotDone.length}
                    value={randomPickCount}
                    onChange={setRandomPickCount}
                    className="w-14 text-xs text-center bg-gray-800 border border-gray-600 text-white rounded px-1 py-1 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-xs text-gray-400">งาน</span>
                  <button
                    onClick={() => {
                      const shuffled = [...readyNotDone].sort(() => Math.random() - 0.5);
                      const picked = shuffled.slice(0, randomPickCount);
                      setSelectedIds(new Set(picked.map(a => a.id)));
                    }}
                    className="text-xs bg-amber-700/60 hover:bg-amber-600 text-amber-200 px-3 py-1.5 rounded font-bold transition-all border border-amber-500/40"
                    title={`สุ่มหยิบ ${randomPickCount} งานจาก ${readyNotDone.length} งานที่พร้อมแต่ยังไม่เสร็จ`}
                  >
                    🎲 สุ่มหยิบ
                  </button>
                </div>
              </>
            ) : null;
          })()}
          <span className="text-xs text-gray-500">เลือกอยู่ {selectedIds.size}/{filteredArticles.length}</span>
          {showOldNewsOnly && (
            <span className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded">
              กำลังแสดงข่าวเก่า: คะแนนข่าว 8+ / Evergreen 7 ลงมา / อายุ 7 วันขึ้นไป
            </span>
          )}
          {showYoutubeOnly && (
            <span className="text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded">
              กำลังแสดงเฉพาะคลิป YouTube
            </span>
          )}
          {sourceFilter !== 'all' && (
            <span className="text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-1 rounded">
              กำลังแสดงเฉพาะแหล่งที่มา: {sourceSummaries.find(s => s.key === sourceFilter)?.label || sourceFilter}
            </span>
          )}
          {statusFilter !== 'all' && (
            <span className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
              กำลังแสดงเฉพาะสถานะ: {statusSummaries.find(s => s.key === statusFilter)?.label || statusFilter}
            </span>
          )}
          {showContentReadyOnly && (
            <span className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
              กำลังแสดงเฉพาะ Content ที่สร้างบทความเสร็จแล้ว
            </span>
          )}
          {showCompletedOnly && (
            <span className="text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-1 rounded">
              กำลังแสดงเฉพาะ Content ที่ทำเสร็จทุกอย่างแล้ว (อยู่ในผลลัพธ์)
            </span>
          )}
          {selectedIds.size > 0 && onSendToAIPage && (
            <button
              onClick={handleSendSelected}
              className="ml-auto px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2"
            >
              🚀 ส่ง {selectedIds.size} Content ไปทำโพสต์
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-lg shadow-red-500/20 transition-all flex items-center gap-2"
            >
              {isDeleting ? '⏳ กำลังลบ...' : `🗑️ ลบ ${selectedIds.size} Content`}
            </button>
          )}
        </div>
      )}

      {/* Article List */}
      {isLoading ? (
        <div className="text-center py-20 text-gray-500">
          <div className="text-4xl mb-3 animate-pulse">📦</div>
          <p>กำลังโหลดคลัง Content...</p>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-lg font-medium mb-2">{showYoutubeOnly ? 'ยังไม่มีคลิป YouTube ในคลัง' : showOldNewsOnly ? 'ไม่พบข่าวเก่าที่เข้าเงื่อนไข' : 'ยังไม่มี Content ในคลัง'}</p>
          <p className="text-sm">{showYoutubeOnly ? 'ไปหน้าเรดาร์คู่แข่ง แล้วเลือกคลิปจากช่อง YouTube เพื่อบันทึก' : showOldNewsOnly ? 'เงื่อนไขคือ คะแนนข่าว 8 ขึ้นไป, Evergreen 7 ลงมา, อายุในคลัง 7 วันขึ้นไป' : 'ไปหน้า "ค้นหาContent น่าสนใจ" แล้วกดเก็บ Content เข้าคลัง'}</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto pr-1 custom-scrollbar">
          {filteredArticles.map((article) => {
            const isExpanded = expandedId === article.id;
            const isSelected = selectedIds.has(article.id);
            const ageDays = getArticleAgeDays(article.createdAt);
            const cached = getCachedEntry(article);
            const isCacheExpanded = expandedCacheId === article.id;
            const isCompleted = completedSourceUrls.has(article.sourceUrl);
            const source = getArticleSource(article);
            const status = getArticleStatus(article);
            return (
              <div
                key={article.id}
                className={`bg-[var(--bg-card)] rounded-xl border p-4 transition-all ${isSelected ? 'border-cyan-500 bg-cyan-900/10' : 'border-gray-700/50 hover:border-gray-600'}`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <label className="cursor-pointer flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(article.id)}
                      className="w-5 h-5 text-cyan-500 bg-gray-700 border-gray-600 rounded cursor-pointer"
                    />
                  </label>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Top row: domain, scores, tags */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${source.className}`}>
                        {source.icon} {source.label}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${status.className}`} title={status.desc}>
                        {status.icon} {status.label}
                      </span>
                      <span className="text-[10px] text-gray-500 font-bold">{article.domain}</span>

                      {article.newsScore > 0 && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${scoreColor(article.newsScore, 'news')}`}>
                          🔥 ข่าว: {article.newsScore}/10
                        </span>
                      )}
                      {article.evergreenScore > 0 && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${scoreColor(article.evergreenScore, 'evergreen')}`}>
                          🌿 Evergreen: {article.evergreenScore}/10
                        </span>
                      )}

                      {article.tags?.map((tag, ti) => (
                        <span
                          key={ti}
                          onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium border border-blue-500/20 cursor-pointer hover:bg-blue-500/30"
                        >
                          #{tag}
                        </span>
                      ))}

                      {(article.sourceType === 'youtube' || article.tags?.includes('youtube')) && (
                        <span className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold border bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                          {article.channelLogoUrl ? (
                            <img src={article.channelLogoUrl} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0 border border-cyan-500/40" />
                          ) : '▶️'}
                          {' '}YouTube{article.channelName ? `: ${article.channelName}` : ''}
                          {article.subscriberCount != null && article.subscriberCount > 0 && (
                            <span className="ml-1 px-1.5 py-0 rounded-full bg-green-500/20 text-green-300 border border-green-500/30 text-[9px] font-bold">
                              👥 {article.subscriberCount >= 1_000_000 ? `${(article.subscriberCount / 1_000_000).toFixed(1)}M` : article.subscriberCount >= 1_000 ? `${(article.subscriberCount / 1_000).toFixed(1)}K` : article.subscriberCount.toLocaleString()}
                            </span>
                          )}
                        </span>
                      )}

                      {article.ytExtracted && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                          🎬 ดึง Script + แคปรูปจาก YouTube แล้ว
                        </span>
                      )}

                      {isCompleted && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-violet-500/20 text-violet-300 border-violet-500/30">
                          ✅ ทำเสร็จทุกอย่างแล้ว
                        </span>
                      )}
                      {cached && (
                        <button
                          onClick={() => setExpandedCacheId(isCacheExpanded ? null : article.id)}
                          className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                        >
                          📝 บทความพร้อม {isCacheExpanded ? '▲' : '▼'}
                        </button>
                      )}

                      {isOldNews(article) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-red-500/20 text-red-300 border-red-500/30">
                          ข่าวเก่า {ageDays} วัน
                        </span>
                      )}

                      {(article.fbLikes != null || article.fbComments != null || article.fbShares != null) && (
                        <span className="flex items-center gap-2 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                          {article.fbLikes != null && <span className="text-red-400">❤️ {article.fbLikes.toLocaleString()}</span>}
                          {article.fbComments != null && <span className="text-blue-400">💬 {article.fbComments.toLocaleString()}</span>}
                          {article.fbShares != null && <span className="text-green-400">🔄 {article.fbShares.toLocaleString()}</span>}
                          {article.fbViews != null && article.fbViews > 0 && <span className="text-gray-400">👁 {article.fbViews.toLocaleString()}</span>}
                        </span>
                      )}

                      <span className="text-[10px] text-gray-600 ml-auto">
                        {new Date(article.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-[15px] font-bold text-gray-100 mb-1 leading-snug">{article.title}</h3>

                    {/* Source URL */}
                    <a href={article.sourceUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-500 hover:underline break-all block mb-2">
                      {article.sourceUrl}
                    </a>

                    {/* YouTube thumbnail strip (always visible if images exist) */}
                    {article.images && article.images.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {article.images.slice(0, isExpanded ? undefined : 5).map((img, ii) => (
                          <a key={ii} href={img} target="_blank" rel="noreferrer">
                            <img src={img} alt={`frame ${ii + 1}`} className="h-14 w-24 object-cover rounded border border-gray-700/50 hover:border-cyan-500 transition-all" />
                          </a>
                        ))}
                        {!isExpanded && article.images.length > 5 && (
                          <div className="h-14 w-14 rounded border border-gray-700/50 bg-black/40 flex items-center justify-center text-[10px] text-gray-400">
                            +{article.images.length - 5}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Preview or Full */}
                    {!isExpanded ? (
                      <p className="text-xs text-gray-400 line-clamp-2 mt-2">{article.rawArticle.substring(0, 200)}...</p>
                    ) : (
                      <div className="bg-black/30 p-3 rounded-lg border border-gray-700/30 mt-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{article.rawArticle}</pre>
                      </div>
                    )}

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : article.id)}
                      className="text-[10px] text-cyan-500 hover:text-cyan-400 mt-2 font-medium"
                    >
                      {isExpanded ? '▲ ซ่อนเนื้อหา' : '▼ ดูเนื้อหาเต็ม'}
                    </button>

                    {/* Cache restore panel */}
                    {cached && isCacheExpanded && (
                      <div className="mt-3 bg-emerald-950/40 border border-emerald-600/30 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-400">📝 เนื้อหาที่สร้างไว้แล้ว</span>
                          {cached.cachedAt && (
                            <span className="text-[9px] text-gray-500">
                              {new Date(cached.cachedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        {cached.selectedHeadline && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-gray-400 font-bold">📌 พาดหัวที่เลือก:</span>
                            <p className="text-sm text-amber-300 font-semibold leading-snug">{cached.selectedHeadline}</p>
                          </div>
                        )}

                        {cached.generatedArticle && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-gray-400 font-bold">📄 โพสต์ที่เขียนแล้ว:</span>
                              <button
                                onClick={() => navigator.clipboard.writeText(cached.generatedArticle)}
                                className="text-[9px] text-cyan-400 hover:text-cyan-300 transition-colors"
                              >
                                📋 คัดลอก
                              </button>
                            </div>
                            <div className="bg-black/30 rounded-lg p-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{cached.generatedArticle}</pre>
                            </div>
                          </div>
                        )}

                        {(cached.commentPostText || cached.generatedCommentPost) && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-gray-400 font-bold">💬 ใต้คอมเม้น:</span>
                              <button
                                onClick={() => navigator.clipboard.writeText(cached.commentPostText || cached.generatedCommentPost)}
                                className="text-[9px] text-cyan-400 hover:text-cyan-300 transition-colors"
                              >
                                📋 คัดลอก
                              </button>
                            </div>
                            <p className="text-xs text-gray-300 bg-black/20 rounded p-2">{(cached.commentPostText || cached.generatedCommentPost).slice(0, 200)}...</p>
                          </div>
                        )}

                        {(cached.localImageUrl || cached.imageUrl) && (
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-gray-400 font-bold">🖼️ รูปที่สร้าง:</span>
                            <img src={cached.localImageUrl || cached.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover border border-gray-600" />
                            {cached.localImageUrl && <span className="text-[9px] text-emerald-400">💾 local</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
