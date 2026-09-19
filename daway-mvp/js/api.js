// js/api.js
const TOKEN_KEY = 'daway_token';
const USER_KEY = 'daway_user';

// --- دوال التخزين المحلي ---
function readToken() { return localStorage.getItem(TOKEN_KEY); }
function readUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
function storeSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// --- تنسيق العملة ---
const formatCurrency = (amount, currency = 'ريال') => {
  const num = Number(amount);
  if (isNaN(num)) return '0.00 ' + currency;
  return num.toLocaleString('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ' + currency;
};

// ========== محاكاة البيانات ==========
const initializeMockData = () => {
  if (!localStorage.getItem('mock_medicines')) {
    localStorage.setItem('mock_medicines', JSON.stringify([
      { id: 1, user_id: 1, name: "بنادول إكسترا", quantity: 120, batch_number: "B001", expire_date: "2026-12-01", price: 15, supplier_id: null, category: "مسكن", barcode: "62810001", cost_price: 10, owner_id: 1 },
      { id: 2, user_id: 1, name: "أوميبرازول 20 ملغ", quantity: 5, batch_number: "B002", expire_date: "2024-07-15", price: 45, supplier_id: null, category: "معدة", barcode: "62810002", cost_price: 30, owner_id: 1 },
      { id: 3, user_id: 2, name: "أموكسيسيلين 500 ملغ", quantity: 50, batch_number: "B003", expire_date: "2025-10-01", price: 32, supplier_id: null, category: "مضاد حيوي", barcode: "62810003", cost_price: 20, owner_id: 2 },
    ]));
  }
  if (!localStorage.getItem('mock_users')) {
    localStorage.setItem('mock_users', JSON.stringify([
      { id: 1, pharmacy_name: "صيدلية الشفاء", email: "owner@pharmacy.com", password_hash: "", role: "pharmacy_owner", owner_id: 1, phone: "", country: "", gender: "", age: null },
      { id: 2, pharmacy_name: "صيدلية الأمل", email: "owner2@pharmacy.com", password_hash: "", role: "pharmacy_owner", owner_id: 2, phone: "", country: "", gender: "", age: null },
      { id: 3, pharmacy_name: "أحمد الصيدلي", email: "staff@pharmacy.com", password_hash: "", role: "pharmacy_staff", owner_id: 1, phone: "", country: "", gender: "", age: null },
      { id: 4, pharmacy_name: "المتحدة للمستودعات", email: "supplier@dist.com", password_hash: "", role: "supplier", owner_id: null, phone: "", country: "", gender: "", age: null },
      { id: 5, email: "admin@daway.com", password_hash: "", role: "admin", pharmacy_name: "مدير النظام", owner_id: null, phone: "", country: "", gender: "", age: null },
      { id: 6, email: "customer@test.com", password_hash: "", role: "customer", pharmacy_name: "عميل تجريبي", owner_id: null, phone: "", country: "", gender: "", age: null },
    ]));
  }
  if (!localStorage.getItem('mock_sales')) {
    localStorage.setItem('mock_sales', JSON.stringify([]));
  }
  if (!localStorage.getItem('mock_pending_pharmacies')) {
    localStorage.setItem('mock_pending_pharmacies', JSON.stringify([
      { id: 1, pharmacy_name: "صيدلية النور", owner_name: "خالد العتيبي", email: "nour@test.com", password_hash: "", phone: "+9665000000", address: "", status: "pending", created_at: "2026-06-01", reviewed_by: null, reviewed_at: null }
    ]));
  }
  if (!localStorage.getItem('mock_supplier_medicines')) {
    localStorage.setItem('mock_supplier_medicines', JSON.stringify([]));
  }
  if (!localStorage.getItem('mock_pharmacy_registrations')) {
    localStorage.setItem('mock_pharmacy_registrations', JSON.stringify([]));
  }
};
initializeMockData();

// ========== محاكاة API كاملة (localStorage) ==========
const mockApiFetch = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      let medicines = JSON.parse(localStorage.getItem('mock_medicines') || '[]');
      let users = JSON.parse(localStorage.getItem('mock_users') || '[]');
      let sales = JSON.parse(localStorage.getItem('mock_sales') || '[]');
      let pending = JSON.parse(localStorage.getItem('mock_pending_pharmacies') || '[]');
      let suppMeds = JSON.parse(localStorage.getItem('mock_supplier_medicines') || '[]');
      let registrations = JSON.parse(localStorage.getItem('mock_pharmacy_registrations') || '[]');

      const userId = 1; // في المحاكاة لا نملك توكن حقيقي، نستخدم id=1
      const now = new Date().toISOString();

      try {
        // --- الأدوية ---
        if (url === '/api/medicines') {
          if (options.method === 'POST') {
            const body = JSON.parse(options.body);
            const newMed = { id: Date.now(), ...body };
            medicines.push(newMed);
            localStorage.setItem('mock_medicines', JSON.stringify(medicines));
            return resolve({ ok: true, status: 201, json: () => Promise.resolve(newMed) });
          }
          // GET
          return resolve({ ok: true, status: 200, json: () => Promise.resolve(medicines) });
        }
        if (url.startsWith('/api/medicines/')) {
          const id = parseInt(url.split('/').pop());
          if (options.method === 'PUT') {
            const body = JSON.parse(options.body);
            medicines = medicines.map(m => m.id === id ? { ...m, ...body } : m);
            localStorage.setItem('mock_medicines', JSON.stringify(medicines));
            return resolve({ ok: true, status: 200, json: () => Promise.resolve({ message: 'updated' }) });
          }
          if (options.method === 'DELETE') {
            medicines = medicines.filter(m => m.id !== id);
            localStorage.setItem('mock_medicines', JSON.stringify(medicines));
            return resolve({ ok: true, status: 200, json: () => Promise.resolve({ message: 'deleted' }) });
          }
        }
        if (url === '/api/medicines/expiry-alerts') {
          const today = new Date().toISOString().split('T')[0];
          const alerts = medicines.filter(m => m.expire_date <= today);
          return resolve({ ok: true, status: 200, json: () => Promise.resolve(alerts) });
        }
        if (url === '/api/medicines/low-stock') {
          const low = medicines.filter(m => m.quantity <= 5);
          return resolve({ ok: true, status: 200, json: () => Promise.resolve(low) });
        }

        // --- المستخدمين ---
        if (url === '/api/users') {
          if (options.method === 'POST') {
            const body = JSON.parse(options.body);
            const newUser = { id: Date.now(), ...body, password_hash: '' };
            users.push(newUser);
            localStorage.setItem('mock_users', JSON.stringify(users));
            return resolve({ ok: true, status: 201, json: () => Promise.resolve(newUser) });
          }
          return resolve({ ok: true, status: 200, json: () => Promise.resolve(users) });
        }
        if (url.startsWith('/api/users/')) {
          const id = parseInt(url.split('/').pop());
          if (options.method === 'PUT') {
            const body = JSON.parse(options.body);
            users = users.map(u => u.id === id ? { ...u, ...body } : u);
            localStorage.setItem('mock_users', JSON.stringify(users));
            return resolve({ ok: true, status: 200, json: () => Promise.resolve({ message: 'updated' }) });
          }
          if (options.method === 'DELETE') {
            users = users.filter(u => u.id !== id);
            localStorage.setItem('mock_users', JSON.stringify(users));
            return resolve({ ok: true, status: 200, json: () => Promise.resolve({ message: 'deleted' }) });
          }
        }

        // --- المبيعات ---
        if (url === '/api/admin/sales') {
          return resolve({ ok: true, status: 200, json: () => Promise.resolve(sales.map(s => ({
            id: s.id,
            medicine_name: s.medicine_name,
            pharmacy_name: s.pharmacy_name,
            customer_name: s.customer_name || 'عميل',
            quantity: s.quantity,
            total_price: s.total_price,
            sold_at: s.sold_at
          }))) });
        }

        // --- طلبات الصيدليات ---
        if (url === '/api/admin/pending-pharmacies') {
          return resolve({ ok: true, status: 200, json: () => Promise.resolve(pending) });
        }
        if (url.startsWith('/api/admin/approve-pharmacy/')) {
          const id = parseInt(url.split('/').pop());
          const reg = pending.find(r => r.id === id);
          if (reg) {
            const newOwner = { id: Date.now(), pharmacy_name: reg.pharmacy_name, email: reg.email, password_hash: reg.password_hash, role: 'pharmacy_owner', owner_id: Date.now(), phone: reg.phone };
            users.push(newOwner);
            pending = pending.filter(r => r.id !== id);
            localStorage.setItem('mock_users', JSON.stringify(users));
            localStorage.setItem('mock_pending_pharmacies', JSON.stringify(pending));
          }
          return resolve({ ok: true, status: 200, json: () => Promise.resolve({ message: 'approved' }) });
        }
        if (url.startsWith('/api/admin/reject-pharmacy/')) {
          const id = parseInt(url.split('/').pop());
          pending = pending.filter(r => r.id !== id);
          localStorage.setItem('mock_pending_pharmacies', JSON.stringify(pending));
          return resolve({ ok: true, status: 200, json: () => Promise.resolve({ message: 'rejected' }) });
        }

        // --- الموردين ---
        if (url === '/api/suppliers') {
          const sups = users.filter(u => u.role === 'supplier').map(u => ({ id: u.id, name: u.pharmacy_name, email: u.email }));
          return resolve({ ok: true, status: 200, json: () => Promise.resolve(sups) });
        }
        if (url === '/api/supplier/medicines') {
          if (options.method === 'POST') {
            const body = JSON.parse(options.body);
            const newSM = { id: Date.now(), supplier_id: userId, ...body };
            suppMeds.push(newSM);
            localStorage.setItem('mock_supplier_medicines', JSON.stringify(suppMeds));
            return resolve({ ok: true, status: 201, json: () => Promise.resolve(newSM) });
          }
          const myMeds = suppMeds.filter(m => m.supplier_id === userId);
          return resolve({ ok: true, status: 200, json: () => Promise.resolve(myMeds) });
        }
        if (url.startsWith('/api/supplier/') && url.endsWith('/medicines')) {
          const suppId = parseInt(url.split('/')[2]);
          const meds = suppMeds.filter(m => m.supplier_id === suppId);
          return resolve({ ok: true, status: 200, json: () => Promise.resolve(meds) });
        }

        // --- مالك الصيدلية (موظفين) ---
        if (url === '/api/owner/staff') {
          if (options.method === 'POST') {
            const body = JSON.parse(options.body);
            const newStaff = { id: Date.now(), pharmacy_name: body.pharmacy_name, email: body.email, role: 'pharmacy_staff', owner_id: body.owner_id || 1 };
            users.push(newStaff);
            localStorage.setItem('mock_users', JSON.stringify(users));
            return resolve({ ok: true, status: 201, json: () => Promise.resolve(newStaff) });
          }
          const staff = users.filter(u => u.role === 'pharmacy_staff');
          return resolve({ ok: true, status: 200, json: () => Promise.resolve(staff) });
        }
        if (url.startsWith('/api/owner/staff/')) {
          const id = parseInt(url.split('/').pop());
          if (options.method === 'PUT') {
            const body = JSON.parse(options.body);
            users = users.map(u => u.id === id ? { ...u, ...body } : u);
            localStorage.setItem('mock_users', JSON.stringify(users));
            return resolve({ ok: true, status: 200, json: () => Promise.resolve({ message: 'updated' }) });
          }
          if (options.method === 'DELETE') {
            users = users.filter(u => u.id !== id);
            localStorage.setItem('mock_users', JSON.stringify(users));
            return resolve({ ok: true, status: 200, json: () => Promise.resolve({ message: 'deleted' }) });
          }
        }
        if (url === '/api/owner/sales') {
          const ownerSales = sales.filter(s => s.user_id === 1);
          return resolve({ ok: true, status: 200, json: () => Promise.resolve(ownerSales) });
        }

        // --- العميل ---
        if (url === '/api/pharmacies') {
          const owners = users.filter(u => u.role === 'pharmacy_owner').map(u => ({ id: u.id, pharmacy_name: u.pharmacy_name, email: u.email }));
          return resolve({ ok: true, status: 200, json: () => Promise.resolve(owners) });
        }
        if (url.startsWith('/api/customer/medicines/')) {
          const pharmacyId = parseInt(url.split('/').pop());
          const meds = medicines.filter(m => m.owner_id === pharmacyId);
          return resolve({ ok: true, status: 200, json: () => Promise.resolve(meds) });
        }
        if (url === '/api/customer/order') {
          const body = JSON.parse(options.body);
          const medicine = medicines.find(m => m.id === body.medicine_id);
          if (!medicine) return reject(new Error('الدواء غير موجود'));
          if (medicine.quantity < body.quantity) return reject(new Error('الكمية غير متوفرة'));
          medicine.quantity -= body.quantity;
          const newSale = {
            id: Date.now(),
            user_id: body.owner_id,
            customer_id: userId,
            medicine_id: body.medicine_id,
            quantity: body.quantity,
            unit_price: medicine.price,
            total_price: medicine.price * body.quantity,
            sold_at: now,
            medicine_name: medicine.name,
pharmacy_name: (users.find(u => u.id === body.owner_id) || {}).pharmacy_name || '',            customer_name: 'عميل',
          };
          sales.push(newSale);
          localStorage.setItem('mock_medicines', JSON.stringify(medicines));
          localStorage.setItem('mock_sales', JSON.stringify(sales));
          return resolve({ ok: true, status: 201, json: () => Promise.resolve({ message: 'تم الطلب', order: newSale }) });
        }

        // --- تسجيل الدخول (محاكاة) ---
        if (url === '/api/login') {
          const { email, password } = JSON.parse(options.body);
          const user = users.find(u => u.email === email);
          if (user) {
            const token = 'mock_token_' + user.role;
            return resolve({ ok: true, status: 200, json: () => Promise.resolve({ token, user }) });
          }
          return resolve({ ok: false, status: 401, json: () => Promise.resolve({ message: 'بيانات غير صحيحة' }) });
        }

        // default
        return resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      } catch (err) {
        reject(err);
      }
    }, 200);
  });
};

// ========== دالة apiFetch الموحدة ==========
let serverAvailable = null;

async function checkServerAvailability() {
  try {
const response = await fetch('http://localhost:5000/status', { method: 'GET' });    serverAvailable = response.ok;
  } catch (e) {
    serverAvailable = false;
  }
}

// نستدعيها مرة واحدة عند تحميل الملف
checkServerAvailability().then(() => {
  console.log('وضع التشغيل:', serverAvailable ? 'خادم حقيقي' : 'محاكاة محلية');
});

// الدالة الرئيسية التي ستستخدمها جميع المكونات
async function apiFetch(path, options = {}) {
  // انتظار انتهاء فحص الخادم
  while (serverAvailable === null) {
    await new Promise(r => setTimeout(r, 50));
  }

  if (serverAvailable) {
    // استخدام الخادم الحقيقي
    const token = readToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`http://localhost:5000/api${path}`, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
      throw new Error((data && data.message) ? data.message : 'Request failed');
    }
    return data;
  } else {
    // استخدام المحاكاة المحلية (localStorage)
    // نضيف `/api` افتراضيًا لنحاكي المسارات الحقيقية
    const mockResponse = await mockApiFetch(path.startsWith('/api') ? path : `/api${path}`, options);
    if (!mockResponse.ok) {
      const errData = await mockResponse.json();
      throw new Error(errData.message || 'Request failed');
    }
    return mockResponse.json();
  }
}

// تعريض الدوال المهمة إلى النطاق العام
window.apiFetch = apiFetch;
window.formatCurrency = formatCurrency;
window.readToken = readToken;
window.readUser = readUser;
window.storeSession = storeSession;
window.clearSession = clearSession;
window.TOKEN_KEY = TOKEN_KEY;
window.USER_KEY = USER_KEY;