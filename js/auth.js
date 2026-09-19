const { useState } = React;

function PharmacyRegister({ onSwitch }) {
  const [pharmacyName, setPharmacyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleReg = async (e) => {
    e.preventDefault();
    await apiFetch('/pharmacy/register', {
      method: 'POST',
      body: JSON.stringify({
        pharmacy_name: pharmacyName,
        owner_name: ownerName,
        phone,
        email,
        password,
      }),
    });
    alert("تم رفع طلب تسجيل صيدليتك بنجاح إلى إدارة المنصة. يرجى انتظار المراجعة والموافقة التفعيلية.");
    onSwitch();
  };

  return (
    <form onSubmit={handleReg} className="space-y-3">
      <h3 className="text-base font-bold text-slate-700 text-center">طلب انضمام صيدلية جديدة للمنصة</h3>
      <div>
        <label className="block text-xs text-slate-500 mb-1">اسم الصيدلية التجاري</label>
        <input type="text" required value={pharmacyName} onChange={e => setPharmacyName(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">اسم المستثمر/المالك بالكامل</label>
        <input type="text" required value={ownerName} onChange={e => setOwnerName(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">رقم هاتف الصيدلية أو المالك</label>
        <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="+966" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">البريد الإلكتروني</label>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">كلمة المرور</label>
        <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
      </div>
      <button type="submit" className="w-full bg-emerald-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition shadow-xs mt-2">إرسال طلب التسجيل</button>
      <p className="text-xs text-center text-slate-400 mt-2">هل لديك حساب صيدلية مفعل بالفعل؟ <span onClick={onSwitch} className="text-emerald-600 underline cursor-pointer">سجل دخولك هنا</span></p>
    </form>
  );
}

function CustomerRegister({ onSwitch }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    const data = await apiFetch('/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role: 'customer' }),
    });
    window.storeSession(data.token, data.user);
    alert("تم إنشاء حسابك كعميل بنجاح! يمكنك الآن تسجيل الدخول.");
    onSwitch();
  };

  return (
    <form onSubmit={handleRegister} className="space-y-3">
      <h3 className="text-base font-bold text-slate-700 text-center">إنشاء حساب عميل (للبحث والطلب)</h3>
      <div>
        <label className="block text-xs text-slate-500 mb-1">اسمك الكريم بالكامل</label>
        <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">البريد الإلكتروني</label>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">كلمة المرور</label>
        <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="••••••••" />
      </div>
      <button type="submit" className="w-full bg-emerald-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition shadow-xs mt-2">إنشاء حسابي</button>
      <p className="text-xs text-center text-slate-400 mt-2">لديك حساب عميل سابق؟ <span onClick={onSwitch} className="text-emerald-600 underline cursor-pointer">اضغط للدخول</span></p>
    </form>
  );
}

function AuthScreen({ onAuthenticated }) {
  const [view, setView] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const data = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      window.storeSession(data.token, data.user);
      onAuthenticated(data.user, data.token);
    } catch (error) {
      alert(error.message || 'البريد أو كلمة المرور غير صحيحة');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-black text-emerald-600">دواي</h1>
          <p className="text-xs text-slate-400 font-medium">المنصة الشاملة السحابية لإدارة الصيدليات الطبية الذكية</p>
        </div>

        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">البريد الإلكتروني التجريبي</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="admin@daway.com أو staff@pharmacy.com" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">كلمة المرور</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="••••••••" />
            </div>
            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-sm mt-2">تسجيل الدخول الآمن</button>
            <div className="border-t border-slate-100 pt-4 flex flex-col gap-2 text-center text-xs">
              <p className="text-slate-400">ليس لديك حساب منشأة؟ <span onClick={() => setView('reg_pharmacy')} className="text-emerald-600 underline font-semibold cursor-pointer">سجل صيدليتك الآن</span></p>
              <p className="text-slate-400">تبحث عن دواء معين؟ <span onClick={() => setView('reg_customer')} className="text-emerald-600 underline font-semibold cursor-pointer">أنشئ حساب عميل</span></p>
            </div>
          </form>
        )}

        {view === 'reg_pharmacy' && <PharmacyRegister onSwitch={() => setView('login')} />}
        {view === 'reg_customer' && <CustomerRegister onSwitch={() => setView('login')} />}
      </div>
    </div>
  );
}

window.PharmacyRegister = PharmacyRegister;
window.CustomerRegister = CustomerRegister;
window.AuthScreen = AuthScreen;
