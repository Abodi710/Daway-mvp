const { useState, useEffect } = React;

function PharmacyStaffDashboard({ user, onLogout }) {
  const [medicines, setMedicines] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [editMed, setEditMed] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const loadStaffData = () => {
    apiFetch('/medicines').then(data => {
      const myMeds = data.filter(m => m.pharmacy_name === user.pharmacy_name);
      setMedicines(myMeds);
    });
    apiFetch('/medicines/expiry-alerts').then(data => {
      setExpiryAlerts(data.filter(m => m.pharmacy_name === user.pharmacy_name));
    });
    apiFetch('/medicines/low-stock').then(data => {
      setLowStockAlerts(data.filter(m => m.pharmacy_name === user.pharmacy_name));
    });
  };

  useEffect(() => { loadStaffData(); }, []);

  const handleAddMedicine = (newMed) => {
    const item = { ...newMed, pharmacy_name: user.pharmacy_name, pharmacy_id: user.pharmacy_id || "1" };
    apiFetch('/medicines', { method: 'POST', body: JSON.stringify(item) }).then(() => {
      loadStaffData();
      alert("تمت إضافة الدواء بنجاح لمخزون صيدليتك.");
    });
  };

  const handleSaveMedicine = (id, fields) => {
    apiFetch(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(fields) }).then(() => {
      setEditMed(null);
      loadStaffData();
    });
  };

  const handleDeleteClick = (id) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = () => {
    apiFetch(`/medicines/${confirmDeleteId}`, { method: 'DELETE' }).then(() => {
      setConfirmDeleteId(null);
      loadStaffData();
    });
  };

  const handleChangePassword = async ({ oldPassword, newPassword }) => {
    await apiFetch('/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    alert("تم تحديث كلمة المرور السرية لطاقم الصيدلية بنجاح.");
    setShowChangePassword(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-emerald-700 text-white rounded-3xl p-6 shadow-md flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">بوابة طاقم الصيدلية التنفيذي</h2>
          <p className="text-emerald-100 text-xs mt-1">المنشأة الحالية: <span className="font-bold underline">{user.pharmacy_name}</span> | الموظف المسؤول: {user.name}</p>
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
              <h4 className="text-sm font-bold text-red-700">⚠️ تنبيه أدوية منتهية أو قريبة الانتهاء!</h4>
              <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
                {expiryAlerts.map(e => <li key={e.id}>{e.name} (تاريخ: {e.expiry_date})</li>)}
              </ul>
            </div>
          )}
          {lowStockAlerts.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl space-y-2">
              <h4 className="text-sm font-bold text-amber-700">📉 تنبيه مخزون حرج (شبه نافذ):</h4>
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

      <MedicineForm onAdd={handleAddMedicine} pharmacies={null} />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100"><h3 className="font-bold text-slate-800 text-sm">جرد وقائمة المخزون المتوفر في الصيدلية</h3></div>
        {medicines.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">لا توجد أصناف مسجلة في صيدليتك حتى الآن. يرجى ملء النموذج لإضافة المخزون.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs border-b border-slate-100">
                  <th className="p-4">اسم المستحضر</th>
                  <th className="p-4">الباركود التناظري</th>
                  <th className="p-4">سعر البيع</th>
                  <th className="p-4">الكمية بالمخزن</th>
                  <th className="p-4">تاريخ انتهاء الصلاحية</th>
                  <th className="p-4 text-center">إجراءات المخزون</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                {medicines.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/50">
                    <td className="p-4 font-bold text-slate-800">{m.name}</td>
                    <td className="p-4 font-mono text-xs">{m.bar_code}</td>
                    <td className="p-4 text-slate-600">{formatCurrency(m.price)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${m.quantity <= 10 ? 'bg-amber-100 text-amber-700' : 'text-slate-800'}`}>{m.quantity}</span>
                    </td>
                    <td className="p-4 text-xs font-mono">{m.expiry_date}</td>
                    <td className="p-4 flex justify-center gap-2">
                      <button onClick={() => setEditMed(m)} className="text-emerald-600 hover:underline text-xs">تعديل الأرقام</button>
                      <button onClick={() => handleDeleteClick(m.id)} className="text-red-500 hover:underline text-xs">حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

window.PharmacyStaffDashboard = PharmacyStaffDashboard;
