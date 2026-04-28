import { useState, useEffect } from 'react';

export interface WritingStyle {
  id: string;
  name: string;
  content: string;
}

const LS_KEY = 'aipage_writing_styles';
const API_KEY = 'writing_styles';

export function useWritingStyles() {
  const [styles, setStyles] = useState<WritingStyle[]>([]);

  useEffect(() => {
    fetch(`/api/get-app-data?key=${API_KEY}`)
      .then(res => res.json())
      .then((data: WritingStyle[]) => {
        const localSaved = localStorage.getItem(LS_KEY);
        let localData: WritingStyle[] = [];
        try { if (localSaved) localData = JSON.parse(localSaved); } catch(e) {}

        // MIGRATION: backend empty, localStorage has data
        if ((!data || data.length === 0) && localData.length > 0) {
          console.log('Migrating writing_styles from localStorage to backend...');
          setStyles(localData);
          fetch('/api/save-app-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: API_KEY, data: localData })
          });
        } else if (data && data.length > 0) {
          setStyles(data);
          localStorage.setItem(LS_KEY, JSON.stringify(data));
        }
      })
      .catch(err => {
        console.error('Failed to load writing_styles from backend', err);
        const saved = localStorage.getItem(LS_KEY);
        if (saved) { try { setStyles(JSON.parse(saved)); } catch(e) {} }
      });
  }, []);

  const persist = (updated: WritingStyle[]) => {
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
    fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: API_KEY, data: updated })
    }).catch(console.error);
  };

  const saveStyle = (style: Omit<WritingStyle, 'id'>) => {
    setStyles(prev => {
      const newStyle: WritingStyle = { ...style, id: Date.now().toString() };
      const updated = [...prev, newStyle];
      persist(updated);
      return updated;
    });
  };

  const updateStyle = (id: string, changes: Partial<WritingStyle>) => {
    setStyles(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, ...changes } : s);
      persist(updated);
      return updated;
    });
  };

  const deleteStyle = (id: string) => {
    setStyles(prev => {
      const updated = prev.filter(s => s.id !== id);
      persist(updated);
      return updated;
    });
  };

  return { styles, setStyles, saveStyle, updateStyle, deleteStyle, persist };
}
