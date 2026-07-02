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
  suggestions: string[];
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

export interface OrderConfirmation {
  order: {
    id: string;
    customerName: string;
    subtotal: number;
    tax: number;
    total: number;
    status: string;
    createdAt: string;
  };
  token: string;
  estimatedMinutes: number;
}

export async function placeOrder(
  items: CartItem[],
  customerName = 'Guest',
  notes?: string
): Promise<OrderConfirmation> {
  const res = await fetch(`${API_BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, customerName, ...(notes ? { notes } : {}) }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? `Order request failed: ${res.status}`);
  }
  return data as OrderConfirmation;
}