export const axisTick = {
  fontFamily: "var(--font-ui)",
  fontSize: 12,
  fill: "var(--text-muted)",
};
export const axisAmount = (value) =>
  new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 2 }).format(
    Number(value),
  );
export const tooltipStyle = {
  fontFamily: "var(--font-ui)",
  fontSize: 12,
  background: "var(--surface)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  boxShadow: "var(--shadow)",
};
export const pieMargin = { top: 8, right: 8, bottom: 8, left: 8 };
export const chartDot = { r: 3, strokeWidth: 0 };
const categories = [
  "food",
  "rent",
  "car",
  "family",
  "health",
  "divers",
  "entertainment",
  "wifi",
  "clothes",
  "transport",
];
export function chartColor(name) {
  const index = categories.indexOf(String(name).toLowerCase());
  return `var(--chart-${index < 0 ? 1 : (index % 5) + 1})`;
}
