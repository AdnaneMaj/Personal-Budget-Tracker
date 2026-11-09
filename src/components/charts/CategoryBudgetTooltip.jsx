import { money } from "../../lib/format.js";

export default function CategoryBudgetTooltip({ active, payload, currency }) {
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
