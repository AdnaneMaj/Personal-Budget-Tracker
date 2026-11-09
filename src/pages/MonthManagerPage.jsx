import { notify } from "../components/Toast.jsx";
import { useState, useEffect } from "react";
import useLoad from "../hooks/useLoad.js";
import { api } from "../lib/api.js";
import { Panel, Button, Select, PageSkeleton } from "../components/ui.jsx";
import { monthLabel, money } from "../lib/format.js";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { monthShortNames } from "../lib/config.js";

export default function MonthManagerPage({
  month,
  currency,
  onSelectMonth,
  onOpenMonth,
  onRefreshMonths,
  monthAction,
  onMonthActionChange,
}) {
  const [refresh, setRefresh] = useState(0);
  const [selectedYear, setSelectedYear] = useState(
    month?.year || new Date().getFullYear(),
  );
  const state = useLoad(() => api("/months/summary"), [refresh]);

  useEffect(() => {
    if (month?.year) setSelectedYear(month.year);
  }, [month?.year]);

  function requestCreateMonth(year, monthNumber) {
    onMonthActionChange({ type: "create", year, monthNumber });
  }

  async function confirmCreateMonth(copyFromPrevious) {
    const target = { year: monthAction.year, month: monthAction.monthNumber };
    const created = await api("/months", {
      method: "POST",
      body: JSON.stringify({ ...target, copyFromPrevious }),
    });
    notify("Changes saved.");
    await onRefreshMonths({ preferredId: created.id });
    onOpenMonth(created);
    onMonthActionChange(null);
    setRefresh((value) => value + 1);
  }

  function requestDeleteMonth(monthToDelete) {
    onMonthActionChange({ type: "delete", targetMonth: monthToDelete });
  }

  async function confirmDeleteMonth() {
    const monthToDelete = monthAction.targetMonth;
    await api(`/months/${monthToDelete.id}`, { method: "DELETE" });
    notify("Deleted successfully.");
    const remaining = await api("/months");
    const preferredId =
      month && monthToDelete.id === month.id ? remaining[0]?.id : month?.id;
    await onRefreshMonths(remaining.length ? { preferredId } : {});
    onMonthActionChange(null);
    setRefresh((value) => value + 1);
  }

  if (state.loading) return <PageSkeleton label="Loading months..." />;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;

  const summaries = state.data;
  const byYearMonth = new Map(
    summaries.map((item) => [`${item.year}-${item.month}`, item]),
  );
  const currentYear = new Date().getFullYear();
  const yearOptions = [
    ...new Set(
      [
        currentYear,
        selectedYear,
        month?.year,
        ...summaries.map((item) => item.year),
      ].filter(Boolean),
    ),
  ].sort((a, b) => b - a);

  return (
    <div className="grid">
      <section className="months-page">
        <div className="section-head">
          <h2>Months</h2>
          <span>
            {month ? `${monthLabel(month)} selected` : "No month selected"}
          </span>
        </div>

        <div className="year-toolbar">
          <Button
            aria-label="Previous year"
            className="icon-button"
            title="Previous year"
            onClick={() => setSelectedYear((year) => year - 1)}
          >
            <ChevronLeft size={17} />
          </Button>
          <Select
            aria-label="Year"
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
          <Button
            aria-label="Next year"
            className="icon-button"
            title="Next year"
            onClick={() => setSelectedYear((year) => year + 1)}
          >
            <ChevronRight size={17} />
          </Button>
        </div>

        {monthAction?.type === "create" && (
          <div className="month-action-panel">
            <div>
              <strong>
                Create{" "}
                {monthLabel({
                  year: monthAction.year,
                  month: monthAction.monthNumber,
                })}
              </strong>
              <p>Choose how to initialize the planned budget for this month.</p>
            </div>
            <div className="month-action-buttons">
              <Button
                className="primary"
                onClick={() => confirmCreateMonth(true)}
              >
                Copy all planned values
              </Button>
              <Button onClick={() => confirmCreateMonth(false)}>
                Recurring only
              </Button>
              <Button
                className="quiet"
                onClick={() => onMonthActionChange(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {monthAction?.type === "delete" && (
          <div className="month-action-panel danger-panel">
            <div>
              <strong>Delete {monthLabel(monthAction.targetMonth)}</strong>
              <p>
                This removes that month's budget lines, expenses, and income
                entries.
              </p>
            </div>
            <div className="month-action-buttons">
              <Button className="danger-button" onClick={confirmDeleteMonth}>
                Delete month
              </Button>
              <Button
                className="quiet"
                onClick={() => onMonthActionChange(null)}
              >
                Cancel
              </Button>
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
                  <div
                    key={`${selectedYear}-${monthNumber}`}
                    className={
                      item
                        ? `month-card ${isSelected ? "selected" : ""}`
                        : "month-card empty"
                    }
                    role="listitem"
                  >
                    <Button
                      className="month-card-main"
                      onClick={() =>
                        item
                          ? onOpenMonth(item)
                          : requestCreateMonth(selectedYear, monthNumber)
                      }
                    >
                      <span className="month-card-head">
                        <strong>{name}</strong>
                        {item ? (
                          <span>{item.status}</span>
                        ) : (
                          <span>Create</span>
                        )}
                      </span>
                      {item ? (
                        <>
                          <span className="month-metric">
                            <span>In</span>
                            <strong className="num">
                              {money(item.income_actual, currency)}
                            </strong>
                          </span>
                          <span className="month-metric">
                            <span title="Full amount of expenses recorded in this month">
                              Real out
                            </span>
                            <strong className="num">
                              {money(item.expense_actual, currency)}
                            </strong>
                          </span>
                          <span className="month-metric">
                            <span title="Monthly spending with purchases spread across their selected months">
                              Calculated out
                            </span>
                            <strong className="num">
                              {money(item.calculated_expenses, currency)}
                            </strong>
                          </span>
                          <span
                            className={`month-metric ${savings >= 0 ? "positive" : "negative"}`}
                          >
                            <span>Save</span>
                            <strong className="num">
                              {money(savings, currency)}
                            </strong>
                          </span>
                          <span className="month-foot">
                            {item.expense_count + item.income_count} entries
                          </span>
                        </>
                      ) : (
                        <span className="month-empty-text">No record</span>
                      )}
                    </Button>
                    {item && (
                      <Button
                        className="month-delete"
                        aria-label={`Delete ${name} ${selectedYear}`}
                        title="Delete month"
                        onClick={(event) => {
                          event.stopPropagation();
                          requestDeleteMonth(item);
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
