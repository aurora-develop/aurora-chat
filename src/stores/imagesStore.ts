import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ImageHistoryItem {
  id: string;
  prompt: string;
  mode: 'generate' | 'edit' | 'variation';
  size: string;
  n: number;
  responseFormat: 'url' | 'b64_json';
  results: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
  createdAt: number;
  model: string;
}

interface ImagesState {
  history: ImageHistoryItem[];
  addToHistory: (item: Omit<ImageHistoryItem, 'id' | 'createdAt'>) => string;
  deleteFromHistory: (id: string) => void;
  clearHistory: () => void;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useImagesStore = create<ImagesState>()(
  persist(
    (set) => ({
      history: [],

      addToHistory: (item) => {
        const id = generateId();
        const newItem: ImageHistoryItem = {
          ...item,
          id,
          createdAt: Date.now(),
        };
        set((state) => ({
          history: [newItem, ...state.history],
        }));
        return id;
      },

      deleteFromHistory: (id) => {
        set((state) => ({
          history: state.history.filter((h) => h.id !== id),
        }));
      },

      clearHistory: () => {
        set({ history: [] });
      },
    }),
    {
      name: 'aurora-images-storage',
      version: 1,
    }
  )
);
