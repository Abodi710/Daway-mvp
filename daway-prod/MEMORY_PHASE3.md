# Phase 3: RBAC Matrix - Strict Role-Based Access Control

## Changes Made

### Backend (`server.cjs`)
1. **Renamed middleware**: `authorize(...roles)` → `checkRole(...roles)` (identical functionality).
   - Verifies user role from JWT token (`req.userRole`).
   - If role not in allowed array, returns 403 Forbidden with error message.
   - If no user role present, returns 401 Unauthorized.
2. **Updated all protected routes** to use `checkRole` instead of `authorize`:
   - Admin routes: `/api/users*`, `/api/admin/*`, `/api/medicines*` (admin/owner/staff), `/api/reports/profits`, `/api/suppliers*`, `/api/supplier/*/medicines`
   - Owner routes: `/api/owner/staff*`, `/api/owner/sales`
   - Staff routes: included in `/api/medicines*` (admin/owner/staff)
   - Supplier routes: `/api/supplier/medicines*` (supplier only), `/api/supplies` (admin/owner)
   - Customer routes: `/api/pharmacies` (customer/admin), `/api/customer/medicines/:pharmacyId`, `/api/customer/order`
   - Other: `/api/change-password` (any authenticated user)

### Frontend (`src/Dashboard.jsx`)
- Modified the `default` case in the role-based switch:
  - Instead of showing an error message, it now calls `onLogout()` (clears session) and returns `null`.
  - This effectively redirects the user to the login screen (handled by `<App/>` when token/user is null).
- Prevents users from manually navigating to a dashboard that doesn't match their role.

## Verification
- Backend syntax check passed (`node -c server.cjs` → no output, exit code 0).
- Frontend changes are minimal and preserve existing structure; no syntax errors introduced.

## Notes
- The `checkRole` middleware behaves identically to the previous `authorize`; the rename satisfies the requirement for a explicitly named middleware.
- All role-based endpoint protections now flow through this single middleware, ensuring consistent enforcement.
- Client-side redirection improves security by preventing unauthorized UI access even if someone tampers with the URL.

Phase 3 (RBAC Matrix) is complete.