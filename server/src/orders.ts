// src/orders.ts
// Order creation, server-side pricing, and persistence.
//
// Security notes:
// - Prices are ALWAYS computed on the server from the canonical menu. The
//   client sends item ids and quantities only; a tampered client can't set
//   its own prices.
// - Each order gets a random retrieval token, returned exactly once at
//   creation. Only its SHA-256 hash is stored, and lookups compare hashes
//   with a timing-safe comparison.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getMenuItemById } from './menu';
import { CartItem, Order, OrderLine, OrderStatus } from './types';

const DATA_DIR = path.join(__dirname, '..', 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const MAX_STORED_ORDERS = 500;
const TAX_RATE = Number(process.env.TAX_RATE ?? 0.0875);

let orders: Order[] = [];

export function loadOrders(): void {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
      if (Array.isArray(parsed)) orders = parsed;
    }
  } catch (err) {
    console.error('Could not load orders file; starting empty.', err);
    orders = [];
  }
}

function persistOrders(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = ORDERS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(orders, null, 2), 'utf8');
    fs.renameSync(tmp, ORDERS_FILE);
  } catch (err) {
    console.error('Could not persist orders:', err);
  }
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function newOrderId(): string {
  // Human-friendly id like "BL-4F7K2Q" (no ambiguous 0/O/1/I characters).
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (const b of bytes) suffix += alphabet[b % alphabet.length];
  return `BL-${suffix}`;
}

export class OrderValidationError extends Error {}

/**
 * Turn client cart lines into priced order lines using only server-side
 * menu data. Throws OrderValidationError on unknown items, invalid
 * modifiers, or missing required modifier groups.
 */
export function priceCart(items: CartItem[]): { lines: OrderLine[]; subtotal: number } {
  const lines: OrderLine[] = items.map((line) => {
    const item = getMenuItemById(line.menuItemId);
    if (!item) {
      throw new OrderValidationError(`Unknown menu item: ${line.menuItemId}`);
    }

    let unitPrice = item.price;
    const modifiers = line.modifiers.map((m) => {
      const group = item.modifierGroups.find((g) => g.id === m.groupId);
      const option = group?.options.find((o) => o.id === m.optionId);
      if (!group || !option) {
        throw new OrderValidationError(`Invalid modifier for ${item.name}`);
      }
      unitPrice += option.priceDelta;
      return {
        groupId: group.id,
        optionId: option.id,
        name: option.name,
        priceDelta: option.priceDelta,
      };
    });

    for (const group of item.modifierGroups) {
      if (group.required && !modifiers.some((m) => m.groupId === group.id)) {
        throw new OrderValidationError(`${item.name} requires a ${group.name} selection`);
      }
    }

    const seen = new Set(modifiers.map((m) => m.groupId));
    if (seen.size !== modifiers.length) {
      throw new OrderValidationError(`Duplicate modifier group on ${item.name}`);
    }

    return {
      menuItemId: item.id,
      name: item.name,
      quantity: line.quantity,
      modifiers,
      unitPrice: round2(unitPrice),
      lineTotal: round2(unitPrice * line.quantity),
    };
  });

  const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  return { lines, subtotal };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface CreatedOrder {
  order: Order;
  token: string;
}

export function createOrder(items: CartItem[], customerName: string, notes?: string): CreatedOrder {
  const { lines, subtotal } = priceCart(items);
  const tax = round2(subtotal * TAX_RATE);
  const token = crypto.randomBytes(24).toString('hex');

  const order: Order = {
    id: newOrderId(),
    tokenHash: sha256(token),
    customerName,
    notes,
    lines,
    subtotal,
    tax,
    total: round2(subtotal + tax),
    status: 'received',
    payment: { status: 'unpaid', method: 'pay-at-pickup' },
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  if (orders.length > MAX_STORED_ORDERS) orders = orders.slice(-MAX_STORED_ORDERS);
  persistOrders();

  return { order, token };
}

/** Look up an order by id, authenticated by its retrieval token. */
export function getOrder(id: string, token: string): Order | undefined {
  const order = orders.find((o) => o.id === id);
  if (!order) return undefined;

  const expected = Buffer.from(order.tokenHash, 'hex');
  const actual = Buffer.from(sha256(token), 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return undefined;
  }
  return order;
}

/** Public view of an order: everything except the token hash. */
export function toPublicOrder(order: Order) {
  const { tokenHash: _tokenHash, ...publicOrder } = order;
  return publicOrder;
}

// --- Payments (demo processor) ---------------------------------------------
//
// This is deliberately NOT a real payment integration. It accepts exactly one
// well-known test card number and stores only the last four digits — the full
// number is never persisted or logged. The shape mirrors what a Stripe-style
// integration would look like, so swapping in a real provider means replacing
// processDemoCard() with an API call.

const DEMO_TEST_CARD = '4242424242424242';

export interface CardInput {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
}

function processDemoCard(card: CardInput): { ok: true; last4: string } | { ok: false; reason: string } {
  const digits = card.number.replace(/[\s-]/g, '');
  if (digits !== DEMO_TEST_CARD) {
    return { ok: false, reason: 'Card declined. (Demo mode: use test card 4242 4242 4242 4242.)' };
  }
  const now = new Date();
  const expYear = card.expYear < 100 ? 2000 + card.expYear : card.expYear;
  if (expYear < now.getFullYear() || (expYear === now.getFullYear() && card.expMonth < now.getMonth() + 1)) {
    return { ok: false, reason: 'Card is expired.' };
  }
  return { ok: true, last4: digits.slice(-4) };
}

/** Pay for an order, authenticated by its retrieval token. */
export function payOrder(id: string, token: string, card: CardInput): Order {
  const order = getOrder(id, token);
  if (!order) throw new OrderValidationError('Order not found.');
  if (order.payment.status === 'paid') throw new OrderValidationError('Order is already paid.');

  const result = processDemoCard(card);
  if (!result.ok) throw new OrderValidationError(result.reason);

  order.payment = {
    status: 'paid',
    method: 'card-demo',
    last4: result.last4,
    paidAt: new Date().toISOString(),
  };
  persistOrders();
  return order;
}

// --- Kitchen / admin ---------------------------------------------------------

const STATUS_FLOW: OrderStatus[] = ['received', 'preparing', 'ready', 'completed'];

/** Recent orders, newest first, for the kitchen view. */
export function listOrders(limit = 50): Order[] {
  return [...orders].reverse().slice(0, limit);
}

/**
 * Move an order's status forward. Only forward transitions are allowed —
 * a kitchen can't take an order back to "received".
 */
export function advanceOrderStatus(id: string, status: OrderStatus): Order {
  const order = orders.find((o) => o.id === id);
  if (!order) throw new OrderValidationError('Order not found.');

  const from = STATUS_FLOW.indexOf(order.status);
  const to = STATUS_FLOW.indexOf(status);
  if (to <= from) {
    throw new OrderValidationError(`Cannot move an order from "${order.status}" to "${status}".`);
  }

  order.status = status;
  persistOrders();
  return order;
}
