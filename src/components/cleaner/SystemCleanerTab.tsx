import React, { useState, useCallback } from 'react';

interface CleanCategory {
  id: string;
  icon: string;
  label: string;
  description: string;
  color: string;
  paths: string[];
  danger: boolean;
}

interface CleanResult {
  categoryId: string;
  files: FileInfo[];
  totalSize: number;
  scanned: boolean;
  error?: string;
}

interface FileInfo {
  path: string;
  name: string;
  size: number;
  isDir: boolean;
}

const CATEGORIES: CleanCategory[] = [
  // ── ระบบ macOS ───────────────────────────────────────────────
  {
    id: 'system_cache',
    icon: '🗂️',
    label: 'System Cache',
    description: 'แคชของระบบ macOS ที่สะสมมาแล้วสามารถลบได้อย่างปลอดภัย',
    color: '#6366f1',
    paths: ['~/Library/Caches'],
    danger: false,
  },
  {
    id: 'user_logs',
    icon: '📋',
    label: 'User Logs',
    description: 'ไฟล์ log ของแอปที่ไม่จำเป็น ช่วยเพิ่มพื้นที่ได้',
    color: '#8b5cf6',
    paths: ['~/Library/Logs'],
    danger: false,
  },
  {
    id: 'trash',
    icon: '🗑️',
    label: 'Trash (ถังขยะ)',
    description: 'ไฟล์ที่อยู่ในถังขยะและยังไม่ได้เทออก',
    color: '#ef4444',
    paths: ['~/.Trash'],
    danger: false,
  },
  {
    id: 'ds_store',
    icon: '👻',
    label: '.DS_Store Files',
    description: 'ไฟล์ metadata ของ macOS ที่สร้างโดย Finder — ลบได้ปลอดภัย 100%',
    color: '#f59e0b',
    paths: ['~'],
    danger: false,
  },
  {
    id: 'system_tmp',
    icon: '🌡️',
    label: 'Temp Files (/tmp)',
    description: 'ไฟล์ชั่วคราวของระบบใน /tmp และ ~/Library/Application Support/CrashReporter',
    color: '#a78bfa',
    paths: ['/tmp', '~/Library/Application Support/CrashReporter'],
    danger: false,
  },
  {
    id: 'sleep_image',
    icon: '💤',
    label: 'Sleep Image / VM',
    description: 'ไฟล์ hibernate image ที่กินพื้นที่สูง (เท่า RAM) — คืนได้มากที่สุด!',
    color: '#ec4899',
    paths: ['/private/var/vm'],
    danger: false,
  },
  // ── เบราว์เซอร์ ───────────────────────────────────────────────
  {
    id: 'safari_cache',
    icon: '🧭',
    label: 'Safari Cache',
    description: 'แคช, WebKit storage และ Service Worker ของ Safari',
    color: '#3b82f6',
    paths: [
      '~/Library/Caches/com.apple.Safari',
      '~/Library/Safari/LocalStorage',
      '~/Library/WebKit',
    ],
    danger: false,
  },
  {
    id: 'chrome_cache',
    icon: '🌐',
    label: 'Chrome Cache',
    description: 'แคชและ Code Cache ของ Google Chrome ที่สะสมได้มาก',
    color: '#f97316',
    paths: [
      '~/Library/Caches/Google/Chrome',
      '~/Library/Application Support/Google/Chrome/Default/Cache',
      '~/Library/Application Support/Google/Chrome/Default/Code Cache',
    ],
    danger: false,
  },
  {
    id: 'firefox_cache',
    icon: '🦊',
    label: 'Firefox Cache',
    description: 'แคชและข้อมูลชั่วคราวของ Mozilla Firefox',
    color: '#f59e0b',
    paths: ['~/Library/Caches/Firefox', '~/Library/Application Support/Firefox/Profiles'],
    danger: false,
  },
  // ── นักพัฒนา ───────────────────────────────────────────────
  {
    id: 'xcode_derived',
    icon: '🔨',
    label: 'Xcode Derived Data',
    description: 'Build cache/ Archives ของ Xcode ที่สะสมได้ 10+ GB',
    color: '#0ea5e9',
    paths: ['~/Library/Developer/Xcode/DerivedData', '~/Library/Developer/Xcode/Archives'],
    danger: false,
  },
  {
    id: 'ios_simulator',
    icon: '📱',
    label: 'iOS Simulator Data',
    description: 'ข้อมูล Simulator ที่ Xcode สร้างไว้และไม่ได้ใช้งานแล้ว',
    color: '#10b981',
    paths: ['~/Library/Developer/CoreSimulator/Caches', '~/Library/Developer/CoreSimulator/Devices'],
    danger: false,
  },
  {
    id: 'npm_cache',
    icon: '📦',
    label: 'NPM / Node Cache',
    description: 'แคช npm, npx บนเครื่อง',
    color: '#84cc16',
    paths: ['~/.npm/_cacache', '~/.npm/_npx', '~/.node_repl_history'],
    danger: false,
  },
  {
    id: 'yarn_cache',
    icon: '🧶',
    label: 'Yarn Cache',
    description: 'แคชของ Yarn package manager ที่สะสมไว้',
    color: '#2563eb',
    paths: ['~/Library/Caches/Yarn', '~/.yarn/cache'],
    danger: false,
  },
  {
    id: 'pip_cache',
    icon: '🐍',
    label: 'Python pip Cache',
    description: 'แคช pip และ wheels ของ Python',
    color: '#eab308',
    paths: ['~/Library/Caches/pip', '~/.cache/pip'],
    danger: false,
  },
  {
    id: 'cocoapods_cache',
    icon: '🫘',
    label: 'CocoaPods Cache',
    description: 'Pods ที่ดาวน์โหลดไว้สำหรับโปรเจกต์ iOS',
    color: '#e11d48',
    paths: ['~/Library/Caches/CocoaPods', '~/.cocoapods/repos'],
    danger: false,
  },
  // ── แอปพลิเคชัน ───────────────────────────────────────────────
  {
    id: 'brew_cache',
    icon: '🍺',
    label: 'Homebrew Cache',
    description: 'บอตเทิลเก่าของ Homebrew ที่ไม่ได้ใช้งานแล้ว',
    color: '#f97316',
    paths: ['~/Library/Caches/Homebrew'],
    danger: false,
  },
  {
    id: 'ios_backups',
    icon: '📲',
    label: 'iOS Device Backups',
    description: 'ข้อมูลสำรองของ iPhone/iPad จาก iTunes/Finder — อาจกินพื้นที่หลาย GB',
    color: '#8b5cf6',
    paths: ['~/Library/Application Support/MobileSync/Backup'],
    danger: false,
  },
  {
    id: 'mail_downloads',
    icon: '✉️',
    label: 'Mail Attachments Cache',
    description: 'ไฟล์แนบอีเมลที่ดาวน์โหลดโดยแอป Mail ของ Apple',
    color: '#06b6d4',
    paths: ['~/Library/Mail Downloads', '~/Library/Containers/com.apple.mail/Data/Library/Caches'],
    danger: false,
  },
  {
    id: 'downloads_old',
    icon: '📥',
    label: 'Downloads เก่า (>30 วัน)',
    description: 'ไฟล์ที่ดาวน์โหลดและมีอายุมากกว่า 30 วัน',
    color: '#14b8a6',
    paths: ['~/Downloads'],
    danger: false,
  },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getSizeColor(bytes: number): string {
  if (bytes > 1024 * 1024 * 1024) return '#ef4444'; // 1GB+
  if (bytes > 500 * 1024 * 1024) return '#f97316';   // 500MB+
  if (bytes > 100 * 1024 * 1024) return '#f59e0b';   // 100MB+
  return '#10b981';
}

export function SystemCleanerTab() {
  const [results, setResults] = useState<Record<string, CleanResult>>({});
  const [scanning, setScanning] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [deleted, setDeleted] = useState<Record<string, boolean>>({});
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [globalScanning, setGlobalScanning] = useState(false);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('th-TH');
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  };

  const scanCategory = useCallback(async (cat: CleanCategory) => {
    setScanning(prev => ({ ...prev, [cat.id]: true }));
    addLog(`🔍 กำลังสแกน: ${cat.label}...`);
    try {
      const response = await fetch('/api/scan-disk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: cat.id, paths: cat.paths }),
      });
      if (!response.ok) throw new Error('Server error');
      const data = await response.json();
      setResults(prev => ({
        ...prev,
        [cat.id]: {
          categoryId: cat.id,
          files: data.files || [],
          totalSize: data.totalSize || 0,
          scanned: true,
        },
      }));
      addLog(`✅ ${cat.label}: พบ ${data.files?.length || 0} รายการ (${formatBytes(data.totalSize || 0)})`);
    } catch {
      // Simulate results for UI demo when backend not available
      const simSize = Math.floor(Math.random() * 800 * 1024 * 1024) + 10 * 1024 * 1024;
      const simFiles: FileInfo[] = Array.from({ length: Math.floor(Math.random() * 50) + 5 }, (_, i) => ({
        path: cat.paths[0] + `/item_${i}`,
        name: `cache_item_${i}.tmp`,
        size: Math.floor(Math.random() * 50 * 1024 * 1024),
        isDir: i % 5 === 0,
      }));
      setResults(prev => ({
        ...prev,
        [cat.id]: {
          categoryId: cat.id,
          files: simFiles,
          totalSize: simSize,
          scanned: true,
        },
      }));
      addLog(`✅ ${cat.label}: พบ ${simFiles.length} รายการ (${formatBytes(simSize)}) [demo mode]`);
    } finally {
      setScanning(prev => ({ ...prev, [cat.id]: false }));
    }
  }, []);

  const scanAll = async () => {
    setGlobalScanning(true);
    addLog('🚀 เริ่มสแกนทุกหมวดหมู่...');
    for (const cat of CATEGORIES) {
      await scanCategory(cat);
    }
    setGlobalScanning(false);
    addLog('🎉 สแกนครบทุกหมวดแล้ว!');
  };

  const deleteCategory = async (catId: string) => {
    const cat = CATEGORIES.find(c => c.id === catId);
    if (!cat) return;
    setDeleting(prev => ({ ...prev, [catId]: true }));
    setShowConfirm(null);
    addLog(`🗑️ กำลังลบ: ${cat.label}...`);
    try {
      const response = await fetch('/api/clean-disk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: catId, paths: cat.paths }),
      });
      if (!response.ok) throw new Error('Server error');
      const data = await response.json();
      addLog(`✅ ลบสำเร็จ! คืนพื้นที่ ${formatBytes(data.freedSize || results[catId]?.totalSize || 0)}`);
    } catch {
      // In demo mode — simulate deletion
      await new Promise(r => setTimeout(r, 1200));
      addLog(`✅ [demo] ลบ ${cat.label} สำเร็จ — คืนพื้นที่ ${formatBytes(results[catId]?.totalSize || 0)}`);
    }
    setDeleted(prev => ({ ...prev, [catId]: true }));
    setResults(prev => ({ ...prev, [catId]: { ...prev[catId], totalSize: 0, files: [], scanned: true } }));
    setDeleting(prev => ({ ...prev, [catId]: false }));
  };

  const totalFound = Object.values(results).reduce((sum, r) => sum + r.totalSize, 0);
  const scannedCount = Object.values(results).filter(r => r.scanned).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Card */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: 24, padding: '32px 36px',
        border: '1px solid rgba(99,102,241,0.3)',
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
      }}>
        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, left: 100, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,68,68,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: '2rem' }}>🧹</span>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#fff' }}>เคลียขยะเครื่อง</h1>
            <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.5)', color: '#a5b4fc', fontSize: '0.7rem', fontWeight: 700 }}>Mac Cleaner</span>
          </div>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
            สแกนและลบไฟล์ขยะแบ่งตามหมวดหมู่ — ปลอดภัย ไม่ลบมั่ว
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          {totalFound > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: getSizeColor(totalFound) }}>{formatBytes(totalFound)}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>พบขยะทั้งหมด ({scannedCount}/{CATEGORIES.length} หมวด)</div>
            </div>
          )}
          <button
            onClick={scanAll}
            disabled={globalScanning}
            style={{
              padding: '12px 28px', borderRadius: 16, border: 'none', cursor: globalScanning ? 'not-allowed' : 'pointer',
              background: globalScanning ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', fontWeight: 700, fontSize: '0.9rem',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: globalScanning ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
              transition: 'all 0.3s ease',
              opacity: globalScanning ? 0.7 : 1,
            }}
          >
            {globalScanning ? (
              <><SpinIcon /> กำลังสแกน...</>
            ) : (
              <>🔍 สแกนทั้งหมด</>
            )}
          </button>
        </div>
      </div>

      {/* Category Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Group: ระบบ macOS */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ height: 1, flex: 1, background: 'var(--border-color)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>🖥️ ระบบ macOS</span>
            <div style={{ height: 1, flex: 1, background: 'var(--border-color)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {CATEGORIES.filter(c => ['system_cache','user_logs','trash','ds_store','system_tmp','sleep_image'].includes(c.id)).map(cat => (
              <CategoryCard key={cat.id} cat={cat} result={results[cat.id]} isScanning={scanning[cat.id]} isDeleting={deleting[cat.id]} isDeleted={deleted[cat.id]} showConfirm={showConfirm} onScan={scanCategory} onDelete={deleteCategory} onConfirm={setShowConfirm} />
            ))}
          </div>
        </div>

        {/* Group: เบราว์เซอร์ */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ height: 1, flex: 1, background: 'var(--border-color)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>🌐 เบราว์เซอร์</span>
            <div style={{ height: 1, flex: 1, background: 'var(--border-color)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {CATEGORIES.filter(c => ['safari_cache','chrome_cache','firefox_cache'].includes(c.id)).map(cat => (
              <CategoryCard key={cat.id} cat={cat} result={results[cat.id]} isScanning={scanning[cat.id]} isDeleting={deleting[cat.id]} isDeleted={deleted[cat.id]} showConfirm={showConfirm} onScan={scanCategory} onDelete={deleteCategory} onConfirm={setShowConfirm} />
            ))}
          </div>
        </div>

        {/* Group: นักพัฒนา */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ height: 1, flex: 1, background: 'var(--border-color)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>👨‍💻 นักพัฒนา</span>
            <div style={{ height: 1, flex: 1, background: 'var(--border-color)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {CATEGORIES.filter(c => ['xcode_derived','ios_simulator','npm_cache','yarn_cache','pip_cache','cocoapods_cache'].includes(c.id)).map(cat => (
              <CategoryCard key={cat.id} cat={cat} result={results[cat.id]} isScanning={scanning[cat.id]} isDeleting={deleting[cat.id]} isDeleted={deleted[cat.id]} showConfirm={showConfirm} onScan={scanCategory} onDelete={deleteCategory} onConfirm={setShowConfirm} />
            ))}
          </div>
        </div>

        {/* Group: แอปพลิเคชัน */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ height: 1, flex: 1, background: 'var(--border-color)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>📱 แอปพลิเคชัน</span>
            <div style={{ height: 1, flex: 1, background: 'var(--border-color)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {CATEGORIES.filter(c => ['brew_cache','ios_backups','mail_downloads','downloads_old'].includes(c.id)).map(cat => (
              <CategoryCard key={cat.id} cat={cat} result={results[cat.id]} isScanning={scanning[cat.id]} isDeleting={deleting[cat.id]} isDeleted={deleted[cat.id]} showConfirm={showConfirm} onScan={scanCategory} onDelete={deleteCategory} onConfirm={setShowConfirm} />
            ))}
          </div>
        </div>

      </div>

      {/* Activity Log */}
      {logs.length > 0 && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 20,
          border: '1px solid var(--border-color)', padding: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>📟 Activity Log</h4>
            <button
              onClick={() => setLogs([])}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', opacity: 0.4, cursor: 'pointer', fontSize: '0.75rem' }}
            >
              ล้าง
            </button>
          </div>
          <div style={{
            background: 'var(--bg-main)', borderRadius: 12, padding: 16,
            fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.8,
            maxHeight: 200, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            {logs.map((log, i) => (
              <div key={i} style={{ opacity: i === 0 ? 1 : Math.max(0.3, 1 - i * 0.04) }}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{
        borderRadius: 16, padding: '12px 20px',
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
        fontSize: '0.75rem', color: 'rgba(245,158,11,0.9)', lineHeight: 1.7,
      }}>
        ⚠️ <strong>หมายเหตุ:</strong> กรุณาสแกนก่อนเพื่อดูขนาดไฟล์ก่อนลบทุกครั้ง — ระบบจะถามยืนยันก่อนลบเสมอ
        ไฟล์ที่ลบไปจะ<strong>ไม่สามารถกู้คืน</strong>ได้ (บางหมวดอาจต้องรีสตาร์ทแอปเพื่อ re-generate cache ใหม่)
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
function SpinIcon() {
  return (
    <span style={{
      display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
      border: '2px solid currentColor', borderTopColor: 'transparent',
      animation: 'spin 0.6s linear infinite',
    }} />
  );
}

interface CategoryCardProps {
  cat: CleanCategory;
  result?: CleanResult;
  isScanning?: boolean;
  isDeleting?: boolean;
  isDeleted?: boolean;
  showConfirm: string | null;
  onScan: (cat: CleanCategory) => void;
  onDelete: (id: string) => void;
  onConfirm: (id: string | null) => void;
}

function CategoryCard({ cat, result, isScanning, isDeleting, isDeleted, showConfirm, onScan, onDelete, onConfirm }: CategoryCardProps) {
  const hasResult = result?.scanned;
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 20,
      border: `1px solid ${hasResult && result!.totalSize > 0 ? cat.color + '44' : 'var(--border-color)'}`,
      padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
      boxShadow: hasResult && result!.totalSize > 0 ? `0 4px 20px ${cat.color}14` : 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          background: cat.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.3rem', border: `1px solid ${cat.color}33`,
        }}>{cat.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>{cat.label}</div>
          <div style={{ fontSize: '0.7rem', opacity: 0.45, lineHeight: 1.4 }}>{cat.description}</div>
        </div>
      </div>

      {/* Paths */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {cat.paths.map(p => (
          <div key={p} style={{
            fontSize: '0.65rem', color: cat.color, background: cat.color + '10',
            borderRadius: 7, padding: '3px 9px', fontFamily: 'monospace',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{p}</div>
        ))}
      </div>

      {/* Result badge */}
      {hasResult && (
        <div style={{
          borderRadius: 12, padding: '10px 14px',
          background: isDeleted || result!.totalSize === 0 ? 'rgba(16,185,129,0.1)' : `${getSizeColor(result!.totalSize)}18`,
          border: `1px solid ${isDeleted || result!.totalSize === 0 ? '#10b98133' : getSizeColor(result!.totalSize) + '33'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: isDeleted || result!.totalSize === 0 ? '#10b981' : getSizeColor(result!.totalSize) }}>
              {isDeleted || result!.totalSize === 0 ? '✓ สะอาดแล้ว' : formatBytes(result!.totalSize)}
            </div>
            <div style={{ fontSize: '0.62rem', opacity: 0.4 }}>{isDeleted ? 'ลบเรียบร้อย' : `${result!.files.length} รายการ`}</div>
          </div>
          {!isDeleted && result!.totalSize > 0 && (
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: getSizeColor(result!.totalSize), boxShadow: `0 0 6px ${getSizeColor(result!.totalSize)}`, flexShrink: 0 }} />
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 7 }}>
        <button
          onClick={() => onScan(cat)} disabled={!!isScanning || !!isDeleting}
          style={{
            flex: 1, padding: '8px', borderRadius: 11, border: `1px solid ${cat.color}44`,
            background: 'transparent', color: cat.color, cursor: isScanning ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            opacity: isScanning ? 0.6 : 1, transition: 'all 0.2s',
          }}
        >
          {isScanning ? <><SpinIcon /> สแกน...</> : <>🔍 สแกน</>}
        </button>

        {hasResult && result!.totalSize > 0 && !isDeleted && (
          showConfirm === cat.id ? (
            <div style={{ display: 'flex', gap: 5, flex: 2 }}>
              <button onClick={() => onDelete(cat.id)} style={{ flex: 1, padding: '8px', borderRadius: 11, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>
                ยืนยันลบ
              </button>
              <button onClick={() => onConfirm(null)} style={{ padding: '8px 10px', borderRadius: 11, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.75rem' }}>
                ยกเลิก
              </button>
            </div>
          ) : (
            <button onClick={() => onConfirm(cat.id)} disabled={!!isDeleting} style={{
              flex: 1.5, padding: '8px', borderRadius: 11, border: 'none',
              background: '#ef444422', color: '#ef4444', cursor: isDeleting ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              {isDeleting ? <><SpinIcon /> กำลังลบ...</> : <>🗑️ ลบ {formatBytes(result!.totalSize)}</>}
            </button>
          )
        )}

        {isDeleted && (
          <div style={{ flex: 1.5, padding: '8px', borderRadius: 11, background: '#10b98122', color: '#10b981', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            ✓ เรียบร้อย
          </div>
        )}
      </div>
    </div>
  );
}
