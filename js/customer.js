const { useState, useEffect } = React;

function CustomerDashboard({ user, onLogout }) {
  const [medicines, setMedicines] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    apiFetch('/medicines').then(data => setMedicines(data));
  }, []);

  const filtered = medicines.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-emerald-600 text-white p-6 rounded-2xl flex justify-between items-center shadow-xs">
        <div>
          <h2 className="text-lg font-bold">تطبيق دواي - البحث عن الأدوية والمتوفر التجاري</h2>
          <p className="text-xs text-emerald-100 mt-1">أهلاً بك وعافاك الله، {user.name || "العميل الكريم"}</p>
        </div>
        <button onClick={onLogout} className="bg-emerald-800 hover:bg-emerald-900 text-xs px-4 py-2 rounded-xl">تسجيل الخروج</button>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-slate-700">ابحث عن اسم الدواء أو البديل العلاجي:</label>
        <input type="text" placeholder="اكتب اسم الدواء هنا... (مثال: بنادول)" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(m => (
          <div key={m.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2">
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md inline-block">متوفر للبيع</span>
            <h4 className="font-bold text-slate-800 text-base">{m.name}</h4>
            <div className="text-xs text-slate-500 space-y-1 pt-1">
              <p>الصيدلية المتواجد بها: <span className="font-medium text-slate-700">{m.pharmacy_name}</span></p>
              <p>سعر الدواء الفعلي: <span className="font-bold text-indigo-600">{formatCurrency(m.price)}</span></p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-slate-400 py-8 text-sm">عذراً، لم نجد نتائج تطابق بحثك حالياً في الصيدليات المجاورة.</p>
        )}
      </div>
    </div>
  );
}

window.CustomerDashboard = CustomerDashboard;
