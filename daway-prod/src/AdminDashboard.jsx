import { useState, useEffect } from 'react';
import { Activity, CircleCheck, CircleX, Clock, LogOut, Pill, ShieldCheck, Store, Users } from 'lucide-react';
import { apiFetch, handleApiError } from './api.js';
import { formatCurrency } from './formatCurrency.js';
import { formToMedicinePayload, medicineEditPayload } from './medicineHelpers.js';
import MedicineForm from './MedicineForm.jsx';
import EditMedicineModal from './EditMedicineModal.jsx';
import AddUserModal from './AddUserModal.jsx';
import EditUserModal from './EditUserModal.jsx';
import RejectReasonModal from './RejectReasonModal';

/**
 * Presentation config mirroring the landing page's card language: an icon badge
 * with a `ring-4` halo, in one of the shared accent triples.
 */
const STAT_CARDS = [
  { id: 'medicines', label: 'إجمالي الأدوية بالمنظومة', icon: Pill, accent: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
  { id: 'users', label: 'المستخدمين المسجلين', icon: Users, accent: 'bg-sky-50 text-sky-600 ring-sky-100' },
  { id: 'pending', label: 'الطلبات المعلقة', icon: Clock, accent: 'bg-amber-50 text-amber-600 ring-amber-100' },
  { id: 'sales', label: 'إجمالي عمليات البيع', icon: Activity, accent: 'bg-violet-50 text-violet-600 ring-violet-100' },
];

/** Same Arabic role labels the site header uses, so both agree. */
const ROLE_LABELS = {
  admin: 'مدير النظام',
  supplier: 'مورّد',
  pharmacy_owner: 'صاحب صيدلية',
  pharmacy_staff: 'موظف صيدلية',
  customer: 'عميل',
};

const ROLE_STYLES = {
  admin: 'bg-purple-50 text-purple-700 ring-purple-100',
  supplier: 'bg-amber-50 text-amber-700 ring-amber-100',
  pharmacy_owner: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  pharmacy_staff: 'bg-teal-50 text-teal-700 ring-teal-100',
  customer: 'bg-sky-50 text-sky-700 ring-sky-100',
};

/** Shared shells, so every panel and table cell stays consistent. */
const PANEL = 'overflow-hidden rounded-2xl border border-slate-200 bg-white';
const PANEL_HEAD = 'flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between';
const TH = 'px-4 py-3 text-[11px] font-semibold text-slate-500';
const TD = 'px-4 py-3';
const ROW = 'transition-colors hover:bg-slate-50/70';
const EMPTY = 'px-4 py-10 text-center text-sm text-slate-500';
const ACTION = 'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors';

/** Panel heading with the icon badge used across the marketing pages. */
function PanelTitle({ icon: Icon, accent, children }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-4 ${accent}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="text-base font-bold text-slate-900">{children}</h3>
    </div>
  );
}

export default function AdminDashboard({ user, onLogout, onTokenError }) {
  const [medicines, setMedicines] = useState([]);
  const [users, setUsers] = useState([]);
  const [sales, setSales] = useState([]);
  const [pendingPharmacies, setPendingPharmacies] = useState([]);
  const [filterPharmacy, setFilterPharmacy] = useState('');
  const [editMed, setEditMed] = useState(null);
  const [editUsr, setEditUsr] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [rejectPharmacyId, setRejectPharmacyId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  // An expired/forbidden session (401/403) redirects to login via onTokenError;
  // every other failure is reported without dropping the session.
  const reportError = (err) => handleApiError(err, onTokenError, (e) => alert(e.message));
  const logError = (err) => handleApiError(err, onTokenError, (e) => console.error(e));

  const loadData = () => {
    apiFetch('/medicines').then(data => setMedicines(data || [])).catch(logError);
    apiFetch('/users').then(data => setUsers(data || [])).catch(logError);
    apiFetch('/admin/sales').then(data => setSales(data || [])).catch(logError);
    apiFetch('/admin/pending-pharmacies').then(data => setPendingPharmacies(data || [])).catch(logError);
  };

  // Run once on mount. loadData is re-created each render, so listing it as a
  // dependency would refetch on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, []);

  const ownerPharmacies = users.filter(u => u.role === 'pharmacy_owner');
  const pharmacyNameByOwnerId = (ownerId) => {
    const owner = ownerPharmacies.find(u => u.id === ownerId || u.owner_id === ownerId);
    return owner ? owner.pharmacy_name : `#${ownerId}`;
  };

  const handleAddMedicine = (newMed) => {
    const payload = formToMedicinePayload(newMed, { isAdmin: true });
    apiFetch('/medicines', { method: 'POST', body: JSON.stringify(payload) }).then(() => {
      loadData();
      alert("تم إضافة الدواء بنجاح للمنظومة.");
    }).catch(reportError);
  };

  const handleSaveMedicine = (id, updatedFields) => {
    const med = medicines.find(m => m.id === id);
    const payload = medicineEditPayload(med || {}, updatedFields);
    apiFetch(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(payload) }).then(() => {
      setEditMed(null);
      loadData();
    }).catch(reportError);
  };

  const handleDeleteMedicine = (id) => {
    setConfirmAction({
      message: "هل أنت متأكد من رغبتك في حذف هذا الدواء من المنظومة نهائياً؟",
      onConfirm: () => {
        apiFetch(`/medicines/${id}`, { method: 'DELETE' }).then(() => {
          setConfirmAction(null);
          loadData();
        }).catch(reportError);
      }
    });
  };

  const handleAddUser = (newUser) => {
    setShowAddUser(false);
    setUsers((prev) => [newUser, ...prev]);
    loadData();
  };

  const handleSaveUser = (id, updatedFields) => {
    apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify({
      pharmacy_name: updatedFields.pharmacy_name || updatedFields.name,
      email: updatedFields.email,
      role: updatedFields.role,
    }) }).then(() => {
      setEditUsr(null);
      loadData();
    }).catch(reportError);
  };

  const handleDeleteUser = (id) => {
    setConfirmAction({
      message: "هل أنت متأكد من حذف حساب هذا المستخدم؟",
      onConfirm: () => {
        apiFetch(`/users/${id}`, { method: 'DELETE' }).then(() => {
          setConfirmAction(null);
          loadData();
        }).catch(reportError);
      }
    });
  };

  const handleApprovePharmacy = (id) => {
    apiFetch(`/admin/approve-pharmacy/${id}`, { method: 'PUT' }).then(() => {
      alert("تمت الموافقة على طلب الصيدلية وتفعيل حسابها.");
      loadData();
    }).catch(reportError);
  };

  const handleRejectPharmacy = (id) => {
    setRejectPharmacyId(id);
    setRejectionReason('');
  };

  const handleSubmitRejection = async () => {
    if (!rejectPharmacyId) return;
    try {
      await apiFetch(`/admin/reject-pharmacy/${rejectPharmacyId}`, { method: 'PUT', body: JSON.stringify({ rejection_reason: rejectionReason }) });
      setRejectPharmacyId(null);
      setRejectionReason('');
      loadData();
    } catch (err) {
      reportError(err);
    }
  };

  const uniquePharmacies = ownerPharmacies.map(u => ({ id: u.owner_id || u.id, pharmacy_name: u.pharmacy_name }));
  const filteredSales = filterPharmacy ? sales.filter(s => s.pharmacy_name && s.pharmacy_name.includes(filterPharmacy)) : sales;

  const statValues = {
    medicines: medicines.length,
    users: users.length,
    pending: pendingPharmacies.length,
    sales: sales.length,
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        {/* ── الترويسة ─────────────────────────────────── */}
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 ring-1 ring-purple-100">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              مدير النظام
            </span>
            <h1 className="mt-4 text-2xl font-extrabold text-slate-900 sm:text-3xl">
              لوحة تحكم مدير النظام العام
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              مرحباً بك، {user.pharmacy_name || user.email} · إدارة صيدليات ومبيعات ومستخدمي منصة دواي
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            تسجيل الخروج
          </button>
        </header>

        {/* ── مؤشرات سريعة ─────────────────────────────── */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_CARDS.map(({ id, label, icon: Icon, accent }) => (
            <div
              key={id}
              className="rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl ring-4 ${accent}`}>
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="mt-5 text-[11px] font-semibold text-slate-500">{label}</p>
              <p className="mt-1 text-3xl font-extrabold text-slate-900">{statValues[id]}</p>
            </div>
          ))}
        </div>

        {/* ── إضافة دواء ───────────────────────────────── */}
        <section className={PANEL}>
          <div className={PANEL_HEAD}>
            <PanelTitle icon={Pill} accent="bg-emerald-50 text-emerald-600 ring-emerald-100">
              إضافة دواء جديد للمنظومة
            </PanelTitle>
          </div>
          <div className="p-5">
            <MedicineForm onAdd={handleAddMedicine} pharmacies={uniquePharmacies} />
          </div>
        </section>

        {/* ── الأدوية ──────────────────────────────────── */}
        <section className={PANEL}>
          <div className={PANEL_HEAD}>
            <PanelTitle icon={Pill} accent="bg-emerald-50 text-emerald-600 ring-emerald-100">
              جدول الأدوية الشامل في كافة الصيدليات
            </PanelTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className={TH}>الاسم</th>
                  <th className={TH}>الباركود</th>
                  <th className={TH}>الصيدلية التابعة لها</th>
                  <th className={TH}>السعر</th>
                  <th className={TH}>الكمية</th>
                  <th className={`${TH} text-center`}>إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {medicines.length === 0 ? (
                  <tr><td colSpan="6" className={EMPTY}>لا توجد أدوية لعرضها.</td></tr>
                ) : medicines.map(m => (
                  <tr key={m.id} className={ROW}>
                    <td className={`${TD} font-bold text-slate-900`}>{m.name}</td>
                    <td className={`${TD} font-mono text-xs text-slate-500`}>{m.barcode || m.bar_code || '-'}</td>
                    <td className={`${TD} font-medium text-emerald-700`}>{pharmacyNameByOwnerId(m.owner_id)}</td>
                    <td className={TD}>{formatCurrency(m.price)}</td>
                    <td className={TD}>{m.quantity}</td>
                    <td className={`${TD} text-center`}>
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => setEditMed(m)} className={`${ACTION} text-emerald-700 hover:bg-emerald-50`}>تعديل</button>
                        <button type="button" onClick={() => handleDeleteMedicine(m.id)} className={`${ACTION} text-rose-600 hover:bg-rose-50`}>حذف</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── المستخدمون ───────────────────────────────── */}
        <section className={PANEL}>
          <div className={PANEL_HEAD}>
            <PanelTitle icon={Users} accent="bg-sky-50 text-sky-600 ring-sky-100">
              إدارة حسابات مستخدمي المنصة
            </PanelTitle>
            <button
              type="button"
              onClick={() => setShowAddUser(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              إضافة مستخدم جديد +
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className={TH}>الاسم</th>
                  <th className={TH}>البريد الإلكتروني</th>
                  <th className={TH}>الدور الوظيفي</th>
                  <th className={`${TH} text-center`}>الخيارات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {users.length === 0 ? (
                  <tr><td colSpan="4" className={EMPTY}>لا يوجد مستخدمون لعرضهم.</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} className={ROW}>
                    <td className={`${TD} font-bold text-slate-900`}>{u.pharmacy_name || "لا يوجد اسم"}</td>
                    <td className={`${TD} text-slate-600`}>{u.email}</td>
                    <td className={TD}>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${ROLE_STYLES[u.role] || 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className={`${TD} text-center`}>
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => setEditUsr(u)} className={`${ACTION} text-sky-700 hover:bg-sky-50`}>تعديل</button>
                        <button type="button" onClick={() => handleDeleteUser(u.id)} className={`${ACTION} text-rose-600 hover:bg-rose-50`}>حذف</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── طلبات التسجيل ────────────────────────────── */}
        <section className={PANEL}>
          <div className={PANEL_HEAD}>
            <PanelTitle icon={Store} accent="bg-amber-50 text-amber-600 ring-amber-100">
              طلبات تسجيل الصيدليات الجديدة المعلقة
            </PanelTitle>
          </div>
          {pendingPharmacies.length === 0 ? (
            <p className={EMPTY}>لا توجد طلبات معلقة بانتظار المراجعة حالياً.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className={TH}>اسم الصيدلية المقترح</th>
                    <th className={TH}>اسم المالك طالب التسجيل</th>
                    <th className={TH}>رقم الهاتف</th>
                    <th className={`${TH} text-center`}>القرار الإداري</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {pendingPharmacies.map(p => (
                    <tr key={p.id} className={ROW}>
                      <td className={`${TD} font-bold text-slate-900`}>{p.pharmacy_name}</td>
                      <td className={`${TD} text-slate-600`}>{p.owner_name}</td>
                      <td className={`${TD} font-mono text-xs text-slate-500`}>{p.phone}</td>
                      <td className={`${TD} text-center`}>
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleApprovePharmacy(p.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                          >
                            <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            موافقة وتفعيل
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectPharmacy(p.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50"
                          >
                            <CircleX className="h-3.5 w-3.5" aria-hidden="true" />
                            رفض الطلب
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── المبيعات ─────────────────────────────────── */}
        <section className={PANEL}>
          <div className={PANEL_HEAD}>
            <PanelTitle icon={Activity} accent="bg-violet-50 text-violet-600 ring-violet-100">
              سجل تقارير المبيعات الشاملة في النظام
            </PanelTitle>
            <select
              value={filterPharmacy}
              onChange={e => setFilterPharmacy(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:w-auto"
            >
              <option value="">كل الصيدليات المتوفرة</option>
              {uniquePharmacies.map(p => <option key={p.id} value={p.pharmacy_name}>{p.pharmacy_name}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className={TH}>معرف العملية</th>
                  <th className={TH}>الصيدلية</th>
                  <th className={TH}>الدواء المباع</th>
                  <th className={TH}>القيمة الإجمالية</th>
                  <th className={TH}>تاريخ العملية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredSales.length === 0 ? (
                  <tr><td colSpan="5" className={EMPTY}>لا توجد عمليات بيع مسجلة.</td></tr>
                ) : filteredSales.map(s => (
                  <tr key={s.id} className={ROW}>
                    <td className={`${TD} font-mono text-xs text-slate-500`}>#{s.id}</td>
                    <td className={`${TD} text-slate-600`}>{s.pharmacy_name}</td>
                    <td className={`${TD} font-bold text-slate-900`}>{s.medicine_name}</td>
                    <td className={`${TD} font-bold text-violet-700`}>{formatCurrency(s.total_price)}</td>
                    <td className={`${TD} text-xs text-slate-500`}>{s.sold_at ? new Date(s.sold_at).toLocaleString('ar-SA') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editMed && <EditMedicineModal medicine={editMed} onSave={handleSaveMedicine} onClose={() => setEditMed(null)} />}
      {editUsr && <EditUserModal user={editUsr} onSave={handleSaveUser} onClose={() => setEditUsr(null)} />}
      {showAddUser && <AddUserModal onSave={handleAddUser} onClose={() => setShowAddUser(false)} />}
      {rejectPharmacyId && <RejectReasonModal rejectPharmacyId={rejectPharmacyId} rejectionReason={rejectionReason} onRequestClose={() => { setRejectPharmacyId(null); setRejectionReason(''); }} onSubmit={handleSubmitRejection} />}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <p className="text-sm font-bold text-slate-900">{confirmAction.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={confirmAction.onConfirm}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
              >
                نعم، تأكيد الإجراء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
