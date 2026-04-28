import React, { useState, useEffect } from 'react';
import { globalTaskStore } from '../../hooks/useBackgroundTasks';
const DEFAULT_AI_MODEL = "google/gemini-2.5-flash";

const BASE_SYSTEM_PROMPT = `You are an expert Content Creator and Viral Copywriter.

Task: You will be provided with a YouTube video transcript and its channel metadata.
Your job is to:
1. Write a highly engaging, viral social media post/article (บทความ) in Thai based on the video's content.
2. INVENT catchy Thai headlines (พาดหัวข่าว) that are eye-catching and viral.
3. Create an IMAGE-TO-IMAGE prompt that will be used with the YouTube thumbnail as input image.

IMPORTANT CONTEXT: The user will feed the YouTube THUMBNAIL image into an image-to-image AI (gpt-image-2). 
The prompt must instruct the AI to:
- KEEP the main person/character visible in the original thumbnail (this is critical for engagement)
- REMOVE all original text, captions, subtitles from the image
- REMOVE all channel logos and watermarks
- Add bold, colorful Thai text banners/ribbons with the headlines
- Make the overall design look like a viral Thai social media news banner

JSON Output Format:
{
  "article": "บทความภาษาไทยที่น่าสนใจ ใช้อีโมจิและโครงสร้างดึงดูดคนอ่าน",
  "thai_headlines": {
    "main_headline": "พาดหัวหลักภาษาไทยที่ AI คิดขึ้นมา",
    "sub_headline": "ข้อความรองที่ดึงดูด",
    "bottom_text": "ข้อความสรุปสั้นๆ ด้านล่าง"
  },
  "image_prompt": {
    "person_description": "อธิบายคนหลักในภาพ",
    "design_style": { "overall_theme": "ธีม", "color_scheme": { "primary": "#hex", "secondary": "#hex", "accent": "#hex" }, "background": "พื้นหลัง" },
    "layout": "เลย์เอาท์",
    "final_compiled_prompt": "(English image-to-image prompt. KEEP person, REMOVE text/logos, add Thai banner headlines.)"
  }
}

CRITICAL RULES:
1. Return ONLY valid JSON. No markdown formatting.
2. ALL string values MUST be in Thai (ภาษาไทย) EXCEPT for 'final_compiled_prompt' which MUST be in English.
3. In 'person_description': describe the main person/character visible in the thumbnail in detail (ภาษาไทย).
4. In 'final_compiled_prompt': MUST explicitly say to KEEP the person and REMOVE text/logos. This is an image-to-image prompt.
5. The 'thai_headlines' section provides the text the user will inject into the prompt or overlay manually.`;

// Build dynamic system prompt with optional template/style context
function buildSystemPrompt(imageStyle?: string, articleStyle?: string, headlineExamples?: string): string {
  let prompt = BASE_SYSTEM_PROMPT;
  if (imageStyle) prompt += '\n\nIMAGE STYLE REFERENCE (use this design style for the image prompt):\n' + imageStyle;
  if (articleStyle) prompt += '\n\nARTICLE WRITING STYLE (match this tone and structure):\n' + articleStyle;
  if (headlineExamples) prompt += '\n\nHEADLINE STYLE EXAMPLES (use similar phrasing and energy):\n' + headlineExamples;
  return prompt;
}

function safeJsonParse(text: string) {
  try {
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || '{}';
    return JSON.parse(jsonStr);
  } catch (e) {
    return {};
  }
}

interface ImageTemplate { id: string; name: string; thumbnail: string; analysis: string; }
interface ArticleTemplate { id: string; name: string; preview: string; analysis: string; }
interface HeadlinePreset { id: string; name: string; content: string; }
interface CompletedPost { id: string; videoTitle: string; channelName: string; article: string; headlines: string; imageUrl: string; dropboxUrl: string; createdAt: string; }

export function WebsitePostGeneratorTab() {
  const [websiteUrls, setWebsiteUrls] = useState('');
  const [aspectRatio, setAspectRatio] = useState('auto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<any>(null);
  const [selectedHeadlines, setSelectedHeadlines] = useState<string[]>([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // === Template System ===
  const [imageTemplates, setImageTemplates] = useState<ImageTemplate[]>([]);
  const [articleTemplates, setArticleTemplates] = useState<ArticleTemplate[]>([]);
  const [activeImageTemplateId, setActiveImageTemplateId] = useState('');
  const [activeArticleTemplateId, setActiveArticleTemplateId] = useState('');
  const [articleEditName, setArticleEditName] = useState('');
  const [articleEditContent, setArticleEditContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // === Style Folder System ===
  const [styleFolders, setStyleFolders] = useState<{name: string; fileCount: number}[]>([]);
  const [selectedStyleFolder, setSelectedStyleFolder] = useState('');
  const [newStyleFolderName, setNewStyleFolderName] = useState('');

  // === Logo ===
  const [logoBase64, setLogoBase64] = useState('');
  const [logoPosition, setLogoPosition] = useState('bottom-right');
  const [logoSize, setLogoSize] = useState('small');

  // === Headline Style Presets ===
  const [headlinePresets, setHeadlinePresets] = useState<HeadlinePreset[]>([]);
  const [activeHeadlinePresetId, setActiveHeadlinePresetId] = useState('');
  const [headlineEditName, setHeadlineEditName] = useState('');
  const [headlineEditContent, setHeadlineEditContent] = useState('');

  // === Completed Posts ===
  const [completedPosts, setCompletedPosts] = useState<CompletedPost[]>([]);

  // Load saved settings from localStorage
  useEffect(() => {
    try {
      const it = localStorage.getItem('web_image_templates');
      if (it) setImageTemplates(JSON.parse(it));
      const at = localStorage.getItem('web_article_templates');
      if (at) setArticleTemplates(JSON.parse(at));
      setActiveImageTemplateId(localStorage.getItem('web_active_img_tpl') || '');
      setActiveArticleTemplateId(localStorage.getItem('web_active_art_tpl') || '');
      setLogoBase64(localStorage.getItem('web_page_logo') || '');
      setLogoPosition(localStorage.getItem('web_logo_position') || 'bottom-right');
      setLogoSize(localStorage.getItem('web_logo_size') || 'small');
      const hp = localStorage.getItem('web_headline_presets');
      if (hp) setHeadlinePresets(JSON.parse(hp));
      setActiveHeadlinePresetId(localStorage.getItem('web_active_hl_preset') || '');
      const cp = localStorage.getItem('web_completed_posts');
      if (cp) setCompletedPosts(JSON.parse(cp));
    } catch(e) {}
    loadStyleFolders();
  }, []);

  const loadStyleFolders = async () => {
    try {
      const res = await fetch('/api/style-folders');
      const data = await res.json();
      if (data.success) setStyleFolders(data.folders);
    } catch(e) {}
  };

  const createStyleFolder = async () => {
    if (!newStyleFolderName.trim()) { alert('กรุณาใส่ชื่อ Folder'); return; }
    try {
      const res = await fetch('/api/style-folders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStyleFolderName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setNewStyleFolderName('');
        loadStyleFolders();
        setSelectedStyleFolder(data.name);
      } else alert(data.error);
    } catch(e: any) { alert(e.message); }
  };

  const openStyleFolder = async (folder: string) => {
    try {
      await fetch('/api/style-open-folder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder })
      });
    } catch(e: any) { alert(e.message); }
  };

  const analyzeFolderStyles = async () => {
    if (!selectedStyleFolder) { alert('กรุณาเลือก Folder'); return; }
    const apiKey = getOpenRouterKey();
    if (!apiKey) { setErrorMsg('กรุณาตั้งค่า OpenRouter API Key ก่อน'); return; }
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/style-files?folder=' + selectedStyleFolder);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to get files');
      const files = data.files;
      if (files.length === 0) throw new Error('ไม่พบรูปภาพใน Folder นี้');

      let updatedTemplates = [...imageTemplates];
      for (const file of files) {
        const tplName = file.name.replace(/\.[^.]+$/, '');
        if (updatedTemplates.some(t => t.name === tplName)) continue;

        const imgRes = await fetch(file.url);
        const blob = await imgRes.blob();
        const b64 = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });

        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: DEFAULT_AI_MODEL,
            messages: [
              { role: 'system', content: 'You are an AI analyst. Output JSON format exactly as follows: {"design_analysis": "...", "extracted_headlines": ["..."]}. For design_analysis, describe ONLY the design structure (layout, color scheme, typography style, banner/ribbon placement). For extracted_headlines, extract any prominent short headline text found in the image. Reply ONLY with valid JSON.' },
              { role: 'user', content: [{ type: 'image_url', image_url: { url: b64 } }, { type: 'text', text: 'Analyze design and extract text.' }] }
            ]
          })
        });
        const aiData = await resp.json();
        const contentText = aiData.choices?.[0]?.message?.content || '{}';
        
        let parsed = { design_analysis: 'Analysis failed', extracted_headlines: [] };
        try {
           const jsonStr = contentText.match(/\{[\s\S]*\}/)?.[0] || '{}';
           parsed = JSON.parse(jsonStr);
        } catch(e) {}
        
        const analysis = parsed.design_analysis || 'Analysis failed';
        const extractedHeadlines = Array.isArray(parsed.extracted_headlines) ? parsed.extracted_headlines : [];
        
        const tpl: ImageTemplate = { id: Date.now().toString() + Math.random(), name: tplName, thumbnail: b64, analysis };
        updatedTemplates.push(tpl);

        if (extractedHeadlines.length > 0) {
           const preset: HeadlinePreset = { id: Date.now().toString() + Math.random(), name: 'จากภาพ: ' + tplName, content: extractedHeadlines.join('\n') };
           setHeadlinePresets(prev => {
             const newPresets = [...prev, preset];
             localStorage.setItem('web_headline_presets', JSON.stringify(newPresets));
             return newPresets;
           });
        }
      }
      saveImageTemplates(updatedTemplates);
      if (updatedTemplates.length > 0) {
        setActiveImageTemplateId(updatedTemplates[updatedTemplates.length - 1].id);
        localStorage.setItem('web_active_img_tpl', updatedTemplates[updatedTemplates.length - 1].id);
      }
      alert('วิเคราะห์รูปภาพในโฟลเดอร์เสร็จสิ้น!');
    } catch(e: any) { setErrorMsg(e.message); }
    setIsAnalyzing(false);
  };

  // Persist helpers
  const saveImageTemplates = (t: ImageTemplate[]) => { setImageTemplates(t); localStorage.setItem('web_image_templates', JSON.stringify(t)); };
  const saveArticleTemplates = (t: ArticleTemplate[]) => { setArticleTemplates(t); localStorage.setItem('web_article_templates', JSON.stringify(t)); };
  const saveLogo = (b64: string) => { setLogoBase64(b64); localStorage.setItem('web_page_logo', b64); };
  const saveLogoPos = (p: string) => { setLogoPosition(p); localStorage.setItem('web_logo_position', p); };
  const saveLogoSz = (s: string) => { setLogoSize(s); localStorage.setItem('web_logo_size', s); };
  const saveHeadlinePresets = (p: HeadlinePreset[]) => { setHeadlinePresets(p); localStorage.setItem('web_headline_presets', JSON.stringify(p)); };
  const addCompletedPost = (p: CompletedPost) => { const next = [p, ...completedPosts]; setCompletedPosts(next); localStorage.setItem('web_completed_posts', JSON.stringify(next)); };

  // Get active template analyses
  const getActiveImageStyle = () => imageTemplates.find(t => t.id === activeImageTemplateId)?.analysis || '';
  const getActiveArticleStyle = () => articleTemplates.find(t => t.id === activeArticleTemplateId)?.analysis || '';
  const getActiveHeadlineStyle = () => headlinePresets.find(p => p.id === activeHeadlinePresetId)?.content || '';
  const getSystemPrompt = () => buildSystemPrompt(getActiveImageStyle(), getActiveArticleStyle(), getActiveHeadlineStyle() || undefined);

  // === Canvas Logo Overlay ===
  const overlayLogo = (imageUrl: string): Promise<string> => {
    if (!logoBase64) return Promise.resolve(imageUrl);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(imageUrl); return; }
        ctx.drawImage(img, 0, 0);
        const logo = new Image();
        logo.onload = () => {
          const scaleMap: Record<string, number> = { small: 0.08, medium: 0.12, large: 0.18 };
          const scale = scaleMap[logoSize] || 0.08;
          const lw = img.width * scale;
          const lh = (logo.height / logo.width) * lw;
          const m = img.width * 0.02;
          let x = m, y = m;
          if (logoPosition === 'top-right') { x = img.width - lw - m; }
          else if (logoPosition === 'bottom-left') { y = img.height - lh - m; }
          else if (logoPosition === 'bottom-right') { x = img.width - lw - m; y = img.height - lh - m; }
          else if (logoPosition === 'center') { x = (img.width - lw) / 2; y = (img.height - lh) / 2; }
          ctx.drawImage(logo, x, y, lw, lh);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        logo.onerror = () => resolve(imageUrl);
        logo.src = logoBase64;
      };
      img.onerror = () => resolve(imageUrl);
      img.src = imageUrl;
    });
  };

  // === Template Analysis ===
  const analyzeImageStyle = async (file: File) => {
    const apiKey = getOpenRouterKey();
    if (!apiKey) { setErrorMsg('กรุณาตั้งค่า OpenRouter API Key ก่อน'); return; }
    setIsAnalyzing(true);
    try {
      const b64 = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); });
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: DEFAULT_AI_MODEL,
          messages: [
            { role: 'system', content: 'You are a design analyst. Analyze the image and describe ONLY the design structure: layout, color scheme, typography style, banner/ribbon placement, background treatment. Do NOT mention any specific text content, page names, or credits. Output in English, concise.' },
            { role: 'user', content: [{ type: 'image_url', image_url: { url: b64 } }, { type: 'text', text: 'Analyze design structure only.' }] }
          ]
        })
      });
      const data = await resp.json();
      const analysis = data.choices?.[0]?.message?.content || 'Analysis failed';
      const tplName = prompt('ตั้งชื่อ Template รูปภาพนี้:', file.name.replace(/\.[^.]+$/, ''));
      if (!tplName) { setIsAnalyzing(false); return; }
      const tpl: ImageTemplate = { id: Date.now().toString(), name: tplName, thumbnail: b64, analysis };
      saveImageTemplates([...imageTemplates, tpl]);
      setActiveImageTemplateId(tpl.id);
      localStorage.setItem('web_active_img_tpl', tpl.id);
    } catch(e: any) { setErrorMsg(e.message); }
    setIsAnalyzing(false);
  };

  const analyzeArticleStyle = async (text: string, name: string) => {
    const apiKey = getOpenRouterKey();
    if (!apiKey) { setErrorMsg('กรุณาตั้งค่า OpenRouter API Key ก่อน'); return; }
    if (!text.trim()) return;
    setIsAnalyzing(true);
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: DEFAULT_AI_MODEL,
          messages: [
            { role: 'system', content: 'You are a writing style analyst. Analyze this Thai article and describe ONLY the writing style: tone, structure, emoji usage, paragraph length, hook style, call-to-action patterns. Output in Thai, concise bullet points.' },
            { role: 'user', content: text.substring(0, 5000) }
          ]
        })
      });
      const data = await resp.json();
      const analysis = data.choices?.[0]?.message?.content || 'Analysis failed';
      const tplName = name || 'บทความ ' + text.substring(0, 10);
      const tpl: ArticleTemplate = { id: Date.now().toString(), name: tplName, preview: text.substring(0, 100), analysis };
      saveArticleTemplates([...articleTemplates, tpl]);
      setActiveArticleTemplateId(tpl.id);
      localStorage.setItem('web_active_art_tpl', tpl.id);
    } catch(e: any) { setErrorMsg(e.message); }
    setIsAnalyzing(false);
  };

  // === Dropbox Upload ===
  const getDropboxCreds = () => {
    try {
      const profiles = JSON.parse(localStorage.getItem('api_global_profiles') || '[]');
      const activeId = localStorage.getItem('api_global_active_id');
      const p = profiles.find((x: any) => x.id === activeId) || profiles[0];
      if (p) return { accessToken: p.dropboxKey || '', refreshToken: p.dropboxRefreshToken || '', appKey: p.dropboxAppKey || '', appSecret: p.dropboxAppSecret || '' };
    } catch(e) {}
    return { accessToken: '', refreshToken: '', appKey: '', appSecret: '' };
  };

  const uploadToDropbox = async (imageUrl: string, fileName: string): Promise<string> => {
    const creds = getDropboxCreds();
    if (!creds.accessToken && !creds.refreshToken) throw new Error('ไม่มี Dropbox credentials — ไปตั้งค่าในไอคอนเฟือง');
    const res = await fetch('/api/dropbox-upload', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, fileName, ...creds })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Dropbox upload failed');
    return data.directUrl;
  };

  // === CSV Export ===
  const exportCSV = () => {
    if (completedPosts.length === 0) { alert('ยังไม่มีผลลัพธ์ให้ export'); return; }
    const headers = ['วิดีโอ', 'ช่อง', 'พาดหัว', 'บทความ', 'Dropbox URL', 'วันที่'];
    const rows = completedPosts.map(p => [p.videoTitle, p.channelName, p.headlines, p.article.replace(/\n/g, ' '), p.dropboxUrl, p.createdAt]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => '"' + (c || '').replace(/"/g, '""') + '"').join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'web_viral_posts_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // Build the modified image_prompt with selected headlines injected
  const getModifiedImagePrompt = () => {
    if (!result?.image_prompt) return null;
    const prompt = JSON.parse(JSON.stringify(result.image_prompt)); // deep clone
    if (selectedHeadlines.length > 0) {
      const headlineText = selectedHeadlines.join(' | ');
      // For image-to-image: replace the "remove text" part with "add these Thai headlines"
      const originalPrompt = prompt.final_compiled_prompt || '';
      prompt.final_compiled_prompt = originalPrompt
        .replace(/REMOVE all original text.*$/is, '') // strip old removal instruction
        .trim();
      prompt.final_compiled_prompt += ` IMPORTANT: Keep the main person/character clearly visible. Remove all original text, captions, and channel logos. Replace them with bold, dramatic Thai text banners containing: "${headlineText}". Use large, bold Thai typography in eye-catching colors (red, yellow, white). The Thai text should be the focal point overlaid on colored ribbon banners. Make the overall design look like a viral Thai social media news post.`;
      prompt.injected_thai_headlines = selectedHeadlines;
    }
    return prompt;
  };

  const toggleHeadline = (text: string) => {
    setSelectedHeadlines(prev => 
      prev.includes(text) ? prev.filter(h => h !== text) : [...prev, text]
    );
  };


  // Data from backend
  const [websiteData, setWebsiteData] = useState<{
    content: string;
    domain: string;
    title: string;
    images: string[];
  } | null>(null);

  const getOpenRouterKey = () => {
    const globalKey = localStorage.getItem('api_global_active_id') 
                      ? JSON.parse(localStorage.getItem('api_global_profiles') || '[]')
                        .find((p: any) => p.id === localStorage.getItem('api_global_active_id'))?.openRouterKey 
                      : null;
    const oldKey = localStorage.getItem('openrouter_key');
    let aiKey = globalKey || oldKey;
    
    if (!aiKey) {
        try {
            const arr = JSON.parse(localStorage.getItem('openrouter_keys') || '[]');
            if(arr.length > 0) aiKey = arr[0].key;
        } catch(e) {}
    }
    return aiKey;
  };

  const handleGenerate = async () => {
    const urls = websiteUrls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length === 0) {
      setErrorMsg('กรุณาใส่ลิงก์ Website อย่างน้อย 1 ลิงก์');
      return;
    }
    const firstUrl = urls[0];
    
    const apiKey = getOpenRouterKey();
    if (!apiKey) {
      setErrorMsg('กรุณาตั้งค่า OpenRouter API Key ใน Dashboard ก่อน');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    setResult(null);
    setWebsiteData(null);

    try {
      const res = await fetch('/api/website-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: firstUrl, time: '00:00:30' })
      });
      
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to extract YouTube info');
      
      setWebsiteData({
        content: data.content || '',
        domain: new URL(firstUrl).hostname,
        title: data.title || '',
        images: data.images || []
      });

      const contentForAI = data.content && data.content.trim().length > 10 
        ? data.content.substring(0, 15000) 
        : '(Content not available — generate based on title only.)';
      if (!data.content || data.content.trim().length < 10) {
        setErrorMsg('⚠️ ดึงเนื้อหาเว็บไม่ได้ — AI จะเขียนจากหัวข้อเว็บแทน');
      }

      const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'Bulk Video Creator',
        },
        body: JSON.stringify({
          model: DEFAULT_AI_MODEL,
          messages: [
            { role: 'system', content: getSystemPrompt() },
            { 
              role: 'user', 
              content: `Website Title: ${data.title}\nDomain: ${new URL(firstUrl).hostname}\nContent: ${contentForAI}` 
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      const aiData = await aiResponse.json();
      if (aiData.error) throw new Error(aiData.error.message || JSON.stringify(aiData.error));
      
      const aiText = aiData.choices?.[0]?.message?.content;
      if (!aiText) throw new Error('AI ไม่ตอบกลับ — ลองใหม่');
      
      const parsed = safeJsonParse(aiText);
      
      setResult(parsed);
      setErrorMsg('');

    } catch (e: any) {
      console.error('[handleGenerate] Error:', e);
      setErrorMsg(e.message || String(e));
    } finally {
      setIsProcessing(false);
    }
  };

  const sendToCanvas = async (imageUrl: string, headlinesText: string, title: string) => {
    setIsGeneratingImage(true);
    try {
      const safeTitle = (title || 'post').replace(/[^a-z0-9]/gi, '_').substring(0, 30);
      const saveRes = await fetch('/api/canvas-save-image-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: safeTitle, imageUrl })
      });
      const saveData = await saveRes.json();
      if (!saveData.success) throw new Error(saveData.error || 'Failed to save image');
      alert(`✅ ส่งรูปภาพไปยังโฟลเดอร์ canvas/${safeTitle} เรียบร้อยแล้ว!\n\n(คุณสามารถนำพาดหัวข่าวไปวางในหน้า Canvas ได้เลย)`);
    } catch(e: any) {
      alert('เกิดข้อผิดพลาดในการส่งรูปภาพ: ' + e.message);
    }
    setIsGeneratingImage(false);
  };

  // === Regenerate Content ===
  const regenerateContent = async (type: 'article' | 'headlines' | 'both') => {
    if (!websiteData) return;
    const apiKey = getOpenRouterKey();
    if (!apiKey) { setErrorMsg('กรุณาตั้งค่า OpenRouter API Key'); return; }
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const extraInstruction = type === 'article' ? '\n\nIMPORTANT: Write a COMPLETELY DIFFERENT article version. Different structure, different angle, different hooks.'
        : type === 'headlines' ? '\n\nIMPORTANT: Create COMPLETELY DIFFERENT headlines. Different phrasing, different energy, different angle.'
        : '\n\nIMPORTANT: Write COMPLETELY DIFFERENT article AND headlines. Different everything.';
      const regenerateContent = websiteData.content && websiteData.content.trim().length > 10 
        ? websiteData.content.substring(0, 15000) 
        : '(Content not available)';
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: DEFAULT_AI_MODEL,
          messages: [
            { role: 'system', content: getSystemPrompt() + extraInstruction },
            { role: 'user', content: `Website Title: ${websiteData.title}\nDomain: ${websiteData.domain}\nContent: ${regenerateContent}` }
          ],
          response_format: { type: 'json_object' }
        })
      });
      const aiData = await resp.json();
      if (aiData.error) throw new Error(aiData.error.message || JSON.stringify(aiData.error));
      const aiText = aiData.choices?.[0]?.message?.content;
      if (!aiText) throw new Error('AI ไม่ตอบกลับ — ลองใหม่');
      
      const parsed = safeJsonParse(aiText);
      
      if (type === 'article') {
        setResult((prev: any) => ({ ...prev, article: parsed.article || '(AI ไม่ได้เขียนบทความ)' }));
      } else if (type === 'headlines') {
        setResult((prev: any) => ({ ...prev, thai_headlines: parsed.thai_headlines }));
        setSelectedHeadlines([]);
      } else {
        if (!parsed.article) parsed.article = '(AI ไม่ได้เขียนบทความ)';
        setResult(parsed);
        setSelectedHeadlines([]);
      }
    } catch(e: any) { console.error('[regenerate]', e); setErrorMsg(e.message); }
    setIsProcessing(false);
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error('Download failed', e);
    }
  };

  const processBulkUrls = async () => {
    const urls = websiteUrls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length === 0) {
      setErrorMsg('กรุณาใส่ลิงก์ Website อย่างน้อย 1 ลิงก์');
      return;
    }
    
    const openRouterKey = getOpenRouterKey();
    if (!openRouterKey) {
      setErrorMsg('กรุณาตั้งค่า OpenRouter API Key ใน Dashboard ก่อน');
      return;
    }

    setErrorMsg('');
    setIsProcessing(true);
    
    // Process each URL in background
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const taskId = `web_bulk_${Date.now()}_${i}`;
      
      globalTaskStore.addTask({
        id: taskId,
        title: `YT: ${url.substring(0, 30)}...`,
        progress: 'เริ่มต้นการทำงาน...',
        status: 'running'
      });

      // Fire and forget (run in background)
      (async () => {
        try {
          // 1. Extract info
          globalTaskStore.updateTask(taskId, { progress: 'กำลังดูดข้อมูลเว็บไซต์และค้นหารูปภาพ...' });
          const exRes = await fetch('/api/website-extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          const exData = await exRes.json();
          if (!exData.success) throw new Error(exData.error || 'Failed to extract website info');

          // 2. OpenRouter AI
          globalTaskStore.updateTask(taskId, { progress: 'กำลังให้ AI เขียนบทความและคิดพาดหัว...' });
          const bulkContent = exData.content && exData.content.trim().length > 10 
            ? exData.content.substring(0, 15000)
            : '(Content not available — generate based on title only.)';
          let domain = '';
          try { domain = new URL(url).hostname; } catch(e){}

          const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openRouterKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: DEFAULT_AI_MODEL,
              messages: [
                { role: 'system', content: getSystemPrompt() },
                { role: 'user', content: `Website Title: ${exData.title}\nDomain: ${domain}\nContent: ${bulkContent}` }
              ],
              response_format: { type: "json_object" }
            })
          });
          const aiData = await aiResponse.json();
          if (aiData.error) throw new Error(aiData.error.message || 'AI Error');
          const aiText = aiData.choices[0].message.content;
          const parsedPrompt = safeJsonParse(aiText);

          // 3. Save to Canvas
          globalTaskStore.updateTask(taskId, { progress: 'กำลังเตรียมรูปภาพสำหรับ Canvas...' });
          const headlines = [
            parsedPrompt.thai_headlines?.main_headline,
            parsedPrompt.thai_headlines?.sub_headline,
            parsedPrompt.thai_headlines?.bottom_text
          ].filter(Boolean);
          
          const targetImageUrl = exData.images?.[0] || '';
          if (!targetImageUrl) throw new Error('ไม่พบรูปภาพสำหรับทำต้นฉบับในเว็บไซต์นี้');

          const safeTitle = (exData.title || 'website_post').replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
          
          const saveRes = await fetch('/api/canvas-save-image-url', {
             method: 'POST', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ folder: safeTitle, imageUrl: targetImageUrl })
          });
          const saveData = await saveRes.json();
          if (!saveData.success) throw new Error('เซฟรูปลง Folder Canvas ล้มเหลว');

          // 4. Complete
          globalTaskStore.updateTask(taskId, { progress: 'เสร็จสมบูรณ์! พร้อมแต่งรูปใน Canvas', status: 'completed' });

          const newPost: CompletedPost = {
            id: taskId,
            videoTitle: exData.title || 'Unknown Page',
            channelName: domain || 'Unknown Domain',
            article: parsedPrompt.article || '(AI ไม่ได้เขียนบทความ)',
            headlines: headlines.join('\n'),
            imageUrl: targetImageUrl,
            dropboxUrl: '',
            createdAt: new Date().toISOString(),
            canvasFolder: safeTitle
          };

          addCompletedPost(newPost);

        } catch (e: any) {
          globalTaskStore.updateTask(taskId, { progress: `Error: ${e.message}`, status: 'error' });
        }
      })();
    }

    setIsProcessing(false);
    setWebsiteUrls(''); // Clear the input after starting tasks
  };


  return (
    <div className="space-y-6">
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          ▶️ Website to Viral Post <span className="text-sm bg-orange-600 text-white px-2 py-0.5 rounded-full font-medium">ปรับปรุง</span>
        </h2>

        {/* Status Banner */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <h4 className="font-bold text-green-400 text-sm mb-2">✅ ระบบใหม่ทำงานเต็มรูปแบบ</h4>
            <ul className="text-xs text-green-300 space-y-1">
              <li>✅ <strong>ปรับปรุงดึง Transcript</strong> — ดึงซับภาษาไทยได้ดีขึ้น</li>
              <li>✅ <strong>Canvas Workflow</strong> — ยกเลิกการใช้ AI สร้างรูปเพี้ยนๆ ส่งข้อมูลไปแต่งต่อที่ Canvas ทันที 100% เป๊ะดั่งใจ</li>
              <li>✅ <strong>ป้องกัน AI JSON พัง</strong> — เพิ่มระบบ Parse ขั้นสูง แก้ปัญหา AI ส่งข้อความขยะมา</li>
            </ul>
          </div>

        <p className="text-[var(--text-secondary)] mb-6">
          ใส่ลิงก์คลิป YouTube เพื่อให้ AI แกะบทความ พร้อมดึงภาพคนพูด, ชื่อช่อง และคิดพาดหัวกราฟิกให้
        </p>

        <div className="flex flex-col gap-4">
          <textarea 
            placeholder="ใส่ลิงก์ Website (บรรทัดละ 1 ลิงก์เพื่อรัน Bulk)" 
            className="w-full h-24 p-3 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-red-500 resize-none"
            value={websiteUrls}
            onChange={(e) => setWebsiteUrls(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-color)] p-2 rounded-lg">
              <span className="text-sm font-bold text-gray-400">ขนาดรูป:</span>
              <select 
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="bg-black text-white p-1 rounded border border-gray-600 text-sm focus:outline-none"
              >
                <option value="auto">Auto (ตามรูปต้นฉบับ)</option>
                <option value="1:1">1:1 (Square)</option>
                <option value="16:9">16:9 (Landscape)</option>
                <option value="9:16">9:16 (Portrait)</option>
                <option value="4:3">4:3</option>
                <option value="3:4">3:4</option>
                <option value="3:2">3:2</option>
                <option value="2:3">2:3</option>
              </select>
            </div>
            
            <button 
              onClick={handleGenerate}
              disabled={isProcessing}
              className={`px-4 py-2 rounded-lg font-medium text-white transition-colors text-sm ${
                isProcessing ? 'bg-gray-600 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isProcessing ? 'กำลังทำ...' : 'ดูดทีละโพสต์ (Manual)'}
            </button>
            
            <button 
              onClick={processBulkUrls}
              disabled={isProcessing}
              className={`flex-1 px-4 py-2 rounded-lg font-bold text-white transition-all shadow-lg text-sm ${
                isProcessing ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-purple-500/20'
              }`}
            >
              🚀 รัน Bulk อัตโนมัติเบื้องหลัง (โหลดรูปออโต้)
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
            {errorMsg}
          </div>
        )}
      </div>

      {/* === Settings Panel (collapsible) === */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
        <button onClick={() => setShowSettings(!showSettings)} className="w-full p-4 text-left flex justify-between items-center hover:bg-white/5 transition-colors rounded-xl">
          <span className="font-bold flex items-center gap-2">⚙️ Template, Logo & Style {(activeImageTemplateId || activeArticleTemplateId || logoBase64 || activeHeadlinePresetId) && <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">Active</span>}</span>
          <span className="text-gray-400">{showSettings ? '▲' : '▼'}</span>
        </button>
        {showSettings && (
          <div className="p-4 pt-0 space-y-6 border-t border-[var(--border-color)]">
            {isAnalyzing && <div className="flex items-center gap-2 text-sm text-blue-400"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>AI กำลังวิเคราะห์...</div>}

            {/* Image Style Templates */}
            <div>
              <h4 className="font-bold text-sm text-purple-400 mb-2">🎨 Template รูปภาพ (อัพรูป style ที่ชอบ)</h4>
              <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-3 mb-3 space-y-3">
                <div className="flex gap-2">
                  <input type="text" placeholder="ชื่อ Folder ใหม่..." value={newStyleFolderName} onChange={(e) => setNewStyleFolderName(e.target.value)} className="flex-1 bg-black border border-gray-600 rounded px-2 text-xs text-white" />
                  <button onClick={createStyleFolder} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs font-bold shrink-0">+ สร้าง Folder</button>
                </div>
                
                {styleFolders.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select value={selectedStyleFolder} onChange={(e) => setSelectedStyleFolder(e.target.value)} className="flex-1 bg-black border border-purple-500/50 rounded px-2 py-1.5 text-xs text-purple-300">
                      <option value="">-- เลือก Folder --</option>
                      {styleFolders.map(f => <option key={f.name} value={f.name}>📁 {f.name} ({f.fileCount} รูป)</option>)}
                    </select>
                    {selectedStyleFolder && (
                      <button onClick={() => openStyleFolder(selectedStyleFolder)} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs font-bold shrink-0">📂 เปิดโฟลเดอร์</button>
                    )}
                  </div>
                )}
                
                {selectedStyleFolder && (
                   <button onClick={analyzeFolderStyles} disabled={isAnalyzing} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-2 rounded text-xs font-bold mt-2">
                     {isAnalyzing ? 'กำลังวิเคราะห์...' : '🔍 วิเคราะห์รูปลง Template'}
                   </button>
                )}
              </div>
              {imageTemplates.length > 0 && (
                <div className="space-y-2">
                  {imageTemplates.map(t => (
                    <div key={t.id} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${activeImageTemplateId === t.id ? 'border-purple-500 bg-purple-900/20' : 'border-[var(--border-color)] hover:border-white/20'}`}
                      onClick={() => { const newId = activeImageTemplateId === t.id ? '' : t.id; setActiveImageTemplateId(newId); localStorage.setItem('web_active_img_tpl', newId); }}>
                      <img src={t.thumbnail} className="w-12 h-12 rounded object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{t.name}</p>
                        <p className="text-[10px] text-gray-500 line-clamp-1">{t.analysis.substring(0, 80)}...</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); saveImageTemplates(imageTemplates.filter(x => x.id !== t.id)); if (activeImageTemplateId === t.id) { setActiveImageTemplateId(''); localStorage.setItem('web_active_img_tpl', ''); } }} className="text-red-400 hover:text-red-300 text-xs shrink-0">ลบ</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Article Style Templates */}
            <div>
              <h4 className="font-bold text-sm text-blue-400 mb-2">📝 Template บทความ (วางบทความตัวอย่าง)</h4>
              <div className="flex flex-col gap-2 mb-2 bg-blue-900/10 border border-blue-500/20 p-3 rounded-lg">
                <input type="text" placeholder="ตั้งชื่อ Template บทความนี้..." value={articleEditName} onChange={(e) => setArticleEditName(e.target.value)} className="w-full bg-black border border-gray-600 rounded px-2 py-1.5 text-xs text-white" />
                <textarea placeholder="วางบทความตัวอย่างที่ชอบลงที่นี่..." value={articleEditContent} onChange={(e) => setArticleEditContent(e.target.value)} className="w-full h-20 p-2 text-xs bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg resize-none" />
                <button onClick={() => { if(!articleEditContent.trim() || !articleEditName.trim()) { alert('กรุณาใส่ชื่อและบทความตัวอย่าง'); return; } analyzeArticleStyle(articleEditContent, articleEditName); setArticleEditContent(''); setArticleEditName(''); }} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg">วิเคราะห์และบันทึก</button>
              </div>
              {articleTemplates.length > 0 && (
                <div className="space-y-2">
                  {articleTemplates.map(t => (
                    <div key={t.id} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${activeArticleTemplateId === t.id ? 'border-blue-500 bg-blue-900/20' : 'border-[var(--border-color)] hover:border-white/20'}`}
                      onClick={() => { const newId = activeArticleTemplateId === t.id ? '' : t.id; setActiveArticleTemplateId(newId); localStorage.setItem('web_active_art_tpl', newId); }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{t.name}</p>
                        <p className="text-[10px] text-gray-500 line-clamp-1">{t.analysis.substring(0, 80)}...</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); saveArticleTemplates(articleTemplates.filter(x => x.id !== t.id)); if (activeArticleTemplateId === t.id) { setActiveArticleTemplateId(''); localStorage.setItem('web_active_art_tpl', ''); } }} className="text-red-400 hover:text-red-300 text-xs shrink-0">ลบ</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Logo */}
            <div>
              <h4 className="font-bold text-sm text-green-400 mb-2">🖼️ Logo เพจ (แปะทับด้วย Canvas)</h4>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => saveLogo(r.result as string); r.readAsDataURL(f); } e.target.value = ''; }} />
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors">
                      {logoBase64 ? <><img src={logoBase64} className="w-6 h-6 rounded object-contain" />เปลี่ยน Logo</> : '📷 อัพ Logo'}
                    </div>
                  </label>
                  {logoBase64 && <button onClick={() => saveLogo('')} className="text-[10px] text-red-400 mt-1 block">ลบ Logo</button>}
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">ตำแหน่ง</label>
                  <select value={logoPosition} onChange={(e) => saveLogoPos(e.target.value)} className="bg-black text-white p-1 rounded border border-gray-600 text-xs">
                    <option value="top-left">บน-ซ้าย</option><option value="top-right">บน-ขวา</option>
                    <option value="bottom-left">ล่าง-ซ้าย</option><option value="bottom-right">ล่าง-ขวา</option>
                    <option value="center">ตรงกลาง</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">ขนาด</label>
                  <select value={logoSize} onChange={(e) => saveLogoSz(e.target.value)} className="bg-black text-white p-1 rounded border border-gray-600 text-xs">
                    <option value="small">เล็ก (8%)</option><option value="medium">กลาง (12%)</option><option value="large">ใหญ่ (18%)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Headline Style Presets */}
            <div>
              <h4 className="font-bold text-sm text-yellow-400 mb-2">🔥 สำนวนพาดหัวที่ชอบ</h4>
              <div className="space-y-2 mb-3">
                <input
                  type="text"
                  placeholder="ชื่อ Preset เช่น: ข่าวการเมือง, เทคโนโลยี"
                  className="w-full p-2 text-sm bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg"
                  value={headlineEditName}
                  onChange={(e) => setHeadlineEditName(e.target.value)}
                />
                <textarea
                  placeholder={"ใส่ตัวอย่างสำนวนพาดหัว (บรรทัดละ 1 สำนวน)\nเช่น:\nทรัมป์สั่งลุย! ส่งเรือรบ 3 ลำ ถล่มอิหร่าน!\nช็อกวงการ! หุ้นไทยร่วงหนัก 100 จุด!"}
                  className="w-full h-20 p-2 text-sm bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg resize-none"
                  value={headlineEditContent}
                  onChange={(e) => setHeadlineEditContent(e.target.value)}
                />
                <button
                  onClick={() => {
                    if (!headlineEditName.trim() || !headlineEditContent.trim()) { alert('กรุณาใส่ชื่อและสำนวนพาดหัว'); return; }
                    const preset: HeadlinePreset = { id: Date.now().toString(), name: headlineEditName.trim(), content: headlineEditContent.trim() };
                    saveHeadlinePresets([...headlinePresets, preset]);
                    setActiveHeadlinePresetId(preset.id);
                    localStorage.setItem('web_active_hl_preset', preset.id);
                    setHeadlineEditName(''); setHeadlineEditContent('');
                  }}
                  className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-bold rounded-lg"
                >
                  💾 บันทึก Preset สำนวน
                </button>
              </div>
              {headlinePresets.length > 0 && (
                <div className="space-y-2">
                  {headlinePresets.map(p => (
                    <div key={p.id} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${activeHeadlinePresetId === p.id ? 'border-yellow-500 bg-yellow-900/20' : 'border-[var(--border-color)] hover:border-white/20'}`}
                      onClick={() => { const newId = activeHeadlinePresetId === p.id ? '' : p.id; setActiveHeadlinePresetId(newId); localStorage.setItem('web_active_hl_preset', newId); }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold">{p.name}</p>
                        <p className="text-[10px] text-gray-500 line-clamp-1">{p.content.substring(0, 60)}...</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); saveHeadlinePresets(headlinePresets.filter(x => x.id !== p.id)); if (activeHeadlinePresetId === p.id) { setActiveHeadlinePresetId(''); localStorage.setItem('web_active_hl_preset', ''); } }} className="text-red-400 hover:text-red-300 text-xs shrink-0">ลบ</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {(isProcessing || websiteData || result) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* ข้อมูลที่ดึงจาก Website */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 space-y-4">
            <h3 className="text-lg font-semibold text-red-400 border-b border-[var(--border-color)] pb-2">
              📸 ข้อมูลที่ดูดมาได้
            </h3>
            
            {isProcessing && !websiteData ? (
              <div className="animate-pulse flex flex-col items-center justify-center py-10 space-y-4">
                <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[var(--text-secondary)]">กำลังโหลดเนื้อหาเว็บและดึงรูปภาพ (รอประมาณ 10-20 วินาที)...</p>
              </div>
            ) : websiteData && (
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                    <span className="text-xl">🌐</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-blue-400">{websiteData.domain}</h4>
                    <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{websiteData.title}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-[var(--text-secondary)] mb-2">📷 คลิกเลือกรูปที่จะใช้เป็นปก</p>
                  {websiteData.images && websiteData.images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-2">
                       {websiteData.images.map((url, idx) => {
                          const isSelected = selectedImageUrl === url;
                          return (
                          <div key={idx} 
                            className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${isSelected ? 'border-green-500 ring-2 ring-green-500/50' : 'border-[var(--border-color)] hover:border-white/30'}`}
                            onClick={() => setSelectedImageUrl(url)}
                          >
                             <img src={url} className="w-full object-cover aspect-video bg-black" alt={`Image ${idx+1}`} />
                             {isSelected && (
                               <div className="absolute top-1 right-1 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">✓ เลือกแล้ว</div>
                             )}
                          </div>
                          );
                       })}
                    </div>
                  ) : (
                    <div className="p-8 bg-gray-800/50 rounded-lg text-center text-sm text-gray-500">ดึงภาพไม่ได้</div>
                  )}
                </div>

                <div className="pt-4 border-t border-[var(--border-color)]">
                  <p className="text-sm text-[var(--text-secondary)] mb-2">คำพูดที่ดูดได้ (บางส่วน)</p>
                  <p className="text-xs text-gray-400 bg-black/30 p-3 rounded-md max-h-32 overflow-y-auto">
                    {websiteData.content ? websiteData.content.substring(0, 500) : '(ไม่มีเนื้อหา)'}...
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* บทความและ Prompt */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 space-y-4">
            <h3 className="text-lg font-semibold text-blue-400 border-b border-[var(--border-color)] pb-2">
              📝 ผลลัพธ์จาก AI
            </h3>
            
            {isProcessing && websiteData && !result ? (
              <div className="animate-pulse flex flex-col items-center justify-center py-10 space-y-4">
                 <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                 <p className="text-[var(--text-secondary)]">กำลังปั้นบทความ และคิดพาดหัว...</p>
              </div>
            ) : errorMsg && !result ? (
              <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg text-center space-y-3">
                <div className="text-4xl">❌</div>
                <h4 className="text-red-400 font-bold text-lg">เกิดข้อผิดพลาด</h4>
                <p className="text-sm text-red-300">{errorMsg}</p>
              </div>
            ) : result && (
              <div className="space-y-6">

                {/* พาดหัวข่าวที่ AI คิดมาให้ — กดเลือกเพื่อใส่ลง Prompt */}
                {result.thai_headlines && (() => {
                  const headlines = [
                    { key: 'main', text: result.thai_headlines.main_headline, label: 'พาดหัวหลัก', color: 'text-yellow-300 font-bold text-lg' },
                    { key: 'sub', text: result.thai_headlines.sub_headline, label: 'ข้อความรอง', color: 'text-white' },
                    ...(result.thai_headlines.bottom_text ? [{ key: 'bottom', text: result.thai_headlines.bottom_text, label: 'ข้อความสรุป', color: 'text-gray-300 text-sm' }] : [])
                  ];
                  return (
                  <div className="bg-gradient-to-r from-red-900/30 to-orange-900/30 border border-red-500/30 rounded-lg p-4 space-y-3">
                    <h4 className="font-bold text-red-400 flex items-center gap-2">🔥 พาดหัวข่าว — กดเลือกเพื่อใส่ลง Prompt โดยอัตโนมัติ</h4>
                    {selectedHeadlines.length > 0 && (
                      <p className="text-xs text-green-400">✅ เลือกแล้ว {selectedHeadlines.length} รายการ — Prompt ด้านล่างถูกอัปเดตอัตโนมัติแล้ว</p>
                    )}
                    
                    <div className="space-y-2">
                      {headlines.map(h => {
                        const isSelected = selectedHeadlines.includes(h.text);
                        return (
                          <div key={h.key} 
                            className={`flex items-center justify-between rounded p-3 cursor-pointer transition-all border-2 ${
                              isSelected 
                                ? 'bg-green-900/40 border-green-500/60' 
                                : 'bg-black/30 border-transparent hover:border-white/20'
                            }`}
                            onClick={() => toggleHeadline(h.text)}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm shrink-0 ${isSelected ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                                {isSelected ? '✓' : '○'}
                              </span>
                              <div>
                                <span className="text-[10px] text-gray-500 block">{h.label}</span>
                                <span className={h.color}>{h.text}</span>
                              </div>
                            </div>
                            <div className="flex gap-1 ml-2 shrink-0">
                              <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(h.text); }} className="text-xs bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded text-white">คัดลอก</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const allTexts = headlines.map(h => h.text);
                          setSelectedHeadlines(allTexts);
                        }}
                        className="flex-1 text-sm bg-green-600 hover:bg-green-700 py-2 rounded text-white font-medium"
                      >
                        ✅ เลือกทั้งหมดใส่ Prompt
                      </button>
                      <button 
                        onClick={() => setSelectedHeadlines([])}
                        className="flex-1 text-sm bg-gray-600 hover:bg-gray-700 py-2 rounded text-white font-medium"
                      >
                        ❌ ยกเลิกทั้งหมด
                      </button>
                    </div>

                    <button 
                      onClick={() => {
                        const allText = headlines.map(h => h.text).join('\n');
                        navigator.clipboard.writeText(allText);
                        alert('คัดลอกพาดหัวทั้งหมดแล้ว!');
                      }}
                      className="w-full text-sm bg-red-600 hover:bg-red-700 py-2 rounded text-white font-medium"
                    >
                      📋 คัดลอกพาดหัวทั้งหมด
                    </button>
                    <button 
                      onClick={() => regenerateContent('headlines')}
                      disabled={isProcessing}
                      className="w-full text-sm bg-orange-600 hover:bg-orange-700 py-2 rounded text-white font-medium disabled:opacity-50"
                    >
                      🔄 คิดพาดหัวใหม่
                    </button>
                  </div>
                  );
                })()}

                <div>
                  <h4 className="font-bold mb-2 flex items-center justify-between">
                    <span>📖 บทความ / โพสต์</span>
                    <button onClick={() => regenerateContent('article')} disabled={isProcessing} className="text-xs bg-orange-600 hover:bg-orange-700 px-3 py-1 rounded text-white disabled:opacity-50">🔄 เขียนใหม่</button>
                  </h4>
                  <textarea 
                    className="w-full h-48 p-3 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg text-sm"
                    value={result.article || ''}
                    onChange={(e) => setResult((prev: any) => ({ ...prev, article: e.target.value }))}
                  ></textarea>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(result.article); alert('คัดลอกบทความแล้ว!'); }}
                    className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded text-white"
                  >
                    คัดลอกบทความ
                  </button>
                </div>

                <div>
                  <h4 className="font-bold mb-2 flex justify-between items-center">
                    <span>🎨 Image Prompt (JSON) {selectedHeadlines.length > 0 ? '— ✅ มีพาดหัวถูกใส่แล้ว' : '— ลบข้อความเดิม + ป้ายเปล่า'}</span>
                    <button 
                      onClick={() => {
                        const promptToExport = getModifiedImagePrompt() || result.image_prompt;
                        navigator.clipboard.writeText(JSON.stringify(promptToExport, null, 2));
                        alert('คัดลอก JSON แล้ว!');
                      }}
                      className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-white"
                    >
                      คัดลอก JSON
                    </button>
                  </h4>
                  {selectedHeadlines.length > 0 && (
                    <div className="mb-2 p-2 bg-green-900/30 border border-green-500/30 rounded text-xs text-green-400">
                      💡 Prompt ถูกแก้ไขแล้ว: แทนที่ "ป้ายเปล่า" ด้วยข้อความ: <strong>{selectedHeadlines.join(' | ')}</strong>
                    </div>
                  )}
                  <textarea 
                    className={`w-full h-64 p-3 border rounded-lg text-xs font-mono ${selectedHeadlines.length > 0 ? 'bg-green-950 text-green-300 border-green-500/30' : 'bg-black text-green-400 border-[var(--border-color)]'}`}
                    readOnly
                    value={JSON.stringify(getModifiedImagePrompt() || result.image_prompt, null, 2)}
                  ></textarea>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* === Canvas Generate Section === */}
      {result && websiteData && (
        <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-xl border border-purple-500/30 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-purple-400 flex items-center gap-2">
            🎨 ส่งข้อมูลไปแต่งต่อใน Canvas Editor
          </h3>

          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span className={selectedImageUrl ? 'text-green-400' : 'text-gray-500'}>
              {selectedImageUrl ? '✅ เลือกรูปแล้ว' : '⬜ ยังไม่ได้เลือกรูป'}
            </span>
            <span className={selectedHeadlines.length > 0 ? 'text-green-400' : 'text-gray-500'}>
              {selectedHeadlines.length > 0 ? `✅ เลือกพาดหัว ${selectedHeadlines.length} รายการ` : '⬜ ยังไม่ได้เลือกพาดหัว'}
            </span>
          </div>

          <button
            onClick={() => {
               sendToCanvas(selectedImageUrl, selectedHeadlines.join('\n'), websiteData.title);
               addCompletedPost({
                 id: Date.now().toString(),
                 videoTitle: websiteData.title || '',
                 channelName: websiteData.domain || '',
                 article: result?.article || '',
                 headlines: selectedHeadlines.join(' | '),
                 imageUrl: selectedImageUrl,
                 dropboxUrl: '',
                 createdAt: new Date().toLocaleString('th-TH'),
                 canvasFolder: (websiteData.title || 'post').replace(/[^a-z0-9]/gi, '_').substring(0, 30)
               });
            }}
            disabled={isGeneratingImage || !selectedImageUrl || selectedHeadlines.length === 0}
            className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
              isGeneratingImage
                ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                : (!selectedImageUrl || selectedHeadlines.length === 0)
                  ? 'bg-gray-800 cursor-not-allowed text-gray-500'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-500/20'
            }`}
          >
            {isGeneratingImage ? '⏳ กำลังเตรียมโฟลเดอร์...' : '🎨 ส่งไป Canvas เลย!'}
          </button>
        </div>
      )}

      {/* === Completed Posts Table + CSV Export === */}
      {completedPosts.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-emerald-400">📊 ผลลัพธ์ที่เสร็จแล้ว ({completedPosts.length})</h3>
            <div className="flex gap-2">
              <button onClick={exportCSV} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold">📥 Export CSV</button>
              <button onClick={() => { if (confirm('ลบผลลัพธ์ทั้งหมด?')) { setCompletedPosts([]); localStorage.removeItem('web_completed_posts'); } }} className="px-3 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded-lg text-sm">🗑️</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left p-2 text-gray-500">วิดีโอ</th>
                  <th className="text-left p-2 text-gray-500">ช่อง</th>
                  <th className="text-left p-2 text-gray-500">พาดหัว</th>
                  <th className="text-left p-2 text-gray-500">Dropbox URL</th>
                  <th className="text-left p-2 text-gray-500">วันที่</th>
                </tr>
              </thead>
              <tbody>
                {completedPosts.map(p => (
                  <tr key={p.id} className="border-b border-[var(--border-color)] hover:bg-white/5">
                    <td className="p-2 max-w-[150px] truncate">{p.videoTitle}</td>
                    <td className="p-2">{p.channelName}</td>
                    <td className="p-2 max-w-[200px] truncate">{p.headlines}</td>
                    <td className="p-2"><button onClick={() => { navigator.clipboard.writeText(p.dropboxUrl); alert('คัดลอกแล้ว!'); }} className="text-blue-400 hover:text-blue-300 truncate max-w-[150px] block">{p.dropboxUrl ? '📋 คัดลอก' : '-'}</button></td>
                    <td className="p-2 text-gray-500">{p.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
