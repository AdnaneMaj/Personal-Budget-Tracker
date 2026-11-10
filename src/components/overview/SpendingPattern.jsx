import { useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  ComposedChart,
  Area,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays } from "lucide-react";
import { axisTick } from "../../lib/charts.js";
import { money, monthLabel } from "../../lib/format.js";
import OverviewTooltip, {
  ViewSwitch,
  shortAmount,
  barRadius,
  chartMargin,
} from "./OverviewTooltip.jsx";

const views = [
  { value: "cumulative", label: "Running total" },
  { value: "daily", label: "Daily" },
  { value: "calendar", label: "Calendar" },
  { value: "history", label: "Savings" },
];
const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];

export default function SpendingPattern({ model: m, month, currency }) {
  const [view, setView] = useState("cumulative");
  const [selectedDay, setSelectedDay] = useState(null);
  const selected = m.daily.find((row) => row.day === selectedDay);
  const maximum = Math.max(1, ...m.daily.map((row) => row.amount));
  const offset = (new Date(month.year, month.month - 1, 1).getDay() + 6) % 7;
  const history = m.history.map((row) => ({
    ...row,
    label: `${new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(row.year, row.month - 1, 1))}${row.year !== month.year ? ` ’${String(row.year).slice(-2)}` : ""}`,
  }));
  return (
    <section
      className="overview-chart-card overview-pattern"
      aria-label="Spending pattern"
    >
      <div className="overview-card-heading">
        <div>
          <h3>
            {view === "history"
              ? "Cash saved by month"
              : view === "calendar"
                ? "Spending calendar"
                : view === "daily"
                  ? "Daily spending"
                  : "Spending vs budget"}
          </h3>
          <p>
            {view === "history"
              ? "Recorded income minus real out"
              : "Calculated spending throughout the month"}
          </p>
        </div>
      </div>
      <ViewSwitch
        label="Spending chart view"
        options={views}
        value={view}
        onChange={setView}
      />
      {view === "calendar" ? (
        <div className="overview-calendar">
          <div className="overview-calendar-weekdays" aria-hidden="true">
            {weekdayLabels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
          <div
            className="overview-calendar-grid"
            role="group"
            aria-label={`Daily calculated expenses for ${monthLabel(month)}`}
          >
            {Array.from({ length: offset }, (_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {m.daily.map((row) => (
              <button
                type="button"
                key={row.day}
                data-level={
                  row.amount > 0
                    ? Math.max(1, Math.ceil((row.amount / maximum) * 4))
                    : 0
                }
                aria-pressed={selectedDay === row.day}
                aria-label={`${row.date}: ${money(row.amount, currency)} calculated${row.future ? ", future date" : ""}`}
                className={row.future ? "is-future" : ""}
                onClick={() =>
                  setSelectedDay(selectedDay === row.day ? null : row.day)
                }
              >
                <span>{row.day}</span>
                <small>{row.amount > 0 ? shortAmount(row.amount) : "—"}</small>
              </button>
            ))}
          </div>
          <p className="overview-calendar-detail">
            {selected ? (
              <>
                <CalendarDays size={14} />
                <span>
                  {selected.date} ·{" "}
                  <strong>{money(selected.amount, currency)}</strong>
                  {selected.categories.length
                    ? ` · ${selected.categories
                        .map((c) => c.category_name)
                        .slice(0, 3)
                        .join(", ")}`
                    : selected.amount === 0
                      ? " · No expenses recorded"
                      : ""}
                </span>
              </>
            ) : (
              "Choose a day to see its recorded expenses. Darker cells mean more spending."
            )}
          </p>
        </div>
      ) : (
        <div className="overview-chart-canvas">
          <ResponsiveContainer width="100%" height={320}>
            {view === "daily" ? (
              <BarChart accessibilityLayer data={m.daily} margin={chartMargin}>
                <CartesianGrid
                  stroke="var(--border)"
                  vertical={false}
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={axisTick}
                  minTickGap={16}
                  tickMargin={10}
                />
                <YAxis
                  tickFormatter={shortAmount}
                  axisLine={false}
                  tickLine={false}
                  tick={axisTick}
                  width={52}
                />
                <Tooltip
                  content={<OverviewTooltip kind="daily" currency={currency} />}
                  cursor={{ fill: "var(--surface-subtle)" }}
                />
                {m.dailyAverage > 0 && (
                  <ReferenceLine
                    y={m.dailyAverage}
                    stroke="var(--text-muted)"
                    strokeDasharray="3 4"
                  />
                )}
                <Bar
                  dataKey="recorded"
                  name="Calculated expenses"
                  radius={barRadius}
                  maxBarSize={18}
                  isAnimationActive={false}
                >
                  {m.daily.map((row) => (
                    <Cell
                      key={row.day}
                      fill={row.future ? "var(--neutral-4)" : "var(--accent)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            ) : view === "cumulative" ? (
              <ComposedChart
                accessibilityLayer
                data={m.daily}
                margin={chartMargin}
              >
                <CartesianGrid
                  stroke="var(--border)"
                  vertical={false}
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={axisTick}
                  minTickGap={16}
                  tickMargin={10}
                />
                <YAxis
                  tickFormatter={shortAmount}
                  axisLine={false}
                  tickLine={false}
                  tick={axisTick}
                  width={52}
                />
                <Tooltip
                  content={
                    <OverviewTooltip kind="cumulative" currency={currency} />
                  }
                />
                <Line
                  dataKey="target"
                  name="Even budget pace"
                  stroke="var(--text-muted)"
                  strokeDasharray="3 5"
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
                <Area
                  type="linear"
                  dataKey="actual"
                  name="Recorded spending"
                  stroke="var(--accent)"
                  fill="var(--accent)"
                  fillOpacity={0.08}
                  strokeWidth={2.5}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="forecast"
                  name="Estimate"
                  stroke="var(--accent)"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            ) : (
              <BarChart accessibilityLayer data={history} margin={chartMargin}>
                <CartesianGrid
                  stroke="var(--border)"
                  vertical={false}
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={axisTick}
                  tickMargin={10}
                />
                <YAxis
                  tickFormatter={shortAmount}
                  axisLine={false}
                  tickLine={false}
                  tick={axisTick}
                  width={52}
                />
                <ReferenceLine y={0} stroke="var(--border-strong)" />
                <Tooltip
                  content={
                    <OverviewTooltip kind="history" currency={currency} />
                  }
                  cursor={{ fill: "var(--surface-subtle)" }}
                />
                <Bar
                  dataKey="balance"
                  name="Cash saved / deficit"
                  radius={barRadius}
                  maxBarSize={40}
                  isAnimationActive={false}
                >
                  {history.map((row) => (
                    <Cell
                      key={row.month_id || `${row.year}-${row.month}`}
                      fill={
                        row.balance < 0 ? "var(--negative)" : "var(--positive)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      <div className="overview-chart-footer">
        <span className="overview-chart-legend">
          <i />
          {view === "history"
            ? "Income minus real spending"
            : "Calculated spending"}
          {view === "daily" && (
            <>
              <i className="is-average" />
              Daily average
            </>
          )}
          {view === "cumulative" && (
            <>
              <i className="is-average" />
              {m.planned > 0 ? "Budget pace" : "No budget set"}
            </>
          )}
        </span>
        <span>
          {view === "history"
            ? `${history.length} recorded months`
            : `${m.activeDays} days with expenses`}
        </span>
      </div>
      <p className="overview-caption">
        {view === "history"
          ? "Cash savings through the selected month. Negative bars mean spending exceeded recorded income."
          : view === "cumulative" && m.forecast !== null
            ? "The dashed estimate extends the recorded pace and holds monthly spread shares constant."
            : "Calculated amounts include monthly spread shares, rather than full purchase payments."}
      </p>
    </section>
  );
}
