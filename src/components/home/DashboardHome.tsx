import React, { useState } from 'react';
import { TabId, NAV_GROUPS } from '../layout/Sidebar';

interface DashboardHomeProps {
  onNavigate: (tab: TabId) => void;
}

interface GuideItem {
  id: TabId;
  icon: string;
  title: string;
  desc: string;
  color: string;
  steps: string[];
}

const TOOL_GUIDES: GuideItem[] = [
  {
    id: 'singleclip',
    icon: '✂️',
    title: 'คัตชนคลิป (Single Clip)',
    desc: 'ตัดต่อคลิปเดี่ยว ใส่เอฟเฟกต์ ใส่เพลง ประกอบฉากได้อย่างรวดเร็ว',
    color: '#6366f1',
    steps: [
      'เลือกไฟล์คลิปต้นฉบับ (.mp4)',
      'ตั้งค่าจุด Cut เริ่ม-จบ ของแต่ละ Scene',
      'เลือก Transition, เพลง BGM, และเอฟเฟกต์',
      'กดดาวน์โหลด .command แล้วรันบน Terminal',
    ],
  },
  {
    id: 'bulk',
    icon: '📹',
    title: 'Bulk Video Creator',
    desc: 'สร้างวิดีโอจำนวนมากจาก AI Content พร้อมซับไตเติ้ลอัตโนมัติ',
    color: '#3b82f6',
    steps: [
      'ใช้ AI สร้างเนื้อหา (ข้อความ + คำคม)',
      'เลือกหลายรายการจากคลัง Stock',
      'ตั้งค่า Template วิดีโอ (ขนาด, ฟอนต์, สี)',
      'กด Render Bulk — ระบบจะผลิตให้ทั้งหมด',
    ],
  },
  {
    id: 'financial',
    icon: '🎙️',
    title: 'สตูดิโอเล่าเรื่อง',
    desc: 'สร้างคลิปเล่าเรื่อง สาระความรู้ สารคดี พร้อมสร้าง Scene อัตโนมัติ',
    color: '#f97316',
    steps: [
      'ใส่เนื้อเรื่องหรือ Script ที่ต้องการ',
      'AI จะแบ่ง Scene + แนะนำ Prompt สร้างวิดีโอ',
      'เลือก SFX, เสียงพากย์, เพลงประกอบ',
      'Export สคริปต์ไปรันสร้างคลิปจริง',
    ],
  },
  {
    id: 'clone',
    icon: '🖼️',
    title: 'โคลนนิ่งเพจ',
    desc: 'วิเคราะห์สไตล์ภาพจากตัวอย่าง แล้วสร้าง Prompt โคลนสไตล์ได้ทันที',
    color: '#f59e0b',
    steps: [
      'อัปโหลดรูปตัวอย่างที่ต้องการโคลน',
      'AI จะวิเคราะห์สไตล์สี แสง องค์ประกอบ',
      'ใส่ข้อความ/แคปชัน ที่ต้องการ',
      'ระบบสร้าง Prompt พร้อมใช้ใน AI Generator',
    ],
  },
  {
    id: 'avatar',
    icon: '👨‍🎨',
    title: 'สร้างอวาตาร์ PNGTuber',
    desc: 'ออกแบบตัวละคร PNGTuber พร้อม Expression ต่างๆ',
    color: '#ec4899',
    steps: [
      'เลือกสไตล์ตัวละคร (อนิเมะ, เรียลลิสต์, การ์ตูน)',
      'ตั้งค่า Expression: ปกติ, ยิ้ม, ตกใจ, โกรธ',
      'ใส่องค์ประกอบเสริม (หมวก, แว่น, พื้นหลัง)',
      'Export PNG แยกชั้นสำหรับ OBS/Streaming',
    ],
  },
  {
    id: 'horoscope',
    icon: '🔮',
    title: 'เครื่องสร้างดวงรายวัน',
    desc: 'สร้างรูปไพ่ทาโรต์ สร้างไพ่ AI และจัดการธีมสีสำหรับดวงรายวัน',
    color: '#a855f7',
    steps: [
      'เลือกธีมสี (Built-in หรือ Custom)',
      'ตั้งค่า CSV ข้อมูลดวง + ช่วงแถว',
      'กดสร้าง PNG / AI Card ได้ตามต้องการ',
      'ดาวน์โหลดไพ่ Rider-Waite ต้นฉบับได้ในหน้า Download',
    ],
  },
  {
    id: 'news',
    icon: '🗞️',
    title: 'ค้นหาContent น่าสนใจ',
    desc: 'ดึงข่าวจากเว็บไซต์ / ดึง Script จาก YouTube พร้อมแคปรูปภาพ',
    color: '#ef4444',
    steps: [
      'เลือกแหล่งข่าว RSS ที่ต้องการ',
      'ระบบจะดึงข่าวล่าสุดมาแสดง',
      'AI แปลข่าวเป็นภาษาไทยแบบสั้นๆ',
      'ให้คะแนนความน่าสนใจ แล้วส่งไป Stock ได้เลย',
    ],
  },
  {
    id: 'automator',
    icon: '🚀',
    title: 'รันบอท Flow',
    desc: 'ระบบ Auto สำหรับ Google Flow — รัน prompt อัตโนมัติแบบ Bulk',
    color: '#f43f5e',
    steps: [
      'เปิดหน้า Google Flow ใน Chrome',
      'ตั้งค่า Prompt Queue ที่ต้องการเจน',
      'ระบบจะหน่วงเวลาเรียก AI ให้อัตโนมัติ',
      'ดาวน์โหลดผลลัพธ์ได้ทันทีเมื่อเสร็จ',
    ],
  },
  {
    id: 'lazada',
    icon: '🛒',
    title: 'Lazada Affiliate',
    desc: 'สร้างคอนเทนต์โปรโมตสินค้า Lazada แบบ Affiliate',
    color: '#14b8a6',
    steps: [
      'อัปโหลดไฟล์ Excel รายการสินค้า',
      'ระบบจะดึงรูปภาพและรายละเอียดสินค้า',
      'สร้าง Caption + Prompt สำหรับโพสต์',
      'Export ออกเป็นชุดพร้อมใช้ทันที',
    ],
  },
  {
    id: 'assets',
    icon: '📂',
    title: 'คลังแสง (Assets)',
    desc: 'จัดการไฟล์ Assets ต่างๆ เสียง เพลง ฟุตเทจ สำหรับใช้งานในโปรเจกต์',
    color: '#8b5cf6',
    steps: [
      'เพิ่มไฟล์เสียง, เพลง, หรือฟุตเทจ',
      'ตั้งค่า Path ระบบไฟล์บน macOS',
      'จัดหมวดหมู่ตามโปรเจกต์',
      'เรียกใช้ได้จากทุก Tab อื่นๆ',
    ],
  },
  {
    id: 'tracking',
    icon: '📊',
    title: 'ติดตามงาน',
    desc: 'แดชบอร์ดภาพรวมงาน, Kanban Todo, ซิงค์ Google Sheets สด',
    color: '#0ea5e9',
    steps: [
      'ใส่ Google API Key เพื่อเชื่อมต่อ',
      'ระบบจะดึง Stock จาก Sheets อัตโนมัติ',
      'ใช้ Kanban Board จัดการ Todo List',
      'ดูกราฟ Stock รวมของแต่ละคน',
    ],
  },
];

export function DashboardHome({ onNavigate }: DashboardHomeProps) {
  const [expandedGuide, setExpandedGuide] = useState<TabId | null>(null);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? '🌅 สวัสดีตอนเช้า' : hour < 17 ? '☀️ สวัสดีตอนบ่าย' : '🌙 สวัสดีตอนเย็น';
  const dateStr = now.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="dashboard-home">
      {/* Hero Section */}
      <div className="dash-hero">
        <div className="dash-hero-inner">
          <div className="dash-hero-text">
            <h1 className="dash-hero-greeting">{greeting}</h1>
            <p className="dash-hero-date">{dateStr}</p>
            <p className="dash-hero-subtitle">เลือกเครื่องมือด้านล่าง หรือกดเมนูทางซ้ายเพื่อเริ่มทำงานได้เลย</p>
          </div>
          <div className="dash-hero-stats">
            <div className="dash-stat">
              <span className="dash-stat-num">{TOOL_GUIDES.length}</span>
              <span className="dash-stat-label">เครื่องมือ</span>
            </div>
            <div className="dash-stat">
              <span className="dash-stat-num">∞</span>
              <span className="dash-stat-label">ความเป็นไปได้</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Grid */}
      <h2 className="dash-section-title">⚡ เครื่องมือทั้งหมด & คู่มือการใช้งาน</h2>
      <div className="dash-tools-grid">
        {TOOL_GUIDES.map((tool) => {
          const isExpanded = expandedGuide === tool.id;
          return (
            <div
              key={tool.id}
              className={`dash-tool-card ${isExpanded ? 'dash-tool-card-expanded' : ''}`}
              style={{ '--tool-color': tool.color } as React.CSSProperties}
            >
              <div className="dash-tool-header" onClick={() => setExpandedGuide(isExpanded ? null : tool.id)}>
                <div className="dash-tool-icon-wrap" style={{ background: `${tool.color}20` }}>
                  <span className="dash-tool-icon">{tool.icon}</span>
                </div>
                <div className="dash-tool-info">
                  <h3 className="dash-tool-title">{tool.title}</h3>
                  <p className="dash-tool-desc">{tool.desc}</p>
                </div>
                <span className={`dash-tool-chevron ${isExpanded ? 'dash-tool-chevron-open' : ''}`}>▾</span>
              </div>

              {isExpanded && (
                <div className="dash-tool-guide">
                  <div className="dash-guide-steps">
                    <p className="dash-guide-label">📖 ขั้นตอนการใช้งาน:</p>
                    <ol className="dash-guide-list">
                      {tool.steps.map((step, i) => (
                        <li key={i} className="dash-guide-step">
                          <span className="dash-guide-num" style={{ background: tool.color }}>{i + 1}</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <button
                    className="dash-tool-open-btn"
                    style={{ background: tool.color }}
                    onClick={(e) => { e.stopPropagation(); onNavigate(tool.id); }}
                  >
                    เปิดเครื่องมือ →
                  </button>
                </div>
              )}

              {!isExpanded && (
                <button
                  className="dash-tool-quick-btn"
                  style={{ color: tool.color }}
                  onClick={(e) => { e.stopPropagation(); onNavigate(tool.id); }}
                >
                  เปิด →
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Keyboard Shortcuts */}
      <div className="dash-shortcuts">
        <h3 className="dash-shortcuts-title">💡 Tips</h3>
        <div className="dash-tips-grid">
          <div className="dash-tip">✦ กดปุ่ม <kbd>☰</kbd> ที่ Sidebar เพื่อย่อ/ขยายเมนู</div>
          <div className="dash-tip">✦ ทุก Tab จะเก็บสถานะไว้ใน localStorage ไม่หายเมื่อรีเฟรช</div>
          <div className="dash-tip">✦ ระบบผลิตคลิปใช้การสร้างไฟล์ <code>.command</code> สำหรับ macOS</div>
          <div className="dash-tip">✦ เปลี่ยนธีมสีได้ที่มุมขวาบน — มีหลายธีมให้เลือก</div>
        </div>
      </div>
    </div>
  );
}
