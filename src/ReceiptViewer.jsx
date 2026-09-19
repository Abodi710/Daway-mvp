import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import api from './api.js';

/**
 * Shows a stored Bankak receipt. The file is fetched with the session token
 * (the route is protected) and displayed from an object URL that is revoked on
 * close.
 */
export default function ReceiptViewer({ orderId, onClose }) {
  const [url, setUrl] = useState(null);
  const [isPdf, setIsPdf] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    api.orders.receiptUrl(orderId)
      .then(({ url: value, type }) => {
        objectUrl = value;
        if (cancelled) { URL.revokeObjectURL(value); return; }
        setIsPdf(type === 'application/pdf');
        setUrl(value);
      })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [orderId]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`إيصال الطلب رقم ${orderId}`}
        dir="rtl"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h3 className="font-bold text-slate-900">إيصال بنكك — الطلب #{orderId}</h3>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex min-h-64 flex-1 items-center justify-center overflow-auto bg-slate-50 p-4">
          {error ? (
            <p className="text-sm font-bold text-rose-700">{error}</p>
          ) : !url ? (
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" aria-label="جارٍ التحميل" />
          ) : isPdf ? (
            <iframe title="الإيصال" src={url} className="h-[70vh] w-full rounded-lg bg-white" />
          ) : (
            <img src={url} alt={`إيصال الطلب رقم ${orderId}`} className="max-h-[70vh] rounded-lg object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}
