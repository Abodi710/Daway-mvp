import { useState, useEffect } from 'react';
import api, { apiFetch, handleApiError } from './api.js';
import { formatCurrency } from './formatCurrency.js';

export default function CustomerDashboard({ user, onLogout, onTokenError }) {
  const [pharmacies, setPharmacies] = useState([]);
  const [pharmacySearch, setPharmacySearch] = useState('');
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [medicineSearch, setMedicineSearch] = useState('');
  const [cart, setCart] = useState([]); // each item: { medicineId, pharmacyId, quantity, name, price }
  const [pastOrders, setPastOrders] = useState([]);
  const [pharmacyLoading, setPharmacyLoading] = useState(true);
  const [medicineLoading, setMedicineLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [pastOrdersLoading, setPastOrdersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('new-order'); // 'new-order' or 'order-history'
  // Bumped after a successful order so stock and history refetch.
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch pharmacies with optional search
  useEffect(() => {
    const fetchPharmacies = async () => {
      setPharmacyLoading(true);
      try {
        const params = pharmacySearch ? `?search=${pharmacySearch}` : '';
        const data = await apiFetch(`/pharmacies${params}`);
        setPharmacies(data || []);
      } catch (err) {
        // 401/403 -> session expired, redirect to login; other failures logged.
        handleApiError(err, onTokenError, (e) => console.error(e));
      } finally {
        setPharmacyLoading(false);
      }
    };
    fetchPharmacies();
  }, [pharmacySearch, onTokenError]);

  // Fetch medicines for selected pharmacy
  useEffect(() => {
    if (selectedPharmacy) {
      const fetchMedicines = async () => {
        setMedicineLoading(true);
        try {
          const data = await apiFetch(`/customer/medicines/${selectedPharmacy}`);
          setMedicines(data || []);
        } catch (err) {
          handleApiError(err, onTokenError, (e) => alert(e.message));
        } finally {
          setMedicineLoading(false);
        }
      };
      fetchMedicines();
    } else {
      setMedicines([]);
    }
  }, [selectedPharmacy, onTokenError, refreshKey]);

  // Search medicines within selected pharmacy
  const filteredMedicines = medicines.filter(m =>
    m.name.toLowerCase().includes(medicineSearch.toLowerCase())
  );

  // Fetch past orders
  useEffect(() => {
    if (activeTab === 'order-history') {
      const fetchPastOrders = async () => {
        setPastOrdersLoading(true);
        try {
          const data = await apiFetch('/customer/orders');
          setPastOrders(data || []);
        } catch (err) {
          handleApiError(err, onTokenError, (e) => console.error(e));
        } finally {
          setPastOrdersLoading(false);
        }
      };
      fetchPastOrders();
    }
  }, [activeTab, onTokenError, refreshKey]);

  // Add to cart
  const addToCart = (medicine) => {
    if (!selectedPharmacy) return;
    const existing = cart.find(item => item.medicineId === medicine.id && item.pharmacyId === selectedPharmacy);
    if (existing) {
      setCart(cart.map(item =>
        item.medicineId === medicine.id && item.pharmacyId === selectedPharmacy
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([
        ...cart,
        {
          medicineId: medicine.id,
          pharmacyId: selectedPharmacy,
          quantity: 1,
          name: medicine.name,
          price: medicine.price
        }
      ]);
    }
  };

  // Remove from cart
  const removeFromCart = (medicineId, pharmacyId) => {
    setCart(cart.filter(item => !(item.medicineId === medicineId && item.pharmacyId === pharmacyId)));
  };

  // Increase quantity
  const increaseQuantity = (medicineId, pharmacyId) => {
    setCart(cart.map(item =>
      item.medicineId === medicineId && item.pharmacyId === pharmacyId
        ? { ...item, quantity: item.quantity + 1 }
        : item
    ));
  };

  // Decrease quantity
  const decreaseQuantity = (medicineId, pharmacyId) => {
    setCart(cart.map(item =>
      item.medicineId === medicineId && item.pharmacyId === pharmacyId
        ? item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : null
        : item
    ).filter(Boolean));
  };

  // Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('السلة فارغة');
      return;
    }
    // /api/customer/order-batch places one order against a single pharmacy.
    const pharmacyIds = [...new Set(cart.map((item) => item.pharmacyId))];
    if (pharmacyIds.length > 1) {
      alert('السلة تحتوي أدوية من أكثر من صيدلية. يرجى إتمام الطلب لكل صيدلية على حدة.');
      return;
    }
    setOrderLoading(true);
    try {
      // api.orders.create normalises the cart to the server's shape:
      // { pharmacyId, items: [{ medicine_id, quantity }] }.
      await api.orders.create({ pharmacyId: pharmacyIds[0], items: cart });
      setCart([]);
      setRefreshKey((key) => key + 1); // pull fresh stock + order history
      alert('تم تقديم الطلب بنجاح');
    } catch (err) {
      handleApiError(err, onTokenError, (e) => alert(e.message));
    } finally {
      setOrderLoading(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    onLogout();
  };

  // Render pharmacy list
  const renderPharmacyList = () => {
    if (pharmacyLoading) return <p className="text-sm text-slate-400">جاري تحميل الصيدليات...</p>;
    if (pharmacies.length === 0) return <p className="text-sm text-slate-400">لا توجد صيدليات بمخزون متاح حالياً.</p>;
    return (
      <div className="flex flex-wrap gap-2 mb-4">
        {pharmacies.map(p => (
          <button
            key={p.id}
            onClick={() => selectPharmacy(p.id)}
            className={`px-4 py-2 rounded-xl text-sm border transition ${selectedPharmacy === p.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 border-slate-200 hover:bg-emerald-50'}`}
          >
            {p.pharmacy_name}
          </button>
        ))}
      </div>
    );
  };

  // Select pharmacy
  const selectPharmacy = (pharmacyId) => {
    setSelectedPharmacy(pharmacyId);
    setMedicineSearch('');
  };

  // Render medicine grid
  const renderMedicineGrid = () => {
    if (!selectedPharmacy) return null;
    if (medicineLoading) return <p className="col-span-full text-sm text-slate-400 text-center">جاري تحميل الأدوية...</p>;
    if (medicines.length === 0) return <p className="col-span-full text-sm text-slate-400 text-center">لا توجد أدوية في هذه الصيدلية.</p>;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMedicines.map(m => (
          <div key={m.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md inline-block">متوفر للبيع</span>
            <h4 className="font-bold text-slate-800 text-base">{m.name}</h4>
            <div className="text-xs text-slate-500 space-y-1 pt-1">
              <p>الصيدلية: <span className="font-medium text-slate-700">{pharmacies.find(p => p.id === selectedPharmacy)?.pharmacy_name || ''}</span></p>
              <p>الكمية المتوفرة: <span className="font-medium">{m.quantity}</span></p>
              <p>سعر الدواء: <span className="font-bold text-indigo-600">{formatCurrency(m.price)}</span></p>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => addToCart(m)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl"
              >
                إضافة إلى السلة
              </button>
            </div>
          </div>
        ))}
        {filteredMedicines.length === 0 && (
          <p className="col-span-1 text-sm text-slate-500">لا توجد أدوية تطابق البحث.</p>
        )}
      </div>
    );
  };

  // Render cart sidebar
  const renderCartSidebar = () => {
    if (cart.length === 0) return null;
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return (
      <aside className="mt-4 md:mt-0 md:col-span-2 lg:col-span-1">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="font-bold text-slate-800 mb-4">سلتي</h3>
          <div className="space-y-3">
            {cart.map(item => (
              <div key={`${item.medicineId}-${item.pharmacyId}`} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl">
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">الصيدلية: {pharmacies.find(p => p.id === item.pharmacyId)?.pharmacy_name || ''}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => decreaseQuantity(item.medicineId, item.pharmacyId)}
                    className="w-8 h-8 bg-red-100 text-red-800 rounded flex items-center justify-center text-xs"
                    disabled={item.quantity === 1}
                  >
                    −
                  </button>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => increaseQuantity(item.medicineId, item.pharmacyId)}
                    className="w-8 h-8 bg-emerald-100 text-emerald-800 rounded flex items-center justify-center text-xs"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => removeFromCart(item.medicineId, item.pharmacyId)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  إزالة
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex justify-between text-lg font-bold">
              <span>الإجمالي:</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={orderLoading}
              className="w-full mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {orderLoading ? 'جاري الإتمام...' : 'إتمام الطلب'}
            </button>
          </div>
        </div>
      </aside>
    );
  };

  // Render past orders table
  const renderPastOrders = () => {
    if (pastOrdersLoading) return <p className="text-sm text-slate-400 text-center">جاري التحميل...</p>;
    if (pastOrders.length === 0) return <p className="text-sm text-slate-400 text-center">لا توجد طلبات سابقة.</p>;
    return (
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm text-right">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-2">رقم الطلب</th>
              <th className="px-4 py-2">التاريخ</th>
              <th className="px-4 py-2">الإجمالي</th>
              <th className="px-4 py-2">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pastOrders.map(order => (
              <tr key={order.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">#{order.id}</td>
                <td className="px-4 py-2 text-xs">{new Date(order.created_at).toLocaleString('ar-SA')}</td>
                <td className="px-4 py-2 font-medium text-indigo-600">{formatCurrency(order.total_amount)}</td>
                <td className="px-4 py-2 text-xs">
                  <span className={`px-2 py-0.5 rounded text-xs ${order.status === 'completed' ? 'bg-green-100 text-green-800' : order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                    {order.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="bg-emerald-600 text-white p-6 rounded-2xl flex justify-between items-center shadow-xs">
        <div>
          <h2 className="text-lg font-bold">تطبيق دواي - البحث عن الأدوية والمتوفر التجاري</h2>
          <p className="text-xs text-emerald-100 mt-1">أهلاً بك وعافاك الله، {user.pharmacy_name || "العميل الكريم"}</p>
        </div>
        <button onClick={handleLogout} className="bg-emerald-800 hover:bg-emerald-900 text-xs px-4 py-2 rounded-xl">تسجيل الخروج</button>
      </div>

      {/* Pharmacy search */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
        <label className="block text-sm font-bold text-slate-700 mb-2">ابحث عن صيدلية</label>
        <input
          type="text"
          placeholder="ابحث باسم الصيدلية..."
          value={pharmacySearch}
          onChange={e => setPharmacySearch(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
        />
      </div>

      {/* Pharmacy list */}
      <section className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
        <h3 className="font-bold text-slate-800 mb-2">الصيدليات المتوفرة</h3>
        {renderPharmacyList()}
      </section>

      {/* Tabs */}
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setActiveTab('new-order')}
          className={`px-4 py-2 rounded-xl text-sm font-medium ${activeTab === 'new-order' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          طلب جديد
        </button>
        <button
          onClick={() => setActiveTab('order-history')}
          className={`px-4 py-2 rounded-xl text-sm font-medium ${activeTab === 'order-history' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          طلباتي
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'new-order' ? (
        <>
          {selectedPharmacy ? (
            <>
              <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  ابحث في مخزون {pharmacies.find(p => p.id === selectedPharmacy)?.pharmacy_name}:
                </label>
                <input
                  type="text"
                  placeholder="ابحث باسم الدواء..."
                  value={medicineSearch}
                  onChange={e => setMedicineSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                />
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  {renderMedicineGrid()}
                </div>
                <div className="md:col-span-1">
                  {renderCartSidebar()}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center">
              <p className="text-sm text-slate-500">يرجى اختيار صيدلية لعرض أدويتها.</p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="font-bold text-slate-800 mb-4">طلباتي السابقة</h3>
          {renderPastOrders()}
        </div>
      )}
    </div>
  );
}