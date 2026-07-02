// src/index.ts
import 'dotenv/config';
import crypto from 'crypto';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { MENU } from './menu';
import { handleChat } from './chat';
import {
  advanceOrderStatus,
  createOrder,
  getOrder,
  listOrders,
  loadOrders,
  payOrder,
  toPublicOrder,
  OrderValidationError,
} from './orders';
import {
  adminStatusSchema,
  chatRequestSchema,
  orderRequestSchema,
  orderLookupSchema,
  paymentRequestSchema,
  sanitizeCartForChat,
} from './validation';

// Fail fast: without an API key the /chat route can only 500 later, so
// refuse to boot instead of failing at request time.
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');

// --- Security middleware -------------------------------------------------

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'https://images.unsplash.com', 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);

// Origin policy: requests with no Origin header (native mobile, curl) and
// same-origin browser requests (the bundled web app — browsers send Origin
// on every POST, even same-origin) are always allowed. Cross-origin browser
// access must be explicitly allowlisted via ALLOWED_ORIGINS.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsDelegate: cors.CorsOptionsDelegate<express.Request> = (req, callback) => {
  const origin = req.headers.origin;
  const sameOrigin = origin === `${req.protocol}://${req.headers.host}`;
  if (!origin || sameOrigin || allowedOrigins.includes(origin)) {
    callback(null, { origin: true });
  } else {
    callback(new Error('Not allowed by CORS'));
  }
};
app.use(cors(corsDelegate));

app.use(express.json({ limit: '100kb' }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many chat requests. Please slow down a little.' },
});
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many order requests. Please slow down a little.' },
});
app.use(globalLimiter);

// --- Routes ---------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/menu', (_req, res) => {
  res.json({ menu: MENU });
});

app.post('/chat', chatLimiter, async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request.' });
  }

  const { message, cart, conversationHistory } = parsed.data;

  try {
    const result = await handleChat(message, sanitizeCartForChat(cart), conversationHistory);
    res.json(result);
  } catch (err) {
    console.error('chat error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.post('/orders', orderLimiter, (req, res) => {
  const parsed = orderRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid order.' });
  }

  try {
    const { order, token } = createOrder(
      parsed.data.items,
      parsed.data.customerName,
      parsed.data.notes
    );
    res.status(201).json({
      order: toPublicOrder(order),
      token,
      estimatedMinutes: 15,
    });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('order error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.post('/orders/:id/pay', orderLimiter, (req, res) => {
  const parsed = paymentRequestSchema.safeParse(req.body);
  if (!parsed.success || typeof req.params.id !== 'string' || req.params.id.length > 32) {
    return res.status(400).json({ error: 'Invalid payment request.' });
  }

  try {
    const order = payOrder(req.params.id, parsed.data.token, parsed.data.card);
    res.json({ order: toPublicOrder(order) });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('payment error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.get('/orders/:id', (req, res) => {
  const parsed = orderLookupSchema.safeParse({ token: req.query.token });
  if (!parsed.success || typeof req.params.id !== 'string' || req.params.id.length > 32) {
    return res.status(400).json({ error: 'Invalid request.' });
  }

  const order = getOrder(req.params.id, parsed.data.token);
  // Same response for "no such order" and "wrong token" — don't leak which.
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  res.json({ order: toPublicOrder(order) });
});

// --- Kitchen / admin API ----------------------------------------------------
// Protected by ADMIN_KEY (x-admin-key header, timing-safe compare). If the
// env var isn't set, the admin API stays disabled rather than defaulting open.

const ADMIN_KEY = process.env.ADMIN_KEY ?? '';

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!ADMIN_KEY) {
    return res.status(503).json({ error: 'Kitchen view is not configured. Set ADMIN_KEY in .env.' });
  }
  const provided = req.get('x-admin-key') ?? '';
  const expected = crypto.createHash('sha256').update(ADMIN_KEY).digest();
  const actual = crypto.createHash('sha256').update(provided).digest();
  if (!crypto.timingSafeEqual(expected, actual)) {
    return res.status(401).json({ error: 'Invalid admin key.' });
  }
  next();
}

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

app.get('/admin/orders', adminLimiter, requireAdmin, (_req, res) => {
  res.json({ orders: listOrders().map(toPublicOrder) });
});

app.patch('/admin/orders/:id/status', adminLimiter, requireAdmin, (req, res) => {
  const parsed = adminStatusSchema.safeParse(req.body);
  if (!parsed.success || typeof req.params.id !== 'string' || req.params.id.length > 32) {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  try {
    const order = advanceOrderStatus(req.params.id, parsed.data.status);
    res.json({ order: toPublicOrder(order) });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('admin status error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// --- Web app (same-origin static SPA) --------------------------------------

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Final error handler: never leak stack traces or internal messages.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  console.error('unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong.' });
});

loadOrders();

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`Bistro server running on http://localhost:${PORT}`);
});
