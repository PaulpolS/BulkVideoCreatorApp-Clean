import React from 'react';
import { PromptGenerator } from './PromptGenerator';
import { SFXGenerator } from './SFXGenerator';
import { AssetManager } from './AssetManager';

export function AssetManagementTab() {
  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6 animate-fade-in pb-12">
      
      {/* Header section with Stats or Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">โฟลเดอร์ Stock ของคุณ</h3>
              <span className="text-xl">📁</span>
            </div>
            <ul className="space-y-4 text-sm text-gray-600 dark:text-gray-400 font-medium">
              <li className="flex items-center gap-3">
                <span className="p-2 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-lg">🎤</span> 
                Voice_stock (เสียงพากย์)
              </li>
              <li className="flex items-center gap-3">
                <span className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">🎵</span> 
                Sound_stock (เสียงเอฟเฟค/SFX)
              </li>
              <li className="flex items-center gap-3">
                <span className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">📹</span> 
                Video_stock (คลิปสต็อก)
              </li>
              <li className="flex items-center gap-3">
                <span className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">🖼️</span> 
                Image_stock (รูปภาพ)
              </li>
            </ul>
          </div>
          <p className="text-xs mt-6 text-indigo-500 bg-indigo-50 dark:bg-indigo-900/10 p-3 rounded-xl border border-indigo-200 dark:border-indigo-900">
            *ระบบจัดการไฟล์และไอเดียต่างๆ อยู่ที่นี่ สามารถสร้างและจัดการนำไปใช้ในคลิปได้เลย
          </p>
        </div>

        <div className="md:col-span-2 space-y-6">
           <PromptGenerator />
           <SFXGenerator />
        </div>
      </div>

      {/* Media Management */}
      <div>
        <AssetManager />
      </div>

    </div>
  );
}
