import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle, Eye, RefreshCw, Filter, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface BreakdownReport {
  id: string;
  title: string | null;
  breakdown_type: string;
  severity: string;
  location: string | null;
  photo_urls: string[] | null;
  reported_at: string;
  received_at: string | null;
  status: string;
  bus: { registration_number: string; manufacturer: string | null; model: string | null } | null;
  driver: { full_name: string | null } | null;
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  faible:   { label: 'Faible',   color: '#22C55E' },
  moyenne:  { label: 'Moyenne',  color: '#F59E0B' },
  critique: { label: 'Critique', color: '#EF4444' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  signale:       { label: 'Signalé',        color: '#EF4444' },
  recu_garage:   { label: 'Reçu garage',    color: '#F59E0B' },
  en_diagnostic: { label: 'En diagnostic',  color: '#3B82F6' },
  resolu:        { label: 'Résolu',         color: '#22C55E' },
};

export default function GarageBreakdowns() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [breakdowns, setBreakdowns] = useState<BreakdownReport[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  useEffect(() => { loadBreakdowns(); }, []);

  const loadBreakdowns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('breakdown_reports')
        .select(`
          id, title, breakdown_type, severity, location, photo_urls,
          reported_at, received_at, status,
          bus:bus_id(registration_number, manufacturer, model),
          driver:driver_id(full_name)
        `)
        .order('reported_at', { ascending: false });

      if (error) throw error;
      setBreakdowns((data as any) || []);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = breakdowns.filter(b => {
    const title = b.title || b.breakdown_type || '';
    const matchSearch =
      !search ||
      title.toLowerCase().includes(search.toLowerCase()) ||
      b.bus?.registration_number?.toLowerCase().includes(search.toLowerCase()) ||
      b.location?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchSeverity = severityFilter === 'all' || b.severity === severityFilter;
    return matchSearch && matchStatus && matchSeverity;
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Pannes reçues</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {breakdowns.length} signalement{breakdowns.length !== 1 ? 's' : ''} au total
          </p>
        </div>
        <button onClick={loadBreakdowns}
                className="px-4 py-2 rounded-lg border flex items-center gap-2 text-sm font-medium"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="rounded-xl border mb-6" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Rechercher par titre, immatriculation, lieu..."
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
            <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
              <option value="all">Toutes les sévérités</option>
              {Object.entries(SEVERITY_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
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
          <CheckCircle className="w-14 h-14 mx-auto mb-4" style={{ color: '#22C55E' }} />
          <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Aucun signalement</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {search || statusFilter !== 'all' || severityFilter !== 'all'
              ? 'Aucun résultat pour ces filtres' : 'Tous les bus sont opérationnels'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden"
             style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {filtered.map(breakdown => {
              const severity = SEVERITY_CONFIG[breakdown.severity] || { label: breakdown.severity, color: '#6B7280' };
              const status = STATUS_CONFIG[breakdown.status] || { label: breakdown.status, color: '#6B7280' };
              return (
                <div key={breakdown.id} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                           style={{ backgroundColor: severity.color + '20' }}>
                        <AlertTriangle className="w-5 h-5" style={{ color: severity.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {breakdown.title || breakdown.breakdown_type}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                                style={{ backgroundColor: severity.color + '20', color: severity.color }}>
                            {severity.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                                style={{ backgroundColor: status.color + '20', color: status.color }}>
                            {status.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {breakdown.bus && (
                            <span>
                              <strong style={{ color: 'var(--text-primary)' }}>{breakdown.bus.registration_number}</strong>
                              {(breakdown.bus.manufacturer || breakdown.bus.model) && (
                                <> — {[breakdown.bus.manufacturer, breakdown.bus.model].filter(Boolean).join(' ')}</>
                              )}
                            </span>
                          )}
                          {breakdown.driver?.full_name && <span>{breakdown.driver.full_name}</span>}
                          {breakdown.location && <span>{breakdown.location}</span>}
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          Signalé le {format(new Date(breakdown.reported_at), 'dd/MM/yyyy à HH:mm')}
                          {breakdown.received_at && ` · Reçu le ${format(new Date(breakdown.received_at), 'dd/MM/yyyy')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {breakdown.status === 'signale' && (
                        <button onClick={() => navigate(`/garage/breakdowns/${breakdown.id}/receive`)}
                                className="px-3 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-1.5"
                                style={{ backgroundColor: 'var(--primary)' }}>
                          <CheckCircle className="w-4 h-4" /> Recevoir
                        </button>
                      )}
                      <button onClick={() => navigate(`/garage/breakdowns/${breakdown.id}/receive`)}
                              className="px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-1.5"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                        <Eye className="w-4 h-4" /> Voir
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
