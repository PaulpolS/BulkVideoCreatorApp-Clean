import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { ContentIdea } from '../../hooks/useContentStock';

interface Props {
  stock: ContentIdea[];
  onDelete: (id: string) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  categories: string[];
}

export function ContentStock({ stock, onDelete, selectedIds, onToggleSelect, onSelectAll, onDeselectAll, categories }: Props) {
  const [activeCategory, setActiveCategory] = useState('ทั้งหมด');

  const filtered = activeCategory === 'ทั้งหมด' ? stock : stock.filter(s => s.category === activeCategory);
  const unusedCount = stock.filter(s => s.status === 'unused').length;

  return (
    <Card className="flex flex-col" style={{ height: '520px' }}>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">🗂️ Content Stock</h2>
        <span className="text-[10px] px-2 py-1 rounded-full" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-muted)' }}>
            {unusedCount} ยังไม่ทำ / {stock.length} ทั้งหมด
        </span>
      </div>

      {/* Category Filter */}
      {categories.length > 1 && (
        <div className="flex gap-1 mb-3 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-2 py-1 rounded-full text-[10px] font-medium transition-all"
              style={{
                backgroundColor: activeCategory === cat ? 'var(--accent)' : 'var(--bg-main)',
                color: activeCategory === cat ? '#fff' : 'var(--text-muted)',
                border: '1px solid',
                borderColor: activeCategory === cat ? 'var(--accent)' : 'var(--border-color)',
              }}
            >
              {cat} {cat !== 'ทั้งหมด' && `(${stock.filter(s => s.category === cat).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Select All / Deselect All */}
      {filtered.length > 0 && (
        <div className="flex gap-2 mb-2">
          <button 
            onClick={onSelectAll} 
            className="text-[10px] px-2 py-1 rounded border transition-opacity hover:opacity-80"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            ✅ เลือกทั้งหมด ({filtered.filter(f => f.status === 'unused').length})
          </button>
          <button 
            onClick={onDeselectAll} 
            className="text-[10px] px-2 py-1 rounded border transition-opacity hover:opacity-80"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
          >
            ❌ ยกเลิกทั้งหมด
          </button>
          {selectedIds.length > 0 && (
            <span className="text-[10px] py-1 font-medium" style={{ color: 'var(--accent)' }}>
              🎯 เลือก {selectedIds.length} อัน
            </span>
          )}
        </div>
      )}

      {stock.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm italic" style={{ color: 'var(--text-muted)' }}>
              ยังไม่มีไอเดีย. กดปุ่มด้านบนให้ AI คิดให้สิ!
          </div>
      ) : filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm italic" style={{ color: 'var(--text-muted)' }}>
              ไม่มี content ในหมวดนี้
          </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {filtered.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                <div 
                  key={item.id} 
                  className="p-3 rounded-xl border group cursor-pointer hover:shadow-md transition-all"
                  style={{ 
                    backgroundColor: isSelected ? 'var(--bg-card)' : item.status === 'rendered' ? 'var(--bg-main)' : 'var(--bg-card)',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border-color)',
                    opacity: item.status === 'rendered' ? 0.5 : 1,
                    boxShadow: isSelected ? '0 0 0 1px var(--accent)' : 'none',
                  }}
                  onClick={() => onToggleSelect(item.id)}
                >
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                            {/* Checkbox */}
                            <span className="w-4 h-4 rounded border flex items-center justify-center text-[10px]" style={{
                              borderColor: isSelected ? 'var(--accent)' : 'var(--border-color)',
                              backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                              color: '#fff'
                            }}>
                              {isSelected && '✓'}
                            </span>
                            <h3 className="text-xs font-semibold truncate max-w-[170px]" title={item.topic}>{item.topic}</h3>
                        </div>
                        <div className="flex gap-1 items-center">
                            {item.status === 'rendered' && <span className="text-[10px]" title="ทำคลิปแล้ว">✅</span>}
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-muted)' }}>
                              {item.category}
                            </span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} 
                              className="text-red-400 hover:text-red-300 text-xs p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity" 
                              title="ลบ"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                    <ul className="text-[10px] space-y-0.5 list-disc pl-4 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                        {item.body.slice(0, 2).map((b, i) => <li key={i} className="truncate">{b}</li>)}
                    </ul>
                </div>
                );
            })}
        </div>
      )}
    </Card>
  );
}
