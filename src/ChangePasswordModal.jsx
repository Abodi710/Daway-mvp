import { useState } from 'react';

export default function ChangePasswordModal({ onSave, onClose }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSave = () => {
    if (newPassword.length < 8) {
      alert("يجب أن تكون كلمة المرور الجديدة مكونة من 8 خانات على الأقل");
      return;
    }
    onSave({ oldPassword, newPassword });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl mx-4 space-y-4">
        <h3 className="text-lg font-bold text-slate-800">تغيير كلمة المرور الشخصية</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">كلمة المرور الحالية</label>
            <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">كلمة المرور الجديدة</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-emerald-500 focus:outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">إلغاء</button>
          <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium shadow-sm">تحديث كلمة المرور</button>
        </div>
      </div>
    </div>
  );
}
