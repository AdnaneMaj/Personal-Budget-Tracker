// Run before the app paints so a saved appearance does not flash the other theme.
(() => {
  let preference = "system";
  try {
    const saved = localStorage.getItem("ledger:theme");
    if (["light", "dark", "system"].includes(saved)) preference = saved;
  } catch {
    // Appearance still works when browser storage is unavailable.
  }
  const dark =
    preference === "dark" ||
    (preference === "system" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#151813" : "#fafaf8");
})();
