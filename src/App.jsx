import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  LayoutDashboard,
  Plus,
  Save,
  TrendingDown,
  TrendingUp,
  Trash2,
  WalletCards,
  X
} from 'lucide-react';
import { api, dateOnly, money, monthLabel, todayISO } from './api.js';
import './styles.css';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'months', label: 'Months', icon: CalendarDays },
  { id: 'budget', label: 'Budget', icon: WalletCards },
  { id: 'transactions', label: 'Transactions', icon: Coins },
  { id: 'receivables', label: 'Receivable', icon: WalletCards },
  { id: 'savings', label: 'Savings', icon: BarChart3 }
];

const axisTick = { fontFamily: 'IBM Plex Mono', fontSize: 12, fill: '#6b6559' };
const tooltipStyle = { fontFamily: 'IBM Plex Mono', border: '1px solid #c9bfa8', borderRadius: 3 };
const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RADIAN = Math.PI / 180;
const categoryEmojiOptions = [
  '🍽️',
  '🏠',
  '🚌',
  '🛒',
  '💼',
  '💰',
  '🎁',
  '📶',
  '🚗',
  '🩺',
  '👕',
  '🎬',
  '👪',
  '✦'
];
const categoryEmojiFallbacks = {
  food: '🍽️',
  utensils: '🍽️',
  clothes: '👕',
  shirt: '👕',
  rent: '🏠',
  home: '🏠',
  wifi: '📶',
  transport: '🚌',
  bus: '🚌',
  health: '🩺',
  'heart-pulse': '🩺',
  family: '👪',
  users: '👪',
  entertainment: '🎬',
  film: '🎬',
  car: '🚗',
  divers: '✦',
  'more-horizontal': '✦',
  paycheck: '💼',
  briefcase: '💼',
  bonus: '🎁',
  sparkles: '🎁',
  other: '💰',
  wallet: '💰'
};

function categoryEmoji(categoryOrName, icon) {
  const category = typeof categoryOrName === 'object' ? categoryOrName : { name: categoryOrName, icon };
  if (category.icon && !/^[a-z0-9-]+$/i.test(category.icon)) return category.icon;
  return categoryEmojiFallbacks[category.icon] || categoryEmojiFallbacks[category.name] || '✦';
}

function DailyExpenseTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const isForecast = row.isForecast;
  const categories = (row.expense_categories || []).filter((category) => Number(category.amount) > 0);
  return (
    <div className="chart-tooltip">
      <strong>Day {label}</strong>
      <div className="tooltip-row">
        <span>{isForecast ? 'Projected total' : 'Accumulated'}</span>
        <span>{money(isForecast ? row.forecast_expenses : row.expenses, currency)}</span>
      </div>
      {!isForecast && (
        <div className="tooltip-row">
          <span>This day</span>
          <span>{money(row.daily_expenses, currency)}</span>
        </div>
      )}
      {!isForecast && categories.length > 0 && (
        <div className="tooltip-breakdown">
          {categories.map((category) => (
            <div key={category.category_name} className="tooltip-row">
              <span>{categoryEmoji(category.category_name)} {category.category_name}</span>
              <span>{money(category.amount, currency)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryBudgetTooltip({ active, payload, currency }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const planned = Number(row.planned_amount || 0);
  const actual = Number(row.actual_amount || 0);
  const remaining = Math.max(planned - actual, 0);
  const consumptionPct = planned > 0 ? (actual / planned) * 100 : 0;

  return (
    <div className="chart-tooltip">
      <strong>{row.category_name}</strong>
      <div className="tooltip-row">
        <span>Budget</span>
        <span>{money(planned, currency)}</span>
      </div>
      <div className="tooltip-row">
        <span>Consumed</span>
        <span>{money(actual, currency)}</span>
      </div>
      <div className="tooltip-row">
        <span>Remaining</span>
        <span>{money(remaining, currency)}</span>
      </div>
      <div className="tooltip-row">
        <span>Consumption</span>
        <span>{consumptionPct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function CategoryBudgetLabel({ cx, cy, midAngle, outerRadius, payload }) {
  if (!payload?.showLabel) return null;

  const radius = Number(outerRadius || 0);
  const cos = Math.cos(-RADIAN * midAngle);
  const sin = Math.sin(-RADIAN * midAngle);
  const startX = cx + (radius + 4) * cos;
  const startY = cy + (radius + 4) * sin;
  const midX = cx + (radius + 16) * cos;
  const midY = cy + (radius + 16) * sin;
  const endX = midX + (cos >= 0 ? 24 : -24);
  const endY = midY;
  const labelX = endX + (cos >= 0 ? 5 : -5);
  const anchor = cos >= 0 ? 'start' : 'end';

  return (
    <g className="category-pie-label">
      <path
        d={`M${startX},${startY}L${midX},${midY}L${endX},${endY}`}
        stroke={payload.color || '#8a8375'}
      />
      <text x={labelX} y={endY} textAnchor={anchor} dominantBaseline="central">
        {payload.category_name}
      </text>
    </g>
  );
}

function nextMonthValue(month, offset) {
  const date = new Date(month.year, month.month - 1 + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function useLoad(fn, deps) {
  const [state, setState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: '' }));
    fn()
      .then((data) => active && setState({ loading: false, error: '', data }))
      .catch((error) => active && setState({ loading: false, error: error.message, data: null }));
    return () => {
      active = false;
    };
  }, deps);

  return state;
}

function Shell() {
  const [activeTab, setActiveTab] = useState('overview');
  const [months, setMonths] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(null);
  const [monthAction, setMonthAction] = useState(null);
  const [currency, setCurrency] = useState('MAD');
  const [error, setError] = useState('');

  async function loadMonths(options = {}) {
    const config = await api('/config');
    let refreshed = await api('/months');
    if (refreshed.length === 0) {
      const today = new Date();
      const created = await api('/months', {
        method: 'POST',
        body: JSON.stringify({
          year: today.getFullYear(),
          month: today.getMonth() + 1,
          copyFromPrevious: false
        })
      });
      refreshed = await api('/months');
      options.preferredId = created.id;
    }

    const savedId = options.preferredId ?? Number(localStorage.getItem('budget:selectedMonthId'));
    const savedMonth = refreshed.find((month) => month.id === savedId);
    const stillSelected = currentMonth ? refreshed.find((month) => month.id === currentMonth.id) : null;
    const today = new Date();
    const calendarMonth = refreshed.find(
      (month) => month.year === today.getFullYear() && month.month === today.getMonth() + 1
    );
    const nextSelected = savedMonth || stillSelected || calendarMonth || refreshed[0] || null;

    setCurrency(config.currency);
    setMonths(refreshed);
    setCurrentMonth(nextSelected);
  }

  useEffect(() => {
    loadMonths().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (currentMonth?.id) {
      localStorage.setItem('budget:selectedMonthId', String(currentMonth.id));
    } else {
      localStorage.removeItem('budget:selectedMonthId');
    }
  }, [currentMonth]);

  async function moveMonth(offset) {
    if (!currentMonth) {
      setActiveTab('months');
      return;
    }
    const target = nextMonthValue(currentMonth, offset);
    const existing = months.find((month) => month.year === target.year && month.month === target.month);
    if (existing) {
      setCurrentMonth(existing);
      return;
    }

    setMonthAction({ type: 'create', year: target.year, monthNumber: target.month });
    setActiveTab('months');
  }

  const pages = {
    overview: OverviewPage,
    months: MonthManagerPage,
    budget: BudgetPage,
    transactions: TransactionsPage,
    receivables: ReceivablesPage,
    savings: SavingsPage
  };
  const Page = pages[activeTab] || (currentMonth ? OverviewPage : MonthManagerPage);

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>Ledger</h1>
        </div>
        <div className="month-switcher">
          <button className="icon-button" title="Previous month" onClick={() => moveMonth(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button className="current-month-pill" onClick={() => setActiveTab('months')}>
            <CalendarDays size={16} />
            {currentMonth ? monthLabel(currentMonth) : 'No month selected'}
          </button>
          <button className="icon-button" title="Next month" onClick={() => moveMonth(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {error && <div className="error">{error}</div>}
      <Page
        month={currentMonth}
        months={months}
        currency={currency}
        onSelectMonth={setCurrentMonth}
        onOpenMonth={(selectedMonth) => {
          setCurrentMonth(selectedMonth);
          setActiveTab('overview');
        }}
        onRefreshMonths={loadMonths}
        monthAction={monthAction}
        onMonthActionChange={setMonthAction}
      />
    </main>
  );
}

/* ---------------------------------------------------------------- */
/* Overview — the landing page. One headline number, then evidence. */
/* ---------------------------------------------------------------- */

function OverviewPage({ month, currency }) {
  const state = useLoad(() => (month ? api(`/dashboard/${month.id}`) : Promise.resolve(null)), [month?.id]);

  if (!month) return <Panel>Select or create a month from the Months tab.</Panel>;
  if (state.loading) return <Panel>Loading overview...</Panel>;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;
  if (!state.data) return <Panel>Loading overview...</Panel>;

  const data = state.data;
  const expensePct = data.totals.planned_expenses > 0
    ? (data.totals.actual_expenses / data.totals.planned_expenses) * 100
    : 0;
  const remainingBudget = data.totals.planned_expenses - data.totals.actual_expenses;
  const today = new Date();
  const daysInMonth = new Date(month.year, month.month, 0).getDate();
  const isCurrentMonth = month.year === today.getFullYear() && month.month === today.getMonth() + 1;
  const elapsedDays = isCurrentMonth ? today.getDate() : daysInMonth;
  const monthElapsedPct = (elapsedDays / daysInMonth) * 100;
  const daysLeftIncludingToday = Math.max(daysInMonth - elapsedDays + 1, 1);
  const safePerDay = Math.max(remainingBudget, 0) / daysLeftIncludingToday;
  const projectedSpend = elapsedDays > 0 ? (data.totals.actual_expenses / elapsedDays) * daysInMonth : 0;
  const projectedDelta = data.totals.planned_expenses - projectedSpend;
  const TrendIcon = projectedDelta >= 0 ? TrendingDown : TrendingUp;
  const paceStatus = expensePct <= monthElapsedPct ? 'positive' : 'negative';
  const spentDisplay = money(data.totals.actual_expenses, currency).replace(` ${currency}`, '');
  const realSpending = Number(data.totals.cash_expenses || 0);
  const progressPct = Math.min(Math.max(expensePct, 0), 100);
  const paceMarkerPct = Math.min(Math.max(monthElapsedPct, 0), 100);
  const dailyRunRate = elapsedDays > 0 ? data.totals.actual_expenses / elapsedDays : 0;
  const categoryTotal = data.spendingByCategory.reduce((total, row) => total + Number(row.planned_amount || 0), 0);
  const spreadExpenses = data.activeSpreadExpenses || [];
  const spreadMonthlyTotal = spreadExpenses.reduce((total, row) => total + Number(row.monthly_amount || 0), 0);
  const categorySegments = data.spendingByCategory.flatMap((row) => {
    const planned = Number(row.planned_amount || 0);
    const actual = Number(row.actual_amount || 0);
    const consumed = Math.min(actual, planned);
    const remaining = Math.max(planned - consumed, 0);
    const labelSegment = consumed >= remaining ? 'consumed' : 'remaining';
    const segments = [];
    if (consumed > 0) {
      segments.push({ ...row, segment: 'consumed', value: consumed, showLabel: labelSegment === 'consumed' });
    }
    if (remaining > 0) {
      segments.push({ ...row, segment: 'remaining', value: remaining, showLabel: labelSegment === 'remaining' });
    }
    return segments;
  });
  const trend = data.trend.map((row) => {
    const isForecast = isCurrentMonth && row.day > elapsedDays;
    return {
      ...row,
      label: String(row.day),
      actual_expenses: isForecast ? null : row.expenses,
      forecast_expenses: isCurrentMonth && row.day >= elapsedDays
        ? data.totals.actual_expenses + (row.day - elapsedDays) * dailyRunRate
        : null,
      isForecast
    };
  });

  return (
    <div className="grid overview-grid">
      <section className={`panel hero budget-hero ${paceStatus}`}>
        <div className="budget-hero-top">
          <div>
            <span className="hero-label">Budget used</span>
            <strong className="hero-number num">
              {spentDisplay}
              <span> / {money(data.totals.planned_expenses, currency)}</span>
            </strong>
            <p className="budget-pace">Real month spending: {money(realSpending, currency)}</p>
          </div>
          <div className="safe-spend">
            <span>Safe to spend today</span>
            <strong className="num">
              {money(safePerDay, currency)}
              <small>/day</small>
            </strong>
            <em>to stay on budget</em>
          </div>
        </div>
        <div className="hero-compare">
          <p className="budget-pace">
            {Math.round(expensePct)}% of budget &middot; day {elapsedDays} of {daysInMonth} ({Math.round(monthElapsedPct)}% of month gone)
          </p>
          <div className="pace-track" aria-label="Budget usage compared with month progress">
            <span className="pace-fill" style={{ width: `${progressPct}%` }} />
            <i className="pace-marker" style={{ left: `${paceMarkerPct}%` }} />
          </div>
          <div className="budget-hero-footer">
            <TrendIcon size={18} />
            <span>
              Projected month-end spending: {money(projectedSpend, currency)}. Expected to finish {money(Math.abs(projectedDelta), currency)} {projectedDelta >= 0 ? 'under' : 'over'} budget.
            </span>
          </div>
        </div>
      </section>

      <section className="panel chart-panel">
        <div className="section-head">
          <h2>Daily expenses</h2>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={trend}>
            <CartesianGrid stroke="#ded6c4" vertical={false} />
            <XAxis dataKey="label" stroke="#6b6559" tick={axisTick} />
            <YAxis stroke="#6b6559" tick={axisTick} />
            <Tooltip content={<DailyExpenseTooltip currency={currency} />} />
            <Line type="monotone" dataKey="actual_expenses" stroke="#a8452f" strokeWidth={2.5} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="forecast_expenses" stroke="#a8452f" strokeWidth={2.5} strokeDasharray="6 5" dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="panel chart-panel">
        <div className="section-head">
          <h2>Budget by category</h2>
          {categoryTotal > 0 && <span className="num">{money(categoryTotal, currency)}</span>}
        </div>
        {categoryTotal === 0 ? (
          <p className="empty-state">No category budget yet.</p>
        ) : (
          <div className="category-breakdown">
            <div className="category-pie">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart margin={{ top: 12, right: 58, bottom: 12, left: 58 }}>
	                  <Pie
	                    data={categorySegments}
	                    dataKey="value"
	                    nameKey="category_name"
	                    innerRadius={42}
	                    outerRadius={76}
	                    paddingAngle={0}
	                    stroke="none"
	                    strokeWidth={0}
                      label={(props) => <CategoryBudgetLabel {...props} />}
                      labelLine={false}
	                  >
	                    {categorySegments.map((entry, index) => (
	                      <Cell
	                        key={`${entry.category_name}-${entry.segment}-${index}`}
	                        fill={entry.color || '#8a8375'}
	                        opacity={entry.segment === 'consumed' ? 1 : 0.22}
	                        stroke="none"
	                        strokeWidth={0}
	                      />
	                    ))}
	                  </Pie>
	                  <Tooltip content={<CategoryBudgetTooltip currency={currency} />} />
	                </PieChart>
	              </ResponsiveContainer>
	            </div>
	          </div>
	        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Over budget</h2>
        </div>
        <div className="stack-list">
          {data.overBudget.length === 0 && <p className="empty-state">Nothing over budget this month.</p>}
          {data.overBudget.map((row) => (
            <div key={row.category_name} className="stack-row danger">
              <span>{row.category_name}</span>
              <strong className="num">{money(row.over_amount, currency)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Spread expenses</h2>
          {spreadMonthlyTotal > 0 && <span className="num">{money(spreadMonthlyTotal, currency)}/mo</span>}
        </div>
        <div className="stack-list">
          {spreadExpenses.length === 0 && <p className="empty-state">No active spread expenses this month.</p>}
          {spreadExpenses.map((row) => (
            <div key={row.id} className="stack-row">
              <span>
                {row.description}
                <br />
                <small>
                  {dateOnly(row.date)} · {row.category_name} · {money(row.price, currency)} total · month {row.spread_month_number} of {row.spread_months} · {row.months_remaining} left
                </small>
              </span>
              <strong className="num">{money(row.monthly_amount, currency)}/mo</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Vs. last month</h2>
        </div>
        <div className="stack-list">
          {data.mom.length === 0 && <p className="empty-state">Not enough history yet.</p>}
          {data.mom.map((row) => (
            <div key={row.category_name} className="stack-row">
              <span>{row.category_name}</span>
              <strong className={`num ${row.percent_change > 0 ? 'flag-up' : 'flag-down'}`}>
                {row.percent_change > 0 ? '+' : ''}
                {row.percent_change.toFixed(1)}%
              </strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Budget — one table, a toggle instead of two permanent panels,    */
/* category management tucked into a drawer that opens on demand.   */
/* ---------------------------------------------------------------- */

function MonthManagerPage({
  month,
  currency,
  onSelectMonth,
  onOpenMonth,
  onRefreshMonths,
  monthAction,
  onMonthActionChange
}) {
  const [refresh, setRefresh] = useState(0);
  const [selectedYear, setSelectedYear] = useState(month?.year || new Date().getFullYear());
  const state = useLoad(() => api('/months/summary'), [refresh]);

  useEffect(() => {
    if (month?.year) setSelectedYear(month.year);
  }, [month?.year]);

  function requestCreateMonth(year, monthNumber) {
    onMonthActionChange({ type: 'create', year, monthNumber });
  }

  async function confirmCreateMonth(copyFromPrevious) {
    const target = { year: monthAction.year, month: monthAction.monthNumber };
    const created = await api('/months', {
      method: 'POST',
      body: JSON.stringify({ ...target, copyFromPrevious })
    });
    await onRefreshMonths({ preferredId: created.id });
    onOpenMonth(created);
    onMonthActionChange(null);
    setRefresh((value) => value + 1);
  }

  function requestDeleteMonth(monthToDelete) {
    onMonthActionChange({ type: 'delete', targetMonth: monthToDelete });
  }

  async function confirmDeleteMonth() {
    const monthToDelete = monthAction.targetMonth;
    await api(`/months/${monthToDelete.id}`, { method: 'DELETE' });
    const remaining = await api('/months');
    const preferredId = month && monthToDelete.id === month.id ? remaining[0]?.id : month?.id;
    await onRefreshMonths(remaining.length ? { preferredId } : {});
    onMonthActionChange(null);
    setRefresh((value) => value + 1);
  }

  if (state.loading) return <Panel>Loading months...</Panel>;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;

  const summaries = state.data;
  const byYearMonth = new Map(summaries.map((item) => [`${item.year}-${item.month}`, item]));
  const currentYear = new Date().getFullYear();
  const yearOptions = [...new Set([currentYear, selectedYear, month?.year, ...summaries.map((item) => item.year)].filter(Boolean))]
    .sort((a, b) => b - a);

  return (
    <div className="grid">
      <section className="panel">
        <div className="section-head">
          <h2>Months</h2>
          <span>{month ? `${monthLabel(month)} selected` : 'No month selected'}</span>
        </div>

        <div className="year-toolbar">
          <button className="icon-button" title="Previous year" onClick={() => setSelectedYear((year) => year - 1)}>
            <ChevronLeft size={17} />
          </button>
          <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button className="icon-button" title="Next year" onClick={() => setSelectedYear((year) => year + 1)}>
            <ChevronRight size={17} />
          </button>
        </div>

        {monthAction?.type === 'create' && (
          <div className="month-action-panel">
            <div>
              <strong>Create {monthLabel({ year: monthAction.year, month: monthAction.monthNumber })}</strong>
              <p>Choose how to initialize the planned budget for this month.</p>
            </div>
            <div className="month-action-buttons">
              <button className="primary" onClick={() => confirmCreateMonth(true)}>
                Copy all planned values
              </button>
              <button onClick={() => confirmCreateMonth(false)}>Recurring only</button>
              <button className="quiet" onClick={() => onMonthActionChange(null)}>Cancel</button>
            </div>
          </div>
        )}

        {monthAction?.type === 'delete' && (
          <div className="month-action-panel danger-panel">
            <div>
              <strong>Delete {monthLabel(monthAction.targetMonth)}</strong>
              <p>This removes that month's budget lines, expenses, and income entries.</p>
            </div>
            <div className="month-action-buttons">
              <button className="danger-button" onClick={confirmDeleteMonth}>Delete month</button>
              <button className="quiet" onClick={() => onMonthActionChange(null)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="year-stack">
            <section className="year-section">
              <h3>{selectedYear}</h3>
              <div className="month-grid" role="list">
                {monthShortNames.map((name, index) => {
                  const monthNumber = index + 1;
                  const item = byYearMonth.get(`${selectedYear}-${monthNumber}`);
                  const isSelected = item?.id === month?.id;
                  const savings = item ? item.savings : 0;
                  return (
                    <button
                      key={`${selectedYear}-${monthNumber}`}
                      className={item ? `month-card ${isSelected ? 'selected' : ''}` : 'month-card empty'}
                      onClick={() => (item ? onOpenMonth(item) : requestCreateMonth(selectedYear, monthNumber))}
                      role="listitem"
                    >
                      <span className="month-card-head">
                        <strong>{name}</strong>
                        {item ? <span>{item.status}</span> : <span>Create</span>}
                      </span>
                      {item ? (
                        <>
                          <span className="month-metric">
                            <span>In</span>
                            <strong className="num">{money(item.income_actual, currency)}</strong>
                          </span>
                          <span className="month-metric">
                            <span>Out</span>
                            <strong className="num">{money(item.expense_actual, currency)}</strong>
                          </span>
                          <span className={`month-metric ${savings >= 0 ? 'positive' : 'negative'}`}>
                            <span>Save</span>
                            <strong className="num">{money(savings, currency)}</strong>
                          </span>
                          <span className="month-foot">
                            {item.expense_count + item.income_count} entries
                            <span
                              className="month-delete"
                              title="Delete month"
                              onClick={(event) => {
                                event.stopPropagation();
                                requestDeleteMonth(item);
                              }}
                            >
                              <Trash2 size={14} />
                            </span>
                          </span>
                        </>
                      ) : (
                        <span className="month-empty-text">No record</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
        </div>
      </section>
    </div>
  );
}

function BudgetPage({ month, currency }) {
  const [refresh, setRefresh] = useState(0);
  const [showCategories, setShowCategories] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', icon: categoryEmojiFallbacks.food });

  const state = useLoad(async () => {
    if (!month) return null;
    const [budget, expenseCategories] = await Promise.all([
      api(`/budget/${month.id}`),
      api('/categories/expense')
    ]);
    return { budget, expenseCategories };
  }, [month?.id, refresh]);

  async function saveLine(line, patch) {
    await api(`/budget-lines/${line.id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch)
    });
    setRefresh((value) => value + 1);
  }

  async function addCategory() {
    const name = newCategory.name.trim();
    if (!name) return;
    await api('/categories/expense', {
      method: 'POST',
      body: JSON.stringify({ name, icon: newCategory.icon })
    });
    setNewCategory((current) => ({ ...current, name: '' }));
    setRefresh((value) => value + 1);
  }

  async function deactivateCategory(id) {
    await api(`/categories/expense/${id}`, { method: 'DELETE' });
    setRefresh((value) => value + 1);
  }

  if (!month) return <Panel>Select or create a month from the Months tab.</Panel>;
  if (state.loading) return <Panel>Loading budget...</Panel>;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;
  if (!state.data) return <Panel>Loading budget...</Panel>;

  const lines = state.data.budget.expenses;
  const categories = state.data.expenseCategories;

  return (
    <section className="panel">
      <div className="section-head">
        <h2>Budget</h2>
        <div className="head-actions">
          <span className="num">{money(sum(lines, 'actual_amount'), currency)} actual</span>
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="empty-state">No expense categories budgeted yet. Add one below to get started.</p>
      ) : (
        <BudgetTable lines={lines} currency={currency} onSave={saveLine} />
      )}

      <button className="text-toggle" onClick={() => setShowCategories((value) => !value)}>
        <ChevronDown size={15} className={showCategories ? 'chev open' : 'chev'} />
        {showCategories ? 'Hide categories' : 'Manage categories'}
      </button>

      {showCategories && (
        <div className="drawer">
          <div className="inline-form">
            <select
              className="emoji-select"
              value={newCategory.icon}
              aria-label="Category emoji"
              onChange={(event) => setNewCategory((current) => ({ ...current, icon: event.target.value }))}
            >
              {categoryEmojiOptions.map((emoji) => (
                <option key={emoji} value={emoji}>
                  {emoji}
                </option>
              ))}
            </select>
            <input
              value={newCategory.name}
              placeholder="New expense category"
              onChange={(event) => setNewCategory((current) => ({ ...current, name: event.target.value }))}
              onKeyDown={(event) => event.key === 'Enter' && addCategory()}
            />
            <button className="icon-button primary" title="Add category" onClick={addCategory}>
              <Plus size={16} />
            </button>
          </div>
          <div className="category-list">
            {categories.map((category) => (
              <div key={category.id} className={!category.is_active ? 'inactive category-row' : 'category-row'}>
                <span className="category-emoji" aria-hidden="true">{categoryEmoji(category)}</span>
                <span>{category.name}</span>
                {category.is_active && (
                  <button className="row-delete" title="Remove category" onClick={() => deactivateCategory(category.id)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function BudgetTable({ lines, currency, onSave }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Planned</th>
            <th>Actual</th>
            <th>Remaining</th>
            <th>% used</th>
            <th>Recurring</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const over = line.actual_amount > line.planned_amount;
            return (
              <tr key={line.id} className={over ? 'over-budget' : ''}>
                <td>
                  <span className="category-emoji" aria-hidden="true">{categoryEmoji(line.category_name, line.icon)}</span>
                  {line.category_name}
                  {!line.is_active && <span className="muted"> inactive</span>}
                </td>
                <td>
                  <input
                    className="amount-input"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={line.planned_amount}
                    onBlur={(event) => onSave(line, { planned_amount: event.target.value })}
                  />
                </td>
                <td>{money(line.actual_amount, currency)}</td>
                <td>{money(line.remaining, currency)}</td>
                <td>
                  <div className="progress">
                    <span className={over ? 'over' : ''} style={{ width: `${Math.min(line.percent_used, 140)}%` }} />
                  </div>
                  {Math.round(line.percent_used)}%
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={line.is_recurring}
                    onChange={(event) => onSave(line, { is_recurring: event.target.checked })}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Transactions — toggle instead of two panels, add-form on demand  */
/* instead of a permanently open input strip.                       */
/* ---------------------------------------------------------------- */

function TransactionsPage({ month, currency }) {
  const [refresh, setRefresh] = useState(0);
  const [kind, setKind] = useState('expense');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState({ sortBy: 'date', sortDir: 'desc' });
  const [showAdd, setShowAdd] = useState(false);
  const isExpense = kind === 'expense';

  useEffect(() => {
    setFilter('');
    setShowAdd(false);
  }, [kind]);

  const state = useLoad(async () => {
    if (!month) return null;
    const query = new URLSearchParams({ monthId: month.id, ...sort });
    if (filter) query.set('categoryId', filter);
    const [expenseCategories, incomeCategories, rows] = await Promise.all([
      api('/categories/expense'),
      api('/categories/income'),
      api(`/transactions/${isExpense ? 'expenses' : 'income'}?${query}`)
    ]);
    return { expenseCategories, incomeCategories, rows };
  }, [month?.id, refresh, kind, filter, sort.sortBy, sort.sortDir]);

  if (!month) return <Panel>Select or create a month from the Months tab.</Panel>;
  if (state.loading) return <Panel>Loading transactions...</Panel>;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;
  if (!state.data) return <Panel>Loading transactions...</Panel>;

  const categories = (isExpense ? state.data.expenseCategories : state.data.incomeCategories).filter(
    (category) => category.is_active
  );

  function flipSort(sortBy) {
    setSort((current) => ({
      sortBy,
      sortDir: current.sortBy === sortBy && current.sortDir === 'desc' ? 'asc' : 'desc'
    }));
  }

  return (
    <section className="panel">
      <div className="section-head">
        <h2>Transactions</h2>
        <div className="head-actions">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: 'expense', label: 'Expenses' },
              { value: 'income', label: 'Income' }
            ]}
          />
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button className="primary" onClick={() => setShowAdd((value) => !value)}>
            <Plus size={15} /> Add
          </button>
        </div>
      </div>

      {isExpense && (
        <NaturalExpenseInput
          categories={categories}
          month={month}
          currency={currency}
          onDone={() => setRefresh((value) => value + 1)}
        />
      )}

      {showAdd && (
        <AddTransactionForm
          isExpense={isExpense}
          categories={categories}
          month={month}
          onDone={() => {
            setShowAdd(false);
            setRefresh((value) => value + 1);
          }}
        />
      )}

      {state.data.rows.length === 0 ? (
        <p className="empty-state">No {isExpense ? 'expenses' : 'income'} logged yet this month.</p>
      ) : (
        <TransactionTable
          isExpense={isExpense}
          rows={state.data.rows}
          categories={categories}
          currency={currency}
          flipSort={flipSort}
          onChange={() => setRefresh((value) => value + 1)}
        />
      )}
    </section>
  );
}

function multiplyAmount(quantity, unitPrice) {
  const q = Number(quantity);
  const unit = Number(unitPrice);
  if (!Number.isFinite(q) || !Number.isFinite(unit) || q <= 0 || unit < 0) return '';
  return (q * unit).toFixed(2);
}

function divideAmount(amount, quantity) {
  const total = Number(amount);
  const q = Number(quantity);
  if (!Number.isFinite(total) || !Number.isFinite(q) || q <= 0 || total < 0) return '';
  return (total / q).toFixed(2);
}

function NaturalExpenseInput({ categories, month, currency, onDone }) {
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function parseText() {
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      const parsed = await api('/transactions/expenses/parse', {
        method: 'POST',
        body: JSON.stringify({ month_id: month.id, text })
      });
      setProvider(parsed.provider || '');
      setWarnings(parsed.warnings || []);
      setDrafts((parsed.items || []).map((item, index) => ({
        id: `${Date.now()}-${index}`,
        date: todayISO(),
        productName: item.product_name || '',
        quantity: String(item.quantity || 1),
        unitPrice: String(item.unit_price || ''),
        amount: multiplyAmount(item.quantity || 1, item.unit_price || ''),
        category_id: item.category_id ? String(item.category_id) : '',
        budgetTreatment: 'normal',
        spreadMonths: '12',
        confidence: Number(item.confidence || 0)
      })));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function updateDraft(id, patch) {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  function updateDraftCost(id, patch) {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== id) return draft;
      const next = { ...draft, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'amount')) {
        next.unitPrice = divideAmount(next.amount, next.quantity);
      } else {
        next.amount = multiplyAmount(next.quantity, next.unitPrice);
      }
      return next;
    }));
  }

  function removeDraft(id) {
    setDrafts((current) => current.filter((draft) => draft.id !== id));
  }

  async function saveDrafts() {
    const validDrafts = drafts.filter((draft) =>
      draft.productName.trim()
        && Number(draft.amount) >= 0
        && Number(draft.quantity) > 0
        && Number(draft.unitPrice) >= 0
        && (draft.budgetTreatment !== 'spread' || Number.isInteger(Number(draft.spreadMonths)) && Number(draft.spreadMonths) > 0)
        && draft.category_id
    );
    if (validDrafts.length !== drafts.length || validDrafts.length === 0) {
      setError('Review every draft row before saving. Product name, quantity, unit price, amount, category, and spread period are required.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api('/transactions/expenses/bulk', {
        method: 'POST',
        body: JSON.stringify({
          transactions: validDrafts.map((draft) => ({
            month_id: month.id,
            transaction_date: draft.date,
            description: draft.productName,
            quantity: draft.quantity,
            unit_price: draft.unitPrice,
            price: draft.amount,
            category_id: Number(draft.category_id),
            budget_treatment: draft.budgetTreatment,
            spread_months: draft.budgetTreatment === 'spread' ? Number(draft.spreadMonths) : null
          }))
        })
      });
      setText('');
      setDrafts([]);
      setWarnings([]);
      setProvider('');
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="natural-expense">
      <div className="natural-expense-input">
        <textarea
          value={text}
          placeholder="Example: I bought 2 milks 4mad each, 1 chicken with 40dh, and took the bus with 4dh"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              parseText();
            }
          }}
          rows={3}
        />
        <button className="primary" onClick={parseText} disabled={busy || !text.trim()}>
          {busy ? 'Parsing...' : 'Parse'}
        </button>
      </div>
      {provider && <p className="parse-provider">Drafted with {provider === 'local' ? 'local parser' : provider}</p>}
      {error && <p className="parse-error">{error}</p>}
      {warnings.length > 0 && (
        <div className="parse-warnings">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
      {drafts.length > 0 && (
        <div className="draft-review">
          <div className="draft-review-head">
            <h3>Review parsed expenses</h3>
            <button className="primary" onClick={saveDrafts} disabled={busy}>
              Save all
            </button>
          </div>
          <div className="table-wrap">
            <table className="draft-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Amount</th>
                  <th>Category</th>
                  <th>Treatment</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr key={draft.id}>
                    <td>
                      <input type="date" value={draft.date} onChange={(event) => updateDraft(draft.id, { date: event.target.value })} />
                    </td>
                    <td>
                      <input value={draft.productName} onChange={(event) => updateDraft(draft.id, { productName: event.target.value })} />
                    </td>
                    <td>
                      <input type="number" min="0.01" step="0.01" value={draft.quantity} onChange={(event) => updateDraftCost(draft.id, { quantity: event.target.value })} />
                    </td>
                    <td>
                      <input type="number" min="0" step="0.01" value={draft.unitPrice} onChange={(event) => updateDraftCost(draft.id, { unitPrice: event.target.value })} />
                    </td>
                    <td>
                      <input type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => updateDraftCost(draft.id, { amount: event.target.value })} />
                    </td>
                    <td>
                      <select value={draft.category_id} onChange={(event) => updateDraft(draft.id, { category_id: event.target.value })}>
                        <option value="">Pick category</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select value={draft.budgetTreatment} onChange={(event) => updateDraft(draft.id, { budgetTreatment: event.target.value })}>
                        <option value="normal">Normal</option>
                        <option value="spread">Spread expense</option>
                      </select>
                      {draft.budgetTreatment === 'spread' && (
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={draft.spreadMonths}
                          title="Spread period in months"
                          onChange={(event) => updateDraft(draft.id, { spreadMonths: event.target.value })}
                        />
                      )}
                    </td>
                    <td>
                      <span className={draft.confidence >= 0.75 ? 'draft-status confident' : 'draft-status'}>
                        {draft.confidence >= 0.75 ? 'Ready' : 'Check'}
                      </span>
                    </td>
                    <td>
                      <button className="icon-button" title="Remove draft" onClick={() => removeDraft(draft.id)}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="draft-total">Draft total: {money(drafts.reduce((sum, draft) => sum + Number(draft.amount || 0), 0), currency)}</p>
        </div>
      )}
    </div>
  );
}

function AddTransactionForm({ isExpense, categories, month, onDone }) {
  const [form, setForm] = useState({
    date: todayISO(),
    description: '',
    quantity: '1',
    unitPrice: '',
    amount: '',
    category_id: categories[0]?.id || '',
    budgetTreatment: 'normal',
    spreadMonths: '12'
  });

  function updateFormCost(patch) {
    setForm((current) => {
      const next = { ...current, ...patch };
      if (!isExpense) return next;
      if (Object.prototype.hasOwnProperty.call(patch, 'amount')) {
        next.unitPrice = divideAmount(next.amount, next.quantity);
      } else {
        next.amount = multiplyAmount(next.quantity, next.unitPrice);
      }
      return next;
    });
  }

  async function submit() {
    if (!form.amount || !form.description) return;
    const path = isExpense ? '/transactions/expenses' : '/transactions/income';
    const body = isExpense
      ? {
          month_id: month.id,
          transaction_date: form.date,
          description: form.description,
          quantity: form.quantity || 1,
          unit_price: form.unitPrice || divideAmount(form.amount, form.quantity || 1),
          price: form.amount,
          category_id: Number(form.category_id),
          budget_treatment: form.budgetTreatment,
          spread_months: form.budgetTreatment === 'spread' ? Number(form.spreadMonths) : null
        }
      : {
          month_id: month.id,
          entry_date: form.date,
          source_name: form.description,
          amount: form.amount,
          category_id: Number(form.category_id)
        };
    await api(path, { method: 'POST', body: JSON.stringify(body) });
    onDone();
  }

  return (
    <div className="add-form">
      <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
      <input
        value={form.description}
        placeholder={isExpense ? 'Product' : 'Source name'}
        onChange={(event) => setForm({ ...form, description: event.target.value })}
        autoFocus
      />
      {isExpense && (
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={form.quantity}
          placeholder="Qty"
          onChange={(event) => updateFormCost({ quantity: event.target.value })}
        />
      )}
      {isExpense && (
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.unitPrice}
          placeholder="Unit price"
          onChange={(event) => updateFormCost({ unitPrice: event.target.value })}
        />
      )}
      <input
        type="number"
        min="0"
        step="0.01"
        value={form.amount}
        placeholder="Amount"
        onChange={(event) => (isExpense ? updateFormCost({ amount: event.target.value }) : setForm({ ...form, amount: event.target.value }))}
        onKeyDown={(event) => event.key === 'Enter' && submit()}
      />
      <select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      {isExpense && (
        <select value={form.budgetTreatment} onChange={(event) => setForm({ ...form, budgetTreatment: event.target.value })}>
          <option value="normal">Normal</option>
          <option value="spread">Spread expense</option>
        </select>
      )}
      {isExpense && form.budgetTreatment === 'spread' && (
        <input
          type="number"
          min="1"
          step="1"
          value={form.spreadMonths}
          placeholder="Months"
          title="Spread period in months"
          onChange={(event) => setForm({ ...form, spreadMonths: event.target.value })}
        />
      )}
      <button className="primary" onClick={submit}>
        Save
      </button>
    </div>
  );
}

function TransactionTable({ isExpense, rows, categories, currency, flipSort, onChange }) {
  const [editing, setEditing] = useState(null);

  function updateEditingCost(patch) {
    setEditing((current) => {
      const next = { ...current, ...patch };
      if (!isExpense) return next;
      if (Object.prototype.hasOwnProperty.call(patch, 'amount')) {
        next.unitPrice = divideAmount(next.amount, next.quantity);
      } else {
        next.amount = multiplyAmount(next.quantity, next.unitPrice);
      }
      return next;
    });
  }

  async function saveEdit() {
    const path = isExpense ? `/transactions/expenses/${editing.id}` : `/transactions/income/${editing.id}`;
    const body = isExpense
      ? {
          transaction_date: editing.date,
          description: editing.description,
          quantity: editing.quantity,
          unit_price: editing.unitPrice,
          price: editing.amount,
          category_id: Number(editing.category_id),
          budget_treatment: editing.budgetTreatment,
          spread_months: editing.budgetTreatment === 'spread' ? Number(editing.spreadMonths) : null
        }
      : {
          entry_date: editing.date,
          source_name: editing.description,
          amount: editing.amount,
          category_id: Number(editing.category_id)
        };
    await api(path, { method: 'PATCH', body: JSON.stringify(body) });
    setEditing(null);
    onChange();
  }

  async function deleteRow(id) {
    const path = isExpense ? `/transactions/expenses/${id}` : `/transactions/income/${id}`;
    await api(path, { method: 'DELETE' });
    onChange();
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th><button onClick={() => flipSort('date')}>Date</button></th>
            <th><button onClick={() => flipSort(isExpense ? 'description' : 'source')}>{isExpense ? 'Product' : 'Source'}</button></th>
            {isExpense && <th><button onClick={() => flipSort('quantity')}>Qty</button></th>}
            {isExpense && <th><button onClick={() => flipSort('unit_price')}>Unit</button></th>}
            <th><button onClick={() => flipSort(isExpense ? 'price' : 'amount')}>Amount</button></th>
            <th><button onClick={() => flipSort('category')}>Category</button></th>
            {isExpense && <th>Treatment</th>}
            <th></th>
          </tr>
        </thead>
        <tbody>
	          {rows.map((row) => {
	            const rowDescription = isExpense ? row.description : row.source_name;
	            const rowDate = dateOnly(row.date);
	            const rowQuantity = isExpense ? row.quantity : null;
	            const rowUnitPrice = isExpense ? row.unit_price : null;
	            const rowAmount = isExpense ? row.price : row.amount;
	            const rowBudgetTreatment = isExpense ? row.budget_treatment : null;
	            const rowSpreadMonths = isExpense ? row.spread_months : null;
            const isEditing = editing?.id === row.id;
            return (
              <tr key={row.id} className={isEditing ? 'editing' : ''}>
	                <td>
	                  {isEditing ? (
	                    <input type="date" value={dateOnly(editing.date)} onChange={(event) => setEditing({ ...editing, date: event.target.value })} />
	                  ) : rowDate}
	                </td>
                <td>
                  {isEditing ? (
                    <input value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} />
                  ) : rowDescription}
                </td>
                {isExpense && (
                  <td>
                    {isEditing ? (
                      <input type="number" min="0.01" step="0.01" value={editing.quantity} onChange={(event) => updateEditingCost({ quantity: event.target.value })} />
                    ) : rowQuantity}
                  </td>
                )}
                {isExpense && (
                  <td>
                    {isEditing ? (
                      <input type="number" min="0" step="0.01" value={editing.unitPrice} onChange={(event) => updateEditingCost({ unitPrice: event.target.value })} />
                    ) : money(rowUnitPrice, currency)}
                  </td>
                )}
                <td>
                  {isEditing ? (
                    <input type="number" min="0" step="0.01" value={editing.amount} onChange={(event) => updateEditingCost({ amount: event.target.value })} />
                  ) : money(rowAmount, currency)}
                </td>
                <td>
                  {isEditing ? (
                    <select value={editing.category_id} onChange={(event) => setEditing({ ...editing, category_id: event.target.value })}>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  ) : row.category_name}
                </td>
                {isExpense && (
                  <td>
                    {isEditing ? (
                      <>
                        <select value={editing.budgetTreatment} onChange={(event) => setEditing({ ...editing, budgetTreatment: event.target.value })}>
                          <option value="normal">Normal</option>
                          <option value="spread">Spread expense</option>
                        </select>
                        {editing.budgetTreatment === 'spread' && (
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={editing.spreadMonths}
                            title="Spread period in months"
                            onChange={(event) => setEditing({ ...editing, spreadMonths: event.target.value })}
                          />
                        )}
                      </>
                    ) : rowBudgetTreatment === 'spread' ? (
                      `Spread / ${rowSpreadMonths} mo`
                    ) : (
                      'Normal'
                    )}
                  </td>
                )}
                <td className="row-actions">
                  {isEditing ? (
                    <>
                      <button className="icon-button primary" title="Save" onClick={saveEdit}>
                        <Save size={15} />
                      </button>
                      <button className="icon-button" title="Cancel edit" onClick={() => setEditing(null)}>
                        <X size={15} />
                      </button>
                    </>
                  ) : (
                    <button
                      className="row-edit"
                      onClick={() =>
	                        setEditing({
	                          id: row.id,
	                          date: rowDate,
	                          description: rowDescription,
                          quantity: rowQuantity,
                          unitPrice: rowUnitPrice ?? divideAmount(rowAmount, rowQuantity || 1),
                          amount: rowAmount,
                          category_id: row.category_id,
                          budgetTreatment: rowBudgetTreatment || 'normal',
                          spreadMonths: rowSpreadMonths || '12'
                        })
                      }
                    >
                      Edit
                    </button>
                  )}
                  <button className="row-delete" title="Delete" onClick={() => deleteRow(row.id)}>
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Savings — leads with the number that actually matters.           */
/* ---------------------------------------------------------------- */

function ReceivablesPage({ month, currency }) {
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState({
    person_name: '',
    description: '',
    amount: '',
    status: 'not_yet'
  });
  const [editing, setEditing] = useState(null);
  const state = useLoad(
    () => (month ? api(`/receivables?${new URLSearchParams({ monthId: month.id })}`) : Promise.resolve(null)),
    [month?.id, refresh]
  );

  if (!month) return <Panel>Select or create a month from the Months tab.</Panel>;
  if (state.loading) return <Panel>Loading receivables...</Panel>;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;
  if (!state.data) return <Panel>Loading receivables...</Panel>;

  const rows = state.data;
  const notYetTotal = rows.filter((row) => row.status === 'not_yet').reduce((total, row) => total + Number(row.amount), 0);
  const paidTotal = rows.filter((row) => row.status === 'paid').reduce((total, row) => total + Number(row.amount), 0);

  async function addReceivable() {
    if (!form.person_name.trim() || !form.amount) return;
    await api('/receivables', {
      method: 'POST',
      body: JSON.stringify({
        month_id: month.id,
        person_name: form.person_name,
        description: form.description,
        amount: form.amount,
        status: form.status
      })
    });
    setForm({ person_name: '', description: '', amount: '', status: 'not_yet' });
    setRefresh((value) => value + 1);
  }

  async function saveEdit() {
    await api(`/receivables/${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        person_name: editing.person_name,
        description: editing.description,
        amount: editing.amount,
        status: editing.status
      })
    });
    setEditing(null);
    setRefresh((value) => value + 1);
  }

  async function updateStatus(row, status) {
    await api(`/receivables/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    setRefresh((value) => value + 1);
  }

  async function deleteReceivable(id) {
    await api(`/receivables/${id}`, { method: 'DELETE' });
    setRefresh((value) => value + 1);
  }

  return (
    <section className="panel">
      <div className="section-head">
        <h2>Receivable</h2>
        <div className="receivable-summary">
          <span><strong className="num">{money(notYetTotal, currency)}</strong> not yet</span>
          <span><strong className="num">{money(paidTotal, currency)}</strong> paid</span>
        </div>
      </div>

      <div className="add-form receivable-form">
        <input
          value={form.person_name}
          placeholder="Person"
          onChange={(event) => setForm({ ...form, person_name: event.target.value })}
          autoFocus
        />
        <input
          value={form.description}
          placeholder="What for"
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.amount}
          placeholder="Amount"
          onChange={(event) => setForm({ ...form, amount: event.target.value })}
          onKeyDown={(event) => event.key === 'Enter' && addReceivable()}
        />
        <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          <option value="not_yet">Not yet</option>
          <option value="paid">Paid</option>
        </select>
        <button className="primary" onClick={addReceivable}>
          <Plus size={15} /> Add
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="empty-state">No receivables for this month.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>What for</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isEditing = editing?.id === row.id;
                return (
                  <tr key={row.id} className={isEditing ? 'editing' : ''}>
                    <td>
                      {isEditing ? (
                        <input value={editing.person_name} onChange={(event) => setEditing({ ...editing, person_name: event.target.value })} />
                      ) : row.person_name}
                    </td>
                    <td>
                      {isEditing ? (
                        <input value={editing.description || ''} onChange={(event) => setEditing({ ...editing, description: event.target.value })} />
                      ) : row.description || <span className="muted">No details</span>}
                    </td>
                    <td>
                      {isEditing ? (
                        <input type="number" min="0" step="0.01" value={editing.amount} onChange={(event) => setEditing({ ...editing, amount: event.target.value })} />
                      ) : money(row.amount, currency)}
                    </td>
                    <td>
                      {isEditing ? (
                        <select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value })}>
                          <option value="not_yet">Not yet</option>
                          <option value="paid">Paid</option>
                        </select>
                      ) : (
                        <button
                          className={row.status === 'paid' ? 'status-pill paid' : 'status-pill'}
                          onClick={() => updateStatus(row, row.status === 'paid' ? 'not_yet' : 'paid')}
                        >
                          {row.status === 'paid' ? 'Paid' : 'Not yet'}
                        </button>
                      )}
                    </td>
                    <td className="row-actions">
                      {isEditing ? (
                        <>
                          <button className="icon-button primary" title="Save" onClick={saveEdit}>
                            <Save size={15} />
                          </button>
                          <button className="icon-button" title="Cancel edit" onClick={() => setEditing(null)}>
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <button
                          className="row-edit"
                          onClick={() =>
                            setEditing({
                              id: row.id,
                              person_name: row.person_name,
                              description: row.description || '',
                              amount: row.amount,
                              status: row.status
                            })
                          }
                        >
                          Edit
                        </button>
                      )}
                      <button className="row-delete" title="Delete" onClick={() => deleteReceivable(row.id)}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SavingsPage({ currency }) {
  const state = useLoad(() => api('/savings'), []);
  const [expectedMonthlyValue, setExpectedMonthlyValue] = useState(() => (
    localStorage.getItem('budget:expectedMonthlySavings') || ''
  ));
  const [forecastStartKey, setForecastStartKey] = useState(() => (
    localStorage.getItem('budget:forecastStartMonth') || 'latest'
  ));

  useEffect(() => {
    localStorage.setItem('budget:expectedMonthlySavings', expectedMonthlyValue);
  }, [expectedMonthlyValue]);

  useEffect(() => {
    localStorage.setItem('budget:forecastStartMonth', forecastStartKey);
  }, [forecastStartKey]);

  if (state.loading) return <Panel>Loading savings...</Panel>;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;

  const expectedMonthly = Number(expectedMonthlyValue || 0);
  const hasForecast = expectedMonthlyValue !== '' && Number.isFinite(expectedMonthly);
  const actualChartData = state.data.map((row) => ({ ...row, label: `${row.month}/${row.year}` }));
  const total = actualChartData.length ? actualChartData[actualChartData.length - 1].running_total : 0;
  const selectedForecastStartIndex = forecastStartKey === 'latest'
    ? actualChartData.length - 1
    : actualChartData.findIndex((row) => String(row.month_id) === forecastStartKey);
  const forecastStartIndex = selectedForecastStartIndex >= 0 ? selectedForecastStartIndex : actualChartData.length - 1;
  const forecastStart = actualChartData[forecastStartIndex] || {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    running_total: 0
  };
  const forecastBase = Number(forecastStart.running_total || 0);
  const chartRowsByMonth = new Map();
  for (const row of actualChartData) {
    chartRowsByMonth.set(`${row.year}-${row.month}`, { ...row, expected_running_total: null });
  }
  if (hasForecast) {
    for (let index = 0; index <= 12; index += 1) {
      const date = new Date(forecastStart.year, forecastStart.month - 1 + index, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;
      const existing = chartRowsByMonth.get(key) || {
        year,
        month,
        label: `${month}/${year}`,
        running_total: null
      };
      chartRowsByMonth.set(key, {
        ...existing,
        expected_running_total: forecastBase + expectedMonthly * index,
        is_forecast: index > 0
      });
    }
  }
  const chartData = Array.from(chartRowsByMonth.values())
    .sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

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
            <input
              type="number"
              step="0.01"
              value={expectedMonthlyValue}
              placeholder="0.00"
              onChange={(event) => setExpectedMonthlyValue(event.target.value)}
            />
          </label>
          <label className="forecast-control">
            <span>Start from</span>
            <select value={forecastStartKey} onChange={(event) => setForecastStartKey(event.target.value)}>
              <option value="latest">Latest actual</option>
              {actualChartData.map((row) => (
                <option key={row.month_id} value={row.month_id}>
                  {monthLabel(row)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="#ded6c4" vertical={false} />
            <XAxis dataKey="label" stroke="#6b6559" tick={axisTick} />
            <YAxis stroke="#6b6559" tick={axisTick} />
            <Tooltip formatter={(value) => (value == null ? '' : money(value, currency))} contentStyle={tooltipStyle} />
            <Line
              name="Actual"
              type="monotone"
              dataKey="running_total"
              stroke="#274b52"
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
            <Line
              name="Expected"
              type="monotone"
              dataKey="expected_running_total"
              stroke="#b0813f"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="chart-legend">
          <span><i className="legend-line actual" />Actual</span>
          <span><i className="legend-line expected" />Expected 12-month forecast</span>
        </div>
      </section>

      <ZakatSection currency={currency} />

      <section className="panel">
        <div className="section-head">
          <h2>Monthly savings</h2>
        </div>
        {actualChartData.length === 0 ? (
          <p className="empty-state">No months tracked yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
	                <tr>
	                  <th>Month</th>
	                  <th>Income</th>
	                  <th>Expenses</th>
	                  <th>Savings</th>
	                  <th>Running total</th>
	                </tr>
              </thead>
              <tbody>
                {state.data.map((row) => (
	                  <tr key={row.month_id}>
	                    <td>{monthLabel(row)}</td>
	                    <td>{money(row.income_actual, currency)}</td>
	                    <td>{money(row.expense_actual, currency)}</td>
	                    <td>{money(row.amount_saved, currency)}</td>
	                    <td>{money(row.running_total, currency)}</td>
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

const zakatStatusLabels = {
  missing_price: 'Add price',
  not_started: 'Not started',
  below_nisab: 'Below nisab',
  tracking: 'Tracking',
  due: 'Due'
};

const zakatEventLabels = {
  initial_anchor: 'Initial anchor',
  missing_price: 'Waiting for price',
  nisab_reached: 'Nisab reached',
  anchor_reset: 'Anchor reset',
  zakat_due: 'Zakat due',
  zakat_paid: 'Zakat paid'
};

function ZakatSection({ currency }) {
  const [refresh, setRefresh] = useState(0);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const state = useLoad(() => api('/zakat'), [refresh]);

  async function markPaid() {
    setPaying(true);
    setError('');
    try {
      await api('/zakat/pay', { method: 'POST' });
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setPaying(false);
    }
  }

  if (state.loading) return <Panel>Loading zakat...</Panel>;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;
  if (!state.data) return <Panel>Loading zakat...</Panel>;

  const zakatEvents = [
    ...(state.data.calculations.gold.events || []),
    ...(state.data.calculations.silver.events || [])
  ].sort((a, b) => b.date.localeCompare(a.date) || a.standard.localeCompare(b.standard));
  const dueNow = Number(state.data.due_now ?? Math.max(
    Number(state.data.calculations.gold.zakat_due_amount || 0),
    Number(state.data.calculations.silver.zakat_due_amount || 0)
  ));

  return (
    <section className="panel zakat-panel">
      <div className="section-head">
        <h2>Zakat</h2>
        <span className="muted">Initial anchor {dateOnly(state.data.settings.gold_anchor_date)} · 354-day haul</span>
      </div>

      <div className="zakat-summary">
        <div>
          <span>Due now</span>
          <strong className="num">{money(dueNow, currency)}</strong>
          <button className="status-pill paid" disabled={!state.data.has_unpaid_zakat || paying} onClick={markPaid}>
            {state.data.has_unpaid_zakat ? (paying ? 'Saving...' : 'Mark paid') : 'Paid'}
          </button>
        </div>
      </div>
      {error && <p className="parse-error">{error}</p>}

      <div className="zakat-cards">
        <ZakatNisabCard calculation={state.data.calculations.gold} currency={currency} />
        <ZakatNisabCard calculation={state.data.calculations.silver} currency={currency} />
      </div>

      <p className="zakat-refresh-note">
        {state.data.price_refresh.configured
          ? 'Gold and silver prices refresh automatically once per day at midnight.'
          : 'Add GOLDAPI_KEY to enable automatic daily gold and silver price updates.'}
      </p>

      <div className="zakat-event-log">
        <div className="section-head">
          <h3>Zakat events</h3>
        </div>
        {zakatEvents.length === 0 ? (
          <p className="empty-state">No zakat events recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="zakat-event-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Standard</th>
                  <th>Event</th>
                  <th>Savings</th>
                  <th>Nisab</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Anchor</th>
                </tr>
              </thead>
              <tbody>
                {zakatEvents.map((event, index) => (
                  <tr key={`${event.standard}-${event.type}-${event.date}-${index}`}>
                    <td>{dateOnly(event.date)}</td>
                    <td>{event.standard}</td>
                    <td>
                      <span className={`event-pill ${event.type}`}>
                        {zakatEventLabels[event.type] || event.title || event.type}
                      </span>
                    </td>
                    <td>{event.savings == null ? '-' : money(event.savings, currency)}</td>
                    <td>{event.nisab == null ? '-' : money(event.nisab, currency)}</td>
                    <td>{event.amount_due == null ? '-' : money(event.amount_due, currency)}</td>
                    <td>{event.amount_due == null ? '-' : event.paid ? 'Yes' : 'No'}</td>
                    <td>{event.anchor_date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {state.data.prices.length === 0 ? (
        <p className="empty-state">No automatic nisab price checkpoint yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="zakat-price-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Gold / gram</th>
                <th>Gold nisab</th>
                <th>Silver / gram</th>
                <th>Silver nisab</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {state.data.prices.map((row) => (
                <tr key={row.id}>
                  <td>{dateOnly(row.entry_date)}</td>
                  <td>{row.gold_price_per_gram == null ? '-' : money(row.gold_price_per_gram, currency)}</td>
                  <td>{row.gold_price_per_gram == null ? '-' : money(row.gold_price_per_gram * 85, currency)}</td>
                  <td>{row.silver_price_per_gram == null ? '-' : money(row.silver_price_per_gram, currency)}</td>
                  <td>{row.silver_price_per_gram == null ? '-' : money(row.silver_price_per_gram * 595, currency)}</td>
                  <td>{row.source || 'goldapi'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ZakatNisabCard({ calculation, currency }) {
  const status = zakatStatusLabels[calculation.status] || calculation.status;
  return (
    <article className={`zakat-card ${calculation.status}`}>
      <div className="zakat-card-head">
        <div>
          <span>{calculation.standard}</span>
          <strong>{calculation.grams}g nisab</strong>
        </div>
        <em>{status}</em>
      </div>
      <div className="zakat-progress">
        <span style={{ width: `${Math.min((calculation.days_elapsed / 354) * 100, 100)}%` }} />
      </div>
      <div className="zakat-metrics">
        <span>Current nisab <strong className="num">{calculation.current_nisab == null ? '-' : money(calculation.current_nisab, currency)}</strong></span>
        <span>Price / gram <strong className="num">{calculation.current_price_per_gram == null ? '-' : money(calculation.current_price_per_gram, currency)}</strong></span>
        <span>Active anchor <strong>{calculation.active_anchor_date || '-'}</strong></span>
        <span>Due date <strong>{calculation.due_date || '-'}</strong></span>
        <span>Days <strong className="num">{calculation.days_elapsed} / 354</strong></span>
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------- */
/* Shared bits                                                      */
/* ---------------------------------------------------------------- */

function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          className={value === option.value ? 'active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Panel({ children, tone = '' }) {
  return <section className={`panel ${tone}`}>{children}</section>;
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

createRoot(document.getElementById('root')).render(<Shell />);
