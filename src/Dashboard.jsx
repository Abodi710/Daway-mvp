import AdminDashboard from './AdminDashboard.jsx';
import PharmacyOwnerDashboard from './PharmacyOwnerDashboard.jsx';
import PharmacyStaffDashboard from './PharmacyStaffDashboard.jsx';
import SupplierDashboard from './SupplierDashboard.jsx';
import CustomerDashboard from './CustomerDashboard.jsx';

export default function Dashboard({ user, onLogout, onTokenError }) {
  switch (user.role) {
    case 'admin':
      return <AdminDashboard user={user} onLogout={onLogout} onTokenError={onTokenError} />;
    case 'pharmacy_owner':
      return <PharmacyOwnerDashboard user={user} onLogout={onLogout} onTokenError={onTokenError} />;
    case 'pharmacy_staff':
      return <PharmacyStaffDashboard user={user} onLogout={onLogout} onTokenError={onTokenError} />;
    case 'supplier':
      return <SupplierDashboard user={user} onLogout={onLogout} onTokenError={onTokenError} />;
    case 'customer':
      return <CustomerDashboard user={user} onLogout={onLogout} onTokenError={onTokenError} />;
    default:
      // Unauthorized role: log out and redirect to login
      onLogout();
      return null;
  }
}
