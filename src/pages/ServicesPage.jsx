import { Building2, Network, Search, ArrowLeft, CheckCircle2 } from 'lucide-react';

const services = [
  {
    title: 'Cloud ERP للصيدليات',
    text: 'مخزون، صلاحيات مستخدمين، طلبات، وتنبيهات نقص وصلاحية من لوحة واحدة.',
    icon: Building2,
    route: 'register-pharmacy',
    cta: 'سجّل صيدليتك',
    points: ['إدارة المخزون', 'تنبيهات آلية', 'تقارير يومية'],
  },
  {
    title: 'بحث المرضى عن الدواء',
    text: 'محرك بحث يربط اسم الدواء بالتوفر والسعر والصيدلية والمدينة.',
    icon: Search,
    route: 'explore',
    cta: 'ابحث عن دواء',
    points: ['بحث بالاسم العلمي', 'فلترة حسب المدينة', 'إضافة للسلة'],
  },
  {
    title: 'شبكة الجملة والتوريد',
    text: 'ربط الصيدليات بالموردين لمتابعة طلبات الجملة وسلاسل الإمداد.',
    icon: Network,
    // Suppliers are onboarded by the platform team, so this leads to sign-in.
    route: 'login',
    cta: 'دخول الموردين',
    points: ['كتالوج جملة', 'أسعار الجملة', 'أوامر التوريد'],
  },
];

export default function ServicesPage({ onNavigate }) {
  return (
    <main dir="rtl" className="bg-slate-50">
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-bold text-emerald-700">خدمات المنصة</p>
          <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl">تكامل دوائي من المريض حتى المورد</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            دواي تجمع البحث، إدارة المخزون، والشراء بالجملة في تجربة واحدة جاهزة للنمو.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {services.map(({ title, text, icon: Icon, points, route, cta }) => (
            <article key={title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-5 text-xl font-extrabold text-slate-900">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
              <ul className="mt-5 space-y-2">
                {points.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    {point}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onNavigate(route)}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
              >
                {cta}
                <ArrowLeft className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
