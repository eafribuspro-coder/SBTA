import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, Plus, MapPin, Calendar, ChevronDown, ChevronUp, Bus, Image } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BreakdownReport {
  id: string;
  title: string | null;
  breakdown_type: string;
  severity: string;
  description: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  reported_at: string;
  photo_urls: string[];
  buses: {
    registration_number: string;
    brand: string;
    model: string;
  } | null;
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  faible:   { label: 'Faible',    color: '#2563EB', bg: '#EFF6FF' },
  moyenne:  { label: 'Moyenne',   color: '#D97706', bg: '#FEF3C7' },
  critique: { label: 'Critique',  color: '#DC2626', bg: '#FEF2F2' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  signale:      { label: 'Signalé',         color: '#DC2626', bg: '#FEF2F2',  dot: '#DC2626' },
  recu_garage:  { label: 'Reçu au garage',  color: '#D97706', bg: '#FEF3C7',  dot: '#D97706' },
  en_diagnostic:{ label: 'En diagnostic',   color: '#2563EB', bg: '#EFF6FF',  dot: '#2563EB' },
  resolu:       { label: 'Résolu',          color: '#059669', bg: '#ECFDF5',  dot: '#059669' },
};

const TYPE_LABELS: Record<string, string> = {
  mecanique:  'Mécanique',
  electrique: 'Électrique',
  pneumatique:'Pneumatique',
  carrosserie:'Carrosserie',
  autres:     'Autre',
};

export default function MyBreakdowns() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<BreakdownReport[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) loadReports();
  }, [user]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('breakdown_reports')
        .select(`
          id,
          title,
          breakdown_type,
          severity,
          description,
          location,
          latitude,
          longitude,
          status,
          reported_at,
          photo_urls,
          buses:bus_id (registration_number, brand, model)
        `)
        .eq('driver_id', user?.id)
        .order('reported_at', { ascending: false });

      if (error) throw error;
      setReports((data as unknown as BreakdownReport[]) || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des signalements');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="p-8 text-center py-20">
        <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
             style={{ borderColor: 'var(--danger)', borderTopColor: 'transparent' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Chargement de vos signalements...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Mes signalements de pannes
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {reports.length} signalement{reports.length !== 1 ? 's' : ''} au total
            </p>
          </div>
          <button
            onClick={() => navigate('/chauffeur/breakdown')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: 'var(--danger)' }}
          >
            <Plus className="w-4 h-4" />
            Nouveau
          </button>
        </div>

        {/* Empty state */}
        {reports.length === 0 && (
          <div className="bg-white rounded-2xl border p-12 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                 style={{ backgroundColor: 'var(--danger-light)' }}>
              <AlertTriangle className="w-8 h-8" style={{ color: 'var(--danger)' }} />
            </div>
            <h3 className="font-bold text-lg mb-2">Aucun signalement</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Vous n'avez encore signalé aucune panne.
            </p>
            <button
              onClick={() => navigate('/chauffeur/breakdown')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold"
              style={{ backgroundColor: 'var(--danger)' }}
            >
              <Plus className="w-4 h-4" />
              Signaler une panne
            </button>
          </div>
        )}

        {/* List */}
        <div className="space-y-3">
          {reports.map((report) => {
            const severity = SEVERITY_CONFIG[report.severity] || { label: report.severity, color: '#6B7280', bg: '#F9FAFB' };
            const status = STATUS_CONFIG[report.status] || { label: report.status, color: '#6B7280', bg: '#F9FAFB', dot: '#6B7280' };
            const isExpanded = expandedId === report.id;

            return (
              <div key={report.id}
                   className="bg-white rounded-2xl border overflow-hidden transition-shadow hover:shadow-sm"
                   style={{ borderColor: 'var(--border)' }}>

                {/* Card header — always visible */}
                <button
                  type="button"
                  onClick={() => toggleExpand(report.id)}
                  className="w-full text-left p-5"
                >
                  <div className="flex items-start gap-4">

                    {/* Severity indicator */}
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                         style={{ backgroundColor: severity.bg }}>
                      <AlertTriangle className="w-5 h-5" style={{ color: severity.color }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                          {report.title || TYPE_LABELS[report.breakdown_type] || report.breakdown_type}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                              style={{ backgroundColor: severity.bg, color: severity.color }}>
                          {severity.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Status badge with dot */}
                        <span className="flex items-center gap-1.5 text-xs font-medium"
                              style={{ color: status.color }}>
                          <span className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: status.dot }} />
                          {status.label}
                        </span>

                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>•</span>

                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <Calendar className="w-3 h-3" />
                          {format(new Date(report.reported_at), 'dd MMM yyyy, HH:mm', { locale: fr })}
                        </span>

                        {report.buses && (
                          <>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>•</span>
                            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                              <Bus className="w-3 h-3" />
                              {report.buses.registration_number}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>
                      {isExpanded
                        ? <ChevronUp className="w-5 h-5" />
                        : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="pt-4 space-y-4">

                      {/* Type + Bus */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-1"
                             style={{ color: 'var(--text-muted)' }}>Type de panne</p>
                          <p className="font-medium text-sm">
                            {TYPE_LABELS[report.breakdown_type] || report.breakdown_type}
                          </p>
                        </div>
                        {report.buses && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-1"
                               style={{ color: 'var(--text-muted)' }}>Bus</p>
                            <p className="font-medium text-sm">
                              {report.buses.registration_number}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {report.buses.brand} {report.buses.model}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1"
                           style={{ color: 'var(--text-muted)' }}>Description</p>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {report.description}
                        </p>
                      </div>

                      {/* Location */}
                      {report.location && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-1"
                             style={{ color: 'var(--text-muted)' }}>Localisation</p>
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              {report.location}
                            </p>
                          </div>
                          {report.latitude && report.longitude && (
                            <p className="text-xs mt-1 pl-5" style={{ color: 'var(--text-muted)' }}>
                              GPS: {Number(report.latitude).toFixed(6)}, {Number(report.longitude).toFixed(6)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Photos */}
                      {report.photo_urls && report.photo_urls.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5"
                             style={{ color: 'var(--text-muted)' }}>
                            <Image className="w-3.5 h-3.5" />
                            Photos ({report.photo_urls.length})
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {report.photo_urls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={url}
                                  alt={`Photo ${i + 1}`}
                                  className="w-full h-24 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Status timeline indicator */}
                      <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-3"
                           style={{ color: 'var(--text-muted)' }}>Suivi du dossier</p>
                        <div className="flex items-center gap-0">
                          {(['signale', 'recu_garage', 'en_diagnostic', 'resolu'] as const).map((step, idx, arr) => {
                            const stepCfg = STATUS_CONFIG[step];
                            const statusOrder = ['signale', 'recu_garage', 'en_diagnostic', 'resolu'];
                            const currentIdx = statusOrder.indexOf(report.status);
                            const stepIdx = statusOrder.indexOf(step);
                            const isActive = stepIdx === currentIdx;
                            const isDone = stepIdx < currentIdx;
                            const color = isDone || isActive ? stepCfg.dot : '#D1D5DB';

                            return (
                              <React.Fragment key={step}>
                                <div className="flex flex-col items-center" style={{ minWidth: 0, flex: '0 0 auto' }}>
                                  <div
                                    className="w-3 h-3 rounded-full border-2 flex-shrink-0"
                                    style={{
                                      backgroundColor: isDone || isActive ? color : 'white',
                                      borderColor: color,
                                    }}
                                  />
                                  <p className="text-xs mt-1 text-center leading-tight"
                                     style={{
                                       color: isActive ? stepCfg.color : isDone ? '#6B7280' : '#D1D5DB',
                                       fontWeight: isActive ? 700 : 400,
                                       maxWidth: '56px',
                                       fontSize: '10px',
                                     }}>
                                    {stepCfg.label}
                                  </p>
                                </div>
                                {idx < arr.length - 1 && (
                                  <div className="flex-1 h-0.5 mb-5 mx-1"
                                       style={{ backgroundColor: stepIdx < currentIdx ? '#9CA3AF' : '#E5E7EB', minWidth: '12px' }} />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
