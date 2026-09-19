# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

**Daway (دواي)** — a Sudanese pharmacy platform: patients search medicines across approved pharmacies and order with Bankak payment; pharmacies manage stock, staff, POS sales and incoming orders; admins approve pharmacies and manage users; suppliers publish a wholesale catalog.

One app, one repo root:
- `server.cjs` — Express 5 API + SQLite (`daway.db`, created on first run). In production it also serves the built SPA from `dist/`.
- `src/` — React 19 + Vite 8 + Tailwind 4 SPA, Arabic / RTL throughout.

There is no separate MVP any more; the old vanilla-JS copies were removed (they remain in git history).

## Commands

```bash
npm install
npm run server   # API on :5000 (needs .env — see .env.example)
npm run dev      # Vite on :3000, proxies /api to :5000
npm run build    # production bundle into dist/
npm start        # API + built SPA on one port
npm run lint     # oxlint over src/ and server.cjs
```

Required env: `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (server exits without them). Optional: `SEED_DEMO_DATA=true` (dev only — demo accounts with password 123456, reset every boot), `VITE_ENABLE_OFFLINE_MOCK=true` (dev only — localStorage fallback when the API is down; never logs anyone in).

## Roles and data scoping

Roles live only in `users.role`: `admin`, `pharmacy_owner`, `pharmacy_staff`, `supplier`, `customer`. There are no hard-coded admin emails.

- A **pharmacy is its owner's user row**; `users.owner_id` = own id for owners, the owner's id for staff, NULL otherwise. `medicines.owner_id` and `orders.pharmacy_id` hold that owner id. `users.pharmacy_name` doubles as the display name for every role.
- `verifyToken` re-reads the user row on every request, so suspension (`status = 'suspended'`), deletion and role changes apply immediately. The JWT proves identity only.
- Public `/api/register` always creates a **customer**. Pharmacies apply via `/api/pharmacy/register` (admin approves). Staff are created by their owner; suppliers/admins by an admin.
- 401 = session invalid (client logs out). 403 = not allowed for this action (client shows the message, stays logged in). Keep that distinction.

## Rules that must not regress

- **Stock changes go through `withTransaction`** (second SQLite connection, queued, `BEGIN IMMEDIATE`) and decrement with `UPDATE … SET quantity = quantity - ? WHERE … AND quantity >= ?`, checking `changes`. Never read-then-write stock, and never `BEGIN` on the shared `db` connection.
- **Expired or out-of-stock medicine is never sold**: the public catalog, `/api/customer/medicines`, both customer order routes and POS all enforce `date(expire_date) >= date('now')`.
- **The public catalog (`/api/catalog/*`) never exposes** cost price, barcode, batch, supplier or exact quantity.
- **Receipts**: stored under `uploads/receipts/` (git-ignored) with a generated name; type decided by magic bytes; served only to the order's customer, its pharmacy, or an admin. Upload never marks an order paid — the pharmacy confirms via `PATCH /api/orders/:id/payment`.
- Order lifecycle: `pending → completed | cancelled` (cancel restores stock; customer may cancel own pending order). Payment: `unpaid → pending_review → paid | rejected` (re-upload allowed until paid).
- Passwords ≥ 8 characters everywhere (`passwordProblem`).
- Never commit `*.db*`, `.env`, `uploads/`, or SQL files containing password hashes.

## Frontend conventions

- All server calls go through `src/api.js` (`apiFetch` / grouped `api.*`). Same-origin by default; `VITE_API_BASE` only for a separate API host.
- Money and dates: `formatCurrency` / `formatDate` / `formatDateTime` from `src/formatCurrency.js` (ج.س, Western digits). Don't call `toLocaleString` directly.
- Order/payment labels: `src/orderStatus.js` + `src/StatusBadge.jsx`. Sudan's states: `src/data/sudanStates.js`.
- `src/data/mockData.ts` feeds only the dev offline mock — public pages must not import it.
- Dashboard pattern: `src/Dashboard.jsx` switches on `user.role`; each dashboard receives `user`, `onLogout`, `onTokenError` and reports errors with `handleApiError`.

## Known gaps (not yet built)

- Pharmacies cannot create purchase orders to suppliers (only supplier-side fulfilment exists; PO items reference pharmacy `medicines`, not `supplier_medicines`).
- No password reset, no notifications (email/SMS), no audit log.
- `server.cjs` is a single ~2k-line file; splitting into routes/services and adding automated tests is planned.
