import { useState } from "react";
import { Button, EmptyState } from "../ui.jsx";
import { money } from "../../lib/format.js";
import { ViewSwitch } from "./OverviewTooltip.jsx";

const views = [
  { value: "ranked", label: "By spending" },
  { value: "budget", label: "Budget check" },
];

export default function CategoryAnalysis({
  model: m,
  currency,
  openTransactions,
  openBudget,
}) {
  const [view, setView] = useState("ranked");
  const [focus, setFocus] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const rows =
    view === "ranked"
      ? m.spendingCategories
      : m.categories.filter((row) => row.actual > 0 || row.planned > 0);
  const maximum = Math.max(
    1,
    ...rows.flatMap((row) => [row.actual, row.planned]),
  );
  const focused = m.categories.find((row) => row.name === focus);
  const visible = showAll ? rows : rows.slice(0, 5);
  return (
    <section
      className="overview-chart-card overview-categories"
      aria-label="Category analysis"
    >
      <div className="overview-card-heading">
        <div>
          <h3>Top expense categories</h3>
          <p>Calculated out, ranked by amount</p>
        </div>
      </div>
      <ViewSwitch
        label="Category chart view"
        options={views}
        value={view}
        onChange={setView}
      />
      {rows.length === 0 ? (
        <EmptyState
          title={
            view === "ranked"
              ? "No expenses recorded yet"
              : "Give your spending a plan"
          }
          actionLabel={view === "ranked" ? "Add an expense" : "Set a budget"}
          onAction={view === "ranked" ? openTransactions : openBudget}
        >
          Record expenses and set category budgets to see where your money goes.
        </EmptyState>
      ) : (
        <>
          <div className="overview-budget-key">
            <span>
              <i />
              Calculated
            </span>
            <span>
              <i className="is-planned" />
              Budget marker
            </span>
            <span>{view === "ranked" ? "% of total" : "Actual / budget"}</span>
          </div>
          <div
            className="overview-category-budgets"
            role="group"
            aria-label="Focus a spending category"
          >
            {visible.map((row) => (
              <button
                type="button"
                key={row.name}
                className={`overview-category-budget ${row.planned > 0 && row.remaining < 0 ? "is-over" : ""}`}
                aria-pressed={focus === row.name}
                onClick={() => setFocus(focus === row.name ? null : row.name)}
              >
                <span className="overview-category-budget-heading">
                  <span>{row.name}</span>
                  <span className="num">
                    <strong>{money(row.actual, currency)}</strong>
                    <small>
                      {view === "ranked"
                        ? `${row.share.toFixed(1)}%`
                        : ` / ${money(row.planned, currency)}`}
                    </small>
                  </span>
                </span>
                <span className="overview-category-bars" aria-hidden="true">
                  <i
                    className="overview-actual-bar"
                    style={{ width: `${(row.actual / maximum) * 100}%` }}
                  />
                  {row.planned > 0 && (
                    <i
                      className="overview-budget-marker"
                      style={{ left: `${(row.planned / maximum) * 100}%` }}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
          {rows.length > 5 && (
            <Button
              className="quiet overview-show-categories"
              onClick={() => setShowAll(!showAll)}
              aria-expanded={showAll}
            >
              {showAll ? "Show top 5" : `Show all ${rows.length} categories`}
            </Button>
          )}
          {focused && focus ? (
            <div className="overview-category-focus">
              <strong>{focused.name}</strong>
              <p>
                {focused.share.toFixed(1)}% of calculated out.{" "}
                {focused.planned > 0
                  ? `${money(Math.abs(focused.remaining), currency)} ${focused.remaining < 0 ? "above" : "left in"} its budget.`
                  : "No budget set for this category."}
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
