import { useState } from 'react';
import { apiFetch } from './api'; // تأكد من صحة مسار الاستيراد لديك

export default function AddUserModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // 👈 الحقل الجديد هنا
  const [role, setRole] = useState('pharmacy_staff');
  const [pharmacyName, setPharmacyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // إرسال البيانات للخادم الحقيقي عبر دالة apiFetch المحدثة
      const newUser = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password, // 👈 إرسال كلمة المرور مع الطلب
          role,
          pharmacy_name: pharmacyName // تحويلها لـ snake_case لتطابق متطلبات الـ Backend
        }),
      });

      alert('تم إضافة المستخدم بنجاح');
      if (onSave) onSave(newUser); // تحديث القائمة في لوحة التحكم
      onClose(); // إغلاق النافذة
    } catch (error) {
      alert(error.message || 'حدث خطأ أثناء إضافة المستخدم');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full text-right" dir="rtl">
        <h2 className="text-xl font-bold mb-4">إضافة مستخدم جديد</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">الاسم بالكامل</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              className="w-full p-2 border rounded"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* 👈 حقل كلمة المرور المضاف حديثاً */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">كلمة المرور</label>
            <input
              type="password"
              className="w-full p-2 border rounded"
              placeholder="أدخل كلمة مرور قوية"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">الدور الوظيفي</label>
            <select
              className="w-full p-2 border rounded"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="pharmacy_owner">مالك صيدلية</option>
              <option value="pharmacy_staff">طاقم صيدلية</option>
              <option value="supplier">مورد</option>
              <option value="customer">عميل</option>
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">اسم الصيدلية / الشركة التابعة لها (اختياري)</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={pharmacyName}
              onChange={(e) => setPharmacyName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
            >
              {isSubmitting ? 'جاري الإضافة...' : 'إضافة المستخدم'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}