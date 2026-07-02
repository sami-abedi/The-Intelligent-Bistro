// mobile/stores/useChatStore.ts
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

interface ChatState {
  messages: ChatMessage[];
  isThinking: boolean;
  lastSuggestions: string[];
  /** Set when the last send failed — offered back to the user as a retry. */
  retryText: string | null;
  addMessage: (role: ChatRole, content: string) => ChatMessage;
  setThinking: (thinking: boolean) => void;
  setLastSuggestions: (suggestions: string[]) => void;
  setRetryText: (text: string | null) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isThinking: false,
  lastSuggestions: [],
  retryText: null,
  addMessage: (role, content) => {
    const message: ChatMessage = {
      id: uuidv4(),
      role,
      content,
      createdAt: Date.now(),
    };
    set((state) => ({ messages: [...state.messages, message] }));
    return message;
  },
  setThinking: (thinking) => set({ isThinking: thinking }),
  setLastSuggestions: (suggestions) => set({ lastSuggestions: suggestions }),
  setRetryText: (text) => set({ retryText: text }),
  clear: () =>
    set({ messages: [], isThinking: false, lastSuggestions: [], retryText: null }),
}));