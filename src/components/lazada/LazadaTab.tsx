import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

type LazadaItem = {
  id: string;
  name: string;
  image: string;
  link: string;
  sales?: string;
  commission?: string;
  price?: string;
  category?: string;
  shortName?: string;
};

type ClusterGroup = {
  categoryName: string;
  items: LazadaItem[];
};

export type LazadaModel = {
  id: string;
  name: string;
  base64: string;
  timestamp: number;
};

export const LazadaTab: React.FC = () => {
  const [items, setItems] = useState<LazadaItem[]>([]);
  const [clusters, setClusters] = useState<ClusterGroup[]>([]);
  const [savedClusters, setSavedClusters] = useState<ClusterGroup[]>(() => {
    try { return JSON.parse(localStorage.getItem('lazada_saved_clusters') || '[]'); } catch { return []; }
  });
  
  // Model Directory
  const [savedModels, setSavedModels] = useState<LazadaModel[]>(() => {
    try { return JSON.parse(localStorage.getItem('lazada_saved_models') || '[]'); } catch { return []; }
  });
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [modelNameInput, setModelNameInput] = useState('');
  const [imageModel, setImageModel] = useState('nano-banana-pro');
  const [outfitStyle, setOutfitStyle] = useState('auto');
  const [poseStyle, setPoseStyle] = useState('dynamic');
  const [photoTone, setPhotoTone] = useState('korean_ig'); // auto, korean_ig, candid, cinematic, or custom ID
  const [productFocus, setProductFocus] = useState('level_3'); // 5 levels of product placement
  const [customToneText, setCustomToneText] = useState('');
  const [customToneName, setCustomToneName] = useState('');
  const [savedTones, setSavedTones] = useState<{id: string, name: string, prompt: string}[]>(() => {
    try { return JSON.parse(localStorage.getItem('kie_saved_tones') || '[]'); } catch { return []; }
  });
  const [generatedAds, setGeneratedAds] = useState<Record<string, string>>({}); // itemId -> imageUrl

  const [viewMode, setViewMode] = useState<'new' | 'saved'>('new');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatingItemId, setGeneratingItemId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [logs, setLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelUploadRef = useRef<HTMLInputElement>(null);

  // ════════════════════════════════════════
  // NEW: Shoot Mode & Review Card States
  // ════════════════════════════════════════
  const [shootMode, setShootMode] = useState<'model' | 'product_only'>('model');
  const [sceneStyle, setSceneStyle] = useState('lifestyle');
  const [enableReviewOverlay, setEnableReviewOverlay] = useState(false);
  const [reviewStyle, setReviewStyle] = useState<'secret_find' | 'recommend' | 'rating' | 'pros_cons'>('secret_find');
  const [reviewLength, setReviewLength] = useState<'short' | 'medium' | 'long'>('medium');

  const fetchReviewTextForPrompt = async (product: LazadaItem): Promise<string> => {
    const { openRouterKey } = getApiKeys();
    if (!openRouterKey) throw new Error("ไม่พบ OpenRouter API Key สำหรับเขียนรีวิว");

    const stylePrompts: Record<string, string> = {
      secret_find: `เขียนรีวิวสินค้าแบบ "ของลับ ลายแทง!" ให้ดูตื่นเต้น น่าจะลอง เหมือนคนรีวิวจริงๆ ภาษาไม่เป็นทางการ ใช้อิโมจิ บอกข้อดีสัก 2-3 ข้อแบบกระตุ้นอยากซื้อ แล้วก็บอกข้อเสียเล็กน้อย 1 ข้อให้ดูจริงใจ\nตอบกลับเป็น JSON: {"headline":"ข้อความหัวเรื่องสั้นๆ เช่น ของลับมาแล้ว!","body":"[YOUR TEXT]","rating":4.5,"pros":["ข้อดี1","ข้อดี2"],"cons":["ข้อเสียเล็กน้อย"]}`,
      recommend: `เขียนรีวิวแนะนำสินค้าแบบ Influencer บอกว่าลองแล้วดียังไง ทำไมถึงแนะนำ ภาษาไทยลำลอง มีอิโมจิ\nตอบกลับเป็น JSON: {"headline":"แนะนำเลย!","body":"[YOUR TEXT]","rating":4.5,"pros":["ข้อดี1","ข้อดี2","ข้อดี3"],"cons":["ข้อเสียเล็กน้อย"]}`,
      rating: `ให้คะแนนรีวิวสินค้าพร้อมเหตุผล แบบ review site ภาษาไทย มีข้อดี ข้อเสีย ให้คะแนน 1-5\nตอบกลับเป็น JSON: {"headline":"⭐ ให้คะแนน X/5","body":"[YOUR TEXT]","rating":4.0,"pros":["ข้อดี1","ข้อดี2"],"cons":["ข้อเสีย1"]}`,
      pros_cons: `วิเคราะห์ สินค้านี้แบบตรงไปตรงมา ข้อดี vs ข้อเสีย ภาษาไทย ให้ดูจริงใจเหมือนคนใช้จริงรีวิว\nตอบกลับเป็น JSON: {"headline":"ดีจริงมั้ย? มาดูกัน","body":"[YOUR TEXT]","rating":4.0,"pros":["ข้อดี1","ข้อดี2","ข้อดี3"],"cons":["ข้อเสีย1","ข้อเสียเล็กน้อย2"]}`
    };

    let lengthInstruction = 'แบบความยาวปานกลาง ประมาณ 2-3 ประโยค กำลังดี';
    if (reviewLength === 'short') lengthInstruction = 'แบบกระชับ! สั้นมากๆ เอาแค่ใจความสำคัญ 1 ประโยคเด็ดๆพอ พิมพ์ให้อ่านง่ายและเร็วที่สุด';
    if (reviewLength === 'long') lengthInstruction = 'แบบละเอียด จัดเต็ม เล่าความรู้สึกเยอะๆ 4-5 ประโยค';

    const aiPrompt = `สินค้า: "${product.name}"\n${stylePrompts[reviewStyle]}\n*คำสั่งความยาวตัวเนื้อหา body: ${lengthInstruction}*\nห้ามใส่ markdown ticks ตอบแค่ JSON อย่างเดียว`;

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: aiPrompt }]
      })
    });
    if(!res.ok) throw new Error("OpenRouter API Error");
    const data = await res.json();
    const textOutput = data.choices[0].message.content.trim().replace(/```json\n?/g, '').replace(/```/g, '').trim();
    const review = JSON.parse(textOutput);

    return `\nInclude the following exact Thai text overlay on the graphic in a beautiful, highly legible layout matching the reference graphic perfectly:
Headline: "${review.headline}"
Review: "${review.body}"
Pros: ${review.pros ? review.pros.join(', ') : ''}
Cons: ${review.cons ? review.cons.join(', ') : ''}
Rating: ${review.rating}/5
CRITICAL: The text MUST be placed inside a clean, modern text box or semi-transparent background plate (like frosted glass or solid color shape) to match the reference graphic's style and ensure maximum legibility against the product photo. Use authentic, perfect Thai typography. The texts MUST be written in Thai language!`;
  };
  
  // Dropbox States
  const [dropboxFolder, setDropboxFolder] = useState('');
  const [enableCaption, setEnableCaption] = useState(false);
  const [captionPrompt, setCaptionPrompt] = useState('เขียนแคปชั่นขายของแบบป้ายยา ฮาร์ดเซลล์นิดๆ ใช้อีโมจิน่ารักๆ');
  const [captionLength, setCaptionLength] = useState<'short'|'medium'|'long'>('medium');

  // Review Style References (Ref Images)
  const [savedReviewStyles, setSavedReviewStyles] = useState<LazadaModel[]>(() => {
    try { return JSON.parse(localStorage.getItem('lazada_saved_review_styles') || '[]'); } catch { return []; }
  });
  const [selectedReviewStyleId, setSelectedReviewStyleId] = useState<string | null>(null);
  const [reviewStyleNameInput, setReviewStyleNameInput] = useState('');
  const reviewStyleUploadRef = useRef<HTMLInputElement>(null);

  const [generatedReviews, setGeneratedReviews] = useState<Record<string, string>>({}); // itemId -> review canvas dataURL
  const reviewCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleSaveCluster = (cluster: ClusterGroup) => {
    const updated = [cluster, ...savedClusters];
    setSavedClusters(updated);
    localStorage.setItem('lazada_saved_clusters', JSON.stringify(updated));
    alert('💾 บันทึกกลุ่มนี้สำเร็จ! ดูได้ที่แถบ "กลุ่มที่บันทึกไว้"');
  };
  
  const handleDeleteSavedCluster = (idx: number) => {
    if(!confirm('ลบกลุ่มที่บันทึกไว้นี้?')) return;
    const updated = [...savedClusters];
    updated.splice(idx, 1);
    setSavedClusters(updated);
    localStorage.setItem('lazada_saved_clusters', JSON.stringify(updated));
  };

  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    const time = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '📢';
    setLogs(prev => [`[${time}] ${prefix} ${msg}`, ...prev].slice(0, 30));
  };

  const getApiKeys = () => {
    let openRouterKey = '';
    try {
      const keys = JSON.parse(localStorage.getItem('openrouter_keys') || '[]');
      openRouterKey = keys.find((k: any) => k.isActive)?.key || keys[0]?.key || localStorage.getItem('openrouter_key') || '';
    } catch(e) {}
    return { openRouterKey };
  };

  const getKieApiKey = () => {
    try {
      const profiles = JSON.parse(localStorage.getItem('api_key_profiles') || '[]');
      const targetId = localStorage.getItem('selected_api_key_id');
      return profiles.find((p: any) => p.id === targetId)?.key || profiles[0]?.key || '';
    } catch(e) { return ''; }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    addLog('อ่านไฟล์ ' + file.name + '...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of objects
        const rawJson = XLSX.utils.sheet_to_json<any>(worksheet);
        addLog(`เจอข้อมูลทั้งหมด ${rawJson.length} แถว`);

        const parsedItems: LazadaItem[] = [];
        
        // Dynamic column matching
        rawJson.forEach((row, i) => {
          let name = '';
          let image = '';
          let link = '';
          let sales = '';
          let commission = '';
          let price = '';
          let category = '';
          
          Object.keys(row).forEach(key => {
            const lowerKey = key.toLowerCase();
            const val = String(row[key] || '').trim();
            if (!val || val === 'N/A' || val === '-') return;

            // Exact Match for Lazada standard export
            if (lowerKey === 'product_name') name = val;
            else if (lowerKey === 'picture_url') image = val;
            else if (lowerKey === 'promo_short_link') link = val;
            else if (lowerKey === 'promo_link' && !link) link = val;
            else if (lowerKey === 'in_stock') sales = val; // Often Lazada sheets put stock/sales together
            else if (lowerKey === 'monthly_sales' || lowerKey.includes('ยอดขาย') || lowerKey.includes('sold')) sales = val;
            else if (lowerKey === 'commission' || lowerKey.includes('ค่าคอม') || lowerKey.includes('est. com') || lowerKey === 'est_commission') commission = val;
            else if (lowerKey === 'price' || lowerKey.includes('ราคา') || lowerKey === 'discount_price') price = val;
            else if (lowerKey === 'category_name' || lowerKey.includes('หมวดหมู่') || lowerKey === 'category') category = val;

            // Content-based heuristic (if exact match not found)
            if (!image && val.startsWith('http') && (val.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i) || val.includes('img.alicdn') || val.includes('slatic.net'))) {
              image = val;
            } else if (!link && val.startsWith('http') && !val.includes('img.alicdn') && !val.includes('slatic.net')) {
              link = val;
            } else if (!name && val.length > 15 && !val.match(/^[0-9.]+$/) && !val.includes('http')) {
              name = val;
            }

            // Fallback Key-based heuristic
            if (!name && (lowerKey.includes('name') || lowerKey.includes('ชื่อ') || lowerKey.includes('offer') || lowerKey.includes('title'))) name = val;
            if (!image && (lowerKey.includes('image') || lowerKey.includes('รูป') || lowerKey.includes('pic'))) image = val;
            if (!link && (lowerKey.includes('link') || lowerKey.includes('url') || lowerKey.includes('landing')) && !lowerKey.includes('image') && !lowerKey.includes('pic') && !lowerKey.includes('picture')) {
               link = val;
            }
          });

          // Ensure it's somewhat valid
          if (name && (image || link)) {
            parsedItems.push({
              id: `item-${Date.now()}-${i}`,
              name,
              image: image || 'https://via.placeholder.com/150?text=No+Image',
              link: link || '#',
              sales,
              commission,
              price,
              category
            });
          }
        });

        setItems(parsedItems);
        addLog(`สกัดข้อมูลสำเร็จ ${parsedItems.length} ชิ้น เตรียมจัดกลุ่ม...`);
        
        if (parsedItems.length > 0) {
          clusterProductsWithAI(parsedItems);
        } else {
          setIsProcessing(false);
          addLog("❌ ไม่พบข้อมูลสินค้าที่สมบูรณ์ โปรดตรวจสอบชื่อคอลัมน์");
        }
      } catch (err: any) {
        addLog('❌ Error reading file: ' + err.message);
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const clusterProductsWithAI = async (productList: LazadaItem[]) => {
    const { openRouterKey } = getApiKeys();
    if (!openRouterKey) {
      addLog("❌ ไม่พบ OpenRouter API Key กรุณาตั้งค่าในหน้าคลังแสงก่อน");
      setIsProcessing(false);
      return;
    }

    addLog('กำลังเรียก AI จัดกลุ่มสินค้า (Gemini 2.5 Flash)...');
    
    // We only send names to save token context
    const inputPayload = productList.map(item => ({
      id: item.id,
      name: item.name
    }));

    const aiPrompt = `คุณเป็นระบบจัดหมวดหมู่สินค้า E-Commerce
หน้าที่ของคุณคือ:
1. จัดกลุ่มสินค้าที่มีความเข้ากันได้ ให้อยู่ในกลุ่มเดียวกันเพื่อให้สามารถนำไปทำภาพรีวิวมัดรวมสินค้าในหมวดนั้นๆได้สวยงาม (ประมาณ 3-7 กลุ่ม) และตั้งชื่อกลุ่มให้น่าสนใจ
2. สินค้าแต่ละตัวจะมีชื่อที่ยาวและรก ให้คุณ "ตั้งชื่อสินค้าใหม่ให้สั้น กระชับ ดึงดูด และเข้าใจง่าย" สำหรับใช้โปรโมท

สินค้าดั้งเดิม:
${JSON.stringify(inputPayload)}

ข้อจำกัดผลลัพธ์:
ตอบกลับเป็น JSON Format แบบเป๊ะๆ ห้ามพิมพ์แถมคำอื่น (No markdown ticks) โครงสร้างดังนี้:
[
  {
    "categoryName": "ชื่อกลุ่มน่าสนใจ",
    "items": [
      {
        "id": "รหัส id เดิมของสินค้า",
        "shortName": "ชื่อสินค้าใหม่ที่สั้นและน่าสนใจ"
      }
    ]
  }
]
`;

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          model: 'google/gemini-2.5-flash', 
          messages: [{ role: 'user', content: aiPrompt }] 
        })
      });

      const data = await res.json();
      const textOutput = data.choices[0].message.content.trim().replace(/```json\n?/g, '').replace(/```/g, '').trim();
      
      let parsedGroups;
      try {
        parsedGroups = JSON.parse(textOutput);
      } catch (e) {
        throw new Error('AI ส่งผลลัพธ์ผิดรูปแบบ (ท่าไม่ใช่ JSON)');
      }

      // Map back to our objects and inject shortName
      const newClusters: ClusterGroup[] = parsedGroups.map((g: any) => {
        const foundItems = (g.items || []).map((aiItem: any) => {
          const original = productList.find(p => p.id === aiItem.id);
          if (original) {
            return { ...original, shortName: aiItem.shortName || original.name };
          }
          return null;
        }).filter(Boolean) as LazadaItem[];
        return {
          categoryName: g.categoryName,
          items: foundItems
        };
      }).filter((g: any) => g.items.length > 0);

      setClusters(newClusters);
      addLog(`✅ จัดกลุ่มเสร็จสิ้น ได้ทั้งหมด ${newClusters.length} หมวดหมู่`);
    } catch (err: any) {
      addLog('❌ AI Error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!modelNameInput.trim()) return alert('กรุณาตั้งชื่อแฟ้มผลงานก่อนอัปโหลดนางแบบ!');

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Downscale image to max 800px to prevent localStorage QuotaExceededError
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 800;
        
        if (width > height && width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
        } else if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);

        const newModel: LazadaModel = {
          id: 'model-' + Date.now(),
          name: modelNameInput.trim(),
          base64: compressedBase64,
          timestamp: Date.now()
        };
        
        try {
            const updated = [newModel, ...savedModels];
            localStorage.setItem('lazada_saved_models', JSON.stringify(updated));
            setSavedModels(updated);
            setSelectedModelId(newModel.id);
            setModelNameInput('');
            addLog(`✨ บันทึกแฟ้มนางแบบ "${newModel.name}" สำเร็จ!`);
        } catch (storageErr) {
            alert('❌ พื้นที่เก็บข้อมูลเบราว์เซอร์เต็ม! (กรุณาลบนางแบบเก่าออกก่อน)');
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteModel = (id: string, name: string) => {
    if (!confirm(`ต้องการลบนางแบบ "${name}" ตลอดกาลหรือไม่?`)) return;
    const updated = savedModels.filter(m => m.id !== id);
    setSavedModels(updated);
    localStorage.setItem('lazada_saved_models', JSON.stringify(updated));
    if (selectedModelId === id) setSelectedModelId(null);
  };

  const handleReviewStyleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!reviewStyleNameInput.trim()) return alert('กรุณาตั้งชื่อสไตล์ก่อนอัปโหลด!');

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 800;
        
        if (width > height && width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
        } else if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);

        const newStyle: LazadaModel = {
          id: 'style-' + Date.now(),
          name: reviewStyleNameInput.trim(),
          base64: compressedBase64,
          timestamp: Date.now()
        };
        
        try {
            const updated = [newStyle, ...savedReviewStyles];
            localStorage.setItem('lazada_saved_review_styles', JSON.stringify(updated));
            setSavedReviewStyles(updated);
            setSelectedReviewStyleId(newStyle.id);
            setReviewStyleNameInput('');
            addLog(`✨ บันทึกสไตล์รีวิว "${newStyle.name}" สำเร็จ!`);
        } catch (storageErr) {
            alert('❌ พื้นที่เก็บข้อมูลเบราว์เซอร์เต็ม! (กรุณาลบของเก่าออกก่อน)');
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteReviewStyle = (id: string, name: string) => {
    if (!confirm(`ต้องการลบสไตล์ "${name}" ตลอดกาลหรือไม่?`)) return;
    const updated = savedReviewStyles.filter(m => m.id !== id);
    setSavedReviewStyles(updated);
    localStorage.setItem('lazada_saved_review_styles', JSON.stringify(updated));
    if (selectedReviewStyleId === id) setSelectedReviewStyleId(null);
  };

  const executeKieGenerationForLazada = async (product: LazadaItem) => {
    const apiKey = getKieApiKey();
    if (!apiKey) return alert("❌ ไม่พบ Kie API Key กรุณาตั้งค่าในแท็บ คลังแสง");
    if (!selectedModelId) return alert("❌ กรุณาเลือกหรืออัปโหลดนางแบบในหน้า Model Studio ก่อน!");
    
    const targetModel = savedModels.find(m => m.id === selectedModelId);
    if (!targetModel) return alert("❌ ไม่พบข้อมูลแฟ้มนางแบบอ้างอิง");

    setGeneratingItemId(product.id);
    addLog(`🎬 กำลังส่งมอบบทให้ AI ตัดต่อภาพสำหรับ: ${product.name.substring(0,25)}...`);

    let outfitPrompt = "wearing an outfit that naturally and organically suits the product";
    if (outfitStyle === 'original') outfitPrompt = "wearing the EXACT SAME outfit as seen in the reference image (strictly keep original)";
    else if (outfitStyle === 'casual') outfitPrompt = "wearing stylish, relaxed casual fashion (e.g. streetwear, jeans, tank top, cap)";
    else if (outfitStyle === 'formal') outfitPrompt = "wearing elegant, professional executive or luxury formal dress";
    else if (outfitStyle === 'home') outfitPrompt = "wearing cozy, comfortable, and aesthetic premium homewear or sweatpants";

    let posePrompt = "striking a natural, candid NEW POSE that realistically incorporates the product";
    if (poseStyle === 'original') posePrompt = "maintaining a pose VERY SIMILAR to the reference image, just naturally integrating the product";

    let tonePrompt = "Strictly extract and replicate the exact photographic color tone, film grain, and authentic lighting from the reference image.";
    if (photoTone === 'korean_ig') tonePrompt = "Shot on a film camera or Fujifilm. VSCO filter, soft aesthetic Korean Instagram lifestyle photography, warm natural sunlight. Natural, slightly imperfect skin textures.";
    else if (photoTone === 'candid') tonePrompt = "Candid everyday snapshot, shot on iPhone. Authentic street photography or home vlog style with natural harsh shadows or raw lighting.";
    else if (photoTone === 'cinematic') tonePrompt = "Cinematic lighting, golden hour / sunset glow, deep authentic shadows, dramatic but hyper-realistic film aesthetic.";
    else {
      const customTone = savedTones.find(t => t.id === photoTone);
      if (customTone) tonePrompt = customTone.prompt;
    }

    let focusPrompt = "She naturally interacts with the product.";
    if (productFocus === 'level_1') focusPrompt = "EXTREMELY SUBTLE: The product is just sitting passively in the background/foreground. She is NOT interacting with it AT ALL. It is barely noticeable, like a hidden easter egg.";
    else if (productFocus === 'level_2') focusPrompt = "INCIDENTAL: The product is resting on a table or nearby. She is not holding it, just casually sitting near it while looking away. Natural ambient placement.";
    else if (productFocus === 'level_3') focusPrompt = "CANDID LIFESTYLE: She is naturally and casually holding or interacting with the product as part of a normal everyday moment. NOT trying to show it to the camera.";
    else if (productFocus === 'level_4') focusPrompt = "SOFT INFLUENCER: She is softly presenting the product to the camera like a casual influencer recommendation. Gently holding it so it is clearly visible but still relaxed.";
    else if (productFocus === 'level_5') focusPrompt = "HARD SELL COMMERCIAL: She is holding the product prominently, directly toward the camera, making sure the label and product are the absolute center of attention.";

    const cleanProductName = product.name.replace(/\[.*?\]|\(.*?\)/g, '');

    const prompt = `Highly authentic, raw, everyday candid lifestyle photograph. NO CGI, NO 3D RENDER, NO PLASTIC AI LOOK.
CORE IDENTITY: A female model matching the EXACT facial identity and natural, authentic facial features of the reference image.
AESTHETICS & CAMERA: ${tonePrompt} Shot with a portrait lens (e.g. 50mm f/1.8). SHALLOW DEPTH OF FIELD, beautifully blurred background (bokeh) to naturally isolate the subject. Avoid infinite focus; background objects like chairs or buildings MUST be out of focus. It must look indistinguishable from a real photo.
ANATOMY & CAPTURE: Perfect natural human anatomy and slim, realistic body proportions (NO bloated belly or visual distortions). Hands and fingers must be natural, casual, and relaxed, avoiding stiff forced poses.
ACTION & POSE: She is ${poseStyle === 'original' ? "maintaining a pose VERY SIMILAR to the reference image" : "striking a natural, candid NEW POSE"}.
OUTFIT: She is ${outfitPrompt}.
PRODUCT INTEGRATION: The product is a "${cleanProductName}". ${focusPrompt} CRITICAL: The product MUST NOT look like an artificially pasted commercial overlay. It must absorb the EXACT ambient lighting, shadow cast, and color grading of the surrounding environment. If the scene has harsh sunlight or deep shadows, the product MUST have the same lighting contrast. Prevent unnatural frontal illumination on the product. The product must physically ground into the scene (casting and receiving shadows) and respect the camera's depth of field.`;
    // Strip base64 header if present, some APIs crash if it's included
    const cleanBase64 = targetModel.base64.split(',')[1] || targetModel.base64;

    let finalPrompt = prompt;
    let targetStylePubUrl = '';

    if (enableReviewOverlay) {
        const targetStyle = savedReviewStyles.find(s => s.id === selectedReviewStyleId);
        if (!targetStyle) {
           setGeneratingItemId(null);
           return alert("❌ คุณเปิดโหมดรีวิว แต่ยังไม่ได้เลือกสไตล์อ้างอิง");
        }
        addLog(`📝 กำลังให้ AI แต่งรีวิวการ์ดเพื่อนำไปแปะ...`);
        try {
           const reviewOverlayPrompt = await fetchReviewTextForPrompt(product);
           finalPrompt += reviewOverlayPrompt;
           
           // Nano banana requires public URL
           if (imageModel === 'nano-banana-pro' || imageModel === 'nano-banana') {
               addLog('🛜 กำลังอัปโหลดภาพสไตล์รีวิวไปยังเซิร์ฟเวอร์ Kie...', 'info');
               const uploadRes = await fetch('https://kieai.riftrunnerai.com/api/file-base64-upload', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                  body: JSON.stringify({
                    base64Data: targetStyle.base64,
                    uploadPath: "images/lazada-reviews",
                    fileName: `review-style-${Date.now()}.png`
                  })
               });
               const uploadData = await uploadRes.json();
               if(uploadData.data?.downloadUrl) targetStylePubUrl = uploadData.data.downloadUrl;
           } else {
               targetStylePubUrl = targetStyle.base64;
           }
        } catch (e: any) {
           addLog(`❌ แต่งรีวิวไม่ผ่าน: ${e.message}`);
           setGeneratingItemId(null);
           return;
        }
    }

    try {
      let inputPayload: any = { prompt: finalPrompt, aspect_ratio: '1:1' };
      
      if (imageModel === 'nano-banana-pro' || imageModel === 'nano-banana') {
        addLog('🛜 กำลังอัปโหลดรูปภาพนางแบบไปยังเซิร์ฟเวอร์ Kie...', 'info');
        
        const uploadRes = await fetch('https://kieai.riftrunnerai.com/api/file-base64-upload', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
           body: JSON.stringify({
             base64Data: targetModel.base64,
             uploadPath: "images/lazada-models",
             fileName: `model-${Date.now()}.png`
           })
        });

        if (!uploadRes.ok) throw new Error("ไม่สามารถอัปโหลดรูปภาพไปยัง Server ได้ (Upload API Error)");
        const uploadData = await uploadRes.json();
        
        if (!uploadData.success || !uploadData.data?.downloadUrl) {
           throw new Error("อัปโหลดรูปภาพล้มเหลว หรือไม่ได้รับ URL รูปภาพจาก Kie API");
        }

        const publicImageUrl = uploadData.data.downloadUrl;
        addLog('✅ อัปโหลดรูปภาพครบถ้วน! กำลังส่งสคริปต์ให้ Nano Banana...', 'success');

        const imageInputs = [publicImageUrl, product.image];
        if (targetStylePubUrl) imageInputs.push(targetStylePubUrl);

        inputPayload = {
           prompt: finalPrompt,
           image_input: imageInputs,
           aspect_ratio: '1:1',
           resolution: '1K',
           output_format: 'png'
        };
      } else {
        inputPayload = {
           prompt: finalPrompt,
           image: cleanBase64,
           init_image: cleanBase64,
           aspect_ratio: '1:1',
           quality: 'basic'
        };
        // If not nano-banana, usually only supports 1 init image
        if (targetStylePubUrl && (imageModel.includes('seedream') || imageModel.includes('recraft'))) {
           inputPayload.image_input = [targetModel.base64, product.image, targetStylePubUrl];
        }
      }

      const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: imageModel, input: inputPayload })
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`API HTTP Error ${createRes.status}: ${errText.substring(0, 100)}`);
      }
      const createData = await createRes.json();
      const taskId = createData?.data?.taskId || createData?.taskId;
      if (!taskId) throw new Error(`API ปฏิเสธ (ไม่มี Task ID): ${JSON.stringify(createData).substring(0, 120)}`);

      addLog(`⏳ ผู้กำกับสั่งแอคชั่น! รอรูป... (Task: ${taskId.substring(0,6)})`);
      let attempt = 0;
      while (attempt < 40) {
        await new Promise(res => setTimeout(res, 2500));
        const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
          method: 'GET', headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const pollData = await pollRes.json();
        const state = pollData?.data?.state?.toLowerCase() || pollData?.state?.toLowerCase();

        if (state === 'success' || state === 'completed') {
            let imgUrl: string | null = null;
            
            // 1. Try resultJson (often used by Kie)
            const resultJsonStr = pollData?.data?.resultJson || pollData?.resultJson;
            if (resultJsonStr) {
               try {
                  const parsed = typeof resultJsonStr === 'string' ? JSON.parse(resultJsonStr) : resultJsonStr;
                  imgUrl = parsed.images?.[0]?.url || parsed.url || parsed.resultUrls?.[0] || parsed.imageUrl || parsed.output?.url || parsed.image_url;
               } catch (e) {}
            }
            
            // 2. Try direct keys
            if (!imgUrl) {
               imgUrl = pollData?.data?.output?.url || pollData?.data?.resultUrl || pollData?.data?.url || pollData?.data?.imageUrl || pollData?.data?.image_url;
            }
            
            // 3. Try images array
            if (!imgUrl) {
               const rawImages = pollData?.data?.output?.images || pollData?.data?.images || pollData?.data?.output?.image_urls || [];
               imgUrl = rawImages[0]?.url || rawImages[0];
            }

            if (imgUrl && typeof imgUrl === 'string') {
                setGeneratedAds(prev => ({...prev, [product.id]: imgUrl}));
                addLog(`✅ ถ่ายทำเสร็จสิ้น! ได้รูปผลลัพธ์ของ ${product.name.substring(0,10)} แล้ว!`);
                setGeneratingItemId(null);
                return;
            }
            throw new Error(`สร้างเสร็จแต่ดึง URL ไม่ได้ แจ้งนายช่างที: ${JSON.stringify(pollData).substring(0, 150)}`);
        } else if (state === 'failed' || state === 'error') {
            throw new Error("ตัวแบบไม่สามารถถ่ายทำได้ (API Failed)");
        }
        attempt++;
      }
      throw new Error("ช่างภาพทำงานนานเกินไป");
    } catch(err: any) {
      addLog(`❌ ขัดข้อง: ${err.message}`);
      setGeneratingItemId(null);
    }
  };

  // ════════════════════════════════════════════════════
  // NEW: Product-Only Mode — ถ่ายสินค้าเดี่ยวในฉากธรรมชาติ
  // ════════════════════════════════════════════════════
  const executeProductOnlyGeneration = async (product: LazadaItem) => {
    const apiKey = getKieApiKey();
    if (!apiKey) return alert("❌ ไม่พบ Kie API Key กรุณาตั้งค่าก่อน");

    setGeneratingItemId(product.id);
    const cleanName = product.name.replace(/\[.*?\]|\(.*?\)/g, '');

    const sceneMap: Record<string, string> = {
      lifestyle: 'on a warm, textured wooden table in a cozy minimal living room with soft natural window light, a small potted plant nearby',
      minimal: 'on a clean white marble surface, isolated product shot, bright studio diffused lighting, subtle shadows',
      outdoor: 'resting on aged stone steps in a botanical garden, morning golden light, shallow depth of field, natural greenery',
      kitchen: 'on a marble kitchen countertop near a window, natural morning sunlight streaming in, a cup of coffee and fresh flowers nearby',
      bathroom: 'on a clean spa-style bathroom shelf with white towels, eucalyptus sprigs, soft ambient light, calm and fresh aesthetic',
    };

    const sceneDesc = sceneMap[sceneStyle] || sceneMap.lifestyle;

    let basePrompt = `Ultra-realistic, editorial commercial product photography shot on Canon R5 with 85mm f/1.4 lens.
The product "${cleanName}" is placed ${sceneDesc}.
PHOTOGRAPHY STYLE: Professional e-commerce product photography. Shallow depth of field with beautiful bokeh background. The product is the hero of the frame, shot at a natural 3/4 angle.
LIGHTING: Natural, authentic lighting with soft directional light. Product must have realistic reflections, micro-shadows, and ambient light interaction. ABSOLUTELY NO CGI, NO 3D RENDER look.
CRITICAL: The product must look real and grounded — casting natural shadows on the surface. Respect material textures (glass reflections, matte surfaces, plastic sheen). The scene must feel like a REAL photograph taken for a luxury lifestyle magazine, not an AI render.`;

    let finalPrompt = basePrompt;
    let targetStylePubUrl = '';

    if (enableReviewOverlay) {
        const targetStyle = savedReviewStyles.find(s => s.id === selectedReviewStyleId);
        if (!targetStyle) {
           setGeneratingItemId(null);
           return alert("❌ คุณเปิดโหมดรีวิว แต่ยังไม่ได้เลือกสไตล์อ้างอิง");
        }
        addLog(`📝 กำลังให้ AI แต่งรีวิวการ์ดเพื่อนำไปแปะ...`);
        try {
           const reviewOverlayPrompt = await fetchReviewTextForPrompt(product);
           finalPrompt += reviewOverlayPrompt;
           
           if (imageModel === 'nano-banana-pro' || imageModel === 'nano-banana') {
               addLog('🛜 กำลังอัปโหลดภาพสไตล์รีวิวไปยังเซิร์ฟเวอร์ Kie...', 'info');
               const uploadRes = await fetch('https://kieai.riftrunnerai.com/api/file-base64-upload', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                  body: JSON.stringify({
                    base64Data: targetStyle.base64,
                    uploadPath: "images/lazada-reviews",
                    fileName: `review-style-${Date.now()}.png`
                  })
               });
               const uploadData = await uploadRes.json();
               if(uploadData.data?.downloadUrl) targetStylePubUrl = uploadData.data.downloadUrl;
           } else {
               targetStylePubUrl = targetStyle.base64;
           }
        } catch (e: any) {
           addLog(`❌ แต่งรีวิวไม่ผ่าน: ${e.message}`);
           setGeneratingItemId(null);
           return;
        }
        addLog(`✅ ได้คำรีวิวแล้ว! ส่งช่างภาพถ่ายสินค้ารวมป้าย...`);
    }

    try {
      const imageInputs = [product.image];
      if (targetStylePubUrl) imageInputs.push(targetStylePubUrl);

      const inputPayload = {
        prompt: finalPrompt,
        image_input: imageInputs,
        aspect_ratio: '1:1',
        resolution: '1K',
        output_format: 'png'
      };

      const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: imageModel, input: inputPayload })
      });

      if (!createRes.ok) throw new Error(`API HTTP Error ${createRes.status}`);
      const createData = await createRes.json();
      const taskId = createData?.data?.taskId || createData?.taskId;
      if (!taskId) throw new Error('ไม่ได้รับ Task ID');

      addLog(`⏳ ถ่ายสินค้าอยู่... (Task: ${taskId.substring(0,6)})`);
      let attempt = 0;
      while (attempt < 40) {
        await new Promise(res => setTimeout(res, 2500));
        const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
          method: 'GET', headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const pollData = await pollRes.json();
        const state = pollData?.data?.state?.toLowerCase() || pollData?.state?.toLowerCase();

        if (state === 'success' || state === 'completed') {
          let imgUrl: string | null = null;
          const resultJsonStr = pollData?.data?.resultJson || pollData?.resultJson;
          if (resultJsonStr) {
            try {
              const parsed = typeof resultJsonStr === 'string' ? JSON.parse(resultJsonStr) : resultJsonStr;
              imgUrl = parsed.images?.[0]?.url || parsed.url || parsed.resultUrls?.[0] || parsed.imageUrl || parsed.output?.url || parsed.image_url;
            } catch (e) {}
          }
          if (!imgUrl) imgUrl = pollData?.data?.output?.url || pollData?.data?.resultUrl || pollData?.data?.url;
          if (!imgUrl) {
            const rawImages = pollData?.data?.output?.images || pollData?.data?.images || [];
            imgUrl = rawImages[0]?.url || rawImages[0];
          }
          if (imgUrl && typeof imgUrl === 'string') {
            setGeneratedAds(prev => ({...prev, [product.id]: imgUrl}));
            addLog(`✅ ถ่ายสินค้าเสร็จ! ${product.name.substring(0,15)}...`);
            setGeneratingItemId(null);
            return;
          }
          throw new Error('สร้างเสร็จแต่ดึง URL ไม่ได้');
        } else if (state === 'failed' || state === 'error') {
          throw new Error('API Failed');
        }
        attempt++;
      }
      throw new Error('Timeout');
    } catch (err: any) {
      addLog(`❌ ${err.message}`);
      setGeneratingItemId(null);
    }
  };



  const exportToDropboxAndCSV = async () => {
    if (selectedItems.size === 0) return alert('❌ กรุณาเลือกสินค้าที่ต้องการส่งออกอย่างน้อย 1 รายการ (ติ๊กถูกที่มุมซ้ายบนของรูป)');
    
    const dbxKey = localStorage.getItem('dropbox_api_key');
    if (!dbxKey) return alert('❌ กรุณาเชื่อมต่อ Dropbox ในหน้าตั้งค่าโปรแกรมก่อน');
    
    const currentClusters = viewMode === 'new' ? clusters : savedClusters;
    if (currentClusters.length === 0) return alert('ไม่มีรายการสินค้า');

    const folder = dropboxFolder.trim() || '/Lazada_Export_' + new Date().toISOString().split('T')[0];
    
    setIsProcessing(true);
    addLog(`กำลังเริ่มแบทช์อัปโหลดไปที่ ${folder} ...`);

    const csvRows: any[] = [];
    let successCount = 0;

    for (const cluster of currentClusters) {
       for (const item of cluster.items) {
          if (!selectedItems.has(item.id)) continue;
          const imgUrl = generatedAds[item.id] || generatedReviews[item.id] || item.image;
          if (!imgUrl || imgUrl === 'https://via.placeholder.com/150?text=No+Image') continue;

          try {
             addLog(`กำลังดาวน์โหลด ${item.name.substring(0,10)}...`);
             let blob: Blob | null = null;
             const proxies = [
                imgUrl,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(imgUrl)}`,
                `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(imgUrl)}`,
                `https://corsproxy.io/?${encodeURIComponent(imgUrl)}`
             ];
             for (const pUrl of proxies) {
                 try {
                     const res = await fetch(pUrl);
                     if (res.ok) {
                         blob = await res.blob();
                         break;
                     }
                 } catch (e: any) {}
             }
             if (!blob) throw new Error(`Failed to download via all proxies.`);

             const ext = blob.type.split('/')[1] || 'png';
             const cleanName = (item.shortName || item.name).replace(/[^a-zA-Z0-9ก-๙]/g, '_').substring(0, 30);
             const dbxPath = `${folder}/${cleanName}_${Date.now()}.${ext}`;

             addLog(`กำลังอัปโหลดขึ้น Dropbox: ${dbxPath}`);
             
             let aiCaption = "";
             if (enableCaption) {
                 addLog(`📝 กำลังร่างแคปชั่น AI ให้ ${item.name.substring(0,10)}...`);
                 try {
                     const { openRouterKey } = getApiKeys();
                     if (openRouterKey) {
                         let lenInstruction = 'ความยาวปานกลาง 3-4 บรรทัด';
                         if (captionLength === 'short') lenInstruction = 'สั้นกระชับ 1-2 ประโยคก็พอ เน้นใจความสำคัญ';
                         if (captionLength === 'long') lenInstruction = 'จัดเต็ม เล่าสตอรี่ยาวๆ 5-8 บรรทัด';
                         
                         const prompt = `เขียนแคปชั่นโซเชียลมีเดียสำหรับสินค้า: "${item.name}"\nสไตล์/เงื่อนไข: ${captionPrompt}\nความยาว: ${lenInstruction}\n*บังคับ: ตอบกลับเฉพาะเนื้อหาแคปชั่นล้วนๆ ห้ามมีคำอธิบายอื่นๆ นอกเหนือจากแคปชั่น*`;
                         
                         const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                               model: 'google/gemini-2.5-flash',
                               messages: [{ role: 'user', content: prompt }]
                            })
                         });
                         if (res.ok) {
                             const data = await res.json();
                             aiCaption = data.choices[0].message.content.trim();
                         } else {
                             addLog(`⚠️ พลาดเขียนแคปชั่น ${item.name} (${res.status})`);
                         }
                     } else {
                         addLog('⚠️ ไม่ได้ใส่ OpenRouter API Key เลยข้ามการเขียนแคปชั่น');
                     }
                 } catch (err: any) {
                     addLog(`⚠️ Error เขียนแคปชั่น: ${err.message}`);
                 }
             }

             const uploadRes = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                   'Authorization': `Bearer ${dbxKey}`,
                   'Dropbox-API-Arg': JSON.stringify({
                      path: dbxPath,
                      mode: 'add',
                      autorename: true,
                      mute: false
                   }),
                   'Content-Type': 'application/octet-stream'
                },
                body: blob
             });

             if (!uploadRes.ok) {
                 const errText = await uploadRes.text();
                 throw new Error(`Dropbox Upload Failed (Status ${uploadRes.status}): ${errText}`);
             }
             const uploadData = await uploadRes.json();

             const shareRes = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
                method: 'POST',
                headers: {
                   'Authorization': `Bearer ${dbxKey}`,
                   'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                   path: uploadData.path_display,
                   settings: { requested_visibility: "public" }
                })
             });

             let dpLink = '';
             if (shareRes.ok) {
                 const shareData = await shareRes.json();
                 dpLink = shareData.url.replace('dl=0', 'dl=1');
                 if (!dpLink.includes('dl=1')) dpLink += '&dl=1';
             } else {
                 const shareErr = await shareRes.json();
                 if (shareErr.error?.['.tag'] === 'shared_link_already_exists') {
                     dpLink = 'already_shared_need_manual_check';
                 }
             }

             csvRows.push({
                 "ชื่อเดิม": item.name,
                 "ชื่อสั้น (AI)": cleanName,
                 "แคปชั่น (AI)": aiCaption,
                 "Dropbox Link (dl=1)": dpLink,
                 "Affiliate Link": item.link,
                 "หมวดหมู่": cluster.categoryName
             });
             successCount++;

          } catch (e: any) {
             addLog(`❌ พลาดการอัปโหลด ${item.name.substring(0,10)}: ${e.message}`);
          }
       }
    }

    if (csvRows.length > 0) {
       addLog(`กำลังสร้างไฟล์ CSV (${successCount} รายการ)...`);
       const ws = XLSX.utils.json_to_sheet(csvRows);
       const wb = XLSX.utils.book_new();
       XLSX.utils.book_append_sheet(wb, ws, "Export");
       XLSX.writeFile(wb, `Lazada_Export_${Date.now()}.csv`);
       addLog(`✅ เสร็จสิ้น! ดาวน์โหลด CSV เรียบร้อย`);
    } else {
       addLog(`⚠️ ไม่มีข้อมูลที่ส่งออกได้ (แน่ใจหรือว่ามีรูปที่เทคผ่านแล้ว?)`);
    }
    
    setIsProcessing(false);
  };

  const executeBulkGeneration = async (itemsList: LazadaItem[]) => {
      if (itemsList.length === 0) return;
      if (generatingItemId) return alert('❌ กรุณารอให้คิวปัจจุบันเสร็จก่อนครับ');

      addLog(`✨ เริ่มถ่ายภาพพรีเซนเตอร์แบบมาราธอน (${itemsList.length} รูป)...`);
      for (const item of itemsList) {
         if (shootMode === 'model') {
            await executeKieGenerationForLazada(item);
         } else {
            await executeProductOnlyGeneration(item);
         }
      }
      addLog(`✨ ถ่ายทำมาราธอนเสร็จสิ้นทั้ง ${itemsList.length} รูป! 🎉`);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-3xl">🛒</span> Lazada Affiliate Factory
          </h2>
        </div>
        <p className="text-sm opacity-70 mb-6">อัปโหลดไฟล์ data_promo_list.xlsx ระบบจะจัดกลุ่มสินค้าให้อัตโนมัติด้วย AI</p>

        {/* ═══ MODE SELECTOR ═══ */}
        <div className="mb-6 p-4 bg-[var(--surface)] rounded-xl border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold opacity-60 uppercase tracking-wider">🎯 เลือกโหมดสร้างภาพหลัก</div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {([
              { id: 'model' as const, icon: '👩‍🎤', label: 'นางแบบถือสินค้า', desc: 'AI สร้างนางแบบจับสินค้า', color: 'pink' },
              { id: 'product_only' as const, icon: '📦', label: 'สินค้าเดี่ยว', desc: 'วางสินค้าในฉากธรรมชาติ ไม่มีคน', color: 'blue' },
            ]).map(mode => (
              <button
                key={mode.id}
                onClick={() => setShootMode(mode.id)}
                className={`p-4 rounded-xl text-left transition-all border-2 ${
                  shootMode === mode.id
                    ? (mode.color === 'pink' ? 'border-pink-500 bg-pink-500/10 shadow-lg shadow-pink-500/10'
                      : 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10')
                    : 'border-transparent bg-[var(--bg-card)] hover:border-[var(--border-color)]'
                }`}
              >
                <div className="text-2xl mb-2">{mode.icon}</div>
                <div className="text-sm font-bold">{mode.label}</div>
                <div className="text-[10px] opacity-60 mt-1">{mode.desc}</div>
              </button>
            ))}
          </div>

          <div 
             className={`p-3 rounded-xl border-2 transition-colors cursor-pointer flex items-center justify-between ${enableReviewOverlay ? 'border-amber-500 bg-amber-500/10' : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--border-color)]/70'}`}
             onClick={() => setEnableReviewOverlay(!enableReviewOverlay)}
          >
             <div className="flex items-center gap-3">
                <div className="text-2xl">⭐</div>
                <div>
                   <div className={`text-sm font-bold ${enableReviewOverlay ? 'text-amber-500' : 'text-gray-400'}`}>แปะข้อความรีวิวลงในภาพด้วย (AI Review Overlay)</div>
                   <div className="text-[10px] opacity-60 mt-0.5">เสริมพลังการขายด้วยข้อความรีวิว, ให้คะแนน, พร้อมข้อดี/ข้อเสียบนรูป</div>
                </div>
             </div>
             <div className={`w-12 h-6 rounded-full p-1 transition-colors border ${enableReviewOverlay ? 'bg-amber-500 border-amber-500' : 'bg-gray-400/20 border-[var(--border-color)]'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${enableReviewOverlay ? 'translate-x-6' : 'translate-x-0'}`}></div>
             </div>
          </div>

          {/* Product-Only Scene Selector */}
          {shootMode === 'product_only' && (
            <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold opacity-70">🏠 ฉาก:</span>
              {([
                { id: 'lifestyle', label: '🛋️ ห้องนั่งเล่น' },
                { id: 'minimal', label: '⬜ มินิมอลขาว' },
                { id: 'outdoor', label: '🌿 กลางแจ้ง' },
                { id: 'kitchen', label: '🍳 ห้องครัว' },
                { id: 'bathroom', label: '🛁 ห้องน้ำ/สปา' },
              ]).map(scene => (
                <button
                  key={scene.id}
                  onClick={() => setSceneStyle(scene.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    sceneStyle === scene.id
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-blue-400'
                  }`}
                >
                  {scene.label}
                </button>
              ))}
            </div>
          )}

          {/* Review Card Style Selector */}
          {enableReviewOverlay && (
            <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-800/50">
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs font-bold text-amber-700 dark:text-amber-500">📝 โทนคำพูดสำหรับรีวิว:</div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">ความยาว:</span>
                  <select 
                    value={reviewLength} 
                    onChange={e => setReviewLength(e.target.value as 'short' | 'medium' | 'long')}
                    className="text-[10px] px-2 py-1 rounded bg-white dark:bg-black border border-amber-300 dark:border-amber-700 outline-none text-amber-800 dark:text-amber-300"
                  >
                    <option value="short">สั้นกระชับ (1 ประโยค)</option>
                    <option value="medium">กำลังดี (2-3 ประโยค)</option>
                    <option value="long">เล่าละเอียด (4-5 ประโยค)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {([
                  { id: 'secret_find' as const, icon: '🤫', label: 'ของลับ ลายแทง', desc: 'ตื่นเต้น กระตุ้นอยากได้' },
                  { id: 'recommend' as const, icon: '💬', label: 'Recommend', desc: 'แนะนำจริงใจ' },
                  { id: 'rating' as const, icon: '⭐', label: 'ให้คะแนน', desc: 'ดาว + เหตุผล' },
                  { id: 'pros_cons' as const, icon: '⚖️', label: 'ข้อดี vs ข้อเสีย', desc: 'วิเคราะห์ตรงๆ' },
                ]).map(style => (
                  <button
                    key={style.id}
                    onClick={() => setReviewStyle(style.id)}
                    className={`p-3 rounded-lg text-left transition-all border ${
                      reviewStyle === style.id
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-amber-300'
                    }`}
                  >
                    <div className="text-lg">{style.icon}</div>
                    <div className="text-xs font-bold mt-1">{style.label}</div>
                    <div className="text-[9px] opacity-50">{style.desc}</div>
                  </button>
                ))}
              </div>
              {/* Review Card Style Selector */}
              <div className="mt-4 p-4 bg-[var(--bg-card)] border border-amber-500/30 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                 <div className="flex justify-between items-end mb-4">
                    <div>
                      <h4 className="text-sm font-bold flex items-center gap-2 text-amber-500">
                        🖼️ Review Style Studio <span className="text-xs font-normal text-[var(--text-muted)] bg-[var(--bg-main)] px-2 py-0.5 rounded-full border border-[var(--border-color)] flex-shrink-0">สไตล์อ้างอิง ({savedReviewStyles.length})</span>
                      </h4>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">อัปโหลดภาพป้ายรีวิวที่ชอบ เพื่อให้ AI วาดออกมาในสไตล์เดียวกันเป๊ะ (AI จะเอาข้อความภาษาไทยไปวางให้ด้วย)</p>
                    </div>
                    <div className="flex gap-2">
                       <input 
                         type="text" 
                         placeholder="ตั้งชื่อสไตล์..." 
                         value={reviewStyleNameInput}
                         onChange={e => setReviewStyleNameInput(e.target.value)}
                         className="text-xs px-2 py-1.5 rounded-lg border border-amber-500/30 outline-none focus:ring-2 focus:ring-amber-500 w-32 bg-[var(--bg-main)] text-[var(--text-main)]"
                       />
                       <button onClick={() => reviewStyleUploadRef.current?.click()} className="text-[10px] font-bold px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors">
                          ➕ อัปโหลดสไตล์
                       </button>
                       <input type="file" accept="image/jpeg, image/png, image/webp" className="hidden" ref={reviewStyleUploadRef} onChange={handleReviewStyleUpload} />
                    </div>
                 </div>

                 <div className="flex items-center gap-4 overflow-x-auto pb-2 custom-scrollbar">
                    {savedReviewStyles.length === 0 ? (
                       <div className="text-[10px] text-gray-400 italic py-2">ยังไม่มีภาพสไตล์อ้างอิง...</div>
                    ) : savedReviewStyles.map(style => (
                       <div key={style.id} className="flex flex-col items-center gap-1 group relative flex-shrink-0 cursor-pointer" onClick={() => setSelectedReviewStyleId(style.id)}>
                          <div className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all duration-300 shadow-sm ${selectedReviewStyleId === style.id ? 'border-amber-500 scale-105 shadow-amber-500/30' : 'border-transparent scale-100 hover:border-amber-500/50'}`}>
                             <img src={style.base64} className="w-full h-full object-cover" />
                          </div>
                          <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${selectedReviewStyleId === style.id ? 'bg-amber-500 text-white' : 'bg-[var(--bg-main)] text-[var(--text-muted)] border border-[var(--border-color)]'}`}>
                             {style.name}
                          </div>
                          <button 
                             onClick={(e) => { e.stopPropagation(); handleDeleteReviewStyle(style.id, style.name); }}
                             className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity font-bold shadow-md hover:bg-red-600"
                          >
                             ✕
                          </button>
                       </div>
                    ))}
                 </div>
              </div>
              
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-500">🤖 AI Engine:</span>
                <select 
                  value={imageModel} 
                  onChange={(e) => setImageModel(e.target.value)}
                  className="text-[11px] px-2 py-1 rounded bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-color)] outline-none w-48"
                >
                  <option value="nano-banana-pro">🍌 Nano Banana Pro (แนะนำทับภาษาไทย)</option>
                  <option value="seedream/4.5-text-to-image">🎨 Seedream 4.5</option>
                  <option value="recraft/image-to-image">✨ Recraft Image</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* --- MODEL STUDIO (show only in model mode) --- */}
        {shootMode === 'model' && (
        <div className="mb-8 p-6 bg-[var(--bg-card)] border border-pink-500/30 rounded-xl shadow-[0_0_15px_rgba(236,72,153,0.05)]">
           <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-pink-500">
                  👩‍🎤 Model Studio <span className="text-xs font-normal flex-shrink-0 text-gray-400 bg-[var(--bg-main)] px-2 py-0.5 rounded-full border border-[var(--border-color)]">แฟ้มผลงานอ้างอิง ({savedModels.length})</span>
                </h3>
                <p className="text-xs text-gray-500 mt-1">ตั้งชื่อและอัปโหลดรูปนางแบบ เพื่อใช้เป็นแบบ AI ถ่ายโฆษณาสินค้าด้านล่าง</p>
              </div>
              <div className="flex gap-2">
                 <input 
                   type="text" 
                   placeholder="ตั้งชื่อโมเดล..." 
                   value={modelNameInput}
                   onChange={e => setModelNameInput(e.target.value)}
                   className="text-sm px-3 py-1.5 rounded-lg border border-pink-500/30 outline-none focus:ring-2 focus:ring-pink-500 w-40 bg-[var(--bg-main)] text-[var(--text-main)]"
                 />
                 <button onClick={() => modelUploadRef.current?.click()} className="text-xs font-bold px-4 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors shadow-none">
                    ➕ อัปโหลดนางแบบอ้างอิง
                 </button>
                 <input type="file" accept="image/jpeg, image/png, image/webp" className="hidden" ref={modelUploadRef} onChange={handleModelUpload} />
              </div>
           </div>

           <div className="flex items-center gap-4 overflow-x-auto pb-4 custom-scrollbar">
              {savedModels.length === 0 ? (
                 <div className="text-xs text-gray-400 italic py-4">ยังไม่มีนางแบบในสังกัด... อัปโหลดรูปอ้างอิงเพื่อเริ่มต้นเลย</div>
              ) : savedModels.map(model => (
                 <div key={model.id} className="flex flex-col items-center gap-1 group relative flex-shrink-0 cursor-pointer" onClick={() => setSelectedModelId(model.id)}>
                    <div className={`w-16 h-16 rounded-full overflow-hidden border-4 transition-all duration-300 shadow-sm ${selectedModelId === model.id ? 'border-pink-500 scale-105 shadow-pink-500/30' : 'border-white dark:border-gray-800 scale-100 hover:border-pink-300'}`}>
                       <img src={model.base64} className="w-full h-full object-cover" />
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedModelId === model.id ? 'bg-pink-500 text-white' : 'bg-[var(--bg-main)] text-[var(--text-muted)] border border-[var(--border-color)]'}`}>
                       {model.name}
                    </div>
                    <button 
                       onClick={(e) => { e.stopPropagation(); handleDeleteModel(model.id, model.name); }}
                       className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity font-bold shadow-md hover:bg-red-600"
                    >
                       ✕
                    </button>
                 </div>
              ))}
           </div>
           
           <div className="mt-2 flex flex-col gap-2 border-t border-pink-200 dark:border-pink-800/50 pt-3">
             <div className="flex flex-wrap items-center gap-3">
                 <div className="flex items-center gap-2">
                   <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">🤖 AI Model:</span>
                   <select 
                     value={imageModel} 
                     onChange={(e) => setImageModel(e.target.value)}
                     className="text-[11px] px-2 py-1 rounded bg-white dark:bg-black border border-gray-300 dark:border-gray-700 outline-none w-48"
                   >
                     <option value="nano-banana-pro">🍌 Nano Banana Pro (แนะนำ)</option>
                     <option value="nano-banana">🍌 Nano Banana (ปกติ)</option>
                     <option value="seedream/4.5-text-to-image">🎨 Seedream 4.5</option>
                     <option value="flux2/flex-image-to-image">🌊 Flux-2 Image</option>
                     <option value="recraft/image-to-image">✨ Recraft Image</option>
                   </select>
                 </div>

                 <div className="flex items-center gap-2">
                   <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">👗 ชุดนางแบบ:</span>
                   <select 
                     value={outfitStyle} 
                     onChange={(e) => setOutfitStyle(e.target.value)}
                     className="text-[11px] px-2 py-1 rounded bg-white dark:bg-black border border-gray-300 dark:border-gray-700 outline-none w-36"
                   >
                     <option value="auto">🌟 เข้ากับสินค้า (AI คิดให้)</option>
                     <option value="original">🎯 ชุดเดิมแบบเป๊ะๆ</option>
                     <option value="casual">👕 ชุดเดินเล่น ลำลอง</option>
                     <option value="formal">👔 ชุดทำงาน หรูหรา</option>
                     <option value="home">🏡 ชุดอยู่บ้าน สบายๆ</option>
                   </select>
                 </div>

                 <div className="flex items-center gap-2">
                   <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">🧍‍♀️ ท่าทางโพส:</span>
                   <select 
                     value={poseStyle} 
                     onChange={(e) => setPoseStyle(e.target.value)}
                     className="text-[11px] px-2 py-1 rounded bg-white dark:bg-black border border-gray-300 dark:border-gray-700 outline-none w-40"
                   >
                     <option value="dynamic">✨ ปล่อยให้โพสธรรมชาติ</option>
                     <option value="original">📌 ยึดท่าโพสเดิมเป๊ะๆ</option>
                   </select>
                 </div>

                 <div className="flex items-center gap-2">
                   <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">📸 Mood & Tone:</span>
                   <select 
                     value={photoTone} 
                     onChange={(e) => setPhotoTone(e.target.value)}
                     className="text-[11px] px-2 py-1 rounded bg-white dark:bg-black border border-pink-300 dark:border-pink-700 outline-none w-44 font-bold text-pink-600 dark:text-pink-400"
                   >
                     <option value="korean_ig">🌸 กล้องฟิล์ม / สไตล์ IG เกาหลี</option>
                     <option value="candid">📱 แอบถ่ายสมจริง (iPhone)</option>
                     <option value="cinematic">🌅 แสงเย็น / Golden Hour</option>
                     <option value="auto">🎯 ดึงแสงสีรูปเดิม 100%</option>
                     {savedTones.map(tone => (
                       <option key={tone.id} value={tone.id}>🎨 {tone.name}</option>
                     ))}
                     <option value="new_custom">➕ สร้างโทนใหม่...</option>
                   </select>
                 </div>

                 <div className="flex items-center gap-2">
                   <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">📦 ความเนียนขายของ:</span>
                   <select 
                     value={productFocus} 
                     onChange={(e) => setProductFocus(e.target.value)}
                     className="text-[11px] px-2 py-1 rounded bg-white dark:bg-black border border-green-300 dark:border-green-700 outline-none w-56 font-bold text-green-700 dark:text-green-500"
                   >
                     <option value="level_1">🥷 Lv.1 วางแอบๆ เนียนสุดๆ (Easter Egg)</option>
                     <option value="level_2">🪴 Lv.2 วางข้างๆ ไม่หยิบจับ (ประกอบฉาก)</option>
                     <option value="level_3">☕ Lv.3 ถือ/ใช้งาน เผลอๆ ธรรมชาติ</option>
                     <option value="level_4">✨ Lv.4 ถือโชว์แบบ Influencer (พอดีๆ)</option>
                     <option value="level_5">📢 Lv.5 หันโลโก้ยัดใส่กล้อง! (โชว์เต็มตา)</option>
                   </select>
                 </div>
             </div>

             {photoTone === 'new_custom' && (
               <div className="flex flex-col gap-2 p-2 bg-pink-500/10 rounded border border-pink-500/30 border-dashed mt-1">
                 <input 
                   type="text" 
                   value={customToneName}
                   onChange={e => setCustomToneName(e.target.value)}
                   placeholder="ชื่อโทนภาพ (เช่น โทนดาร์กมืดๆ)"
                   className="text-xs p-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-black outline-none w-full"
                 />
                 <input 
                   type="text" 
                   value={customToneText}
                   onChange={e => setCustomToneText(e.target.value)}
                   placeholder="คีย์เวิร์ดภาษาอังกฤษ เช่น Shot on 35mm film, dark dramatic lighting..."
                   className="text-xs p-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-black outline-none w-full"
                 />
                 <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setPhotoTone('korean_ig')}
                      className="px-2 py-1 text-[10px] text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                    >
                      ยกเลิก
                    </button>
                    <button 
                      onClick={() => {
                        if (!customToneName || !customToneText) return;
                        const newTone = { id: 'tone_' + Date.now(), name: customToneName, prompt: customToneText };
                        const updated = [...savedTones, newTone];
                        setSavedTones(updated);
                        localStorage.setItem('kie_saved_tones', JSON.stringify(updated));
                        setPhotoTone(newTone.id);
                        setCustomToneName('');
                        setCustomToneText('');
                      }}
                      className="px-2 py-1 text-[10px] bg-pink-500 text-white rounded hover:bg-pink-600"
                    >
                      💾 บันทึกโทนนี้
                    </button>
                 </div>
               </div>
             )}

             <div className="text-[10px] text-pink-500/80 bg-pink-500/10 px-2 py-1 rounded border border-pink-500/30 flex items-center gap-1.5 w-fit">
                 <span className="text-sm">📸</span> 
                 <b>Anti-AI Gloss Engine:</b> บังคับปิดความเนียนระดับ 3D Render และสั่งให้ Product กลืนไปกับเงาแสงแวดล้อมเพื่อความสมจริงขั้นสุด!
             </div>
           </div>

        </div>
        )}
        {/* --- MODEL STUDIO END --- */}

        {/* --- INLINE CONSOLE LOG --- */}
        <div className="mt-4 mb-8 bg-gray-900 dark:bg-black rounded-xl border border-gray-700 shadow-inner flex flex-col overflow-hidden max-h-48">
           <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              <span className="text-[10px] font-mono text-gray-400 ml-2">📝 AI Generation Logs</span>
              {logs.length > 0 && <button onClick={() => setLogs([])} className="ml-auto text-[9px] text-gray-500 hover:text-red-400 font-bold">ล้าง</button>}
           </div>
           <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1 bg-gray-900 custom-scrollbar flex flex-col-reverse">
              {logs.length === 0 ? (
                 <div className="text-gray-600 text-center py-4">รอคำสั่งจากผู้กำกับ...</div>
              ) : logs.map((log, i) => (
                 <div key={i} className={`whitespace-pre-wrap ${log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : 'text-gray-300'}`}>
                    {log}
                 </div>
              ))}
           </div>
        </div>

        {/* Top Navigation for Lazada Tab */}
        <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
          <div className="flex gap-4">
            <button 
              onClick={() => setViewMode('new')}
              className={`px-6 py-2 rounded-xl font-bold transition-all ${viewMode === 'new' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}
            >
              🆕 อัปโหลด & สร้างกลุ่มใหม่
            </button>
            <button 
              onClick={() => setViewMode('saved')}
              className={`px-6 py-2 rounded-xl font-bold transition-all ${viewMode === 'saved' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}
            >
              💾 กลุ่มที่บันทึกไว้ ({savedClusters.length})
            </button>
          </div>
          
          <div className="flex flex-col gap-3 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-xl border border-blue-200 dark:border-blue-800/50 w-full lg:w-auto">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold text-blue-700 dark:text-blue-400">📦 Export & Dropbox</span>
              <input 
                 type="text" 
                 placeholder="ชื่อ Folder (เช่น /Promos/April)"
                 value={dropboxFolder}
                 onChange={e => setDropboxFolder(e.target.value)}
                 className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-700/50 outline-none focus:ring-2 focus:ring-blue-500 w-48 dark:bg-black"
              />
              <button
                 onClick={exportToDropboxAndCSV}
                 disabled={isProcessing}
                 className={`text-xs font-bold px-4 py-1.5 ${isProcessing ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5`}
              >
                 <span>📥</span> {isProcessing ? 'กำลังส่งออก...' : 'ส่งออกรูปเข้า Dropbox + โหลด CSV'}
              </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-blue-200 dark:border-blue-800/50">
               <label className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 dark:text-blue-400 cursor-pointer">
                  <input type="checkbox" checked={enableCaption} onChange={e => setEnableCaption(e.target.checked)} className="rounded border-blue-300 text-blue-600 focus:ring-blue-500" />
                  ✨ ปั่นแคปชั่น AI ลง CSV
               </label>
               {enableCaption && (
                 <>
                   <input 
                     type="text" 
                     value={captionPrompt} 
                     onChange={e => setCaptionPrompt(e.target.value)} 
                     placeholder="บรีฟสไตล์การเขียน เช่น ป้ายยา, ฮาร์ดเซลล์..." 
                     className="text-[10px] px-2 py-1 rounded bg-white dark:bg-black border border-blue-300 dark:border-blue-700 outline-none w-64 text-blue-800 dark:text-blue-300"
                   />
                   <select 
                     value={captionLength} 
                     onChange={e => setCaptionLength(e.target.value as any)}
                     className="text-[10px] px-2 py-1 rounded bg-white dark:bg-black border border-blue-300 dark:border-blue-700 outline-none text-blue-800 dark:text-blue-300"
                   >
                     <option value="short">สั้นกระชับ (1-2 ประโยค)</option>
                     <option value="medium">กำลังดี (3-4 บรรทัด)</option>
                     <option value="long">เล่าละเอียด (5-8 บรรทัด)</option>
                   </select>
                 </>
               )}
            </div>
          </div>
        </div>

        {viewMode === 'new' && (
          <div 
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-10 text-center hover:border-indigo-500 cursor-pointer transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              accept=".xlsx, .xlsm, .xls" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-lg font-bold">คลิกอัปโหลดไฟล์ Excel (.xlsx)</h3>
            <p className="text-sm text-gray-500 mt-2">โปรแกรมจะแกะคอลัมน์ชื่อ, รูป และลิงก์มาให้เอง (แม้ชื่อคอลัมน์จะเปลี่ยน)</p>
          </div>
        )}
      </div>

      {/* Clusters Gallery */}
      <div className="space-y-8">
        {(viewMode === 'new' ? clusters : savedClusters).length === 0 && viewMode === 'saved' && (
          <div className="text-center p-8 opacity-50 font-bold border-2 border-dashed border-gray-300 rounded-xl">ยังไม่มีกลุ่มสินค้าที่บันทึกไว้</div>
        )}
        {(viewMode === 'new' ? clusters : savedClusters).map((cluster, cIdx) => {
          const clusterItemIds = cluster.items.map(i => i.id);
          const allSelected = clusterItemIds.length > 0 && clusterItemIds.every(id => selectedItems.has(id));
          const someSelected = clusterItemIds.some(id => selectedItems.has(id));
          const selectedCount = clusterItemIds.filter(id => selectedItems.has(id)).length;

          const handleSelectAll = () => {
              const next = new Set(selectedItems);
              if (allSelected) {
                  clusterItemIds.forEach(id => next.delete(id));
              } else {
                  clusterItemIds.forEach(id => next.add(id));
              }
              setSelectedItems(next);
          };

          return (
          <div key={cIdx} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm relative">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                📦 {cluster.categoryName} <span className="text-sm opacity-50 font-normal">({cluster.items.length} สินค้า)</span>
              </h3>
              <div className="flex flex-wrap gap-2 items-center">
                <button onClick={handleSelectAll} className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-[10px] font-bold transition-colors border border-blue-200 dark:border-blue-800 shadow-sm">
                  {allSelected ? '☑️ เอาออกทั้งหมด' : '☑️ เลือกทั้งหมด'}
                </button>
                <button 
                  onClick={() => executeBulkGeneration(cluster.items.filter(i => selectedItems.has(i.id)))} 
                  disabled={generatingItemId !== null || !someSelected} 
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50 shadow-sm flex items-center gap-1"
                >
                  <span className="hidden sm:inline">✨ สร้างรูป</span> {selectedCount > 0 ? `(${selectedCount})` : ''}
                </button>
                {viewMode === 'new' && (
                  <button onClick={() => handleSaveCluster(cluster)} className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-[10px] font-bold transition-colors border border-green-200 dark:border-green-800 shadow-sm">
                    💾 บันทึกกลุ่ม
                  </button>
                )}
                {viewMode === 'saved' && (
                  <button onClick={() => handleDeleteSavedCluster(cIdx)} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-[10px] font-bold transition-colors border border-red-200 dark:border-red-800 shadow-sm">
                    🗑️ ลบกลุ่มนี้
                  </button>
                )}
              </div>
            </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {cluster.items.map((item) => (
                  <div key={item.id} className={`group bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border ${selectedItems.has(item.id) ? 'border-2 border-indigo-500 shadow-md shadow-indigo-500/20' : 'border border-gray-200 dark:border-gray-700'} flex flex-col relative transition-all`}>
                    
                    {/* --- CHECKBOX OVERLAY --- */}
                    <div className="absolute top-2 left-2 z-20 bg-white/80 dark:bg-black/60 rounded flex items-center justify-center p-0.5 backdrop-blur-sm shadow-sm ring-1 ring-black/10">
                       <input 
                         type="checkbox" 
                         className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shadow-sm cursor-pointer"
                         checked={selectedItems.has(item.id)}
                         onChange={(e) => {
                            const next = new Set(selectedItems);
                            if (e.target.checked) next.add(item.id); else next.delete(item.id);
                            setSelectedItems(next);
                         }}
                       />
                    </div>

                    <div className={`aspect-square bg-gray-100 overflow-hidden relative cursor-pointer ${selectedItems.has(item.id) ? 'opacity-100' : 'opacity-90 grayscale-0 hover:grayscale-0'}`} 
                         onClick={() => {
                            const next = new Set(selectedItems);
                            if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                            setSelectedItems(next);
                         }}>
                      {item.image && item.image !== 'https://via.placeholder.com/150?text=No+Image' ? (
                        <img src={generatedAds[item.id] || item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                      )}
                      {generatingItemId === item.id && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-2 text-center text-xs backdrop-blur-sm z-10 animate-fade-in">
                           <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mb-2 shadow-[0_0_10px_rgba(236,72,153,0.8)]"></div>
                           <span className="font-bold text-[10px] tracking-wide animate-pulse">ผู้กำกับสั่งแอคชั่น...</span>
                        </div>
                      )}
                      {generatedAds[item.id] && (
                        <div className="absolute top-1.5 right-1.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-lg z-10 border border-pink-300 flex items-center gap-1">
                          <span className="animate-spin text-[8px]">✨</span> AI Directed
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col flex-1">
                      <div className="text-xs font-bold line-clamp-2 mb-2 flex-1 break-words leading-tight" title={item.name}>{item.name}</div>
                      
                      {/* --- SALES & COMMISSION DATA --- */}
                      {(item.sales || item.commission || item.price) && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {item.sales && (
                            <div className="bg-orange-500/10 text-orange-500 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center border border-orange-500/30">
                              🔥 ขายไป: {item.sales}
                            </div>
                          )}
                          {item.commission && (
                            <div className="bg-green-500/10 text-green-500 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center border border-green-500/30">
                              💰 คอม: {item.commission}
                            </div>
                          )}
                          {item.price && (
                            <div className="bg-blue-500/10 text-blue-500 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center border border-blue-500/30">
                              🏷️ {item.price}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-1 mt-auto">
                        <button 
                          onClick={() => {
                            if (shootMode === 'model') executeKieGenerationForLazada(item);
                            else executeProductOnlyGeneration(item);
                          }}
                          disabled={generatingItemId !== null}
                          className={`flex-1 flex flex-col justify-center items-center text-[9px] font-bold py-1.5 rounded-lg transition-colors border disabled:opacity-50 ${
                            shootMode === 'model'
                              ? 'bg-pink-500/10 hover:bg-pink-500/20 text-pink-500 border-pink-500/30'
                              : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border-blue-500/30'
                          }`}
                        >
                          <span className="text-[12px] mb-0.5">{shootMode === 'model' ? '📸' : '📦'}</span>
                          {shootMode === 'model' ? 'สั่งนางแบบโพส' : 'ถ่ายสินค้า'}
                        </button>
                        {(generatedAds[item.id] || generatedReviews[item.id]) && (
                          <a
                            href={generatedAds[item.id] || generatedReviews[item.id]}
                            download={`review_${item.id}.png`}
                            className="flex flex-col justify-center items-center text-[9px] bg-green-500/10 hover:bg-green-500/20 text-green-500 font-bold py-1.5 px-2 rounded-lg transition-colors border border-green-500/30"
                          >
                            <span className="text-[12px] mb-0.5">💾</span> บันทึกรูป
                          </a>
                        )}
                        <a 
                          href={item.link} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex-1 flex flex-col justify-center items-center text-[9px] text-center bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 font-bold py-1.5 rounded-lg transition-colors border border-indigo-500/30"
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(item.link);
                            alert('คัดลอกลิงก์เรียบร้อยแล้ว: ' + item.link);
                          }}
                        >
                          <span className="text-[12px] mb-0.5">🔗</span> คัดลอกลิงก์
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        </div>
    </div>
  );
};
