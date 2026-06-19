import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import {
  CheckCircle, XCircle, AlertTriangle, ArrowLeft,
  Wrench, Bus, User, Calendar, DollarSign, Package
} from 'lucide-react';
import { format } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatCurrency';

interface WorkOrderDetail {
  id: string;
  work_order_number: string;
  estimated_cost: number | null;
  actual_cost: number | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  status: string;
  priority: string | null;
  work_description: string | null;
  spare_parts_used: any;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  bus: {
    id: string;
    registration_number: string;
    brand: string | null;
    model: string;
    mileage: number | null;
    status: string;
  } | null;
  assignee: {
    full_name: string;
  } | null;
  creator: {
    full_name: string;
  } | null;
  diagnostic: {
    id: string;
    diagnosis_summary: string | null;
    estimated_cost: number | null;
    priority: string | null;
    spare_parts_needed: any;
  } | null;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  submitted:   { label: 'En attente',   color: 'var(--warning)', bg: 'var(--warning-light)' },
  validated:   { label: 'Validé',       color: 'var(--info)',    bg: 'var(--info-light)' },
  in_progress: { label: 'En cours',     color: 'var(--primary)', bg: 'var(--primary-light)' },
  completed:   { label: 'Terminé',      color: 'var(--success)', bg: 'var(--success-light)' },
  cancelled:   { label: 'Annulé',       color: 'var(--danger)',  bg: 'var(--danger-light)' },
};

export default function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [comments, setComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    if (id) loadWorkOrder();
  }, [id]);

  const loadWorkOrder = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('maintenance_work_orders')
        .select(`
          id,
          work_order_number,
          estimated_cost,
          actual_cost,
          estimated_hours,
          actual_hours,
          status,
          priority,
          work_description,
          spare_parts_used,
          started_at,
          completed_at,
          created_at,
          bus:bus_id (
            id,
            registration_number,
            brand,
            model,
            mileage,
            status
          ),
          assignee:assigned_to (
            full_name
          ),
          creator:created_by (
            full_name
          ),
          diagnostic:diagnostic_id (
            id,
            diagnosis_summary,
            estimated_cost,
            priority,
            spare_parts_needed
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setWorkOrder(data as any);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!workOrder) return;
    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('maintenance_work_orders')
        .update({
          status: 'validated',
          validated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('OT validé avec succès');
      loadWorkOrder();
    } catch (error: any) {
      toast.error('Erreur lors de la validation');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { toast.error('Veuillez indiquer le motif du rejet'); return; }
    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('maintenance_work_orders')
        .update({
          status: 'cancelled',
          validated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('OT rejeté');
      navigate('/comptable/work-orders');
    } catch (error: any) {
      toast.error('Erreur lors du rejet');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center py-16">
        <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4"
          style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="p-8 text-center py-16">
        <p style={{ color: 'var(--text-secondary)' }}>Ordre de travail introuvable</p>
        <button onClick={() => navigate('/comptable/work-orders')} className="mt-4 px-4 py-2 rounded-lg border">
          Retour
        </button>
      </div>
    );
  }

  const st = STATUS_META[workOrder.status] ?? STATUS_META.submitted;
  const cost = workOrder.actual_cost ?? workOrder.estimated_cost;

  let spareParts: any[] = [];
  if (workOrder.spare_parts_used) {
    try {
      spareParts = Array.isArray(workOrder.spare_parts_used)
        ? workOrder.spare_parts_used
        : typeof workOrder.spare_parts_used === 'object'
        ? Object.values(workOrder.spare_parts_used)
        : [];
    } catch {
      spareParts = [];
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <button
              onClick={() => navigate('/comptable/work-orders')}
              className="flex items-center gap-2 text-sm mb-3 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ArrowLeft className="w-4 h-4" />
              Retour aux ordres de travail
            </button>
            <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {workOrder.work_order_number}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Créé le {format(new Date(workOrder.created_at), 'dd/MM/yyyy à HH:mm')}
            </p>
          </div>
          <span className="px-4 py-2 rounded-full font-semibold text-sm"
            style={{ backgroundColor: st.bg, color: st.color }}>
            {st.label}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* General Info */}
            <div className="bg-white rounded-xl p-6 border" style={{ borderColor: 'var(--neutral-200)' }}>
              <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Wrench className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                Informations générales
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bus className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Bus</span>
                  </div>
                  <p className="font-bold">{workOrder.bus?.registration_number ?? '—'}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {workOrder.bus?.brand} {workOrder.bus?.model}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <User className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Assigné à</span>
                  </div>
                  <p className="font-semibold">{workOrder.assignee?.full_name ?? '—'}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <User className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Créé par</span>
                  </div>
                  <p className="font-semibold">{workOrder.creator?.full_name ?? '—'}</p>
                </div>
                {workOrder.bus?.mileage != null && (
                  <div>
                    <span className="block mb-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Kilométrage</span>
                    <p className="font-semibold">{workOrder.bus.mileage.toLocaleString()} km</p>
                  </div>
                )}
                {workOrder.priority && (
                  <div>
                    <span className="block mb-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Priorité</span>
                    <p className="font-semibold capitalize">{workOrder.priority}</p>
                  </div>
                )}
                {workOrder.started_at && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>Démarré le</span>
                    </div>
                    <p className="font-semibold">{format(new Date(workOrder.started_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                )}
                {workOrder.completed_at && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>Terminé le</span>
                    </div>
                    <p className="font-semibold">{format(new Date(workOrder.completed_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {workOrder.work_description && (
              <div className="bg-white rounded-xl p-6 border" style={{ borderColor: 'var(--neutral-200)' }}>
                <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Description des travaux</h3>
                <p className="text-sm leading-relaxed p-4 rounded-lg"
                  style={{ backgroundColor: 'var(--neutral-50)', color: 'var(--text-primary)' }}>
                  {workOrder.work_description}
                </p>
              </div>
            )}

            {/* Diagnostic */}
            {workOrder.diagnostic && (
              <div className="bg-white rounded-xl p-6 border" style={{ borderColor: 'var(--neutral-200)' }}>
                <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Diagnostic</h3>
                {workOrder.diagnostic.diagnosis_summary && (
                  <p className="text-sm p-4 rounded-lg mb-4"
                    style={{ backgroundColor: 'var(--neutral-50)' }}>
                    {workOrder.diagnostic.diagnosis_summary}
                  </p>
                )}
                {workOrder.diagnostic.estimated_cost != null && (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Coût estimé diagnostic : <span className="font-bold" style={{ color: 'var(--primary)' }}>
                      {formatCurrency(workOrder.diagnostic.estimated_cost)}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Spare Parts */}
            {spareParts.length > 0 && (
              <div className="bg-white rounded-xl p-6 border" style={{ borderColor: 'var(--neutral-200)' }}>
                <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Package className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  Pièces utilisées
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ backgroundColor: 'var(--neutral-50)' }}>
                      <tr>
                        <th className="text-left p-2 font-semibold">Pièce</th>
                        <th className="text-center p-2 font-semibold">Qté</th>
                        <th className="text-right p-2 font-semibold">Prix/U</th>
                        <th className="text-right p-2 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spareParts.map((part: any, i: number) => (
                        <tr key={i} className="border-t" style={{ borderColor: 'var(--neutral-100)' }}>
                          <td className="p-2">{part.name ?? part.part_name ?? `Pièce ${i + 1}`}</td>
                          <td className="p-2 text-center">{part.quantity ?? '—'}</td>
                          <td className="p-2 text-right">
                            {part.unit_price != null ? formatCurrency(part.unit_price) : '—'}
                          </td>
                          <td className="p-2 text-right font-semibold">
                            {part.total_price != null ? formatCurrency(part.total_price)
                              : part.quantity != null && part.unit_price != null
                              ? formatCurrency(part.quantity * part.unit_price)
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Hours */}
            {(workOrder.estimated_hours != null || workOrder.actual_hours != null) && (
              <div className="bg-white rounded-xl p-6 border" style={{ borderColor: 'var(--neutral-200)' }}>
                <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Main d'œuvre</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--neutral-50)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Heures estimées</p>
                    <p className="text-2xl font-black">{workOrder.estimated_hours ?? '—'} h</p>
                  </div>
                  <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--primary-light)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Heures réelles</p>
                    <p className="text-2xl font-black" style={{ color: 'var(--primary)' }}>
                      {workOrder.actual_hours ?? '—'} h
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Validation form */}
            {workOrder.status === 'submitted' && (
              <div className="bg-white rounded-xl p-6 border" style={{ borderColor: 'var(--neutral-200)' }}>
                <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Validation comptable</h3>
                <div className="mb-4">
                  <label className="block mb-2 text-sm font-medium">Commentaires (optionnel)</label>
                  <textarea
                    value={comments}
                    onChange={e => setComments(e.target.value)}
                    className="w-full p-3 border rounded-lg text-sm"
                    rows={3}
                    placeholder="Notes ou observations..."
                    style={{ borderColor: 'var(--neutral-300)' }}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="flex-1 py-3 rounded-lg border-2 font-bold flex items-center justify-center gap-2"
                    style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  >
                    <XCircle className="w-5 h-5" />
                    Rejeter
                  </button>
                  <button
                    onClick={handleValidate}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-lg text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--success)' }}
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : <CheckCircle className="w-5 h-5" />}
                    Valider l'OT
                  </button>
                </div>
              </div>
            )}

            {workOrder.status === 'validated' && (
              <div className="bg-white rounded-xl p-6 border text-center" style={{ borderColor: 'var(--success)', backgroundColor: 'var(--success-light)' }}>
                <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--success)' }} />
                <p className="font-bold" style={{ color: 'var(--success)' }}>OT validé — Les travaux peuvent commencer</p>
              </div>
            )}
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 border sticky top-8" style={{ borderColor: 'var(--neutral-200)' }}>
              <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <DollarSign className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                Récapitulatif
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Coût estimé</span>
                  <span className="font-semibold">
                    {workOrder.estimated_cost != null ? formatCurrency(workOrder.estimated_cost) : '—'}
                  </span>
                </div>
                {workOrder.actual_cost != null && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Coût réel</span>
                    <span className="font-semibold">{formatCurrency(workOrder.actual_cost)}</span>
                  </div>
                )}
                {workOrder.estimated_hours != null && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Heures est.</span>
                    <span className="font-semibold">{workOrder.estimated_hours} h</span>
                  </div>
                )}
                {workOrder.actual_hours != null && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Heures réelles</span>
                    <span className="font-semibold">{workOrder.actual_hours} h</span>
                  </div>
                )}
                <div className="border-t pt-3" style={{ borderColor: 'var(--neutral-200)' }}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold">Total</span>
                    <span className="font-black text-xl" style={{ color: 'var(--primary)' }}>
                      {cost != null ? formatCurrency(cost) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--neutral-200)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Statut actuel</p>
                <span className="inline-block px-3 py-1 rounded-full text-sm font-medium"
                  style={{ backgroundColor: st.bg, color: st.color }}>
                  {st.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6" style={{ color: 'var(--danger)' }} />
              <h3 className="font-bold text-lg">Rejeter l'OT</h3>
            </div>
            <div className="mb-6">
              <label className="block mb-2 text-sm font-medium">Motif du rejet *</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                className="w-full p-3 border rounded-lg text-sm"
                rows={4}
                placeholder="Expliquez pourquoi cet OT est rejeté..."
                style={{ borderColor: 'var(--neutral-300)' }}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border font-medium text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={submitting || !rejectionReason.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg text-white font-bold text-sm disabled:opacity-50"
                style={{ backgroundColor: 'var(--danger)' }}
              >
                {submitting ? 'Rejet...' : 'Confirmer le rejet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
