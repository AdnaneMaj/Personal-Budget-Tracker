import CategoryIcon from "../components/CategoryIcon.jsx";
import { notify } from "../components/Toast.jsx";
import { useState } from "react";
import {
  categoryEmojiFallbacks,
  categoryEmojiOptions,
} from "../lib/categories.jsx";
import useLoad from "../hooks/useLoad.js";
import { api } from "../lib/api.js";
import {
  Panel,
  Button,
  Input,
  Select,
  PageSkeleton,
  EmptyState,
  FormFields,
} from "../components/ui.jsx";
import { money, sum } from "../lib/format.js";
import BudgetTable from "../components/BudgetTable.jsx";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

export default function BudgetPage({ month, currency }) {
  const [refresh, setRefresh] = useState(0);
  const [showCategories, setShowCategories] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: "",
    icon: categoryEmojiFallbacks.food,
  });

  const state = useLoad(async () => {
    if (!month) return null;
    const [budget, expenseCategories] = await Promise.all([
      api(`/budget/${month.id}`),
      api("/categories/expense"),
    ]);
    return { budget, expenseCategories };
  }, [month?.id, refresh]);

  async function saveLine(line, patch) {
    await api(`/budget-lines/${line.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    notify("Changes saved.");
    setRefresh((value) => value + 1);
  }

  async function addCategory() {
    const name = newCategory.name.trim();
    if (!name) return;
    await api("/categories/expense", {
      method: "POST",
      body: JSON.stringify({ name, icon: newCategory.icon }),
    });
    notify("Changes saved.");
    setNewCategory((current) => ({ ...current, name: "" }));
    setRefresh((value) => value + 1);
  }

  async function deactivateCategory(id) {
    await api(`/categories/expense/${id}`, { method: "DELETE" });
    notify("Deleted successfully.");
    setRefresh((value) => value + 1);
  }

  if (!month)
    return (
      <EmptyState title="Make room for a new month">
        Choose a month to see your ledger.
      </EmptyState>
    );
  if (state.loading) return <PageSkeleton label="Loading budget..." />;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;
  if (!state.data) return <PageSkeleton label="Loading budget..." />;

  const lines = state.data.budget.expenses;
  const categories = state.data.expenseCategories;

  return (
    <section className="panel">
      <div className="section-head">
        <h2>Budget</h2>
        <div className="head-actions">
          <span className="num">
            {money(sum(lines, "actual_amount"), currency)} actual
          </span>
        </div>
      </div>

      {lines.length === 0 ? (
        <EmptyState
          title="Give your spending a plan"
          actionLabel="Add a category"
          onAction={() => setShowCategories(true)}
        >
          Start with a category, then set an amount that works for you.
        </EmptyState>
      ) : (
        <BudgetTable lines={lines} currency={currency} onSave={saveLine} />
      )}

      <Button
        className="text-toggle"
        onClick={() => setShowCategories((value) => !value)}
      >
        <ChevronDown
          size={15}
          className={showCategories ? "chev open" : "chev"}
        />
        {showCategories ? "Hide categories" : "Manage categories"}
      </Button>

      {showCategories && (
        <div className="drawer">
          <FormFields className="inline-form">
            <Select
              className="emoji-select"
              value={newCategory.icon}
              aria-label="Category emoji"
              onChange={(event) =>
                setNewCategory((current) => ({
                  ...current,
                  icon: event.target.value,
                }))
              }
            >
              {categoryEmojiOptions.map((emoji) => (
                <option key={emoji} value={emoji}>
                  {emoji}
                </option>
              ))}
            </Select>
            <Input
              required
              aria-label="New expense category"
              value={newCategory.name}
              placeholder="New expense category"
              onChange={(event) =>
                setNewCategory((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              onKeyDown={(event) => event.key === "Enter" && addCategory()}
            />
            <Button
              aria-label="Add category"
              className="icon-button primary"
              title="Add category"
              onClick={addCategory}
            >
              <Plus size={16} />
            </Button>
          </FormFields>
          <div className="category-list">
            {categories.map((category) => (
              <div
                key={category.id}
                className={
                  !category.is_active ? "inactive category-row" : "category-row"
                }
              >
                <span className="category-icon" aria-hidden="true">
                  <CategoryIcon category={category} />
                </span>
                <span>{category.name}</span>
                {category.is_active && (
                  <Button
                    aria-label="Remove category"
                    className="row-delete"
                    title="Remove category"
                    onClick={() => deactivateCategory(category.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
