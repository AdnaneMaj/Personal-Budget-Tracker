import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../config.js';
import { callGroq, normalizeParsed, parseLocal, parseWithFallback } from './expenseParserService.js';
import { validExpenseDate } from '../utils/expenseDate.js';

const categories = [{ id: 1, name: 'food' }, { id: 2, name: 'transport' }];
const today = '2026-10-19';
const parse = (text) => normalizeParsed(parseLocal(text, categories, today), categories, []);

test('shared relative date, quantities, unit prices, and totals', () => {
  const { items } = parse('Yesterday I bought 2 milks 4dh each, chicken 40dh, bus 4dh');
  assert.equal(items.length, 3);
  assert.deepEqual(items.map(i => i.transaction_date), Array(3).fill('2026-10-18'));
  assert.deepEqual(items.map(i => [i.quantity, i.unit_price]), [[2, 4], [1, 40], [1, 4]]);
});

test('decimal commas, attached prices, total prices, and currency-free amounts', () => {
  const { items } = parse('5 eggs for 20dh; 2 milks, 7dh each; coffee 12,50dh and taxi 30');
  assert.deepEqual(items.map(i => [i.quantity, i.unit_price]), [[5, 4], [2, 7], [1, 12.5], [1, 30]]);
});

test('explicit dates and distinct dates survive normalization', () => {
  const { items } = parse('2026-10-01 bread 5dh; yesterday taxi 30dh; today milk 7dh');
  assert.deepEqual(items.map(i => i.transaction_date), ['2026-10-01', '2026-10-18', today]);
  assert.equal(parse('bread 5dh on 18/10/2026').items[0].transaction_date, '2026-10-18');
  const dated = parse('On 2026-10-12 I bought 5 eggs for 20dh').items[0];
  assert.equal(dated.product_name, 'Eggs');
  assert.equal(dated.quantity, 5);
  assert.equal(dated.unit_price, 4);
});

test('missing and invalid dates remain empty with a review warning', () => {
  for (const text of ['bread 5dh', '2026-02-30 bread 5dh']) {
    const result = parse(text);
    assert.equal(result.items[0].transaction_date, null);
    assert.ok(result.warnings.some(w => w.includes('Choose a date')));
  }
  assert.equal(validExpenseDate('2026-02-30'), false);
  assert.equal(validExpenseDate('2024-02-29'), true);
});

test('dates without a year and weekdays are extracted per purchase without affecting prices', () => {
  const { items } = parse('On 18/10 bread 5dh. Last Friday taxi 30dh; this Monday milk 7dh; next Monday eggs 20dh');
  assert.deepEqual(items.map(i => i.transaction_date), ['2026-10-18', '2026-10-16', today, '2026-10-26']);
  assert.deepEqual(items.map(i => i.product_name), ['Bread', 'Taxi', 'Milk', 'Eggs']);
  assert.deepEqual(items.map(i => i.unit_price), [5, 30, 7, 20]);
  assert.equal(parse('18/10/2025 bread 5dh').items[0].transaction_date, '2025-10-18');
});

test('invalid or conflicting dates clear inheritance instead of reusing a previous purchase date', () => {
  for (const date of ['31/02/2026', '31/02', '18/10/26', 'today or yesterday']) {
    const { items } = parse(`today bread 5dh; ${date} milk 7dh; eggs 20dh`);
    assert.deepEqual(items.map(i => i.transaction_date), [today, null, null]);
  }
});

test('successful AI responses recover omitted dates per transaction even when items are reordered', async () => {
  const parsed = await parseWithFallback('18/10 bread 5dh; last Friday taxi 30dh; today milk 7dh', categories, [], today, async () => ({
    items: [
      { input_name: 'milk', product_name: 'Milk', transaction_date: null },
      { input_name: 'bread', product_name: 'Bread' },
      { input_name: 'taxi', product_name: 'Taxi', transaction_date: 'invalid' }
    ]
  }));
  const result = normalizeParsed(parsed, categories, []);
  assert.equal(result.provider, 'groq');
  assert.deepEqual(result.items.map(i => i.transaction_date), [today, '2026-10-18', '2026-10-16']);
  assert.ok(!result.warnings.some(w => w.includes('Choose a date')));
});

test('AI date recovery uses a shared date and preserves valid model dates for other formats', async () => {
  const parsed = await parseWithFallback('Yesterday I bought 5 eggs for 20dh and bread 5dh', categories, [], today, async () => ({
    items: [{ product_name: 'Egg' }, { product_name: 'Bread' }]
  }));
  assert.deepEqual(parsed.items.map(i => i.transaction_date), ['2026-10-18', '2026-10-18']);
  const named = await parseWithFallback('October 12 coffee 15dh', categories, [], today, async () => ({
    items: [{ product_name: 'Coffee', transaction_date: '2026-10-12' }]
  }));
  assert.equal(named.items[0].transaction_date, '2026-10-12');
});

test('AI date recovery leaves missing, invalid, and ambiguous purchase dates for review', async () => {
  for (const text of ['bread 5dh', '31/02 bread 5dh', 'today bread 5dh; yesterday bread 7dh']) {
    const parsed = await parseWithFallback(text, categories, [], today, async () => ({ items: [{ product_name: 'Bread' }] }));
    const result = normalizeParsed(parsed, categories, []);
    assert.equal(result.items[0].transaction_date, null);
    assert.ok(result.warnings.some(w => w.includes('Choose a date')));
  }
});

test('AI errors fall back to a reviewable local draft', async () => {
  const parsed = await parseWithFallback('yesterday bus 4dh', categories, [], today, async () => { throw new Error('timeout'); });
  assert.equal(parsed.provider, 'local');
  assert.equal(parsed.items[0].transaction_date, '2026-10-18');
  assert.equal(parsed.ai_error.code, 'connection_error');
  assert.match(parsed.warnings[0], /connection to Groq/);
});

test('AI request includes date context; malformed responses and provider errors fall back', async (t) => {
  const originalKey = config.groqApiKey, originalModel = config.groqModel;
  config.groqApiKey = 'test'; config.groqModel = 'test';
  t.after(() => { config.groqApiKey = originalKey; config.groqModel = originalModel; });
  let content = '```json\n{"items":[{"product_name":"Milk","transaction_date":"2026-10-18"}]}\n```';
  let status = 200;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.ok(body.messages[0].content.includes(today));
    assert.ok(body.messages[0].content.includes('NEVER default to today'));
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
  });
  assert.equal((await callGroq('yesterday milk', categories, [], today)).items[0].transaction_date, '2026-10-18');
  for (const malformed of ['bad JSON', '{"items":[null]}', '{"unexpected":true}']) {
    content = malformed;
    assert.equal((await parseWithFallback('bus 4dh', categories, [], today)).provider, 'local');
  }
  status = 429;
  const limited = await parseWithFallback('bus 4dh', categories, [], today);
  assert.equal(limited.provider, 'local');
  assert.equal(limited.ai_error.code, 'rate_limit');
  assert.match(limited.warnings[0], /rate limit/);
  assert.equal(normalizeParsed(limited, categories, []).ai_error.code, 'rate_limit');
  status = 401;
  assert.equal((await parseWithFallback('bus 4dh', categories, [], today)).ai_error.code, 'authentication');
});

test('timeouts have a specific explanation without exposing internal errors', async () => {
  const result = await parseWithFallback('bus 4dh', categories, [], today, async () => {
    throw new DOMException('private request information', 'TimeoutError');
  });
  assert.equal(result.ai_error.code, 'timeout');
  assert.match(result.warnings[0], /25 seconds/);
  assert.ok(!JSON.stringify(result).includes('private request information'));
});
