import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { ClipboardCheck, RefreshCw, Search, Filter, Eye, User, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WorkOrder {
  id: string;
  work_order_number: string;
  work_description: string;
  status: string;
  priority: string;
  estimated_cost: number | null;
  actual_cost: number | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  created_at: string;
  completed_at: string | null;
  bus: { registration_number: string; manufacturer: string | null; model: string | null } | null;
  mechanic: { full_name: string | null } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  attente_validation: { label: 'Attente validation', color: '#F59E0B' },
  valide_comptable:   { label: 'Validé comptable',   color: '#3B82F6' },
  en_cours:           { label: 'En cours',            color: '#0EA5E9' },
  en_controle:        { label: 'Contrôle qualité',    color: '#8B5CF6' },
  termine:            { label: 'Terminé',             color: '#22C55E' },
  annule:             { label: 'Annulé',              color: '#6B7280' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  faible:  { label: 'Faible',   color: '#6B7280' },
  moyenne: { label: 'Moyenne',  color: '#3B82F6' },
  haute:   { label: 'Haute',    color: '#F59E0B' },
  urgente: { label: 'Urgente',  color: '#EF4444' },
};

export default function GarageWorkOrders() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  useEffect(() => { loadWorkOrders(); }, []);

  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('maintenance_work_orders')
        .select(`
          id, work_order_number, work_description, status, priority,
          estimated_cost, actual_cost, estimated_hours, actual_hours,
          created_at, completed_at,
          bus:bus_id(registration_number, manufacturer, model),
          mechanic:assigned_to(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkOrders((data as any) || []);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = workOrders.filter(wo => {
    const matchSearch =
      !search ||
      wo.work_order_number?.toLowerCase().includes(search.toLowerCase()) ||
      wo.bus?.registration_number?.toLowerCase().includes(search.toLowerCase()) ||
      wo.work_description?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || wo.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || wo.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const stats = {
    total:          workOrders.length,
    pending:        workOrders.filter(w => w.status === 'attente_validation').length,
    inProgress:     workOrders.filter(w => w.status === 'en_cours').length,
    qualityControl: workOrders.filter(w => w.status === 'en_controle').length,
    completed:      workOrders.filter(w => w.status === 'termine').length,
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Ordres de travail (OT)</h1>
          <p style={{ color: 'var(--text-secondary)' }}>{workOrders.length} OT au total</p>
        </div>
        <button onClick={loadWorkOrders}
                className="px-4 py-2 rounded-lg border flex items-center gap-2 text-sm font-medium"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total',             value: stats.total,          color: 'var(--text-primary)' },
          { label: 'Attente validation', value: stats.pending,        color: '#F59E0B' },
          { label: 'En cours',          value: stats.inProgress,     color: '#0EA5E9' },
          { label: 'Contrôle qualité',  value: stats.qualityControl, color: '#8B5CF6' },
          { label: 'Terminés',          value: stats.completed,      color: '#22C55E' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border p-4"
               style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border mb-6 p-4 flex flex-col md:flex-row gap-3"
           style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Rechercher par numéro, immatriculation, description..."
                 value={search} onChange={e => setSearch(e.target.value)}
                 className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm"
                 style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }} />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
            <option value="all">Toutes priorités</option>
            {Object.entries(PRIORITY_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border py-16 text-center"
             style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
          <ClipboardCheck className="w-14 h-14 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Aucun OT trouvé</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {search || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Aucun résultat pour ces filtres' : 'Les ordres de travail apparaîtront ici'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden"
             style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                {['N° OT', 'Bus', 'Description', 'Priorité', 'Statut', 'Mécanicien', 'Coût estimé', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(wo => {
                const status = STATUS_CONFIG[wo.status] || { label: wo.status, color: '#6B7280' };
                const priority = PRIORITY_CONFIG[wo.priority] || { label: wo.priority, color: '#6B7280' };
                return (
                  <tr key={wo.id} className="hover:bg-gray-50 transition-colors border-b"
                      style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-4">
                      <span className="font-mono text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {wo.work_order_number || wo.id.split('-')[0].toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {wo.bus?.registration_number || '-'}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {[wo.bus?.manufacturer, wo.bus?.model].filter(Boolean).join(' ')}
                      </p>
                    </td>
                    <td className="px-4 py-4 max-w-xs">
                      <p className="text-sm line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                        {wo.work_description || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: priority.color + '20', color: priority.color }}>
                        {priority.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: status.color + '20', color: status.color }}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {wo.mechanic?.full_name ? (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {wo.mechanic.full_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {wo.estimated_cost ? `${Number(wo.estimated_cost).toLocaleString()} FCFA` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {wo.status === 'en_controle' && (
                          <button onClick={() => navigate(`/garage/quality-check/${wo.id}`)}
                                  className="px-3 py-1.5 rounded-lg text-white text-xs font-medium flex items-center gap-1"
                                  style={{ backgroundColor: '#8B5CF6' }}>
                            <AlertCircle className="w-3 h-3" /> Contrôle
                          </button>
                        )}
                        <button onClick={() => navigate(`/garage/quality-check/${wo.id}`)}
                                className="px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                          <Eye className="w-3 h-3" /> Voir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
