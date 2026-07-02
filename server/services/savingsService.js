import { query } from '../db/pool.js';

export async function listSavings() {
  const { rows } = await query(
    `WITH monthly_savings AS (
       SELECT m.id AS month_id,
              m.year,
              m.month,
              COALESCE(income.amount, 0) AS income_actual,
              COALESCE(expenses.amount, 0) AS expense_actual,
              COALESCE(income.amount, 0) - COALESCE(expenses.amount, 0) AS amount_saved
       FROM months m
       LEFT JOIN (
         SELECT month_id, SUM(amount) AS amount
         FROM income_entries
         GROUP BY month_id
       ) income ON income.month_id = m.id
       LEFT JOIN (
         SELECT month_id, SUM(price) AS amount
         FROM expense_transactions
         GROUP BY month_id
       ) expenses ON expenses.month_id = m.id
     )
     SELECT month_id,
            year,
            month,
            income_actual,
            expense_actual,
            amount_saved,
            SUM(amount_saved) OVER (ORDER BY year, month) AS running_total
     FROM monthly_savings
     ORDER BY year, month`
  );
  return rows.map((row) => ({
    ...row,
    income_actual: Number(row.income_actual),
    expense_actual: Number(row.expense_actual),
    amount_saved: Number(row.amount_saved),
    running_total: Number(row.running_total)
  }));
}
