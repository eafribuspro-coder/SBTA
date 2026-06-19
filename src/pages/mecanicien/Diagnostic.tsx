import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronUp, Plus, Trash2, Upload, Send, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';

interface BreakdownReport {
  id: string;
  title: string | null;
  breakdown_type: string;
  severity: string;
  description: string | null;
  photo_urls: string[] | null;
  photos_urls: string[] | null;
  reported_at: string;
  bus: {
    id: string;
    registration_number: string;
    manufacturer: string | null;
    brand: string | null;
    model: string | null;
    mileage: number | null;
  } | null;
  driver: {
    full_name: string | null;
  } | null;
}

interface Intervention {
  id: string;
  type: string;
  component: string;
  urgency: string;
}

const SYSTEMS = ['Moteur', 'Freins', 'Électrique', 'Carrosserie', 'Transmission', 'Autre'];
const INTERVENTION_TYPES = ['Remplacement', 'Réparation', 'Réglage', 'Nettoyage'];
const URGENCY_LEVELS = [
  { value: 'haute', label: 'Haute' },
  { value: 'moyenne', label: 'Moyenne' },
  { value: 'faible', label: 'Basse' },
];

export default function MechanicDiagnostic() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [breakdown, setBreakdown] = useState<BreakdownReport | null>(null);

  const [expandedSystems, setExpandedSystems] = useState<Record<string, boolean>>({});
  const [systemObservations, setSystemObservations] = useState<Record<string, string>>(
    Object.fromEntries(SYSTEMS.map(s => [s, '']))
  );

  const [rootCause, setRootCause] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [priority, setPriority] = useState('moyenne');

  const [interventions, setInterventions] = useState<Intervention[]>([
    { id: '1', type: '', component: '', urgency: 'moyenne' }
  ]);

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  useEffect(() => { loadBreakdown(); }, [id]);

  const loadBreakdown = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('breakdown_reports')
        .select(`
          id, title, breakdown_type, severity, description,
          photo_urls, photos_urls, reported_at,
          bus:bus_id(id, registration_number, manufacturer, brand, model, mileage),
          driver:driver_id(full_name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error('Signalement introuvable');
        navigate('/mecanicien/dashboard');
        return;
      }
      setBreakdown(data as any);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSystem = (system: string) => {
    setExpandedSystems(prev => ({ ...prev, [system]: !prev[system] }));
  };

  const addIntervention = () => {
    setInterventions(prev => [
      ...prev,
      { id: Date.now().toString(), type: '', component: '', urgency: 'moyenne' }
    ]);
  };

  const removeIntervention = (iid: string) => {
    setInterventions(prev => prev.filter(i => i.id !== iid));
  };

  const updateIntervention = (iid: string, field: keyof Intervention, value: string) => {
    setInterventions(prev => prev.map(i => i.id === iid ? { ...i, [field]: value } : i));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreviews(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rootCause.trim()) {
      toast.error('Veuillez identifier la cause racine');
      return;
    }

    const validInterventions = interventions.filter(i => i.type && i.component);
    if (validInterventions.length === 0) {
      toast.error('Veuillez ajouter au moins une intervention');
      return;
    }

    try {
      setSubmitting(true);

      const photoUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        const ext = file.name.split('.').pop();
        const fileName = `${breakdown?.bus?.id}-diag-${Date.now()}-${i}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('documents').upload(`diagnostic-photos/${fileName}`, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from('documents').getPublicUrl(`diagnostic-photos/${fileName}`);
        photoUrls.push(urlData.publicUrl);
      }

      const systemsWithObs = Object.entries(systemObservations)
        .filter(([, obs]) => obs.trim())
        .map(([sys, obs]) => `${sys}: ${obs}`)
        .join('\n');

      const diagSummary = [
        `Cause racine: ${rootCause}`,
        systemsWithObs ? `\nSystèmes inspectés:\n${systemsWithObs}` : '',
        `\nInterventions recommandées:\n${validInterventions.map(i => `- ${i.type} ${i.component} (urgence: ${i.urgency})`).join('\n')}`,
        photoUrls.length > 0 ? `\nPhotos: ${photoUrls.join(', ')}` : '',
      ].filter(Boolean).join('');

      const { data: diagData, error: diagError } = await supabase
        .from('maintenance_diagnostics')
        .insert({
          breakdown_report_id: id,
          bus_id: breakdown?.bus?.id,
          diagnosed_by: user?.id,
          diagnosis_summary: diagSummary,
          estimated_cost: parseFloat(estimatedCost) || null,
          estimated_duration_hours: parseFloat(estimatedHours) || null,
          spare_parts_needed: validInterventions.reduce((acc, i) => {
            acc[i.component] = { type: i.type, urgency: i.urgency };
            return acc;
          }, {} as Record<string, any>),
          priority: priority,
          status: 'en_cours',
          diagnosed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (diagError) throw diagError;

      await supabase
        .from('breakdown_reports')
        .update({ status: 'en_diagnostic' })
        .eq('id', id);

      toast.success('Diagnostic soumis au chef de garage');
      navigate(`/mecanicien/work-orders/new/${diagData.id}`);
    } catch (error: any) {
      toast.error('Erreur lors de la soumission');
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

  if (!breakdown) {
    return (
      <div className="p-8 text-center py-12">
        <p style={{ color: 'var(--text-secondary)' }}>Signalement introuvable</p>
      </div>
    );
  }

  const allPhotos = [
    ...(breakdown.photo_urls || []),
    ...(breakdown.photos_urls || []),
  ].filter(Boolean);

  const busMake = breakdown.bus?.manufacturer || breakdown.bus?.brand || '';

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
              Diagnostic technique
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              {breakdown.bus?.registration_number} — {breakdown.title || breakdown.breakdown_type}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl p-6 border"
                 style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Signalement initial
              </h3>
              <div className="space-y-3 text-sm">
                {breakdown.description && (
                  <div>
                    <p className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Description chauffeur
                    </p>
                    <p className="p-3 rounded-lg"
                       style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)' }}>
                      {breakdown.description}
                    </p>
                  </div>
                )}
                {allPhotos.length > 0 && (
                  <div>
                    <p className="font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Photos du signalement
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {allPhotos.map((url, index) => (
                        <img key={index} src={url} alt={`Photo ${index + 1}`}
                             className="w-full h-24 object-cover rounded-lg border" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="rounded-xl p-6 border"
                   style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                  Systèmes inspectés
                </h3>
                <div className="space-y-2">
                  {SYSTEMS.map(system => (
                    <div key={system} className="border rounded-lg overflow-hidden"
                         style={{ borderColor: 'var(--border)' }}>
                      <button type="button" onClick={() => toggleSystem(system)}
                              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 text-left">
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {system}
                        </span>
                        {expandedSystems[system]
                          ? <ChevronUp className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                          : <ChevronDown className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                        }
                      </button>
                      {expandedSystems[system] && (
                        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
                          <textarea
                            value={systemObservations[system] || ''}
                            onChange={e => setSystemObservations(prev => ({ ...prev, [system]: e.target.value }))}
                            className="w-full p-3 border rounded-lg text-sm"
                            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                            rows={3}
                            placeholder={`Observations sur le système ${system}...`}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl p-6 border"
                   style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                  Cause racine identifiée *
                </h3>
                <textarea
                  value={rootCause}
                  onChange={e => setRootCause(e.target.value)}
                  className="w-full p-3 border rounded-lg text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                  rows={4}
                  placeholder="Décrivez la cause principale du problème..."
                  required
                />
              </div>

              <div className="rounded-xl p-6 border"
                   style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    Interventions recommandées *
                  </h3>
                  <button type="button" onClick={addIntervention}
                          className="px-3 py-2 rounded-lg border flex items-center gap-2 text-sm"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                    <Plus className="w-4 h-4" /> Ajouter
                  </button>
                </div>
                <div className="space-y-4">
                  {interventions.map((intervention, index) => (
                    <div key={intervention.id} className="p-4 border rounded-lg"
                         style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                          Intervention #{index + 1}
                        </p>
                        {interventions.length > 1 && (
                          <button type="button" onClick={() => removeIntervention(intervention.id)}
                                  className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1"
                                 style={{ color: 'var(--text-secondary)' }}>Type</label>
                          <select value={intervention.type}
                                  onChange={e => updateIntervention(intervention.id, 'type', e.target.value)}
                                  className="w-full p-2 border rounded-lg text-sm"
                                  style={{ borderColor: 'var(--border)' }}>
                            <option value="">Sélectionner</option>
                            {INTERVENTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1"
                                 style={{ color: 'var(--text-secondary)' }}>Composant</label>
                          <input type="text" value={intervention.component}
                                 onChange={e => updateIntervention(intervention.id, 'component', e.target.value)}
                                 className="w-full p-2 border rounded-lg text-sm"
                                 style={{ borderColor: 'var(--border)' }}
                                 placeholder="Ex: Filtre à huile" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1"
                                 style={{ color: 'var(--text-secondary)' }}>Urgence</label>
                          <select value={intervention.urgency}
                                  onChange={e => updateIntervention(intervention.id, 'urgency', e.target.value)}
                                  className="w-full p-2 border rounded-lg text-sm"
                                  style={{ borderColor: 'var(--border)' }}>
                            {URGENCY_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl p-6 border"
                   style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Estimations</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium"
                           style={{ color: 'var(--text-secondary)' }}>
                      Durée estimée (heures)
                    </label>
                    <input type="number" step="0.5" value={estimatedHours}
                           onChange={e => setEstimatedHours(e.target.value)}
                           className="w-full p-3 border rounded-lg text-sm"
                           style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                           placeholder="0" />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium"
                           style={{ color: 'var(--text-secondary)' }}>
                      Coût estimé (FCFA)
                    </label>
                    <input type="number" step="1000" value={estimatedCost}
                           onChange={e => setEstimatedCost(e.target.value)}
                           className="w-full p-3 border rounded-lg text-sm"
                           style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                           placeholder="0" />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium"
                           style={{ color: 'var(--text-secondary)' }}>
                      Priorité
                    </label>
                    <select value={priority} onChange={e => setPriority(e.target.value)}
                            className="w-full p-3 border rounded-lg text-sm"
                            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
                      <option value="faible">Faible</option>
                      <option value="moyenne">Moyenne</option>
                      <option value="haute">Haute</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-6 border"
                   style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                  Photos du diagnostic
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
                         onChange={handlePhotoChange} className="hidden" id="diag-photos" />
                  <label htmlFor="diag-photos" className="flex flex-col items-center cursor-pointer">
                    <Upload className="w-8 h-8 mb-2" style={{ color: 'var(--text-secondary)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Ajouter des photos
                    </p>
                  </label>
                </div>
              </div>

              <div className="flex gap-4">
                <button type="button" onClick={() => navigate('/mecanicien/dashboard')}
                        className="flex-1 px-6 py-3 rounded-lg border font-medium"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                        className="flex-1 px-6 py-3 rounded-lg text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                        style={{ backgroundColor: 'var(--primary)' }}>
                  <Send className="w-5 h-5" />
                  {submitting ? 'Envoi...' : 'Soumettre et créer un OT'}
                </button>
              </div>
            </form>
          </div>

          <div>
            <div className="rounded-xl p-6 border sticky top-8"
                 style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Informations véhicule
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>Immatriculation</p>
                  <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                    {breakdown.bus?.registration_number}
                  </p>
                </div>
                {(busMake || breakdown.bus?.model) && (
                  <div>
                    <p style={{ color: 'var(--text-secondary)' }}>Modèle</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {[busMake, breakdown.bus?.model].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}
                {breakdown.bus?.mileage != null && (
                  <div>
                    <p style={{ color: 'var(--text-secondary)' }}>Kilométrage</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {breakdown.bus.mileage.toLocaleString()} km
                    </p>
                  </div>
                )}
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>Type de panne</p>
                  <p className="font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                    {breakdown.breakdown_type}
                  </p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>Sévérité</p>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: breakdown.severity === 'critique' ? '#FEF2F2' : breakdown.severity === 'moyenne' ? '#FFFBEB' : '#F0FDF4',
                          color: breakdown.severity === 'critique' ? '#EF4444' : breakdown.severity === 'moyenne' ? '#F59E0B' : '#22C55E',
                        }}>
                    {breakdown.severity}
                  </span>
                </div>
                {breakdown.driver?.full_name && (
                  <div>
                    <p style={{ color: 'var(--text-secondary)' }}>Chauffeur</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {breakdown.driver.full_name}
                    </p>
                  </div>
                )}
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>Signalé le</p>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {format(new Date(breakdown.reported_at), 'dd/MM/yyyy à HH:mm')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
