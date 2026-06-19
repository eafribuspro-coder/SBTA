import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Wrench, Clock, CheckCircle, Play, FileText, AlertTriangle, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';
import { format } from 'date-fns';

interface WorkOrder {
  id: string;
  work_order_number: string;
  bus_id: string;
  estimated_cost: number | null;
  actual_cost: number | null;
  status: string;
  created_at: string;
  started_at?: string | null;
  bus: {
    registration_number: string;
    manufacturer: string | null;
    brand: string | null;
    model: string | null;
  } | null;
}

interface PendingDiagnostic {
  id: string;
  bus_id: string;
  diagnosed_at: string;
  status: string;
  bus: {
    registration_number: string;
    manufacturer: string | null;
    brand: string | null;
    model: string | null;
  } | null;
  breakdown_report: {
    id: string;
    title: string | null;
    severity: string;
  } | null;
}

export default function MecanicienDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [pendingWO, setPendingWO] = useState<WorkOrder[]>([]);
  const [validatedWO, setValidatedWO] = useState<WorkOrder[]>([]);
  const [inProgressWO, setInProgressWO] = useState<WorkOrder[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [pendingDiags, setPendingDiags] = useState<PendingDiagnostic[]>([]);

  useEffect(() => {
    if (user?.id) loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [pendingRes, validatedRes, inProgressRes, completedRes, diagRes] = await Promise.all([
        supabase
          .from('maintenance_work_orders')
          .select('id, work_order_number, bus_id, estimated_cost, status, created_at, bus:bus_id(registration_number, manufacturer, brand, model)')
          .eq('assigned_to', user.id)
          .eq('status', 'attente_validation')
          .order('created_at', { ascending: false }),

        supabase
          .from('maintenance_work_orders')
          .select('id, work_order_number, bus_id, estimated_cost, status, created_at, bus:bus_id(registration_number, manufacturer, brand, model)')
          .eq('assigned_to', user.id)
          .eq('status', 'valide_comptable')
          .order('created_at', { ascending: false }),

        supabase
          .from('maintenance_work_orders')
          .select('id, work_order_number, bus_id, estimated_cost, status, created_at, started_at, bus:bus_id(registration_number, manufacturer, brand, model)')
          .eq('assigned_to', user.id)
          .eq('status', 'en_cours')
          .order('started_at', { ascending: false }),

        supabase
          .from('maintenance_work_orders')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', user.id)
          .eq('status', 'termine')
          .gte('completed_at', startOfMonth.toISOString()),

        supabase
          .from('maintenance_diagnostics')
          .select(`
            id, bus_id, diagnosed_at, status,
            bus:bus_id(registration_number, manufacturer, brand, model),
            breakdown_report:breakdown_report_id(id, title, severity)
          `)
          .eq('diagnosed_by', user.id)
          .eq('status', 'en_cours')
          .order('diagnosed_at', { ascending: false })
          .limit(5),
      ]);

      setPendingWO((pendingRes.data as WorkOrder[]) || []);
      setValidatedWO((validatedRes.data as WorkOrder[]) || []);
      setInProgressWO((inProgressRes.data as WorkOrder[]) || []);
      setCompletedCount(completedRes.count || 0);
      setPendingDiags((diagRes.data as PendingDiagnostic[]) || []);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkOrder = async (wo: WorkOrder) => {
    try {
      const { error } = await supabase
        .from('maintenance_work_orders')
        .update({ status: 'en_cours', started_at: new Date().toISOString() })
        .eq('id', wo.id);
      if (error) throw error;
      toast.success('OT démarré');
      navigate(`/mecanicien/work-orders/${wo.id}/execute`);
    } catch (error: any) {
      toast.error('Erreur lors du démarrage');
      console.error(error);
    }
  };

  const getTimeSince = (dateString: string) => {
    const diffMs = new Date().getTime() - new Date(dateString).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return diffHours > 0 ? `depuis ${diffHours}h${String(diffMinutes).padStart(2, '0')}` : `depuis ${diffMinutes} min`;
  };

  const busLabel = (wo: WorkOrder) => {
    const make = wo.bus?.manufacturer || wo.bus?.brand || '';
    return [make, wo.bus?.model].filter(Boolean).join(' ');
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Dashboard Mécanicien
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Mes ordres de travail</p>
        </div>
        <button onClick={loadDashboardData}
                className="px-4 py-2 rounded-lg border flex items-center gap-2 text-sm font-medium"
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
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'En attente validation', value: pendingWO.length, color: '#F59E0B', bg: '#FFFBEB' },
              { label: 'Validés à démarrer', value: validatedWO.length, color: '#22C55E', bg: '#F0FDF4' },
              { label: 'En cours', value: inProgressWO.length, color: '#3B82F6', bg: '#EFF6FF' },
              { label: 'Terminés ce mois', value: completedCount, color: '#6B7280', bg: '#F9FAFB' },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl border p-4"
                   style={{ backgroundColor: stat.bg, borderColor: stat.color + '30' }}>
                <p className="text-xs font-medium mb-1" style={{ color: stat.color }}>{stat.label}</p>
                <p className="text-3xl font-black" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {pendingDiags.length > 0 && (
            <div className="rounded-xl border overflow-hidden"
                 style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="p-5 border-b flex items-center justify-between"
                   style={{ borderColor: 'var(--border)' }}>
                <h2 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <AlertTriangle className="w-5 h-5" style={{ color: '#F59E0B' }} />
                  Diagnostics en cours
                </h2>
                <span className="px-3 py-1 rounded-full text-sm font-bold"
                      style={{ backgroundColor: '#FFFBEB', color: '#F59E0B' }}>
                  {pendingDiags.length}
                </span>
              </div>
              <div className="p-5 space-y-3">
                {pendingDiags.map(diag => (
                  <div key={diag.id} className="p-4 rounded-lg border flex items-center justify-between gap-4"
                       style={{ borderColor: '#FEF3C7', backgroundColor: '#FFFBEB' }}>
                    <div>
                      <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                        {diag.bus?.registration_number}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {diag.breakdown_report?.title || 'Panne en diagnostic'}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/mecanicien/work-orders/new/${diag.id}`)}
                      className="px-4 py-2 rounded-lg text-white text-sm font-medium flex-shrink-0"
                      style={{ backgroundColor: '#F59E0B' }}>
                      Créer OT
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border overflow-hidden"
               style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="p-5 border-b flex items-center justify-between"
                 style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Clock className="w-5 h-5" style={{ color: '#F59E0B' }} />
                En attente de validation comptable
              </h2>
              <span className="px-3 py-1 rounded-full text-sm font-bold"
                    style={{ backgroundColor: '#FFFBEB', color: '#F59E0B' }}>
                {pendingWO.length}
              </span>
            </div>
            <div className="p-5">
              {pendingWO.length > 0 ? (
                <div className="space-y-3">
                  {pendingWO.map(wo => (
                    <div key={wo.id} className="p-4 rounded-lg border-2"
                         style={{ borderColor: '#FEF3C7', backgroundColor: '#FFFBEB' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                            {wo.work_order_number}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {wo.bus?.registration_number} {busLabel(wo) ? `— ${busLabel(wo)}` : ''}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Créé le {format(new Date(wo.created_at), 'dd/MM/yyyy à HH:mm')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black" style={{ color: '#F59E0B' }}>
                            {formatCurrency(wo.estimated_cost || 0)}
                          </p>
                          <p className="text-xs font-medium" style={{ color: '#F59E0B' }}>
                            En attente comptable
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Aucun OT en attente de validation
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden"
               style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="p-5 border-b flex items-center justify-between"
                 style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Play className="w-5 h-5" style={{ color: '#22C55E' }} />
                Validés — Prêts à démarrer
              </h2>
              <span className="px-3 py-1 rounded-full text-sm font-bold"
                    style={{ backgroundColor: '#F0FDF4', color: '#22C55E' }}>
                {validatedWO.length}
              </span>
            </div>
            <div className="p-5">
              {validatedWO.length > 0 ? (
                <div className="space-y-3">
                  {validatedWO.map(wo => (
                    <div key={wo.id} className="p-4 rounded-lg border-2"
                         style={{ borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                            {wo.work_order_number}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {wo.bus?.registration_number} {busLabel(wo) ? `— ${busLabel(wo)}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black" style={{ color: '#22C55E' }}>
                            {formatCurrency(wo.estimated_cost || 0)}
                          </p>
                          <p className="text-xs font-medium" style={{ color: '#22C55E' }}>Validé</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleStartWorkOrder(wo)}
                        className="w-full py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2"
                        style={{ backgroundColor: '#22C55E' }}>
                        <Play className="w-5 h-5" /> Commencer les travaux
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Aucun OT prêt à démarrer
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden"
               style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="p-5 border-b flex items-center justify-between"
                 style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Wrench className="w-5 h-5" style={{ color: '#3B82F6' }} />
                En cours
              </h2>
              <span className="px-3 py-1 rounded-full text-sm font-bold"
                    style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>
                {inProgressWO.length}
              </span>
            </div>
            <div className="p-5">
              {inProgressWO.length > 0 ? (
                <div className="space-y-3">
                  {inProgressWO.map(wo => (
                    <div key={wo.id} className="p-4 rounded-lg border-2"
                         style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                            {wo.work_order_number}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {wo.bus?.registration_number} {busLabel(wo) ? `— ${busLabel(wo)}` : ''}
                          </p>
                          {wo.started_at && (
                            <p className="text-xs mt-0.5 font-medium" style={{ color: '#3B82F6' }}>
                              {getTimeSince(wo.started_at)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => navigate(`/mecanicien/work-orders/${wo.id}/execute`)}
                          className="px-5 py-2.5 rounded-lg font-medium text-white"
                          style={{ backgroundColor: '#3B82F6' }}>
                          Continuer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Aucun OT en cours
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border p-6 flex items-center gap-4"
               style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ backgroundColor: '#F0FDF4' }}>
              <CheckCircle className="w-7 h-7" style={{ color: '#22C55E' }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Terminés ce mois
              </p>
              <p className="text-3xl font-black" style={{ color: '#22C55E' }}>
                {completedCount} intervention{completedCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="rounded-xl border p-6"
               style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Accès rapide</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: <Wrench className="w-6 h-6" style={{ color: 'var(--primary)' }} />,
                  title: 'Nouveau diagnostic',
                  subtitle: 'Diagnostiquer un bus en panne',
                  action: () => navigate('/garage/breakdowns'),
                },
                {
                  icon: <FileText className="w-6 h-6" style={{ color: 'var(--primary)' }} />,
                  title: 'Mes OT',
                  subtitle: 'Voir tous mes ordres de travail',
                  action: () => navigate('/mecanicien/dashboard'),
                },
                {
                  icon: <CheckCircle className="w-6 h-6" style={{ color: 'var(--primary)' }} />,
                  title: 'Stock pièces',
                  subtitle: 'Consulter le stock',
                  action: () => navigate('/stock/parts'),
                },
              ].map(item => (
                <button key={item.title} onClick={item.action}
                        className="p-5 rounded-xl border-2 text-left transition-all hover:shadow-md"
                        style={{ borderColor: 'var(--border)' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                       style={{ backgroundColor: 'var(--primary-light)' }}>
                    {item.icon}
                  </div>
                  <p className="font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.subtitle}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
