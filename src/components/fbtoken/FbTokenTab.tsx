import React, { useState, useEffect, useRef } from 'react';

interface PageInfo {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

interface TokenRow {
  pageId: string;
  pageName: string;
  pageToken: string;
  igAccountId: string;
}

const LS_APP_ID = 'fb_token_app_id';
const LS_APP_SECRET = 'fb_token_app_secret';
const LS_OAUTH_ORIGIN = 'fb_token_oauth_origin';
const FB_SCOPE = 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management';

const getFacebookOAuthOrigin = () => {
  return window.location.origin;
};

const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, '');

const isLocalOrigin = (origin: string) => {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1' || hostname === '[::1]';
  } catch {
    return false;
  }
};

const getSafeHostname = (origin: string) => {
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
};

function CopyBtn({ text, label = 'คัดลอก' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className={`text-xs px-2 py-1 rounded transition-all whitespace-nowrap ${copied ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
    >
      {copied ? '✓ คัดลอก' : label}
    </button>
  );
}

export function FbTokenTab() {
  const [appId, setAppId] = useState(() => localStorage.getItem(LS_APP_ID) || '');
  const [appSecret, setAppSecret] = useState(() => localStorage.getItem(LS_APP_SECRET) || '');
  const [oauthOriginInput, setOauthOriginInput] = useState(() => localStorage.getItem(LS_OAUTH_ORIGIN) || '');
  const [manualUserToken, setManualUserToken] = useState('');
  const [loginStatus, setLoginStatus] = useState<'idle' | 'saving' | 'waiting' | 'success' | 'error'>('idle');
  const [userToken, setUserToken] = useState('');
  const [tokenExpiry, setTokenExpiry] = useState(0);
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [error, setError] = useState('');

  // Use refs to avoid stale closures in timer/listener
  const oauthDoneRef = useRef(false);
  const listenerRef = useRef<((e: MessageEvent) => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore previous session token
  useEffect(() => {
    const saved = localStorage.getItem('fb_user_token');
    const expiry = Number(localStorage.getItem('fb_token_expiry') || 0);
    if (saved && expiry > Date.now()) {
      setUserToken(saved);
      setTokenExpiry(expiry);
      setLoginStatus('success');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (listenerRef.current) window.removeEventListener('message', listenerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleLogin = async () => {
    if (!appId || !appSecret) {
      setError('กรุณากรอก App ID และ App Secret ก่อน');
      return;
    }
    setError('');
    setLoginStatus('saving');

    const oauthOrigin = normalizeOrigin(oauthOriginInput) || getFacebookOAuthOrigin();
    if (!getSafeHostname(oauthOrigin)) {
      setError('HTTPS OAuth URL ยังไม่ครบ — กรุณาใส่ URL เต็ม เช่น https://purple-spiders-thank.loca.lt');
      setLoginStatus('error');
      return;
    }
    if (!oauthOrigin.startsWith('https://') && !isLocalOrigin(oauthOrigin)) {
      setError('Facebook ไม่รับ HTTP Redirect URI ใหม่แล้ว — กรุณาใช้ HTTPS URL จาก ngrok หรือ Cloudflare Tunnel');
      setLoginStatus('error');
      return;
    }

    // Auto-save credentials to backend before opening popup
    try {
      localStorage.setItem(LS_APP_ID, appId);
      localStorage.setItem(LS_APP_SECRET, appSecret);
      if (oauthOriginInput.trim()) localStorage.setItem(LS_OAUTH_ORIGIN, normalizeOrigin(oauthOriginInput));
      else localStorage.removeItem(LS_OAUTH_ORIGIN);
      const saveRes = await fetch('/api/fb-save-creds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, appSecret }),
      });
      if (!saveRes.ok) throw new Error('บันทึก credentials ไม่สำเร็จ');
    } catch (e: any) {
      setError(e.message);
      setLoginStatus('error');
      return;
    }

    const redirectUri = `${oauthOrigin}/api/fb-oauth-callback`;
    const oauthUrl = `https://www.facebook.com/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${FB_SCOPE}&response_type=code&auth_type=rerequest`;

    const popup = window.open(oauthUrl, 'fb-login', 'width=640,height=740,left=300,top=80');
    if (!popup) {
      setError('เปิด Popup ไม่ได้ — กรุณาอนุญาต Popup สำหรับ localhost ในบราวเซอร์');
      setLoginStatus('error');
      return;
    }

    setLoginStatus('waiting');
    oauthDoneRef.current = false;

    // Listen for postMessage from callback page
    const listener = (e: MessageEvent) => {
      // Accept from same origin or from the popup
      if (e.data?.type === 'fb-oauth-success') {
        oauthDoneRef.current = true;
        const token = String(e.data.token || '');
        const expires = Date.now() + (Number(e.data.expiresIn) || 5184000) * 1000;
        setUserToken(token);
        setTokenExpiry(expires);
        setLoginStatus('success');
        setError('');
        localStorage.setItem('fb_user_token', token);
        localStorage.setItem('fb_token_expiry', String(expires));
        window.removeEventListener('message', listener);
        listenerRef.current = null;
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        try { if (!popup.closed) popup.close(); } catch {}
      } else if (e.data?.type === 'fb-oauth-error') {
        oauthDoneRef.current = true;
        setError('Login ไม่สำเร็จ: ' + (e.data.error || 'unknown error'));
        setLoginStatus('error');
        window.removeEventListener('message', listener);
        listenerRef.current = null;
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      }
    };
    listenerRef.current = listener;
    window.addEventListener('message', listener);

    // Poll for popup close (user closed without authorizing)
    timerRef.current = setInterval(() => {
      if (popup.closed) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        if (!oauthDoneRef.current) {
          window.removeEventListener('message', listener);
          listenerRef.current = null;
          setLoginStatus('idle');
          setError('ปิดหน้าต่าง Login ก่อนเสร็จ — ลองใหม่อีกครั้ง');
        }
      }
    }, 600);
  };

  const handleGetPages = async () => {
    if (!userToken) return;
    setLoadingPages(true);
    setError('');
    try {
      const res = await fetch('/api/fb-get-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userToken }),
      });
      const data = await res.json();
      if (data.error) {
        setError('ดึงเพจไม่สำเร็จ: ' + (data.error.message || JSON.stringify(data.error)));
        return;
      }
      const pages: PageInfo[] = data.data || [];
      if (pages.length === 0) {
        setError('ไม่พบเพจที่เป็น Admin — ตรวจสอบว่า Scope ครบ (pages_show_list, pages_manage_posts)');
      }
      setRows(pages.map(p => ({
        pageId: p.id,
        pageName: p.name,
        pageToken: p.access_token,
        igAccountId: p.instagram_business_account?.id || '',
      })));
    } catch (e: any) {
      setError('เกิดข้อผิดพลาด: ' + e.message);
    } finally {
      setLoadingPages(false);
    }
  };

  const handleUseManualToken = async () => {
    if (!appId || !appSecret) {
      setError('กรุณากรอก App ID และ App Secret ก่อน');
      return;
    }
    if (!manualUserToken.trim()) {
      setError('กรุณาวาง User Access Token ก่อน');
      return;
    }
    setError('');
    setLoginStatus('saving');
    try {
      localStorage.setItem(LS_APP_ID, appId);
      localStorage.setItem(LS_APP_SECRET, appSecret);
      const res = await fetch('/api/fb-extend-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, appSecret, userToken: manualUserToken.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        const msg = typeof data.error === 'string' ? data.error : data.error.message || JSON.stringify(data.error);
        throw new Error(msg);
      }
      const token = String(data.access_token || manualUserToken.trim());
      const expires = Date.now() + (Number(data.expires_in) || 5184000) * 1000;
      setUserToken(token);
      setTokenExpiry(expires);
      setLoginStatus('success');
      localStorage.setItem('fb_user_token', token);
      localStorage.setItem('fb_token_expiry', String(expires));
      setManualUserToken('');
    } catch (e: any) {
      setError('ใช้ Token ไม่สำเร็จ: ' + e.message);
      setLoginStatus('error');
    }
  };

  const handleExportN8N = () => {
    const payload = rows.map(r => ({
      page_name: r.pageName,
      page_id: r.pageId,
      page_access_token: r.pageToken,
      ig_account_id: r.igAccountId || null,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fb_page_tokens_${Date.now()}.json`;
    a.click();
  };

  const handleLogout = () => {
    setLoginStatus('idle');
    setUserToken('');
    setTokenExpiry(0);
    setRows([]);
    setError('');
    localStorage.removeItem('fb_user_token');
    localStorage.removeItem('fb_token_expiry');
  };

  const expiryDate = tokenExpiry
    ? new Date(tokenExpiry).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const currentOAuthOrigin = typeof window !== 'undefined'
    ? normalizeOrigin(oauthOriginInput) || getFacebookOAuthOrigin()
    : 'http://localhost:5173';
  const currentRedirectUri = typeof window !== 'undefined'
    ? `${currentOAuthOrigin}/api/fb-oauth-callback`
    : 'http://localhost:5173/api/fb-oauth-callback';
  const currentAppDomain = typeof window !== 'undefined'
    ? getSafeHostname(currentOAuthOrigin)
    : 'localhost';
  const hasInvalidOAuthOrigin = Boolean(oauthOriginInput.trim()) && !getSafeHostname(currentOAuthOrigin);

  return (
    <div className="p-6 max-w-5xl mx-auto dark:text-gray-200 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">🔑 เฟสบุ๊ค Token Manager</h1>
        <p className="text-sm text-gray-400">
          ขอ Page Access Token ที่ <strong className="text-white">ไม่หมดอายุ</strong> สำหรับ Facebook Page & Instagram — Export เป็น JSON ใส่ n8n ได้เลย
        </p>
      </div>

      {/* Setup guide */}
      <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 text-xs text-amber-300 space-y-1">
        <p className="font-bold text-sm mb-2">⚙️ ตั้งค่าใน Facebook Developer ก่อนใช้ครั้งแรก</p>
        <p>1. ไปที่ <span className="text-white">developers.facebook.com → Your App → App Settings → Basic</span></p>
        <p>2. ใส่ App Domains: <code className="bg-black/40 px-1.5 py-0.5 rounded text-green-300">{currentAppDomain || 'ใส่ HTTPS URL ให้ครบก่อน'}</code> {currentAppDomain && <CopyBtn text={currentAppDomain} />}</p>
        <p>3. กด <span className="text-white">Add Platform → Website</span>, Site URL: <code className="bg-black/40 px-1.5 py-0.5 rounded text-green-300">{hasInvalidOAuthOrigin ? 'ใส่ HTTPS URL ให้ครบก่อน' : currentOAuthOrigin}</code> {!hasInvalidOAuthOrigin && <CopyBtn text={currentOAuthOrigin} />}</p>
        <p>4. ไปที่ <span className="text-white">Facebook Login → Settings</span> แล้วเพิ่ม Valid OAuth Redirect URI: <code className="bg-black/40 px-1.5 py-0.5 rounded text-green-300">{hasInvalidOAuthOrigin ? 'ใส่ HTTPS URL ให้ครบก่อน' : currentRedirectUri}</code> {!hasInvalidOAuthOrigin && <CopyBtn text={currentRedirectUri} />}</p>
        <p>5. กด Save Changes แล้วกลับมาใช้ได้เลย</p>
        {hasInvalidOAuthOrigin && (
          <p className="pt-2 text-red-200">
            URL ยังไม่ครบ กรุณาใส่ให้ขึ้นต้นด้วย https:// และมีโดเมนครบ เช่น https://purple-spiders-thank.loca.lt
          </p>
        )}
        {!hasInvalidOAuthOrigin && !currentOAuthOrigin.startsWith('https://') && (
          <p className="pt-2 text-red-200">
            Meta ไม่รับ HTTP Redirect URI ใหม่แล้ว ถ้าช่อง Facebook Login ขึ้นว่า New HTTP Redirect URIs are not allowed ให้ใช้ HTTPS URL จาก ngrok/Cloudflare Tunnel
          </p>
        )}
        {!hasInvalidOAuthOrigin && typeof window !== 'undefined' && window.location.origin !== currentOAuthOrigin && (
          <p className="pt-2 text-amber-200">
            ตอนนี้จะใช้ OAuth ผ่าน <code className="bg-black/40 px-1.5 py-0.5 rounded text-green-300">{currentOAuthOrigin}</code>
          </p>
        )}
      </div>

      {/* Step 1: Credentials + Login */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 space-y-4">
        <h2 className="font-bold text-lg">① App Credentials</h2>
        <p className="text-xs text-gray-400">
          ดูได้ที่ <span className="text-blue-400">developers.facebook.com → Your App → App Settings → Basic</span>
        </p>

        <div>
          <label className="block text-sm mb-1 text-gray-300">HTTPS OAuth URL (ถ้าใช้ ngrok/Cloudflare Tunnel)</label>
          <input
            type="text"
            value={oauthOriginInput}
            onChange={e => setOauthOriginInput(e.target.value)}
            placeholder="https://your-tunnel.ngrok-free.app"
            className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-sm font-mono focus:border-blue-500 outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            ถ้า Meta ไม่รับ http://localhost ให้ใส่ HTTPS URL ตรงนี้ แล้วคัดลอกค่าด้านบนไปตั้งค่าใน Facebook Developer
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1 text-gray-300">App ID</label>
            <input
              type="text"
              value={appId}
              onChange={e => setAppId(e.target.value)}
              placeholder="1234567890123456"
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-sm font-mono focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-300">App Secret</label>
            <input
              type="password"
              value={appSecret}
              onChange={e => setAppSecret(e.target.value)}
              placeholder="••••••••••••••••••••••••••••••••"
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-sm font-mono focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Login button */}
        <div className="pt-1">
          {loginStatus === 'success' ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 text-green-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse inline-block" />
                Login สำเร็จแล้ว
              </span>
              {expiryDate && (
                <span className="text-xs text-gray-400 bg-gray-900/50 px-2 py-1 rounded">
                  User Token หมดอายุ: {expiryDate}
                </span>
              )}
              <CopyBtn text={userToken} label="คัดลอก User Token" />
              <button
                onClick={handleLogout}
                className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-red-800 text-gray-300 hover:text-white rounded-lg transition-all"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              disabled={loginStatus === 'waiting' || loginStatus === 'saving'}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg ${
                loginStatus === 'waiting' || loginStatus === 'saving'
                  ? 'bg-blue-900/60 cursor-wait'
                  : 'bg-[#1877f2] hover:bg-[#1565d8] active:scale-95'
              }`}
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="white">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              {loginStatus === 'saving' ? 'กำลังบันทึก...' : loginStatus === 'waiting' ? 'รอ Login จาก Popup...' : 'Login with Facebook'}
            </button>
          )}
        </div>

        {loginStatus === 'waiting' && (
          <p className="text-sm text-amber-400 animate-pulse">📋 หน้าต่าง Login กำลังเปิดอยู่ — กรุณา Authorize และรอสักครู่</p>
        )}

        <div className="border-t border-gray-700 pt-4 space-y-3">
          <div>
            <h3 className="font-bold text-sm text-gray-200">วิธีง่าย: วาง User Access Token เอง</h3>
            <p className="text-xs text-gray-500">
              ถ้า Login ผ่าน popup/tunnel มีปัญหา ให้สร้าง token จาก Graph API Explorer แล้ววางตรงนี้ โปรแกรมจะแปลงเป็น long-lived token ให้
            </p>
          </div>
          <textarea
            value={manualUserToken}
            onChange={e => setManualUserToken(e.target.value)}
            placeholder="วาง User Access Token จาก Graph API Explorer ที่นี่"
            className="w-full min-h-[88px] px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-xs font-mono focus:border-blue-500 outline-none resize-y"
          />
          <button
            onClick={handleUseManualToken}
            disabled={loginStatus === 'saving'}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-all"
          >
            ใช้ Token ที่วาง แล้วแปลงเป็น Long-Lived
          </button>
        </div>
      </div>

      {/* Step 2: Fetch Pages */}
      {loginStatus === 'success' && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-bold text-lg">② ดึงรายชื่อเพจ & Instagram</h2>
            <button
              onClick={handleGetPages}
              disabled={loadingPages}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-all flex items-center gap-2"
            >
              {loadingPages
                ? <span className="inline-block animate-spin">⟳</span>
                : '🔍'} ดึงรายชื่อเพจ
            </button>
          </div>

          {rows.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900/80">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-300 font-semibold">เพจ</th>
                      <th className="text-left px-4 py-3 text-gray-300 font-semibold">Page ID</th>
                      <th className="text-left px-4 py-3 text-gray-300 font-semibold">Page Token (ไม่หมดอายุ)</th>
                      <th className="text-left px-4 py-3 text-gray-300 font-semibold">IG Account ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {rows.map(r => (
                      <tr key={r.pageId} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 font-medium max-w-[160px] truncate">{r.pageName}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-400">{r.pageId}</span>
                            <CopyBtn text={r.pageId} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-500 max-w-[120px] truncate">{r.pageToken.slice(0, 18)}…</span>
                            <CopyBtn text={r.pageToken} label="คัดลอก" />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {r.igAccountId ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-pink-400">{r.igAccountId}</span>
                              <CopyBtn text={r.igAccountId} />
                            </div>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-3 text-xs text-green-300">
                <strong>✅ Page Token เหล่านี้ไม่มีวันหมดอายุ</strong> — ได้จากการแปลงผ่าน Long-Lived User Token ตาม Facebook API spec นำไปใส่ n8n ได้เลย
              </div>

              <button
                onClick={handleExportN8N}
                className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-sm transition-all"
              >
                📥 Export JSON สำหรับ n8n
              </button>
            </>
          )}
        </div>
      )}

      {/* Error box */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm flex items-start gap-2">
          <span className="shrink-0 mt-0.5">❌</span>
          <span>{error}</span>
        </div>
      )}

      {/* n8n guide */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 space-y-2">
        <h3 className="font-bold text-gray-300">📖 วิธีใช้ Token ใน n8n</h3>
        <ol className="list-decimal list-inside space-y-1.5 text-gray-400 text-xs">
          <li>กด <strong className="text-white">Export JSON</strong> → ได้ไฟล์ที่มี page_id, page_access_token, ig_account_id ทุกเพจ</li>
          <li>Facebook Post node ใน n8n: ใส่ <code className="bg-black/30 px-1 rounded text-blue-300">page_id</code> + <code className="bg-black/30 px-1 rounded text-blue-300">page_access_token</code></li>
          <li>Instagram Post node: ใส่ <code className="bg-black/30 px-1 rounded text-pink-300">ig_account_id</code> + <code className="bg-black/30 px-1 rounded text-pink-300">page_access_token</code> (token เดียวกัน)</li>
          <li className="text-green-400">Token ไม่หมดอายุตราบเท่าที่ไม่ได้เปลี่ยน password FB หรือ Revoke Access</li>
        </ol>
      </div>
    </div>
  );
}
