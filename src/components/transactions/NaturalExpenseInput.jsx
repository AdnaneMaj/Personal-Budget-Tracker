import { notify } from "../Toast.jsx";
import { Button, Input, Select } from "../ui.jsx";
import { useState } from "react";
import { api } from "../../lib/api.js";
import {
  multiplyAmount,
  divideAmount,
  draftMemoryStatus,
} from "../../lib/transactions.js";
import { Trash2 } from "lucide-react";
import { money } from "../../lib/format.js";

export default function NaturalExpenseInput({
  categories,
  month,
  currency,
  onDone,
}) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function parseText() {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const parsed = await api("/transactions/expenses/parse", {
        method: "POST",
        body: JSON.stringify({
          month_id: month.id,
          text,
          time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      setProvider(parsed.provider || "");
      setWarnings(parsed.warnings || []);
      setDrafts(
        (parsed.items || []).map((item, index) => ({
          id: `${Date.now()}-${index}`,
          date: item.transaction_date || "",
          productName: item.product_name || "",
          productAlias: item.input_name || item.product_name || "",
          productId: item.product_id || null,
          productMatch: item.product_match || "new",
          quantity: String(item.quantity || 1),
          unitPrice:
            item.unit_price === null || item.unit_price === undefined
              ? ""
              : String(item.unit_price),
          amount:
            item.unit_price === null || item.unit_price === undefined
              ? ""
              : multiplyAmount(item.quantity || 1, item.unit_price),
          priceSource: item.price_source || "missing",
          category_id: item.category_id ? String(item.category_id) : "",
          budgetTreatment: "normal",
          spreadMonths: "12",
          confidence: Number(item.confidence || 0),
        })),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function updateDraft(id, patch) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function updateDraftProduct(id, productName) {
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== id) return draft;
        const usedRememberedPrice = draft.priceSource === "remembered";
        return {
          ...draft,
          productName,
          productAlias: productName,
          productId: null,
          productMatch: "new",
          unitPrice: usedRememberedPrice ? "" : draft.unitPrice,
          amount: usedRememberedPrice ? "" : draft.amount,
          priceSource: usedRememberedPrice ? "missing" : draft.priceSource,
        };
      }),
    );
  }

  function updateDraftCost(id, patch) {
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== id) return draft;
        const next = { ...draft, ...patch };
        if (Object.prototype.hasOwnProperty.call(patch, "amount")) {
          next.unitPrice = divideAmount(next.amount, next.quantity);
          next.priceSource = "user";
        } else {
          next.amount = multiplyAmount(next.quantity, next.unitPrice);
          if (Object.prototype.hasOwnProperty.call(patch, "unitPrice"))
            next.priceSource = "user";
        }
        return next;
      }),
    );
  }

  function removeDraft(id) {
    setDrafts((current) => current.filter((draft) => draft.id !== id));
  }

  async function saveDrafts() {
    const validDrafts = drafts.filter(
      (draft) =>
        draft.productName.trim() &&
        draft.date &&
        draft.amount !== "" &&
        draft.unitPrice !== "" &&
        Number(draft.amount) >= 0 &&
        Number(draft.quantity) > 0 &&
        Number(draft.unitPrice) >= 0 &&
        (draft.budgetTreatment !== "spread" ||
          (Number.isInteger(Number(draft.spreadMonths)) &&
            Number(draft.spreadMonths) > 0)) &&
        draft.category_id,
    );
    if (validDrafts.length !== drafts.length || validDrafts.length === 0) {
      setError(
        "Review every draft row before saving. Date, product name, quantity, unit price, amount, category, and spread period are required.",
      );
      return;
    }

    setBusy(true);
    setError("");
    try {
      await api("/transactions/expenses/bulk", {
        method: "POST",
        body: JSON.stringify({
          transactions: validDrafts.map((draft) => ({
            month_id: month.id,
            transaction_date: draft.date,
            description: draft.productName,
            product_id: draft.productId,
            product_alias: draft.productAlias,
            quantity: draft.quantity,
            unit_price: draft.unitPrice,
            price: draft.amount,
            category_id: Number(draft.category_id),
            budget_treatment: draft.budgetTreatment,
            spread_months:
              draft.budgetTreatment === "spread"
                ? Number(draft.spreadMonths)
                : null,
          })),
        }),
      });
      notify("Changes saved.");
      setText("");
      setDrafts([]);
      setWarnings([]);
      setProvider("");
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="natural-expense">
      <div className="composer-heading">
        <span className="eyebrow">Less typing, more living</span>
        <h2>What did you spend?</h2>
        <p>Write it as you remember it. Review every detail before saving.</p>
      </div>
      <div className="natural-expense-input">
        <textarea
          id="expense-text"
          aria-label="Describe your expenses"
          aria-describedby="expense-text-help"
          value={text}
          placeholder="Yesterday, coffee 12dh, groceries 85dh, and a taxi home for 25dh…"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              parseText();
            }
          }}
          rows={3}
        />
        <Button
          className="primary"
          onClick={parseText}
          disabled={busy || !text.trim()}
        >
          {busy ? "Preparing your draft…" : "Create draft"}
        </Button>
      </div>
      <p className="composer-help" id="expense-text-help">
        <span>
          Include a date and the prices. You can always edit the draft.
        </span>
        <span>
          <kbd>Enter</kbd> to draft <span aria-hidden="true">·</span>{" "}
          <kbd>Shift + Enter</kbd> new line
        </span>
      </p>
      {provider && (
        <p className="parse-provider">
          Drafted with {provider === "local" ? "local parser" : provider}
        </p>
      )}
      {error && <p className="parse-error">{error}</p>}
      {warnings.length > 0 && (
        <div className="parse-warnings">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
      {drafts.length > 0 && (
        <div className="draft-review">
          <div className="draft-review-head">
            <h3>Review your draft</h3>
            <Button className="primary" onClick={saveDrafts} disabled={busy}>
              Save all
            </Button>
          </div>
          <div
            tabIndex={0}
            role="region"
            aria-label="Draft review"
            className="table-wrap"
          >
            <table className="draft-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit price</th>
                  <th className="num">Amount</th>
                  <th>Category</th>
                  <th>Treatment</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => {
                  const status = draftMemoryStatus(draft);
                  return (
                    <tr key={draft.id}>
                      <td>
                        <Input
                          aria-label="Date"
                          type="date"
                          value={draft.date}
                          onChange={(event) =>
                            updateDraft(draft.id, { date: event.target.value })
                          }
                        />
                      </td>
                      <td>
                        <Input
                          aria-label="Product"
                          value={draft.productName}
                          onChange={(event) =>
                            updateDraftProduct(draft.id, event.target.value)
                          }
                        />
                      </td>
                      <td className="num">
                        <Input
                          aria-label="Quantity"
                          inputMode="decimal"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={draft.quantity}
                          onChange={(event) =>
                            updateDraftCost(draft.id, {
                              quantity: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="num">
                        <Input
                          aria-label="Unit price"
                          inputMode="decimal"
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.unitPrice}
                          onChange={(event) =>
                            updateDraftCost(draft.id, {
                              unitPrice: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="num">
                        <Input
                          aria-label="Amount"
                          inputMode="decimal"
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.amount}
                          onChange={(event) =>
                            updateDraftCost(draft.id, {
                              amount: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <Select
                          aria-label="Category"
                          value={draft.category_id}
                          onChange={(event) =>
                            updateDraft(draft.id, {
                              category_id: event.target.value,
                            })
                          }
                        >
                          <option value="">Pick category</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="num">
                        <Select
                          aria-label="Budget treatment"
                          value={draft.budgetTreatment}
                          onChange={(event) =>
                            updateDraft(draft.id, {
                              budgetTreatment: event.target.value,
                            })
                          }
                        >
                          <option value="normal">Normal</option>
                          <option value="spread">Spread expense</option>
                        </Select>
                        {draft.budgetTreatment === "spread" && (
                          <Input
                            inputMode="decimal"
                            aria-label="Spread period in months"
                            type="number"
                            min="1"
                            step="1"
                            value={draft.spreadMonths}
                            title="Spread period in months"
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                spreadMonths: event.target.value,
                              })
                            }
                          />
                        )}
                      </td>
                      <td>
                        <span
                          className={
                            status.ready
                              ? "draft-status confident"
                              : "draft-status"
                          }
                        >
                          {status.label}
                        </span>
                      </td>
                      <td>
                        <Button
                          aria-label="Remove draft"
                          className="icon-button"
                          title="Remove draft"
                          onClick={() => removeDraft(draft.id)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="draft-total">
            Draft total:{" "}
            {money(
              drafts.reduce((sum, draft) => sum + Number(draft.amount || 0), 0),
              currency,
            )}
          </p>
        </div>
      )}
    </div>
  );
}
