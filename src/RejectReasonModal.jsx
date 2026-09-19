import { useState } from 'react';

/**
 * Collects the rejection reason. The request itself is made by the parent
 * (`onSubmit(reason)`), which owns the session and error handling.
 */
const RejectReasonModal = ({ rejectPharmacyId, onRequestClose, onSubmit }) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rejectPharmacyId || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  if (!rejectPharmacyId) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
      <div role="dialog" aria-modal="true" aria-labelledby="reject-title" dir="rtl" className="bg-white p-6 rounded-2xl max-w-sm w-full mx-4 space-y-4">
        <p id="reject-title" className="text-sm font-bold text-slate-700">سبب رفض طلب التسجيل</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={5}
            aria-label="سبب الرفض"
            className="w-full p-2 border border-slate-300 rounded-md resize-y min-h-[80px]"
            placeholder="مثال: رقم الترخيص غير واضح، يرجى إعادة التقديم بصورة الترخيص."
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onRequestClose}
              className="px-4 py-2 border border-slate-200 text-xs rounded-xl hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-red-500 text-white text-xs rounded-xl hover:bg-red-600 disabled:opacity-50"
            >
              {submitting ? 'جارٍ الإرسال…' : 'تأكيد الرفض'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectReasonModal;
