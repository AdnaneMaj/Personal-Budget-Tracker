import { notify } from "../Toast.jsx";
import { Button, Input, Select } from "../ui.jsx";
import { useState } from "react";
import { divideAmount, multiplyAmount } from "../../lib/transactions.js";
import { api } from "../../lib/api.js";
import { dateOnly, money } from "../../lib/format.js";
import { Save, X, Trash2 } from "lucide-react";

export default function TransactionTable({
  isExpense,
  rows,
  categories,
  currency,
  flipSort,
  onChange,
}) {
  const [editing, setEditing] = useState(null);

  function updateEditingCost(patch) {
    setEditing((current) => {
      const next = { ...current, ...patch };
      if (!isExpense) return next;
      if (Object.prototype.hasOwnProperty.call(patch, "amount")) {
        next.unitPrice = divideAmount(next.amount, next.quantity);
      } else {
        next.amount = multiplyAmount(next.quantity, next.unitPrice);
      }
      return next;
    });
  }

  async function saveEdit() {
    const path = isExpense
      ? `/transactions/expenses/${editing.id}`
      : `/transactions/income/${editing.id}`;
    const body = isExpense
      ? {
          transaction_date: editing.date,
          description: editing.description,
          quantity: editing.quantity,
          unit_price: editing.unitPrice,
          price: editing.amount,
          category_id: Number(editing.category_id),
          budget_treatment: editing.budgetTreatment,
          spread_months:
            editing.budgetTreatment === "spread"
              ? Number(editing.spreadMonths)
              : null,
        }
      : {
          entry_date: editing.date,
          source_name: editing.description,
          amount: editing.amount,
          category_id: Number(editing.category_id),
        };
    await api(path, { method: "PATCH", body: JSON.stringify(body) });
    notify("Changes saved.");
    setEditing(null);
    onChange();
  }

  async function deleteRow(id) {
    const path = isExpense
      ? `/transactions/expenses/${id}`
      : `/transactions/income/${id}`;
    await api(path, { method: "DELETE" });
    notify("Deleted successfully.");
    onChange();
  }

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Transactions table"
      className="table-wrap"
    >
      <table>
        <thead>
          <tr>
            <th>
              <Button onClick={() => flipSort("date")}>Date</Button>
            </th>
            <th>
              <Button
                onClick={() => flipSort(isExpense ? "description" : "source")}
              >
                {isExpense ? "Product" : "Source"}
              </Button>
            </th>
            {isExpense && (
              <th className="num">
                <Button onClick={() => flipSort("quantity")}>Qty</Button>
              </th>
            )}
            {isExpense && (
              <th className="num">
                <Button onClick={() => flipSort("unit_price")}>Unit</Button>
              </th>
            )}
            <th className="num">
              <Button onClick={() => flipSort(isExpense ? "price" : "amount")}>
                Amount
              </Button>
            </th>
            <th>
              <Button onClick={() => flipSort("category")}>Category</Button>
            </th>
            {isExpense && <th>Treatment</th>}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowDescription = isExpense
              ? row.description
              : row.source_name;
            const rowDate = dateOnly(row.date);
            const rowQuantity = isExpense ? row.quantity : null;
            const rowUnitPrice = isExpense ? row.unit_price : null;
            const rowAmount = isExpense ? row.price : row.amount;
            const rowBudgetTreatment = isExpense ? row.budget_treatment : null;
            const rowSpreadMonths = isExpense ? row.spread_months : null;
            const isEditing = editing?.id === row.id;
            return (
              <tr key={row.id} className={isEditing ? "editing" : ""}>
                <td>
                  {isEditing ? (
                    <Input
                      aria-label="Date"
                      type="date"
                      value={dateOnly(editing.date)}
                      onChange={(event) =>
                        setEditing({ ...editing, date: event.target.value })
                      }
                    />
                  ) : (
                    rowDate
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <Input
                      aria-label="Description"
                      value={editing.description}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          description: event.target.value,
                        })
                      }
                    />
                  ) : (
                    rowDescription
                  )}
                </td>
                {isExpense && (
                  <td className="num">
                    {isEditing ? (
                      <Input
                        aria-label="Quantity"
                        inputMode="decimal"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={editing.quantity}
                        onChange={(event) =>
                          updateEditingCost({ quantity: event.target.value })
                        }
                      />
                    ) : (
                      rowQuantity
                    )}
                  </td>
                )}
                {isExpense && (
                  <td className="num">
                    {isEditing ? (
                      <Input
                        aria-label="Unit price"
                        inputMode="decimal"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editing.unitPrice}
                        onChange={(event) =>
                          updateEditingCost({ unitPrice: event.target.value })
                        }
                      />
                    ) : (
                      money(rowUnitPrice, currency)
                    )}
                  </td>
                )}
                <td className="num">
                  {isEditing ? (
                    <Input
                      aria-label="Amount"
                      inputMode="decimal"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editing.amount}
                      onChange={(event) =>
                        updateEditingCost({ amount: event.target.value })
                      }
                    />
                  ) : (
                    money(rowAmount, currency)
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <Select
                      aria-label="Category"
                      value={editing.category_id}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          category_id: event.target.value,
                        })
                      }
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    row.category_name
                  )}
                </td>
                {isExpense && (
                  <td className="num">
                    {isEditing ? (
                      <>
                        <Select
                          aria-label="Budget treatment"
                          value={editing.budgetTreatment}
                          onChange={(event) =>
                            setEditing({
                              ...editing,
                              budgetTreatment: event.target.value,
                            })
                          }
                        >
                          <option value="normal">Normal</option>
                          <option value="spread">Spread expense</option>
                        </Select>
                        {editing.budgetTreatment === "spread" && (
                          <Input
                            inputMode="decimal"
                            aria-label="Spread period in months"
                            type="number"
                            min="1"
                            step="1"
                            value={editing.spreadMonths}
                            title="Spread period in months"
                            onChange={(event) =>
                              setEditing({
                                ...editing,
                                spreadMonths: event.target.value,
                              })
                            }
                          />
                        )}
                      </>
                    ) : rowBudgetTreatment === "spread" ? (
                      `Spread / ${rowSpreadMonths} mo`
                    ) : (
                      "Normal"
                    )}
                  </td>
                )}
                <td className="row-actions">
                  {isEditing ? (
                    <>
                      <Button
                        aria-label="Save"
                        className="icon-button primary"
                        title="Save"
                        onClick={saveEdit}
                      >
                        <Save size={15} />
                      </Button>
                      <Button
                        aria-label="Cancel edit"
                        className="icon-button"
                        title="Cancel edit"
                        onClick={() => setEditing(null)}
                      >
                        <X size={15} />
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="row-edit"
                      onClick={() =>
                        setEditing({
                          id: row.id,
                          date: rowDate,
                          description: rowDescription,
                          quantity: rowQuantity,
                          unitPrice:
                            rowUnitPrice ??
                            divideAmount(rowAmount, rowQuantity || 1),
                          amount: rowAmount,
                          category_id: row.category_id,
                          budgetTreatment: rowBudgetTreatment || "normal",
                          spreadMonths: rowSpreadMonths || "12",
                        })
                      }
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    aria-label="Delete"
                    className="row-delete"
                    title="Delete"
                    onClick={() => deleteRow(row.id)}
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
  );
}
