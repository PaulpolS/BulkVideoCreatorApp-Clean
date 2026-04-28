import React, { useState, useEffect, useRef } from 'react';
import { NumInput } from '../ui/NumInput';
import { globalTaskStore } from '../../hooks/useBackgroundTasks';
import { useKieTTS } from '../../hooks/useKieTTS';
import { useStockKeywords } from '../../hooks/useStockKeywords';

export interface SceneData {
  id: string;
  type: 'hook' | 'image' | 'video' | 'outro';
  title: string;
  description: string;
  color: string;
  script: string;
  audioUrl?: string;
  duration?: number;
  artStyle?: string;
  mediaMode?: 'ai' | 'manual' | 'generate';
  selectedMedia?: string;
  imagePrompt?: string;
  imageUrl?: string;
  animation?: string;
  animationIntensity?: number;
  videoStockFolder?: string;
  isSelectedForTest?: boolean;
  transitionType?: string;
  transitionSoundUrl?: string;
  avatarCharacter?: string;
  avatarAnimation?: string;
  avatarPosition?: string;
  avatarPos?: { x: number, y: number, scale: number };
}

export interface TimelineData {
  id: string;
  topic: string;
  isExpanded: boolean;
  isGeneratingScript: boolean;
  scenes: SceneData[];
  subtitles?: string;
  isGeneratingSubtitles?: boolean;
}

export interface SubtitleStyle {
  fontName: string;
  fontSize: number;
  primaryColor: string;
  outlineColor: string;
  borderStyle: number;
  outlineThickness: number;
  shadowColor: string;
  shadowThickness: number;
  marginV: number;
  zIndex?: number;
}

export function SceneBuilder() {
  const { keywords } = useStockKeywords();
  const [apiKeys] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('api_key_profiles') || '[]'); } 
    catch(e) { return []; }
  });
  const [selectedKeyId, setSelectedKeyId] = useState(() => localStorage.getItem('selected_api_key_id') || '');
  const apiKey = apiKeys.find((p: any) => p.id === selectedKeyId)?.key || '';

  const [openRouterKey, setOpenRouterKey] = useState<string>('');
  


  useEffect(() => {
    localStorage.setItem('selected_api_key_id', selectedKeyId);
    // Fetch OpenRouter key for AI
    const keys = localStorage.getItem('openrouter_keys');
    if (keys) {
      try {
        const parsed = JSON.parse(keys);
        if (parsed.length > 0) setOpenRouterKey(parsed[0].key);
      } catch(e) {}
    }
  }, [selectedKeyId]);

  const [voiceModel, setVoiceModel] = useState('mac_Kanya'); // Mac Free Default
  const [voiceStability, setVoiceStability] = useState<number>(0.5);
  const { generateAudio, isGenerating } = useKieTTS();

  // Template scenes (Blueprint)
  const [templateScenes, setTemplateScenes] = useState<SceneData[]>([
    { id: 't1', type: 'hook', title: 'Hook', description: 'น่าสนใจมาก', color: 'purple', script: 'ความลับของคนรวยที่เขาไม่เคยบอกคุณ!', mediaMode: 'manual' },
    { id: 't2', type: 'image', title: 'ภาพประกอบ AI', description: 'เอฟเฟคค่อยๆเลื่อนซูม', color: 'orange', script: 'ทำไมคนรวยถึงยิ่งรวยขึ้น แต่คนจนกลับถอยหลัง?', artStyle: 'cinematic', imagePrompt: '', mediaMode: 'generate' },
    { id: 't3', type: 'video', title: 'คลิปStock', description: 'คลิปบรรยายพร้อมข้อมูล', color: 'orange', script: 'วันนี้เรามาเจาะลึก 3 ข้อคิดทางการเงิน...', videoStockFolder: 'ความสำเร็จ', mediaMode: 'stock' },
    { id: 't4', type: 'outro', title: 'คลิปจบ', description: 'ชวนกดติดตาม', color: 'purple', script: 'ถ้าชอบคลิปนี้ อย่าลืมกดติดตามและแชร์ให้เพื่อนๆ นะครับ', mediaMode: 'stock' }
  ]);

  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
  const [draggedTemplateIdx, setDraggedTemplateIdx] = useState<number | null>(null);
  const [avatarFrameIdx, setAvatarFrameIdx] = useState(0);
  
  // Drag state for avatar
  const [draggingAvatarInfo, setDraggingAvatarInfo] = useState<{timelineId: string, sceneId: string, startX: number, startY: number, initialX: number, initialY: number} | null>(null);
  
  // Drag state for subtitle
  const [draggingSubtitleInfo, setDraggingSubtitleInfo] = useState<{startY: number, initialMarginV: number} | null>(null);
  
  // Bulk Factory Generation
  const [timelines, setTimelines] = useState<TimelineData[]>([]);
  const [bulkCount, setBulkCount] = useState(10);
  const [logs, setLogs] = useState<{ time: string; message: string; type: 'info' | 'success' | 'error' }[]>([]);
  const [sfxList, setSfxList] = useState<any[]>([]);
  const [avatarList, setAvatarList] = useState<any[]>([]);
  const [fontList, setFontList] = useState<any[]>([]);
  
  // Subtitle Styling States
  const [isSubtitlePanelOpen, setIsSubtitlePanelOpen] = useState(false);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(() => {
    const defaults = {
      fontName: 'Arial',
      fontSize: 24,
      primaryColor: '#ffffff',
      outlineColor: '#000000',
      borderStyle: 1,
      outlineThickness: 2.5,
      shadowColor: '#000000',
      shadowThickness: 0,
      marginV: 30
    };
    try {
      const parsed = JSON.parse(localStorage.getItem('subtitle_style') || '{}');
      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    if (Object.keys(subtitleStyle).length > 0) {
      localStorage.setItem('subtitle_style', JSON.stringify(subtitleStyle));
    }
  }, [subtitleStyle]);

  const draggingRef = useRef(draggingAvatarInfo);
  draggingRef.current = draggingAvatarInfo;

  const dragSubRef = useRef(draggingSubtitleInfo);
  dragSubRef.current = draggingSubtitleInfo;

  // Global mouse handlers for avatar and subtitle drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Subtitle drag processing
      const subInfo = dragSubRef.current;
      if (subInfo) {
         // Moving up decreases clientY, meaning marginV increases
         const dy = subInfo.startY - e.clientY; 
         // approximate pixel mapping
         let newMarginV = subInfo.initialMarginV + (dy * 1.5);
         newMarginV = Math.max(0, Math.min(600, newMarginV));
         setSubtitleStyle(prev => ({ ...prev, marginV: newMarginV }));
         return; // If dragging subtitle, skip avatar
      }

      const info = draggingRef.current;
      if (!info) return;
      
      const dx = e.clientX - info.startX;
      const dy = e.clientY - info.startY;
      
      // Convert pixel delta to % (based on approximate preview container size)
      const dxPercent = (dx / 3); // roughly 3px = 1%
      const dyPercent = (dy / 3);

      setTimelines(prev => prev.map(t => {
        if (t.id === info.timelineId) {
          return {
            ...t,
            scenes: t.scenes.map(s => {
              if (s.id === info.sceneId) {
                return {
                  ...s,
                  avatarPos: {
                    x: Math.max(-50, Math.min(150, info.initialX + dxPercent)),
                    y: Math.max(-50, Math.min(150, info.initialY + dyPercent)),
                    scale: s.avatarPos?.scale || 1
                  }
                };
              }
              return s;
            })
          };
        }
        return t;
      }));
    };

    const handleMouseUp = () => {
      setDraggingAvatarInfo(null);
      setDraggingSubtitleInfo(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []); // Empty deps — uses ref to avoid stale closure

  useEffect(() => {
    fetch('/api/list-sound-stock')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setSfxList(data);
      })
      .catch(() => {});

    fetch('/api/list-avatars')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvatarList(data);
      })
      .catch(() => {});

    fetch('/api/list-assets')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
           const fonts = data.filter((d: any) => d.type === 'Font_stock');
           setFontList(fonts);
        }
      })
      .catch(() => {});
  }, []);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
    setLogs(prev => [...prev, { time, message, type }]);
  };

  const handleBulkGenerateTimelines = () => {
    if (bulkCount < 1 || bulkCount > 50) return alert('จำนวนคลิปต้องอยู่ระหว่าง 1 - 50');
    const newTimelines: TimelineData[] = Array.from({ length: bulkCount }).map((_, i) => ({
      id: `timeline-${Date.now()}-${i}`,
      topic: '',
      isExpanded: true,
      isGeneratingScript: false,
      scenes: JSON.parse(JSON.stringify(templateScenes))
    }));
    setTimelines(prev => [...newTimelines, ...prev]);
  };

  // Timeline Interactions
  const updateTimelineTopic = (timelineId: string, topic: string) => {
    setTimelines(prev => prev.map(t => t.id === timelineId ? { ...t, topic } : t));
  };
  
  const toggleTimeline = (timelineId: string) => {
    setTimelines(prev => prev.map(t => t.id === timelineId ? { ...t, isExpanded: !t.isExpanded } : t));
  };
  
  const deleteTimeline = (timelineId: string) => {
    if(confirm("ลบคลิปแถวนี้ทั้งหมดหรือไม่?")) {
      setTimelines(prev => prev.filter(t => t.id !== timelineId));
    }
  };

  const updateTimelineSceneProps = (timelineId: string, sceneId: string, props: Partial<SceneData>) => {
    setTimelines(prev => prev.map(t => {
      if (t.id === timelineId) {
        return {
          ...t,
          scenes: t.scenes.map(s => s.id === sceneId ? { ...s, ...props } : s)
        };
      }
      return t;
    }));
  };

  const updateTimelineSubtitles = (timelineId: string, subs: string) => {
    setTimelines(prev => prev.map(t => t.id === timelineId ? { ...t, subtitles: subs } : t));
  };

  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const [expandedSubtitleId, setExpandedSubtitleId] = useState<string | null>(null);

  const msToSrtTime = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mx = Math.floor(ms % 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${mx.toString().padStart(3, '0')}`;
  };

  const handleGenerateSubtitles = async (timelineId: string) => {
    const timeline = timelines.find(t => t.id === timelineId);
    if (!timeline) return;

    setTimelines(prev => prev.map(t => t.id === timelineId ? { ...t, isGeneratingSubtitles: true } : t));
    addLog(`✨ กำลังซิงค์ซับไตเติ้ลจาก Script (Auto-Sync)...`, 'info');

    try {
      let cumulativeDurMs = 0;
      let srtContent = '';
      let srtIndexCount = 1;

      for (let i = 0; i < timeline.scenes.length; i++) {
         const scene = timeline.scenes[i];
         const durMs = (scene.duration || 5) * 1000;
         const startMs = cumulativeDurMs;
         
         const text = (scene.script || '').replace(/\n/g, ' ').trim();
         if (text) {
             const words = text.split(/(\s+|[!?.,]+)/).filter(w => w.trim());
             const chunks: string[] = [];
             let cur = '';
             for(let w of words) {
               if ((cur.length + w.length > 35) && cur.length > 4) {
                 chunks.push(cur.trim());
                 cur = w;
               } else {
                 cur += (cur && !w.match(/^[!?.,]+$/) ? ' ' : '') + w;
               }
             }
             if (cur) chunks.push(cur.trim());

             const finalChunks: string[] = [];
             for(let ch of chunks) {
               let temp = ch;
               while(temp.length > 45) {
                 finalChunks.push(temp.substring(0, 40) + '-');
                 temp = temp.substring(40);
               }
               if (temp) finalChunks.push(temp);
             }

             const totalChars = finalChunks.reduce((acc, curr) => acc + curr.length, 0);
             let chunkStartMs = startMs;
             
             for (const chunk of finalChunks) {
                const chunkDurMs = Math.round((chunk.length / totalChars) * durMs);
                const chunkEndMs = chunkStartMs + chunkDurMs;
                
                srtContent += `${srtIndexCount}\n${msToSrtTime(chunkStartMs)} --> ${msToSrtTime(chunkEndMs)}\n${chunk}\n\n`;
                srtIndexCount++;
                chunkStartMs = chunkEndMs;
             }
         }
         
         cumulativeDurMs += durMs;
         if (scene.transitionType && scene.transitionType !== 'none' && i < timeline.scenes.length - 1) {
            cumulativeDurMs -= 500; // XFade overlap
         }
      }

      updateTimelineSubtitles(timelineId, srtContent.trim());
      addLog('✅ ซิงค์ซับไตเติ้ลจาก Script เป๊ะ 100% เสร็จสมบูรณ์!', 'success');
    } catch (e: any) {
      addLog(`❌ จัดการซับไตเติ้ลล้มเหลว: ${e.message}`, 'error');
    } finally {
      setTimelines(prev => prev.map(t => t.id === timelineId ? { ...t, isGeneratingSubtitles: false } : t));
    }
  };

  const handleRefineSubtitles = async (timelineId: string) => {
    if (!openRouterKey) return alert('ไม่พบ OpenRouter Key สำหรับเกลาคำรบกวนตั้งค่าในหน้า AI Content ก่อนครับ');
    const timeline = timelines.find(t => t.id === timelineId);
    if (!timeline || !timeline.subtitles) return;

    setTimelines(prev => prev.map(t => t.id === timelineId ? { ...t, isGeneratingSubtitles: true } : t));
    addLog('✨ กำลังส่งให้ AI เกลาซับไตเติ้ล...', 'info');

    try {
      const prompt = `ช่วยแก้คำผิดภาษาไทย ปรับรูปประโยคให้อ่านง่าย และตัดขึ้นบรรทัดใหม่ให้พอดี (1 บรรทัดไม่ควรเกิน 8 คำ หรือประมาณ 40 ตัวอักษร) แต่ห้ามเปลี่ยนเวลา (Timestamps) หรือรูปแบบ SRT เด็ดขาด ให้ตอบกลับเป็นโพแมต SRT ทันที ห้ามแสดงคิดเห็นเพิ่มเติม\n\n${timeline.subtitles}`;
      
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
         method: 'POST',
         headers: {
             'Authorization': `Bearer ${openRouterKey}`,
             'Content-Type': 'application/json'
         },
         body: JSON.stringify({
             model: 'google/gemini-2.5-flash-lite',
             messages: [{ role: 'user', content: prompt }]
         })
      });

      const data = await res.json();
      const contentStr = data.choices?.[0]?.message?.content || '';
      if (!contentStr) throw new Error('AI Response ว่างเปล่า');

      const cleaned = contentStr.replace(/```srt/g, '').replace(/```/g, '').trim();
      updateTimelineSubtitles(timelineId, cleaned);
      addLog('✅ AI แก้ไขเกลาซับไตเติ้ลเรียบร้อย!', 'success');
    } catch(e: any) {
      addLog(`❌ AI เกลาซับผิดพลาด: ${e.message}`, 'error');
    } finally {
      setTimelines(prev => prev.map(t => t.id === timelineId ? { ...t, isGeneratingSubtitles: false } : t));
    }
  };

  // Real-time Lip Sync using AudioContext
  useEffect(() => {
    if (!playingPreviewId || !activeAudioRef.current) {
       setAvatarFrameIdx(0);
       return;
    }

    const audio = activeAudioRef.current;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    let audioCtx: AudioContext;
    let source: MediaElementAudioSourceNode;
    let analyser: AnalyserNode;
    let animationFrameId: number;

    try {
        audioCtx = new AudioContextClass();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
    } catch(e) {
        console.error("AudioContext setup failed:", e);
        return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    // Smoothing buffer
    let speakingFrames = 0;

    const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for(let i=0; i<dataArray.length; i++) { sum += dataArray[i]; }
        const avg = sum / dataArray.length; 
        
        // Volume Threshold: 10 out of 255 is relatively quiet but detectable
        if (avg > 15) { 
            // Flap mouth every 120ms as long as volume is above threshold
            if (Math.floor(Date.now() / 120) % 2 === 0) {
               setAvatarFrameIdx(1); 
            } else {
               setAvatarFrameIdx(0);
            }
        } else {
            setAvatarFrameIdx(0);
        }
        animationFrameId = requestAnimationFrame(checkVolume);
    };
    
    checkVolume();

    return () => {
        cancelAnimationFrame(animationFrameId);
        try { source.disconnect(); } catch(e){}
        try { analyser.disconnect(); } catch(e){}
        try { audioCtx.close(); } catch(e){}
    };
  }, [playingPreviewId]);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleTogglePreview = (sceneId: string, audioUrl?: string, duration?: number) => {
    if (playingPreviewId === sceneId) {
       if (activeAudioRef.current) {
          activeAudioRef.current.pause();
          activeAudioRef.current = null;
       }
       setPlayingPreviewId(null);
    } else {
       if (activeAudioRef.current) {
          activeAudioRef.current.pause();
       }
       setPlayingPreviewId(sceneId);
       if (audioUrl) {
          const audio = new Audio(audioUrl);
          audio.crossOrigin = "anonymous"; // Important for AudioContext
          audio.onended = () => setPlayingPreviewId(null);

          audio.play().catch(e => {
            console.error("Audio play failed:", e);
            setPlayingPreviewId(null);
          });
          activeAudioRef.current = audio;
       } else {
          setTimeout(() => setPlayingPreviewId(null), (duration || 5) * 1000);
       }
    }
  };

  const handleGenerateVoice = async (timelineId: string, sceneId: string, script: string) => {
    if (!voiceModel.startsWith('mac_') && !apiKey) {
      addLog('เบิกเงินไม่สำเร็จ! กรุณาเลือกบัญชี Kie.ai API Key ด้านบนก่อน (หรือใช้โหมดฟรี Mac Kanya)', 'error');
      return alert("⚠️ กรุณาเลือกบัญชี Kie.ai API Key ด้านบนก่อน");
    }
    
    setGeneratingSceneId(`${timelineId}-${sceneId}`);
    addLog(`🎙️ เริ่มกระบวนการอัดเสียง...`, 'info');

    const result = await generateAudio({ 
      text: script, 
      apiKey, 
      voiceId: voiceModel,
      stability: voiceStability,
      onLog: addLog
    });
    
    if (result) {
      let finalAudioUrl = result.audioUrl;
      
      // If it's a remote URL from Kie.ai, download it to Voice_stock
      if (finalAudioUrl.startsWith('http')) {
         addLog(`กำลังบันทึกเสียงพากย์ลงเครื่อง...`, 'info');
         try {
            const saveRes = await fetch('/api/save-audio', {
               method: 'POST',
               body: JSON.stringify({ 
                 url: finalAudioUrl, 
                 fileName: `kie-voice-${Date.now()}`, 
                 prompt: script.substring(0, 50),
                 folder: 'Voice_stock'
               })
            });
            const saveData = await saveRes.json();
            if (saveRes.ok && saveData.url) {
               finalAudioUrl = saveData.url;
               addLog(`✅ บันทึกเสียงพากย์ลง Voice_stock สำเร็จ!`, 'success');
            }
         } catch(e: any) {
            addLog(`⚠️ ดาวน์โหลดไฟล์ล้มเหลว (ใช้ลิงก์ออนไลน์แทน): ${e.message}`, 'error');
         }
      }

      updateTimelineSceneProps(timelineId, sceneId, { audioUrl: finalAudioUrl, duration: result.duration });
      addLog(`💾 นำเสียงมาใส่ในฉากสำเร็จ!`, 'success');
    } else {
      addLog(`❌ การสร้างเสียงล้มเหลว ตรวจสอบปัญหาด้านบน`, 'error');
    }
    setGeneratingSceneId(null);
  };

  const handleGenerateImage = async (timelineId: string, sceneId: string, imagePrompt: string) => {
    if (!apiKey) {
      addLog('⚠️ เบิกเงินไม่สำเร็จ! กรุณาเลือกบัญชี Kie.ai API Key ด้านบนก่อน', 'error');
      return alert("⚠️ กรุณาเลือกบัญชี Kie.ai API Key ด้านบนก่อน");
    }
    
    setGeneratingSceneId(`${timelineId}-${sceneId}-image`);
    addLog(`🎨 เริ่มส่งคำสั่งวาดภาพ AI รุ่น Z-Image...`, 'info');

    try {
      const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'z-image',
          input: {
            prompt: imagePrompt,
            aspect_ratio: '1:1',
            nsfw_checker: true
          }
        })
      });

      if (!createRes.ok) {
        throw new Error(`API Error: ${createRes.status}`);
      }

      const createData = await createRes.json();
      const taskId = createData?.data?.taskId || createData?.taskId;

      if (!taskId) {
        throw new Error(`ไม่ได้รับ Task ID: ${JSON.stringify(createData)}`);
      }

      addLog(`รอคิววาดภาพ (Task ID: ${taskId.substring(0,6)}...)`, 'info');

      let imageUrl = null;
      let attempt = 0;
      while (attempt < 40) { // Max 100 seconds
        await new Promise(res => setTimeout(res, 2500));
        addLog(`กำลังวาดภาพ... (รอ ${attempt * 2.5} วินาที)`, 'info');

        const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        const pollData = await pollRes.json();
        const state = pollData?.data?.state?.toLowerCase() || pollData?.state?.toLowerCase();
        
        if (state === 'success' || state === 'completed') {
           const resultJsonStr = pollData?.data?.resultJson || pollData?.resultJson;
           if (resultJsonStr) {
             try {
               const parsedResult = JSON.parse(resultJsonStr);
               // Handle different structure possibilities from z-image (images[0].url, url, resultUrls, etc)
               imageUrl = parsedResult.images?.[0]?.url || parsedResult.url || parsedResult.resultUrls?.[0] || parsedResult.imageUrl;
             } catch(e) {
               console.error("Parse error", e);
             }
           }
           break;
        } else if (state === 'failed' || state === 'error') {
           throw new Error(`ระบบเจนภาพล้มเหลว: ${JSON.stringify(pollData)}`);
        }
        attempt++;
      }

      if (!imageUrl) {
        throw new Error('หมดเวลาหรือภาพไม่ถูกส่งกลับมา');
      }

      addLog(`กำลังดาวน์โหลดภาพ...`, 'info');
      try {
         const saveRes = await fetch('/api/save-audio', {
            method: 'POST',
            body: JSON.stringify({ 
              url: imageUrl, 
              fileName: `z-image-${Date.now()}`, 
              prompt: imagePrompt.substring(0, 50),
              folder: 'Image_stock'
            })
         });
         const saveData = await saveRes.json();
         if (saveRes.ok && saveData.url) {
            imageUrl = saveData.url;
            addLog(`✅ บันทึกรูปภาพลง Image_stock สำเร็จ!`, 'success');
         }
      } catch(e: any) {
         addLog(`⚠️ บันทึกรูปลงเครื่องล้มเหลว (ใช้ลิงก์ออนไลน์): ${e.message}`, 'error');
      }

      updateTimelineSceneProps(timelineId, sceneId, { imageUrl });
      addLog(`🎯 นำภาพมาใส่ในฉากสำเร็จ!`, 'success');
    } catch(err: any) {
      addLog(`❌ การสร้างภาพล้มเหลว: ${err.message}`, 'error');
    } finally {
      setGeneratingSceneId(null);
    }
  };

  const handlePickRandomVideo = async (timelineId: string, sceneId: string, folderName: string) => {
    if (!folderName) return;
    try {
      addLog(`กำลังสุ่มวิดีโอจากสต็อค ${folderName}...`, 'info');
      const res = await fetch(`/api/list-video-folder?folder=${encodeURIComponent(folderName)}`);
      const files = await res.json();
      if (files.error) throw new Error(files.error);
      if (files.length === 0) {
        addLog(`ไม่มีวิดีโอในโฟลเดอร์ ${folderName}`, 'error');
        return;
      }
      const randomFile = files[Math.floor(Math.random() * files.length)];
      updateTimelineSceneProps(timelineId, sceneId, { imageUrl: randomFile.url });
      addLog(`✅ เลือกวิดีโอ ${randomFile.name} สำเร็จ`, 'success');
    } catch (e: any) {
      addLog(`❌ ดึงวิดีโอสต็อคไม่สำเร็จ: ${e.message}`, 'error');
    }
  };

  // SFX random function removed - replaced by dropdown

  const handleSaveProjectTestSubset = async (timelineId: string) => {
    const timeline = timelines.find(t => t.id === timelineId);
    if (!timeline) return;
    
    // Only export scenes where isSelectedForTest is true
    const selectedScenes = timeline.scenes.filter(s => s.isSelectedForTest);
    if (selectedScenes.length === 0) {
      alert("กรุณาติ๊ก ✓ เลือดทดสอบเรนเดอร์ อย่างน้อย 1 ฉากในเส้นเวลาก่อน");
      return;
    }
    
    const outputPath = localStorage.getItem('custom_output_folder');
    if (!outputPath) {
      alert('กรุณาตั้งค่าโฟลเดอร์ Output ก่อน! (ปุ่มตั้งค่าด้านบน)');
      return;
    }
    
    addLog(`กำลังส่งเรนเดอร์วิดีโอ (รอประมาณ 1-3 นาที กรุณาอย่าปิดหน้าต่าง)...`, 'info');
    const taskId = `render_${Date.now()}`;
    globalTaskStore.addTask({ id: taskId, title: `🎬 เรนเดอร์วิดีโอ: ${timeline.topic || 'Test Project'}`, category: 'render', progress: `กำลังเรนเดอร์ ${selectedScenes.length} ฉาก...`, status: 'running' });
    try {
      const payload = {
        topic: timeline.topic || 'Test Project',
        scenes: selectedScenes,
        subtitles: timeline.subtitles,
        subtitleStyle: subtitleStyle,
        outputPath: outputPath
      };

      const res = await fetch('/api/render-video', {
         method: 'POST',
         body: JSON.stringify(payload)
      });
      const resData = await res.json();
      if (res.ok) {
         addLog(`✅ เรนเดอร์วิดีโอเสร็จสิ้น! บันทึกใน: ${outputPath}`, 'success');
         globalTaskStore.updateTask(taskId, { progress: `✅ เสร็จ! บันทึกใน: ${outputPath}`, status: 'completed' });
      } else {
         throw new Error(resData.error || resData.details);
      }
    } catch(e: any) {
      addLog(`❌ เรนเดอร์วิดีโอล้มเหลว: ${e.message}`, 'error');
      globalTaskStore.updateTask(taskId, { progress: `❌ ${e.message}`, status: 'error' });
    }
  };

  const handleExportProjectJSON = async () => {
     addLog(`กำลังสร้างไฟล์ส่งออก (Project JSON)...`, 'info');
     const outputPath = localStorage.getItem('custom_output_folder') || '/Users/macos/Desktop/Done';
     try {
       const res = await fetch('/api/save-project', {
         method: 'POST',
         body: JSON.stringify({
           path: outputPath,
           data: timelines
         })
       });
       const data = await res.json();
       if (res.ok) {
         addLog(`🎉 ส่งออก Project ไว้ที่ ${data.filePath} สำเร็จ!`, 'success');
         alert(`🎉 ส่งออกสำเร็จ!\nไฟล์อยู่ที่: ${data.filePath}`);
       } else {
         addLog(`❌ ดร็อปไฟล์ไม่สำเร็จ: ${data.error}`, 'error');
         alert(`ดร็อปไฟล์ไม่สำเร็จ: ${data.error}`);
       }
     } catch (e: any) {
       addLog(`❌ เออเร่อการเชื่อมต่อ: ${e.message}`, 'error');
     }
  };

  const handleGenerateRowScript = async (timelineId: string) => {
    const timeline = timelines.find(t => t.id === timelineId);
    if(!timeline) return;
    if(!timeline.topic) return alert('กรุณาเซ็ตหัวข้อให้แถวนี้ก่อนครับ (เช่น "จุดเด่นของ AI")');
    if(!openRouterKey) return alert('ไม่พบ OpenRouter Key กรุณากลับไปติดตั้งในแท็บคลัง Content ก่อนครับ');

    setTimelines(prev => prev.map(t => t.id === timelineId ? {...t, isGeneratingScript: true} : t));

    try {
       const prompt = `
คุณต้องเป็นผู้กำกับและนักเขียนบทวิดีโอคลิปสั้น (TikTok/Reels)
หัวข้อ: "${timeline.topic}"

ภารกิจของคุณคือการออกแบบเรื่องราว (Storyboard) ให้กับคลิปนี้ โดยคลิปจะถูกแบ่งออกเป็น ${timeline.scenes.length} ฉาก (Scenes) พอดีเป๊ะ
คุณต้องกำหนดทิศทางการเล่าเรื่องของแต่ละฉากให้เรียงร้อยต่อกัน (เช่น ฉากแรกเป็น Hook ดึงดูด, ฉากกลางๆ อธิบาย/เล่าเรื่อง, ฉากสุดท้าย Call to Action) พร้อมคิดบทพูดและคำแนะนำสื่อประกอบ

กรุณาสร้างระดับ JSON Array ออกมา ${timeline.scenes.length} ชิ้น โดยแต่ละชิ้นมีโครงสร้างดังนี้:
{
  "sceneRole": "หน้าที่ของฉาก เช่น 'ฮุคเปิดให้หยุดดู', 'อธิบายปัญหา', 'Call to Action'",
  "mediaGuidance": "คำแนะนำสั้นๆ ว่าฉากนี้ควรใช้ภาพ/วิดีโอแนวไหน (เช่น 'วิดีโอคนกำลังปวดหัว', 'ภาพ AI หุ่นยนต์ทำงาน')",
  "script": "บทพูดภาษาไทย (1 ประโยคเด่นๆ ต่อฉาก ความยาว 15-30 คำ) เขียนให้น่าสนใจ เล่าเรื่องต่อกัน",
  "imagePrompt": "พรอมต์ภาษาอังกฤษแบบละเอียด 1 บรรทัด เผื่อให้ระบบวาดภาพ AI ช่วยแปลความหมายเนื้อหาของฉากเป็นรูป (ต้องแต่งให้ทุกฉากแบบเจาะจง)"
}

ตอบเฉพาะ JSON Array ล้วนๆ ห้ามอธิบายเพิ่ม ห้ามมีกรอบ Markdown
ตัวอย่าง:
[
  { "sceneRole": "Hook ดึงดูด", "mediaGuidance": "คลิปคนกำลังสับสน", "script": "ความลับที่คนเก่งๆ ไม่บอกคุณ..", "imagePrompt": "A confused person looking at multiple paths, cinematic lighting" },
  { "sceneRole": "เฉลยวิธีแก้", "mediaGuidance": "ภาพ AI หุ่นยนต์นั่งพิมพ์งาน", "script": "เขาใช้ AI ช่วยทำงานแทนทั้งหมด!", "imagePrompt": "A futuristic robot typing rapidly on a glowing laptop, cyber aesthetic, detailed 8k" }
]`;

       const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
           method: 'POST',
           headers: {
               'Authorization': `Bearer ${openRouterKey}`,
               'Content-Type': 'application/json'
           },
           body: JSON.stringify({
               model: 'google/gemini-2.5-flash-lite',
               messages: [{ role: 'user', content: prompt }]
           })
       });

       const data = await res.json();
       const contentStr = data.choices?.[0]?.message?.content || '[]';
       const cleaned = contentStr.replace(/```json/g, '').replace(/```/g, '').trim();
       const parsed = JSON.parse(cleaned);

       if(Array.isArray(parsed) && parsed.length === timeline.scenes.length) {
          setTimelines(prev => prev.map(t => {
             if(t.id === timelineId) {
               const updatedScenes = t.scenes.map((s, idx) => ({
                   ...s,
                   title: parsed[idx]?.sceneRole || s.title,
                   description: parsed[idx]?.mediaGuidance || s.description,
                   script: parsed[idx]?.script || s.script,
                   imagePrompt: parsed[idx]?.imagePrompt || s.imagePrompt
               }));
               return { ...t, scenes: updatedScenes, isGeneratingScript: false };
             }
             return t;
          }));
       } else {
          throw new Error('AI ส่งผลลัพธ์มาไม่ตรงโครงสร้างฉาก (พยายามอีกครั้ง)');
       }
    } catch (e: any) {
       alert('เกิดข้อผิดพลาด AI Script: ' + e.message);
       setTimelines(prev => prev.map(t => t.id === timelineId ? {...t, isGeneratingScript: false} : t));
    }
  };

  // Blueprint Controls
  const moveTemplate = (index: number, direction: -1 | 1) => {
    setTemplateScenes(prev => {
      const newS = [...prev];
      if (index + direction >= 0 && index + direction < newS.length) {
        const t = newS[index]; newS[index] = newS[index + direction]; newS[index + direction] = t;
      }
      return newS;
    });
  };
  const removeTemplate = (id: string) => setTemplateScenes(prev => prev.filter(s => s.id !== id));
  const addTemplate = () => {
    const id = Date.now().toString();
    setTemplateScenes(prev => [...prev, { 
       id, 
       type: 'image', 
       title: `ฉากที่ ${prev.length + 1}`, 
       description: '', 
       color: 'blue', 
       script: '', 
       mediaMode: 'generate',
       artStyle: 'cinematic'
    } as SceneData]);
  };
  const updateTemplate = (id: string, props: Partial<SceneData>) => {
    setTemplateScenes(prev => prev.map(s => s.id === id ? { ...s, ...props } : s));
  };
  
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedTemplateIdx(index);
    // Needed for Firefox to allow dragging
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedTemplateIdx === null || draggedTemplateIdx === dropIndex) return;
    
    setTemplateScenes(prev => {
      const newS = [...prev];
      const [moved] = newS.splice(draggedTemplateIdx, 1);
      newS.splice(dropIndex, 0, moved);
      return newS;
    });
    setDraggedTemplateIdx(null);
  };


  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);

  const getAnimationStyles = (scene: SceneData, isPlaying: boolean) => {
    let startTransform = 'scale(1)';
    let endTransform = 'scale(1)';

    const intensity = scene.animationIntensity || 2;
    // Map intensity (1,2,3) to values
    const zoomVal = intensity === 1 ? 1.1 : intensity === 2 ? 1.3 : 1.7;
    const panVal = intensity === 1 ? 5 : intensity === 2 ? 15 : 30;
    const rotVal = intensity === 1 ? 3 : intensity === 2 ? 10 : 25;
    
    // For Ken Burns
    const kbZoom = intensity === 1 ? 1.2 : intensity === 2 ? 1.5 : 2.0;
    const kbPan = intensity === 1 ? 2 : intensity === 2 ? 10 : 25;

    switch(scene.animation) {
      case 'zoom-in': startTransform = 'scale(1)'; endTransform = `scale(${zoomVal})`; break;
      case 'zoom-out': startTransform = `scale(${zoomVal})`; endTransform = 'scale(1)'; break;
      case 'pan-left': startTransform = `scale(${zoomVal}) translateX(${panVal}%)`; endTransform = `scale(${zoomVal}) translateX(-${panVal}%)`; break;
      case 'pan-right': startTransform = `scale(${zoomVal}) translateX(-${panVal}%)`; endTransform = `scale(${zoomVal}) translateX(${panVal}%)`; break;
      case 'pan-up': startTransform = `scale(${zoomVal}) translateY(${panVal}%)`; endTransform = `scale(${zoomVal}) translateY(-${panVal}%)`; break;
      case 'pan-down': startTransform = `scale(${zoomVal}) translateY(-${panVal}%)`; endTransform = `scale(${zoomVal}) translateY(${panVal}%)`; break;
      case 'rotate-left': startTransform = `scale(${zoomVal}) rotate(${rotVal}deg)`; endTransform = `scale(${zoomVal}) rotate(-${rotVal}deg)`; break;
      case 'rotate-right': startTransform = `scale(${zoomVal}) rotate(-${rotVal}deg)`; endTransform = `scale(${zoomVal}) rotate(${rotVal}deg)`; break;
      case 'ken-burns-1': startTransform = 'scale(1) translate(0%, 0%)'; endTransform = `scale(${kbZoom}) translate(-${kbPan}%, -${kbPan}%)`; break;
      case 'ken-burns-2': startTransform = 'scale(1) translate(0%, 0%)'; endTransform = `scale(${kbZoom}) translate(${kbPan}%, ${kbPan}%)`; break;
      default: startTransform = 'scale(1)'; endTransform = 'scale(1)'; break;
    }

    return {
      transform: isPlaying && scene.animation && scene.animation !== 'none' ? endTransform : startTransform,
      transition: isPlaying && scene.animation && scene.animation !== 'none' ? `transform ${scene.duration || 5}s linear` : 'none'
    };
  };

  const colorMap: Record<string, string> = {
    purple: 'border-[var(--card-purple-border)] bg-[var(--card-purple-bg)] text-[var(--card-purple-text)]',
    orange: 'border-[var(--card-orange-border)] bg-[var(--card-orange-bg)] text-[var(--card-orange-text)]',
  };

  return (
    <div className="space-y-6">
      
      {/* 1. GLOBAL SUBTITLE STYLE */}
      <div className="bg-[var(--bg-card)] border-2 border-[var(--border-color)] rounded-2xl p-6 shadow-sm mb-6">
         <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={() => setIsSubtitlePanelOpen(!isSubtitlePanelOpen)}>
            <div>
               <h3 className="text-xl font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                 <span>🎨</span> จัดการสไตล์ซับไตเติ้ล (Global Subtitle Style)
               </h3>
               <p className="text-sm opacity-70 mt-1">ตั้งค่าฟอนต์ สี ขอบ สำหรับซับไตเติ้ลทุกคลิปในโปรเจกต์ (ตั้งครั้งเดียวใช้ได้ตลอดไป)</p>
            </div>
            <button className="text-sm font-bold bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition">
              {isSubtitlePanelOpen ? '🔽 พับเก็บ' : '▶️ เปิดตั้งค่า'}
            </button>
         </div>

         {isSubtitlePanelOpen && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pt-4 border-t border-[var(--border-color)]">
               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">ตัวอักษร (Font)</label>
                  <select 
                     className="px-3 py-2 rounded border border-[var(--border-color)] bg-white dark:bg-black text-sm"
                     value={subtitleStyle.fontName}
                     onChange={e => setSubtitleStyle({...subtitleStyle, fontName: e.target.value})}
                  >
                     <option value="Arial">Arial (ตัวพื้นฐาน)</option>
                     {fontList.map(f => (
                        <option key={f.name} value={f.name}>{f.name}</option>
                     ))}
                  </select>
                  <span className="text-[10px] text-gray-500">อัปโหลดฟอนต์ .ttf/.otf เพิ่มได้ที่เมนู Asset ด้านล่าง</span>
               </div>
               
               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">ขนาดความใหญ่ (Size)</label>
                  <div className="flex items-center gap-2">
                     <span className="text-sm font-mono font-bold w-6">{subtitleStyle.fontSize}</span>
                     <input type="range" min="12" max="72" value={subtitleStyle.fontSize} onChange={e => setSubtitleStyle({...subtitleStyle, fontSize: Number(e.target.value)})} className="flex-1" />
                  </div>
               </div>

               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">รูปแบบกล่อง/ขอบตกแต่ง</label>
                  <select 
                     className="px-3 py-2 rounded border border-[var(--border-color)] bg-white dark:bg-black text-sm"
                     value={subtitleStyle.borderStyle}
                     onChange={e => setSubtitleStyle({...subtitleStyle, borderStyle: Number(e.target.value)})}
                  >
                     <option value={1}>ตีเส้นขอบ (Outline)</option>
                     <option value={3}>กล่องสีทึบพื้นหลัง (Opaque Box)</option>
                  </select>
               </div>

               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">ขยับความสูงขอบล่าง (Margin Y)</label>
                  <div className="flex items-center gap-2">
                     <span className="text-sm font-mono font-bold w-6">{Math.round(subtitleStyle.marginV)}</span>
                     <input type="range" min="0" max="600" step="5" value={subtitleStyle.marginV} onChange={e => setSubtitleStyle({...subtitleStyle, marginV: Number(e.target.value)})} className="flex-1" />
                  </div>
                  <span className="text-[10px] text-gray-500">ลากข้อความในจอก็ได้! (ลากรวดเดียวใช้ได้ทุกคลิป)</span>
               </div>

               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">ชั้นเลเยอร์ (Z-Index)</label>
                  <select 
                     className="px-3 py-2 rounded border border-[var(--border-color)] bg-white dark:bg-black text-sm"
                     value={subtitleStyle.zIndex || 20}
                     onChange={e => setSubtitleStyle({...subtitleStyle, zIndex: Number(e.target.value)})}
                  >
                     <option value={20}>อยู่ล่าง (ซับโดน Avatar ทับ)</option>
                     <option value={40}>อยู่บน (ซับทับ Avatar)</option>
                  </select>
                  <span className="text-[10px] text-gray-500">ลำดับการซ้อนทับภาพตอนเรนเดอร์</span>
               </div>

               {/* ======= PRESETS ======= */}
               <div className="col-span-1 md:col-span-2 lg:col-span-5 mt-2">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 block">✨ กดยกเซ็ตเอฟเฟคสำเร็จรูป (CapCut Style):</label>
                  <div className="flex flex-wrap gap-2">
                     <button onClick={() => setSubtitleStyle({...subtitleStyle, primaryColor: '#f1c40f', outlineColor: '#000000', borderStyle: 1, outlineThickness: 3, shadowThickness: 0})} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#f1c40f] text-black border-2 border-black hover:scale-105 transition-transform shadow-sm">เหลืองขอบดำ</button>
                     <button onClick={() => setSubtitleStyle({...subtitleStyle, primaryColor: '#ffffff', outlineColor: '#000000', borderStyle: 1, outlineThickness: 0, shadowColor: '#000000', shadowThickness: 4})} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-black border border-gray-300 hover:scale-105 transition-transform shadow-md">ขาวมินิมอล (เงาตก)</button>
                     <button onClick={() => setSubtitleStyle({...subtitleStyle, primaryColor: '#ffffff', outlineColor: '#000000', borderStyle: 3, outlineThickness: 0, shadowThickness: 0})} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-black text-white border border-gray-700 hover:scale-105 transition-transform shadow-sm">สตรีมมิ่ง (พื้นหลังทึบ)</button>
                     <button onClick={() => setSubtitleStyle({...subtitleStyle, primaryColor: '#ff4757', outlineColor: '#ffffff', borderStyle: 1, outlineThickness: 4, shadowThickness: 0})} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#ff4757] text-white border-2 border-white hover:scale-105 transition-transform shadow-sm">แดงเดือด ขอบขาว</button>
                     <button onClick={() => setSubtitleStyle({...subtitleStyle, primaryColor: '#7efff5', outlineColor: '#ffffff', borderStyle: 1, outlineThickness: 0, shadowColor: '#17c0eb', shadowThickness: 5})} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#7efff5] text-teal-900 border border-teal-200 hover:scale-105 transition-transform shadow-sm">พาสเทลน่ารัก</button>
                  </div>
               </div>

               <div className="flex items-center gap-6 col-span-1 md:col-span-2 lg:col-span-5 mt-2 p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-[var(--border-color)]">
                  <div className="flex items-center gap-2">
                     <label className="text-xs font-bold w-24">สีตัวหนังสือหลัก:</label>
                     <input type="color" value={subtitleStyle.primaryColor} onChange={e => setSubtitleStyle({...subtitleStyle, primaryColor: e.target.value})} className="w-8 h-8 rounded cursor-pointer" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                     <label className="text-xs font-bold w-24">{subtitleStyle.borderStyle === 1 ? 'สีตีเส้นขอบ (Outline):' : 'สีกล่องทึบ (Box):'}</label>
                     <input type="color" value={subtitleStyle.outlineColor} onChange={e => setSubtitleStyle({...subtitleStyle, outlineColor: e.target.value})} className="w-8 h-8 rounded cursor-pointer" />
                     
                     {subtitleStyle.borderStyle === 1 && (
                        <>
                           <div className="w-px h-6 bg-gray-300 mx-2"></div>
                           <label className="text-xs font-bold whitespace-nowrap">ความหนาขอบ:</label>
                           <input type="range" min="0" max="10" step="0.5" value={subtitleStyle.outlineThickness} onChange={e => setSubtitleStyle({...subtitleStyle, outlineThickness: Number(e.target.value)})} className="w-20" />
                           
                           <div className="w-px h-6 bg-gray-300 mx-2"></div>
                           <label className="text-xs font-bold whitespace-nowrap">สีตกเงาบรรทัด:</label>
                           <input type="color" value={subtitleStyle.shadowColor || '#000000'} onChange={e => setSubtitleStyle({...subtitleStyle, shadowColor: e.target.value})} className="w-8 h-8 rounded cursor-pointer" />
                           <label className="text-xs font-bold whitespace-nowrap ml-2">ระยะเงา:</label>
                           <input type="range" min="0" max="10" step="1" value={subtitleStyle.shadowThickness || 0} onChange={e => setSubtitleStyle({...subtitleStyle, shadowThickness: Number(e.target.value)})} className="w-20" />
                        </>
                     )}
                  </div>

                  <div className="ml-auto w-1/3 min-h-[50px] flex items-center justify-center bg-gray-400 dark:bg-gray-800 rounded p-2 overflow-hidden relative">
                       <span style={{
                          fontFamily: subtitleStyle.fontName && subtitleStyle.fontName !== 'Arial' ? `"${subtitleStyle.fontName.replace(/\.(ttf|otf)/i, '')}", Arial` : 'Arial',
                          fontSize: `${Math.max(12, (subtitleStyle.fontSize || 24) * 0.7)}px`, // scaled for preview
                          color: subtitleStyle.primaryColor || '#ffffff',
                          WebkitTextStroke: subtitleStyle.borderStyle === 1 && subtitleStyle.outlineThickness > 0 ? `${subtitleStyle.outlineThickness}px ${subtitleStyle.outlineColor}` : 'none',
                          paintOrder: 'stroke fill',
                          filter: subtitleStyle.borderStyle === 1 && subtitleStyle.shadowThickness > 0 ? `drop-shadow(${subtitleStyle.shadowThickness}px ${subtitleStyle.shadowThickness}px 0px ${subtitleStyle.shadowColor || '#000000'})` : 'none',
                          backgroundColor: subtitleStyle.borderStyle === 3 ? (subtitleStyle.outlineColor || '#000000') : 'transparent',
                          padding: subtitleStyle.borderStyle === 3 ? '2px 8px' : '0',
                          borderRadius: subtitleStyle.borderStyle === 3 ? '6px' : '0',
                          fontWeight: 'bold',
                       }}>
                          ตัวอย่างซับไตเติ้ล (Preview)
                       </span>
                  </div>
               </div>
            </div>
         )}
      </div>
      
      {/* 2. BLUEPRINT TEMPLATE AREA */}
      <div className="bg-[var(--bg-card)] border-2 border-dashed border-blue-500/50 rounded-2xl p-6 shadow-sm relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 pb-4 border-b border-[var(--border-color)]">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <span>🏗️</span> อู่ต่อเรือแม่แบบ (Master Blueprint)
            </h3>
            <p className="text-sm opacity-70 mt-1">จัดเรียงโครงสร้างที่นี่ แล้วนำไปปั๊มเป็นแถวใช้งานจริงด้านล่าง</p>
          </div>
          
          <div className="flex bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-200 dark:border-blue-800 gap-3 items-end">
            <div>
              <label className="text-xs font-bold text-blue-800 dark:text-blue-400 mb-1 block">โควต้ารวม (คลิป)</label>
              <NumInput min={1} max={50} value={bulkCount} onChange={setBulkCount} className="w-20 px-3 py-2 text-sm rounded bg-white dark:bg-black border border-blue-200 focus:outline-none"/>
            </div>
            <button onClick={handleBulkGenerateTimelines} className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-sm rounded transition-all shadow-md">
               🚀 ปั๊มชิ้นงาน {bulkCount} คลิป
            </button>
          </div>
        </div>

        {/* Template Render */}
        <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex gap-4 min-w-max items-stretch opacity-95">
          {templateScenes.map((scene, index) => (
            <React.Fragment key={scene.id}>
              <div 
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className={`w-[260px] shrink-0 border-2 rounded-xl p-3 flex flex-col relative transition-all cursor-move hover:shadow-lg ${
                  draggedTemplateIdx === index ? 'opacity-50 border-dashed scale-95' : ''
                } ${colorMap[scene.color] || colorMap.purple}`}
              >
                <div className="absolute -top-3 right-2 flex bg-white dark:bg-gray-800 rounded shadow border text-[10px] z-10 overflow-hidden">
                  <button onClick={() => moveTemplate(index, -1)} disabled={index===0} className="px-2 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30">⬅️</button>
                  <div className="px-2 py-0.5 border-l border-r hover:bg-gray-100 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing text-gray-500" title="กดค้างเพื่อลาก">⋮⋮</div>
                  <button onClick={() => moveTemplate(index, 1)} disabled={index===templateScenes.length-1} className="px-2 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 border-r disabled:opacity-30">➡️</button>
                  <button onClick={() => removeTemplate(scene.id)} className="px-2 py-0.5 hover:bg-red-50 text-red-500 font-bold">✕</button>
                </div>
                <div className="font-bold text-sm mb-2 mt-1 py-1 px-2 bg-black/10 dark:bg-white/10 rounded inline-block w-fit text-center">
                   กล่องที่ {index+1}
                </div>
                <textarea 
                  value={scene.script} onChange={(e) => updateTemplate(scene.id, { script: e.target.value })}
                  placeholder="บทต้นแบบ (ตั้งให้ว่างก็ได้).." 
                  className="w-full text-xs p-2 h-16 rounded bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 resize-none outline-none focus:border-blue-400"
                />
                <div className="mt-2 text-[10px] bg-white/30 dark:bg-black/30 p-2 rounded flex flex-col gap-1 border border-black/5 dark:border-white/5">
                   <select 
                     value={scene.mediaMode || (scene.type === 'image' ? 'generate' : (scene.type === 'video' ? 'stock' : 'manual'))} 
                     onChange={e=>updateTemplate(scene.id, {mediaMode:e.target.value as 'generate'|'stock'|'manual'})} 
                     className="p-1 rounded bg-white/50 dark:bg-black/50 w-full outline-none"
                   >
                     <option value="generate">🎨 วาดภาพ AI (Gen)</option>
                     <option value="stock">🔀 สุ่มคลิปวิดีโอ (Stock)</option>
                     <option value="manual">📁 แนบลิงก์เอง (Manual)</option>
                   </select>

                   {(scene.mediaMode === 'generate' || (!scene.mediaMode && scene.type === 'image')) && (
                      <select value={scene.artStyle || 'cinematic'} onChange={e=>updateTemplate(scene.id, {artStyle:e.target.value})} className="p-1 rounded bg-white/50 dark:bg-black/50 w-full outline-none">
                        <option value="cinematic">🎬 ภาพสมจริง</option>
                        <option value="flat">🎨 การ์ตูน 2D</option>
                        <option value="3d">🗿 3D Pixar</option>
                      </select>
                   )}
                   <select 
                      value={scene.avatarCharacter || ''} 
                      onChange={e=>updateTemplate(scene.id, {avatarCharacter:e.target.value})} 
                      className="p-1 rounded bg-white/50 dark:bg-black/50 w-full outline-none mt-1 text-emerald-700 dark:text-emerald-400 font-bold"
                   >
                     <option value="">🚫 ไม่ใช้นักพากย์ (ซ่อน Avatar)</option>
                     {avatarList.map(avatar => <option key={avatar.name} value={avatar.name}>👨‍🎨 {avatar.name}</option>)}
                   </select>
                </div>
              </div>
              {index < templateScenes.length - 1 && <div className="flex flex-col justify-center px-0 text-xl opacity-30 text-right">➡️</div>}
            </React.Fragment>
          ))}
          <div className="w-[260px] shrink-0 border-2 border-dashed border-gray-400 bg-gray-50/50 dark:bg-gray-800/20 rounded-xl p-3 flex flex-col justify-center gap-2">
            <button onClick={addTemplate} className="w-full py-4 bg-indigo-100 text-indigo-700 text-sm font-bold rounded-lg transition-colors border border-indigo-200 shadow-sm hover:scale-[1.02]">➕ เพิ่มกล่องใหม่</button>
          </div>
          </div>
        </div>
      </div>

      {/* 2. GENERATED TIMELINES */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm">
        
        {/* Bulk Audio Setup Area */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b border-[var(--border-color)] pb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <span>🎬</span> สายพานการผลิต (Timelines)
            <span className="text-sm bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">{timelines.length} แถว</span>
          </h3>
          <div className="flex flex-wrap items-center gap-3 bg-[var(--bg-main)] p-2 rounded-lg border border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">🔑 Kie Voice:</span>
              <select value={selectedKeyId} onChange={(e) => setSelectedKeyId(e.target.value)} className="text-xs px-2 py-1 rounded border border-[var(--border-color)] bg-transparent">
                <option value="" disabled>-- บัญชี --</option>
                {apiKeys.map((k: any) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
              <select value={voiceModel} onChange={(e) => setVoiceModel(e.target.value)} className="text-xs px-2 py-1 rounded border border-[var(--border-color)] bg-transparent">
                <optgroup label="🆓 เสียงฟรี (พลัง MacOS)">
                  <option value="mac_Kanya">🍎 กันยา Kanya (หญิง ธรรมชาติ)</option>
                  <option value="mac_Narisa">🍎 ริสา Narisa (หญิง ใสๆ - ต้องโหลดเพิ่ม)</option>
                  <option value="mac_Nirut">🍎 นิรุตต์ Nirut (ชาย หล่อเข้ม - ต้องโหลดเพิ่ม)</option>
                </optgroup>
                <optgroup label="⚡ เสียงพรีเมียม (Text-to-Dialogue-v3)">
                  <option value="DGzg6RaUqxGRTHSBjfgF">🎮 Brock (ชาย พากย์เกม ดุดัน)</option>
                  <option value="KTPVrSVAEUSJRClDzBw7">🎮 Bob (ชาย อบอุ่น คาวบอย)</option>
                  <option value="yjJ45q8TVCrtMhEKurxY">🔬 Dr.von (ชาย นักวิทยาศาสตร์ เพี้ยนๆ)</option>
                  <option value="EkK5I93UQWFDigLMpZcX">👨 James (ชาย ดุดัน เข้มๆ)</option>
                  <option value="B8gJV1IhpuegLxdpXFOE">🌸 Kuon (หญิง ร่าเริง สายอนิเมะ)</option>
                  <option value="P1bg08DkjqiVEzOn76yG">👨 Viraj (ชาย แหบเสน่ห์)</option>
                  <option value="NOpBlnGInO9m6vDvFkFC">🎧 Spuds Oxley (ชาย เสียงผู้รู้ดูแพง)</option>
                </optgroup>
              </select>

              {!voiceModel.startsWith('mac_') && (
                <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded border border-black/10 dark:border-white/10" title="Stability: 0 = อารมณ์พุ่งพล่าน / 1 = นิ่งสม่ำเสมอ">
                   <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Stability:</span>
                   <span className="text-xs text-blue-600 dark:text-blue-400 font-mono w-4">{voiceStability.toFixed(1)}</span>
                   <input type="range" min="0" max="1" step="0.5" value={voiceStability} onChange={e => setVoiceStability(Number(e.target.value))} className="w-12 h-1 bg-blue-200 rounded-lg appearance-none cursor-pointer" />
                </div>
              )}
            </div>
          </div>
        </div>

        {timelines.length === 0 ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400 border border-dashed border-[var(--border-color)] rounded-xl">
             <div className="text-4xl mb-3">🛠️</div>
             รอคุณกด "ปั๊มชิ้นงาน" จากหน้าต่างด้านบนสุดครับ
          </div>
        ) : (
          <div className="space-y-6">
            {timelines.map((timeline, tIndex) => (
              <div key={timeline.id} className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
                {/* Timeline Banner */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-[var(--bg-card)] border-b border-[var(--border-color)] gap-3">
                  <div className="flex items-center gap-3 px-4 py-3 flex-1 border-r border-[var(--border-color)] h-full">
                    <span className="font-black text-gray-400 pt-1">#{tIndex + 1}</span>
                    <input 
                      type="text" 
                      value={timeline.topic} 
                      onChange={e => updateTimelineTopic(timeline.id, e.target.value)}
                      placeholder='พิมพ์หัวข้อ (เช่น "วิธีเก็บเงินแสนแรก") เพื่อให้ AI ช่วยร่างคริปต์...'
                      className="flex-1 bg-transparent px-2 py-1 text-sm font-semibold border-b border-transparent focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 shrink-0">
                    <button 
                      onClick={() => handleSaveProjectTestSubset(timeline.id)}
                      className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded text-xs font-bold flex items-center gap-1 shadow-sm"
                    >
                      🎬 เรนเดอร์ย่อย
                    </button>
                    <button 
                      onClick={() => handleGenerateRowScript(timeline.id)}
                      disabled={timeline.isGeneratingScript}
                      className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white rounded text-xs font-bold flex items-center gap-1 shadow-sm disabled:opacity-50"
                    >
                      {timeline.isGeneratingScript ? '⏳ กำลังแต่งสคริปต์...' : '✨ ทุบสคริปต์ด่วน (AI)'}
                    </button>
                    <button 
                      onClick={() => setExpandedSubtitleId(expandedSubtitleId === timeline.id ? null : timeline.id)}
                      className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded text-xs font-bold flex items-center gap-1 shadow-sm"
                    >
                      🔤 จัดการซับไตเติ้ล
                    </button>
                    <div className="w-px h-6 bg-[var(--border-color)] mx-1"></div>
                    <button onClick={() => toggleTimeline(timeline.id)} className="px-2 py-1.5 bg-white/10 hover:bg-black/10 rounded text-xs transition-colors">
                      {timeline.isExpanded ? '🔽 พับเก็บ' : '▶️ เปิดดู'}
                    </button>
                    <button onClick={() => deleteTimeline(timeline.id)} className="px-2 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded text-xs transition-colors font-bold ml-1">
                      ✕
                    </button>
                  </div>
                </div>

                {expandedSubtitleId === timeline.id && (
                  <div className="bg-gray-50 dark:bg-black/50 p-4 border-b border-[var(--border-color)] transition-all">
                    <div className="flex gap-4">
                      <div className="flex flex-col gap-2 w-1/3">
                         <h4 className="font-bold text-sm text-orange-600 dark:text-orange-400">📝 ระบบสร้างซับไตเติ้ลจาก Script</h4>
                         <p className="text-[10px] opacity-70">
                           คำนวณเวลาและแปลงข้อความจาก 'บทพูดจริง (Script)' ในแต่ละฉากเป็น SRT อัตโนมัติ แม่นยำ 100% ตามบทที่คุณเขียน!
                         </p>
                         <button 
                           onClick={() => handleGenerateSubtitles(timeline.id)}
                           disabled={timeline.isGeneratingSubtitles}
                           className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded text-xs font-bold w-full disabled:opacity-50"
                         >
                           {timeline.isGeneratingSubtitles ? '⏳ กำลังสร้างซับ...' : '1. สร้างซับใหม่จาก Script'}
                         </button>
                         
                         <div className="w-full h-px bg-[var(--border-color)] my-2"></div>

                         <h4 className="font-bold text-sm text-purple-600 dark:text-purple-400">✨ ช่วยเกลาคำ (AI Edit)</h4>
                         <p className="text-[10px] opacity-70">
                           ให้ OpenRouter ตรวจสอบการสะกด เว้นวรรคคำ ตัดบรรทัดใหม่ไม่ให้ยาวเกินจอ โดยรักษา Format เวลาไว้
                         </p>
                         <button 
                           onClick={() => handleRefineSubtitles(timeline.id)}
                           disabled={timeline.isGeneratingSubtitles || !timeline.subtitles}
                           className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded text-xs font-bold w-full disabled:opacity-50"
                         >
                           2. เกลาซับไตเติ้ลให้สวย
                         </button>
                      </div>
                      <div className="flex-1">
                        <textarea
                          className="w-full h-48 bg-white dark:bg-gray-900 border border-[var(--border-color)] rounded p-3 text-[11px] font-mono leading-relaxed outline-none focus:border-orange-500"
                          placeholder="ยังไม่มีซับไตเติ้ล... 
1. กดปุ่ม '1. สร้างซับใหม่จาก Script' ทางซ้ายมือ เพื่อจับเวลาประโยคให้อัตโนมัติ
2. สามารถแก้ไขข้อความด้วยตัวเอง หรือนำไปให้ AI เกลาด้วยปุ่มสเต็ป 2"
                          value={timeline.subtitles || ''}
                          onChange={(e) => updateTimelineSubtitles(timeline.id, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Timeline Row Content Area */}
                {timeline.isExpanded && (
                  <div className="w-full overflow-x-auto custom-scrollbar p-5">
                    <div className="flex gap-4 min-w-max items-stretch pb-2">
                      {timeline.scenes.map((scene, index) => {
                      const isGeneratingThis = isGenerating && generatingSceneId === `${timeline.id}-${scene.id}`;

                      return (
                        <div key={scene.id} className={`w-[300px] shrink-0 border-2 rounded-xl p-4 flex flex-col relative transition-all bg-[var(--bg-card)] ${colorMap[scene.color] || colorMap.purple}`}>
                           
                           <div className="flex justify-between items-start mb-2">
                             <h4 className="font-bold text-sm">{scene.title}</h4>
                             <div className="flex items-center gap-2">
                               <label className="flex items-center gap-1 text-[10px] cursor-pointer" title="ติ๊กเพื่อเลือกเฉพาะฉากที่จะเรนเดอร์ทดสอบ">
                                  <input type="checkbox" checked={scene.isSelectedForTest || false} onChange={e => updateTimelineSceneProps(timeline.id, scene.id, { isSelectedForTest: e.target.checked })} className="accent-emerald-500" />
                                  ทดสอบ
                               </label>
                               <span className="text-[10px] bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm">ฉาก {index + 1}</span>
                             </div>
                           </div>

                           <div className="flex-1 flex flex-col gap-2 mt-2">
                              <label className="text-xs font-semibold flex justify-between">
                                  <span>บทพูดจริง (Script)</span>
                                  <span className="text-[10px] font-normal opacity-70">{scene.script.length} chars</span>
                              </label>
                              <textarea 
                                value={scene.script}
                                onChange={(e) => updateTimelineSceneProps(timeline.id, scene.id, { script: e.target.value })}
                                className="w-full h-24 px-3 py-2 text-xs rounded-lg bg-white/70 dark:bg-black/20 border border-black/10 dark:border-white/10 resize-none outline-none focus:border-blue-400 transition-colors"
                              />

                              {/* Media Control Switcher */}
                              <div className="mt-2 flex flex-col gap-1 p-2 bg-black/5 dark:bg-white/5 rounded border border-black/10 dark:border-white/10">
                                <label className="text-[10px] font-bold text-gray-700 dark:text-gray-300">ควบคุมสื่อประกอบฉาก (Media)</label>
                                <select 
                                  value={scene.mediaMode || (scene.type === 'image' ? 'generate' : (scene.type === 'video' ? 'stock' : 'manual'))}
                                  onChange={e => updateTimelineSceneProps(timeline.id, scene.id, { mediaMode: e.target.value as 'generate' | 'stock' | 'manual' })}
                                  className="w-full px-2 py-1.5 text-[10px] rounded bg-white dark:bg-black border border-gray-300 dark:border-gray-700 outline-none"
                                >
                                  <option value="generate">🎨 โหมดวาดภาพ AI อัตโนมัติ (Gen)</option>
                                  <option value="stock">🔀 โหมดสุ่มคลิปจากคลังวิดีโอ (Stock)</option>
                                  <option value="manual">📁 ระบุลิงก์รูป/วิดีโอภายนอก (Manual)</option>
                                </select>

                                {/* Target AI Box */}
                                {(scene.mediaMode === 'generate' || (!scene.mediaMode && scene.type === 'image')) && (
                                  <div className="mt-1 flex flex-col gap-1">
                                    <label className="text-[10px] font-semibold flex justify-between text-amber-700 dark:text-amber-400">
                                       <span>รอคิวสร้างภาพ (Image Prompt)</span>
                                       <select 
                                         value={scene.artStyle || 'cinematic'}
                                         onChange={e => updateTimelineSceneProps(timeline.id, scene.id, { artStyle: e.target.value })}
                                         className="w-20 px-1 py-0.5 text-[9px] rounded bg-white/50 dark:bg-black/50 border border-amber-200"
                                       >
                                         <option value="cinematic">ภาพสมจริง</option>
                                         <option value="flat">การ์ตูน 2D</option>
                                         <option value="3d">3D Pixar</option>
                                       </select>
                                    </label>
                                    <textarea 
                                      value={scene.imagePrompt || ''}
                                      onChange={(e) => updateTimelineSceneProps(timeline.id, scene.id, { imagePrompt: e.target.value })}
                                      className="w-full h-12 px-2 py-1.5 text-[10px] rounded bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 resize-none outline-none focus:border-amber-400 italic text-amber-900 dark:text-amber-200"
                                      placeholder="English prompt waits here..."
                                    />
                                  </div>
                                )}

                                {/* Target Video Stock Box */}
                                {(scene.mediaMode === 'stock' || (!scene.mediaMode && scene.type === 'video')) && (
                                  <div className="mt-1 flex flex-col gap-1">
                                    <label className="text-[10px] font-semibold flex justify-between text-blue-700 dark:text-blue-400">
                                       <span>โฟลเดอร์ Stock Video</span>
                                    </label>
                                    <select
                                      value={scene.videoStockFolder || 'ความสำเร็จ'}
                                      onChange={e => updateTimelineSceneProps(timeline.id, scene.id, { videoStockFolder: e.target.value })}
                                      className="w-full px-2 py-1.5 text-[10px] rounded bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 outline-none focus:border-blue-400"
                                    >
                                      {keywords.map(kw => (
                                        <option key={kw.id} value={kw.folderName}>{kw.name}</option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => handlePickRandomVideo(timeline.id, scene.id, scene.videoStockFolder || 'ความสำเร็จ')}
                                      className="w-full mt-1 py-1 text-[10px] bg-blue-500 hover:bg-blue-600 text-white rounded font-bold transition-all shadow-sm"
                                    >
                                      🔀 สุ่มวิิดีโอจากโฟลเดอร์นี้
                                    </button>
                                  </div>
                                )}

                                {/* Target Manual Input Box */}
                                {(scene.mediaMode === 'manual' || (!scene.mediaMode && scene.type !== 'image' && scene.type !== 'video')) && (
                                  <div className="mt-1 flex flex-col gap-1">
                                    <label className="text-[10px] font-semibold flex justify-between text-emerald-700 dark:text-emerald-400">พาทไฟล์/ลิงก์รูปหรือวิดีโอ (URL/Path)</label>
                                    <input 
                                      type="text" 
                                      value={scene.imageUrl || ''}
                                      onChange={(e) => updateTimelineSceneProps(timeline.id, scene.id, { imageUrl: e.target.value })}
                                      placeholder="https://... หรือ /Image_stock/file.jpg"
                                      className="w-full px-2 py-1.5 text-[10px] rounded bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 outline-none focus:border-emerald-400"
                                    />
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-2 w-full mt-2">
                                <button 
                                  onClick={() => handleGenerateVoice(timeline.id, scene.id, scene.script)}
                                  disabled={isGeneratingThis || !scene.script.trim()}
                                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all text-white shadow-sm ${
                                    isGeneratingThis ? 'bg-gray-400 animate-pulse' : 'bg-blue-500 hover:bg-blue-600 hover:scale-[1.02]'
                                  }`}
                                >
                                  {isGeneratingThis ? '⏳ สร้างซาวด์' : '🎙️ อัดเสียง'}
                                </button>
                                
                                {(scene.mediaMode === 'generate' || (!scene.mediaMode && scene.type === 'image')) && (
                                  <button 
                                    onClick={() => handleGenerateImage(timeline.id, scene.id, scene.imagePrompt || '')}
                                    disabled={generatingSceneId === `${timeline.id}-${scene.id}-image` || !scene.imagePrompt?.trim()}
                                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all text-white shadow-sm ${
                                      generatingSceneId === `${timeline.id}-${scene.id}-image` ? 'bg-gray-400 animate-pulse' : 'bg-orange-500 hover:bg-orange-600 hover:scale-[1.02]'
                                    }`}
                                  >
                                    {generatingSceneId === `${timeline.id}-${scene.id}-image` ? '⏳ วาดภาพ...' : '🎨 วาดภาพ AI'}
                                  </button>
                                )}
                              </div>

                              {scene.duration && (
                                <div className="mt-2 p-2 bg-white/40 dark:bg-black/30 rounded-lg border border-emerald-500/30 shadow-inner">
                                  <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">✅ เสียงพร้อม</span>
                                    <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded shadow-sm">⏱️ {scene.duration} วิ</span>
                                  </div>
                                  {scene.audioUrl && <audio controls className="w-full h-6 object-cover rounded-md" src={scene.audioUrl} />}
                                </div>
                              )}

                              {scene.imageUrl && (
                                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-500/30 shadow-inner">
                                  <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">✅ ภาพพร้อม</span>
                                    <div className="flex gap-1 items-center">
                                      <select 
                                        value={scene.animationIntensity || 2}
                                        onChange={(e) => updateTimelineSceneProps(timeline.id, scene.id, { animationIntensity: Number(e.target.value) })}
                                        className="text-[10px] px-1 py-0.5 rounded border border-amber-200 bg-white dark:bg-black text-amber-800 dark:text-amber-200 focus:outline-none"
                                        title="ระดับความแรงของเอฟเฟค"
                                      >
                                        <option value={1}>พลัง: เบา</option>
                                        <option value={2}>พลัง: กลาง</option>
                                        <option value={3}>พลัง: แรง</option>
                                      </select>
                                      <select 
                                        value={scene.animation || 'none'}
                                        onChange={(e) => updateTimelineSceneProps(timeline.id, scene.id, { animation: e.target.value })}
                                        className="text-[10px] px-1 py-0.5 rounded border border-amber-200 bg-white dark:bg-black text-amber-800 dark:text-amber-200 focus:outline-none"
                                      >
                                        <option value="none">FX: ไม่มี</option>
                                        <option value="zoom-in">FX: ซูมเข้า</option>
                                        <option value="zoom-out">FX: ซูมออก</option>
                                        <option value="pan-left">FX: เลื่อนซ้าย</option>
                                        <option value="pan-right">FX: เลื่อนขวา</option>
                                        <option value="pan-up">FX: เลื่อนขึ้น</option>
                                        <option value="pan-down">FX: เลื่อนลง</option>
                                        <option value="rotate-left">FX: เอียงซ้าย</option>
                                        <option value="rotate-right">FX: เอียงขวา</option>
                                        <option value="ken-burns-1">FX: Ken Burns 1</option>
                                        <option value="ken-burns-2">FX: Ken Burns 2</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className={`overflow-hidden rounded border border-black/10 w-full relative bg-black transition-all ${expandedPreviewId === scene.id ? 'fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4' : 'h-24'}`}>
                                    <div className={`${expandedPreviewId === scene.id ? 'w-full max-w-sm aspect-[9/16] relative shadow-2xl rounded-2xl overflow-hidden border border-white/20' : 'w-full h-full relative'}`}>
                                      {scene.imageUrl && (scene.imageUrl.endsWith('.mp4') || scene.imageUrl.endsWith('.webm') || scene.imageUrl.endsWith('.mov')) ? (
                                        <video
                                          src={scene.imageUrl}
                                          autoPlay
                                          loop
                                          muted
                                          playsInline
                                          className="w-full h-full object-cover origin-center"
                                          style={getAnimationStyles(scene, playingPreviewId === scene.id)}
                                        />
                                      ) : (
                                        <img 
                                          src={scene.imageUrl} 
                                          alt="AI Scene" 
                                          className="w-full h-full object-cover origin-center" 
                                          style={getAnimationStyles(scene, playingPreviewId === scene.id)}
                                        />
                                      )}

                                      {/* Subtitle UI Preview */}
                                      {scene.script && subtitleStyle && (
                                        <div 
                                          className={`absolute w-[90%] left-[5%] flex items-end justify-center text-center select-none`}
                                          style={{
                                            bottom: `${(subtitleStyle.marginV || 30) * (expandedPreviewId === scene.id ? 1 : 0.4)}px`,
                                            zIndex: subtitleStyle.zIndex || 20,
                                            cursor: 'ns-resize',
                                            transition: draggingSubtitleInfo ? 'none' : 'bottom 0.1s ease-out'
                                          }}
                                          onMouseDown={(e) => {
                                            setDraggingSubtitleInfo({
                                              startY: e.clientY,
                                              initialMarginV: subtitleStyle.marginV || 30
                                            });
                                            e.preventDefault();
                                            e.stopPropagation();
                                          }}
                                        >
                                          <span style={{
                                            fontFamily: subtitleStyle.fontName && subtitleStyle.fontName !== 'Arial' ? `"${subtitleStyle.fontName.replace(/\.(ttf|otf)/i, '')}", Arial` : 'Arial',
                                            fontSize: `${Math.max(10, (subtitleStyle.fontSize || 24) * (expandedPreviewId === scene.id ? 0.8 : 0.35))}px`,
                                            color: subtitleStyle.primaryColor || '#ffffff',
                                            WebkitTextStroke: subtitleStyle.borderStyle === 1 && subtitleStyle.outlineThickness > 0 ? `${subtitleStyle.outlineThickness * (expandedPreviewId === scene.id ? 1 : 0.4)}px ${subtitleStyle.outlineColor}` : 'none',
                                            paintOrder: 'stroke fill',
                                            filter: subtitleStyle.borderStyle === 1 && subtitleStyle.shadowThickness > 0 ? `drop-shadow(${subtitleStyle.shadowThickness * (expandedPreviewId === scene.id ? 1 : 0.5)}px ${subtitleStyle.shadowThickness * (expandedPreviewId === scene.id ? 1 : 0.5)}px 0px ${subtitleStyle.shadowColor || '#000000'})` : 'none',
                                            backgroundColor: subtitleStyle.borderStyle === 3 ? (subtitleStyle.outlineColor || '#000000') : 'transparent',
                                            padding: subtitleStyle.borderStyle === 3 ? '2px 6px' : '0',
                                            borderRadius: subtitleStyle.borderStyle === 3 ? '4px' : '0',
                                            fontWeight: 'bold',
                                            lineHeight: '1.4',
                                            pointerEvents: 'none' // Let the container handle the drag events.
                                          }}>
                                            {scene.script}
                                          </span>
                                        </div>
                                      )}

                                      {/* Avatar UI Preview */}
                                      {scene.avatarCharacter && (() => {
                                        let left = undefined, right = undefined, bottom = undefined, marginLeft = undefined;
                                        
                                        // Legacy position map
                                        if (!scene.avatarPos) {
                                           if (scene.avatarPosition === 'bottom-left') { left = '4%'; bottom = '6%'; }
                                           else if (scene.avatarPosition === 'bottom-right') { right = '4%'; bottom = '6%'; }
                                           else { left = '0'; right = '0'; marginLeft = 'auto'; bottom = '6%'; }
                                        }

                                        return (
                                          <div 
                                            className={`absolute z-30 drop-shadow-2xl flex items-end justify-center ${draggingAvatarInfo?.sceneId === scene.id ? '' : 'transition-all duration-300'}`}
                                            onMouseDown={(e) => {
                                              const containerEl = e.currentTarget.parentElement;
                                              const containerRect = containerEl?.getBoundingClientRect();
                                              const pos = scene.avatarPos || { 
                                                x: 10, 
                                                y: 60, scale: 0.3 
                                              };
                                              setDraggingAvatarInfo({
                                                timelineId: timeline.id,
                                                sceneId: scene.id,
                                                startX: e.clientX,
                                                startY: e.clientY,
                                                initialX: pos.x,
                                                initialY: pos.y
                                              });
                                              e.preventDefault();
                                              e.stopPropagation();
                                            }}
                                            onWheel={(e) => {
                                              const pos = scene.avatarPos || { 
                                                x: 10, 
                                                y: 60, scale: 0.3 
                                              };
                                              let newScale = (pos.scale || 1) + (e.deltaY > 0 ? -0.05 : 0.05);
                                              newScale = Math.max(0.15, Math.min(3, newScale));
                                              updateTimelineSceneProps(timeline.id, scene.id, { 
                                                avatarPos: { ...pos, scale: newScale } 
                                              });
                                              e.preventDefault();
                                              e.stopPropagation();
                                            }}
                                            style={{
                                              left: `${(scene.avatarPos?.x ?? 10)}%`,
                                              top: `${(scene.avatarPos?.y ?? 60)}%`,
                                              width: `${Math.round(83 * (scene.avatarPos?.scale || 0.3))}%`,
                                              cursor: 'move',
                                              pointerEvents: 'auto',
                                              zIndex: 30
                                            }}
                                          >
                                            {(() => {
                                               const charData = avatarList.find(a => a.name === scene.avatarCharacter);
                                               if (!charData) return null;
                                               const animConfig = charData.animations?.[scene.avatarAnimation || 'talking'] || ['neutral', 'talking'];
                                               const currentExpName = playingPreviewId === scene.id 
                                                   ? (animConfig[avatarFrameIdx] || animConfig[0]) 
                                                   : animConfig[0];
                                               let currentFrame = charData.avatars.find((a: any) => a.name === currentExpName);
                                               if (!currentFrame) currentFrame = charData.avatars.find((a: any) => a.name === 'neutral') || charData.avatars[0];
                                               return currentFrame ? <img src={currentFrame.url} className="w-full object-contain pointer-events-none" style={{filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.7))'}} /> : null;
                                            })()}
                                          </div>
                                        );
                                      })()}
                                      {expandedPreviewId !== scene.id ? (
                                        <button onClick={() => setExpandedPreviewId(scene.id)} className="absolute top-1 left-1 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded backdrop-blur-sm z-10 hover:bg-black/90">
                                            🔍 ขยาย
                                        </button>
                                      ) : (
                                        <button onClick={() => setExpandedPreviewId(null)} className="absolute top-4 right-4 text-xs font-bold bg-white/20 text-white backdrop-blur-md px-3 py-1.5 rounded-full z-10 hover:bg-white/40 shadow-lg border border-white/30">
                                            ✕ ย่อกลับ
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {(scene.audioUrl || scene.imageUrl) && (
                                <button 
                                  onClick={() => handleTogglePreview(scene.id, scene.audioUrl, scene.duration)}
                                  className={`w-full py-2 mt-2 text-xs font-bold rounded-lg transition-all shadow-sm flex items-center justify-center gap-1 ${
                                    playingPreviewId === scene.id ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600'
                                  }`}
                                >
                                  {playingPreviewId === scene.id ? '⏹️ หยุดเล่น' : '▶️ ลองเล่นพรีวิวฉาก'}
                                </button>
                              )}

                              {/* Transitions Box */}
                              <div className="mt-3 p-2 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg border border-indigo-500/20 shadow-sm flex flex-col gap-2">
                                <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400">🔗 การเปลี่ยนฉาก (Transition)</div>
                                <select
                                  value={scene.transitionType || 'none'}
                                  onChange={e => updateTimelineSceneProps(timeline.id, scene.id, { transitionType: e.target.value })}
                                  className="w-full text-[10px] px-1 py-1 rounded border border-indigo-200 bg-white dark:bg-black focus:outline-none"
                                >
                                  <option value="none">ไม่มี (ตัดชน)</option>
                                  <option value="fade">ค่อยๆ เปลี่ยน (Fade)</option>
                                  <option value="slide-left">เลื่อนซ้าย (Slide Left)</option>
                                  <option value="slide-right">เลื่อนขวา (Slide Right)</option>
                                  <option value="zoom-in">ซูมเข้าลึก (Zoom In)</option>
                                  <option value="glitch">จอกระตุก (Glitch)</option>
                                </select>

                                  <select
                                    value={scene.transitionSoundUrl || ''}
                                    onChange={e => updateTimelineSceneProps(timeline.id, scene.id, { transitionSoundUrl: e.target.value })}
                                    className="w-full text-[10px] px-1 py-1 rounded border border-indigo-200 bg-white dark:bg-black focus:outline-none"
                                  >
                                    <option value="">🔇 ไม่มีเสียง SFX</option>
                                    <optgroup label="🌟 ยอดนิยม (สั้นๆ กระชับ)">
                                      {sfxList.filter(s => s.name.includes('whoosh') || s.name.includes('bell') || s.name.includes('click') || s.name.includes('glitch') || s.name.includes('paper-swipe'))
                                        .sort((a,b) => a.duration - b.duration)
                                        .map(sfx => (
                                        <option key={sfx.url} value={sfx.url}>
                                          {sfx.name.replace('.mp3','')} ({sfx.duration}s)
                                        </option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="📂 เสียงอื่นๆ ทั้งหมด">
                                      {sfxList.filter(s => !(s.name.includes('whoosh') || s.name.includes('bell') || s.name.includes('click') || s.name.includes('glitch') || s.name.includes('paper-swipe')))
                                        .sort((a,b) => a.duration - b.duration)
                                        .map(sfx => (
                                        <option key={sfx.url} value={sfx.url}>
                                          {sfx.name.replace('.mp3','')} ({sfx.duration}s)
                                        </option>
                                      ))}
                                    </optgroup>
                                  </select>
                              </div>

                              {/* Avatar Box */}
                              <div className="mt-3 p-2 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg border border-emerald-500/20 shadow-sm flex flex-col gap-2">
                                <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">👨‍🎨 นักพากย์ (Avatar Overlay)</div>
                                <select
                                  value={scene.avatarCharacter || ''}
                                  onChange={e => updateTimelineSceneProps(timeline.id, scene.id, { avatarCharacter: e.target.value })}
                                  className="w-full text-[10px] px-1 py-1 rounded border border-emerald-200 bg-white dark:bg-black focus:outline-none"
                                >
                                  <option value="">🚫 ไม่ใช้ตัวละคร</option>
                                  {avatarList.map(avatar => (
                                    <option key={avatar.name} value={avatar.name}>{avatar.name}</option>
                                  ))}
                                </select>
                                {scene.avatarCharacter && (
                                  <>
                                    <select
                                      value={scene.avatarAnimation || 'talking'}
                                      onChange={e => updateTimelineSceneProps(timeline.id, scene.id, { avatarAnimation: e.target.value })}
                                      className="w-full text-[10px] px-1 py-1 rounded border border-emerald-200 bg-white dark:bg-black focus:outline-none"
                                    >
                                      <option value="talking">🗣️ พูดคุยปกติ</option>
                                      <option value="laughing">😂 หัวเราะ</option>
                                      <option value="angry_talk">🤬 โวยวาย</option>
                                      <option value="crying">😭 ร้องไห้สะอื้น</option>
                                    </select>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => updateTimelineSceneProps(timeline.id, scene.id, { avatarPos: { x: 10, y: 60, scale: 0.3 } })}
                                        className="flex-1 text-[9px] py-1 rounded border border-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-200"
                                      >
                                        🔄 รีเซ็ตตำแหน่ง
                                      </button>
                                      <button
                                        onClick={() => {
                                          const pos = scene.avatarPos || { x: 10, y: 60, scale: 0.3 };
                                          updateTimelineSceneProps(timeline.id, scene.id, { avatarPos: { ...pos, scale: Math.max(0.1, pos.scale - 0.1) } });
                                        }}
                                        className="px-2 text-[9px] py-1 rounded border border-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-200"
                                      >
                                        ➖
                                      </button>
                                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center">{Math.round((scene.avatarPos?.scale || 0.3) * 100)}%</span>
                                      <button
                                        onClick={() => {
                                          const pos = scene.avatarPos || { x: 10, y: 60, scale: 0.3 };
                                          updateTimelineSceneProps(timeline.id, scene.id, { avatarPos: { ...pos, scale: Math.min(2, pos.scale + 0.1) } });
                                        }}
                                        className="px-2 text-[9px] py-1 rounded border border-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-200"
                                      >
                                        ➕
                                      </button>
                                    </div>
                                    <div className="text-[8px] text-emerald-600/60 dark:text-emerald-400/60 text-center">💡 ลากน้องในพรีวิวเพื่อจัดตำแหน่ง | ใช้ ➖➕ ย่อ/ขยาย</div>
                                  </>
                                )}
                              </div>
                           </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>

      {/* 3. TERMINAL LOGS AREA */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm mt-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <span>🖥️</span> Terminal Logs
          </h4>
          <button 
            onClick={() => setLogs([])}
            className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition"
          >
            ล้าง Log
          </button>
        </div>
        <div className="bg-[#1e1e1e] text-gray-300 p-4 rounded-xl font-mono text-xs h-40 overflow-y-auto shadow-inner border border-gray-800">
          {logs.length === 0 ? (
            <p className="text-gray-600 italic">...รอรับคำสั่ง...</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="mb-1">
                <span className="text-gray-500">[{log.time}]</span>{' '}
                <span className={
                  log.type === 'error' ? 'text-red-400 font-bold' : 
                  log.type === 'success' ? 'text-emerald-400 font-bold' : 'text-blue-300'
                }>
                  {log.type === 'error' ? '[ERROR]' : log.type === 'success' ? '[SUCCESS]' : '[INFO]'}
                </span>{' '}
                {log.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
