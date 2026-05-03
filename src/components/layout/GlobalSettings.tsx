import React, { useState, useEffect, useRef } from 'react';
import { checkOpenRouterCredits } from '../../hooks/useApiSettings';

interface ApiProfile {
  id: string;
  name: string;
  openRouterKey: string;
  dropboxKey: string;
  dropboxAppKey?: string;
  dropboxAppSecret?: string;
  dropboxRefreshToken?: string;
  kieKey: string;
  googleKey?: string;
  apifyKey?: string;
}

export default function GlobalSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');

  // Form states matching active profile
  const [name, setName] = useState('โปรไฟล์เริ่มต้น');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [dropboxKey, setDropboxKey] = useState('');
  const [dropboxAppKey, setDropboxAppKey] = useState('');
  const [dropboxAppSecret, setDropboxAppSecret] = useState('');
  const [dropboxRefreshToken, setDropboxRefreshToken] = useState('');
  const [kieKey, setKieKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [apifyKey, setApifyKey] = useState('');
  const [isCheckingCredits, setIsCheckingCredits] = useState(false);
  const [creditResult, setCreditResult] = useState('');
  
  const hasAttemptedAuth = useRef(false);
  const getDropboxRedirectUri = () => `${window.location.origin.replace(/\/$/, '')}/`;

  const readLocalProfiles = (): ApiProfile[] => {
    try {
      const localProfiles = JSON.parse(localStorage.getItem('api_global_profiles') || '[]');
      return Array.isArray(localProfiles) ? localProfiles : [];
    } catch {
      return [];
    }
  };

  const mergeProfiles = (...profileGroups: ApiProfile[][]) => {
    const profileMap = new Map<string, ApiProfile>();
    profileGroups.flat().forEach(profile => {
      if (!profile) return;
      const key = String(profile.id || profile.name || Date.now());
      profileMap.set(key, { ...profileMap.get(key), ...profile, id: profile.id || key });
    });
    return Array.from(profileMap.values());
  };

  // 1. Intercept Dropbox OAuth Redirect globally
  useEffect(() => {
    const handleDropboxAuth = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      
      if (code && !hasAttemptedAuth.current) {
        hasAttemptedAuth.current = true;
        // Find if we have temp keys stored from before the redirect
        const pendingAppKey = localStorage.getItem('__temp_dbx_appkey') || '';
        const pendingAppSecret = localStorage.getItem('__temp_dbx_appsecret') || '';
        
        if (pendingAppKey && pendingAppSecret) {
          try {
            const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
               method: 'POST',
               headers: {
                 'Content-Type': 'application/x-www-form-urlencoded'
               },
               body: new URLSearchParams({
                  grant_type: 'authorization_code',
                  code: code,
                  client_id: pendingAppKey,
                  client_secret: pendingAppSecret,
                  redirect_uri: getDropboxRedirectUri()
               })
            });
            const data = await res.json();
            
            if (data.refresh_token) {
              const savedProfiles = JSON.parse(localStorage.getItem('api_global_profiles') || '[]');
              const activeId = localStorage.getItem('api_global_active_id') || savedProfiles[0]?.id;
              
              if (activeId) {
                const pIndex = savedProfiles.findIndex((x: ApiProfile) => x.id === activeId);
                if (pIndex >= 0) {
                  savedProfiles[pIndex].dropboxRefreshToken = data.refresh_token;
                  savedProfiles[pIndex].dropboxKey = data.access_token; // save the new sl token initially
                  savedProfiles[pIndex].dropboxAppKey = pendingAppKey;
                  savedProfiles[pIndex].dropboxAppSecret = pendingAppSecret;
                  
                  localStorage.setItem('api_global_profiles', JSON.stringify(savedProfiles));
                  localStorage.setItem('dropbox_api_key', data.access_token);
                  fetch('/api/save-app-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'api_profiles', data: savedProfiles })
                  }).catch(console.error);

                  setProfiles(savedProfiles);
                  setDropboxKey(data.access_token);
                  setDropboxAppKey(pendingAppKey);
                  setDropboxAppSecret(pendingAppSecret);
                  setDropboxRefreshToken(data.refresh_token);
                  
                  alert('✅ ยืนยันเชื่อมต่อ Dropbox ถาวรสำเร็จ! (ได้รับ Refresh Token แล้ว)');
                }
              }
            } else {
              alert('❌ เปิดการเชื่อมต่อล้มเหลว: ' + JSON.stringify(data));
            }
          } catch(e) {
            alert('❌ เกิดข้อผิดพลาดในการดึง Token: ' + e);
          } finally {
            localStorage.removeItem('__temp_dbx_appkey');
            localStorage.removeItem('__temp_dbx_appsecret');
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      }
    };
    handleDropboxAuth();
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/get-app-data?key=api_profiles')
        .then(res => res.json())
        .then(serverProfiles => {
          const profilesToLoad = mergeProfiles(
            Array.isArray(serverProfiles) ? serverProfiles : [],
            readLocalProfiles(),
          );

          if (profilesToLoad.length > 0) {
            setProfiles(profilesToLoad);
            const active = localStorage.getItem('api_global_active_id') || profilesToLoad[0].id;
            setActiveProfileId(active);
            
            const p = profilesToLoad.find((x: ApiProfile) => x.id === active) || profilesToLoad[0];
            setName(p.name || '');
            setOpenRouterKey(p.openRouterKey || '');
            setDropboxKey(p.dropboxKey || '');
            setDropboxAppKey(p.dropboxAppKey || '');
            setDropboxAppSecret(p.dropboxAppSecret || '');
            setDropboxRefreshToken(p.dropboxRefreshToken || '');
            setKieKey(p.kieKey || '');
            setGoogleKey(p.googleKey || '');
            setApifyKey(p.apifyKey || '');
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const authorizeDropbox = () => {
    if (!dropboxAppKey || !dropboxAppSecret) {
      alert('❌ กรุณากรอก App Key และ App Secret ก่อนทำการยืนยันสิทธิ์');
      return;
    }
    localStorage.setItem('__temp_dbx_appkey', dropboxAppKey.trim());
    localStorage.setItem('__temp_dbx_appsecret', dropboxAppSecret.trim());
    
    const uri = encodeURIComponent(getDropboxRedirectUri());
    window.location.href = `https://www.dropbox.com/oauth2/authorize?client_id=${dropboxAppKey.trim()}&response_type=code&token_access_type=offline&redirect_uri=${uri}`;
  };

  const saveSettings = () => {
    const newProfile: ApiProfile = {
      id: activeProfileId || Date.now().toString(),
      name: name.trim() || 'โปรไฟล์ API',
      openRouterKey: openRouterKey.trim(),
      dropboxKey: dropboxKey.trim(),
      dropboxAppKey: dropboxAppKey.trim(),
      dropboxAppSecret: dropboxAppSecret.trim(),
      dropboxRefreshToken: dropboxRefreshToken,
      kieKey: kieKey.trim(),
      googleKey: googleKey.trim(),
      apifyKey: apifyKey.trim()
    };
    
    let updated = [...profiles];
    const index = updated.findIndex(p => p.id === newProfile.id);
    if (index >= 0) {
      updated[index] = newProfile;
    } else {
      updated.push(newProfile);
    }

    setProfiles(updated);
    setActiveProfileId(newProfile.id);
    
    // Save to Git-synced backend file
    fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'api_profiles', data: updated })
    }).catch(console.error);

    // Keep backwards compatibility for old hooks that directly read localStorage
    localStorage.setItem('api_global_profiles', JSON.stringify(updated));
    localStorage.setItem('api_global_active_id', newProfile.id);

    // Write backwards compatibility for existing tabs!
    localStorage.setItem('openrouter_key', newProfile.openRouterKey);
    localStorage.setItem('dropbox_api_key', newProfile.dropboxKey);
    // for kie
    localStorage.setItem('kie_api_key', newProfile.kieKey); // Example backward mapping if needed
    // for tracking-dashboard
    if (newProfile.googleKey) {
      localStorage.setItem('google_api_key', newProfile.googleKey);
    }
    window.dispatchEvent(new CustomEvent('api-profiles-updated', {
      detail: { profiles: updated, activeProfileId: newProfile.id },
    }));

    alert(`✅ บันทึกโปรไฟล์ "${newProfile.name}" เรียบร้อยแล้ว`);
    setIsOpen(false);
  };

  const createNewProfile = () => {
    const newId = Date.now().toString();
    setActiveProfileId(newId);
    setName(`โปรไฟล์ใหม่ ${profiles.length + 1}`);
    setOpenRouterKey('');
    setDropboxKey('');
    setKieKey('');
    setGoogleKey('');
    setApifyKey('');
    setCreditResult('');
  };

  const loadProfile = (id: string) => {
    const p = profiles.find(x => x.id === id);
    if (p) {
      setActiveProfileId(p.id);
      setName(p.name || '');
      setOpenRouterKey(p.openRouterKey || '');
      setDropboxKey(p.dropboxKey || '');
      setDropboxAppKey(p.dropboxAppKey || '');
      setDropboxAppSecret(p.dropboxAppSecret || '');
      setDropboxRefreshToken(p.dropboxRefreshToken || '');
      setKieKey(p.kieKey || '');
      setGoogleKey(p.googleKey || '');
      setApifyKey(p.apifyKey || '');
      setCreditResult('');
      
      // Update backwards compatibility immediately so switching takes effect
      localStorage.setItem('api_global_active_id', p.id);
      localStorage.setItem('openrouter_key', p.openRouterKey);
      localStorage.setItem('dropbox_api_key', p.dropboxKey);
      if (p.googleKey) localStorage.setItem('google_api_key', p.googleKey);
      window.dispatchEvent(new CustomEvent('api-profiles-updated', {
        detail: { profiles, activeProfileId: p.id },
      }));
    }
  };

  const handleExportData = () => {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) data[key] = localStorage.getItem(key) || '';
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_video_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if(confirm('⚠️ การนำเข้าข้อมูลนี้ จะเขียนทับข้อมูลทั้งหมดในเครื่องนี้ (นางแบบ, การตั้งค่าแบบเก่าจะหายไป) ยืนยันหรือไม่?')) {
          for (const key in data) {
            localStorage.setItem(key, data[key]);
          }
          alert('✅ นำเข้าข้อมูลสำเร็จ! ระบบจะรีสตาร์ทเพื่อโหลดข้อมูลใหม่');
          window.location.reload();
        }
      } catch (err) {
        alert('❌ ไฟล์แนบไม่ถูกต้อง หรือเกิดข้อผิดพลาดในการโหลด');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset file input
  };

  const handleCheckCredits = async () => {
    if (!openRouterKey) return;
    setIsCheckingCredits(true);
    setCreditResult('');
    try {
      const credits = await checkOpenRouterCredits(openRouterKey);
      if (credits !== null) {
        setCreditResult(`✅ เครดิตคงเหลือ: $${credits.toFixed(4)}`);
      } else {
        setCreditResult('❌ ไม่สามารถดึงข้อมูลเครดิตได้ (Key อาจไม่ถูกต้อง)');
      }
    } catch (err: any) {
      setCreditResult(`❌ เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsCheckingCredits(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all font-medium flex items-center gap-2"
      >
        <span>⚙️ ตั้งค่า API (คีย์)</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-[var(--border-color)] rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <span>🔑 จัดการโปรไฟล์ API Keys</span>
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold">×</button>
            </div>

            {profiles.length > 0 && (
              <div className="mb-6 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2">สลับโปรไฟล์ที่มีอยู่:</label>
                <div className="flex flex-wrap gap-2">
                  {profiles.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => loadProfile(p.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${activeProfileId === p.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                    >
                      {p.name}
                    </button>
                  ))}
                  <button onClick={createNewProfile} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-dashed border-gray-400 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">+ เพิ่มโปรไฟล์</button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">🏷️ ชื่อโปรไฟล์นี้ (ตั้งให้จำง่าย)</label>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-black border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-indigo-500 font-bold"
                  placeholder="เช่น ทีมเอ, งานส่วนตัว"
                />
              </div>

              <hr className="border-gray-100 dark:border-gray-800 my-4" />

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">🧠 OpenRouter API Key <span className="text-red-500">*</span></label>
                  <button 
                    onClick={handleCheckCredits}
                    disabled={isCheckingCredits || !openRouterKey}
                    className="text-xs px-2 py-1 bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-300 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {isCheckingCredits ? '⏳ กำลังเช็ค...' : '💰 เช็คเครดิต'}
                  </button>
                </div>
                <input 
                  type="password"
                  value={openRouterKey}
                  onChange={(e) => {
                    setOpenRouterKey(e.target.value);
                    if (creditResult) setCreditResult('');
                  }}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-black border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-indigo-500"
                  placeholder="sk-or-v1-..."
                />
                {creditResult && (
                  <div className={`mt-2 text-xs px-3 py-2 rounded-lg font-medium ${
                    creditResult.includes('❌') 
                      ? 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400' 
                      : 'bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400'
                  }`}>
                    {creditResult}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">📦 Dropbox Configuration</label>
                  {dropboxRefreshToken ? (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 font-bold rounded">✅ เชื่อมต่อถาวรแล้ว (Auto-Refresh)</span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 font-bold rounded">⚠️ ใช้คีย์ชั่วคราว</span>
                  )}
                </div>

                {!dropboxRefreshToken && (
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Dropbox Access Token (อัปเดตทุก 4 ชม.)</label>
                    <input 
                      type="password"
                      value={dropboxKey}
                      onChange={(e) => setDropboxKey(e.target.value)}
                      className="w-full px-4 py-2 bg-white dark:bg-black border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-indigo-500 text-sm"
                      placeholder="sl.Bxxxx..."
                    />
                  </div>
                )}

                <div className="border-t border-blue-200 dark:border-blue-800/50 pt-3 mt-3">
                  <label className="block text-xs font-bold text-blue-700 dark:text-blue-400 mb-2">💎 ระบบ Auto-Update (ไม่ต้องก๊อปปี้คีย์อีกต่อไป)</label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <input 
                        type="text"
                        value={dropboxAppKey}
                        onChange={(e) => setDropboxAppKey(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-black border border-[var(--border-color)] rounded focus:outline-none focus:border-blue-500 text-xs"
                        placeholder="App Key"
                      />
                    </div>
                    <div>
                      <input 
                        type="password"
                        value={dropboxAppSecret}
                        onChange={(e) => setDropboxAppSecret(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-black border border-[var(--border-color)] rounded focus:outline-none focus:border-blue-500 text-xs"
                        placeholder="App Secret"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={authorizeDropbox}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1"
                  >
                    🔄 ยืนยันสิทธิ์ Dropbox อัตโนมัติ
                  </button>
                  {dropboxRefreshToken && (
                    <button 
                      onClick={() => {
                        if(confirm('คุณต้องการตัดการเชื่อมต่ออัตโนมัติหรือไม่?')) {
                          setDropboxRefreshToken('');
                        }
                      }}
                      className="w-full mt-2 py-1 text-red-500 hover:text-red-700 text-xs font-bold"
                    >
                      ยกเลิกการเชื่อมต่อถาวร
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">🎙️ Kie.ai API Key (เสียงพากย์)</label>
                <input 
                  type="password"
                  value={kieKey}
                  onChange={(e) => setKieKey(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-black border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-indigo-500"
                  placeholder="sk-kie-..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">📊 Google Sheets API Key (สำหรับ Dashboard)</label>
                <input 
                  type="password"
                  value={googleKey}
                  onChange={(e) => setGoogleKey(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-black border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-indigo-500"
                  placeholder="AIzaSy..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">🕷️ Apify API Key (ดึงข้อมูลโซเชียล)</label>
                <input 
                  type="password"
                  value={apifyKey}
                  onChange={(e) => setApifyKey(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-black border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-indigo-500"
                  placeholder="apify_api_..."
                />
              </div>
            </div>

            <hr className="border-gray-100 dark:border-gray-800 my-6" />
            
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 mt-2">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-2">🔄 ย้ายเครื่อง / สำรองข้อมูล (Backup & Restore)</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">แพ็กการตั้งค่า คีย์ต่างๆ โฟลเดอร์ที่เซฟไว้ และอัลบั้มนางแบบทั้งหมดไปเปิดที่เครื่องอื่นได้เลย</p>
              <div className="flex gap-2">
                <button 
                  onClick={handleExportData}
                  className="flex-1 py-2 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-black text-gray-700 dark:text-gray-300 transition-all flex items-center justify-center gap-2"
                >
                  📥 ส่งออกข้อมูล (.json)
                </button>
                <div className="flex-1 relative">
                  <input 
                    type="file" 
                    accept=".json"
                    onChange={handleImportData}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="w-full h-full py-2 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-black text-gray-700 dark:text-gray-300 pointer-events-none flex items-center justify-center gap-2">
                    📤 นำเข้าข้อมูลจากเครื่องเก่า
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-8">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-lg font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                ปิด
              </button>
              <button 
                onClick={saveSettings}
                className="px-6 py-2 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2 transform hover:scale-105 transition-all"
              >
                💾 บันทึกโปรไฟล์
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
