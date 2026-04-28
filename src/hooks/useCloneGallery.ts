import { useState, useEffect } from 'react';

export interface CloneStyle {
  id: string;
  prompt: string;
  imageUrl: string;
  traits?: string[];
  layout?: string;
  promptGuide?: string;
  createdAt: number;
}

export function useCloneGallery() {
  const [gallery, setGallery] = useState<CloneStyle[]>([]);

  useEffect(() => {
    // 1. Fetch from backend first
    fetch('/api/get-app-data?key=styles')
      .then(res => res.json())
      .then((data: CloneStyle[]) => {
        const localSaved = localStorage.getItem('ai_clone_gallery');
        let localData: CloneStyle[] = [];
        try { if (localSaved) localData = JSON.parse(localSaved); } catch(e) {}
        
        // MIGRATION LOGIC: if backend is empty but local storage has data, migrate it!
        if (data.length === 0 && localData.length > 0) {
          console.log('Migrating styles from localStorage to backend...');
          setGallery(localData);
          fetch('/api/save-app-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'styles', data: localData })
          });
        } else {
          setGallery(data);
          // Optional: also push backend data back to localStorage to keep it sync'd
          localStorage.setItem('ai_clone_gallery', JSON.stringify(data));
        }
      })
      .catch(err => {
        console.error('Failed to load clone gallery from backend', err);
        // Fallback to local storage
        const saved = localStorage.getItem('ai_clone_gallery');
        if (saved) {
          try { setGallery(JSON.parse(saved)); } catch (e) {}
        }
      });
  }, []);

  const saveStyle = (style: Omit<CloneStyle, 'id' | 'createdAt'>) => {
    const newStyle: CloneStyle = {
      ...style,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
    };
    setGallery(prev => {
      const newGallery = [newStyle, ...prev];
      // Save globally
      localStorage.setItem('ai_clone_gallery', JSON.stringify(newGallery));
      fetch('/api/save-app-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'styles', data: newGallery })
      }).catch(console.error);
      return newGallery;
    });
  };

  const deleteStyle = (id: string) => {
    setGallery(prev => {
      const newGallery = prev.filter((item) => item.id !== id);
      localStorage.setItem('ai_clone_gallery', JSON.stringify(newGallery));
      fetch('/api/save-app-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'styles', data: newGallery })
      }).catch(console.error);
      return newGallery;
    });
  };

  return { gallery, saveStyle, deleteStyle };
}
