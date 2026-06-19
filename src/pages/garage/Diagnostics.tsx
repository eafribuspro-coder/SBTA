import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { ClipboardList, RefreshCw, Search, Filter, ChevronRight, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Diagnostic {
  id: string;
  diagnosis_summary: string;
  estimated_cost: number | null;
  estimated_duration_hours: number | null;
  spare_parts_needed: any | null;
  status: string;
  priority: string | null;
  diagnosed_at: string;
  breakdown_report: {
    id: string;
    title: string | null;
    severity: string;
    status: string;
    bus: {
      registration_number: string;
      manufacturer: string | null;
      model: string | null;
    } | null;
  } | null;
  diagnosed_by_user: { full_name: string | null } | null;
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  faible:   { label: 'Faible',   color: '#22C55E' },
  moyenne:  { label: 'Moyenne',  color: '#F59E0B' },
  critique: { label: 'Critique', color: '#EF4444' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  faible:  { label: 'Faible',   color: '#6B7280' },
  moyenne: { label: 'Moyenne',  color: '#3B82F6' },
  haute:   { label: 'Haute',    color: '#F59E0B' },
  urgente: { label: 'Urgente',  color: '#EF4444' },
};

export default function GarageDiagnostics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'en_cours' | 'termine' | 'attente_pieces'>('all');

  useEffect(() => { loadDiagnostics(); }, []);

  const loadDiagnostics = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('maintenance_diagnostics')
        .select(`
          id, diagnosis_summary, estimated_cost, estimated_duration_hours,
          spare_parts_needed, status, priority, diagnosed_at,
          breakdown_report:breakdown_report_id(
            id, title, severity, status,
            bus:bus_id(registration_number, manufacturer, model)
          ),
          diagnosed_by_user:diagnosed_by(full_name)
        `)
        .order('diagnosed_at', { ascending: false });

      if (error) throw error;
      setDiagnostics((data as any) || []);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = diagnostics.filter(d => {
    const bus = d.breakdown_report?.bus;
    const title = d.breakdown_report?.title || '';
    const matchSearch =
      !search ||
      title.toLowerCase().includes(search.toLowerCase()) ||
      bus?.registration_number?.toLowerCase().includes(search.toLowerCase()) ||
      d.diagnosis_summary?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Diagnostics</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {diagnostics.length} diagnostic{diagnostics.length !== 1 ? 's' : ''} enregistré{diagnostics.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={loadDiagnostics}
                className="px-4 py-2 rounded-lg border flex items-center gap-2 text-sm font-medium"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="rounded-xl border mb-6 p-4 flex flex-col md:flex-row gap-3"
           style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Rechercher par titre, immatriculation, notes..."
                 value={search} onChange={e => setSearch(e.target.value)}
                 className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm"
                 style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }} />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <select value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
            <option value="all">Tous</option>
            <option value="en_cours">En cours</option>
            <option value="attente_pieces">Attente pièces</option>
            <option value="termine">Terminé</option>
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
          <ClipboardList className="w-14 h-14 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Aucun diagnostic</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {search || statusFilter !== 'all' ? 'Aucun résultat pour ces filtres' : 'Les diagnostics apparaîtront ici'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(diagnostic => {
            const severity = SEVERITY_CONFIG[diagnostic.breakdown_report?.severity || ''] || { label: '-', color: '#6B7280' };
            const priority = PRIORITY_CONFIG[diagnostic.priority || ''];
            const bus = diagnostic.breakdown_report?.bus;
            return (
              <div key={diagnostic.id}
                   className="rounded-xl border p-5 hover:shadow-sm transition-shadow"
                   style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                         style={{ backgroundColor: 'var(--primary-light)' }}>
                      <ClipboardList className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {diagnostic.breakdown_report?.title || 'Diagnostic'}
                        </h3>
                        {diagnostic.breakdown_report?.severity && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ backgroundColor: severity.color + '20', color: severity.color }}>
                            {severity.label}
                          </span>
                        )}
                        {priority && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ backgroundColor: priority.color + '20', color: priority.color }}>
                            {priority.label}
                          </span>
                        )}
                      </div>
                      {bus && (
                        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                          {bus.registration_number}{' '}
                          {[bus.manufacturer, bus.model].filter(Boolean).join(' ')}
                        </p>
                      )}
                      {diagnostic.diagnosis_summary && (
                        <p className="text-sm mb-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                          {diagnostic.diagnosis_summary}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {diagnostic.diagnosed_by_user?.full_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {diagnostic.diagnosed_by_user.full_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(diagnostic.diagnosed_at), 'dd/MM/yyyy HH:mm')}
                        </span>
                        {diagnostic.estimated_cost != null && (
                          <span>Coût estimé: {Number(diagnostic.estimated_cost).toLocaleString()} FCFA</span>
                        )}
                        {diagnostic.estimated_duration_hours != null && (
                          <span>{diagnostic.estimated_duration_hours}h estimées</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {diagnostic.breakdown_report?.id && (
                    <button
                      onClick={() => navigate(`/garage/breakdowns/${diagnostic.breakdown_report!.id}/receive`)}
                      className="px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-1.5 flex-shrink-0"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                      Détails <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
