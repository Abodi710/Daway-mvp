const { useState } = React;

function MedicineForm({ onAdd, pharmacies }) {
  const [name, setName] = useState('');
  const [barCode, setBarCode] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [pharmacyId, setPharmacyId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    let pName = "";
    if (pharmacies) {
      const selected = pharmacies.find(p => p.id == pharmacyId);
      pName = selected ? selected.pharmacy_name : "عام";
    }
    onAdd({
      name,
      bar_code: barCode,
      price: parseFloat(price),
      quantity: parseInt(quantity),
      expiry_date: expiryDate,
      pharmacy_id: pharmacyId || "1",
      pharmacy_name: pName || "الصيدلية الافتراضية"
    });
    setName(''); setBarCode(''); setPrice(''); setQuantity(''); setExpiryDate('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
      <h3 className="text-lg font-bold text-slate-800 mb-2">إضافة دواء جديد للمنظومة</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">اسم الدواء</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">الباركود</label>
          <input type="text" value={barCode} onChange={e => setBarCode(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">السعر (ريال)</label>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">الكمية</label>
          <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">تاريخ انتهاء الصلاحية</label>
          <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        {pharmacies && (
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">تخصيص لصيدلية</label>
            <select value={pharmacyId} onChange={e => setPharmacyId(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">اختر الصيدلية</option>
              {pharmacies.map(p => <option key={p.id} value={p.id}>{p.pharmacy_name}</option>)}
            </select>
          </div>
        )}
      </div>
      <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition shadow-sm">حفظ الدواء</button>
    </form>
  );
}

function EditMedicineModal({ medicine, onSave, onClose }) {
  const [name, setName] = useState(medicine.name);
  const [price, setPrice] = useState(medicine.price);
  const [quantity, setQuantity] = useState(medicine.quantity);

  const handleSave = () => {
    onSave(medicine.id, { name, price: parseFloat(price), quantity: parseInt(quantity) });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl mx-4 space-y-4">
        <h3 className="text-lg font-bold text-slate-800">تعديل بيانات الدواء</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">اسم الدواء</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">السعر</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">الكمية</label>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">إلغاء</button>
          <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium shadow-sm">حفظ التغييرات</button>
        </div>
      </div>
    </div>
  );
}

function AddUserModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('pharmacy_staff');
  const [pharmacyName, setPharmacyName] = useState('');

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl mx-4 space-y-4">
        <h3 className="text-lg font-bold text-slate-800">إضافة مستخدم جديد</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">الاسم بالكامل</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">البريد الإلكتروني</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">الدور الوظيفي</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2">
              <option value="admin">مدير النظام</option>
              <option value="pharmacy_owner">مالك صيدلية</option>
              <option value="pharmacy_staff">طاقم صيدلية</option>
              <option value="supplier">مورد مستودع</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">اسم الصيدلية / الشركة التابعة لها</label>
            <input type="text" value={pharmacyName} onChange={e => setPharmacyName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" placeholder="اختياري" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">إلغاء</button>
          <button onClick={() => onSave({ name, email, role, pharmacy_name: pharmacyName })} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium shadow-sm">إضافة المستخدم</button>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ user, onSave, onClose }) {
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [role, setRole] = useState(user.role || 'pharmacy_staff');

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl mx-4 space-y-4">
        <h3 className="text-lg font-bold text-slate-800">تعديل بيانات المستخدم</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">الاسم</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
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
          <button onClick={() => onSave(user.id, { name, email, role })} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium shadow-sm">حفظ التعديلات</button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onSave, onClose }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSave = () => {
    if (newPassword.length < 6) {
      alert("يجب أن تكون كلمة المرور الجديدة مكونة من 6 خانات على الأقل");
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

window.MedicineForm = MedicineForm;
window.EditMedicineModal = EditMedicineModal;
window.AddUserModal = AddUserModal;
window.EditUserModal = EditUserModal;
window.ChangePasswordModal = ChangePasswordModal;
