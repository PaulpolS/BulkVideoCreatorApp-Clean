import React, { useState } from 'react';
import { DiaryCalendar } from './DiaryCalendar';
import { DiaryTodoList } from './DiaryTodoList';
import { DiaryNotes } from './DiaryNotes';

type DiarySubTab = 'calendar' | 'todo' | 'notes';

const SUB_TABS: { id: DiarySubTab; icon: string; label: string }[] = [
  { id: 'calendar', icon: '📅', label: 'Calendar' },
  { id: 'todo', icon: '✅', label: 'Todo List' },
  { id: 'notes', icon: '📝', label: 'Notes' },
];

export function DiaryTab() {
  const [activeSubTab, setActiveSubTab] = useState<DiarySubTab>('calendar');

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Sub-tab navigation */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: 'var(--bg-card)',
        borderRadius: 16,
        border: '1px solid var(--border-color)',
        marginBottom: 24,
        width: 'fit-content',
      }}>
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            style={{
              padding: '10px 24px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: activeSubTab === tab.id ? 700 : 500,
              background: activeSubTab === tab.id
                ? 'linear-gradient(135deg, #f59e0b, #f97316)'
                : 'transparent',
              color: activeSubTab === tab.id ? '#fff' : 'var(--text-main)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: activeSubTab === tab.id ? 1 : 0.6,
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="animate-fade-in" key={activeSubTab}>
        {activeSubTab === 'calendar' && <DiaryCalendar />}
        {activeSubTab === 'todo' && <DiaryTodoList />}
        {activeSubTab === 'notes' && <DiaryNotes />}
      </div>
    </div>
  );
}
