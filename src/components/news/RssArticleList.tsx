import React from 'react';

interface RssArticleItem {
  id: string;
  title: string;
  url: string;
  domain: string;
  thaiTitle?: string;
  score?: number;
  evergreenScore?: number;
  tags?: string[];
  rawText?: string;
}

export function RssArticleList({
  articles,
  selectedIds,
  processingId,
  toggleSelect,
  handleProcessArticle,
}: {
  articles: RssArticleItem[];
  selectedIds: Set<string>;
  processingId: string | null;
  toggleSelect: (id: string) => void;
  handleProcessArticle: (article: RssArticleItem) => void;
}) {
  if (articles.length === 0) return null;

  return (
    <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
      {articles.map((article, i) => (
        <div key={article.id} className={`bg-white dark:bg-gray-800 p-4 rounded-xl border transition-all flex flex-col md:flex-row gap-4 items-start md:items-center justify-between ${selectedIds.has(article.id) ? 'border-cyan-500 dark:border-cyan-500 bg-cyan-50/50 dark:bg-cyan-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-400'}`}>
          <label className="cursor-pointer flex-shrink-0 mt-1">
            <input type="checkbox" checked={selectedIds.has(article.id)} onChange={() => toggleSelect(article.id)} className="w-5 h-5 text-cyan-500 bg-gray-700 border-gray-600 rounded cursor-pointer" />
          </label>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs text-gray-500 font-bold">{i + 1}. {article.domain}</span>
              {article.score !== undefined && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  article.score >= 8 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                  article.score >= 5 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  🔥 ข่าว: {article.score}/10
                </span>
              )}
              {article.evergreenScore !== undefined && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  article.evergreenScore >= 8 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  article.evergreenScore >= 5 ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' :
                  'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  🌿 Evergreen: {article.evergreenScore}/10
                </span>
              )}
              {article.tags && article.tags.length > 0 && article.tags.map((tag, ti) => (
                <span key={ti} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-medium">#{tag}</span>
              ))}
            </div>

            {article.thaiTitle ? (
              <>
                <h3 className="text-[16px] font-bold text-gray-800 dark:text-gray-100 mb-1 leading-snug">
                  {article.thaiTitle}
                </h3>
                <p className="text-[12px] text-gray-500 mb-2 truncate max-w-xl">{article.title}</p>
              </>
            ) : (
              <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100 mb-2 leading-snug">
                {article.title}
              </h3>
            )}

            <a href={article.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline break-all">
              {article.url}
            </a>
          </div>

          <button
            onClick={() => handleProcessArticle(article)}
            disabled={processingId !== null}
            className={`min-w-[120px] px-4 py-2 rounded-lg font-bold text-sm shadow flex items-center justify-center transition-all ${
              processingId === article.id
                ? 'bg-amber-500 text-white animate-pulse cursor-not-allowed'
                : processingId !== null
                  ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 border cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {processingId === article.id ? 'กำลังปั่นข่าว ⚙️' : '⚙️ ปั่นเข้า Bulk เก่า'}
          </button>
        </div>
      ))}
    </div>
  );
}
