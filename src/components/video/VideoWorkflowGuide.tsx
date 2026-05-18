import React from 'react';
import { TabId } from '../layout/Sidebar';

const VIDEO_WORKFLOW_ITEMS: {
  id: TabId;
  icon: string;
  title: string;
  desc: string;
  bestFor: string;
  badge: string;
  color: string;
}[] = [
  {
    id: 'singleclip',
    icon: '✂️',
    title: 'ตัด/สุ่มต่อคลิป',
    desc: 'คัตชนคลิปด้วยสูตร FFmpeg หรือสุ่มต่อคลิปจากโฟลเดอร์ให้ได้ความยาวที่ต้องการ',
    bestFor: 'มีไฟล์วิดีโอในเครื่องแล้ว อยากตัด/ต่อเร็ว',
    badge: 'ใช้บ่อย',
    color: '#6366f1',
  },
  {
    id: 'stockclip',
    icon: '🎞️',
    title: 'คลิป Stock จากเสียง',
    desc: 'เลือกคลังวิดีโอ + โฟลเดอร์เสียง แล้วให้ระบบต่อคลิปตามความยาวไฟล์เสียงทีละไฟล์',
    bestFor: 'ทำคลิปประกอบเสียง/voice หลายไฟล์',
    badge: 'สายผลิตจำนวนมาก',
    color: '#14b8a6',
  },
  {
    id: 'autoeditor',
    icon: '🎬',
    title: 'AI รวมคลิปเป็นเรื่อง',
    desc: 'ให้ AI อ่านชื่อไฟล์/ภาพตัวอย่าง จับกลุ่มคลิปเป็นเรื่อง แล้ว render รวมพร้อมฟิลเตอร์ลดรอย AI',
    bestFor: 'มีคลิปย่อยจำนวนมากและอยากให้ AI เรียงเรื่อง',
    badge: 'Auto Director',
    color: '#eab308',
  },
  {
    id: 'financial',
    icon: '🎙️',
    title: 'Documentary Studio',
    desc: 'สร้างคลิปเล่าเรื่องแบบมี scene, asset, prompt และโครงสารคดี',
    bestFor: 'คลิปเล่าเรื่องยาว/การเงิน/สารคดี',
    badge: 'Story-driven',
    color: '#f97316',
  },
  {
    id: 'bulk',
    icon: '📹',
    title: 'Bulk Creator เก่า',
    desc: 'ระบบ bulk รุ่นแรกที่ยังเก็บไว้สำหรับงานเดิมและ compatibility',
    bestFor: 'งานเก่าที่ยังอิง workflow เดิม',
    badge: 'Legacy',
    color: '#3b82f6',
  },
];

export function VideoWorkflowGuide({ currentTab, onNavigate }: { currentTab: TabId; onNavigate: (tab: TabId) => void }) {
  return (
    <div className="mb-6 rounded-2xl border p-5 shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mb-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400 mb-2">Video Production Hub</div>
          <h1 className="text-2xl font-black">🎬 เลือกเครื่องมือตัดต่อให้ตรงงาน</h1>
          <p className="text-sm opacity-70 mt-1 max-w-3xl">
            กลุ่มนี้คือเครื่องมือเกี่ยวกับคลิปทั้งหมด แยกตามงานจริง: ตัด/ต่อไฟล์, ทำคลิปตามเสียง, ให้ AI รวมคลิป, ทำสารคดี หรือใช้ระบบ bulk เก่า
          </p>
        </div>
        <div className="rounded-xl border px-4 py-3 text-xs leading-relaxed" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(245,158,11,0.08)' }}>
          <div className="font-bold text-amber-300 mb-1">เริ่มเร็ว</div>
          <div className="opacity-75">ไม่แน่ใจใช้อันไหน ให้เริ่มจาก “ตัด/สุ่มต่อคลิป” ถ้าเป็นไฟล์วิดีโอทั่วไป หรือ “คลิป Stock จากเสียง” ถ้ามีไฟล์เสียงนำทาง</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {VIDEO_WORKFLOW_ITEMS.map(item => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`text-left rounded-xl border p-4 transition-all ${isActive ? 'ring-2 shadow-lg' : 'hover:translate-y-[-1px]'}`}
              style={{
                borderColor: isActive ? item.color : 'var(--border-color)',
                backgroundColor: isActive ? `${item.color}22` : 'rgba(255,255,255,0.02)',
                boxShadow: isActive ? `0 12px 30px ${item.color}18` : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full border" style={{ borderColor: item.color, color: item.color }}>
                  {item.badge}
                </span>
              </div>
              <div className="font-black text-sm mb-1">{item.title}</div>
              <div className="text-xs opacity-70 leading-relaxed mb-3">{item.desc}</div>
              <div className="text-[11px] font-bold opacity-80">เหมาะกับ: {item.bestFor}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
