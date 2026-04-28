import React, { useState, useEffect } from 'react';
import { NumInput } from '../ui/NumInput';
import { CompetitorPage } from '../../interfaces/radar';
import { RadarDashboard } from './RadarDashboard';
import { ViralPostsView } from './ViralPostsView';
import { YoutubeChannelFinder } from './YoutubeChannelFinder';
import { globalTaskStore } from '../../hooks/useBackgroundTasks';

interface ApifyUsage {
  usageUsd: number;
  limitUsd: number;
  planName: string;
  email: string;
}

export function CompetitorRadarTab() {
  const [pages, setPages] = useState<CompetitorPage[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apifyUsage, setApifyUsage] = useState<ApifyUsage | null>(null);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);
  const [debugRaw, setDebugRaw] = useState<string>('');
  const [isDeepResearching, setIsDeepResearching] = useState(false);
  const [deepResearchLimit, setDeepResearchLimit] = useState(300);
  const [scanLimit, setScanLimit] = useState(30);
  const [editingPage, setEditingPage] = useState<CompetitorPage | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editIsOwnPage, setEditIsOwnPage] = useState(false);
  const [newIsOwnPage, setNewIsOwnPage] = useState(false);
  const [editFollowers, setEditFollowers] = useState<string>('');
  const [isCustomNewCategory, setIsCustomNewCategory] = useState(false);
  const [isCustomEditCategory, setIsCustomEditCategory] = useState(false);
  const [globalScanTaskId, setGlobalScanTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!globalScanTaskId || scanLogs.length === 0) return;
    globalTaskStore.updateTask(globalScanTaskId, { progress: scanLogs[scanLogs.length - 1] });
  }, [scanLogs, globalScanTaskId]);

  const predefinedCategories = ['ทั่วไป', 'รีวิว', 'สอน AI', 'การเงิน/ลงทุน', 'ธุรกิจ/การตลาด', 'ข่าว/กระแส', 'ไลฟ์สไตล์', 'บันเทิง'];
  const allCategories = React.useMemo(() => {
    const cats = new Set(predefinedCategories);
    pages.forEach(p => { if (p.category) cats.add(p.category); });
    return Array.from(cats);
  }, [pages]);

  // ฟังก์ชัน Deep-scan หาทุก key ที่มีค่าเป็นตัวเลข (เพื่อหา usage)
  const findAllNumbers = (obj: any, prefix = ''): string[] => {
    const results: string[] = [];
    if (!obj || typeof obj !== 'object') return results;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof val === 'number') {
        results.push(`${path} = ${val}`);
      } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        results.push(...findAllNumbers(val, path));
      }
    }
    return results;
  };

  // ดึงข้อมูล Apify Credit คงเหลือ
  const checkApifyUsage = async () => {
    setIsCheckingUsage(true);
    setDebugRaw('กำลังตรวจสอบ...');
    try {
      // ดึง key จาก profile
      let currentApifyKey = '';
      const res = await fetch('/api/get-app-data?key=api_profiles');
      const profiles = await res.json();
      if (Array.isArray(profiles) && profiles.length > 0) {
        const activeId = localStorage.getItem('api_global_active_id') || profiles[0].id;
        const activeProfile = profiles.find((p: any) => p.id === activeId) || profiles[0];
        currentApifyKey = activeProfile.apifyKey || '';
      }
      if (!currentApifyKey) {
        alert('❌ ยังไม่ได้ใส่ Apify API Key ในตั้งค่า');
        setIsCheckingUsage(false);
        setDebugRaw('');
        return;
      }

      // ===== ยิง 3 API พร้อมกัน =====
      const [userRes, usageRes, limitsRes] = await Promise.all([
        fetch(`https://api.apify.com/v2/users/me?token=${currentApifyKey}`),
        fetch(`https://api.apify.com/v2/users/me/usage/monthly?token=${currentApifyKey}`),
        fetch(`https://api.apify.com/v2/users/me/limits?token=${currentApifyKey}`)
      ]);

      if (!userRes.ok) {
        alert('❌ API Key ไม่ถูกต้อง หรือหมดอายุ');
        setIsCheckingUsage(false);
        setDebugRaw('');
        return;
      }

      const userData = await userRes.json();
      const usageData = usageRes.ok ? await usageRes.json() : { error: `status ${usageRes.status}` };
      const limitsData = limitsRes.ok ? await limitsRes.json() : { error: `status ${limitsRes.status}` };

      // Scan หาตัวเลขทั้งหมดจากทุก endpoint
      const nums1 = findAllNumbers(userData?.data || userData, 'user');
      const nums2 = findAllNumbers(usageData?.data || usageData, 'usage');
      const nums3 = findAllNumbers(limitsData?.data || limitsData, 'limits');

      // สร้าง debug string แสดงผลบนหน้าจอ
      const debugLines = [
        `=== /users/me (status: ${userRes.status}) ===`,
        ...nums1,
        '',
        `=== /usage/monthly (status: ${usageRes.status}) ===`,
        ...nums2,
        '',
        `=== /limits (status: ${limitsRes.status}) ===`,
        ...nums3,
      ];
      setDebugRaw(debugLines.join('\n'));

      // ✅ ใช้ field ที่ตรวจเจอจริงจาก API:
      // limits.current.monthlyUsageUsd = 0.187 (ยอดใช้จริง)
      // limits.limits.maxMonthlyUsageUsd = 5 (ลิมิต)
      // usage.totalUsageCreditsUsdAfterVolumeDiscount = 0.187 (ยอดใช้อีกทาง)
      const limitsObj = limitsData?.data || limitsData || {};
      const usageObj = usageData?.data || usageData || {};
      const planObj = userData?.data?.plan || userData?.plan || {};

      const finalUsed = limitsObj?.current?.monthlyUsageUsd
        ?? usageObj?.totalUsageCreditsUsdAfterVolumeDiscount
        ?? usageObj?.totalUsageCreditsUsdBeforeVolumeDiscount
        ?? 0;

      const monthlyLimit = limitsObj?.limits?.maxMonthlyUsageUsd
        ?? planObj?.maxMonthlyUsageUsd
        ?? 5;

      const email = userData?.data?.email ?? userData?.email ?? 'ไม่ทราบ';
      const planName = planObj?.name ?? planObj?.id ?? 'Free';

      setApifyUsage({
        usageUsd: finalUsed,
        limitUsd: monthlyLimit,
        planName,
        email
      });
    } catch (err) {
      console.error('Apify usage check failed:', err);
      setDebugRaw(`Error: ${err}`);
      alert('❌ ตรวจสอบไม่ได้ ลองอีกครั้ง');
    }
    setIsCheckingUsage(false);
  };

  // Load Data
  useEffect(() => {
    fetch('/api/get-app-data?key=competitors')
      .then(res => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPages(data);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // Save Data
  const saveData = (data: CompetitorPage[]) => {
    fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'competitors', data })
    }).catch(console.error);
    setPages(data);
  };

  const getPlatformFromUrl = (url: string): CompetitorPage['platform'] => {
    const lUrl = url.toLowerCase();
    if (lUrl.includes('facebook.com')) return 'facebook';
    if (lUrl.includes('tiktok.com')) return 'tiktok';
    if (lUrl.includes('youtube.com')) return 'youtube';
    if (lUrl.includes('instagram.com')) return 'instagram';
    return 'unknown';
  };

  const getNameFromUrl = (url: string) => {
    try {
      const u = new URL(url);
      const paths = u.pathname.split('/').filter(p => p && p !== 'profile.php');
      // ถ้าเป็น profile.php?id=xxx ให้ใช้ id
      if (u.pathname.includes('profile.php')) {
        return u.searchParams.get('id') || 'Facebook User';
      }
      return paths[paths.length - 1] || 'Unknown Page';
    } catch {
      return url;
    }
  };

  const processAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    const newPage: CompetitorPage = {
      id: Date.now().toString(),
      url: newUrl.trim(),
      name: getNameFromUrl(newUrl.trim()),
      category: newCategory.trim() || 'ทั่วไป',
      platform: getPlatformFromUrl(newUrl.trim()),
      followers: 0,
      followerGrowth: 0,
      engagementRate: 0,
      bestTimeToPost: '-',
      topHashtags: [],
      videoSweetSpot: '-',
      lastActiveDays: 0,
      status: 'active',
      lastScraped: new Date().toISOString(),
      selected: false,
      scanSelected: true,
      isOwnPage: newIsOwnPage || undefined,
      note: newNote.trim() || undefined,
    };

    saveData([...pages, newPage]);
    setNewUrl('');
    setNewCategory('');
    setNewNote('');
    setNewIsOwnPage(false);
    setIsCustomNewCategory(false);
  };

  const handleRemove = (id: string) => {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบเพจนี้?')) {
      const updated = pages.filter(p => p.id !== id);
      saveData(updated);
    }
  };

  // ✏️ Edit page details
  const openEditModal = (page: CompetitorPage) => {
    setEditingPage(page);
    setEditName(page.name);
    setEditCategory(page.category || '');
    setEditNote(page.note || '');
    setEditIsOwnPage(!!page.isOwnPage);
    setEditFollowers(page.followers > 0 ? page.followers.toString() : '');
    setIsCustomEditCategory(false);
  };

  const saveEdit = () => {
    if (!editingPage) return;
    const updated = pages.map(p =>
      p.id === editingPage.id
        ? {
            ...p,
            name: editName.trim() || p.name,
            category: editCategory.trim(),
            note: editNote,
            isOwnPage: editIsOwnPage || undefined,
            followers: editFollowers.trim() !== '' ? parseInt(editFollowers.replace(/,/g, '')) || p.followers : p.followers,
          }
        : p
    );
    saveData(updated);
    setEditingPage(null);
    setIsCustomEditCategory(false);
  };

  // 🚀 Simulate Apify API Scan
  const handleScanNow = async () => {
    // Check Apify Key from Global Settings
    let currentApifyKey = '';
    try {
      const res = await fetch('/api/get-app-data?key=api_profiles');
      const profiles = await res.json();
      if (Array.isArray(profiles) && profiles.length > 0) {
        const activeId = localStorage.getItem('api_global_active_id') || profiles[0].id;
        const activeProfile = profiles.find((p: any) => p.id === activeId) || profiles[0];
        currentApifyKey = activeProfile.apifyKey || '';
      }
    } catch(e) {}

    if (!currentApifyKey) {
      alert('❌ กรุณาไปที่ล้อเฟือง "ตั้งค่า API" มุมขวาบน และกรอก Apify API Key ก่อนทำการสแกนครับ\\n(ระบบต้องการ API ของคุณเพื่อหลีกเลี่ยงการถูกแบน)');
      return;
    }

    setIsScanning(true);
    setScanLogs(['เริ่มกระบวนการสแกนผ่าน Apify API...']);
    const taskId = `radar_scan_${Date.now()}`;
    setGlobalScanTaskId(taskId);
    globalTaskStore.addTask({
      id: taskId,
      title: 'Radar Scan',
      category: 'radar',
      progress: 'เริ่มกระบวนการสแกนผ่าน Apify API...',
      status: 'running',
    });
    
    // Real Apify API Call processing
    const updatedPages = [...pages];
    const pagesToScan = updatedPages.filter(p => p.scanSelected !== false);
    const totalToScan = pagesToScan.length;

    if (totalToScan === 0) {
      alert('❌ ยังไม่ได้เลือกเพจที่จะ Scan กรุณาติ๊กเลือกก่อน');
      globalTaskStore.updateTask(taskId, { progress: 'ยกเลิก: ยังไม่ได้เลือกเพจที่จะ Scan', status: 'cancelled' });
      setIsScanning(false);
      setGlobalScanTaskId(null);
      return;
    }

    let scanIdx = 0;
    for (let i = 0; i < updatedPages.length; i++) {
      const page = updatedPages[i];
      if (page.scanSelected === false) continue;
      scanIdx++;
      setScanLogs(prev => [...prev, `⏳ [${scanIdx}/${totalToScan}] กำลังส่งบอทไปที่ ${page.name}...`]);

      try {
        if (page.platform === 'facebook') {
          // ✅ ใช้ facebook-posts-scraper (ดึงโพสต์จริง ไม่ใช่ข้อมูลเพจ)
          const apifyRes = await fetch(`https://api.apify.com/v2/acts/apify~facebook-posts-scraper/run-sync-get-dataset-items?token=${currentApifyKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startUrls: [{ url: page.url }],
              resultsLimit: scanLimit
            })
          });

          if (apifyRes.ok) {
            const data = await apifyRes.json();
            console.log(`[Radar] Raw FB data for ${page.name}:`, data?.length, 'items', data?.[0] ? Object.keys(data[0]) : 'empty');

            if (Array.isArray(data) && data.length > 0) {
              // Map ตาม schema จริงของ facebook-posts-scraper:
              // url = ลิงก์โพสต์ตรงๆ (e.g. facebook.com/pagename/posts/pfbid...)
              // text = เนื้อหาโพสต์
              // time = ISO string วันที่โพสต์
              // likes, comments, shares = ตัวเลข engagement
              // viewsCount = ยอดวิว (สำหรับ Reel/Video)
              // media[0].__typename = "Photo" | "Video" ฯลฯ
              const viral = data.map((d: any) => {
                const postUrl = d.url || d.topLevelUrl || page.url;
                const mediaType = d.media?.[0]?.__typename?.toLowerCase() || '';
                const postType = d.viewsCount ? 'video' : (mediaType.includes('video') ? 'video' : (mediaType.includes('photo') ? 'photo' : 'post'));

                return {
                  id: d.postId || d.facebookId || (Date.now().toString() + Math.random()),
                  url: postUrl,
                  thumbnail: '',
                  caption: d.text || 'ไม่มีข้อความ',
                  type: postType,
                  likes: d.likes || 0,
                  comments: d.comments || 0,
                  shares: d.shares || 0,
                  views: d.viewsCount || 0,
                  postedAt: d.time || new Date().toISOString()
                };
              });
              
              // Sort by total engagement
              viral.sort((a: any, b: any) => (b.likes + b.comments + b.shares + b.views) - (a.likes + a.comments + a.shares + a.views));

              // ดึงข้อมูลผู้ติดตามจาก user object ถ้ามี
              let newFollowers = page.followers;
              // ดึงชื่อเพจจริงจาก API แทนที่จะใช้ path ที่อาจเป็น profile.php
              let realName = page.name;
              if (data[0].user?.name) {
                realName = data[0].user.name;
              } else if (data[0].pageName) {
                realName = data[0].pageName;
              }
              // ลอง field ผู้ติดตามหลายชื่อ (scraper ต่างกันใช้ชื่อต่างกัน)
              const userObj = data[0].user || {};
              const followersRaw =
                userObj.followersCount ||
                userObj.followers ||
                userObj.fans ||
                userObj.likesCount ||
                userObj.subscribersCount ||
                data[0].pageFollowers ||
                data[0].followersCount ||
                0;
              if (followersRaw > 0) {
                newFollowers = followersRaw;
              }

              // ดึงรูปโปรไฟล์เพจ
              let profilePic = page.profilePicUrl || '';
              if (data[0].user?.profilePic) {
                profilePic = data[0].user.profilePic;
              } else if (data[0].user?.profilePicture) {
                profilePic = data[0].user.profilePicture;
              } else if (data[0].user?.profileUrl) {
                profilePic = data[0].user.profileUrl;
              }

              const totalEng = viral.reduce((sum: number, v: any) => sum + v.likes + v.comments, 0);
              // คำนวณ engagement เฉพาะเมื่อรู้จำนวน followers จริง ไม่งั้นให้ 0
              const engRate = (newFollowers > 0 && viral.length > 0)
                ? (totalEng / viral.length / newFollowers) * 100
                : 0;

              updatedPages[i] = {
                ...page,
                name: realName,
                followers: newFollowers,
                profilePicUrl: profilePic || page.profilePicUrl,
                followerGrowth: 0,
                engagementRate: engRate,
                status: 'active',
                lastScraped: new Date().toISOString(),
                viralPosts: viral
              };
              setScanLogs(prev => [...prev, `✅ ดึงข้อมูล ${realName} สำเร็จ (พบ ${viral.length} โพสต์)`]);
              continue;
            } else {
              setScanLogs(prev => [...prev, `⚠️ ไม่พบข้อมูลโพสต์สำหรับ ${page.name}`]);
            }
          } else {
            const errText = await apifyRes.text().catch(() => 'unknown');
            setScanLogs(prev => [...prev, `❌ ดึงข้อมูล ${page.name} ล้มเหลว (${apifyRes.status}: ${errText.substring(0, 100)})`]);
          }
        } else if (page.platform === 'tiktok') {
          // TikTok Scraper (clockwork/tiktok-profile-scraper)
          const apifyRes = await fetch(`https://api.apify.com/v2/acts/clockwork~tiktok-profile-scraper/run-sync-get-dataset-items?token=${currentApifyKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profiles: [page.url.split('@')[1]?.split('?')[0] || page.url],
              resultsPerPage: scanLimit
            })
          });

          if (apifyRes.ok) {
            const data = await apifyRes.json();
            if (Array.isArray(data) && data.length > 0) {
              // Extract posts
              const userStats = data[0].authorMeta || {};
              const posts = data.map((d: any) => ({
                 id: d.id || Date.now().toString() + Math.random(),
                 url: d.webVideoUrl || page.url,
                 thumbnail: '',
                 caption: d.text || d.desc || 'ไม่มีข้อความ',
                 type: 'video',
                 likes: d.diggCount || 0,
                 comments: d.commentCount || 0,
                 shares: d.shareCount || 0,
                 views: d.playCount || 0,
                 postedAt: new Date(d.createTime * 1000).toISOString()
              }));

              updatedPages[i] = {
                ...page,
                followers: userStats.fans || page.followers,
                profilePicUrl: userStats.avatar || userStats.avatarThumb || userStats.avatarMedium || page.profilePicUrl,
                engagementRate: posts.length > 0 ? ((posts[0].likes + posts[0].comments) / Math.max(userStats.fans || 1, 1)) * 100 : 0,
                status: 'active',
                lastScraped: new Date().toISOString(),
                viralPosts: posts
              };
              setScanLogs(prev => [...prev, `✅ ดึงข้อมูล ${page.name} สำเร็จ (พบ ${posts.length} ไวรัลโพสต์)`]);
              continue;
            } else {
              setScanLogs(prev => [...prev, `⚠️ ไม่พบข้อมูลวิดีโอสำหรับ ${page.name}`]);
            }
          } else {
            setScanLogs(prev => [...prev, `❌ ดึงข้อมูล ${page.name} ล้มเหลว (API Error)`]);
          }
        } else {
           setScanLogs(prev => [...prev, `⏭️ ข้าม ${page.name} (แพลตฟอร์มยังไม่รองรับการดึงสด)`]);
        }
      } catch (err) {
        console.error(`Failed to scan ${page.url}`, err);
        setScanLogs(prev => [...prev, `❌ Error: การเชื่อมต่อล้มเหลวสำหรับ ${page.name}`]);
      }
    }

    saveData(updatedPages);
    setScanLogs(prev => [...prev, `🎉 สแกนเสร็จสิ้น ${totalToScan} เพจ!`]);
    globalTaskStore.updateTask(taskId, { progress: `🎉 สแกนเสร็จสิ้น ${totalToScan} เพจ!`, status: 'completed' });
    setTimeout(() => {
       setIsScanning(false);
       setGlobalScanTaskId(null);
    }, 2000);
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

  const toggleScanSelect = (id: string) => {
    const updated = pages.map(p => p.id === id ? { ...p, scanSelected: !p.scanSelected } : p);
    saveData(updated);
  };

  const toggleAllScan = (val: boolean) => {
    const updated = pages.map(p => ({ ...p, scanSelected: val }));
    saveData(updated);
  };

  // 🔬 Deep Research: ดึง 300 โพสต์ → CSV
  const handleDeepResearch = async (page: CompetitorPage) => {
    if (page.platform !== 'facebook') {
      alert('ขณะนี้ Deep Research รองรับเฉพาะ Facebook เท่านั้น');
      return;
    }
    
    setIsDeepResearching(true);
    setScanLogs([`🔬 เริ่ม Deep Research สำหรับ ${page.name} (ดึง ${deepResearchLimit} โพสต์)...`]);
    setIsScanning(true);
    const taskId = `radar_deep_${page.id}_${Date.now()}`;
    setGlobalScanTaskId(taskId);
    globalTaskStore.addTask({
      id: taskId,
      title: `Deep Research: ${page.name}`,
      category: 'radar',
      progress: `🔬 เริ่ม Deep Research สำหรับ ${page.name}`,
      status: 'running',
    });

    try {
      let currentApifyKey = '';
      const res = await fetch('/api/get-app-data?key=api_profiles');
      const profiles = await res.json();
      if (Array.isArray(profiles) && profiles.length > 0) {
        const activeId = localStorage.getItem('api_global_active_id') || profiles[0].id;
        const activeProfile = profiles.find((p: any) => p.id === activeId) || profiles[0];
        currentApifyKey = activeProfile.apifyKey || '';
      }
      if (!currentApifyKey) {
        alert('❌ กรุณาใส่ Apify API Key ก่อน');
        globalTaskStore.updateTask(taskId, { progress: 'ยกเลิก: ยังไม่ได้ใส่ Apify API Key', status: 'cancelled' });
        setIsDeepResearching(false);
        setIsScanning(false);
        setGlobalScanTaskId(null);
        return;
      }

      setScanLogs(prev => [...prev, `⏳ กำลังดึง ${deepResearchLimit} โพสต์... (อาจใช้เวลา 2-5 นาที)`]);

      const apifyRes = await fetch(`https://api.apify.com/v2/acts/apify~facebook-posts-scraper/run-sync-get-dataset-items?token=${currentApifyKey}&timeout=300`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: page.url }],
          resultsLimit: deepResearchLimit
        })
      });

      if (!apifyRes.ok) {
        setScanLogs(prev => [...prev, `❌ API Error: ${apifyRes.status}`]);
        globalTaskStore.updateTask(taskId, { progress: `❌ API Error: ${apifyRes.status}`, status: 'error' });
        setIsDeepResearching(false);
        setIsScanning(false);
        setGlobalScanTaskId(null);
        return;
      }

      const data = await apifyRes.json();
      setScanLogs(prev => [...prev, `✅ ได้ข้อมูล ${data.length} โพสต์ กำลังสร้าง CSV...`]);

      // สร้าง CSV
      const csvHeader = 'ลำดับ,ชื่อเพจ,ลิงก์โพส,ข้อความ,ประเภท,ไลก์,แชร์,คอมเมนต์,ยอดวิว,วันที่โพส';
      const csvRows = data.map((d: any, idx: number) => {
        const postUrl = d.url || d.topLevelUrl || '';
        const text = (d.text || '').replace(/[\n\r,"]/g, ' ').substring(0, 200);
        const mediaType = d.viewsCount ? 'video' : (d.media?.[0]?.__typename?.toLowerCase()?.includes('video') ? 'video' : 'photo');
        const pageName = d.user?.name || page.name;
        return `${idx+1},"${pageName}","${postUrl}","${text}",${mediaType},${d.likes||0},${d.shares||0},${d.comments||0},${d.viewsCount||0},"${d.time||''}"`;
      });

      const csvContent = '\uFEFF' + csvHeader + '\n' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deep_research_${page.name}_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      // 💾 บันทึก CSV ไว้ในเซิร์ฟเวอร์เพื่อให้ดาวน์โหลดซ้ำได้
      try {
        await fetch('/api/save-app-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: `deep_research_${page.id}`, data: csvContent })
        });
      } catch (e) {
        console.warn('Failed to save CSV to server:', e);
      }

      // 📝 อัปเดตสถานะ Deep Research ลงใน page data
      const now = new Date().toISOString();
      const updatedPages = pages.map(p =>
        p.id === page.id
          ? { ...p, deepResearchDate: now, deepResearchPostCount: data.length }
          : p
      );
      saveData(updatedPages);

      setScanLogs(prev => [...prev, `🎉 ดาวน์โหลด CSV สำเร็จ! (${data.length} โพสต์)`]);
      globalTaskStore.updateTask(taskId, { progress: `🎉 ดาวน์โหลด CSV สำเร็จ! (${data.length} โพสต์)`, status: 'completed' });
    } catch (err) {
      setScanLogs(prev => [...prev, `❌ Error: ${err}`]);
      globalTaskStore.updateTask(taskId, { progress: `❌ Error: ${err}`, status: 'error' });
    }

    setIsDeepResearching(false);
    setTimeout(() => {
      setIsScanning(false);
      setGlobalScanTaskId(null);
    }, 3000);
  };

  // 📥 ดาวน์โหลด CSV วิจัยลึกที่บันทึกไว้
  const handleDownloadSavedCSV = async (page: CompetitorPage) => {
    try {
      const res = await fetch(`/api/get-app-data?key=deep_research_${page.id}`);
      const csvData = await res.json();
      
      if (!csvData || (typeof csvData === 'object' && !Array.isArray(csvData) && Object.keys(csvData).length === 0)) {
        alert('❌ ไม่พบไฟล์ CSV ที่บันทึกไว้ กรุณากดวิจัยลึกใหม่');
        return;
      }

      const csvContent = typeof csvData === 'string' ? csvData : JSON.stringify(csvData);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = page.deepResearchDate ? new Date(page.deepResearchDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      a.download = `deep_research_${page.name}_${dateStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download saved CSV:', err);
      alert('❌ ดาวน์โหลดไม่สำเร็จ กรุณาลองวิจัยลึกใหม่');
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading Radar...</div>;

  return (
    <div className="space-y-6">
      
      <div className="flex justify-between items-center p-6 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>🕵️‍♂️ เรดาร์สืบคู่แข่ง (Competitor Radar)</h2>
          <p className="mt-1" style={{ color: 'var(--text-muted, #888)' }}>มอนิเตอร์กลยุทธ์ของคู่แข่งแบบไม่จำกัดจำนวน เฝ้าระวังอัตราการเติบโต และเจาะลึกคอนเทนต์ไวรัล</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="text-sm font-semibold px-4 py-2 rounded-lg shadow-sm border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              ติดตามแล้ว: <span className="text-green-500">{pages.length}</span> เพจ
           </div>
           <div className="flex items-center gap-2">

             <button 
               onClick={handleScanNow}
               disabled={isScanning || pages.filter(p => p.scanSelected !== false).length === 0}
               className={`px-5 py-3 rounded-lg font-bold text-white transition-all shadow-lg flex items-center gap-2 text-sm ${
                 isScanning || pages.filter(p => p.scanSelected !== false).length === 0
                 ? 'bg-gray-400 cursor-not-allowed opacity-70' 
                 : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 hover:-translate-y-0.5'
               } ${isScanning && 'animate-pulse'}`}
             >
               {isScanning && !isDeepResearching ? 'กำลังสแกน...' : `🚀 Scan ${pages.filter(p => p.scanSelected !== false).length} เพจ`}
             </button>
           </div>
        </div>
      </div>

      {/* Apify Credit Balance Widget */}
      <div className="flex items-center gap-4 p-4 rounded-xl border bg-[var(--bg-card)] border-[var(--border-color)]">
        <button
          onClick={checkApifyUsage}
          disabled={isCheckingUsage}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
            isCheckingUsage
            ? 'cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
          }`}
          style={isCheckingUsage ? { backgroundColor: 'var(--border-color)', color: 'var(--text-muted, #888)' } : {}}
        >
          {isCheckingUsage ? '⏳ กำลังตรวจ...' : '💰 เช็คเครดิต Apify'}
        </button>

        {apifyUsage && (() => {
          const pct = apifyUsage.limitUsd > 0 ? (apifyUsage.usageUsd / apifyUsage.limitUsd) * 100 : 0;
          const remaining = Math.max(apifyUsage.limitUsd - apifyUsage.usageUsd, 0);
          const barColor = pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-green-500';
          const textColor = pct >= 90 ? 'text-red-500' : pct >= 60 ? 'text-amber-500' : 'text-green-500';

          return (
            <div className="flex-1 flex items-center gap-6">
              {/* Account Info */}
              <div className="text-xs">
                <div className="text-gray-500">บัญชี: <span className="font-bold text-[var(--text-color)]">{apifyUsage.email}</span></div>
                <div className="text-gray-500">แพลน: <span className="font-bold text-indigo-500">{apifyUsage.planName}</span></div>
              </div>

              {/* Progress Bar */}
              <div className="flex-1">
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-gray-500">ใช้ไป: ${apifyUsage.usageUsd.toFixed(2)}</span>
                  <span className={textColor}>คงเหลือ: ${remaining.toFixed(2)} / ${apifyUsage.limitUsd.toFixed(2)}</span>
                </div>
                <div className="w-full rounded-full h-3 overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
                  <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div className="text-right text-[10px] text-gray-400 mt-1">{pct.toFixed(1)}% ของลิมิตรายเดือน</div>
              </div>

              {/* Status Badge */}
              {pct >= 90 ? (
                <div className="px-3 py-2 rounded-lg text-xs font-bold text-red-500 text-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  ⚠️ ใกล้หมด!<br/>สลับอีเมลได้เลย
                </div>
              ) : pct >= 60 ? (
                <div className="px-3 py-2 rounded-lg text-xs font-bold text-amber-500 text-center" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  🟡 เกินครึ่ง<br/>เตรียมสำรอง
                </div>
              ) : (
                <div className="px-3 py-2 rounded-lg text-xs font-bold text-green-500 text-center" style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                  ✅ ยังสบาย<br/>ใช้ได้อีกเยอะ
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* 🔧 Debug Panel - แสดง raw data จาก API (ลบทิ้งเมื่อทำงานถูกต้องแล้ว) */}
      {debugRaw && (
        <div className="bg-[#1a1a2e] border border-purple-600 p-4 rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-purple-400 font-bold text-xs">🔧 DEBUG: ข้อมูลดิบจาก Apify API (ตัวเลขทั้งหมดที่พบ)</span>
            <button onClick={() => setDebugRaw('')} className="text-red-400 text-xs hover:text-red-300">✕ ปิด</button>
          </div>
          <pre className="text-[11px] text-green-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">{debugRaw}</pre>
        </div>
      )}

      {/* Terminal Log View */}
      {isScanning && scanLogs.length > 0 && (
        <div className="bg-[#0a0a0a] border border-gray-800 p-4 rounded-xl font-mono text-xs max-h-40 overflow-y-auto shadow-inner flex flex-col gap-1">
          {scanLogs.map((log, idx) => (
            <div key={idx} className={
              log.includes('✅') ? 'text-green-400' :
              log.includes('❌') || log.includes('Error') ? 'text-red-400' : 
              log.includes('⚠️') ? 'text-amber-400' : 'text-gray-400'
            }>
              <span className="text-gray-600 mr-2">[{new Date().toLocaleTimeString()}]</span> {log}
            </div>
          ))}
        </div>
      )}

      <RadarDashboard pages={pages} />

      <YoutubeChannelFinder />



      {/* Pages List */}
      <div className="p-6 rounded-2xl border bg-[var(--bg-card)] border-[var(--border-color)]">
        <h3 className="text-lg font-semibold mb-4">ฟีดเพจเป้าหมาย (Watchlist)</h3>
        
        <form onSubmit={processAddUrl} className="flex gap-2 mb-6 flex-wrap">
          <input 
             type="url" 
             value={newUrl}
             onChange={e => setNewUrl(e.target.value)}
             placeholder="วาง Link เพจ (Facebook, TikTok, YouTube)..."
             className="flex-1 min-w-[300px] px-4 py-2 border rounded-lg bg-transparent border-[var(--border-color)] focus:ring-2 focus:ring-green-500 outline-none"
             required
          />
          {isCustomNewCategory ? (
            <div className="flex items-center gap-1 w-[180px]">
              <input 
                 type="text" 
                 value={newCategory}
                 onChange={e => setNewCategory(e.target.value)}
                 placeholder="พิมพ์ประเภท..."
                 className="w-full px-3 py-2 border rounded-lg bg-transparent border-[var(--border-color)] focus:ring-2 focus:ring-blue-500 outline-none"
                 autoFocus
              />
              <button 
                 type="button" 
                 onClick={() => { setIsCustomNewCategory(false); setNewCategory(''); }}
                 className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg text-sm"
              >
                 ✕
              </button>
            </div>
          ) : (
            <select
               value={newCategory}
               onChange={e => {
                 if (e.target.value === 'NEW') {
                   setIsCustomNewCategory(true);
                   setNewCategory('');
                 } else {
                   setNewCategory(e.target.value);
                 }
               }}
               className="w-[180px] px-3 py-2 border rounded-lg bg-transparent border-[var(--border-color)] focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
               style={{ color: newCategory ? 'var(--text-main)' : 'var(--text-muted, #888)' }}
            >
               <option value="" disabled className="bg-[var(--bg-card)]">-- เลือกประเภท --</option>
               {allCategories.map(c => (
                 <option key={c} value={c} className="bg-[var(--bg-card)] text-[var(--text-main)]">{c}</option>
               ))}
               <option value="NEW" className="font-bold bg-[var(--bg-card)] text-blue-500">+ กดสร้างประเภทใหม่</option>
            </select>
          )}
          <input 
             type="text" 
             value={newNote}
             onChange={e => setNewNote(e.target.value)}
             placeholder="📝 Note (ไม่บังคับ)"
             className="w-[180px] px-4 py-2 border rounded-lg bg-transparent border-[var(--border-color)] focus:ring-2 focus:ring-amber-500 outline-none text-sm"
          />
          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border whitespace-nowrap select-none" style={{ borderColor: newIsOwnPage ? '#fbbf24' : 'var(--border-color)', backgroundColor: newIsOwnPage ? 'rgba(251,191,36,0.12)' : 'transparent' }}>
            <input
              type="checkbox"
              checked={newIsOwnPage}
              onChange={e => setNewIsOwnPage(e.target.checked)}
              className="w-4 h-4 accent-yellow-400 cursor-pointer"
            />
            <span className="text-sm font-semibold" style={{ color: newIsOwnPage ? '#fbbf24' : 'var(--text-muted, #888)' }}>⭐ เพจของฉัน</span>
          </label>
          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg whitespace-nowrap">
             + เพิ่มเพจ
          </button>
        </form>

        {/* Select All / Deselect All */}
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => toggleAllScan(true)} className="text-xs px-3 py-1 rounded font-semibold" style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
            ✅ เลือกทั้งหมด
          </button>
          <button onClick={() => toggleAllScan(false)} className="text-xs px-3 py-1 rounded font-semibold" style={{ backgroundColor: 'var(--surface, var(--bg-card))', color: 'var(--text-muted, #888)' }}>
            ☐ ยกเลิกทั้งหมด
          </button>
          <span className="text-xs text-gray-500">เลือก Scan: {pages.filter(p => p.scanSelected !== false).length}/{pages.length} เพจ</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b" style={{ borderColor: 'var(--border-color)' }}>
              <tr>
                <th className="pb-3 font-semibold text-gray-500 w-10">Scan</th>
                <th className="pb-3 font-semibold text-gray-500">แพลตฟอร์ม/หน้าเพจ</th>
                <th className="pb-3 font-semibold text-gray-500">ประเภท</th>
                <th className="pb-3 font-semibold text-gray-500 text-right">ผู้ติดตาม</th>
                <th className="pb-3 font-semibold text-gray-500 text-right">Engagement</th>
                <th className="pb-3 font-semibold text-gray-500 text-center">สถานะ</th>
                <th className="pb-3 font-semibold text-gray-500 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pages.length === 0 && (
                <tr>
                   <td colSpan={7} className="py-8 text-center text-gray-400">ยังไม่มีข้อมูลในตาราง</td>
                </tr>
              )}
              {pages.map(page => (
                <tr key={page.id} className={`border-b last:border-0 transition-colors ${page.scanSelected === false ? 'opacity-50' : ''}`} style={{ borderColor: 'var(--border-color)' }}>
                  {/* Scan Checkbox */}
                  <td className="py-4">
                    <input 
                      type="checkbox" 
                      checked={page.scanSelected !== false}
                      onChange={() => toggleScanSelect(page.id)}
                      className="w-4 h-4 accent-green-500 cursor-pointer"
                    />
                  </td>
                  <td className="py-4">
                     <div className="flex items-center gap-3">
                        {page.profilePicUrl ? (
                          <img 
                            src={page.profilePicUrl} 
                            alt={page.name}
                            className="w-9 h-9 rounded-full object-cover border-2 flex-shrink-0"
                            style={{ borderColor: 'var(--border-color)' }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling && ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).style.removeProperty('display'); }}
                          />
                        ) : null}
                        <span className="text-2xl flex-shrink-0" style={{ width: '36px', height: '36px', lineHeight: '36px', textAlign: 'center', display: page.profilePicUrl ? 'none' : 'inline-block' }}>{getPlatformIcon(page.platform)}</span>
                        <div>
                           <div className="font-semibold flex items-center gap-1.5 flex-wrap" style={{ color: page.isOwnPage ? '#fbbf24' : 'var(--text-main)' }}>
                             {page.name}
                             {page.isOwnPage && (
                               <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: '#fbbf24', color: '#1a1a1a' }}>⭐ ของฉัน</span>
                             )}
                           </div>
                           <a href={page.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1">
                              เปิดดู <span className="text-[10px]">↗</span>
                           </a>
                           {page.note && (
                             <div className="text-[10px] mt-0.5 truncate max-w-[180px]" style={{ color: 'var(--text-muted, #888)' }} title={page.note}>
                               📝 {page.note}
                             </div>
                           )}
                        </div>
                     </div>
                  </td>
                  <td className="py-4">
                    <span className="px-2 py-1 rounded-full text-[11px] font-semibold" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent)' }}>
                      {page.category || 'ทั่วไป'}
                    </span>
                  </td>
                  <td className="py-4 text-right font-medium">{page.followers > 0 ? page.followers.toLocaleString() : '-'}</td>
                  <td className="py-4 text-right font-medium">
                     {page.engagementRate > 0 ? <span className="text-orange-500">{page.engagementRate.toFixed(2)}%</span> : '-'}
                  </td>
                  <td className="py-4 text-center">
                     <div className="flex flex-col items-center gap-1">
                       {page.status === 'dead' ? (
                         <span className="px-2 py-1 rounded text-xs font-semibold" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>ผีป่าช้า</span>
                       ) : (page.viralPosts && page.viralPosts.length > 0) || page.followers > 0 ? (
                         <span className="px-2 py-1 rounded text-xs font-semibold" style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>✅ สแกนแล้ว</span>
                       ) : (
                         <span className="px-2 py-1 rounded text-xs font-semibold" style={{ backgroundColor: 'var(--surface, var(--bg-card))', color: 'var(--text-muted, #888)' }}>รอสแกน</span>
                       )}
                       {page.deepResearchDate && (
                         <span className="px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }} title={`วิจัยลึกเมื่อ ${new Date(page.deepResearchDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })} (${page.deepResearchPostCount || 0} โพสต์)`}>
                           🔬 วิจัยลึกแล้ว ({new Date(page.deepResearchDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})
                         </span>
                       )}
                     </div>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <NumInput min={10} max={1000} value={deepResearchLimit} onChange={setDeepResearchLimit} className="w-14 px-1 py-0.5 text-[11px] text-center rounded border bg-transparent focus:ring-1 focus:ring-purple-500 outline-none" />
                          <button 
                            onClick={() => handleDeepResearch(page)} 
                            disabled={isDeepResearching}
                            className="px-2 py-1 rounded transition-colors text-xs font-bold"
                            style={{ color: 'var(--accent)' }}
                            title={`ดึง ${deepResearchLimit} โพสต์ส่งเป็น CSV`}
                          >
                            🔬 วิจัยลึก
                          </button>
                        </div>
                        {page.deepResearchDate && (
                          <button
                            onClick={() => handleDownloadSavedCSV(page)}
                            className="px-2 py-1 rounded transition-colors text-xs font-bold"
                            style={{ color: '#22d3ee' }}
                            title={`ดาวน์โหลด CSV วิจัยลึก (${new Date(page.deepResearchDate).toLocaleDateString('th-TH')})`}
                          >
                            📥 CSV
                          </button>
                        )}
                        <button 
                          onClick={() => openEditModal(page)} 
                          className="px-2 py-1 rounded transition-colors text-xs font-bold"
                          style={{ color: '#f59e0b' }}
                          title="แก้ไขรายละเอียดเพจ"
                        >
                          ✏️ แก้ไข
                        </button>
                        <button onClick={() => handleRemove(page.id)} className="text-red-500 px-2 py-1 rounded transition-colors text-xs font-medium">
                          ✕ ลบ
                        </button>
                      </div>
                      {page.deepResearchDate && (
                        <span className="text-[10px] text-gray-400">
                          วิจัยล่าสุด: {new Date(page.deepResearchDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Viral Posts List Component */}
      <ViralPostsView pages={pages} />

      {/* ✏️ Edit Modal */}
      {editingPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setEditingPage(null)}>
          <div 
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl border"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>✏️ แก้ไขรายละเอียดเพจ</h3>
              <button onClick={() => setEditingPage(null)} className="text-xl opacity-50 hover:opacity-100" style={{ color: 'var(--text-main)' }}>✕</button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary, #aaa)' }}>ชื่อเพจ</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)', '--tw-ring-color': 'var(--accent)' } as any}
                  placeholder="ชื่อเพจ"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary, #aaa)' }}>ประเภท</label>
                {isCustomEditCategory ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editCategory}
                      onChange={e => setEditCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)', '--tw-ring-color': 'var(--accent)' } as any}
                      placeholder="พิมพ์ประเภท..."
                      autoFocus
                    />
                    <button 
                      type="button" 
                      onClick={() => setIsCustomEditCategory(false)}
                      className="px-3 py-2 text-sm font-semibold rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 whitespace-nowrap"
                    >
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <select
                    value={allCategories.includes(editCategory) ? editCategory : (editCategory ? 'NEW' : '')}
                    onChange={e => {
                      if (e.target.value === 'NEW') {
                        setIsCustomEditCategory(true);
                        setEditCategory('');
                      } else {
                        setEditCategory(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2 cursor-pointer"
                    style={{ borderColor: 'var(--border-color)', color: editCategory ? 'var(--text-main)' : 'var(--text-muted, #888)', '--tw-ring-color': 'var(--accent)' } as any}
                  >
                    <option value="" disabled className="bg-[var(--bg-card)]">-- เลือกประเภท --</option>
                    {allCategories.map(c => (
                      <option key={c} value={c} className="bg-[var(--bg-card)] text-[var(--text-main)]">{c}</option>
                    ))}
                    <option value="NEW" className="font-bold bg-[var(--bg-card)] text-amber-500">+ กดสร้างประเภทใหม่</option>
                  </select>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary, #aaa)' }}>📝 บันทึก / Note</label>
                <textarea
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2 resize-none"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)', '--tw-ring-color': 'var(--accent)' } as any}
                  placeholder="บันทึกรายละเอียดเพจ เช่น จุดเด่น, กลยุทธ์, สิ่งที่น่าสนใจ..."
                />
              </div>

              {/* Followers (manual) */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary, #aaa)' }}>
                  👥 ผู้ติดตาม <span className="font-normal opacity-60">(กรอกเองถ้า Scan ไม่ได้ข้อมูล)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editFollowers}
                  onChange={e => setEditFollowers(e.target.value.replace(/[^0-9,]/g, ''))}
                  className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)', '--tw-ring-color': '#60a5fa' } as any}
                  placeholder="เช่น 50000"
                />
              </div>

              {/* isOwnPage Toggle */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 transition-all" style={{ borderColor: editIsOwnPage ? '#fbbf24' : 'var(--border-color)', backgroundColor: editIsOwnPage ? 'rgba(251,191,36,0.10)' : 'transparent' }}>
                  <input
                    type="checkbox"
                    checked={editIsOwnPage}
                    onChange={e => setEditIsOwnPage(e.target.checked)}
                    className="w-5 h-5 accent-yellow-400 cursor-pointer"
                  />
                  <div>
                    <div className="text-sm font-bold" style={{ color: editIsOwnPage ? '#fbbf24' : 'var(--text-main)' }}>⭐ นี่คือเพจของฉัน</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted, #888)' }}>เพิ่มเพจนี้ใน Dashboard จัดอันดับเทียบคู่แข่ง</div>
                  </div>
                </label>
              </div>

              {/* URL (read-only) */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary, #aaa)' }}>URL</label>
                <div className="text-xs px-3 py-2 rounded-lg truncate" style={{ backgroundColor: 'var(--surface, var(--bg-main))', color: 'var(--text-muted, #888)' }}>
                  {editingPage.url}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingPage(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: 'var(--surface, var(--bg-main))', color: 'var(--text-muted, #888)' }}
              >
                ยกเลิก
              </button>
              <button
                onClick={saveEdit}
                className="px-5 py-2 rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                💾 บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
