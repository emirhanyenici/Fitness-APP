import { create } from 'zustand';

interface SubscriptionStore {
  plan: 'free' | 'pro' | 'elite';
  isPro: boolean;
  isElite: boolean;
  setPlan: (plan: 'free' | 'pro' | 'elite') => void;
}

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
  plan: 'free',
  isPro: false,
  isElite: false,

  setPlan: (plan) =>
    set({
      plan,
      isPro: plan === 'pro' || plan === 'elite',
      isElite: plan === 'elite'
    }),
}));
