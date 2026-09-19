import { ArrowRight, FileText, MapPin, ShieldCheck, ShoppingCart } from 'lucide-react';
import { mockMedicines, mockPharmacies } from '../data/mockData';

export default function ProductDetailsPage({ product, onBack, onAddToCart }) {
  const medicine = product || mockMedicines[0];
  const pharmacy = mockPharmacies.find((item) => item.id === medicine.pharmacyId);
  const inStock = medicine.stock > 0;

  return (
    <main dir="rtl" className="bg-slate-50">
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">
          <ArrowRight className="h-4 w-4" /> الرجوع للاستكشاف
        </button>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{medicine.category}</span>
            <h1 className="mt-4 text-3xl font-extrabold text-slate-950">{medicine.name}</h1>
            <p className="mt-2 text-lg text-slate-600">{medicine.genericName}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Info label="الشكل" value={medicine.form || '-'} />
              <Info label="التركيز" value={medicine.strength || '-'} />
              <Info label="السعر" value={`${medicine.price} ج.س`} />
              <Info label="تاريخ الصلاحية" value={medicine.expiryDate} />
            </div>
            {medicine.requiresPrescription && (
              <p className="mt-6 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">
                <FileText className="h-4 w-4" /> يحتاج وصفة طبية عند الاستلام.
              </p>
            )}
          </article>

          <aside className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-900">حالة توفر الصيدلية</h2>
            <p className={`mt-4 rounded-lg p-3 text-sm font-bold ${inStock ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {inStock ? `متوفر الآن: ${medicine.stock} عبوة` : 'غير متوفر حالياً'}
            </p>
            <div className="mt-5 space-y-3 text-sm text-slate-700">
              <p className="font-extrabold text-slate-900">{medicine.pharmacyName}</p>
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-600" /> {pharmacy?.address || `${pharmacy?.city || ''} ${pharmacy?.state || ''}`}</p>
              <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> صيدلية {pharmacy?.status === 'approved' ? 'معتمدة' : 'قيد المراجعة'}</p>
            </div>
            <button type="button" disabled={!inStock} onClick={() => onAddToCart(medicine)} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              <ShoppingCart className="h-4 w-4" /> شراء الآن
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 font-extrabold text-slate-900">{value}</p>
    </div>
  );
}
