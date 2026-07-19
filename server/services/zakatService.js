import { pool, query } from '../db/pool.js';
import { HttpError } from '../utils/http.js';
import { config } from '../config.js';
import { listSavings } from './savingsService.js';
import { createMonth, findMonthByYearMonth } from './monthService.js';

const GOLD_GRAMS = 85;
const SILVER_GRAMS = 595;
const HAUL_DAYS = 354;
const DAY_MS = 24 * 60 * 60 * 1000;
const TROY_OUNCE_GRAMS = 31.1034768;
const INITIAL_GOLD_ANCHOR_DATE = '2026-07-01';
const INITIAL_SILVER_ANCHOR_DATE = '2025-10-01';
const LOCAL_TIME_ZONE = 'Africa/Casablanca';
const GOLDAPI_SOURCE = 'goldapi';
let schedulerStarted = false;

function dateOnly(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toDay(value) {
  return Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / DAY_MS);
}

function addDays(value, days) {
  return new Date((toDay(value) + days) * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  return Math.max(toDay(end) - toDay(start), 0);
}

function monthEnd(year, month) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function datedNumber(row, field) {
  return row[field] == null ? null : Number(row[field]);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function priceRow(row) {
  return {
    ...row,
    entry_date: dateOnly(row.entry_date),
    gold_price_per_gram: datedNumber(row, 'gold_price_per_gram'),
    silver_price_per_gram: datedNumber(row, 'silver_price_per_gram'),
    fetched_at: row.fetched_at ? new Date(row.fetched_at).toISOString() : null
  };
}

async function ensureSettings() {
  const { rows } = await query(
    `INSERT INTO zakat_settings (id, gold_anchor_date, silver_anchor_date)
     VALUES (1, DATE '2026-07-01', DATE '2025-10-01')
     ON CONFLICT (id) DO UPDATE
     SET gold_anchor_date = DATE '2026-07-01',
         silver_anchor_date = DATE '2025-10-01',
         updated_at = now()
     RETURNING id`
  );
  return rows;
}

async function getSettings() {
  await ensureSettings();
  return {
    id: 1,
    gold_anchor_date: INITIAL_GOLD_ANCHOR_DATE,
    silver_anchor_date: INITIAL_SILVER_ANCHOR_DATE
  };
}

async function listPrices() {
  const { rows } = await query(
    `SELECT id, entry_date, gold_price_per_gram, silver_price_per_gram, source, fetched_at
     FROM zakat_price_entries
     ORDER BY entry_date DESC, id DESC`
  );
  return rows.map(priceRow);
}

async function listObligations() {
  const { rows } = await query(
    `SELECT id,
            standard,
            due_date,
            cycle_anchor_date,
            savings_basis,
            nisab_amount,
            amount_due,
            paid,
            paid_at,
            expense_transaction_id
     FROM zakat_obligations
     ORDER BY due_date DESC, standard ASC`
  );
  return rows.map((row) => ({
    ...row,
    due_date: dateOnly(row.due_date),
    cycle_anchor_date: dateOnly(row.cycle_anchor_date),
    paid_at: row.paid_at ? dateOnly(row.paid_at) : null,
    savings_basis: Number(row.savings_basis),
    nisab_amount: Number(row.nisab_amount),
    amount_due: Number(row.amount_due)
  }));
}

async function persistGeneratedObligations(obligations) {
  if (!obligations.length) return [];
  const persisted = [];
  for (const obligation of obligations) {
    const { rows } = await query(
      `INSERT INTO zakat_obligations
         (standard, due_date, cycle_anchor_date, savings_basis, nisab_amount, amount_due)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (standard, due_date, cycle_anchor_date) DO UPDATE
       SET savings_basis = zakat_obligations.savings_basis,
           nisab_amount = zakat_obligations.nisab_amount,
           amount_due = zakat_obligations.amount_due,
           updated_at = now()
       RETURNING id,
                 standard,
                 due_date,
                 cycle_anchor_date,
                 savings_basis,
                 nisab_amount,
                 amount_due,
                 paid,
                 paid_at,
                 expense_transaction_id`,
      [
        obligation.standard,
        obligation.due_date,
        obligation.cycle_anchor_date,
        roundMoney(obligation.savings_basis),
        roundMoney(obligation.nisab_amount),
        roundMoney(obligation.amount_due)
      ]
    );
    persisted.push({
      ...rows[0],
      due_date: dateOnly(rows[0].due_date),
      cycle_anchor_date: dateOnly(rows[0].cycle_anchor_date),
      paid_at: rows[0].paid_at ? dateOnly(rows[0].paid_at) : null,
      savings_basis: Number(rows[0].savings_basis),
      nisab_amount: Number(rows[0].nisab_amount),
      amount_due: Number(rows[0].amount_due)
    });
  }
  return persisted;
}

function buildSavingsCheckpoints(savings, today) {
  return savings.map((row) => {
    const endDate = monthEnd(row.year, row.month);
    const date = endDate > today ? today : endDate;
    return {
      date,
      amount: Number(row.running_total || 0)
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

function lastAtOrBefore(items, date, valueKey) {
  let value = null;
  for (const item of items) {
    if (item.date <= date && item[valueKey] != null) value = item[valueKey];
  }
  return value;
}

function valueAtOrFirst(items, date, valueKey) {
  const value = lastAtOrBefore(items, date, valueKey);
  if (value != null) return value;
  const first = items.find((item) => item[valueKey] != null);
  return first ? first[valueKey] : null;
}

function eventEntry({ standard, date, type, title, savings, nisab, anchorDate, dueDate, amountDue, paid }) {
  return {
    standard,
    date,
    type,
    title,
    savings: savings == null ? null : Number(savings),
    nisab: nisab == null ? null : Number(nisab),
    anchor_date: anchorDate || null,
    due_date: dueDate || null,
    amount_due: amountDue == null ? null : Number(amountDue),
    paid: Boolean(paid)
  };
}

function calculateStandard({ standard, grams, priceKey, anchorDate, prices, savingsCheckpoints, obligations, today }) {
  const currentSavings = valueAtOrFirst(savingsCheckpoints, today, 'amount') || 0;
  const standardObligations = obligations.filter((obligation) => obligation.standard === standard);
  const localObligations = [...standardObligations];
  const generatedObligations = [];
  const priceTimeline = prices
    .filter((price) => price[priceKey] != null)
    .map((price) => ({ date: price.entry_date, price: Number(price[priceKey]) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const currentPrice = valueAtOrFirst(priceTimeline, today, 'price');
  const events = [
    eventEntry({
      standard,
      date: anchorDate,
      type: 'initial_anchor',
      title: 'Initial anchor',
      savings: currentSavings,
      nisab: null,
      anchorDate
    })
  ];

  const effectiveSavingsAt = (date) => {
    const actualSavings = valueAtOrFirst(savingsCheckpoints, date, 'amount') || 0;
    const unpaidDue = localObligations
      .filter((obligation) => !obligation.paid && obligation.due_date <= date)
      .reduce((total, obligation) => total + Number(obligation.amount_due || 0), 0);
    return actualSavings - unpaidDue;
  };

  const savingsBeforeDueAt = (date) => {
    const actualSavings = valueAtOrFirst(savingsCheckpoints, date, 'amount') || 0;
    const unpaidBefore = localObligations
      .filter((obligation) => !obligation.paid && obligation.due_date < date)
      .reduce((total, obligation) => total + Number(obligation.amount_due || 0), 0);
    return actualSavings - unpaidBefore;
  };

  const obligationFor = (dueDate, cycleAnchorDate) => localObligations.find((obligation) =>
    obligation.due_date === dueDate && obligation.cycle_anchor_date === cycleAnchorDate
  );

  if (currentPrice == null) {
    const elapsed = anchorDate <= today ? daysBetween(anchorDate, today) : 0;
    events.push(eventEntry({
      standard,
      date: today,
      type: 'missing_price',
      title: 'Waiting for nisab price',
      savings: currentSavings,
      nisab: null,
      anchorDate
    }));
    return {
      standard,
      grams,
      anchor_date: anchorDate,
      active_anchor_date: anchorDate,
      due_date: addDays(anchorDate, HAUL_DAYS),
      status: 'missing_price',
      current_price_per_gram: null,
      current_nisab: null,
      current_savings: currentSavings,
      days_elapsed: elapsed,
      days_remaining: Math.max(HAUL_DAYS - elapsed, 0),
      zakat_due_amount: 0,
      events,
      generated_obligations: generatedObligations
    };
  }

  const currentNisab = currentPrice * grams;

  if (anchorDate > today) {
    return {
      standard,
      grams,
      anchor_date: anchorDate,
      active_anchor_date: anchorDate,
      due_date: addDays(anchorDate, HAUL_DAYS),
      status: 'not_started',
      current_price_per_gram: currentPrice,
      current_nisab: currentNisab,
      current_savings: currentSavings,
      days_elapsed: 0,
      days_remaining: HAUL_DAYS,
      zakat_due_amount: 0,
      events,
      generated_obligations: generatedObligations
    };
  }

  const eventDates = new Set([anchorDate, today]);
  for (const price of priceTimeline) {
    if (price.date >= anchorDate && price.date <= today) eventDates.add(price.date);
  }
  for (const checkpoint of savingsCheckpoints) {
    if (checkpoint.date >= anchorDate && checkpoint.date <= today) eventDates.add(checkpoint.date);
  }

  let activeAnchorDate = null;
  let latestNisab = null;

  function processDueCyclesUntil(boundDate) {
    while (activeAnchorDate) {
      const dueDate = addDays(activeAnchorDate, HAUL_DAYS);
      if (dueDate > boundDate) return;

      const duePrice = valueAtOrFirst(priceTimeline, dueDate, 'price');
      if (duePrice == null) return;

      const dueNisab = duePrice * grams;
      const savingsBasis = Math.max(savingsBeforeDueAt(dueDate), 0);
      let obligation = obligationFor(dueDate, activeAnchorDate);
      if (!obligation) {
        obligation = {
          standard,
          due_date: dueDate,
          cycle_anchor_date: activeAnchorDate,
          savings_basis: roundMoney(savingsBasis),
          nisab_amount: roundMoney(dueNisab),
          amount_due: roundMoney(savingsBasis * 0.025),
          paid: false,
          paid_at: null,
          expense_transaction_id: null
        };
        localObligations.push(obligation);
        generatedObligations.push(obligation);
      }

      events.push(eventEntry({
        standard,
        date: dueDate,
        type: obligation.paid ? 'zakat_paid' : 'zakat_due',
        title: obligation.paid ? 'Zakat paid' : 'Zakat became due',
        savings: savingsBasis,
        nisab: dueNisab,
        anchorDate: activeAnchorDate,
        dueDate,
        amountDue: obligation.amount_due,
        paid: obligation.paid
      }));

      activeAnchorDate = null;
      const basisAfterDue = effectiveSavingsAt(dueDate);
      if (basisAfterDue >= dueNisab) {
        activeAnchorDate = dueDate;
        events.push(eventEntry({
          standard,
          date: dueDate,
          type: 'nisab_reached',
          title: 'New cycle started',
          savings: basisAfterDue,
          nisab: dueNisab,
          anchorDate: activeAnchorDate,
          dueDate: addDays(activeAnchorDate, HAUL_DAYS)
        }));
      } else {
        events.push(eventEntry({
          standard,
          date: dueDate,
          type: 'anchor_reset',
          title: 'Counter paused after zakat deduction',
          savings: basisAfterDue,
          nisab: dueNisab,
          anchorDate: dueDate
        }));
      }
    }
  }

  for (const eventDate of Array.from(eventDates).sort()) {
    processDueCyclesUntil(eventDate);
    const price = valueAtOrFirst(priceTimeline, eventDate, 'price');
    if (price == null) {
      activeAnchorDate = null;
      continue;
    }

    latestNisab = price * grams;
    const savings = effectiveSavingsAt(eventDate);

    if (savings >= latestNisab) {
      if (!activeAnchorDate) {
        activeAnchorDate = eventDate;
        events.push(eventEntry({
          standard,
          date: eventDate,
          type: 'nisab_reached',
          title: eventDate === anchorDate ? 'Counter started' : 'Nisab reached again',
          savings,
          nisab: latestNisab,
          anchorDate: activeAnchorDate,
          dueDate: addDays(activeAnchorDate, HAUL_DAYS)
        }));
      }
    } else {
      if (activeAnchorDate) {
        events.push(eventEntry({
          standard,
          date: eventDate,
          type: 'anchor_reset',
          title: 'Anchor reset',
          savings,
          nisab: latestNisab,
          anchorDate: activeAnchorDate
        }));
      }
      activeAnchorDate = null;
    }
  }

  processDueCyclesUntil(today);

  if (!activeAnchorDate) {
    return {
      standard,
      grams,
      anchor_date: anchorDate,
      active_anchor_date: null,
      due_date: null,
      status: 'below_nisab',
      current_price_per_gram: currentPrice,
      current_nisab: latestNisab || currentNisab,
      current_savings: currentSavings,
      days_elapsed: 0,
      days_remaining: HAUL_DAYS,
      zakat_due_amount: localObligations
        .filter((obligation) => !obligation.paid && obligation.due_date <= today)
        .reduce((total, obligation) => total + Number(obligation.amount_due || 0), 0),
      events,
      generated_obligations: generatedObligations
    };
  }

  const elapsed = daysBetween(activeAnchorDate, today);
  const dueDate = addDays(activeAnchorDate, HAUL_DAYS);
  const unpaidDue = localObligations
    .filter((obligation) => !obligation.paid && obligation.due_date <= today)
    .reduce((total, obligation) => total + Number(obligation.amount_due || 0), 0);

  return {
    standard,
    grams,
    anchor_date: anchorDate,
    active_anchor_date: activeAnchorDate,
    due_date: dueDate,
    status: unpaidDue > 0 ? 'due' : 'tracking',
    current_price_per_gram: currentPrice,
    current_nisab: currentNisab,
    current_savings: effectiveSavingsAt(today),
    days_elapsed: elapsed,
    days_remaining: Math.max(HAUL_DAYS - elapsed, 0),
    zakat_due_amount: unpaidDue,
    events,
    generated_obligations: generatedObligations
  };
}

export async function getZakatSummary() {
  const [settings, prices, savings, obligations] = await Promise.all([
    getSettings(),
    listPrices(),
    listSavings(),
    listObligations()
  ]);
  const today = localDateISO();
  const savingsCheckpoints = buildSavingsCheckpoints(savings, today);
  const gold = calculateStandard({
    standard: 'gold',
    grams: GOLD_GRAMS,
    priceKey: 'gold_price_per_gram',
    anchorDate: settings.gold_anchor_date,
    prices,
    savingsCheckpoints,
    obligations,
    today
  });
  const silver = calculateStandard({
    standard: 'silver',
    grams: SILVER_GRAMS,
    priceKey: 'silver_price_per_gram',
    anchorDate: settings.silver_anchor_date,
    prices,
    savingsCheckpoints,
    obligations,
    today
  });
  const persisted = await persistGeneratedObligations([
    ...gold.generated_obligations,
    ...silver.generated_obligations
  ]);
  const allObligations = [...obligations, ...persisted];
  const dueNow = Math.max(
    0,
    ...allObligations
      .filter((obligation) => !obligation.paid && obligation.due_date <= today)
      .map((obligation) => Number(obligation.amount_due || 0))
  );
  const publicCalculation = (calculation) => {
    const { generated_obligations: generatedObligations, ...publicFields } = calculation;
    return publicFields;
  };

  return {
    today,
    haul_days: HAUL_DAYS,
    price_refresh: {
      source: GOLDAPI_SOURCE,
      configured: Boolean(config.goldApiKey),
      automatic: true
    },
    settings,
    prices,
    obligations: allObligations,
    due_now: dueNow,
    has_unpaid_zakat: dueNow > 0,
    calculations: {
      gold: publicCalculation(gold),
      silver: publicCalculation(silver)
    }
  };
}

export async function markZakatPaid() {
  const today = localDateISO();
  await getZakatSummary();
  const obligations = await listObligations();
  const dueObligations = obligations.filter((obligation) => !obligation.paid && obligation.due_date <= today);
  if (!dueObligations.length) {
    throw new HttpError(400, 'No due zakat to mark as paid');
  }

  const amount = Math.max(...dueObligations.map((obligation) => Number(obligation.amount_due || 0)));
  const [year, month] = today.split('-').map(Number);
  const monthRow = await findMonthByYearMonth(year, month) || await createMonth({ year, month, copyFromPrevious: false });
  const { rows: categoryRows } = await query(
    `SELECT id
     FROM expense_categories
     WHERE name = 'divers'
     LIMIT 1`
  );
  if (!categoryRows[0]) {
    throw new HttpError(500, 'divers expense category is missing');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const expense = await client.query(
      `INSERT INTO expense_transactions
         (month_id, transaction_date, description, quantity, unit_price, price, category_id)
       VALUES ($1, $2, 'zakat', 1, $3, $3, $4)
       RETURNING id, month_id, transaction_date AS date, description, quantity, unit_price, price, category_id`,
      [monthRow.id, today, roundMoney(amount), categoryRows[0].id]
    );
    const obligationIds = dueObligations.map((obligation) => obligation.id);
    await client.query(
      `UPDATE zakat_obligations
       SET paid = TRUE,
           paid_at = $1,
           expense_transaction_id = $2,
           updated_at = now()
       WHERE id = ANY($3::int[])`,
      [today, expense.rows[0].id, obligationIds]
    );
    await client.query('COMMIT');
    return {
      paid_at: today,
      amount: roundMoney(amount),
      expense_transaction: {
        ...expense.rows[0],
        quantity: Number(expense.rows[0].quantity),
        unit_price: Number(expense.rows[0].unit_price),
        price: Number(expense.rows[0].price)
      },
      obligations: obligationIds
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

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

function msUntilNextMidnight() {
  const now = new Date();
  let probe = new Date(now.getTime() + 1000);
  const today = localDateISO(now);
  for (let minutes = 1; minutes <= 36 * 60; minutes += 1) {
    probe = new Date(now.getTime() + minutes * 60 * 1000);
    if (localDateISO(probe) !== today) {
      return Math.max(probe.getTime() - now.getTime(), 1000);
    }
  }
  return DAY_MS;
}

async function hasGoldApiPriceForDate(entryDate) {
  const { rows } = await query(
    `SELECT id
     FROM zakat_price_entries
     WHERE entry_date = $1
       AND source = $2
       AND gold_price_per_gram IS NOT NULL
       AND silver_price_per_gram IS NOT NULL
     LIMIT 1`,
    [entryDate, GOLDAPI_SOURCE]
  );
  return Boolean(rows[0]);
}

function pricePerGram(payload, metal) {
  const gramPrice = Number(payload.price_gram_24k || payload.price_gram || payload.price_gram_999);
  if (Number.isFinite(gramPrice) && gramPrice > 0) return gramPrice;

  const ouncePrice = Number(payload.price);
  if (Number.isFinite(ouncePrice) && ouncePrice > 0) return ouncePrice / TROY_OUNCE_GRAMS;
  throw new HttpError(502, `${metal} price response did not include a usable price`);
}

async function fetchGoldApiMetal(symbol) {
  if (!config.goldApiKey) {
    throw new HttpError(503, 'GOLDAPI_KEY is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${config.goldApiBaseUrl}/${symbol}/MAD`, {
      headers: {
        'x-access-token': config.goldApiKey,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new HttpError(response.status, body.error || body.message || `GoldAPI ${symbol} request failed`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

export async function refreshZakatPrices({ force = false } = {}) {
  const entryDate = localDateISO();
  if (!force && await hasGoldApiPriceForDate(entryDate)) {
    return { skipped: true, reason: 'already_fetched_today', entry_date: entryDate };
  }

  const [gold, silver] = await Promise.all([
    fetchGoldApiMetal('XAU'),
    fetchGoldApiMetal('XAG')
  ]);

  const goldPrice = Number(pricePerGram(gold, 'gold').toFixed(2));
  const silverPrice = Number(pricePerGram(silver, 'silver').toFixed(2));

  const { rows } = await query(
    `INSERT INTO zakat_price_entries (entry_date, gold_price_per_gram, silver_price_per_gram, source, fetched_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (entry_date) DO UPDATE
     SET gold_price_per_gram = EXCLUDED.gold_price_per_gram,
         silver_price_per_gram = EXCLUDED.silver_price_per_gram,
         source = EXCLUDED.source,
         fetched_at = EXCLUDED.fetched_at,
         updated_at = now()
     RETURNING id, entry_date, gold_price_per_gram, silver_price_per_gram, source, fetched_at`,
    [entryDate, goldPrice, silverPrice, GOLDAPI_SOURCE]
  );
  return { skipped: false, entry: priceRow(rows[0]) };
}

export function startZakatPriceScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const run = async () => {
    try {
      const result = await refreshZakatPrices();
      console.log(result.skipped
        ? `Zakat prices skipped: ${result.reason}`
        : `Zakat prices refreshed for ${result.entry.entry_date}`);
    } catch (error) {
      console.warn(`Zakat price refresh failed: ${error.message}`);
    }
  };

  run();

  const scheduleNext = () => {
    setTimeout(async () => {
      await run();
      scheduleNext();
    }, msUntilNextMidnight());
  };
  scheduleNext();
}
