// mobile/lib/api.ts
import { MenuItem, CartItem, CartAction } from '../types';
import { ChatMessage } from '../stores/useChatStore';

// IMPORTANT: localhost won't work on a real phone — point at your computer's LAN IP.
const API_BASE_URL = 'http://192.168.4.221:3000';

export async function fetchMenu(): Promise<MenuItem[]> {
  const res = await fetch(`${API_BASE_URL}/menu`);
  if (!res.ok) throw new Error('Failed to fetch menu');
  const data = await res.json();
  return data.menu;
}

export interface ChatResponse {
  reply: string;
  actions: CartAction[];
}

export async function sendChat(
  message: string,
  cart: CartItem[],
  conversationHistory: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      cart,
      conversationHistory: conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);
  return res.json();
}