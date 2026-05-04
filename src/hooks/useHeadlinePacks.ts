import { useState, useEffect } from 'react';

export interface HeadlinePack {
  id: string;
  name: string;
  headlines: string[];
}

const LS_KEY = 'aipage_headline_packs';
const API_KEY = 'headline_packs';

export const DEFAULT_3_LINE_PACK: HeadlinePack = {
  id: 'default-3-line-hook',
  name: '🔥 พาดหัว 3 บรรทัด (Hook-Method-Result)',
  headlines: [
    'ถอดบทเรียนความพังของสื่อใหญ่ BuzzFeed\nเมื่อการใช้ AI เขียนบทความแทนคน\nกลายเป็นจุดจบที่ทำลายความเชื่อใจคนอ่าน',
    'กรณีศึกษา: เมื่อสื่อใหญ่เลือกทางลัดใช้ AI\nแต่กลับทำให้คุณภาพคอนเทนต์พังพินาศ\nนี่คือบทเรียนสำคัญที่คนทำคอนเทนต์ต้องรู้',
    'ทำไมการนำ AI มาใช้ถึงพังไม่เป็นท่า?\nสรุปเคส BuzzFeed ที่ใช้ AI ปั่นบทความ\nจนสุดท้ายสูญเสียทั้งรายได้และฐานคนดู'
  ]
};

export function useHeadlinePacks() {
  const [packs, setPacks] = useState<HeadlinePack[]>([]);

  useEffect(() => {
    fetch(`/api/get-app-data?key=${API_KEY}`)
      .then(res => res.json())
      .then((data: HeadlinePack[]) => {
        const localSaved = localStorage.getItem(LS_KEY);
        let localData: HeadlinePack[] = [];
        try { if (localSaved) localData = JSON.parse(localSaved); } catch(e) {}

        let finalData = data || [];
        // MIGRATION: backend empty, localStorage has data
        if ((!data || data.length === 0) && localData.length > 0) {
          console.log('Migrating headline_packs from localStorage to backend...');
          finalData = localData;
        }
        
        // Inject Default 3-Line Pack if missing
        if (!finalData.some(p => p.id === DEFAULT_3_LINE_PACK.id)) {
          finalData = [DEFAULT_3_LINE_PACK, ...finalData];
          fetch('/api/save-app-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: API_KEY, data: finalData })
          }).catch(() => {});
        }

        setPacks(finalData);
        localStorage.setItem(LS_KEY, JSON.stringify(finalData));
      })
      .catch(err => {
        console.error('Failed to load headline_packs from backend', err);
        const saved = localStorage.getItem(LS_KEY);
        if (saved) { try { setPacks(JSON.parse(saved)); } catch(e) {} }
      });
  }, []);

  const persist = (updated: HeadlinePack[]) => {
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
    fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: API_KEY, data: updated })
    }).catch(console.error);
  };

  const savePack = (pack: Omit<HeadlinePack, 'id'>) => {
    setPacks(prev => {
      const newPack: HeadlinePack = { ...pack, id: Date.now().toString() };
      const updated = [...prev, newPack];
      persist(updated);
      return updated;
    });
  };

  const updatePack = (id: string, changes: Partial<HeadlinePack>) => {
    setPacks(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...changes } : p);
      persist(updated);
      return updated;
    });
  };

  const deletePack = (id: string) => {
    setPacks(prev => {
      const updated = prev.filter(p => p.id !== id);
      persist(updated);
      return updated;
    });
  };

  return { packs, setPacks, savePack, updatePack, deletePack, persist };
}
