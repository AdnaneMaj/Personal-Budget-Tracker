export function money(value, currency = "MAD") {
  const amount = new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
  return `${amount} ${currency}`;
}

export function monthLabel(month) {
  if (!month) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(month.year, month.month - 1, 1));
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function dateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

export function nextMonthValue(month, offset) {
  const date = new Date(month.year, month.month - 1 + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}
