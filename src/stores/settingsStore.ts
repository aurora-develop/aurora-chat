import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  token: string;
  model: string;
  streamEnabled: boolean;
  useCustomApi: boolean;
  customApiUrl: string;
  customApiKey: string;
  setToken: (token: string) => void;
  setModel: (model: string) => void;
  setStreamEnabled: (enabled: boolean) => void;
  setUseCustomApi: (use: boolean) => void;
  setCustomApiUrl: (url: string) => void;
  setCustomApiKey: (key: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      token: '',
      model: 'auto',
      streamEnabled: true,
      useCustomApi: false,
      customApiUrl: '',
      customApiKey: '',
      setToken: (token) => {
        localStorage.setItem('aurora_token', token);
        set({ token });
      },
      setModel: (model) => set({ model }),
      setStreamEnabled: (enabled) => set({ streamEnabled: enabled }),
      setUseCustomApi: (use) => set({ useCustomApi: use }),
      setCustomApiUrl: (url) => set({ customApiUrl: url }),
      setCustomApiKey: (key) => set({ customApiKey: key }),
    }),
    {
      name: 'aurora-settings',
      version: 2,
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          return {
            ...persisted,
            useCustomApi: false,
            customApiUrl: '',
            customApiKey: '',
          };
        }
        return persisted;
      },
    }
  )
);
