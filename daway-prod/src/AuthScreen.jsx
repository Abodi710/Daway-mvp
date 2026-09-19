import { useState } from 'react';
import { Lock, LogIn, Mail, ShieldCheck, Store, UserCheck } from 'lucide-react';
import api from './api.js';
import PharmacyRegister from './PharmacyRegister.jsx';
import CustomerRegister from './CustomerRegister.jsx';

/**
 * شاشة الدخول والتسجيل — التصميم منقول من
 * `daway-platform-main/src/pages/AuthPage.tsx` مع الإبقاء على عقود الخادم كما هي:
 *
 *   - الدخول    : POST /api/login بجسم `{ email, password }` عبر `api.auth.login`،
 *                 الذي يمرّر الاستجابة على `adaptUser` ثم يحفظ الجلسة (JWT + المستخدم)
 *                 في localStorage عبر `storeSession`.
 *   - التسجيل   : POST /api/register  (عميل)   عبر CustomerRegister
 *                 POST /api/pharmacy/register (صيدلية) عبر PharmacyRegister
 *                 الأول يُرجع رسالة فقط بلا توكن، والثاني طلب بانتظار مراجعة الإدارة —
 *                 لذا ينتهي كلاهما بالعودة إلى تبويب الدخول لا بجلسة مباشرة.
 *
 * ملاحظة مقصودة: تبويب الدخول لا يحتوي على مُنتقي دور. التصميم الأصلي كان يحاكي
 * الأدوار محليًا، أما هنا فالدور يأتي من قاعدة البيانات داخل رد /api/login.
 *
 * @param onAuthenticated يُنادى بـ (user, token) بعد نجاح الدخول.
 * @param initialView اللوحة المفتوحة عند التحميل: 'login' | 'reg_pharmacy' | 'reg_customer'.
 */
export default function AuthScreen({ onAuthenticated, initialView = 'login' }) {
  const [view, setView] = useState(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  /** `{ tone: 'error' | 'success', text }` — يحلّ محل نوافذ alert السابقة. */
  const [notice, setNotice] = useState(null);

  const isLoginTab = view === 'login';

  const showTab = (next) => {
    setView(next);
    setNotice(null);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setNotice(null);
    setSubmitting(true);
    try {
      // api.auth.login: POST /api/login { email, password } -> adaptUser -> storeSession.
      const session = await api.auth.login({ email, password });
      if (!session?.token || !session?.user) {
        throw new Error('استجابة غير متوقعة من الخادم، يرجى المحاولة مرة أخرى.');
      }
      if (onAuthenticated) onAuthenticated(session.user, session.token);
    } catch (error) {
      setNotice({ tone: 'error', text: error.message || 'البريد أو كلمة المرور غير صحيحة' });
    } finally {
      setSubmitting(false);
    }
  };

  /** يُمرَّر لنماذج التسجيل لتعرض رسائلها داخل الصفحة بدل نافذة alert. */
  const handleNotice = (text, tone = 'success') => setNotice({ tone, text });

  /** بعد نجاح التسجيل: العودة لتبويب الدخول مع إبقاء رسالة النجاح ظاهرة. */
  const handleRegistered = () => setView('login');

  return (
    <div dir="rtl" className="flex min-h-[80vh] flex-col bg-white md:flex-row">

      {/* ── لوحة الهوية (اليمين في RTL) ──────────────── */}
      <div className="relative flex w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 text-right text-white sm:p-10 md:w-1/2">
        <div
          className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:16px_16px]"
          aria-hidden="true"
        />

        {/* ترويسة العلامة */}
        <div className="relative z-10 flex items-center justify-end gap-2.5">
          <span className="flex flex-col items-end leading-tight">
            <span className="text-2xl font-black tracking-tight">دواي</span>
            <span className="text-[10px] text-emerald-100">صحتك بين يديك</span>
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-xl font-black">
            د
          </span>
        </div>

        {/* العنوان الرئيسي */}
        <div className="relative z-10 my-10 max-w-md space-y-4 md:my-0">
          <span className="inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-emerald-50">
            منظومة ذكية واحدة
          </span>
          <h1 className="text-2xl font-extrabold leading-snug sm:text-3xl lg:text-4xl">
            صحتك وسرعة حصولك على الدواء هي أولويتنا القصوى
          </h1>
          <p className="text-xs leading-relaxed text-emerald-50 sm:text-sm">
            بانضمامك إلى دواي تصل إلى الصيدليات المعتمدة ومستودعات الموردين في السودان، لمتابعة
            الأدوية الشحيحة والمنقذة للحياة، والتحقّق من الأسعار وتواريخ الصلاحية قبل الحجز.
          </p>

          <ul className="space-y-2 pt-2 text-xs text-emerald-50">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              مراجعة ترخيص كل صيدلية قبل اعتمادها
            </li>
            <li className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              صلاحيات منفصلة لكل دور داخل المنصّة
            </li>
          </ul>
        </div>

        {/* تذييل اللوحة */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-emerald-100">
          <span>دعم وتأمين طبي معتمد</span>
          <span>جمهورية السودان</span>
        </div>
      </div>

      {/* ── لوحة النماذج (اليسار في RTL) ─────────────── */}
      <div className="flex w-full flex-col justify-center p-6 text-right sm:p-12 md:w-1/2">
        <div className="mx-auto w-full max-w-md space-y-6">

          {/* التبويبات */}
          <div role="tablist" aria-label="الدخول أو التسجيل" className="flex rounded-xl border border-slate-200 bg-slate-100 p-1.5">
            <button
              type="button"
              role="tab"
              aria-selected={!isLoginTab}
              onClick={() => showTab('reg_customer')}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                !isLoginTab ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              إنشاء حساب جديد
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isLoginTab}
              onClick={() => showTab('login')}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                isLoginTab ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تسجيل الدخول
            </button>
          </div>

          {/* صندوق الرسائل */}
          {notice && (
            <div
              role="alert"
              className={`rounded-xl border p-3.5 text-xs font-medium ${
                notice.tone === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}
            >
              {notice.text}
            </div>
          )}

          {/* تبويب الدخول */}
          {isLoginTab ? (
            <form onSubmit={handleLogin} className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="block font-bold text-slate-500" htmlFor="login-email">
                  البريد الإلكتروني:
                </label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pe-4 ps-10 text-left text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-500" htmlFor="login-password">
                  كلمة المرور:
                </label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="login-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pe-4 ps-10 text-left text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {submitting ? 'جارٍ التحقّق…' : 'تسجيل الدخول الآمن'}
              </button>

              <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-center text-xs">
                <p className="text-slate-400">
                  ليس لديك حساب منشأة؟{' '}
                  <button
                    type="button"
                    onClick={() => showTab('reg_pharmacy')}
                    className="font-semibold text-emerald-600 underline"
                  >
                    سجّل صيدليتك الآن
                  </button>
                </p>
                <p className="text-slate-400">
                  تبحث عن دواء معيّن؟{' '}
                  <button
                    type="button"
                    onClick={() => showTab('reg_customer')}
                    className="font-semibold text-emerald-600 underline"
                  >
                    أنشئ حساب عميل
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* تبويب التسجيل — نوع الحساب يحدّد أيّ عقد خادم يُستخدم */
            <div className="space-y-5">
              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-slate-500">نوع الحساب:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => showTab('reg_customer')}
                    aria-pressed={view === 'reg_customer'}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all ${
                      view === 'reg_customer'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <UserCheck className="h-4 w-4" aria-hidden="true" />
                    عميل / مريض
                  </button>
                  <button
                    type="button"
                    onClick={() => showTab('reg_pharmacy')}
                    aria-pressed={view === 'reg_pharmacy'}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all ${
                      view === 'reg_pharmacy'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Store className="h-4 w-4" aria-hidden="true" />
                    صيدلية / منشأة
                  </button>
                </div>
              </div>

              {view === 'reg_pharmacy' ? (
                <PharmacyRegister onSwitch={handleRegistered} onNotice={handleNotice} />
              ) : (
                <CustomerRegister onSwitch={handleRegistered} onNotice={handleNotice} />
              )}
            </div>
          )}

          <p className="border-t border-slate-100 pt-4 text-center text-[11px] leading-relaxed text-slate-400">
            بالمتابعة أنت توافق على شروط استخدام منصّة دواي وسياسة الخصوصية الخاصة بها.
          </p>
        </div>
      </div>
    </div>
  );
}
