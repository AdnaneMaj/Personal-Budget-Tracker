import { money, monthLabel } from "../../lib/format.js";

export default function OverviewTooltip({ active, payload, kind, currency }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  let title, lines;
  if (kind === "category") {
    title = row.name;
    lines = [
      ["Calculated spending", row.actual],
      ["Planned budget", row.planned],
    ];
  } else if (kind === "history") {
    title = monthLabel(row);
    lines = [
      ["Cash saved / deficit", row.balance],
      ["Total saved through this month", row.running_total],
    ];
  } else {
    title = new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
    }).format(new Date(`${row.date}T12:00:00`));
    lines =
      kind === "cumulative"
        ? [
            [
              row.actual === null ? "Estimated total" : "Recorded total",
              row.actual ?? row.forecast,
            ],
            ["Even budget pace", row.target],
          ]
        : [
            ["Calculated expenses", row.amount],
            ...(row.income > 0 ? [["Income recorded", row.income]] : []),
          ];
  }
  return (
    <div className="chart-tooltip overview-tooltip">
      <strong>{title}</strong>
      {lines
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([label, value]) => (
          <div className="tooltip-row" key={label}>
            <span>{label}</span>
            <span className="num">{money(value, currency)}</span>
          </div>
        ))}
      {kind === "daily" && row.categories?.length > 0 && (
        <div className="tooltip-breakdown">
          {row.categories.slice(0, 4).map((category) => (
            <div className="tooltip-row" key={category.category_name}>
              <span>{category.category_name}</span>
              <span className="num">{money(category.amount, currency)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ViewSwitch({ label, options, value, onChange }) {
  return (
    <div className="overview-view-switch" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          className={value === option.value ? "selected" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const shortAmount = (value) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value));
export const barRadius = [4, 4, 0, 0];
export const chartMargin = { top: 16, right: 12, bottom: 0, left: -8 };
