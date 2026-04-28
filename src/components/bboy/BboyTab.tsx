import React, { useState } from 'react';
import { TrainingSchedule } from './TrainingSchedule';
import { MoveLibrary } from './MoveLibrary';
import { WorkoutPlan } from './WorkoutPlan';
import { HealthTracker } from './HealthTracker';
import { AICoach } from './AICoach';
import { DisciplineBoard } from './DisciplineBoard';

type BboySubTab = 'schedule' | 'moves' | 'workout' | 'health' | 'coach' | 'discipline';

const SUB_TABS: { id: BboySubTab; icon: string; label: string }[] = [
  { id: 'schedule', icon: '📋', label: 'ตารางซ้อม' },
  { id: 'moves', icon: '🎬', label: 'คลังท่าเต้น' },
  { id: 'workout', icon: '💪', label: 'ออกกำลังกาย' },
  { id: 'health', icon: '📊', label: 'สุขภาพ' },
  { id: 'coach', icon: '🤖', label: 'AI โค้ช' },
  { id: 'discipline', icon: '🔥', label: 'วินัย' },
];

export function BboyTab() {
  const [activeSubTab, setActiveSubTab] = useState<BboySubTab>('schedule');

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
        flexWrap: 'wrap',
      }}>
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            style={{
              padding: '10px 20px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: activeSubTab === tab.id ? 700 : 500,
              background: activeSubTab === tab.id
                ? 'linear-gradient(135deg, #ef4444, #f97316)'
                : 'transparent',
              color: activeSubTab === tab.id ? '#fff' : 'var(--text-main)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
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
        {activeSubTab === 'schedule' && <TrainingSchedule />}
        {activeSubTab === 'moves' && <MoveLibrary />}
        {activeSubTab === 'workout' && <WorkoutPlan />}
        {activeSubTab === 'health' && <HealthTracker />}
        {activeSubTab === 'coach' && <AICoach />}
        {activeSubTab === 'discipline' && <DisciplineBoard />}
      </div>
    </div>
  );
}
