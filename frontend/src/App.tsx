import { useEffect, useState } from 'react';
import { apiFetch } from './services/api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
    try {
      const data = await apiFetch('/api/auth/session');
      setUser(data.username);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout falhou', err);
    } finally {
      setUser(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
        <span className="text-slate-400 text-sm">Abrindo cofre...</span>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={checkSession} />;
  }

  return <Dashboard username={user} onLogout={handleLogout} />;
}
