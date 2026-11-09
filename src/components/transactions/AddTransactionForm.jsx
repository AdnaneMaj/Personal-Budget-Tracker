import { notify } from "../Toast.jsx";
import { Button, Input, Select, FormFields } from "../ui.jsx";
import { useState } from "react";
import { todayISO } from "../../lib/format.js";
import { divideAmount, multiplyAmount } from "../../lib/transactions.js";
import { api } from "../../lib/api.js";

export default function AddTransactionForm({
  isExpense,
  categories,
  month,
  onDone,
}) {
  const [form, setForm] = useState({
    date: todayISO(),
    description: "",
    quantity: "1",
    unitPrice: "",
    amount: "",
    category_id: categories[0]?.id || "",
    budgetTreatment: "normal",
    spreadMonths: "12",
  });

  function updateFormCost(patch) {
    setForm((current) => {
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

  async function submit() {
    if (!form.amount || !form.description) return;
    const path = isExpense ? "/transactions/expenses" : "/transactions/income";
    const body = isExpense
      ? {
          month_id: month.id,
          transaction_date: form.date,
          description: form.description,
          quantity: form.quantity || 1,
          unit_price:
            form.unitPrice || divideAmount(form.amount, form.quantity || 1),
          price: form.amount,
          category_id: Number(form.category_id),
          budget_treatment: form.budgetTreatment,
          spread_months:
            form.budgetTreatment === "spread"
              ? Number(form.spreadMonths)
              : null,
        }
      : {
          month_id: month.id,
          entry_date: form.date,
          source_name: form.description,
          amount: form.amount,
          category_id: Number(form.category_id),
        };
    await api(path, { method: "POST", body: JSON.stringify(body) });
    notify("Changes saved.");
    onDone();
  }

  return (
    <FormFields className="add-form">
      <Input
        label="Date"
        required
        type="date"
        value={form.date}
        onChange={(event) => setForm({ ...form, date: event.target.value })}
      />
      <Input
        label="Description"
        required
        value={form.description}
        placeholder={isExpense ? "Product" : "Source name"}
        onChange={(event) =>
          setForm({ ...form, description: event.target.value })
        }
        autoFocus
      />
      {isExpense && (
        <Input
          label="Quantity"
          required
          inputMode="decimal"
          type="number"
          min="0.01"
          step="0.01"
          value={form.quantity}
          placeholder="Qty"
          onChange={(event) => updateFormCost({ quantity: event.target.value })}
        />
      )}
      {isExpense && (
        <Input
          label="Unit price"
          inputMode="decimal"
          type="number"
          min="0"
          step="0.01"
          value={form.unitPrice}
          placeholder="Unit price"
          onChange={(event) =>
            updateFormCost({ unitPrice: event.target.value })
          }
        />
      )}
      <Input
        label="Amount"
        required
        inputMode="decimal"
        type="number"
        min="0"
        step="0.01"
        value={form.amount}
        placeholder="Amount"
        onChange={(event) =>
          isExpense
            ? updateFormCost({ amount: event.target.value })
            : setForm({ ...form, amount: event.target.value })
        }
        onKeyDown={(event) => event.key === "Enter" && submit()}
      />
      <Select
        label="Category"
        required
        value={form.category_id}
        onChange={(event) =>
          setForm({ ...form, category_id: event.target.value })
        }
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      {isExpense && (
        <Select
          label="Budget treatment"
          value={form.budgetTreatment}
          onChange={(event) =>
            setForm({ ...form, budgetTreatment: event.target.value })
          }
        >
          <option value="normal">Normal</option>
          <option value="spread">Spread expense</option>
        </Select>
      )}
      {isExpense && form.budgetTreatment === "spread" && (
        <Input
          label="Spread over (months)"
          required
          inputMode="decimal"
          aria-label="Spread period in months"
          type="number"
          min="1"
          step="1"
          value={form.spreadMonths}
          placeholder="Months"
          title="Spread period in months"
          onChange={(event) =>
            setForm({ ...form, spreadMonths: event.target.value })
          }
        />
      )}
      <Button className="primary" onClick={submit}>
        Save
      </Button>
    </FormFields>
  );
}
