import { pool, query } from '../db/pool.js';
import { HttpError } from '../utils/http.js';

const expenseSort = {
  date: 't.transaction_date',
  description: 't.description',
  quantity: 't.quantity',
  unit_price: 't.unit_price',
  price: 't.price',
  category: 'c.name'
};

const incomeSort = {
  date: 'i.entry_date',
  source: 'i.source_name',
  amount: 'i.amount',
  category: 'c.name'
};

function sortDirection(value) {
  return String(value).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
}

function amountValue(value, fieldName) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new HttpError(400, `${fieldName} must be a non-negative number`);
  }
  return amount;
}

function quantityValue(value) {
  if (value === undefined || value === null || value === '') return 1;
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new HttpError(400, 'quantity must be greater than zero');
  }
  return quantity;
}

function spreadMonthsValue(value) {
  const months = Number(value);
  if (!Number.isInteger(months) || months <= 0) {
    throw new HttpError(400, 'spread_months must be a positive whole number');
  }
  return months;
}

function budgetTreatmentFields(payload, current = {}) {
  const treatment = payload.budget_treatment ?? current.budget_treatment ?? 'normal';
  if (!['normal', 'spread'].includes(treatment)) {
    throw new HttpError(400, 'budget_treatment must be normal or spread');
  }

  if (treatment === 'normal') {
    return { budgetTreatment: 'normal', spreadMonths: null };
  }

  const sourceMonths = payload.spread_months ?? current.spread_months;
  return {
    budgetTreatment: 'spread',
    spreadMonths: spreadMonthsValue(sourceMonths)
  };
}

function expenseRow(row) {
  return {
    ...row,
    quantity: Number(row.quantity),
    unit_price: row.unit_price === null ? null : Number(row.unit_price),
    price: Number(row.price),
    spread_months: row.spread_months === null ? null : Number(row.spread_months)
  };
}

function expenseFields(payload) {
  if (!payload.month_id || !payload.transaction_date || !payload.description || !payload.category_id) {
    throw new HttpError(400, 'month_id, transaction_date, description, category_id, and price are required');
  }
  const quantity = quantityValue(payload.quantity);
  const hasPrice = payload.price !== undefined && payload.price !== null && payload.price !== '';
  const hasUnitPrice = payload.unit_price !== undefined && payload.unit_price !== null && payload.unit_price !== '';
  const price = hasPrice ? amountValue(payload.price, 'price') : amountValue(Number(payload.unit_price) * quantity, 'price');
  const unitPrice = hasUnitPrice ? amountValue(payload.unit_price, 'unit_price') : (quantity > 0 ? price / quantity : price);
  const { budgetTreatment, spreadMonths } = budgetTreatmentFields(payload);
  return [
    payload.month_id,
    payload.transaction_date,
    String(payload.description).trim(),
    quantity,
    unitPrice,
    price,
    payload.category_id,
    budgetTreatment,
    spreadMonths
  ];
}

const insertExpenseSql = `INSERT INTO expense_transactions
    (month_id, transaction_date, description, quantity, unit_price, price, category_id, budget_treatment, spread_months)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  RETURNING id, month_id, transaction_date AS date, description, quantity, unit_price, price, category_id, budget_treatment, spread_months`;

export async function listExpenseTransactions({ monthId, categoryId, sortBy = 'date', sortDir = 'desc' }) {
  const params = [monthId];
  let where = 'WHERE t.month_id = $1';
  if (categoryId) {
    params.push(categoryId);
    where += ` AND t.category_id = $${params.length}`;
  }
  const orderColumn = expenseSort[sortBy] || expenseSort.date;

  const { rows } = await query(
    `SELECT t.id,
            t.month_id,
            t.transaction_date AS date,
            t.description,
            t.quantity,
            t.unit_price,
            t.price,
            t.category_id,
            t.budget_treatment,
            t.spread_months,
            c.name AS category_name
     FROM expense_transactions t
     JOIN expense_categories c ON c.id = t.category_id
     ${where}
     ORDER BY ${orderColumn} ${sortDirection(sortDir)}, t.id DESC`,
    params
  );
  return rows.map(expenseRow);
}

export async function createExpenseTransaction(payload) {
  const { rows } = await query(
    insertExpenseSql,
    expenseFields(payload)
  );
  return expenseRow(rows[0]);
}

export async function createExpenseTransactions(payloads) {
  if (!Array.isArray(payloads) || payloads.length === 0) {
    throw new HttpError(400, 'transactions must be a non-empty array');
  }
  if (payloads.length > 50) {
    throw new HttpError(400, 'cannot create more than 50 expense transactions at once');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = [];
    for (const payload of payloads) {
      const { rows } = await client.query(insertExpenseSql, expenseFields(payload));
      created.push(expenseRow(rows[0]));
    }
    await client.query('COMMIT');
    return created;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateExpenseTransaction(id, payload) {
  const currentResult = await query(
    `SELECT budget_treatment, spread_months
     FROM expense_transactions
     WHERE id = $1`,
    [id]
  );
  if (!currentResult.rows[0]) throw new HttpError(404, 'expense transaction not found');

  const quantity = payload.quantity === undefined ? null : quantityValue(payload.quantity);
  const unitPrice = payload.unit_price === undefined ? null : amountValue(payload.unit_price, 'unit_price');
  const price = payload.price === undefined ? null : amountValue(payload.price, 'price');
  const { budgetTreatment, spreadMonths } = budgetTreatmentFields(payload, currentResult.rows[0]);
  const { rows } = await query(
    `UPDATE expense_transactions
     SET transaction_date = COALESCE($1, transaction_date),
         description = COALESCE($2, description),
         quantity = COALESCE($3, quantity),
         unit_price = COALESCE($4, unit_price),
         price = COALESCE($5, price),
         category_id = COALESCE($6, category_id),
         budget_treatment = $7,
         spread_months = $8,
         updated_at = now()
     WHERE id = $9
     RETURNING id, month_id, transaction_date AS date, description, quantity, unit_price, price, category_id, budget_treatment, spread_months`,
    [
      payload.transaction_date || null,
      payload.description ? String(payload.description).trim() : null,
      quantity,
      unitPrice,
      price,
      payload.category_id || null,
      budgetTreatment,
      spreadMonths,
      id
    ]
  );
  if (!rows[0]) throw new HttpError(404, 'expense transaction not found');
  return expenseRow(rows[0]);
}

export async function deleteExpenseTransaction(id) {
  const { rows } = await query(
    `DELETE FROM expense_transactions
     WHERE id = $1
     RETURNING id`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, 'expense transaction not found');
  return rows[0];
}

export async function listIncomeEntries({ monthId, categoryId, sortBy = 'date', sortDir = 'desc' }) {
  const params = [monthId];
  let where = 'WHERE i.month_id = $1';
  if (categoryId) {
    params.push(categoryId);
    where += ` AND i.category_id = $${params.length}`;
  }
  const orderColumn = incomeSort[sortBy] || incomeSort.date;

  const { rows } = await query(
    `SELECT i.id,
            i.month_id,
            i.entry_date AS date,
            i.source_name,
            i.amount,
            i.category_id,
            c.name AS category_name
     FROM income_entries i
     JOIN income_categories c ON c.id = i.category_id
     ${where}
     ORDER BY ${orderColumn} ${sortDirection(sortDir)}, i.id DESC`,
    params
  );
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

export async function createIncomeEntry(payload) {
  if (!payload.month_id || !payload.entry_date || !payload.source_name || !payload.category_id) {
    throw new HttpError(400, 'month_id, entry_date, source_name, category_id, and amount are required');
  }
  const amount = amountValue(payload.amount, 'amount');
  const { rows } = await query(
    `INSERT INTO income_entries (month_id, entry_date, source_name, amount, category_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, month_id, entry_date AS date, source_name, amount, category_id`,
    [payload.month_id, payload.entry_date, String(payload.source_name).trim(), amount, payload.category_id]
  );
  return { ...rows[0], amount: Number(rows[0].amount) };
}

export async function updateIncomeEntry(id, payload) {
  const amount = payload.amount === undefined ? null : amountValue(payload.amount, 'amount');
  const { rows } = await query(
    `UPDATE income_entries
     SET entry_date = COALESCE($1, entry_date),
         source_name = COALESCE($2, source_name),
         amount = COALESCE($3, amount),
         category_id = COALESCE($4, category_id),
         updated_at = now()
     WHERE id = $5
     RETURNING id, month_id, entry_date AS date, source_name, amount, category_id`,
    [
      payload.entry_date || null,
      payload.source_name ? String(payload.source_name).trim() : null,
      amount,
      payload.category_id || null,
      id
    ]
  );
  if (!rows[0]) throw new HttpError(404, 'income entry not found');
  return { ...rows[0], amount: Number(rows[0].amount) };
}

export async function deleteIncomeEntry(id) {
  const { rows } = await query(
    `DELETE FROM income_entries
     WHERE id = $1
     RETURNING id`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, 'income entry not found');
  return rows[0];
}
