// js/owner.js
function PharmacyOwnerDashboard({ user, onLogout, onTokenError }) {
  const [medicines, setMedicines] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

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
  const [totalSales, setTotalSales] = useState(0);

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

  const loadData = () => {
    setLoading(true);
    apiFetch('/medicines').then(data => { setMedicines(data || []); setLoading(false); }).catch(onTokenError);
    apiFetch('/medicines/expiry-alerts').then(data => setAlerts(data || [])).catch(() => {});
    apiFetch('/medicines/low-stock').then(data => setLowStock(data || [])).catch(() => {});
    // موظفين
    setStaffLoading(true);
    apiFetch('/owner/staff').then(data => { setStaff(data || []); setStaffLoading(false); }).catch(() => setStaffLoading(false));
    // مبيعات
    setSalesLoading(true);
    apiFetch('/owner/sales').then(data => {
      setSales(data || []);
      setTotalSales(data ? data.reduce((sum, s) => sum + (s.total_price || 0), 0) : 0);
      setSalesLoading(false);
    }).catch(() => setSalesLoading(false));
    // موردين
    setSuppliersLoading(true);
    apiFetch('/suppliers').then(data => { setSuppliers(data || []); setSuppliersLoading(false); }).catch(() => setSuppliersLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  // دوال الموظفين
  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/owner/staff', { method: 'POST', body: JSON.stringify(staffForm) });
      setStaffForm({ pharmacy_name: '', email: '', password: '' });
      setShowAddStaff(false);
      loadData();
      showToast('تم إضافة الموظف');
    } catch (err) { alert(err.message); }
  };
  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/owner/staff/${editingStaff.id}`, { method: 'PUT', body: JSON.stringify(staffForm) });
      setEditingStaff(null);
      setStaffForm({ pharmacy_name: '', email: '', password: '' });
      loadData();
      showToast('تم تحديث الموظف');
    } catch (err) { alert(err.message); }
  };
  const handleDeleteStaff = async () => {
    if (!deleteStaffTarget) return;
    try {
      await apiFetch(`/owner/staff/${deleteStaffTarget.id}`, { method: 'DELETE' });
      setDeleteStaffTarget(null);
      loadData();
      showToast('تم حذف الموظف');
    } catch (err) { alert(err.message); }
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
    } catch (err) { console.error(err); }
    finally { setSupplierMedLoading(false); }
  };

  // دوال الأدوية
  const handleDelete = (medicine) => setDeleteTarget(medicine);
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/medicines/${deleteTarget.id}`, { method: 'DELETE' });
      loadData();
      setSuccessMessage('تم الحذف بنجاح');
      showToast('تم الحذف');
    } catch (err) { onTokenError(err); }
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
          <div className="bg-white p-5 rounded-2xl shadow"><div className="text-sm text-slate-500">الأدوية</div><div className="text-3xl font-bold">{medicines.length}</div></div>
          <div className="bg-white p-5 rounded-2xl shadow"><div className="text-sm text-slate-500">الموظفين</div><div className="text-3xl font-bold">{staff.length}</div></div>
          <div className="bg-white p-5 rounded-2xl shadow"><div className="text-sm text-slate-500">المبيعات</div><div className="text-3xl font-bold text-emerald-700">{formatCurrency(totalSales)}</div></div>
          <div className="bg-white p-5 rounded-2xl shadow"><div className="text-sm text-slate-500">الموردين</div><div className="text-3xl font-bold">{suppliers.length}</div></div>
        </div>

        {/* أدوية */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold mb-4">إضافة دواء جديد</h2>
            <MedicineForm onSaved={loadData} onTokenError={onTokenError} onToast={showToast} userRole={user.role} ownerId={user.owner_id} isAdmin={false} pharmacies={[]} />
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
                      <td className="px-2 py-2">{m.expire_date}</td>
                      <td className="px-2 py-2"><div className="flex gap-1"><button onClick={() => setEditingMedicine(m)} className="bg-emerald-600 text-white text-xs px-2 py-1 rounded">تعديل</button><button onClick={() => handleDelete(m)} className="bg-rose-500 text-white text-xs px-2 py-1 rounded">حذف</button></div></td>
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
                    <td className="px-2 py-2">{new Date(s.sold_at).toLocaleString('ar-SA')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* الموردين */}
        <section className="rounded-2xl bg-white p-6 shadow mb-8">
          <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">الموردين</h2><button onClick={() => { setSuppliersLoading(true); apiFetch('/suppliers').then(d => { setSuppliers(d || []); setSuppliersLoading(false); }); }} className="text-sm text-emerald-700 border rounded-xl px-3 py-1">تحديث</button></div>
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
                <table className="w-full text-sm border-separate border-spacing-y-2">
                  <thead><tr className="text-right text-slate-500"><th className="px-2 py-1">الاسم</th><th className="px-2 py-1">السعر</th><th className="px-2 py-1">الوصف</th></tr></thead>
                  <tbody>{supplierMedicines.map(m => (<tr key={m.id} className="bg-slate-50 rounded-xl shadow-sm"><td className="px-2 py-2 font-semibold">{m.name}</td><td className="px-2 py-2">{formatCurrency(m.price)}</td><td className="px-2 py-2">{m.description || '-'}</td></tr>))}</tbody>
                </table>
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
                <input type="password" placeholder="كلمة المرور" value={staffForm.password} onChange={e => setStaffForm({...staffForm, password: e.target.value})} required className="w-full border rounded-xl p-3" />
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
                <input type="password" placeholder="كلمة مرور جديدة (اختياري)" value={staffForm.password} onChange={e => setStaffForm({...staffForm, password: e.target.value})} className="w-full border rounded-xl p-3" />
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
        {editingMedicine && <EditMedicineModal medicine={editingMedicine} onClose={() => setEditingMedicine(null)} onSaved={() => { setEditingMedicine(null); loadData(); }} onTokenError={onTokenError} />}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">تأكيد الحذف</h3>
              <p>هل أنت متأكد من حذف هذا الدواء؟</p>
              <div className="flex gap-3 mt-6"><button onClick={confirmDelete} className="flex-1 bg-red-600 text-white py-2 rounded-xl">حذف</button><button onClick={() => setDeleteTarget(null)} className="flex-1 border py-2 rounded-xl">إلغاء</button></div>
            </div>
          </div>
        )}
        {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} onSuccess={(msg) => { setSuccessMessage(msg); showToast(msg); }} onTokenError={onTokenError} />}

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