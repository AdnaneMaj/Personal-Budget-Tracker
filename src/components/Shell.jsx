import { notify } from "./Toast.jsx";
import { Button } from "./ui.jsx";
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { nextMonthValue, monthLabel } from "../lib/format.js";
import OverviewPage from "../pages/OverviewPage.jsx";
import MonthManagerPage from "../pages/MonthManagerPage.jsx";
import BudgetPage from "../pages/BudgetPage.jsx";
import TransactionsPage from "../pages/TransactionsPage.jsx";
import ReceivablesPage from "../pages/ReceivablesPage.jsx";
import SavingsPage from "../pages/SavingsPage.jsx";
import { ChevronLeft, CalendarDays, ChevronRight } from "lucide-react";
import { tabs } from "../lib/config.js";
import Sidebar from "./Sidebar.jsx";
import ThemeSwitcher from "./ThemeSwitcher.jsx";

export default function Shell() {
  const [activeTab, setActiveTab] = useState("overview");
  const [months, setMonths] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(null);
  const [monthAction, setMonthAction] = useState(null);
  const [currency, setCurrency] = useState("MAD");
  const [error, setError] = useState("");

  async function loadMonths(options = {}) {
    const config = await api("/config");
    let refreshed = await api("/months");
    if (refreshed.length === 0) {
      const today = new Date();
      const created = await api("/months", {
        method: "POST",
        body: JSON.stringify({
          year: today.getFullYear(),
          month: today.getMonth() + 1,
          copyFromPrevious: false,
        }),
      });
      notify("Changes saved.");
      refreshed = await api("/months");
      options.preferredId = created.id;
    }

    const savedId =
      options.preferredId ??
      Number(localStorage.getItem("budget:selectedMonthId"));
    const savedMonth = refreshed.find((month) => month.id === savedId);
    const stillSelected = currentMonth
      ? refreshed.find((month) => month.id === currentMonth.id)
      : null;
    const today = new Date();
    const calendarMonth = refreshed.find(
      (month) =>
        month.year === today.getFullYear() &&
        month.month === today.getMonth() + 1,
    );
    const nextSelected =
      savedMonth || stillSelected || calendarMonth || refreshed[0] || null;

    setCurrency(config.currency);
    setMonths(refreshed);
    setCurrentMonth(nextSelected);
  }

  useEffect(() => {
    loadMonths().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (currentMonth?.id) {
      localStorage.setItem("budget:selectedMonthId", String(currentMonth.id));
    } else {
      localStorage.removeItem("budget:selectedMonthId");
    }
  }, [currentMonth]);

  async function moveMonth(offset) {
    if (!currentMonth) {
      setActiveTab("months");
      return;
    }
    const target = nextMonthValue(currentMonth, offset);
    const existing = months.find(
      (month) => month.year === target.year && month.month === target.month,
    );
    if (existing) {
      setCurrentMonth(existing);
      return;
    }

    setMonthAction({
      type: "create",
      year: target.year,
      monthNumber: target.month,
    });
    setActiveTab("months");
  }

  const pages = {
    overview: OverviewPage,
    months: MonthManagerPage,
    budget: BudgetPage,
    transactions: TransactionsPage,
    receivables: ReceivablesPage,
    savings: SavingsPage,
  };
  const Page =
    pages[activeTab] || (currentMonth ? OverviewPage : MonthManagerPage);

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar activeTab={activeTab} onChange={setActiveTab} />
      <div className="workspace">
        <header className="topbar">
          <div className="page-heading">
            <span className="mobile-brand">Ledger</span>
            <span className="header-context">
              Personal ledger <span aria-hidden="true">/</span>
            </span>
            <h1>
              {tabs.find((tab) => tab.id === activeTab)?.label || "Overview"}
            </h1>
          </div>
          <div className="header-actions">
            <div className="month-switcher">
              <Button
                aria-label="Previous month"
                className="icon-button"
                title="Previous month"
                onClick={() => moveMonth(-1)}
              >
                <ChevronLeft size={18} />
              </Button>
              <Button
                className="current-month-pill"
                onClick={() => setActiveTab("months")}
              >
                <CalendarDays size={16} />
                {currentMonth ? monthLabel(currentMonth) : "No month selected"}
              </Button>
              <Button
                aria-label="Next month"
                className="icon-button"
                title="Next month"
                onClick={() => moveMonth(1)}
              >
                <ChevronRight size={18} />
              </Button>
            </div>
            <ThemeSwitcher />
          </div>
        </header>

        <main className="main-content" id="main-content" tabIndex={-1}>
          {error && <div className="error">{error}</div>}
          <Page
            month={currentMonth}
            months={months}
            currency={currency}
            onSelectMonth={setCurrentMonth}
            onOpenMonth={(selectedMonth) => {
              setCurrentMonth(selectedMonth);
              setActiveTab("overview");
            }}
            onRefreshMonths={loadMonths}
            monthAction={monthAction}
            onMonthActionChange={setMonthAction}
          />
        </main>
      </div>
    </div>
  );
}
