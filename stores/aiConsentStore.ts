import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';

/**
 * Explicit, persisted consent to send data to the third-party AI provider
 * (App Store 5.1.1(i) / 5.1.2(i), review item 2.1). Device-local on purpose —
 * a new install must ask again.
 */
interface AiConsentStore {
  accepted: boolean;
  setAccepted: (accepted: boolean) => void;
}

export const useAiConsentStore = create<AiConsentStore>()(
  persist(
    (set) => ({
      accepted: false,
      setAccepted: (accepted) => set({ accepted }),
    }),
    {
      name: 'zenova-ai-consent-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
