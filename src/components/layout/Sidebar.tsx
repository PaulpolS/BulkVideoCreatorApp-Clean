import React from 'react';

export type TabId = 'home' | 'singleclip' | 'bulk' | 'financial' | 'news' | 'articlestock' | 'pagestock' | 'assets' | 'avatar' | 'clone' | 'automator' | 'lazada' | 'horoscope' | 'tracking' | 'radar' | 'cleaner' | 'scanner' | 'prompt' | 'autoeditor' | 'course' | 'canvas' | 'aipage';

interface NavGroup {
  label: string;
  icon: string;
  items: { id: TabId; icon: string; label: string; color: string; featured?: boolean }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'หน้าหลัก',
    icon: '🏠',
    items: [
      { id: 'home', icon: '📋', label: 'Dashboard', color: '#6366f1' },
    ],
  },
  {
    label: 'ตัดต่อ & ผลิตคลิป',
    icon: '🎬',
    items: [
      { id: 'singleclip', icon: '✂️', label: 'คัตชนคลิป', color: '#6366f1' },
      { id: 'bulk', icon: '📹', label: 'Bulk Creator', color: '#3b82f6' },
      { id: 'financial', icon: '🎙️', label: 'คลิปเล่าเรื่อง', color: '#f97316' },
    ],
  },
  {
    label: 'สร้างคอนเทนต์',
    icon: '✨',
    items: [
      { id: 'clone', icon: '🖼️', label: 'โคลนนิ่งเพจ', color: '#f59e0b' },
      { id: 'avatar', icon: '👨‍🎨', label: 'อวาตาร์ PNGTuber', color: '#ec4899' },
      { id: 'horoscope', icon: '🔮', label: 'ดวงรายวัน', color: '#a855f7' },
      { id: 'prompt', icon: '📝', label: 'Video Prompt Generator', color: '#f43f5e' },
      { id: 'aipage', icon: '🤖', label: 'สร้างContentลงเพจ', color: '#8b5cf6', featured: true },
      { id: 'pagestock', icon: '📮', label: 'ทำStockลงเพจ', color: '#f59e0b', featured: true },
      { id: 'canvas', icon: '🎨', label: 'Canvas Editor', color: '#f472b6' },
      { id: 'course', icon: '🎓', label: 'สร้างคอร์สออนไลน์', color: '#10b981' },
    ],
  },
  {
    label: '📓 ไดอารี่',
    icon: '📓',
    items: [
      { id: 'autoeditor', icon: '🎬', label: 'Auto Editor', color: '#eab308' },
    ],
  },
  {
    label: 'เครื่องมือ & บอท',
    icon: '🤖',
    items: [
      { id: 'radar', icon: '🕵️‍♂️', label: 'เรดาร์คู่แข่ง', color: '#10b981', featured: true },
      { id: 'news', icon: '🔍', label: 'ค้นหาContent น่าสนใจ', color: '#ef4444', featured: true },
      { id: 'articlestock', icon: '📦', label: 'คลังบทความ', color: '#06b6d4', featured: true },
      { id: 'automator', icon: '🚀', label: 'รันบอท Flow', color: '#f43f5e' },
      { id: 'lazada', icon: '🛒', label: 'Lazada Affiliate', color: '#14b8a6' },
    ],
  },
  {
    label: 'จัดการระบบ',
    icon: '⚙️',
    items: [
      { id: 'assets', icon: '📂', label: 'คลังแสง Assets', color: '#8b5cf6' },
      { id: 'tracking', icon: '📊', label: 'ติดตามงาน', color: '#0ea5e9' },
    ],
  },
  {
    label: 'ความสะอาด & ปลอดภัย',
    icon: '🛡️',
    items: [
      { id: 'cleaner', icon: '🧹', label: 'เคลียขยะเครื่อง', color: '#6366f1' },
      { id: 'scanner', icon: '🛡️', label: 'สแกนไวรัส', color: '#ef4444' },
    ],
  },
];

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ activeTab, onTabChange, collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <aside
      className={`sidebar-root ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}
    >
      {/* Logo / Header */}
      <div className="sidebar-header">
        {!collapsed && (
          <div className="sidebar-logo">
            <span className="sidebar-logo-icon">⚡</span>
            <div className="sidebar-logo-text">
              <span className="sidebar-logo-title">CreatorHub</span>
              <span className="sidebar-logo-sub">Production Suite</span>
            </div>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="sidebar-toggle"
          title={collapsed ? 'ขยาย Sidebar' : 'ย่อ Sidebar'}
        >
          {collapsed ? '☰' : '✕'}
        </button>
      </div>

      {/* Nav Groups */}
      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="sidebar-group">
            {!collapsed && (
              <div className="sidebar-group-label">
                <span>{group.icon}</span>
                <span>{group.label}</span>
              </div>
            )}
            {group.items.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`sidebar-item ${item.featured ? 'sidebar-item-featured' : ''} ${isActive ? 'sidebar-item-active' : ''}`}
                  title={collapsed ? item.label : undefined}
                  style={{ '--item-color': item.color } as React.CSSProperties}
                >
                  <span className="sidebar-item-icon">{item.icon}</span>
                  {!collapsed && <span className="sidebar-item-label">{item.label}</span>}
                  {isActive && !collapsed && <span className="sidebar-item-dot" style={{ background: item.color }} />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="sidebar-footer">
          <span className="sidebar-footer-text">v2.0 — All-in-One</span>
        </div>
      )}
    </aside>
  );
}

export { NAV_GROUPS };
