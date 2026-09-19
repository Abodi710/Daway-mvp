import { useState } from 'react';
import { Building, Mail, MapPin, Phone, Lock, User } from 'lucide-react';
import { apiFetch } from './api.js';

/**
 * طلب انضمام صيدلية — POST /api/pharmacy/register.
 *
 * العقد كما هو في server.cjs: الحقول الإلزامية هي
 * `pharmacy_name, owner_name, email, password`، و`phone`/`address` اختياريان.
 * الطلب يُخزَّن في جدول `pharmacy_registrations` بانتظار موافقة الإدارة — لا يُنشأ
 * حساب ولا يُصدر توكن هنا، لذا ينتهي النجاح بالعودة إلى تبويب الدخول.
 *
 * @param onSwitch يُنادى بعد نجاح الطلب للعودة إلى تبويب الدخول.
 * @param onNotice يُنادى بـ (text, tone) لعرض الرسائل في صندوق AuthScreen.
 */
export default function PharmacyRegister({ onSwitch, onNotice }) {
  const [pharmacyName, setPharmacyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const notify = (text, tone) => {
    if (onNotice) onNotice(text, tone);
  };

  const handleReg = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await apiFetch('/pharmacy/register', {
        method: 'POST',
        body: JSON.stringify({
          pharmacy_name: pharmacyName,
          owner_name: ownerName,
          phone,
          address,
          email,
          password,
        }),
      });
      notify(
        'تم رفع طلب تسجيل صيدليتك بنجاح إلى إدارة المنصّة. يرجى انتظار المراجعة والموافقة التفعيلية.',
        'success'
      );
      if (onSwitch) onSwitch();
    } catch (error) {
      notify(error.message || 'تعذّر إرسال طلب التسجيل، يرجى المحاولة مرة أخرى.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pe-4 ps-10 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <form onSubmit={handleReg} className="space-y-4 text-xs sm:text-sm">
      <h3 className="text-center text-sm font-bold text-slate-700">طلب انضمام صيدلية جديدة للمنصّة</h3>

      <div className="space-y-1">
        <label className="block font-bold text-slate-500" htmlFor="reg-pharmacy-name">اسم الصيدلية التجاري:</label>
        <div className="relative">
          <Building className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="reg-pharmacy-name"
            type="text"
            required
            value={pharmacyName}
            onChange={(event) => setPharmacyName(event.target.value)}
            placeholder="صيدلية النيل"
            className={`${fieldClass} text-right`}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block font-bold text-slate-500" htmlFor="reg-owner-name">اسم المالك بالكامل:</label>
        <div className="relative">
          <User className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="reg-owner-name"
            type="text"
            required
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
            placeholder="الاسم الثلاثي"
            className={`${fieldClass} text-right`}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block font-bold text-slate-500" htmlFor="reg-pharmacy-phone">رقم هاتف الصيدلية أو المالك:</label>
        <div className="relative">
          <Phone className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="reg-pharmacy-phone"
            type="tel"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+249"
            className={`${fieldClass} text-left`}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block font-bold text-slate-500" htmlFor="reg-pharmacy-address">
          عنوان الصيدلية <span className="font-medium text-slate-400">(اختياري)</span>:
        </label>
        <div className="relative">
          <MapPin className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="reg-pharmacy-address"
            type="text"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="الولاية، المدينة، الشارع"
            className={`${fieldClass} text-right`}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block font-bold text-slate-500" htmlFor="reg-pharmacy-email">البريد الإلكتروني:</label>
        <div className="relative">
          <Mail className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="reg-pharmacy-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            className={`${fieldClass} text-left`}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block font-bold text-slate-500" htmlFor="reg-pharmacy-password">كلمة المرور:</label>
        <div className="relative">
          <Lock className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="reg-pharmacy-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="8 خانات على الأقل"
            className={`${fieldClass} text-left`}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
      >
        {submitting ? 'جارٍ الإرسال…' : 'إرسال طلب التسجيل'}
      </button>

      <p className="text-center text-[11px] text-slate-400">
        يُراجع فريق دواي الترخيص قبل تفعيل الحساب، وسيصلك إشعار بنتيجة المراجعة.
      </p>
    </form>
  );
}
