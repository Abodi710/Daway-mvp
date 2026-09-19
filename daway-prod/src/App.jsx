import { lazy, Suspense, useMemo, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Bell, Loader2 } from 'lucide-react';
import api, { clearSession, readUser, storeSession } from './api';
import Header from './components/Header';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import ProtectedRoute from './ProtectedRoute.jsx';

/**
 * Route-level code splitting. The landing page and the chrome stay in the entry
 * chunk so the first paint needs no extra round trip; everything else — and in
 * particular the dashboard subtree, which pulls in all five role dashboards and
 * their modals — is fetched on demand.
 */
const AboutUs = lazy(() => import('./pages/AboutUs'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const ProductDetailsPage = lazy(() => import('./pages/ProductDetailsPage'));
const PatientDashboard = lazy(() => import('./pages/PatientDashboard'));
const AuthScreen = lazy(() => import('./AuthScreen.jsx'));
const Dashboard = lazy(() => import('./Dashboard.jsx'));

/**
 * The page components navigate by id (`onNavigate('explore')`) rather than by
 * URL. Mapping the ids here keeps every one of them unchanged while the actual
 * navigation goes through the router.
 */
const PAGE_ROUTES = {
  home: '/',
  services: '/services',
  explore: '/explore',
  about: '/about',
  auth: '/login',
  login: '/login',
  register: '/register',
  'register-pharmacy': '/register?type=pharmacy',
  'product-details': '/product',
  'patient-dashboard': '/cart',
  cart: '/cart',
  dashboard: '/dashboard',
};

/** Reverse map, so Header/Footer keep receiving the `activeLink` id they expect. */
const ROUTE_PAGES = {
  '/': 'home',
  '/services': 'services',
  '/explore': 'explore',
  '/about': 'about',
  '/product': 'product-details',
  '/cart': 'patient-dashboard',
  '/login': 'auth',
  '/register': 'auth',
};

/** Fallback shown while a lazily-loaded route chunk is fetched. */
function RouteLoader({ full = false }) {
  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 ${full ? 'min-h-screen' : 'min-h-[60vh]'}`}
    >
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-hidden="true" />
      <p className="text-sm font-semibold text-slate-500">جارٍ التحميل…</p>
    </div>
  );
}

/** Marketing chrome shared by the public routes. */
function PublicLayout({ user, cartCount, activeLink, onNavigate, onCartClick, onLogin, onLogout }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header
        user={user}
        cartCount={cartCount}
        activeLink={activeLink}
        onNavigate={onNavigate}
        onCartClick={onCartClick}
        onLogin={onLogin}
        onLogout={onLogout}
      />
      {/* Boundary sits inside the layout so the header and footer stay put
          while the next page's chunk arrives. */}
      <Suspense fallback={<RouteLoader />}>
        <Outlet />
      </Suspense>
      <Footer activeLink={activeLink} onNavigate={onNavigate} />
    </div>
  );
}

/** /register — opens the pharmacy or customer panel based on ?type=. */
function RegisterScreen({ onAuthenticated }) {
  const [params] = useSearchParams();
  const initialView = params.get('type') === 'pharmacy' ? 'reg_pharmacy' : 'reg_customer';
  // keyed so switching ?type= remounts with the requested panel
  return <AuthScreen key={initialView} initialView={initialView} onAuthenticated={onAuthenticated} />;
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Read the session during the first render: /dashboard must have a user
  // available immediately, before any effect has had a chance to run.
  const [currentUser, setCurrentUser] = useState(() => readUser());
  const [cartItems, setCartItems] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [notification, setNotification] = useState('');

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const activeLink = ROUTE_PAGES[location.pathname] || '';

  const notify = (message) => {
    setNotification(message);
    window.clearTimeout(window.__dawayNotifyTimer);
    window.__dawayNotifyTimer = window.setTimeout(() => setNotification(''), 3500);
  };

  /** Accepts a legacy page id or a plain path. */
  const goToPage = (page) => {
    navigate(PAGE_ROUTES[page] || (typeof page === 'string' && page.startsWith('/') ? page : '/'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthenticated = (user, token) => {
    // AuthScreen already persisted the session; storeSession is idempotent and
    // returns the role-adapted user, so reuse its result as the source of truth.
    setCurrentUser(storeSession(token, user) || user);
    navigate('/dashboard', { replace: true });
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setCartItems([]);
    notify('تم تسجيل الخروج');
    navigate('/', { replace: true });
  };

  /** A dashboard request came back unauthorised — drop the session and re-auth. */
  const handleTokenError = () => {
    clearSession();
    setCurrentUser(null);
    notify('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى');
    navigate('/login', { replace: true });
  };

  const addToCart = (medicine) => {
    setCartItems((items) => {
      const exists = items.find((item) => item.medicine.id === medicine.id);
      if (exists) {
        return items.map((item) =>
          item.medicine.id === medicine.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...items, { medicine, quantity: 1 }];
    });
    notify(`تمت إضافة ${medicine.name} إلى السلة`);
  };

  const selectProduct = (medicine) => {
    setSelectedProduct(medicine);
    navigate('/product');
  };

  const checkout = async () => {
    if (!cartItems.length) return;
    const totalAmount = cartItems.reduce((sum, item) => sum + item.medicine.price * item.quantity, 0);
    await api.orders.create({
      customerName: currentUser?.name || 'مريض تجريبي',
      items: cartItems.map((item) => ({
        medicineId: item.medicine.id,
        medicineName: item.medicine.name,
        quantity: item.quantity,
        unitPrice: item.medicine.price,
        subtotal: item.quantity * item.medicine.price,
      })),
      totalAmount,
      paymentMethod: 'bankak',
      status: 'pending',
    });
    setCartItems([]);
    notify('تم إنشاء الطلب، يرجى رفع إيصال Bankak من لوحة المريض');
  };

  return (
    <>
      {notification && (
        <div dir="rtl" className="fixed left-4 top-24 z-[60] max-w-sm rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-xl">
          <Bell className="ms-2 inline h-4 w-4 text-emerald-300" />
          {notification}
        </div>
      )}

      <Routes>
        {/* ---------------- Public ---------------- */}
        <Route
          element={
            <PublicLayout
              user={currentUser}
              cartCount={cartCount}
              activeLink={activeLink}
              onNavigate={goToPage}
              onCartClick={() => goToPage('cart')}
              onLogin={() => goToPage('auth')}
              onLogout={handleLogout}
            />
          }
        >
          <Route index element={<LandingPage onNavigate={goToPage} />} />
          <Route path="/services" element={<ServicesPage onNavigate={goToPage} />} />
          <Route path="/explore" element={<ExplorePage onAddToCart={addToCart} onSelectProduct={selectProduct} />} />
          <Route path="/about" element={<AboutUs onNavigate={goToPage} />} />
          <Route path="/cart" element={<PatientDashboard cartItems={cartItems} onCheckout={checkout} notification={notification} />} />
          <Route
            path="/product"
            element={selectedProduct
              ? <ProductDetailsPage product={selectedProduct} onBack={() => goToPage('explore')} onAddToCart={addToCart} />
              : <Navigate to="/explore" replace />}
          />
          <Route path="/login" element={<AuthScreen onAuthenticated={handleAuthenticated} />} />
          <Route path="/register" element={<RegisterScreen onAuthenticated={handleAuthenticated} />} />
        </Route>

        {/* ------- Protected: role-routed dashboards -------
            Rendered without the marketing chrome — each role dashboard draws
            its own banner and logout button. */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              {/* Standalone chrome, so the loader covers the full viewport.
                  readUser() as a fallback: ProtectedRoute has already proven a
                  session exists, so never hand Dashboard a null user. */}
              <Suspense fallback={<RouteLoader full />}>
                <Dashboard user={currentUser || readUser()} onLogout={handleLogout} onTokenError={handleTokenError} />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
