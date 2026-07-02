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
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

CREATE INDEX IF NOT EXISTS idx_budget_lines_month ON budget_lines(month_id);
CREATE INDEX IF NOT EXISTS idx_expense_transactions_month_category ON expense_transactions(month_id, category_id);
CREATE INDEX IF NOT EXISTS idx_income_entries_month_category ON income_entries(month_id, category_id);

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
