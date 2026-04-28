import { useState, useEffect } from 'react';

export interface ContentIdea {
  id: string;
  topic: string;
  body: string[];
  category: string;
  status: 'unused' | 'rendered';
  createdAt: number;
}

export function useContentStock() {
  const [stock, setStock] = useState<ContentIdea[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('ai_content_stock');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrate old items that don't have category
        const migrated = parsed.map((item: any) => ({
          ...item,
          category: item.category || 'ทั่วไป'
        }));
        setStock(migrated);
      } catch (e) {
        console.error('Failed to parse stock from local storage');
      }
    }
  }, []);

  const saveStock = (newStock: ContentIdea[]) => {
    setStock(newStock);
    localStorage.setItem('ai_content_stock', JSON.stringify(newStock));
  };

  const addContent = (data: {topic: string, body: string[], category?: string}[]) => {
    const newItems: ContentIdea[] = data.map(item => ({
      id: Math.random().toString(36).substr(2, 9),
      topic: item.topic,
      body: item.body,
      category: item.category || 'ทั่วไป',
      status: 'unused',
      createdAt: Date.now()
    }));
    saveStock([...newItems, ...stock]);
  };

  const deleteContent = (id: string) => {
    saveStock(stock.filter(item => item.id !== id));
  };

  const markAsRendered = (id: string) => {
    saveStock(stock.map(item => item.id === id ? { ...item, status: 'rendered' } : item));
  };

  const markMultipleAsRendered = (ids: string[]) => {
    saveStock(stock.map(item => ids.includes(item.id) ? { ...item, status: 'rendered' } : item));
  };

  const getCategories = (): string[] => {
    const cats = new Set(stock.map(s => s.category));
    return ['ทั้งหมด', ...Array.from(cats)];
  };

  return { stock, addContent, deleteContent, markAsRendered, markMultipleAsRendered, getCategories };
}
