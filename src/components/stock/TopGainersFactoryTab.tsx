import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ChartBarSquareIcon,
  ClipboardDocumentIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  LinkIcon,
  PlayIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { getActiveGiphyKey } from '../../hooks/useApiSettings';

type RunMode = 'gainers' | 'losers' | 'low_pe' | 'trending';
type MemeSource = 'local' | 'giphy';
type ImageRatio = 'default' | 'square';
type HeadlineTheme =
  | 'classic'
  | 'emerald_gold'
  | 'orange_teal'
  | 'purple_lime'
  | 'rose_cyan'
  | 'amber_indigo'
  | 'magenta_mint'
  | 'graphite_gold'
  | 'navy_coral'
  | 'white_hot';

const MODE_OPTIONS: { value: RunMode; label: string; desc: string }[] = [
  { value: 'gainers',  label: '📈 ราคาพุ่ง',    desc: 'Top Day Gainers' },
  { value: 'losers',   label: '📉 ราคาลด',      desc: 'Top Day Losers' },
  { value: 'low_pe',   label: '💎 P/E ต่ำ',     desc: 'Undervalued Large Caps' },
  { value: 'trending', label: '🔥 น่าจับตา',    desc: 'Most Active + News' },
];

interface TopGainersResult {
  date: string;
  symbol: string;
  caption: string;
  imageUrl: string;
  configRef: string;
  localImagePath: string;
  previewUrl: string;
}

interface TopGainersPayload {
  date: string;
  outputDir: string;
  csvPath: string;
  configP2: string;
  rows: TopGainersResult[];
}

const DEFAULT_P2 = 'sector: Technology';
const DEFAULT_DROPBOX = '/Stock_Gainers_Content';
const CUSTOM_P2_VALUE = '__custom__';
const EXPORT_FOLDER_STORAGE_KEY = 'topGainers.exportFolder';
const PAGE_CREDIT_STORAGE_KEY = 'topGainers.pageCredit';
const GIPHY_KEY_STORAGE_KEY = 'topGainers.giphyKey';
const MEME_SOURCE_STORAGE_KEY = 'topGainers.memeSource';
const LOCAL_MEME_PATH_STORAGE_KEY = 'topGainers.localMemePath';
const IMAGE_RATIO_STORAGE_KEY = 'topGainers.imageRatio';
const HEADLINE_THEME_STORAGE_KEY = 'topGainers.headlineTheme';
const P2_PRESETS = [
  { label: 'ทั้งตลาด / ทุกอุตสาหกรรม', value: 'market: all' },
  { label: 'Technology', value: 'sector: Technology' },
  { label: 'Healthcare', value: 'sector: Healthcare' },
  { label: 'Financial Services', value: 'sector: Financial Services' },
  { label: 'Consumer Cyclical', value: 'sector: Consumer Cyclical' },
  { label: 'Communication Services', value: 'sector: Communication Services' },
  { label: 'Industrials', value: 'sector: Industrials' },
  { label: 'Energy', value: 'sector: Energy' },
  { label: 'Basic Materials', value: 'sector: Basic Materials' },
  { label: 'Real Estate', value: 'sector: Real Estate' },
  { label: 'Utilities', value: 'sector: Utilities' },
  { label: 'Watchlist: AI Chips', value: 'symbols: NVDA, AMD, AVGO, ARM, MRVL' },
  { label: 'Watchlist: Quantum', value: 'symbols: IONQ, RGTI, QBTS, QUBT' },
  { label: 'Watchlist: EV & Energy', value: 'symbols: TSLA, RIVN, LCID, ENPH, FSLR' },
];

const HEADLINE_THEME_OPTIONS: Array<{
  value: HeadlineTheme;
  label: string;
  desc: string;
  colors: [string, string, string];
}> = [
  { value: 'classic', label: 'Classic', desc: 'Red / Blue / Yellow', colors: ['#e11d1d', '#fff200', '#1688f0'] },
  { value: 'emerald_gold', label: 'Emerald', desc: 'Green / Gold / Teal', colors: ['#059669', '#facc15', '#0f766e'] },
  { value: 'orange_teal', label: 'Orange Teal', desc: 'Orange / Yellow / Cyan', colors: ['#f97316', '#fde047', '#0891b2'] },
  { value: 'purple_lime', label: 'Purple Lime', desc: 'Purple / Lime / Indigo', colors: ['#7c3aed', '#bef264', '#4f46e5'] },
  { value: 'rose_cyan', label: 'Rose Cyan', desc: 'Rose / Cyan / Deep Cyan', colors: ['#e11d48', '#22d3ee', '#0e7490'] },
  { value: 'amber_indigo', label: 'Amber Indigo', desc: 'Amber / Cream / Indigo', colors: ['#d97706', '#fef08a', '#4f46e5'] },
  { value: 'magenta_mint', label: 'Magenta Mint', desc: 'Pink / Mint / Green', colors: ['#db2777', '#a7f3d0', '#10b981'] },
  { value: 'graphite_gold', label: 'Graphite', desc: 'Slate / Gold / Bronze', colors: ['#374151', '#fbbf24', '#92400e'] },
  { value: 'navy_coral', label: 'Navy Coral', desc: 'Navy / Coral / Ink', colors: ['#1d4ed8', '#fb7185', '#0f172a'] },
  { value: 'white_hot', label: 'White Hot', desc: 'White / Orange / Yellow', colors: ['#f8fafc', '#fb923c', '#facc15'] },
];

export function TopGainersFactoryTab() {
  const [p2, setP2] = useState(DEFAULT_P2);
  const [limit, setLimit] = useState<number | string>(5);
  const [scanCount, setScanCount] = useState(150);
  const [dropboxFolder, setDropboxFolder] = useState(DEFAULT_DROPBOX);
  const [skipDropbox, setSkipDropbox] = useState(false);
  const [mode, setMode] = useState<RunMode>('gainers');
  const [canvasStyle, setCanvasStyle] = useState('viral');
  const [imageRatio, setImageRatio] = useState<ImageRatio>(() => {
    try {
      return localStorage.getItem(IMAGE_RATIO_STORAGE_KEY) === 'square' ? 'square' : 'default';
    } catch {
      return 'default';
    }
  });
  const [headlineTheme, setHeadlineTheme] = useState<HeadlineTheme>(() => {
    try {
      const saved = localStorage.getItem(HEADLINE_THEME_STORAGE_KEY) as HeadlineTheme | null;
      return HEADLINE_THEME_OPTIONS.some(option => option.value === saved) ? saved! : 'classic';
    } catch {
      return 'classic';
    }
  });
  const [memeOverlay, setMemeOverlay] = useState(false);
  const [memeSource, setMemeSource] = useState<MemeSource>(() => {
    try {
      const saved = localStorage.getItem(MEME_SOURCE_STORAGE_KEY);
      return saved === 'giphy' ? 'giphy' : 'local';
    } catch {
      return 'local';
    }
  });
  const [giphyKey, setGiphyKey] = useState(() => {
    try {
      return localStorage.getItem(GIPHY_KEY_STORAGE_KEY) || getActiveGiphyKey();
    } catch {
      return '';
    }
  });
  const [localMemePath, setLocalMemePath] = useState(() => {
    try {
      return localStorage.getItem(LOCAL_MEME_PATH_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [pageCredit, setPageCredit] = useState(() => {
    try {
      return localStorage.getItem(PAGE_CREDIT_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [saveFolder, setSaveFolder] = useState(() => {
    try {
      return localStorage.getItem(EXPORT_FOLDER_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [isRunning, setIsRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloadingMemes, setIsDownloadingMemes] = useState(false);
  const [isCheckingMemes, setIsCheckingMemes] = useState(false);
  const [memeLibraryDir, setMemeLibraryDir] = useState('');
  const [memeLibraryCount, setMemeLibraryCount] = useState(0);
  const [memeAvailableCount, setMemeAvailableCount] = useState<number | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [results, setResults] = useState<TopGainersPayload | null>(null);
  const [error, setError] = useState('');
  const logRef = useRef<HTMLDivElement | null>(null);

  const completedCount = results?.rows?.length || 0;
  const hasResults = completedCount > 0;
  const selectedPreset = P2_PRESETS.some(item => item.value === p2) ? p2 : CUSTOM_P2_VALUE;
  const isCustomP2 = selectedPreset === CUSTOM_P2_VALUE;
  const statusText = useMemo(() => {
    if (isRunning) return 'กำลังสร้างงาน';
    if (hasResults) return `พร้อมใช้งาน ${completedCount} รายการ`;
    return 'พร้อมเริ่ม';
  }, [completedCount, hasResults, isRunning]);

  useEffect(() => {
    loadInitialState();
  }, []);

  useEffect(() => {
    const handleApiProfilesUpdated = () => {
      if (!giphyKey.trim()) updateGiphyKey(getActiveGiphyKey());
    };
    window.addEventListener('api-profiles-updated', handleApiProfilesUpdated);
    return () => window.removeEventListener('api-profiles-updated', handleApiProfilesUpdated);
  }, [giphyKey]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  const loadInitialState = async () => {
    try {
      const [configRes, resultRes, memeLibraryRes] = await Promise.all([
        fetch('/api/top-gainers-config'),
        fetch('/api/top-gainers-results'),
        fetch('/api/top-gainers-meme-library'),
      ]);
      const config = await configRes.json();
      const latest = await resultRes.json();
      const memeLibrary = await memeLibraryRes.json();
      if (config?.p2) setP2(config.p2);
      if (latest?.success) setResults(latest);
      if (memeLibrary?.success) {
        setMemeLibraryDir(memeLibrary.outputDir || '');
        setMemeLibraryCount(Number(memeLibrary.count || 0));
      }
    } catch (e: any) {
      setError(e.message || 'โหลดข้อมูลไม่สำเร็จ');
    }
  };

  const appendLog = (line: string) => {
    const timestamp = new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const text = String(line || '').trim();
    setLogLines(prev => [...prev, `[${timestamp}] ${text}`].slice(-300));
  };

  const updateSaveFolder = (dir: string) => {
    setSaveFolder(dir);
    try {
      if (dir) localStorage.setItem(EXPORT_FOLDER_STORAGE_KEY, dir);
    } catch {}
  };

  const updatePageCredit = (next: string) => {
    setPageCredit(next);
    try {
      localStorage.setItem(PAGE_CREDIT_STORAGE_KEY, next);
    } catch {}
  };

  const updateMemeSource = (next: MemeSource) => {
    setMemeSource(next);
    try {
      localStorage.setItem(MEME_SOURCE_STORAGE_KEY, next);
    } catch {}
  };

  const updateGiphyKey = (next: string) => {
    setGiphyKey(next);
    try {
      localStorage.setItem(GIPHY_KEY_STORAGE_KEY, next);
    } catch {}
  };

  const updateLocalMemePath = (next: string) => {
    setLocalMemePath(next);
    try {
      localStorage.setItem(LOCAL_MEME_PATH_STORAGE_KEY, next);
    } catch {}
  };

  const updateImageRatio = (next: ImageRatio) => {
    setImageRatio(next);
    try {
      localStorage.setItem(IMAGE_RATIO_STORAGE_KEY, next);
    } catch {}
  };

  const updateHeadlineTheme = (next: HeadlineTheme) => {
    setHeadlineTheme(next);
    try {
      localStorage.setItem(HEADLINE_THEME_STORAGE_KEY, next);
    } catch {}
  };

  const pickFolder = async () => {
    try {
      const res = await fetch('/api/pick-folder', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.dir) updateSaveFolder(data.dir);
    } catch (e: any) {
      setError(e.message || 'เลือก Folder ไม่สำเร็จ');
    }
  };

  const pickLocalMemeFile = async () => {
    try {
      const res = await fetch('/api/pick-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'เลือกไฟล์ Meme (png, jpg, gif, webp)' }),
      });
      const data = await res.json();
      if (data.success && data.file) updateLocalMemePath(data.file);
    } catch (e: any) {
      setError(e.message || 'เลือกไฟล์ Meme ไม่สำเร็จ');
    }
  };

  const pickLocalMemeFolder = async () => {
    try {
      const res = await fetch('/api/pick-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'เลือกโฟลเดอร์ Meme' }),
      });
      const data = await res.json();
      if (data.success && data.dir) updateLocalMemePath(data.dir);
    } catch (e: any) {
      setError(e.message || 'เลือกโฟลเดอร์ Meme ไม่สำเร็จ');
    }
  };

  const downloadStockMemes = async () => {
    setIsDownloadingMemes(true);
    setError('');
    appendLog('เริ่มโหลด stock meme เข้าโฟลเดอร์ในเครื่อง...');
    try {
      const key = giphyKey.trim() || getActiveGiphyKey();
      const res = await fetch('/api/top-gainers-download-memes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 50, giphyKey: key }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'โหลดมีมไม่สำเร็จ');
      updateLocalMemePath(data.outputDir);
      updateMemeSource('local');
      setMemeLibraryDir(data.outputDir || '');
      setMemeLibraryCount(Number(data.count || 0));
      appendLog(`โหลดมีมเสร็จ → ${data.outputDir}`);
      if (data.summary) appendLog(data.summary);
    } catch (e: any) {
      const message = e.message || 'โหลดมีมไม่สำเร็จ';
      setError(message);
      appendLog(message);
    } finally {
      setIsDownloadingMemes(false);
    }
  };

  const checkStockMemes = async () => {
    setIsCheckingMemes(true);
    setError('');
    appendLog('กำลังเช็กมีมรูปนิ่งใหม่จาก GIPHY...');
    try {
      const key = giphyKey.trim() || getActiveGiphyKey();
      const res = await fetch('/api/top-gainers-check-memes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 50, giphyKey: key }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'เช็กมีมไม่สำเร็จ');
      setMemeAvailableCount(Number(data.available || 0));
      setMemeLibraryDir(data.outputDir || memeLibraryDir);
      setMemeLibraryCount(Number(data.count || memeLibraryCount));
      appendLog(`เช็กแล้ว: โหลดมีมรูปนิ่งใหม่ได้อีก ${Number(data.available || 0)} รูป`);
    } catch (e: any) {
      const message = e.message || 'เช็กมีมไม่สำเร็จ';
      setError(message);
      appendLog(message);
    } finally {
      setIsCheckingMemes(false);
    }
  };

  const openMemeLibraryFolder = async () => {
    const dir = memeLibraryDir || localMemePath;
    if (!dir) {
      appendLog('ยังไม่มีโฟลเดอร์คลังมีม ให้กดค้นหา/โหลดก่อน');
      return;
    }
    await fetch(`/api/open-folder?type=${encodeURIComponent(dir)}`);
  };

  const useMemeLibraryFolder = () => {
    if (!memeLibraryDir) {
      appendLog('ยังไม่มีโฟลเดอร์คลังมีม ให้กดค้นหา/โหลดก่อน');
      return;
    }
    updateLocalMemePath(memeLibraryDir);
    updateMemeSource('local');
    appendLog(`ตั้ง Local Meme Folder → ${memeLibraryDir}`);
  };

  const exportToFolder = async () => {
    if (!saveFolder || !results?.rows?.length) return;
    setIsExporting(true);
    setError('');
    try {
      const res = await fetch('/api/top-gainers-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destDir: saveFolder,
          rows: results.rows.map(r => ({
            symbol: r.symbol,
            caption: r.caption,
            localImagePath: r.localImagePath,
          })),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Export ไม่สำเร็จ');
      appendLog(`✅ Export สำเร็จ → ${data.exportDir} (${data.count} รายการ)`);
    } catch (e: any) {
      setError(e.message || 'Export ไม่สำเร็จ');
    } finally {
      setIsExporting(false);
    }
  };

  const runFactory = async () => {
    setIsRunning(true);
    setError('');
    setLogLines([]);
    appendLog('เริ่มส่งงานเข้า Top Gainers Content Factory...');

    try {
      const res = await fetch('/api/top-gainers-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p2, limit: Number(limit) || 1, scanCount, dropboxFolder, skipDropbox, mode, destDir: saveFolder, canvasStyle, imageRatio, headlineTheme, memeOverlay, pageCredit, memeSource, giphyKey, localMemePath }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Browser does not support streaming response');
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          const line = event.split('\n').find(part => part.startsWith('data: '));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6));
          if (payload.type === 'log') appendLog(payload.text);
          if (payload.type === 'done') {
            appendLog('สร้างงานเสร็จแล้ว');
            setResults(payload.result);
          }
          if (payload.type === 'error') {
            setError(payload.text || 'รันงานไม่สำเร็จ');
            appendLog(payload.text || 'รันงานไม่สำเร็จ');
          }
        }
      }
    } catch (e: any) {
      setError(e.message || 'รันงานไม่สำเร็จ');
      appendLog(e.message || 'รันงานไม่สำเร็จ');
    } finally {
      setIsRunning(false);
    }
  };

  const saveConfig = async () => {
    try {
      const res = await fetch('/api/top-gainers-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p2 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'บันทึก P2 ไม่สำเร็จ');
      appendLog(`บันทึก P2 แล้ว: ${data.p2}`);
    } catch (e: any) {
      setError(e.message || 'บันทึก P2 ไม่สำเร็จ');
    }
  };

  const copyText = async (value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    appendLog('คัดลอกแล้ว');
  };

  const openOutputFolder = async () => {
    if (!results?.outputDir) return;
    await fetch(`/api/open-folder?type=${encodeURIComponent(results.outputDir)}`);
  };

  const clearGeneratedAssets = () => {
    if (!results) return;
    setResults(null);
    appendLog('ล้างรายการ Generated Assets บนหน้าจอแล้ว');
  };

  return (
    <div className="min-h-[700px] space-y-5">
      <section
        className="border rounded-lg p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-emerald-500/15 text-emerald-400">
              <ChartBarSquareIcon className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
                Top Gainers Content Factory
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                {statusText}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadInitialState}
              disabled={isRunning}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <ArrowPathIcon className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={openOutputFolder}
              disabled={!results?.outputDir}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <FolderOpenIcon className="w-4 h-4" />
              Open Folder
            </button>
            {results?.csvPath && (
              <button
                onClick={() => copyText(results.csvPath)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <DocumentTextIcon className="w-4 h-4" />
                Copy CSV Path
              </button>
            )}
            <button
              onClick={exportToFolder}
              disabled={!hasResults || !saveFolder || isExporting || isRunning}
              title={!saveFolder ? 'เลือก Export Folder ในแผงด้านซ้ายก่อน' : undefined}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              {isExporting ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ArrowDownTrayIcon className="w-4 h-4" />}
              Export ลงเครื่อง
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-5">
        <div
          className="border rounded-lg p-5 space-y-4"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <div>
            <label className="block text-sm font-bold mb-2">โหมดการสแกน</label>
            <div className="grid grid-cols-2 gap-2">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={`flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-colors ${
                    mode === opt.value
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                      : 'border-transparent bg-black/20'
                  }`}
                  style={mode !== opt.value ? { borderColor: 'var(--border-color)' } : {}}
                >
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="text-xs opacity-60">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">ขนาดรูป</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'default' as ImageRatio, label: '4:5 เดิม', desc: '1080×1350' },
                { value: 'square' as ImageRatio, label: '1:1 Square', desc: '1080×1080' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateImageRatio(opt.value)}
                  type="button"
                  className={`flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-colors ${
                    imageRatio === opt.value
                      ? 'border-sky-500 bg-sky-500/15 text-sky-200'
                      : 'border-transparent bg-black/20'
                  }`}
                  style={imageRatio !== opt.value ? { borderColor: 'var(--border-color)' } : {}}
                >
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="text-xs opacity-60">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">ชุดสีพาดหัว</label>
            <div className="grid grid-cols-2 gap-2">
              {HEADLINE_THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateHeadlineTheme(opt.value)}
                  type="button"
                  className={`min-h-[68px] flex flex-col items-start justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                    headlineTheme === opt.value
                      ? 'border-amber-400 bg-amber-400/10 text-amber-100'
                      : 'border-transparent bg-black/20'
                  }`}
                  style={headlineTheme !== opt.value ? { borderColor: 'var(--border-color)' } : {}}
                >
                  <span className="text-sm font-semibold leading-tight">{opt.label}</span>
                  <span className="flex gap-1.5 my-1">
                    {opt.colors.map((color) => (
                      <span
                        key={color}
                        className="w-5 h-2.5 rounded-sm border border-white/20"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                  <span className="text-[11px] opacity-60 leading-tight">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Cell P2</label>
            <select
              value={selectedPreset}
              onChange={(e) => {
                const next = e.target.value;
                setP2(next === CUSTOM_P2_VALUE ? p2 || 'symbols: ' : next);
              }}
              className="w-full h-[42px] rounded-lg border px-3 bg-transparent"
              style={{ borderColor: 'var(--border-color)' }}
            >
              {P2_PRESETS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
              <option value={CUSTOM_P2_VALUE}>กำหนดเอง</option>
            </select>
            <div className="mt-2 rounded-lg border px-3 py-2 text-xs truncate" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary, #94a3b8)' }}>
              {p2}
            </div>
            {isCustomP2 && (
              <textarea
                value={p2}
                onChange={(e) => setP2(e.target.value)}
                rows={3}
                className="mt-3 w-full rounded-lg border px-3 py-2 text-sm bg-transparent"
                style={{ borderColor: 'var(--border-color)' }}
                placeholder="market: all หรือ sector: Technology หรือ symbols: NVDA, AMD, TSLA"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold mb-2">จำนวนหุ้น</label>
              <input
                type="number"
                min={1}
                max={100}
                value={limit}
                onChange={(e) => setLimit(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={() => {
                  let val = Number(limit);
                  if (isNaN(val) || val < 1) val = 1;
                  if (val > 100) val = 100;
                  setLimit(val);
                }}
                className="w-full rounded-lg border px-3 py-2 bg-transparent"
                style={{ borderColor: 'var(--border-color)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Dropbox</label>
              <label className="h-[42px] flex items-center gap-2 rounded-lg border px-3 text-sm" style={{ borderColor: 'var(--border-color)' }}>
                <input
                  type="checkbox"
                  checked={!skipDropbox}
                  onChange={(e) => setSkipDropbox(!e.target.checked)}
                />
                Upload
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">ค้นลึก</label>
            <select
              value={scanCount}
              onChange={(e) => setScanCount(Number(e.target.value))}
              className="w-full h-[42px] rounded-lg border px-3 bg-transparent"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <option value={50}>เร็ว · 50 candidates</option>
              <option value={150}>สมดุล · 150 candidates</option>
              <option value={300}>ลึก · 300 candidates</option>
              <option value={500}>ลึกสุด · 500 candidates</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">🎨 Canvas Style</label>
            <select
              value={canvasStyle}
              onChange={(e) => setCanvasStyle(e.target.value)}
              className="w-full h-[42px] rounded-lg border px-3 bg-transparent"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <option value="viral">🔥 Viral Split — กราฟบน แถบดำพาดหัว 3 บรรทัด</option>
              <option value="classic">🌙 Classic Dark — มืดเท่ สไตล์ GitHub</option>
              <option value="neon">💜 Neon Glow — พื้นน้ำเงินเข้ม เรืองแสง</option>
              <option value="clean">☀️ Clean White — สะอาดตา มินิมอล</option>
              <option value="bold">💥 Bold Impact — ตัวเลขยักษ์ จัดเต็ม</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Meme Sticker</label>
            <label className="h-[42px] flex items-center gap-2 rounded-lg border px-3 text-sm" style={{ borderColor: 'var(--border-color)' }}>
              <input
                type="checkbox"
                checked={memeOverlay}
                onChange={(e) => setMemeOverlay(e.target.checked)}
              />
              ใส่ reaction meme ในพื้นที่กราฟ
            </label>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Meme Source</label>
            <select
              value={memeSource}
              onChange={(e) => updateMemeSource(e.target.value as MemeSource)}
              className="w-full h-[42px] rounded-lg border px-3 bg-transparent"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <option value="local">ในเครื่อง / Sticker local</option>
              <option value="giphy">GIPHY API</option>
            </select>
          </div>

          {memeSource === 'local' ? (
            <div>
              <label className="block text-sm font-bold mb-2">Local Meme File/Folder</label>
              <div className="flex gap-2">
                <div
                  className="flex-1 h-[42px] rounded-lg border px-3 py-2 text-sm truncate"
                  style={{ borderColor: 'var(--border-color)', color: localMemePath ? 'var(--text-main)' : 'var(--text-secondary, #94a3b8)' }}
                  title={localMemePath}
                >
                  {localMemePath || 'ไม่เลือก = ใช้ sticker local'}
                </div>
                <button
                  onClick={pickLocalMemeFile}
                  type="button"
                  className="h-[42px] px-3 rounded-lg border text-sm font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  เลือกไฟล์
                </button>
                <button
                  onClick={pickLocalMemeFolder}
                  type="button"
                  className="h-[42px] px-3 rounded-lg border text-sm font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  เลือกโฟลเดอร์
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-bold mb-2">GIPHY API Key</label>
              <input
                type="password"
                value={giphyKey}
                onChange={(e) => updateGiphyKey(e.target.value)}
                placeholder="ใส่ GIPHY API Key หรือใช้จาก Global Settings"
                className="w-full h-[42px] rounded-lg border px-3 bg-transparent"
                style={{ borderColor: 'var(--border-color)' }}
              />
            </div>
          )}

          <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="block text-sm font-bold">คลังมีม Stock</label>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                  {memeLibraryCount > 0 ? `${memeLibraryCount} รูป · ตรวจ/ลบในโฟลเดอร์ได้` : 'ยังไม่มีมีมในคลัง'}
                  {memeAvailableCount !== null ? ` · ใหม่อีก ${memeAvailableCount} รูป` : ''}
                </p>
              </div>
              <button
                onClick={checkStockMemes}
                type="button"
                disabled={isCheckingMemes || isDownloadingMemes}
                className="h-[38px] px-3 rounded-lg border text-sm font-bold disabled:opacity-50"
                style={{ borderColor: 'var(--border-color)' }}
              >
                {isCheckingMemes ? 'กำลัง Check...' : 'Check'}
              </button>
              <button
                onClick={downloadStockMemes}
                type="button"
                disabled={isDownloadingMemes || isCheckingMemes}
                className="h-[38px] px-3 rounded-lg border text-sm font-bold disabled:opacity-50"
                style={{ borderColor: 'var(--border-color)' }}
              >
                {isDownloadingMemes ? 'กำลังค้นหา...' : 'ค้นหา/โหลด 50 รูป'}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={openMemeLibraryFolder}
                type="button"
                disabled={!memeLibraryDir && !localMemePath}
                className="flex-1 h-[38px] rounded-lg border text-sm font-semibold disabled:opacity-50"
                style={{ borderColor: 'var(--border-color)' }}
              >
                เปิดโฟลเดอร์ตรวจมีม
              </button>
              <button
                onClick={useMemeLibraryFolder}
                type="button"
                disabled={!memeLibraryDir}
                className="flex-1 h-[38px] rounded-lg border text-sm font-semibold disabled:opacity-50"
                style={{ borderColor: 'var(--border-color)' }}
              >
                ใช้โฟลเดอร์นี้
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Page Credit</label>
            <input
              value={pageCredit}
              onChange={(e) => updatePageCredit(e.target.value)}
              placeholder="เช่น TrendTech หรือ @TrendTech"
              className="w-full h-[42px] rounded-lg border px-3 bg-transparent"
              style={{ borderColor: 'var(--border-color)' }}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Dropbox Folder</label>
            <input
              value={dropboxFolder}
              onChange={(e) => setDropboxFolder(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 bg-transparent"
              style={{ borderColor: 'var(--border-color)' }}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Export Folder (บันทึกไฟล์ลงเครื่อง)</label>
            <div className="flex gap-2">
              <div
                className="flex-1 rounded-lg border px-3 py-2 text-sm truncate"
                style={{ borderColor: 'var(--border-color)', color: saveFolder ? 'var(--text-main)' : 'var(--text-secondary, #94a3b8)' }}
                title={saveFolder}
              >
                {saveFolder || 'ยังไม่ได้เลือก Folder'}
              </div>
              <button
                onClick={pickFolder}
                disabled={isRunning}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-semibold disabled:opacity-50"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <FolderOpenIcon className="w-4 h-4" />
                เลือก
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={saveConfig}
              disabled={isRunning}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border font-bold disabled:opacity-50"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <ClipboardDocumentIcon className="w-5 h-5" />
              Save P2
            </button>
            <button
              onClick={runFactory}
              disabled={isRunning}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-500 text-slate-950 font-bold disabled:opacity-50"
            >
              {isRunning ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <PlayIcon className="w-5 h-5" />}
              Run
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        <div
          className="border rounded-lg p-5 min-h-[332px]"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">Run Log</h2>
            <span className="text-xs" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
              {logLines.length} lines
            </span>
          </div>
          <div
            ref={logRef}
            className="h-[270px] overflow-auto rounded-lg bg-black/40 p-3 font-mono text-xs leading-5 custom-scrollbar"
            style={{ color: '#d1fae5' }}
          >
            {logLines.length === 0 ? (
              <div className="text-slate-500">ยังไม่มี log</div>
            ) : (
              logLines.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)
            )}
          </div>
        </div>
      </section>

      {results && (
        <section
          className="border rounded-lg p-5"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
            <div>
              <h2 className="text-lg font-bold">Generated Assets</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                {results.date ? `${results.date} · ${completedCount} images` : 'ยังไม่มีผลลัพธ์'}
              </p>
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-2 min-w-0">
              {results.csvPath && (
                <div
                  className="text-xs rounded-lg border px-3 py-2 max-w-full truncate"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  {results.csvPath}
                </div>
              )}
              <button
                type="button"
                onClick={clearGeneratedAssets}
                disabled={isRunning}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold disabled:opacity-50"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <TrashIcon className="w-4 h-4" />
                ล้างรายการ
              </button>
            </div>
          </div>

          {!hasResults ? (
            <div className="min-h-[280px] flex items-center justify-center rounded-lg border border-dashed" style={{ borderColor: 'var(--border-color)' }}>
              <div className="text-center">
                <ChartBarSquareIcon className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
                <p className="font-semibold">กด Run เพื่อสร้างภาพและ CSV</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
              {results.rows.map((item) => (
                <article
                  key={`${item.date}-${item.symbol}`}
                  className="rounded-lg border overflow-hidden"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="bg-black/30" style={{ aspectRatio: imageRatio === 'square' ? '1 / 1' : '4 / 5' }}>
                    {item.previewUrl ? (
                      <img src={item.previewUrl} alt={item.symbol} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">No preview</div>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black">{item.symbol}</h3>
                        <p className="text-xs" style={{ color: 'var(--text-secondary, #94a3b8)' }}>{item.configRef}</p>
                      </div>
                      <button
                        onClick={() => copyText(item.imageUrl)}
                        disabled={!item.imageUrl}
                        title="Copy Dropbox image URL"
                        className="w-10 h-10 inline-flex items-center justify-center rounded-lg border disabled:opacity-40"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <LinkIcon className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-sm leading-6 line-clamp-4" style={{ color: 'var(--text-secondary, #cbd5e1)' }}>
                      {item.caption}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
