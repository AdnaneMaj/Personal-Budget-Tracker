// Read-only presentation analytics for the existing dashboard response.
const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const ordinal = ({ year, month }) => number(year) * 12 + number(month);
export const clamp = (value, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

export function buildOverview(data, month, today = new Date()) {
  const planned = number(data.totals?.planned_expenses);
  const calculated = number(data.totals?.actual_expenses);
  const cash = number(data.totals?.cash_expenses);
  const income = number(data.totals?.actual_income);
  const daysInMonth = new Date(month.year, month.month, 0).getDate();
  const currentOrdinal = today.getFullYear() * 12 + today.getMonth() + 1;
  const period =
    ordinal(month) === currentOrdinal
      ? "current"
      : ordinal(month) < currentOrdinal
        ? "past"
        : "future";
  const elapsedDays =
    period === "past"
      ? daysInMonth
      : period === "current"
        ? Math.min(today.getDate(), daysInMonth)
        : 0;
  const daysLeft = period === "current" ? daysInMonth - elapsedDays + 1 : 0;

  const spreads = (data.activeSpreadExpenses || [])
    .map((row) => ({
      ...row,
      price: number(row.price),
      monthly_amount: number(row.monthly_amount),
      months_remaining: Math.max(0, number(row.months_remaining)),
      spread_months: number(row.spread_months),
      spread_month_number: number(row.spread_month_number),
    }))
    .sort((a, b) => b.monthly_amount - a.monthly_amount);
  const spreadMonthly = spreads.reduce(
    (sum, row) => sum + row.monthly_amount,
    0,
  );
  const ordinary = Math.max(0, calculated - spreadMonthly);
  const spreadPayments = Math.max(0, cash - ordinary);
  const nextMonthSpread = spreads
    .filter((row) => row.months_remaining > 0)
    .reduce((sum, row) => sum + row.monthly_amount, 0);
  const budgetLeft = planned - calculated;
  const budgetPct = planned > 0 ? (calculated / planned) * 100 : null;

  const sourceDays = new Map(
    (data.trend || []).map((row) => [number(row.day), row]),
  );
  let lastCumulative = 0;
  const daily = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const source = sourceDays.get(day) || {};
    const amount = number(source.daily_expenses);
    const cumulative =
      source.expenses === undefined
        ? lastCumulative + amount
        : number(source.expenses);
    lastCumulative = cumulative;
    const future =
      period === "future" || (period === "current" && day > elapsedDays);
    return {
      day,
      date: `${month.year}-${String(month.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      amount,
      income: number(source.income),
      cumulative,
      categories: source.expense_categories || [],
      future,
      recorded: future && amount === 0 ? null : amount,
      actual: future && amount === 0 ? null : cumulative,
      target: planned > 0 ? (planned / daysInMonth) * day : null,
    };
  });
  const futureEntries = daily.some((row) => row.future && row.amount > 0);
  // Fixed monthly shares are held constant rather than multiplied by the daily pace.
  const forecast =
    period === "current" && elapsedDays > 0 && !futureEntries
      ? spreadMonthly + (ordinary / elapsedDays) * daysInMonth
      : null;
  for (const row of daily) {
    row.forecast =
      forecast !== null && row.day >= elapsedDays
        ? calculated + (ordinary / elapsedDays) * (row.day - elapsedDays)
        : null;
  }

  const categories = (data.spendingByCategory || []).map((row) => ({
    name: row.category_name,
    actual: number(row.actual_amount),
    planned: number(row.planned_amount),
  }));
  const categorizedTotal = categories.reduce((sum, row) => sum + row.actual, 0);
  if (calculated - categorizedTotal > 0.01)
    categories.push({
      name: "Other recorded expenses",
      actual: calculated - categorizedTotal,
      planned: 0,
    });
  categories.forEach((row) => {
    row.share = calculated > 0 ? (row.actual / calculated) * 100 : 0;
    row.remaining = row.planned - row.actual;
    row.usage = row.planned > 0 ? (row.actual / row.planned) * 100 : null;
  });
  categories.sort(
    (a, b) => b.actual - a.actual || a.name.localeCompare(b.name),
  );
  const spendingCategories = categories.filter((row) => row.actual > 0);
  const overBudget = categories
    .filter((row) => row.actual > row.planned)
    .sort((a, b) => a.remaining - b.remaining);

  const history = (data.savings || [])
    .filter((row) => ordinal(row) <= ordinal(month))
    .map((row) => ({
      ...row,
      balance: number(row.amount_saved),
      running_total: number(row.running_total),
    }))
    .sort((a, b) => ordinal(a) - ordinal(b));
  const previousMonth =
    history.filter((row) => ordinal(row) < ordinal(month)).at(-1) || null;
  const comparisons = previousMonth
    ? (data.mom || [])
        .map((row) => {
          const current = number(row.current_amount),
            previous = number(row.previous_amount);
          return {
            name: row.category_name,
            current,
            previous,
            delta: current - previous,
            percent:
              previous > 0 ? ((current - previous) / previous) * 100 : null,
          };
        })
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    : [];
  const previousTotal = comparisons.length
    ? comparisons.reduce((sum, row) => sum + row.previous, 0)
    : null;
  const comparisonDelta =
    previousTotal !== null ? calculated - previousTotal : null;
  const activeDays = daily.filter((row) => !row.future && row.amount > 0);
  const biggestDay =
    daily
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)[0] || null;

  return {
    planned,
    calculated,
    cash,
    income,
    cashBalance: income - cash,
    savingsRate: income > 0 ? ((income - cash) / income) * 100 : null,
    daysInMonth,
    elapsedDays,
    daysLeft,
    period,
    futureEntries,
    budgetLeft,
    budgetPct,
    monthProgress: (elapsedDays / daysInMonth) * 100,
    safePerDay:
      planned > 0 && daysLeft > 0 ? Math.max(0, budgetLeft) / daysLeft : null,
    forecast,
    ordinary,
    spreadPayments,
    spreadMonthly,
    nextMonthSpread,
    spreads,
    daily,
    categories,
    spendingCategories,
    overBudget,
    history: history.slice(-12),
    previousMonth,
    previousTotal,
    comparisonDelta,
    comparisons,
    activeDays: activeDays.length,
    biggestDay,
    topCategory: spendingCategories[0] || null,
    dailyAverage: elapsedDays > 0 ? calculated / elapsedDays : null,
  };
}
