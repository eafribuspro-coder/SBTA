import React, { useState, useEffect } from 'react';
import { Calendar, Plus, CreditCard as Edit2, Trash2, Bus, Route as RouteIcon, Clock, User } from 'lucide-react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface RouteData {
  id: string;
  name: string;
}

interface BusData {
  id: string;
  registration_number: string;
  capacity: number;
}

interface Driver {
  id: string;
  full_name: string;
}

interface Schedule {
  id: string;
  route_id: string;
  route_name: string;
  bus_id: string;
  driver_id: string;
  copilot_id?: string;
  departure_datetime: string;
  arrival_datetime: string;
  price: number;
  seats_available: number;
  seats_reserved: number;
  fill_rate: number;
  status: 'planifie' | 'en_cours' | 'termine' | 'annule';
  routes?: { name: string };
  buses?: { registration_number: string };
  drivers?: { full_name: string };
  copilots?: { full_name: string };
}

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [buses, setBuses] = useState<BusData[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    route_id: '',
    bus_id: '',
    driver_id: '',
    copilot_id: '',
    departure_datetime: '',
    arrival_datetime: '',
    price: 0,
    status: 'planifie' as 'planifie' | 'en_cours' | 'termine' | 'annule'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [schedulesRes, routesRes, busesRes, driversRes] = await Promise.all([
        supabase
          .from('schedules')
          .select(`
            *,
            routes(name),
            buses:bus_id(registration_number),
            drivers:driver_id(full_name),
            copilots:copilot_id(full_name)
          `)
          .order('departure_datetime', { ascending: false }),
        supabase.from('routes').select('id, name').eq('is_active', true).order('name'),
        supabase.from('buses').select('id, registration_number, capacity').eq('status', 'disponible').order('registration_number'),
        supabase.from('users').select('id, full_name').eq('role', 'chauffeur').eq('is_active', true).order('full_name')
      ]);

      if (schedulesRes.error) throw schedulesRes.error;
      if (routesRes.error) throw routesRes.error;
      if (busesRes.error) throw busesRes.error;
      if (driversRes.error) throw driversRes.error;

      setSchedules(schedulesRes.data || []);
      setRoutes(routesRes.data || []);
      setBuses(busesRes.data || []);
      setDrivers(driversRes.data || []);
    } catch (error: any) {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        route_id: formData.route_id,
        bus_id: formData.bus_id,
        driver_id: formData.driver_id,
        copilot_id: formData.copilot_id || null,
        departure_datetime: formData.departure_datetime,
        arrival_datetime: formData.arrival_datetime,
        price: formData.price,
        status: formData.status
      };

      if (editingId) {
        const { error } = await supabase
          .from('schedules')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Horaire mis à jour');
      } else {
        const { error } = await supabase
          .from('schedules')
          .insert([payload]);

        if (error) throw error;
        toast.success('Horaire créé');
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast.error(error.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setFormData({
      route_id: schedule.route_id,
      bus_id: schedule.bus_id,
      driver_id: schedule.driver_id,
      copilot_id: schedule.copilot_id || '',
      departure_datetime: schedule.departure_datetime,
      arrival_datetime: schedule.arrival_datetime,
      price: schedule.price,
      status: schedule.status
    });
    setEditingId(schedule.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cet horaire?')) return;

    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Horaire supprimé');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      route_id: '',
      bus_id: '',
      driver_id: '',
      copilot_id: '',
      departure_datetime: '',
      arrival_datetime: '',
      price: 0,
      status: 'planifie'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planifie': return { bg: 'var(--primary-light)', text: 'var(--primary)' };
      case 'en_cours': return { bg: 'var(--warning-light)', text: 'var(--warning)' };
      case 'termine': return { bg: 'var(--success-light)', text: 'var(--success)' };
      case 'annule': return { bg: 'var(--danger-light)', text: 'var(--danger)' };
      default: return { bg: 'var(--neutral-200)', text: 'var(--neutral-600)' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'planifie': return 'Planifié';
      case 'en_cours': return 'En cours';
      case 'termine': return 'Terminé';
      case 'annule': return 'Annulé';
      default: return status;
    }
  };

  if (loading) {
    return <div className="p-8">Chargement...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Planification
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {schedules.length} horaires au total
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-6 py-3 rounded-lg flex items-center gap-2 text-white font-medium"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Plus className="w-5 h-5" />
          Nouvel horaire
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl my-8">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold">
                {editingId ? 'Modifier' : 'Nouvel'} horaire
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 font-medium">Itinéraire *</label>
                  <select
                    value={formData.route_id}
                    onChange={(e) => setFormData({ ...formData, route_id: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    required
                  >
                    <option value="">Sélectionner un itinéraire</option>
                    {routes.map(route => (
                      <option key={route.id} value={route.id}>{route.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 font-medium">Bus *</label>
                    <select
                      value={formData.bus_id}
                      onChange={(e) => setFormData({ ...formData, bus_id: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                      required
                    >
                      <option value="">Sélectionner un bus</option>
                      {buses.map(bus => (
                        <option key={bus.id} value={bus.id}>
                          {bus.registration_number} ({bus.capacity} places)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2 font-medium">Chauffeur *</label>
                    <select
                      value={formData.driver_id}
                      onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                      required
                    >
                      <option value="">Sélectionner un chauffeur</option>
                      {drivers.map(driver => (
                        <option key={driver.id} value={driver.id}>{driver.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block mb-2 font-medium">Copilote (optionnel)</label>
                  <select
                    value={formData.copilot_id}
                    onChange={(e) => setFormData({ ...formData, copilot_id: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                  >
                    <option value="">Aucun copilote</option>
                    {drivers.filter(d => d.id !== formData.driver_id).map(driver => (
                      <option key={driver.id} value={driver.id}>{driver.full_name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 font-medium">Date et heure de départ *</label>
                    <input
                      type="datetime-local"
                      value={formData.departure_datetime}
                      onChange={(e) => setFormData({ ...formData, departure_datetime: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                      required
                    />
                  </div>

                  <div>
                    <label className="block mb-2 font-medium">Date et heure d'arrivée *</label>
                    <input
                      type="datetime-local"
                      value={formData.arrival_datetime}
                      onChange={(e) => setFormData({ ...formData, arrival_datetime: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-2 font-medium">Prix du billet (FCFA) *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-3 border rounded-lg"
                    min="0"
                    step="100"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Statut</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full p-3 border rounded-lg"
                  >
                    <option value="planifie">Planifié</option>
                    <option value="en_cours">En cours</option>
                    <option value="termine">Terminé</option>
                    <option value="annule">Annulé</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-lg text-white font-medium"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {editingId ? 'Mettre à jour' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
                  className="px-6 py-3 rounded-lg border"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead style={{ backgroundColor: 'var(--neutral-100)' }}>
            <tr>
              <th className="text-left p-4 font-semibold">Itinéraire</th>
              <th className="text-left p-4 font-semibold">Bus</th>
              <th className="text-left p-4 font-semibold">Chauffeur</th>
              <th className="text-left p-4 font-semibold">Départ</th>
              <th className="text-left p-4 font-semibold">Arrivée</th>
              <th className="text-left p-4 font-semibold">Occupation</th>
              <th className="text-left p-4 font-semibold">Prix</th>
              <th className="text-left p-4 font-semibold">Statut</th>
              <th className="text-left p-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule) => {
              const statusColors = getStatusColor(schedule.status);
              return (
                <tr key={schedule.id} className="border-t hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <RouteIcon className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                      <span className="font-medium">{schedule.route_name || schedule.routes?.name || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Bus className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                      {schedule.buses?.registration_number || 'N/A'}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                      <div>
                        <div className="font-medium">{schedule.drivers?.full_name || 'N/A'}</div>
                        {schedule.copilots?.full_name && (
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            Copilote: {schedule.copilots.full_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                      <div>
                        <div className="text-sm font-medium">
                          {format(new Date(schedule.departure_datetime), 'HH:mm')}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {format(new Date(schedule.departure_datetime), 'dd/MM/yyyy')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-medium">
                      {format(new Date(schedule.arrival_datetime), 'HH:mm')}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {format(new Date(schedule.arrival_datetime), 'dd/MM/yyyy')}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      <div className="font-medium">{schedule.seats_reserved || 0}/{schedule.seats_available || 0}</div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {schedule.fill_rate?.toFixed(0) || 0}% rempli
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium">{schedule.price?.toLocaleString() || 0} FCFA</div>
                  </td>
                  <td className="p-4">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: statusColors.bg,
                        color: statusColors.text
                      }}
                    >
                      {getStatusLabel(schedule.status)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(schedule)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                      </button>
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" style={{ color: 'var(--danger)' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {schedules.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--neutral-400)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Aucun horaire trouvé</p>
          </div>
        )}
      </div>
    </div>
  );
}
