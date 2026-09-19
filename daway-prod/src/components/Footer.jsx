import {
  Ambulance,
  Clock,
  Compass,
  Heart,
  Home,
  Info,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Pill,
  ShieldCheck,
  Siren,
  Stethoscope,
  TriangleAlert,
} from 'lucide-react';

/** روابط سريعة - مطابقة لروابط الهيدر */
const QUICK_LINKS = [
  { id: 'home', label: 'الرئيسية', icon: Home },
  { id: 'services', label: 'الخدمات', icon: Stethoscope },
  { id: 'explore', label: 'استكشف', icon: Compass },
  { id: 'about', label: 'من نحن', icon: Info },
];

/**
 * أرقام الطوارئ الوطنية في السودان.
 * ⚠️ يجب التحقّق من هذه الأرقام من مصدر رسمي قبل النشر للإنتاج.
 */
const EMERGENCY_NUMBERS = [
  { id: 'ambulance', label: 'الإسعاف', number: '333', icon: Ambulance },
  { id: 'police', label: 'الشرطة', number: '999', icon: ShieldCheck },
  { id: 'civil-defence', label: 'الدفاع المدني', number: '998', icon: Siren },
];

/** قنوات دعم المنصّة (قيم تجريبية) */
const SUPPORT_CHANNELS = [
  { id: 'hotline', label: 'خط الدعم', value: '+249 91 000 1234', href: 'tel:+249910001234', icon: Phone },
  { id: 'whatsapp', label: 'واتساب', value: '+249 92 000 5678', href: 'tel:+249920005678', icon: MessageCircle },
  { id: 'email', label: 'البريد الإلكتروني', value: 'support@daway.sd', href: 'mailto:support@daway.sd', icon: Mail },
];

export default function Footer({ activeLink = '', onNavigate }) {
  const year = new Date().getFullYear();

  const handleNavigate = (id) => {
    if (onNavigate) onNavigate(id);
  };

  return (
    <footer dir="rtl" className="bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* الهوية والوصف */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <Pill className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-lg font-extrabold text-white">دواي</span>
                <span className="text-[11px] font-semibold tracking-wide text-emerald-400">DAWAY</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              منصّة سودانية تربط المرضى بالصيدليات والموردين، لتسهيل البحث عن الأدوية
              ومعرفة توفّرها وطلبها بأمان وسرعة.
            </p>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              الخرطوم، جمهورية السودان
            </p>
          </div>

          {/* روابط سريعة */}
          <nav aria-label="روابط سريعة">
            <h2 className="text-sm font-bold text-white">روابط سريعة</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {QUICK_LINKS.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => handleNavigate(id)}
                    aria-current={activeLink === id ? 'page' : undefined}
                    className={`flex items-center gap-2 rounded text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      activeLink === id ? 'font-semibold text-emerald-400' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* أرقام الطوارئ */}
          <section aria-labelledby="footer-emergency">
            <h2 id="footer-emergency" className="flex items-center gap-1.5 text-sm font-bold text-white">
              <TriangleAlert className="h-4 w-4 text-rose-400" aria-hidden="true" />
              أرقام الطوارئ
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              {EMERGENCY_NUMBERS.map(({ id, label, number, icon: Icon }) => (
                <li key={id}>
                  <a
                    href={`tel:${number}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-800/60 px-3 py-2 ring-1 ring-slate-700 transition-colors hover:bg-rose-900/30 hover:ring-rose-700"
                  >
                    <span className="flex items-center gap-2 text-sm text-slate-300">
                      <Icon className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
                      {label}
                    </span>
                    <span dir="ltr" className="font-mono text-base font-bold text-white">{number}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          {/* الدعم والتواصل */}
          <section aria-labelledby="footer-support">
            <h2 id="footer-support" className="text-sm font-bold text-white">الدعم والتواصل</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {SUPPORT_CHANNELS.map(({ id, label, value, href, icon: Icon }) => (
                <li key={id}>
                  <a
                    href={href}
                    className="group flex items-start gap-2 text-sm text-slate-400 transition-colors hover:text-white"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                    <span className="flex flex-col leading-tight">
                      <span className="text-xs text-slate-500 group-hover:text-slate-400">{label}</span>
                      <span dir="ltr" className="font-medium">{value}</span>
                    </span>
                  </a>
                </li>
              ))}
              <li className="flex items-start gap-2 text-sm text-slate-400">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                <span className="flex flex-col leading-tight">
                  <span className="text-xs text-slate-500">ساعات الدعم</span>
                  <span className="font-medium">السبت - الخميس، 8:00 ص - 8:00 م</span>
                </span>
              </li>
            </ul>
          </section>
        </div>

        {/* الشريط السفلي */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-800 pt-6 sm:flex-row">
          <p className="text-xs text-slate-500">
            © {year} دواي · جميع الحقوق محفوظة
          </p>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            صُنع بـ
            <Heart className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
            في السودان
          </p>
        </div>
      </div>
    </footer>
  );
}
