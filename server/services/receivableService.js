import { query } from '../db/pool.js';
import { HttpError } from '../utils/http.js';

function amountValue(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new HttpError(400, 'amount must be a non-negative number');
  }
  return amount;
}

function statusValue(value) {
  const status = value || 'not_yet';
  if (!['not_yet', 'paid'].includes(status)) {
    throw new HttpError(400, 'status must be not_yet or paid');
  }
  return status;
}

function receivableRow(row) {
  return { ...row, amount: Number(row.amount) };
}

export async function listReceivables({ monthId }) {
  const { rows } = await query(
    `SELECT id, month_id, person_name, description, amount, status, created_at
     FROM receivables
     WHERE month_id = $1
     ORDER BY CASE status WHEN 'not_yet' THEN 0 ELSE 1 END, created_at DESC, id DESC`,
    [monthId]
  );
  return rows.map(receivableRow);
}

export async function createReceivable(payload) {
  if (!payload.month_id || !payload.person_name) {
    throw new HttpError(400, 'month_id, person_name, and amount are required');
  }

  const { rows } = await query(
    `INSERT INTO receivables (month_id, person_name, description, amount, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, month_id, person_name, description, amount, status, created_at`,
    [
      payload.month_id,
      String(payload.person_name).trim(),
      payload.description ? String(payload.description).trim() : null,
      amountValue(payload.amount),
      statusValue(payload.status)
    ]
  );
  return receivableRow(rows[0]);
}

export async function updateReceivable(id, payload) {
  const amount = payload.amount === undefined ? null : amountValue(payload.amount);
  const status = payload.status === undefined ? null : statusValue(payload.status);

  const { rows } = await query(
    `UPDATE receivables
     SET person_name = COALESCE($1, person_name),
         description = COALESCE($2, description),
         amount = COALESCE($3, amount),
         status = COALESCE($4, status),
         updated_at = now()
     WHERE id = $5
     RETURNING id, month_id, person_name, description, amount, status, created_at`,
    [
      payload.person_name ? String(payload.person_name).trim() : null,
      payload.description === undefined ? null : String(payload.description || '').trim(),
      amount,
      status,
      id
    ]
  );
  if (!rows[0]) throw new HttpError(404, 'receivable not found');
  return receivableRow(rows[0]);
}

export async function deleteReceivable(id) {
  const { rows } = await query(
    `DELETE FROM receivables
     WHERE id = $1
     RETURNING id`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, 'receivable not found');
  return rows[0];
}
