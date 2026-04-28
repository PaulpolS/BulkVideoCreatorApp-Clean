import React from 'react';

export function Card({ children, className = '', style = {} }: { children: React.ReactNode, className?: string, style?: React.CSSProperties }) {
  return (
    <div 
      className={`p-6 rounded-2xl shadow-sm border transition-colors duration-200 ${className}`}
      style={{ 
        backgroundColor: 'var(--bg-card)', 
        borderColor: 'var(--border-color)',
        color: 'var(--text-main)',
        ...style
      }}
    >
      {children}
    </div>
  );
}
