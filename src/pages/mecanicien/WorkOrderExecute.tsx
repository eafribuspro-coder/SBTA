import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Play, Square, Plus, Trash2, CheckCircle, ArrowLeft, Clock } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatCurrency';

interface WorkOrder {
  id: string;
  work_order_number: string;
  estimated_cost: number | null;
  actual_cost: number | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  work_description: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  spare_parts_used: SparePartEntry[] | null;
  bus: {
    id: string;
    registration_number: string;
    manufacturer: string | null;
    brand: string | null;
    model: string | null;
  } | null;
}

interface SparePartEntry {
  part_id: string;
  part_number: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface ActualPart extends SparePartEntry {
  actual_qty: number;
}

interface AdditionalWork {
  id: string;
  description: string;
  cost: number;
}

export default function WorkOrderExecute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);

  const [workNotes, setWorkNotes] = useState('');
  const [actualParts, setActualParts] = useState<ActualPart[]>([]);
  const [additionalWorks, setAdditionalWorks] = useState<AdditionalWork[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    loadWorkOrder();
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, [id]);

  const loadWorkOrder = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('maintenance_work_orders')
        .select(`
          id, work_order_number, estimated_cost, actual_cost,
          estimated_hours, actual_hours, work_description,
          status, started_at, completed_at, spare_parts_used,
          bus:bus_id(id, registration_number, manufacturer, brand, model)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error('OT introuvable');
        navigate('/mecanicien/dashboard');
        return;
      }

      setWorkOrder(data as WorkOrder);

      if (data.work_description) setWorkNotes(data.work_description);

      const parts: ActualPart[] = (data.spare_parts_used || []).map((p: SparePartEntry) => ({
        ...p,
        actual_qty: p.quantity,
      }));
      setActualParts(parts);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartWork = async () => {
    try {
      const { error } = await supabase
        .from('maintenance_work_orders')
        .update({ status: 'en_cours', started_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('Travaux démarrés');
      loadWorkOrder();
    } catch (error: any) {
      toast.error('Erreur lors du démarrage');
      console.error(error);
    }
  };

  const handleSaveProgress = async () => {
    try {
      const { error } = await supabase
        .from('maintenance_work_orders')
        .update({ work_description: workNotes })
        .eq('id', id);
      if (error) throw error;
      toast.success('Progression sauvegardée');
    } catch (error: any) {
      toast.error('Erreur de sauvegarde');
      console.error(error);
    }
  };

  const updateActualQty = (partId: string, qty: number) => {
    setActualParts(prev => prev.map(p =>
      p.part_id === partId ? { ...p, actual_qty: qty } : p
    ));
  };

  const addAdditionalWork = () => {
    setAdditionalWorks(prev => [
      ...prev,
      { id: Date.now().toString(), description: '', cost: 0 }
    ]);
  };

  const updateAdditionalWork = (wid: string, field: 'description' | 'cost', value: any) => {
    setAdditionalWorks(prev => prev.map(w => w.id === wid ? { ...w, [field]: value } : w));
  };

  const removeAdditionalWork = (wid: string) => {
    setAdditionalWorks(prev => prev.filter(w => w.id !== wid));
  };

  const handleCompleteWork = async () => {
    if (!workNotes.trim()) {
      toast.error('Veuillez ajouter des notes de travaux');
      return;
    }

    try {
      setSubmitting(true);

      const actualPartsCost = actualParts.reduce((sum, p) => sum + (p.actual_qty * p.unit_price), 0);
      const additionalCost = additionalWorks.reduce((sum, w) => sum + w.cost, 0);
      const totalActualCost = actualPartsCost + additionalCost;

      const updatedParts = actualParts.map(p => ({
        part_id: p.part_id,
        part_number: p.part_number,
        name: p.name,
        quantity: p.actual_qty,
        unit_price: p.unit_price,
        total: p.actual_qty * p.unit_price,
      }));

      const notesWithAdditional = additionalWorks.length > 0
        ? `${workNotes}\n\nTravaux supplémentaires:\n${additionalWorks.map(w => `- ${w.description}: ${formatCurrency(w.cost)}`).join('\n')}`
        : workNotes;

      const { error: woError } = await supabase
        .from('maintenance_work_orders')
        .update({
          status: 'en_controle',
          completed_at: new Date().toISOString(),
          work_description: notesWithAdditional,
          spare_parts_used: updatedParts,
          actual_cost: totalActualCost || null,
        })
        .eq('id', id);

      if (woError) throw woError;

      if (workOrder?.bus?.id) {
        await supabase.from('buses')
          .update({ status: 'controle_qualite', updated_at: new Date().toISOString() })
          .eq('id', workOrder.bus.id);
      }

      toast.success('Travaux terminés — En attente de contrôle qualité');
      navigate('/mecanicien/dashboard');
    } catch (error: any) {
      toast.error('Erreur lors de la finalisation');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center py-12">
        <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
             style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="p-8 text-center py-12">
        <p style={{ color: 'var(--text-secondary)' }}>OT introuvable</p>
      </div>
    );
  }

  const isStarted = !!workOrder.started_at;
  const isCompleted = !!workOrder.completed_at;
  const canStart = workOrder.status === 'valide_comptable' && !isStarted;

  let duration: number | null = null;
  if (isStarted && !isCompleted) {
    duration = differenceInMinutes(now, new Date(workOrder.started_at!));
  } else if (isStarted && isCompleted) {
    duration = differenceInMinutes(new Date(workOrder.completed_at!), new Date(workOrder.started_at!));
  }

  const busMake = workOrder.bus?.manufacturer || workOrder.bus?.brand || '';
  const actualPartsCost = actualParts.reduce((sum, p) => sum + (p.actual_qty * p.unit_price), 0);
  const additionalCost = additionalWorks.reduce((sum, w) => sum + w.cost, 0);

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/mecanicien/dashboard')}
                  className="p-2 rounded-lg border"
                  style={{ borderColor: 'var(--border)' }}>
            <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <div>
            <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Exécution OT — {workOrder.work_order_number}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              {workOrder.bus?.registration_number}
              {(busMake || workOrder.bus?.model) ? ` — ${[busMake, workOrder.bus?.model].filter(Boolean).join(' ')}` : ''}
            </p>
          </div>
        </div>

        {canStart && (
          <div className="rounded-xl p-6 border mb-6"
               style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg mb-1" style={{ color: '#166534' }}>
                  OT validé — Prêt à démarrer
                </h3>
                <p className="text-sm" style={{ color: '#16A34A' }}>
                  Cliquez sur le bouton pour démarrer les travaux et enregistrer l'heure de début
                </p>
              </div>
              <button onClick={handleStartWork}
                      className="px-6 py-3 rounded-lg text-white font-bold flex items-center gap-2"
                      style={{ backgroundColor: '#22C55E' }}>
                <Play className="w-5 h-5" />
                DÉMARRER LES TRAVAUX
              </button>
            </div>
          </div>
        )}

        {!canStart && !isStarted && (
          <div className="rounded-xl p-6 border mb-6"
               style={{ backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }}>
            <p className="font-semibold" style={{ color: '#92400E' }}>
              OT en attente de validation par le comptable avant de pouvoir démarrer.
            </p>
          </div>
        )}

        {isStarted && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-xl p-6 border"
                   style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    Temps de travail
                  </h3>
                  {duration !== null && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg"
                         style={{ backgroundColor: '#EFF6FF' }}>
                      <Clock className="w-5 h-5" style={{ color: '#3B82F6' }} />
                      <p className="text-2xl font-bold" style={{ color: '#3B82F6' }}>
                        {Math.floor(duration / 60)}h {String(duration % 60).padStart(2, '0')}min
                      </p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p style={{ color: 'var(--text-secondary)' }}>Début des travaux</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {format(new Date(workOrder.started_at!), 'dd/MM/yyyy à HH:mm')}
                    </p>
                  </div>
                  {isCompleted && workOrder.completed_at && (
                    <div>
                      <p style={{ color: 'var(--text-secondary)' }}>Fin des travaux</p>
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {format(new Date(workOrder.completed_at), 'dd/MM/yyyy à HH:mm')}
                      </p>
                    </div>
                  )}
                  {workOrder.estimated_hours && (
                    <div>
                      <p style={{ color: 'var(--text-secondary)' }}>Durée estimée</p>
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {workOrder.estimated_hours}h
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {!isCompleted && (
                <>
                  <div className="rounded-xl p-6 border"
                       style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                      Notes d'avancement *
                    </h3>
                    <textarea value={workNotes} onChange={e => setWorkNotes(e.target.value)}
                              className="w-full p-3 border rounded-lg text-sm"
                              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                              rows={6}
                              placeholder="Décrivez l'état d'avancement, les découvertes, les points d'attention..." />
                    <button onClick={handleSaveProgress}
                            className="mt-3 px-4 py-2 rounded-lg border text-sm font-medium"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                      Sauvegarder la progression
                    </button>
                  </div>

                  {actualParts.length > 0 && (
                    <div className="rounded-xl p-6 border"
                         style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                      <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                        Pièces réellement utilisées
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                              <th className="text-left p-2 font-semibold">Réf</th>
                              <th className="text-left p-2 font-semibold">Désignation</th>
                              <th className="text-center p-2 font-semibold">Qté prévue</th>
                              <th className="text-center p-2 font-semibold">Qté réelle</th>
                              <th className="text-right p-2 font-semibold">Prix/U</th>
                              <th className="text-right p-2 font-semibold">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {actualParts.map(part => (
                              <tr key={part.part_id} className="border-t"
                                  style={{ borderColor: 'var(--border)' }}>
                                <td className="p-2 font-mono text-xs">{part.part_number}</td>
                                <td className="p-2 font-semibold" style={{ color: 'var(--text-primary)' }}>
                                  {part.name}
                                </td>
                                <td className="p-2 text-center" style={{ color: 'var(--text-secondary)' }}>
                                  {part.quantity}
                                </td>
                                <td className="p-2">
                                  <div className="flex justify-center">
                                    <input type="number" min="0" value={part.actual_qty}
                                           onChange={e => updateActualQty(part.part_id, parseInt(e.target.value) || 0)}
                                           className="w-20 p-2 border rounded-lg text-sm text-center"
                                           style={{ borderColor: 'var(--border)' }} />
                                  </div>
                                </td>
                                <td className="p-2 text-right">{formatCurrency(part.unit_price)}</td>
                                <td className="p-2 text-right font-bold">
                                  {formatCurrency(part.actual_qty * part.unit_price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl p-6 border"
                       style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                        Travaux supplémentaires découverts
                      </h3>
                      <button onClick={addAdditionalWork}
                              className="px-3 py-2 rounded-lg border flex items-center gap-2 text-sm"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                        <Plus className="w-4 h-4" /> Ajouter
                      </button>
                    </div>

                    {additionalWorks.length > 0 ? (
                      <div className="space-y-3">
                        {additionalWorks.map(work => (
                          <div key={work.id} className="p-4 border rounded-lg"
                               style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
                            <div className="flex items-start justify-between mb-3">
                              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                                Travail supplémentaire
                              </p>
                              <button onClick={() => removeAdditionalWork(work.id)}
                                      className="text-red-500 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="md:col-span-2">
                                <input type="text" value={work.description}
                                       onChange={e => updateAdditionalWork(work.id, 'description', e.target.value)}
                                       className="w-full p-2 border rounded-lg text-sm"
                                       style={{ borderColor: 'var(--border)' }}
                                       placeholder="Description du travail supplémentaire" />
                              </div>
                              <div>
                                <input type="number" step="1000" value={work.cost}
                                       onChange={e => updateAdditionalWork(work.id, 'cost', parseFloat(e.target.value) || 0)}
                                       className="w-full p-2 border rounded-lg text-sm"
                                       style={{ borderColor: 'var(--border)' }}
                                       placeholder="Coût (FCFA)" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Aucun travail supplémentaire découvert
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl p-6 border"
                       style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <button onClick={handleCompleteWork}
                            disabled={submitting || !workNotes.trim()}
                            className="w-full px-6 py-4 rounded-lg text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                            style={{ backgroundColor: '#22C55E' }}>
                      <Square className="w-5 h-5" />
                      {submitting ? 'Finalisation...' : 'TERMINER LES TRAVAUX'}
                    </button>
                    <p className="text-xs text-center mt-2" style={{ color: 'var(--text-secondary)' }}>
                      Le bus sera envoyé en contrôle qualité par le chef de garage
                    </p>
                  </div>
                </>
              )}

              {isCompleted && (
                <div className="rounded-xl p-6 border"
                     style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle className="w-8 h-8" style={{ color: '#22C55E' }} />
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: '#166534' }}>
                        Travaux terminés
                      </h3>
                      <p className="text-sm" style={{ color: '#16A34A' }}>
                        En attente de contrôle qualité par le chef de garage
                      </p>
                    </div>
                  </div>
                  {workOrder.work_description && (
                    <div className="p-4 rounded-lg bg-white border border-green-200">
                      <p className="font-semibold text-sm mb-2" style={{ color: '#166534' }}>
                        Notes de travaux
                      </p>
                      <p className="text-sm whitespace-pre-line" style={{ color: '#15803D' }}>
                        {workOrder.work_description}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="rounded-xl p-6 border sticky top-8 space-y-5"
                   style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                  Estimations vs Réel
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p style={{ color: 'var(--text-secondary)' }}>Coût estimé</p>
                    <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                      {formatCurrency(workOrder.estimated_cost || 0)}
                    </p>
                  </div>

                  {!isCompleted && (
                    <>
                      <div>
                        <p style={{ color: 'var(--text-secondary)' }}>Pièces réelles</p>
                        <p className="font-bold text-lg" style={{ color: 'var(--primary)' }}>
                          {formatCurrency(actualPartsCost)}
                        </p>
                      </div>

                      {additionalWorks.length > 0 && (
                        <div>
                          <p style={{ color: 'var(--text-secondary)' }}>Travaux supplémentaires</p>
                          <p className="font-bold text-lg" style={{ color: '#F59E0B' }}>
                            {formatCurrency(additionalCost)}
                          </p>
                        </div>
                      )}

                      <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                        <p style={{ color: 'var(--text-secondary)' }}>Total actuel</p>
                        <p className="font-bold text-2xl" style={{ color: 'var(--primary)' }}>
                          {formatCurrency(actualPartsCost + additionalCost)}
                        </p>
                      </div>
                    </>
                  )}

                  {isCompleted && workOrder.actual_cost != null && (
                    <div>
                      <p style={{ color: 'var(--text-secondary)' }}>Coût réel final</p>
                      <p className="font-bold text-xl" style={{ color: '#22C55E' }}>
                        {formatCurrency(workOrder.actual_cost)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Pièces prévues</h3>
                  {actualParts.length > 0 ? (
                    <div className="space-y-2">
                      {actualParts.map(part => (
                        <div key={part.part_id} className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--text-secondary)' }} className="truncate mr-2">
                            {part.name}
                          </span>
                          <span className="font-medium flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                            ×{part.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Aucune pièce prévue
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
