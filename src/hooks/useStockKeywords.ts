import { useState, useEffect, useCallback } from 'react';

export interface StockKeyword {
  id: string;
  name: string;
  folderName: string;
  count: number;
}

const DEFAULT_KEYWORDS: StockKeyword[] = [
  { id: '1', name: 'กราฟพุ่งขึ้น (Bull Market)', folderName: 'กราฟพุ่งขึ้น', count: 0 },
  { id: '2', name: 'กราฟร่วง (Bear Market)', folderName: 'กราฟร่วง', count: 0 },
  { id: '3', name: 'คนทำงานหนัก/สู้งาน', folderName: 'คนทำงานหนัก', count: 0 },
  { id: '4', name: 'คนรวย/ไลฟ์สไตล์หรูหรา', folderName: 'คนรวย_ไลฟ์สไตล์', count: 0 },
  { id: '5', name: 'ความสำเร็จ/ทะลุเป้าหมาย', folderName: 'ความสำเร็จ', count: 0 },
  { id: '6', name: 'ความกังวล/เครียดเรื่องเงิน', folderName: 'ความกังวล_เครียด', count: 0 },
  { id: '7', name: 'การวางแผน/วิเคราะห์การเงิน', folderName: 'วางแผนการเงิน', count: 0 },
  { id: '8', name: 'การนับเงิน/เงินก้อนโต', folderName: 'การนับเงิน', count: 0 },
  { id: '9', name: 'รถสปอร์ต/นาฬิกาหรู', folderName: 'รถสปอร์ต_นาฬิกาหรู', count: 0 },
  { id: '10', name: 'ตึกระฟ้า/เมืองใหญ่', folderName: 'ตึกระฟ้า_เมืองใหญ่', count: 0 },
  { id: '11', name: 'การลงทุน/เทรดหุ้น', folderName: 'การลงทุน_เทรดหุ้น', count: 0 },
  { id: '12', name: 'การจับมือธุรกิจ/ดีลสำเร็จ', folderName: 'การจับมือธุรกิจ', count: 0 },
  { id: '13', name: 'คริปโต/บิทคอยน์', folderName: 'คริปโต_บิทคอยน์', count: 0 },
  { id: '14', name: 'อสังหาริมทรัพย์/บ้านเดี่ยว', folderName: 'อสังหาริมทรัพย์', count: 0 },
  { id: '15', name: 'เริ่มต้นธุรกิจ/สตาร์ทอัพ', folderName: 'เริ่มต้นธุรกิจ', count: 0 },
  { id: '16', name: 'แสงสว่างปลายอุโมงค์/ความหวัง', folderName: 'แสงสว่างปลายอุโมงค์', count: 0 },
  { id: '17', name: 'การทำงานเป็นทีม/ประชุม', folderName: 'การทำงานเป็นทีม', count: 0 },
  { id: '18', name: 'ความล้มเหลว/ล้มลุกคลุกคลาน', folderName: 'ความล้มเหลว', count: 0 },
  { id: '19', name: 'พัฒนาตัวเอง/อ่านหนังสือ', folderName: 'พัฒนาตัวเอง_อ่านหนังสือ', count: 0 },
  { id: '20', name: 'มีวินัย/ออกกำลังกาย', folderName: 'วินัย_ออกกำลังกาย', count: 0 },
];

export function useStockKeywords() {
  const [keywords, setKeywords] = useState<StockKeyword[]>(DEFAULT_KEYWORDS);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/count-video-stock');
      if (!res.ok) return;
      const counts: Record<string, number> = await res.json();
      
      setKeywords(prev => prev.map(kw => ({
        ...kw,
        count: counts[kw.folderName] ?? 0
      })));
    } catch(e) {
      console.error('Failed to fetch video stock counts', e);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const updateCount = (id: string, newCount: number) => {
    setKeywords(prev => {
      const updated = prev.map(k => k.id === id ? { ...k, count: newCount } : k);
      return updated;
    });
  };

  return { keywords, updateCount, refreshCounts: fetchCounts };
}
