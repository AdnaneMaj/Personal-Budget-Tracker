import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

export function notify(message, tone = "success") {
  window.dispatchEvent(
    new CustomEvent("ledger:toast", { detail: { message, tone } }),
  );
}

export function Toast({ message, tone, onDismiss }) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      className={`toast ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon size={18} />
      <span>{message}</span>
      <button
        type="button"
        className="icon-button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const [toasts, setToasts] = useState([]);
  const sequence = useRef(0);
  useEffect(() => {
    const timers = new Set();
    function add(event) {
      const id = ++sequence.current;
      setToasts((current) => [...current.slice(-2), { ...event.detail, id }]);
      const timer = setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
        timers.delete(timer);
      }, 5000);
      timers.add(timer);
    }
    window.addEventListener("ledger:toast", add);
    return () => {
      window.removeEventListener("ledger:toast", add);
      timers.forEach(clearTimeout);
    };
  }, []);
  return (
    <div className="toast-viewport" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <Toast
          key={t.id}
          {...t}
          onDismiss={() =>
            setToasts((current) => current.filter((item) => item.id !== t.id))
          }
        />
      ))}
    </div>
  );
}
