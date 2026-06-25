import React, { useState } from 'react';
import { apiFetch } from '../services/api';
import { Shield, Key, Loader2, AlertTriangle, Terminal } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'ACESSO NEGADO: CREDENCIAIS DE OPERADOR INVÁLIDAS.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030305] flex flex-col justify-center py-12 sm:px-6 lg:px-8 crt-screen font-cyber-sans relative">
      {/* Background static design elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.02)_0%,transparent_70%)] pointer-events-none" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <div className="flex justify-center mb-4">
          <div className="bg-amber-500/5 p-4 border border-amber-500/20 rounded-none shadow-[0_0_15px_rgba(245,158,11,0.05)]">
            <Shield className="w-12 h-12 text-amber-500 animate-pulse text-glow-amber" />
          </div>
        </div>
        
        <h1 className="text-3xl font-extrabold text-white tracking-widest font-cyber-mono text-glow-amber uppercase">
          Secret Vault
        </h1>
        
        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-cyber-mono uppercase tracking-widest text-slate-400">
          <Terminal className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span>Status do sistema: <span className="text-emerald-400 font-bold">Online</span></span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-[#09090f] border-2 border-slate-800 p-6 sm:p-10 shadow-[0_10px_40px_rgba(0,0,0,0.8)] relative">
          {/* Brutalist border accents */}
          <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-amber-500" />
          <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-amber-500" />
          <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-amber-500" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-amber-500" />

          {/* Console Header */}
          <div className="border-b border-slate-800 pb-4 mb-6">
            <div className="text-[10px] font-cyber-mono text-amber-500 uppercase tracking-widest">
              [ PORTAL DE OPERADOR SEGURO v2.4.1 ]
            </div>
            <div className="text-xs font-cyber-mono text-slate-500 mt-1">
              ESTABELECENDO CONEXÃO... CRIPTOGRAFIA ATIVA
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/5 border border-red-500/30 text-red-400 p-3.5 rounded-none flex items-start gap-2.5 text-xs font-cyber-mono uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-xs font-bold font-cyber-mono text-amber-500/80 uppercase tracking-widest">
                // nome_do_operador
              </label>
              <div className="mt-2">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full px-3 py-3 border border-slate-800 bg-[#020204] text-white placeholder-slate-700 font-cyber-mono text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition duration-150"
                  placeholder="digite o usuário..."
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold font-cyber-mono text-amber-500/80 uppercase tracking-widest">
                // senha_de_acesso
              </label>
              <div className="mt-2 relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-3 border border-slate-800 bg-[#020204] text-white placeholder-slate-700 font-cyber-mono text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition duration-150 pr-10"
                  placeholder="••••••••"
                />
                <Key className="w-4 h-4 text-slate-600 absolute right-3 top-3.5" />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-amber-500 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 font-cyber-mono text-sm uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.05)] active:translate-y-0.5"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'INICIAR CONEXÃO DO SISTEMA'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
