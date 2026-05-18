import React from 'react';

type RssSortBy = 'default' | 'newsScore' | 'evergreenScore';

export function RssResultsHeader({
  total,
  sourceCounts,
  sortBy,
  setSortBy,
  isTranslating,
  handleTranslateTitles,
}: {
  total: number;
  sourceCounts: { name: string; count: number }[];
  sortBy: RssSortBy;
  setSortBy: (sortBy: RssSortBy) => void;
  isTranslating: boolean;
  handleTranslateTitles: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-between items-center px-1 gap-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-gray-700 dark:text-gray-300 text-lg">พบ {total} ข่าว</h3>
          {sourceCounts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {sourceCounts.map((sc, i) => (
                <span key={i} className="text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {sc.name}: {sc.count}
                </span>
              ))}
            </div>
          )}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as RssSortBy)}
          className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm font-medium"
        >
          <option value="default">จัดเรียง: ตามที่ดึงมา</option>
          <option value="newsScore">🔥 เรียงตาม คะแนนข่าว</option>
          <option value="evergreenScore">🌿 เรียงตาม คะแนน Evergreen</option>
        </select>
      </div>
      <button
        onClick={handleTranslateTitles}
        disabled={isTranslating}
        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow transition-all flex items-center gap-2"
      >
        {isTranslating ? 'กำลังแปล...' : '🇹🇭 แปลหัวข้อเป็นไทย & ให้คะแนน'}
      </button>
    </div>
  );
}
