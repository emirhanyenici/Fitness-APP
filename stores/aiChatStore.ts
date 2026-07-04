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

/** Per-user daily send counter, kept separate from the message array so
 *  "Clear conversation" can't reset the free-tier limit (F12). */
export interface DailyCount { date: string; count: number }

/** Count of user messages sent today for a given userId (used for free-tier limit). */
export function getTodayMsgCount(chats: Record<string, ChatMessage[]>, userId: string): number {
  const today = todayStr();
  return (chats[userId] ?? []).filter(
    (m) => m.role === 'user' && !!m.createdAt && dateStr(new Date(m.createdAt)) === today
  ).length;
}

/**
 * Today's usage for the free-tier gate: the max of the date-keyed counter and
 * the message-derived count. The counter survives clearHistory; the message
 * count covers records persisted before the counter existed.
 */
export function getTodayUsage(
  s: { chats: Record<string, ChatMessage[]>; dailyCounts: Record<string, DailyCount> },
  userId: string,
): number {
  const dc = s.dailyCounts[userId];
  const counted = dc?.date === todayStr() ? dc.count : 0;
  return Math.max(counted, getTodayMsgCount(s.chats, userId));
}

export const WELCOME_MESSAGE: ChatMessage = {
  id: '0',
  role: 'assistant',
  text: "Hi! I'm your Zenova AI Coach. Ask me anything about your workouts, nutrition, or recovery — or tap a quick prompt below.",
};

interface AIChatStore {
  /** userId → messages */
  chats: Record<string, ChatMessage[]>;
  /** userId → today's user-message count (independent of the chats array) */
  dailyCounts: Record<string, DailyCount>;
  addMessage: (userId: string, msg: ChatMessage) => void;
  clearHistory: (userId: string) => void;
  clearAll: () => void;
}

export const useAIChatStore = create<AIChatStore>()(
  persist(
    (set) => ({
      chats: {},
      dailyCounts: {},

      addMessage: (userId, msg) =>
        set((s) => {
          const stamped = msg.createdAt ? msg : { ...msg, createdAt: new Date().toISOString() };
          const current = s.chats[userId] ?? [WELCOME_MESSAGE];
          const chats = { ...s.chats, [userId]: [...current.slice(-49), stamped] };
          if (msg.role !== 'user') return { chats };
          const today = todayStr();
          const prev  = s.dailyCounts[userId];
          const count = prev?.date === today ? prev.count + 1 : 1;
          return { chats, dailyCounts: { ...s.dailyCounts, [userId]: { date: today, count } } };
        }),

      // Deliberately leaves dailyCounts intact — clearing the conversation
      // must not reset the free-tier daily limit (F12).
      clearHistory: (userId) =>
        set((s) => ({
          chats: { ...s.chats, [userId]: [WELCOME_MESSAGE] },
        })),

      clearAll: () => set({ chats: {}, dailyCounts: {} }),
    }),
    {
      name: 'zenova-ai-chat-v2',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
