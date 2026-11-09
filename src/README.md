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

Only presentation state belongs in the shared UI components. Financial state,
calculation logic, API routes, and payloads stay in their original page handlers.
Delete uses the existing endpoint; no automatic undo creates replacement records.
