import { useState, useEffect } from 'react';
import api, { apiFetch, handleApiError } from './api.js';
import { formatCurrency } from './formatCurrency.js';
import MedicineForm from './MedicineForm.jsx';
import EditMedicineModal from './EditMedicineModal.jsx';
import ChangePasswordModal from './ChangePasswordModal.jsx';
import PharmacyOrdersPanel from './PharmacyOrdersPanel.jsx';

import { formToMedicinePayload, medicineEditPayload } from './medicineHelpers.js';

export default function PharmacyStaffDashboard({ user, onLogout, onTokenError }) {
  const [medicines, setMedicines] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [editMed, setEditMed] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // An expired/forbidden session (401/403) redirects to login via onTokenError;
  // every other failure is reported without dropping the session.
  const reportError = (err) => handleApiError(err, onTokenError, (e) => alert(e.message));
  const logError = (err) => handleApiError(err, onTokenError, (e) => console.error(e));

  const loadStaffData = () => {
    apiFetch('/medicines').then(data => setMedicines(data || [])).catch(logError);
    apiFetch('/medicines/expiry-alerts').then(data => setExpiryAlerts(data || [])).catch(logError);
    apiFetch('/medicines/low-stock').then(data => setLowStockAlerts(data || [])).catch(logError);
  };

  // Run once on mount. loadStaffData is re-created each render, so listing it as
  // a dependency would refetch on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadStaffData(); }, []);

  const handleAddMedicine = (newMed) => {
    const payload = formToMedicinePayload(newMed, { ownerId: user.owner_id });
    apiFetch('/medicines', { method: 'POST', body: JSON.stringify(payload) }).then(() => {
      loadStaffData();
      alert("تمت إضافة الدواء بنجاح لمخزون صيدليتك.");
    }).catch(reportError);
  };

  const handleSaveMedicine = (id, fields) => {
    const med = medicines.find(m => m.id === id);
    const payload = medicineEditPayload(med || {}, fields);
    apiFetch(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(payload) }).then(() => {
      setEditMed(null);
      loadStaffData();
    }).catch(reportError);
  };

  // Unwired: nothing renders a delete trigger yet, so the confirm modal below
  // is currently unreachable. Kept for when the delete button is added.
  const _handleDeleteClick = (id) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = () => {
    apiFetch(`/medicines/${confirmDeleteId}`, { method: 'DELETE' }).then(() => {
      setConfirmDeleteId(null);
      loadStaffData();
    }).catch(reportError);
  };

  const handleChangePassword = async ({ oldPassword, newPassword }) => {
    // ChangePasswordModal does not await or catch onSave, so failures must be
    // handled here or they surface as an unhandled rejection.
    try {
      await api.auth.changePassword(oldPassword, newPassword);
      setShowChangePassword(false);
      alert("تم تحديث كلمة المرور السرية لطاقم الصيدلية بنجاح.");
    } catch (err) {
      reportError(err);
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // The cart never asks for more than is on the shelf (item.quantity in the
  // cart line is the amount being sold; stockOf reads the shelf level).
  const stockOf = (id) => medicines.find(m => m.id === id)?.quantity ?? 0;

  const addToCart = (medicine) => {
    const existing = cart.find(item => item.id === medicine.id);
    if (existing) {
      if (existing.quantity >= stockOf(medicine.id)) return;
      setCart(cart.map(item =>
        item.id === medicine.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...medicine, quantity: 1 }]);
    }
  };

  const increaseQuantity = (id) => {
    setCart(cart.map(item =>
      item.id === id && item.quantity < stockOf(id)
        ? { ...item, quantity: item.quantity + 1 }
        : item
    ));
  };

  const decreaseQuantity = (id) => {
    setCart(cart.map(item =>
      item.id === id
        ? item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : null
        : item
    ).filter(Boolean));
  };

  // Unwired: the POS cart has no remove-item button yet.
  const _removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('السلّة فارغة');
      return;
    }
    setIsSubmitting(true);
    const sold = [];
    try {
      // POST /api/pos/order records a single line per call (medicine_id +
      // quantity), so the cart is submitted line by line. Each call is
      // transactional on the server, but the cart as a whole is not — hence the
      // partial-failure reporting below.
      for (const item of cart) {
        await api.orders.createPos({ medicine_id: item.id, quantity: item.quantity });
        sold.push(item);
      }
      setCart([]);
      loadStaffData();
      alert('تم إتمام العملية بنجاح!');
    } catch (err) {
      // Keep whatever did not go through so the cashier can retry it.
      setCart(cart.filter((item) => !sold.includes(item)));
      if (sold.length) loadStaffData();
      handleApiError(err, onTokenError, (e) => alert(
        sold.length
          ? `تم تسجيل ${sold.length} من ${cart.length} صنف، وتعذّر إكمال الباقي: ${e.message}`
          : (e.message || 'فشل إتمام العملية')
      ));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-emerald-700 text-white rounded-3xl p-6 shadow-md flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">بوابة طاقم الصيدلية التنفيذي</h2>
          <p className="text-emerald-100 text-xs mt-1">المنشأة الحالية: <span className="font-bold underline">{user.pharmacy_label || '—'}</span> | الموظف المسؤول: {user.pharmacy_name || user.email}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowChangePassword(true)} className="bg-emerald-800 hover:bg-emerald-900 text-xs px-4 py-2 rounded-xl transition">تغيير كلمة السر</button>
          <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-xs font-bold px-4 py-2 rounded-xl transition">خروج</button>
        </div>
      </div>

      {(expiryAlerts.length > 0 || lowStockAlerts.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {expiryAlerts.length > 0 && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl space-y-2">
              <h4 className="text-sm font-bold text-red-700">تنبيه: أدوية منتهية أو قريبة الانتهاء</h4>
              <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
                {expiryAlerts.map(e => <li key={e.id}>{e.name} (تاريخ: {e.expire_date})</li>)}
              </ul>
            </div>
          )}
          {lowStockAlerts.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl space-y-2">
              <h4 className="text-sm font-bold text-amber-700">تنبيه: مخزون منخفض</h4>
              <ul className="text-xs text-amber-600 space-y-1 list-disc list-inside">
                {lowStockAlerts.map(l => <li key={l.id}>{l.name} - المتبقي في الرف ({l.quantity} قطع فقط)</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs"><span className="text-xs text-slate-400 font-bold block mb-1">أصناف الأدوية بمستودعنا</span><span className="text-2xl font-black text-slate-800">{medicines.length} صنف</span></div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs"><span className="text-xs text-slate-400 font-bold block mb-1">إجمالي القطع المتوفرة</span><span className="text-2xl font-black text-emerald-600">{medicines.reduce((acc, m) => acc + m.quantity, 0)} قطعة</span></div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs"><span className="text-xs text-slate-400 font-bold block mb-1">حالة التنبيهات الفعالة</span><span className="text-2xl font-black text-amber-500">{expiryAlerts.length + lowStockAlerts.length} خطر</span></div>
      </div>

      <PharmacyOrdersPanel onTokenError={onTokenError} />

      <MedicineForm onAdd={handleAddMedicine} pharmacies={null} />

      {/* Point of Sale (POS) Interface */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-12">
        {/* Left side: medicine search and list */}
        <div className="col-span-12 sm:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm">نقطة البيع (POS)</h3>
          </div>
          <div className="p-4">
            <input
              type="text"
              placeholder="بحث بالدواء أو الباركود..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full mb-4 p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {(() => {
              // Only sellable stock: the server refuses expired or empty lines.
              const today = new Date().toISOString().slice(0, 10);
              const term = searchQuery.toLowerCase();
              const filtered = medicines.filter(m =>
                m.quantity > 0 &&
                (m.expire_date || '') >= today &&
                (m.name.toLowerCase().includes(term) ||
                  (m.barcode || m.bar_code || '').toLowerCase().includes(term))
              );
              if (filtered.length === 0) {
                return <p className="text-sm text-slate-500">لا توجد أدوية صالحة للبيع تطابق البحث.</p>;
              }
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs border-b border-slate-100">
                        <th className="p-4">اسم المستحضر</th>
                        <th className="p-4">الباركود</th>
                        <th className="p-4">سعر البيع</th>
                        <th className="p-4">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                      {filtered.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-bold text-slate-800">{m.name}</td>
                          <td className="p-4 font-mono text-xs">{m.barcode || m.bar_code || '-'}</td>
                          <td className="p-4 text-slate-600">{formatCurrency(m.price)}</td>
                          <td className="p-4 flex justify-center gap-2">
                            <button
                              onClick={() => addToCart(m)}
                              className="text-emerald-600 hover:bg-emerald-50 px-3 py-1 rounded-lg text-xs"
                            >
                              إضافة
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Right side: cart */}
        <div className="col-span-12 sm:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm">سلّتي</h3>
          </div>
          <div className="p-4 space-y-4">
            {cart.length === 0 ? (
              <p className="text-sm text-slate-500 text-center">السلّة فارغة</p>
            ) : (
              <>
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 border border-slate-200 rounded-lg">
                    <div className="flex-1 text-right space-x-2">
                      <span className="font-medium">{item.name}</span>
                      <div className="text-xs text-slate-500">
                        {item.expire_date || item.expiry_date || '-'}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => decreaseQuantity(item.id)}
                        className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded"
                        disabled={item.quantity === 1}
                      >
                        −
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => increaseQuantity(item.id)}
                        className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex justify-between text-lg font-bold">
                    <span>الإجمالي:</span>
                    <span>{formatCurrency(cart.reduce((sum, item) => sum + (item.price * item.quantity), 0))}</span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={isSubmitting}
                    className="w-full mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'جاري الإتمام...' : 'إتمام العملية'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {editMed && <EditMedicineModal medicine={editMed} onSave={handleSaveMedicine} onClose={() => setEditMed(null)} />}
      {showChangePassword && <ChangePasswordModal onSave={handleChangePassword} onClose={() => setShowChangePassword(false)} />}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full mx-4 space-y-4">
            <h4 className="font-bold text-slate-800">تأكيد عملية الحذف</h4>
            <p className="text-xs text-slate-500">هل أنت متأكد من رغبتك في حذف هذا الصنف البرمجي نهائياً من الرفوف الرقمية للصيدلية؟</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 border border-slate-200 text-xs rounded-xl">تراجع</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-500 text-white text-xs rounded-xl">تأكيد الحذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}