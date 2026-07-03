import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';

export type Lang = 'en' | 'tr';

interface LocaleStore {
  /** Active UI language. Default English; user can switch in Profile. */
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      lang: 'en',
      setLang: (lang) => set({ lang }),
    }),
    {
      name: 'zenova-locale-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
