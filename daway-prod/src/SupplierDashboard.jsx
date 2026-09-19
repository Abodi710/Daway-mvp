import { useState, useEffect } from 'react';
import { apiFetch, handleApiError } from './api.js';
import { formatCurrency } from './formatCurrency.js';

export default function SupplierDashboard({ user, onLogout, onTokenError }) {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', price: '', description: '', bulk_qty: '', bulk_price: '' });

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [poLoading, setPoLoading] = useState(false);

  // An expired/forbidden session (401/403) redirects to login via onTokenError;
  // every other failure is surfaced without dropping the session.
  const reportError = (err) => handleApiError(err, onTokenError, (e) => alert(e.message));
  const logError = (err) => handleApiError(err, onTokenError, (e) => console.error(e));

  const loadMedicines = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/supplier/medicines');
      setMedicines(data || []);
    } catch (err) { logError(err); }
    finally { setLoading(false); }
  };
  const loadPurchaseOrders = async () => {
    setPoLoading(true);
    try {
      const data = await apiFetch('/supplier/purchase-orders');
      setPurchaseOrders(data || []);
    } catch (err) { logError(err); }
    finally { setPoLoading(false); };
  };

  const handleFulfill = async (id) => {
    try {
      await apiFetch(`/supplier/purchase-order/${id}/fulfill`, {
        method: 'POST',
      });
      alert('تم تنفيذ الأمر بنجاح');
      loadPurchaseOrders();
    } catch (err) { reportError(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/supplier/medicines', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          price: parseFloat(form.price),
          description: form.description,
          bulk_qty: parseInt(form.bulk_qty) || 0,
          bulk_price: parseFloat(form.bulk_price) || 0
        })
      });
      setForm({ name: '', price: '', description: '', bulk_qty: '', bulk_price: '' });
      loadMedicines();
      alert('تمت إضافة الدواء إلى كتالوجك');
    } catch (err) { reportError(err); }
  };

  // Run once on mount. The loaders are re-created on every render (they close
  // over the onTokenError prop), so listing them as dependencies would refetch
  // continuously.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMedicines(); loadPurchaseOrders(); }, []);

  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 rounded-2xl bg-white/80 p-6 shadow flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">لوحة المورد</h1>
            <p className="text-slate-600">مرحباً {user.pharmacy_name || user.email}</p>
          </div>
          <button onClick={onLogout} className="bg-slate-800 text-white px-5 py-3 rounded-2xl">تسجيل خروج</button>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold mb-4">إضافة دواء جديد</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="اسم الدواء" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full rounded-xl border p-3" />
              <input type="number" step="0.01" placeholder="السعر" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required className="w-full rounded-xl border p-3" />
              <input type="number" placeholder="الكمية الكبيرة" value={form.bulk_qty} onChange={e => setForm({...form, bulk_qty: e.target.value})} className="w-full rounded-xl border p-3" />
              <input type="number" step="0.01" placeholder="سعر الجملة" value={form.bulk_price} onChange={e => setForm({...form, bulk_price: e.target.value})} className="w-full rounded-xl border p-3" />
              <textarea placeholder="وصف (اختياري)" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full rounded-xl border p-3" />
              <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">إضافة</button>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">أدويتي المعروضة</h2>
              <button onClick={loadMedicines} className="text-sm text-emerald-700 border rounded-xl px-3 py-1">تحديث</button>
            </div>
            {loading ? <p>جاري التحميل...</p> : medicines.length === 0 ? <p>لا توجد أدوية</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr><th className="text-right py-2">الاسم</th><th className="text-right py-2">السعر</th><th className="text-right py-2">الوصف</th></tr></thead>
                  <tbody>
                    {medicines.map(m => (
                      <tr key={m.id} className="border-b">
                        <td className="py-2">{m.name}</td>
                        <td className="py-2">{formatCurrency(m.price)}</td>
                        <td className="py-2">{m.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">أوامر الشراء الواردة</h2>
              <button onClick={loadPurchaseOrders} className="text-sm text-emerald-700 border rounded-xl px-3 py-1">تحديث</button>
            </div>
            {poLoading ? <p>جاري التحميل...</p> : purchaseOrders.length === 0 ? <p>لا توجد أوامر شراء</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-right py-2">رقم الأمر</th>
                      <th className="text-right py-2">اسم الدواء</th>
                      <th className="text-right py-2">الكمية</th>
                      <th className="text-right py-2">سعر الوحدة</th>
                      <th className="text-right py-2">الحالة</th>
                      <th className="text-right py-2">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrders.map(order => (
                      <tr key={order.id} className="border-b">
                        <td className="py-2">#{order.id}</td>
                        <td className="py-2">{order.medicine?.name || '-'}</td>
                        <td className="py-2">{order.quantity}</td>
                        <td className="py-2">{formatCurrency(order.unit_price)}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${order.status === 'completed' ? 'bg-green-100 text-green-800' : order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-2">
                          {order.status === 'pending' && (
                            <button
                              onClick={() => handleFulfill(order.id)}
                              className="bg-emerald-600 text-white px-3 py-1 rounded-xl text-xs hover:bg-emerald-700"
                            >
                              تنفيذ
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}