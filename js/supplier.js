// js/supplier.js
function SupplierDashboard({ user, onLogout }) {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', price: '', description: '' });

  const loadMedicines = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/supplier/medicines');
      setMedicines(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadMedicines(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/supplier/medicines', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          price: parseFloat(form.price),
          description: form.description
        })
      });
      setForm({ name: '', price: '', description: '' });
      loadMedicines();
      alert('تمت إضافة الدواء إلى كتالوجك');
    } catch (err) { alert(err.message); }
  };

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
            )}
          </section>
        </div>
      </div>
    </div>
  );
}