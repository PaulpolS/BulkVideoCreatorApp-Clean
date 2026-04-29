import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '../ui/Card';
import { useYtQueueStore } from '../../hooks/useYtQueueStore';
import { NumInput } from '../ui/NumInput';
import { globalTaskStore } from '../../hooks/useBackgroundTasks';

interface ArticleItem {
  id: string;
  title: string;
  url: string;
  domain: string;
  thaiTitle?: string;
  score?: number;
  evergreenScore?: number;
  tags?: string[];
  rawText?: string;
}


interface NewsScraperProps {
  onSendToStock: (data: any) => void;
  onSendToAIPage?: (items: { rawArticle: string; sourceUrl: string; title: string; tags?: string[]; images?: string[]; sourceType?: string; domain?: string }[]) => void;
  initialYoutubeUrls?: string[];
  onYoutubeUrlsConsumed?: () => void;
}

const SCORE_PROMPT = `คุณคือบรรณาธิการข่าวการเงินและผู้เชี่ยวชาญด้าน Social Media สำหรับเพจที่นำเสนอเรื่องราวเกี่ยวกับ "เศรษฐกิจ การเงิน และการลงทุน"
หน้าที่ของคุณคือการประเมินข่าวสารที่ได้รับมา ว่ามีความน่าสนใจและมีโอกาสที่คนจะ "แชร์" มากน้อยแค่ไหน (Virality Potential)

เกณฑ์การให้คะแนนความน่าแชร์ (เต็ม 10 คะแนน):
9-10 (สูงมาก): ข่าวใหญ่ระดับโลกหรือระดับประเทศที่กระทบเงินในกระเป๋าคนส่วนมากโดยตรง (เช่น การปรับอัตราดอกเบี้ยของ FED/BOT, วิกฤตเศรษฐกิจ, มาตรการแจกเงิน/ลดหย่อนภาษีของรัฐ, หรือตลาดหุ้น/คริปโตผันผวนรุนแรง)
7-8 (สูง): ข่าวอัปเดตเทรนด์การลงทุน, สินทรัพย์ที่กำลังเป็นกระแส, บทวิเคราะห์ที่เห็นทิศทางชัดเจน, หรือทริคการวางแผนการเงินส่วนบุคคล/การออมที่คนเอาไปทำตามได้ทันที
4-6 (ปานกลาง): ข่าวผลประกอบการบริษัทจดทะเบียน (Earnings), การควบรวมกิจการ, ข่าวธุรกิจเฉพาะกลุ่ม, หรือบทวิเคราะห์เศรษฐกิจมหภาคเชิงลึกที่คนทั่วไปอาจมองว่าไกลตัว
1-3 (ต่ำ): ข่าวประกาศทั่วไปขององค์กร (PR), การแต่งตั้งผู้บริหารระดับกลาง, บทความวิชาการทางเศรษฐศาสตร์ที่เข้าใจยาก, หรือข่าวเดิมที่ตลาดรับรู้ไปหมดแล้ว (Priced in)

คำสั่ง:
- สรุปและแปลชื่อข่าวเป็น "ภาษาไทย" ที่ดึงดูด กระชับ เห็นผลกระทบหรือโอกาสชัดเจน
- ประเมินคะแนน 1-10 ตามเกณฑ์ด้านบน
- ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่น

รูปแบบ JSON:
{
  "ชื่อข่าว": "ชื่อข่าวภาษาไทยที่แปลแล้ว",
  "คะแนน": ตัวเลขจำนวนเต็ม
}

เนื้อหาข่าว:
{content}`;

const WRITE_PROMPT = `🚨 CRITICAL INSTRUCTION 1 (กฎเหล็กเรื่องภาษา):
ห้ามพิมพ์ตัวอักษรภาษาจีน (Chinese Characters/Hanzi) ออกมาโดยเด็ดขาด! ผลลัพธ์ทั้งหมดต้องเป็น "ภาษาไทย" 100% (อนุญาตให้ใช้ภาษาอังกฤษได้เฉพาะชื่อเฉพาะ ศัพท์เทคนิค หรือทับศัพท์ที่จำเป็น)
หากในเนื้อหาต้นฉบับมีชื่อบุคคล ชื่อบริษัท หรือสถานที่ที่เป็นภาษาจีน ให้แปลเป็นภาษาไทย หรือเขียนทับศัพท์ด้วยอักษรภาษาอังกฤษ (Pinyin) แทน ห้ามมีอักษรจีนหลุดรอดออกมาแม้แต่ตัวเดียว!

🚨 CRITICAL INSTRUCTION 2 (กฎเหล็กเรื่องรูปแบบ JSON):
คุณต้องตอบกลับเป็นโครงสร้าง JSON ที่ถูกต้อง (Valid JSON) เท่านั้น! ห้ามมีข้อความเกริ่นนำ คำอธิบาย หรือ Markdown ใดๆ นอกกรอบ JSON:
{
  "พาดหัวข่าว": "ใส่พาดหัวข่าวที่นี่",
  "รายละเอียดข่าว Part1": "ใส่เนื้อหาส่วนที่ 1 ที่นี่",
  "รายละเอียดข่าว Part2": "ใส่เนื้อหาส่วนที่ 2 ที่นี่"
}

บทบาทของคุณ:
สวมบทบาทเป็นนักเขียนข่าวการเงินและการลงทุนชาวไทยที่เขียนบทความได้น่าติดตาม เชี่ยวชาญในการเล่าประเด็นร้อน ทิศทางตลาดหุ้น คริปโต นโยบายการเงิน วิกฤตเศรษฐกิจ และผลกระทบต่อปากท้องของคนทั่วไป

คำสั่งในการเขียน:

1. สำหรับ "พาดหัวข่าว":
- สร้างพาดหัวที่ใช้ภาษาชาวบ้าน อ่านปุ๊บเข้าใจปั๊บในประโยคเดียว
- ห้ามใช้ศัพท์เทคนิคการเงิน (Jargon) ที่คนทั่วไปไม่เข้าใจ
- เน้นความกระแทกใจ ตรงประเด็น เห็นภาพรวมทันทีว่าใครรวยขึ้นหรือใครกำลังแย่
- เพิ่มอีโมจิที่เกี่ยวข้อง 1-2 ตัว
- ลงท้ายด้วย "(อ่านต่อ👇)" หรือ "(อ่านเพิ่มเติม👇)" เสมอ
- ตัวอย่าง: 🚨 ด่วน! แบงก์ชาติงัดไม้ตาย หั่นดอกเบี้ยกู้ชีพเศรษฐกิจ หุ้นพุ่งรับข่าวดีทันที... 🔥 (อ่านต่อ👇)

2. สำหรับ "รายละเอียดข่าว Part1" (เล่าเรื่องและวิเคราะห์):
- สรุปเนื้อหาข่าวแบบเจาะลึกแต่เข้าใจง่าย สำนวนเหมือนเพื่อนนักลงทุนมาเล่าให้ฟัง
- ใช้ Bullet points แบ่งย่อยประเด็นชัดเจน
- ระบุ "สาเหตุที่แท้จริง" ของเหตุการณ์ ใครได้เปรียบ ใครเสียเปรียบ

3. สำหรับ "รายละเอียดข่าว Part2" (ผลกระทบและกระตุ้นคอมเมนต์):
- เจาะประเด็นที่กระทบคนทั่วไป ผ่านหัวข้อ 'เรื่องนี้กระทบเงินในกระเป๋าคุณแค่ไหน?'
- เพิ่มหัวข้อ 'เคล็ดลับรับมือ:' หรือการวิเคราะห์ว่าควรปรับพอร์ตอย่างไร
- ตั้งคำถามท้ายโพสต์แบบท้าทายเพื่อกระตุ้นคอมเมนต์
- ปิดท้ายด้วยแฮชแท็ก 3-5 ตัว และแหล่งที่มา

ข้อมูลเนื้อหาข่าว:
{content}`;

const SITE_LIBRARY = [
  {"cat":"🤖 AI & เทคโนโลยี","name":"TechCrunch","url":"https://techcrunch.com"},
  {"cat":"🤖 AI & เทคโนโลยี","name":"The Verge","url":"https://www.theverge.com"},
  {"cat":"🤖 AI & เทคโนโลยี","name":"Brandinside (TH)","url":"https://brandinside.asia"},
  {"cat":"💰 การเงิน","name":"Reuters Finance","url":"https://www.reuters.com/finance/"},
  {"cat":"💰 การเงิน","name":"CNBC","url":"https://www.cnbc.com"},
  {"cat":"💰 การเงิน","name":"Finnomena (TH)","url":"https://www.finnomena.com"},
  {"cat":"💰 การเงิน","name":"Kaohoon (TH)","url":"https://www.kaohoon.com"},
  {"cat":"🌍 การเมืองโลก","name":"BBC World News","url":"https://www.bbc.com/news/world"},
  {"cat":"₿ คริปโต","name":"CoinTelegraph","url":"https://cointelegraph.com"},
  {"cat":"₿ คริปโต","name":"Bitkub Blog (TH)","url":"https://blog.bitkub.com"},
  {"cat":"🏆 ความสำเร็จ","name":"Forbes","url":"https://www.forbes.com"},
  {"cat":"🏆 ความสำเร็จ","name":"Longtunman (TH)","url":"https://www.longtunman.com"},
  {"cat":"📈 การลงทุน","name":"Motley Fool","url":"https://www.fool.com"},
  {"cat":"🇨🇳 ข่าวจีน (แปลไทย)","name":"36氪 AI (36kr)","url":"https://36kr.com/information/AI/"},
  {"cat":"🇨🇳 ข่าวจีน (แปลไทย)","name":"第一财经 Yicai","url":"https://www.yicai.com"},
  {"cat":"🇨🇳 ข่าวจีน (แปลไทย)","name":"深潮TechFlow","url":"https://www.techflowpost.com"},
];

const TITLES_TRANSLATE_PROMPT = `หน้าที่ของคุณคือเป็นบรรณาธิการข่าวมืออาชีพ แปลหัวข้อข่าวต่อไปนี้เป็นภาษาไทยที่ดึงดูด และประเมิน 2 คะแนนแยกกัน:

1. "news_score" (คะแนนข่าว 1-10): ความน่าสนใจในฐานะข่าว ความ Viral ความกระทบวงกว้าง
   - 9-10 = ข่าวใหญ่ระดับโลก/ประเทศ กระทบคนส่วนมาก
   - 7-8 = เทรนด์น่าสนใจ ทริคการลงทุน/การเงิน
   - 4-6 = ข่าวเฉพาะกลุ่ม ผลประกอบการ
   - 1-3 = ข่าว PR ทั่วไป

2. "evergreen_score" (คะแนน Evergreen 1-10): ความเป็นเนื้อหาอมตะที่ไม่มีวันหมดอายุ นำไปทำคอนเทนต์ได้ตลอด
   - 9-10 = ความรู้/หลักการที่ใช้ได้ตลอดกาล (เช่น วิธีออมเงิน, กฎการลงทุนของ Warren Buffett)
   - 7-8 = เทรนด์ระยะยาว/บทวิเคราะห์เชิงลึก ที่มีอายุใช้งานได้หลายเดือน
   - 4-6 = เนื้อหาที่เกี่ยวข้องกับช่วงเวลา แต่ยังมีบทเรียนนำไปใช้ได้
   - 1-3 = ข่าวสดที่หมดอายุเร็ว (เช่น ราคาหุ้นวันนี้)

3. "tags": ติด Tag หมวดหมู่สั้นๆ 2-4 tag เป็นภาษาไทย เช่น ["AI", "การลงทุน", "คริปโต", "อสังหา", "ออมเงิน", "หุ้น", "เศรษฐกิจโลก", "สตาร์ทอัพ", "เทคโนโลยี", "การเงินส่วนบุคคล"]

ข้อมูลอินพุตเป็น JSON Array ของหัวข้อข่าว:
{content}

ตอบกลับเป็น JSON Format ตามรูปแบบนี้เท่านั้น ห้ามมีข้อความอื่น:
{
  "results": [
    { "id": "รหัสเดิม", "thai_title": "หัวข้อแปลไทยที่ดึงดูดใจ", "news_score": 8, "evergreen_score": 5, "tags": ["AI", "เทคโนโลยี"] }
  ]
}`;

export const NewsScraperTab: React.FC<NewsScraperProps> = ({ onSendToStock, onSendToAIPage, initialYoutubeUrls, onYoutubeUrlsConsumed }) => {
  const [activeMode, setActiveMode] = useState<'rss' | 'youtube'>('rss');

  // RSS states
  const [url, setUrl] = useState('https://36kr.com/information/AI/');
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkSending, setIsBulkSending] = useState(false);
  const stopBulkRef = useRef(false);
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [scrapedToday, setScrapedToday] = useState<{ url: string; time: string; name: string }[]>([]);
  const [sortBy, setSortBy] = useState<'default' | 'newsScore' | 'evergreenScore'>('default');

  // YouTube states
  const [ytUrl, setYtUrl] = useState('');
  const [isYtLoading, setIsYtLoading] = useState(false);
  const [ytResult, setYtResult] = useState<{
    videoTitle: string;
    channelName: string;
    channelAvatar: string;
    channelLogoUrl: string;
    subscriberCount?: number;
    transcript: string;
    screenshotUrls: string[];
  } | null>(null);
  const [ytSelectedImages, setYtSelectedImages] = useState<Set<string>>(new Set());
  const [ytError, setYtError] = useState('');
  const [isSavingYt, setIsSavingYt] = useState(false);

  // YouTube Queue (global store — persists across tab changes, runs in background)
  const ytQueueStore = useYtQueueStore();
  const [ytQueueSelectedIds, setYtQueueSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [expandedQueueId, setExpandedQueueId] = useState<string | null>(null);

  // Receive URLs from ArticleStockTab → add to global queue
  useEffect(() => {
    if (initialYoutubeUrls && initialYoutubeUrls.length > 0) {
      setActiveMode('youtube');
      const newIds = ytQueueStore.addUrls(initialYoutubeUrls);
      setYtQueueSelectedIds(new Set(newIds));
      onYoutubeUrlsConsumed?.();
    }
  }, [initialYoutubeUrls]);

  // Restore selection when items change
  useEffect(() => {
    setYtQueueSelectedIds(prev => {
      const validIds = new Set(ytQueueStore.items.map(q => q.id));
      const next = new Set([...prev].filter(id => validIds.has(id)));
      return next;
    });
  }, [ytQueueStore.items]);

  const handleProcessSelected = () => {
    const ids = Array.from(ytQueueSelectedIds).filter(id => {
      const item = ytQueueStore.items.find(q => q.id === id);
      return item && item.status !== 'completed';
    });
    ytQueueStore.processItems(ids);
  };

  const handleProcessAll = () => ytQueueStore.processAll(false);
  const handleProcessAllAndSave = () => ytQueueStore.processAll(true);

  const handleBatchSaveToStock = async () => {
    setIsBatchSaving(true);
    const result = await ytQueueStore.batchSaveToStock();
    setIsBatchSaving(false);
    if (result?.success) {
      alert(`✅ บันทึกเข้าคลังบทความแล้ว! เพิ่ม ${result.added ?? 0} คลิป (อัปเดต ${result.updated ?? 0})`);
    } else if (result?.error) {
      alert(`❌ บันทึกไม่สำเร็จ: ${result.error}`);
    }
  };

  const toggleQueueSelect = (id: string) => setYtQueueSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectAllQueue = () => setYtQueueSelectedIds(new Set(ytQueueStore.items.map(q => q.id)));
  const deselectAllQueue = () => setYtQueueSelectedIds(new Set());
  const removeQueueItem = (id: string) => {
    ytQueueStore.removeItem(id);
    setYtQueueSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };
  const clearCompletedQueue = () => {
    ytQueueStore.clearCompleted();
  };

  const toggleYtImage = (url: string) => setYtSelectedImages(prev => {
    const next = new Set(prev);
    if (next.has(url)) next.delete(url); else next.add(url);
    return next;
  });
  const selectAllYtImages = () => setYtSelectedImages(new Set(ytResult?.screenshotUrls || []));
  const deselectAllYtImages = () => setYtSelectedImages(new Set());

  const handleYoutubeExtract = async () => {
    if (!ytUrl.trim()) return;
    setIsYtLoading(true);
    setYtError('');
    setYtResult(null);
    try {
      const res = await fetch('/api/youtube-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ytUrl.trim(), frameCount: ytQueueStore.frameCount }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Extract failed');
      const allShots: string[] = data.screenshotUrls || [];
      const localShots = allShots.filter((u: string) => u.startsWith('/'));
      const shots = localShots.length > 0 ? localShots : allShots;
      setYtResult({
        videoTitle: data.videoTitle || '',
        channelName: data.channelName || '',
        channelAvatar: data.channelAvatar || '',
        channelLogoUrl: data.channelLogoUrl || '',
        subscriberCount: data.subscriberCount,
        transcript: data.transcript || '',
        screenshotUrls: shots,
      });
      setYtSelectedImages(new Set(shots));
    } catch (e: any) {
      setYtError(e.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsYtLoading(false);
    }
  };

  const handleSaveYtToStock = async () => {
    if (!ytResult) return;
    setIsSavingYt(true);
    try {
      const selectedImgList = Array.from(ytSelectedImages);
      const item = {
        title: ytResult.videoTitle || ytUrl,
        rawArticle: ytResult.transcript || ytResult.videoTitle,
        sourceUrl: ytUrl,
        newsScore: 0,
        evergreenScore: 0,
        tags: ['youtube', ytResult.channelName].filter(Boolean),
        domain: 'www.youtube.com',
        createdAt: new Date().toISOString(),
        images: selectedImgList,
        sourceType: 'youtube',
        channelName: ytResult.channelName,
        channelLogoUrl: ytResult.channelLogoUrl,
        channelAvatar: ytResult.channelAvatar,
        subscriberCount: ytResult.subscriberCount,
        ytExtracted: true,
      };
      const res = await fetch('/api/article-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-batch', items: [item] }),
      });
      const data = await res.json();
      if (data.success) {
        const resultText = data.added > 0
          ? 'เพิ่มใหม่'
          : data.updated > 0
            ? 'อัปเดตรายการเดิมแล้ว'
            : 'มีอยู่แล้ว';
        alert(`✅ เก็บเข้าคลังบทความแล้ว! (${resultText})`);
      }
      else throw new Error(data.error);
    } catch (e: any) {
      alert(`❌ บันทึกไม่สำเร็จ: ${e.message}`);
    } finally {
      setIsSavingYt(false);
    }
  };

  // Load/Save scrapedToday
  useEffect(() => {
    try {
      const saved = localStorage.getItem('scraped_today_news');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only keep today's data
        if (parsed.date === new Date().toLocaleDateString('th-TH')) {
          setScrapedToday(parsed.data || []);
        } else {
          localStorage.setItem('scraped_today_news', JSON.stringify({ date: new Date().toLocaleDateString('th-TH'), data: [] }));
        }
      }
    } catch(e) {}
  }, []);

  const saveScrapedToday = (newData: { url: string; time: string; name: string }[]) => {
    setScrapedToday(newData);
    localStorage.setItem('scraped_today_news', JSON.stringify({ date: new Date().toLocaleDateString('th-TH'), data: newData }));
  };

  const toggleSiteSelect = (siteUrl: string) => {
    setSelectedSites(prev => {
      const next = new Set(prev);
      if (next.has(siteUrl)) next.delete(siteUrl);
      else next.add(siteUrl);
      return next;
    });
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const selectAll = () => setSelectedIds(new Set(articles.map(a => a.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('th-TH')}] ${msg}`]);
  };

  const cleanJsonText = (text: string) => {
    return text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
  };

  const getOpenRouterKey = () => {
    const raw = localStorage.getItem('api_global_profiles') || '[]';
    const activeId = localStorage.getItem('api_global_active_id');
    try {
      const profiles = JSON.parse(raw);
      const p = profiles.find((x: any) => x.id === activeId) || profiles[0];
      return p ? p.openRouterKey : '';
    } catch(e) {
      return localStorage.getItem('openrouter_key') || '';
    }
  };

  const handleScrape = async () => {
    const targets = Array.from(selectedSites);
    if (url.trim() && !targets.includes(url.trim())) {
      targets.push(url.trim());
    }

    if (targets.length === 0) return alert("โปรดเลือกแหล่งข่าว หรือใส่ URL อย่างน้อย 1 แหล่ง");
    
    setIsScraping(true);
    setArticles([]);
    setLogs([]);
    let allScraped: ArticleItem[] = [];
    let newScrapedToday = [...scrapedToday];

    for (let i = 0; i < targets.length; i++) {
      const targetUrl = targets[i];
      addLog(`\n[${i+1}/${targets.length}] 🔍 กำลังดึงข้อมูลจาก: ${targetUrl}`);

      try {
        let html = "";
        let success = false;
        let errorMsg = "";

        // Proxy 1: AllOrigins
        try {
          const res1 = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
          if (res1.ok) {
            const data1 = await res1.json();
            if (data1.contents) {
              html = data1.contents;
              success = true;
            }
          }
        } catch (e: any) { errorMsg = e.message; }

        // Proxy 2
        if (!success) {
          try {
            const res2 = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
            if (res2.ok) { html = await res2.text(); success = true; }
          } catch (e: any) { errorMsg = e.message; }
        }

        // Proxy 3
        if (!success) {
          try {
            const res3 = await fetch(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(targetUrl)}`);
            if (res3.ok) { html = await res3.text(); success = true; }
          } catch (e: any) { errorMsg = e.message; }
        }

        if (!success) throw new Error("CORS Proxy ถูกบล็อก (" + errorMsg + ")");
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const baseUrlParsed = new URL(targetUrl);
        const host = baseUrlParsed.host;
        const scraped: ArticleItem[] = [];
        const seenUrl = new Set<string>();

        doc.querySelectorAll('a').forEach(aTag => {
          let href = aTag.getAttribute('href');
          if (!href || href.startsWith('#') || href.startsWith('javascript')) return;

          try {
            const absoluteUrl = new URL(href, targetUrl);
            if (!absoluteUrl.host.includes(host.replace('www.', ''))) return;
            
            const path = absoluteUrl.pathname;
            if (path.length < 5 || path === '/') return;
            if (path.match(/\/(tag|category|video|gallery|login|search)\//i)) return;

            const title = aTag.innerText.trim();
            if (title.length < 15) return;

            const cleanUrlStr = absoluteUrl.href.split('#')[0];
            if (!seenUrl.has(cleanUrlStr) && !allScraped.some(a => a.url === cleanUrlStr)) {
              seenUrl.add(cleanUrlStr);
              scraped.push({
                id: Math.random().toString(36).substring(7),
                title: title,
                url: cleanUrlStr,
                domain: absoluteUrl.host
              });
            }
          } catch(e) {}
        });

        allScraped = [...allScraped, ...scraped];
        addLog(`✅ สกัดได้ ${scraped.length} ข่าวจาก ${targetUrl}`);
        
        // Add to scraped today if not already there today
        const siteName = SITE_LIBRARY.find(s => s.url === targetUrl)?.name || host;
        if (!newScrapedToday.some(s => s.url === targetUrl)) {
          newScrapedToday.push({ url: targetUrl, time: new Date().toLocaleTimeString('th-TH'), name: siteName });
        }

      } catch(e: any) {
        addLog(`❌ ดึงข้อมูล ${targetUrl} ไม่สำเร็จ: ${e.message}`);
      }
    }

    setArticles(allScraped.slice(0, 150)); // limit total
    saveScrapedToday(newScrapedToday);
    addLog(`\n🎯 สรุปผล: สกัดลิงก์ข่าวรวมทั้งหมด ${allScraped.length} ข่าว (แสดงสูงสุด 150 ข่าว)`);
    setIsScraping(false);
  };

  const handleTranslateTitles = async () => {
    const apiKey = getOpenRouterKey();
    if (!apiKey) return alert("กรุณาตั้งค่า OpenRouter API Key ก่อน");

    const allToTranslate = articles.filter(a => !a.thaiTitle);
    if (allToTranslate.length === 0) return alert("ไม่มีหัวเรื่องใหม่ให้แปลแล้ว");

    setIsTranslating(true);
    const BATCH_SIZE = 30;
    const totalBatches = Math.ceil(allToTranslate.length / BATCH_SIZE);
    addLog(`🌐 พบ ${allToTranslate.length} หัวข้อที่ยังไม่ได้แปล → จะแบ่งเป็น ${totalBatches} ชุด (ชุดละ ${BATCH_SIZE})`);

    let totalTranslated = 0;

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batch = allToTranslate.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
      const inputData = batch.map(a => ({ id: a.id, title: a.title }));

      addLog(`📦 [ชุดที่ ${batchIndex + 1}/${totalBatches}] กำลังแปล ${batch.length} หัวข้อ...`);

      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{ role: 'user', content: TITLES_TRANSLATE_PROMPT.replace('{content}', JSON.stringify(inputData)) }],
            temperature: 0.3
          })
        });
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(cleanJsonText(raw));
        if (parsed.results && Array.isArray(parsed.results)) {
          setArticles(prev => prev.map(a => {
             const match = parsed.results.find((r: any) => r.id === a.id);
             if (match) {
               return { ...a, thaiTitle: match.thai_title, score: match.news_score ?? match.score, evergreenScore: match.evergreen_score, tags: match.tags || [] };
             }
             return a;
          }));
          totalTranslated += parsed.results.length;
          addLog(`✅ ชุดที่ ${batchIndex + 1}: แปลสำเร็จ ${parsed.results.length} รายการ (รวม ${totalTranslated}/${allToTranslate.length})`);
        } else {
          addLog(`⚠️ ชุดที่ ${batchIndex + 1}: AI คืนค่าผิดรูปแบบ ข้ามไป`);
        }
      } catch(e: any) {
        addLog(`❌ ชุดที่ ${batchIndex + 1}: แปลล้มเหลว: ${e.message}`);
      }

      // Small delay between batches to avoid rate limiting
      if (batchIndex < totalBatches - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    addLog(`🎯 สรุปผล: แปลหัวข้อข่าวสำเร็จทั้งหมด ${totalTranslated}/${allToTranslate.length} รายการ (พร้อมคะแนน News + Evergreen + Tags)`);
    setIsTranslating(false);
  };

  const handleProcessArticle = async (article: ArticleItem) => {
    const apiKey = getOpenRouterKey();
    if (!apiKey) return alert("กรุณาตั้งค่า OpenRouter API Key ก่อน");

    setProcessingId(article.id);
    addLog(`-----------------------------------`);
    addLog(`🚀 [${article.title.substring(0, 30)}...] เริ่มต้นกระบวนการ AI`);

    try {
      // Step 1: อ่านเนื้อหาเต็มผ่าน jina.ai
      addLog(`📖 อ่านเนื้อหาเต็มจากเว็บ (Jina Reader)...`);
      const jinaUrl = `https://r.jina.ai/${article.url}`;
      const jinaRes = await fetch(jinaUrl, {
        headers: {
          'Accept': 'text/plain',
          'X-Return-Format': 'text'
        }
      });
      if (!jinaRes.ok) throw new Error("Jina API โหลดเนื้อหาไม่ขึ้น");
      let fullText = await jinaRes.text();
      fullText = fullText.substring(0, 8000); // ตัดแค่ 8000 ตัวแรก ประหยัด Token

      // Step 2: ประเมินคะแนนไวรัล
      addLog(`🌡️ ให้ AI ตรวจสอบคะแนนความไวรัล...`);
      const scoreRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: SCORE_PROMPT.replace('{content}', `${article.title}\n\n${fullText}`) }],
          temperature: 0.3
        })
      });
      const scoreData = await scoreRes.json();
      const scoreJsonRaw = scoreData.choices?.[0]?.message?.content || '{}';
      const scoreParsed = JSON.parse(cleanJsonText(scoreJsonRaw));
      addLog(`⭐ ประเมินความน่าสนใจได้: ${scoreParsed.คะแนน || 0}/10`);

      // Step 3: เขียนลง Detail
      addLog(`✍️ กำลังให้ AI เขียนบทความสไตล์เพจการเงิน...`);
      const writeRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: WRITE_PROMPT.replace('{content}', `${article.title}\n\n${fullText}`) }],
          temperature: 0.7
        })
      });
      const writeData = await writeRes.json();
      const writeJsonRaw = writeData.choices?.[0]?.message?.content || '{}';
      let mappedData;
      try {
        const writeParsed = JSON.parse(cleanJsonText(writeJsonRaw));
        mappedData = `${writeParsed.พาดหัวข่าว || ''}\n\n${writeParsed['รายละเอียดข่าว Part1'] || writeParsed.รายละเอียดข่าว_Part1 || ''}\n\n${writeParsed['รายละเอียดข่าว Part2'] || writeParsed.รายละเอียดข่าว_Part2 || ''}`;
      } catch (e) {
        addLog(`⚠️ AI คืนค่าผิดรูปแบบ JSON แต่จะพยายามบันทึกข้อความดิบแทน`);
        mappedData = writeJsonRaw;
      }

      // Step 4: ส่งเข้าคลังแสง
      addLog(`📥 กำลังส่งเข้าคลังแสง (Content Stock)...`);
      const newStockData = {
        title: scoreParsed.ชื่อข่าว || article.title,
        detail: mappedData,
        rawText: fullText,
        sourceUrl: article.url,
        platform: 'facebook',
        category: 'finance',
        viralScore: scoreParsed.คะแนน || 5,
        prompt: `ภาพอ้างอิงของข่าว: ${scoreParsed.ชื่อข่าว}`
      };
      
      // Save raw text to the article for later use
      setArticles(prev => prev.map(a => a.id === article.id ? { ...a, rawText: fullText } : a));
      
      onSendToStock([newStockData]);
      addLog(`🎉 เสร็จสมบูรณ์! ข้อความพร้อมถูกนำไปปั้นวิดีโอแล้ว`);

    } catch (e: any) {
      addLog(`❌ เกิดข้อผิดพลาดระหว่าง AI Process: ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const sortedArticles = useMemo(() => {
    if (sortBy === 'default') return articles;
    return [...articles].sort((a, b) => {
      if (sortBy === 'newsScore') return (b.score || 0) - (a.score || 0);
      if (sortBy === 'evergreenScore') return (b.evergreenScore || 0) - (a.evergreenScore || 0);
      return 0;
    });
  }, [articles, sortBy]);

  return (
    <div className="w-full max-w-[1400px] mx-auto animate-fade-in space-y-4">

      {/* Mode Toggle */}
      <div className="flex gap-2 p-1 bg-gray-800/60 rounded-xl w-fit">
        <button
          onClick={() => setActiveMode('rss')}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeMode === 'rss' ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' : 'text-gray-400 hover:text-white'}`}
        >
          🗞️ ดูดข่าว RSS
        </button>
        <button
          onClick={() => setActiveMode('youtube')}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeMode === 'youtube' ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' : 'text-gray-400 hover:text-white'}`}
        >
          🎬 YouTube Script + รูปภาพ
        </button>
      </div>

      {/* YouTube Mode */}
      {activeMode === 'youtube' && (
        <div className="space-y-4">
          <Card>
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <span className="text-2xl">🎬</span> ดึง Script + แคปรูปจาก YouTube
            </h2>
            <p className="text-xs text-gray-400 mb-4">วาง URL คลิป YouTube แล้วระบบจะดึง Script (คำบรรยาย) และแคปรูปภาพสุ่มกระจายตลอดคลิป — ฟรี ไม่มีค่า API</p>

            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={ytUrl}
                onChange={e => setYtUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleYoutubeExtract()}
                placeholder="https://www.youtube.com/watch?v=..."
                className="input-field flex-1 min-w-[200px] text-sm"
              />
              <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700 rounded-lg px-3">
                <label className="text-xs text-gray-400 whitespace-nowrap">🖼️ จำนวนรูป</label>
                <NumInput
                  min={1} max={30}
                  value={ytQueueStore.frameCount}
                  onChange={n => ytQueueStore.setFrameCount(n)}
                  className="w-14 bg-transparent text-sm font-bold text-white text-center outline-none"
                />
              </div>
              <button
                onClick={handleYoutubeExtract}
                disabled={isYtLoading || !ytUrl.trim()}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap"
              >
                {isYtLoading ? '⏳ กำลังดึง...' : '🚀 ดึง Script + รูปภาพ'}
              </button>
            </div>

            {isYtLoading && (
              <div className="mt-4 p-4 bg-black/30 rounded-lg border border-gray-700 text-sm text-gray-400 animate-pulse">
                ⏳ กำลังดึง transcript และแคปรูปจากคลิป... อาจใช้เวลา 1-2 นาที
              </div>
            )}

            {ytError && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                ❌ {ytError}
              </div>
            )}
          </Card>

          {/* === Queue Panel === */}
          {ytQueueStore.items.length > 0 && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="font-bold text-gray-200 flex items-center gap-2">
                  📋 คิวดึง YouTube
                  <span className="text-[10px] font-normal bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">
                    {ytQueueStore.items.filter(q => q.status === 'completed').length}/{ytQueueStore.items.length} เสร็จ
                  </span>
                  {ytQueueStore.isRunning && (
                    <span className="text-[10px] font-normal bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 animate-pulse">
                      กำลังทำงาน...
                    </span>
                  )}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={selectAllQueue} className="text-[10px] px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all">☑ เลือกทั้งหมด</button>
                  <button onClick={deselectAllQueue} className="text-[10px] px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all">☐ ยกเลิก</button>
                  {ytQueueStore.items.some(q => q.status === 'completed') && (
                    <button onClick={clearCompletedQueue} className="text-[10px] px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all">🧹 ล้างที่เสร็จแล้ว</button>
                  )}
                </div>
              </div>

              {/* Queue Items */}
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar mb-4">
                {ytQueueStore.items.map((item, idx) => {
                  const isSelected = ytQueueSelectedIds.has(item.id);
                  const isExpanded = expandedQueueId === item.id;
                  const statusIcon = item.status === 'completed' ? '✅' : item.status === 'running' ? '🔄' : item.status === 'error' ? '❌' : '⏳';
                  const statusColor = item.status === 'completed' ? 'border-green-500/30 bg-green-900/10' : item.status === 'running' ? 'border-amber-500/30 bg-amber-900/10 animate-pulse' : item.status === 'error' ? 'border-red-500/30 bg-red-900/10' : 'border-gray-700/50';
                  return (
                    <div key={item.id} className={`rounded-lg border p-3 transition-all ${statusColor}`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleQueueSelect(item.id)}
                          className="w-4 h-4 accent-cyan-500 cursor-pointer flex-shrink-0"
                          disabled={ytQueueStore.isRunning}
                        />
                        <span className="text-sm flex-shrink-0">{statusIcon}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0 w-5">{idx + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-200 truncate font-medium">
                            {item.result?.videoTitle || item.url}
                          </p>
                          {item.result?.videoTitle && (
                            <p className="text-[10px] text-gray-500 truncate">{item.url}</p>
                          )}
                          {item.error && (
                            <p className="text-[10px] text-red-400 mt-0.5">❌ {item.error}</p>
                          )}
                          {item.result && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">📝 {item.result.transcript.length.toLocaleString()} ตัวอักษร</span>
                              <span className="text-[9px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">🖼️ {item.result.screenshotUrls.length} รูป</span>
                              {item.result.channelName && <span className="text-[9px] text-gray-400">📺 {item.result.channelName}</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {item.result && (
                            <button
                              onClick={() => setExpandedQueueId(isExpanded ? null : item.id)}
                              className="text-[10px] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-all"
                            >
                              {isExpanded ? '▲ ซ่อน' : '▼ ดู'}
                            </button>
                          )}
                          {!ytQueueStore.isRunning && (
                            <button
                              onClick={() => removeQueueItem(item.id)}
                              className="text-red-500 text-xs px-1.5 py-0.5 hover:bg-red-500/10 rounded transition-all"
                            >✕</button>
                          )}
                        </div>
                      </div>

                      {/* Expanded: show transcript preview + images */}
                      {isExpanded && item.result && (
                        <div className="mt-3 space-y-2 border-t border-gray-700/30 pt-3">
                          {item.result.transcript && (
                            <div className="bg-black/30 rounded-lg border border-gray-700/50 p-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                              <pre className="text-[10px] text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">{item.result.transcript.substring(0, 2000)}{item.result.transcript.length > 2000 ? '...' : ''}</pre>
                            </div>
                          )}
                          {item.result.screenshotUrls.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap">
                              {item.result.screenshotUrls.slice(0, 8).map((img, ii) => (
                                <a key={ii} href={img} target="_blank" rel="noreferrer">
                                  <img src={img} alt={`frame ${ii + 1}`} className="h-12 w-20 object-cover rounded border border-gray-700/50 hover:border-cyan-500 transition-all" />
                                </a>
                              ))}
                              {item.result.screenshotUrls.length > 8 && (
                                <div className="h-12 w-12 rounded border border-gray-700/50 bg-black/40 flex items-center justify-center text-[10px] text-gray-400">
                                  +{item.result.screenshotUrls.length - 8}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 border-t border-gray-700/30 pt-3">
                {/* Start buttons — show when NOT running */}
                {!ytQueueStore.isRunning && !ytQueueStore.isPaused && (
                  <>
                    <button
                      onClick={handleProcessSelected}
                      disabled={ytQueueSelectedIds.size === 0}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                    >
                      🚀 ดึง {ytQueueSelectedIds.size} คลิปที่เลือก
                    </button>
                    <button
                      onClick={handleProcessAll}
                      disabled={ytQueueStore.items.every(q => q.status === 'completed')}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                    >
                      🚀 ดึงทั้งหมด {ytQueueStore.items.filter(q => q.status !== 'completed').length} คลิป
                    </button>
                    <button
                      onClick={handleProcessAllAndSave}
                      disabled={isBatchSaving || ytQueueStore.items.every(q => q.status === 'completed')}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                    >
                      🎬 ดึง Script+รูป {ytQueueStore.items.filter(q => q.status !== 'completed').length} คลิป แล้วบันทึกเข้าคลัง
                    </button>
                  </>
                )}

                {/* Control buttons — show when running */}
                {ytQueueStore.isRunning && (
                  <>
                    <button
                      onClick={() => ytQueueStore.requestPause()}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                    >
                      ⏸️ พักการทำงาน
                    </button>
                    <button
                      onClick={() => ytQueueStore.requestStop()}
                      className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                    >
                      ⛔ หยุดทั้งหมด
                    </button>
                    <span className="text-xs text-gray-400 flex items-center animate-pulse">⏳ กำลังดึง...</span>
                  </>
                )}

                {/* Resume button — show when paused */}
                {ytQueueStore.isPaused && !ytQueueStore.isRunning && (
                  <>
                    <button
                      onClick={() => ytQueueStore.resume()}
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-green-500/20"
                    >
                      ▶️ ทำต่อ ({ytQueueStore.items.filter(q => q.status === 'pending').length} คลิปที่เหลือ)
                    </button>
                    <button
                      onClick={() => ytQueueStore.requestStop()}
                      className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                    >
                      ⛔ หยุดเลย
                    </button>
                    <span className="text-xs text-amber-400 flex items-center">⏸️ พักอยู่</span>
                  </>
                )}

                {/* Save button — always show when there are completed items */}
                {ytQueueStore.items.some(q => q.status === 'completed') && (
                  <button
                    onClick={handleBatchSaveToStock}
                    disabled={isBatchSaving}
                    className="ml-auto px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
                  >
                    {isBatchSaving ? '⏳ กำลังบันทึก...' : `📦 บันทึก ${ytQueueStore.items.filter(q => q.status === 'completed').length} คลิปเข้าคลัง`}
                  </button>
                )}
              </div>
            </Card>
          )}

          {/* Also allow adding single URL to queue */}
          {ytUrl.trim() && !ytQueueStore.items.some(q => q.url === ytUrl.trim()) && (
            <div className="flex justify-end -mt-2">
              <button
                onClick={() => {
                  const ids = ytQueueStore.addUrls([ytUrl.trim()]);
                  setYtQueueSelectedIds(prev => new Set([...prev, ...ids]));
                  setYtUrl('');
                }}
                className="text-[10px] px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all"
              >
                ➕ เพิ่มเข้าคิวแทน
              </button>
            </div>
          )}

          {ytResult && (
            <>
              {/* Video Info */}
              <Card>
                <div className="flex items-start gap-4">
                  {ytResult.channelAvatar && (
                    <img src={ytResult.channelAvatar} alt="thumbnail" className="w-32 h-20 object-cover rounded-lg flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-100 text-base leading-snug mb-1">{ytResult.videoTitle}</h3>
                    <p className="text-sm text-gray-400">📺 {ytResult.channelName}</p>
                    <p className={`text-xs ${ytResult.channelLogoUrl ? 'text-emerald-400' : 'text-amber-400'}`}>
                      โลโก้ช่อง: {ytResult.channelLogoUrl ? 'ดึงได้แล้ว' : 'ยังไม่ได้จาก yt-dlp'}
                    </p>
                    {typeof ytResult.subscriberCount === 'number' && (
                      <p className="text-xs text-gray-500">ผู้ติดตาม: {ytResult.subscriberCount.toLocaleString()}</p>
                    )}
                    <a href={ytUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline break-all mt-1 block">{ytUrl}</a>
                  </div>
                </div>
              </Card>

              {/* Transcript */}
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-200 flex items-center gap-2">📝 Script / คำบรรยาย
                    <span className="text-[10px] font-normal text-gray-500">({ytResult.transcript.length.toLocaleString()} ตัวอักษร)</span>
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { navigator.clipboard.writeText(ytResult.transcript); }}
                      className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-all"
                    >
                      📋 คัดลอก
                    </button>
                    <button
                      onClick={handleSaveYtToStock}
                      disabled={isSavingYt}
                      className="text-xs px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-bold rounded-lg transition-all"
                    >
                      {isSavingYt ? '⏳...' : `📦 เก็บเข้าคลัง${ytSelectedImages.size > 0 ? ` + ${ytSelectedImages.size} รูป` : ''}`}
                    </button>
                  </div>
                </div>
                {ytResult.transcript ? (
                  <div className="bg-black/30 rounded-lg border border-gray-700/50 p-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{ytResult.transcript}</pre>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">⚠️ ดึง Script ไม่ได้ — คลิปนี้อาจไม่มี subtitle หรือปิดการเข้าถึง</p>
                )}
              </Card>

              {/* Screenshots */}
              {ytResult.screenshotUrls.length > 0 && (
                <Card>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <h3 className="font-bold text-gray-200 flex items-center gap-2">
                      🖼️ รูปภาพจากคลิป
                      <span className="text-[10px] font-normal text-gray-500">({ytResult.screenshotUrls.length} รูป)</span>
                    </h3>
                    <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                      เลือก {ytSelectedImages.size}/{ytResult.screenshotUrls.length} รูป
                    </span>
                    <div className="flex gap-1.5 ml-auto">
                      <button onClick={selectAllYtImages} className="text-[10px] px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all">☑ เลือกทั้งหมด</button>
                      <button onClick={deselectAllYtImages} className="text-[10px] px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all">☐ ยกเลิก</button>
                      <button
                        onClick={handleYoutubeExtract}
                        disabled={isYtLoading}
                        className="text-[10px] px-2.5 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-lg transition-all"
                      >
                        🔀 สุ่มรูปใหม่
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {ytResult.screenshotUrls.map((imgUrl, i) => {
                      const isSelected = ytSelectedImages.has(imgUrl);
                      return (
                        <div
                          key={i}
                          onClick={() => toggleYtImage(imgUrl)}
                          className={`group relative aspect-video overflow-hidden rounded-lg border-2 cursor-pointer transition-all ${isSelected ? 'border-cyan-400 shadow-lg shadow-cyan-500/20' : 'border-gray-700/50 hover:border-gray-500'}`}
                        >
                          <img src={imgUrl} alt={`frame ${i + 1}`} className="w-full h-full object-cover" />
                          <div className={`absolute inset-0 transition-all ${isSelected ? 'bg-cyan-500/10' : 'bg-transparent group-hover:bg-white/5'}`} />
                          {/* Checkbox overlay */}
                          <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-cyan-500 border-cyan-400' : 'bg-black/50 border-gray-500'}`}>
                            {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
                          </div>
                          <span className="absolute bottom-1 right-1 text-[9px] bg-black/70 text-white px-1 py-0.5 rounded">#{i + 1}</span>
                          <a
                            href={imgUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="absolute top-1.5 right-1.5 text-[9px] bg-black/60 hover:bg-black/80 text-white px-1.5 py-0.5 rounded transition-all opacity-0 group-hover:opacity-100"
                          >
                            🔗
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* RSS Mode */}
      {activeMode === 'rss' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <div className="mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">🗞️</span> ดูดข่าว RSS เข้าคลังบทความ
            </h2>
          </div>
          
          <div className="mb-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">📚 แหล่งข่าวแนะนำ (จิ้มเพื่อดูด)</h3>
            <div className="flex flex-wrap gap-2">
              {SITE_LIBRARY.map((site, i) => {
                const isSelected = selectedSites.has(site.url);
                return (
                  <button
                    key={i}
                    onClick={() => toggleSiteSelect(site.url)}
                    className={`px-3 py-1.5 text-xs font-medium border rounded-lg shadow-sm transition-all flex items-center gap-1 ${
                      isSelected 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:text-blue-600'
                    }`}
                    title={site.cat}
                  >
                    {isSelected && <span className="text-xs">✓</span>}
                    {site.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex gap-2">
              <input 
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="วางลิงก์หน้าเว็บอื่น หรือเลือกจากแหล่งข่าวด้านบน (เลือกหลายแหล่งได้)"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button 
                onClick={handleScrape}
                disabled={isScraping}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-lg shadow transition-all"
              >
                {isScraping ? 'กำลังดูด...' : '🔍 สแกนหาข่าว'}
              </button>
            </div>
          </div>
        </Card>

        {articles.length > 0 && (
          <div className="space-y-3 mb-3 mt-8">
            <div className="flex flex-wrap justify-between items-center px-1 gap-4">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-gray-700 dark:text-gray-300 text-lg">พบ {articles.length} ข่าว</h3>
                <select 
                  value={sortBy} 
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm font-medium"
                >
                  <option value="default">จัดเรียง: ตามที่ดึงมา</option>
                  <option value="newsScore">🔥 เรียงตาม คะแนนข่าว</option>
                  <option value="evergreenScore">🌿 เรียงตาม คะแนน Evergreen</option>
                </select>
              </div>
              <button 
                onClick={handleTranslateTitles}
                disabled={isTranslating}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow transition-all flex items-center gap-2"
              >
                {isTranslating ? 'กำลังแปล...' : '🇹🇭 แปลหัวข้อเป็นไทย & ให้คะแนน'}
              </button>
            </div>

            {/* Multi-select controls */}
            <div className="flex flex-wrap items-center gap-2 px-1 py-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
              <button onClick={selectAll} className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded font-medium transition-all">☑ เลือกทั้งหมด</button>
              <button onClick={deselectAll} className="text-xs bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded font-medium transition-all">☐ ยกเลิก</button>
              <span className="text-xs text-gray-500 dark:text-gray-400">เลือกอยู่ {selectedIds.size}/{articles.length}</span>
              {isBulkSending && (
                <button onClick={() => { stopBulkRef.current = true; }} className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-bold transition-all">⛔ หยุด</button>
              )}
              {selectedIds.size > 0 && (
                <>
                  {/* Save to Article Stock */}
                  <button
                    onClick={async () => {
                      const selected = articles.filter(a => selectedIds.has(a.id));
                      if (selected.length === 0) return;
                      stopBulkRef.current = false;
                      setIsBulkSending(true);
                      addLog(`📦 กำลังดึงเนื้อหาและเก็บ ${selected.length} ข่าวเข้าคลังบทความ...`);
                      const saveTaskId = `news_save_${Date.now()}`;
                      globalTaskStore.addTask({ id: saveTaskId, title: `📦 เก็บข่าวเข้าคลัง ${selected.length} ข่าว`, category: 'news-save', progress: `กำลังดึงเนื้อหา 0/${selected.length}...`, status: 'running' });
                      const stockItems: any[] = [];
                      for (let i = 0; i < selected.length; i++) {
                        if (stopBulkRef.current) {
                          addLog(`⛔ หยุดโดยผู้ใช้ (${i}/${selected.length})`);
                          globalTaskStore.updateTask(saveTaskId, { progress: `⛔ หยุดแล้ว (${i}/${selected.length})`, status: 'error' });
                          break;
                        }
                        const art = selected[i];
                        addLog(`📖 [${i+1}/${selected.length}] อ่านเนื้อหาจาก ${art.domain}...`);
                        globalTaskStore.updateTask(saveTaskId, { progress: `📖 [${i+1}/${selected.length}] ดึงจาก ${art.domain}...` });
                        try {
                          let rawText = art.rawText || '';
                          if (!rawText) {
                            const jinaRes = await fetch(`https://r.jina.ai/${art.url}`, {
                              headers: { 'Accept': 'text/plain', 'X-Return-Format': 'text' }
                            });
                            if (jinaRes.ok) {
                              rawText = (await jinaRes.text()).substring(0, 8000);
                              setArticles(prev => prev.map(a => a.id === art.id ? { ...a, rawText } : a));
                            }
                          }
                          stockItems.push({
                            id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
                            title: art.thaiTitle || art.title,
                            rawArticle: rawText || art.title,
                            sourceUrl: art.url,
                            newsScore: art.score || 0,
                            evergreenScore: art.evergreenScore || 0,
                            tags: art.tags || [],
                            domain: art.domain,
                            createdAt: new Date().toISOString()
                          });
                        } catch (e: any) {
                          addLog(`⚠️ ดึงเนื้อหา ${art.title.substring(0,30)} ไม่ได้: ${e.message}`);
                          stockItems.push({
                            id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
                            title: art.thaiTitle || art.title,
                            rawArticle: art.title,
                            sourceUrl: art.url,
                            newsScore: art.score || 0,
                            evergreenScore: art.evergreenScore || 0,
                            tags: art.tags || [],
                            domain: art.domain,
                            createdAt: new Date().toISOString()
                          });
                        }
                      }
                      // Save to API
                      try {
                        const res = await fetch('/api/article-stock', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'add-batch', items: stockItems })
                        });
                        const data = await res.json();
                        addLog(`✅ เก็บเข้าคลังบทความสำเร็จ! เพิ่ม ${data.added} ข่าว (ซ้ำ ${data.duplicates} ข่าว)`);
                        globalTaskStore.updateTask(saveTaskId, { progress: `✅ เพิ่ม ${data.added} ข่าว (ซ้ำ ${data.duplicates})`, status: 'completed' });
                      } catch (e: any) {
                        addLog(`❌ เก็บเข้าคลังบทความล้มเหลว: ${e.message}`);
                        globalTaskStore.updateTask(saveTaskId, { progress: `❌ ${e.message}`, status: 'error' });
                      }
                      setIsBulkSending(false);
                    }}
                    disabled={isBulkSending}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                  >
                    {isBulkSending ? '⏳ กำลังดึงเนื้อหา...' : `📦 เก็บ ${selectedIds.size} ข่าวเข้าคลัง`}
                  </button>

                  {/* Send to AI Page */}
                  {onSendToAIPage && (
                    <button
                      onClick={async () => {
                        const selected = articles.filter(a => selectedIds.has(a.id));
                        if (selected.length === 0) return;
                        stopBulkRef.current = false;
                        setIsBulkSending(true);
                        addLog(`🚀 กำลังดึงเนื้อหาดิบ ${selected.length} ข่าวเพื่อส่งไปทำโพสต์ AI...`);
                        const aiSendTaskId = `news_ai_${Date.now()}`;
                        globalTaskStore.addTask({ id: aiSendTaskId, title: `📰 ส่งข่าวไป AI Page ${selected.length} ข่าว`, category: 'news-save', progress: `ดึงเนื้อหา 0/${selected.length}...`, status: 'running' });
                        const results: { rawArticle: string; sourceUrl: string; title: string; tags?: string[]; images?: string[]; sourceType?: string; domain?: string }[] = [];
                        const stockItems: any[] = [];
                        const sentToAIPageAt = new Date().toISOString();
                        for (let i = 0; i < selected.length; i++) {
                          if (stopBulkRef.current) {
                            addLog(`⛔ หยุดโดยผู้ใช้ (${i}/${selected.length})`);
                            globalTaskStore.updateTask(aiSendTaskId, { progress: `⛔ หยุดแล้ว (${i}/${selected.length})`, status: 'error' });
                            break;
                          }
                          const art = selected[i];
                          addLog(`📖 [${i+1}/${selected.length}] อ่านเนื้อหาจาก ${art.domain}...`);
                          globalTaskStore.updateTask(aiSendTaskId, { progress: `📖 [${i+1}/${selected.length}] ดึงจาก ${art.domain}...` });
                          try {
                            let rawText = art.rawText || '';
                            if (!rawText) {
                              const jinaRes = await fetch(`https://r.jina.ai/${art.url}`, {
                                headers: { 'Accept': 'text/plain', 'X-Return-Format': 'text' }
                              });
                              if (jinaRes.ok) {
                                rawText = (await jinaRes.text()).substring(0, 8000);
                                setArticles(prev => prev.map(a => a.id === art.id ? { ...a, rawText } : a));
                              }
                            }
                            results.push({ rawArticle: rawText || art.title, sourceUrl: art.url, title: art.thaiTitle || art.title, tags: art.tags || [], images: [], sourceType: 'news', domain: art.domain });
                            stockItems.push({
                              id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
                              title: art.thaiTitle || art.title,
                              rawArticle: rawText || art.title,
                              sourceUrl: art.url,
                              newsScore: art.score || 0,
                              evergreenScore: art.evergreenScore || 0,
                              tags: art.tags || [],
                              domain: art.domain,
                              createdAt: new Date().toISOString(),
                              sentToAIPageAt
                            });
                          } catch (e: any) {
                            addLog(`⚠️ ดึงเนื้อหา ${art.title.substring(0,30)} ไม่ได้: ${e.message}`);
                            results.push({ rawArticle: art.title, sourceUrl: art.url, title: art.thaiTitle || art.title, tags: art.tags || [], images: [], sourceType: 'news', domain: art.domain });
                          }
                        }
                        // Also save to Article Stock for persistence
                        try {
                          await fetch('/api/article-stock', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'add-batch', items: stockItems })
                          });
                          addLog(`📦 บันทึกลงคลังบทความด้วยเรียบร้อย`);
                        } catch(e) {}
                        addLog(`✅ ดึงเนื้อหาเสร็จ ${results.length} ข่าว → กำลังส่งไปหน้า "สร้างรูปลงเพจ AI"...`);
                        globalTaskStore.updateTask(aiSendTaskId, { progress: `✅ ส่ง ${results.length} ข่าวไป AI Page เรียบร้อย`, status: 'completed' });
                        onSendToAIPage(results);
                        setIsBulkSending(false);
                      }}
                      disabled={isBulkSending}
                      className="ml-auto px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
                    >
                      {isBulkSending ? '⏳ กำลังดึงเนื้อหา...' : `📰 ส่ง ${selectedIds.size} ข่าวไปทำโพสต์ AI`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {sortedArticles.length > 0 && (
          <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
            {sortedArticles.map((article, i) => (
              <div key={article.id} className={`bg-white dark:bg-gray-800 p-4 rounded-xl border transition-all flex flex-col md:flex-row gap-4 items-start md:items-center justify-between ${selectedIds.has(article.id) ? 'border-cyan-500 dark:border-cyan-500 bg-cyan-50/50 dark:bg-cyan-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-400'}`}>
                <label className="cursor-pointer flex-shrink-0 mt-1">
                  <input type="checkbox" checked={selectedIds.has(article.id)} onChange={() => toggleSelect(article.id)} className="w-5 h-5 text-cyan-500 bg-gray-700 border-gray-600 rounded cursor-pointer" />
                </label>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                     <span className="text-xs text-gray-500 font-bold">{i + 1}. {article.domain}</span>
                     {article.score !== undefined && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                           article.score >= 8 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                           article.score >= 5 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                           'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                           🔥 ข่าว: {article.score}/10
                        </span>
                     )}
                     {article.evergreenScore !== undefined && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                           article.evergreenScore >= 8 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                           article.evergreenScore >= 5 ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' :
                           'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                           🌿 Evergreen: {article.evergreenScore}/10
                        </span>
                     )}
                     {article.tags && article.tags.length > 0 && article.tags.map((tag, ti) => (
                        <span key={ti} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-medium">#{tag}</span>
                     ))}
                  </div>
                  
                  {article.thaiTitle ? (
                    <>
                      <h3 className="text-[16px] font-bold text-gray-800 dark:text-gray-100 mb-1 leading-snug">
                        {article.thaiTitle}
                      </h3>
                      <p className="text-[12px] text-gray-500 mb-2 truncate max-w-xl">{article.title}</p>
                    </>
                  ) : (
                    <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100 mb-2 leading-snug">
                      {article.title}
                    </h3>
                  )}
                  
                  <a href={article.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline break-all">
                    {article.url}
                  </a>
                </div>
                
                <button 
                  onClick={() => handleProcessArticle(article)}
                  disabled={processingId !== null}
                  className={`min-w-[120px] px-4 py-2 rounded-lg font-bold text-sm shadow flex items-center justify-center transition-all ${
                    processingId === article.id 
                    ? 'bg-amber-500 text-white animate-pulse cursor-not-allowed'
                    : processingId !== null
                      ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 border cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {processingId === article.id ? 'กำลังปั่นข่าว ⚙️' : '📦 โยนเข้าคลังบทความ'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lg:col-span-1">
        <Card className="sticky top-4">
          <div className="mb-4">
            <h2 className="text-lg flex items-center gap-2 font-bold">
              💻 สเตตัสการปั่น (Live Logs)
            </h2>
          </div>
          <div>
            <div className="bg-black/90 p-3 rounded-lg h-[400px] overflow-y-auto font-mono text-[11px] text-green-400 space-y-1 shadow-inner custom-scrollbar">
              {logs.length === 0 ? (
                <div className="text-gray-500 italic text-center mt-10">ระบบรอดำเนินการ...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="break-words opacity-90 hover:opacity-100 border-b border-white/10 pb-1">{log}</div>
                ))
              )}
            </div>
            {logs.length > 0 && (
               <button onClick={() => setLogs([])} className="w-full mt-2 text-xs text-gray-400 hover:text-red-500">
                  ล้างหน้าจอ Logs
               </button>
            )}
            
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-xs text-blue-700 dark:text-blue-300">
              <strong>💡 ทริคการใช้งาน:</strong>
              <ul className="list-disc pl-4 mt-1 space-y-1">
                <li>เอาลิงก์จากหน้าหมวดหมู่มาใส่ (เช่น หน้ารวมข่าวหุ้น) มันจะสอยมาให้ทีละ 20-50 เรื่อง</li>
                <li>คุณมีหน้าที่แค่กดปุ่มเขียว AI จะอ่านเนื้อหาเต็มทะลุกำแพง และเขียนข่าวสรุปให้ใหม่ 100% ตรงคอนเทนต์</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Scraped Today Box */}
        <Card className="mt-4 sticky top-[600px]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>📅</span> แหล่งข่าวที่ดูดแล้ววันนี้
            </h3>
            <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">{new Date().toLocaleDateString('th-TH')}</span>
          </div>
          
          {scrapedToday.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">
              ยังไม่มีการดูดข่าวในวันนี้
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
              {scrapedToday.map((item, idx) => (
                <div key={idx} className="flex flex-col bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-[13px] text-blue-600 dark:text-blue-400">{item.name}</span>
                    <span className="text-[10px] text-gray-500">{item.time}</span>
                  </div>
                  <a href={item.url} target="_blank" rel="noreferrer" className="text-[10px] text-gray-400 hover:text-blue-500 truncate block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                    {item.url}
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      </div>
      )}

    </div>
  );
};
