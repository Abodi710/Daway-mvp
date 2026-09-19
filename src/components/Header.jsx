import { useState } from 'react';
import {
  ChevronDown,
  Compass,
  Home,
  Info,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Pill,
  ShoppingCart,
  Stethoscope,
  UserCircle,
  X,
} from 'lucide-react';

/** روابط التنقّل الرئيسية */
const NAV_LINKS = [
  { id: 'home', label: 'الرئيسية', icon: Home },
  { id: 'services', label: 'الخدمات', icon: Stethoscope },
  { id: 'explore', label: 'استكشف', icon: Compass },
  { id: 'about', label: 'من نحن', icon: Info },
];

/** تسميات الأدوار بالعربية */
const ROLE_LABELS = {
  patient: 'مريض',
  pharmacy: 'صيدلية',
  supplier: 'مورّد',
  admin: 'مدير النظام',
  // الأدوار المستخدمة في api.js الحالي
  customer: 'عميل',
  pharmacy_owner: 'صاحب صيدلية',
  pharmacy_staff: 'موظف صيدلية',
};

const ROLE_STYLES = {
  admin: 'bg-purple-100 text-purple-700',
  supplier: 'bg-amber-100 text-amber-700',
  pharmacy: 'bg-emerald-100 text-emerald-700',
  pharmacy_owner: 'bg-emerald-100 text-emerald-700',
  pharmacy_staff: 'bg-teal-100 text-teal-700',
  patient: 'bg-sky-100 text-sky-700',
  customer: 'bg-sky-100 text-sky-700',
};

export default function Header({
  user = null,
  cartCount = 0,
  activeLink = 'home',
  onNavigate,
  onCartClick,
  onLogin,
  onLogout,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = user?.name || user?.pharmacy_name || user?.email || '';
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || '';
  const roleStyle = ROLE_STYLES[user?.role] || 'bg-slate-100 text-slate-700';
  const badgeCount = cartCount > 99 ? '99+' : cartCount;

  const handleNavigate = (id) => {
    setMobileOpen(false);
    if (onNavigate) onNavigate(id);
  };

  const handleAuth = () => {
    setMobileOpen(false);
    if (user) {
      if (onLogout) onLogout();
    } else if (onLogin) {
      onLogin();
    }
  };

  return (
    <header dir="rtl" className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* الهوية / Branding */}
          <button
            type="button"
            onClick={() => handleNavigate('home')}
            className="flex items-center gap-2 shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="دواي - الصفحة الرئيسية"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Pill className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-lg font-extrabold text-slate-900">دواي</span>
              <span className="text-[11px] font-semibold tracking-wide text-emerald-600">DAWAY</span>
            </span>
          </button>

          {/* التنقّل - سطح المكتب */}
          <nav className="hidden md:flex items-center gap-1" aria-label="التنقّل الرئيسي">
            {NAV_LINKS.map(({ id, label, icon: Icon }) => {
              const isActive = activeLink === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavigate(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* السلة + حالة المستخدم */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* السلة */}
            <button
              type="button"
              onClick={onCartClick}
              className="relative rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label={`سلة المشتريات، ${cartCount} عنصر`}
            >
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {badgeCount}
                </span>
              )}
            </button>

            {/* لوحة التحكم - سطح المكتب */}
            {user && (
              <button
                type="button"
                onClick={() => handleNavigate('dashboard')}
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                {user.role === 'customer' ? 'طلباتي' : 'لوحة التحكم'}
              </button>
            )}

            {/* حالة الدور الحالي - سطح المكتب */}
            {user && (
              <div className="hidden lg:flex items-center gap-2 rounded-full bg-slate-50 py-1 ps-1 pe-3 ring-1 ring-slate-200">
                <UserCircle className="h-7 w-7 text-slate-400" aria-hidden="true" />
                <span className="flex flex-col leading-tight">
                  <span className="max-w-[9rem] truncate text-xs font-bold text-slate-800">{displayName}</span>
                  {roleLabel && (
                    <span className={`w-fit rounded px-1.5 text-[10px] font-semibold ${roleStyle}`}>
                      {roleLabel}
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* تسجيل الدخول / الخروج */}
            <button
              type="button"
              onClick={handleAuth}
              className={`hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                user
                  ? 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500'
                  : 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500'
              }`}
            >
              {user ? <LogOut className="h-4 w-4" aria-hidden="true" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
              {user ? 'تسجيل الخروج' : 'تسجيل الدخول'}
            </button>

            {/* زر القائمة - الجوال */}
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              className="md:hidden rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* القائمة المنسدلة - الجوال */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pb-4 pt-2">
          {user && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200">
              <UserCircle className="h-8 w-8 text-slate-400" aria-hidden="true" />
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-bold text-slate-800">{displayName}</span>
                {roleLabel && (
                  <span className={`w-fit rounded px-1.5 text-[10px] font-semibold ${roleStyle}`}>{roleLabel}</span>
                )}
              </span>
              <ChevronDown className="ms-auto h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
          )}

          <nav className="flex flex-col gap-1" aria-label="التنقّل للجوال">
            {NAV_LINKS.map(({ id, label, icon: Icon }) => {
              const isActive = activeLink === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavigate(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                    isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </nav>

          {user && (
            <button
              type="button"
              onClick={() => handleNavigate('dashboard')}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              {user.role === 'customer' ? 'طلباتي' : 'لوحة التحكم'}
            </button>
          )}

          <button
            type="button"
            onClick={handleAuth}
            className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-bold text-white shadow-sm transition-colors ${
              user ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {user ? <LogOut className="h-4 w-4" aria-hidden="true" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
            {user ? 'تسجيل الخروج' : 'تسجيل الدخول'}
          </button>
        </div>
      )}
    </header>
  );
}
