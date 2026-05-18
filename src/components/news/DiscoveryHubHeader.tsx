import React from 'react';
import { Card } from '../ui/Card';

export type DiscoveryModeId = 'rss' | 'youtube' | 'github' | 'celebrity';

const DISCOVERY_MODES: Array<{
  id: DiscoveryModeId;
  icon: string;
  title: string;
  desc: string;
  flow: string;
}> = [
  {
    id: 'rss',
    icon: '🗞️',
    title: 'RSS / ข่าว',
    desc: 'หาเรื่องสดจากเว็บข่าว แปลหัวข้อ ให้คะแนน แล้วเก็บเข้าคลัง',
    flow: 'สแกนข่าว → แปล/ให้คะแนน → เก็บเข้าคลัง Content',
  },
  {
    id: 'youtube',
    icon: '▶️',
    title: 'YouTube',
    desc: 'หาเคสจริงจาก keyword แล้วดึง script + รูปจากคลิป',
    flow: 'ค้นคลิป → ดึง script/รูป → เก็บเข้าคลัง Content',
  },
  {
    id: 'github',
    icon: '🐙',
    title: 'GitHub',
    desc: 'หา repo มาแรง เครื่องมือ AI และ dev story สำหรับทำโพสต์',
    flow: 'หา repo → ดึง README → เก็บเข้าคลัง Content',
  },
  {
    id: 'celebrity',
    icon: '💬',
    title: 'คำสอนคนดัง',
    desc: 'คลังแนวคิด/คำคม ใช้เป็นวัตถุดิบสร้างคอนเทนต์เฉพาะทาง',
    flow: 'เลือกคนดัง → เตรียมเนื้อหา → ส่งต่อสายสร้าง Content',
  },
];

export function DiscoveryHubHeader({
  activeMode,
  onModeChange,
}: {
  activeMode: DiscoveryModeId;
  onModeChange: (mode: DiscoveryModeId) => void;
}) {
  return (
    <Card>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
        <div>
          <div className="text-xs font-bold text-cyan-300 uppercase tracking-wide mb-1">Discovery Hub</div>
          <h1 className="text-2xl font-black text-gray-100">🔍 หา Content น่าแชร์</h1>
          <p className="text-sm text-gray-400 mt-1">
            จุดเริ่มต้นของงาน: หาเรื่องจากหลายแหล่ง แล้วเก็บเข้า <span className="text-cyan-300 font-bold">คลัง Content</span> ก่อนนำไปสร้างโพสต์/ภาพ/คลิป
          </p>
        </div>
        <div className="text-xs text-gray-500 bg-black/25 border border-gray-700/60 rounded-lg px-3 py-2">
          Workflow: หาเจอ → ดึงข้อมูล → เก็บเข้าคลัง Content → ส่งไปสร้าง
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {DISCOVERY_MODES.map(mode => {
          const active = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onModeChange(mode.id)}
              className={`text-left rounded-xl border p-4 transition-all ${
                active
                  ? 'border-cyan-400 bg-cyan-500/15 shadow-lg shadow-cyan-500/10'
                  : 'border-gray-700/60 bg-black/20 hover:border-cyan-500/40'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{mode.icon}</span>
                <span className={`text-sm font-black ${active ? 'text-white' : 'text-gray-200'}`}>{mode.title}</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{mode.desc}</p>
              <div className="mt-3 text-[10px] text-cyan-300/80 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2 py-1">
                {mode.flow}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
