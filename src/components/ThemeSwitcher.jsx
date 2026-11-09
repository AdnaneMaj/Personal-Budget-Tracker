import { Monitor, Moon, Sun } from "lucide-react";
import useTheme from "../hooks/useTheme.js";

export default function ThemeSwitcher() {
  const [preference, setPreference] = useTheme();
  const Icon =
    preference === "dark" ? Moon : preference === "light" ? Sun : Monitor;
  return (
    <label className="theme-switcher" title="Appearance">
      <Icon size={16} aria-hidden="true" />
      <select
        aria-label="Appearance"
        value={preference}
        onChange={(event) => setPreference(event.target.value)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
