import React, { useState, useRef } from 'react';
import { FilmIcon, FolderIcon, CogIcon, CheckCircleIcon, ExclamationCircleIcon, PauseIcon, PlayIcon, StopIcon } from '@heroicons/react/24/outline';

interface AudioFile {
  name: string;
  status: 'pending' | 'analyzing' | 'rendering' | 'done' | 'error' | 'paused';
  outputPath?: string;
  errorMessage?: string;
  duration?: number;
  clipsUsed?: number;
}

export function StockClipTab() {
  const [sourceFolder, setSourceFolder] = useState('');
  const [audioFolder, setAudioFolder] = useState('');
  const [outputFolder, setOutputFolder] = useState('');
  const [audioFiles, setAudioFiles] = useState<string[]>([]);
  const [outputClips, setOutputClips] = useState<AudioFile[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [renderLog, setRenderLog] = useState('');
  const abortRef = useRef<(() => void) | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const pickSourceFolder = async () => {
    const res = await fetch('/api/pick-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'เลือกโฟลเดอร์ที่มีคลิปวิดีโอ' }),
    });
    const data = await res.json();
    if (data.success) setSourceFolder(data.dir);
  };

  const pickAudioFolder = async () => {
    const res = await fetch('/api/pick-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'เลือกโฟลเดอร์ที่มีไฟล์เสียง (.wav .mp3 .m4a)' }),
    });
    const data = await res.json();
    if (data.success) {
      setAudioFolder(data.dir);
      // List audio files
      const listRes = await fetch('/api/list-audio-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: data.dir }),
      });
      const listData = await listRes.json();
      setAudioFiles(listData.files || []);
    }
  };

  const pickOutputFolder = async () => {
    const res = await fetch('/api/pick-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'เลือกโฟลเดอร์ปลายทาง' }),
    });
    const data = await res.json();
    if (data.success) setOutputFolder(data.dir);
  };

  const startRender = async () => {
    if (!sourceFolder) return alert('กรุณาเลือกโฟลเดอร์คลิปวิดีโอ');
    if (!audioFolder) return alert('กรุณาเลือกโฟลเดอร์ไฟล์เสียง');
    if (!outputFolder) return alert('กรุณาเลือกโฟลเดอร์ปลายทาง');
    if (audioFiles.length === 0) return alert('ไม่มีไฟล์เสียงในโฟลเดอร์');

    setIsRendering(true);
    setIsPaused(false);
    setProgress(0);
    setRenderLog('');
    setCompletedCount(0);
    setTotalCount(audioFiles.length);

    const clips: AudioFile[] = audioFiles.map((name) => ({
      name,
      status: 'pending' as const,
    }));
    setOutputClips(clips);

    // Create an AbortController for stop
    const controller = new AbortController();
    abortRef.current = () => controller.abort();

    for (let i = 0; i < audioFiles.length; i++) {
      if (controller.signal.aborted) break;

      const updated = [...clips];
      updated[i].status = 'analyzing';
      setOutputClips([...updated]);
      setRenderLog(`กำลังวิเคราะห์ไฟล์: ${audioFiles[i]}`);

      try {
        const res = await fetch('/api/render-stockclip-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceFolder,
            audioFolder,
            outputFolder,
            audioFile: audioFiles[i],
          }),
          signal: controller.signal,
        });

        const reader = res.body?.getReader();
        if (!reader) throw new Error('Stream not supported');

        const decoder = new TextDecoder();
        let done = false;
        let clipResult: AudioFile = { name: audioFiles[i], status: 'error' };

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) {
            const chunkStr = decoder.decode(value, { stream: true });
            const lines = chunkStr.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const d = JSON.parse(line.substring(6));
                  if (d.log) setRenderLog(`${audioFiles[i]}: ${d.log}`);
                  if (d.paused) {
                    setIsPaused(true);
                    clips[i].status = 'paused';
                    setOutputClips([...clips]);
                  }
                  if (d.resumed) {
                    setIsPaused(false);
                    clips[i].status = 'rendering';
                    setOutputClips([...clips]);
                  }
                  if (d.success) {
                    clipResult = {
                      name: audioFiles[i],
                      status: 'done',
                      outputPath: d.filePath,
                      duration: d.duration,
                      clipsUsed: d.clipsUsed,
                    };
                  }
                  if (d.error) {
                    clipResult = {
                      name: audioFiles[i],
                      status: 'error',
                      errorMessage: d.error,
                    };
                  }
                } catch { /* skip */ }
              }
            }
          }
        }

        clips[i] = clipResult;
        if (clipResult.status === 'done') {
          setCompletedCount((c) => c + 1);
        }
      } catch (e: any) {
        if (e.name === 'AbortError') {
          clips[i] = { name: audioFiles[i], status: 'error', errorMessage: 'ถูกหยุดโดยผู้ใช้' };
        } else {
          clips[i] = { name: audioFiles[i], status: 'error', errorMessage: e.message || 'Unknown error' };
        }
      }

      setOutputClips([...clips]);
      setProgress(Math.round(((i + 1) / audioFiles.length) * 100));
    }

    setIsRendering(false);
    setIsPaused(false);
    abortRef.current = null;
    if (!controller.signal.aborted) {
      alert('สร้างคลิป Stock เสร็จสิ้น!');
    }
  };

  const handlePause = async () => {
    try {
      await fetch('/api/stockclip-pause', { method: 'POST' });
    } catch { /* ignore */ }
  };

  const handleResume = async () => {
    try {
      await fetch('/api/stockclip-resume', { method: 'POST' });
    } catch { /* ignore */ }
  };

  const handleStop = async () => {
    try {
      await fetch('/api/stockclip-stop', { method: 'POST' });
    } catch { /* ignore */ }
    if (abortRef.current) abortRef.current();
  };

  const openFolder = async () => {
    try {
      await fetch(`/api/open-folder?type=${encodeURIComponent(outputFolder)}`);
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6 min-h-[500px]">
      {/* Header */}
      <div className="flex justify-between items-center p-6 rounded-3xl border shadow-xl" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <FilmIcon className="w-8 h-8" style={{ color: '#14b8a6' }} />
            ทำคลิปStock
          </h1>
          <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
            สุ่มตัดต่อคลิปจากโฟลเดอร์ต้นทาง อิงตามความยาวไฟล์เสียง พร้อมใส่เสียงลงในคลิป
          </p>
        </div>
      </div>

      {/* Settings */}
      <div className="p-6 rounded-3xl border shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <CogIcon className="w-5 h-5" style={{ color: '#14b8a6' }} />
          ตั้งค่า
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Source Video Folder */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
              โฟลเดอร์คลิปวิดีโอ
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={sourceFolder}
                placeholder="ยังไม่ได้เลือก..."
                className="flex-1 px-4 py-2.5 rounded-xl text-sm border outline-none"
                style={{
                  backgroundColor: 'var(--bg-body)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border-color)',
                }}
              />
              <button
                onClick={pickSourceFolder}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all border"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <FolderIcon className="w-4 h-4" />
                เลือก
              </button>
            </div>
          </div>

          {/* Audio Folder */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
              โฟลเดอร์ไฟล์เสียง
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={audioFolder}
                placeholder="ยังไม่ได้เลือก..."
                className="flex-1 px-4 py-2.5 rounded-xl text-sm border outline-none"
                style={{
                  backgroundColor: 'var(--bg-body)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border-color)',
                }}
              />
              <button
                onClick={pickAudioFolder}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all border"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <FolderIcon className="w-4 h-4" />
                เลือก
              </button>
            </div>
            {audioFiles.length > 0 && (
              <div className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                พบ {audioFiles.length} ไฟล์: {audioFiles.join(', ')}
              </div>
            )}
          </div>

          {/* Output Folder */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
              โฟลเดอร์ปลายทาง
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={outputFolder}
                placeholder="ยังไม่ได้เลือก..."
                className="flex-1 px-4 py-2.5 rounded-xl text-sm border outline-none"
                style={{
                  backgroundColor: 'var(--bg-body)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border-color)',
                }}
              />
              <button
                onClick={pickOutputFolder}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all border"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <FolderIcon className="w-4 h-4" />
                เลือก
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-3 flex-wrap">
        {!isRendering ? (
          <button
            onClick={startRender}
            disabled={!sourceFolder || !audioFolder || !outputFolder || audioFiles.length === 0}
            className="px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg"
            style={{
              backgroundColor: '#14b8a6',
              color: 'white',
            }}
          >
            <CogIcon className="w-5 h-5" />
            🎬 สร้างทุกคลิป ({audioFiles.length} ไฟล์)
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold" style={{ backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }}>
              <span>{progress}%</span>
              {renderLog && <span className="text-xs opacity-75 ml-2">{renderLog}</span>}
            </div>

            {!isPaused ? (
              <button
                onClick={handlePause}
                className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
                style={{ backgroundColor: '#f59e0b', color: 'white' }}
              >
                <PauseIcon className="w-5 h-5" />
                พัก
              </button>
            ) : (
              <button
                onClick={handleResume}
                className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
                style={{ backgroundColor: '#10b981', color: 'white' }}
              >
                <PlayIcon className="w-5 h-5" />
                ต่อ
              </button>
            )}

            <button
              onClick={handleStop}
              className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
              style={{ backgroundColor: '#ef4444', color: 'white' }}
            >
              <StopIcon className="w-5 h-5" />
              หยุด
            </button>
          </>
        )}

        {!isRendering && outputClips.some((c) => c.status === 'done') && outputFolder && (
          <button
            onClick={openFolder}
            className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <FolderIcon className="w-5 h-5" />
            เปิดโฟลเดอร์ปลายทาง
          </button>
        )}
      </div>

      {/* Output Results */}
      {outputClips.length > 0 && (
        <div className="p-6 rounded-3xl border shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            ผลลัพธ์ ({completedCount}/{totalCount})
          </h2>
          <div className="space-y-3">
            {outputClips.map((clip, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border"
                style={{
                  backgroundColor: 'var(--bg-body)',
                  borderColor:
                    clip.status === 'done'
                      ? 'rgba(20, 184, 166, 0.3)'
                      : clip.status === 'error'
                      ? 'rgba(239, 68, 68, 0.3)'
                      : clip.status === 'rendering' || clip.status === 'analyzing'
                      ? 'rgba(234, 179, 8, 0.3)'
                      : clip.status === 'paused'
                      ? 'rgba(245, 158, 11, 0.3)'
                      : 'var(--border-color)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {clip.name}
                    </span>
                    {clip.status === 'pending' && (
                      <span className="text-xs px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
                        รอคิว
                      </span>
                    )}
                    {clip.status === 'analyzing' && (
                      <span className="text-xs px-2 py-1 rounded font-semibold whitespace-nowrap" style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)', color: '#a855f7' }}>
                        กำลังวิเคราะห์...
                      </span>
                    )}
                    {clip.status === 'rendering' && (
                      <span className="text-xs px-2 py-1 rounded font-semibold whitespace-nowrap" style={{ backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#eab308' }}>
                        กำลังสร้าง...
                      </span>
                    )}
                    {clip.status === 'paused' && (
                      <span className="text-xs px-2 py-1 rounded font-semibold whitespace-nowrap" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
                        ⏸️ พักไว้
                      </span>
                    )}
                    {clip.status === 'done' && (
                      <span className="text-xs px-2 py-1 rounded font-semibold flex items-center gap-1 whitespace-nowrap" style={{ backgroundColor: 'rgba(20, 184, 166, 0.2)', color: '#14b8a6' }}>
                        <CheckCircleIcon className="w-3 h-3" /> เสร็จ
                      </span>
                    )}
                    {clip.status === 'error' && (
                      <span className="text-xs px-2 py-1 rounded font-semibold flex items-center gap-1 whitespace-nowrap" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                        <ExclamationCircleIcon className="w-3 h-3" /> ผิดพลาด
                      </span>
                    )}
                  </div>
                  {clip.duration && (
                    <span className="text-xs ml-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {clip.duration.toFixed(1)}วินาที | {clip.clipsUsed ?? 0}คลิป
                    </span>
                  )}
                </div>
                {clip.errorMessage && (
                  <div className="mt-2 text-xs font-mono whitespace-pre-wrap" style={{ color: '#ef4444' }}>
                    {clip.errorMessage}
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
