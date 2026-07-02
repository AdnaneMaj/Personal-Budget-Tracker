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

  await client.query(
    `INSERT INTO budget_lines (month_id, category_id, category_type, planned_amount)
     SELECT $1, id, 'income', 0
     FROM income_categories
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

export async function getOrCreateCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return createMonth({ year, month, copyFromPrevious: true });
}
