import useLoad from "../hooks/useLoad.js";
import { api } from "../lib/api.js";
import { useState, useEffect } from "react";
import {
  Panel,
  Input,
  Select,
  PageSkeleton,
  EmptyState,
} from "../components/ui.jsx";
import { money, monthLabel } from "../lib/format.js";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
} from "recharts";
import { axisTick, tooltipStyle, chartDot } from "../lib/charts.js";
import ZakatSection from "../components/ZakatSection.jsx";

export default function SavingsPage({ currency }) {
  const state = useLoad(() => api("/savings"), []);
  const [expectedMonthlyValue, setExpectedMonthlyValue] = useState(
    () => localStorage.getItem("budget:expectedMonthlySavings") || "",
  );
  const [forecastStartKey, setForecastStartKey] = useState(
    () => localStorage.getItem("budget:forecastStartMonth") || "latest",
  );

  useEffect(() => {
    localStorage.setItem("budget:expectedMonthlySavings", expectedMonthlyValue);
  }, [expectedMonthlyValue]);

  useEffect(() => {
    localStorage.setItem("budget:forecastStartMonth", forecastStartKey);
  }, [forecastStartKey]);

  if (state.loading) return <PageSkeleton label="Loading savings..." />;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;

  const expectedMonthly = Number(expectedMonthlyValue || 0);
  const hasForecast =
    expectedMonthlyValue !== "" && Number.isFinite(expectedMonthly);
  const actualChartData = state.data.map((row) => ({
    ...row,
    label: `${row.month}/${row.year}`,
  }));
  const total = actualChartData.length
    ? actualChartData[actualChartData.length - 1].running_total
    : 0;
  const selectedForecastStartIndex =
    forecastStartKey === "latest"
      ? actualChartData.length - 1
      : actualChartData.findIndex(
          (row) => String(row.month_id) === forecastStartKey,
        );
  const forecastStartIndex =
    selectedForecastStartIndex >= 0
      ? selectedForecastStartIndex
      : actualChartData.length - 1;
  const forecastStart = actualChartData[forecastStartIndex] || {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    running_total: 0,
  };
  const forecastBase = Number(forecastStart.running_total || 0);
  const chartRowsByMonth = new Map();
  for (const row of actualChartData) {
    chartRowsByMonth.set(`${row.year}-${row.month}`, {
      ...row,
      expected_running_total: null,
    });
  }
  if (hasForecast) {
    for (let index = 0; index <= 12; index += 1) {
      const date = new Date(
        forecastStart.year,
        forecastStart.month - 1 + index,
        1,
      );
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;
      const existing = chartRowsByMonth.get(key) || {
        year,
        month,
        label: `${month}/${year}`,
        running_total: null,
      };
      chartRowsByMonth.set(key, {
        ...existing,
        expected_running_total: forecastBase + expectedMonthly * index,
        is_forecast: index > 0,
      });
    }
  }
  const chartData = Array.from(chartRowsByMonth.values()).sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month),
  );

  return (
    <div className="grid">
      <section className="panel hero positive">
        <span className="hero-label">Total saved</span>
        <strong className="hero-number num">{money(total, currency)}</strong>
      </section>

      <section className="panel chart-panel">
        <div className="section-head">
          <h2>Savings growth</h2>
          <label className="forecast-control">
            <span>Expected / month</span>
            <Input
              aria-label="Expected monthly savings"
              type="number"
              step="0.01"
              value={expectedMonthlyValue}
              placeholder="0.00"
              onChange={(event) => setExpectedMonthlyValue(event.target.value)}
            />
          </label>
          <label className="forecast-control">
            <span>Start from</span>
            <Select
              aria-label="Forecast starting month"
              value={forecastStartKey}
              onChange={(event) => setForecastStartKey(event.target.value)}
            >
              <option value="latest">Latest actual</option>
              {actualChartData.map((row) => (
                <option key={row.month_id} value={row.month_id}>
                  {monthLabel(row)}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart accessibilityLayer data={chartData}>
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
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              width={60}
              stroke="var(--text-muted)"
              tick={axisTick}
            />
            <Tooltip
              formatter={(value) =>
                value == null ? "" : money(value, currency)
              }
              contentStyle={tooltipStyle}
            />
            <Line
              name="Actual"
              type="monotone"
              dataKey="running_total"
              stroke="var(--accent)"
              strokeWidth={2.5}
              dot={chartDot}
            />
            <Line
              name="Expected"
              type="monotone"
              dataKey="expected_running_total"
              stroke="var(--warning)"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="chart-legend">
          <span>
            <i className="legend-line actual" />
            Actual
          </span>
          <span>
            <i className="legend-line expected" />
            Expected 12-month forecast
          </span>
        </div>
      </section>

      <ZakatSection currency={currency} />

      <section className="panel">
        <div className="section-head">
          <h2>Monthly savings</h2>
        </div>
        {actualChartData.length === 0 ? (
          <EmptyState title="A little progress starts here">
            Choose a month and record your income and expenses to see your
            savings grow.
          </EmptyState>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-label="Monthly savings"
            className="table-wrap"
          >
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="num">Income</th>
                  <th className="num">Expenses</th>
                  <th className="num">Savings</th>
                  <th className="num">Running total</th>
                </tr>
              </thead>
              <tbody>
                {state.data.map((row) => (
                  <tr key={row.month_id}>
                    <td>{monthLabel(row)}</td>
                    <td className="num">
                      {money(row.income_actual, currency)}
                    </td>
                    <td className="num">
                      {money(row.expense_actual, currency)}
                    </td>
                    <td className="num">{money(row.amount_saved, currency)}</td>
                    <td className="num">
                      {money(row.running_total, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
