import { config } from '../config.js';
import { query } from '../db/pool.js';
import { parseExpenseText } from './expenseParserService.js';
import { createExpenseTransactions } from './transactionService.js';
import { createMonth, findMonthByYearMonth } from './monthService.js';

const LOCAL_TIME_ZONE = 'Africa/Casablanca';
const pendingDrafts = new Map();
let botStarted = false;
let offset = 0;

function localDateISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LOCAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} MAD`;
}

function draftTotal(items) {
  return items.reduce((total, item) => total + Number(item.quantity || 1) * Number(item.unit_price || 0), 0);
}

async function telegram(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    throw new Error(body.description || `Telegram ${method} failed`);
  }
  return body.result;
}

async function sendMessage(chatId, text, options = {}) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...options
  });
}

async function editMessage(chatId, messageId, text, options = {}) {
  return telegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...options
  });
}

function isAuthorized(chatId) {
  return config.telegramAllowedChatId && String(chatId) === String(config.telegramAllowedChatId);
}

function draftKey(chatId, draftId) {
  return `${chatId}:${draftId}`;
}

function latestDraftFor(chatId) {
  return Array.from(pendingDrafts.values())
    .filter((draft) => String(draft.chatId) === String(chatId))
    .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
}

function formatDraft(draft) {
  const lines = draft.items.map((item, index) => {
    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.unit_price || 0);
    const total = quantity * unitPrice;
    const category = item.category_name || 'No category';
    return `${index + 1}. <b>${escapeHtml(item.product_name)}</b> x${quantity} · ${money(unitPrice)}/unit · ${money(total)} · ${escapeHtml(category)}`;
  });
  const warnings = draft.warnings?.length
    ? `\n\nWarnings:\n${draft.warnings.map((warning) => `- ${escapeHtml(warning)}`).join('\n')}`
    : '';
  return [
    '<b>Review expense draft</b>',
    ...lines,
    '',
    `<b>Total:</b> ${money(draftTotal(draft.items))}`,
    warnings,
    '',
    'Edit examples:',
    '<code>set 1 name bread</code>',
    '<code>set 2 qty 3</code>',
    '<code>set 2 unit 5</code>',
    '<code>set 3 category transport</code>'
  ].filter(Boolean).join('\n');
}

function draftKeyboard(draft) {
  return {
    inline_keyboard: [
      [
        { text: 'Confirm', callback_data: `expense_confirm:${draft.id}` },
        { text: 'Cancel', callback_data: `expense_cancel:${draft.id}` }
      ]
    ]
  };
}

async function activeCategories() {
  const { rows } = await query(
    `SELECT id, name
     FROM expense_categories
     WHERE is_active = TRUE
     ORDER BY name`
  );
  return rows;
}

async function currentMonth() {
  const today = localDateISO();
  const [year, month] = today.split('-').map(Number);
  return await findMonthByYearMonth(year, month) || await createMonth({ year, month, copyFromPrevious: true });
}

async function createDraft(chatId, text) {
  const parsed = await parseExpenseText({ text });
  if (!parsed.items.length) {
    await sendMessage(chatId, 'I could not find any priced expense items in that message.');
    return;
  }

  const draft = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    chatId,
    text,
    items: parsed.items,
    warnings: parsed.warnings || [],
    createdAt: Date.now()
  };
  pendingDrafts.set(draftKey(chatId, draft.id), draft);
  await sendMessage(chatId, formatDraft(draft), { reply_markup: draftKeyboard(draft) });
}

async function updateDraft(chatId, text) {
  const match = text.match(/^set\s+(\d+)\s+(name|product|qty|quantity|unit|price|category)\s+(.+)$/i);
  if (!match) return false;

  const draft = latestDraftFor(chatId);
  if (!draft) {
    await sendMessage(chatId, 'No pending draft to edit. Send a new expense message first.');
    return true;
  }

  const index = Number(match[1]) - 1;
  const field = match[2].toLowerCase();
  const value = match[3].trim();
  const item = draft.items[index];
  if (!item) {
    await sendMessage(chatId, `Draft item ${index + 1} does not exist.`);
    return true;
  }

  if (field === 'name' || field === 'product') {
    item.product_name = value;
  } else if (field === 'qty' || field === 'quantity') {
    const quantity = Number(value.replace(',', '.'));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      await sendMessage(chatId, 'Quantity must be greater than zero.');
      return true;
    }
    item.quantity = quantity;
  } else if (field === 'unit' || field === 'price') {
    const unitPrice = Number(value.replace(',', '.'));
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      await sendMessage(chatId, 'Unit price must be a non-negative number.');
      return true;
    }
    item.unit_price = unitPrice;
  } else if (field === 'category') {
    const categories = await activeCategories();
    const category = categories.find((row) => row.name.toLowerCase() === value.toLowerCase());
    if (!category) {
      await sendMessage(chatId, `Unknown category "${escapeHtml(value)}". Available: ${categories.map((row) => row.name).join(', ')}`);
      return true;
    }
    item.category_id = category.id;
    item.category_name = category.name;
  }

  await sendMessage(chatId, formatDraft(draft), { reply_markup: draftKeyboard(draft) });
  return true;
}

async function confirmDraft(chatId, draftId, messageId) {
  const key = draftKey(chatId, draftId);
  const draft = pendingDrafts.get(key);
  if (!draft) {
    await editMessage(chatId, messageId, 'This draft is no longer available.');
    return;
  }

  const invalid = draft.items.filter((item) => !item.category_id || Number(item.unit_price) <= 0);
  if (invalid.length) {
    await sendMessage(chatId, 'Some items are missing category or price. Edit the draft before confirming.');
    return;
  }

  const month = await currentMonth();
  const date = localDateISO();
  const created = await createExpenseTransactions(draft.items.map((item) => ({
    month_id: month.id,
    transaction_date: date,
    description: item.product_name,
    quantity: item.quantity || 1,
    unit_price: item.unit_price,
    price: Number(item.quantity || 1) * Number(item.unit_price || 0),
    category_id: item.category_id
  })));

  pendingDrafts.delete(key);
  await editMessage(chatId, messageId, `Saved ${created.length} expense(s).\nTotal: ${money(draftTotal(draft.items))}`);
}

async function cancelDraft(chatId, draftId, messageId) {
  pendingDrafts.delete(draftKey(chatId, draftId));
  await editMessage(chatId, messageId, 'Draft cancelled.');
}

async function handleMessage(message) {
  const chatId = message.chat?.id;
  const text = String(message.text || '').trim();
  if (!chatId || !text) return;

  if (!config.telegramAllowedChatId) {
    await sendMessage(chatId, `Telegram bot is connected.\nYour chat ID is <code>${chatId}</code>.\nSet TELEGRAM_ALLOWED_CHAT_ID=${chatId} in .env, then restart the app.`);
    return;
  }
  if (!isAuthorized(chatId)) return;

  if (text === '/start' || text === '/help') {
    await sendMessage(chatId, [
      'Send expenses naturally, for example:',
      '<code>2 milks 4dh each, chicken 40dh, bus 4dh</code>',
      '',
      'Then confirm, cancel, or edit with:',
      '<code>set 1 category food</code>',
      '<code>set 2 unit 45</code>'
    ].join('\n'));
    return;
  }

  if (await updateDraft(chatId, text)) return;
  await createDraft(chatId, text);
}

async function handleCallback(callback) {
  const chatId = callback.message?.chat?.id;
  const messageId = callback.message?.message_id;
  const data = String(callback.data || '');
  if (!chatId || !messageId || !isAuthorized(chatId)) return;

  await telegram('answerCallbackQuery', { callback_query_id: callback.id });

  const [action, draftId] = data.split(':');
  if (action === 'expense_confirm') {
    await confirmDraft(chatId, draftId, messageId);
  } else if (action === 'expense_cancel') {
    await cancelDraft(chatId, draftId, messageId);
  }
}

async function poll() {
  while (botStarted) {
    try {
      const updates = await telegram('getUpdates', {
        offset,
        timeout: 30,
        allowed_updates: ['message', 'callback_query']
      });
      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message) await handleMessage(update.message);
        if (update.callback_query) await handleCallback(update.callback_query);
      }
    } catch (error) {
      console.warn(`Telegram bot polling failed: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

export function startTelegramBot() {
  if (botStarted) return;
  if (!config.telegramBotToken) {
    console.log('Telegram bot disabled: TELEGRAM_BOT_TOKEN is not configured');
    return;
  }
  botStarted = true;
  console.log('Telegram bot polling started');
  poll();
}
