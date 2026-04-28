import React, { useState } from 'react';
import { useTheme, Theme } from '../../context/ThemeContext';

const themes: {
  id: Theme;
  icon: string;
  label: string;
  desc: string;
  bg: string;
  card: string;
  accent: string;
  ring: string;
}[] = [
  {
    id: 'linear',
    icon: '💜',
    label: 'Linear',
    desc: 'Starlight Dark',
    bg: '#08090a',
    card: '#0f1011',
    accent: '#5e6ad2',
    ring: '#7170ff',
  },
  {
    id: 'raycast',
    icon: '🔴',
    label: 'Raycast',
    desc: 'Obsidian',
    bg: '#07080a',
    card: '#101111',
    accent: '#FF6363',
    ring: '#ff8a8a',
  },
  {
    id: 'supabase',
    icon: '🟢',
    label: 'Supabase',
    desc: 'Terminal',
    bg: '#171717',
    card: '#1a1a1a',
    accent: '#3ecf8e',
    ring: '#00c573',
  },
  {
    id: 'midnight',
    icon: '🌙',
    label: 'Midnight',
    desc: 'Deep Dark',
    bg: '#09090b',
    card: '#18181b',
    accent: '#8b5cf6',
    ring: '#a78bfa',
  },
  {
    id: 'neon',
    icon: '⚡',
    label: 'Neon',
    desc: 'Cyber Gold',
    bg: '#111111',
    card: '#1a1a1a',
    accent: '#eab308',
    ring: '#facc15',
  },
  {
    id: 'cyberpunk',
    icon: '🦾',
    label: 'Cyberpunk',
    desc: 'Violet Night',
    bg: '#0c0a20',
    card: '#16123a',
    accent: '#00ffcc',
    ring: '#ff0055',
  },
  {
    id: 'ferrari',
    icon: '🏎️',
    label: 'Ferrari',
    desc: 'Rosso Corsa',
    bg: '#0b0b0b',
    card: '#1a1a1a',
    accent: '#e8423f',
    ring: '#ff5b4f',
  },
  {
    id: 'spotify',
    icon: '🎵',
    label: 'Spotify',
    desc: 'Immersive Dark',
    bg: '#121212',
    card: '#181818',
    accent: '#1ed760',
    ring: '#1db954',
  },
  {
    id: 'stripe',
    icon: '💳',
    label: 'Stripe',
    desc: 'Indigo Night',
    bg: '#0d253d',
    card: '#1c1e54',
    accent: '#533afd',
    ring: '#665efd',
  },
];

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const current = themes.find(t => t.id === theme) || themes[0];

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80"
        style={{
          background: `linear-gradient(135deg, ${current.card}, ${current.bg})`,
          border: `1px solid ${current.ring}44`,
          color: current.accent,
          boxShadow: `0 0 12px ${current.accent}22`,
        }}
        title="เปลี่ยนธีม"
      >
        <span className="text-base">{current.icon}</span>
        <span style={{ color: 'var(--text-main)', opacity: 0.85 }}>{current.label}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
          className="transition-transform"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.5 }}
        >
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div
            className="absolute right-0 top-full mt-2 z-50 rounded-2xl p-2 shadow-2xl"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              minWidth: '220px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-widest px-2 pb-2 opacity-40" style={{ color: 'var(--text-main)' }}>
              เลือกธีม
            </div>
            <div className="flex flex-col gap-1">
              {themes.map(t => {
                const isActive = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => { setTheme(t.id); setIsOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:opacity-100"
                    style={{
                      background: isActive
                        ? `linear-gradient(135deg, ${t.card}cc, ${t.bg}cc)`
                        : 'transparent',
                      border: isActive ? `1px solid ${t.ring}55` : '1px solid transparent',
                      opacity: isActive ? 1 : 0.7,
                    }}
                  >
                    {/* Color preview dot */}
                    <div className="flex gap-1 shrink-0">
                      <div className="w-3 h-3 rounded-full" style={{ background: t.bg, border: `1px solid ${t.accent}88` }} />
                      <div className="w-3 h-3 rounded-full" style={{ background: t.accent }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{t.icon}</span>
                        <span className="text-xs font-bold" style={{ color: isActive ? t.accent : 'var(--text-main)' }}>
                          {t.label}
                        </span>
                      </div>
                      <div className="text-[10px] opacity-50" style={{ color: 'var(--text-main)' }}>
                        {t.desc}
                      </div>
                    </div>

                    {isActive && (
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: t.accent, boxShadow: `0 0 6px ${t.accent}` }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom tag */}
            <div className="mt-2 pt-2 px-2 border-t text-[9px] opacity-25 text-center" style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
              awesome-design-md inspired
            </div>
          </div>
        </>
      )}
    </div>
  );
}
