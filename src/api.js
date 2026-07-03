const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4100/api';

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export function money(value, currency = 'MAD') {
  const amount = new Intl.NumberFormat('fr-MA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
  return `${amount} ${currency}`;
}

export function monthLabel(month) {
  if (!month) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(month.year, month.month - 1, 1)
  );
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
