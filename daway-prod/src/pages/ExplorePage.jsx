import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Info, Plus, Search } from 'lucide-react';
import { mockMedicines, mockPharmacies, mockStates } from '../data/mockData';

export default function ExplorePage({ onAddToCart, onSelectProduct }) {
  // البحث من الصفحة الرئيسية يصل كـ `/explore?q=&state=`، فيُستخدم كقيمة ابتدائية
  // للفلاتر. الحالة بعدها محلية بالكامل — تعديل الفلتر لا يُعيد كتابة الرابط.
  const [params] = useSearchParams();
  const [query, setQuery] = useState(() => params.get('q') || '');
  const [state, setState] = useState(() => {
    const requested = params.get('state') || '';
    return mockStates.some((item) => item.name === requested) ? requested : '';
  });
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const categories = useMemo(() => [...new Set(mockMedicines.map((item) => item.category))], []);
  const cities = useMemo(() => {
    if (!state) return mockStates.flatMap((item) => item.cities);
    return mockStates.find((item) => item.name === state)?.cities || [];
  }, [state]);

  const results = useMemo(() => mockMedicines.filter((medicine) => {
    const pharmacy = mockPharmacies.find((item) => item.id === medicine.pharmacyId);
    const text = `${medicine.name} ${medicine.genericName}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) &&
      (!state || pharmacy?.state === state) &&
      (!city || pharmacy?.city === city) &&
      (!category || medicine.category === category) &&
      (!maxPrice || medicine.price <= Number(maxPrice));
  }), [query, state, city, category, maxPrice]);

  return (
    <main dir="rtl" className="bg-white">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold text-emerald-700">استكشف الدواء</p>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-950">محرك بحث الأدوية والصيدليات</h1>
          </div>
          <div className="relative max-w-md grow">
            <Search className="absolute right-3 top-3 h-5 w-5 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث باسم الدواء أو المادة الفعالة"
              className="w-full rounded-lg border border-slate-300 py-3 pe-4 ps-10 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
            <Filter className="h-4 w-4 text-emerald-600" />
            الفلاتر
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <select value={state} onChange={(event) => { setState(event.target.value); setCity(''); }} className="rounded-lg border border-slate-300 bg-white p-3 text-sm">
              <option value="">كل الولايات</option>
              {mockStates.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
            </select>
            <select value={city} onChange={(event) => setCity(event.target.value)} className="rounded-lg border border-slate-300 bg-white p-3 text-sm">
              <option value="">كل المدن</option>
              {cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-slate-300 bg-white p-3 text-sm">
              <option value="">كل التصنيفات</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} type="number" min="0" placeholder="أعلى سعر" className="rounded-lg border border-slate-300 bg-white p-3 text-sm" />
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {results.map((medicine) => {
            const pharmacy = mockPharmacies.find((item) => item.id === medicine.pharmacyId);
            return (
              <article key={medicine.id} className="rounded-lg border border-slate-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">{medicine.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{medicine.genericName} · {medicine.form} · {medicine.strength}</p>
                  </div>
                  <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{medicine.category}</span>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-slate-500">السعر</dt><dd className="font-extrabold text-slate-900">{medicine.price} ج.س</dd></div>
                  <div><dt className="text-slate-500">المخزون</dt><dd className="font-extrabold text-slate-900">{medicine.stock} عبوة</dd></div>
                  <div><dt className="text-slate-500">الصيدلية</dt><dd className="font-bold text-slate-800">{medicine.pharmacyName}</dd></div>
                  <div><dt className="text-slate-500">الموقع</dt><dd className="font-bold text-slate-800">{pharmacy?.city || '-'}، {pharmacy?.state || '-'}</dd></div>
                </dl>
                <div className="mt-5 flex gap-2">
                  <button type="button" onClick={() => onAddToCart(medicine)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
                    <Plus className="h-4 w-4" /> إضافة للسلة
                  </button>
                  <button type="button" onClick={() => onSelectProduct(medicine)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    <Info className="h-4 w-4" /> تفاصيل
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
