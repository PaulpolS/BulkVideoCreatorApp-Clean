/**
 * Unified API Key Management Utility
 *
 * Central source of truth for retrieving API keys from the global profile system.
 * All components should use these functions instead of implementing local key retrieval.
 *
 * Priority chain:
 *   1. Module-level cache (updated instantly when settings change)
 *   2. localStorage api_global_profiles + api_global_active_id
 *   3. Legacy localStorage keys (openrouter_key, openrouter_keys, kie_api_key, etc.)
 *   4. Server-side api_profiles (via /api/get-app-data) — async only, used as fallback
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

// ─── Module-level cache ──────────────────────────────────────────────────────
// Populated on module load from localStorage and kept in sync via the
// 'api-profiles-updated' event that GlobalSettings dispatches on every save.
// This eliminates race conditions: sync callers always get a fresh value.

let _cachedProfile: ApiProfile | null = null;

function _refreshCacheFromStorage(): void {
  _cachedProfile = _readLocalActiveProfile();
}

function _applyProfilesUpdate(profiles: ApiProfile[], activeProfileId?: string): void {
  const id = activeProfileId || localStorage.getItem('api_global_active_id');
  const active = (id ? profiles.find(p => p.id === id) : undefined) ?? profiles[0] ?? null;
  _cachedProfile = active;
}

// Initialise cache synchronously on module load
_refreshCacheFromStorage();

// Keep cache fresh whenever GlobalSettings (or loadProfile) saves/switches profiles
if (typeof window !== 'undefined') {
  window.addEventListener('api-profiles-updated', (event) => {
    const detail = (event as CustomEvent<{ profiles?: ApiProfile[]; activeProfileId?: string }>).detail;
    if (Array.isArray(detail?.profiles) && detail.profiles.length > 0) {
      _applyProfilesUpdate(detail.profiles, detail.activeProfileId);
    } else {
      _refreshCacheFromStorage();
    }
  });
}

// ─── Server fetch helper ─────────────────────────────────────────────────────

const SERVER_FETCH_TIMEOUT_MS = 5_000;

async function _fetchJsonWithTimeout(url: string, timeoutMs = SERVER_FETCH_TIMEOUT_MS): Promise<any> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json();
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`Request timeout after ${Math.round(timeoutMs / 1000)}s`);
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}

// ─── localStorage helpers ────────────────────────────────────────────────────

function _readLocalProfiles(): ApiProfile[] {
  try {
    const raw = localStorage.getItem('api_global_profiles');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function _readLocalActiveProfile(): ApiProfile | null {
  const profiles = _readLocalProfiles();
  if (profiles.length === 0) return null;
  const activeId = localStorage.getItem('api_global_active_id');
  return profiles.find(p => p.id === activeId) ?? profiles[0];
}

/** Write server profiles into localStorage and refresh the cache. */
function _syncServerProfilesToLocalStorage(profiles: ApiProfile[]): void {
  if (!Array.isArray(profiles) || profiles.length === 0) return;
  const activeId = localStorage.getItem('api_global_active_id');
  const active = (activeId ? profiles.find(p => p.id === activeId) : undefined) ?? profiles[0];

  localStorage.setItem('api_global_profiles', JSON.stringify(profiles));
  if (!activeId) localStorage.setItem('api_global_active_id', active.id);
  // Keep backward-compat keys in sync
  if (active.openRouterKey) localStorage.setItem('openrouter_key', active.openRouterKey);
  if (active.dropboxKey)    localStorage.setItem('dropbox_api_key', active.dropboxKey);
  if (active.kieKey)        localStorage.setItem('kie_api_key', active.kieKey);
  if (active.googleKey)     localStorage.setItem('google_api_key', active.googleKey);

  _refreshCacheFromStorage();
}

// ─── Sync key getters ────────────────────────────────────────────────────────

/**
 * Get the OpenRouter API key synchronously.
 * Uses the module cache (always up-to-date) then falls back to localStorage and legacy keys.
 */
export function getActiveOpenRouterKey(): string {
  // 1. Module cache (fastest, always current after any save)
  if (_cachedProfile?.openRouterKey?.trim()) return _cachedProfile.openRouterKey.trim();

  // 2. Re-read localStorage in case the module was imported before the first save
  const profile = _readLocalActiveProfile();
  if (profile?.openRouterKey?.trim()) {
    _cachedProfile = profile; // update cache
    return profile.openRouterKey.trim();
  }

  // 3. Legacy single key
  const legacyKey = localStorage.getItem('openrouter_key');
  if (legacyKey?.trim()) return legacyKey.trim();

  // 4. Legacy array from old AIContentGenerator
  try {
    const arr = JSON.parse(localStorage.getItem('openrouter_keys') || '[]');
    if (Array.isArray(arr) && arr.length > 0) {
      const active = arr.find((k: any) => k.isActive) ?? arr[0];
      if (active?.key?.trim()) return active.key.trim();
    }
  } catch {}

  return '';
}

/**
 * Get the Kie.ai API key synchronously.
 */
export function getActiveKieKey(): string {
  if (_cachedProfile?.kieKey?.trim()) return _cachedProfile.kieKey.trim();

  const profile = _readLocalActiveProfile();
  if (profile?.kieKey?.trim()) return profile.kieKey.trim();

  const legacyKey = localStorage.getItem('kie_api_key');
  if (legacyKey?.trim()) return legacyKey.trim();

  try {
    const arr = JSON.parse(localStorage.getItem('kie_api_keys') || '[]');
    if (Array.isArray(arr) && arr.length > 0) {
      const active = arr.find((k: any) => k.isActive) ?? arr[0];
      if (active?.key?.trim()) return active.key.trim();
    }
  } catch {}

  return '';
}

/**
 * Get Dropbox credentials synchronously.
 */
export function getActiveDropboxCreds(): {
  accessToken: string;
  refreshToken: string;
  appKey: string;
  appSecret: string;
} {
  const profile = _cachedProfile ?? _readLocalActiveProfile();
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
 * Get the Apify API key synchronously.
 */
export function getActiveApifyKey(): string {
  const profile = _cachedProfile ?? _readLocalActiveProfile();
  if (profile?.apifyKey?.trim()) return profile.apifyKey.trim();
  return localStorage.getItem('apify_api_key')?.trim() || '';
}

/**
 * Get the full active ApiProfile object synchronously.
 */
export function getActiveProfile(): ApiProfile | null {
  return _cachedProfile ?? _readLocalActiveProfile();
}

// ─── One-time startup initialiser ────────────────────────────────────────────

let _initPromise: Promise<void> | null = null;

/**
 * Call this once on application startup (e.g. in App.tsx's useEffect).
 * It syncs the server-side api_profiles.json into localStorage so that all
 * sync getters work even after the user clears browser storage.
 * Safe to call multiple times — runs only once.
 */
export function initApiSettings(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    // If localStorage already has profiles with a key, nothing to do
    if (_cachedProfile?.openRouterKey?.trim()) return;

    try {
      const profiles = await _fetchJsonWithTimeout('/api/get-app-data?key=api_profiles');
      if (Array.isArray(profiles) && profiles.length > 0) {
        _syncServerProfilesToLocalStorage(profiles);
      }
    } catch (e) {
      console.warn('[useApiSettings] initApiSettings: server fetch failed, using localStorage only.', e);
    }
  })();
  return _initPromise;
}

// ─── Async key getters ───────────────────────────────────────────────────────

/**
 * Async version of getActiveOpenRouterKey.
 * Fast path: returns immediately from cache if available.
 * Slow path: fetches from server, syncs to localStorage, updates cache.
 */
export async function getActiveOpenRouterKeyAsync(): Promise<string> {
  // Fast path — cache hit (most common case after first save)
  const cached = getActiveOpenRouterKey();
  if (cached) return cached;

  // Slow path — cache miss: try server
  try {
    const profiles = await _fetchJsonWithTimeout('/api/get-app-data?key=api_profiles');
    if (Array.isArray(profiles) && profiles.length > 0) {
      _syncServerProfilesToLocalStorage(profiles);
      const key = getActiveOpenRouterKey();
      if (key) return key;
    }
  } catch (e) {
    console.error('[useApiSettings] getActiveOpenRouterKeyAsync server fetch failed:', e);
  }

  return '';
}

/**
 * Get all OpenRouter key candidates for multi-key retry patterns.
 * Returns array sorted by priority: cache → localStorage → legacy → server profiles.
 */
export async function getOpenRouterKeyCandidates(): Promise<{ key: string; label: string }[]> {
  const candidates: { key: string; label: string }[] = [];
  const addCandidate = (key: unknown, label: string) => {
    const clean = String(key ?? '').trim();
    if (
      !clean ||
      clean === 'undefined' ||
      clean === 'null' ||
      clean === '[object Object]' ||
      !/^sk-or-/i.test(clean) ||
      candidates.some(c => c.key === clean)
    ) return;
    candidates.push({ key: clean, label });
  };

  // 1. Cache / localStorage profiles (sync, instant)
  try {
    const profiles = _readLocalProfiles();
    const activeId = localStorage.getItem('api_global_active_id');
    if (profiles.length > 0) {
      const active = profiles.find(p => p.id === activeId) ?? profiles[0];
      addCandidate(active?.openRouterKey, `Profile: ${active?.name ?? 'active'}`);
      profiles.forEach((p, i) =>
        addCandidate(p?.openRouterKey, `Profile ${i + 1}: ${p?.name ?? p?.id ?? 'unnamed'}`)
      );
    }
  } catch {}

  // 2. Legacy keys
  addCandidate(localStorage.getItem('openrouter_key'), 'Legacy openrouter_key');
  try {
    const keys = JSON.parse(localStorage.getItem('openrouter_keys') || '[]');
    if (Array.isArray(keys)) {
      const active = keys.find((k: any) => k.isActive);
      addCandidate(active?.key, `OpenRouter key: ${active?.name ?? 'active'}`);
      keys.forEach((item: any, i: number) =>
        addCandidate(item?.key, `OpenRouter key ${i + 1}: ${item?.name ?? 'saved'}`)
      );
    }
  } catch {}

  // 3. Server profiles (async fallback — only if nothing found locally)
  if (candidates.length === 0) {
    try {
      const profiles = await _fetchJsonWithTimeout('/api/get-app-data?key=api_profiles');
      if (Array.isArray(profiles) && profiles.length > 0) {
        _syncServerProfilesToLocalStorage(profiles);
        const activeId = localStorage.getItem('api_global_active_id');
        const active = profiles.find((p: any) => p.id === activeId) ?? profiles[0];
        addCandidate(active?.openRouterKey, `Server Profile: ${active?.name ?? 'active'}`);
        profiles.forEach((p: any, i: number) =>
          addCandidate(p?.openRouterKey, `Server Profile ${i + 1}: ${p?.name ?? p?.id ?? 'unnamed'}`)
        );
      }
    } catch {}
  }

  return candidates;
}

// ─── Credit Check ─────────────────────────────────────────────────────────────

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
 */
export async function checkOpenRouterCredits(apiKey: string): Promise<OpenRouterCreditInfo> {
  if (!apiKey?.trim()) {
    return { valid: false, balance: 0, balanceFormatted: '$0.00', usage: 0, limit: null, error: 'ไม่พบ API Key' };
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { 'Authorization': `Bearer ${apiKey.trim()}` },
    });

    if (!res.ok) {
      return {
        valid: false, balance: 0, balanceFormatted: '$0.00', usage: 0, limit: null,
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();
    const usage = Number(data.data?.usage) || 0;
    const limit = data.data?.limit != null ? Number(data.data.limit) : null;
    const isFreeTier = data.data?.is_free_tier === true;
    const keyLabel = data.data?.label || '';
    // If limit is null (unlimited plan) balance is -1 to signal "unlimited"
    const balance = limit !== null ? Math.max(0, limit - usage) : -1;
    const balanceFormatted = limit !== null ? `$${balance.toFixed(4)}` : 'ไม่ได้ตั้งลิมิตบน Key นี้';

    return { valid: true, balance, balanceFormatted, usage, limit, isFreeTier, keyLabel, rawData: data.data };
  } catch (e: any) {
    return {
      valid: false, balance: 0, balanceFormatted: '$0.00', usage: 0, limit: null,
      error: e.message || 'Network error',
    };
  }
}
