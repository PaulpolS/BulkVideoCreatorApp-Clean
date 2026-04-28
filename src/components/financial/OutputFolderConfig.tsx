import React, { useState, useEffect } from 'react';

export function OutputFolderConfig() {
  const [outputFolder, setOutputFolder] = useState(() => localStorage.getItem('custom_output_folder') || '/Users/macos/Desktop/Done');

  const handleOutputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setOutputFolder(val);
    localStorage.setItem('custom_output_folder', val);
  };

  const handleOpenFolder = async () => {
    try {
      await fetch(`/api/open-folder?type=${encodeURIComponent(outputFolder)}`);
    } catch (error) {
      console.error("Failed to open folder", error);
    }
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h3 className="font-bold text-lg flex items-center gap-2">
           <span className="text-xl">📁</span> ปลายทางวิดีโอ (Output Folder)
        </h3>
        <p className="text-sm opacity-70 mt-1">ที่อยู่เดสก์ท็อปหรือโฟลเดอร์สำหรับส่งออกไฟล์วิดีโอ (เมื่อกด Render)</p>
      </div>
      
      <div className="flex bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 rounded-xl border border-indigo-200 dark:border-indigo-800 gap-3 items-center w-full md:w-auto">
        <span className="text-sm font-bold text-indigo-800 dark:text-indigo-400 whitespace-nowrap">Output Path:</span>
        <input 
          type="text" 
          value={outputFolder} 
          onChange={handleOutputChange}
          placeholder="/Users/name/Desktop/Done"
          className="flex-1 md:w-[300px] px-3 py-1.5 text-sm rounded bg-white dark:bg-black border border-indigo-200 dark:border-indigo-700 focus:outline-none focus:border-indigo-500 font-mono"
        />
        <button 
          onClick={handleOpenFolder}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-colors whitespace-nowrap shadow-sm"
          title="เปิดโฟลเดอร์ปลายทางด้วย Finder"
        >
          เปิดดู
        </button>
      </div>
    </div>
  );
}
