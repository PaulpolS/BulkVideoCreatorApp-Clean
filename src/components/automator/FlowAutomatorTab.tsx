import React, { useState, useEffect, useRef } from 'react';
import { getActiveOpenRouterKey } from '../../hooks/useApiSettings';

export function FlowAutomatorTab() {
  const [dropboxKey, setDropboxKey] = useState(localStorage.getItem('dropbox_api_key') || '');
  const [folderPath, setFolderPath] = useState('/หยก/set3');
  
  const [systemPrompt, setSystemPrompt] = useState(`## สินค้าหยก
Role: คุณคือเจ้าของร้านหยกประสบการณ์สูงที่เน้นการขายแบบ "Short & Sharp" (สั้น กระชับ ได้ใจความ) สไตล์ของคุณคือ ตรงไปตรงมา จริงใจ บอกสเปกชัดเจน และเน้นความคุ้มค่า
Task: ดูข้อมูลรูปภาพสินค้าหยก แล้วเขียนแคปชั่นขายของแบบสั้นๆ (Micro-Content) ที่คนอ่านจบใน 10 วินาทีแล้วอยากทักซื้อทันที

Rules (กฎเหล็ก):
ห้ามมีหัวข้อ: ห้ามใส่คำว่า "Hook:", "Body:", "Price:" หรือหัวข้อใดๆ
ความยาว: ห้ามเกิน 4-5 บรรทัด (รวมเว้นวรรค)
หัวข้อบังคับ:
บรรทัดแรก: จุดเด่น
บรรทัดสอง: สเปก
บรรทัดสาม: ราคาและ CTA

รูปแบบ: เป็นข้อความดิบ ไม่มี markdown ไม่ใช้ markdown bold`);

  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Google OAuth states
  const [clientIds, setClientIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('google_client_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    return localStorage.getItem('google_selected_client_id') || '';
  });
  const [newClientId, setNewClientId] = useState('');
  
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  
  // โหมดการทำงาน: "sheets" (ส่งเข้า Google Sheets) หรือ "csv" (ดาวน์โหลดไฟล์เอง)
  const [outputMode, setOutputMode] = useState<'sheets' | 'csv'>(() => {
     return (localStorage.getItem('flow_output_mode') as 'sheets' | 'csv') || 'csv';
  });

  const [savedBrains, setSavedBrains] = useState<{id:string, name:string, content:string}[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('system_prompts_brain') || '[]');
    } catch { return []; }
  });
  const [selectedBrainId, setSelectedBrainId] = useState<string>('');

  // Sync savedBrains every time this tab becomes visible
  useEffect(() => {
    const syncBrains = () => {
      try {
        setSavedBrains(JSON.parse(localStorage.getItem('system_prompts_brain') || '[]'));
      } catch {}
    };
    window.addEventListener('focus', syncBrains);
    syncBrains(); // Run on mount too
    return () => window.removeEventListener('focus', syncBrains);
  }, []);
  
  // Google Sheets integration states
  const [spreadsheets, setSpreadsheets] = useState<{id: string, name: string}[]>([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<string>(localStorage.getItem('google_selected_spreadsheet') || '');
  
  const [worksheets, setWorksheets] = useState<{title: string, id: number}[]>([]);
  const [selectedWorksheet, setSelectedWorksheet] = useState<string>(localStorage.getItem('google_selected_worksheet') || '');
  
  const clientRef = useRef<any>(null);
  const cancelRef = useRef<boolean>(false);

  // ดักจับ Access Token ที่ Google โยนกลับมาให้ทาง URL หลังล็อคอินเสร็จ
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        setGoogleToken(token);
        addLog(`✅ ล็อคอิน Google สำเร็จ! (วิธี Redirect) ได้รับ Token แล้ว`);
        // ล้าง URL ให้สะอาด
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchSpreadsheets(token);
      }
    }
  }, []);

  // [...Dropbox Effect และอื่นๆ ยังเหมือนเดิม...]
  useEffect(() => {
    localStorage.setItem('dropbox_api_key', dropboxKey);
  }, [dropboxKey]);

  useEffect(() => {
    localStorage.setItem('google_client_ids', JSON.stringify(clientIds));
  }, [clientIds]);

  useEffect(() => {
    localStorage.setItem('google_selected_client_id', selectedClientId);
  }, [selectedClientId]);
  
  useEffect(() => {
    localStorage.setItem('google_selected_spreadsheet', selectedSpreadsheet);
  }, [selectedSpreadsheet]);
  
  useEffect(() => {
    localStorage.setItem('google_selected_worksheet', selectedWorksheet);
  }, [selectedWorksheet]);

  useEffect(() => {
    localStorage.setItem('flow_output_mode', outputMode);
  }, [outputMode]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
  };

  const getOpenRouterKey = () => getActiveOpenRouterKey();
  
  const handleAddClientId = () => {
    if (newClientId && !clientIds.includes(newClientId)) {
      const updated = [...clientIds, newClientId];
      setClientIds(updated);
      setSelectedClientId(newClientId);
      setNewClientId('');
    }
  };

  const handleDeleteClientId = (id: string) => {
    const updated = clientIds.filter(c => c !== id);
    setClientIds(updated);
    if (selectedClientId === id) {
      setSelectedClientId(updated.length > 0 ? updated[0] : '');
    }
  };

  const loginGoogle = () => {
    if (!selectedClientId) return alert("กรุณาเลือกหรือเพิ่ม Google Client ID ก่อน");
    
    const clientId = selectedClientId.trim();
    if (!clientId.endsWith('.apps.googleusercontent.com')) {
      alert("❌ Client ID ของคุณไม่ถูกต้อง! ต้องลงท้ายด้วย .apps.googleusercontent.com เสมอครับ");
      return;
    }

    addLog(`🔑 กำลังสลับหน้าต่างไปล็อคอินที่ Google (Redirect Flow)...`);
    const redirectUri = encodeURIComponent('http://localhost:5173');
    const scope = encodeURIComponent('https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&include_granted_scopes=true`;
    
    // ย้ายหน้าเว็บเราไปหน้าล็อคอิน Google เลี่ยง Popup บล็อกเกอร์ได้ 100%
    window.location.href = authUrl;
  };

  const fetchSpreadsheets = async (token: string) => {
    addLog(`📂 กำลังค้นหาไฟล์ชีททั้งหมดใน Google Drive...`);
    try {
      const res = await fetch("https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)&orderBy=modifiedTime desc", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSpreadsheets(data.files || []);
      addLog(`✅ พบชีทจำนวน ${data.files?.length || 0} ไฟล์`);
    } catch (e: any) {
      addLog(`❌ ดึงรายชื่อชีทไม่ได้: ${e.message}`);
    }
  };

  const fetchWorksheets = async (spreadsheetId: string) => {
    if (!googleToken || !spreadsheetId) return;
    addLog(`📂 กำลังดึงแท็บงานในชีทที่เลือก...`);
    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(title,sheetId)`, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const sheets = data.sheets.map((s: any) => s.properties);
      setWorksheets(sheets || []);
      if (!selectedWorksheet || !sheets.find((s: any) => s.title === selectedWorksheet)) {
         setSelectedWorksheet(sheets[0]?.title || '');
      }
    } catch (e: any) {
      addLog(`❌ ดึงรายชื่อแท็บไม่ได้: ${e.message}`);
    }
  };

  // When selected spreadsheet changes, auto-load worksheets
  useEffect(() => {
    if (selectedSpreadsheet && googleToken) {
      fetchWorksheets(selectedSpreadsheet);
    }
  }, [selectedSpreadsheet, googleToken]);

  const refreshDropboxTokenIfNeeded = async (): Promise<string> => {
    try {
      const savedProfiles = JSON.parse(localStorage.getItem('api_global_profiles') || '[]');
      const activeId = localStorage.getItem('api_global_active_id');
      const profile = savedProfiles.find((x: any) => x.id === activeId) || savedProfiles[0];
      
      if (profile && profile.dropboxRefreshToken && profile.dropboxAppKey && profile.dropboxAppSecret) {
        addLog(`🔄 ตรวจพบระบบ Auto-Refresh (กำลังอัปเดตคีย์ Dropbox ใหม่เอี่ยมให้คุณ...)`);
        const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/x-www-form-urlencoded',
             'Authorization': 'Basic ' + btoa(profile.dropboxAppKey + ':' + profile.dropboxAppSecret)
           },
           body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: profile.dropboxRefreshToken
           })
        });
        const data = await res.json();
        if (data.access_token) {
           profile.dropboxKey = data.access_token;
           localStorage.setItem('api_global_profiles', JSON.stringify(savedProfiles));
           localStorage.setItem('dropbox_api_key', data.access_token);
           setDropboxKey(data.access_token);
           addLog(`✅ ดึงคีย์ใหม่สำเร็จ! คีย์นี้จะไม่มีวันหมดอายุระหว่างรัน`);
           return data.access_token;
        } else {
           addLog(`⚠️ แจ้งเตือน: ดึงคีย์ใหม่ไม่สำเร็จ (${data.error_description || 'Unknown'})`);
        }
      }
    } catch(e) {
       addLog(`⚠️ แจ้งเตือน: ระบบ Auto-Refresh ขัดข้อง (${e})`);
    }
    return '';
  };

  const runWorkflow = async () => {
    setIsRunning(true);
    setLogs([]);
    cancelRef.current = false;
    
    // 0. Auto-Refresh Token First (If configured)
    const refreshedToken = await refreshDropboxTokenIfNeeded();

    // ให้อ่านจาก LocalStorage สดๆ เสมอ เพื่อป้องกันปัญหา State ค้างหลังเปลี่ยนตั้งค่าที่มุมขวาบน
    const rawDbKey = refreshedToken || localStorage.getItem('dropbox_api_key') || dropboxKey;
    const currentDropboxKey = rawDbKey ? rawDbKey.trim() : "";
    
    if (!currentDropboxKey) {
      setIsRunning(false);
      return alert("กรุณาใส่ Dropbox Access Token ใน ⚙️ ตั้งค่า API (มุมขวาบน) ก่อนครับ");
    }
    
    if (outputMode === 'sheets') {
      if (!googleToken) return alert("กรุณากด Login with Google และเลือกชีทให้เรียบร้อยก่อน");
      if (!selectedSpreadsheet || !selectedWorksheet) return alert("กรุณาเลือก Google Sheet และแท็บเป้าหมายก่อน");
    }
    
    const openRouterKey = getOpenRouterKey();
    if (!openRouterKey) {
      setIsRunning(false);
      return alert("กรุณาใส่ OpenRouter API Key ใน ⚙️ ตั้งค่า API (มุมขวาบน) ก่อนครับ");
    }

    addLog(`🚀 เริ่มต้น Workflow Automator โหมดโคลนนิ่ง... (Output: ${outputMode === 'csv' ? 'ไฟล์ CSV' : 'Google Sheets'})`);

    const recordsForCsv: any[] = []; // เก็บสะสมแถวไว้สร้าง CSV

    try {
      // 1. List files in Dropbox folder
      addLog(`📂 กำลังดึงรายชื่อไฟล์จาก Dropbox: ${folderPath}`);
      const dbxRes = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${currentDropboxKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          path: folderPath.trim(),
          recursive: false,
          include_media_info: false,
          include_deleted: false,
          include_has_explicit_shared_members: false
        })
      });

      if (!dbxRes.ok) {
        throw new Error(`Dropbox List Error: ${await dbxRes.text()}`);
      }

      const listData = await dbxRes.json();
      const files = listData.entries.filter((e: any) => e['.tag'] === 'file');
      addLog(`✅ พบไฟล์ทั้งหมด ${files.length} รายการ กำลังเริ่มวนลูป...`);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        addLog(`⏳ [${i+1}/${files.length}] กำลังจัดการไฟล์: ${file.name}`);

         if (cancelRef.current) {
            addLog(`🛑 ผู้ใช้สั่งหยุดการทำงานกลางคัน! จะทำการรวมไฟล์เท่าที่เสร็จแล้ว...`);
            break;
         }

        // 2. Get Shared Link for the file (so Vision AI can read it)
        let fileUrl = "";
        try {
           const linkRes = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
             method: "POST",
             headers: {
               "Authorization": `Bearer ${currentDropboxKey}`,
               "Content-Type": "application/json"
               },
             body: JSON.stringify({ path: file.path_lower })
           });
           
           const shareData = await linkRes.json();
           if (shareData.url) {
             fileUrl = shareData.url.replace("?dl=0", "?raw=1").replace("&dl=0", "&raw=1");
           } else if (shareData.error && shareData.error.shared_link_already_exists) {
              fileUrl = shareData.error.shared_link_already_exists.metadata.url.replace("?dl=0", "?raw=1").replace("&dl=0", "&raw=1");
           }
        } catch(e) {
           addLog(`⚠️ หาลิงก์ Shared Link ไม่สำเร็จ จะข้ามการส่งรูปให้ AI แต่ยังบันทึกข้อมูล`);
        }

        // 3. Let LLM generate caption
        let aiCaption = "ไม่ได้เปิดเขียนแคปชั่นด้วย AI (เพราะหารูปไม่เจอ)";
        if (fileUrl) {
           addLog(`🤖 กำลังส่งรูปลงตู้ AI ให้คิดแคปชั่น...`);
           const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
             method: "POST",
             headers: {
               "HTTP-Referer": window.location.href,
               "X-Title": "BulkVideoCreator",
               "Authorization": `Bearer ${openRouterKey.trim()}`,
               "Content-Type": "application/json"
             },
             body: JSON.stringify({
               model: "google/gemini-2.5-flash",
               messages: [
                 {
                   role: "user",
                   content: [
                     { type: "text", text: `${systemPrompt}\n\nโดยอิงข้อมูลจากชื่อรูปด้วย ก็คือชื่อนี้: ${file.name}` },
                     { type: "image_url", image_url: { url: fileUrl } }
                   ]
                 }
               ]
             })
           });

           if (aiRes.ok) {
             const aiData = await aiRes.json();
             aiCaption = aiData.choices?.[0]?.message?.content || "";
           } else {
             addLog(`❌ AI Error: ${await aiRes.text()}`);
           }
        }

        // 4. Send to Google Sheets API OR Prepare for CSV
        const updateDate = "มาใหม่ๆ " + new Date().toLocaleDateString('th-TH');
        const linkDl = fileUrl ? fileUrl.replace("?raw=1", "?dl=1").replace("&raw=1", "&dl=1").replace("?dl=0", "?dl=1").replace("&dl=0", "&dl=1") : "ไม่พบลิงก์";
        
        if (outputMode === 'sheets') {
           addLog(`📝 กำลังบันทึกอัดลง Google Sheets...`);
           const encodedRange = encodeURIComponent(`${selectedWorksheet}!A1`);
           const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${selectedSpreadsheet}/values/${encodedRange}:append?valueInputOption=USER_ENTERED`;
           
           const sheetRes = await fetch(sheetUrl, {
             method: "POST",
             headers: {
               "Authorization": `Bearer ${googleToken}`,
               "Content-Type": "application/json"
             },
             body: JSON.stringify({
               range: `${selectedWorksheet}!A1`,
               majorDimension: "ROWS",
               values: [
                  [file.id, aiCaption.trim(), updateDate, "N", linkDl, "="]
               ]
             })
           });

           if (!sheetRes.ok) {
               addLog(`❌ บันทึก Google Sheets ไม่สำเร็จ: ${await sheetRes.text()}`);
           } else {
               addLog(`✅ บันทึกแถว ${file.name} สำเร็จ!`);
           }
        } else {
           // CSV Mode
           addLog(`📝 บันทึกข้อมูล ${file.name} ลงหน่วยความจำชั่วคราวแล้ว`);
           // แทนที่การเว้นบรรทัด \n ในแคปชั่นด้วยการเว้นวรรคธรรมดาเพื่อป้องกันปัญหา CSV พัง
           const safeCaption = aiCaption.trim().replace(/\r?\n/g, ' '); 
           const newRecord = [file.id, `"${safeCaption.replace(/"/g, '""')}"`, updateDate, "N", linkDl, "="];
           recordsForCsv.push(newRecord);
        }

        // Delay 3 seconds like n8n
        addLog(`⏳ หน่วงเวลา 3 วินาทีเพื่อป้องกัน Rate Limit...`);
        await new Promise(r => setTimeout(r, 3000));
      }

      // -- Export CSV if in CSV Mode
      if (outputMode === 'csv' && recordsForCsv.length > 0) {
         addLog(`📦 กำลังสร้างไฟล์ CSV...`);
         
         // หัวคอลัมน์มาตรฐาน (เหมือนที่คุณส่งเข้า Google Sheet)
         let csvContent = ""; // ไม่ใส่ Header ไว้ถ้าบอสเอาไปก๊อปต่อตูดแถวเก่า จะได้ง่าย
         
         recordsForCsv.forEach(row => {
            csvContent += row.join(",") + "\r\n";
         });
         
         const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF for Excel Thai encoding
         const url = URL.createObjectURL(blob);
         
         const a = document.createElement('a');
         a.href = url;
         a.download = `automator_export_${new Date().getTime()}.csv`;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         
         addLog(`📥 ดาวน์โหลดไฟล์ CSV สำเร็จแล้ว!`);
      }

      addLog(`🎉 จบการทำงาน Pipeline อย่างสมบูรณ์!`);

    } catch (err: any) {
      addLog(`🆘 ข้อผิดพลาดร้ายแรง: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 animate-fade-in relative pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600 mb-2 font-display uppercase tracking-tight">
             Workflow Automator
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">เชื่อมต่อ Dropbox → AI Prompt → Google Sheets อัตโนมัติ (ทดแทน n8n)</p>
        </div>
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className="mt-4 md:mt-0 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-bold text-sm flex items-center transition-all"
        >
          ⚙️ การตั้งค่า API & โหมดส่งออกข้อมูล
        </button>
      </div>

      {showConfig && (
        <div className="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-6 mb-8 shadow-sm animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-indigo-700 dark:text-indigo-400">วิธีส่งออกผลลัพธ์ข้อมูล (Output Mode)</h2>
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button 
                onClick={() => setOutputMode('csv')}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${outputMode === 'csv' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                📥 ออฟไลน์ (.CSV)
              </button>
              <button 
                onClick={() => setOutputMode('sheets')}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${outputMode === 'sheets' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                ☁️ ออนไลน์ (Sheets)
              </button>
            </div>
          </div>

          <div className="space-y-6">
            
            {/* Dropbox */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">🔑 Dropbox Access Token (ต้องใส่เสมอ)</label>
              <input 
                type="password"
                value={dropboxKey} 
                onChange={(e) => setDropboxKey(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-800 rounded-lg focus:outline-none focus:border-indigo-500 text-sm"
                placeholder="sl.Bxxxxxxx..."
              />
            </div>
            
            {/* Google OAuth Panel (ซ่อนถ้าใช้โหมด CSV) */}
            {outputMode === 'sheets' && (
              <>
                <hr className="border-gray-200 dark:border-gray-800" />
                <div className="animate-fade-in">
                   <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                 🌐 Google Cloud Client ID (บันทึกไว้ใช้ร่วมกัน)
               </label>
               
               <div className="flex gap-2 mb-2">
                 <select 
                   value={selectedClientId}
                   onChange={(e) => setSelectedClientId(e.target.value)}
                   className="flex-1 px-4 py-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-800 rounded-lg focus:outline-none focus:border-indigo-500 text-sm"
                 >
                   <option value="" disabled>-- เลือก Client ID ที่บันทึกไว้ --</option>
                   {clientIds.map(id => (
                     <option key={id} value={id}>{id.substring(0, 30)}...</option>
                   ))}
                 </select>
                 {selectedClientId && (
                   <button 
                     onClick={() => handleDeleteClientId(selectedClientId)}
                     className="px-4 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 text-red-700 dark:text-red-400 rounded-lg text-sm font-bold transition-colors"
                   >
                     ลบ
                   </button>
                 )}
               </div>

               <div className="flex gap-2">
                 <input 
                   type="text"
                   value={newClientId} 
                   onChange={(e) => setNewClientId(e.target.value)}
                   className="flex-1 px-4 py-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-800 rounded-lg focus:outline-none focus:border-indigo-500 text-sm"
                   placeholder="เพิ่ม Client ID ใหม่ที่นี่ เช่น 2198....apps.googleusercontent.com"
                 />
                 <button 
                    onClick={handleAddClientId}
                    className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-bold transition-colors whitespace-nowrap"
                 >
                    บันทึก +
                 </button>
               </div>
               
               {/* Login Button Area */}
               <div className="mt-4 p-4 border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl">
                 <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                   <div className="text-sm">
                     {googleToken ? (
                       <span className="font-bold text-green-600 dark:text-green-400">✅ ระบบเชื่อมต่อ Google Sheet พร้อมใช้งานแล้ว!</span>
                     ) : (
                       <span className="text-gray-600 dark:text-gray-400">กรุณาล็อคอินด้วย Google Account เพื่อดึงรายชื่อ Sheets ของคุณ</span>
                     )}
                   </div>
                   <button 
                     onClick={loginGoogle}
                     className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-full font-bold shadow-sm hover:bg-gray-50 transition-all active:scale-95"
                   >
                     <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-5 h-5" />
                     {googleToken ? "ต่ออายุ Login ใหม่" : "Sign in with Google"}
                   </button>
                 </div>

                 {/* Google Sheets Dropdown (Only show if logged in) */}
                 {googleToken && (
                   <div className="mt-6 space-y-4 animate-fade-in border-t border-indigo-100 dark:border-indigo-900/30 pt-4">
                     <div>
                       <label className="block text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-1">
                         📊 เลือกไฟล์ Google Sheet เป้าหมาย
                       </label>
                       {spreadsheets.length === 0 ? (
                         <div className="text-sm text-gray-500 italic px-2">กำลังโหลดรายชื่อชีทจาก Google Drive...</div>
                       ) : (
                         <select 
                           value={selectedSpreadsheet}
                           onChange={(e) => setSelectedSpreadsheet(e.target.value)}
                           className="w-full px-4 py-2 bg-white dark:bg-black border border-indigo-300 dark:border-indigo-700 rounded-lg focus:outline-none focus:border-indigo-500 text-sm font-medium"
                         >
                           <option value="" disabled>-- เลือกไฟล์ Excel งานของคุณ --</option>
                           {spreadsheets.map(s => (
                             <option key={s.id} value={s.id}>📄 {s.name}</option>
                           ))}
                         </select>
                       )}
                     </div>

                     {selectedSpreadsheet && worksheets.length > 0 && (
                       <div>
                         <label className="block text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-1">
                           📑 เลือกแผ่นงาน (Worksheet Tab)
                         </label>
                         <select 
                           value={selectedWorksheet}
                           onChange={(e) => setSelectedWorksheet(e.target.value)}
                           className="w-full px-4 py-2 bg-white dark:bg-black border border-indigo-300 dark:border-indigo-700 rounded-lg focus:outline-none focus:border-indigo-500 text-sm font-medium"
                         >
                           <option value="" disabled>-- เลือกแท็บที่จะลงข้อมูล --</option>
                           {worksheets.map(w => (
                             <option key={w.title} value={w.title}>📌 {w.title}</option>
                           ))}
                         </select>
                       </div>
                     )}
                   </div>
                 )}
               </div>
               
              </div>
            </>
            )}

            {/* คำอธิบายโหมด CSV */}
            {outputMode === 'csv' && (
              <>
                <hr className="border-gray-200 dark:border-gray-800" />
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/50 rounded-xl p-4 animate-fade-in">
                  <h3 className="font-bold text-green-700 dark:text-green-400 mb-2">✅ โหมดส่งออก Offline ใช้งานได้ทันที</h3>
                  <p className="text-sm text-green-600 dark:text-green-500">
                    ในโหมดนี้ บอสสามารถ "รัน Pipeline ทันที" ได้เลย โดยไม่ต้องล็อคอิน Google Cloud รันเสร็จ 100 รูปปุ๊บ ระบบจะเด้งให้เซฟไฟล์ Excel (CSV) ซึ่งบอสสามารถลากไปคลุมดำแล้ววางใน Google Sheets อันไหนก็ได้ตามใจชอบครับ
                  </p>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* เลนซ้าย: ตั้งค่างาน */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm flex flex-col overflow-hidden">
           <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
             <h2 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
               🎯 เป้าหมายการผลิต (Target)
             </h2>
           </div>
           
           <div className="p-5 flex-1 flex flex-col gap-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">📁 โฟลเดอร์ Dropbox (เช่น /หยก/set3)</label>
                <input 
                  type="text"
                  value={folderPath} 
                  onChange={(e) => setFolderPath(e.target.value)}
                  className="w-full px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/50 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm text-blue-700 dark:text-blue-400 shadow-inner"
                />
              </div>

              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">🧠 AI System Prompt (สมองของ AI)</label>
                  {savedBrains.length > 0 && (
                    <div className="flex items-center gap-2">
                       <select 
                         value={selectedBrainId}
                         onChange={(e) => {
                            setSelectedBrainId(e.target.value);
                            const match = savedBrains.find(b => b.id === e.target.value);
                            if (match) setSystemPrompt(match.content);
                         }}
                         className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:border-indigo-500 max-w-[200px]"
                       >
                         <option value="">-- เลือกสมองที่บันทึกไว้ --</option>
                         {savedBrains.map(b => (
                            <option key={b.id} value={b.id}>🧠 {b.name}</option>
                         ))}
                       </select>
                       {selectedBrainId && (
                         <button 
                           onClick={() => {
                             if(confirm('🗑️ ยืนยันการลบสมองชุดนี้ใช่ไหม?')) {
                               const updated = savedBrains.filter(x => x.id !== selectedBrainId);
                               localStorage.setItem('system_prompts_brain', JSON.stringify(updated));
                               setSavedBrains(updated);
                               setSelectedBrainId('');
                               setSystemPrompt(''); // clear if deleted
                             }
                           }}
                           className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 text-xs font-bold transition-all"
                           title="ลบสมองนี้ทิ้ง"
                         >
                           ลบ
                         </button>
                       )}
                    </div>
                  )}
                </div>
                <textarea 
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full flex-1 min-h-[250px] p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg text-xs leading-relaxed outline-none resize-none focus:border-indigo-500 custom-scrollbar"
                />
              </div>

              {!isRunning ? (
                <button 
                   onClick={runWorkflow}
                   className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-black text-lg shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-0.5 active:translate-y-0"
                >
                   🚀 ปล่อยบอทรัน Pipeline ทันที
                </button>
              ) : (
                <button 
                   onClick={() => cancelRef.current = true}
                   className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-lg shadow-lg hover:shadow-red-500/25 transition-all flex items-center justify-center gap-3 animate-pulse"
                >
                   🛑 หยุดบอทเดี๋ยวนี้!
                </button>
              )}
           </div>
        </div>

        {/* เลนขวา: มอนิเตอร์หน้าจอ */}
        <div className="bg-black border border-gray-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
           <div className="p-3 border-b border-gray-800 bg-gray-900/80 flex justify-between items-center">
             <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRunning ? 'bg-green-400' : 'bg-red-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isRunning ? 'bg-green-500' : 'bg-red-500'}`}></span>
                </span>
                <span className="text-xs font-mono font-bold text-gray-300">SYSTEM LOGS TERMINAL</span>
             </div>
             {logs.length > 0 && !isRunning && (
               <button onClick={() => setLogs([])} className="text-[10px] text-gray-500 hover:text-white transition">CLEAR</button>
             )}
           </div>

           <div className="flex-1 p-4 overflow-y-auto bg-[#0a0a0a] min-h-[400px] custom-scrollbar font-mono text-xs">
              {logs.length === 0 ? (
                 <div className="h-full flex items-center justify-center text-gray-600 italic">
                   รอรับคำสั่งเพื่อรันระบบ...
                 </div>
              ) : (
                 <div className="space-y-1.5 pb-8">
                   {logs.map((log, i) => (
                     <div key={i} className={`${log.includes('🔴') || log.includes('❌') || log.includes('🆘') ? 'text-red-400' : log.includes('✅') || log.includes('🎉') ? 'text-green-400' : log.includes('⚠️') ? 'text-amber-400' : 'text-gray-300'}`}>
                       {log}
                     </div>
                   ))}
                   {isRunning && (
                     <div className="flex items-center gap-2 text-indigo-400 mt-4 pl-2 opacity-70">
                       <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                       <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                       <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                       <span className="ml-1">กำลังทำงาน...</span>
                     </div>
                   )}
                 </div>
              )}
           </div>
           
           <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <svg className="w-48 h-48 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
           </div>
        </div>
      </div>
    </div>
  );
}
