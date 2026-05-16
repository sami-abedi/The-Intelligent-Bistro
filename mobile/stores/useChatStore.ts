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
  addMessage: (role: ChatRole, content: string) => ChatMessage;
  setThinking: (thinking: boolean) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isThinking: false,
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
  clear: () => set({ messages: [], isThinking: false }),
}));