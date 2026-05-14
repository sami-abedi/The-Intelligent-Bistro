// src/types.ts

export type Category = 'Sandwiches' | 'Sides' | 'Drinks' | 'Desserts';

export interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  imageUrl: string;
  modifierGroups: ModifierGroup[];
}

export interface CartItemModifier {
  groupId: string;
  optionId: string;
}

export interface CartItem {
  cartItemId: string;
  menuItemId: string;
  quantity: number;
  modifiers: CartItemModifier[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type CartAction =
  | { type: 'add_to_cart'; menuItemId: string; quantity: number; modifiers: CartItemModifier[] }
  | { type: 'remove_from_cart'; cartItemId: string }
  | { type: 'update_quantity'; cartItemId: string; quantity: number }
  | { type: 'clear_cart' };

export interface ChatResponse {
  reply: string;
  actions: CartAction[];
}