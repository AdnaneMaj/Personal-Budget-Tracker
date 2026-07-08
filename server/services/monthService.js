import { pool, query } from '../db/pool.js';
import { HttpError } from '../utils/http.js';

function monthOrdinal(year, month) {
  return year * 12 + month;
}

export async function ensureBudgetLines(client, monthId) {
  await client.query(
    `INSERT INTO budget_lines (month_id, category_id, category_type, planned_amount)
     SELECT $1, id, 'expense', 0
     FROM expense_categories
     WHERE is_active = TRUE
     ON CONFLICT (month_id, category_id, category_type) DO NOTHING`,
    [monthId]
  );

}

export async function listMonths() {
  const { rows } = await query(
    `SELECT id, year, month, status
     FROM months
     ORDER BY year DESC, month DESC`
  );
  return rows;
}

export async function listMonthSummaries() {
  const { rows } = await query(
    `SELECT m.id,
            m.year,
            m.month,
            m.status,
            COALESCE(income.amount, 0) AS income_actual,
            COALESCE(expenses.amount, 0) AS expense_actual,
            COALESCE(income.amount, 0) - COALESCE(expenses.amount, 0) AS savings,
            COALESCE(expenses.count, 0) AS expense_count,
            COALESCE(income.count, 0) AS income_count
     FROM months m
     LEFT JOIN (
       SELECT month_id, SUM(amount) AS amount, COUNT(*) AS count
       FROM income_entries
       GROUP BY month_id
     ) income ON income.month_id = m.id
     LEFT JOIN (
       SELECT month_id, SUM(price) AS amount, COUNT(*) AS count
       FROM expense_transactions
       GROUP BY month_id
     ) expenses ON expenses.month_id = m.id
     ORDER BY m.year DESC, m.month DESC`
  );
  return rows.map((row) => ({
    ...row,
    income_actual: Number(row.income_actual),
    expense_actual: Number(row.expense_actual),
    savings: Number(row.savings),
    expense_count: Number(row.expense_count),
    income_count: Number(row.income_count)
  }));
}

export async function findMonthByYearMonth(year, month) {
  const { rows } = await query(
    `SELECT id, year, month, status
     FROM months
     WHERE year = $1 AND month = $2`,
    [year, month]
  );
  return rows[0] || null;
}

export async function createMonth({ year, month, status = 'open', copyFromPrevious = false }) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new HttpError(400, 'year must be a valid year');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new HttpError(400, 'month must be between 1 and 12');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inserted = await client.query(
      `INSERT INTO months (year, month, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (year, month) DO UPDATE SET status = months.status
       RETURNING id, year, month, status`,
      [year, month, status]
    );
    const target = inserted.rows[0];

    const previous = await client.query(
      `SELECT id
       FROM months
       WHERE (year * 12 + month) < $1
       ORDER BY year DESC, month DESC
       LIMIT 1`,
      [monthOrdinal(year, month)]
    );

    const previousMonthId = previous.rows[0]?.id;
    if (previousMonthId) {
      await client.query(
	        `INSERT INTO budget_lines (month_id, category_id, category_type, planned_amount, is_recurring)
	         SELECT $1, category_id, category_type, planned_amount, is_recurring
	         FROM budget_lines
	         WHERE month_id = $2
	           AND category_type = 'expense'
	           AND ($3::boolean = TRUE OR is_recurring = TRUE)
	         ON CONFLICT (month_id, category_id, category_type) DO NOTHING`,
        [target.id, previousMonthId, copyFromPrevious]
      );
    }

    await ensureBudgetLines(client, target.id);
    await client.query('COMMIT');
    return target;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteMonth(id) {
  const { rows } = await query(
    `DELETE FROM months
     WHERE id = $1
     RETURNING id, year, month, status`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, 'month not found');
  return rows[0];
}
