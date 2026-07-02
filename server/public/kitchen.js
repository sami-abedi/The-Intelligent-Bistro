// Bistro Lumière — kitchen view.
// Staff page: lists recent orders and advances their status. Authenticated
// with the ADMIN_KEY via the x-admin-key header; the key is kept in
// sessionStorage only (cleared when the tab closes, or via the Lock button).

'use strict';

const KEY_STORAGE = 'bistro-admin-key';
const NEXT_STATUS = { received: 'preparing', preparing: 'ready', ready: 'completed' };

let adminKey = sessionStorage.getItem(KEY_STORAGE) || '';
let refreshTimer = null;

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function money(n) {
  return `$${n.toFixed(2)}`;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      'x-admin-key': adminKey,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 503) {
    lock(data.error || 'Access denied.');
    throw new Error(data.error || 'Unauthorized');
  }
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

function lock(message) {
  adminKey = '';
  sessionStorage.removeItem(KEY_STORAGE);
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  $('kitchen-main').hidden = true;
  $('lock-button').hidden = true;
  $('kitchen-login').hidden = false;
  if (message) {
    $('login-error').textContent = message;
    $('login-error').hidden = false;
  }
}

async function unlock(key) {
  adminKey = key;
  try {
    await api('/admin/orders'); // validates the key
    sessionStorage.setItem(KEY_STORAGE, key);
    $('kitchen-login').hidden = true;
    $('kitchen-main').hidden = false;
    $('lock-button').hidden = false;
    await refresh();
    refreshTimer = setInterval(refresh, 5000);
  } catch {
    /* lock() already showed the error */
  }
}

async function refresh() {
  let orders;
  try {
    ({ orders } = await api('/admin/orders'));
  } catch {
    return; // auth failures already handled; transient errors retry next tick
  }

  $('order-count').textContent = `${orders.length} order${orders.length === 1 ? '' : 's'}`;
  const grid = $('kitchen-grid');
  grid.replaceChildren();

  if (orders.length === 0) {
    grid.appendChild(el('p', 'empty-cart', 'No orders yet. The calm before the service.'));
    return;
  }

  for (const order of orders) {
    const card = el('article', 'order-card');

    const header = el('div', 'order-card-header');
    header.appendChild(el('h3', null, order.id));
    header.appendChild(el('span', `badge status-${order.status}`, order.status));
    card.appendChild(header);

    const placed = new Date(order.createdAt);
    const meta = el('div', 'order-meta');
    meta.textContent = `${order.customerName} · ${placed.toLocaleTimeString()} · ${money(order.total)} `;
    const payBadge = el(
      'span',
      `badge ${order.payment?.status === 'paid' ? 'paid' : 'unpaid'}`,
      order.payment?.status === 'paid' ? `paid ····${order.payment.last4}` : 'pay at pickup'
    );
    meta.appendChild(payBadge);
    card.appendChild(meta);

    if (order.notes) {
      card.appendChild(el('div', 'order-meta', `Note: ${order.notes}`));
    }

    const lines = el('ul', 'order-lines');
    for (const line of order.lines) {
      const li = el('li', null, `${line.quantity}× ${line.name}`);
      const modText = line.modifiers.map((m) => m.name).join(', ');
      if (modText) {
        li.appendChild(document.createTextNode(' '));
        li.appendChild(el('span', 'mods', `(${modText})`));
      }
      lines.appendChild(li);
    }
    card.appendChild(lines);

    const next = NEXT_STATUS[order.status];
    if (next) {
      const btn = el('button', 'advance-button', `Mark ${next}`);
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await api(`/admin/orders/${encodeURIComponent(order.id)}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: next }),
          });
          await refresh();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = err.message || 'Failed — try again';
        }
      });
      card.appendChild(btn);
    }

    grid.appendChild(card);
  }
}

function init() {
  $('unlock-button').addEventListener('click', () => {
    const key = $('admin-key-input').value.trim();
    if (key) unlock(key);
  });
  $('admin-key-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('unlock-button').click();
  });
  $('lock-button').addEventListener('click', () => lock());

  if (adminKey) {
    unlock(adminKey);
  } else {
    $('kitchen-login').hidden = false;
  }
}

init();
