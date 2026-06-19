import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { MapPin, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';

interface BreakdownReport {
  id: string;
  title: string | null;
  breakdown_type: string;
  severity: string;
  description: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_urls: string[] | null;
  photos_urls: string[] | null;
  reported_at: string;
  status: string;
  bus: {
    id: string;
    registration_number: string;
    manufacturer: string | null;
    model: string | null;
    mileage: number | null;
  } | null;
  driver: {
    full_name: string | null;
    phone: string | null;
  } | null;
  schedule: {
    route: {
      origin_station: { name: string } | null;
      destination_station: { name: string } | null;
    } | null;
  } | null;
}

interface Mechanic {
  id: string;
  full_name: string;
}

const SEVERITY_LABELS: Record<string, string> = { faible: 'Faible', moyenne: 'Moyenne', critique: 'Critique' };
const SEVERITY_COLORS: Record<string, string> = { faible: '#3B82F6', moyenne: '#F59E0B', critique: '#EF4444' };

export default function BreakdownReceive() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [breakdown, setBreakdown] = useState<BreakdownReport | null>(null);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);

  const [formData, setFormData] = useState({
    reception_notes: '',
    assigned_mechanic_id: ''
  });

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [breakdownRes, mechanicsRes] = await Promise.all([
        supabase
          .from('breakdown_reports')
          .select(`
            id, title, breakdown_type, severity, description,
            location, latitude, longitude, photo_urls, photos_urls,
            reported_at, status,
            bus:bus_id(id, registration_number, manufacturer, model, mileage),
            driver:driver_id(full_name, phone),
            schedule:schedule_id(
              route:route_id(
                origin_station:departure_station_id(name),
                destination_station:arrival_station_id(name)
              )
            )
          `)
          .eq('id', id)
          .maybeSingle(),

        supabase
          .from('users')
          .select('id, full_name')
          .eq('role', 'mecanicien')
          .eq('is_active', true)
          .order('full_name'),
      ]);

      if (breakdownRes.error) throw breakdownRes.error;
      setBreakdown((breakdownRes.data as any) || null);

      if (!mechanicsRes.error) {
        setMechanics((mechanicsRes.data as Mechanic[]) || []);
      }
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getPhotos = (): string[] => {
    if (breakdown?.photo_urls && breakdown.photo_urls.length > 0) return breakdown.photo_urls;
    if (breakdown?.photos_urls && breakdown.photos_urls.length > 0) return breakdown.photos_urls;
    return [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assigned_mechanic_id) {
      toast.error('Veuillez assigner un mécanicien');
      return;
    }
    try {
      setSubmitting(true);

      const { error: updateError } = await supabase
        .from('breakdown_reports')
        .update({ status: 'recu_garage', received_at: new Date().toISOString() })
        .eq('id', id);
      if (updateError) throw updateError;

      if (breakdown?.bus?.id) {
        await supabase.from('buses')
          .update({ status: 'diagnostic', updated_at: new Date().toISOString() })
          .eq('id', breakdown.bus.id);
      }

      toast.success('Bus reçu au garage et assigné au mécanicien');
      navigate('/garage/dashboard');
    } catch (error: any) {
      toast.error('Erreur lors de la réception');
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
        <AlertTriangle className="w-16 h-16 mx-auto mb-4" style={{ color: '#EF4444' }} />
        <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Signalement introuvable</p>
      </div>
    );
  }

  const photos = getPhotos();

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Réception du bus au garage
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Signalement N°{breakdown.id.split('-')[0].toUpperCase()}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl p-6 border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                    {breakdown.title || breakdown.breakdown_type}
                  </h2>
                  <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {breakdown.bus?.registration_number}
                    {(breakdown.bus?.manufacturer || breakdown.bus?.model) && (
                      <> — {[breakdown.bus.manufacturer, breakdown.bus.model].filter(Boolean).join(' ')}</>
                    )}
                  </p>
                </div>
                <span className="px-4 py-2 rounded-full font-bold text-sm flex-shrink-0"
                      style={{
                        backgroundColor: (SEVERITY_COLORS[breakdown.severity] || '#6B7280') + '20',
                        color: SEVERITY_COLORS[breakdown.severity] || '#6B7280'
                      }}>
                  {SEVERITY_LABELS[breakdown.severity] || breakdown.severity}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Type de panne</p>
                  <p className="font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                    {breakdown.breakdown_type}
                  </p>
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Signalé le</p>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {format(new Date(breakdown.reported_at), 'dd/MM/yyyy à HH:mm')}
                  </p>
                </div>
                {breakdown.driver && (
                  <div>
                    <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Chauffeur</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {breakdown.driver.full_name || '—'}
                    </p>
                    {breakdown.driver.phone && (
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{breakdown.driver.phone}</p>
                    )}
                  </div>
                )}
                {breakdown.bus?.mileage != null && (
                  <div>
                    <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Kilométrage</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {Number(breakdown.bus.mileage).toLocaleString()} km
                    </p>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Description</p>
                <p className="p-4 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                  {breakdown.description}
                </p>
              </div>

              {breakdown.location && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Localisation</p>
                  </div>
                  <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{breakdown.location}</p>
                  {breakdown.latitude && breakdown.longitude && (
                    <div className="p-3 rounded-lg border text-sm" style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border)' }}>
                      <p style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-semibold">GPS:</span>{' '}
                        {Number(breakdown.latitude).toFixed(6)}, {Number(breakdown.longitude).toFixed(6)}
                      </p>
                      <a href={`https://www.google.com/maps?q=${breakdown.latitude},${breakdown.longitude}`}
                         target="_blank" rel="noopener noreferrer"
                         className="text-sm underline" style={{ color: 'var(--primary)' }}>
                        Voir sur Google Maps
                      </a>
                    </div>
                  )}
                </div>
              )}

              {photos.length > 0 && (
                <div>
                  <p className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                    Photos ({photos.length})
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map((url, index) => (
                      <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={url} alt={`Photo ${index + 1}`}
                             className="w-full h-40 object-cover rounded-lg border hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="rounded-xl p-6 border sticky top-8"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
                Réception au garage
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                    Mécanicien assigné *
                  </label>
                  <select value={formData.assigned_mechanic_id}
                          onChange={e => setFormData({ ...formData, assigned_mechanic_id: e.target.value })}
                          className="w-full p-3 border rounded-lg text-sm"
                          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                          required>
                    <option value="">Sélectionner un mécanicien</option>
                    {mechanics.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                  {mechanics.length === 0 && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Aucun mécanicien disponible
                    </p>
                  )}
                </div>

                <div>
                  <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                    Notes de réception
                  </label>
                  <textarea value={formData.reception_notes}
                            onChange={e => setFormData({ ...formData, reception_notes: e.target.value })}
                            className="w-full p-3 border rounded-lg text-sm resize-none"
                            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                            rows={4}
                            placeholder="État général du bus, éléments visuels constatés..." />
                </div>

                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--info-light, #EFF6FF)' }}>
                  <p className="text-sm mb-2 font-semibold" style={{ color: 'var(--info, #2563EB)' }}>Action :</p>
                  <ul className="text-sm space-y-1" style={{ color: 'var(--info, #2563EB)' }}>
                    <li>• Bus marqué "En diagnostic"</li>
                    <li>• Mécanicien notifié</li>
                    <li>• Début du processus de diagnostic</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => navigate('/garage/dashboard')}
                          className="flex-1 px-4 py-3 rounded-lg border font-medium text-sm"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                    Annuler
                  </button>
                  <button type="submit" disabled={submitting}
                          className="flex-1 px-4 py-3 rounded-lg text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                          style={{ backgroundColor: '#22C55E' }}>
                    <CheckCircle className="w-5 h-5" />
                    {submitting ? 'Envoi...' : 'Confirmer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
