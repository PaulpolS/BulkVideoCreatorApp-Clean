import React, { useState, useEffect } from 'react';
import { initApiSettings } from './hooks/useApiSettings';
import ThemeSwitcher from './components/layout/ThemeSwitcher';
import GlobalSettings from './components/layout/GlobalSettings';
import { ApiKeyQuickBar } from './components/layout/ApiKeyQuickBar';
import { GlobalTaskOverlay } from './components/layout/GlobalTaskOverlay';
import { Sidebar, TabId } from './components/layout/Sidebar';
import { DashboardHome } from './components/home/DashboardHome';
import { AIContentGenerator } from './components/ai/AIContentGenerator';
import { ContentStock } from './components/ai/ContentStock';
import { useContentStock, ContentIdea } from './hooks/useContentStock';
import { VideoEditor } from './components/editor/VideoEditor';
import { FinancialDocumentaryTab } from './components/financial/FinancialDocumentaryTab';
import { AssetManagementTab } from './components/financial/AssetManagementTab';
import { AvatarCreator } from './components/avatar/AvatarCreator';
import { CloneTab } from './components/clone/CloneTab';
import { FlowAutomatorTab } from './components/automator/FlowAutomatorTab';
import { LazadaTab } from './components/lazada/LazadaTab';
import { NewsScraperTab } from './components/news/NewsScraperTab';
import { SingleClipEditorTab } from './components/editor/SingleClipEditorTab';
import { HoroscopeTab } from './components/horoscope/HoroscopeTab';
import { TrackingTab } from './components/tracking/TrackingTab';
import { CompetitorRadarTab } from './components/radar/CompetitorRadarTab';
import { SystemCleanerTab } from './components/cleaner/SystemCleanerTab';
import { SecurityScannerTab } from './components/scanner/SecurityScannerTab';
import { VideoPromptGeneratorTab } from './components/prompt/VideoPromptGeneratorTab';
import AutoVideoEditorTab from './components/video/AutoVideoEditorTab';
import { OnlineCourseTab } from './components/course/OnlineCourseTab';
import { AIPagePostGeneratorTab } from './components/prompt/AIPagePostGeneratorTab';
import { CanvasEditorTab } from './components/canvas/CanvasEditorTab';
import { ArticleStockTab } from './components/stock/ArticleStockTab';
import { PageStockTab } from './components/stock/PageStockTab';
import { StockClipTab } from './components/stock/StockClipTab';
import { TopGainersFactoryTab } from './components/stock/TopGainersFactoryTab';
import { FbTokenTab } from './components/fbtoken/FbTokenTab';
import { StoryArchitectTab } from './components/StoryArchitectTab';

const VALID_TAB_IDS: TabId[] = [
  'home', 'singleclip', 'bulk', 'financial', 'stockclip', 'news', 'articlestock', 'assets',
  'avatar', 'clone', 'automator', 'lazada', 'horoscope', 'tracking', 'radar',
  'cleaner', 'scanner', 'prompt', 'autoeditor', 'course', 'canvas', 'aipage', 'pagestock', 'topgainers', 'fbtoken',
  'storyarchitect',
];

function App() {
  const { stock, addContent, deleteContent, markAsRendered, markMultipleAsRendered, getCategories } = useContentStock();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTabState] = useState<TabId>(() => {
    const storedTab = localStorage.getItem('activeTab') as TabId | null;
    return storedTab && VALID_TAB_IDS.includes(storedTab) ? storedTab : 'home';
  });
  const setActiveTab = (tab: TabId) => { localStorage.setItem('activeTab', tab); setActiveTabState(tab); };
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(new Set<TabId>(['home']));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingBulkItems, setPendingBulkItems] = useState<{
    rawArticle: string;
    sourceUrl: string;
    title: string;
    tags?: string[];
    images?: string[];
    sourceType?: string;
    channelName?: string;
    channelLogoUrl?: string;
    channelAvatar?: string;
    subscriberCount?: number;
    ytExtracted?: boolean;
  }[] | undefined>(undefined);
  const [pendingYoutubeUrls, setPendingYoutubeUrls] = useState<string[] | undefined>(undefined);

  const handleSendToAIPage = (items: {
    rawArticle: string;
    sourceUrl: string;
    title: string;
    tags?: string[];
    images?: string[];
    sourceType?: string;
    channelName?: string;
    channelLogoUrl?: string;
    channelAvatar?: string;
    subscriberCount?: number;
    ytExtracted?: boolean;
  }[]) => {
    setPendingBulkItems(items);
    setActiveTab('aipage');
  };

  const handleNavigateToYoutubeExtract = (urls: string[]) => {
    setPendingYoutubeUrls(urls);
    setActiveTab('news');
  };

  // Sync server api_profiles → localStorage once on startup so sync key getters always work
  useEffect(() => { initApiSettings(); }, []);

  // Track visited tabs for keep-alive (lazy mount, never unmount)
  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      return new Set([...prev, activeTab]);
    });
  }, [activeTab]);

  // Clear pending items after AI Page tab has consumed them
  useEffect(() => {
    if (pendingBulkItems && activeTab === 'aipage') {
      const timer = setTimeout(() => setPendingBulkItems(undefined), 500);
      return () => clearTimeout(timer);
    }
  }, [pendingBulkItems, activeTab]);

  const handleContentGenerated = (data: any[]) => {
    addContent(data);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const unusedIds = stock.filter(s => s.status === 'unused').map(s => s.id);
    setSelectedIds(unusedIds);
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleRendered = (ids: string[]) => {
    markMultipleAsRendered(ids);
    setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
  };

  const selectedItems = stock.filter(s => selectedIds.includes(s.id));

  const TAB_TITLES: Record<TabId, string> = {
    home: '📋 Dashboard',
    singleclip: '✂️ คัตชนคลิป',
    bulk: '📹 Bulk Video Creator',
    financial: '🎙️ สตูดิโอเล่าเรื่อง',
    stockclip: '🎞️ ทำคลิปStock',
    news: '🔍 ค้นหาContent น่าสนใจ',
    assets: '📂 คลังแสง',
    avatar: '👨‍🎨 อวาตาร์ PNGTuber',
    clone: '🖼️ โคลนนิ่งเพจ',
    automator: '🚀 รันบอท Flow',
    lazada: '🛒 Lazada Affiliate',
    horoscope: '🔮 ดวงรายวัน',
    tracking: '📊 ติดตามงาน',
    radar: '🕵️‍♂️ เรดาร์คู่แข่ง',
    cleaner: '🧹 ล้างขยะประหยัดพื้นที่',
    scanner: '🛡️ แสกนไวรัสบนเครื่อง',
    prompt: '🔥 SORA-2 Prompt Generator',
    canvas: '🎨 Canvas Editor',
    autoeditor: '🎬 AI Auto-Video Editor',
    course: '🎓 สร้างคอร์สออนไลน์',
    aipage: '🤖 สร้างContentลงเพจ',
    articlestock: '📦 คลังบทความ',
    pagestock: '📮 ทำStockลงเพจ',
    topgainers: '📈 Top Gainers Factory',
    fbtoken: '🔑 เฟสบุ๊ค Token Manager',
    storyarchitect: '📚 AI Storyboard Architect',
  };

  return (
    <div className="app-layout">
      <GlobalTaskOverlay />
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className={`app-main ${sidebarCollapsed ? 'app-main-expanded' : ''}`}>
        {/* Top Bar */}
        <header className="app-topbar">
          <h2 className="app-topbar-title">{TAB_TITLES[activeTab]}</h2>
          <div className="app-topbar-actions">
            <ApiKeyQuickBar />
            <GlobalSettings />
            <ThemeSwitcher />
          </div>
        </header>

        {/* Content Area — keep-alive: tabs mount on first visit and stay mounted (hidden via CSS) */}
        <main className="app-content">
          {visitedTabs.has('home') && (
            <div className={activeTab !== 'home' ? 'hidden' : ''}>
              <DashboardHome onNavigate={setActiveTab} />
            </div>
          )}
          {visitedTabs.has('singleclip') && (
            <div className={activeTab !== 'singleclip' ? 'hidden' : ''}>
              <SingleClipEditorTab />
            </div>
          )}
          {visitedTabs.has('horoscope') && (
            <div className={activeTab !== 'horoscope' ? 'hidden' : ''}>
              <HoroscopeTab />
            </div>
          )}
          {visitedTabs.has('tracking') && (
            <div className={activeTab !== 'tracking' ? 'hidden' : ''}>
              <TrackingTab />
            </div>
          )}
          {visitedTabs.has('bulk') && (
            <div className={activeTab !== 'bulk' ? 'hidden' : 'grid grid-cols-1 lg:grid-cols-4 gap-6'}>
              <div className="lg:col-span-1 space-y-6">
                <AIContentGenerator onContentGenerated={handleContentGenerated} />
                <ContentStock
                  stock={stock}
                  onDelete={deleteContent}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onSelectAll={handleSelectAll}
                  onDeselectAll={handleDeselectAll}
                  categories={getCategories()}
                />
              </div>
              <div className="lg:col-span-3 space-y-6">
                <section
                  className="p-6 rounded-2xl shadow-sm border min-h-[700px] flex flex-col"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <h2 className="text-xl font-semibold mb-4">🎬 Video Editor & Bulk Render</h2>
                  <VideoEditor selectedItems={selectedItems} onRendered={handleRendered} />
                </section>
              </div>
            </div>
          )}
          {visitedTabs.has('news') && (
            <div className={activeTab !== 'news' ? 'hidden' : ''}>
              <NewsScraperTab
                onSendToStock={handleContentGenerated}
                onSendToAIPage={handleSendToAIPage}
                initialYoutubeUrls={pendingYoutubeUrls}
                onYoutubeUrlsConsumed={() => setPendingYoutubeUrls(undefined)}
              />
            </div>
          )}
          {visitedTabs.has('articlestock') && (
            <div className={activeTab !== 'articlestock' ? 'hidden' : ''}>
              <ArticleStockTab
                onSendToAIPage={handleSendToAIPage}
                onNavigateToYoutubeExtract={handleNavigateToYoutubeExtract}
              />
            </div>
          )}
          {visitedTabs.has('financial') && (
            <div className={activeTab !== 'financial' ? 'hidden' : ''}>
              <FinancialDocumentaryTab />
            </div>
          )}
          {visitedTabs.has('stockclip') && (
            <div className={activeTab !== 'stockclip' ? 'hidden' : ''}>
              <StockClipTab />
            </div>
          )}
          {visitedTabs.has('assets') && (
            <div className={activeTab !== 'assets' ? 'hidden' : ''}>
              <AssetManagementTab />
            </div>
          )}
          {visitedTabs.has('avatar') && (
            <div className={activeTab !== 'avatar' ? 'hidden' : ''}>
              <AvatarCreator />
            </div>
          )}
          {visitedTabs.has('clone') && (
            <div className={activeTab !== 'clone' ? 'hidden' : ''}>
              <CloneTab />
            </div>
          )}
          {visitedTabs.has('automator') && (
            <div className={activeTab !== 'automator' ? 'hidden' : ''}>
              <FlowAutomatorTab />
            </div>
          )}
          {visitedTabs.has('lazada') && (
            <div className={activeTab !== 'lazada' ? 'hidden' : ''}>
              <LazadaTab />
            </div>
          )}
          {visitedTabs.has('radar') && (
            <div className={activeTab !== 'radar' ? 'hidden' : ''}>
              <CompetitorRadarTab />
            </div>
          )}
          {visitedTabs.has('cleaner') && (
            <div className={activeTab !== 'cleaner' ? 'hidden' : ''}>
              <SystemCleanerTab />
            </div>
          )}
          {visitedTabs.has('scanner') && (
            <div className={activeTab !== 'scanner' ? 'hidden' : ''}>
              <SecurityScannerTab />
            </div>
          )}
          {visitedTabs.has('prompt') && (
            <div className={activeTab !== 'prompt' ? 'hidden' : ''}>
              <VideoPromptGeneratorTab />
            </div>
          )}
          {visitedTabs.has('autoeditor') && (
            <div className={activeTab !== 'autoeditor' ? 'hidden' : ''}>
              <AutoVideoEditorTab />
            </div>
          )}
          {visitedTabs.has('course') && (
            <div className={activeTab !== 'course' ? 'hidden' : ''}>
              <OnlineCourseTab />
            </div>
          )}
          {visitedTabs.has('canvas') && (
            <div className={activeTab !== 'canvas' ? 'hidden' : ''}>
              <CanvasEditorTab />
            </div>
          )}
          {visitedTabs.has('aipage') && (
            <div className={activeTab !== 'aipage' ? 'hidden' : ''}>
              <AIPagePostGeneratorTab
                initialBulkItems={pendingBulkItems}
                onInitialBulkItemsConsumed={() => setPendingBulkItems(undefined)}
              />
            </div>
          )}
          {visitedTabs.has('pagestock') && (
            <div className={activeTab !== 'pagestock' ? 'hidden' : ''}>
              <PageStockTab />
            </div>
          )}
          {visitedTabs.has('topgainers') && (
            <div className={activeTab !== 'topgainers' ? 'hidden' : ''}>
              <TopGainersFactoryTab />
            </div>
          )}
          {visitedTabs.has('fbtoken') && (
            <div className={activeTab !== 'fbtoken' ? 'hidden' : ''}>
              <FbTokenTab />
            </div>
          )}
          {visitedTabs.has('storyarchitect') && (
            <div className={activeTab !== 'storyarchitect' ? 'hidden' : ''}>
              <StoryArchitectTab />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
