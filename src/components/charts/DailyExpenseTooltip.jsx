import CategoryIcon from "../CategoryIcon.jsx";
import { money } from "../../lib/format.js";

export default function DailyExpenseTooltip({
  active,
  payload,
  label,
  currency,
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const isForecast = row.isForecast;
  const categories = (row.expense_categories || []).filter(
    (category) => Number(category.amount) > 0,
  );
  return (
    <div className="chart-tooltip">
      <strong>Day {label}</strong>
      <div className="tooltip-row">
        <span>{isForecast ? "Projected total" : "Accumulated"}</span>
        <span>
          {money(isForecast ? row.forecast_expenses : row.expenses, currency)}
        </span>
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
              <span>
                <CategoryIcon category={category.category_name} />{" "}
                {category.category_name}
              </span>
              <span>{money(category.amount, currency)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
