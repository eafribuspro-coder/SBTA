import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, Upload, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatCurrency';

interface WorkOrder {
  id: string;
  work_order_number: string;
  started_at: string | null;
  completed_at: string | null;
  work_description: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  bus: {
    id: string;
    registration_number: string;
    manufacturer: string | null;
    brand: string | null;
    model: string | null;
    mileage: number | null;
  } | null;
  diagnostic: {
    diagnosis_summary: string | null;
    breakdown_report: {
      title: string | null;
    } | null;
  } | null;
  mechanic: {
    full_name: string | null;
  } | null;
}

const QUALITY_CHECKLIST = [
  'Système réparé testé et fonctionnel',
  'Pièces remplacées documentées',
  'Aucune fuite détectée',
  'Nettoyage du poste de travail',
  'Essai routier effectué (si applicable)'
];

export default function QualityCheck() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);

  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [qualityNotes, setQualityNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadWorkOrder();
    const initialChecklist: Record<string, boolean> = {};
    QUALITY_CHECKLIST.forEach(item => { initialChecklist[item] = false; });
    setChecklist(initialChecklist);
  }, [id]);

  const loadWorkOrder = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('maintenance_work_orders')
        .select(`
          id, work_order_number, started_at, completed_at,
          work_description, estimated_cost, actual_cost,
          bus:bus_id (id, registration_number, manufacturer, brand, model, mileage),
          diagnostic:diagnostic_id (
            diagnosis_summary,
            breakdown_report:breakdown_report_id (title)
          ),
          mechanic:assigned_to (full_name)
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

  const toggleChecklistItem = (item: string) => {
    setChecklist(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleApprove = async () => {
    const allChecked = Object.values(checklist).every(checked => checked);
    if (!allChecked) {
      toast.error('Veuillez valider tous les points de contrôle');
      return;
    }
    if (!qualityNotes.trim()) {
      toast.error('Veuillez ajouter des notes de contrôle');
      return;
    }
    try {
      setSubmitting(true);

      const photoUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${workOrder?.bus?.id}-quality-${Date.now()}-${i}.${fileExt}`;
        const filePath = `quality-photos/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('documents').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from('documents').getPublicUrl(filePath);
        photoUrls.push(urlData.publicUrl);
      }

      const { error: woError } = await supabase
        .from('maintenance_work_orders')
        .update({
          status: 'termine',
          quality_check_passed: true,
          quality_checklist: checklist,
          quality_notes: qualityNotes,
          quality_photos: photoUrls,
          quality_checked_at: new Date().toISOString()
        })
        .eq('id', id);
      if (woError) throw woError;

      if (workOrder?.bus?.id) {
        await supabase.from('buses')
          .update({ status: 'disponible', updated_at: new Date().toISOString() })
          .eq('id', workOrder.bus.id);
      }

      toast.success('Contrôle validé - Bus remis en service');
      navigate('/garage/dashboard');
    } catch (error: any) {
      toast.error('Erreur lors de la validation');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Veuillez indiquer le motif du rejet');
      return;
    }
    try {
      setSubmitting(true);
      const { error: woError } = await supabase
        .from('maintenance_work_orders')
        .update({
          status: 'en_cours',
          quality_check_passed: false,
          quality_rejection_reason: rejectionReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      if (woError) throw woError;

      if (workOrder?.bus?.id) {
        await supabase.from('buses')
          .update({ status: 'maintenance', updated_at: new Date().toISOString() })
          .eq('id', workOrder.bus.id);
      }

      toast.success('Non conforme - Retour en maintenance');
      navigate('/garage/dashboard');
    } catch (error: any) {
      toast.error('Erreur lors du rejet');
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
        <AlertTriangle className="w-16 h-16 mx-auto mb-4" style={{ color: '#EF4444' }} />
        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>OT introuvable</p>
      </div>
    );
  }

  const allChecked = Object.values(checklist).every(checked => checked);
  const checkedCount = Object.values(checklist).filter(Boolean).length;
  const busMake = workOrder.bus?.manufacturer || workOrder.bus?.brand || '';

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Contrôle qualité
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {workOrder.work_order_number} — {workOrder.bus?.registration_number}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl p-6 border"
                 style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Informations de réparation
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                {workOrder.diagnostic?.breakdown_report?.title && (
                  <div>
                    <p style={{ color: 'var(--text-secondary)' }}>Panne initiale</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {workOrder.diagnostic.breakdown_report.title}
                    </p>
                  </div>
                )}
                {workOrder.mechanic?.full_name && (
                  <div>
                    <p style={{ color: 'var(--text-secondary)' }}>Mécanicien</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {workOrder.mechanic.full_name}
                    </p>
                  </div>
                )}
                {workOrder.started_at && (
                  <div>
                    <p style={{ color: 'var(--text-secondary)' }}>Début travaux</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {format(new Date(workOrder.started_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                )}
                {workOrder.completed_at && (
                  <div>
                    <p style={{ color: 'var(--text-secondary)' }}>Fin travaux</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {format(new Date(workOrder.completed_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                )}
              </div>

              {workOrder.diagnostic?.diagnosis_summary && (
                <div className="mb-4">
                  <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Résumé du diagnostic
                  </p>
                  <p className="p-3 rounded-lg text-sm"
                     style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                    {workOrder.diagnostic.diagnosis_summary}
                  </p>
                </div>
              )}

              {workOrder.work_description && (
                <div className="mb-4">
                  <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Description des travaux
                  </p>
                  <p className="p-3 rounded-lg text-sm"
                     style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                    {workOrder.work_description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>Coût estimé</p>
                  <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(workOrder.estimated_cost || 0)}
                  </p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>Coût réel</p>
                  <p className="font-bold text-lg" style={{ color: 'var(--primary)' }}>
                    {formatCurrency(workOrder.actual_cost || workOrder.estimated_cost || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl p-6 border"
                 style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                  Checklist de contrôle
                </h3>
                <span className="px-3 py-1 rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: allChecked ? '#F0FDF4' : '#FFFBEB',
                        color: allChecked ? '#16A34A' : '#D97706'
                      }}>
                  {checkedCount}/{QUALITY_CHECKLIST.length}
                </span>
              </div>
              <div className="space-y-3">
                {QUALITY_CHECKLIST.map((item, index) => (
                  <label key={index}
                         className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                           checklist[item] ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                         }`}>
                    <input type="checkbox" checked={checklist[item] || false}
                           onChange={() => toggleChecklistItem(item)}
                           className="mt-1 w-5 h-5 rounded" style={{ accentColor: '#22C55E' }} />
                    <div className="flex-1">
                      <p className={`font-medium ${checklist[item] ? 'text-green-700' : ''}`}>{item}</p>
                    </div>
                    {checklist[item] && <CheckCircle className="w-5 h-5 text-green-600" />}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-6 border"
                 style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Notes de contrôle qualité
              </h3>
              <textarea value={qualityNotes} onChange={e => setQualityNotes(e.target.value)}
                        className="w-full p-3 border rounded-lg text-sm"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                        rows={5}
                        placeholder="État général du véhicule, résultats des tests, observations particulières..." />
            </div>

            <div className="rounded-xl p-6 border"
                 style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Photos de validation
              </h3>
              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                  {photoPreviews.map((preview, index) => (
                    <div key={index} className="relative">
                      <img src={preview} alt={`Photo ${index + 1}`}
                           className="w-full h-24 object-cover rounded-lg border" />
                      <button type="button" onClick={() => removePhoto(index)}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-2 border-dashed rounded-lg p-4"
                   style={{ borderColor: 'var(--border)' }}>
                <input type="file" accept="image/*" multiple
                       onChange={handlePhotoChange} className="hidden" id="quality-photos" />
                <label htmlFor="quality-photos" className="flex flex-col items-center cursor-pointer">
                  <Upload className="w-8 h-8 mb-2" style={{ color: 'var(--text-secondary)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Ajouter des photos
                  </p>
                </label>
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setShowRejectModal(true)}
                      className="flex-1 px-6 py-4 rounded-lg border-2 font-bold flex items-center justify-center gap-2"
                      style={{ borderColor: '#EF4444', color: '#EF4444' }}>
                <XCircle className="w-5 h-5" /> NON CONFORME
              </button>
              <button onClick={handleApprove}
                      disabled={submitting || !allChecked || !qualityNotes.trim()}
                      className="flex-1 px-6 py-4 rounded-lg text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ backgroundColor: '#22C55E' }}>
                <CheckCircle className="w-5 h-5" />
                {submitting ? 'Validation...' : 'CONTRÔLE VALIDÉ'}
              </button>
            </div>
          </div>

          <div>
            <div className="rounded-xl p-6 border sticky top-8"
                 style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Informations bus
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>Immatriculation</p>
                  <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                    {workOrder.bus?.registration_number || '—'}
                  </p>
                </div>
                {(busMake || workOrder.bus?.model) && (
                  <div>
                    <p style={{ color: 'var(--text-secondary)' }}>Modèle</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {[busMake, workOrder.bus?.model].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}
                {workOrder.bus?.mileage != null && (
                  <div>
                    <p style={{ color: 'var(--text-secondary)' }}>Kilométrage</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {workOrder.bus.mileage.toLocaleString()} km
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: '#EFF6FF' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: '#2563EB' }}>
                  APRÈS VALIDATION
                </p>
                <ul className="text-xs space-y-1" style={{ color: '#2563EB' }}>
                  <li>• Bus marqué "Disponible"</li>
                  <li>• Notification planificateur</li>
                  <li>• Historique enregistré</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
             style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-xl p-6 max-w-md w-full shadow-xl"
               style={{ backgroundColor: 'var(--surface)' }}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6" style={{ color: '#EF4444' }} />
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                Contrôle non conforme
              </h3>
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                Motif du rejet *
              </label>
              <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                        className="w-full p-3 border rounded-lg text-sm"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                        rows={4}
                        placeholder="Expliquez ce qui n'est pas conforme et doit être corrigé..."
                        autoFocus />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(false)}
                      className="flex-1 px-4 py-2 rounded-lg border font-medium text-sm"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                Annuler
              </button>
              <button onClick={handleReject}
                      disabled={submitting || !rejectionReason.trim()}
                      className="flex-1 px-4 py-2 rounded-lg text-white font-bold text-sm disabled:opacity-50"
                      style={{ backgroundColor: '#EF4444' }}>
                {submitting ? 'Rejet...' : 'Confirmer le rejet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
