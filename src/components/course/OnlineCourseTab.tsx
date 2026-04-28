import React, { useState, useEffect, useRef } from 'react';
import { globalTaskStore } from '../../hooks/useBackgroundTasks';
import { SlideViewerModal } from './SlideViewerModal';

interface CourseEP {
  id: string;
  module: string;
  ep: string;
  title: string;
  duration: string;
  guideline?: string;
  slideContent?: string;
}

interface Course {
  id: string;
  title: string;
  sourceUrl: string;
  sourceText?: string;
  episodes: CourseEP[];
}

export function OnlineCourseTab() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [fallbackText, setFallbackText] = useState('');
  const [targetEpCount, setTargetEpCount] = useState('10');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeLog, setScrapeLog] = useState('');

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalTitle, setAiModalTitle] = useState('');
  const [aiModalContent, setAiModalContent] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- Slide Viewer State ---
  const [viewingSlideEp, setViewingSlideEp] = useState<CourseEP | null>(null);

  // --- Multi-Select State ---
  const [selectedEps, setSelectedEps] = useState<string[]>([]);

  const isMounted = useRef(true);
  const latestCoursesRef = useRef<Course[]>([]);

  useEffect(() => {
    latestCoursesRef.current = courses;
  }, [courses]);

  useEffect(() => {
    isMounted.current = true;
    fetch('/api/get-app-data?key=online_courses')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d) && isMounted.current) setCourses(d);
      })
      .catch(e => console.error(e));
      
    return () => {
      isMounted.current = false;
    };
  }, []);

  const saveCourses = (data: Course[]) => {
    setCourses(data);
    fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'online_courses', data })
    });
  };

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
    return localStorage.getItem('openrouter_key') || '';
  }

  const handleGenerateCourse = async () => {
    if (!newTitle) return alert('กรุณาตั้งชื่อคอร์ส');
    if (!newUrl && !fallbackText) return alert('กรุณาใส่ URL หรือวางเนื้อหา Text โดยตรง');
    
    const apiKey = await getOpenRouterKey();
    if (!apiKey) return alert('❌ ยังไม่ได้ตั้งค่า OpenRouter API Key');

    setIsScraping(true);
    let extractedText = fallbackText;

    if (newUrl && !extractedText) {
      setScrapeLog('กำลังอ่านข้อมูลจากเว็บ...');
      try {
        const r = await fetch(`https://r.jina.ai/${encodeURIComponent(newUrl)}`, {
          headers: {
            'Accept': 'application/json',
          }
        });
        const data = await r.json();
        if (data && data.data && data.data.content) {
          extractedText = data.data.content;
        } else {
          extractedText = await r.text();
        }
      } catch (err) {
        setScrapeLog('อ่านข้อมูลจากเว็บล้มเหลว กรุณา Paste Text เอง');
        setIsScraping(false);
        return;
      }
    }

    setScrapeLog('ให้ AI วิเคราะห์โครงสร้างสารบัญ (TOC)...');
    try {
      const epCountInstruction = targetEpCount && parseInt(targetEpCount) > 0 
        ? `คุณต้องสร้างเนื้อหาให้มีจำนวนทั้งหมด ${targetEpCount} ตอน (EP) ห้ามขาดห้ามเกิน` 
        : 'จัดสรรจำนวนตอน (EP) ตามความเหมาะสม';

      const systemPrompt = `คุณเป็นผู้เชี่ยวชาญด้านการออกแบบหลักสูตร (Curriculum Designer) ที่เก่งที่สุด
      วิเคราะห์เนื้อหาที่ได้รับ และสร้างสารบัญคอร์สออนไลน์ให้เหมาะสมที่สุด
      ${epCountInstruction}
      ตอบเป็น JSON เท่านั้น รูปแบบ:
      {
        "episodes": [
          { "module": "1. พื้นฐาน", "ep": "1", "title": "บทนำ", "duration": "5 min" }
        ]
      }`;

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: "ข้อมูลที่จะใช้สร้างคอร์ส:\n" + extractedText.substring(0, 30000) }
          ]
        })
      });

      if (!res.ok) throw new Error('API Error');
      const aiData = await res.json();
      const content = aiData?.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      
      const newCourse: Course = {
        id: Date.now().toString(),
        title: newTitle,
        sourceUrl: newUrl,
        sourceText: extractedText,
        episodes: (parsed.episodes || []).map((ep: any, idx: number) => ({
          ...ep,
          id: `ep_${Date.now()}_${idx}`
        }))
      };

      saveCourses([...courses, newCourse]);
      setActiveCourseId(newCourse.id);
      setIsCreating(false);
      setNewTitle('');
      setNewUrl('');
      setFallbackText('');
      setTargetEpCount('10');

    } catch (e) {
      alert('เกิดข้อผิดพลาดในการเรียก AI');
      console.error(e);
    } finally {
      setIsScraping(false);
      setScrapeLog('');
    }
  };

  const handleAIGuideline = async (ep: CourseEP, type: 'guideline' | 'slide', forceGenerate = false) => {
    const course = courses.find(c => c.id === activeCourseId);
    if (!course) return;

    if (!forceGenerate) {
      if (type === 'guideline' && ep.guideline) {
        setAiModalTitle(`ไกด์ไลน์: ${ep.title}`);
        setAiModalContent(ep.guideline);
        setAiModalOpen(true);
        return;
      }
      if (type === 'slide' && ep.slideContent) {
        setAiModalTitle(`เนื้อหาสไลด์: ${ep.title}`);
        setAiModalContent(ep.slideContent);
        setAiModalOpen(true);
        return;
      }
    }

    const apiKey = await getOpenRouterKey();
    if (!apiKey) return alert('❌ ยังไม่ได้ตั้งค่า OpenRouter API Key');

    setAiModalTitle(type === 'guideline' ? `กำลังวิเคราะห์ไกด์ไลน์: ${ep.title}` : `กำลังสร้างสไลด์: ${ep.title}`);
    setAiModalContent('');
    setAiModalOpen(true);
    setIsAiLoading(true);

    try {
      let prompt = '';
      if (type === 'guideline') {
        prompt = `อ้างอิงจากข้อมูลนี้:\n${course.sourceText?.substring(0, 20000)}\n\nคุณกำลังจะสอนคอร์ส ในบทเรียนชื่อ: "${ep.title}" (Module: ${ep.module})\n\nเขียนไกด์ไลน์สำหรับคนสอนว่า:\n1. ต้องศึกษา/โฟกัสเนื้อหาส่วนไหนจากเอกสารบ้าง\n2. ต้องพูดประเด็นสำคัญอะไรบ้างในคลิปนี้ (Bullet Points)\n3. ไอเดียตัวอย่าง (Example) ที่ควรยกมาสอนให้เห็นภาพชัดเจน`;
      } else {
        prompt = `อ้างอิงจากข้อมูลนี้:\n${course.sourceText?.substring(0, 20000)}\n\nคุณกำลังจะสร้างสไลด์พรีเซนเทชันระดับมืออาชีพสำหรับคอร์สเรียน บทที่: "${ep.title}" (Module: ${ep.module}) ความยาวประมาณ ${ep.duration}\n\nกฎเหล็ก (CRITICAL RULES) ที่ต้องปฏิบัติตามอย่างเคร่งครัด:\n1. สำเร็จรูป 100%: ห้ามใช้ Placeholder เด็ดขาด (เช่น ห้ามเขียนว่า [ใส่โลโก้], [ชื่อผู้สอน], [ใส่รูป]) ให้คุณแต่งเนื้อหาจริงๆ ขึ้นมาเลยให้พร้อมใช้งานพรีเซนต์\n2. หน้าปก (Slide 1): ต้องมีชื่อหัวข้อที่ดึงดูดใจ และคำโปรย (Subtitle) ที่ทรงพลัง ห้ามมีคำสั่งแทรก (ห้ามพิมพ์คำว่า "Title:" หรือ "Subtitle:" นำหน้าข้อความ)\n3. เนื้อหาสไลด์ (Bullets): ต้องเขียนเป็นประโยคที่พร้อมนำเสนอจริง กระชับ ทรงพลัง อ่านง่าย ได้ใจความ\n4. Speaker Notes: ต้องเขียนเป็น "บทพูดจริง" ที่ผู้สอนสามารถอ่านตามได้เลย ไม่ใช่การเขียนคำแนะนำ\n5. ห้ามมีเกริ่นนำ (NO PREAMBLE): ห้ามพิมพ์ข้อความทักทายหรือตอบรับคำสั่ง เช่น "ยอดเยี่ยมเลยครับ..." ให้เริ่มต้นที่ "## Slide 1:" ทันที\n6. ห้ามมีข้อความปิดท้าย: ห้ามพิมพ์ข้อความสรุปท้ายเนื้อหา ให้จบที่ Speaker Notes ของสไลด์หน้าสุดท้ายเลย\n\nรูปแบบที่ต้องการ:\n## Slide 1: [หัวข้อสไลด์พร้อมพรีเซนต์]\n- [เนื้อหาจริงที่ทรงพลังข้อ 1]\n- [เนื้อหาจริงที่ทรงพลังข้อ 2]\n\n**Speaker Notes:**\nสวัสดีครับทุกคน... (สคริปต์พูดจริง)`;
      }

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-pro',
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });

      if (!res.ok) throw new Error('API Error');
      const aiData = await res.json();
      const content = aiData?.choices?.[0]?.message?.content || 'ไม่มีข้อมูลตอบกลับ';
      
      setAiModalContent(content);
      
      // Save cache
      const updatedCourses = courses.map(c => {
        if (c.id === course.id) {
          const updatedEps = c.episodes.map(e => {
            if (e.id === ep.id) {
              return type === 'guideline' ? { ...e, guideline: content } : { ...e, slideContent: content };
            }
            return e;
          });
          return { ...c, episodes: updatedEps };
        }
        return c;
      });
      saveCourses(updatedCourses);

    } catch (e) {
      setAiModalContent('เกิดข้อผิดพลาดในการสร้างข้อมูล');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleViewPresentation = (ep: CourseEP) => {
    if (!ep.slideContent) return;
    setViewingSlideEp(ep);
  };

  const handleDownloadAllGuidelines = () => {
    const course = courses.find(c => c.id === activeCourseId);
    if (!course) return;
    
    const epsWithGuideline = course.episodes.filter(ep => ep.guideline);
    if (epsWithGuideline.length === 0) {
      alert('ยังไม่มีไกด์ไลน์สำหรับคอร์สนี้ กรุณาสร้างไกด์ไลน์ก่อน');
      return;
    }

    let content = `ไกด์ไลน์ทั้งหมด: ${course.title}\n`;
    content += `=========================================\n\n`;

    course.episodes.forEach(ep => {
      if (ep.guideline) {
        content += `[Module: ${ep.module}] EP.${ep.ep} - ${ep.title}\n`;
        content += `-----------------------------------------\n`;
        content += `${ep.guideline}\n\n`;
        content += `=========================================\n\n`;
      }
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Guidelines_${course.title.replace(/[\\/:*?"<>|]/g, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateSelected = async (type: 'guideline' | 'slide') => {
    const course = courses.find(c => c.id === activeCourseId);
    if (!course) return;

    if (selectedEps.length === 0) {
      return alert('กรุณาเลือกอย่างน้อย 1 บทเพื่อสร้างเนื้อหา');
    }

    const apiKey = await getOpenRouterKey();
    if (!apiKey) return alert('❌ ยังไม่ได้ตั้งค่า OpenRouter API Key');

    const epsToGenerate = course.episodes.filter(ep => selectedEps.includes(ep.id));
    
    if (!confirm(`กำลังจะสร้าง${type === 'guideline' ? 'ไกด์ไลน์' : 'เนื้อหาสไลด์'}จำนวน ${epsToGenerate.length} บท (เขียนทับหากมีของเดิม) อาจใช้เวลาสักครู่ โลโก้จะลอยอยู่มุมขวาบน ต้องการดำเนินการต่อหรือไม่?`)) return;

    const taskId = Date.now().toString();
    globalTaskStore.addTask({
      id: taskId,
      title: `✨ สร้าง${type === 'guideline' ? 'ไกด์ไลน์' : 'สไลด์'}: ${course.title}`,
      progress: 'กำลังเตรียมการ...',
      status: 'running'
    });

    for (let i = 0; i < epsToGenerate.length; i++) {
      const ep = epsToGenerate[i];
      globalTaskStore.updateTask(taskId, { progress: `กำลังสร้าง ${i+1}/${epsToGenerate.length} (EP.${ep.ep})` });
      
      try {
        let prompt = '';
        if (type === 'guideline') {
          prompt = `อ้างอิงจากข้อมูลนี้:\n${course.sourceText?.substring(0, 20000)}\n\nคุณกำลังจะสอนคอร์ส ในบทเรียนชื่อ: "${ep.title}" (Module: ${ep.module})\n\nเขียนไกด์ไลน์สำหรับคนสอนว่า:\n1. ต้องศึกษา/โฟกัสเนื้อหาส่วนไหนจากเอกสารบ้าง\n2. ต้องพูดประเด็นสำคัญอะไรบ้างในคลิปนี้ (Bullet Points)\n3. ไอเดียตัวอย่าง (Example) ที่ควรยกมาสอนให้เห็นภาพชัดเจน`;
        } else {
          prompt = `อ้างอิงจากข้อมูลนี้:\n${course.sourceText?.substring(0, 20000)}\n\nคุณกำลังจะสร้างสไลด์พรีเซนเทชันระดับมืออาชีพสำหรับคอร์สเรียน บทที่: "${ep.title}" (Module: ${ep.module}) ความยาวประมาณ ${ep.duration}\n\nกฎเหล็ก (CRITICAL RULES) ที่ต้องปฏิบัติตามอย่างเคร่งครัด:\n1. สำเร็จรูป 100%: ห้ามใช้ Placeholder เด็ดขาด (เช่น ห้ามเขียนว่า [ใส่โลโก้], [ชื่อผู้สอน], [ใส่รูป]) ให้คุณแต่งเนื้อหาจริงๆ ขึ้นมาเลยให้พร้อมใช้งานพรีเซนต์\n2. หน้าปก (Slide 1): ต้องมีชื่อหัวข้อที่ดึงดูดใจ และคำโปรย (Subtitle) ที่ทรงพลัง ห้ามมีคำสั่งแทรก (ห้ามพิมพ์คำว่า "Title:" หรือ "Subtitle:" นำหน้าข้อความ)\n3. เนื้อหาสไลด์ (Bullets): ต้องเขียนเป็นประโยคที่พร้อมนำเสนอจริง กระชับ ทรงพลัง อ่านง่าย ได้ใจความ\n4. Speaker Notes: ต้องเขียนเป็น "บทพูดจริง" ที่ผู้สอนสามารถอ่านตามได้เลย ไม่ใช่การเขียนคำแนะนำ\n5. ห้ามมีเกริ่นนำ (NO PREAMBLE): ห้ามพิมพ์ข้อความทักทายหรือตอบรับคำสั่ง เช่น "ยอดเยี่ยมเลยครับ..." ให้เริ่มต้นที่ "## Slide 1:" ทันที\n6. ห้ามมีข้อความปิดท้าย: ห้ามพิมพ์ข้อความสรุปท้ายเนื้อหา ให้จบที่ Speaker Notes ของสไลด์หน้าสุดท้ายเลย\n\nรูปแบบที่ต้องการ:\n## Slide 1: [หัวข้อสไลด์พร้อมพรีเซนต์]\n- [เนื้อหาจริงที่ทรงพลังข้อ 1]\n- [เนื้อหาจริงที่ทรงพลังข้อ 2]\n\n**Speaker Notes:**\nสวัสดีครับทุกคน... (สคริปต์พูดจริง)`;
        }

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-pro',
            messages: [{ role: 'user', content: prompt }]
          })
        });

        if (!res.ok) throw new Error('API Error');
        const aiData = await res.json();
        const content = aiData?.choices?.[0]?.message?.content || 'ไม่มีข้อมูลตอบกลับ';

        const updatedCourses = latestCoursesRef.current.map(c => {
          if (c.id === course.id) {
            const updatedEps = c.episodes.map(e => {
              if (e.id === ep.id) {
                return type === 'guideline' ? { ...e, guideline: content } : { ...e, slideContent: content };
              }
              return e;
            });
            return { ...c, episodes: updatedEps };
          }
          return c;
        });
        
        if (isMounted.current) {
          setCourses(updatedCourses);
        } else {
          latestCoursesRef.current = updatedCourses;
        }

        // Save immediately per EP so progress is not lost
        fetch('/api/save-app-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'online_courses', data: updatedCourses })
        });
        
      } catch (e) {
        console.error('Error generating for EP', ep.ep, e);
      }
    }

    globalTaskStore.updateTask(taskId, { progress: 'เสร็จสิ้น!', status: 'completed' });
    setTimeout(() => {
      globalTaskStore.removeTask(taskId);
    }, 5000);
  };

  const activeCourse = courses.find(c => c.id === activeCourseId);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: 'var(--accent)' }}>
            🎓 Online Course Creator
          </h1>
          <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            สร้างโครงสร้างหลักสูตรและเนื้อหาสอนจาก Link หรือ Text ด้วย AI
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-2"
          >
            <span>+</span> สร้างคอร์สใหม่
          </button>
        )}
      </div>

      {isCreating && (
        <div className="mb-8 p-6 rounded-2xl border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border-color)' }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>สร้างโปรเจกต์คอร์สใหม่</h2>
          
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-sm font-bold mb-1" style={{ color: 'var(--text-muted)' }}>ชื่อคอร์ส</label>
              <input 
                type="text" 
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="เช่น Masterclass AI Automation" 
                className="w-full p-3 rounded-lg border outline-none"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Link เนื้อหาอ้างอิง (จะให้ AI ไปอ่านหน้านี้)</label>
              <input 
                type="text" 
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="https://example.com/guide..." 
                className="w-full p-3 rounded-lg border outline-none"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1" style={{ color: 'var(--text-muted)' }}>จำนวนตอน (EP) ที่ต้องการ</label>
              <input 
                type="number" 
                value={targetEpCount}
                onChange={e => setTargetEpCount(e.target.value)}
                placeholder="เช่น 10, 20" 
                className="w-full p-3 rounded-lg border outline-none"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1" style={{ color: 'var(--text-muted)' }}>หรือแปะเนื้อหา Text (กรณีเว็บมีล็อกอิน/ป้องกันบอท)</label>
              <textarea 
                value={fallbackText}
                onChange={e => setFallbackText(e.target.value)}
                rows={4}
                placeholder="วางเนื้อหาลงที่นี่..." 
                className="w-full p-3 rounded-lg border outline-none resize-y"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleGenerateCourse}
                disabled={isScraping}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md disabled:opacity-50"
              >
                {isScraping ? `กำลังทำ... ${scrapeLog}` : '✨ สร้างสารบัญคอร์สอัตโนมัติ'}
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="px-6 py-2.5 rounded-xl font-bold transition-all border hover:bg-black/5"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {!isCreating && courses.length > 0 && !activeCourseId && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {courses.map(course => (
            <div 
              key={course.id}
              className="p-5 rounded-2xl border cursor-pointer hover:shadow-lg transition-all group relative"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border-color)' }}
              onClick={() => setActiveCourseId(course.id)}
            >
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if(confirm('ลบคอร์สนี้?')) saveCourses(courses.filter(c => c.id !== course.id));
                  }}
                  className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white"
                >
                  🗑️
                </button>
              </div>
              <h3 className="text-lg font-bold mb-2 line-clamp-2" style={{ color: 'var(--text-main)' }}>{course.title}</h3>
              <p className="text-xs mb-3 truncate" style={{ color: 'var(--text-muted)' }}>{course.sourceUrl || 'จาก Text Paste'}</p>
              <div className="flex justify-between items-center text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                <span>📚 {course.episodes.length} บทเรียน</span>
                <span>เปิดดู ↗</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeCourse && (
        <div className="animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  setActiveCourseId(null);
                  setSelectedEps([]); // clear selection when leaving
                }}
                className="px-3 py-1.5 rounded-lg font-bold border hover:bg-black/5"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
              >
                ← กลับหน้ารวม
              </button>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>{activeCourse.title}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 bg-black/5 p-2 rounded-xl border border-black/10 dark:border-white/10 dark:bg-white/5">
              <label className="flex items-center gap-2 px-3 py-2 cursor-pointer font-bold select-none text-sm border-r border-black/10 dark:border-white/10" style={{ color: 'var(--text-main)' }}>
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  checked={selectedEps.length === activeCourse.episodes.length && activeCourse.episodes.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedEps(activeCourse.episodes.map(ep => ep.id));
                    } else {
                      setSelectedEps([]);
                    }
                  }}
                />
                <span>เลือกทั้งหมด</span>
              </label>
              
              <div className="flex gap-2 pl-2">
                <button
                  onClick={() => handleGenerateSelected('guideline')}
                  disabled={selectedEps.length === 0}
                  className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white text-indigo-600 dark:text-indigo-400 text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  ✨ สร้างไกด์ไลน์ 
                  {selectedEps.length > 0 && <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{selectedEps.length}</span>}
                </button>
                <button
                  onClick={() => handleGenerateSelected('slide')}
                  disabled={selectedEps.length === 0}
                  className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:text-emerald-400 text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  ✨ สร้างสไลด์ 
                  {selectedEps.length > 0 && <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{selectedEps.length}</span>}
                </button>
                <div className="w-px h-6 bg-black/10 dark:bg-white/10 mx-1 self-center"></div>
                <button
                  onClick={handleDownloadAllGuidelines}
                  className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500 hover:text-white text-blue-600 dark:text-blue-400 text-sm font-bold rounded-lg transition-colors flex items-center gap-1"
                >
                  📥 โหลดไกด์ไลน์ทั้งหมด
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Group by Module */}
            {Array.from(new Set(activeCourse.episodes.map(e => e.module))).map((mod, modIdx) => (
              <div key={mod} className="rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface)' }}>
                <div className="px-5 py-3 border-b font-bold text-lg" style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  {mod}
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {activeCourse.episodes.filter(e => e.module === mod).map((ep) => (
                    <div key={ep.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-black/5 transition-colors">
                      <div className="flex gap-4 items-center">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0 ml-1"
                          checked={selectedEps.includes(ep.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEps(prev => [...prev, ep.id]);
                            } else {
                              setSelectedEps(prev => prev.filter(id => id !== ep.id));
                            }
                          }}
                        />
                        <div className="w-12 h-12 flex items-center justify-center rounded-xl font-bold bg-indigo-500 text-white shrink-0 shadow-sm cursor-pointer" onClick={() => {
                          // Allow clicking the EP box to toggle as well
                          if (selectedEps.includes(ep.id)) {
                            setSelectedEps(prev => prev.filter(id => id !== ep.id));
                          } else {
                            setSelectedEps(prev => [...prev, ep.id]);
                          }
                        }}>
                          EP.{ep.ep}
                        </div>
                        <div>
                          <h4 className="font-bold text-base mb-1" style={{ color: 'var(--text-main)' }}>{ep.title}</h4>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600">⏱️ {ep.duration}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 md:w-auto w-full shrink-0">
                        <button 
                          onClick={() => handleAIGuideline(ep, 'guideline')}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${ep.guideline ? 'bg-indigo-500 text-white' : 'border text-indigo-500 hover:bg-indigo-500 hover:text-white'}`}
                          style={!ep.guideline ? { borderColor: 'var(--border-color)' } : {}}
                        >
                          🕵️‍♂️ ไกด์ไลน์คนสอน {ep.guideline && '✓'}
                        </button>
                        <div className="flex rounded-lg overflow-hidden shadow-sm" style={{ border: '1px solid var(--border-color)' }}>
                          {!ep.slideContent ? (
                            <button 
                              onClick={() => handleAIGuideline(ep, 'slide', true)}
                              className="px-4 py-2 text-xs font-bold transition-all text-emerald-600 hover:bg-emerald-50 w-full"
                              style={{ backgroundColor: 'var(--surface)' }}
                            >
                              ✨ สร้างสไลด์ด้วย AI
                            </button>
                          ) : (
                            <>
                              <button 
                                onClick={() => handleViewPresentation(ep)}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all flex items-center justify-center flex-1"
                              >
                                ▶️ เปิดพรีเซนต์
                              </button>
                              <button 
                                onClick={() => {
                                  if(confirm('การสร้างใหม่จะสุ่มเนื้อหาใหม่และลบเนื้อหาเดิมทิ้ง คุณแน่ใจหรือไม่?')) {
                                    handleAIGuideline(ep, 'slide', true);
                                  }
                                }}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center border-l border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
                                title="สร้างเนื้อหาใหม่ด้วย AI"
                              >
                                🔄 สร้างใหม่
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <div className="px-6 py-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface)' }}>
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-main)' }}>{aiModalTitle}</h3>
              <button 
                onClick={() => setAiModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors text-xl leading-none pb-1"
                style={{ color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {isAiLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <span className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></span>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>AI กำลังคิดวิเคราะห์และเรียบเรียงเนื้อหา...</p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{
                  __html: aiModalContent
                    .replace(/## (.*?)\n/g, '<h2 class="text-xl font-bold mt-6 mb-3 text-indigo-500">$1</h2>')
                    .replace(/### (.*?)\n/g, '<h3 class="text-lg font-bold mt-4 mb-2 text-emerald-500">$1</h3>')
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                    .replace(/\* (.*?)\n/g, '<li class="ml-4 mb-1">$1</li>')
                    .replace(/\n/g, '<br/>')
                }} />
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface)' }}>
              {!isAiLoading && (
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(aiModalContent);
                    alert('คัดลอกลง Clipboard เรียบร้อย!');
                  }}
                  className="px-4 py-2 border rounded-lg text-sm font-bold hover:bg-black/5 mr-2"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
                >
                  📋 คัดลอก
                </button>
              )}
              <button 
                onClick={() => setAiModalOpen(false)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide Viewer Presentation Modal */}
      {viewingSlideEp && (
        <SlideViewerModal
          courseTitle={activeCourse?.title || ''}
          epTitle={viewingSlideEp.title}
          markdownContent={viewingSlideEp.slideContent || ''}
          onClose={() => setViewingSlideEp(null)}
        />
      )}
    </div>
  );
}
