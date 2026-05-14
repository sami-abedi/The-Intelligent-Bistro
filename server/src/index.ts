// src/index.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MENU } from './menu';
import { handleChat } from './chat';
import { CartItem, ChatMessage } from './types';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/menu', (_req, res) => {
  res.json({ menu: MENU });
});

app.post('/chat', async (req, res) => {
  try {
    const { message, cart, conversationHistory } = req.body as {
      message: string;
      cart: CartItem[];
      conversationHistory: ChatMessage[];
    };

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const result = await handleChat(
      message,
      Array.isArray(cart) ? cart : [],
      Array.isArray(conversationHistory) ? conversationHistory : []
    );

    res.json(result);
  } catch (err) {
    console.error('chat error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`Bistro server running on http://localhost:${PORT}`);
});