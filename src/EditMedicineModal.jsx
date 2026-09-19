import { useState } from 'react';

export default function EditMedicineModal({ medicine, onSave, onClose }) {
  const [name, setName] = useState(medicine.name);
  const [price, setPrice] = useState(medicine.price);
  const [quantity, setQuantity] = useState(medicine.quantity);

  const handleSave = () => {
    onSave(medicine.id, { name, price: parseFloat(price), quantity: parseInt(quantity) });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl mx-4 space-y-4">
        <h3 className="text-lg font-bold text-slate-800">تعديل بيانات الدواء</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">اسم الدواء</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">السعر</label>
            <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">الكمية</label>
            <input type="number" min="0" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">إلغاء</button>
          <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium shadow-sm">حفظ التغييرات</button>
        </div>
      </div>
    </div>
  );
}
