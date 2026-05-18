import React from 'react';
import { Card } from '../ui/Card';
import { NumInput } from '../ui/NumInput';
import { YtQueueItem } from '../../hooks/useYtQueueStore';

type YoutubeExtractResult = NonNullable<YtQueueItem['result']>;

interface YoutubeExtractQueuePanelProps {
  ytUrl: string;
  setYtUrl: (url: string) => void;
  isYtLoading: boolean;
  ytError: string;
  frameCount: number;
  setFrameCount: (count: number) => void;
  handleYoutubeExtract: () => void;
  items: YtQueueItem[];
  isRunning: boolean;
  isPaused: boolean;
  selectedIds: Set<string>;
  expandedQueueId: string | null;
  setExpandedQueueId: (id: string | null) => void;
  isBatchSaving: boolean;
  selectAllQueue: () => void;
  deselectAllQueue: () => void;
  clearCompletedQueue: () => void;
  toggleQueueSelect: (id: string) => void;
  removeQueueItem: (id: string) => void;
  handleProcessSelected: () => void;
  handleProcessAll: () => void;
  handleProcessAllAndSave: () => void;
  requestPause: () => void;
  requestStop: () => void;
  resume: () => void;
  handleBatchSaveToStock: () => void;
  addCurrentUrlToQueue: () => void;
  ytResult: YoutubeExtractResult | null;
  ytSelectedImages: Set<string>;
  isSavingYt: boolean;
  handleSaveYtToStock: () => void;
  selectAllYtImages: () => void;
  deselectAllYtImages: () => void;
  toggleYtImage: (url: string) => void;
}

export function YoutubeExtractQueuePanel({
  ytUrl,
  setYtUrl,
  isYtLoading,
  ytError,
  frameCount,
  setFrameCount,
  handleYoutubeExtract,
  items,
  isRunning,
  isPaused,
  selectedIds,
  expandedQueueId,
  setExpandedQueueId,
  isBatchSaving,
  selectAllQueue,
  deselectAllQueue,
  clearCompletedQueue,
  toggleQueueSelect,
  removeQueueItem,
  handleProcessSelected,
  handleProcessAll,
  handleProcessAllAndSave,
  requestPause,
  requestStop,
  resume,
  handleBatchSaveToStock,
  addCurrentUrlToQueue,
  ytResult,
  ytSelectedImages,
  isSavingYt,
  handleSaveYtToStock,
  selectAllYtImages,
  deselectAllYtImages,
  toggleYtImage,
}: YoutubeExtractQueuePanelProps) {
  const completedCount = items.filter(q => q.status === 'completed').length;
  const pendingCount = items.filter(q => q.status !== 'completed').length;
  const hasCompletedItems = items.some(q => q.status === 'completed');
  const canAddSingleUrl = ytUrl.trim() && !items.some(q => q.url === ytUrl.trim());

  return (
    <>
      <Card>
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <span className="text-2xl">🎬</span> ดึง Script + แคปรูปจาก YouTube
        </h2>
        <p className="text-xs text-gray-400 mb-4">วาง URL คลิป YouTube แล้วระบบจะดึง Script (คำบรรยาย) และแคปรูปภาพสุ่มกระจายตลอดคลิป — ฟรี ไม่มีค่า API</p>

        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={ytUrl}
            onChange={e => setYtUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleYoutubeExtract()}
            placeholder="https://www.youtube.com/watch?v=..."
            className="input-field flex-1 min-w-[200px] text-sm"
          />
          <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700 rounded-lg px-3">
            <label className="text-xs text-gray-400 whitespace-nowrap">🖼️ จำนวนรูป</label>
            <NumInput
              min={1} max={30}
              value={frameCount}
              onChange={setFrameCount}
              className="w-14 bg-transparent text-sm font-bold text-white text-center outline-none"
            />
          </div>
          <button
            onClick={handleYoutubeExtract}
            disabled={isYtLoading || !ytUrl.trim()}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap"
          >
            {isYtLoading ? '⏳ กำลังดึง...' : '🚀 ดึง Script + รูปภาพ'}
          </button>
        </div>

        {isYtLoading && (
          <div className="mt-4 p-4 bg-black/30 rounded-lg border border-gray-700 text-sm text-gray-400 animate-pulse">
            ⏳ กำลังดึง transcript และแคปรูปจากคลิป... อาจใช้เวลา 1-2 นาที
          </div>
        )}

        {ytError && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            ❌ {ytError}
          </div>
        )}
      </Card>

      {items.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-gray-200 flex items-center gap-2">
              📋 คิวดึง YouTube
              <span className="text-[10px] font-normal bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">
                {completedCount}/{items.length} เสร็จ
              </span>
              {isRunning && (
                <span className="text-[10px] font-normal bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 animate-pulse">
                  กำลังทำงาน...
                </span>
              )}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={selectAllQueue} className="text-[10px] px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all">☑ เลือกทั้งหมด</button>
              <button onClick={deselectAllQueue} className="text-[10px] px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all">☐ ยกเลิก</button>
              {hasCompletedItems && (
                <button onClick={clearCompletedQueue} className="text-[10px] px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all">🧹 ล้างที่เสร็จแล้ว</button>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar mb-4">
            {items.map((item, idx) => {
              const isSelected = selectedIds.has(item.id);
              const isExpanded = expandedQueueId === item.id;
              const statusIcon = item.status === 'completed' ? '✅' : item.status === 'running' ? '🔄' : item.status === 'error' ? '❌' : '⏳';
              const statusColor = item.status === 'completed' ? 'border-green-500/30 bg-green-900/10' : item.status === 'running' ? 'border-amber-500/30 bg-amber-900/10 animate-pulse' : item.status === 'error' ? 'border-red-500/30 bg-red-900/10' : 'border-gray-700/50';
              const resultShots = Array.isArray(item.result?.screenshotUrls) ? item.result.screenshotUrls : [];
              const resultTranscript = String(item.result?.transcript || '');
              return (
                <div key={item.id} className={`rounded-lg border p-3 transition-all ${statusColor}`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleQueueSelect(item.id)}
                      className="w-4 h-4 accent-cyan-500 cursor-pointer flex-shrink-0"
                      disabled={isRunning}
                    />
                    <span className="text-sm flex-shrink-0">{statusIcon}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0 w-5">{idx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-200 truncate font-medium">
                        {item.result?.videoTitle || item.url}
                      </p>
                      {item.result?.videoTitle && (
                        <p className="text-[10px] text-gray-500 truncate">{item.url}</p>
                      )}
                      {item.error && (
                        <p className="text-[10px] text-red-400 mt-0.5">❌ {item.error}</p>
                      )}
                      {item.result && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">📝 {resultTranscript.length.toLocaleString()} ตัวอักษร</span>
                          <span className="text-[9px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">🖼️ {resultShots.length} รูป</span>
                          {item.result.channelName && <span className="text-[9px] text-gray-400">📺 {item.result.channelName}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {item.result && (
                        <button
                          onClick={() => setExpandedQueueId(isExpanded ? null : item.id)}
                          className="text-[10px] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-all"
                        >
                          {isExpanded ? '▲ ซ่อน' : '▼ ดู'}
                        </button>
                      )}
                      {!isRunning && (
                        <button
                          onClick={() => removeQueueItem(item.id)}
                          className="text-red-500 text-xs px-1.5 py-0.5 hover:bg-red-500/10 rounded transition-all"
                        >✕</button>
                      )}
                    </div>
                  </div>

                  {isExpanded && item.result && (
                    <div className="mt-3 space-y-2 border-t border-gray-700/30 pt-3">
                      {resultTranscript && (
                        <div className="bg-black/30 rounded-lg border border-gray-700/50 p-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                          <pre className="text-[10px] text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">{resultTranscript.substring(0, 2000)}{resultTranscript.length > 2000 ? '...' : ''}</pre>
                        </div>
                      )}
                      {resultShots.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                          {resultShots.slice(0, 8).map((img, ii) => (
                            <a key={ii} href={img} target="_blank" rel="noreferrer">
                              <img src={img} alt={`frame ${ii + 1}`} className="h-12 w-20 object-cover rounded border border-gray-700/50 hover:border-cyan-500 transition-all" />
                            </a>
                          ))}
                          {resultShots.length > 8 && (
                            <div className="h-12 w-12 rounded border border-gray-700/50 bg-black/40 flex items-center justify-center text-[10px] text-gray-400">
                              +{resultShots.length - 8}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-gray-700/30 pt-3">
            {!isRunning && !isPaused && (
              <>
                <button
                  onClick={handleProcessSelected}
                  disabled={selectedIds.size === 0}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                >
                  🚀 ดึง {selectedIds.size} คลิปที่เลือก
                </button>
                <button
                  onClick={handleProcessAll}
                  disabled={items.every(q => q.status === 'completed')}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                >
                  🚀 ดึงทั้งหมด {pendingCount} คลิป
                </button>
                <button
                  onClick={handleProcessAllAndSave}
                  disabled={isBatchSaving || items.every(q => q.status === 'completed')}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  🎬 ดึง Script+รูป {pendingCount} คลิป แล้วบันทึกเข้าคลัง
                </button>
              </>
            )}

            {isRunning && (
              <>
                <button
                  onClick={requestPause}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                >
                  ⏸️ พักการทำงาน
                </button>
                <button
                  onClick={requestStop}
                  className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                >
                  ⛔ หยุดทั้งหมด
                </button>
                <span className="text-xs text-gray-400 flex items-center animate-pulse">⏳ กำลังดึง...</span>
              </>
            )}

            {isPaused && !isRunning && (
              <>
                <button
                  onClick={resume}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-green-500/20"
                >
                  ▶️ ทำต่อ ({items.filter(q => q.status === 'pending').length} คลิปที่เหลือ)
                </button>
                <button
                  onClick={requestStop}
                  className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                >
                  ⛔ หยุดเลย
                </button>
                <span className="text-xs text-amber-400 flex items-center">⏸️ พักอยู่</span>
              </>
            )}

            {hasCompletedItems && (
              <button
                onClick={handleBatchSaveToStock}
                disabled={isBatchSaving}
                className="ml-auto px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
              >
                {isBatchSaving ? '⏳ กำลังบันทึก...' : `📦 บันทึก ${completedCount} คลิปเข้าคลัง`}
              </button>
            )}
          </div>
        </Card>
      )}

      {canAddSingleUrl && (
        <div className="flex justify-end -mt-2">
          <button
            onClick={addCurrentUrlToQueue}
            className="text-[10px] px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all"
          >
            ➕ เพิ่มเข้าคิวแทน
          </button>
        </div>
      )}

      {ytResult && (
        <>
          <Card>
            <div className="flex items-start gap-4">
              {ytResult.channelAvatar && (
                <img src={ytResult.channelAvatar} alt="thumbnail" className="w-32 h-20 object-cover rounded-lg flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-100 text-base leading-snug mb-1">{ytResult.videoTitle}</h3>
                <p className="text-sm text-gray-400">📺 {ytResult.channelName}</p>
                <p className={`text-xs ${ytResult.channelLogoUrl ? 'text-emerald-400' : 'text-amber-400'}`}>
                  โลโก้ช่อง: {ytResult.channelLogoUrl ? 'ดึงได้แล้ว' : 'ยังไม่ได้จาก yt-dlp'}
                </p>
                {typeof ytResult.subscriberCount === 'number' && (
                  <p className="text-xs text-gray-500">ผู้ติดตาม: {ytResult.subscriberCount.toLocaleString()}</p>
                )}
                <a href={ytUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline break-all mt-1 block">{ytUrl}</a>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-200 flex items-center gap-2">📝 Script / คำบรรยาย
                <span className="text-[10px] font-normal text-gray-500">({ytResult.transcript.length.toLocaleString()} ตัวอักษร)</span>
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(ytResult.transcript); }}
                  className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-all"
                >
                  📋 คัดลอก
                </button>
                <button
                  onClick={handleSaveYtToStock}
                  disabled={isSavingYt}
                  className="text-xs px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-bold rounded-lg transition-all"
                >
                  {isSavingYt ? '⏳...' : `📦 เก็บเข้าคลัง${ytSelectedImages.size > 0 ? ` + ${ytSelectedImages.size} รูป` : ''}`}
                </button>
              </div>
            </div>
            {ytResult.transcript ? (
              <div className="bg-black/30 rounded-lg border border-gray-700/50 p-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{ytResult.transcript}</pre>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">⚠️ ดึง Script ไม่ได้ — คลิปนี้อาจไม่มี subtitle หรือปิดการเข้าถึง</p>
            )}
          </Card>

          {ytResult.screenshotUrls.length > 0 && (
            <Card>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h3 className="font-bold text-gray-200 flex items-center gap-2">
                  🖼️ รูปภาพจากคลิป
                  <span className="text-[10px] font-normal text-gray-500">({ytResult.screenshotUrls.length} รูป)</span>
                </h3>
                <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                  เลือก {ytSelectedImages.size}/{ytResult.screenshotUrls.length} รูป
                </span>
                <div className="flex gap-1.5 ml-auto">
                  <button onClick={selectAllYtImages} className="text-[10px] px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all">☑ เลือกทั้งหมด</button>
                  <button onClick={deselectAllYtImages} className="text-[10px] px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all">☐ ยกเลิก</button>
                  <button
                    onClick={handleYoutubeExtract}
                    disabled={isYtLoading}
                    className="text-[10px] px-2.5 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-lg transition-all"
                  >
                    🔀 สุ่มรูปใหม่
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {ytResult.screenshotUrls.map((imgUrl, i) => {
                  const isSelected = ytSelectedImages.has(imgUrl);
                  return (
                    <div
                      key={i}
                      onClick={() => toggleYtImage(imgUrl)}
                      className={`group relative aspect-video overflow-hidden rounded-lg border-2 cursor-pointer transition-all ${isSelected ? 'border-cyan-400 shadow-lg shadow-cyan-500/20' : 'border-gray-700/50 hover:border-gray-500'}`}
                    >
                      <img src={imgUrl} alt={`frame ${i + 1}`} className="w-full h-full object-cover" />
                      <div className={`absolute inset-0 transition-all ${isSelected ? 'bg-cyan-500/10' : 'bg-transparent group-hover:bg-white/5'}`} />
                      <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-cyan-500 border-cyan-400' : 'bg-black/50 border-gray-500'}`}>
                        {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
                      </div>
                      <span className="absolute bottom-1 right-1 text-[9px] bg-black/70 text-white px-1 py-0.5 rounded">#{i + 1}</span>
                      <a
                        href={imgUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="absolute top-1.5 right-1.5 text-[9px] bg-black/60 hover:bg-black/80 text-white px-1.5 py-0.5 rounded transition-all opacity-0 group-hover:opacity-100"
                      >
                        🔗
                      </a>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
