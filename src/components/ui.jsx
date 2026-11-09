import { forwardRef, useId, useState } from "react";
import { ArrowRight, Inbox } from "lucide-react";
import { notify } from "./Toast.jsx";

export const Button = forwardRef(function Button(
  { variant = "", className = "", onClick, children, ...props },
  ref,
) {
  const [actionError, setActionError] = useState("");
  function reportError(error) {
    const message = error.message || "Something went wrong. Please try again.";
    setActionError(message);
    notify(message, "error");
  }
  function handleClick(event) {
    setActionError("");
    try {
      const result = onClick?.(event);
      result?.catch?.(reportError);
      return result;
    } catch (error) {
      reportError(error);
    }
  }
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`button ${variant} ${className}`}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
      {actionError && (
        <span className="action-error field-error" role="alert">
          {actionError}
        </span>
      )}
    </>
  );
});

export const IconButton = forwardRef(function IconButton(
  { label, title, children, className = "", ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      className={`icon-button ${className}`}
      aria-label={label || title}
      title={title || label}
      {...props}
    >
      {children}
    </Button>
  );
});

export const Input = forwardRef(function Input(
  { label, error, onBlur, onChange, onKeyDown, className = "", ...props },
  ref,
) {
  const id = useId();
  const [validation, setValidation] = useState("");
  const message = error || validation;
  const Wrapper = label ? "label" : "span";
  return (
    <Wrapper
      className={`field ${label ? "" : "field-unlabelled"} ${message ? "field-invalid" : ""}`}
    >
      {label && <span className="field-label">{label}</span>}
      <input
        {...props}
        ref={ref}
        id={props.id || id}
        className={className}
        aria-label={
          props["aria-label"] ||
          label ||
          props.placeholder ||
          props.title ||
          (props.type === "date"
            ? "Date"
            : props.type === "checkbox"
              ? "Recurring"
              : "Value")
        }
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? `${id}-error` : undefined}
        onChange={(event) => {
          setValidation("");
          try {
            const result = onChange?.(event);
            result?.catch?.((e) => notify(e.message, "error"));
          } catch (e) {
            notify(e.message, "error");
          }
        }}
        onKeyDown={(event) => {
          try {
            const result = onKeyDown?.(event);
            result?.catch?.((e) => notify(e.message, "error"));
          } catch (e) {
            notify(e.message, "error");
          }
        }}
        onBlur={(event) => {
          setValidation(
            event.target.validity.valid ? "" : event.target.validationMessage,
          );
          try {
            const result = onBlur?.(event);
            result?.catch?.((e) => notify(e.message, "error"));
          } catch (e) {
            notify(e.message, "error");
          }
        }}
      />
      {message && (
        <span className="field-error" id={`${id}-error`} role="alert">
          {message}
        </span>
      )}
    </Wrapper>
  );
});

export const Select = forwardRef(function Select(
  { label, children, className = "", ...props },
  ref,
) {
  const Wrapper = label ? "label" : "span";
  return (
    <Wrapper className={`field ${label ? "" : "field-unlabelled"}`}>
      {label && <span className="field-label">{label}</span>}
      <select
        ref={ref}
        className={className}
        aria-label={props["aria-label"] || label || props.title || "Category"}
        {...props}
      >
        {children}
      </select>
    </Wrapper>
  );
});

export function Panel({ children, tone = "", className = "" }) {
  return (
    <section
      className={`panel ${tone} ${className}`}
      role={tone === "error" ? "alert" : undefined}
    >
      {children}
    </section>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented" role="group" aria-label="Transaction type">
      {options.map((option) => (
        <Button
          key={option.value}
          aria-pressed={value === option.value}
          className={value === option.value ? "active" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function PageSkeleton({ label = "Loading your ledger" }) {
  return (
    <div className="page-skeleton" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <Panel className="skeleton-hero">
        <Skeleton className="skeleton-label" />
        <Skeleton className="skeleton-number" />
        <Skeleton />
      </Panel>
      <div className="skeleton-columns">
        <Panel>
          <Skeleton className="skeleton-label" />
          <Skeleton className="skeleton-chart" />
        </Panel>
        <Panel>
          <Skeleton className="skeleton-label" />
          <Skeleton className="skeleton-chart" />
        </Panel>
      </div>
      <Panel>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton className="skeleton-row" key={i} />
        ))}
      </Panel>
    </div>
  );
}

export function EmptyState({
  title = "A fresh start",
  children,
  actionLabel = "Choose a month",
  onAction,
  icon: Icon = Inbox,
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={24} strokeWidth={1.5} />
      </span>
      <strong>{title}</strong>
      <p>{children}</p>
      <Button
        className="quiet"
        onClick={
          onAction ||
          (() => document.querySelector('[data-nav="months"]')?.click())
        }
      >
        {actionLabel}
        <ArrowRight size={14} />
      </Button>
    </div>
  );
}

export function StatCard({ label, value, hint, className = "" }) {
  return (
    <div className={`stat-card ${className}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value num">{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function FormFields({ children, className = "" }) {
  const [message, setMessage] = useState("");
  function validate(event) {
    const invalid = [
      ...event.currentTarget.querySelectorAll("input, select"),
    ].find((input) => !input.checkValidity());
    setMessage(
      invalid
        ? "Please complete the required fields and check the highlighted values."
        : "",
    );
    if (invalid) invalid.focus();
  }
  return (
    <div
      className={`form-fields ${className}`}
      onKeyDownCapture={(event) => {
        if (event.key === "Enter") validate(event);
      }}
      onClickCapture={(event) => {
        if (!event.target.closest("button.primary")) return;
        validate(event);
      }}
    >
      {children}
      {message && (
        <p className="form-feedback" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
