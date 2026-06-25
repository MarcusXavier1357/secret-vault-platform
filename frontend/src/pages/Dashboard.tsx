import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { 
  LogOut, Shield, AlertCircle, Plus, Eye, Trash2, 
  RefreshCw, CheckCircle2, AlertTriangle, X, History, FileText, Lock
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

      setShowEditModal(false);
      fetchSecrets();
      fetchAuditLogs();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar segredo.');
    }
  };

  // Revoke handler
  const handleRevokeSecret = async (id: string) => {
    if (!confirm('Deseja realmente revogar este segredo? Esta ação não pode ser desfeita.')) return;
    try {
      await apiFetch(`/api/secrets/${id}/revoke`, { method: 'POST' });
      fetchSecrets();
      fetchAuditLogs();
    } catch (err: any) {
      alert(err.message || 'Erro ao revogar segredo.');
    }
  };

  // Versioning handlers
  const handleOpenVersions = async (secret: SecretItem) => {
    setSelectedSecretId(secret.id);
    setViewSecretName(secret.name);
    setViewSecretVersion(secret.version);
    setSecretVersions([]);
    setShowVersionsModal(true);
    try {
      const data = await apiFetch(`/api/secrets/${secret.id}/versions`);
      setSecretVersions(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar versões.');
    }
  };

  const handleRollback = async (version: number) => {
    if (!selectedSecretId) return;
    if (!confirm(`Deseja restaurar para a versão v${version}? Isso criará uma nova versão no histórico.`)) return;
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased">
      {/* Top Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
              <Shield className="w-6 h-6 text-emerald-500" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Secret Vault
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-xs hidden sm:inline">
              Operador: <strong className="text-white">{username}</strong>
            </span>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-800 rounded-lg hover:bg-slate-900 hover:text-red-400 text-xs transition duration-150 ease-in-out cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        
        {/* Error notification */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start justify-between gap-2 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Dashboard Metrics (Fase 9 layout base) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-medium">Total de Segredos</span>
            <span className="text-2xl font-bold text-white mt-1">{totalSecrets}</span>
          </div>
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <span className="text-xs text-emerald-400 font-medium">Ativos</span>
            <span className="text-2xl font-bold text-emerald-400 mt-1">{activeSecrets}</span>
          </div>
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <span className="text-xs text-red-400 font-medium">Revogados</span>
            <span className="text-2xl font-bold text-red-400 mt-1">{revokedSecrets}</span>
          </div>
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <span className="text-xs text-amber-400 font-medium">Expirados</span>
            <span className="text-2xl font-bold text-amber-400 mt-1">{expiredSecrets}</span>
          </div>
        </section>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Secrets List Table (2/3 width) */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-850 rounded-xl shadow-xl flex flex-col">
            <div className="p-5 border-b border-slate-850 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Cofre de Segredos</h2>
                <p className="text-xs text-slate-400">Gerencie chaves, tokens e variáveis criptografadas</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1 bg-emerald-400 hover:bg-emerald-300 text-slate-950 px-3.5 py-1.8 rounded-lg font-medium text-xs transition duration-150 ease-in-out cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Novo Segredo
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
                Carregando segredos...
              </div>
            ) : secrets.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
                <Lock className="w-8 h-8 text-slate-700" />
                <span>Nenhum segredo armazenado neste Vault.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-850 text-left text-sm">
                  <thead className="bg-slate-950/40 text-slate-400 text-xs font-semibold uppercase">
                    <tr>
                      <th className="px-6 py-3">Identificador (Name)</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Versão</th>
                      <th className="px-6 py-3">Expiração</th>
                      <th className="px-6 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {secrets.map((secret) => (
                      <tr key={secret.id} className="hover:bg-slate-950/40 transition duration-100">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white tracking-wide">{secret.name}</div>
                          {secret.description && (
                            <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{secret.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            secret.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            secret.status === 'REVOKED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {secret.status === 'ACTIVE' && <CheckCircle2 className="w-3 h-3" />}
                            {secret.status === 'REVOKED' && <Trash2 className="w-3 h-3" />}
                            {secret.status === 'EXPIRED' && <AlertTriangle className="w-3 h-3" />}
                            {secret.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300 font-mono">v{secret.version}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs">
                          {secret.expires_at ? new Date(secret.expires_at).toLocaleDateString() : 'Sem expiração'}
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                          <button
                            onClick={() => handleViewSecret(secret)}
                            title="Descriptografar e Visualizar"
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-950 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenVersions(secret)}
                            title="Histórico de Versões"
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-950 rounded-lg transition cursor-pointer"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          
                          {secret.status === 'ACTIVE' && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(secret)}
                                title="Criar Nova Versão"
                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-950 rounded-lg transition cursor-pointer"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRevokeSecret(secret.id)}
                                title="Revogar Segredo"
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-950 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
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
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 shadow-xl flex flex-col gap-4">
            <div>
              <h3 className="text-md font-semibold text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-450" />
                Logs de Auditoria
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Atividades recentes e rastreabilidade de eventos
              </p>
            </div>
            
            <div className="border-t border-slate-850 pt-4 flex-1 overflow-y-auto max-h-[450px] pr-1">
              {auditLogs.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-4">Nenhum evento registrado ainda.</div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => {
                    let badgeColor = 'text-slate-400 bg-slate-950';
                    if (log.event_type === 'CREATE_SECRET') badgeColor = 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
                    if (log.event_type === 'READ_SECRET') badgeColor = 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
                    if (log.event_type === 'UPDATE_SECRET' || log.event_type === 'RESTORE_VERSION') badgeColor = 'text-blue-400 bg-blue-500/10 border border-blue-500/20';
                    if (log.event_type === 'REVOKE_SECRET') badgeColor = 'text-red-400 bg-red-500/10 border border-red-500/20';

                    const meta = typeof log.metadata === 'string' 
                      ? JSON.parse(log.metadata) 
                      : (log.metadata || {});

                    return (
                      <div key={log.id} className="p-3 bg-slate-950/40 border border-slate-850/60 rounded-xl flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${badgeColor}`}>
                            {log.event_type}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-xs text-white font-medium">
                          Segredo: <span className="font-mono text-slate-300">{log.secret_name || 'N/A'}</span>
                        </div>
                        {log.metadata && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            {log.event_type === 'RESTORE_VERSION' && `v${meta.version} ← v${meta.restored_from}`}
                            {log.event_type === 'UPDATE_SECRET' && `Criada versão v${meta.version}`}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-4">Adicionar Novo Segredo</h3>
            
            <form onSubmit={handleCreateSecret} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">Nome Identificador</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: STRIPE_API_KEY"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toUpperCase())}
                  className="mt-1 block w-full px-3 py-2 border border-slate-800 rounded-lg bg-slate-950 text-white focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">Descrição</label>
                <textarea
                  placeholder="Breve descrição sobre a utilidade deste segredo"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-800 rounded-lg bg-slate-950 text-white focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">Valor do Segredo</label>
                <input
                  type="password"
                  required
                  placeholder="Digite o valor confidencial"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-800 rounded-lg bg-slate-950 text-white focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">Data de Expiração (Opcional)</label>
                <input
                  type="datetime-local"
                  value={newExpires}
                  onChange={(e) => setNewExpires(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-800 rounded-lg bg-slate-950 text-white focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-800 rounded-lg text-xs hover:bg-slate-950 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold rounded-lg text-xs transition"
                >
                  Salvar Segredo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Visualizar Segredo */}
      {showViewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowViewModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-2">Descriptografar Segredo</h3>
            <p className="text-xs text-slate-400 mb-4">{viewSecretName} (versão v{viewSecretVersion})</p>
            
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg font-mono text-sm break-all relative">
                {decryptedValue === null ? (
                  <div className="flex items-center justify-center gap-2 text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                    Descriptografando...
                  </div>
                ) : (
                  <div className="text-emerald-400 select-all">{decryptedValue}</div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-lg text-xs transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Atualizar Segredo / Nova Versão */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowEditModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-4">Atualizar Segredo (Criar v + 1)</h3>
            
            <form onSubmit={handleUpdateSecret} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">Descrição</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-800 rounded-lg bg-slate-950 text-white focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">Novo Valor do Segredo</label>
                <input
                  type="password"
                  required
                  placeholder="Digite o novo valor confidencial"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-800 rounded-lg bg-slate-950 text-white focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">Data de Expiração (Opcional)</label>
                <input
                  type="datetime-local"
                  value={editExpires}
                  onChange={(e) => setEditExpires(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-800 rounded-lg bg-slate-950 text-white focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-800 rounded-lg text-xs hover:bg-slate-950 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold rounded-lg text-xs transition"
                >
                  Criar Nova Versão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Histórico de Versões */}
      {showVersionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowVersionsModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-2">Histórico de Versões</h3>
            <p className="text-xs text-slate-400 mb-4">{viewSecretName}</p>
            
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {secretVersions.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-4">Carregando versões...</div>
              ) : (
                <div className="divide-y divide-slate-850">
                  {secretVersions.map((v) => (
                    <div key={v.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white font-mono">
                          Versão v{v.version} {v.version === viewSecretVersion && <span className="text-xs text-emerald-400 font-sans ml-1">(Atual)</span>}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Criado em: {new Date(v.created_at).toLocaleString()}
                        </div>
                      </div>
                      
                      {v.version !== viewSecretVersion && (
                        <button
                          onClick={() => handleRollback(v.version)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-medium rounded-lg text-xs transition cursor-pointer"
                        >
                          Restaurar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-850 flex justify-end">
              <button
                onClick={() => setShowVersionsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-lg text-xs transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
