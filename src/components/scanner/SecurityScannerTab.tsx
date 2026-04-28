import React, { useState } from 'react';
import { 
  ShieldCheckIcon, 
  ShieldExclamationIcon, 
  MagnifyingGlassIcon,
  TrashIcon,
  DocumentMagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface ScannedItem {
  path: string;
  name: string;
  risk: 'High' | 'Medium' | 'Low';
  type: string;
}

export function SecurityScannerTab() {
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [results, setResults] = useState<ScannedItem[]>([]);
  const [scanProgress, setScanProgress] = useState(0);

  const handleScan = async () => {
    setIsScanning(true);
    setHasScanned(false);
    setResults([]);
    setScanProgress(0);

    // Fake progress animation
    const interval = setInterval(() => {
      setScanProgress(p => {
        if (p >= 90) {
          clearInterval(interval);
          return 90;
        }
        return p + Math.floor(Math.random() * 15);
      });
    }, 200);

    try {
      const res = await fetch('/api/scan-malware');
      const data = await res.json();
      
      clearInterval(interval);
      setScanProgress(100);
      
      if (data.success) {
        // Sort by risk (High -> Medium -> Low)
        const order = { 'High': 0, 'Medium': 1, 'Low': 2 };
        const sorted = data.items.sort((a: ScannedItem, b: ScannedItem) => order[a.risk] - order[b.risk]);
        setResults(sorted);
      }
    } catch (e) {
      console.error(e);
      clearInterval(interval);
      setScanProgress(0);
    }

    setTimeout(() => {
      setIsScanning(false);
      setHasScanned(true);
    }, 500);
  };

  const handleRemove = async (path: string) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบไฟล์นี้?\n\n${path}\n\n*คำเตือน: การลบไฟล์ LaunchAgents อาจทำให้แอปพลิเคชันบางตัวทำงานผิดปกติได้`)) {
      return;
    }

    try {
      const res = await fetch('/api/remove-malware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      const data = await res.json();
      if (data.success) {
        setResults(prev => prev.filter(r => r.path !== path));
      }
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการลบไฟล์');
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'High': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'Medium': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'Low': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const isSafe = hasScanned && results.length === 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Overview */}
      <div 
        className="p-8 rounded-2xl border flex flex-col items-center justify-center text-center relative overflow-hidden transition-colors duration-500"
        style={{ 
          backgroundColor: hasScanned 
            ? isSafe ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'
            : 'var(--bg-card)', 
          borderColor: hasScanned
            ? isSafe ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'
            : 'var(--border-color)' 
        }}
      >
        <AnimatePresence mode="wait">
          {!hasScanned ? (
             <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
               <ShieldCheckIcon className="w-20 h-20 mx-auto text-gray-400 mb-4" />
               <h2 className="text-2xl font-bold mb-2">Mac Security Scanner</h2>
               <p className="text-sm opacity-70 mb-6 max-w-md mx-auto">
                 สแกนค้นหามัลแวร์, แอดแวร์ และไฟล์น่าสงสัยที่แฝงตัวอยู่ใน LaunchAgents และโฟลเดอร์ดาวน์โหลด
               </p>
             </motion.div>
          ) : isSafe ? (
            <motion.div key="safe" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
               <ShieldCheckIcon className="w-20 h-20 mx-auto text-emerald-500 mb-4" />
               <h2 className="text-2xl font-bold mb-2 text-emerald-500">เครื่องของคุณปลอดภัย</h2>
               <p className="text-sm opacity-70 mb-6">ไม่พบไฟล์มัลแวร์หรือแอดแวร์ในระบบของคุณ</p>
            </motion.div>
          ) : (
            <motion.div key="risk" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
               <ShieldExclamationIcon className="w-20 h-20 mx-auto text-red-500 mb-4" />
               <h2 className="text-2xl font-bold mb-2 text-red-500">พบไฟล์น่าสงสัย {results.length} รายการ</h2>
               <p className="text-sm opacity-70 mb-6">กรุณาตรวจสอบและลบไฟล์ที่ไม่รู้จักด้านล่าง</p>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleScan}
          disabled={isScanning}
          className={`flex items-center gap-2 px-8 py-3 rounded-full font-medium transition-all ${
            isScanning 
              ? 'bg-indigo-500/50 cursor-not-allowed text-white' 
              : 'bg-indigo-500 hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-500/20 text-white'
          }`}
        >
          {isScanning ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              กำลังสแกน... {scanProgress}%
            </>
          ) : (
            <>
              <MagnifyingGlassIcon className="w-5 h-5" />
              {hasScanned ? 'สแกนอีกครั้ง' : 'เริ่มสแกนตอนนี้'}
            </>
          )}
        </button>

        {isScanning && (
          <div className="absolute bottom-0 left-0 h-1 bg-indigo-500 transition-all duration-300" style={{ width: `${scanProgress}%` }} />
        )}
      </div>

      {/* Results List */}
      <AnimatePresence>
        {hasScanned && results.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          >
            <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <h3 className="font-semibold flex items-center gap-2">
                <DocumentMagnifyingGlassIcon className="w-5 h-5" />
                รายละเอียดที่พบ
              </h3>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {results.map((item, idx) => (
                <div key={idx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getRiskColor(item.risk)}`}>
                        Risk: {item.risk}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-500/10 border border-gray-500/20">
                        {item.type}
                      </span>
                    </div>
                    <p className="font-medium text-sm truncate" title={item.name}>{item.name}</p>
                    <p className="text-xs opacity-50 truncate" title={item.path}>{item.path}</p>
                  </div>
                  
                  <button
                    onClick={() => handleRemove(item.path)}
                    className="flex-shrink-0 flex items-center justify-center gap-1 px-4 py-2 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 rounded-lg text-sm transition-colors border border-red-500/20"
                  >
                    <TrashIcon className="w-4 h-4" />
                    ลบไฟล์นี้
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10">
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <span className="text-xl">⚠️</span> ทำไมต้องสแกน?
          </h4>
          <p className="text-xs opacity-70 leading-relaxed">
            บ่อยครั้งที่มัลแวร์หรือแอดแวร์ในฝั่ง Mac มักจะแฝงตัวมาในรูปแบบของสคริปต์ที่ตั้งให้รันตัวเองอัตโนมัติ (LaunchAgents)
            ทำให้เครื่องช้าลง หรือแสดงโฆษณาที่ไม่พึงประสงค์ การหมั่นตรวจสอบจึงช่วยให้เครื่องทำงานได้เต็มประสิทธิภาพ
          </p>
        </div>
        <div className="p-4 rounded-xl border bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10">
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <span className="text-xl">💡</span> คำแนะนำก่อนลบ
          </h4>
          <p className="text-xs opacity-70 leading-relaxed">
            ไฟล์ LaunchAgents บางไฟล์ที่เป็น "Low Risk" อาจมาจากโปรแกรมที่ถูกกฎหมาย เช่น Google Chrome, Adobe หรือสคริปต์ที่คุณติดตั้งเอง
            <strong className="block mt-1">"หากไม่มั่นใจว่าไฟล์นั้นคืออะไร แนะนำให้ปล่อยทิ้งไว้"</strong>
          </p>
        </div>
      </div>

    </div>
  );
}
