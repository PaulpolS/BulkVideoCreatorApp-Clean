import { useState, useEffect } from 'react';

export interface ImagePromptStyle {
  id: string;
  name: string;
  content: string;
}

const LS_KEY = 'aipage_image_prompts';
const API_KEY = 'image_prompt_styles';

export function useImagePromptStyles() {
  const [prompts, setPrompts] = useState<ImagePromptStyle[]>([]);

  useEffect(() => {
    fetch(`/api/get-app-data?key=${API_KEY}`)
      .then(res => res.json())
      .then((data: ImagePromptStyle[]) => {
        const localSaved = localStorage.getItem(LS_KEY);
        let localData: ImagePromptStyle[] = [];
        try { if (localSaved) localData = JSON.parse(localSaved); } catch(e) {}

        // MIGRATION: backend empty, localStorage has data
        if ((!data || data.length === 0) && localData.length > 0) {
          console.log('Migrating image_prompt_styles from localStorage to backend...');
          setPrompts(localData);
          fetch('/api/save-app-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: API_KEY, data: localData })
          });
        } else if (data && data.length > 0) {
          setPrompts(data);
          localStorage.setItem(LS_KEY, JSON.stringify(data));
        }
      })
      .catch(err => {
        console.error('Failed to load image_prompt_styles from backend', err);
        const saved = localStorage.getItem(LS_KEY);
        if (saved) { try { setPrompts(JSON.parse(saved)); } catch(e) {} }
      });
  }, []);

  const persist = (updated: ImagePromptStyle[]) => {
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
    fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: API_KEY, data: updated })
    }).catch(console.error);
  };

  const savePrompt = (prompt: Omit<ImagePromptStyle, 'id'>) => {
    setPrompts(prev => {
      const newPrompt: ImagePromptStyle = { ...prompt, id: Date.now().toString() };
      const updated = [...prev, newPrompt];
      persist(updated);
      return updated;
    });
  };

  const updatePrompt = (id: string, changes: Partial<ImagePromptStyle>) => {
    setPrompts(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...changes } : p);
      persist(updated);
      return updated;
    });
  };

  const deletePrompt = (id: string) => {
    setPrompts(prev => {
      const updated = prev.filter(p => p.id !== id);
      persist(updated);
      return updated;
    });
  };

  return { prompts, setPrompts, savePrompt, updatePrompt, deletePrompt, persist };
}
