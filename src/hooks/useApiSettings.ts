/**
 * Unified API Key Management Utility
 * 
 * Central source of truth for retrieving API keys from the global profile system.
 * All components should use these functions instead of implementing local key retrieval.
 * 
 * Priority chain:
 *   1. Server-side api_profiles (via /api/get-app-data)
 *   2. localStorage api_global_profiles + api_global_active_id
 *   3. Legacy localStorage keys (openrouter_key, openrouter_keys, kie_api_key, etc.)
 */

export interface ApiProfile {
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

const API_SETTINGS_FETCH_TIMEOUT_MS = 10_000;

async function fetchJsonWithTimeout(url: string, init: RequestInit = {}, timeoutMs = API_SETTINGS_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return await res.json();
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`Request timeout after ${Math.round(timeoutMs / 1000)}s`);
    throw e;
  } finally {
    window.clearTimeout(timeout);
  }
}

// ─── Sync helpers (localStorage only, no network) ───────────────────────────

function getLocalProfiles(): ApiProfile[] {
  try {
    const raw = localStorage.getItem('api_global_profiles');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getLocalActiveProfile(): ApiProfile | null {
  const profiles = getLocalProfiles();
  if (profiles.length === 0) return null;
  const activeId = localStorage.getItem('api_global_active_id');
  return profiles.find(p => p.id === activeId) || profiles[0];
}

// ─── Synchronous key getters ────────────────────────────────────────────────

/**
 * Get the OpenRouter API key from the active profile (sync, localStorage).
 * Falls back to legacy keys if profile system has no key.
 */
export function getActiveOpenRouterKey(): string {
  // 1. Profile system
  const profile = getLocalActiveProfile();
  if (profile?.openRouterKey?.trim()) return profile.openRouterKey.trim();

  // 2. Legacy single key (set by GlobalSettings backward compat)
  const legacyKey = localStorage.getItem('openrouter_key');
  if (legacyKey?.trim()) return legacyKey.trim();

  // 3. Legacy array from old AIContentGenerator
  try {
    const arr = JSON.parse(localStorage.getItem('openrouter_keys') || '[]');
    if (Array.isArray(arr) && arr.length > 0) {
      const active = arr.find((k: any) => k.isActive) || arr[0];
      if (active?.key?.trim()) return active.key.trim();
    }
  } catch {}

  return '';
}

/**
 * Get the Kie.ai API key from the active profile (sync).
 */
export function getActiveKieKey(): string {
  const profile = getLocalActiveProfile();
  if (profile?.kieKey?.trim()) return profile.kieKey.trim();

  const legacyKey = localStorage.getItem('kie_api_key');
  if (legacyKey?.trim()) return legacyKey.trim();

  try {
    const arr = JSON.parse(localStorage.getItem('kie_api_keys') || '[]');
    if (Array.isArray(arr) && arr.length > 0) {
      const active = arr.find((k: any) => k.isActive) || arr[0];
      if (active?.key?.trim()) return active.key.trim();
    }
  } catch {}

  return '';
}

/**
 * Get the Dropbox credentials from the active profile (sync).
 */
export function getActiveDropboxCreds(): {
  accessToken: string;
  refreshToken: string;
  appKey: string;
  appSecret: string;
} {
  const profile = getLocalActiveProfile();
  if (profile) {
    return {
      accessToken: profile.dropboxKey || '',
      refreshToken: profile.dropboxRefreshToken || '',
      appKey: profile.dropboxAppKey || '',
      appSecret: profile.dropboxAppSecret || '',
    };
  }
  return {
    accessToken: localStorage.getItem('dropbox_api_key') || '',
    refreshToken: '',
    appKey: '',
    appSecret: '',
  };
}

/**
 * Get the Apify API key from the active profile (sync).
 */
export function getActiveApifyKey(): string {
  const profile = getLocalActiveProfile();
  if (profile?.apifyKey?.trim()) return profile.apifyKey.trim();
  return localStorage.getItem('apify_api_key')?.trim() || '';
}

/**
 * Get the full active ApiProfile object (sync).
 */
export function getActiveProfile(): ApiProfile | null {
  return getLocalActiveProfile();
}

// ─── Async key getters (with server-side check) ─────────────────────────────

/**
 * Async version that checks the server-side api_profiles first.
 * Use this in components that previously called fetch('/api/get-app-data?key=api_profiles').
 */
export async function getActiveOpenRouterKeyAsync(): Promise<string> {
  // 1. Try server-side profiles first
  try {
    const profiles = await fetchJsonWithTimeout('/api/get-app-data?key=api_profiles');
    if (Array.isArray(profiles) && profiles.length > 0) {
      const activeId = localStorage.getItem('api_global_active_id') || profiles[0].id;
      const activeProfile = profiles.find((p: any) => p.id === activeId) || profiles[0];
      if (activeProfile?.openRouterKey?.trim()) return activeProfile.openRouterKey.trim();
    }
  } catch (e) {
    console.error('[useApiSettings] Server profile fetch failed:', e);
  }

  // 2. Fall back to sync method
  return getActiveOpenRouterKey();
}

/**
 * Get all OpenRouter key candidates for multi-key retry patterns.
 * Returns array sorted by priority: server profiles → localStorage profiles → legacy keys.
 */
export async function getOpenRouterKeyCandidates(): Promise<{ key: string; label: string }[]> {
  const candidates: { key: string; label: string }[] = [];
  const addCandidate = (key: unknown, label: string) => {
    const clean = String(key || '').trim();
    if (!clean || candidates.some(item => item.key === clean)) return;
    candidates.push({ key: clean, label });
  };

  // 1. Server-side profiles
  try {
    const profiles = await fetchJsonWithTimeout('/api/get-app-data?key=api_profiles');
    if (Array.isArray(profiles) && profiles.length > 0) {
      const activeId = localStorage.getItem('api_global_active_id') || profiles[0].id;
      const active = profiles.find((p: any) => p.id === activeId) || profiles[0];
      addCandidate(active?.openRouterKey, `Profile: ${active?.name || 'active'}`);
      profiles.forEach((p: any, i: number) =>
        addCandidate(p?.openRouterKey, `Profile ${i + 1}: ${p?.name || p?.id || 'unnamed'}`)
      );
    }
  } catch {}

  // 2. localStorage profiles
  try {
    const profiles = getLocalProfiles();
    const activeId = localStorage.getItem('api_global_active_id');
    if (profiles.length > 0) {
      const activeProfile = profiles.find(p => p.id === activeId);
      addCandidate(activeProfile?.openRouterKey, `Local: ${activeProfile?.name || 'active'}`);
      profiles.forEach((p, i) =>
        addCandidate(p?.openRouterKey, `Local ${i + 1}: ${p?.name || p?.id || 'unnamed'}`)
      );
    }
  } catch {}

  // 3. Legacy keys
  addCandidate(localStorage.getItem('openrouter_key'), 'Legacy openrouter_key');
  try {
    const keys = JSON.parse(localStorage.getItem('openrouter_keys') || '[]');
    if (Array.isArray(keys)) {
      const active = keys.find((k: any) => k.isActive);
      addCandidate(active?.key, `OpenRouter key: ${active?.name || 'active'}`);
      keys.forEach((item: any, i: number) =>
        addCandidate(item?.key, `OpenRouter key ${i + 1}: ${item?.name || 'saved'}`)
      );
    }
  } catch {}

  return candidates;
}

// ─── Credit Check ───────────────────────────────────────────────────────────

export interface OpenRouterCreditInfo {
  valid: boolean;
  balance: number;
  balanceFormatted: string;
  usage: number;
  limit: number | null;
  isFreeTier?: boolean;
  keyLabel?: string;
  rawData?: any;
  error?: string;
}

/**
 * Check credit balance for an OpenRouter API key.
 * Uses the /api/v1/auth/key endpoint.
 */
export async function checkOpenRouterCredits(apiKey: string): Promise<OpenRouterCreditInfo> {
  if (!apiKey?.trim()) {
    return { valid: false, balance: 0, balanceFormatted: '$0.00', usage: 0, limit: null, error: 'ไม่พบ API Key' };
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
    });

    if (!res.ok) {
      return {
        valid: false,
        balance: 0,
        balanceFormatted: '$0.00',
        usage: 0,
        limit: null,
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();
    const usage = Number(data.data?.usage) || 0;
    const limit = data.data?.limit != null ? Number(data.data.limit) : null;
    const isFreeTier = data.data?.is_free_tier === true;
    const keyLabel = data.data?.label || '';
    const balance = limit !== null ? Math.max(0, limit - usage) : -1;

    let balanceFormatted: string;
    if (limit !== null) {
      balanceFormatted = `$${Number(balance).toFixed(4)}`;
    } else {
      balanceFormatted = 'ไม่ได้ตั้งลิมิตบน Key นี้';
    }

    return {
      valid: true,
      balance,
      balanceFormatted,
      usage,
      limit,
      isFreeTier,
      keyLabel,
      rawData: data.data,
    };
  } catch (e: any) {
    return {
      valid: false,
      balance: 0,
      balanceFormatted: '$0.00',
      usage: 0,
      limit: null,
      error: e.message || 'Network error',
    };
  }
}
