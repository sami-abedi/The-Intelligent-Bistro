// src/validation.ts
// Zod schemas for every request body the server accepts. Everything the
// client sends is untrusted: sizes are capped, shapes are strict, and
// anything that doesn't parse is a 400 before it reaches business logic.
import { z } from 'zod';
import { getMenuItemById } from './menu';
import { CartItem } from './types';

const idString = z.string().min(1).max(64);

export const cartItemSchema = z
  .object({
    cartItemId: idString,
    menuItemId: idString,
    quantity: z.number().int().min(1).max(20),
    modifiers: z
      .array(
        z.object({ groupId: idString, optionId: idString }).strict()
      )
      .max(5),
  })
  .strict();

const chatMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000),
  })
  .strict();

export const chatRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
    cart: z.array(cartItemSchema).max(30).default([]),
    conversationHistory: z.array(chatMessageSchema).max(40).default([]),
  })
  .strict();

export const orderRequestSchema = z
  .object({
    items: z.array(cartItemSchema).min(1).max(30),
    customerName: z.string().trim().min(1).max(60).default('Guest'),
    notes: z.string().trim().max(200).optional(),
  })
  .strict();

export const orderLookupSchema = z
  .object({
    token: z.string().min(1).max(128),
  })
  .strict();

export const paymentRequestSchema = z
  .object({
    token: z.string().min(1).max(128),
    card: z
      .object({
        number: z
          .string()
          .max(25)
          .regex(/^[\d\s-]{12,25}$/, 'Invalid card number'),
        expMonth: z.number().int().min(1).max(12),
        expYear: z.number().int().min(0).max(2100),
        cvc: z.string().regex(/^\d{3,4}$/),
      })
      .strict(),
  })
  .strict();

export const adminStatusSchema = z
  .object({
    status: z.enum(['preparing', 'ready', 'completed']),
  })
  .strict();

/**
 * For /chat we're lenient: drop cart lines that reference unknown menu items
 * or invalid modifier options instead of rejecting the whole request, so a
 * stale client cart can't block the conversation.
 */
export function sanitizeCartForChat(cart: CartItem[]): CartItem[] {
  return cart.filter((line) => {
    const item = getMenuItemById(line.menuItemId);
    if (!item) return false;
    return line.modifiers.every((m) => {
      const group = item.modifierGroups.find((g) => g.id === m.groupId);
      return !!group?.options.some((o) => o.id === m.optionId);
    });
  });
}
