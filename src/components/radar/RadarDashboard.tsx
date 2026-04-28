import React, { useMemo } from 'react';
import { CompetitorPage } from '../../interfaces/radar';

interface RadarDashboardProps {
  pages: CompetitorPage[];
}

export function RadarDashboard({ pages }: RadarDashboardProps) {
  const activePages = pages.filter(p => p.status === 'active' && p.followers > 0);

  // Default values if no active pages
  const defaultMetrics = {
    topEngagement: null,
    topGrowth: null,
    deadCount: pages.filter(p => p.status === 'dead').length,
    sweetSpot: '-',
    bestTime: '-',
    topTags: [] as string[]
  };

  const metrics = useMemo(() => {
    if (activePages.length === 0) return defaultMetrics;

    // 1. Top Engagement Rate
    const topEng = [...activePages].sort((a, b) => b.engagementRate - a.engagementRate)[0];

    // 2. Fastest Growth
    const topGrowth = [...activePages].sort((a, b) => b.followerGrowth - a.followerGrowth)[0];

    // 3. Hashtag Cloud (Aggregate and count)
    const tagCounts: Record<string, number> = {};
    activePages.forEach(p => {
      p.topHashtags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const sortedTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(entry => entry[0]);

    // 4. Video Sweet Spot (Most frequent)
    const sweetSpots = activePages.map(p => p.videoSweetSpot).filter(s => s && s !== '-');
    let bestSweetSpot = '-';
    if (sweetSpots.length > 0) {
      const spCounts = sweetSpots.reduce((acc, val) => { acc[val] = (acc[val] || 0) + 1; return acc; }, {} as Record<string, number>);
      bestSweetSpot = Object.keys(spCounts).reduce((a, b) => spCounts[a] > spCounts[b] ? a : b);
    }

    // 5. Best Time (Most frequent)
    const bestTimes = activePages.map(p => p.bestTimeToPost).filter(t => t && t !== '-');
    let bestOverallTime = '-';
    if (bestTimes.length > 0) {
       const timeCounts = bestTimes.reduce((acc, val) => { acc[val] = (acc[val] || 0) + 1; return acc; }, {} as Record<string, number>);
       bestOverallTime = Object.keys(timeCounts).reduce((a, b) => timeCounts[a] > timeCounts[b] ? a : b);
    }

    return {
      topEngagement: topEng,
      topGrowth: topGrowth,
      deadCount: defaultMetrics.deadCount,
      sweetSpot: bestSweetSpot,
      bestTime: bestOverallTime,
      topTags: sortedTags
    };
  }, [activePages, defaultMetrics.deadCount]);

  if (pages.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 border border-dashed rounded-xl mb-6">
        <p>ยังไม่มีข้อมูลคู่แข่งในระบบ โปรดเพิ่มลิงก์เพจและกดสแกน</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Metric 1: Top Engagement */}
      <div className="p-5 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <h3 className="text-sm font-medium text-gray-500 mb-1">🔥 Top Engagement</h3>
        {metrics.topEngagement ? (
          <div>
            <div className="text-2xl font-bold text-orange-500">{metrics.topEngagement.engagementRate.toFixed(2)}%</div>
            <div className="text-xs text-gray-400 mt-1 truncate" title={metrics.topEngagement.name}>
              จากเพจ: {metrics.topEngagement.name}
            </div>
          </div>
        ) : (
          <div className="text-xl font-bold">-</div>
        )}
      </div>

      {/* Metric 2: Top Growth */}
      <div className="p-5 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <h3 className="text-sm font-medium text-gray-500 mb-1">🚀 เติบโตเร็วสุด (7 วัน)</h3>
        {metrics.topGrowth ? (
          <div>
            <div className="text-2xl font-bold text-green-500">+{metrics.topGrowth.followerGrowth.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1 truncate" title={metrics.topGrowth.name}>
              จากเพจ: {metrics.topGrowth.name}
            </div>
          </div>
        ) : (
          <div className="text-xl font-bold">-</div>
        )}
      </div>

      {/* Metric 3: Best Time to Post */}
      <div className="p-5 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <h3 className="text-sm font-medium text-gray-500 mb-1">⏱️ เวลาทองคำ</h3>
        <div className="text-xl font-bold text-blue-500">{metrics.bestTime}</div>
        <div className="text-xs text-gray-400 mt-1">เวลาที่มีโอกาสคนดูมากสุด</div>
      </div>

      {/* Metric 4: Keyword & Hashtag Cloud */}
      <div className="md:col-span-2 p-5 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <h3 className="text-sm font-medium text-gray-500 mb-3">💬 แฮชแท็กมาแรง (Keyword Cloud)</h3>
        <div className="flex flex-wrap gap-2">
          {metrics.topTags.length > 0 ? metrics.topTags.map((tag, idx) => (
            <span key={idx} className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' }}>
              {tag}
            </span>
          )) : (
            <span className="text-gray-400 text-sm">ไม่มีแฮชแท็ก</span>
          )}
        </div>
      </div>

      {/* Metric 5: Insight Combo */}
      <div className="p-5 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div>
           <h3 className="text-sm font-medium text-gray-500 mb-1">🎥 ความยาวคลิปสุดปัง</h3>
           <div className="text-xl font-bold text-indigo-500">{metrics.sweetSpot}</div>
        </div>
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
           <h3 className="text-sm font-medium text-gray-500 mb-1">💀 เพจหมดไฟ (ผี)</h3>
           <div className="text-lg font-bold text-red-500">{metrics.deadCount} <span className="text-xs text-gray-400 font-normal">เพจ</span></div>
        </div>
      </div>
    </div>
  );
}
