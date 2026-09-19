import { useState } from 'react';

export default function MedicineForm({ onAdd, pharmacies }) {
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expireDate, setExpireDate] = useState('');
  const [pharmacyId, setPharmacyId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    let pName = "";
    if (pharmacies) {
      const selected = pharmacies.find(p => p.id == pharmacyId);
      pName = selected ? selected.pharmacy_name : "عام";
    }
    onAdd({
      name,
      barcode,
      price: parseFloat(price),
      quantity: parseInt(quantity),
      expire_date: expireDate,
      pharmacy_id: pharmacyId || "1",
      pharmacy_name: pName || "الصيدلية الافتراضية"
    });
    setName(''); setBarcode(''); setPrice(''); setQuantity(''); setExpireDate('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
      <h3 className="text-lg font-bold text-slate-800 mb-2">إضافة دواء جديد للمنظومة</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">اسم الدواء</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">الباركود</label>
          <input type="text" value={barcode} onChange={e => setBarcode(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">السعر (ريال)</label>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">الكمية</label>
          <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">تاريخ انتهاء الصلاحية</label>
          <input type="date" value={expireDate} onChange={e => setExpireDate(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        {pharmacies && (
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">تخصيص لصيدلية</label>
            <select value={pharmacyId} onChange={e => setPharmacyId(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">اختر الصيدلية</option>
              {pharmacies.map(p => <option key={p.id} value={p.id}>{p.pharmacy_name}</option>)}
            </select>
          </div>
        )}
      </div>
      <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition shadow-sm">حفظ الدواء</button>
    </form>
  );
}