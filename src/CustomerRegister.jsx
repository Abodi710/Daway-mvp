import { useState } from 'react';
import { Lock, Mail, Phone, User } from 'lucide-react';
import { apiFetch } from './api.js';

/**
 * إنشاء حساب عميل — POST /api/register.
 *
 * العقد كما هو في server.cjs: `pharmacy_name` يحمل اسم الشخص للعملاء
 * (الخادم يستبدله بـ 'عميل' إن كان فارغاً). الخادم ينشئ دائماً حساب عميل ويتجاهل
 * أي `role` مُرسَل. `phone` عمود حقيقي يقرأه المسار ويخزّنه.
 *
 * الاستجابة `{ message }` بلا توكن، لذا ينتهي النجاح بالعودة إلى تبويب الدخول.
 *
 * @param onSwitch يُنادى بعد نجاح التسجيل للعودة إلى تبويب الدخول.
 * @param onNotice يُنادى بـ (text, tone) لعرض الرسائل في صندوق AuthScreen.
 */
export default function CustomerRegister({ onSwitch, onNotice }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const notify = (text, tone) => {
    if (onNotice) onNotice(text, tone);
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const data = await apiFetch('/register', {
        method: 'POST',
        body: JSON.stringify({
          pharmacy_name: name,
          email,
          password,
          phone,
        }),
      });
      notify(data?.message || 'تم إنشاء حسابك كعميل بنجاح! يمكنك الآن تسجيل الدخول.', 'success');
      if (onSwitch) onSwitch();
    } catch (error) {
      notify(error.message || 'تعذّر إنشاء الحساب، يرجى المحاولة مرة أخرى.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pe-4 ps-10 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <form onSubmit={handleRegister} className="space-y-4 text-xs sm:text-sm">
      <h3 className="text-center text-sm font-bold text-slate-700">إنشاء حساب عميل (للبحث والطلب)</h3>

      <div className="space-y-1">
        <label className="block font-bold text-slate-500" htmlFor="reg-customer-name">الاسم الكامل:</label>
        <div className="relative">
          <User className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="reg-customer-name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="الاسم الثلاثي"
            className={`${fieldClass} text-right`}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block font-bold text-slate-500" htmlFor="reg-customer-email">البريد الإلكتروني:</label>
        <div className="relative">
          <Mail className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="reg-customer-email"
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
        <label className="block font-bold text-slate-500" htmlFor="reg-customer-phone">
          رقم الهاتف <span className="font-medium text-slate-400">(اختياري)</span>:
        </label>
        <div className="relative">
          <Phone className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="reg-customer-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+249"
            className={`${fieldClass} text-left`}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block font-bold text-slate-500" htmlFor="reg-customer-password">كلمة المرور:</label>
        <div className="relative">
          <Lock className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="reg-customer-password"
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
        {submitting ? 'جارٍ الإنشاء…' : 'إنشاء حسابي'}
      </button>

      <p className="text-center text-[11px] text-slate-400">
        بعد إنشاء الحساب سجّل دخولك للبحث عن الأدوية وإرسال الطلبات للصيدليات.
      </p>
    </form>
  );
}
