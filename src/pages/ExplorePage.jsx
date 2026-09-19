import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Info, Loader2, MapPin, Plus, Search, TriangleAlert } from 'lucide-react';
import api from '../api.js';
import { formatCurrency, formatDate } from '../formatCurrency.js';

/** Wait this long after the last keystroke before asking the server. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * محرك البحث العام — يقرأ من GET /api/catalog/* بدون تسجيل دخول.
 *
 * البحث بالاسم والسعر والصيدلية يتم على الخادم؛ التصنيف والولاية يُرشَّحان
 * محلياً لأنهما مشتقّان من الصفوف (الولاية تُستنتج من عنوان الصيدلية).
 * يقبل `?q=` و`?state=` و`?pharmacy=` من الصفحة الرئيسية.
 */
export default function ExplorePage({ onAddToCart, onSelectProduct }) {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(() => params.get('q') || '');
  const [state, setState] = useState(() => params.get('state') || '');
  const [pharmacyId, setPharmacyId] = useState(() => params.get('pharmacy') || '');
  const [category, setCategory] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const [pharmacies, setPharmacies] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.catalog.pharmacies().then(setPharmacies).catch(() => setPharmacies([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      api.catalog
        .medicines({ q: query, maxPrice, pharmacyId })
        .then((rows) => { if (!cancelled) setMedicines(rows); })
        .catch((err) => { if (!cancelled) { setMedicines([]); setError(err.message); } })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, SEARCH_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, maxPrice, pharmacyId]);

  const states = useMemo(
    () => [...new Set(pharmacies.map((item) => item.state).filter(Boolean))],
    [pharmacies]
  );
  const categories = useMemo(
    () => [...new Set(medicines.map((item) => item.category).filter(Boolean))],
    [medicines]
  );

  const results = medicines.filter((medicine) =>
    (!category || medicine.category === category) &&
    (!state || medicine.state === state));

  const resetFilters = () => {
    setQuery(''); setState(''); setPharmacyId(''); setCategory(''); setMaxPrice('');
  };
  const hasFilters = Boolean(query || state || pharmacyId || category || maxPrice);

  const fieldClass = 'rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

  return (
    <main dir="rtl" className="bg-white">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold text-emerald-700">استكشف الدواء</p>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-950">محرك بحث الأدوية والصيدليات</h1>
            <p className="mt-2 text-sm text-slate-500">الأسعار والتوفّر كما سجّلتها الصيدليات المعتمدة على المنصّة.</p>
          </div>
          <label className="relative max-w-md grow">
            <span className="sr-only">ابحث باسم الدواء</span>
            <Search className="absolute right-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث باسم الدواء"
              className="w-full rounded-lg border border-slate-300 py-3 pe-4 ps-10 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>

        <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Filter className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              الفلاتر
            </span>
            {hasFilters && (
              <button type="button" onClick={resetFilters} className="text-xs font-bold text-emerald-700 hover:underline">
                مسح الفلاتر
              </button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <select aria-label="الولاية" value={state} onChange={(event) => setState(event.target.value)} className={fieldClass}>
              <option value="">كل الولايات</option>
              {states.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select aria-label="الصيدلية" value={pharmacyId} onChange={(event) => setPharmacyId(event.target.value)} className={fieldClass}>
              <option value="">كل الصيدليات</option>
              {pharmacies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select aria-label="التصنيف" value={category} onChange={(event) => setCategory(event.target.value)} className={fieldClass}>
              <option value="">كل التصنيفات</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input
              aria-label="أعلى سعر"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              type="number"
              min="0"
              placeholder="أعلى سعر (ج.س)"
              className={fieldClass}
            />
          </div>
        </div>

        <div className="mt-8" aria-live="polite">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" aria-hidden="true" />
              جارٍ البحث…
            </p>
          ) : error ? (
            <p className="flex items-center justify-center gap-2 rounded-lg bg-rose-50 p-6 text-sm font-bold text-rose-700">
              <TriangleAlert className="h-5 w-5" aria-hidden="true" />
              {error}
            </p>
          ) : results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 py-16 text-center">
              <p className="font-bold text-slate-700">لا توجد نتائج مطابقة</p>
              <p className="mt-1 text-sm text-slate-500">
                {hasFilters ? 'جرّب تعديل الفلاتر أو البحث باسم آخر.' : 'لا توجد أدوية متاحة على المنصّة حالياً.'}
              </p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-xs font-bold text-slate-500">{results.length} نتيجة</p>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {results.map((medicine) => (
                  <article key={medicine.id} className="flex flex-col rounded-lg border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="text-lg font-extrabold text-slate-900">{medicine.name}</h2>
                      {medicine.category && (
                        <span className="shrink-0 rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{medicine.category}</span>
                      )}
                    </div>
                    <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-slate-500">السعر</dt><dd className="font-extrabold text-slate-900">{formatCurrency(medicine.price)}</dd></div>
                      <div><dt className="text-slate-500">الصلاحية حتى</dt><dd className="font-bold text-slate-800">{formatDate(medicine.expiryDate)}</dd></div>
                      <div className="col-span-2"><dt className="text-slate-500">الصيدلية</dt><dd className="font-bold text-slate-800">{medicine.pharmacyName}</dd></div>
                      {medicine.pharmacyAddress && (
                        <div className="col-span-2 flex items-center gap-1 text-slate-600">
                          <MapPin className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                          {medicine.pharmacyAddress}
                        </div>
                      )}
                    </dl>
                    <div className="mt-auto flex gap-2 pt-5">
                      <button type="button" onClick={() => onAddToCart(medicine)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
                        <Plus className="h-4 w-4" aria-hidden="true" /> إضافة للسلة
                      </button>
                      <button type="button" onClick={() => onSelectProduct(medicine)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                        <Info className="h-4 w-4" aria-hidden="true" /> تفاصيل
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
