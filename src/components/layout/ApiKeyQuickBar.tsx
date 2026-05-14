import React, { useEffect, useMemo, useState } from 'react';
import { checkOpenRouterCredits, type ApiProfile } from '../../hooks/useApiSettings';

type KeyKind = 'openrouter' | 'kie' | 'github' | 'dropbox' | 'google' | 'apify';

type KeyOption = {
  id: KeyKind;
  label: string;
  hint: string;
  profileField?: keyof ApiProfile;
  legacyKey: string;
  placeholder: string;
};

const KEY_OPTIONS: KeyOption[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    hint: 'ใช้กับงานเขียน AI เกือบทุกหน้า',
    profileField: 'openRouterKey',
    legacyKey: 'openrouter_key',
    placeholder: 'sk-or-...',
  },
  {
    id: 'kie',
    label: 'KIE.ai',
    hint: 'ใช้กับงานสร้างวิดีโอ/รูปบางโมดูล',
    profileField: 'kieKey',
    legacyKey: 'kie_api_key',
    placeholder: 'ใส่ KIE API key',
  },
  {
    id: 'github',
    label: 'GitHub Token',
    hint: 'เพิ่ม quota ตอนหา repo/trending',
    legacyKey: 'github_api_token',
    placeholder: 'ghp_... หรือ github_pat_...',
  },
  {
    id: 'dropbox',
    label: 'Dropbox',
    hint: 'ใช้เลือก/อ่านคลังรูปและไฟล์',
    profileField: 'dropboxKey',
    legacyKey: 'dropbox_api_key',
    placeholder: 'Dropbox access token',
  },
  {
    id: 'google',
    label: 'Google',
    hint: 'ใช้กับเครื่องมือที่พึ่ง Google API',
    profileField: 'googleKey',
    legacyKey: 'google_api_key',
    placeholder: 'Google API key',
  },
  {
    id: 'apify',
    label: 'Apify',
    hint: 'ใช้กับงาน scrape/automation',
    profileField: 'apifyKey',
    legacyKey: 'apify_api_key',
    placeholder: 'apify_api_...',
  },
];

const PROFILE_STORAGE_KEY = 'api_global_profiles';
const ACTIVE_PROFILE_KEY = 'api_global_active_id';

function readProfiles(): ApiProfile[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function makeQuickProfile(): ApiProfile {
  return {
    id: `quick-${Date.now()}`,
    name: 'Quick API Profile',
    openRouterKey: '',
    dropboxKey: '',
    kieKey: '',
    googleKey: '',
    apifyKey: '',
  };
}

function ensureActiveProfile(): { profiles: ApiProfile[]; activeId: string; active: ApiProfile } {
  const profiles = readProfiles();
  const storedActiveId = localStorage.getItem(ACTIVE_PROFILE_KEY) || '';
  const existingActive = (storedActiveId ? profiles.find(p => p.id === storedActiveId) : undefined) ?? profiles[0];

  if (existingActive) {
    const activeId = existingActive.id;
    if (!storedActiveId) localStorage.setItem(ACTIVE_PROFILE_KEY, activeId);
    return { profiles, activeId, active: existingActive };
  }

  const active = makeQuickProfile();
  return { profiles: [active], activeId: active.id, active };
}

function getProfileKey(option: KeyOption): string {
  const profiles = readProfiles();
  const activeId = localStorage.getItem(ACTIVE_PROFILE_KEY);
  const active = (activeId ? profiles.find(p => p.id === activeId) : undefined) ?? profiles[0];
  const profileValue = option.profileField ? active?.[option.profileField] : '';
  const cleanProfileValue = typeof profileValue === 'string' ? profileValue.trim() : '';
  if (cleanProfileValue) return cleanProfileValue;

  if (option.id === 'github') {
    return (localStorage.getItem('github_api_token') || localStorage.getItem('github_token') || '').trim();
  }

  return (localStorage.getItem(option.legacyKey) || '').trim();
}

function maskKey(key: string): string {
  const clean = key.trim();
  if (!clean) return 'ยังไม่ได้ใส่';
  if (clean.length <= 12) return 'บันทึกแล้ว';
  return `${clean.slice(0, 7)}...${clean.slice(-4)}`;
}

async function persistProfiles(profiles: ApiProfile[], activeId: string) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
  localStorage.setItem(ACTIVE_PROFILE_KEY, activeId);
  window.dispatchEvent(new CustomEvent('api-profiles-updated', {
    detail: { profiles, activeProfileId: activeId },
  }));

  fetch('/api/save-app-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'api_profiles', data: profiles }),
  }).catch(console.error);
}

export function ApiKeyQuickBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedKind, setSelectedKind] = useState<KeyKind>('openrouter');
  const [keyValue, setKeyValue] = useState('');
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const selectedOption = useMemo(
    () => KEY_OPTIONS.find(option => option.id === selectedKind) ?? KEY_OPTIONS[0],
    [selectedKind]
  );
  const savedKey = getProfileKey(selectedOption);
  const hasOpenRouterKey = /^sk-or-/i.test(getProfileKey(KEY_OPTIONS[0]));

  useEffect(() => {
    setKeyValue(getProfileKey(selectedOption));
    setStatus('');
  }, [selectedOption]);

  useEffect(() => {
    const refresh = () => {
      if (!isOpen) return;
      setKeyValue(getProfileKey(selectedOption));
    };
    window.addEventListener('api-profiles-updated', refresh);
    window.addEventListener('api-quick-key-updated', refresh);
    return () => {
      window.removeEventListener('api-profiles-updated', refresh);
      window.removeEventListener('api-quick-key-updated', refresh);
    };
  }, [isOpen, selectedOption]);

  const saveKey = async () => {
    const clean = keyValue.trim();
    if (selectedOption.id === 'openrouter' && clean && !/^sk-or-/i.test(clean)) {
      setStatus('OpenRouter key ต้องขึ้นต้นด้วย sk-or-');
      return;
    }

    setIsSaving(true);
    setStatus('');
    try {
      if (selectedOption.id === 'github') {
        if (clean) {
          localStorage.setItem('github_api_token', clean);
          localStorage.setItem('github_token', clean);
        } else {
          localStorage.removeItem('github_api_token');
          localStorage.removeItem('github_token');
        }
        window.dispatchEvent(new CustomEvent('api-quick-key-updated', {
          detail: { kind: selectedOption.id, value: clean },
        }));
        setStatus(clean ? 'บันทึก GitHub token แล้ว' : 'ลบ GitHub token แล้ว');
        return;
      }

      const { profiles, activeId, active } = ensureActiveProfile();
      const updatedProfile: ApiProfile = { ...active };
      if (selectedOption.profileField) {
        (updatedProfile as Record<string, string | undefined>)[selectedOption.profileField] = clean;
      }

      const updatedProfiles = profiles.some(profile => profile.id === activeId)
        ? profiles.map(profile => profile.id === activeId ? updatedProfile : profile)
        : [...profiles, updatedProfile];

      if (clean) localStorage.setItem(selectedOption.legacyKey, clean);
      else localStorage.removeItem(selectedOption.legacyKey);

      await persistProfiles(updatedProfiles, activeId);
      window.dispatchEvent(new CustomEvent('api-quick-key-updated', {
        detail: { kind: selectedOption.id, value: clean },
      }));
      setStatus(clean ? `บันทึก ${selectedOption.label} แล้ว` : `ลบ ${selectedOption.label} แล้ว`);
    } catch (error: any) {
      setStatus(error?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  const testOpenRouter = async () => {
    const clean = keyValue.trim();
    if (!clean) {
      setStatus('ใส่ OpenRouter key ก่อนทดสอบ');
      return;
    }
    if (!/^sk-or-/i.test(clean)) {
      setStatus('OpenRouter key ต้องขึ้นต้นด้วย sk-or-');
      return;
    }

    setIsTesting(true);
    setStatus('กำลังเช็กเครดิต...');
    const info = await checkOpenRouterCredits(clean);
    setIsTesting(false);
    if (info.valid) {
      setStatus(`ใช้ได้ · เครดิต ${info.balanceFormatted}${info.keyLabel ? ` · ${info.keyLabel}` : ''}`);
    } else {
      setStatus(`ใช้ไม่ได้: ${info.error || 'ตรวจไม่ผ่าน'}`);
    }
  };

  return (
    <div className="api-key-quick">
      <button
        type="button"
        className={`api-key-quick-trigger ${hasOpenRouterKey ? 'ready' : 'missing'}`}
        onClick={() => setIsOpen(prev => !prev)}
        title="แก้ API key แบบเร็ว ใช้ได้ทุกหน้า"
      >
        <span>🔑 API</span>
        <small>{hasOpenRouterKey ? 'พร้อมใช้' : 'ใส่คีย์'}</small>
      </button>

      {isOpen && (
        <div className="api-key-quick-panel">
          <div className="api-key-quick-head">
            <div>
              <strong>API Key กลาง</strong>
              <p>แก้ตรงนี้แล้วทุกหน้าจะใช้คีย์ชุดเดียวกัน</p>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="ปิด">×</button>
          </div>

          <label className="api-key-quick-field">
            <span>เลือกคีย์</span>
            <select
              value={selectedKind}
              onChange={(event) => setSelectedKind(event.target.value as KeyKind)}
            >
              {KEY_OPTIONS.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="api-key-quick-note">
            <strong>{selectedOption.hint}</strong>
            <span>สถานะ: {maskKey(savedKey)}</span>
          </div>

          <label className="api-key-quick-field">
            <span>API key ใหม่</span>
            <input
              type="password"
              value={keyValue}
              onChange={(event) => setKeyValue(event.target.value)}
              placeholder={selectedOption.placeholder}
              autoComplete="off"
            />
          </label>

          {status && <div className="api-key-quick-status">{status}</div>}

          <div className="api-key-quick-actions">
            {selectedOption.id === 'openrouter' && (
              <button type="button" className="api-key-quick-secondary" onClick={testOpenRouter} disabled={isTesting}>
                {isTesting ? 'กำลังเช็ก...' : 'เช็กเครดิต'}
              </button>
            )}
            <button type="button" className="api-key-quick-save" onClick={saveKey} disabled={isSaving}>
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกคีย์'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
