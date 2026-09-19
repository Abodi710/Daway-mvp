import { UploadCloud, WalletCards } from 'lucide-react';
import { mockOrders } from '../data/mockData';

export default function PatientDashboard({ cartItems = [], onCheckout, notification }) {
  const total = cartItems.reduce((sum, item) => sum + item.medicine.price * item.quantity, 0);

  return (
    <main dir="rtl" className="bg-slate-50">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-extrabold text-slate-950">لوحة المريض</h1>
        {notification && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{notification}</p>}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-extrabold text-slate-900">ملخص السلة</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {cartItems.length === 0 && <p className="py-8 text-sm text-slate-500">السلة فارغة حالياً.</p>}
              {cartItems.map((item) => (
                <div key={item.medicine.id} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-bold text-slate-900">{item.medicine.name}</p>
                    <p className="text-sm text-slate-500">{item.quantity} × {item.medicine.price} ج.س</p>
                  </div>
                  <p className="font-extrabold text-slate-900">{item.quantity * item.medicine.price} ج.س</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-lg bg-slate-50 p-4">
              <span className="font-bold text-slate-700">الإجمالي</span>
              <span className="text-xl font-extrabold text-emerald-700">{total} ج.س</span>
            </div>
            <button type="button" disabled={!cartItems.length} onClick={onCheckout} className="mt-5 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:bg-slate-300">
              إنشاء طلب Bankak
            </button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900"><UploadCloud className="h-5 w-5 text-emerald-600" /> إيصال Bankak</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">ارفع صورة الإيصال بعد التحويل ليتم اعتماد الطلب من الصيدلية.</p>
            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-600 hover:border-emerald-400">
              <UploadCloud className="mb-2 h-8 w-8 text-emerald-600" />
              اختر ملف الإيصال
              <input type="file" className="sr-only" accept="image/*,.pdf" />
            </label>
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900"><WalletCards className="h-5 w-5 text-emerald-600" /> سجل الطلبات</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr><th className="p-3 text-right">رقم الطلب</th><th className="p-3 text-right">الصيدلية</th><th className="p-3 text-right">التاريخ</th><th className="p-3 text-right">الدفع</th><th className="p-3 text-right">الحالة</th><th className="p-3 text-right">الإجمالي</th></tr>
              </thead>
              <tbody>
                {mockOrders.map((order) => (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="p-3 font-bold">#{order.id}</td><td className="p-3">{order.pharmacyName}</td><td className="p-3">{order.date}</td><td className="p-3">{order.paymentMethod}</td><td className="p-3">{order.status}</td><td className="p-3 font-bold">{order.totalAmount} ج.س</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
