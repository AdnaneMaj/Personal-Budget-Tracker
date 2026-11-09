import { notify } from "./Toast.jsx";
import { useState } from "react";
import useLoad from "../hooks/useLoad.js";
import { api } from "../lib/api.js";
import { Panel, Button, PageSkeleton } from "./ui.jsx";
import { dateOnly, money } from "../lib/format.js";
import ZakatNisabCard from "./ZakatNisabCard.jsx";
import { zakatEventLabels } from "../lib/config.js";

export default function ZakatSection({ currency }) {
  const [refresh, setRefresh] = useState(0);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const state = useLoad(() => api("/zakat"), [refresh]);

  async function markPaid() {
    setPaying(true);
    setError("");
    try {
      await api("/zakat/pay", { method: "POST" });
      notify("Changes saved.");
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setPaying(false);
    }
  }

  if (state.loading) return <PageSkeleton label="Loading zakat..." />;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;
  if (!state.data) return <PageSkeleton label="Loading zakat..." />;

  const zakatEvents = [
    ...(state.data.calculations.gold.events || []),
    ...(state.data.calculations.silver.events || []),
  ].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || a.standard.localeCompare(b.standard),
  );
  const dueNow = Number(
    state.data.due_now ??
      Math.max(
        Number(state.data.calculations.gold.zakat_due_amount || 0),
        Number(state.data.calculations.silver.zakat_due_amount || 0),
      ),
  );

  return (
    <section className="panel zakat-panel">
      <div className="section-head">
        <h2>Zakat</h2>
        <span className="muted">
          Initial anchor {dateOnly(state.data.settings.gold_anchor_date)} ·
          354-day haul
        </span>
      </div>

      <div className="zakat-summary">
        <div>
          <span>Due now</span>
          <strong className="num">{money(dueNow, currency)}</strong>
          <Button
            className="status-pill paid"
            disabled={!state.data.has_unpaid_zakat || paying}
            onClick={markPaid}
          >
            {state.data.has_unpaid_zakat
              ? paying
                ? "Saving..."
                : "Mark paid"
              : "Paid"}
          </Button>
        </div>
      </div>
      {error && <p className="parse-error">{error}</p>}

      <div className="zakat-cards">
        <ZakatNisabCard
          calculation={state.data.calculations.gold}
          currency={currency}
        />
        <ZakatNisabCard
          calculation={state.data.calculations.silver}
          currency={currency}
        />
      </div>

      <p className="zakat-refresh-note">
        {state.data.price_refresh.configured
          ? "Gold and silver prices refresh automatically once per day at midnight."
          : "Add GOLDAPI_KEY to enable automatic daily gold and silver price updates."}
      </p>

      <div className="zakat-event-log">
        <div className="section-head">
          <h3>Zakat events</h3>
        </div>
        {zakatEvents.length === 0 ? (
          <p className="empty-state">No zakat events recorded yet.</p>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-label="Zakat events"
            className="table-wrap"
          >
            <table className="zakat-event-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Standard</th>
                  <th>Event</th>
                  <th className="num">Savings</th>
                  <th>Nisab</th>
                  <th className="num">Amount</th>
                  <th>Paid</th>
                  <th>Anchor</th>
                </tr>
              </thead>
              <tbody>
                {zakatEvents.map((event, index) => (
                  <tr
                    key={`${event.standard}-${event.type}-${event.date}-${index}`}
                  >
                    <td>{dateOnly(event.date)}</td>
                    <td>{event.standard}</td>
                    <td>
                      <span className={`event-pill ${event.type}`}>
                        {zakatEventLabels[event.type] ||
                          event.title ||
                          event.type}
                      </span>
                    </td>
                    <td className="num">
                      {event.savings == null
                        ? "-"
                        : money(event.savings, currency)}
                    </td>
                    <td className="num">
                      {event.nisab == null ? "-" : money(event.nisab, currency)}
                    </td>
                    <td className="num">
                      {event.amount_due == null
                        ? "-"
                        : money(event.amount_due, currency)}
                    </td>
                    <td>
                      {event.amount_due == null
                        ? "-"
                        : event.paid
                          ? "Yes"
                          : "No"}
                    </td>
                    <td>{event.anchor_date || "-"}</td>
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
        <div
          tabIndex={0}
          role="region"
          aria-label="Metal price history"
          className="table-wrap"
        >
          <table className="zakat-price-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">Gold / gram</th>
                <th className="num">Gold nisab</th>
                <th className="num">Silver / gram</th>
                <th className="num">Silver nisab</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {state.data.prices.map((row) => (
                <tr key={row.id}>
                  <td>{dateOnly(row.entry_date)}</td>
                  <td className="num">
                    {row.gold_price_per_gram == null
                      ? "-"
                      : money(row.gold_price_per_gram, currency)}
                  </td>
                  <td className="num">
                    {row.gold_price_per_gram == null
                      ? "-"
                      : money(row.gold_price_per_gram * 85, currency)}
                  </td>
                  <td className="num">
                    {row.silver_price_per_gram == null
                      ? "-"
                      : money(row.silver_price_per_gram, currency)}
                  </td>
                  <td className="num">
                    {row.silver_price_per_gram == null
                      ? "-"
                      : money(row.silver_price_per_gram * 595, currency)}
                  </td>
                  <td>{row.source || "goldapi"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
