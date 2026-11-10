# Ledger frontend

Development UI: `http://localhost:5173`. The production container is separate and
does not receive frontend changes until explicitly rebuilt.

- `App.jsx` mounts the shell and notification viewport.
- `pages/` contains the six existing views, with their original data hooks,
  calculations, request payloads, and handlers.
- `components/` contains navigation, charts, editable tables, the transaction
  composer, and the manual-entry drawer.
- `components/ui.jsx` exports Button, IconButton, Input, Select, Panel,
  Segmented, Skeleton, EmptyState, StatCard, and form validation feedback.
- `components/Drawer.jsx` provides a modal drawer with focus containment,
  Escape dismissal, scroll locking, and focus restoration.
- `components/Toast.jsx` provides save/delete notifications and error feedback.
- `hooks/useLoad.js` is the existing loading hook.
- `lib/` contains the unchanged API helper, formatters, transaction helpers,
  existing configuration, and chart presentation constants. `api.js` keeps
  compatibility exports.

`styles.css` is organized into tokens, base, layout, shared components, page
styles, and responsive utilities. Theme values live in `:root`. The header's
appearance selector offers Light, Dark, or System, saved as `ledger:theme` in
local storage. System follows `prefers-color-scheme`, including changes while the
app is open. `public/theme.js` applies the preference before paint. Reduced motion
and touch input have dedicated rules.

Only presentation state belongs in the shared UI components. Financial records,
server totals, API routes, request payloads, and transaction handlers retain their
existing behavior. Overview analytics are read-only.
Delete uses the existing endpoint; no automatic undo creates replacement records.

The Overview uses the same dashboard request. `components/overview/` provides
two inline spending totals and two graph panels: switchable cumulative/daily/
calendar/savings views and ranked category bars with budget markers. Extra KPI
cards and detail lists are omitted to keep the overview focused on graphs.
`lib/overview.js` derives read-only presentation analytics;
its regression tests run with `npm test`. Cash and calculated totals are taken
directly from the server. Current-month estimates extrapolate ordinary recorded
spending while holding monthly spread shares fixed. Past or future months, and
months with future-dated expenses, do not show those estimates. Missing entries
are never described as proof that no money was spent.
