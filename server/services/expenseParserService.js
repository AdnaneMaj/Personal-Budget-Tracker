import { config } from '../config.js';
import { extractLocalDate, referenceDate, validExpenseDate } from '../utils/expenseDate.js';
import { query } from '../db/pool.js';
import { HttpError } from '../utils/http.js';
import {
  listProductMemory,
  normalizeProductName,
  productMemoryIndex
} from './productMemoryService.js';

const currencyPattern = '(?:mad|dh|dhs|dirham|dirhams)';

function numberValue(value) {
  return Number(String(value).replace(',', '.'));
}

function cleanProductName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^\s*and\s+/i, '')
    .replace(/\bi\s+(bought|paid for|got|took|used)\b/g, '')
    .replace(/\b(bought|paid for|got|took|used)\b/g, '')
    .replace(/\b(the|a|an)\b/g, '')
    .replace(/^\s*\d+(?:[\.,]\d+)?\s+/, '')
    .replace(new RegExp(`\\b(?:with|for|at)\\s*\\d+(?:[\\.,]\\d+)?\\s*${currencyPattern}\\b`, 'gi'), '')
    .replace(new RegExp(`\\b\\d+(?:[\\.,]\\d+)?\\s*${currencyPattern}\\s*(?:each)?\\b`, 'gi'), '')
    .replace(/\beach\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryForDescription(description, categories) {
  const text = description.toLowerCase();
  const preferred = [
    ['transport', ['bus', 'taxi', 'train', 'tram', 'ride']],
    ['food', ['milk', 'chicken', 'bread', 'egg', 'eggs', 'meat', 'coffee', 'meal', 'food']],
    ['health', ['medicine', 'doctor', 'pharmacy']],
    ['clothes', ['shirt', 'shoes', 'pants', 'jacket']],
    ['wifi', ['wifi', 'internet']],
    ['car', ['fuel', 'gas', 'parking']],
    ['entertainment', ['movie', 'cinema', 'game']]
  ];

  for (const [categoryName, words] of preferred) {
    if (words.some((word) => text.includes(word))) {
      const match = categories.find((category) => category.name.toLowerCase() === categoryName);
      if (match) return match;
    }
  }

  return categories.find((category) => category.name.toLowerCase() === 'divers') || categories[0] || null;
}

function normalizeCategoryName(value) {
  return String(value || '').trim().toLowerCase();
}

export function parseLocal(text, categories, today = referenceDate()) {
  const amountRegex = new RegExp(`(\\d+(?:[\\.,]\\d+)?)\\s*${currencyPattern}`, 'i');
  const eachRegex = new RegExp(`(\\d+(?:[\\.,]\\d+)?)\\s*${currencyPattern}\\s*each`, 'i');
  const segments = String(text)
    .replace(new RegExp(`(?<!\\d),\\s*(?=\\d+(?:[.,]\\d+)?\\s*${currencyPattern}\\b)`, 'gi'), ' ')
    .split(/(?<!\d),|,(?!\d)|;|\n|\s+and\s+|[.!?]\s+/i)
    .map((segment) => segment.trim())
    .filter(Boolean);

  let inheritedDate = extractLocalDate(text, today).date;
  const items = segments.flatMap((raw) => {
    const extracted = extractLocalDate(raw, today);
    if (extracted.hasDate) inheritedDate = extracted.date;
    const segment = extracted.text.replace(/^(?:i\s+)?(?:bought|paid for|got|took|used)\s+/i, '').trim();
    if (!segment) return [];
    const amountMatch = segment.match(amountRegex) || segment.match(/(\d+(?:[.,]\d+)?)\s*(?:each)?\s*$/i);
    const eachMatch = segment.match(eachRegex);
    const withoutPrice = amountMatch ? segment.slice(0, amountMatch.index) + segment.slice(amountMatch.index + amountMatch[0].length) : segment;
    const quantityMatch = withoutPrice.match(/^\s*(\d+(?:[.,]\d+)?)\s+(?=[a-z])/i);
    const quantity = quantityMatch ? numberValue(quantityMatch[1]) : 1;
    const unitPrice = eachMatch
      ? numberValue(eachMatch[1])
      : amountMatch
        ? numberValue(amountMatch[1]) / (/\beach\b/i.test(segment) ? 1 : quantity)
        : null;
    const productName = cleanProductName(withoutPrice).replace(/\b(for|with|at|on)\s*$/i, '').trim();
    if (!productName) return [];
    const category = categoryForDescription(productName, categories);

    return [{
      transaction_date: inheritedDate,
      input_name: productName,
      product_name: productName.charAt(0).toUpperCase() + productName.slice(1),
      quantity,
      unit_price: unitPrice,
      price_provided: unitPrice !== null,
      matched_product_id: null,
      category_name: category?.name || '',
      confidence: category && unitPrice !== null ? 0.7 : 0.45
    }];
  });

  return {
    provider: 'local',
    items,
    warnings: items.length === 0 ? ['No expense items were found.'] : ['Local parsing is limited; review all items, amounts, and dates.']
  };
}

function buildPrompt(text, categories, products, today) {
  const categoryNames = categories.map((category) => category.name);
  const responseTemplate = {
    items: [
      {
        transaction_date: null,
        input_name: 'milks',
        product_name: 'Milk',
        quantity: 2,
        unit_price: 4,
        price_provided: true,
        matched_product_id: 12,
        category_name: 'food',
        confidence: 0.95
      }
    ],
    warnings: []
  };

  const systemPrompt = `
  You are an expense transaction extraction engine.

  Your job:
  Extract purchased items from short natural-language text and return valid JSON only.

  Output rules:
  - Return ONLY a JSON object.
  - Do NOT return markdown.
  - Do NOT explain anything.
  - Do NOT add fields that are not in the template.
  - Follow this exact JSON shape:
  ${JSON.stringify(responseTemplate, null, 2)}

  Date rules:
  - The reference date is ${today}. Resolve relative dates and weekdays against it.
  - Extract transaction_date for EACH item as YYYY-MM-DD, including shared sentence dates.
  - Interpret slash dates as day/month/year; use the reference year when omitted.
  - Missing, invalid, or ambiguous dates must be null with a warning. NEVER default to today.
  - Preserve different dates for different purchases. Date numbers are not prices or quantities.
  - Keep the date attached to its purchase even when several purchases have different dates.
  - For example, with reference date 2026-10-19, "yesterday eggs 20dh; today milk 7dh"
    gives eggs transaction_date "2026-10-18" and milk transaction_date "2026-10-19".

  Each extracted item must contain:
  - transaction_date: YYYY-MM-DD string or null
  - input_name: string, the item wording used by the user without quantity or price
  - product_name: string, normalized item name, singular when natural
  - quantity: number, or null if unknown
  - unit_price: number, or null if unknown
  - price_provided: boolean, true only when the user explicitly supplied enough price information
  - matched_product_id: an ID from Known products when clearly the same item, otherwise null
  - category_name: one of the allowed category names, or null
  - confidence: number between 0 and 1

  Allowed categories:
  ${categories.map(c => `- ${c.name}`).join('\n')}

  Known products and confirmed aliases:
  ${products.length ? JSON.stringify(products.map((product) => ({
    id: product.id,
    canonical_name: product.canonical_name,
    aliases: product.aliases
  }))) : '[]'}

  Extraction rules:
  - Split the sentence into separate purchased items.
  - Understand quantities written as digits or words.
  - Currency can be written as MAD, DH, dh, dhs, dirham, or dirhams.
  - If the user says "4dh each", set unit_price = 4.
  - If the user says "5 eggs for 20dh", infer unit_price = 20 / 5 = 4.
  - If the user gives only a total price and no quantity, set quantity = 1 and unit_price = total price.
  - If price is missing, set unit_price = null.
  - Set price_provided to false whenever price is missing. Never copy or guess a known product price.
  - If quantity is missing, set quantity = 1 unless the text clearly says quantity is unknown.
  - Match a known product only when it is clearly the same product or a straightforward alias.
  - When matched_product_id is set, use that product's canonical_name as product_name.
  - Never invent a price.
  - Never invent a category outside the allowed categories.
  - If no category fits, use category_name = null and add a warning.
  - If the input is ambiguous, still extract what is clear and add a warning.
  - Use numbers only for quantity and unit_price. Do not include currency symbols inside numbers.
  - Use Moroccan dirham as the default currency when currency is not explicitly stated.

  Category rules:
  - Choose the most specific matching category.
  - Food items like eggs, milk, bread, meat, fruit, vegetables, water, snacks, and groceries should use the food/grocery category if available.
  - If two categories could match, choose the category that best matches the actual product, not the store.
  - If unsure, use null and lower confidence.

  Confidence rules:
  - Use 0.9-1.0 when item, quantity, price, and category are clear.
  - Use 0.6-0.8 when the item is clear but price or category is uncertain.
  - Use below 0.6 when the extraction is very uncertain.

  Examples:

  Input:
  "I bought 5 eggs, 4dh each, and 3 milks, 7dh each"

  Output:
  {
    "items": [
      {
        "transaction_date": null,
        "input_name": "eggs",
        "product_name": "egg",
        "quantity": 5,
        "unit_price": 4,
        "price_provided": true,
        "matched_product_id": null,
        "category_name": "Food",
        "confidence": 0.98
      },
      {
        "transaction_date": null,
        "input_name": "milks",
        "product_name": "milk",
        "quantity": 3,
        "unit_price": 7,
        "price_provided": true,
        "matched_product_id": null,
        "category_name": "Food",
        "confidence": 0.98
      }
    ],
    "warnings": []
  }

  Input:
  "coffee 15dh and taxi 30"

  Output:
  {
    "items": [
      {
        "transaction_date": null,
        "input_name": "coffee",
        "product_name": "coffee",
        "quantity": 1,
        "unit_price": 15,
        "price_provided": true,
        "matched_product_id": null,
        "category_name": "Food",
        "confidence": 0.9
      },
      {
        "transaction_date": null,
        "input_name": "taxi",
        "product_name": "taxi",
        "quantity": 1,
        "unit_price": 30,
        "price_provided": true,
        "matched_product_id": null,
        "category_name": "Transport",
        "confidence": 0.9
      }
    ],
    "warnings": []
  }
  `;

  return [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: 'user',
      content: JSON.stringify({ text, categories: categoryNames })
    }
  ];
}

function aiFailure(code, message, status) {
  const error = new Error(message);
  error.aiCode = code;
  error.providerStatus = status;
  return error;
}

export async function callGroq(text, categories, products, today) {
  if (!config.groqApiKey || !config.groqModel) {
    throw aiFailure('not_configured', 'AI parsing is not configured.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(25000),
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.groqModel,
      messages: buildPrompt(text, categories, products, today),
      temperature: 0,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const reasons = {
      400: ['request_rejected', 'Groq rejected the parsing request or could not generate valid JSON.'],
      401: ['authentication', 'Groq rejected the API key.'],
      403: ['access_denied', 'Groq denied access to the configured model.'],
      404: ['model_unavailable', 'The configured Groq model is unavailable.'],
      413: ['request_too_large', 'The parsing request exceeds the model input limit.'],
      429: ['rate_limit', 'Groq rate limit reached. Wait before trying again.']
    };
    const [code, message] = reasons[response.status] || ['provider_error', 'Groq is temporarily unavailable.'];
    throw aiFailure(code, message, response.status);
  }

  const body = await response.json();
  const content = body.choices?.[0]?.message?.content;
  if (body.choices?.[0]?.finish_reason === 'length') {
    throw aiFailure('truncated_response', 'The AI response was cut short before parsing finished.');
  }
  if (!content) throw aiFailure('empty_response', 'Groq returned an empty response.');
  let parsed;
  try {
    parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch {
    throw aiFailure('invalid_json', 'Groq returned malformed JSON.');
  }
  if (!parsed || !Array.isArray(parsed.items) || parsed.items.some((item) =>
    !item || typeof item !== 'object' || Array.isArray(item)
      || typeof (item.product_name ?? item.description) !== 'string'
      || !(item.product_name ?? item.description).trim())) {
    throw aiFailure('invalid_items', 'Groq returned an unexpected expense format.');
  }
  return parsed;
}

export function normalizeParsed(parsed, categories, products) {
  const categoryByName = new Map(categories.map((category) => [normalizeCategoryName(category.name), category]));
  const { byId: productById, byName: productByName } = productMemoryIndex(products);
  const warnings = Array.isArray(parsed?.warnings) ? parsed.warnings.map(String) : [];
  const items = Array.isArray(parsed?.items) ? parsed.items : [];

  return {
    provider: parsed?.provider || 'groq',
    ...(parsed?.ai_error ? { ai_error: parsed.ai_error } : {}),
    items: items.filter((item) => item && typeof item === 'object').map((item) => {
      const quantity = numberValue(item.quantity || 1);
      const parsedUnitPrice = item.unit_price === null || item.unit_price === undefined ? null : numberValue(item.unit_price);
      const hasExplicitPrice = typeof item.price_provided === 'boolean'
        ? item.price_provided && Number.isFinite(parsedUnitPrice)
        : Number.isFinite(parsedUnitPrice);
      const returnedCategory = item.category_name ?? item.category;
      const confidence = Math.max(0, Math.min(1, Number(item.confidence || 0.5)));
      const productName = String(item.product_name || item.description || 'Expense').trim();
      const inputName = String(item.input_name || productName).trim();
      const exactProduct = productByName.get(normalizeProductName(inputName))
        || productByName.get(normalizeProductName(productName))
        || null;
      const suggestedProduct = productById.get(Number(item.matched_product_id)) || null;
      const product = exactProduct || suggestedProduct;
      const productMatch = exactProduct ? 'exact' : suggestedProduct ? 'suggested' : 'new';
      const category = product
        ? categoryByName.get(normalizeCategoryName(product.category_name)) || null
        : categoryByName.get(normalizeCategoryName(returnedCategory)) || null;
      const unitPrice = hasExplicitPrice
        ? parsedUnitPrice
        : product
          ? Number(product.unit_price)
          : null;
      const priceSource = hasExplicitPrice ? 'explicit' : product ? 'remembered' : 'missing';

      if (!category) {
        warnings.push(`No matching category for "${productName || 'item'}"${returnedCategory ? ` (${returnedCategory})` : ''}.`);
      }
      if (unitPrice === null) {
        warnings.push(`No price was provided or remembered for "${productName || 'item'}".`);
      }

      const transactionDate = validExpenseDate(item.transaction_date) ? item.transaction_date : null;
      if (!transactionDate) warnings.push(`Choose a date for "${productName}"; no valid date was extracted.`);
      return {
        transaction_date: transactionDate,
        product_name: product?.canonical_name || productName,
        input_name: inputName,
        product_id: product?.id || null,
        product_match: productMatch,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        unit_price: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : null,
        price_source: priceSource,
        category_id: category?.id || null,
        category_name: category?.name || '',
        confidence
      };
    }).filter((item) => item.product_name),
    warnings: [...new Set(warnings)]
  };
}

async function activeExpenseCategories() {
  const { rows } = await query(
    `SELECT id, name
     FROM expense_categories
     WHERE is_active = true
     ORDER BY name`
  );
  return rows;
}

export async function parseExpenseText({ text, time_zone } = {}) {
  const input = String(text || '').trim();
  if (!input) throw new HttpError(400, 'text is required');
  let today;
  try { today = referenceDate(time_zone); } catch { throw new HttpError(400, 'Invalid time zone'); }

  const [categories, products] = await Promise.all([
    activeExpenseCategories(),
    listProductMemory()
  ]);
  const parsed = await parseWithFallback(input, categories, products, today);
  return normalizeParsed(parsed, categories, products);
}

function recoverMissingDates(parsed, input, categories, today) {
  if (!Array.isArray(parsed?.items)) return parsed;
  const sharedDate = extractLocalDate(input, today).date;
  const localItems = parseLocal(input, categories, today).items;
  return {
    ...parsed,
    items: parsed.items.map((item) => {
      if (!item || validExpenseDate(item.transaction_date)) return item;
      const names = [item.input_name, item.product_name, item.description]
        .filter(Boolean).map(normalizeProductName);
      const matches = localItems.filter((local) => names.includes(normalizeProductName(local.input_name)));
      const dates = [...new Set(matches.map((local) => local.transaction_date))];
      // Match by wording, never response order: the model can reorder purchases.
      const date = matches.length ? (dates.length === 1 ? dates[0] : null) : sharedDate;
      return { ...item, transaction_date: date || null };
    })
  };
}

export async function parseWithFallback(input, categories, products, today = referenceDate(), aiParser = callGroq) {
  try {
    const parsed = await aiParser(input, categories, products, today);
    return parsed ? recoverMissingDates(parsed, input, categories, today) : parseLocal(input, categories, today);
  } catch (error) {
    const failure = error.aiCode ? error
      : error.name === 'TimeoutError' || error.name === 'AbortError'
        ? aiFailure('timeout', 'Groq did not respond within 25 seconds. Try again.')
        : aiFailure('connection_error', 'The app could not complete its connection to Groq.');
    // Never log expense text, product memory, credentials, or provider response bodies.
    console.warn('[expense-parser]', JSON.stringify({ code: failure.aiCode, status: failure.providerStatus }));
    const parsed = parseLocal(input, categories, today);
    parsed.ai_error = { code: failure.aiCode, message: failure.message };
    parsed.warnings.unshift(`${failure.message} A local draft was used; review it carefully.`);
    return parsed;
  }
}
