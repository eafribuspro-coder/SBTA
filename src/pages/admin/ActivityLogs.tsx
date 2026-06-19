import { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, Activity } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface LogEntry {
  id: string;
  user_id?: string;
  target_id?: string;
  target_type?: string;
  action: string;
  description?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
  users?: { first_name?: string; last_name?: string; full_name?: string; email: string; role: string };
}

const ACTION_COLORS: Record<string, string> = {
  user_created: '#0B7439',
  user_invited: '#1D6FA4',
  user_role_changed: '#D97706',
  user_suspended: '#AF3029',
  login: '#0B7439',
  logout: '#6B7280',
  password_reset: '#D97706',
};

const getActionColor = (action: string) => ACTION_COLORS[action] || '#6B7280';

export default function ActivityLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*, users(first_name, last_name, full_name, email, role)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des journaux');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getUserName = (log: LogEntry) => {
    if (!log.users) return '—';
    const u = log.users;
    return u.first_name ? `${u.first_name} ${u.last_name}` : u.full_name || u.email;
  };

  const actions = [...new Set(logs.map(l => l.action))];

  const filteredLogs = logs.filter(log => {
    const matchAction = actionFilter === 'all' || log.action === actionFilter;
    const name = getUserName(log);
    const matchSearch = !searchTerm ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    return matchAction && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Journal d'activité
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Historique des actions système — {filteredLogs.length} entrées
          </p>
        </div>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="px-4 py-2 rounded-lg flex items-center gap-2 border disabled:opacity-50"
          style={{ borderColor: 'var(--border)' }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-secondary)' }} />
          Actualiser
        </button>
      </div>

      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--surface)' }}>
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--border)' }}
            >
              <option value="all">Toutes les actions</option>
              {actions.map(a => (
                <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Aucune entrée trouvée</p>
          </div>
        ) : (
          <div className="space-y-0 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            {filteredLogs.map((log, idx) => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="flex items-start gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                style={{
                  borderBottom: idx < filteredLogs.length - 1 ? `1px solid var(--border)` : 'none',
                }}
              >
                <div
                  className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                  style={{ backgroundColor: getActionColor(log.action) }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: `${getActionColor(log.action)}18`,
                          color: getActionColor(log.action),
                        }}
                      >
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {getUserName(log)}
                      </span>
                      {log.users?.role && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          ({log.users.role})
                        </span>
                      )}
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </span>
                  </div>

                  {log.description && (
                    <p className="text-sm mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                      {log.description}
                    </p>
                  )}

                  {log.ip_address && (
                    <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                      IP: {String(log.ip_address)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedLog(null)}>
          <div
            className="rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--surface)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Détails de l'événement</h3>
              <button onClick={() => setSelectedLog(null)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Action', value: selectedLog.action.replace(/_/g, ' ') },
                { label: 'Utilisateur', value: getUserName(selectedLog) },
                { label: 'Rôle', value: selectedLog.users?.role || '—' },
                { label: 'Type de cible', value: selectedLog.target_type || '—' },
                { label: 'Date', value: format(new Date(selectedLog.created_at), "dd MMMM yyyy 'à' HH:mm:ss", { locale: fr }) },
                { label: 'IP', value: selectedLog.ip_address ? String(selectedLog.ip_address) : '—' },
                { label: 'Description', value: selectedLog.description || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}

              {selectedLog.new_values && Object.keys(selectedLog.new_values).length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Nouvelles valeurs</p>
                  <pre className="text-xs p-3 rounded-lg overflow-x-auto" style={{ backgroundColor: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.old_values && Object.keys(selectedLog.old_values).length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Anciennes valeurs</p>
                  <pre className="text-xs p-3 rounded-lg overflow-x-auto" style={{ backgroundColor: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
