import { useState } from 'react';
import { Loader2, Minus, Plus, ShoppingCart, Store, Trash2 } from 'lucide-react';
import { formatCurrency } from '../formatCurrency.js';

/**
 * سلة المشتريات العامة.
 *
 * كل طلب على الخادم يخصّ صيدلية واحدة، لذا تُجمَّع السلة حسب الصيدلية ويُرسَل
 * كل جزء كطلب مستقل. الدفع عبر بنكك: بعد إنشاء الطلب يرفع العميل الإيصال من
 * لوحة «طلباتي».
 *
 * @param onCheckout (pharmacyId) => Promise — يتولّى App التحقق من الجلسة.
 */
export default function CartPage({ cartItems = [], user, onUpdateQuantity, onRemove, onCheckout, onNavigate }) {
  const [submittingId, setSubmittingId] = useState(null);

  const groups = cartItems.reduce((acc, item) => {
    const key = item.medicine.pharmacyId;
    if (!acc.has(key)) acc.set(key, { pharmacyId: key, pharmacyName: item.medicine.pharmacyName, items: [] });
    acc.get(key).items.push(item);
    return acc;
  }, new Map());

  const submit = async (pharmacyId) => {
    setSubmittingId(pharmacyId);
    try {
      await onCheckout(pharmacyId);
    } finally {
      setSubmittingId(null);
    }
  };

  const isCustomer = user?.role === 'customer';

  return (
    <main dir="rtl" className="bg-slate-50">
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-950">
          <ShoppingCart className="h-7 w-7 text-emerald-600" aria-hidden="true" />
          سلة المشتريات
        </h1>

        {cartItems.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-slate-300 bg-white py-16 text-center">
            <p className="font-bold text-slate-700">السلة فارغة</p>
            <p className="mt-1 text-sm text-slate-500">ابحث عن دوائك وأضفه إلى السلة.</p>
            <button type="button" onClick={() => onNavigate('explore')} className="mt-5 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
              استكشف الأدوية
            </button>
          </div>
        ) : (
          <>
            {!user && (
              <p className="mt-6 rounded-lg bg-sky-50 p-3 text-sm font-bold text-sky-800">
                لإتمام الطلب سجّل الدخول بحساب عميل — ستبقى سلتك محفوظة.
              </p>
            )}
            {user && !isCustomer && (
              <p className="mt-6 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">
                الطلب من الصيدليات متاح لحسابات العملاء فقط.
              </p>
            )}
            {groups.size > 1 && (
              <p className="mt-4 text-sm text-slate-600">
                سلتك تضم أدوية من {groups.size} صيدليات — يُرسَل طلب منفصل لكل صيدلية.
              </p>
            )}

            <div className="mt-6 space-y-6">
              {[...groups.values()].map((group) => {
                const total = group.items.reduce((sum, item) => sum + item.medicine.price * item.quantity, 0);
                const busy = submittingId === group.pharmacyId;
                return (
                  <section key={group.pharmacyId} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
                      <Store className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                      {group.pharmacyName || 'صيدلية'}
                    </h2>
                    <ul className="mt-4 divide-y divide-slate-100">
                      {group.items.map(({ medicine, quantity }) => (
                        <li key={medicine.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900">{medicine.name}</p>
                            <p className="text-sm text-slate-500">{formatCurrency(medicine.price)} للوحدة</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center rounded-lg border border-slate-200">
                              <button type="button" aria-label={`إنقاص كمية ${medicine.name}`} disabled={quantity <= 1} onClick={() => onUpdateQuantity(medicine.id, quantity - 1)} className="p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                                <Minus className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <span className="w-8 text-center text-sm font-bold" aria-live="polite">{quantity}</span>
                              <button type="button" aria-label={`زيادة كمية ${medicine.name}`} onClick={() => onUpdateQuantity(medicine.id, quantity + 1)} className="p-2 text-slate-600 hover:bg-slate-50">
                                <Plus className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                            <span className="w-24 text-left font-extrabold text-slate-900">{formatCurrency(medicine.price * quantity)}</span>
                            <button type="button" aria-label={`إزالة ${medicine.name}`} onClick={() => onRemove(medicine.id)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50">
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-slate-50 p-4">
                      <span className="font-bold text-slate-700">
                        الإجمالي: <span className="text-xl font-extrabold text-emerald-700">{formatCurrency(total)}</span>
                      </span>
                      <button
                        type="button"
                        disabled={busy || (user && !isCustomer)}
                        onClick={() => submit(group.pharmacyId)}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {user ? 'تأكيد الطلب والدفع عبر بنكك' : 'سجّل الدخول لإتمام الطلب'}
                      </button>
                    </div>
                  </section>
                );
              })}
            </div>

            <p className="mt-6 text-xs leading-relaxed text-slate-500">
              بعد تأكيد الطلب تُحجز الكمية لك، ثم ارفع إيصال التحويل عبر بنكك من «طلباتي» لتراجعه الصيدلية.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
