import { zakatStatusLabels } from "../lib/config.js";
import { money } from "../lib/format.js";

export default function ZakatNisabCard({ calculation, currency }) {
  const status = zakatStatusLabels[calculation.status] || calculation.status;
  return (
    <article className={`zakat-card ${calculation.status}`}>
      <div className="zakat-card-head">
        <div>
          <span>{calculation.standard}</span>
          <strong>{calculation.grams}g nisab</strong>
        </div>
        <em>{status}</em>
      </div>
      <div className="zakat-progress">
        <span
          style={{
            width: `${Math.min((calculation.days_elapsed / 354) * 100, 100)}%`,
          }}
        />
      </div>
      <div className="zakat-metrics">
        <span>
          Current nisab{" "}
          <strong className="num">
            {calculation.current_nisab == null
              ? "-"
              : money(calculation.current_nisab, currency)}
          </strong>
        </span>
        <span>
          Price / gram{" "}
          <strong className="num">
            {calculation.current_price_per_gram == null
              ? "-"
              : money(calculation.current_price_per_gram, currency)}
          </strong>
        </span>
        <span>
          Active anchor <strong>{calculation.active_anchor_date || "-"}</strong>
        </span>
        <span>
          Due date <strong>{calculation.due_date || "-"}</strong>
        </span>
        <span>
          Days <strong className="num">{calculation.days_elapsed} / 354</strong>
        </span>
      </div>
    </article>
  );
}
