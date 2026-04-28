import React, { useState, useEffect } from 'react';

interface AssetFile {
  id: string; // e.g., "Sound_stock/mac-voice-123.m4a"
  name: string;
  type: string; // "Sound_stock" | "Image_stock" | "Video_stock" | "Font_stock"
  sizeBytes: number;
  createdAt: string;
}

export function AssetManager() {
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/list-assets');
      if (res.ok) {
        const data = await res.json();
        // Sort by newest first
        data.sort((a: AssetFile, b: AssetFile) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAssets(data);
      }
    } catch (e) {
      console.error("Failed to load assets", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  // removed handleOutputChange

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(assets.map(a => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`คุณแน่ใจหรือไม่ว่าจะลบไฟล์ทั้งหมด ${selectedIds.length} ไฟล์? (ไม่สามารถกู้คืนได้)`)) return;

    try {
      setLoading(true);
      const res = await fetch('/api/delete-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: selectedIds })
      });
      if (res.ok) {
        setSelectedIds([]);
        await fetchAssets();
      } else {
         const err = await res.json();
         alert("ลบไฟล์ไม่สำเร็จ: " + err.error);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFolder = async (folderType: string) => {
    try {
      await fetch(`/api/open-folder?type=${encodeURIComponent(folderType)}`);
    } catch (error) {
      console.error("Failed to open folder", error);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const allSelected = assets.length > 0 && selectedIds.length === assets.length;

  return (
    <div className="bg-[var(--bg-card)] border-2 border-[var(--border-color)] rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[var(--border-color)] pb-4 gap-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <span>🗄️</span> คลังทรัพยากร (Asset Manager)
          </h3>
          <p className="text-sm opacity-70 mt-1">จัดการไฟล์เสียง วิดีโอ รูปภาพ ที่สร้างไว้ในเครื่อง (ลบเพื่อคืนพื้นที่)</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
             onClick={fetchAssets}
             disabled={loading}
             className="px-4 py-2 border border-[var(--border-color)] rounded-lg text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
          >
             🔄 รีเฟรช
          </button>
          <div className="w-px h-6 bg-[var(--border-color)]"></div>
          <button onClick={() => handleOpenFolder('Voice_stock')} className="px-3 py-2 bg-pink-50 text-pink-700 rounded-lg text-xs font-semibold border border-pink-100 hover:bg-pink-100 dark:bg-pink-900/30 dark:border-pink-800 dark:text-pink-300">📂 Voice_stock</button>
          <button onClick={() => handleOpenFolder('Sound_stock')} className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold border border-blue-100 hover:bg-blue-100 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300">📂 Sound_stock</button>
          <button onClick={() => handleOpenFolder('Image_stock')} className="px-3 py-2 bg-orange-50 text-orange-700 rounded-lg text-xs font-semibold border border-orange-100 hover:bg-orange-100 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-300">📂 Image_stock</button>
          <button onClick={() => handleOpenFolder('Video_stock')} className="px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold border border-purple-100 hover:bg-purple-100 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300">📂 Video_stock</button>
          <button onClick={() => handleOpenFolder('Font_stock')} className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-100 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300">📂 Font_stock</button>
        </div>
        
        <button 
           onClick={handleDeleteSelected}
           disabled={selectedIds.length === 0 || loading}
           className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
           🗑️ ลบที่เลือก ({selectedIds.length})
        </button>
      </div>

      {/* Asset Table */}
      <div className="border border-[var(--border-color)] rounded-xl overflow-hidden overflow-y-auto max-h-[400px]">
         <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--bg-main)] sticky top-0 border-b border-[var(--border-color)] shadow-sm">
               <tr>
                  <th className="px-4 py-3 w-10">
                     <input 
                       type="checkbox" 
                       checked={allSelected} 
                       onChange={handleSelectAll}
                       className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                     />
                  </th>
                  <th className="px-4 py-3 font-semibold w-24">ประเภท</th>
                  <th className="px-4 py-3 font-semibold">ชื่อไฟล์</th>
                  <th className="px-4 py-3 font-semibold w-24 text-right">ขนาด</th>
                  <th className="px-4 py-3 font-semibold w-40">วันที่สร้าง</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
               {assets.length === 0 ? (
                  <tr>
                     <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                        {loading ? '⏳ กำลังโหลด...' : '📭 ไม่พบไฟล์ Asset ในระบบ'}
                     </td>
                  </tr>
               ) : (
                  assets.map((asset) => (
                     <tr key={asset.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="px-4 py-2">
                           <input 
                              type="checkbox" 
                              checked={selectedIds.includes(asset.id)}
                              onChange={() => handleToggleSelect(asset.id)}
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                           />
                        </td>
                        <td className="px-4 py-2">
                           <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                              asset.type === 'Voice_stock' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' :
                              asset.type === 'Sound_stock' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 
                              asset.type === 'Image_stock' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 
                              asset.type === 'Font_stock' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                              'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                           }`}>
                              {asset.type.replace('_stock', '')}
                           </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{asset.name}</td>
                        <td className="px-4 py-2 text-right text-xs opacity-80">{formatSize(asset.sizeBytes)}</td>
                        <td className="px-4 py-2 text-xs opacity-80">{new Date(asset.createdAt).toLocaleString('th-TH')}</td>
                     </tr>
                  ))
               )}
            </tbody>
         </table>
      </div>
    </div>
  );
}
