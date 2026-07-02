# Personal Budget Tracker — Build Spec

## 1. Overview
Build a monthly personal budget tracker showing where money goes. Each calendar month
is a self-contained record with a planned budget (expenses + income), a running actual
(computed from logged transactions), a savings tracker, and a dashboard.

Currency: MAD. Store as a config constant, not hardcoded per screen.

## 2. Core Concept: Planned vs Actual
- **Planned** = manually-set number per category per month. Fixed until edited.
- **Actual** = derived, never editable directly. It is the SUM of all transactions
  logged against that category for that month. Recompute automatically whenever a
  transaction is added, edited, or deleted.

Do not store Actual as a static field. Either compute on read (SQL aggregate) or
store denormalized and recalculate on every transaction write. For v1, compute-on-read
is simpler and avoids drift bugs — use that.

## 3. Data Model

### Month
- id, year, month (unique together)
- status: open / closed (optional — supports locking past months)

### ExpenseCategory (seed list, editable)
food, clothes, rent, wifi, transport, health, family, entertainment, car, divers
- id, name, icon/color (optional), is_active

### IncomeCategory (seed list, editable)
paycheck, bonus, other

### BudgetLine (one row per month × category)
- month_id, category_id, category_type (expense/income), planned_amount
- actual_amount → computed, not stored (see §2)

### Transaction (expenses)
- id, month_id, date, product/description, price, category_id

### IncomeEntry
- id, month_id, date, source_name, amount, category_id

### SavingsRecord
- id, month_id, amount_saved, running_total (computed = prior total + this month's amount)
- amount_saved is a manual entry, prefilled with a suggested value of
  (income actual − expense actual), overridable — do not make it fully automatic,
  since real months have exceptions (gifts, transfers, etc.)

## 4. Pages

### 4.1 Budget Overview (per month)
- Expense table: category | planned | actual | remaining (planned − actual) | % used
- Income table: category | planned | actual | difference
- Visual indicator when actual > planned (e.g. red row / progress bar over 100%)
- Editable planned values inline
- Category management: support add/deactivate without breaking historical data
  (soft-delete via is_active; never hard-delete a category with existing transactions)

### 4.2 Transactions (per month)
- Expenses table: date | product | price | category — sortable, filterable by category,
  add/edit/delete row (edit/delete must trigger actual recompute)
- Income table: date | source name | amount | category — same behavior
- Quick-add form pinned at top (date defaults to today, category dropdown)

### 4.3 Savings
- One row per month: month | amount saved | running total
- Line/bar chart of running total over time

### 4.4 Dashboard
- Total planned vs total actual (expenses) for current month
- Spending by category (pie or bar)
- Income vs expenses trend over last 6–12 months (line chart)
- Savings growth over time (line chart)
- Top 3 over-budget categories this month
- Month-over-month comparison (% change per category vs previous month)

## 5. Cross-cutting behaviors to implement
- **Month switching**: a month selector (dropdown or prev/next arrows) persists
  across all pages.
- **New month creation**: when a new month starts, offer to copy last month's planned
  values as a starting template (editable), instead of starting from zero.
- **Recurring items**: support a "recurring" flag on planned budget lines (e.g. rent,
  wifi) that auto-carries the planned value forward each month. Actual still computed
  fresh from transactions regardless.
- **Data integrity**: deleting/editing a transaction must recompute the affected
  category's actual immediately, not on next page load.

## 6. Stack
- Backend: Node.js + Express, layered as routes → controllers → services → db queries
- DB: PostgreSQL
- Frontend: React
- Charts: Recharts or Chart.js for the dashboard

## 7. Build order
1. DB schema + migrations (Month, Categories, BudgetLine, Transaction, IncomeEntry, SavingsRecord)
2. Backend CRUD API for categories, budget lines, transactions, income, savings
3. Actual-amount aggregation endpoint (per category, per month)
4. Budget Overview page (planned vs actual tables)
5. Transactions page (full CRUD tables)
6. Savings page
7. Dashboard (charts, last — depends on all prior data existing)