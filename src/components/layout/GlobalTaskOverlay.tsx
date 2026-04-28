import React from 'react';
import { useBackgroundTasks } from '../../hooks/useBackgroundTasks';

export function GlobalTaskOverlay() {
  const { tasks, removeTask, clearFinished } = useBackgroundTasks();
  const [expanded, setExpanded] = React.useState(true);

  const activeCount = tasks.filter(t => t.status === 'queued' || t.status === 'running').length;
  const latest = [...tasks].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-[9999] border-t shadow-2xl backdrop-blur-xl"
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-card) 94%, transparent)', borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center gap-3 px-4 py-2">
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-7 h-7 rounded border text-xs font-black"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)', backgroundColor: 'var(--surface, transparent)' }}
          title={expanded ? 'ซ่อน Log' : 'เปิด Log'}
        >
          {expanded ? '▾' : '▴'}
        </button>
        <div className="font-bold text-sm whitespace-nowrap" style={{ color: 'var(--text-main)' }}>
          Activity Queue
        </div>
        <span
          className="text-[11px] px-2 py-0.5 rounded-full font-bold"
          style={{
            backgroundColor: activeCount > 0 ? 'rgba(59,130,246,0.18)' : 'var(--surface, rgba(128,128,128,0.14))',
            color: activeCount > 0 ? '#60a5fa' : 'var(--text-muted, #888)',
          }}
        >
          {activeCount > 0 ? `กำลังทำ/รอ ${activeCount}` : 'ว่าง'}
        </span>
        <div className="min-w-0 flex-1 text-xs truncate" style={{ color: 'var(--text-muted, #888)' }}>
          {latest ? `${latest.title}: ${latest.progress}` : 'ไม่มีงาน'}
        </div>
        <button onClick={clearFinished} className="text-xs px-3 py-1 rounded border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted, #888)' }}>
          ล้างที่เสร็จแล้ว
        </button>
      </div>

      {expanded && tasks.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 px-4 pb-3 max-h-64 overflow-y-auto custom-scrollbar">
          {tasks.map(task => (
            <div
              key={task.id}
              className="rounded-lg border p-3 min-w-0"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor:
                  task.status === 'error' ? '#ef4444' :
                  task.status === 'completed' ? '#10b981' :
                  task.status === 'cancelled' ? '#f59e0b' :
                  task.status === 'running' ? '#3b82f6' : 'var(--border-color)',
              }}
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      task.status === 'running' ? '#3b82f6' :
                      task.status === 'queued' ? '#a855f7' :
                      task.status === 'completed' ? '#10b981' :
                      task.status === 'cancelled' ? '#f59e0b' : '#ef4444',
                    animation: task.status === 'running' ? 'pulse 1.3s infinite' : undefined,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs truncate" style={{ color: 'var(--text-main)' }}>{task.title}</h4>
                    <span className="text-[9px] uppercase font-black" style={{ color: 'var(--text-muted, #888)' }}>{task.status}</span>
                  </div>
                  <p className="text-[11px] mt-1 truncate" style={{ color: task.status === 'error' ? '#ef4444' : 'var(--text-muted, #888)' }}>{task.progress}</p>
                </div>
                <button
                  onClick={() => removeTask(task.id)}
                  className="w-6 h-6 rounded hover:bg-red-500/10 text-sm flex-shrink-0"
                  style={{ color: task.status === 'queued' || task.status === 'running' ? '#ef4444' : 'var(--text-muted, #888)' }}
                  title={task.status === 'queued' ? 'ลบคิว' : task.status === 'running' ? 'ขอยกเลิกงาน' : 'ปิด'}
                >
                  ×
                </button>
              </div>
              {task.logs && task.logs.length > 1 && (
                <div className="mt-2 pt-2 border-t max-h-40 overflow-y-auto custom-scrollbar space-y-1" style={{ borderColor: 'var(--border-color)' }}>
                  {task.logs.slice(-12).map((log, idx) => (
                    <div key={idx} className="text-[10px] leading-snug" style={{ color: 'var(--text-muted, #888)' }}>
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
