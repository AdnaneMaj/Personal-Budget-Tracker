export const budgetImpactCte = `WITH selected_month AS (
  SELECT id,
         year,
         month,
         make_date(year, month, 1)::date AS month_start,
         (make_date(year, month, 1) + interval '1 month - 1 day')::date AS month_end,
         (year * 12 + month) AS month_ordinal
  FROM months
  WHERE id = $1
),
budget_impacts AS (
  SELECT t.id,
         t.category_id,
         CASE
           WHEN t.budget_treatment = 'spread' THEN t.price / t.spread_months
           ELSE t.price
         END AS amount,
         CASE
           WHEN t.budget_treatment = 'spread' AND t.transaction_date < sm.month_start THEN sm.month_start
           WHEN t.transaction_date NOT BETWEEN sm.month_start AND sm.month_end THEN sm.month_start
           ELSE t.transaction_date
         END AS impact_date
  FROM expense_transactions t
  CROSS JOIN selected_month sm
  WHERE (
    t.budget_treatment = 'normal'
    AND t.month_id = sm.id
  ) OR (
    t.budget_treatment = 'spread'
    AND (EXTRACT(YEAR FROM t.transaction_date)::int * 12 + EXTRACT(MONTH FROM t.transaction_date)::int) <= sm.month_ordinal
    AND sm.month_ordinal < (
      (EXTRACT(YEAR FROM t.transaction_date)::int * 12 + EXTRACT(MONTH FROM t.transaction_date)::int)
      + t.spread_months
    )
  )
)`;
