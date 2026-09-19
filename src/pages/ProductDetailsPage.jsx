import { ArrowRight, CalendarDays, FileText, MapPin, ShieldCheck, ShoppingCart, Tag } from 'lucide-react';
import { formatCurrency, formatDate } from '../formatCurrency.js';

/** تفاصيل دواء من الكتالوج العام — `product` بصيغة api.catalog.medicines. */
export default function ProductDetailsPage({ product, onBack, onAddToCart }) {
  return (
    <main dir="rtl" className="bg-slate-50">
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <ArrowRight className="h-4 w-4" aria-hidden="true" /> الرجوع للاستكشاف
        </button>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            {product.category && (
              <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{product.category}</span>
            )}
            <h1 className="mt-4 text-3xl font-extrabold text-slate-950">{product.name}</h1>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Info icon={Tag} label="السعر" value={formatCurrency(product.price)} />
              <Info icon={CalendarDays} label="تاريخ الصلاحية" value={formatDate(product.expiryDate)} />
            </div>
            <p className="mt-6 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm font-bold leading-relaxed text-amber-800">
              <FileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              قد تطلب الصيدلية وصفة طبية عند الاستلام لبعض الأدوية. استشر الصيدلي قبل الاستخدام.
            </p>
          </article>

          <aside className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-900">الصيدلية</h2>
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-700">متوفّر الآن</p>
            <div className="mt-5 space-y-3 text-sm text-slate-700">
              <p className="font-extrabold text-slate-900">{product.pharmacyName}</p>
              {product.pharmacyAddress && (
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /> {product.pharmacyAddress}</p>
              )}
              <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /> صيدلية معتمدة على منصّة دواي</p>
            </div>
            <button type="button" onClick={() => onAddToCart(product)} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">
              <ShoppingCart className="h-4 w-4" aria-hidden="true" /> أضف إلى السلة
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 font-extrabold text-slate-900">{value}</p>
    </div>
  );
}
