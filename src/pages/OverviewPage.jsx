import useLoad from "../hooks/useLoad.js";
import { api } from "../lib/api.js";
import { Button, Panel, PageSkeleton, EmptyState } from "../components/ui.jsx";
import { ArrowUpRight } from "lucide-react";
import { money, monthLabel } from "../lib/format.js";
import { buildOverview } from "../lib/overview.js";
import SpendingPattern from "../components/overview/SpendingPattern.jsx";
import CategoryAnalysis from "../components/overview/CategoryAnalysis.jsx";
import "../components/overview/overview.css";

export default function OverviewPage({ month, currency }) {
  const state = useLoad(
    () => (month ? api(`/dashboard/${month.id}`) : Promise.resolve(null)),
    [month?.id],
  );

  if (!month)
    return (
      <EmptyState title="Start with a month">
        Choose a month to see the full picture of your spending.
      </EmptyState>
    );
  if (state.loading || (!state.data && !state.error))
    return <PageSkeleton label="Putting your month in perspective..." />;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;

  const m = buildOverview(state.data, month);
  const openBudget = () =>
    document.querySelector('[data-nav="budget"]')?.click();
  const openTransactions = () =>
    document.querySelector('[data-nav="transactions"]')?.click();
  const periodLabel =
    m.period === "current"
      ? `Month to date · ${m.elapsedDays} of ${m.daysInMonth} days`
      : m.period === "past"
        ? "Full recorded month"
        : "Upcoming month";

  return (
    <div className="insight-overview">
      <div className="overview-page-heading">
        <div>
          <h2>{monthLabel(month)}</h2>
          <span className="overview-kicker">{periodLabel}</span>
        </div>
        <Button className="overview-ledger-link" onClick={openTransactions}>
          Open your ledger
          <ArrowUpRight size={16} />
        </Button>
      </div>

      <dl className="overview-spending-summary" aria-label="Spending summary">
        <div>
          <dt>Real out</dt>
          <dd className="num">{money(m.cash, currency)}</dd>
        </div>
        <div>
          <dt>Calculated out</dt>
          <dd className="num">{money(m.calculated, currency)}</dd>
        </div>
      </dl>

      <div className="overview-main-charts">
        <SpendingPattern model={m} month={month} currency={currency} />
        <CategoryAnalysis
          model={m}
          currency={currency}
          openTransactions={openTransactions}
          openBudget={openBudget}
        />
      </div>

      <p className="overview-data-note">
        Real out counts full payments. Calculated out includes monthly spread
        shares.
        {m.futureEntries
          ? " This month includes future-dated entries, so no pace estimate is shown."
          : ""}
      </p>
    </div>
  );
}
