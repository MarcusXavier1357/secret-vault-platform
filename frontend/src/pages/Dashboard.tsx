import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { 
  LogOut, Shield, AlertCircle, Plus, Eye, Trash2, 
  RefreshCw, X, History, FileText, Lock, Terminal
} from 'lucide-react';

interface DashboardProps {
  username: string;
  onLogout: () => void;
}

interface SecretItem {
  id: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  version: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function Dashboard({ username, onLogout }: DashboardProps) {
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVersionsModal, setShowVersionsModal] = useState(false);

  // Selected item state
  const [selectedSecretId, setSelectedSecretId] = useState<string | null>(null);
  const [decryptedValue, setDecryptedValue] = useState<string | null>(null);
  const [viewSecretName, setViewSecretName] = useState('');
  const [viewSecretVersion, setViewSecretVersion] = useState<number>(1);

  // Forms state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newExpires, setNewExpires] = useState('');

  const [editDesc, setEditDesc] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editExpires, setEditExpires] = useState('');

  // Audit Logs & Versions (Stub for now, fully functional in Phase 5 & 6)
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [secretVersions, setSecretVersions] = useState<any[]>([]);

  // Fetch all secrets
  const fetchSecrets = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/secrets');
      setSecrets(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar segredos.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await apiFetch('/api/audit-logs');
      setAuditLogs(data);
    } catch (err: any) {
      console.error('Erro ao carregar logs de auditoria:', err);
    }
  };

  useEffect(() => {
    fetchSecrets();
    fetchAuditLogs();
  }, []);

  // Create handler
  const handleCreateSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        name: newName,
        description: newDesc,
        value: newValue,
        expires_at: newExpires ? new Date(newExpires).toISOString() : null
      };

      await apiFetch('/api/secrets', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Clear form
      setNewName('');
      setNewDesc('');
      setNewValue('');
      setNewExpires('');
      setShowCreateModal(false);
      
      // Refresh list
      fetchSecrets();
      fetchAuditLogs();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar segredo.');
    }
  };

  // View handler
  const handleViewSecret = async (secret: SecretItem) => {
    setError('');
    setViewSecretName(secret.name);
    setViewSecretVersion(secret.version);
    setDecryptedValue(null);
    setShowViewModal(true);
    try {
      const data = await apiFetch(`/api/secrets/${secret.id}`);
      setDecryptedValue(data.value || 'N/A (Expirado ou revogado)');
      fetchAuditLogs();
    } catch (err: any) {
      setError(err.message || 'Erro ao descriptografar segredo.');
    }
  };

  // Edit handler
  const handleOpenEdit = (secret: SecretItem) => {
    setSelectedSecretId(secret.id);
    setEditDesc(secret.description);
    setEditValue('');
    setEditExpires(secret.expires_at ? secret.expires_at.slice(0, 16) : '');
    setShowEditModal(true);
  };

  const handleUpdateSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSecretId) return;
    setError('');
    try {
      const payload = {
        description: editDesc,
        value: editValue,
        expires_at: editExpires ? new Date(editExpires).toISOString() : null
      };

      await apiFetch(`/api/secrets/${selectedSecretId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      // Clear form
      setEditDesc('');
      setEditValue('');
      setEditExpires('');
      setSelectedSecretId(null);
      setShowEditModal(false);

      // Refresh list
      fetchSecrets();
      fetchAuditLogs();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar segredo.');
    }
  };

  // Revoke handler
  const handleRevokeSecret = async (id: string) => {
    if (!confirm('Deseja revogar permanentemente este segredo?')) return;
    setError('');
    try {
      await apiFetch(`/api/secrets/${id}/revoke`, { method: 'POST' });
      fetchSecrets();
      fetchAuditLogs();
    } catch (err: any) {
      setError(err.message || 'Erro ao revogar segredo.');
    }
  };

  // Version List handler
  const handleOpenVersions = async (secret: SecretItem) => {
    setSelectedSecretId(secret.id);
    setViewSecretName(secret.name);
    setSecretVersions([]);
    setShowVersionsModal(true);
    try {
      const data = await apiFetch(`/api/secrets/${secret.id}/versions`);
      setSecretVersions(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao listar versões.');
    }
  };

  // Rollback handler
  const handleRollback = async (version: number) => {
    if (!selectedSecretId) return;
    if (!confirm(`Deseja restaurar para a versão v${version}?`)) return;
    setError('');
    try {
      await apiFetch(`/api/secrets/${selectedSecretId}/versions/${version}/rollback`, {
        method: 'POST'
      });
      setShowVersionsModal(false);
      fetchSecrets();
      fetchAuditLogs();
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar rollback.');
    }
  };

  // Metrics calculation
  const totalSecrets = secrets.length;
  const activeSecrets = secrets.filter(s => s.status === 'ACTIVE').length;
  const revokedSecrets = secrets.filter(s => s.status === 'REVOKED').length;
  const expiredSecrets = secrets.filter(s => s.status === 'EXPIRED').length;

  return (
    <div className="h-screen bg-[#030305] text-[#e2e8f0] font-cyber-sans flex flex-col antialiased crt-screen overflow-hidden">
      {/* Dynamic top static accents */}
      <div className="h-1 bg-amber-500 w-full" />
      
      {/* Top Header */}
      <header className="border-b-2 border-slate-900 bg-[#07070a]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/5 p-2 border border-amber-500/30">
              <Shield className="w-5 h-5 text-amber-500 text-glow-amber" />
            </div>
            <div>
              <span className="font-bold text-base tracking-widest font-cyber-mono text-glow-amber uppercase text-white">
                SECRET VAULT
              </span>
              <span className="text-[10px] text-slate-500 font-cyber-mono ml-2 hidden md:inline">
                // CONEXAO_SEGURA: SIM
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-xs font-cyber-mono uppercase tracking-wider hidden sm:inline">
              operador: <strong className="text-white text-glow-amber">{username}</strong>
            </span>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/30 bg-red-500/5 hover:bg-red-500 hover:text-slate-950 text-red-400 font-cyber-mono text-xs uppercase tracking-widest transition duration-150 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Desconectar
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-4 min-h-0 overflow-hidden">
        
        {/* Error notification */}
        {error && (
          <div className="bg-red-500/5 border-2 border-red-500/30 text-red-400 p-4 flex items-start justify-between gap-2 text-xs font-cyber-mono uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>[SYSTEM_ALERT] {error}</span>
            </div>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Dashboard Metrics (Brutalist high-contrast boxes) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#09090f] border-2 border-slate-900 p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex flex-col justify-between relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-700" />
            <span className="text-[10px] text-slate-500 font-cyber-mono uppercase tracking-widest">// total_de_segredos</span>
            <span className="text-3xl font-extrabold text-white mt-2 font-cyber-mono">{(totalSecrets.toString()).padStart(3, '0')}</span>
          </div>
          <div className="bg-[#09090f] border-2 border-slate-900 p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex flex-col justify-between relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-emerald-500/50" />
            <span className="text-[10px] text-emerald-500 font-cyber-mono uppercase tracking-widest">// status_ativo</span>
            <span className="text-3xl font-extrabold text-emerald-400 mt-2 font-cyber-mono text-glow-green">{(activeSecrets.toString()).padStart(3, '0')}</span>
          </div>
          <div className="bg-[#09090f] border-2 border-slate-900 p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex flex-col justify-between relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-red-500/50" />
            <span className="text-[10px] text-red-500 font-cyber-mono uppercase tracking-widest">// status_revogado</span>
            <span className="text-3xl font-extrabold text-red-400 mt-2 font-cyber-mono">{(revokedSecrets.toString()).padStart(3, '0')}</span>
          </div>
          <div className="bg-[#09090f] border-2 border-slate-900 p-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex flex-col justify-between relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500/50" />
            <span className="text-[10px] text-amber-500 font-cyber-mono uppercase tracking-widest">// status_expirado</span>
            <span className="text-3xl font-extrabold text-amber-400 mt-2 font-cyber-mono text-glow-amber">{(expiredSecrets.toString()).padStart(3, '0')}</span>
          </div>
        </section>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Secrets List Table (2/3 width) */}
          <div className="lg:col-span-2 bg-[#09090f] border-2 border-slate-900 shadow-2xl flex flex-col relative min-h-0">
            {/* Corner accents */}
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-700" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-700" />

            <div className="p-5 border-b border-slate-900 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold font-cyber-mono text-white tracking-widest uppercase">// cofre_segredos</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Acesso autorizado apenas. A descriptografia ocorre sob demanda.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/40 hover:bg-amber-500 hover:text-slate-950 text-amber-400 px-3 py-1.5 font-cyber-mono text-xs uppercase tracking-widest transition duration-150 ease-in-out cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.05)]"
              >
                <Plus className="w-3.5 h-3.5" />
                adicionar_segredo
              </button>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs font-cyber-mono uppercase tracking-widest flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                Consultando banco de dados...
              </div>
            ) : secrets.length === 0 ? (
              <div className="p-16 text-center text-slate-600 text-xs font-cyber-mono uppercase tracking-widest flex flex-col items-center gap-3">
                <Lock className="w-8 h-8 text-slate-800 animate-pulse" />
                <span>O cofre de segredos está vazio. Nenhum registro ativo.</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-0">
                <table className="min-w-full divide-y-2 divide-slate-950 text-left text-xs font-cyber-mono">
                  <thead className="bg-[#040407] text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-bold">// identificador</th>
                      <th className="px-6 py-4 font-bold">// status</th>
                      <th className="px-6 py-4 font-bold">// versão</th>
                      <th className="px-6 py-4 font-bold">// expiração</th>
                      <th className="px-6 py-4 text-right font-bold">// ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 bg-[#09090f]">
                    {secrets.map((secret) => (
                      <tr key={secret.id} className="hover:bg-[#040407]/45 transition duration-100">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white tracking-wide">{secret.name}</div>
                          {secret.description && (
                            <div className="text-[10px] text-slate-500 mt-1 lowercase line-clamp-1">{secret.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-none text-[10px] font-bold uppercase ${
                            secret.status === 'ACTIVE' ? 'bg-emerald-500/5 text-emerald-400 border border-emerald-500/20 text-glow-green' :
                            secret.status === 'REVOKED' ? 'bg-red-500/5 text-red-400 border border-red-500/20' :
                            'bg-amber-500/5 text-amber-400 border border-amber-500/20 text-glow-amber'
                          }`}>
                            {secret.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300">v{secret.version}</td>
                        <td className="px-6 py-4 text-slate-400">
                          {secret.expires_at ? new Date(secret.expires_at).toLocaleDateString() : 'sem_expiracao'}
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                          <button
                            onClick={() => handleViewSecret(secret)}
                            title="Descriptografar e Visualizar"
                            className="p-1.5 border border-slate-800 bg-[#020204] text-slate-400 hover:border-emerald-500 hover:text-emerald-400 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenVersions(secret)}
                            title="Histórico e Reversão"
                            className="p-1.5 border border-slate-800 bg-[#020204] text-slate-400 hover:border-amber-500 hover:text-amber-400 transition cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          
                          {secret.status === 'ACTIVE' && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(secret)}
                                title="Atualizar Segredo"
                                className="p-1.5 border border-slate-800 bg-[#020204] text-slate-400 hover:border-amber-500 hover:text-amber-400 transition cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRevokeSecret(secret.id)}
                                title="Revogar Registro"
                                className="p-1.5 border border-slate-800 bg-[#020204] text-slate-450 hover:border-red-500 hover:text-red-400 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Live Audit Logs Panel (1/3 width) */}
          <div className="bg-[#09090f] border-2 border-slate-900 p-5 shadow-2xl flex flex-col gap-4 relative min-h-0">
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-700" />
            
            <div>
              <h3 className="text-sm font-bold font-cyber-mono text-white flex items-center gap-1.5 uppercase tracking-wider">
                <FileText className="w-4 h-4 text-amber-500" />
                // trilha_de_auditoria
              </h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
                Rastreamento de logs de segurança em tempo real
              </p>
            </div>
            
            <div className="border-t border-slate-900 pt-4 flex-1 overflow-y-auto pr-1">
              {auditLogs.length === 0 ? (
                <div className="text-[10px] font-cyber-mono text-slate-650 text-center py-6">// sem logs registrados</div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => {
                    let textClass = 'text-slate-400';
                    if (log.event_type === 'CREATE_SECRET') textClass = 'text-emerald-400';
                    if (log.event_type === 'READ_SECRET') textClass = 'text-amber-400';
                    if (log.event_type === 'UPDATE_SECRET' || log.event_type === 'RESTORE_VERSION') textClass = 'text-blue-400';
                    if (log.event_type === 'REVOKE_SECRET') textClass = 'text-red-400';

                    const meta = typeof log.metadata === 'string' 
                      ? JSON.parse(log.metadata) 
                      : (log.metadata || {});

                    return (
                      <div key={log.id} className="p-2.5 bg-[#020204] border border-slate-900 flex flex-col gap-1 font-cyber-mono text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className={`font-bold ${textClass}`}>
                            {log.event_type}
                          </span>
                          <span className="text-slate-600">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-white mt-0.5">
                          ID: <span className="text-slate-400 font-semibold">{log.secret_name || 'N/A'}</span>
                        </div>
                        {log.metadata && (
                          <div className="text-slate-500 text-[9px] lowercase">
                            {log.event_type === 'RESTORE_VERSION' && `v${meta.version} restaurada de v${meta.restored_from}`}
                            {log.event_type === 'UPDATE_SECRET' && `criou versão v${meta.version}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal: Novo Segredo */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 font-cyber-mono crt-screen">
          <div className="bg-[#09090f] border-2 border-amber-500/50 max-w-md w-full p-6 shadow-2xl relative">
            {/* Corner Crosshairs */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-amber-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-amber-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-amber-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-amber-500" />

            <button 
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 text-slate-450 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest text-glow-amber">// ADICIONAR_NOVO_SEGREDO</h3>
            
            <form onSubmit={handleCreateSecret} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-amber-500 uppercase tracking-widest">nome_identificador</label>
                <input
                  type="text"
                  required
                  placeholder="EX: JWT_SECRET"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toUpperCase())}
                  className="mt-1.5 block w-full px-3 py-2.5 border border-slate-800 bg-[#020204] text-white focus:outline-none focus:border-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-amber-500 uppercase tracking-widest">descrição</label>
                <textarea
                  placeholder="digite a descrição..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2.5 border border-slate-800 bg-[#020204] text-white focus:outline-none focus:border-amber-500 text-xs h-20 resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-amber-500 uppercase tracking-widest">conteudo_confidencial</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2.5 border border-slate-800 bg-[#020204] text-white focus:outline-none focus:border-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-amber-500 uppercase tracking-widest">data_de_expiracao (opcional)</label>
                <input
                  type="datetime-local"
                  value={newExpires}
                  onChange={(e) => setNewExpires(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2.5 border border-slate-800 bg-[#020204] text-white focus:outline-none focus:border-amber-500 text-xs text-slate-350"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:border-slate-650 hover:text-white transition uppercase text-xs cursor-pointer"
                >
                  cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-amber-500 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 transition uppercase text-xs cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.05)]"
                >
                  salvar_registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Visualizar Segredo */}
      {showViewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 font-cyber-mono crt-screen">
          <div className="bg-[#09090f] border-2 border-emerald-500/50 max-w-md w-full p-6 shadow-2xl relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-emerald-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-emerald-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-emerald-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-emerald-500" />

            <button 
              onClick={() => { setShowViewModal(false); setDecryptedValue(null); }}
              className="absolute right-4 top-4 text-slate-450 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest text-glow-green">// SAIDA_DESCRIPTOGRAFADA</h3>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">identificador</span>
                <div className="text-sm font-bold text-white mt-1">{viewSecretName}</div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">versao_ativa</span>
                <div className="text-xs text-slate-300 mt-1">v{viewSecretVersion}</div>
              </div>

              <div className="border-t border-slate-900 pt-4">
                <span className="text-[10px] text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                  <Terminal className="w-3.5 h-3.5 animate-pulse" />
                  valor_descriptografado
                </span>
                <div className="mt-2 p-3 bg-[#020204] border border-emerald-500/25 text-emerald-400 font-cyber-mono text-sm break-all select-all text-glow-green shadow-[0_0_12px_rgba(34,197,94,0.05)]">
                  {decryptedValue === null ? (
                    <span className="text-slate-650 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      executando descriptografia RSA-OAEP...
                    </span>
                  ) : (
                    decryptedValue
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => { setShowViewModal(false); setDecryptedValue(null); }}
                  className="px-4 py-2 border border-emerald-500 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 transition uppercase text-xs cursor-pointer shadow-[0_0_10px_rgba(34,197,94,0.05)]"
                >
                  fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Segredo */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 font-cyber-mono crt-screen">
          <div className="bg-[#09090f] border-2 border-amber-500/50 max-w-md w-full p-6 shadow-2xl relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-amber-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-amber-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-amber-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-amber-500" />

            <button 
              onClick={() => setShowEditModal(false)}
              className="absolute right-4 top-4 text-slate-455 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest text-glow-amber">// ATUALIZAR_VERSAO_DO_SEGREDO</h3>
            
            <form onSubmit={handleUpdateSecret} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-amber-500 uppercase tracking-widest">descrição</label>
                <textarea
                  placeholder="digite a descrição..."
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2.5 border border-slate-800 bg-[#020204] text-white focus:outline-none focus:border-amber-500 text-xs h-20 resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-amber-500 uppercase tracking-widest">novo_conteudo_confidencial</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2.5 border border-slate-800 bg-[#020204] text-white focus:outline-none focus:border-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-amber-500 uppercase tracking-widest">data_de_expiracao (opcional)</label>
                <input
                  type="datetime-local"
                  value={editExpires}
                  onChange={(e) => setEditExpires(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2.5 border border-slate-800 bg-[#020204] text-white focus:outline-none focus:border-amber-500 text-xs text-slate-355"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:border-slate-650 hover:text-white transition uppercase text-xs cursor-pointer"
                >
                  cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-amber-500 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 transition uppercase text-xs cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.05)]"
                >
                  salvar_nova_versao
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Histórico de Versões */}
      {showVersionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 font-cyber-mono crt-screen">
          <div className="bg-[#09090f] border-2 border-amber-500/50 max-w-md w-full p-6 shadow-2xl relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-amber-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-amber-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-amber-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-amber-500" />

            <button 
              onClick={() => setShowVersionsModal(false)}
              className="absolute right-4 top-4 text-slate-450 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-widest text-glow-amber">// CONTROLE_DE_VERSOES_HISTORICAS</h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-6">Selecione uma versão histórica para reverter</p>
            
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 border-t border-slate-900 pt-4">
              {secretVersions.length === 0 ? (
                <div className="text-[10px] text-slate-500 text-center py-6">// consultando banco de dados de versões...</div>
              ) : (
                secretVersions.map((v) => (
                  <div key={v.id} className="p-3 bg-[#020204] border border-slate-900 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-xs">versão: v{v.version}</div>
                      <div className="text-[9px] text-slate-500 lowercase mt-0.5">{new Date(v.created_at).toLocaleString()}</div>
                    </div>
                    <button
                      onClick={() => handleRollback(v.version)}
                      className="px-2.5 py-1 border border-amber-500 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 transition uppercase text-[10px] cursor-pointer"
                    >
                      reverter
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 flex justify-end border-t border-slate-900 mt-4">
              <button
                onClick={() => setShowVersionsModal(false)}
                className="px-4 py-2 border border-slate-800 text-slate-400 hover:border-slate-650 hover:text-white transition uppercase text-xs cursor-pointer"
              >
                fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
