import { useState } from 'react';

export default function EditUserModal({ user, onSave, onClose }) {
  const [pharmacyName, setPharmacyName] = useState(user.pharmacy_name || user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [role, setRole] = useState(user.role || 'pharmacy_staff');

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl mx-4 space-y-4">
        <h3 className="text-lg font-bold text-slate-800">تعديل بيانات المستخدم</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">الاسم</label>
            <input type="text" value={pharmacyName} onChange={e => setPharmacyName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">البريد الإلكتروني</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">الدور</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2">
              <option value="admin">مدير النظام</option>
              <option value="pharmacy_owner">مالك صيدلية</option>
              <option value="pharmacy_staff">طاقم صيدلية</option>
              <option value="supplier">مورد مستودع</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">إلغاء</button>
          <button onClick={() => onSave(user.id, { pharmacy_name: pharmacyName, email, role })} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium shadow-sm">حفظ التعديلات</button>
        </div>
      </div>
    </div>
  );
}
