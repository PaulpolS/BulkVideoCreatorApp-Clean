import { useState, useEffect } from 'react';

export interface BackgroundTask {
  id: string;
  title: string;
  progress: string;
  status: 'queued' | 'running' | 'completed' | 'error' | 'cancelled';
  category?: string;
  logs?: string[];
  createdAt?: number;
  updatedAt?: number;
  cancelRequested?: boolean;
}

interface TaskRunnerContext {
  signal: AbortSignal;
  isCancelled: () => boolean;
  log: (message: string) => void;
  update: (updates: Partial<BackgroundTask>) => void;
}

type TaskRunner = (ctx: TaskRunnerContext) => Promise<void>;

class TaskStore {
  tasks: BackgroundTask[] = [];
  listeners: (() => void)[] = [];
  private runners = new Map<string, TaskRunner>();
  private abortControllers = new Map<string, AbortController>();
  private activeTaskId: string | null = null;

  addTask(task: BackgroundTask) {
    const now = Date.now();
    this.tasks.push({
      ...task,
      status: task.status || 'running',
      logs: task.logs || [task.progress],
      createdAt: task.createdAt || now,
      updatedAt: task.updatedAt || now,
    });
    this.notify();
  }

  enqueueTask(task: Omit<BackgroundTask, 'status'> & { status?: BackgroundTask['status'] }, runner: TaskRunner) {
    const now = Date.now();
    const nextTask: BackgroundTask = {
      ...task,
      status: 'queued',
      logs: task.logs || [task.progress || 'รอคิวเริ่มทำงาน...'],
      progress: task.progress || 'รอคิวเริ่มทำงาน...',
      createdAt: task.createdAt || now,
      updatedAt: now,
    };
    this.tasks.push(nextTask);
    this.runners.set(nextTask.id, runner);
    this.notify();
    this.runNext();
    return nextTask.id;
  }

  updateTask(id: string, updates: Partial<BackgroundTask>) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      Object.assign(task, { ...updates, updatedAt: Date.now() });
      if (updates.progress) {
        task.logs = [...(task.logs || []), updates.progress].slice(-80);
      }
      this.notify();
    }
  }

  logTask(id: string, message: string) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    task.progress = message;
    task.logs = [...(task.logs || []), message].slice(-80);
    task.updatedAt = Date.now();
    this.notify();
  }

  removeTask(id: string) {
    const task = this.tasks.find(t => t.id === id);
    if (task?.status === 'queued') {
      task.status = 'cancelled';
      task.progress = 'ยกเลิกคิวแล้ว';
      task.logs = [...(task.logs || []), 'ยกเลิกคิวแล้ว'].slice(-80);
      this.runners.delete(id);
    } else if (task?.status === 'running') {
      task.cancelRequested = true;
      task.progress = 'กำลังขอยกเลิกงาน...';
      task.logs = [...(task.logs || []), 'กำลังขอยกเลิกงาน...'].slice(-80);
      this.abortControllers.get(id)?.abort();
    } else {
      this.tasks = this.tasks.filter(t => t.id !== id);
    }
    this.notify();
  }

  clearFinished() {
    this.tasks = this.tasks.filter(t => t.status === 'queued' || t.status === 'running');
    this.notify();
  }

  private async runNext() {
    if (this.activeTaskId) return;
    const task = this.tasks.find(t => t.status === 'queued');
    if (!task) return;
    const runner = this.runners.get(task.id);
    if (!runner) return;

    this.activeTaskId = task.id;
    const controller = new AbortController();
    this.abortControllers.set(task.id, controller);
    this.updateTask(task.id, { status: 'running', progress: 'เริ่มทำงาน...' });

    const ctx: TaskRunnerContext = {
      signal: controller.signal,
      isCancelled: () => !!this.tasks.find(t => t.id === task.id)?.cancelRequested || controller.signal.aborted,
      log: (message: string) => this.logTask(task.id, message),
      update: (updates: Partial<BackgroundTask>) => this.updateTask(task.id, updates),
    };

    try {
      await runner(ctx);
      const current = this.tasks.find(t => t.id === task.id);
      if (current?.cancelRequested || controller.signal.aborted) {
        this.updateTask(task.id, { status: 'cancelled', progress: 'ยกเลิกงานแล้ว' });
      } else {
        this.updateTask(task.id, { status: 'completed', progress: current?.progress || 'เสร็จสิ้น' });
      }
    } catch (err: any) {
      const isAbort = controller.signal.aborted || err?.name === 'AbortError';
      this.updateTask(task.id, {
        status: isAbort ? 'cancelled' : 'error',
        progress: isAbort ? 'ยกเลิกงานแล้ว' : `Error: ${err?.message || String(err)}`,
      });
    } finally {
      this.runners.delete(task.id);
      this.abortControllers.delete(task.id);
      this.activeTaskId = null;
      this.notify();
      this.runNext();
    }
  }

  notify() {
    this.listeners.forEach(l => l());
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const globalTaskStore = new TaskStore();

export function useBackgroundTasks() {
  const [tasks, setTasks] = useState<BackgroundTask[]>(globalTaskStore.tasks);

  useEffect(() => {
    return globalTaskStore.subscribe(() => {
      setTasks([...globalTaskStore.tasks]);
    });
  }, []);

  return {
    tasks,
    addTask: (t: BackgroundTask) => globalTaskStore.addTask(t),
    enqueueTask: (t: Omit<BackgroundTask, 'status'> & { status?: BackgroundTask['status'] }, r: TaskRunner) => globalTaskStore.enqueueTask(t, r),
    updateTask: (id: string, u: Partial<BackgroundTask>) => globalTaskStore.updateTask(id, u),
    removeTask: (id: string) => globalTaskStore.removeTask(id),
    clearFinished: () => globalTaskStore.clearFinished(),
  };
}
