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
} from '@heroicons/react/24/outline';

type RunMode = 'gainers' | 'losers' | 'low_pe' | 'trending';

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
const P2_PRESETS = [
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

export function TopGainersFactoryTab() {
  const [p2, setP2] = useState(DEFAULT_P2);
  const [limit, setLimit] = useState(5);
  const [scanCount, setScanCount] = useState(150);
  const [dropboxFolder, setDropboxFolder] = useState(DEFAULT_DROPBOX);
  const [skipDropbox, setSkipDropbox] = useState(false);
  const [mode, setMode] = useState<RunMode>('gainers');
  const [saveFolder, setSaveFolder] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
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
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  const loadInitialState = async () => {
    try {
      const [configRes, resultRes] = await Promise.all([
        fetch('/api/top-gainers-config'),
        fetch('/api/top-gainers-results'),
      ]);
      const config = await configRes.json();
      const latest = await resultRes.json();
      if (config?.p2) setP2(config.p2);
      if (latest?.success) setResults(latest);
    } catch (e: any) {
      setError(e.message || 'โหลดข้อมูลไม่สำเร็จ');
    }
  };

  const appendLog = (line: string) => {
    setLogLines(prev => [...prev, line].slice(-300));
  };

  const pickFolder = async () => {
    try {
      const res = await fetch('/api/pick-folder');
      const data = await res.json();
      if (data.success && data.dir) setSaveFolder(data.dir);
    } catch (e: any) {
      setError(e.message || 'เลือก Folder ไม่สำเร็จ');
    }
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
        body: JSON.stringify({ p2, limit, scanCount, dropboxFolder, skipDropbox, mode }),
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
                placeholder="sector: Technology หรือ symbols: NVDA, AMD, TSLA"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold mb-2">จำนวนหุ้น</label>
              <input
                type="number"
                min={1}
                max={20}
                value={limit}
                onChange={(e) => setLimit(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
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

      <section
        className="border rounded-lg p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold">Generated Assets</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
              {results?.date ? `${results.date} · ${completedCount} images` : 'ยังไม่มีผลลัพธ์'}
            </p>
          </div>
          {results?.csvPath && (
            <div className="text-xs rounded-lg border px-3 py-2 max-w-full truncate" style={{ borderColor: 'var(--border-color)' }}>
              {results.csvPath}
            </div>
          )}
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
            {results!.rows.map((item) => (
              <article
                key={`${item.date}-${item.symbol}`}
                className="rounded-lg border overflow-hidden"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="aspect-[4/5] bg-black/30">
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
    </div>
  );
}
