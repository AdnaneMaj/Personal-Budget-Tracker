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
  Trash2,
  WalletCards
} from 'lucide-react';
import { api, money, monthLabel, todayISO } from './api.js';
import './styles.css';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'months', label: 'Months', icon: CalendarDays },
  { id: 'budget', label: 'Budget', icon: WalletCards },
  { id: 'transactions', label: 'Transactions', icon: Coins },
  { id: 'savings', label: 'Savings', icon: BarChart3 }
];

const axisTick = { fontFamily: 'IBM Plex Mono', fontSize: 12, fill: '#6b6559' };
const tooltipStyle = { fontFamily: 'IBM Plex Mono', border: '1px solid #c9bfa8', borderRadius: 3 };
const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
  const net = data.totals.actual_income - data.totals.actual_expenses;
  const expensePct = data.totals.planned_expenses > 0
    ? (data.totals.actual_expenses / data.totals.planned_expenses) * 100
    : 0;
  const trend = data.trend.map((row) => ({ ...row, label: `${row.month}/${row.year}` }));

  return (
    <div className="grid overview-grid">
      <section className={`panel hero ${net >= 0 ? 'positive' : 'negative'}`}>
        <span className="hero-label">Net this month</span>
        <strong className="hero-number num">
          {net >= 0 ? '+' : ''}
          {money(net, currency)}
        </strong>
        <div className="hero-compare">
          <div className="compare-row">
            <span>Income</span>
            <span className="num">{money(data.totals.actual_income, currency)}</span>
          </div>
          <div className="compare-row">
            <span>Expenses</span>
            <span className="num">
              {money(data.totals.actual_expenses, currency)}
              <span className="muted"> of {money(data.totals.planned_expenses, currency)} planned</span>
            </span>
          </div>
          <div className="progress wide">
            <span className={expensePct > 100 ? 'over' : ''} style={{ width: `${Math.min(expensePct, 100)}%` }} />
          </div>
        </div>
      </section>

      <section className="panel chart-panel">
        <div className="section-head">
          <h2>Income vs expenses</h2>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={trend}>
            <CartesianGrid stroke="#ded6c4" vertical={false} />
            <XAxis dataKey="label" stroke="#6b6559" tick={axisTick} />
            <YAxis stroke="#6b6559" tick={axisTick} />
            <Tooltip formatter={(value) => money(value, currency)} contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="income" stroke="#3c6e5c" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="expenses" stroke="#a8452f" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="panel chart-panel">
        <div className="section-head">
          <h2>Spending by category</h2>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Pie data={data.spendingByCategory} dataKey="amount" nameKey="category_name" outerRadius={85}>
              {data.spendingByCategory.map((entry) => (
                <Cell key={entry.category_name} fill={entry.color || '#8a8375'} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => money(value, currency)} contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
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
  const [type, setType] = useState('expense');
  const [showCategories, setShowCategories] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', icon: categoryEmojiFallbacks.food });

  useEffect(() => {
    setNewCategory({
      name: '',
      icon: type === 'expense' ? categoryEmojiFallbacks.food : categoryEmojiFallbacks.paycheck
    });
  }, [type]);

  const state = useLoad(async () => {
    if (!month) return null;
    const [budget, expenseCategories, incomeCategories] = await Promise.all([
      api(`/budget/${month.id}`),
      api('/categories/expense'),
      api('/categories/income')
    ]);
    return { budget, expenseCategories, incomeCategories };
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
    await api(`/categories/${type}`, {
      method: 'POST',
      body: JSON.stringify({ name, icon: newCategory.icon })
    });
    setNewCategory((current) => ({ ...current, name: '' }));
    setRefresh((value) => value + 1);
  }

  async function deactivateCategory(id) {
    await api(`/categories/${type}/${id}`, { method: 'DELETE' });
    setRefresh((value) => value + 1);
  }

  if (!month) return <Panel>Select or create a month from the Months tab.</Panel>;
  if (state.loading) return <Panel>Loading budget...</Panel>;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;
  if (!state.data) return <Panel>Loading budget...</Panel>;

  const lines = type === 'expense' ? state.data.budget.expenses : state.data.budget.income;
  const categories = type === 'expense' ? state.data.expenseCategories : state.data.incomeCategories;

  return (
    <section className="panel">
      <div className="section-head">
        <h2>Budget</h2>
        <div className="head-actions">
          <span className="num">{money(sum(lines, 'actual_amount'), currency)} actual</span>
          <Segmented
            value={type}
            onChange={setType}
            options={[
              { value: 'expense', label: 'Expenses' },
              { value: 'income', label: 'Income' }
            ]}
          />
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="empty-state">No {type} categories budgeted yet. Add one below to get started.</p>
      ) : (
        <BudgetTable type={type} lines={lines} currency={currency} onSave={saveLine} />
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
              placeholder={`New ${type} category`}
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
                  <button className="row-delete" title="Deactivate category" onClick={() => deactivateCategory(category.id)}>
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

function BudgetTable({ type, lines, currency, onSave }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Planned</th>
            <th>Actual</th>
            <th>{type === 'expense' ? 'Remaining' : 'Difference'}</th>
            <th>% used</th>
            <th>Recurring</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const over = type === 'expense' && line.actual_amount > line.planned_amount;
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
                <td>{money(type === 'expense' ? line.remaining : line.difference, currency)}</td>
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

function AddTransactionForm({ isExpense, categories, month, onDone }) {
  const [form, setForm] = useState({
    date: todayISO(),
    description: '',
    amount: '',
    category_id: categories[0]?.id || ''
  });

  async function submit() {
    if (!form.amount || !form.description) return;
    const path = isExpense ? '/transactions/expenses' : '/transactions/income';
    const body = isExpense
      ? {
          month_id: month.id,
          transaction_date: form.date,
          description: form.description,
          price: form.amount,
          category_id: Number(form.category_id)
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
      <input
        type="number"
        min="0"
        step="0.01"
        value={form.amount}
        placeholder="Amount"
        onChange={(event) => setForm({ ...form, amount: event.target.value })}
        onKeyDown={(event) => event.key === 'Enter' && submit()}
      />
      <select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <button className="primary" onClick={submit}>
        Save
      </button>
    </div>
  );
}

function TransactionTable({ isExpense, rows, categories, currency, flipSort, onChange }) {
  const [editing, setEditing] = useState(null);

  async function saveEdit() {
    const path = isExpense ? `/transactions/expenses/${editing.id}` : `/transactions/income/${editing.id}`;
    const body = isExpense
      ? {
          transaction_date: editing.date,
          description: editing.description,
          price: editing.amount,
          category_id: Number(editing.category_id)
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
            <th><button onClick={() => flipSort(isExpense ? 'price' : 'amount')}>Amount</button></th>
            <th><button onClick={() => flipSort('category')}>Category</button></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowDescription = isExpense ? row.description : row.source_name;
            const rowAmount = isExpense ? row.price : row.amount;
            const isEditing = editing?.id === row.id;
            return (
              <tr key={row.id} className={isEditing ? 'editing' : ''}>
                <td>
                  {isEditing ? (
                    <input type="date" value={editing.date} onChange={(event) => setEditing({ ...editing, date: event.target.value })} />
                  ) : row.date}
                </td>
                <td>
                  {isEditing ? (
                    <input value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} />
                  ) : rowDescription}
                </td>
                <td>
                  {isEditing ? (
                    <input type="number" min="0" step="0.01" value={editing.amount} onChange={(event) => setEditing({ ...editing, amount: event.target.value })} />
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
                <td className="row-actions">
                  {isEditing ? (
                    <button className="icon-button primary" title="Save" onClick={saveEdit}>
                      <Save size={15} />
                    </button>
                  ) : (
                    <button
                      className="row-edit"
                      onClick={() =>
                        setEditing({
                          id: row.id,
                          date: row.date,
                          description: rowDescription,
                          amount: rowAmount,
                          category_id: row.category_id
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
              strokeDasharray="6 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="chart-legend">
          <span><i className="legend-line actual" />Actual</span>
          <span><i className="legend-line expected" />Expected 12-month forecast</span>
        </div>
      </section>

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
