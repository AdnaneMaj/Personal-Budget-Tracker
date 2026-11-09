export function multiplyAmount(quantity, unitPrice) {
  const q = Number(quantity);
  const unit = Number(unitPrice);
  if (!Number.isFinite(q) || !Number.isFinite(unit) || q <= 0 || unit < 0)
    return "";
  return (q * unit).toFixed(2);
}

export function divideAmount(amount, quantity) {
  const total = Number(amount);
  const q = Number(quantity);
  if (!Number.isFinite(total) || !Number.isFinite(q) || q <= 0 || total < 0)
    return "";
  return (total / q).toFixed(2);
}

export function draftMemoryStatus(draft) {
  if (!draft.unitPrice) return { label: "Price needed", ready: false };
  if (draft.productMatch === "suggested")
    return { label: "Check match", ready: false };
  if (draft.priceSource === "remembered")
    return { label: "Remembered", ready: true };
  if (draft.priceSource === "explicit")
    return { label: "From text", ready: true };
  if (draft.priceSource === "user")
    return { label: draft.productId ? "Updated" : "New product", ready: true };
  return { label: draft.productId ? "Matched" : "New product", ready: true };
}
