CREATE TABLE IF NOT EXISTS months (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS income_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_lines (
  id SERIAL PRIMARY KEY,
  month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL,
  category_type TEXT NOT NULL CHECK (category_type IN ('expense', 'income')),
  planned_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (planned_amount >= 0),
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (month_id, category_id, category_type)
);

CREATE TABLE IF NOT EXISTS expense_transactions (
  id SERIAL PRIMARY KEY,
  month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) CHECK (unit_price >= 0),
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  budget_treatment TEXT NOT NULL DEFAULT 'normal' CHECK (budget_treatment IN ('normal', 'spread')),
  spread_months INTEGER CHECK (spread_months IS NULL OR spread_months > 0),
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (budget_treatment = 'normal' AND spread_months IS NULL)
    OR
    (budget_treatment = 'spread' AND spread_months IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS income_entries (
  id SERIAL PRIMARY KEY,
  month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  source_name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  category_id INTEGER NOT NULL REFERENCES income_categories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS receivables (
  id SERIAL PRIMARY KEY,
  month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'not_yet' CHECK (status IN ('not_yet', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zakat_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gold_anchor_date DATE NOT NULL DEFAULT DATE '2026-07-01',
  silver_anchor_date DATE NOT NULL DEFAULT DATE '2025-10-01',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zakat_price_entries (
  id SERIAL PRIMARY KEY,
  entry_date DATE NOT NULL UNIQUE,
  gold_price_per_gram NUMERIC(12, 2) CHECK (gold_price_per_gram >= 0),
  silver_price_per_gram NUMERIC(12, 2) CHECK (silver_price_per_gram >= 0),
  source TEXT NOT NULL DEFAULT 'manual',
  fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (gold_price_per_gram IS NOT NULL OR silver_price_per_gram IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS zakat_obligations (
  id SERIAL PRIMARY KEY,
  standard TEXT NOT NULL CHECK (standard IN ('gold', 'silver')),
  due_date DATE NOT NULL,
  cycle_anchor_date DATE NOT NULL,
  savings_basis NUMERIC(12, 2) NOT NULL CHECK (savings_basis >= 0),
  nisab_amount NUMERIC(12, 2) NOT NULL CHECK (nisab_amount >= 0),
  amount_due NUMERIC(12, 2) NOT NULL CHECK (amount_due >= 0),
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at DATE,
  expense_transaction_id INTEGER REFERENCES expense_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (standard, due_date, cycle_anchor_date)
);

CREATE INDEX IF NOT EXISTS idx_budget_lines_month ON budget_lines(month_id);
CREATE INDEX IF NOT EXISTS idx_expense_transactions_month_category ON expense_transactions(month_id, category_id);
CREATE INDEX IF NOT EXISTS idx_income_entries_month_category ON income_entries(month_id, category_id);
CREATE INDEX IF NOT EXISTS idx_receivables_month_status ON receivables(month_id, status);
CREATE INDEX IF NOT EXISTS idx_zakat_price_entries_date ON zakat_price_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_zakat_obligations_paid_due ON zakat_obligations(paid, due_date);

ALTER TABLE expense_transactions
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0);

ALTER TABLE expense_transactions
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2) CHECK (unit_price >= 0);

ALTER TABLE expense_transactions
  ADD COLUMN IF NOT EXISTS budget_treatment TEXT NOT NULL DEFAULT 'normal';

ALTER TABLE expense_transactions
  ADD COLUMN IF NOT EXISTS spread_months INTEGER;

ALTER TABLE expense_transactions
  DROP CONSTRAINT IF EXISTS expense_transactions_budget_treatment_check;

ALTER TABLE expense_transactions
  ADD CONSTRAINT expense_transactions_budget_treatment_check
  CHECK (budget_treatment IN ('normal', 'spread'));

ALTER TABLE expense_transactions
  DROP CONSTRAINT IF EXISTS expense_transactions_spread_months_check;

ALTER TABLE expense_transactions
  ADD CONSTRAINT expense_transactions_spread_months_check
  CHECK (spread_months IS NULL OR spread_months > 0);

UPDATE expense_transactions
SET spread_months = NULL
WHERE budget_treatment = 'normal';

ALTER TABLE expense_transactions
  DROP CONSTRAINT IF EXISTS expense_transactions_budget_treatment_spread_check;

ALTER TABLE expense_transactions
  ADD CONSTRAINT expense_transactions_budget_treatment_spread_check
  CHECK (
    (budget_treatment = 'normal' AND spread_months IS NULL)
    OR
    (budget_treatment = 'spread' AND spread_months IS NOT NULL)
  );

ALTER TABLE zakat_price_entries
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE zakat_price_entries
  ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;

UPDATE expense_transactions
SET unit_price = ROUND(price / quantity, 2)
WHERE unit_price IS NULL AND quantity > 0;

INSERT INTO expense_categories (name, icon, color)
VALUES
  ('food', 'utensils', '#D94F30'),
  ('clothes', 'shirt', '#7D5BA6'),
  ('rent', 'home', '#3B82A0'),
  ('wifi', 'wifi', '#2F855A'),
  ('transport', 'bus', '#D69E2E'),
  ('health', 'heart-pulse', '#C53030'),
  ('family', 'users', '#805AD5'),
  ('entertainment', 'film', '#319795'),
  ('car', 'car', '#4A5568'),
  ('divers', 'more-horizontal', '#718096')
ON CONFLICT (name) DO NOTHING;

INSERT INTO income_categories (name, icon, color)
VALUES
  ('paycheck', 'briefcase', '#2F855A'),
  ('bonus', 'sparkles', '#B7791F'),
  ('other', 'wallet', '#3182CE')
ON CONFLICT (name) DO NOTHING;

INSERT INTO zakat_settings (id, gold_anchor_date, silver_anchor_date)
VALUES (1, DATE '2026-07-01', DATE '2025-10-01')
ON CONFLICT (id) DO NOTHING;

UPDATE zakat_settings
SET gold_anchor_date = DATE '2026-07-01',
    silver_anchor_date = DATE '2025-10-01',
    updated_at = now()
WHERE id = 1;
