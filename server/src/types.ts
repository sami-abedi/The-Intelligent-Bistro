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
  calories: number;
  protein: number;
  carbs: number;
  fiber: number;
  ingredients: string[];
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
  suggestions: string[];
}

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'completed';

export type Payment =
  | { status: 'unpaid'; method: 'pay-at-pickup' }
  | { status: 'paid'; method: 'card-demo'; last4: string; paidAt: string };

export interface OrderLineModifier {
  groupId: string;
  optionId: string;
  name: string;
  priceDelta: number;
}

export interface OrderLine {
  menuItemId: string;
  name: string;
  quantity: number;
  modifiers: OrderLineModifier[];
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  /** SHA-256 of the retrieval token. The raw token is only returned once, at creation. */
  tokenHash: string;
  customerName: string;
  notes?: string;
  lines: OrderLine[];
  subtotal: number;
  tax: number;
  total: number;
  status: OrderStatus;
  payment: Payment;
  createdAt: string;
}