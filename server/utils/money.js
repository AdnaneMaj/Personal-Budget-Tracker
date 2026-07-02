export function toNumber(value) {
  return Number(value || 0);
}

export function lineMetrics(line) {
  const planned = toNumber(line.planned_amount);
  const actual = toNumber(line.actual_amount);
  const remaining = planned - actual;
  const percentUsed = planned > 0 ? (actual / planned) * 100 : actual > 0 ? 100 : 0;

  return {
    ...line,
    planned_amount: planned,
    actual_amount: actual,
    remaining,
    percent_used: percentUsed
  };
}
