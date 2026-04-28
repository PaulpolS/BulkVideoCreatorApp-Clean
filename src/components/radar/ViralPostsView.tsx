import React, { useState, useEffect, useRef } from 'react';
import { NumInput } from '../ui/NumInput';
import { CompetitorPage, RadarPost } from '../../interfaces/radar';
import { globalTaskStore } from '../../hooks/useBackgroundTasks';

interface Props {
  pages: CompetitorPage[];
}

type EnrichedPost = RadarPost & { pageName: string; platform: string; pageUrl: string; category: string; ageDays: number };

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SavedPrompt {
  id: string;
  text: string;
}

const DEFAULT_PROMPTS: SavedPrompt[] = [
  { id: 'p1', text: 'ควรทำเนื้อหาสอนเรื่องอะไรจากเทรนด์ตอนนี้?' },
  { id: 'p2', text: 'สรุปเทรนด์หลัก 3-5 อย่างประจำรอบนี้' },
  { id: 'p3', text: 'โพสต์รูปแบบไหนที่เวิร์คที่สุด (ภาพ/คลิปสั้น/ยาว)?' },
  { id: 'p4', text: 'แนวทางเนื้อหาที่ควรหลีกเลี่ยงตอนนี้คืออะไร?' },
];


// ดึง OpenRouter API Key จาก api_profiles
async function getOpenRouterKey(): Promise<string> {
  try {
    const res = await fetch('/api/get-app-data?key=api_profiles');
    const profiles = await res.json();
    if (Array.isArray(profiles) && profiles.length > 0) {
      const activeId = localStorage.getItem('api_global_active_id') || profiles[0].id;
      const activeProfile = profiles.find((p: any) => p.id === activeId) || profiles[0];
      return activeProfile.openRouterKey || '';
    }
  } catch (e) { console.error(e); }
  // fallback
  return localStorage.getItem('openrouter_key') || '';
}

export function ViralPostsView({ pages }: Props) {
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPage, setFilterPage] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(0);
  
  const [postLimit, setPostLimit] = useState<number | string>(100);
  const [showAllPosts, setShowAllPosts] = useState<boolean>(false);
  const [timeRange, setTimeRange] = useState<string>('30'); // '7', '14', '30', 'all', 'custom'
  const [customDays, setCustomDays] = useState<number>(30);

  // AI Chat states
  const [chatHistory, setChatHistory] = useState<AIChatMessage[]>([]);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExportingAI, setIsExportingAI] = useState(false);
  const [exportAILog, setExportAILog] = useState<string>('');
  const [aiPostsContext, setAiPostsContext] = useState<{label: string, posts: EnrichedPost[]}>({label:'', posts:[]});
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('radar_selected_model') || 'google/gemini-3-flash-preview');

  // Post scores (viral/evergreen) — persisted server-side
  type PostScore = { viral: number | null; evergreen: number | null };
  const [postScores, setPostScores] = useState<Record<string, PostScore>>({});
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [filterViralMin, setFilterViralMin] = useState<number>(0);
  const [filterEvergreenMin, setFilterEvergreenMin] = useState<number>(0);
  const [isSendingToStock, setIsSendingToStock] = useState(false);
  const [isAIScoring, setIsAIScoring] = useState(false);
  const [aiScoringLog, setAiScoringLog] = useState('');

  useEffect(() => {
    fetch('/api/get-app-data?key=post_scores')
      .then(r => r.json())
      .then(d => { if (d && typeof d === 'object' && !Array.isArray(d)) setPostScores(d); })
      .catch(() => {});
  }, []);

  const savePostScores = (scores: Record<string, PostScore>) => {
    fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'post_scores', data: scores }),
    });
  };

  const updatePostScore = (postId: string, field: 'viral' | 'evergreen', value: number) => {
    const newScores = { ...postScores, [postId]: { ...(postScores[postId] || { viral: null, evergreen: null }), [field]: value } };
    setPostScores(newScores);
    savePostScores(newScores);
  };

  const handleAutoSelect = (posts: EnrichedPost[]) => {
    const matching = posts.filter(p => {
      const score = postScores[p.id];
      if (!score) return false;
      const viralOk = filterViralMin === 0 || (score.viral ?? 0) >= filterViralMin;
      const evergreenOk = filterEvergreenMin === 0 || (score.evergreen ?? 0) >= filterEvergreenMin;
      return viralOk && evergreenOk;
    });
    setSelectedPostIds(new Set(matching.map(p => p.id)));
  };

  const sendSelectedToStock = async (posts: EnrichedPost[]) => {
    const toSend = posts.filter(p => selectedPostIds.has(p.id));
    if (toSend.length === 0) return;
    setIsSendingToStock(true);
    const items = toSend.map(p => {
      let domain = p.pageName || '';
      try { domain = new URL(p.url).hostname; } catch {}
      return {
        title: (p.caption || p.url).substring(0, 80),
        rawArticle: p.caption || '',
        sourceUrl: p.url,
        newsScore: postScores[p.id]?.viral ?? 0,
        evergreenScore: postScores[p.id]?.evergreen ?? 0,
        tags: [p.category, p.platform, p.pageName].filter(Boolean),
        domain,
        createdAt: p.postedAt || new Date().toISOString(),
        fbLikes: p.likes,
        fbComments: p.comments,
        fbShares: p.shares,
        fbViews: p.views,
      };
    });
    try {
      const res = await fetch('/api/article-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-batch', items }),
      });
      const data = await res.json();
      alert(`✅ ส่งเข้าคลังสำเร็จ! เพิ่ม ${data.added ?? toSend.length} โพสต์ (ซ้ำ ${data.duplicates ?? 0})`);
      setSelectedPostIds(new Set());
    } catch {
      alert('❌ ส่งเข้าคลังล้มเหลว');
    }
    setIsSendingToStock(false);
  };

  const scorePostsWithAI = async (posts: EnrichedPost[]) => {
    const apiKey = await getOpenRouterKey();
    if (!apiKey) { alert('❌ ยังไม่ได้ใส่ OpenRouter API Key ในตั้งค่า'); return; }

    const unscored = posts.filter(p => postScores[p.id]?.viral == null || postScores[p.id]?.evergreen == null);
    if (unscored.length === 0) { alert('✅ ทุกโพสต์มีคะแนนครบแล้ว'); return; }
    if (!confirm(`AI จะให้คะแนนไวรัล + Evergreen ให้กับ ${unscored.length} โพสต์ที่ยังไม่มีคะแนน\n(โพสต์ที่ให้คะแนนไว้แล้วจะไม่ถูกแตะ)\n\nดำเนินการต่อ?`)) return;

    const taskId = `radar_score_${Date.now()}`;
    globalTaskStore.enqueueTask({
      id: taskId,
      title: `AI ให้คะแนนโพสต์ (${unscored.length})`,
      category: 'radar',
      progress: `รอคิวให้คะแนน ${unscored.length} โพสต์`,
    }, async (task) => {
      setIsAIScoring(true);
      const BATCH_SIZE = 10;
      const totalBatches = Math.ceil(unscored.length / BATCH_SIZE);
      let newScores = { ...postScores };

      const systemPrompt = `คุณคือผู้เชี่ยวชาญด้านการวิเคราะห์เนื้อหาโซเชียลมีเดีย
ให้คะแนนแต่ละโพสต์ 2 มิติ:
1. "viral_score" (0-10): ข่าวนี้ดึงดูด แชร์ง่าย เร้าอารมณ์ เป็นกระแสแค่ไหน?
2. "evergreen_score" (0-10): เนื้อหานี้มีคุณค่าระยะยาว อ่านได้ตลอดเวลา ไม่เกาะกระแสสั้นแค่ไหน?
ตอบ JSON เท่านั้น: { "results": [ { "id": 1, "viral_score": 8, "evergreen_score": 5 } ] }`;

      try {
        for (let i = 0; i < unscored.length; i += BATCH_SIZE) {
          if (task.isCancelled()) return;
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          setAiScoringLog(`batch ${batchNum}/${totalBatches}...`);
          task.log(`กำลังให้คะแนน batch ${batchNum}/${totalBatches}`);
          const batch = unscored.slice(i, i + BATCH_SIZE);
          const postsData = batch.map((p, idx) => ({
            id: i + idx + 1,
            caption: (p.caption || '').substring(0, 300),
          }));

          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': window.location.origin,
              'X-Title': 'Bulk Video Creator',
            },
            body: JSON.stringify({
              model: selectedModel,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: JSON.stringify(postsData) },
              ],
            }),
            signal: task.signal,
          });

          if (!res.ok) throw new Error(`API Error batch ${batchNum}`);
          const data = await res.json();
          try {
            const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
            if (Array.isArray(parsed.results)) {
              parsed.results.forEach((r: any) => {
                const post = batch[r.id - i - 1];
                if (!post) return;
                const existing = newScores[post.id] || { viral: null, evergreen: null };
                newScores = {
                  ...newScores,
                  [post.id]: {
                    viral: existing.viral ?? r.viral_score ?? null,
                    evergreen: existing.evergreen ?? r.evergreen_score ?? null,
                  },
                };
              });
            }
          } catch (e) { console.error('Parse error batch', batchNum, e); }
        }
        setPostScores(newScores);
        savePostScores(newScores);
        task.update({ progress: `AI ให้คะแนนสำเร็จ ${unscored.length} โพสต์`, status: 'completed' });
      } finally {
        setIsAIScoring(false);
        setAiScoringLog('');
      }
    });
  };

  useEffect(() => {
    localStorage.setItem('radar_selected_model', selectedModel);
  }, [selectedModel]);

  const MODEL_OPTIONS = [
    { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash (แนะนำ/เร็ว)' },
    { id: 'google/gemini-3-pro', name: 'Gemini 3 Pro (ฉลาด)' },
    { id: 'anthropic/claude-3.5-sonnet:beta', name: 'Claude 3.5 Sonnet' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (คุ้มค่า)' },
    { id: 'openai/gpt-4o', name: 'GPT-4o (เก่งสุด)' }
  ];

  useEffect(() => {
    fetch('/api/get-app-data?key=radar_prompts')
      .then(r => r.json())
      .then(d => {
        if(Array.isArray(d) && d.length > 0) setSavedPrompts(d);
        else setSavedPrompts(DEFAULT_PROMPTS);
      }).catch(() => setSavedPrompts(DEFAULT_PROMPTS));
  }, []);

  useEffect(() => {
    if(chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isAnalyzing]);

  const savePromptsData = async (newPrompts: SavedPrompt[]) => {
    setSavedPrompts(newPrompts);
    fetch('/api/save-app-data', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "radar_prompts", data: newPrompts }),
    });
  }

  const handleSaveCurrentPrompt = () => {
    if(!chatInput.trim()) return;
    const newP = { id: Date.now().toString(), text: chatInput };
    savePromptsData([...savedPrompts, newP]);
  }

  const handleDeletePrompt = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm('ต้องการลบเทมเพลตคำถามนี้หรือไม่?')) {
      savePromptsData(savedPrompts.filter(p => p.id !== id));
    }
  }

  const openChat = (posts: EnrichedPost[], label: string) => {
     if(aiPostsContext.label !== label) {
         setChatHistory([]);
     }
     setAiPostsContext({label, posts});
     setIsChatOpen(true);
     setTimeout(() => document.getElementById('ai-chat-panel')?.scrollIntoView({behavior: 'smooth', block: 'start'}), 100);
  }

  const categories = Array.from(new Set(pages.map(p => p.category || 'ทั่วไป'))).sort();
  const pageNames = Array.from(new Set(pages.filter(p => p.viralPosts && p.viralPosts.length > 0).map(p => p.name))).sort();

  const now = new Date();
  let allPosts: EnrichedPost[] = [];

  pages.forEach(p => {
    if (p.viralPosts && p.viralPosts.length > 0) {
      p.viralPosts.forEach(vp => {
        const postDate = new Date(vp.postedAt);
        const diffTime = Math.abs(now.getTime() - postDate.getTime());
        let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (isNaN(diffDays)) diffDays = 1;

        allPosts.push({
          ...vp,
          pageName: p.name,
          platform: p.platform,
          pageUrl: p.url,
          category: p.category || 'ทั่วไป',
          ageDays: diffDays
        });
      });
    }
  });

  let filtered = allPosts;
  if (filterPlatform !== 'all') {
    filtered = filtered.filter(p => p.platform === filterPlatform);
  }
  if (filterCategory !== 'all') {
    filtered = filtered.filter(p => p.category === filterCategory);
  }
  if (filterPage !== 'all') {
    filtered = filtered.filter(p => p.pageName === filterPage);
  }

  let displayPosts = filtered;
  if (timeRange !== 'all') {
    const daysLimit = timeRange === 'custom' ? customDays : parseInt(timeRange);
    displayPosts = displayPosts.filter(p => p.ageDays <= daysLimit);
  }

  const sortByEng = (a: EnrichedPost, b: EnrichedPost) =>
    (b.likes + b.comments + b.shares + b.views) - (a.likes + a.comments + a.shares + a.views);

  displayPosts.sort(sortByEng);

  const actualLimit = typeof postLimit === 'number' ? postLimit : 100;
  const totalPosts = showAllPosts ? displayPosts.length : Math.min(displayPosts.length, actualLimit);
  displayPosts = showAllPosts ? displayPosts : displayPosts.slice(0, actualLimit);

  const PER_PAGE = 20;
  const totalPages = Math.ceil(displayPosts.length / PER_PAGE);
  const visiblePosts = displayPosts.slice(currentPage * PER_PAGE, (currentPage + 1) * PER_PAGE);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const exportCSV = (posts: EnrichedPost[], label: string) => {
    if (posts.length === 0) return;
    const csvHeader = 'ลำดับ,ชื่อเพจ,ประเภทเพจ,ลิงก์โพส,ข้อความ,ประเภทโพส,ไลก์,แชร์,คอมเมนต์,ยอดวิว,อายุ(วัน),วันที่โพส,คะแนนข่าว,คะแนน Evergreen';
    const csvRows = posts.map((p, idx) => {
      const text = (p.caption || '').replace(/[\n\r,"]/g, ' ').substring(0, 200);
      const viral = postScores[p.id]?.viral ?? '';
      const evergreen = postScores[p.id]?.evergreen ?? '';
      return `${idx+1},"${p.pageName}","${p.category}","${p.url}","${text}",${p.type},${p.likes},${p.shares},${p.comments},${p.views},${p.ageDays},"${p.postedAt}",${viral},${evergreen}`;
    });
    const csvContent = '\uFEFF' + csvHeader + '\n' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const catLabel = filterCategory !== 'all' ? `_${filterCategory}` : '';
    a.download = `top100_${label}${catLabel}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSVWithAI = async (posts: EnrichedPost[], label: string) => {
    if (posts.length === 0) return;
    
    const apiKey = await getOpenRouterKey();
    if (!apiKey) {
      alert('❌ ยังไม่ได้ใส่ OpenRouter API Key ในตั้งค่า');
      return;
    }

    if (posts.length > 50) {
      if(!confirm(`คุณกำลังส่งออก ${posts.length} โพสต์ พร้อมให้ AI วิเคราะห์ ซึ่งอาจใช้เวลานาน (1-3 นาที) ต้องการดำเนินการต่อหรือไม่?`)) return;
    }

    setIsExportingAI(true);
    setExportAILog('เตรียมข้อมูล...');
    try {
      let aiResults: any = {};
      const BATCH_SIZE = 10;
      const totalBatches = Math.ceil(posts.length / BATCH_SIZE);

      const systemPrompt = `คุณคือผู้เชี่ยวชาญด้านการวิเคราะห์เนื้อหาโซเชียลมีเดียและกลยุทธ์การขายคอร์สออนไลน์
วิเคราะห์โพสต์เหล่านี้และประเมิน 4 ข้อสำหรับแต่ละโพสต์:

1. "ทำคอร์สออนไลน์ได้": ให้คะแนน 0-10 ว่าโพสต์นี้เหมาะที่จะนำไปสร้างเป็นคอร์สออนไลน์หรือไม่ (ใส่คะแนนใน 'course_score') ถ้าคะแนนตั้งแต่ 7 ขึ้นไป ให้เขียนไอเดียสั้นๆ (ไม่เกิน 15 คำ) ใน 'course_idea' ถ้าต่ำกว่า 7 ให้ใส่ "-"

2. "ทำโพส Evergreen แบบดึงดูดได้": ให้คะแนน 0-10 ว่าโพสต์นี้เหมาะจะทำเป็นโพสต์แนว Evergreen (เนื้อหาเป็นอมตะ อ่านได้ตลอดไป ไม่เกาะกระแสสั้นๆ) ที่พาดหัวดึงดูดคลิกเบทหรือไม่ (ใส่คะแนนใน 'post_score') โพสต์ที่จะได้คะแนนสูงต้องเป็นแนว Evergreen เท่านั้น ถ้าคะแนนตั้งแต่ 7 ขึ้นไป ให้เขียนไอเดียพาดหัวสั้นๆ ใน 'post_idea' ถ้าต่ำกว่า 7 ให้ใส่ "-"

3. "หมวดโพสต์" (ใส่ใน 'post_categories'): จำแนกว่าโพสต์นี้เป็นหมวดอะไร โดย 1 โพสต์อาจมีได้หลายหมวด ให้ใส่เป็น array ของ string จากตัวเลือกต่อไปนี้เท่านั้น:
   - "คลิกเบต/ข่าวไวรัล" = โพสต์ที่ใช้หัวข้อเร้าใจ ข่าวเด่น กระแสร้อน เพื่อดึงความสนใจ
   - "ให้ความรู้เชิงลึก" = โพสต์ที่ให้ข้อมูล สอน อธิบาย How-to มีสาระ
   - "ขายคอร์ส" = โพสต์ที่มีเจตนาขายคอร์สเรียน ไม่ว่าจะเนียนหรือตรงๆ
   ถ้าโพสต์ไม่เข้าหมวดไหนเลย ให้ใส่ ["อื่นๆ"]

4. "สไตล์ขายคอร์ส" (ใส่ใน 'selling_styles'): ถ้าโพสต์มีหมวด "ขายคอร์ส" อยู่ด้วย ให้จำแนกต่อว่าใช้สไตล์ขายแบบไหน (อาจมีได้หลายสไตล์) จากตัวเลือกต่อไปนี้เท่านั้น:
   - "The Proof Maker" = โชว์ผลลัพธ์/อัปเดตบรรยากาศ เนียนๆขาย
   - "The Value Provider" = ขยี้ Pain Point + ให้คุณค่าล่อใจ
   - "The FOMO Creator" = สร้างความกดดัน/เล่นกับเวลา จำนวนจำกัด
   - "The B2B Authority" = โชว์ความโปรระดับองค์กร
   ถ้าไม่ใช่หมวดขายคอร์ส ให้ใส่ ["-"]

ตอบกลับเป็น JSON format เท่านั้น ในรูปแบบ:
{
  "results": [
    {
      "id": 1,
      "course_score": 8,
      "course_idea": "...",
      "post_score": 5,
      "post_idea": "-",
      "post_categories": ["คลิกเบต/ข่าวไวรัล", "ให้ความรู้เชิงลึก"],
      "selling_styles": ["-"]
    }
  ]
}`;

      for (let i = 0; i < posts.length; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        setExportAILog(`วิเคราะห์ชุดที่ ${batchNum}/${totalBatches}...`);
        
        const batch = posts.slice(i, i + BATCH_SIZE);
        const postsData = batch.map((p, idx) => ({
          id: i + idx + 1,
          caption: (p.caption || '').substring(0, 300)
        }));

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Bulk Video Creator',
          },
          body: JSON.stringify({
            model: selectedModel,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: JSON.stringify(postsData) }
            ],
          })
        });

        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content || '{}';
        
        try {
          const parsed = JSON.parse(content);
          if (parsed.results && Array.isArray(parsed.results)) {
            parsed.results.forEach((r: any) => {
              aiResults[r.id] = r;
            });
          }
        } catch (e) {
          console.error("Failed to parse AI response for batch", e);
        }
      }

      setExportAILog('สร้างไฟล์ CSV...');

      const csvHeader = 'ลำดับ,ชื่อเพจ,ประเภทเพจ,ลิงก์โพส,ข้อความ,ประเภทโพส,ไลก์,แชร์,คอมเมนต์,ยอดวิว,อายุ(วัน),วันที่โพส,คะแนนข่าว,คะแนน Evergreen,หมวดโพสต์,สไตล์ขายคอร์ส,ทำคอร์สออนไลน์ได้,ทำโพสคลิกเบทให้คนสนใจได้';
      const csvRows = posts.map((p, idx) => {
        const text = (p.caption || '').replace(/[\n\r,"]/g, ' ').substring(0, 200);
        const aiData = aiResults[idx + 1] || { course_score: 0, course_idea: '-', post_score: 0, post_idea: '-', post_categories: ['—'], selling_styles: ['-'] };

        let courseText = aiData.course_score >= 7 ? `[${aiData.course_score}/10] ${aiData.course_idea}` : `[${aiData.course_score || 0}/10] -`;
        let clickbaitText = aiData.post_score >= 7 ? `[${aiData.post_score}/10] ${aiData.post_idea}` : `[${aiData.post_score || 0}/10] -`;

        const course = courseText.replace(/[\n\r,"]/g, ' ');
        const clickbait = clickbaitText.replace(/[\n\r,"]/g, ' ');

        const categories = Array.isArray(aiData.post_categories) ? aiData.post_categories.join(' | ') : (aiData.post_categories || '—');
        const sellingStyles = Array.isArray(aiData.selling_styles) ? aiData.selling_styles.join(' | ') : (aiData.selling_styles || '-');
        const categoriesClean = categories.replace(/[\n\r,"]/g, ' ');
        const sellingStylesClean = sellingStyles.replace(/[\n\r,"]/g, ' ');

        const viralScore = postScores[p.id]?.viral ?? '';
        const evergreenScore = postScores[p.id]?.evergreen ?? '';

        return `${idx+1},"${p.pageName}","${p.category}","${p.url}","${text}",${p.type},${p.likes},${p.shares},${p.comments},${p.views},${p.ageDays},"${p.postedAt}",${viralScore},${evergreenScore},"${categoriesClean}","${sellingStylesClean}","${course}","${clickbait}"`;
      });
      
      const csvContent = '\uFEFF' + csvHeader + '\n' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const catLabel = filterCategory !== 'all' ? `_${filterCategory}` : '';
      a.download = `top100_AI_${label}${catLabel}_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเรียกใช้ AI กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsExportingAI(false);
      setExportAILog('');
    }
  };

  // === Caption Generation States ===
  type CaptionResult = { post: EnrichedPost; caption1: string; caption2: string; caption3: string; comment1: string; comment2: string; comment3: string; note: string };
  type CaptionLog = { time: string; type: 'info' | 'success' | 'error' | 'warning'; message: string };
  
  const CAPTION_MODES = [
    { id: 'selfwrite', name: 'ทำทรงเขียนเอง', desc: 'Clickbait เต็มที่ แต่ไม่อ้างเพจคู่แข่ง เขียนเหมือนหาข้อมูลมาเอง' },
    { id: 'clickbait', name: 'Clickbait จัดเต็ม', desc: 'แคปชั่นสไตล์ Clickbait เน้น Emoji + FOMO + ตัวเลข สร้าง Urgency สูงสุด' },
    { id: 'casual', name: 'แชร์ข่าวแบบเพื่อน', desc: 'เขียนแบบเพื่อนเล่าให้ฟัง ภาษาง่ายๆ สบายๆ ไม่ขายของ' },
  ];

  const [isCaptionPanelOpen, setIsCaptionPanelOpen] = useState(false);
  const [isCaptionGenerating, setIsCaptionGenerating] = useState(false);
  const [captionProgress, setCaptionProgress] = useState({ current: 0, total: 0 });
  const [captionResults, setCaptionResults] = useState<CaptionResult[]>([]);
  const [captionLogs, setCaptionLogs] = useState<CaptionLog[]>([]);
  const [captionPosts, setCaptionPosts] = useState<EnrichedPost[]>([]);
  const [captionSourceLabel, setCaptionSourceLabel] = useState('');
  const [captionModel, setCaptionModel] = useState<string>(() => localStorage.getItem('caption_selected_model') || 'google/gemini-3-flash-preview');
  const [captionMode, setCaptionMode] = useState<string>(() => localStorage.getItem('caption_mode') || 'selfwrite');
  const captionLogEndRef = useRef<HTMLDivElement>(null);
  const captionStopRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('caption_selected_model', captionModel);
  }, [captionModel]);

  useEffect(() => {
    localStorage.setItem('caption_mode', captionMode);
  }, [captionMode]);

  useEffect(() => {
    if (captionLogEndRef.current) captionLogEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [captionLogs]);

  const addCaptionLog = (type: CaptionLog['type'], message: string) => {
    const time = new Date().toLocaleTimeString('th-TH');
    setCaptionLogs(prev => [...prev, { time, type, message }]);
  };

  const openCaptionPanel = (posts: EnrichedPost[], label: string) => {
    setIsCaptionPanelOpen(true);
    setCaptionSourceLabel(label);
    setCaptionPosts(posts);
    // Don't clear results if same label (allow resume)
    if (captionSourceLabel !== label) {
      setCaptionResults([]);
      setCaptionLogs([]);
    }
    setTimeout(() => document.getElementById('caption-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const exportCaptionCSV = () => {
    if (captionResults.length === 0) return;
    const csvHeader = 'ลำดับ,ชื่อเพจ,ประเภทเพจ,ลิงก์โพส,ข้อความต้นฉบับ,ประเภทโพส,ไลก์,แชร์,คอมเมนต์,ยอดวิว,อายุ(วัน),วันที่โพส,แคปชั่นแบบที่1,แคปชั่นแบบที่2,แคปชั่นแบบที่3,ใต้เม้น 1/3,ใต้เม้น 2/3,ใต้เม้น 3/3,note';
    const csvRows = captionResults.map((r, idx) => {
      const sanitize = (s: string) => (s || '').replace(/[\n\r]/g, ' ').replace(/"/g, '""');
      const text = sanitize(r.post.caption || '').substring(0, 200);
      return `${idx+1},"${sanitize(r.post.pageName)}","${sanitize(r.post.category)}","${r.post.url}","${text}",${r.post.type},${r.post.likes},${r.post.shares},${r.post.comments},${r.post.views},${r.post.ageDays},"${r.post.postedAt}","${sanitize(r.caption1)}","${sanitize(r.caption2)}","${sanitize(r.caption3)}","${sanitize(r.comment1)}","${sanitize(r.comment2)}","${sanitize(r.comment3)}","${sanitize(r.note)}"`;
    });
    const csvContent = '\uFEFF' + csvHeader + '\n' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const catLabel = filterCategory !== 'all' ? `_${filterCategory}` : '';
    a.download = `clickbait_captions_${captionSourceLabel}${catLabel}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addCaptionLog('success', `📥 ส่งออก CSV สำเร็จ (${captionResults.length} โพสต์)`);
  };

  // === AI Caption Generation Logic (Batch with Logs) ===
  const generateCaptions = async (posts: EnrichedPost[]) => {
    if (posts.length === 0) return;

    const apiKey = await getOpenRouterKey();
    if (!apiKey) {
      alert('❌ ยังไม่ได้ใส่ OpenRouter API Key ในตั้งค่า\nไปที่ ⚙️ ตั้งค่า API แล้วกรอก OpenRouter Key ก่อนครับ');
      return;
    }

    captionStopRef.current = false;
    setIsCaptionGenerating(true);
    const currentMode = CAPTION_MODES.find(m => m.id === captionMode) || CAPTION_MODES[0];
    addCaptionLog('info', `🚀 เริ่มสร้างแคปชั่น [${currentMode.name}] — โมเดล: ${MODEL_OPTIONS.find(m => m.id === captionModel)?.name || captionModel}`);

    // Skip already processed posts
    const processedIds = new Set(captionResults.map(r => r.post.id));
    const remainingPosts = posts.filter(p => !processedIds.has(p.id));

    if (remainingPosts.length === 0) {
      addCaptionLog('success', '✅ ทุกโพสต์ถูกประมวลผลแล้ว! กด "ส่งออก CSV" ได้เลย');
      setIsCaptionGenerating(false);
      return;
    }

    const BATCH_SIZE = 3;
    const totalPosts = Math.min(remainingPosts.length, 100);
    const totalOverall = captionResults.length + totalPosts;
    setCaptionProgress({ current: captionResults.length, total: totalOverall });
    addCaptionLog('info', `📋 โพสต์ที่ต้องทำ: ${totalPosts} รายการ (ทีละ ${BATCH_SIZE} โพสต์) ${captionResults.length > 0 ? `| ทำไปแล้ว: ${captionResults.length}` : ''}`);

    for (let i = 0; i < totalPosts; i += BATCH_SIZE) {
      if (captionStopRef.current) {
        addCaptionLog('warning', `⏸️ หยุดชั่วคราว — ทำแล้ว ${captionResults.length} โพสต์ | กด "เริ่มต่อ" เพื่อทำต่อ หรือ "ส่งออก CSV" ได้เลย`);
        break;
      }

      const batch = remainingPosts.slice(i, Math.min(i + BATCH_SIZE, totalPosts));
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(totalPosts / BATCH_SIZE);
      addCaptionLog('info', `📦 Batch ${batchNum}/${totalBatches} — กำลังประมวลผล ${batch.length} โพสต์...`);

      const batchPromises = batch.map(async (post, batchIdx) => {
        const captionText = (post.caption || '').substring(0, 500);
        const eng = post.likes + post.comments + post.shares + post.views;
        const hasEnoughContent = captionText.trim().length > 30;
        const postLabel = `#${captionResults.length + i + batchIdx + 1} [${post.pageName}]`;

        // === Build prompts based on selected mode ===
        let systemPrompt = '';
        let userPrompt = '';

        if (captionMode === 'selfwrite') {
          systemPrompt = `คุณคือผู้เชี่ยวชาญด้านการเขียนแคปชั่น Clickbait สำหรับโซเชียลมีเดียภาษาไทย คุณเป็น Admin เพจที่เก่งมาก ติดตามข่าวสาร ค้นหาข้อมูลน่าสนใจมาเล่าให้คนอ่านเอง

เทคนิคที่คุณต้องใช้:
- ใช้ Emoji เร้าใจ (🔥, 🚀, ⚡️, 💡, 💎, 🎯) แต่ไม่ต้องเยอะจนน่ารำคาญ (2-4 ตัวต่อแคปชั่น)
- ใช้คำสร้าง Urgency เช่น "ห้ามพลาด!", "มาแรง!", ตัวเลขเฉพาะเจาะจง
- ลงท้ายด้วย (มีต่อ👇) หรือ (ดูต่อในคอมเม้นท์)
- สร้างความน่าเชื่อถือ + FOMO
- ใช้ภาษาแบบคนไทยโพสต์โซเชียลจริงๆ

กฎสำคัญ:
1. ห้ามพูดถึงชื่อเพจ/คนโพสต์ต้นทางเด็ดขาด — เขียนเหมือนคุณค้นหาข้อมูลนี้มาเอง จากแหล่งข่าว/บทความ/งานวิจัย
2. ถ้าในเนื้อหามีการอ้างถึงบุคคลสาธารณะ/บริษัท/ผลิตภัณฑ์ที่เป็นแหล่งข้อมูลจริง (เช่น Sam Altman, Google, Anthropic, Claude) ให้อ้างอิงได้ แต่ห้ามอ้างชื่อเพจหรือคนที่โพสต์
3. ใต้เม้น 1/3 ถึง 3/3 เขียนเหมือนคุณเป็นคนอธิบายเรื่องนี้ให้คนอ่านเข้าใจเอง ไม่ใช่การสรุปโพสต์คนอื่น
4. ใต้เม้น 3/3 ห้ามใส่ลิงก์ไปเพจคู่แข่ง ให้จบด้วยการชวนคนกดติดตามเพจเรา หรือชวนให้แสดงความคิดเห็น
5. ใน note ให้เขียนคำแนะนำสำหรับ Admin ว่า:
   - ควรหารูปประกอบอะไร (เช่น screenshot, infographic, ภาพตัวอย่าง)
   - ควรทำโพสต์เป็นแบบไหน (carousel, single image, video)
   - มีอะไรที่ต้องเพิ่มเติมหรือปรับเปลี่ยนก่อนโพสต์จริง

คุณต้องตอบกลับเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น ในรูปแบบ:
{
  "caption1": "แคปชั่นแบบ Story-driven เน้นเล่าเรื่อง โดนใจ",
  "caption2": "แคปชั่นแบบ Data-driven เน้นตัวเลข สถิติ ผลลัพธ์",
  "caption3": "แคปชั่นแบบ Problem-solution เน้นปัญหาและวิธีแก้",
  "comment1": "ใต้เม้น 1/3 - อธิบายเนื้อหาส่วนแรก",
  "comment2": "ใต้เม้น 2/3 - อธิบายเนื้อหาส่วนที่สอง",
  "comment3": "ใต้เม้น 3/3 - สรุปและชวนติดตามเพจเรา",
  "note": "คำแนะนำสำหรับ Admin: หารูปอะไร ทำโพสต์แบบไหน ปรับอะไรก่อนลง"
}`;

          userPrompt = `สร้างแคปชั่น Clickbait 3 แบบ + ใต้เม้นอธิบาย 3 ส่วน สำหรับเนื้อหานี้:

เนื้อหาต้นฉบับ: ${captionText}
ประเภทเนื้อหา: ${post.type} | หมวด: ${post.category}
Engagement ต้นฉบับ: likes ${post.likes} shares ${post.shares} comments ${post.comments} views ${post.views}

จำไว้: คุณต้องเขียนเหมือน Admin เพจที่ค้นหาข้อมูลมาเล่าเอง ห้ามพูดถึงเพจต้นทาง/คนโพสต์ต้นทางเด็ดขาด ใต้เม้น 3/3 ห้ามใส่ลิงก์ไปเพจคู่แข่ง
${!hasEnoughContent ? '\n⚠️ เนื้อหาต้นฉบับน้อย ให้เขียนจากสิ่งที่มีให้ดีที่สุด และใน note ให้เขียนว่าควรเข้าไปหาข้อมูลเพิ่มเติมจากแหล่งข่าวจริงก่อนโพสต์' : ''}

ตอบเป็น JSON เท่านั้น`;

        } else if (captionMode === 'casual') {
          systemPrompt = `คุณคือ Admin เพจที่ชอบแชร์เรื่องน่าสนใจแบบเพื่อนเล่าให้ฟัง

กฎ:
1. ห้ามพูดถึงชื่อเพจ/คนโพสต์ต้นทาง เขียนเหมือนคุณหาข้อมูลมาเอง
2. ภาษาง่ายๆ สบายๆ เหมือนคุยกับเพื่อน ไม่ต้องเป็นทางการ
3. Emoji น้อยๆ พอประดับ (1-3 ตัว)
4. ใต้เม้น 3 ส่วน เขียนแบบเพื่อนอธิบายให้ฟัง
5. ห้ามใส่ลิงก์ไปเพจคู่แข่ง
6. ใน note ให้แนะนำว่าควรหารูปอะไร ทำโพสต์แบบไหน

ตอบ JSON เท่านั้น:
{
  "caption1": "แคปชั่นแบบเพื่อนเล่า",
  "caption2": "แคปชั่นแบบชวนคุย",
  "caption3": "แคปชั่นแบบแชร์ความเห็น",
  "comment1": "ใต้เม้น 1/3",
  "comment2": "ใต้เม้น 2/3",
  "comment3": "ใต้เม้น 3/3",
  "note": "คำแนะนำสำหรับ Admin"
}`;

          userPrompt = `เขียนแคปชั่น 3 แบบ + ใต้เม้น 3 ส่วน แบบเพื่อนเล่าให้ฟัง:

เนื้อหา: ${captionText}
ประเภท: ${post.type} | หมวด: ${post.category}

เขียนเหมือนเพื่อนคุยกัน ภาษาง่ายๆ ไม่ขายของ ห้ามอ้างเพจต้นทาง
${!hasEnoughContent ? '\n⚠️ เนื้อหาน้อย เขียนจากที่มีให้ดีที่สุด' : ''}

ตอบเป็น JSON เท่านั้น`;

        } else {
          // Default: clickbait mode
          systemPrompt = `คุณคือผู้เชี่ยวชาญด้านการเขียนแคปชั่น Clickbait สำหรับโซเชียลมีเดียภาษาไทย

กฎสำคัญ:
1. ห้ามพูดถึงชื่อเพจ/คนโพสต์ต้นทาง เขียนเหมือนคุณค้นหาข้อมูลมาเอง
2. ถ้ามีบุคคลสาธารณะ/บริษัทที่เป็นแหล่งข้อมูลจริง อ้างอิงได้
3. ใช้ Emoji เร้าใจ (🔥, 🚀, ⚡️, 💡, 💎, 🎯) แต่ไม่เยอะเกินไป (2-4 ตัวต่อแคปชั่น)
4. ใช้คำสร้าง Urgency ตัวเลขเฉพาะเจาะจง
5. ลงท้ายด้วย (มีต่อ👇) หรือ (ดูต่อในคอมเม้นท์)
6. ใต้เม้น 3/3 ห้ามใส่ลิงก์ไปเพจคู่แข่ง ชวนติดตามเพจเราแทน
7. ใน note ให้แนะนำว่าควรหารูปอะไร ทำโพสต์แบบไหน

ตอบ JSON เท่านั้น:
{
  "caption1": "แคปชั่นแบบ Story-driven",
  "caption2": "แคปชั่นแบบ Data-driven",
  "caption3": "แคปชั่นแบบ Problem-solution",
  "comment1": "ใต้เม้น 1/3 - อธิบายเนื้อหาส่วนแรก",
  "comment2": "ใต้เม้น 2/3 - อธิบายเนื้อหาส่วนที่สอง",
  "comment3": "ใต้เม้น 3/3 - สรุปและ CTA",
  "note": "คำแนะนำสำหรับ Admin"
}`;

          userPrompt = `สร้างแคปชั่น Clickbait 3 แบบ + ใต้เม้น 3 ส่วน:

เนื้อหา: ${captionText}
ประเภท: ${post.type} | หมวด: ${post.category}
Engagement: likes ${post.likes} shares ${post.shares} comments ${post.comments} views ${post.views}

จำไว้: เขียนเหมือน Admin เพจที่หาข้อมูลมาเอง ห้ามอ้างเพจต้นทาง
${!hasEnoughContent ? '\n⚠️ เนื้อหาน้อย เขียนจากที่มีให้ดีที่สุด' : ''}

ตอบเป็น JSON เท่านั้น`;
        }

        try {
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': window.location.origin,
              'X-Title': 'Bulk Video Creator - Caption Gen',
            },
            body: JSON.stringify({
              model: captionModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              temperature: 0.8,
            })
          });

          if (!res.ok) {
            const errText = await res.text().catch(() => 'unknown');
            throw new Error(`HTTP ${res.status}: ${errText.substring(0, 100)}`);
          }
          const data = await res.json();
          let content = data?.choices?.[0]?.message?.content || '';
          
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            addCaptionLog('success', `✅ ${postLabel} — สร้างแคปชั่นสำเร็จ`);
            return {
              post,
              caption1: parsed.caption1 || '',
              caption2: parsed.caption2 || '',
              caption3: parsed.caption3 || '',
              comment1: parsed.comment1 || '',
              comment2: parsed.comment2 || '',
              comment3: parsed.comment3 || '',
              note: parsed.note || (hasEnoughContent ? '' : '⚠️ ต้องเข้าไปอ่านรายละเอียดจากลิงก์โพสต์จริงก่อนจึงจะเขียนใต้เม้นได้สมบูรณ์'),
            };
          }
          throw new Error('AI ตอบมาไม่ใช่ JSON format');
        } catch (err: any) {
          addCaptionLog('error', `❌ ${postLabel} — ล้มเหลว: ${err.message || 'Unknown error'}`);
          return {
            post,
            caption1: '❌ สร้างไม่สำเร็จ',
            caption2: '❌ สร้างไม่สำเร็จ',
            caption3: '❌ สร้างไม่สำเร็จ',
            comment1: '',
            comment2: '',
            comment3: '',
            note: `❌ Error: ${err.message || 'API Error'} — ลองใหม่อีกครั้ง`,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      setCaptionResults(prev => [...prev, ...batchResults]);
      setCaptionProgress(prev => ({ ...prev, current: prev.current + batchResults.length }));
      addCaptionLog('info', `💾 บันทึก Batch ${batchNum} สำเร็จ — รวมทำแล้ว ${captionResults.length + i + batchResults.length} โพสต์`);
      
      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < totalPosts && !captionStopRef.current) {
        addCaptionLog('info', '⏳ รอ 1 วินาที ก่อน batch ถัดไป...');
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!captionStopRef.current) {
      addCaptionLog('success', `🎉 เสร็จสมบูรณ์! สร้างแคปชั่นได้ทั้งหมด ${captionResults.length + totalPosts} โพสต์ — กด "ส่งออก CSV" ได้เลย`);
    }
    setIsCaptionGenerating(false);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook': return '📘';
      case 'tiktok': return '🎵';
      case 'youtube': return '▶️';
      case 'instagram': return '📷';
      default: return '🌐';
    }
  };

  // === AI Chat Logic ===
  const handleAIChat = async (messageText: string) => {
    if (!messageText.trim() || aiPostsContext.posts.length === 0) return;
    
    const apiKey = await getOpenRouterKey();
    if (!apiKey) {
      alert('❌ ยังไม่ได้ใส่ OpenRouter API Key ในตั้งค่า\nไปที่ ⚙️ ตั้งค่า API แล้วกรอก OpenRouter Key ก่อนครับ');
      return;
    }

    const newUserMsg: AIChatMessage = { role: 'user', content: messageText };
    setChatInput('');
    setIsAnalyzing(true);
    
    setChatHistory(prev => [...prev, newUserMsg]);

    const contextLimit = Math.min(aiPostsContext.posts.length, 100);
    const contextTopAll = aiPostsContext.posts.slice(0, contextLimit).map((p, i) => {
      const eng = p.likes + p.comments + p.shares + p.views;
      return `#${i+1} | ${p.pageName} | ${p.category} | Eng: ${eng}\nเนื้อหา: ${(p.caption || '').substring(0, 150)}\nLink: ${p.url}`;
    }).join('\n\n');

    const systemPrompt: AIChatMessage = {
      role: 'system',
      content: `คุณคือผู้เชี่ยวชาญด้านมาร์เก็ตติ้งโซเชียลมีเดีย เรากำลังอยู่ในหน้าวิเคราะห์โพสต์ไวรัล ${aiPostsContext.label}
      
นี่คือรายการ ${contextLimit} โพสต์ที่ไวรัลที่สุดในรอบนี้:
${contextTopAll}

กรุณาตอบคำถามของผู้ใช้โดยอ้างอิงจากบริบทโพสต์ไวรัลด้านบนเป็นหลัก (ถ้าเกี่ยวข้อง)
ตอบเป็นภาษาไทย เน้นกระชับ อ่านง่าย เป็นระบบ และใช้อีโมจิประกอบข้อความให้น่าสนใจ`
    };

    let apiMessages = [];
    if(chatHistory.length === 0) {
       apiMessages = [systemPrompt, newUserMsg];
    } else {
       apiMessages = [systemPrompt, ...chatHistory.map(m=>({role:m.role, content:m.content})), newUserMsg];
    }

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Bulk Video Creator',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: apiMessages,
        })
      });

      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || 'ไม่มีข้อมูลตอบกลับ';
      
      setChatHistory(prev => [...prev, {role: 'assistant', content}]);
    } catch(err) {
      setChatHistory(prev => [...prev, {role: 'assistant', content: '❌ การเชื่อมต่อล้มเหลว หรือคีย์ API ไม่ถูกต้อง'}]);
    }
    
    setIsAnalyzing(false);
  }

  // Score bar — 10 clickable dots
  const ScoreBar = ({ postId, field, label, accentColor }: { postId: string; field: 'viral' | 'evergreen'; label: string; accentColor: string }) => {
    const current = postScores[postId]?.[field] ?? null;
    return (
      <div className="flex items-center gap-1 mt-1.5">
        <span className="text-[9px] font-bold w-14 flex-shrink-0" style={{ color: 'var(--text-muted, #888)' }}>{label}</span>
        <div className="flex gap-0.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              onClick={e => { e.stopPropagation(); updatePostScore(postId, field, n); }}
              className="w-4 h-4 rounded-sm text-[8px] font-black transition-all hover:scale-110 flex items-center justify-center"
              style={{
                backgroundColor: current !== null && n <= current ? accentColor : 'var(--surface, rgba(128,128,128,0.15))',
                color: current !== null && n <= current ? '#fff' : 'var(--text-muted, #888)',
              }}
              title={`${label} ${n}/10`}
            >
              {n}
            </button>
          ))}
        </div>
        {current !== null && (
          <span className="text-[9px] font-black ml-0.5" style={{ color: accentColor }}>{current}</span>
        )}
      </div>
    );
  };

  // Render a single post card
  const PostCard = ({ post, idx, color }: { post: EnrichedPost; idx: number; color: 'indigo' | 'amber' }) => {
    const isSelected = selectedPostIds.has(post.id);
    return (
    <div
      className={`relative group rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col border ${isSelected ? 'ring-2 ring-emerald-500' : ''}`}
      style={{ backgroundColor: 'var(--bg-card)', borderColor: isSelected ? '#10b981' : 'var(--border-color)' }}
    >
      {/* Selection checkbox */}
      <button
        onClick={() => setSelectedPostIds(prev => {
          const next = new Set(prev);
          next.has(post.id) ? next.delete(post.id) : next.add(post.id);
          return next;
        })}
        className={`absolute top-1 left-1 z-20 w-5 h-5 rounded flex items-center justify-center text-xs font-black transition-all shadow ${isSelected ? 'bg-emerald-500 text-white' : 'bg-black/30 text-white/60 hover:bg-emerald-500/80'}`}
        title="เลือก/ยกเลิก"
      >
        {isSelected ? '✓' : '+'}
      </button>

      <div className={`absolute top-0 right-0 ${color === 'indigo' ? 'bg-indigo-600' : 'bg-amber-500'} text-white text-xs font-black px-3 py-1 rounded-bl-lg z-10 shadow`}>
        #{idx + 1}
      </div>

      <div className={`px-4 pt-3 pb-1 flex justify-between items-center`} style={{ backgroundColor: 'var(--surface, var(--bg-card))' }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{getPlatformIcon(post.platform)}</span>
          <span className={`text-[10px] font-bold uppercase tracking-widest leading-none`} style={{ color: color === 'indigo' ? '#818cf8' : '#f59e0b' }}>
            {post.type === 'video' ? 'วิดีโอ' : post.type === 'photo' ? 'รูปภาพ' : post.type || 'โพสต์'}
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-purple-700 text-[9px] font-bold" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent)' }}>
          {post.category}
        </span>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <p className="text-sm line-clamp-4 mb-3 leading-relaxed font-medium min-h-[5rem]" style={{ color: 'var(--text-main)' }}>
          {post.caption || 'ไม่มีข้อความอธิบาย'}
        </p>

        <div className="mt-auto">
          <hr style={{ borderColor: 'var(--border-color)' }} className="mb-3" />
          <div className="text-xs font-semibold mb-2">
            <div className="truncate flex-1 leading-tight" style={{ color: 'var(--text-main)' }}>
              จาก {post.pageName}
            </div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--text-secondary, #aaa)' }}>{post.ageDays} วันที่ผ่านมา</div>
          </div>

          <div className="flex items-center justify-between gap-1 mb-3" style={{ color: 'var(--text-muted, #888)' }}>
            <span className="text-red-500 font-bold text-xs">❤️ {formatNumber(post.likes)}</span>
            <span className="text-blue-500 font-bold text-xs">💬 {formatNumber(post.comments)}</span>
            <span className="text-green-500 font-bold text-xs">🔄 {formatNumber(post.shares)}</span>
          </div>

          {/* Score rating section */}
          <div className="pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <ScoreBar postId={post.id} field="viral" label="🔥 ไวรัล" accentColor="#ef4444" />
            <ScoreBar postId={post.id} field="evergreen" label="🌿 Evergreen" accentColor="#10b981" />
          </div>
        </div>
      </div>

      <div className="p-2 border-t" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface, var(--bg-card))' }}>
        <a href={post.url} target="_blank" rel="noreferrer" className="block w-full text-center py-1.5 text-xs font-bold rounded" style={{ color: 'var(--text-secondary, #ccc)' }}>
          ดูโพสต์ ↗
        </a>
      </div>
    </div>
    );
  };

  // Pagination component
  const Pagination = ({ currentPage, totalPages, onPageChange, color }: { currentPage: number; totalPages: number; onPageChange: (p: number) => void; color: string }) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 mt-6">
        <button
          onClick={() => onPageChange(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
          className="px-3 py-1.5 rounded-lg text-sm font-bold disabled:opacity-30"
          style={{ backgroundColor: 'var(--surface, var(--bg-card))', color: 'var(--text-main)' }}
        >
          ← ก่อนหน้า
        </button>
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            onClick={() => onPageChange(i)}
            className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${currentPage === i ? `text-white shadow` : ''}`}
            style={currentPage === i ? { backgroundColor: color } : { backgroundColor: 'var(--surface, var(--bg-card))', color: 'var(--text-muted, #888)' }}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
          disabled={currentPage >= totalPages - 1}
          className="px-3 py-1.5 rounded-lg text-sm font-bold disabled:opacity-30"
          style={{ backgroundColor: 'var(--surface, var(--bg-card))', color: 'var(--text-main)' }}
        >
          ถัดไป →
        </button>
      </div>
    );
  };

  // Chat Button component
  const ChatButton = ({ posts, label, color }: { posts: EnrichedPost[]; label: string; color: string }) => (
    <button
      onClick={() => openChat(posts, label)}
      disabled={posts.length === 0}
      className="px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition-all flex items-center gap-1.5 hover:-translate-y-0.5"
      style={{
        backgroundColor: color,
        cursor: posts.length === 0 ? 'not-allowed' : 'pointer',
        opacity: posts.length === 0 ? 0.4 : 1,
      }}
    >
      �� คุยกับข้อมูล (AI)
    </button>
  );

  if (allPosts.length === 0) {
    return (
      <div className="p-6 mt-6 rounded-2xl border text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>📋 โพสทั้งหมด</h3>
        <p className="py-10" style={{ color: 'var(--text-muted, #888)' }}>ยังไม่มีข้อมูลโพสต์ไวรัล กรุณากดปุ่ม Scan Now เพื่อดึงข้อมูล</p>
      </div>
    );
  }

  return (
    <div className="p-6 mt-6 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <span>📋</span> โพสทั้งหมด
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-muted, #888)' }}>รวมโพสต์ที่มี Engagement สูงสุดจากเพจคู่แข่งทั้งหมด</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 font-semibold">ประเภท:</span>
            <select
              value={filterCategory}
              onChange={e => { setFilterCategory(e.target.value); setCurrentPage(0); }}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold border-0 outline-none cursor-pointer"
              style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: 'var(--text-main)' }}
            >
              <option value="all">ทั้งหมด</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
            <span className="text-xs text-gray-500 font-semibold">เพจ:</span>
            <select
              value={filterPage}
              onChange={e => { setFilterPage(e.target.value); setCurrentPage(0); }}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold border-0 outline-none cursor-pointer truncate max-w-[150px]"
              style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--text-main)' }}
            >
              <option value="all">ทุกเพจ</option>
              {pageNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {['all', 'facebook', 'tiktok', 'instagram', 'youtube'].map(plat => (
            <button
              key={plat}
              onClick={() => { setFilterPlatform(plat); setCurrentPage(0); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                filterPlatform === plat
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:opacity-80'
              }`}
              style={filterPlatform !== plat ? { backgroundColor: 'var(--surface, var(--bg-card))', color: 'var(--text-muted, #888)' } : {}}
            >
              {plat === 'all' ? 'ทั้งหมด' : getPlatformIcon(plat) + ' ' + plat.charAt(0).toUpperCase() + plat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-12">
        {/* Section: Top Viral */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-6 border-b pb-3 flex-wrap" style={{ borderColor: 'var(--border-color)' }}>
             <div className="flex items-center gap-3 flex-wrap">
               <h4 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                 <span>🔥</span> Top ไวรัล
               </h4>
               
               <div className="flex items-center gap-1.5" style={{ backgroundColor: 'var(--surface, var(--bg-card))', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                 <span className="text-xs text-gray-500 font-semibold">เวลา:</span>
                 <select
                   value={timeRange}
                   onChange={e => { setTimeRange(e.target.value); setCurrentPage(0); }}
                   className="bg-transparent text-sm font-semibold border-0 outline-none cursor-pointer"
                   style={{ color: 'var(--text-main)' }}
                 >
                   <option value="7">7 วัน</option>
                   <option value="14">14 วัน</option>
                   <option value="30">1 เดือน</option>
                   <option value="all">ทั้งหมด</option>
                   <option value="custom">กำหนดเอง</option>
                 </select>
                 {timeRange === 'custom' && (
                   <NumInput min={1} value={customDays} onChange={n => { setCustomDays(n); setCurrentPage(0); }} className="w-12 px-1 text-sm font-semibold border-b outline-none text-center bg-transparent ml-2" />
                 )}
               </div>

               <span className="text-sm font-normal ml-2" style={{ color: 'var(--text-muted, #888)' }}>
                 {filterCategory !== 'all' && `[${filterCategory}]`} — แสดง {totalPosts} โพสต์
               </span>
             </div>

             <div className="flex items-center gap-2 flex-wrap">
               <div className="flex items-center gap-1.5 mr-2" style={{ borderColor: 'var(--border-color)' }}>
                 <span className="text-xs text-gray-500 font-semibold">แสดง:</span>
                 <input
                   type="number"
                   min="1"
                   value={postLimit}
                   onChange={e => { 
                     const val = e.target.value;
                     if (val === '') setPostLimit('');
                     else setPostLimit(Math.max(1, parseInt(val) || 1));
                     setCurrentPage(0); 
                   }}
                   disabled={showAllPosts}
                   className="w-16 px-2 py-1.5 rounded-lg text-sm font-semibold border-0 outline-none text-center disabled:opacity-30 shadow-sm"
                   style={{ backgroundColor: 'var(--surface, var(--bg-card))', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                 />
                 <span className="text-xs text-gray-500 font-semibold">โพสต์</span>
               </div>
               
               <label className="flex items-center gap-1.5 cursor-pointer text-sm font-semibold transition-opacity mr-3" style={{ color: showAllPosts ? 'var(--text-main)' : 'var(--text-muted, #888)' }}>
                 <input 
                   type="checkbox" 
                   checked={showAllPosts}
                   onChange={e => { setShowAllPosts(e.target.checked); setCurrentPage(0); }}
                   className="rounded w-4 h-4 accent-amber-600 cursor-pointer"
                 />
                 แสดงทั้งหมด
               </label>
             

               <ChatButton posts={displayPosts} label={timeRange === 'custom' ? `รอบ ${customDays} วัน` : (timeRange === 'all' ? 'ทั้งหมด' : `รอบ ${timeRange} วัน`)} color="#d97706" />
               {displayPosts.length > 0 && (
                 <>
                   <button
                     onClick={() => scorePostsWithAI(displayPosts)}
                     disabled={isAIScoring}
                     className="px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition-all flex items-center gap-1.5 hover:-translate-y-0.5 disabled:opacity-60"
                     style={{ backgroundColor: '#7c3aed' }}
                     title="ให้ AI ให้คะแนนไวรัล+Evergreen อัตโนมัติ (ข้ามโพสต์ที่มีคะแนนแล้ว)"
                   >
                     {isAIScoring
                       ? <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></span> {aiScoringLog || 'กำลังให้คะแนน...'}</>
                       : <>⚡ AI ให้คะแนน</>}
                   </button>

                   <button
                     onClick={() => openCaptionPanel(displayPosts, timeRange === 'custom' ? 'custom' : timeRange)}
                     disabled={isCaptionGenerating}
                     className="px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition-all flex items-center gap-1.5 hover:-translate-y-0.5 disabled:opacity-50"
                     style={{ backgroundColor: '#059669' }}
                   >
                     ✍️ สร้างแคปชั่น
                   </button>

                   <button
                     onClick={() => exportCSV(displayPosts, 'viral')}
                     className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all flex items-center gap-1.5"
                   >
                     📥 CSV
                   </button>
                   <button
                     onClick={() => exportCSVWithAI(displayPosts, 'viral')}
                     disabled={isExportingAI}
                     className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-80"
                   >
                     {isExportingAI ? (
                        <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></span> {exportAILog}</>
                     ) : (
                        <>✨ CSV + AI</>
                     )}
                   </button>
                 </>
               )}
             </div>
          </div>

          {/* ===== Smart Filter & Select Bar ===== */}
          <div className="mb-4 p-3 rounded-xl border flex flex-wrap items-center gap-3" style={{ backgroundColor: 'var(--surface, var(--bg-card))', borderColor: 'var(--border-color)' }}>
            <span className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>🎯 เลือกตามคะแนน:</span>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-red-400">🔥 ไวรัล ≥</span>
              <select
                value={filterViralMin}
                onChange={e => setFilterViralMin(Number(e.target.value))}
                className="px-2 py-1 rounded text-xs font-bold border-0 outline-none cursor-pointer"
                style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--text-main)' }}
              >
                <option value={0}>ทุกคะแนน</option>
                {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-emerald-400">🌿 Evergreen ≥</span>
              <select
                value={filterEvergreenMin}
                onChange={e => setFilterEvergreenMin(Number(e.target.value))}
                className="px-2 py-1 rounded text-xs font-bold border-0 outline-none cursor-pointer"
                style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: 'var(--text-main)' }}
              >
                <option value={0}>ทุกคะแนน</option>
                {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <button
              onClick={() => handleAutoSelect(displayPosts)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: '#7c3aed' }}
            >
              ✅ เลือกทั้งหมดที่ตรงเงื่อนไข
            </button>

            {selectedPostIds.size > 0 && (
              <>
                <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(16,185,129,0.2)', color: '#10b981' }}>
                  เลือกแล้ว {selectedPostIds.size} โพสต์
                </span>
                <button
                  onClick={() => sendSelectedToStock(displayPosts)}
                  disabled={isSendingToStock}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-1.5"
                  style={{ backgroundColor: '#059669' }}
                >
                  {isSendingToStock ? <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></span> กำลังส่ง...</> : `📦 ส่งเข้าคลัง (${selectedPostIds.size})`}
                </button>
                <button
                  onClick={() => setSelectedPostIds(new Set())}
                  className="px-2 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                  style={{ color: 'var(--text-muted, #888)', backgroundColor: 'var(--surface)' }}
                >
                  ยกเลิก
                </button>
              </>
            )}
          </div>

          {visiblePosts.length === 0 ? (
            <p className="text-sm text-center py-6 rounded-xl" style={{ color: 'var(--text-muted, #888)', backgroundColor: 'var(--surface, var(--bg-card))' }}>ไม่มีโพสต์ในช่วงเวลานี้ หรือยังไม่ได้กด Scan</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                {visiblePosts.map((post, idx) => (
                  <PostCard key={post.id} post={post} idx={currentPage * PER_PAGE + idx} color="amber" />
                ))}
              </div>
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} color="#f59e0b" />
            </>
          )}
        </div>
      </div>

      {/* ===== Caption Generator Panel ===== */}
      {isCaptionPanelOpen && (
        <div id="caption-panel" className="mt-8 rounded-2xl border-2 overflow-hidden flex flex-col shadow-2xl transition-all" style={{ borderColor: '#059669', backgroundColor: 'var(--bg-card)' }}>
          {/* Header */}
          <div className="px-6 py-4 flex flex-wrap items-center justify-between shadow-sm z-10 gap-3" style={{ backgroundColor: '#059669' }}>
            <div className="flex items-center gap-3 text-white">
              <span className="text-2xl bg-white/20 p-2 rounded-xl">✍️</span>
              <div>
                <h3 className="font-bold text-lg leading-tight">
                  สร้างแคปชั่น Clickbait — {captionSourceLabel === 'all' ? 'ทั้งหมด' : captionSourceLabel === 'custom' ? 'กำหนดเอง' : `รอบ ${captionSourceLabel} วัน`}
                </h3>
                <p className="text-[11px] text-emerald-100 font-medium">
                  สร้างแคปชั่น 3 แบบ + ใต้เม้น 3 ส่วน สำหรับแต่ละโพสต์ → ส่งออก CSV
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {/* Caption Mode Selector */}
              <div className="relative">
                <select
                  value={captionMode}
                  onChange={e => setCaptionMode(e.target.value)}
                  disabled={isCaptionGenerating}
                  className="appearance-none bg-white/20 hover:bg-white/30 text-white text-xs font-bold py-1.5 pl-3 pr-7 rounded-lg outline-none cursor-pointer border border-white/20 transition-all max-w-[160px] truncate disabled:opacity-50"
                  title="เลือกโหมดการเขียนแคปชั่น"
                >
                  {CAPTION_MODES.map(m => (
                    <option key={m.id} value={m.id} className="text-gray-900 font-medium">{m.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-white">
                  <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
              {/* Model Selector */}
              <div className="relative">
                <select
                  value={captionModel}
                  onChange={e => setCaptionModel(e.target.value)}
                  disabled={isCaptionGenerating}
                  className="appearance-none bg-white/20 hover:bg-white/30 text-white text-xs font-bold py-1.5 pl-3 pr-7 rounded-lg outline-none cursor-pointer border border-white/20 transition-all max-w-[160px] truncate disabled:opacity-50"
                  title="เลือกโมเดล AI สำหรับสร้างแคปชั่น"
                >
                  {MODEL_OPTIONS.map(m => (
                    <option key={m.id} value={m.id} className="text-gray-900 font-medium">{m.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-white">
                  <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
              <button
                onClick={() => setIsCaptionPanelOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center font-bold transition-all text-xl pb-1 leading-none"
              >
                ×
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {/* Description */}
            <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>📋 โหมด: {CAPTION_MODES.find(m => m.id === captionMode)?.name}</h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: captionMode === 'selfwrite' ? '#059669' : captionMode === 'casual' ? '#0284c7' : '#d97706', color: 'white' }}>
                  {CAPTION_MODES.find(m => m.id === captionMode)?.desc}
                </span>
              </div>
              <ul className="text-xs space-y-1.5" style={{ color: 'var(--text-muted, #888)' }}>
                {captionMode === 'selfwrite' ? (
                  <>
                    <li>• <b>Clickbait เต็มรูปแบบ</b> แต่เขียนเหมือนคุณค้นหาข้อมูลมาเอง <b>ไม่อ้างเพจต้นทาง</b></li>
                    <li>• ใต้เม้น 1/3 - 3/3 เขียนเหมือน <b>คุณเป็นคนอธิบาย</b> ไม่ใช่สรุปโพสต์คนอื่น ไม่มีลิงก์คู่แข่ง</li>
                    <li>• Note จะแนะนำว่า <b>ควรหารูปอะไร ทำโพสต์แบบไหน ปรับอะไรก่อนลง</b></li>
                  </>
                ) : captionMode === 'casual' ? (
                  <>
                    <li>• เขียนแบบ <b>เพื่อนเล่าให้ฟัง</b> ภาษาง่ายๆ สบายๆ ไม่ขายของ</li>
                    <li>• ไม่อ้างอิงเพจต้นทาง Emoji น้อยพอประดับ</li>
                    <li>• เน้นชวนคุย ชวนแสดงความคิดเห็น</li>
                  </>
                ) : (
                  <>
                    <li>• Clickbait จัดเต็ม Emoji + FOMO + ตัวเลข แต่ <b>ไม่อ้างเพจต้นทาง</b></li>
                    <li>• เขียนเหมือนคุณค้นหาข้อมูลมาเอง</li>
                    <li>• Note แนะนำว่าควรหารูปอะไร ทำโพสต์แบบไหน</li>
                  </>
                )}
                <li>• ทำทีละ <b>3 โพสต์</b> เพื่อประหยัด Token — กด <b>"หยุดชั่วคราว"</b> แล้ว <b>"ส่งออก CSV"</b> ได้ตลอด</li>
                <li>• กด <b>"เริ่มต่อ"</b> จะทำต่อจากจุดที่หยุดไว้ ไม่ซ้ำโพสต์เดิม</li>
              </ul>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {!isCaptionGenerating ? (
                <button
                  onClick={() => {
                    generateCaptions(captionPosts);
                  }}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 flex items-center gap-2"
                  style={{ backgroundColor: '#059669' }}
                >
                  {captionResults.length > 0 ? '▶️ เริ่มต่อ' : '🚀 เริ่มสร้างแคปชั่น'}
                </button>
              ) : (
                <button
                  onClick={() => { captionStopRef.current = true; }}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 flex items-center gap-2 bg-red-500 hover:bg-red-600"
                >
                  ⏸️ หยุดชั่วคราว
                </button>
              )}

              {captionResults.length > 0 && (
                <button
                  onClick={exportCaptionCSV}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 flex items-center gap-2 bg-blue-500 hover:bg-blue-600"
                >
                  📥 ส่งออก CSV ({captionResults.length} โพสต์)
                </button>
              )}

              {captionResults.length > 0 && !isCaptionGenerating && (
                <button
                  onClick={() => {
                    if (confirm('ต้องการล้างผลลัพธ์ที่ทำไว้แล้วเริ่มใหม่หรือไม่?')) {
                      setCaptionResults([]);
                      setCaptionLogs([]);
                      setCaptionProgress({ current: 0, total: 0 });
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 hover:opacity-80"
                  style={{ backgroundColor: 'var(--surface)', color: 'var(--text-muted, #888)', border: '1px solid var(--border-color)' }}
                >
                  🗑️ ล้างเริ่มใหม่
                </button>
              )}
            </div>

            {/* Progress Bar */}
            {captionProgress.total > 0 && (
              <div>
                <div className="flex justify-between text-xs mb-1.5 font-semibold" style={{ color: 'var(--text-muted, #888)' }}>
                  <span>ความคืบหน้า</span>
                  <span>{captionProgress.current} / {captionProgress.total} โพสต์ ({Math.round((captionProgress.current / captionProgress.total) * 100)}%)</span>
                </div>
                <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(captionProgress.current / captionProgress.total) * 100}%`,
                      background: 'linear-gradient(90deg, #059669, #10b981, #34d399)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Log Viewer */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: 'var(--text-muted, #888)' }}>
                📝 Log การทำงาน
                {captionLogs.length > 0 && (
                  <span className="text-[10px] font-normal">({captionLogs.length} รายการ)</span>
                )}
              </h4>
              <div
                className="rounded-xl border overflow-y-auto font-mono text-xs p-4 space-y-1"
                style={{ backgroundColor: '#0d1117', borderColor: 'var(--border-color)', maxHeight: '300px', minHeight: '120px' }}
              >
                {captionLogs.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">กด "เริ่มสร้างแคปชั่น" เพื่อเริ่มต้น...</p>
                ) : (
                  captionLogs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-gray-600 flex-shrink-0">[{log.time}]</span>
                      <span className={`${
                        log.type === 'success' ? 'text-emerald-400' :
                        log.type === 'error' ? 'text-red-400' :
                        log.type === 'warning' ? 'text-amber-400' :
                        'text-gray-400'
                      }`}>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
                <div ref={captionLogEndRef} />
              </div>
            </div>

            {/* Results Summary */}
            {captionResults.length > 0 && (
              <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border-color)' }}>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                  ✅ ผลลัพธ์ ({captionResults.length} โพสต์)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: 'var(--text-muted, #888)' }}>
                        <th className="text-left py-1.5 px-2 border-b" style={{ borderColor: 'var(--border-color)' }}>#</th>
                        <th className="text-left py-1.5 px-2 border-b" style={{ borderColor: 'var(--border-color)' }}>เพจ</th>
                        <th className="text-left py-1.5 px-2 border-b" style={{ borderColor: 'var(--border-color)' }}>แคปชั่น 1 (ตัวอย่าง)</th>
                        <th className="text-left py-1.5 px-2 border-b" style={{ borderColor: 'var(--border-color)' }}>สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {captionResults.slice(-10).map((r, i) => (
                        <tr key={i}>
                          <td className="py-1.5 px-2 border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}>{captionResults.length - 10 + i + 1 > 0 ? captionResults.length - 10 + i + 1 : i + 1}</td>
                          <td className="py-1.5 px-2 border-b font-semibold" style={{ color: 'var(--text-main)', borderColor: 'var(--border-color)' }}>{r.post.pageName}</td>
                          <td className="py-1.5 px-2 border-b max-w-[300px] truncate" style={{ color: 'var(--text-main)', borderColor: 'var(--border-color)' }}>{r.caption1.substring(0, 80)}...</td>
                          <td className="py-1.5 px-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                            {r.caption1.startsWith('❌') ? <span className="text-red-400">❌</span> : <span className="text-emerald-400">✅</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {captionResults.length > 10 && (
                    <p className="text-[10px] mt-2 text-center" style={{ color: 'var(--text-muted)' }}>แสดง 10 รายการล่าสุด จากทั้งหมด {captionResults.length}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== AI Chatbot Panel ===== */}
      {isChatOpen && (
        <div id="ai-chat-panel" className="mt-8 rounded-2xl border-2 overflow-hidden flex flex-col h-[80vh] min-h-[550px] shadow-2xl transition-all" style={{ borderColor: '#7c3aed', backgroundColor: 'var(--bg-card)' }}>
          {/* Header */}
          <div className="px-6 py-4 flex flex-wrap items-center justify-between shadow-sm z-10 gap-3" style={{ backgroundColor: '#7c3aed' }}>
            <div className="flex items-center gap-3 text-white">
              <span className="text-2xl bg-white/20 p-2 rounded-xl">🤖</span>
              <div>
                <h3 className="font-bold text-lg leading-tight">
                  วิเคราะห์ข้อมูล — {aiPostsContext.label}
                </h3>
                <p className="text-[11px] text-indigo-100 font-medium">
                  {Math.min(aiPostsContext.posts.length, 100)} โพสต์ | {filterCategory === 'all' ? 'ทุกหมวด' : filterCategory}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 ml-auto">
              {/* Model Selector Dropdown */}
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  className="appearance-none bg-white/20 hover:bg-white/30 text-white text-xs font-bold py-1.5 pl-3 pr-8 rounded-lg outline-none cursor-pointer border border-white/20 transition-all max-w-[170px] truncate"
                  title="เลือกโมเดล AI"
                >
                  {MODEL_OPTIONS.map(m => (
                    <option key={m.id} value={m.id} className="text-gray-900 font-medium truncate max-w-full">
                      {m.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>

              <button
                onClick={() => setIsChatOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center font-bold transition-all text-xl pb-1 leading-none"
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex flex-1 min-h-0 overflow-hidden flex-col md:flex-row relative">
            
            {/* Left/Top: Saved Prompts Sidebar */}
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r overflow-y-auto flex-shrink-0" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface)' }}>
              <div className="p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted, #888)' }}>⚡ เทมเพลตคำถาม</h4>
                <div className="space-y-2">
                  {savedPrompts.map(prompt => (
                    <div key={prompt.id} className="group relative">
                      <button
                        onClick={() => { setChatInput(prompt.text); handleAIChat(prompt.text); }}
                        className="w-full text-left p-3 rounded-xl border hover:border-indigo-500 transition-colors text-sm font-medium pr-8"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
                      >
                        {prompt.text}
                      </button>
                      <button
                        onClick={(e) => handleDeletePrompt(prompt.id, e)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        title="ลบคำถามนี้"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                {savedPrompts.length === 0 && (
                  <p className="text-xs text-center p-3 text-gray-500">ไม่มีเทมเพลต</p>
                )}
              </div>
            </div>

            {/* Right: Chat History & Input */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-black/5">
              
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {chatHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <div className="text-5xl mb-4 opacity-50">👋</div>
                    <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-main)' }}>ต้องการให้ AI ช่วยสรุปอะไร?</h3>
                    <p className="text-sm max-w-sm mb-6" style={{ color: 'var(--text-muted, #888)' }}>
                      กดเลือกคำถามจาก <b>เทมเพลตด้านซ้าย</b> หรือ พิมพ์คำถามที่คุณต้องการได้เอง ข้อมูลของรอบนี้เตรียมไว้พร้อมวิเคราะห์แล้ว
                    </p>
                  </div>
                ) : (
                  chatHistory.map((msg, i) => (
                    <div key={i} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-amber-500 text-white'}`}>
                        {msg.role === 'user' ? 'You' : 'AI'}
                      </div>
                      <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'rounded-tl-sm shadow-sm border'}`} style={msg.role === 'assistant' ? { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-main)' } : {}}>
                        {msg.role === 'assistant' ? (
                          <div className="prose prose-invert max-w-none text-sm leading-relaxed" dangerouslySetInnerHTML={{
                            __html: msg.content
                              .replace(/## (.*?)\n/g, '<h3 class="text-base font-bold text-amber-500 border-b border-amber-500/20 pb-2 mb-3 mt-4">$1</h3>')
                              .replace(/### (.*?)\n/g, '<h4 class="text-sm font-bold text-amber-500 mt-3 mb-2">$1</h4>')
                              .replace(/\*\*(.*?)\*\*/g, '<b class="text-indigo-300">$1</b>')
                              .replace(/\* (.*?)\n/g, '<li class="ml-4 list-disc marker:text-amber-500">$1</li>')
                              .replace(/\n/g, '<br />')
                          }} />
                        ) : (
                          <div className="text-sm">{msg.content}</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isAnalyzing && (
                  <div className="flex gap-3 mr-auto max-w-[85%]">
                     <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse text-sm">AI</div>
                     <div className="p-4 rounded-2xl rounded-tl-sm border flex items-center gap-2 text-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span> กำลังวิเคราะห์...
                     </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface)' }}>
                <div className="flex gap-2">
                  <div className="relative flex-1 group">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAIChat(chatInput)}
                      placeholder="พิมพ์คำถาม... (เช่น ขอไอเดียตั้งชื่อคลิป)"
                      disabled={isAnalyzing}
                      className="w-full px-5 py-3.5 pr-20 rounded-xl outline-none transition-all shadow-inner disabled:opacity-50"
                      style={{ backgroundColor: 'var(--input-bg, rgba(0,0,0,0.2))', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                    />
                    {chatInput.trim() && (
                      <button 
                        onClick={handleSaveCurrentPrompt}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all text-[11px] font-bold"
                        title="บันทึกคำถามนี้เก็บไว้ใช้ครั้งหน้า"
                      >
                        💾 ทึก
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => handleAIChat(chatInput)}
                    disabled={isAnalyzing || !chatInput.trim()}
                    className="px-6 py-3.5 rounded-xl font-bold text-white shadow-lg disabled:opacity-50 hover:-translate-y-0.5 transition-all w-24 flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#7c3aed' }}
                  >
                    {isAnalyzing ? '...' : 'ส่ง'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
