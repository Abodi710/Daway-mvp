const { useState } = React;

const AdminDashboard = window.AdminDashboard;
const PharmacyOwnerDashboard = window.PharmacyOwnerDashboard;
const PharmacyStaffDashboard = window.PharmacyStaffDashboard;
const SupplierDashboard = window.SupplierDashboard;
const CustomerDashboard = window.CustomerDashboard;

function Dashboard({ user, onLogout, onTokenError }) {
  switch (user.role) {
    case 'admin':
      return <AdminDashboard user={user} onLogout={onLogout} />;
    case 'pharmacy_owner':
      return <PharmacyOwnerDashboard user={user} onLogout={onLogout} />;
    case 'pharmacy_staff':
      return <PharmacyStaffDashboard user={user} onLogout={onLogout} />;
    case 'supplier':
      return <SupplierDashboard user={user} onLogout={onLogout} />;
    case 'customer':
      return <CustomerDashboard user={user} onLogout={onLogout} />;
    default:
      return (
        <div className="p-8 text-center space-y-4">
          <p className="text-red-500 font-bold">عذراً، الدور الوظيفي غير معرف أو ليس لديك صلاحية وصول.</p>
          <button onClick={onLogout} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs">العودة للخلف</button>
        </div>
      );
  }
}

window.Dashboard = Dashboard;
