// Bistro Lumière — web app.
// Same architecture as the mobile app: the cart lives on the client, the
// server is stateless for chat and authoritative for order pricing.
//
// Security: all dynamic content is rendered through createElement/textContent.
// Remy's replies pass through renderMarkdownInto(), which builds DOM nodes
// (bold/italic only) instead of injecting HTML.

'use strict';

// --------------------------------------------------------------------------
// State
// --------------------------------------------------------------------------
const CART_STORAGE_KEY = 'bistro-cart-v1';

let menu = [];
let cart = loadCart(); // [{ cartItemId, menuItemId, quantity, modifiers: [{groupId, optionId}] }]
let activeCategory = 'All';
let chatMessages = []; // [{ role: 'user'|'assistant', content }]
let suggestions = [];
let thinking = false;
let checkoutMode = false; // cart drawer shows checkout form
let pendingOrder = null; // created but not yet paid: { order, token, estimatedMinutes }
let lastConfirmation = null; // finished: { order, token, estimatedMinutes }
let statusPollTimer = null;
let retryMessage = null; // last chat message that failed, offered for retry

const $ = (id) => document.getElementById(id);

// --------------------------------------------------------------------------
// Cart helpers (mirrors mobile stores/cartStore.ts)
// --------------------------------------------------------------------------
function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    /* storage unavailable — cart stays in memory */
  }
}

function findMenuItem(id) {
  return menu.find((m) => m.id === id);
}

function modifiersMatch(a, b) {
  if (a.length !== b.length) return false;
  const key = (m) => `${m.groupId}:${m.optionId}`;
  return [...a].map(key).sort().join('|') === [...b].map(key).sort().join('|');
}

function addToCart(menuItem, quantity, modifiers) {
  const existing = cart.find(
    (ci) => ci.menuItemId === menuItem.id && modifiersMatch(ci.modifiers, modifiers)
  );
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      cartItemId: crypto.randomUUID(),
      menuItemId: menuItem.id,
      quantity,
      modifiers,
    });
  }
  onCartChanged();
}

function removeFromCart(cartItemId) {
  cart = cart.filter((ci) => ci.cartItemId !== cartItemId);
  onCartChanged();
}

function updateQuantity(cartItemId, quantity) {
  if (quantity <= 0) return removeFromCart(cartItemId);
  const line = cart.find((ci) => ci.cartItemId === cartItemId);
  if (line) line.quantity = Math.min(quantity, 20);
  onCartChanged();
}

function clearCart() {
  cart = [];
  onCartChanged();
}

function lineUnitPrice(line) {
  const item = findMenuItem(line.menuItemId);
  if (!item) return 0;
  let price = item.price;
  for (const m of line.modifiers) {
    const group = item.modifierGroups.find((g) => g.id === m.groupId);
    const option = group?.options.find((o) => o.id === m.optionId);
    if (option) price += option.priceDelta;
  }
  return price;
}

function cartSubtotal() {
  return cart.reduce((sum, line) => sum + lineUnitPrice(line) * line.quantity, 0);
}

function cartCount() {
  return cart.reduce((sum, line) => sum + line.quantity, 0);
}

function applyAction(action) {
  switch (action.type) {
    case 'add_to_cart': {
      const item = findMenuItem(action.menuItemId);
      if (item) addToCart(item, action.quantity, action.modifiers ?? []);
      break;
    }
    case 'remove_from_cart':
      removeFromCart(action.cartItemId);
      break;
    case 'update_quantity':
      updateQuantity(action.cartItemId, action.quantity);
      break;
    case 'clear_cart':
      clearCart();
      break;
  }
}

function onCartChanged() {
  saveCart();
  renderCartCount();
  if (!$('cart-overlay').hidden) renderCartBody();
}

// --------------------------------------------------------------------------
// API
// --------------------------------------------------------------------------
async function fetchMenu() {
  const res = await fetch('/menu');
  if (!res.ok) throw new Error('Failed to fetch menu');
  return (await res.json()).menu;
}

async function placeOrder(customerName, notes) {
  const res = await fetch('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: cart,
      customerName,
      ...(notes ? { notes } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Order failed');
  return data;
}

async function payForOrder(orderId, token, card) {
  const res = await fetch(`/orders/${encodeURIComponent(orderId)}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, card }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Payment failed');
  return data;
}

async function fetchOrderStatus(orderId, token) {
  const res = await fetch(
    `/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`
  );
  if (!res.ok) throw new Error('Status check failed');
  return (await res.json()).order;
}

// --------------------------------------------------------------------------
// DOM helpers
// --------------------------------------------------------------------------
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Minimal safe markdown: builds text/strong/em nodes. No HTML injection. */
function renderMarkdownInto(container, text) {
  // Split on **bold** and *italic* runs; everything is added as text nodes.
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  for (const token of tokens) {
    if (!token) continue;
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      container.appendChild(el('strong', null, token.slice(2, -2)));
    } else if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      container.appendChild(el('em', null, token.slice(1, -1)));
    } else {
      container.appendChild(document.createTextNode(token));
    }
  }
}

function money(n) {
  return `$${n.toFixed(2)}`;
}

// --------------------------------------------------------------------------
// Menu rendering
// --------------------------------------------------------------------------
function renderCategories() {
  const categories = ['All', ...new Set(menu.map((m) => m.category))];
  const nav = $('category-chips');
  nav.replaceChildren();
  for (const cat of categories) {
    const chip = el('button', 'chip' + (cat === activeCategory ? ' active' : ''), cat);
    chip.addEventListener('click', () => {
      activeCategory = cat;
      renderCategories();
      renderMenu();
    });
    nav.appendChild(chip);
  }
}

function renderMenu() {
  const grid = $('menu-grid');
  grid.replaceChildren();
  const items = activeCategory === 'All' ? menu : menu.filter((m) => m.category === activeCategory);

  for (const item of items) {
    const card = el('article', 'menu-card');

    const img = el('img');
    img.src = item.imageUrl;
    img.alt = item.name;
    img.loading = 'lazy';
    img.classList.add('card-click');
    img.addEventListener('click', () => openItemModal(item));
    card.appendChild(img);

    const body = el('div', 'menu-card-body');
    const title = el('h3', 'card-click', item.name);
    title.addEventListener('click', () => openItemModal(item));
    body.appendChild(title);
    body.appendChild(el('p', 'menu-card-desc', item.description));

    const footer = el('div', 'menu-card-footer');
    footer.appendChild(el('span', 'menu-price', money(item.price)));

    const add = el('button', 'add-button', '+');
    add.setAttribute('aria-label', `Add ${item.name}`);
    add.addEventListener('click', () => {
      if (item.modifierGroups.length > 0) {
        openItemModal(item); // needs a required choice — customize first
      } else {
        addToCart(item, 1, []);
      }
    });
    footer.appendChild(add);
    body.appendChild(footer);
    card.appendChild(body);
    grid.appendChild(card);
  }
}

function renderCartCount() {
  const count = cartCount();
  const badge = $('cart-count');
  badge.hidden = count === 0;
  badge.textContent = String(count);
}

// --------------------------------------------------------------------------
// Item detail / customize modal
// --------------------------------------------------------------------------
function openItemModal(item) {
  const body = $('item-modal-body');
  body.replaceChildren();

  const img = el('img');
  img.src = item.imageUrl;
  img.alt = item.name;
  body.appendChild(img);

  const content = el('div', 'modal-body');
  const title = el('h2', null, item.name);
  title.id = 'item-modal-title';
  content.appendChild(title);
  content.appendChild(el('p', 'modal-desc', item.description));

  // Nutrition
  content.appendChild(el('p', 'section-label', 'Nutrition'));
  const nutrition = el('div', 'nutrition-row');
  for (const [value, label] of [
    [item.calories, 'cal'],
    [`${item.protein}g`, 'protein'],
    [`${item.carbs}g`, 'carbs'],
    [`${item.fiber}g`, 'fiber'],
  ]) {
    const cell = el('div', 'nutrition-cell');
    cell.appendChild(el('div', 'value', String(value)));
    cell.appendChild(el('div', 'label', label));
    nutrition.appendChild(cell);
  }
  content.appendChild(nutrition);

  // Ingredients
  content.appendChild(el('p', 'section-label', 'Ingredients'));
  const ul = el('ul', 'ingredients');
  for (const ing of item.ingredients) ul.appendChild(el('li', null, ing));
  content.appendChild(ul);

  // Modifiers
  const selected = {}; // groupId -> optionId
  for (const group of item.modifierGroups) {
    selected[group.id] = group.options[0].id;
    content.appendChild(el('p', 'section-label', group.name));
    const row = el('div', 'option-row');
    for (const option of group.options) {
      const label =
        option.priceDelta > 0 ? `${option.name} +${money(option.priceDelta)}` : option.name;
      const pill = el('button', 'option-pill', label);
      pill.dataset.group = group.id;
      pill.dataset.option = option.id;
      pill.addEventListener('click', () => {
        selected[group.id] = option.id;
        row.querySelectorAll('.option-pill').forEach((p) => p.classList.remove('selected'));
        pill.classList.add('selected');
        updatePrice();
      });
      row.appendChild(pill);
    }
    row.querySelector('.option-pill').classList.add('selected');
    content.appendChild(row);
  }

  // Quantity + add
  content.appendChild(el('p', 'section-label', 'Quantity'));
  let qty = 1;
  const qtyControls = el('div', 'qty-controls');
  const minus = el('button', 'qty-btn', '−');
  const qtyLabel = el('span', null, '1');
  const plus = el('button', 'qty-btn', '+');
  minus.addEventListener('click', () => {
    qty = Math.max(1, qty - 1);
    qtyLabel.textContent = String(qty);
    updatePrice();
  });
  plus.addEventListener('click', () => {
    qty = Math.min(20, qty + 1);
    qtyLabel.textContent = String(qty);
    updatePrice();
  });
  qtyControls.append(minus, qtyLabel, plus);
  content.appendChild(qtyControls);

  const addBtn = el('button', 'primary-button');
  function currentUnitPrice() {
    let price = item.price;
    for (const [groupId, optionId] of Object.entries(selected)) {
      const group = item.modifierGroups.find((g) => g.id === groupId);
      const option = group?.options.find((o) => o.id === optionId);
      if (option) price += option.priceDelta;
    }
    return price;
  }
  function updatePrice() {
    addBtn.textContent = `Add to order — ${money(currentUnitPrice() * qty)}`;
  }
  updatePrice();
  addBtn.addEventListener('click', () => {
    const modifiers = Object.entries(selected).map(([groupId, optionId]) => ({
      groupId,
      optionId,
    }));
    addToCart(item, qty, modifiers);
    closeOverlay('item-modal');
  });
  content.appendChild(addBtn);

  body.appendChild(content);
  $('item-modal').hidden = false;
}

// --------------------------------------------------------------------------
// Cart drawer + checkout
// --------------------------------------------------------------------------
function renderCartBody() {
  const body = $('cart-body');
  body.replaceChildren();

  if (lastConfirmation) {
    renderConfirmation(body);
    return;
  }

  if (pendingOrder) {
    renderPayment(body);
    return;
  }

  if (cart.length === 0) {
    const empty = el('div', 'empty-cart');
    empty.appendChild(el('h3', null, 'Your table is set.'));
    empty.appendChild(el('p', null, 'Add something from the menu to get started.'));
    body.appendChild(empty);
    return;
  }

  for (const line of cart) {
    const item = findMenuItem(line.menuItemId);
    if (!item) continue;

    const row = el('div', 'cart-line');
    const img = el('img');
    img.src = item.imageUrl;
    img.alt = item.name;
    row.appendChild(img);

    const main = el('div', 'cart-line-main');
    const top = el('div', 'cart-line-top');
    const nameWrap = el('div');
    nameWrap.appendChild(el('div', 'cart-line-name', item.name));
    const modNames = line.modifiers
      .map((m) => {
        const group = item.modifierGroups.find((g) => g.id === m.groupId);
        return group?.options.find((o) => o.id === m.optionId)?.name;
      })
      .filter(Boolean)
      .join(' · ');
    if (modNames) nameWrap.appendChild(el('div', 'cart-line-mods', modNames));
    top.appendChild(nameWrap);
    top.appendChild(el('div', 'menu-price', money(lineUnitPrice(line) * line.quantity)));
    main.appendChild(top);

    const bottom = el('div', 'cart-line-bottom');
    const qtyControls = el('div', 'qty-controls');
    const minus = el('button', 'qty-btn', '−');
    const plus = el('button', 'qty-btn', '+');
    minus.addEventListener('click', () => updateQuantity(line.cartItemId, line.quantity - 1));
    plus.addEventListener('click', () => updateQuantity(line.cartItemId, line.quantity + 1));
    qtyControls.append(minus, el('span', null, String(line.quantity)), plus);
    bottom.appendChild(qtyControls);

    const remove = el('button', 'remove-link', 'Remove');
    remove.addEventListener('click', () => removeFromCart(line.cartItemId));
    bottom.appendChild(remove);
    main.appendChild(bottom);
    row.appendChild(main);
    body.appendChild(row);
  }

  const totals = el('div', 'totals');
  const subtotalRow = el('div', 'totals-row');
  subtotalRow.appendChild(el('span', null, 'Subtotal'));
  subtotalRow.appendChild(el('span', null, money(cartSubtotal())));
  totals.appendChild(subtotalRow);
  totals.appendChild(el('p', 'cart-line-mods', 'Tax is calculated at checkout.'));
  body.appendChild(totals);

  if (!checkoutMode) {
    const checkoutBtn = el('button', 'primary-button', 'Checkout');
    checkoutBtn.addEventListener('click', () => {
      checkoutMode = true;
      renderCartBody();
    });
    body.appendChild(checkoutBtn);
    return;
  }

  // Checkout form
  const nameLabel = el('label', 'field-label', 'Name for the order');
  nameLabel.htmlFor = 'checkout-name';
  const nameInput = el('input', 'text-input');
  nameInput.id = 'checkout-name';
  nameInput.type = 'text';
  nameInput.maxLength = 60;
  nameInput.placeholder = 'Your name';

  const notesLabel = el('label', 'field-label', 'Notes (optional)');
  notesLabel.htmlFor = 'checkout-notes';
  const notesInput = el('input', 'text-input');
  notesInput.id = 'checkout-notes';
  notesInput.type = 'text';
  notesInput.maxLength = 200;
  notesInput.placeholder = 'Allergies, pickup time…';

  const errorText = el('p', 'error-text', '');
  errorText.hidden = true;

  const submitBtn = el('button', 'primary-button', 'Place order');
  submitBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim() || 'Guest';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Placing order…';
    errorText.hidden = true;
    try {
      const data = await placeOrder(name, notesInput.value.trim() || undefined);
      pendingOrder = data;
      clearCart();
      checkoutMode = false;
      renderCartBody();
    } catch (err) {
      errorText.textContent = err.message || 'Order failed. Please try again.';
      errorText.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Place order';
    }
  });

  body.append(nameLabel, nameInput, notesLabel, notesInput, errorText, submitBtn);
}

function renderPayment(body) {
  const { order } = pendingOrder;

  const box = el('div');
  box.appendChild(el('h3', null, `Order ${order.id} — ${money(order.total)}`));
  box.appendChild(
    el('p', 'modal-desc', `Subtotal ${money(order.subtotal)} + tax ${money(order.tax)}. How would you like to pay?`)
  );
  box.appendChild(
    el('p', 'cart-line-mods', 'Demo payments — use test card 4242 4242 4242 4242, any future expiry, any CVC. No real money moves.')
  );

  const numberLabel = el('label', 'field-label', 'Card number');
  numberLabel.htmlFor = 'pay-number';
  const numberInput = el('input', 'text-input');
  numberInput.id = 'pay-number';
  numberInput.inputMode = 'numeric';
  numberInput.autocomplete = 'off';
  numberInput.maxLength = 25;
  numberInput.placeholder = '4242 4242 4242 4242';

  const expLabel = el('label', 'field-label', 'Expiry (MM/YY)');
  expLabel.htmlFor = 'pay-exp';
  const expInput = el('input', 'text-input');
  expInput.id = 'pay-exp';
  expInput.autocomplete = 'off';
  expInput.maxLength = 7;
  expInput.placeholder = '12/30';

  const cvcLabel = el('label', 'field-label', 'CVC');
  cvcLabel.htmlFor = 'pay-cvc';
  const cvcInput = el('input', 'text-input');
  cvcInput.id = 'pay-cvc';
  cvcInput.inputMode = 'numeric';
  cvcInput.autocomplete = 'off';
  cvcInput.maxLength = 4;
  cvcInput.placeholder = '123';

  const errorText = el('p', 'error-text', '');
  errorText.hidden = true;

  const payBtn = el('button', 'primary-button', `Pay ${money(order.total)} (demo)`);
  payBtn.addEventListener('click', async () => {
    const expMatch = expInput.value.trim().match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
    if (!expMatch) {
      errorText.textContent = 'Enter expiry as MM/YY.';
      errorText.hidden = false;
      return;
    }
    payBtn.disabled = true;
    payBtn.textContent = 'Processing…';
    errorText.hidden = true;
    try {
      const data = await payForOrder(order.id, pendingOrder.token, {
        number: numberInput.value.trim(),
        expMonth: Number(expMatch[1]),
        expYear: Number(expMatch[2]),
        cvc: cvcInput.value.trim(),
      });
      lastConfirmation = { ...pendingOrder, order: data.order };
      pendingOrder = null;
      renderCartBody();
    } catch (err) {
      errorText.textContent = err.message || 'Payment failed. Please try again.';
      errorText.hidden = false;
      payBtn.disabled = false;
      payBtn.textContent = `Pay ${money(order.total)} (demo)`;
    }
  });

  const pickupBtn = el('button', 'primary-button secondary', 'Pay at pickup instead');
  pickupBtn.addEventListener('click', () => {
    lastConfirmation = pendingOrder;
    pendingOrder = null;
    renderCartBody();
  });

  box.append(numberLabel, numberInput, expLabel, expInput, cvcLabel, cvcInput, errorText, payBtn, pickupBtn);
  body.appendChild(box);
}

function renderConfirmation(body) {
  const { order, estimatedMinutes } = lastConfirmation;
  const box = el('div', 'confirmation');
  box.appendChild(el('h3', null, 'Merci! Order received.'));
  box.appendChild(el('div', 'order-id', order.id));
  box.appendChild(el('span', 'status-pill', `Status: ${order.status}`));
  box.appendChild(
    el('p', null, `${order.customerName}, your total is ${money(order.total)} ` +
      `(subtotal ${money(order.subtotal)} + tax ${money(order.tax)}).`)
  );
  box.appendChild(
    el(
      'p',
      null,
      order.payment?.status === 'paid'
        ? `Paid with card ending ${order.payment.last4}.`
        : 'Payment due at pickup.'
    )
  );
  if (order.status !== 'completed') {
    box.appendChild(el('p', null, `Estimated ready in about ${estimatedMinutes} minutes.`));
  }

  const done = el('button', 'primary-button', 'Back to the menu');
  done.addEventListener('click', () => {
    lastConfirmation = null;
    stopStatusPolling();
    closeOverlay('cart-overlay');
  });
  box.appendChild(done);
  body.appendChild(box);

  startStatusPolling();
}

// Poll the order status while the confirmation is on screen so kitchen
// updates (preparing → ready) show up without a manual refresh.
function startStatusPolling() {
  if (statusPollTimer || !lastConfirmation) return;
  statusPollTimer = setInterval(async () => {
    if (!lastConfirmation || $('cart-overlay').hidden) return stopStatusPolling();
    try {
      const order = await fetchOrderStatus(lastConfirmation.order.id, lastConfirmation.token);
      if (order.status !== lastConfirmation.order.status) {
        lastConfirmation = { ...lastConfirmation, order };
        renderCartBody();
        if (order.status === 'completed') stopStatusPolling();
      }
    } catch {
      /* transient — try again on the next tick */
    }
  }, 5000);
}

function stopStatusPolling() {
  if (statusPollTimer) {
    clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
}

// --------------------------------------------------------------------------
// Chat
// --------------------------------------------------------------------------
function renderChat() {
  const list = $('chat-messages');
  list.replaceChildren();

  if (chatMessages.length === 0 && !thinking) {
    const welcome = el('div', 'bubble assistant');
    renderMarkdownInto(
      welcome,
      "Bonsoir! I'm **Remy**, your host. Tell me what you're craving — I'll take care of the rest."
    );
    list.appendChild(welcome);
  }

  for (const msg of chatMessages) {
    const bubble = el('div', `bubble ${msg.role}`);
    if (msg.role === 'assistant') {
      renderMarkdownInto(bubble, msg.content);
    } else {
      bubble.textContent = msg.content;
    }
    list.appendChild(bubble);
  }

  if (thinking) {
    const dots = el('div', 'bubble assistant thinking');
    dots.append(el('span'), el('span'), el('span'));
    list.appendChild(dots);
  }

  list.scrollTop = list.scrollHeight;

  const chips = $('chat-suggestions');
  chips.replaceChildren();
  if (!thinking) {
    if (retryMessage) {
      const retry = el('button', 'suggestion-chip', '↻ Try again');
      retry.addEventListener('click', () => submitChatMessage(retryMessage, { isRetry: true }));
      chips.appendChild(retry);
    }
    for (const s of suggestions) {
      const chip = el('button', 'suggestion-chip', s);
      chip.addEventListener('click', () => submitChatMessage(s));
      chips.appendChild(chip);
    }
  }
}

async function submitChatMessage(text, { isRetry = false } = {}) {
  const message = text.trim();
  if (!message || thinking) return;

  // On retry the user bubble (and Remy's apology) are already in the
  // transcript — don't repeat the question, just try the request again.
  if (!isRetry) chatMessages.push({ role: 'user', content: message });
  suggestions = [];
  retryMessage = null;
  thinking = true;
  $('chat-send').disabled = true;
  renderChat();

  try {
    // Exclude this turn's user message from history (the server gets it as
    // `message`). On retry the transcript ends [failed user msg, apology],
    // so drop both.
    const history = isRetry ? chatMessages.slice(0, -2) : chatMessages.slice(0, -1);
    const res = await sendChatWithHistory(message, history);
    for (const action of res.actions) applyAction(action);
    chatMessages.push({ role: 'assistant', content: res.reply });
    suggestions = res.suggestions ?? [];
  } catch {
    retryMessage = message;
    if (!isRetry) {
      chatMessages.push({
        role: 'assistant',
        content: "Pardon — something went wrong on my end. Give it another try in a moment?",
      });
    }
  } finally {
    thinking = false;
    $('chat-send').disabled = false;
    renderChat();
  }
}

async function sendChatWithHistory(message, history) {
  const res = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      cart,
      conversationHistory: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
  return res.json();
}

// --------------------------------------------------------------------------
// Overlay plumbing + init
// --------------------------------------------------------------------------
function closeOverlay(id) {
  $(id).hidden = true;
  if (id === 'cart-overlay') checkoutMode = false;
}

function init() {
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeOverlay(btn.dataset.close));
  });
  document.querySelectorAll('.overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay(overlay.id);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ['item-modal', 'cart-overlay', 'chat-panel'].forEach(closeOverlay);
    }
  });

  $('cart-button').addEventListener('click', () => {
    $('cart-overlay').hidden = false;
    renderCartBody();
  });

  $('chat-fab').addEventListener('click', () => {
    const panel = $('chat-panel');
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      renderChat();
      $('chat-input').focus();
    }
  });

  $('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('chat-input');
    const value = input.value;
    input.value = '';
    submitChatMessage(value);
  });

  renderCartCount();

  fetchMenu()
    .then((data) => {
      menu = data;
      renderCategories();
      renderMenu();
    })
    .catch(() => {
      const grid = $('menu-grid');
      grid.replaceChildren(
        el('p', 'empty-cart', 'Could not load the menu. Is the server running?')
      );
    });
}

init();
