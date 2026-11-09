import { useState, useEffect } from "react";
import useLoad from "../hooks/useLoad.js";
import { api } from "../lib/api.js";
import {
  Panel,
  Segmented,
  Button,
  Select,
  PageSkeleton,
  EmptyState,
} from "../components/ui.jsx";
import { Plus } from "lucide-react";
import NaturalExpenseInput from "../components/transactions/NaturalExpenseInput.jsx";
import AddTransactionForm from "../components/transactions/AddTransactionForm.jsx";
import TransactionTable from "../components/transactions/TransactionTable.jsx";
import Drawer from "../components/Drawer.jsx";

export default function TransactionsPage({ month, currency }) {
  const [refresh, setRefresh] = useState(0);
  const [kind, setKind] = useState("expense");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState({ sortBy: "date", sortDir: "desc" });
  const [showAdd, setShowAdd] = useState(false);
  const isExpense = kind === "expense";

  useEffect(() => {
    setFilter("");
    setShowAdd(false);
  }, [kind]);

  const state = useLoad(async () => {
    if (!month) return null;
    const query = new URLSearchParams({ monthId: month.id, ...sort });
    if (filter) query.set("categoryId", filter);
    const [expenseCategories, incomeCategories, rows] = await Promise.all([
      api("/categories/expense"),
      api("/categories/income"),
      api(`/transactions/${isExpense ? "expenses" : "income"}?${query}`),
    ]);
    return { expenseCategories, incomeCategories, rows };
  }, [month?.id, refresh, kind, filter, sort.sortBy, sort.sortDir]);

  if (!month)
    return (
      <EmptyState title="Make room for a new month">
        Choose a month to see your ledger.
      </EmptyState>
    );
  if (state.loading) return <PageSkeleton label="Loading transactions..." />;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;
  if (!state.data) return <PageSkeleton label="Loading transactions..." />;

  const categories = (
    isExpense ? state.data.expenseCategories : state.data.incomeCategories
  ).filter((category) => category.is_active);

  function flipSort(sortBy) {
    setSort((current) => ({
      sortBy,
      sortDir:
        current.sortBy === sortBy && current.sortDir === "desc"
          ? "asc"
          : "desc",
    }));
  }

  return (
    <section className="panel transactions-panel">
      <div className="section-head">
        <h2>Transactions</h2>
        <div className="head-actions">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: "expense", label: "Expenses" },
              { value: "income", label: "Income" },
            ]}
          />
          <Select
            aria-label="Filter by category"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Button
            className="primary"
            onClick={() => setShowAdd((value) => !value)}
          >
            <Plus size={15} /> Add manually
          </Button>
        </div>
      </div>

      {isExpense && (
        <NaturalExpenseInput
          categories={categories}
          month={month}
          currency={currency}
          onDone={() => setRefresh((value) => value + 1)}
        />
      )}

      {showAdd && (
        <Drawer
          title={isExpense ? "Add an expense" : "Add income"}
          description="Enter the details, then save it to your ledger."
          onClose={() => setShowAdd(false)}
        >
          <AddTransactionForm
            isExpense={isExpense}
            categories={categories}
            month={month}
            onDone={() => {
              setShowAdd(false);
              setRefresh((value) => value + 1);
            }}
          />
        </Drawer>
      )}

      {state.data.rows.length === 0 ? (
        <EmptyState
          title={
            filter ? "Nothing in this category yet" : "Your month starts here"
          }
          actionLabel={isExpense ? "Write your first expense" : "Add income"}
          onAction={() =>
            isExpense
              ? document.getElementById("expense-text")?.focus()
              : setShowAdd(true)
          }
        >
          {filter
            ? "Try another category, or add an entry to this one."
            : `No ${isExpense ? "expenses" : "income"} recorded yet. Add one when you’re ready.`}
        </EmptyState>
      ) : (
        <TransactionTable
          isExpense={isExpense}
          rows={state.data.rows}
          categories={categories}
          currency={currency}
          flipSort={flipSort}
          onChange={() => setRefresh((value) => value + 1)}
        />
      )}
    </section>
  );
}
