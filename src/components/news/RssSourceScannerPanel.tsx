import React from 'react';
import { Card } from '../ui/Card';

interface SiteInfo {
  cat: string;
  name: string;
  url: string;
  rss?: string;
}

interface ScrapedTodayItem {
  url: string;
  time: string;
  name: string;
}

export function RssSourceScannerPanel({
  sites,
  scrapedToday,
  selectedSites,
  url,
  setUrl,
  isScraping,
  toggleSiteSelect,
  handleScrape,
}: {
  sites: SiteInfo[];
  scrapedToday: ScrapedTodayItem[];
  selectedSites: Set<string>;
  url: string;
  setUrl: (url: string) => void;
  isScraping: boolean;
  toggleSiteSelect: (siteUrl: string) => void;
  handleScrape: () => void;
}) {
  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span>📅</span> แหล่งข่าวที่ดูดแล้ววันนี้
          </h3>
          <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">{new Date().toLocaleDateString('th-TH')}</span>
        </div>

        {scrapedToday.length === 0 ? (
          <div className="text-sm text-gray-500">
            ยังไม่มีการดูดข่าวในวันนี้
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
            {scrapedToday.map((item, idx) => (
              <a
                key={idx}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-[220px] max-w-[280px] rounded-lg border border-gray-200 bg-gray-50 p-3 transition-colors hover:border-blue-400 dark:border-gray-700 dark:bg-gray-800/50"
                title={item.url}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-bold text-blue-600 dark:text-blue-400">{item.name}</span>
                  <span className="shrink-0 text-[10px] text-gray-500">{item.time}</span>
                </div>
                <div className="mt-1 truncate text-[10px] text-gray-400">{item.url}</div>
              </a>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">🗞️</span> ดูดข่าว RSS เข้าคลัง Content
          </h2>
        </div>

        <div className="mb-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">📚 แหล่งข่าวแนะนำ (จิ้มเพื่อดูด)</h3>
          <div className="flex flex-wrap gap-2">
            {sites.map((site, i) => {
              const isSelected = selectedSites.has(site.url);
              return (
                <button
                  key={i}
                  onClick={() => toggleSiteSelect(site.url)}
                  className={`px-3 py-1.5 text-xs font-medium border rounded-lg shadow-sm transition-all flex items-center gap-1 ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:text-blue-600'
                  }`}
                  title={site.cat}
                >
                  {isSelected && <span className="text-xs">✓</span>}
                  {site.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="วางลิงก์หน้าเว็บอื่น หรือเลือกจากแหล่งข่าวด้านบน (เลือกหลายแหล่งได้)"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              onClick={handleScrape}
              disabled={isScraping}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-lg shadow transition-all"
            >
              {isScraping ? 'กำลังดูด...' : '🔍 สแกนหาข่าว'}
            </button>
          </div>
        </div>
      </Card>
    </>
  );
}
