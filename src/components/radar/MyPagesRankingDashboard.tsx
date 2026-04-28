import React, { useMemo, useState } from 'react';
import { CompetitorPage } from '../../interfaces/radar';

interface MyPagesRankingDashboardProps {
  pages: CompetitorPage[];
  onUpdatePage?: (id: string, updates: Partial<CompetitorPage>) => void;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function getPlatformIcon(platform: string) {
  switch (platform) {
    case 'facebook': return '📘';
    case 'tiktok': return '🎵';
    case 'youtube': return '▶️';
    case 'instagram': return '📷';
    default: return '🌐';
  }
}

/** Row component สำหรับทั้งเพจของฉันและคู่แข่ง */
function PageRow({ page, rank, isOwn, showColumns }: {
  page: CompetitorPage; rank: number | null; isOwn: boolean; showColumns: boolean;
}) {
  const bgColor = isOwn ? 'rgba(251,191,36,0.10)' : rank && rank <= 3
    ? rank === 1 ? 'rgba(250,204,21,0.10)' : rank === 2 ? 'rgba(209,213,219,0.08)' : 'rgba(217,119,6,0.08)'
    : 'transparent';

  return (
    <div
      className="flex items-center gap-3 px-5 py-3"
      style={{
        backgroundColor: bgColor,
        borderLeft: isOwn ? '4px solid #fbbf24' : '4px solid transparent',
      }}
    >
      {/* Rank */}
      <div className="w-10 text-center flex-shrink-0">
        {rank && MEDAL[rank] ? (
          <span className="text-xl">{MEDAL[rank]}</span>
        ) : rank ? (
          <span className="text-sm font-bold" style={{ color: isOwn ? '#fbbf24' : 'var(--text-muted, #888)' }}>#{rank}</span>
        ) : (
          <span className="text-base">⭐</span>
        )}
      </div>

      {/* Profile Pic */}
      <div className="flex-shrink-0">
        {page.profilePicUrl ? (
          <img
            src={page.profilePicUrl}
            alt={page.name}
            className="w-9 h-9 rounded-full object-cover border-2"
            style={{ borderColor: isOwn ? '#fbbf24' : 'var(--border-color)' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-lg border-2"
            style={{
              borderColor: isOwn ? '#fbbf24' : 'var(--border-color)',
              backgroundColor: isOwn ? 'rgba(251,191,36,0.15)' : 'var(--surface, var(--bg-main))'
            }}
          >
            {getPlatformIcon(page.platform)}
          </div>
        )}
      </div>

      {/* Name + Badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm truncate" style={{ color: isOwn ? '#fbbf24' : 'var(--text-main)' }}>
            {page.name}
          </span>
          {isOwn && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: '#fbbf24', color: '#1a1a1a' }}>
              ⭐ เพจของฉัน
            </span>
          )}
          {page.category && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>
              {page.category}
            </span>
          )}
        </div>
        {page.viralPosts && page.viralPosts.length > 0 && (
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted, #888)' }}>
            📊 {page.viralPosts.length} โพสต์
          </div>
        )}
      </div>

      {/* Data Columns */}
      {showColumns && (
        <div className="flex items-center gap-4 flex-shrink-0 text-right text-sm">
          <div className="w-20">
            <div className="font-bold" style={{ color: page.followers > 0 ? '#60a5fa' : 'var(--text-muted, #555)' }}>
              {page.followers > 0 ? formatNumber(page.followers) : '-'}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted, #888)' }}>ผู้ติดตาม</div>
          </div>
          <div className="w-20">
            <div className="font-bold" style={{ color: page.engagementRate > 0 ? '#fb923c' : 'var(--text-muted, #555)' }}>
              {page.engagementRate > 0 ? `${page.engagementRate.toFixed(2)}%` : '-'}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted, #888)' }}>Engagement</div>
          </div>
          <div className="w-20">
            <div className="font-bold" style={{ color: page.followerGrowth > 0 ? '#4ade80' : 'var(--text-muted, #555)' }}>
              {page.followerGrowth > 0 ? `+${formatNumber(page.followerGrowth)}` : '-'}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted, #888)' }}>Growth</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MyPagesRankingDashboard({ pages, onUpdatePage }: MyPagesRankingDashboardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [sortBy, setSortBy] = useState<'followers' | 'engagement' | 'growth'>('followers');
  const [inlineEdit, setInlineEdit] = useState<{ id: string; value: string } | null>(null);

  const ownPages = pages.filter(p => p.isOwnPage);
  const competitorPages = pages.filter(p => !p.isOwnPage);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    pages.forEach(p => { if (p.category) cats.add(p.category); });
    return ['ทั้งหมด', ...Array.from(cats)];
  }, [pages]);

  const filteredPages = useMemo(() => {
    return selectedCategory === 'ทั้งหมด'
      ? pages
      : pages.filter(p => p.category === selectedCategory);
  }, [pages, selectedCategory]);

  const ownInFilter = filteredPages.filter(p => p.isOwnPage);
  const compInFilter = filteredPages.filter(p => !p.isOwnPage);

  const ownAgg = useMemo(() => {
    if (ownInFilter.length === 0) return null;
    const totalFollowers = ownInFilter.reduce((s, p) => s + (p.followers || 0), 0);
    const totalGrowth = ownInFilter.reduce((s, p) => s + (p.followerGrowth || 0), 0);
    const withEng = ownInFilter.filter(p => p.engagementRate > 0);
    const avgEngagement = withEng.length > 0
      ? withEng.reduce((s, p) => s + p.engagementRate, 0) / withEng.length
      : 0;
    return { totalFollowers, totalGrowth, avgEngagement, count: ownInFilter.length };
  }, [ownInFilter]);

  // Rank competitors only (sorted)
  const sortedCompetitors = useMemo(() => {
    const active = compInFilter.filter(p =>
      p.status === 'active' && (p.followers > 0 || p.engagementRate > 0 || (p.viralPosts && p.viralPosts.length > 0))
    );
    return [...active].sort((a, b) => {
      const aVal = sortBy === 'followers' ? (a.followers || 0) : sortBy === 'engagement' ? (a.engagementRate || 0) : (a.followerGrowth || 0);
      const bVal = sortBy === 'followers' ? (b.followers || 0) : sortBy === 'engagement' ? (b.engagementRate || 0) : (b.followerGrowth || 0);
      return bVal - aVal;
    });
  }, [compInFilter, sortBy]);

  // Find own rank among all pages
  const ownRankDisplay = useMemo(() => {
    if (!ownAgg) return null;
    const ownValue = sortBy === 'followers' ? ownAgg.totalFollowers
      : sortBy === 'engagement' ? ownAgg.avgEngagement
      : ownAgg.totalGrowth;
    const compValues = sortedCompetitors.map(p =>
      sortBy === 'followers' ? (p.followers || 0) : sortBy === 'engagement' ? (p.engagementRate || 0) : (p.followerGrowth || 0)
    );
    const rank = compValues.filter(v => v > ownValue).length + 1;
    const total = compValues.length + 1;
    return { rank, total };
  }, [ownAgg, sortedCompetitors, sortBy]);

  const handleInlineSave = (id: string) => {
    if (!inlineEdit || !onUpdatePage) return;
    const val = parseInt(inlineEdit.value.replace(/,/g, '')) || 0;
    onUpdatePage(id, { followers: val });
    setInlineEdit(null);
  };

  if (ownPages.length === 0) {
    return (
      <div className="p-6 rounded-2xl border border-dashed text-center" style={{ borderColor: 'var(--border-color)' }}>
        <div className="text-4xl mb-3">⭐</div>
        <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text-main)' }}>ยังไม่มีเพจของคุณในระบบ</p>
        <p className="text-sm" style={{ color: 'var(--text-muted, #888)' }}>
          เพิ่มเพจโดยติ๊ก <span className="font-bold text-yellow-400">⭐ เพจของฉัน</span> ตอนเพิ่มเพจ หรือกด ✏️ แก้ไข แล้วเปิดสวิตช์
        </p>
      </div>
    );
  }

  const sortLabel = sortBy === 'followers' ? 'ผู้ติดตาม' : sortBy === 'engagement' ? 'Engagement' : 'Growth (7 วัน)';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
            ⭐ Dashboard เปรียบเทียบเพจของฉัน vs คู่แข่ง
          </h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted, #888)' }}>
            เพจของฉัน {ownPages.length} เพจ | คู่แข่ง {competitorPages.length} เพจ
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted, #888)' }}>เรียงโดย:</span>
          {(['followers', 'engagement', 'growth'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={sortBy === s
                ? { backgroundColor: 'var(--accent)', color: '#fff' }
                : { backgroundColor: 'var(--surface, var(--bg-card))', color: 'var(--text-muted, #888)', border: '1px solid var(--border-color)' }
              }
            >
              {s === 'followers' ? '👥 ผู้ติดตาม' : s === 'engagement' ? '🔥 Engagement' : '🚀 Growth'}
            </button>
          ))}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={selectedCategory === cat
              ? { backgroundColor: '#fbbf24', color: '#1a1a1a' }
              : { backgroundColor: 'var(--surface, var(--bg-card))', color: 'var(--text-muted, #888)', border: '1px solid var(--border-color)' }
            }
          >
            {cat}
            {cat !== 'ทั้งหมด' && <span className="ml-1 opacity-60">({pages.filter(p => p.category === cat).length})</span>}
          </button>
        ))}
      </div>

      {/* ===== ส่วนบน: เพจของฉัน ปักหมุด ===== */}
      <div className="rounded-2xl overflow-hidden border-2" style={{ borderColor: '#fbbf24' }}>
        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: 'rgba(251,191,36,0.15)' }}>
          <div className="flex items-center gap-3">
            <span className="text-lg">⭐</span>
            <span className="font-bold text-sm" style={{ color: '#fbbf24' }}>
              เพจของฉัน ({ownInFilter.length} เพจ)
            </span>
            {ownRankDisplay && (
              <span className="px-3 py-1 rounded-full text-xs font-black" style={{ backgroundColor: '#fbbf24', color: '#1a1a1a' }}>
                อันดับ #{ownRankDisplay.rank} จาก {ownRankDisplay.total} เพจ ({sortLabel})
              </span>
            )}
          </div>
          {onUpdatePage && (
            <span className="text-[10px]" style={{ color: 'var(--text-muted, #888)' }}>คลิกตัวเลขผู้ติดตามเพื่อแก้ไข</span>
          )}
        </div>

        {/* Summary Row */}
        {ownAgg && ownInFilter.length > 0 && (
          <div className="grid grid-cols-3 gap-0 border-b" style={{ borderColor: 'rgba(251,191,36,0.3)', backgroundColor: 'rgba(251,191,36,0.06)' }}>
            <div className="p-3 text-center border-r" style={{ borderColor: 'rgba(251,191,36,0.2)' }}>
              <div className="text-xl font-black" style={{ color: '#60a5fa' }}>
                {ownAgg.totalFollowers > 0 ? formatNumber(ownAgg.totalFollowers) : '-'}
              </div>
              <div className="text-[10px] font-semibold" style={{ color: 'var(--text-muted, #888)' }}>ผู้ติดตามรวม</div>
            </div>
            <div className="p-3 text-center border-r" style={{ borderColor: 'rgba(251,191,36,0.2)' }}>
              <div className="text-xl font-black text-orange-400">
                {ownAgg.avgEngagement > 0 ? `${ownAgg.avgEngagement.toFixed(2)}%` : '-'}
              </div>
              <div className="text-[10px] font-semibold" style={{ color: 'var(--text-muted, #888)' }}>Engagement เฉลี่ย</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-xl font-black text-green-400">
                {ownAgg.totalGrowth > 0 ? `+${formatNumber(ownAgg.totalGrowth)}` : '-'}
              </div>
              <div className="text-[10px] font-semibold" style={{ color: 'var(--text-muted, #888)' }}>Growth รวม</div>
            </div>
          </div>
        )}

        {/* Own Pages List */}
        <div className="divide-y" style={{ divideColor: 'rgba(251,191,36,0.2)' } as any}>
          {ownInFilter.map(page => (
            <div
              key={page.id}
              className="flex items-center gap-3 px-5 py-3"
              style={{ backgroundColor: 'rgba(251,191,36,0.06)', borderLeft: '4px solid #fbbf24' }}
            >
              <div className="w-10 text-center flex-shrink-0">
                <span className="text-base">⭐</span>
              </div>
              <div className="flex-shrink-0">
                {page.profilePicUrl ? (
                  <img src={page.profilePicUrl} alt={page.name} className="w-9 h-9 rounded-full object-cover border-2" style={{ borderColor: '#fbbf24' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg border-2" style={{ borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.15)' }}>
                    {getPlatformIcon(page.platform)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm" style={{ color: '#fbbf24' }}>{page.name}</span>
                  {page.category && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>{page.category}</span>
                  )}
                </div>
                {page.viralPosts && page.viralPosts.length > 0 && (
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted, #888)' }}>📊 {page.viralPosts.length} โพสต์</div>
                )}
              </div>

              {/* Followers (inline editable) */}
              <div className="flex items-center gap-4 flex-shrink-0 text-right text-sm">
                <div className="w-24">
                  {inlineEdit && inlineEdit.id === page.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={inlineEdit.value}
                        onChange={e => setInlineEdit({ id: page.id, value: e.target.value.replace(/[^0-9]/g, '') })}
                        onKeyDown={e => { if (e.key === 'Enter') handleInlineSave(page.id); if (e.key === 'Escape') setInlineEdit(null); }}
                        autoFocus
                        className="w-20 px-2 py-1 text-xs text-right rounded border bg-transparent outline-none"
                        style={{ borderColor: '#fbbf24', color: '#fbbf24' }}
                        placeholder="จำนวน"
                      />
                      <button onClick={() => handleInlineSave(page.id)} className="text-green-400 text-xs font-bold">✓</button>
                    </div>
                  ) : (
                    <div
                      className={onUpdatePage ? 'cursor-pointer hover:opacity-70' : ''}
                      onClick={() => onUpdatePage && setInlineEdit({ id: page.id, value: (page.followers || 0).toString() })}
                      title={onUpdatePage ? 'คลิกเพื่อกรอกผู้ติดตาม' : ''}
                    >
                      <div className="font-bold" style={{ color: page.followers > 0 ? '#60a5fa' : '#fbbf24' }}>
                        {page.followers > 0 ? formatNumber(page.followers) : (
                          <span className="text-[11px] underline decoration-dashed" style={{ color: '#fbbf24' }}>
                            {onUpdatePage ? 'คลิกกรอก' : '-'}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted, #888)' }}>ผู้ติดตาม</div>
                    </div>
                  )}
                </div>
                <div className="w-20">
                  <div className="font-bold" style={{ color: page.engagementRate > 0 ? '#fb923c' : 'var(--text-muted, #555)' }}>
                    {page.engagementRate > 0 ? `${page.engagementRate.toFixed(2)}%` : '-'}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted, #888)' }}>Engagement</div>
                </div>
                <div className="w-20">
                  <div className="font-bold" style={{ color: page.followerGrowth > 0 ? '#4ade80' : 'var(--text-muted, #555)' }}>
                    {page.followerGrowth > 0 ? `+${formatNumber(page.followerGrowth)}` : '-'}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted, #888)' }}>Growth</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== ส่วนล่าง: ตารางอันดับคู่แข่ง ===== */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <span className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>
            📊 อันดับคู่แข่ง — เรียงตาม {sortLabel}
            {selectedCategory !== 'ทั้งหมด' && <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>หมวด: {selectedCategory}</span>}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted, #888)' }}>{sortedCompetitors.length} เพจ</span>
        </div>

        {sortedCompetitors.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm" style={{ backgroundColor: 'var(--bg-card)' }}>
            ยังไม่มีข้อมูลคู่แข่งที่สแกนแล้วในหมวดนี้
          </div>
        ) : (
          <div className="divide-y" style={{ divideColor: 'var(--border-color)' } as any}>
            {sortedCompetitors.map((page, idx) => (
              <PageRow key={page.id} page={page} rank={idx + 1} isOwn={false} showColumns={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
