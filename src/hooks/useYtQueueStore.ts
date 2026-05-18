import { useState, useEffect } from 'react';
import { globalTaskStore } from './useBackgroundTasks';

export interface YtQueueItem {
  id: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
  result?: {
    videoTitle: string;
    channelName: string;
    channelAvatar: string;
    channelLogoUrl: string;
    subscriberCount?: number;
    transcript: string;
    screenshotUrls: string[];
  };
}

const STORAGE_KEY = 'yt_queue_state';

function normalizeQueueItem(item: any, index = 0): YtQueueItem {
  const rawStatus = item?.status;
  const status: YtQueueItem['status'] =
    rawStatus === 'completed' || rawStatus === 'error' || rawStatus === 'pending'
      ? rawStatus
      : 'pending';
  const result = item?.result && typeof item.result === 'object'
    ? {
        videoTitle: String(item.result.videoTitle || ''),
        channelName: String(item.result.channelName || ''),
        channelAvatar: String(item.result.channelAvatar || ''),
        channelLogoUrl: String(item.result.channelLogoUrl || ''),
        subscriberCount: typeof item.result.subscriberCount === 'number' ? item.result.subscriberCount : undefined,
        transcript: String(item.result.transcript || ''),
        screenshotUrls: Array.isArray(item.result.screenshotUrls)
          ? item.result.screenshotUrls.map((url: any) => String(url || '')).filter(Boolean)
          : [],
      }
    : undefined;

  return {
    id: String(item?.id || `ytq_restored_${Date.now()}_${index}`),
    url: String(item?.url || ''),
    status: rawStatus === 'running' ? 'pending' : status,
    error: item?.error ? String(item.error) : undefined,
    result,
  };
}

class YtQueueStore {
  items: YtQueueItem[] = [];
  isRunning = false;
  isPaused = false;
  autoSaveAfterQueue = false;
  frameCount = 10;
  private stopRequested = false;
  private listeners: (() => void)[] = [];
  private taskId: string | null = null;

  constructor() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.items = Array.isArray(parsed.items)
          ? parsed.items.map((item: any, index: number) => normalizeQueueItem(item, index)).filter((item: YtQueueItem) => item.url)
          : [];
        this.frameCount = parsed.frameCount || 10;
      }
    } catch (e) {}
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        items: this.items,
        frameCount: this.frameCount,
      }));
    } catch (e) {}
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  setFrameCount(count: number) {
    this.frameCount = Math.max(1, Math.min(30, count));
    this.persist();
    this.notify();
  }

  addUrls(urls: string[]) {
    const existingUrls = new Set(this.items.map(q => q.url));
    const newItems: YtQueueItem[] = urls
      .filter(u => !existingUrls.has(u))
      .map((u, i) => ({ id: `ytq_${Date.now()}_${i}`, url: u, status: 'pending' as const }));
    this.items = [...this.items, ...newItems];
    this.persist();
    this.notify();
    return newItems.map(n => n.id);
  }

  removeItem(id: string) {
    if (this.isRunning) return;
    this.items = this.items.filter(q => q.id !== id);
    this.persist();
    this.notify();
  }

  clearCompleted() {
    this.items = this.items.filter(q => q.status !== 'completed');
    this.persist();
    this.notify();
  }

  clearAll() {
    if (this.isRunning) return;
    this.items = [];
    this.persist();
    this.notify();
  }

  // Stop: abort after current item
  requestStop() {
    this.stopRequested = true;
    this.isPaused = false;
    this.notify();
  }

  // Pause: pause after current item, can resume
  requestPause() {
    this.isPaused = true;
    this.notify();
  }

  // Resume from pause
  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.notify();
    // Re-process remaining pending items
    const ids = this.items.filter(q => q.status === 'pending').map(q => q.id);
    if (ids.length > 0) {
      this.processItems(ids, this.autoSaveAfterQueue);
    }
  }

  async processItems(ids: string[], autoSave = false) {
    const toProcess = ids.filter(id => {
      const item = this.items.find(q => q.id === id);
      return item && item.status !== 'completed';
    });
    if (toProcess.length === 0) return;

    this.isRunning = true;
    this.isPaused = false;
    this.stopRequested = false;
    this.autoSaveAfterQueue = autoSave;
    this.notify();

    this.taskId = `yt_queue_${Date.now()}`;
    globalTaskStore.addTask({
      id: this.taskId,
      title: `🎬 ดึง YouTube Script+รูป ${toProcess.length} คลิป`,
      category: 'youtube-extract',
      progress: `เริ่มดึง ${toProcess.length} คลิป...`,
      status: 'running',
    });

    let completedCount = 0;
    let errorCount = 0;

    for (const id of toProcess) {
      // Check stop
      if (this.stopRequested) {
        globalTaskStore.updateTask(this.taskId!, { progress: `⛔ หยุดแล้ว (เสร็จ ${completedCount}, ผิดพลาด ${errorCount})` });
        break;
      }
      // Check pause
      if (this.isPaused) {
        globalTaskStore.updateTask(this.taskId!, { progress: `⏸️ พักไว้ (เสร็จ ${completedCount}/${toProcess.length})` });
        this.isRunning = false;
        this.persist();
        this.notify();
        return; // Exit — resume() will restart remaining
      }

      const item = this.items.find(q => q.id === id);
      if (!item || item.status === 'completed') continue;

      this.updateItem(id, { status: 'running', error: undefined });
      globalTaskStore.updateTask(this.taskId!, {
        progress: `🔄 [${completedCount + errorCount + 1}/${toProcess.length}] กำลังดึง: ${item.url.substring(0, 60)}...`,
      });

      try {
        const res = await fetch('/api/youtube-extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.url, frameCount: this.frameCount }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Extract failed');
        // Keep all screenshotUrls — filter only the external thumbnail (channelAvatar)
        const allShots: string[] = data.screenshotUrls || [];
        const localShots = allShots.filter((u: string) => u.startsWith('/'));
        // If no local shots found, keep all (API might return relative URLs differently)
        const shots = localShots.length > 0 ? localShots : allShots;
        this.updateItem(id, {
          status: 'completed',
          result: {
            videoTitle: data.videoTitle || '',
            channelName: data.channelName || '',
            channelAvatar: data.channelAvatar || '',
            channelLogoUrl: data.channelLogoUrl || '',
            subscriberCount: data.subscriberCount,
            transcript: data.transcript || '',
            screenshotUrls: shots,
          },
        });
        completedCount++;
        globalTaskStore.updateTask(this.taskId!, {
          progress: `✅ [${completedCount + errorCount}/${toProcess.length}] เสร็จ: ${data.videoTitle?.substring(0, 40) || item.url.substring(0, 40)}... (${shots.length} รูป)`,
        });
      } catch (e: any) {
        this.updateItem(id, { status: 'error', error: e.message });
        errorCount++;
        globalTaskStore.updateTask(this.taskId!, {
          progress: `❌ [${completedCount + errorCount}/${toProcess.length}] Error: ${e.message?.substring(0, 60)}`,
        });
      }
    }

    this.isRunning = false;
    this.isPaused = false;
    this.stopRequested = false;
    this.persist();
    this.notify();

    const summary = `ดึงเสร็จ ${completedCount} คลิป${errorCount > 0 ? ` (ผิดพลาด ${errorCount})` : ''}`;
    globalTaskStore.updateTask(this.taskId!, {
      progress: `🏁 ${summary}`,
      status: errorCount === toProcess.length ? 'error' : 'completed',
    });

    if (autoSave && completedCount > 0) {
      await this.batchSaveToStock();
    }
    this.autoSaveAfterQueue = false;
    this.taskId = null;
  }

  processAll(autoSave = false) {
    const ids = this.items.filter(q => q.status !== 'completed').map(q => q.id);
    this.processItems(ids, autoSave);
  }

  async batchSaveToStock() {
    const completedItems = this.items.filter(q => q.status === 'completed' && q.result);
    if (completedItems.length === 0) return;

    if (this.taskId) {
      globalTaskStore.updateTask(this.taskId, { progress: `📦 กำลังบันทึก ${completedItems.length} คลิปเข้าคลัง Content...` });
    }

    try {
      const items = completedItems.map(q => ({
        title: q.result!.videoTitle || q.url,
        rawArticle: q.result!.transcript || q.result!.videoTitle,
        sourceUrl: q.url,
        newsScore: 0,
        evergreenScore: 0,
        tags: ['youtube', q.result!.channelName].filter(Boolean),
        domain: 'www.youtube.com',
        createdAt: new Date().toISOString(),
        images: q.result!.screenshotUrls,
        sourceType: 'youtube',
        channelName: q.result!.channelName,
        channelLogoUrl: q.result!.channelLogoUrl,
        channelAvatar: q.result!.channelAvatar,
        subscriberCount: q.result!.subscriberCount,
        ytExtracted: true,
      }));
      const res = await fetch('/api/article-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-batch', items }),
      });
      const data = await res.json();
      if (data.success) {
        const msg = `✅ บันทึกเข้าคลัง Content แล้ว! เพิ่ม ${data.added ?? 0} คลิป (อัปเดต ${data.updated ?? 0})`;
        if (this.taskId) globalTaskStore.updateTask(this.taskId, { progress: msg });
        return { success: true, added: data.added, updated: data.updated };
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      const msg = `❌ บันทึกไม่สำเร็จ: ${e.message}`;
      if (this.taskId) globalTaskStore.updateTask(this.taskId, { progress: msg });
      return { success: false, error: e.message };
    }
  }

  private updateItem(id: string, updates: Partial<YtQueueItem>) {
    this.items = this.items.map(q => q.id === id ? { ...q, ...updates } : q);
    this.persist();
    this.notify();
  }
}

export const globalYtQueueStore = new YtQueueStore();

export function useYtQueueStore() {
  const [items, setItems] = useState<YtQueueItem[]>(globalYtQueueStore.items);
  const [isRunning, setIsRunning] = useState(globalYtQueueStore.isRunning);
  const [isPaused, setIsPaused] = useState(globalYtQueueStore.isPaused);

  useEffect(() => {
    return globalYtQueueStore.subscribe(() => {
      setItems([...globalYtQueueStore.items]);
      setIsRunning(globalYtQueueStore.isRunning);
      setIsPaused(globalYtQueueStore.isPaused);
    });
  }, []);

  return {
    items,
    isRunning,
    isPaused,
    frameCount: globalYtQueueStore.frameCount,
    addUrls: (urls: string[]) => globalYtQueueStore.addUrls(urls),
    removeItem: (id: string) => globalYtQueueStore.removeItem(id),
    clearCompleted: () => globalYtQueueStore.clearCompleted(),
    clearAll: () => globalYtQueueStore.clearAll(),
    setFrameCount: (n: number) => globalYtQueueStore.setFrameCount(n),
    processItems: (ids: string[], autoSave?: boolean) => globalYtQueueStore.processItems(ids, autoSave),
    processAll: (autoSave?: boolean) => globalYtQueueStore.processAll(autoSave),
    batchSaveToStock: () => globalYtQueueStore.batchSaveToStock(),
    requestStop: () => globalYtQueueStore.requestStop(),
    requestPause: () => globalYtQueueStore.requestPause(),
    resume: () => globalYtQueueStore.resume(),
  };
}
