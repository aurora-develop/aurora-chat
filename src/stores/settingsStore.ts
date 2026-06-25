import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  token: string;
  model: string;
  streamEnabled: boolean;
  setToken: (token: string) => void;
  setModel: (model: string) => void;
  setStreamEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      token: '',
      model: 'auto',
      streamEnabled: true,
      setToken: (token) => {
        localStorage.setItem('aurora_token', token);
        set({ token });
      },
      setModel: (model) => set({ model }),
      setStreamEnabled: (enabled) => set({ streamEnabled: enabled }),
    }),
    {
      name: 'aurora-settings',
    }
  )
);
