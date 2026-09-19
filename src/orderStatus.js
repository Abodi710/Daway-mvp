/** Arabic labels and badge styles for order and payment states, shared by every screen. */

export const ORDER_STATUS = {
  pending: { label: 'قيد المعالجة', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  completed: { label: 'مكتمل', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  cancelled: { label: 'ملغي', badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

export const PAYMENT_STATUS = {
  unpaid: { label: 'بانتظار الدفع', badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
  pending_review: { label: 'إيصال بانتظار المراجعة', badge: 'bg-sky-50 text-sky-700 ring-sky-200' },
  paid: { label: 'تم الدفع', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  rejected: { label: 'الإيصال مرفوض', badge: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

export const PURCHASE_ORDER_STATUS = {
  pending: { label: 'بانتظار التنفيذ', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  completed: { label: 'منفَّذ', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  cancelled: { label: 'ملغي', badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
};
