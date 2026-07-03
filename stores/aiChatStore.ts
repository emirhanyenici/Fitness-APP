import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';
import { todayStr, dateStr } from '../services/dateUtils';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestionType?: string | null;
  createdAt?: string; // ISO timestamp
}

/** Count of user messages sent today for a given userId (used for free-tier limit). */
export function getTodayMsgCount(chats: Record<string, ChatMessage[]>, userId: string): number {
  const today = todayStr();
  return (chats[userId] ?? []).filter(
    (m) => m.role === 'user' && !!m.createdAt && dateStr(new Date(m.createdAt)) === today
  ).length;
}

export const WELCOME_MESSAGE: ChatMessage = {
  id: '0',
  role: 'assistant',
  text: "Hi! I'm your Zenova AI Coach. Ask me anything about your workouts, nutrition, or recovery — or tap a quick prompt below.",
};

interface AIChatStore {
  /** userId → messages */
  chats: Record<string, ChatMessage[]>;
  addMessage: (userId: string, msg: ChatMessage) => void;
  clearHistory: (userId: string) => void;
  clearAll: () => void;
}

export const useAIChatStore = create<AIChatStore>()(
  persist(
    (set) => ({
      chats: {},

      addMessage: (userId, msg) =>
        set((s) => {
          const stamped = msg.createdAt ? msg : { ...msg, createdAt: new Date().toISOString() };
          const current = s.chats[userId] ?? [WELCOME_MESSAGE];
          return { chats: { ...s.chats, [userId]: [...current.slice(-49), stamped] } };
        }),

      clearHistory: (userId) =>
        set((s) => ({
          chats: { ...s.chats, [userId]: [WELCOME_MESSAGE] },
        })),

      clearAll: () => set({ chats: {} }),
    }),
    {
      name: 'zenova-ai-chat-v2',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
