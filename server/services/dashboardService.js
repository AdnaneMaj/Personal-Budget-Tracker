import { query } from '../db/pool.js';

function numberFields(row, fields) {
  const copy = { ...row };
  for (const field of fields) copy[field] = Number(copy[field] || 0);
  return copy;
}

export async function getDashboard(monthId) {
  const totals = await query(
    `SELECT COALESCE(SUM(bl.planned_amount), 0) AS planned_expenses,
            COALESCE((SELECT SUM(price) FROM expense_transactions WHERE month_id = $1), 0) AS actual_expenses,
            COALESCE((SELECT SUM(amount) FROM income_entries WHERE month_id = $1), 0) AS actual_income
     FROM budget_lines bl
     WHERE bl.month_id = $1 AND bl.category_type = 'expense'`,
    [monthId]
  );

  const spendingByCategory = await query(
    `SELECT c.name AS category_name,
            c.color,
            COALESCE(SUM(t.price), 0) AS amount
     FROM expense_categories c
     JOIN expense_transactions t ON t.category_id = c.id
     WHERE t.month_id = $1
     GROUP BY c.name, c.color
     ORDER BY amount DESC`,
    [monthId]
  );

  const trend = await query(
    `WITH selected_month AS (
       SELECT year, month
       FROM months
       WHERE id = $1
     ),
     days AS (
       SELECT generate_series(
         make_date((SELECT year FROM selected_month), (SELECT month FROM selected_month), 1),
         CASE
           WHEN (SELECT year FROM selected_month) = EXTRACT(YEAR FROM CURRENT_DATE)::int
            AND (SELECT month FROM selected_month) = EXTRACT(MONTH FROM CURRENT_DATE)::int
           THEN CURRENT_DATE
           ELSE (make_date((SELECT year FROM selected_month), (SELECT month FROM selected_month), 1) + interval '1 month - 1 day')::date
         END,
         interval '1 day'
       )::date AS day
     ),
     expense_days AS (
       SELECT transaction_date AS day, SUM(price) AS amount
       FROM expense_transactions
       WHERE month_id = $1
       GROUP BY transaction_date
     ),
     category_days AS (
       SELECT t.transaction_date AS day,
              json_agg(
                json_build_object(
                  'category_name', c.name,
                  'amount', t.amount
                )
                ORDER BY t.amount DESC
              ) AS categories
       FROM (
         SELECT transaction_date, category_id, SUM(price) AS amount
         FROM expense_transactions
         WHERE month_id = $1
         GROUP BY transaction_date, category_id
       ) t
       JOIN expense_categories c ON c.id = t.category_id
       WHERE t.amount > 0
       GROUP BY t.transaction_date
     ),
     income_days AS (
       SELECT entry_date AS day, SUM(amount) AS amount
       FROM income_entries
       WHERE month_id = $1
       GROUP BY entry_date
     )
     SELECT EXTRACT(DAY FROM days.day)::int AS day,
            days.day AS date,
            COALESCE(expense_days.amount, 0) AS daily_expenses,
            SUM(COALESCE(expense_days.amount, 0)) OVER (ORDER BY days.day) AS expenses,
            COALESCE(category_days.categories, '[]'::json) AS expense_categories,
            COALESCE(income_days.amount, 0) AS income
     FROM days
     LEFT JOIN expense_days ON expense_days.day = days.day
     LEFT JOIN category_days ON category_days.day = days.day
     LEFT JOIN income_days ON income_days.day = days.day
     ORDER BY days.day`,
    [monthId]
  );

  const savings = await query(
    `WITH monthly_savings AS (
       SELECT m.id AS month_id,
              m.year,
              m.month,
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
            amount_saved,
            SUM(amount_saved) OVER (ORDER BY year, month) AS running_total
     FROM monthly_savings
     ORDER BY year, month`
  );

  const overBudget = await query(
    `SELECT c.name AS category_name,
            bl.planned_amount,
            COALESCE(actuals.actual_amount, 0) AS actual_amount,
            COALESCE(actuals.actual_amount, 0) - bl.planned_amount AS over_amount
     FROM budget_lines bl
     JOIN expense_categories c ON c.id = bl.category_id
     LEFT JOIN (
       SELECT category_id, SUM(price) AS actual_amount
       FROM expense_transactions
       WHERE month_id = $1
       GROUP BY category_id
     ) actuals ON actuals.category_id = bl.category_id
     WHERE bl.month_id = $1
       AND bl.category_type = 'expense'
       AND COALESCE(actuals.actual_amount, 0) > bl.planned_amount
     ORDER BY over_amount DESC
     LIMIT 3`,
    [monthId]
  );

  const mom = await query(
    `WITH current_month AS (
       SELECT year, month FROM months WHERE id = $1
     ),
     previous_month AS (
       SELECT id FROM months
       WHERE (year * 12 + month) < (SELECT year * 12 + month FROM current_month)
       ORDER BY year DESC, month DESC
       LIMIT 1
     ),
     current_actuals AS (
       SELECT category_id, SUM(price) AS amount
       FROM expense_transactions
       WHERE month_id = $1
       GROUP BY category_id
     ),
     previous_actuals AS (
       SELECT category_id, SUM(price) AS amount
       FROM expense_transactions
       WHERE month_id = (SELECT id FROM previous_month)
       GROUP BY category_id
     )
     SELECT c.name AS category_name,
            COALESCE(ca.amount, 0) AS current_amount,
            COALESCE(pa.amount, 0) AS previous_amount,
            CASE
              WHEN COALESCE(pa.amount, 0) = 0 AND COALESCE(ca.amount, 0) = 0 THEN 0
              WHEN COALESCE(pa.amount, 0) = 0 THEN 100
              ELSE ((COALESCE(ca.amount, 0) - pa.amount) / pa.amount) * 100
            END AS percent_change
     FROM expense_categories c
     LEFT JOIN current_actuals ca ON ca.category_id = c.id
     LEFT JOIN previous_actuals pa ON pa.category_id = c.id
     WHERE COALESCE(ca.amount, 0) > 0 OR COALESCE(pa.amount, 0) > 0
     ORDER BY ABS(
       CASE
         WHEN COALESCE(pa.amount, 0) = 0 AND COALESCE(ca.amount, 0) = 0 THEN 0
         WHEN COALESCE(pa.amount, 0) = 0 THEN 100
         ELSE ((COALESCE(ca.amount, 0) - pa.amount) / pa.amount) * 100
       END
     ) DESC`,
    [monthId]
  );

  return {
    totals: numberFields(totals.rows[0] || {}, ['planned_expenses', 'actual_expenses', 'actual_income']),
    spendingByCategory: spendingByCategory.rows.map((row) => numberFields(row, ['amount'])),
    trend: trend.rows.map((row) => ({
      ...numberFields(row, ['day', 'daily_expenses', 'expenses', 'income']),
      expense_categories: (row.expense_categories || []).map((category) => ({
        ...category,
        amount: Number(category.amount || 0)
      }))
    })),
    savings: savings.rows.map((row) => numberFields(row, ['amount_saved', 'running_total'])),
    overBudget: overBudget.rows.map((row) => numberFields(row, ['planned_amount', 'actual_amount', 'over_amount'])),
    mom: mom.rows.map((row) => numberFields(row, ['current_amount', 'previous_amount', 'percent_change']))
  };
}
