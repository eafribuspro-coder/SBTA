import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { CalendarClock, RefreshCw, AlertTriangle, CheckCircle, Wrench, Plus, X } from 'lucide-react';
import { format, addDays, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BusMaintenance {
  id: string;
  registration_number: string;
  manufacturer: string | null;
  brand: string | null;
  model: string | null;
  mileage: number | null;
  last_maintenance_date: string | null;
  next_maintenance_due: string | null;
  status: string;
}

interface PlannedMaintenance {
  id: string;
  bus_id: string;
  scheduled_date: string;
  maintenance_type: string;
  notes: string | null;
  status: string;
  bus: {
    registration_number: string;
    manufacturer: string | null;
    brand: string | null;
    model: string | null;
  } | null;
}

type UrgencyLevel = 'overdue' | 'critical' | 'soon' | 'ok';

function getUrgency(bus: BusMaintenance): UrgencyLevel {
  if (bus.next_maintenance_due) {
    const daysUntil = differenceInDays(parseISO(bus.next_maintenance_due), new Date());
    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 7) return 'critical';
    if (daysUntil <= 30) return 'soon';
    return 'ok';
  }
  if (bus.last_maintenance_date) {
    const daysSince = differenceInDays(new Date(), parseISO(bus.last_maintenance_date));
    if (daysSince > 180) return 'overdue';
    if (daysSince > 150) return 'critical';
    if (daysSince > 120) return 'soon';
    return 'ok';
  }
  return 'ok';
}

const URGENCY_CONFIG: Record<UrgencyLevel, { label: string; color: string; bg: string }> = {
  overdue:  { label: 'Dépassé',  color: '#EF4444', bg: '#FEF2F2' },
  critical: { label: 'Critique', color: '#DC2626', bg: '#FEF2F2' },
  soon:     { label: 'Bientôt',  color: '#F59E0B', bg: '#FFFBEB' },
  ok:       { label: 'OK',       color: '#22C55E', bg: '#F0FDF4' },
};

function busLabel(bus: BusMaintenance | PlannedMaintenance['bus']): string {
  if (!bus) return '';
  const make = (bus as any).manufacturer || (bus as any).brand || '';
  return [make, bus.model].filter(Boolean).join(' ');
}

export default function GarageMaintenanceSchedule() {
  const [loading, setLoading] = useState(true);
  const [buses, setBuses] = useState<BusMaintenance[]>([]);
  const [planned, setPlanned] = useState<PlannedMaintenance[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'planning'>('alerts');

  const [formData, setFormData] = useState({
    bus_id: '',
    scheduled_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    maintenance_type: 'vidange',
    notes: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [busRes, planRes] = await Promise.all([
        supabase
          .from('buses')
          .select('id, registration_number, manufacturer, brand, model, mileage, last_maintenance_date, next_maintenance_due, status')
          .not('status', 'eq', 'hors_service')
          .order('registration_number'),
        supabase
          .from('planned_maintenances')
          .select(`
            id, bus_id, scheduled_date, maintenance_type, notes, status,
            bus:bus_id (registration_number, manufacturer, brand, model)
          `)
          .gte('scheduled_date', format(new Date(), 'yyyy-MM-dd'))
          .order('scheduled_date')
          .limit(50),
      ]);

      if (!busRes.error) setBuses((busRes.data as BusMaintenance[]) || []);
      if (!planRes.error) setPlanned((planRes.data as PlannedMaintenance[]) || []);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bus_id) {
      toast.error('Veuillez sélectionner un bus');
      return;
    }
    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('planned_maintenances')
        .insert({
          bus_id: formData.bus_id,
          scheduled_date: formData.scheduled_date,
          maintenance_type: formData.maintenance_type,
          notes: formData.notes || null,
          status: 'planifie',
        });

      if (error) throw error;
      toast.success('Maintenance planifiée');
      setShowModal(false);
      setFormData({
        bus_id: '',
        scheduled_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        maintenance_type: 'vidange',
        notes: '',
      });
      loadData();
    } catch (error: any) {
      toast.error('Erreur lors de la planification');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const alertBuses = buses
    .map(b => ({ ...b, urgency: getUrgency(b) }))
    .filter(b => b.urgency !== 'ok')
    .sort((a, b) => {
      const order: UrgencyLevel[] = ['overdue', 'critical', 'soon'];
      return order.indexOf(a.urgency) - order.indexOf(b.urgency);
    });

  const allBuses = buses.map(b => ({ ...b, urgency: getUrgency(b) }));

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Planning maintenance
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Suivi préventif et planification des interventions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData}
                  className="px-4 py-2 rounded-lg border flex items-center gap-2 text-sm font-medium"
                  style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
          <button onClick={() => setShowModal(true)}
                  className="px-4 py-2 rounded-lg text-white flex items-center gap-2 text-sm font-medium"
                  style={{ backgroundColor: 'var(--primary)' }}>
            <Plus className="w-4 h-4" /> Planifier
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Dépassé',  value: buses.filter(b => getUrgency(b) === 'overdue').length,  color: '#EF4444' },
          { label: 'Critique', value: buses.filter(b => getUrgency(b) === 'critical').length, color: '#DC2626' },
          { label: 'Bientôt',  value: buses.filter(b => getUrgency(b) === 'soon').length,     color: '#F59E0B' },
          { label: 'À jour',   value: buses.filter(b => getUrgency(b) === 'ok').length,       color: '#22C55E' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border p-4"
               style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{ backgroundColor: 'var(--bg-subtle)' }}>
        {([
          { key: 'alerts', label: 'Alertes préventives' },
          { key: 'planning', label: 'Planning à venir' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: activeTab === tab.key ? 'var(--surface)' : 'transparent',
                    color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
        </div>
      ) : activeTab === 'alerts' ? (
        alertBuses.length === 0 ? (
          <div className="rounded-xl border py-16 text-center"
               style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <CheckCircle className="w-14 h-14 mx-auto mb-4" style={{ color: '#22C55E' }} />
            <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
              Tous les bus sont à jour
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Aucune maintenance urgente détectée
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alertBuses.map(bus => {
              const urgencyConf = URGENCY_CONFIG[bus.urgency];
              let daysInfo = '';
              if (bus.next_maintenance_due) {
                const d = differenceInDays(parseISO(bus.next_maintenance_due), new Date());
                daysInfo = d < 0 ? `${Math.abs(d)} j de retard` : `dans ${d} j`;
              } else if (bus.last_maintenance_date) {
                const d = differenceInDays(new Date(), parseISO(bus.last_maintenance_date));
                daysInfo = `${d} j depuis dernière maintenance`;
              }
              return (
                <div key={bus.id} className="rounded-xl border p-5"
                     style={{ backgroundColor: urgencyConf.bg, borderColor: urgencyConf.color + '40' }}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                           style={{ backgroundColor: urgencyConf.color + '20' }}>
                        <AlertTriangle className="w-5 h-5" style={{ color: urgencyConf.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                            {bus.registration_number}
                          </p>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{ backgroundColor: urgencyConf.color + '20', color: urgencyConf.color }}>
                            {urgencyConf.label}
                          </span>
                        </div>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {busLabel(bus)}
                        </p>
                        {bus.last_maintenance_date && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Dernière maintenance: {format(parseISO(bus.last_maintenance_date), 'dd/MM/yyyy')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {bus.mileage != null && (
                        <p className="text-xl font-bold" style={{ color: urgencyConf.color }}>
                          {bus.mileage.toLocaleString()} km
                        </p>
                      )}
                      {daysInfo && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{daysInfo}</p>
                      )}
                      {bus.next_maintenance_due && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          Échéance: {format(parseISO(bus.next_maintenance_due), 'dd/MM/yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        planned.length === 0 ? (
          <div className="rounded-xl border py-16 text-center"
               style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <CalendarClock className="w-14 h-14 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
              Aucune maintenance planifiée
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Planifiez des interventions de maintenance préventive
            </p>
            <button onClick={() => setShowModal(true)}
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium inline-flex items-center gap-2"
                    style={{ backgroundColor: 'var(--primary)' }}>
              <Plus className="w-4 h-4" /> Planifier une maintenance
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {planned.map(pm => (
              <div key={pm.id}
                   className="rounded-xl border p-5 flex items-center justify-between gap-4"
                   style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ backgroundColor: 'var(--primary-light)' }}>
                    <Wrench className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {pm.bus?.registration_number}
                      {busLabel(pm.bus) ? ` — ${busLabel(pm.bus)}` : ''}
                    </p>
                    <p className="text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>
                      {pm.maintenance_type.replace(/_/g, ' ')}
                    </p>
                    {pm.notes && (
                      <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                        {pm.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    {format(parseISO(pm.scheduled_date), 'dd MMM yyyy', { locale: fr })}
                  </p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: pm.status === 'planifie' ? '#EFF6FF' : '#F0FDF4',
                          color: pm.status === 'planifie' ? '#2563EB' : '#16A34A'
                        }}>
                    {pm.status === 'planifie' ? 'Planifié' : 'Terminé'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl shadow-xl"
               style={{ backgroundColor: 'var(--surface)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Planifier une maintenance
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
            <form onSubmit={handlePlanSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Bus *
                </label>
                <select value={formData.bus_id}
                        onChange={e => setFormData({ ...formData, bus_id: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border text-sm"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                        required>
                  <option value="">Sélectionner un bus</option>
                  {allBuses.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.registration_number}{busLabel(b) ? ` — ${busLabel(b)}` : ''}
                      {b.urgency !== 'ok' ? ` (${URGENCY_CONFIG[b.urgency].label})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Date planifiée *
                </label>
                <input type="date" value={formData.scheduled_date}
                       onChange={e => setFormData({ ...formData, scheduled_date: e.target.value })}
                       min={format(new Date(), 'yyyy-MM-dd')}
                       className="w-full px-3 py-2.5 rounded-lg border text-sm"
                       style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                       required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Type de maintenance *
                </label>
                <select value={formData.maintenance_type}
                        onChange={e => setFormData({ ...formData, maintenance_type: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border text-sm"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
                  <option value="vidange">Vidange</option>
                  <option value="revision_generale">Révision générale</option>
                  <option value="freins">Freins</option>
                  <option value="pneus">Pneus</option>
                  <option value="filtres">Filtres</option>
                  <option value="courroies">Courroies</option>
                  <option value="climatisation">Climatisation</option>
                  <option value="electrique">Système électrique</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Notes (optionnel)
                </label>
                <textarea value={formData.notes}
                          onChange={e => setFormData({ ...formData, notes: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-lg border text-sm resize-none"
                          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                          rows={3}
                          placeholder="Détails supplémentaires..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                        className="flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                        className="flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-bold disabled:opacity-50"
                        style={{ backgroundColor: 'var(--primary)' }}>
                  {submitting ? 'Planification...' : 'Planifier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
