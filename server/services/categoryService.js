import { pool, query } from '../db/pool.js';
import { HttpError } from '../utils/http.js';
import { ensureBudgetLines } from './monthService.js';

const tables = {
  expense: 'expense_categories',
  income: 'income_categories'
};

function tableFor(type) {
  const table = tables[type];
  if (!table) throw new HttpError(400, 'category type must be expense or income');
  return table;
}

export async function listCategories(type) {
  const table = tableFor(type);
  const { rows } = await query(
    `SELECT id, name, icon, color, is_active
     FROM ${table}
     ORDER BY is_active DESC, name ASC`
  );
  return rows;
}

export async function createCategory(type, payload) {
  const table = tableFor(type);
  const name = String(payload.name || '').trim().toLowerCase();
  if (!name) throw new HttpError(400, 'name is required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO ${table} (name, icon, color, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id, name, icon, color, is_active`,
      [name, payload.icon || null, payload.color || null]
    );

    const months = await client.query('SELECT id FROM months');
    for (const month of months.rows) {
      await ensureBudgetLines(client, month.id);
    }

    await client.query('COMMIT');
    return inserted.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCategory(type, id, payload) {
  const table = tableFor(type);
  const { rows } = await query(
    `UPDATE ${table}
     SET name = COALESCE($1, name),
         icon = COALESCE($2, icon),
         color = COALESCE($3, color),
         is_active = COALESCE($4, is_active)
     WHERE id = $5
     RETURNING id, name, icon, color, is_active`,
    [
      payload.name ? String(payload.name).trim().toLowerCase() : null,
      payload.icon ?? null,
      payload.color ?? null,
      typeof payload.is_active === 'boolean' ? payload.is_active : null,
      id
    ]
  );
  if (!rows[0]) throw new HttpError(404, 'category not found');
  return rows[0];
}

export async function deactivateCategory(type, id) {
  const table = tableFor(type);
  const transactionTable = type === 'expense' ? 'expense_transactions' : 'income_entries';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const category = await client.query(
      `SELECT id, name, icon, color, is_active
       FROM ${table}
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );
    if (!category.rows[0]) throw new HttpError(404, 'category not found');

    const usage = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM ${transactionTable}
       WHERE category_id = $1`,
      [id]
    );
    const budgetUsage = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM budget_lines
       WHERE category_id = $1
         AND category_type = $2
         AND (planned_amount > 0 OR is_recurring = TRUE)`,
      [id, type]
    );

    if (usage.rows[0].count === 0 && budgetUsage.rows[0].count === 0) {
      await client.query(
        `DELETE FROM budget_lines
         WHERE category_id = $1
           AND category_type = $2`,
        [id, type]
      );
      const deleted = await client.query(
        `DELETE FROM ${table}
         WHERE id = $1
         RETURNING id, name, icon, color, is_active`,
        [id]
      );
      await client.query('COMMIT');
      return { ...deleted.rows[0], deleted: true };
    }

    const deactivated = await client.query(
      `UPDATE ${table}
       SET is_active = FALSE
       WHERE id = $1
       RETURNING id, name, icon, color, is_active`,
      [id]
    );
    await client.query('COMMIT');
    return { ...deactivated.rows[0], deleted: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
