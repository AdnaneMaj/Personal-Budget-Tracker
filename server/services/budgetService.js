import { pool, query } from '../db/pool.js';
import { HttpError } from '../utils/http.js';
import { lineMetrics } from '../utils/money.js';
import { ensureBudgetLines } from './monthService.js';
import { budgetImpactCte } from './expenseBudgetImpact.js';

async function ensureLinesForMonth(monthId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureBudgetLines(client, monthId);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getExpenseLines(monthId) {
  const { rows } = await query(
    `${budgetImpactCte}
     SELECT bl.id,
            bl.month_id,
            bl.category_id,
            bl.category_type,
            bl.planned_amount,
            bl.is_recurring,
            c.name AS category_name,
            c.icon,
            c.color,
            c.is_active,
            COALESCE(actuals.actual_amount, 0) AS actual_amount
     FROM budget_lines bl
     JOIN expense_categories c ON c.id = bl.category_id
     LEFT JOIN (
       SELECT category_id, SUM(amount) AS actual_amount
       FROM budget_impacts
       GROUP BY category_id
     ) actuals ON actuals.category_id = bl.category_id
     WHERE bl.month_id = $1 AND bl.category_type = 'expense'
     ORDER BY c.is_active DESC, c.name ASC`,
    [monthId]
  );
  return rows.map(lineMetrics);
}

export async function getBudget(monthId) {
  await ensureLinesForMonth(monthId);
  return { expenses: await getExpenseLines(monthId) };
}

export async function updateBudgetLine(id, payload) {
  const planned = payload.planned_amount === undefined ? null : Number(payload.planned_amount);
  if (planned !== null && (!Number.isFinite(planned) || planned < 0)) {
    throw new HttpError(400, 'planned_amount must be a non-negative number');
  }

  const { rows } = await query(
    `UPDATE budget_lines
     SET planned_amount = COALESCE($1, planned_amount),
         is_recurring = COALESCE($2, is_recurring),
         updated_at = now()
     WHERE id = $3
     RETURNING id, month_id, category_id, category_type, planned_amount, is_recurring`,
    [
      planned,
      typeof payload.is_recurring === 'boolean' ? payload.is_recurring : null,
      id
    ]
  );
  if (!rows[0]) throw new HttpError(404, 'budget line not found');
  return rows[0];
}
