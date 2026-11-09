import { notify } from "../components/Toast.jsx";
import { useState } from "react";
import useLoad from "../hooks/useLoad.js";
import { api } from "../lib/api.js";
import {
  Panel,
  Button,
  Input,
  Select,
  PageSkeleton,
  FormFields,
} from "../components/ui.jsx";
import { money } from "../lib/format.js";
import { Plus, Save, X, Trash2 } from "lucide-react";

export default function ReceivablesPage({ currency }) {
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState({
    person_name: "",
    description: "",
    amount: "",
    status: "not_yet",
  });
  const [editing, setEditing] = useState(null);
  const state = useLoad(() => api("/receivables"), [refresh]);

  if (state.loading) return <PageSkeleton label="Loading receivables..." />;
  if (state.error) return <Panel tone="error">{state.error}</Panel>;
  if (!state.data) return <PageSkeleton label="Loading receivables..." />;

  const rows = state.data;
  const notYetTotal = rows
    .filter((row) => row.status === "not_yet")
    .reduce((total, row) => total + Number(row.amount), 0);
  const paidTotal = rows
    .filter((row) => row.status === "paid")
    .reduce((total, row) => total + Number(row.amount), 0);

  async function addReceivable() {
    if (!form.person_name.trim() || !form.amount) return;
    await api("/receivables", {
      method: "POST",
      body: JSON.stringify({
        person_name: form.person_name,
        description: form.description,
        amount: form.amount,
        status: form.status,
      }),
    });
    notify("Changes saved.");
    setForm({
      person_name: "",
      description: "",
      amount: "",
      status: "not_yet",
    });
    setRefresh((value) => value + 1);
  }

  async function saveEdit() {
    await api(`/receivables/${editing.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        person_name: editing.person_name,
        description: editing.description,
        amount: editing.amount,
        status: editing.status,
      }),
    });
    notify("Changes saved.");
    setEditing(null);
    setRefresh((value) => value + 1);
  }

  async function updateStatus(row, status) {
    await api(`/receivables/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    notify("Changes saved.");
    setRefresh((value) => value + 1);
  }

  async function deleteReceivable(id) {
    await api(`/receivables/${id}`, { method: "DELETE" });
    notify("Deleted successfully.");
    setRefresh((value) => value + 1);
  }

  return (
    <section className="panel">
      <div className="section-head">
        <h2>Receivable</h2>
        <div className="receivable-summary">
          <span>
            <strong className="num">{money(notYetTotal, currency)}</strong> not
            yet
          </span>
          <span>
            <strong className="num">{money(paidTotal, currency)}</strong> paid
          </span>
        </div>
      </div>

      <FormFields className="add-form receivable-form">
        <Input
          aria-label="Person"
          value={form.person_name}
          required
          placeholder="Person"
          onChange={(event) =>
            setForm({ ...form, person_name: event.target.value })
          }
          autoFocus
        />
        <Input
          aria-label="Description"
          value={form.description}
          placeholder="What for"
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
        />
        <Input
          aria-label="Amount"
          inputMode="decimal"
          type="number"
          min="0"
          step="0.01"
          value={form.amount}
          required
          placeholder="Amount"
          onChange={(event) => setForm({ ...form, amount: event.target.value })}
          onKeyDown={(event) => event.key === "Enter" && addReceivable()}
        />
        <Select
          aria-label="Status"
          value={form.status}
          onChange={(event) => setForm({ ...form, status: event.target.value })}
        >
          <option value="not_yet">Not yet</option>
          <option value="paid">Paid</option>
        </Select>
        <Button className="primary" onClick={addReceivable}>
          <Plus size={15} /> Add
        </Button>
      </FormFields>

      {rows.length === 0 ? (
        <EmptyState
          title="All settled up"
          actionLabel="Add a receivable"
          onAction={() =>
            document.querySelector(".receivable-form input")?.focus()
          }
        >
          Keep track of money owed to you. Add a person and an amount above.
        </EmptyState>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label="Receivables table"
          className="table-wrap"
        >
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>What for</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isEditing = editing?.id === row.id;
                return (
                  <tr key={row.id} className={isEditing ? "editing" : ""}>
                    <td>
                      {isEditing ? (
                        <Input
                          aria-label="Person"
                          value={editing.person_name}
                          onChange={(event) =>
                            setEditing({
                              ...editing,
                              person_name: event.target.value,
                            })
                          }
                        />
                      ) : (
                        row.person_name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <Input
                          aria-label="Description"
                          value={editing.description || ""}
                          onChange={(event) =>
                            setEditing({
                              ...editing,
                              description: event.target.value,
                            })
                          }
                        />
                      ) : (
                        row.description || (
                          <span className="muted">No details</span>
                        )
                      )}
                    </td>
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
                            setEditing({
                              ...editing,
                              amount: event.target.value,
                            })
                          }
                        />
                      ) : (
                        money(row.amount, currency)
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <Select
                          aria-label="Status"
                          value={editing.status}
                          onChange={(event) =>
                            setEditing({
                              ...editing,
                              status: event.target.value,
                            })
                          }
                        >
                          <option value="not_yet">Not yet</option>
                          <option value="paid">Paid</option>
                        </Select>
                      ) : (
                        <Button
                          className={
                            row.status === "paid"
                              ? "status-pill paid"
                              : "status-pill"
                          }
                          onClick={() =>
                            updateStatus(
                              row,
                              row.status === "paid" ? "not_yet" : "paid",
                            )
                          }
                        >
                          {row.status === "paid" ? "Paid" : "Not yet"}
                        </Button>
                      )}
                    </td>
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
                              person_name: row.person_name,
                              description: row.description || "",
                              amount: row.amount,
                              status: row.status,
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
                        onClick={() => deleteReceivable(row.id)}
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
      )}
    </section>
  );
}
