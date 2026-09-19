import { useState } from 'react';

const ROLE_OPTIONS = [
  { value: 'customer', label: 'عميل' },
  { value: 'pharmacy_owner', label: 'مالك صيدلية' },
  { value: 'pharmacy_staff', label: 'طاقم صيدلية' },
  { value: 'supplier', label: 'مورد مستودع' },
  { value: 'admin', label: 'مدير النظام' },
];

/**
 * @param pharmacies `{ id, pharmacy_name }[]` — a staff account must belong to
 *   one of them (the server enforces this).
 */
export default function EditUserModal({ user, onSave, onClose, pharmacies = [] }) {
  const [pharmacyName, setPharmacyName] = useState(user.pharmacy_name || user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [role, setRole] = useState(user.role || 'customer');
  const [ownerId, setOwnerId] = useState(user.role === 'pharmacy_staff' && user.owner_id ? String(user.owner_id) : '');

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(user.id, {
      pharmacy_name: pharmacyName,
      email,
      role,
      ...(role === 'pharmacy_staff' ? { owner_id: Number(ownerId) } : {}),
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="edit-user-title" dir="rtl" className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl mx-4 space-y-4">
        <h3 id="edit-user-title" className="text-lg font-bold text-slate-800">تعديل بيانات المستخدم</h3>
        <div className="space-y-3">
          <label className="block">
            <span className="block text-sm text-slate-600 mb-1">الاسم</span>
            <input type="text" value={pharmacyName} onChange={e => setPharmacyName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
          </label>
          <label className="block">
            <span className="block text-sm text-slate-600 mb-1">البريد الإلكتروني</span>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
          </label>
          <label className="block">
            <span className="block text-sm text-slate-600 mb-1">الدور</span>
            <select value={role} onChange={e => setRole(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2">
              {ROLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {role === 'pharmacy_staff' && (
            <label className="block">
              <span className="block text-sm text-slate-600 mb-1">الصيدلية التي يتبع لها</span>
              <select required value={ownerId} onChange={e => setOwnerId(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2">
                <option value="">اختر الصيدلية</option>
                {pharmacies.map(p => <option key={p.id} value={p.id}>{p.pharmacy_name}</option>)}
              </select>
            </label>
          )}
          {role === 'admin' && user.role !== 'admin' && (
            <p className="rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-800">
              تنبيه: مدير النظام يملك صلاحيات كاملة على كل الصيدليات والمستخدمين.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">إلغاء</button>
          <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium shadow-sm">حفظ التعديلات</button>
        </div>
      </form>
    </div>
  );
}
