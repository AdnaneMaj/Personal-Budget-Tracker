import { query } from '../db/pool.js';
import { HttpError } from '../utils/http.js';

const expenseSort = {
  date: 't.transaction_date',
  description: 't.description',
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
            t.price,
            t.category_id,
            c.name AS category_name
     FROM expense_transactions t
     JOIN expense_categories c ON c.id = t.category_id
     ${where}
     ORDER BY ${orderColumn} ${sortDirection(sortDir)}, t.id DESC`,
    params
  );
  return rows.map((row) => ({ ...row, price: Number(row.price) }));
}

export async function createExpenseTransaction(payload) {
  if (!payload.month_id || !payload.transaction_date || !payload.description || !payload.category_id) {
    throw new HttpError(400, 'month_id, transaction_date, description, category_id, and price are required');
  }
  const price = amountValue(payload.price, 'price');
  const { rows } = await query(
    `INSERT INTO expense_transactions (month_id, transaction_date, description, price, category_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, month_id, transaction_date AS date, description, price, category_id`,
    [payload.month_id, payload.transaction_date, String(payload.description).trim(), price, payload.category_id]
  );
  return { ...rows[0], price: Number(rows[0].price) };
}

export async function updateExpenseTransaction(id, payload) {
  const price = payload.price === undefined ? null : amountValue(payload.price, 'price');
  const { rows } = await query(
    `UPDATE expense_transactions
     SET transaction_date = COALESCE($1, transaction_date),
         description = COALESCE($2, description),
         price = COALESCE($3, price),
         category_id = COALESCE($4, category_id),
         updated_at = now()
     WHERE id = $5
     RETURNING id, month_id, transaction_date AS date, description, price, category_id`,
    [
      payload.transaction_date || null,
      payload.description ? String(payload.description).trim() : null,
      price,
      payload.category_id || null,
      id
    ]
  );
  if (!rows[0]) throw new HttpError(404, 'expense transaction not found');
  return { ...rows[0], price: Number(rows[0].price) };
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
