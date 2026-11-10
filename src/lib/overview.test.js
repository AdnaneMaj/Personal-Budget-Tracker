import test from "node:test";
import assert from "node:assert/strict";
import { buildOverview } from "./overview.js";

const month = { year: 2026, month: 11 };
const today = new Date(2026, 10, 10, 12);
const sample = {
  totals: {
    planned_expenses: 2000,
    actual_expenses: 1300,
    cash_expenses: 2200,
    actual_income: 3000,
  },
  activeSpreadExpenses: [
    { id: 1, monthly_amount: 200, months_remaining: 2 },
    { id: 2, monthly_amount: 100, months_remaining: 0 },
  ],
  spendingByCategory: [
    { category_name: "Food", actual_amount: 900, planned_amount: 800 },
    { category_name: "Rent", actual_amount: 400, planned_amount: 1200 },
  ],
  trend: [
    { day: 1, daily_expenses: 300, expenses: 300 },
    { day: 10, daily_expenses: 1000, expenses: 1300 },
  ],
  savings: [
    { year: 2026, month: 10, amount_saved: 500, running_total: 500 },
    { year: 2026, month: 11, amount_saved: 800, running_total: 1300 },
    { year: 2026, month: 12, amount_saved: 9999 },
  ],
  mom: [
    { category_name: "Food", current_amount: 900, previous_amount: 600 },
    { category_name: "Rent", current_amount: 400, previous_amount: 500 },
  ],
};

test("cash and calculated spending reconcile through monthly shares", () => {
  const m = buildOverview(sample, month, today);
  assert.equal(m.ordinary + m.spreadPayments, m.cash);
  assert.equal(m.ordinary + m.spreadMonthly, m.calculated);
  assert.equal(m.cashBalance, 800);
  assert.equal(m.nextMonthSpread, 200);
  assert.equal(m.budgetLeft, 700);
  assert.equal(m.safePerDay, 700 / 21);
});
test("forecast holds monthly shares constant and anchors to the recorded total", () => {
  const m = buildOverview(sample, month, today);
  assert.equal(m.forecast, 3300);
  assert.equal(m.daily[9].forecast, 1300);
  assert.equal(m.daily[29].forecast, m.forecast);
  assert.equal(m.daily[10].actual, null);
  assert.equal(m.daily[4].actual, 300);
  assert.equal(m.biggestDay.day, 10);
});
test("categories use actual spending, retain unbudgeted costs, and reconcile", () => {
  const m = buildOverview(
    { ...sample, spendingByCategory: sample.spendingByCategory.slice(0, 1) },
    month,
    today,
  );
  assert.equal(
    m.spendingCategories.reduce((sum, r) => sum + r.actual, 0),
    1300,
  );
  assert.equal(m.topCategory.name, "Food");
  assert.equal(m.categories[1].planned, 0);
  assert.equal(m.categories[1].usage, null);
});
test("history stops at the selected month and compares actual previous recorded periods", () => {
  const m = buildOverview(sample, month, today);
  assert.equal(m.history.length, 2);
  assert.equal(m.previousMonth.month, 10);
  assert.equal(m.previousTotal, 1100);
  assert.equal(m.comparisonDelta, 200);
  const first = buildOverview(
    { ...sample, savings: sample.savings.slice(1) },
    month,
    today,
  );
  assert.equal(first.previousMonth, null);
  assert.deepEqual(first.comparisons, []);
});
test("missing budgets, income, or history never produce misleading percentages", () => {
  const m = buildOverview({}, month, today);
  for (const field of [
    "budgetPct",
    "savingsRate",
    "safePerDay",
    "previousTotal",
  ])
    assert.equal(m[field], null);
  assert.equal(m.calculated, 0);
  assert.deepEqual(m.spendingCategories, []);
  assert.equal(m.biggestDay, null);
});
test("past and future months do not show current-month projections", () => {
  assert.equal(
    buildOverview(sample, month, new Date(2026, 11, 1)).forecast,
    null,
  );
  const future = buildOverview(sample, month, new Date(2026, 9, 1));
  assert.equal(future.elapsedDays, 0);
  assert.equal(future.safePerDay, null);
  assert.equal(future.forecast, null);
});
test("future-dated expenses are kept visible and disable extrapolation", () => {
  const m = buildOverview(
    {
      ...sample,
      trend: [...sample.trend, { day: 20, daily_expenses: 40, expenses: 1340 }],
    },
    month,
    today,
  );
  assert.equal(m.daily[19].actual, 1340);
  assert.equal(m.daily[19].recorded, 40);
  assert.equal(m.futureEntries, true);
  assert.equal(m.forecast, null);
});
test("input data is not mutated and leap-year calendars are complete", () => {
  const before = JSON.stringify(sample);
  buildOverview(sample, month, today);
  assert.equal(JSON.stringify(sample), before);
  assert.equal(
    buildOverview({}, { year: 2024, month: 2 }, today).daily.length,
    29,
  );
});
