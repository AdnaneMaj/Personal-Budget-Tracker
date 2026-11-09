import CategoryIcon from "./CategoryIcon.jsx";
import { Input } from "./ui.jsx";

import { money } from "../lib/format.js";

export default function BudgetTable({ lines, currency, onSave }) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Budget table"
      className="table-wrap"
    >
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th className="num">Planned</th>
            <th className="num">Actual</th>
            <th className="num">Remaining</th>
            <th className="num">% used</th>
            <th>Recurring</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const over = line.actual_amount > line.planned_amount;
            return (
              <tr key={line.id} className={over ? "over-budget" : ""}>
                <td>
                  <span className="category-icon" aria-hidden="true">
                    <CategoryIcon
                      category={line.category_name}
                      icon={line.icon}
                    />
                  </span>
                  {line.category_name}
                  {!line.is_active && <span className="muted"> inactive</span>}
                </td>
                <td className="num">
                  <Input
                    aria-label={`Planned amount for ${line.category_name}`}
                    className="amount-input"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={line.planned_amount}
                    onBlur={(event) =>
                      onSave(line, { planned_amount: event.target.value })
                    }
                  />
                </td>
                <td className="num">{money(line.actual_amount, currency)}</td>
                <td className="num">{money(line.remaining, currency)}</td>
                <td className="num">
                  <div className="progress">
                    <span
                      className={over ? "over" : ""}
                      style={{ width: `${Math.min(line.percent_used, 140)}%` }}
                    />
                  </div>
                  {Math.round(line.percent_used)}%
                </td>
                <td>
                  <Input
                    aria-label={`Recurring budget for ${line.category_name}`}
                    type="checkbox"
                    checked={line.is_recurring}
                    onChange={(event) =>
                      onSave(line, { is_recurring: event.target.checked })
                    }
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
