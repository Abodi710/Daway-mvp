/**
 * Daway API client
 * ------------------------------------------------------------------
 * Single entry point between the React UI and the Express server in
 * `server.cjs`. Three jobs:
 *
 *   1. Role adapter    — the UI speaks 'patient' / 'pharmacy'; the database
 *                        speaks 'customer' / 'pharmacy_owner' / 'pharmacy_staff'.
 *                        Everything crossing the wire is translated here.
 *   2. Endpoint map    — paths match the real routes in server.cjs
 *                        (/api/login, /api/register, /api/medicines,
 *                        /api/owner/*, /api/customer/order-batch, ...).
 *   3. Hybrid fallback — when the backend is unreachable, requests are served
 *                        from mockData + localStorage so the prototype still runs.
 *
 * Two surfaces are exported, both hitting the same transport:
 *   - `apiFetch(path, options)` — thin wrapper used directly by the dashboards.
 *   - `api.*`                   — grouped helpers used by App.jsx / AuthScreen.jsx.
 */

import {
  mockAuditLogs,
  mockMedicines,
  mockOrders,
  mockPharmacies,
  mockStates,
} from './data/mockData';

/* ------------------------------------------------------------------ */
/* Storage keys                                                        */
/* ------------------------------------------------------------------ */

const TOKEN_KEY = 'daway_token';
const USER_KEY = 'daway_user';
const ORDERS_KEY = 'daway_orders';
const INVENTORY_KEY = 'daway_inventory';
const PHARMACIES_KEY = 'daway_pharmacies';
const USERS_KEY = 'daway_users';

const readJson = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — keep the in-memory value */
  }
  return value;
};

const delay = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 120));

/* ------------------------------------------------------------------ */
/* Base URL                                                            */
/* ------------------------------------------------------------------ */

// VITE_API_BASE may be supplied with or without a trailing `/api`; both work,
// because the `/api` prefix is always added to the path below.
const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:5000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

const withApiPrefix = (path) => (path.startsWith('/api') ? path : `/api${path}`);
const buildUrl = (path) => `${API_BASE}${withApiPrefix(path)}`;

/* ------------------------------------------------------------------ */
/* Role adapter — UI roles <-> backend (database) roles                */
/* ------------------------------------------------------------------ */

export const UI_TO_BACKEND_ROLE = {
  patient: 'customer',
  pharmacy: 'pharmacy_owner',
  pharmacist: 'pharmacy_owner',
  staff: 'pharmacy_staff',
  supplier: 'supplier',
  admin: 'admin',
};

export const BACKEND_TO_UI_ROLE = {
  customer: 'patient',
  pharmacy_owner: 'pharmacy',
  pharmacy_staff: 'pharmacy',
  supplier: 'supplier',
  admin: 'admin',
};

/** UI role -> backend role. Backend roles pass through unchanged. */
export const toBackendRole = (role) => {
  if (!role) return role;
  return UI_TO_BACKEND_ROLE[role] || role;
};

/** Backend role -> UI role. UI roles pass through unchanged. */
export const toUiRole = (role) => {
  if (!role) return role;
  return BACKEND_TO_UI_ROLE[role] || role;
};

/**
 * Normalise a user for the session store.
 *
 * `role` is kept as the canonical BACKEND role, because live components compare
 * against backend values (AdminDashboard filters `role === 'pharmacy_owner'`,
 * PharmacyOwnerDashboard checks `role !== 'pharmacy_staff'`). `uiRole` is the
 * derived UI value for role-agnostic screens (App.jsx, AuthScreen.jsx).
 *
 * `uiRole` is lossy on purpose — owner and staff both collapse to 'pharmacy' —
 * so never rebuild `role` from `uiRole`; `role` is the source of truth.
 *
 * `name` / `pharmacy_name` are mirrored because the server returns only
 * `pharmacy_name` while App.jsx reads `user.name`.
 */
export function adaptUser(user) {
  if (!user || typeof user !== 'object') return user;
  const role = toBackendRole(user.role);
  return {
    ...user,
    role,
    uiRole: toUiRole(role),
    name: user.name || user.pharmacy_name || '',
    pharmacy_name: user.pharmacy_name || user.name || '',
  };
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

export const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

/** Reads the session, translating the stored backend role for UI consumers. */
export const readUser = () => adaptUser(readJson(USER_KEY, null));

/** Saves the session, translating any UI role to its backend equivalent. */
export const storeSession = (token, user) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore storage failures */
  }
  const adapted = adaptUser(user);
  if (adapted) writeJson(USER_KEY, adapted);
  return adapted;
};

export const clearSession = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore storage failures */
  }
};

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

// Once the backend is proven unreachable we stop hammering it for a while and
// serve the offline store directly, re-probing after the window expires.
const OFFLINE_RETRY_MS = 30000;
let offlineSince = 0;

const backendLooksOffline = () => offlineSince > 0 && Date.now() - offlineSince < OFFLINE_RETRY_MS;
const markOffline = () => { offlineSince = Date.now(); };
const markOnline = () => { offlineSince = 0; };

const extractErrorMessage = (data, fallback) => {
  if (!data) return fallback;
  return data.message || data.error || fallback;
};

/**
 * Error carrying the HTTP status, so callers can separate an expired session
 * (401/403) from a genuine failure (404/409/500) instead of treating every
 * rejection as a logout.
 */
export class ApiError extends Error {
  constructor(message, status, body = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** True when the server rejected the request for auth reasons. */
export const isAuthError = (error) => error?.status === 401 || error?.status === 403;

/**
 * Routes a rejected request to the right place: an expired or forbidden session
 * hands off to `onTokenError` (redirect to login); anything else is passed to
 * `onOther` so the UI can report it.
 *
 * Returns true when the error was treated as a session error.
 */
export function handleApiError(error, onTokenError, onOther) {
  if (isAuthError(error) && onTokenError) {
    onTokenError(error);
    return true;
  }
  if (onOther) onOther(error);
  else console.error('[Daway API]', error);
  return false;
}

async function parseResponseBody(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return response.json().catch(() => null);
}

/**
 * Unified request helper.
 *
 * A transport failure (server down, DNS, connection refused) falls back to the
 * offline store. An HTTP error response does NOT — 401/403/409 are real answers
 * from the server and must reach the caller, otherwise a rejected login would
 * silently succeed against mock data.
 */
export async function apiFetch(path, options = {}) {
  const apiPath = withApiPrefix(path);

  if (backendLooksOffline()) {
    return mockRequest(apiPath, options);
  }

  let response;
  try {
    const token = readToken();
    response = await fetch(buildUrl(apiPath), {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    markOnline();
  } catch (transportError) {
    markOffline();
    console.info('[Daway API] backend unreachable, serving offline fallback for', apiPath, transportError.message);
    return mockRequest(apiPath, options);
  }

  const data = await parseResponseBody(response);
  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(data, `فشل الطلب (${response.status}).`),
      response.status,
      data
    );
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Offline store (mockData + localStorage)                             */
/* ------------------------------------------------------------------ */

const demoUsers = [
  { id: 1, pharmacy_name: 'مدير النظام', email: 'admin@daway.sd', role: 'admin', owner_id: null },
  { id: 11, pharmacy_name: 'صيدلية النيل', email: 'pharmacy@daway.sd', role: 'pharmacy_owner', owner_id: 11 },
  { id: 21, pharmacy_name: 'محمد إبراهيم', email: 'patient@daway.sd', role: 'customer', owner_id: null },
  { id: 31, pharmacy_name: 'مورد النيل الطبي', email: 'supplier@daway.sd', role: 'supplier', owner_id: null },
];

/**
 * Mock medicines carry UI field names (stock/expiryDate/pharmacyId) while the
 * server returns quantity/expire_date/owner_id. Offline rows expose both so
 * either kind of screen renders from the same object.
 */
const toServerMedicine = (medicine) => {
  const quantity = Number(medicine.quantity ?? medicine.stock ?? 0);
  const expiry = medicine.expire_date || medicine.expiryDate || '';
  const ownerId = medicine.owner_id ?? medicine.pharmacyId ?? null;
  return {
    ...medicine,
    id: medicine.id,
    name: medicine.name || '',
    quantity,
    price: Number(medicine.price ?? 0),
    batch_number: medicine.batch_number || medicine.batchNumber || `MOCK-${medicine.id}`,
    expire_date: expiry,
    category: medicine.category || '',
    owner_id: ownerId,
    cost_price: medicine.cost_price ?? null,
    // UI-shaped mirrors
    stock: quantity,
    expiryDate: expiry,
    pharmacyId: ownerId,
    genericName: medicine.genericName || '',
    reorderLevel: medicine.reorderLevel ?? 10,
  };
};

const readMockUsers = () => readJson(USERS_KEY, demoUsers).map(adaptUser);
const readMockMedicines = () => readJson(INVENTORY_KEY, mockMedicines).map(toServerMedicine);
const writeMockMedicines = (rows) => writeJson(INVENTORY_KEY, rows.map(toServerMedicine));
const readMockPharmacies = () => readJson(PHARMACIES_KEY, mockPharmacies);
const readMockOrders = () => readJson(ORDERS_KEY, mockOrders);

const parseRequestBody = (body) => {
  if (!body) return {};
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
};

const notFound = (message) => { throw new Error(message); };

/** Offline route table, keyed on the same paths the real server exposes. */
const mockRoutes = [
  /* ---- auth ---- */
  {
    method: 'POST',
    pattern: /^\/login$/,
    handler: ({ body }) => {
      const users = readMockUsers();
      const user = users.find((item) => item.email === body.email);
      if (!user) notFound('بيانات الدخول غير صحيحة.');
      return { token: `mock-token-${user.role}-${Date.now()}`, user };
    },
  },
  {
    // Mirrors the real contract: register returns a message only, no token.
    method: 'POST',
    pattern: /^\/register$/,
    handler: ({ body }) => {
      const users = readMockUsers();
      if (users.some((item) => item.email === body.email)) {
        notFound('البريد الإلكتروني مستخدم مسبقاً.');
      }
      const user = adaptUser({
        id: Date.now(),
        pharmacy_name: body.pharmacy_name || 'مستخدم جديد',
        email: body.email,
        role: toBackendRole(body.role) || 'customer',
        owner_id: null,
        phone: body.phone || '',
      });
      writeJson(USERS_KEY, [...users, user]);
      return { message: 'تم تسجيل المستخدم بنجاح.', id: user.id };
    },
  },
  {
    method: 'POST',
    pattern: /^\/pharmacy\/register$/,
    handler: ({ body }) => {
      const items = readMockPharmacies();
      const pharmacy = {
        id: Date.now(),
        name: body.pharmacy_name,
        pharmacy_name: body.pharmacy_name,
        owner_name: body.owner_name,
        email: body.email,
        phone: body.phone || '',
        address: body.address || '',
        status: 'pending',
      };
      writeJson(PHARMACIES_KEY, [...items, pharmacy]);
      return { message: 'تم تقديم الطلب بنجاح، بانتظار المراجعة', id: pharmacy.id };
    },
  },
  { method: 'POST', pattern: /^\/change-password$/, handler: () => ({ success: true, message: 'تم تغيير كلمة المرور.' }) },

  /* ---- users (admin) ---- */
  { method: 'GET', pattern: /^\/users$/, handler: () => readMockUsers() },
  {
    method: 'POST',
    pattern: /^\/users$/,
    handler: ({ body }) => {
      const users = readMockUsers();
      const user = adaptUser({ id: Date.now(), owner_id: null, ...body, role: toBackendRole(body.role) });
      writeJson(USERS_KEY, [...users, user]);
      return user;
    },
  },
  {
    method: 'PUT',
    pattern: /^\/users\/(\d+)$/,
    handler: ({ params, body }) => {
      const id = Number(params[0]);
      const users = readMockUsers().map((user) =>
        user.id === id ? adaptUser({ ...user, ...body, role: toBackendRole(body.role || user.role) }) : user);
      writeJson(USERS_KEY, users);
      return users.find((user) => user.id === id);
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/users\/(\d+)$/,
    handler: ({ params }) => {
      const id = Number(params[0]);
      writeJson(USERS_KEY, readMockUsers().filter((user) => user.id !== id));
      return { message: 'تم حذف المستخدم.' };
    },
  },
  {
    method: 'PUT',
    pattern: /^\/users\/(\d+)\/toggle-status$/,
    handler: ({ params }) => {
      const id = Number(params[0]);
      const users = readMockUsers().map((user) =>
        user.id === id ? { ...user, status: user.status === 'inactive' ? 'active' : 'inactive' } : user);
      writeJson(USERS_KEY, users);
      return users.find((user) => user.id === id);
    },
  },

  /* ---- medicines ---- */
  {
    method: 'GET',
    pattern: /^\/medicines\/low-stock$/,
    handler: () => readMockMedicines().filter((m) => m.quantity <= (m.reorderLevel ?? 10)),
  },
  {
    method: 'GET',
    pattern: /^\/medicines\/expiry-alerts$/,
    handler: () => {
      const limit = new Date();
      limit.setMonth(limit.getMonth() + 6);
      return readMockMedicines().filter((m) => m.expire_date && new Date(m.expire_date) <= limit);
    },
  },
  { method: 'GET', pattern: /^\/medicines$/, handler: () => readMockMedicines() },
  {
    method: 'POST',
    pattern: /^\/medicines$/,
    handler: ({ body }) => {
      const rows = readMockMedicines();
      const medicine = toServerMedicine({ id: Date.now(), ...body });
      writeMockMedicines([medicine, ...rows]);
      return { message: 'تمت إضافة الدواء بنجاح.', medicine };
    },
  },
  {
    method: 'PUT',
    pattern: /^\/medicines\/(\d+)$/,
    handler: ({ params, body }) => {
      const id = Number(params[0]);
      const rows = readMockMedicines();
      if (!rows.some((m) => Number(m.id) === id)) notFound('الدواء غير موجود.');
      writeMockMedicines(rows.map((m) => (Number(m.id) === id ? toServerMedicine({ ...m, ...body }) : m)));
      return { message: 'تم تحديث الدواء بنجاح.' };
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/medicines\/(\d+)$/,
    handler: ({ params }) => {
      const id = Number(params[0]);
      writeMockMedicines(readMockMedicines().filter((m) => Number(m.id) !== id));
      return { message: 'تم حذف الدواء بنجاح.' };
    },
  },

  /* ---- pharmacies / admin review ---- */
  {
    method: 'GET',
    pattern: /^\/pharmacies$/,
    handler: () => readMockPharmacies().map((p) => ({
      id: p.ownerId ?? p.id,
      pharmacy_name: p.pharmacy_name || p.name,
      email: p.email || '',
      ...p,
    })),
  },
  {
    method: 'GET',
    pattern: /^\/admin\/pending-pharmacies$/,
    handler: () => readMockPharmacies().filter((p) => p.status === 'pending'),
  },
  {
    method: 'PUT',
    pattern: /^\/admin\/approve-pharmacy\/(\d+)$/,
    handler: ({ params }) => {
      const id = Number(params[0]);
      const items = readMockPharmacies().map((p) => (p.id === id ? { ...p, status: 'approved' } : p));
      writeJson(PHARMACIES_KEY, items);
      return { message: 'تمت الموافقة على الصيدلية.', pharmacy: items.find((p) => p.id === id) };
    },
  },
  {
    method: 'PUT',
    pattern: /^\/admin\/reject-pharmacy\/(\d+)$/,
    handler: ({ params, body }) => {
      const id = Number(params[0]);
      const reason = body.rejection_reason || '';
      const items = readMockPharmacies().map((p) =>
        (p.id === id ? { ...p, status: 'rejected', rejection_reason: reason } : p));
      writeJson(PHARMACIES_KEY, items);
      return { message: 'تم رفض الطلب وتسجيل سبب الرفض', rejection_reason: reason };
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/sales$/,
    handler: () => readMockOrders().flatMap((order) => (order.items || []).map((item, index) => ({
      id: Number(`${order.id}${index}`),
      medicine_name: item.medicineName,
      quantity: item.quantity,
      total_price: item.subtotal,
      sold_at: order.date,
      customer_name: order.customerName,
      pharmacy_name: order.pharmacyName,
    }))),
  },

  /* ---- pharmacy owner ---- */
  {
    method: 'GET',
    pattern: /^\/owner\/staff$/,
    handler: () => readMockUsers().filter((user) => user.role === 'pharmacy_staff'),
  },
  {
    method: 'POST',
    pattern: /^\/owner\/staff$/,
    handler: ({ body }) => {
      const users = readMockUsers();
      const staff = adaptUser({
        id: Date.now(),
        pharmacy_name: body.pharmacy_name,
        email: body.email,
        role: 'pharmacy_staff',
        owner_id: body.owner_id ?? null,
      });
      writeJson(USERS_KEY, [...users, staff]);
      return { id: staff.id, message: 'تم إضافة الموظف' };
    },
  },
  {
    method: 'PUT',
    pattern: /^\/owner\/staff\/(\d+)$/,
    handler: ({ params, body }) => {
      const id = Number(params[0]);
      const users = readMockUsers().map((user) => (user.id === id ? adaptUser({ ...user, ...body }) : user));
      writeJson(USERS_KEY, users);
      return { message: 'تم تحديث بيانات الموظف' };
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/owner\/staff\/(\d+)$/,
    handler: ({ params }) => {
      const id = Number(params[0]);
      writeJson(USERS_KEY, readMockUsers().filter((user) => user.id !== id));
      return { message: 'تم حذف الموظف' };
    },
  },
  {
    method: 'GET',
    pattern: /^\/owner\/sales$/,
    handler: () => readMockOrders().flatMap((order) => (order.items || []).map((item, index) => ({
      id: Number(`${order.id}${index}`),
      medicine_name: item.medicineName,
      quantity: item.quantity,
      total_price: item.subtotal,
      sold_at: order.date,
      customer_name: order.customerName,
    }))),
  },
  {
    method: 'GET',
    pattern: /^\/owner\/sales\/summary$/,
    handler: () => {
      const orders = readMockOrders();
      const total = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
      return {
        total_sales: total,
        today_sales: 0,
        month_sales: total,
        order_count: orders.length,
        daily_sales: orders.map((order) => ({ sale_date: order.date, daily_total: order.totalAmount })),
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/owner\/notifications$/,
    handler: () => {
      const rows = readMockMedicines();
      const lowStock = rows.filter((m) => m.quantity < 10);
      const limit = new Date();
      limit.setDate(limit.getDate() + 30);
      const expiringSoon = rows.filter((m) => m.expire_date && new Date(m.expire_date) <= limit);
      // Field names mirror the real route, which responds { expiringSoon, lowStock }.
      return { expiringSoon, lowStock };
    },
  },

  /* ---- customer ---- */
  { method: 'GET', pattern: /^\/customer\/medicines\/(\d+)$/, handler: ({ params }) => {
      const ownerId = Number(params[0]);
      return readMockMedicines().filter((m) => Number(m.owner_id) === ownerId && m.quantity > 0);
    } },
  {
    method: 'GET',
    pattern: /^\/customer\/orders$/,
    handler: () => readMockOrders().flatMap((order) => (order.items || []).map((item) => ({
      id: order.id,
      status: order.status,
      created_at: order.date,
      total_amount: order.totalAmount,
      medicine_name: item.medicineName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.subtotal,
      pharmacy_name: order.pharmacyName,
    }))),
  },
  {
    method: 'POST',
    pattern: /^\/customer\/order(-batch)?$/,
    handler: ({ body }) => {
      const catalog = readMockMedicines();
      const items = (body.items || [{ medicine_id: body.medicine_id, quantity: body.quantity }])
        .map((item) => {
          const medicine = catalog.find((m) => Number(m.id) === Number(item.medicine_id));
          const quantity = Number(item.quantity || 0);
          const unitPrice = Number(medicine?.price ?? 0);
          return {
            medicineId: Number(item.medicine_id),
            medicineName: medicine?.name || `#${item.medicine_id}`,
            quantity,
            unitPrice,
            subtotal: unitPrice * quantity,
          };
        });
      const order = {
        id: Date.now(),
        customerName: readUser()?.name || 'عميل',
        items,
        totalAmount: items.reduce((sum, item) => sum + item.subtotal, 0),
        paymentMethod: body.paymentMethod || 'bankak',
        status: 'pending',
        date: new Date().toISOString().slice(0, 10),
        pharmacyId: body.pharmacyId ?? null,
      };
      writeJson(ORDERS_KEY, [order, ...readMockOrders()]);
      // Offline stock decrement, mirroring the server's transaction.
      writeMockMedicines(catalog.map((medicine) => {
        const line = items.find((item) => item.medicineId === Number(medicine.id));
        return line ? { ...medicine, quantity: Math.max(0, medicine.quantity - line.quantity) } : medicine;
      }));
      return { message: 'تم إنشاء الطلب بنجاح', orderId: order.id, order };
    },
  },

  /* ---- POS / suppliers ---- */
  {
    method: 'POST',
    pattern: /^\/pos\/order$/,
    handler: ({ body }) => {
      const catalog = readMockMedicines();
      const medicine = catalog.find((m) => Number(m.id) === Number(body.medicine_id));
      if (!medicine) notFound('الدواء غير موجود.');
      const quantity = Number(body.quantity || 0);
      if (medicine.quantity < quantity) notFound('الكمية المطلوبة غير متوفرة.');
      writeMockMedicines(catalog.map((m) =>
        (Number(m.id) === Number(body.medicine_id) ? { ...m, quantity: m.quantity - quantity } : m)));
      const totalPrice = medicine.price * quantity;
      return {
        message: 'تم إنشاء الطلب بنجاح.',
        orderId: Date.now(),
        order: { id: Date.now(), medicine_id: medicine.id, quantity, total_price: totalPrice },
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/suppliers$/,
    handler: () => readMockUsers().filter((user) => user.role === 'supplier'),
  },
  { method: 'GET', pattern: /^\/supplier\/medicines$/, handler: () => readMockMedicines() },
  { method: 'GET', pattern: /^\/supplier\/(\d+)\/medicines$/, handler: () => readMockMedicines() },
  {
    method: 'POST',
    pattern: /^\/supplier\/medicines$/,
    handler: ({ body }) => ({ id: Date.now(), ...body }),
  },
  { method: 'GET', pattern: /^\/supplier\/purchase-orders$/, handler: () => [] },
  { method: 'POST', pattern: /^\/supplier\/purchase-order$/, handler: ({ body }) => ({ id: Date.now(), ...body }) },
];

/** Serves a request from mockData + localStorage while the backend is down. */
async function mockRequest(apiPath, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const [rawPath, queryString] = withApiPrefix(apiPath).replace(/^\/api/, '').split('?');
  const path = rawPath || '/';
  const query = Object.fromEntries(new URLSearchParams(queryString || ''));
  const body = parseRequestBody(options.body);

  const route = mockRoutes.find((item) => item.method === method && item.pattern.test(path));
  if (!route) {
    console.warn('[Daway API] no offline handler for', method, apiPath);
    return delay(method === 'GET' ? [] : { message: 'تم تنفيذ الطلب محلياً (وضع عدم الاتصال).' });
  }

  const params = route.pattern.exec(path).slice(1);
  return delay(route.handler({ params, query, body, method, path }));
}

/* ------------------------------------------------------------------ */
/* Payload adapters                                                    */
/* ------------------------------------------------------------------ */

/**
 * PUT /api/medicines/:id overwrites name, quantity, batch_number, expire_date
 * and price in one UPDATE, so every call must send the complete row — a partial
 * body would blank the omitted columns.
 */
const toMedicinePayload = (medicine = {}) => ({
  name: medicine.name ?? '',
  quantity: Number(medicine.quantity ?? medicine.stock ?? 0),
  batch_number: medicine.batch_number ?? medicine.batchNumber ?? '',
  expire_date: medicine.expire_date ?? medicine.expiryDate ?? '',
  price: Number(medicine.price ?? 0),
});

const toCreateMedicinePayload = (medicine = {}) => {
  const payload = { ...toMedicinePayload(medicine) };
  const optional = {
    supplier_id: medicine.supplier_id,
    category: medicine.category,
    barcode: medicine.barcode,
    cost_price: medicine.cost_price,
    owner_id: medicine.owner_id ?? medicine.pharmacyId,
  };
  Object.entries(optional).forEach(([key, value]) => {
    if (value !== undefined && value !== null) payload[key] = value;
  });
  return payload;
};

/** Normalises cart lines to the `{ medicine_id, quantity }` pairs the server wants. */
const toOrderItems = (items = []) => items
  .map((item) => ({
    medicine_id: Number(item.medicine_id ?? item.medicineId ?? item.medicine?.id ?? item.id),
    quantity: Number(item.quantity ?? 1),
  }))
  .filter((item) => Number.isFinite(item.medicine_id) && item.quantity > 0);

/* ---- catalog preview (public marketing pages) ---- */

/**
 * Reads a token-gated catalog route for a page that may have no session,
 * falling back to the offline sample instead of rejecting.
 */
const settleCatalogRead = async (path, readFallback) => {
  try {
    const rows = await apiFetch(path);
    if (Array.isArray(rows)) return { rows, live: true };
  } catch (error) {
    // 401/403 is the expected answer for an anonymous visitor, so it stays
    // quiet; any other failure is worth a console line.
    if (!isAuthError(error)) {
      console.info('[Daway API] catalog preview falling back for', path, error.message);
    }
  }
  return { rows: readFallback(), live: false };
};

/** One medicine shape for the marketing cards, from either row flavour. */
const toCatalogMedicine = (medicine = {}) => {
  const quantity = Number(medicine.quantity ?? medicine.stock ?? 0);
  return {
    id: medicine.id,
    name: medicine.name || 'دواء',
    genericName: medicine.genericName || '',
    category: medicine.category || '',
    price: Number(medicine.price ?? 0),
    quantity,
    inStock: quantity > 0,
    pharmacyId: medicine.owner_id ?? medicine.pharmacyId ?? null,
    pharmacyName: medicine.pharmacyName || '',
  };
};

/**
 * `/api/pharmacies` returns only `{ id, pharmacy_name, email }` — no state, city
 * or rating — so those fields stay empty for live rows rather than being
 * invented. That route already restricts itself to approved owners holding
 * stock, which is what the "معتمدة" badge on the landing page reflects.
 */
const toCatalogPharmacy = (pharmacy = {}) => ({
  id: pharmacy.id ?? pharmacy.ownerId ?? null,
  name: pharmacy.pharmacy_name || pharmacy.name || 'صيدلية',
  email: pharmacy.email || '',
  state: pharmacy.state || '',
  city: pharmacy.city || '',
  rating: pharmacy.rating ?? null,
});

/**
 * State filter options. Live pharmacy rows carry no state column yet, so the
 * known state list is used until they do — the values match the ones
 * ExplorePage filters on, so `?state=` round-trips between the two pages.
 */
const toCatalogStates = (pharmacies = []) => {
  const fromRows = [...new Set(pharmacies.map((item) => item.state).filter(Boolean))];
  return fromRows.length ? fromRows : mockStates.map((state) => state.name);
};

/**
 * /api/customer/order-batch requires a pharmacyId. Callers that only know the
 * cart (App.jsx's prototype checkout) get it resolved from the medicine catalog.
 */
const resolvePharmacyId = (payload, items) => {
  const direct = payload.pharmacyId ?? payload.pharmacy_id ?? payload.owner_id;
  if (direct !== undefined && direct !== null && direct !== '') return Number(direct);

  const fromItems = (payload.items || []).find((item) => item.pharmacyId ?? item.owner_id);
  if (fromItems) return Number(fromItems.pharmacyId ?? fromItems.owner_id);

  const first = items[0];
  if (!first) return null;
  const catalog = readMockMedicines();
  const medicine = catalog.find((item) => Number(item.id) === first.medicine_id);
  return medicine?.owner_id != null ? Number(medicine.owner_id) : null;
};

/* ------------------------------------------------------------------ */
/* Grouped API                                                         */
/* ------------------------------------------------------------------ */

export const api = {
  auth: {
    /** POST /api/login -> { token, user } */
    login: async (credentials = {}) => {
      const data = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      });
      const user = adaptUser(data?.user);
      if (data?.token) storeSession(data.token, user);
      return { ...data, user };
    },

    /**
     * POST /api/register.
     *
     * The server responds `{ message }` with no token, but the caller needs
     * `{ user, token }` to continue, so the credentials just registered are
     * used to sign in immediately.
     */
    register: async (payload = {}) => {
      const body = {
        pharmacy_name: payload.pharmacy_name || payload.name || payload.pharmacyName || payload.companyName || '',
        email: payload.email,
        password: payload.password,
        role: toBackendRole(payload.role) || 'customer',
      };
      if (payload.phone) body.phone = payload.phone;
      if (payload.country || payload.state) body.country = payload.country || payload.state;
      if (payload.gender) body.gender = payload.gender;
      if (payload.age) body.age = payload.age;
      if (payload.owner_id) body.owner_id = payload.owner_id;

      const created = await apiFetch('/register', { method: 'POST', body: JSON.stringify(body) });

      try {
        const session = await api.auth.login({ email: payload.email, password: payload.password });
        return { ...created, ...session };
      } catch {
        throw new Error('تم إنشاء الحساب بنجاح. يرجى تسجيل الدخول.');
      }
    },

    /** No /api/auth/me route exists; the stored session is the source of truth. */
    me: async () => ({ user: readUser() }),

    /** JWTs are stateless — logging out is a client-side operation. */
    logout: async () => {
      clearSession();
      return { ok: true };
    },

    changePassword: (currentPassword, newPassword) => apiFetch('/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  },

  users: {
    list: () => apiFetch('/users'),
    create: (payload) => apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify({ ...payload, role: toBackendRole(payload.role) }),
    }),
    update: (id, payload) => apiFetch(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...payload, role: toBackendRole(payload.role) }),
    }),
    remove: (id) => apiFetch(`/users/${id}`, { method: 'DELETE' }),
    toggleStatus: (id) => apiFetch(`/users/${id}/toggle-status`, { method: 'PUT' }),
  },

  pharmacies: {
    list: () => apiFetch('/pharmacies'),
    pending: () => apiFetch('/admin/pending-pharmacies'),
    approve: (id) => apiFetch(`/admin/approve-pharmacy/${id}`, { method: 'PUT' }),
    // The server reads `rejection_reason`, not `reason`.
    reject: (id, reason = '') => apiFetch(`/admin/reject-pharmacy/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ rejection_reason: reason }),
    }),
    register: (payload) => apiFetch('/pharmacy/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  },

  medicines: {
    list: () => apiFetch('/medicines'),
    create: (payload) => apiFetch('/medicines', {
      method: 'POST',
      body: JSON.stringify(toCreateMedicinePayload(payload)),
    }),
    update: (id, payload) => apiFetch(`/medicines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toMedicinePayload(payload)),
    }),
    remove: (id) => apiFetch(`/medicines/${id}`, { method: 'DELETE' }),
    lowStock: () => apiFetch('/medicines/low-stock'),
    expiringSoon: () => apiFetch('/medicines/expiry-alerts'),

    /** There is no search route — the list is filtered client-side. */
    search: async (filters = {}) => {
      const rows = await api.medicines.list();
      const query = (filters.query || '').trim().toLowerCase();
      return (Array.isArray(rows) ? rows : []).filter((medicine) => {
        const name = (medicine.name || '').toLowerCase();
        const generic = (medicine.genericName || '').toLowerCase();
        const textMatch = !query || name.includes(query) || generic.includes(query);
        const categoryMatch = !filters.category || medicine.category === filters.category;
        const priceMatch = !filters.maxPrice || Number(medicine.price) <= Number(filters.maxPrice);
        return textMatch && categoryMatch && priceMatch;
      });
    },

    /** Re-sends the full row, because PUT overwrites every listed column. */
    updateStock: async (id, quantity) => {
      const rows = await api.medicines.list();
      const current = (Array.isArray(rows) ? rows : []).find((item) => Number(item.id) === Number(id)) || {};
      return api.medicines.update(id, { ...current, quantity });
    },
  },

  /**
   * Catalog reads for the public marketing pages.
   *
   * Nothing on the server is readable anonymously: `/api/medicines` is
   * admin/owner/staff-only and `/api/pharmacies` is customer/admin-only, while
   * the landing page is an unauthenticated route. Rather than open a public
   * inventory endpoint — which would publish every pharmacy's stock and pricing
   * to anyone — the preview degrades: a live read whenever the visitor's session
   * permits one, the bundled sample catalog otherwise.
   */
  catalog: {
    /**
     * Never rejects. The landing page has to paint whether or not the visitor
     * can read the catalog, so a failed read is reported through `live: false`
     * instead of being thrown.
     *
     * Both lists come back whole — the counts shown on the page are meant to
     * describe the catalog, so trimming belongs to whatever renders the rows.
     */
    preview: async () => {
      const [medicines, pharmacies] = await Promise.all([
        settleCatalogRead('/medicines', readMockMedicines),
        settleCatalogRead('/pharmacies', readMockPharmacies),
      ]);
      return {
        medicines: medicines.rows.map(toCatalogMedicine),
        pharmacies: pharmacies.rows.map(toCatalogPharmacy),
        states: toCatalogStates(pharmacies.rows),
        live: medicines.live && pharmacies.live,
      };
    },
  },

  owner: {
    staff: () => apiFetch('/owner/staff'),
    addStaff: (payload) => apiFetch('/owner/staff', { method: 'POST', body: JSON.stringify(payload) }),
    updateStaff: (id, payload) => apiFetch(`/owner/staff/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    removeStaff: (id) => apiFetch(`/owner/staff/${id}`, { method: 'DELETE' }),
    sales: () => apiFetch('/owner/sales'),
    salesSummary: () => apiFetch('/owner/sales/summary'),
    notifications: () => apiFetch('/owner/notifications'),
    inventory: () => apiFetch('/medicines'),
  },

  orders: {
    list: () => apiFetch('/customer/orders'),

    /** POST /api/customer/order-batch — `{ pharmacyId, items: [{ medicine_id, quantity }] }` */
    create: (payload = {}) => {
      const items = toOrderItems(payload.items);
      if (!items.length) {
        return Promise.reject(new Error('السلة فارغة أو تحتوي على عناصر غير صالحة.'));
      }
      const pharmacyId = resolvePharmacyId(payload, items);
      return apiFetch('/customer/order-batch', {
        method: 'POST',
        body: JSON.stringify({ pharmacyId, items }),
      });
    },

    /** Single-line order: POST /api/customer/order */
    createSingle: ({ medicine_id, quantity, owner_id }) => apiFetch('/customer/order', {
      method: 'POST',
      body: JSON.stringify({ medicine_id, quantity, owner_id }),
    }),

    /** Staff till: POST /api/pos/order */
    createPos: ({ medicine_id, quantity }) => apiFetch('/pos/order', {
      method: 'POST',
      body: JSON.stringify({ medicine_id, quantity }),
    }),

    /**
     * PATCH /api/orders/:id/status — 'pending' -> 'completed' | 'cancelled'.
     * Pharmacy-side action; cancelling returns the reserved stock to the shelf.
     */
    updateStatus: (orderId, status) => apiFetch(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

    /** No receipt-upload route exists yet; kept local so the flow still completes. */
    uploadReceipt: async (orderId, receiptName) => delay({
      orderId,
      receiptName,
      uploadedAt: new Date().toISOString(),
    }),
  },

  admin: {
    sales: () => apiFetch('/admin/sales'),

    /** No /api/admin/metrics route — composed from the endpoints that do exist. */
    metrics: async () => {
      const [pharmacies, medicines, orders] = await Promise.all([
        apiFetch('/pharmacies').catch(() => []),
        apiFetch('/medicines').catch(() => []),
        apiFetch('/customer/orders').catch(() => []),
      ]);
      return {
        pharmacies: Array.isArray(pharmacies) ? pharmacies.length : 0,
        medicines: Array.isArray(medicines) ? medicines.length : 0,
        orders: Array.isArray(orders) ? orders.length : 0,
        states: mockStates.length,
      };
    },

    /** No audit-log route on the server yet. */
    auditLogs: async () => delay(mockAuditLogs),
  },
};

/* Back-compatible aliases */
api.inventory = api.medicines;

export const AuthAPI = api.auth;
export const PharmacyAPI = api.pharmacies;
export const InventoryAPI = api.medicines;
export const OrdersAPI = api.orders;

export { TOKEN_KEY, USER_KEY };

export default api;
