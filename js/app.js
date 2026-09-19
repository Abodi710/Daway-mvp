const { useState, useEffect } = React;

function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  const handleTokenError = () => {
    window.clearSession();
    setToken(null);
    setUser(null);
    alert("انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول.");
  };

  useEffect(() => {
    const storedToken = window.readToken();
    const storedUser = window.readUser();
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
    }
  }, []);

  const handleAuthenticated = (nextUser, nextToken) => {
    setUser(nextUser);
    setToken(nextToken);
    window.storeSession(nextToken, nextUser);
  };

  const handleLogout = () => {
    window.clearSession();
    setToken(null);
    setUser(null);
  };

  if (!token) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} onTokenError={handleTokenError} />;
}

window.App = App;
ReactDOM.render(<App />, document.getElementById('root'));
