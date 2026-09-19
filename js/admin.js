const { useState, useEffect } = React;

function AdminDashboard({ user, onLogout }) {
  const [medicines, setMedicines] = useState([]);
  const [users, setUsers] = useState([]);
  const [sales, setSales] = useState([]);
  const [pendingPharmacies, setPendingPharmacies] = useState([]);
  const [filterPharmacy, setFilterPharmacy] = useState('');
  const [editMed, setEditMed] = useState(null);
  const [editUsr, setEditUsr] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const loadData = () => {
    apiFetch('/medicines').then(data => setMedicines(data));
    apiFetch('/users').then(data => setUsers(data));
    apiFetch('/admin/sales').then(data => setSales(data));
    apiFetch('/admin/pending-pharmacies').then(data => setPendingPharmacies(data));
  };

  useEffect(() => { loadData(); }, []);

  const handleAddMedicine = (newMed) => {
    apiFetch('/medicines', { method: 'POST', body: JSON.stringify(newMed) }).then(() => {
      loadData();
      alert("تم إضافة الدواء بنجاح للمنظومة.");
    });
  };

  const handleSaveMedicine = (id, updatedFields) => {
    apiFetch(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(updatedFields) }).then(() => {
      setEditMed(null);
      loadData();
    });
  };

  const handleDeleteMedicine = (id) => {
    setConfirmAction({
      message: "هل أنت متأكد من رغبتك في حذف هذا الدواء من المنظومة نهائياً؟",
      onConfirm: () => {
        apiFetch(`/medicines/${id}`, { method: 'DELETE' }).then(() => {
          setConfirmAction(null);
          loadData();
        });
      }
    });
  };

  const handleAddUser = (newUser) => {
    apiFetch('/users', { method: 'POST', body: JSON.stringify(newUser) }).then(() => {
      setShowAddUser(false);
      loadData();
    });
  };

  const handleSaveUser = (id, updatedFields) => {
    apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(updatedFields) }).then(() => {
      setEditUsr(null);
      loadData();
    });
  };

  const handleDeleteUser = (id) => {
    setConfirmAction({
      message: "هل أنت متأكد من حذف حساب هذا المستخدم؟",
      onConfirm: () => {
        apiFetch(`/users/${id}`, { method: 'DELETE' }).then(() => {
          setConfirmAction(null);
          loadData();
        });
      }
    });
  };

  const handleApprovePharmacy = (id) => {
    apiFetch(`/admin/approve-pharmacy/${id}`, { method: 'POST' }).then(() => {
      alert("تمت الموافقة على طلب الصيدلية وتفعيل حسابها.");
      loadData();
    });
  };

  const handleRejectPharmacy = (id) => {
    apiFetch(`/admin/reject-pharmacy/${id}`, { method: 'POST' }).then(() => {
      alert("تم رفض طلب إنشاء الصيدلية وإزالته.");
      loadData();
    });
  };

  const uniquePharmacies = Array.from(new Set(medicines.map(m => m.pharmacy_name))).map((name, idx) => ({ id: idx + 1, pharmacy_name: name }));
  const filteredSales = filterPharmacy ? sales.filter(s => s.pharmacy_name.includes(filterPharmacy)) : sales;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold">لوحة تحكم مدير النظام العام</h2>
          <p className="text-slate-400 text-sm mt-1">مرحباً بك، {user.name} | إدارة صيدليات ومبيعات ومستخدمي منصة دواي</p>
        </div>
        <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 px-5 py-2 rounded-xl text-sm font-semibold transition shadow-sm">تسجيل الخروج</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs"><span className="text-xs text-slate-400 font-bold block mb-1">إجمالي الأدوية بالمنظومة</span><span className="text-3xl font-black text-slate-800">{medicines.length}</span></div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs"><span className="text-xs text-slate-400 font-bold block mb-1">المستخدمين المسجلين</span><span className="text-3xl font-black text-emerald-600">{users.length}</span></div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs"><span className="text-xs text-slate-400 font-bold block mb-1">الطلبات المعلقة</span><span className="text-3xl font-black text-amber-500">{pendingPharmacies.length}</span></div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs"><span className="text-xs text-slate-400 font-bold block mb-1">إجمالي عمليات البيع</span><span className="text-3xl font-black text-indigo-600">{sales.length}</span></div>
      </div>

      <MedicineForm onAdd={handleAddMedicine} pharmacies={uniquePharmacies} />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100"><h3 className="font-bold text-slate-800">جدول الأدوية الشامل في كافة الصيدليات</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                <th className="p-4">الاسم</th>
                <th className="p-4">الباركود</th>
                <th className="p-4">الصيدلية التابعة لها</th>
                <th className="p-4">السعر</th>
                <th className="p-4">الكمية</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
              {medicines.map(m => (
                <tr key={m.id} className="hover:bg-slate-50/80">
                  <td className="p-4 font-semibold">{m.name}</td>
                  <td className="p-4 font-mono text-xs">{m.bar_code}</td>
                  <td className="p-4 text-emerald-700 font-medium">{m.pharmacy_name}</td>
                  <td className="p-4">{formatCurrency(m.price)}</td>
                  <td className="p-4">{m.quantity}</td>
                  <td className="p-4 flex justify-center gap-2">
                    <button onClick={() => setEditMed(m)} className="text-emerald-600 hover:bg-emerald-50 px-3 py-1 rounded-lg text-xs">تعديل</button>
                    <button onClick={() => handleDeleteMedicine(m.id)} className="text-red-500 hover:bg-red-50 px-3 py-1 rounded-lg text-xs">حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">إدارة حسابات مستخدمي المنصة</h3>
          <button onClick={() => setShowAddUser(true)} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-700">إضافة مستخدم جديد +</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                <th className="p-4">الاسم</th>
                <th className="p-4">البريد الإلكتروني</th>
                <th className="p-4">الدور الوظيفي</th>
                <th className="p-4 text-center">الخيارات</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/80">
                  <td className="p-4 font-medium">{u.name || "لا يوجد اسم"}</td>
                  <td className="p-4">{u.email}</td>
                  <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded-md text-xs font-bold text-slate-600">{u.role}</span></td>
                  <td className="p-4 flex justify-center gap-2">
                    <button onClick={() => setEditUsr(u)} className="text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded-lg text-xs">تعديل</button>
                    <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:bg-red-50 px-3 py-1 rounded-lg text-xs">حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100"><h3 className="font-bold text-slate-800 text-amber-600">طلبات تسجيل الصيدليات الجديدة المعلقة</h3></div>
        {pendingPharmacies.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">لا توجد طلبات معلقة بانتظار المراجعة حالياً.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                  <th className="p-4">اسم الصيدلية المقترح</th>
                  <th className="p-4">اسم المالك طالب التسجيل</th>
                  <th className="p-4">رقم الهاتف</th>
                  <th className="p-4 text-center">القرار الإداري</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                {pendingPharmacies.map(p => (
                  <tr key={p.id}>
                    <td className="p-4 font-bold">{p.pharmacy_name}</td>
                    <td className="p-4">{p.owner_name}</td>
                    <td className="p-4 font-mono text-xs">{p.phone}</td>
                    <td className="p-4 flex justify-center gap-2">
                      <button onClick={() => handleApprovePharmacy(p.id)} className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-emerald-700">موافقة وتفعيل</button>
                      <button onClick={() => handleRejectPharmacy(p.id)} className="bg-red-500 text-white px-3 py-1 rounded-lg text-xs hover:bg-red-600">رفض الطلب</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="font-bold text-slate-800">سجل تقارير المبيعات الشاملة في النظام</h3>
          <div className="w-full sm:w-auto">
            <select value={filterPharmacy} onChange={e => setFilterPharmacy(e.target.value)} className="border border-slate-200 text-xs rounded-xl px-3 py-2 bg-slate-50 focus:outline-none">
              <option value="">كل الصيدليات المتوفرة</option>
              {uniquePharmacies.map(p => <option key={p.id} value={p.pharmacy_name}>{p.pharmacy_name}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                <th className="p-4">معرف العملية</th>
                <th className="p-4">الصيدلية</th>
                <th className="p-4">الدواء المباع</th>
                <th className="p-4">القيمة الإجمالية</th>
                <th className="p-4">تاريخ العملية</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
              {filteredSales.map(s => (
                <tr key={s.id}>
                  <td className="p-4 font-mono text-xs">#{s.id}</td>
                  <td className="p-4 text-slate-600">{s.pharmacy_name}</td>
                  <td className="p-4 font-medium">{s.medicine_name}</td>
                  <td className="p-4 text-indigo-600 font-bold">{formatCurrency(s.amount)}</td>
                  <td className="p-4 text-xs text-slate-400">{s.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editMed && <EditMedicineModal medicine={editMed} onSave={handleSaveMedicine} onClose={() => setEditMed(null)} />}
      {editUsr && <EditUserModal user={editUsr} onSave={handleSaveUser} onClose={() => setEditUsr(null)} />}
      {showAddUser && <AddUserModal onSave={handleAddUser} onClose={() => setShowAddUser(false)} />}
      {confirmAction && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full mx-4 space-y-4">
            <p className="text-sm font-bold text-slate-700">{confirmAction.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 border border-slate-200 text-xs rounded-xl hover:bg-slate-50">إلغاء</button>
              <button onClick={confirmAction.onConfirm} className="px-4 py-2 bg-red-500 text-white text-xs rounded-xl hover:bg-red-600">نعم، تأكيد الإجراء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.AdminDashboard = AdminDashboard;
