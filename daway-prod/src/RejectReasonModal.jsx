import { useState } from 'react';

const RejectReasonModal = ({ rejectPharmacyId, rejectionReason, onRequestClose, onSubmit }) => {
  const [reason, setReason] = useState(rejectionReason || '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rejectPharmacyId) return;
    try {
      await fetch(`/api/admin/reject-pharmacy/${rejectPharmacyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: reason })
      });
      await onSubmit();
    } catch (err) {
      alert('فشل إرسال reason: ' + err.message);
    }
  };

  if (!rejectPharmacyId) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-2xl max-w-sm w-full mx-4 space-y-4">
        <p className="text-sm font-bold text-slate-700">أدخل سبب الرفض</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-md resize-y min-h-[80px]"
            placeholder="اكتب السبب هنا..."
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
              className="px-4 py-2 bg-red-500 text-white text-xs rounded-xl hover:bg-red-600"
            >
              إرسال السبب
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectReasonModal;