import useLoad from "../hooks/useLoad.js";
import { api } from "../lib/api.js";
import {
  Panel,
  PageSkeleton,
  EmptyState,
  StatCard,
} from "../components/ui.jsx";
import { TrendingDown, TrendingUp } from "lucide-react";
import { money, dateOnly, monthLabel } from "../lib/format.js";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { axisTick, axisAmount, pieMargin, chartColor } from "../lib/charts.js";
import DailyExpenseTooltip from "../components/charts/DailyExpenseTooltip.jsx";
import CategoryBudgetTooltip from "../components/charts/CategoryBudgetTooltip.jsx";

export default function OverviewPage({ month, currency }) {
  const state = useLoad(
    () => (month ? api(`/dashboard/${month.id}`) : Promise.resolve(null)),
    [month?.id],
  );

  if (!month)
    return (
      <EmptyState title="Make room for a new month">
        Choose a month to see your ledger.
      </EmptyState>
    );
  if (state.loading) return <PageSkeleton label="Loading overview..." />;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;
  if (!state.data) return <PageSkeleton label="Loading overview..." />;

  const data = state.data;
  const expensePct =
    data.totals.planned_expenses > 0
      ? (data.totals.actual_expenses / data.totals.planned_expenses) * 100
      : 0;
  const remainingBudget =
    data.totals.planned_expenses - data.totals.actual_expenses;
  const today = new Date();
  const daysInMonth = new Date(month.year, month.month, 0).getDate();
  const isCurrentMonth =
    month.year === today.getFullYear() && month.month === today.getMonth() + 1;
  const elapsedDays = isCurrentMonth ? today.getDate() : daysInMonth;
  const monthElapsedPct = (elapsedDays / daysInMonth) * 100;
  const daysLeftIncludingToday = Math.max(daysInMonth - elapsedDays + 1, 1);
  const safePerDay = Math.max(remainingBudget, 0) / daysLeftIncludingToday;
  const projectedSpend =
    elapsedDays > 0
      ? (data.totals.actual_expenses / elapsedDays) * daysInMonth
      : 0;
  const projectedDelta = data.totals.planned_expenses - projectedSpend;
  const TrendIcon = projectedDelta >= 0 ? TrendingDown : TrendingUp;
  const paceStatus = expensePct <= monthElapsedPct ? "positive" : "negative";
  const spentDisplay = money(data.totals.actual_expenses, currency).replace(
    ` ${currency}`,
    "",
  );
  const realSpending = Number(data.totals.cash_expenses || 0);
  const progressPct = Math.min(Math.max(expensePct, 0), 100);
  const paceMarkerPct = Math.min(Math.max(monthElapsedPct, 0), 100);
  const dailyRunRate =
    elapsedDays > 0 ? data.totals.actual_expenses / elapsedDays : 0;
  const expenseChartCeiling = Math.max(
    Number(data.totals.planned_expenses),
    Number(data.totals.actual_expenses),
  );
  const categoryTotal = data.spendingByCategory.reduce(
    (total, row) => total + Number(row.planned_amount || 0),
    0,
  );
  const spreadExpenses = data.activeSpreadExpenses || [];
  const spreadMonthlyTotal = spreadExpenses.reduce(
    (total, row) => total + Number(row.monthly_amount || 0),
    0,
  );
  const categorySegments = data.spendingByCategory.flatMap((row) => {
    const planned = Number(row.planned_amount || 0);
    const actual = Number(row.actual_amount || 0);
    const consumed = Math.min(actual, planned);
    const remaining = Math.max(planned - consumed, 0);
    const labelSegment = consumed >= remaining ? "consumed" : "remaining";
    const segments = [];
    if (consumed > 0) {
      segments.push({
        ...row,
        segment: "consumed",
        value: consumed,
        showLabel: labelSegment === "consumed",
      });
    }
    if (remaining > 0) {
      segments.push({
        ...row,
        segment: "remaining",
        value: remaining,
        showLabel: labelSegment === "remaining",
      });
    }
    return segments;
  });
  const trend = data.trend.map((row) => {
    const isForecast = isCurrentMonth && row.day > elapsedDays;
    return {
      ...row,
      label: String(row.day),
      actual_expenses: isForecast ? null : row.expenses,
      forecast_expenses:
        isCurrentMonth && row.day >= elapsedDays
          ? data.totals.actual_expenses + (row.day - elapsedDays) * dailyRunRate
          : null,
      isForecast,
    };
  });

  return (
    <div className="grid overview-grid">
      <div className="page-intro">
        <span className="eyebrow">{monthLabel(month)}</span>
        <h2>Your month, at a glance.</h2>
        <p>A clear view of what’s going out, and what’s left for you.</p>
      </div>
      <section className={`panel hero budget-hero ${paceStatus}`}>
        <div className="budget-hero-top">
          <div>
            <span className="hero-label">Budget used</span>
            <strong className="hero-number num">
              {spentDisplay}
              <span> / {money(data.totals.planned_expenses, currency)}</span>
            </strong>
            <p className="budget-pace">
              Real month spending: {money(realSpending, currency)}
            </p>
          </div>
          <StatCard
            className="safe-spend"
            label="Safe to spend today"
            value={
              <>
                {money(safePerDay, currency)}
                <small>/day</small>
              </>
            }
            hint="to stay within your budget"
          />
        </div>
        <div className="hero-compare">
          <p className="budget-pace">
            {Math.round(expensePct)}% of budget &middot; day {elapsedDays} of{" "}
            {daysInMonth} ({Math.round(monthElapsedPct)}% of month gone)
          </p>
          <div
            className="pace-track"
            role="img"
            aria-label="Budget usage compared with month progress"
          >
            <span className="pace-fill" style={{ width: `${progressPct}%` }} />
            <i className="pace-marker" style={{ left: `${paceMarkerPct}%` }} />
          </div>
          <div className="budget-hero-footer">
            <TrendIcon size={18} />
            <span>
              Projected month-end spending: {money(projectedSpend, currency)}.
              Expected to finish {money(Math.abs(projectedDelta), currency)}{" "}
              {projectedDelta >= 0 ? "under" : "over"} budget.
            </span>
          </div>
        </div>
      </section>

      <section className="panel chart-panel">
        <div className="section-head">
          <div>
            <h2>Spending over time</h2>
            <p className="section-description">
              Your running total through the month
            </p>
          </div>
          <span className="chart-key">
            <i />
            Spending
          </span>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart accessibilityLayer data={trend}>
            <CartesianGrid
              stroke="var(--border)"
              vertical={false}
              strokeDasharray="3 5"
            />
            <XAxis
              axisLine={false}
              tickLine={false}
              tickMargin={12}
              minTickGap={24}
              dataKey="label"
              stroke="var(--text-muted)"
              tick={axisTick}
            />
            <YAxis
              stroke="var(--text-muted)"
              tick={axisTick}
              tickFormatter={axisAmount}
              domain={[0, expenseChartCeiling]}
              allowDataOverflow
            />
            <Tooltip content={<DailyExpenseTooltip currency={currency} />} />
            <Line
              type="monotone"
              dataKey="actual_expenses"
              stroke="var(--accent)"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="forecast_expenses"
              stroke="var(--accent)"
              strokeWidth={2.5}
              strokeDasharray="6 5"
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="panel chart-panel">
        <div className="section-head">
          <h2>Budget by category</h2>
          {categoryTotal > 0 && (
            <span className="num">{money(categoryTotal, currency)}</span>
          )}
        </div>
        {categoryTotal === 0 ? (
          <EmptyState
            title="Give every category a little direction"
            actionLabel="Set your budget"
            onAction={() =>
              document.querySelector('[data-nav="budget"]')?.click()
            }
          >
            Add planned amounts to see how your budget fits together.
          </EmptyState>
        ) : (
          <div className="category-breakdown">
            <div className="category-pie">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart margin={pieMargin}>
                  <Pie
                    data={categorySegments}
                    dataKey="value"
                    nameKey="category_name"
                    innerRadius={42}
                    outerRadius={76}
                    paddingAngle={0}
                    stroke="none"
                    strokeWidth={0}
                    labelLine={false}
                  >
                    {categorySegments.map((entry, index) => (
                      <Cell
                        aria-label={`${entry.category_name}: ${entry.segment}, ${money(entry.value, currency)}`}
                        key={`${entry.category_name}-${entry.segment}-${index}`}
                        fill={chartColor(entry.category_name)}
                        opacity={entry.segment === "consumed" ? 1 : 0.22}
                        stroke="none"
                        strokeWidth={0}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CategoryBudgetTooltip currency={currency} />}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="category-legend">
              {data.spendingByCategory
                .filter((row) => Number(row.planned_amount) > 0)
                .map((row) => (
                  <li key={row.category_name}>
                    <span>
                      <i
                        style={{ background: chartColor(row.category_name) }}
                      />
                      {row.category_name}
                    </span>
                    <strong className="num">
                      {money(row.planned_amount, currency)}
                    </strong>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>

      <div className="overview-lists">
        <section className="compact-list">
          <div className="section-head">
            <h2>Over budget</h2>
          </div>
          <div className="stack-list">
            {data.overBudget.length === 0 && (
              <p className="empty-state">Nothing over budget this month.</p>
            )}
            {data.overBudget.map((row) => (
              <div key={row.category_name} className="stack-row danger">
                <span>{row.category_name}</span>
                <strong className="num">
                  {money(row.over_amount, currency)}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section className="compact-list">
          <div className="section-head">
            <h2>Spread expenses</h2>
            {spreadMonthlyTotal > 0 && (
              <span className="num">
                {money(spreadMonthlyTotal, currency)}/mo
              </span>
            )}
          </div>
          <div className="stack-list">
            {spreadExpenses.length === 0 && (
              <p className="empty-state">
                No active spread expenses this month.
              </p>
            )}
            {spreadExpenses.map((row) => (
              <div key={row.id} className="stack-row">
                <span>
                  {row.description}
                  <br />
                  <small>
                    {dateOnly(row.date)} · {row.category_name} ·{" "}
                    {money(row.price, currency)} total · month{" "}
                    {row.spread_month_number} of {row.spread_months} ·{" "}
                    {row.months_remaining} left
                  </small>
                </span>
                <strong className="num">
                  {money(row.monthly_amount, currency)}/mo
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section className="compact-list">
          <div className="section-head">
            <h2>Vs. last month</h2>
          </div>
          <div className="stack-list">
            {data.mom.length === 0 && (
              <p className="empty-state">Not enough history yet.</p>
            )}
            {data.mom.map((row) => (
              <div key={row.category_name} className="stack-row">
                <span>{row.category_name}</span>
                <strong
                  className={`num ${row.percent_change > 0 ? "flag-up" : "flag-down"}`}
                >
                  {row.percent_change > 0 ? "+" : ""}
                  {row.percent_change.toFixed(1)}%
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
