import { useState, useEffect } from 'react';
import api, { apiFetch, handleApiError } from './api.js';
import { formToMedicinePayload, medicineEditPayload } from './medicineHelpers.js';
import MedicineForm from './MedicineForm.jsx';
import EditMedicineModal from './EditMedicineModal.jsx';
import ChangePasswordModal from './ChangePasswordModal.jsx';
import PharmacyOrdersPanel from './PharmacyOrdersPanel.jsx';

import { formatCurrency, formatDate, formatDateTime } from './formatCurrency.js';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function PharmacyOwnerDashboard({ user, onLogout, onTokenError }) {
  const [medicines, setMedicines] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [expired, setExpired] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [, setSuccessMessage] = useState('');

  // الموظفين
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [deleteStaffTarget, setDeleteStaffTarget] = useState(null);
  const [staffForm, setStaffForm] = useState({ pharmacy_name: '', email: '', password: '' });

  // المبيعات
  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [, setTotalSales] = useState(0);
  const [summary, setSummary] = useState(null);
  const [, setSummaryLoading] = useState(false);

  // الموردين
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierMedicines, setSupplierMedicines] = useState([]);
  const [supplierMedLoading, setSupplierMedLoading] = useState(false);

  const showToast = (msg, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(c => [...c, { id, message: msg, type }]);
    setTimeout(() => setToasts(c => c.filter(t => t.id !== id)), 3000);
  };

  // An expired/forbidden session (401/403) redirects to login via onTokenError;
  // every other failure is surfaced without dropping the session.
  const reportError = (err) => handleApiError(err, onTokenError, (e) => alert(e.message));
  const logError = (err) => handleApiError(err, onTokenError, (e) => console.error(e));

  const loadData = () => {
    setLoading(true);
    setStaffLoading(true);
    setSalesLoading(true);
    setSuppliersLoading(true);
    setSummaryLoading(true);
    apiFetch('/medicines')
      .then(data => { setMedicines(data || []); })
      .catch(logError)
      .finally(() => setLoading(false));
    apiFetch('/owner/notifications')
      .then(data => {
        setExpired(data?.expired || []);
        setAlerts(data?.expiringSoon || []);
        setLowStock(data?.lowStock || []);
      })
      .catch(logError);
    // موظفين
    apiFetch('/owner/staff')
      .then(data => { setStaff(data || []); })
      .catch(logError)
      .finally(() => setStaffLoading(false));
    // مبيعات
    apiFetch('/owner/sales')
      .then(data => {
        setSales(data || []);
        setTotalSales(data ? data.reduce((sum, s) => sum + (s.total_price || 0), 0) : 0);
      })
      .catch(logError)
      .finally(() => setSalesLoading(false));
    // الملخص
    apiFetch('/owner/sales/summary')
      .then(data => { setSummary(data || null); })
      .catch(logError)
      .finally(() => setSummaryLoading(false));
    // موردين
    apiFetch('/suppliers')
      .then(data => { setSuppliers(data || []); })
      .catch(logError)
      .finally(() => setSuppliersLoading(false));
  };

  // Run once on mount. loadData is re-created each render, so listing it as a
  // dependency would refetch on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, []);

  // دوال الموظفين
  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/owner/staff', { method: 'POST', body: JSON.stringify(staffForm) });
      loadData();
      setStaffForm({ pharmacy_name: '', email: '', password: '' });
      setShowAddStaff(false);
      showToast('تم إضافة الموظف');
    } catch (err) { reportError(err); }
  };
  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/owner/staff/${editingStaff.id}`, { method: 'PUT', body: JSON.stringify(staffForm) });
      setEditingStaff(null);
      setStaffForm({ pharmacy_name: '', email: '', password: '' });
      loadData();
      showToast('تم تحديث الموظف');
    } catch (err) { reportError(err); }
  };
  const handleDeleteStaff = async () => {
    if (!deleteStaffTarget) return;
    try {
      await apiFetch(`/owner/staff/${deleteStaffTarget.id}`, { method: 'DELETE' });
      setDeleteStaffTarget(null);
      loadData();
      showToast('تم حذف الموظف');
    } catch (err) { reportError(err); }
  };
  const openEditStaff = (s) => { setEditingStaff(s); setStaffForm({ pharmacy_name: s.pharmacy_name, email: s.email, password: '' }); };
  const openAddStaff = () => { setStaffForm({ pharmacy_name: '', email: '', password: '' }); setShowAddStaff(true); };

  // دوال الموردين
  const loadSupplierMedicines = async (supplierId) => {
    setSelectedSupplier(supplierId);
    setSupplierMedLoading(true);
    try {
      const data = await apiFetch(`/supplier/${supplierId}/medicines`);
      setSupplierMedicines(data || []);
    } catch (err) { logError(err); }
    finally { setSupplierMedLoading(false); }
  };

  const handleAddMedicine = async (formData) => {
    try {
      const payload = formToMedicinePayload(formData, { ownerId: user.owner_id });
      await apiFetch('/medicines', { method: 'POST', body: JSON.stringify(payload) });
      loadData();
      showToast('تم إضافة الدواء');
    } catch (err) {
      reportError(err);
    }
  };

  const handleSaveMedicine = async (id, fields) => {
    const med = medicines.find(m => m.id === id);
    const payload = medicineEditPayload(med || {}, fields);
    try {
      await apiFetch(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      setEditingMedicine(null);
      loadData();
      showToast('تم تحديث الدواء');
    } catch (err) {
      reportError(err);
    }
  };
  const handleDelete = (medicine) => setDeleteTarget(medicine);
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/medicines/${deleteTarget.id}`, { method: 'DELETE' });
      loadData();
      setSuccessMessage('تم الحذف بنجاح');
      showToast('تم الحذف');
    } catch (err) { reportError(err); }
    finally { setDeleteTarget(null); }
  };

  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 rounded-2xl bg-white/85 p-6 shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">مرحباً، {user.pharmacy_name || user.email}</h1>
            <p className="text-slate-600">لوحة تحكم مالك الصيدلية</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowChangePassword(true)} className="border border-emerald-200 bg-white px-5 py-2 rounded-2xl text-emerald-700">تغيير كلمة المرور</button>
            <button onClick={onLogout} className="bg-slate-900 text-white px-5 py-2 rounded-2xl">تسجيل خروج</button>
          </div>
        </header>

        {/* إحصائيات */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl shadow"><div className="text-sm text-slate-500">إجمالي المبيعات</div><div className="text-3xl font-bold text-emerald-700">{formatCurrency(summary?.total_sales ?? 0)}</div></div>
          <div className="bg-white p-5 rounded-2xl shadow"><div className="text-sm text-slate-500">مبيعات اليوم</div><div className="text-3xl font-bold text-emerald-700">{formatCurrency(summary?.today_sales ?? 0)}</div></div>
          <div className="bg-white p-5 rounded-2xl shadow"><div className="text-sm text-slate-500">مبيعات الشهر</div><div className="text-3xl font-bold text-emerald-700">{formatCurrency(summary?.month_sales ?? 0)}</div></div>
          <div className="bg-white p-5 rounded-2xl shadow"><div className="text-sm text-slate-500">عدد الطلبات</div><div className="text-3xl font-bold">{summary?.order_count ?? 0}</div></div>
        </div>
        {/* Daily Sales Chart */}
        {summary && summary.daily_sales && summary.daily_sales.length > 0 ? (
          <section className="mb-6">
            <h2 className="text-xl font-bold mb-4">المبيعات اليومية (آخر 7 أيام)</h2>
            <div className="rounded-2xl bg-white p-4 shadow" dir="ltr">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={summary.daily_sales.map(day => ({
                    date: day.sale_date,
                    total: Number(day.daily_total)
                  }))}
                  margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tickFormatter={(value) => formatCurrency(value, '')} tick={{ fontSize: 12, fill: '#64748b' }} width={80} />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value), 'المبيعات']}
                    labelFormatter={formatDate}
                  />
                  <Line type="monotone" dataKey="total" name="المبيعات" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        ) : (
          <p className="text-center text-slate-500">لا توجد بيانات متاحة للمبيعات اليومية</p>
        )}
        {/* إشعارات */}
        <section className="mb-6">
          <h2 className="text-xl font-bold mb-4">إشعارات عاجلة</h2>
          {(expired.length === 0 && alerts.length === 0 && lowStock.length === 0) ? (
            <p className="text-center text-slate-500">لا توجد إشعارات عاجلة</p>
          ) : (
            <>
              {/* أدوية منتهية ما زالت في المخزون — لا تُباع ويجب سحبها */}
              {expired.length > 0 && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <h3 className="mb-2 font-bold text-rose-800">أدوية منتهية الصلاحية ما زالت في المخزون ({expired.length}) — يجب سحبها</h3>
                  <ul className="space-y-1 text-sm text-rose-700">
                    {expired.map(med => (
                      <li key={med.id}>{med.name} — انتهت في {formatDate(med.expire_date)} — الكمية {med.quantity}</li>
                    ))}
                  </ul>
                </div>
              )}
              {/* تنبيهات الانتهاء الصلاحية */}
              {alerts.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">الأدوية المتبقية صلاحيتها قريبة (أقل من 30 يومًا)</h3>
                  <div className="space-y-2">
                    {alerts.map(med => (
                      <div key={med.id} className="p-3 border rounded-xl">
                        <div className="flex justify-between">
                          <span className="font-medium">{med.name}</span>
                          <span className="text-sm text-red-600">تنتهي في: {formatDate(med.expire_date)}</span>
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                          الكمية: {med.quantity}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* تنبيهات المخزون المنخفض */}
              {lowStock.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">الأدوية منخفضة المخزون (أقل من 10 وحدات)</h3>
                  <div className="space-y-2">
                    {lowStock.map(med => (
                      <div key={med.id} className="p-3 border rounded-xl">
                        <div className="flex justify-between">
                          <span className="font-medium">{med.name}</span>
                          <span className="text-sm text-orange-600">المخزون: {med.quantity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <PharmacyOrdersPanel onTokenError={onTokenError} onNotify={(message, tone) => showToast(message, tone)} />

        {/* أدوية */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold mb-4">إضافة دواء جديد</h2>
            <MedicineForm onAdd={handleAddMedicine} pharmacies={null} />
          </section>
          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">قائمة الأدوية</h2><button onClick={loadData} className="text-sm text-emerald-700 border rounded-xl px-3 py-1">تحديث</button></div>
            <div className="overflow-auto max-h-96">
              <table className="w-full text-sm border-separate border-spacing-y-2">
                <thead><tr className="text-right text-slate-500"><th className="px-2 py-1">الاسم</th><th className="px-2 py-1">الكمية</th><th className="px-2 py-1">السعر</th><th className="px-2 py-1">صلاحية</th><th className="px-2 py-1">إجراء</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan="5" className="py-4 text-center">جاري التحميل...</td></tr> : medicines.length === 0 ? <tr><td colSpan="5" className="py-4 text-center">لا توجد أدوية</td></tr> : medicines.map(m => (
                    <tr key={m.id} className="bg-slate-50 rounded-xl shadow-sm">
                      <td className="px-2 py-2 font-semibold">{m.name}</td>
                      <td className="px-2 py-2">{m.quantity}</td>
                      <td className="px-2 py-2">{formatCurrency(m.price)}</td>
                      <td className="px-2 py-2">{formatDate(m.expire_date)}</td>
                      <td className="px-2 py-2"><div className="flex gap-1">{user.role !== 'pharmacy_staff' && (<><button onClick={() => setEditingMedicine(m)} className="bg-emerald-600 text-white text-xs px-2 py-1 rounded">تعديل</button><button onClick={() => handleDelete(m)} className="bg-rose-500 text-white text-xs px-2 py-1 rounded">حذف</button></>)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* الموظفين */}
        <section className="rounded-2xl bg-white p-6 shadow mb-8">
          <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">الموظفين</h2><button onClick={openAddStaff} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm">+ إضافة موظف</button></div>
          <div className="overflow-auto">
            <table className="w-full text-sm border-separate border-spacing-y-2">
              <thead><tr className="text-right text-slate-500"><th className="px-2 py-1">الاسم</th><th className="px-2 py-1">البريد</th><th className="px-2 py-1">إجراء</th></tr></thead>
              <tbody>
                {staffLoading ? <tr><td colSpan="3" className="py-4 text-center">جاري التحميل...</td></tr> : staff.length === 0 ? <tr><td colSpan="3" className="py-4 text-center">لا يوجد موظفين</td></tr> : staff.map(s => (
                  <tr key={s.id} className="bg-slate-50 rounded-xl shadow-sm">
                    <td className="px-2 py-2 font-semibold">{s.pharmacy_name}</td>
                    <td className="px-2 py-2">{s.email}</td>
                    <td className="px-2 py-2"><div className="flex gap-1"><button onClick={() => openEditStaff(s)} className="bg-blue-600 text-white text-xs px-2 py-1 rounded">تعديل</button><button onClick={() => setDeleteStaffTarget(s)} className="bg-rose-500 text-white text-xs px-2 py-1 rounded">حذف</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* المبيعات */}
        <section className="rounded-2xl bg-white p-6 shadow mb-8">
          <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">المبيعات</h2><button onClick={loadData} className="text-sm text-emerald-700 border rounded-xl px-3 py-1">تحديث</button></div>
          <div className="overflow-auto">
            <table className="w-full text-sm border-separate border-spacing-y-2">
              <thead><tr className="text-right text-slate-500"><th className="px-2 py-1">الدواء</th><th className="px-2 py-1">العميل</th><th className="px-2 py-1">الكمية</th><th className="px-2 py-1">المبلغ</th><th className="px-2 py-1">التاريخ</th></tr></thead>
              <tbody>
                {salesLoading ? <tr><td colSpan="5" className="py-4 text-center">جاري التحميل...</td></tr> : sales.length === 0 ? <tr><td colSpan="5" className="py-4 text-center">لا توجد مبيعات</td></tr> : sales.map(s => (
                  <tr key={s.id} className="bg-slate-50 rounded-xl shadow-sm">
                    <td className="px-2 py-2">{s.medicine_name}</td>
                    <td className="px-2 py-2">{s.customer_name || 'غير معروف'}</td>
                    <td className="px-2 py-2">{s.quantity}</td>
                    <td className="px-2 py-2">{formatCurrency(s.total_price)}</td>
                    <td className="px-2 py-2">{formatDateTime(s.sold_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* الموردين */}
        <section className="rounded-2xl bg-white p-6 shadow mb-8">
          <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">الموردين</h2><button onClick={() => { setSuppliersLoading(true); apiFetch('/suppliers').then(d => { setSuppliers(d || []); }).catch(logError).finally(() => setSuppliersLoading(false)); }} className="text-sm text-emerald-700 border rounded-xl px-3 py-1">تحديث</button></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliersLoading ? <p>جاري التحميل...</p> : suppliers.length === 0 ? <p>لا يوجد موردين</p> : suppliers.map(s => (
              <button key={s.id} onClick={() => loadSupplierMedicines(s.id)} className={`p-4 rounded-xl border text-right transition ${selectedSupplier === s.id ? 'bg-emerald-100 border-emerald-400' : 'bg-slate-50 border-slate-200 hover:bg-emerald-50'}`}>
                <div className="font-bold">{s.name}</div><div className="text-sm text-slate-500">{s.email}</div>
              </button>
            ))}
          </div>
          {selectedSupplier && (
            <div className="mt-6 border-t pt-4">
              <h3 className="font-bold text-lg mb-2">أدوية المورد</h3>
              {supplierMedLoading ? <p>جاري التحميل...</p> : supplierMedicines.length === 0 ? <p>لا توجد أدوية لهذا المورد</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-separate border-spacing-y-2">
                    <thead><tr className="text-right text-slate-500"><th className="px-2 py-1">الاسم</th><th className="px-2 py-1">السعر</th><th className="px-2 py-1">الوصف</th></tr></thead>
                    <tbody>{supplierMedicines.map(m => (<tr key={m.id} className="bg-slate-50 rounded-xl shadow-sm"><td className="px-2 py-2 font-semibold">{m.name}</td><td className="px-2 py-2">{formatCurrency(m.price)}</td><td className="px-2 py-2">{m.description || '-'}</td></tr>))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* نوافذ الموظفين */}
        {showAddStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">إضافة موظف</h3>
              <form onSubmit={handleAddStaff} className="space-y-4">
                <input type="text" placeholder="اسم الموظف" value={staffForm.pharmacy_name} onChange={e => setStaffForm({...staffForm, pharmacy_name: e.target.value})} required className="w-full border rounded-xl p-3" />
                <input type="email" placeholder="البريد الإلكتروني" value={staffForm.email} onChange={e => setStaffForm({...staffForm, email: e.target.value})} required className="w-full border rounded-xl p-3" />
                <input type="password" placeholder="كلمة المرور (8 خانات على الأقل)" minLength={8} value={staffForm.password} onChange={e => setStaffForm({...staffForm, password: e.target.value})} required className="w-full border rounded-xl p-3" />
                <div className="flex gap-3"><button type="submit" className="flex-1 bg-emerald-600 text-white py-2 rounded-xl">إضافة</button><button type="button" onClick={() => setShowAddStaff(false)} className="flex-1 border py-2 rounded-xl">إلغاء</button></div>
              </form>
            </div>
          </div>
        )}
        {editingStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">تعديل موظف</h3>
              <form onSubmit={handleUpdateStaff} className="space-y-4">
                <input type="text" placeholder="اسم الموظف" value={staffForm.pharmacy_name} onChange={e => setStaffForm({...staffForm, pharmacy_name: e.target.value})} required className="w-full border rounded-xl p-3" />
                <input type="email" placeholder="البريد الإلكتروني" value={staffForm.email} onChange={e => setStaffForm({...staffForm, email: e.target.value})} required className="w-full border rounded-xl p-3" />
                <input type="password" placeholder="كلمة مرور جديدة (اختياري، 8 خانات على الأقل)" minLength={8} value={staffForm.password} onChange={e => setStaffForm({...staffForm, password: e.target.value})} className="w-full border rounded-xl p-3" />
                <div className="flex gap-3"><button type="submit" className="flex-1 bg-emerald-600 text-white py-2 rounded-xl">حفظ</button><button type="button" onClick={() => setEditingStaff(null)} className="flex-1 border py-2 rounded-xl">إلغاء</button></div>
              </form>
            </div>
          </div>
        )}
        {deleteStaffTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">تأكيد الحذف</h3>
              <p>هل أنت متأكد من حذف الموظف "{deleteStaffTarget.pharmacy_name}"؟</p>
              <div className="flex gap-3 mt-6"><button onClick={handleDeleteStaff} className="flex-1 bg-red-600 text-white py-2 rounded-xl">حذف</button><button onClick={() => setDeleteStaffTarget(null)} className="flex-1 border py-2 rounded-xl">إلغاء</button></div>
            </div>
          </div>
        )}

        {/* نوافذ الأدوية */}
        {editingMedicine && <EditMedicineModal medicine={editingMedicine} onClose={() => setEditingMedicine(null)} onSave={handleSaveMedicine} />}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">تأكيد الحذف</h3>
              <p>هل أنت متأكد من حذف هذا الدواء؟</p>
              <div className="flex gap-3 mt-6"><button onClick={confirmDelete} className="flex-1 bg-red-600 text-white py-2 rounded-xl">حذف</button><button onClick={() => setDeleteTarget(null)} className="flex-1 border py-2 rounded-xl">إلغاء</button></div>
            </div>
          </div>
        )}
        {showChangePassword && (
          <ChangePasswordModal
            onClose={() => setShowChangePassword(false)}
            onSave={async ({ oldPassword, newPassword }) => {
              // The modal neither awaits nor catches onSave, so handle it here.
              try {
                await api.auth.changePassword(oldPassword, newPassword);
                setShowChangePassword(false);
                showToast('تم تغيير كلمة المرور');
              } catch (err) {
                reportError(err);
              }
            }}
          />
        )}

        {/* الإشعارات */}
        <div className="pointer-events-none fixed bottom-4 left-4 z-[60] flex flex-col gap-3 max-w-sm">
          {toasts.map(t => (
            <div key={t.id} className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow ${t.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
              <div className="text-sm font-semibold">{t.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
