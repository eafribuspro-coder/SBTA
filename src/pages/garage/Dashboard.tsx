import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Wrench, AlertTriangle, Clock, CheckCircle, Eye, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface BusStats {
  broken_down: number;
  received: number;
  in_diagnostic: number;
  awaiting_work_order: number;
  in_maintenance: number;
  quality_control: number;
  available: number;
}

interface BreakdownReport {
  id: string;
  title: string | null;
  breakdown_type: string;
  severity: string;
  location: string | null;
  photo_urls: string[] | null;
  reported_at: string;
  status: string;
  bus: { registration_number: string; manufacturer: string | null; model: string | null } | null;
  driver: { full_name: string | null } | null;
}

export default function GarageDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BusStats>({
    broken_down: 0, received: 0, in_diagnostic: 0,
    awaiting_work_order: 0, in_maintenance: 0, quality_control: 0, available: 0
  });
  const [recentBreakdowns, setRecentBreakdowns] = useState<BreakdownReport[]>([]);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const { data: busData, error: busError } = await supabase
        .from('buses').select('status');
      if (busError) throw busError;

      const s: BusStats = { broken_down: 0, received: 0, in_diagnostic: 0, awaiting_work_order: 0, in_maintenance: 0, quality_control: 0, available: 0 };
      (busData || []).forEach(bus => {
        switch (bus.status) {
          case 'panne_route': s.broken_down++; break;
          case 'reception_garage': s.received++; break;
          case 'diagnostic': s.in_diagnostic++; break;
          case 'attente_ot': s.awaiting_work_order++; break;
          case 'maintenance': s.in_maintenance++; break;
          case 'controle_qualite': s.quality_control++; break;
          case 'disponible': s.available++; break;
        }
      });
      setStats(s);

      const { data: breakdownData, error: breakdownError } = await supabase
        .from('breakdown_reports')
        .select(`
          id, title, breakdown_type, severity, location, photo_urls, reported_at, status,
          bus:bus_id(registration_number, manufacturer, model),
          driver:driver_id(full_name)
        `)
        .order('reported_at', { ascending: false })
        .limit(10);

      if (breakdownError) throw breakdownError;
      setRecentBreakdowns((breakdownData as any) || []);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const SEVERITY_LABELS: Record<string, string> = { faible: 'Faible', moyenne: 'Moyenne', critique: 'Critique' };
  const SEVERITY_COLORS: Record<string, string> = { faible: '#3B82F6', moyenne: '#F59E0B', critique: '#EF4444' };
  const STATUS_LABELS: Record<string, string> = { signale: 'Signalé', recu_garage: 'Reçu garage', en_diagnostic: 'En diagnostic', resolu: 'Résolu' };
  const STATUS_COLORS: Record<string, string> = { signale: '#EF4444', recu_garage: '#F59E0B', en_diagnostic: '#3B82F6', resolu: '#22C55E' };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Garage — Tableau de bord
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Vue d'ensemble temps réel</p>
        </div>
        <button onClick={loadDashboard} className="px-4 py-2 rounded-lg border flex items-center gap-2 text-sm font-medium"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border mb-8" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <Wrench className="w-6 h-6" style={{ color: 'var(--primary)' }} />
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>État du parc</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {[
                  { label: 'En panne route',    value: stats.broken_down,        color: '#DC2626' },
                  { label: 'Réception garage',  value: stats.received,           color: '#F59E0B' },
                  { label: 'En diagnostic',     value: stats.in_diagnostic,      color: '#EAB308' },
                  { label: 'En attente OT',     value: stats.awaiting_work_order, color: '#EA580C' },
                  { label: 'En maintenance',    value: stats.in_maintenance,     color: '#3B82F6' },
                  { label: 'Contrôle qualité',  value: stats.quality_control,    color: '#8B5CF6' },
                  { label: 'Disponibles',       value: stats.available,          color: '#22C55E' },
                ].map(item => (
                  <div key={item.label} className="p-4 rounded-lg border-2" style={{ borderColor: item.color }}>
                    <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
                    <p className="text-3xl font-bold" style={{ color: item.color }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Signalements récents</h2>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {recentBreakdowns.length === 0 ? (
                <div className="p-12 text-center">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#22C55E' }} />
                  <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Aucun signalement récent</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tous les bus sont opérationnels</p>
                </div>
              ) : (
                recentBreakdowns.map(breakdown => (
                  <div key={breakdown.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-4">
                      {breakdown.photo_urls && breakdown.photo_urls.length > 0 && (
                        <img src={breakdown.photo_urls[0]} alt="Panne"
                             className="w-24 h-24 object-cover rounded-lg border flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2 gap-4">
                          <div>
                            <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                              {breakdown.title || breakdown.breakdown_type}
                            </h3>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              {breakdown.bus?.registration_number}
                              {(breakdown.bus?.manufacturer || breakdown.bus?.model) && (
                                <> — {[breakdown.bus.manufacturer, breakdown.bus.model].filter(Boolean).join(' ')}</>
                              )}
                            </p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <span className="px-3 py-1 rounded-full text-xs font-medium"
                                  style={{ backgroundColor: (SEVERITY_COLORS[breakdown.severity] || '#6B7280') + '20', color: SEVERITY_COLORS[breakdown.severity] || '#6B7280' }}>
                              {SEVERITY_LABELS[breakdown.severity] || breakdown.severity}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-medium"
                                  style={{ backgroundColor: (STATUS_COLORS[breakdown.status] || '#6B7280') + '20', color: STATUS_COLORS[breakdown.status] || '#6B7280' }}>
                              {STATUS_LABELS[breakdown.status] || breakdown.status}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Type</p>
                            <p className="font-semibold text-sm capitalize" style={{ color: 'var(--text-primary)' }}>
                              {breakdown.breakdown_type}
                            </p>
                          </div>
                          {breakdown.driver?.full_name && (
                            <div>
                              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Chauffeur</p>
                              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                                {breakdown.driver.full_name}
                              </p>
                            </div>
                          )}
                          {breakdown.location && (
                            <div>
                              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Localisation</p>
                              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                                {breakdown.location}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            Signalé le {format(new Date(breakdown.reported_at), 'dd/MM/yyyy à HH:mm')}
                          </p>
                          {breakdown.status === 'signale' ? (
                            <button onClick={() => navigate(`/garage/breakdowns/${breakdown.id}/receive`)}
                                    className="px-4 py-2 rounded-lg text-white font-medium flex items-center gap-2"
                                    style={{ backgroundColor: 'var(--primary)' }}>
                              <CheckCircle className="w-4 h-4" />
                              Recevoir au garage
                            </button>
                          ) : (
                            <button onClick={() => navigate(`/garage/breakdowns/${breakdown.id}/receive`)}
                                    className="px-4 py-2 rounded-lg border font-medium flex items-center gap-2"
                                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                              <Eye className="w-4 h-4" />
                              Voir détails
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
