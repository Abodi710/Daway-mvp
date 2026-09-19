import { Navigate, useLocation } from 'react-router-dom';
import { clearSession, readToken, readUser } from './api.js';

/**
 * Roles that Dashboard.jsx knows how to render. Validating here keeps that
 * component's `default:` branch unreachable — it calls `onLogout()` during
 * render, which is not safe as a render-time side effect.
 */
const DASHBOARD_ROLES = new Set([
  'admin',
  'pharmacy_owner',
  'pharmacy_staff',
  'supplier',
  'customer',
]);

/**
 * Guards the dashboard routes by evaluating the stored session.
 *
 * - no token or no user  -> send to /login
 * - role not renderable  -> drop the stale session, then send to /login
 *
 * `readUser()` normalises the stored role to its canonical backend value, so
 * a session saved with a UI role ('patient', 'pharmacy') is accepted too.
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = readToken();
  const user = readUser();

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!DASHBOARD_ROLES.has(user.role)) {
    clearSession();
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
