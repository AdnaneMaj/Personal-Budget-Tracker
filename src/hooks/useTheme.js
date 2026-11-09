import { useEffect, useState } from "react";

const storageKey = "ledger:theme";

function readPreference() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (["light", "dark", "system"].includes(saved)) return saved;
  } catch {
    // Saving a preference is optional; switching appearance should still work.
  }
  return "system";
}

export default function useTheme() {
  const [preference, setPreference] = useState(readPreference);

  useEffect(() => {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      const root = document.documentElement;
      root.dataset.theme =
        preference === "system"
          ? systemTheme.matches
            ? "dark"
            : "light"
          : preference;
      const background = getComputedStyle(root)
        .getPropertyValue("--neutral-1")
        .trim();
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", background);
    }
    apply();
    systemTheme.addEventListener("change", apply);
    try {
      localStorage.setItem(storageKey, preference);
    } catch {
      /* Storage can be disabled. */
    }
    return () => systemTheme.removeEventListener("change", apply);
  }, [preference]);

  useEffect(() => {
    function sync(event) {
      if (event.key === storageKey || event.key === null)
        setPreference(readPreference());
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  return [preference, setPreference];
}
