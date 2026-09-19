import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardList, Loader2, Phone, RefreshCw } from 'lucide-react';
import api, { handleApiError } from './api.js';
import { formatCurrency, formatDateTime } from './formatCurrency.js';
import { ORDER_STATUS, PAYMENT_STATUS } from './orderStatus.js';
import StatusBadge from './StatusBadge.jsx';
import ReceiptViewer from './ReceiptViewer.jsx';

const FILTERS = [
  { id: 'pending', label: 'قيد المعالجة' },
  { id: 'completed', label: 'مكتملة' },
  { id: 'cancelled', label: 'ملغية' },
  { id: '', label: 'الكل' },
];

/**
 * طلبات العملاء الواردة للصيدلية — مشتركة بين المالك والموظف.
 *
 * دورة الطلب: pending → completed (سُلِّم) أو cancelled (يعيد المخزون).
 * دورة الدفع: unpaid → pending_review (رفع العميل إيصالاً) → paid | rejected.
 * التسليم قبل تأكيد الدفع مسموح (قد يدفع العميل نقداً عند الاستلام) لكنه يطلب تأكيداً.
 */
export default function PharmacyOrdersPanel({ onTokenError, onNotify }) {
  const [filter, setFilter] = useState('pending');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [receiptFor, setReceiptFor] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const notify = (message, tone = 'success') => (onNotify ? onNotify(message, tone) : alert(message));
  const report = (err) => handleApiError(err, onTokenError, (e) => notify(e.message, 'error'));

  // The parent passes a fresh callback each render; reading it through a ref
  // keeps `load` stable so a parent re-render does not refetch.
  const tokenErrorRef = useRef(onTokenError);
  useEffect(() => { tokenErrorRef.current = onTokenError; }, [onTokenError]);

  const load = useCallback(() => {
    setLoading(true);
    api.orders.pharmacyList(filter)
      .then((rows) => setOrders(Array.isArray(rows) ? rows : []))
      .catch((err) => handleApiError(err, tokenErrorRef.current, (e) => console.error(e)))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const run = async (orderId, action, successMessage) => {
    setBusyId(orderId);
    try {
      await action();
      notify(successMessage);
      load();
    } catch (err) {
      report(err);
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  };

  const complete = (order) => {
    const doIt = () => run(order.id, () => api.orders.updateStatus(order.id, 'completed'), 'تم تسليم الطلب');
    if (order.payment_status !== 'paid') {
      setConfirm({
        message: `الدفع لهذا الطلب غير مؤكَّد (${PAYMENT_STATUS[order.payment_status]?.label || order.payment_status}). هل استلمت المبلغ وتريد تسليم الطلب؟`,
        confirmLabel: 'نعم، تم التسليم',
        onConfirm: doIt,
      });
    } else {
      doIt();
    }
  };

  const cancel = (order) => setConfirm({
    message: `إلغاء الطلب #${order.id} سيعيد الكميات إلى المخزون. هل أنت متأكد؟`,
    confirmLabel: 'نعم، ألغِ الطلب',
    danger: true,
    onConfirm: () => run(order.id, () => api.orders.updateStatus(order.id, 'cancelled'), 'تم إلغاء الطلب وإعادة المخزون'),
  });

  const reviewPayment = (order, status) => run(
    order.id,
    () => api.orders.reviewPayment(order.id, status),
    status === 'paid' ? 'تم تأكيد الدفع' : 'تم رفض الإيصال، سيُطلب من العميل رفع إيصال جديد'
  );

  return (
    <section className="mb-8 rounded-2xl bg-white p-6 shadow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <ClipboardList className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          طلبات العملاء
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="تصفية الطلبات" className="flex rounded-xl bg-slate-100 p-1">
            {FILTERS.map((item) => (
              <button
                key={item.id || 'all'}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === item.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={load} aria-label="تحديث الطلبات" className="rounded-xl border px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> جارٍ التحميل…
        </p>
      ) : orders.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">لا توجد طلبات في هذا التصنيف.</p>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => {
            const busy = busyId === order.id;
            return (
              <li key={order.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">
                      الطلب #{order.id} · {order.customer_name || 'عميل'}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>{formatDateTime(order.created_at)}</span>
                      {order.customer_phone && (
                        <a href={`tel:${order.customer_phone}`} className="inline-flex items-center gap-1 font-bold text-emerald-700" dir="ltr">
                          <Phone className="h-3 w-3" aria-hidden="true" />{order.customer_phone}
                        </a>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={order.status} map={ORDER_STATUS} />
                    <StatusBadge status={order.payment_status} map={PAYMENT_STATUS} />
                  </div>
                </div>

                <ul className="mt-3 divide-y divide-slate-100 rounded-lg bg-slate-50 px-3 text-sm">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3 py-2">
                      <span>{item.medicine_name} × {item.quantity}</span>
                      <span className="font-bold">{formatCurrency(item.total_price)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-bold">الإجمالي: {formatCurrency(order.total_amount)}</span>
                  <div className="flex flex-wrap gap-2">
                    {order.has_receipt && (
                      <button type="button" onClick={() => setReceiptFor(order.id)} className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-50">
                        عرض الإيصال
                      </button>
                    )}
                    {order.payment_status === 'pending_review' && (
                      <>
                        <button type="button" disabled={busy} onClick={() => reviewPayment(order, 'paid')} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50">
                          تأكيد الدفع
                        </button>
                        <button type="button" disabled={busy} onClick={() => reviewPayment(order, 'rejected')} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                          رفض الإيصال
                        </button>
                      </>
                    )}
                    {order.status === 'pending' && (
                      <>
                        <button type="button" disabled={busy} onClick={() => complete(order)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                          تم التسليم
                        </button>
                        <button type="button" disabled={busy} onClick={() => cancel(order)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                          إلغاء الطلب
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {receiptFor && <ReceiptViewer orderId={receiptFor} onClose={() => setReceiptFor(null)} />}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div role="alertdialog" aria-modal="true" dir="rtl" className="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-sm font-bold leading-relaxed text-slate-900">{confirm.message}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">تراجع</button>
              <button type="button" onClick={confirm.onConfirm} className={`rounded-lg px-4 py-2 text-xs font-bold text-white ${confirm.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
