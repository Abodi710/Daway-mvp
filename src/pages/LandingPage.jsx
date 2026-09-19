import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  CircleCheck,
  Loader2,
  MapPin,
  Package,
  Pill,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Stethoscope,
  Users,
  Zap,
} from 'lucide-react';
import api from '../api.js';
import { formatCurrency } from '../formatCurrency.js';

/**
 * الصفحة الرئيسية — التصميم منقول من `daway-platform-main/src/pages/LandingPage.tsx`
 * وموصول ببيانات الكتالوج الحقيقية عبر `api.catalog.preview()`.
 *
 * معرّفات المسارات المستخدمة مع onNavigate:
 * 'explore' | 'register-pharmacy' | 'services' | 'about' | 'auth'
 *
 * البحث ينتقل إلى `/explore?q=&state=` — `goToPage` في App.jsx يقبل المسار كما هو.
 */

/** مزايا المنصّة */
const FEATURES = [
  {
    id: 'fast-search',
    title: 'بحث فوري عن الأدوية',
    description:
      'ابحث باسم الدواء، واعرف الصيدليات التي يتوفّر فيها الآن مع سعره بالجنيه السوداني.',
    icon: Search,
    tile: 'bg-emerald-100 text-emerald-600',
  },
  {
    id: 'verified',
    title: 'صيدليات موثّقة',
    description:
      'كل صيدلية تمرّ بمراجعة الترخيص قبل الاعتماد، حتى تطمئن لمصدر دوائك وتُحمى من المنتجات المزيّفة.',
    icon: ShieldCheck,
    tile: 'bg-sky-100 text-sky-600',
  },
  {
    id: 'inventory',
    title: 'إدارة ذكية للمخزون',
    description:
      'تتبّع المخزون والتوفّر، وتنبيهات ذكية قبل انتهاء صلاحية الأدوية بثلاثين يوماً لمنع الهدر.',
    icon: BarChart3,
    tile: 'bg-amber-100 text-amber-600',
  },
];

/** قيم مضافة تُعرض أسفل صندوق البحث */
const VALUE_POINTS = [
  'بحث فوري وعرض لأسعار الأدوية بالجنيه السوداني',
  'ربط مباشر مع الصيدليات والموردين',
  'إشعارات انتهاء الصلاحية والمخزون',
];

/** أقسام موجّهة حسب نوع المستخدم */
const AUDIENCES = [
  {
    id: 'patient',
    tab: 'أنا مريض',
    title: 'دواؤك، بلا دوران بين الصيدليات',
    description:
      'ابحث عن الدواء الذي تحتاجه، واعرف توفّره وسعره في الصيدليات المعتمدة قبل أن تتحرّك من مكانك.',
    points: [
      'ابحث باسم الدواء وفلتر حسب الولاية والسعر',
      'قارن الأسعار بين الصيدليات الموثّقة',
      'احجز طلبك وادفع عبر بنكك',
      'تابع حالة طلبك ومراجعة الدفع',
    ],
    cta: { label: 'ابدأ البحث عن دواء', route: 'explore', icon: Search },
    icon: Stethoscope,
    theme: {
      panel: 'bg-emerald-600',
      badge: 'bg-emerald-500/20 text-emerald-50 ring-emerald-400/30',
      button: 'bg-white text-emerald-700 hover:bg-emerald-50',
      check: 'text-emerald-200',
    },
  },
  {
    id: 'pharmacy',
    tab: 'أنا صاحب صيدلية',
    title: 'أدِر صيدليتك ووسّع وصولك',
    description:
      'سجّل صيدليتك، اعرض مخزونك أمام المرضى في منطقتك، وأدِر الطلبات والموردين من لوحة واحدة.',
    points: [
      'لوحة تحكم للمخزون وتواريخ الصلاحية',
      'تنبيهات المخزون المنخفض قبل النفاد',
      'استقبال طلبات المرضى وإدارتها',
      'طلبات التوريد ومتابعة الموردين',
    ],
    cta: { label: 'سجّل صيدليتك الآن', route: 'register-pharmacy', icon: Store },
    icon: Store,
    theme: {
      panel: 'bg-slate-900',
      badge: 'bg-white/10 text-slate-100 ring-white/20',
      button: 'bg-emerald-500 text-white hover:bg-emerald-400',
      check: 'text-emerald-400',
    },
  },
];

/**
 * مواضع ثابتة لدبابيس الخريطة التوضيحية. الخدمة لا تُرجع إحداثيات، لذا تُوزَّع
 * الصيدليات على مواضع معروفة مسبقاً حسب ترتيبها — الخريطة توضيحية لا جغرافية.
 * أصناف Tailwind مكتوبة كاملة لأن الأصناف الديناميكية لا تُستخرج وقت البناء.
 */
const PIN_POSITIONS = [
  'top-1/4 right-1/3',
  'top-1/2 right-1/2',
  'top-1/3 right-1/5',
  'bottom-1/4 right-2/5',
  'top-2/3 right-1/4',
  'bottom-1/3 right-3/5',
];

/** حد أقصى لعدد مقترحات البحث المعروضة تحت الصندوق */
const SUGGESTION_LIMIT = 4;

/** حد أقصى لعدد الصيدليات المعروضة في قائمة قسم الخريطة */
const PHARMACY_LIST_LIMIT = 6;

export default function LandingPage({ onNavigate }) {
  const [catalog, setCatalog] = useState({ medicines: [], pharmacies: [], states: [], error: null });
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  /** ولاية صندوق البحث — تبقى فارغة («كل الولايات») حتى يختار الزائر، كي لا يُضيَّق البحث ضمنياً. */
  const [searchState, setSearchState] = useState('');
  /** ولاية قسم الخريطة — لها قيمة ابتدائية لأن القسم يعرض منطقة واحدة في كل مرة. */
  const [mapState, setMapState] = useState('');
  const [selectedPharmacyId, setSelectedPharmacyId] = useState(null);
  const [audienceId, setAudienceId] = useState('patient');

  const audience = AUDIENCES.find((item) => item.id === audienceId) || AUDIENCES[0];

  const go = (route) => {
    if (onNavigate) onNavigate(route);
  };

  /* جلب الكتالوج الحقيقي مرّة واحدة عند التحميل. `preview` لا يرفض أبداً. */
  useEffect(() => {
    let cancelled = false;
    api.catalog
      .preview()
      .then((data) => {
        if (cancelled) return;
        setCatalog(data);
        setSelectedPharmacyId((current) => current ?? data.pharmacies[0]?.id ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* نتائج البحث الحيّة — تُرشَّح من الكتالوج المُحمَّل بدل رحلة إضافية للخادم. */
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return catalog.medicines.filter((medicine) =>
      `${medicine.name} ${medicine.category}`.toLowerCase().includes(term));
  }, [query, catalog.medicines]);

  /** الولاية مستنتجة من عنوان الصيدلية؛ «الكل» (قيمة فارغة) يعرض كل الصيدليات. */
  const listedPharmacies = useMemo(
    () => catalog.pharmacies.filter((item) => !mapState || item.state === mapState),
    [catalog.pharmacies, mapState]
  );

  const activePharmacy =
    listedPharmacies.find((item) => item.id === selectedPharmacyId) || listedPharmacies[0] || null;

  /** الصفوف المعروضة فعلاً في القائمة وعلى الخريطة. */
  const visiblePharmacies = listedPharmacies.slice(0, PHARMACY_LIST_LIMIT);

  /** مؤشرات مبنيّة على ما وصل فعلاً من الخادم؛ «—» عند تعذّر التحميل بدل صفر مضلِّل. */
  const count = (list) => (catalog.error ? '—' : `${list.length}`);
  const highlights = [
    { id: 'medicines', label: 'أدوية في الكتالوج', value: count(catalog.medicines), icon: Package },
    { id: 'pharmacies', label: 'صيدليات معتمدة', value: count(catalog.pharmacies), icon: Store },
    { id: 'states', label: 'تغطية الولايات', value: count(catalog.states), icon: MapPin },
  ];

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (searchState) params.set('state', searchState);
    const search = params.toString();
    go(search ? `/explore?${search}` : 'explore');
  };

  return (
    <main dir="rtl" className="bg-white">

      {/* ── القسم الرئيسي والبحث ─────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-bl from-emerald-50 via-white to-sky-50">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            منصّة دواء سودانية متكاملة
          </span>

          <h1 className="mx-auto mt-6 max-w-4xl text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            صحتك بين يديك مع
            <span className="text-emerald-600"> دواي</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            دواي تربط المرضى بالصيدليات الموثّقة والموردين في السودان، لتسهيل البحث عن الأدوية
            ومعرفة توفّرها وطلبها بأمان.
          </p>

          {/* صندوق البحث */}
          <form
            onSubmit={handleSearchSubmit}
            role="search"
            className="mx-auto mt-10 flex max-w-4xl flex-col items-stretch gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl sm:p-4 md:flex-row"
          >
            <div className="relative flex-1">
              <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث عن دواء (مثل: بنادول، أموكسيسيلين)…"
                aria-label="ابحث عن دواء"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pe-4 ps-12 text-right text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="relative w-full md:w-64">
              <MapPin className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <select
                value={searchState}
                onChange={(event) => setSearchState(event.target.value)}
                aria-label="الولاية"
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pe-4 ps-12 text-right text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">كل الولايات</option>
                {catalog.states.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-8 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              ابحث الآن
            </button>
          </form>

          {/* مقترحات حيّة من الكتالوج */}
          {query.trim() && !loading && (
            <div className="mx-auto mt-3 max-w-4xl rounded-2xl border border-slate-200 bg-white p-3 text-right shadow-sm">
              {matches.length ? (
                <>
                  <p className="px-1 pb-2 text-[11px] font-bold text-slate-400">
                    {matches.length} نتيجة مطابقة في الكتالوج
                  </p>
                  <ul className="flex flex-col gap-1">
                    {matches.slice(0, SUGGESTION_LIMIT).map((medicine) => (
                      <li key={medicine.id}>
                        <button
                          type="button"
                          onClick={() => go(`/explore?q=${encodeURIComponent(medicine.name)}`)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-right transition-colors hover:bg-slate-50"
                        >
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-bold text-slate-800">{medicine.name}</span>
                            <span className="truncate text-xs text-slate-500">
                              {medicine.pharmacyName || medicine.category || 'دواء'}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {formatCurrency(medicine.price)}
                            </span>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              متوفّر
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="px-2 py-1 text-xs text-slate-500">
                  لا نتائج مطابقة في الكتالوج المعروض — اضغط «ابحث الآن» للبحث الكامل.
                </p>
              )}
            </div>
          )}

          {/* مؤشرات حيّة */}
          <dl className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-4 border-t border-slate-200 pt-6">
            {highlights.map(({ id, label, value, icon: Icon }) => (
              <div key={id} className="flex flex-col items-center gap-1">
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                  <Icon className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  {label}
                </dt>
                <dd className="text-lg font-extrabold text-slate-900">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-300" aria-label="جارٍ التحميل" /> : value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-slate-500">
            {VALUE_POINTS.map((point) => (
              <span key={point} className="flex items-center gap-1.5">
                <CircleCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                {point}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── المزايا ─────────────────────────────────── */}
      <section
        className="border-y border-slate-100 bg-slate-50 py-16 sm:py-20"
        aria-labelledby="features-title"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="features-title" className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
              خدمات وحلول ذكية مصمّمة لك
            </h2>
            <p className="mt-3 text-base text-slate-600">
              ثلاث ركائز تجعل الوصول إلى الدواء أسرع وأكثر أماناً.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ id, title, description, icon: Icon, tile }) => (
              <article
                key={id}
                className="group rounded-2xl border border-slate-100 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${tile}`}>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-6 text-xl font-bold text-slate-800">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
                <button
                  type="button"
                  onClick={() => go('services')}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-emerald-700 transition-transform group-hover:-translate-x-1"
                >
                  اعرف المزيد
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── أقسام موجّهة حسب نوع المستخدم ────────────── */}
      <section className="py-16 sm:py-20" aria-labelledby="audience-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-xl">
              <h2 id="audience-title" className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
                دواي تناسبك أنت
              </h2>
              <p className="mt-3 text-base text-slate-600">اختر دورك لترى ما تقدّمه المنصّة لك.</p>
            </div>

            <div role="tablist" aria-label="نوع المستخدم" className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
              {AUDIENCES.map((item) => {
                const isActive = item.id === audienceId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setAudienceId(item.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                      isActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {item.id === 'patient' ? (
                      <Users className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Store className="h-4 w-4" aria-hidden="true" />
                    )}
                    {item.tab}
                  </button>
                );
              })}
            </div>
          </div>

          <div role="tabpanel" className={`mt-8 overflow-hidden rounded-3xl ${audience.theme.panel} px-6 py-10 sm:px-10`}>
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${audience.theme.badge}`}
                >
                  <audience.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {audience.tab}
                </span>
                <h3 className="mt-4 text-2xl font-extrabold leading-snug text-white sm:text-3xl">
                  {audience.title}
                </h3>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/80 sm:text-base">
                  {audience.description}
                </p>
                <button
                  type="button"
                  onClick={() => go(audience.cta.route)}
                  className={`mt-7 inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold shadow-lg transition-colors ${audience.theme.button}`}
                >
                  <audience.cta.icon className="h-4 w-4" aria-hidden="true" />
                  {audience.cta.label}
                </button>
              </div>

              <ul className="flex flex-col gap-3">
                {audience.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2.5 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white ring-1 ring-white/10"
                  >
                    <CircleCheck className={`mt-0.5 h-4 w-4 shrink-0 ${audience.theme.check}`} aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── الصيدليات المعتمدة والخريطة التوضيحية ────── */}
      <section className="border-t border-slate-100 py-16 sm:py-20" aria-labelledby="map-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-12">

            <div className="space-y-6 lg:col-span-5">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                التحقّق الجغرافي والوفرة
              </span>
              <h2 id="map-title" className="text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl">
                العثور على الأدوية في الصيدليات القريبة منك بالسودان
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                اختر الولاية لعرض الصيدليات المعتمدة على المنصّة، ثم تصفّح ما يتوفّر فيها من أدوية
                وأسعارها بالجنيه السوداني قبل أن تتحرّك.
              </p>

              {/* مبدّل الولاية */}
              <div className="space-y-3">
                <p id="state-picker-label" className="text-xs font-bold text-slate-500">
                  اختر الولاية للاستكشاف:
                </p>
                <div role="group" aria-labelledby="state-picker-label" className="flex flex-wrap gap-2">
                  {['', ...catalog.states].map((state) => (
                    <button
                      key={state}
                      type="button"
                      onClick={() => setMapState(state)}
                      aria-pressed={mapState === state}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        mapState === state
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {state || 'كل الولايات'}
                    </button>
                  ))}
                </div>
              </div>

              {/* قائمة الصيدليات الحيّة */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  الصيدليات المعتمدة على المنصّة:
                </h3>

                {loading ? (
                  <p className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    جارٍ جلب الصيدليات…
                  </p>
                ) : visiblePharmacies.length ? (
                  <ul className="flex flex-col gap-2">
                    {visiblePharmacies.map((pharmacy) => {
                      const isActive = activePharmacy?.id === pharmacy.id;
                      return (
                        <li key={pharmacy.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedPharmacyId(pharmacy.id)}
                            aria-pressed={isActive}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-right transition-all ${
                              isActive
                                ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-sm font-bold text-slate-800">{pharmacy.name}</span>
                              <span className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
                                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                                {pharmacy.address || 'السودان'}
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                معتمدة
                              </span>
                              <span className="text-[11px] font-semibold text-slate-500">{pharmacy.medicineCount} صنف</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs italic text-slate-400">
                    لا توجد صيدليات معتمدة لعرضها في هذه المنطقة حالياً.
                  </p>
                )}
              </div>
            </div>

            {/* لوحة الخريطة التوضيحية */}
            <div className="lg:col-span-7">
              <div
                className="relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-3xl border-4 border-slate-100 bg-slate-900 p-6 text-white shadow-2xl"
              >
                {/* خلفية شبكية */}
                <div
                  className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] opacity-40 [background-size:16px_16px]"
                  aria-hidden="true"
                />
                <div className="absolute left-1/4 top-1/4 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" aria-hidden="true" />
                <div className="absolute bottom-1/4 right-1/3 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" aria-hidden="true" />

                {/* ترويسة الخريطة */}
                <div className="relative z-10 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400" aria-hidden="true" />
                    <span className="text-xs font-bold text-slate-300">
                      {mapState ? `منطقة العرض: ${mapState}` : 'كل ولايات السودان'}
                    </span>
                  </span>
                  <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs text-white">
                    خريطة توضيحية
                  </span>
                </div>

                {/* دبابيس مبنيّة على الصيدليات المعروضة */}
                <div className="relative z-10 my-auto flex h-48 w-full items-center justify-center" aria-hidden="true">
                  {visiblePharmacies.slice(0, PIN_POSITIONS.length).map((pharmacy, index) => {
                    const isActive = activePharmacy?.id === pharmacy.id;
                    return (
                      <button
                        key={pharmacy.id}
                        type="button"
                        tabIndex={-1}
                        onClick={() => setSelectedPharmacyId(pharmacy.id)}
                        className={`absolute flex flex-col items-center ${PIN_POSITIONS[index]}`}
                      >
                        <span
                          className={`rounded-full p-2 transition-all ${
                            isActive ? 'scale-125 bg-emerald-600 ring-4 ring-white' : 'bg-slate-800 hover:bg-slate-700'
                          }`}
                        >
                          <MapPin className="h-5 w-5 text-white" />
                        </span>
                        <span className="mt-1 max-w-[6rem] truncate rounded border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-[10px] font-bold text-white">
                          {pharmacy.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* بطاقة الصيدلية المحدّدة */}
                <div className="relative z-10 rounded-2xl border border-slate-700 bg-slate-800/95 p-4 backdrop-blur-sm">
                  {activePharmacy ? (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          الصيدلية المحدّدة
                        </span>
                        <h4 className="truncate text-sm font-bold text-white">{activePharmacy.name}</h4>
                        <p className="flex items-center gap-1 truncate text-xs text-slate-400">
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {activePharmacy.address || 'السودان'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => go(`/explore?pharmacy=${activePharmacy.id}`)}
                        className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-900 transition-colors hover:bg-slate-100"
                      >
                        تصفّح الأدوية المتوفّرة
                      </button>
                    </div>
                  ) : (
                    <p className="text-center text-xs text-slate-400">
                      {loading
                        ? 'جارٍ تحميل الصيدليات…'
                        : catalog.error
                          ? 'تعذّر تحميل الصيدليات حالياً.'
                          : 'لا توجد صيدليات معتمدة في هذه الولاية بعد.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── دعوة ختامية ─────────────────────────────── */}
      <section className="relative overflow-hidden bg-emerald-600 py-16 text-white">
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-emerald-500 opacity-30 blur-2xl" aria-hidden="true" />
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-sky-500 opacity-20 blur-2xl" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-4xl space-y-6 px-4 text-center sm:px-6 lg:px-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <Zap className="h-7 w-7" aria-hidden="true" />
          </span>
          <h2 className="text-2xl font-extrabold sm:text-3xl">ابدأ رحلتك الصحية الرقمية مع دواي اليوم</h2>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-emerald-50 sm:text-base">
            انضم الآن كصيدلي أو مورد أو مريض، واستمتع بتجربة رعاية وإدارة دوائية سهلة ومتكاملة.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => go('auth')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3 text-sm font-bold text-emerald-700 shadow-lg transition-all hover:bg-emerald-50"
            >
              <Pill className="h-4 w-4" aria-hidden="true" />
              ابدأ الآن مجاناً
            </button>
            <button
              type="button"
              onClick={() => go('register-pharmacy')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-white/20"
            >
              <Store className="h-4 w-4" aria-hidden="true" />
              سجّل صيدليتك
            </button>
            <button
              type="button"
              onClick={() => go('about')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-transparent px-8 py-3 text-sm font-bold text-white transition-all hover:bg-white/10"
            >
              من نحن
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
