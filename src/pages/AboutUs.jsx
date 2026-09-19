import {
  ArrowLeft,
  CircleCheck,
  Eye,
  Handshake,
  Heart,
  Lightbulb,
  Lock,
  MapPin,
  Package,
  Pill,
  Radar,
  Search,
  ShieldCheck,
  Siren,
  Store,
  Target,
  Users,
} from 'lucide-react';

/**
 * معرّفات المسارات المستخدمة مع onNavigate:
 * 'explore' | 'register-pharmacy' | 'home'
 */

/** الرؤية والرسالة */
const PILLARS = [
  {
    id: 'vision',
    label: 'رؤيتنا',
    title: 'دواء متاح ومعروف المكان لكل مريض في السودان',
    body: 'نتصوّر سوداناً لا يضطر فيه أحد للتنقّل بين عشر صيدليات ليعرف إن كان دواؤه متوفّراً. المعلومة الدوائية الصحيحة، في الوقت الصحيح، حقّ لكل مريض.',
    icon: Eye,
    theme: 'bg-emerald-600',
  },
  {
    id: 'mission',
    label: 'رسالتنا',
    title: 'نربط المرضى بالصيدليات الموثّقة والموردين في منصّة واحدة',
    body: 'نبني أدوات بسيطة تعمل على الشبكات الضعيفة وبالعربية أولاً: بحث عن الأدوية، إدارة مخزون للصيدليات، وقناة توريد واضحة تقلّل فترات النفاد.',
    icon: Target,
    theme: 'bg-slate-900',
  },
];

/** تتبّع أدوية الطوارئ */
const EMERGENCY_CAPABILITIES = [
  {
    id: 'critical-stock',
    title: 'رصد الأدوية الحرجة',
    description: 'متابعة توفّر الأدوية المنقذة للحياة كأدوية السكري والضغط والمضادات الحيوية عبر الصيدليات المشاركة.',
    icon: Package,
  },
  {
    id: 'shortage-alerts',
    title: 'تنبيهات النقص المبكرة',
    description: 'عندما يقترب دواء أساسي من النفاد في منطقة ما، ينبّه النظام الصيدلية والمورّد قبل أن يتوقّف الصرف.',
    icon: Siren,
  },
  {
    id: 'geo-view',
    title: 'خريطة التوفّر',
    description: 'عرض التوفّر على مستوى الولاية والمدينة، ليتمكّن المريض من التوجّه إلى أقرب مصدر فعلي للدواء.',
    icon: MapPin,
  },
  {
    id: 'expiry',
    title: 'مراقبة الصلاحية',
    description: 'تتبّع تواريخ انتهاء الصلاحية وأرقام التشغيلات، للحد من صرف دواء منتهي أو غير صالح.',
    icon: ShieldCheck,
  },
];

/** القيم الأساسية */
const VALUES = [
  { id: 'trust', title: 'الثقة أولاً', description: 'لا نعرض صيدلية قبل مراجعة ترخيصها.', icon: ShieldCheck, tone: 'text-emerald-600 bg-emerald-50' },
  { id: 'access', title: 'إتاحة للجميع', description: 'واجهة عربية تعمل على الأجهزة والشبكات المتاحة.', icon: Users, tone: 'text-sky-600 bg-sky-50' },
  { id: 'care', title: 'المريض في المركز', description: 'كل قرار تصميمي يبدأ من سؤال: هل يساعد المريض؟', icon: Heart, tone: 'text-rose-600 bg-rose-50' },
  { id: 'privacy', title: 'خصوصية البيانات', description: 'بيانات المستخدمين وسجلّاتهم الطبية أمانة لا تُشارك.', icon: Lock, tone: 'text-slate-700 bg-slate-100' },
  { id: 'partnership', title: 'شراكة لا وساطة', description: 'ندعم الصيدلي والمورّد بأدوات تنمّي عمله.', icon: Handshake, tone: 'text-amber-600 bg-amber-50' },
  { id: 'practical', title: 'حلول واقعية', description: 'نبني ما يعمل فعلاً في السياق السوداني، لا ما يبدو جميلاً فقط.', icon: Lightbulb, tone: 'text-violet-600 bg-violet-50' },
];

/** حكاية المنصّة */
const STORY = [
  {
    id: 'problem',
    label: 'البداية',
    title: 'مشكلة يعرفها كل بيت',
    body: 'بدأت دواي من مشهد متكرّر: مريض يحمل روشتة ويطوف الصيدليات، ودواء موجود على بعد شارعين لكن لا أحد يعرف. المعلومة كانت مفقودة، لا الدواء.',
  },
  {
    id: 'today',
    label: 'اليوم',
    title: 'منصّة تجمع الأطراف الثلاثة',
    body: 'اليوم تجمع دواي المرضى والصيدليات والموردين في نظام واحد: كتالوج أدوية، إدارة مخزون، طلبات، وسجلّ تدقيق يحفظ كل إجراء.',
  },
  {
    id: 'next',
    label: 'الطريق أمامنا',
    title: 'تغطية أوسع واستجابة أسرع',
    body: 'نعمل على توسيع التغطية عبر ولايات السودان الثمانية عشر، وتعميق قدرات تتبّع أدوية الطوارئ بالتعاون مع الصيدليات والموردين.',
  },
];

export default function AboutUs({ onNavigate }) {
  const go = (route) => {
    if (onNavigate) onNavigate(route);
  };

  return (
    <main dir="rtl" className="bg-white">

      {/* ── تعريف ───────────────────────────────────── */}
      <section className="bg-gradient-to-bl from-emerald-50 via-white to-sky-50">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
            <Pill className="h-3.5 w-3.5" aria-hidden="true" />
            من نحن
          </span>
          <h1 className="mt-5 text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl lg:text-5xl">
            نحن نعمل على أن يكون
            <span className="text-emerald-600"> الدواء الصحيح</span> في متناول كل مريض
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            دواي منصّة سودانية للرعاية الدوائية، تربط المرضى بالصيدليات الموثّقة والموردين،
            وتساعد على تتبّع الأدوية الأساسية وأدوية الطوارئ.
          </p>
        </div>
      </section>

      {/* ── الرؤية والرسالة ─────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8" aria-labelledby="pillars-title">
        <h2 id="pillars-title" className="sr-only">الرؤية والرسالة</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          {PILLARS.map(({ id, label, title, body, icon: Icon, theme }) => (
            <article key={id} className={`rounded-3xl ${theme} p-8 text-white sm:p-10`}>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-white/70">{label}</p>
              <h3 className="mt-2 text-xl font-extrabold leading-snug sm:text-2xl">{title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-white/80">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── تتبّع أدوية الطوارئ ──────────────────────── */}
      <section className="bg-slate-50 py-16 sm:py-20" aria-labelledby="emergency-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
              <Radar className="h-3.5 w-3.5" aria-hidden="true" />
              الطوارئ
            </span>
            <h2 id="emergency-title" className="mt-4 text-2xl font-extrabold text-slate-900 sm:text-3xl">
              تتبّع أدوية الطوارئ في السودان
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              انقطاع دواء واحد قد يعني توقّف علاج مزمن. نبني طبقة رصد تجعل النقص مرئياً مبكراً،
              لتتحرّك الصيدليات والموردون قبل وقوع الأزمة.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {EMERGENCY_CAPABILITIES.map(({ id, title, description, icon: Icon }) => (
              <article
                key={id}
                className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-4 ring-rose-100/60">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{description}</p>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
            <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
            تعتمد دقّة الرصد على تحديث الصيدليات المشاركة لمخزونها، ولا تُغني عن الاتصال بالجهات
            الصحية الرسمية في الحالات الطارئة.
          </p>
        </div>
      </section>

      {/* ── القيم ───────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8" aria-labelledby="values-title">
        <div className="max-w-2xl">
          <h2 id="values-title" className="text-2xl font-extrabold text-slate-900 sm:text-3xl">قيمنا الأساسية</h2>
          <p className="mt-3 text-base text-slate-600">ستّ قواعد نرجع إليها في كل قرار نتّخذه.</p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map(({ id, title, description, icon: Icon, tone }) => (
            <article key={id} className="rounded-2xl border border-slate-200 bg-white p-6">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── الحكاية ─────────────────────────────────── */}
      <section className="bg-slate-900 py-16 sm:py-20" aria-labelledby="story-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 id="story-title" className="text-2xl font-extrabold text-white sm:text-3xl">حكاية دواي</h2>
            <p className="mt-3 text-base text-slate-400">من مشكلة يومية إلى منصّة تخدم ثلاثة أطراف.</p>
          </div>

          <ol className="mt-10 grid gap-6 lg:grid-cols-3">
            {STORY.map(({ id, label, title, body }, index) => (
              <li key={id} className="relative rounded-2xl bg-slate-800/60 p-6 ring-1 ring-slate-700">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-sm font-extrabold text-white">
                  {index + 1}
                </span>
                <p className="mt-4 text-xs font-bold uppercase tracking-wider text-emerald-400">{label}</p>
                <h3 className="mt-1.5 text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── دعوة ختامية ─────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-5 rounded-3xl border border-emerald-100 bg-emerald-50 px-6 py-12 text-center">
          <h2 className="text-2xl font-extrabold text-slate-900">كن جزءاً من الحل</h2>
          <p className="max-w-xl text-sm text-slate-600 sm:text-base">
            ابحث عن دوائك، أو انضم بصيدليتك إلى شبكة دواي وساعد مرضى منطقتك على الوصول لأدويتهم.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => go('explore')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              ابحث عن دواء
            </button>
            <button
              type="button"
              onClick={() => go('register-pharmacy')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-800 ring-1 ring-slate-300 transition-colors hover:bg-slate-50"
            >
              <Store className="h-4 w-4" aria-hidden="true" />
              سجّل صيدليتك
            </button>
            <button
              type="button"
              onClick={() => go('home')}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-bold text-emerald-700 transition-colors hover:text-emerald-800"
            >
              للرئيسية
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
