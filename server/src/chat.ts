// src/chat.ts
import Anthropic from '@anthropic-ai/sdk';
import { MENU, getMenuItemById } from './menu';
import { CartItem, CartAction, ChatMessage, ChatResponse } from './types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-4-6';

const tools: Anthropic.Tool[] = [
  {
    name: 'add_to_cart',
    description:
      'Add a menu item to the cart. Use this when the user wants to order something. If the user orders multiple items with different modifiers (e.g. "one spicy, one mild"), call this tool once per variant.',
    input_schema: {
      type: 'object',
      properties: {
        menu_item_id: {
          type: 'string',
          description: 'The id of the menu item, e.g. "sandwich-spicy-chicken".',
        },
        quantity: {
          type: 'integer',
          minimum: 1,
          description: 'How many of this item to add.',
        },
        modifiers: {
          type: 'array',
          description:
            'Selected modifiers. Each references a group id and chosen option id from the menu.',
          items: {
            type: 'object',
            properties: {
              group_id: { type: 'string' },
              option_id: { type: 'string' },
            },
            required: ['group_id', 'option_id'],
          },
        },
      },
      required: ['menu_item_id', 'quantity', 'modifiers'],
    },
  },
  {
    name: 'remove_from_cart',
    description: 'Remove a specific cart line by its cartItemId.',
    input_schema: {
      type: 'object',
      properties: {
        cart_item_id: { type: 'string', description: 'The cartItemId of the line to remove.' },
      },
      required: ['cart_item_id'],
    },
  },
  {
    name: 'update_quantity',
    description: 'Change the quantity of an existing cart line.',
    input_schema: {
      type: 'object',
      properties: {
        cart_item_id: { type: 'string' },
        quantity: { type: 'integer', minimum: 0, description: 'New quantity. 0 removes the line.' },
      },
      required: ['cart_item_id', 'quantity'],
    },
  },
  {
    name: 'clear_cart',
    description: 'Remove all items from the cart. Confirm with the user before calling this.',
    input_schema: { type: 'object', properties: {} },
  },
];

function buildSystemPrompt(cart: CartItem[]): string {
  const menuText = MENU.map((item) => {
    const mods =
      item.modifierGroups.length === 0
        ? ''
        : '\n    Modifiers: ' +
          item.modifierGroups
            .map(
              (g) =>
                `${g.name} (id: ${g.id}) [${g.options
                  .map((o) => `${o.name}=${o.id}`)
                  .join(', ')}]`
            )
            .join('; ');
    return `- ${item.name} (id: ${item.id}, $${item.price}) — ${item.description}${mods}`;
  }).join('\n');

  const cartText =
    cart.length === 0
      ? 'The cart is currently empty.'
      : 'Current cart:\n' +
        cart
          .map((ci) => {
            const item = getMenuItemById(ci.menuItemId);
            const modText =
              ci.modifiers.length === 0
                ? ''
                : ` [${ci.modifiers.map((m) => `${m.groupId}=${m.optionId}`).join(', ')}]`;
            return `  - cartItemId: ${ci.cartItemId}, ${ci.quantity}× ${item?.name ?? ci.menuItemId}${modText}`;
          })
          .join('\n');

          return `You are Remy, the host at Bistro Lumière. Warm, witty, a little bit French — you love food and you love the people you're feeding. You're not a chatbot taking orders; you're a host who happens to use chat.

          VOICE — this matters more than anything else
          - Have fun with it. Use personality, opinions, the occasional small flourish. "Beautiful choice." "Now we're talking." "Oh, that's a great combo."
          - React to what the guest says. If they pick something spicy, comment on it. If they pick something elegant, say so. Be human.
          - Confirmations should feel like a host saying it, not a system logging it. NOT "I've updated your cart." YES "Two Medium spicy chickens, coming right up." or "Locked in — one Medium Sparkling Water on the way."
          - Brief but alive. One or two sentences, but those sentences should have a voice.
          - Don't be afraid of an emoji if it fits naturally. Don't force them.
          
          WHAT YOU DO
          - Listen, understand, use tools to update the cart, confirm with personality.
          - If something's genuinely ambiguous, ask — but in your voice, not a form-letter way.
          - If they ask for something off-menu, say so kindly and suggest the closest thing.
          - Never invent menu items, prices, or modifier options.
          
          ACTION RULES (follow these, but keep your voice while doing it)
          
          1. When you call a tool, ALWAYS say what you just did in the same reply. Name the item and quantity. Don't ever call a tool silently. But say it like Remy would — "Two Medium spicy chickens, in the cart" beats "Added 2 Spicy Chicken Sandwich (Medium spice)."
          
          2. Short replies during an active thread are continuations, not new requests.
             - You asked "what spice level?" → They say "Medium" → That's the spice for the dish you were just discussing. Just add it. Don't ask "which dish?"
             - You recommended a dish → They say "add it" / "yes" / "sure" → That's the dish. Add it.
             - You were discussing fries → They say "and a water" → Add fries AND a water.
          
          3. If they ask to add something and it's already in the cart, mention it before duplicating. "You've already got a chicken sandwich in there — another, or want to tweak the existing one?"
          
          4. Don't announce intent without action. Don't say "let me add that" without actually calling the tool in the same response.
          
          After your reply, ALWAYS end with this line:
          SUGGESTIONS: <option 1> | <option 2> | <option 3>
          
          2-3 short, contextual follow-ups in the guest's voice (3-6 words each), tap-to-send. Examples:
          - After a recommendation: "Add it" | "Tell me more" | "Something lighter?"
          - After taking an order: "Add a drink" | "Make that two" | "I'm done"
          - After answering a question: "Got it, thanks" | "What else?" | "What about sides?"
          - After a clarifying question: give the actual options as suggestions
          
          Always include SUGGESTIONS. Never skip it.
          
          MENU:
          ${menuText}
          
          ${cartText}`;
}

function parseReplyAndSuggestions(rawReply: string): { reply: string; suggestions: string[] } {
  const marker = 'SUGGESTIONS:';
  const idx = rawReply.lastIndexOf(marker);

  if (idx === -1) {
    return { reply: rawReply.trim(), suggestions: [] };
  }

  const reply = rawReply.slice(0, idx).trim();
  const suggestionsRaw = rawReply.slice(idx + marker.length).trim();

  const suggestions = suggestionsRaw
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 50)
    .slice(0, 3);

  return { reply, suggestions };
}

export async function handleChat(
  message: string,
  cart: CartItem[],
  history: ChatMessage[]
): Promise<ChatResponse> {
  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(cart),
    tools,
    messages,
  });

  let rawReply = '';
  const actions: CartAction[] = [];

  for (const block of response.content) {
    if (block.type === 'text') {
      rawReply += block.text;
    } else if (block.type === 'tool_use') {
      const input = block.input as Record<string, unknown>;
      switch (block.name) {
        case 'add_to_cart':
          actions.push({
            type: 'add_to_cart',
            menuItemId: input.menu_item_id as string,
            quantity: input.quantity as number,
            modifiers:
              (input.modifiers as Array<{ group_id: string; option_id: string }>)?.map((m) => ({
                groupId: m.group_id,
                optionId: m.option_id,
              })) ?? [],
          });
          break;
        case 'remove_from_cart':
          actions.push({
            type: 'remove_from_cart',
            cartItemId: input.cart_item_id as string,
          });
          break;
        case 'update_quantity':
          actions.push({
            type: 'update_quantity',
            cartItemId: input.cart_item_id as string,
            quantity: input.quantity as number,
          });
          break;
        case 'clear_cart':
          actions.push({ type: 'clear_cart' });
          break;
      }
    }
  }

  const { reply: parsedReply, suggestions } = parseReplyAndSuggestions(rawReply);

  let reply = parsedReply;
  if (!reply.trim() && actions.length > 0) {
    // Last-resort fallback — the system prompt requires Claude to confirm
    // explicitly, so this branch should rarely fire. If it does, the prompt
    // needs revisiting rather than this string getting prettier.
    console.warn('Claude called tools without text reply; falling back to generic confirmation.');
    reply = "Done — your cart's updated.";
  }

  return { reply: reply.trim(), actions, suggestions };
}