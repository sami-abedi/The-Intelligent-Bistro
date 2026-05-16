// stores/cartStore.ts
import 'react-native-get-random-values'; // must be imported before uuid on RN
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { CartItem, CartItemModifier, MenuItem, CartAction } from '../types';

interface CartState {
  items: CartItem[];
  addItem: (menuItem: MenuItem, quantity: number, modifiers: CartItemModifier[]) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clear: () => void;
  applyAction: (action: CartAction, menu: MenuItem[]) => void;
  itemCount: () => number;
  subtotal: (menu: MenuItem[]) => number;
}

// Two cart items are "the same line" if they share menuItemId AND modifiers.
function modifiersMatch(a: CartItemModifier[], b: CartItemModifier[]): boolean {
  if (a.length !== b.length) return false;
  const sortKey = (m: CartItemModifier) => `${m.groupId}:${m.optionId}`;
  const aSorted = [...a].map(sortKey).sort().join('|');
  const bSorted = [...b].map(sortKey).sort().join('|');
  return aSorted === bSorted;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (menuItem, quantity, modifiers) => {
    set((state) => {
      // If an identical line exists (same item + same modifiers), bump quantity.
      const existing = state.items.find(
        (ci) => ci.menuItemId === menuItem.id && modifiersMatch(ci.modifiers, modifiers)
      );
      if (existing) {
        return {
          items: state.items.map((ci) =>
            ci.cartItemId === existing.cartItemId
              ? { ...ci, quantity: ci.quantity + quantity }
              : ci
          ),
        };
      }
      const newItem: CartItem = {
        cartItemId: uuidv4(),
        menuItemId: menuItem.id,
        quantity,
        modifiers,
      };
      return { items: [...state.items, newItem] };
    });
  },

  removeItem: (cartItemId) => {
    set((state) => ({ items: state.items.filter((ci) => ci.cartItemId !== cartItemId) }));
  },

  updateQuantity: (cartItemId, quantity) => {
    set((state) => {
      if (quantity <= 0) {
        return { items: state.items.filter((ci) => ci.cartItemId !== cartItemId) };
      }
      return {
        items: state.items.map((ci) =>
          ci.cartItemId === cartItemId ? { ...ci, quantity } : ci
        ),
      };
    });
  },

  clear: () => set({ items: [] }),

  applyAction: (action, menu) => {
    switch (action.type) {
      case 'add_to_cart': {
        const menuItem = menu.find((m) => m.id === action.menuItemId);
        if (!menuItem) {
          console.warn(`applyAction: unknown menuItemId "${action.menuItemId}"`);
          return;
        }
        get().addItem(menuItem, action.quantity, action.modifiers);
        break;
      }
      case 'remove_from_cart': {
        get().removeItem(action.cartItemId);
        break;
      }
      case 'update_quantity': {
        get().updateQuantity(action.cartItemId, action.quantity);
        break;
      }
      case 'clear_cart': {
        get().clear();
        break;
      }
    }
  },

  itemCount: () => get().items.reduce((sum, ci) => sum + ci.quantity, 0),

  subtotal: (menu) => {
    return get().items.reduce((total, ci) => {
      const menuItem = menu.find((m) => m.id === ci.menuItemId);
      if (!menuItem) return total;
      let lineTotal = menuItem.price;
      for (const mod of ci.modifiers) {
        const group = menuItem.modifierGroups.find((g) => g.id === mod.groupId);
        const option = group?.options.find((o) => o.id === mod.optionId);
        if (option) lineTotal += option.priceDelta;
      }
      return total + lineTotal * ci.quantity;
    }, 0);
  },
}));