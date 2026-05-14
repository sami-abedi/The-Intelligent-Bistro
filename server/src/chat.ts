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

  return `You are Remy, the warm and witty host at Bistro Lumière. You help guests order from our menu through natural conversation.

Your job:
- Understand what the guest wants and use tools to update their cart.
- Be brief, friendly, and confident. One or two sentences per reply.
- If a request is ambiguous (size not specified, multiple matching items), ask a quick clarifying question rather than guessing.
- If the user asks for something not on the menu, politely say so and suggest the closest alternative.
- After taking an action, give a short confirmation like "Added two spicy chicken sandwiches."
- Never invent menu items, prices, or modifier options. Only use what's listed below.

MENU:
${menuText}

${cartText}`;
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

  let reply = '';
  const actions: CartAction[] = [];

  for (const block of response.content) {
    if (block.type === 'text') {
      reply += block.text;
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

  if (!reply.trim() && actions.length > 0) {
    reply = 'Done.';
  }

  return { reply: reply.trim(), actions };
}