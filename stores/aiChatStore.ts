import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestionType?: string | null;
}

export const WELCOME_MESSAGE: ChatMessage = {
  id: '0',
  role: 'assistant',
  text: "Hi! I'm your Novra AI Coach. Ask me anything about your workouts, nutrition, or recovery — or tap a quick prompt below.",
};

interface AIChatStore {
  /** userId → messages */
  chats: Record<string, ChatMessage[]>;
  addMessage: (userId: string, msg: ChatMessage) => void;
  clearHistory: (userId: string) => void;
}

export const useAIChatStore = create<AIChatStore>()(
  persist(
    (set) => ({
      chats: {},

      addMessage: (userId, msg) =>
        set((s) => {
          const current = s.chats[userId] ?? [WELCOME_MESSAGE];
          return { chats: { ...s.chats, [userId]: [...current.slice(-49), msg] } };
        }),

      clearHistory: (userId) =>
        set((s) => ({
          chats: { ...s.chats, [userId]: [WELCOME_MESSAGE] },
        })),
    }),
    {
      name: 'novra-ai-chat-v2',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
