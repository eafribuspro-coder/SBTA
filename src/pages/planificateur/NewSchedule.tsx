import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import {
  ArrowLeft, MapPin, Bus, User, AlertTriangle, CheckCircle,
  Clock, Navigation, Plus, Trash2, ChevronRight
} from 'lucide-react';
import { validateSchedule, getAvailableBuses, getAvailableDrivers, formatHours } from '../../services/scheduleValidation';
import { addMinutes, format } from 'date-fns';

interface City {
  id: string;
  name: string;
}

interface Station {
  id: string;
  name: string;
  city_id: string;
  city_name?: string;
}

interface RouteStop {
  id: string;
  station_id: string;
  position: number;
  offset_minutes: number;
  cumulative_distance_km?: number;
  station?: Station;
}

interface Route {
  id: string;
  name: string;
  distance_km: number;
  estimated_duration_minutes: number;
  base_price: number;
  origin_city_id: string;
  destination_city_id: string;
  origin_station_id?: string;
  destination_station_id?: string;
  origin_city?: City;
  destination_city?: City;
  stops?: RouteStop[];
}

interface BusOption {
  id: string;
  license_plate: string;
  model: string;
  capacity: number;
  status: string;
  companies: { name: string };
  isAvailable: boolean;
  availabilityMessage?: string;
}

interface DriverOption {
  id: string;
  full_name: string;
  phone: string;
  isAvailable: boolean;
  availabilityMessage?: string;
  hoursToday: number;
  hoursWeek: number;
  hoursRemainingToday: number;
  hoursRemainingWeek: number;
}

interface TransitStop {
  station_id: string;
  station_name: string;
  arrival_offset_minutes: number;
  departure_offset_minutes: number;
  position: number;
}

export default function NewSchedule() {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultDate = location.state?.defaultDate || new Date();

  const [step, setStep] = useState(1);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<BusOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [allStations, setAllStations] = useState<Station[]>([]);

  const [formData, setFormData] = useState({
    route_id: '',
    departure_station_id: '',
    arrival_station_id: '',
    departure_datetime: format(defaultDate, "yyyy-MM-dd'T'HH:mm"),
    arrival_datetime: '',
    bus_id: '',
    driver_id: '',
    copilot_id: '',
    recurrence: 'unique' as 'unique' | 'daily' | 'weekly' | 'custom',
    recurrence_days: [] as number[],
    recurrence_end_date: ''
  });

  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [transitStops, setTransitStops] = useState<TransitStop[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBuses, setLoadingBuses] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  const formDataRef = useRef(formData);
  useEffect(() => { formDataRef.current = formData; }, [formData]);

  useEffect(() => {
    loadRoutes();
    loadAllStations();
  }, []);

  useEffect(() => {
    if (formData.route_id) {
      const route = routes.find(r => r.id === formData.route_id);
      setSelectedRoute(route || null);

      if (route) {
        setFormData(prev => ({
          ...prev,
          departure_station_id: route.origin_station_id || '',
          arrival_station_id: route.destination_station_id || '',
        }));

        const predefined: TransitStop[] = (route.stops || []).map((s, i) => ({
          station_id: s.station_id,
          station_name: s.station?.name || '',
          arrival_offset_minutes: s.offset_minutes,
          departure_offset_minutes: s.offset_minutes + 10,
          position: i + 1,
        }));
        setTransitStops(predefined);

        if (formData.departure_datetime) {
          const departureDate = new Date(formData.departure_datetime);
          const arrivalDate = addMinutes(departureDate, route.estimated_duration_minutes);
          setFormData(prev => ({
            ...prev,
            arrival_datetime: format(arrivalDate, "yyyy-MM-dd'T'HH:mm")
          }));
        }
      }
    }
  }, [formData.route_id, routes]);

  useEffect(() => {
    if (selectedRoute && formData.departure_datetime) {
      const departureDate = new Date(formData.departure_datetime);
      const arrivalDate = addMinutes(departureDate, selectedRoute.estimated_duration_minutes);
      setFormData(prev => ({
        ...prev,
        arrival_datetime: format(arrivalDate, "yyyy-MM-dd'T'HH:mm")
      }));
    }
  }, [formData.departure_datetime, selectedRoute]);


  useEffect(() => {
    const { departure_datetime, arrival_datetime } = formDataRef.current;
    if (step === 5 && departure_datetime && arrival_datetime) {
      loadAvailableBuses();
    }
    if (step === 6 && departure_datetime && arrival_datetime) {
      loadAvailableDrivers();
    }
  }, [step]);

  const loadAllStations = async () => {
    try {
      const { data } = await supabase
        .from('stations')
        .select('id, name, city_id, cities:city_id(name)')
        .eq('is_active', true)
        .order('name');
      if (data) {
        setAllStations(data.map((s: any) => ({
          ...s,
          city_name: s.cities?.name || '',
        })));
      }
    } catch (_) {}
  };

  const loadRoutes = async () => {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select(`
          id, name, distance_km, estimated_duration_minutes, base_price,
          origin_city_id, destination_city_id,
          origin_station_id, destination_station_id,
          origin_city:origin_city_id(id, name),
          destination_city:destination_city_id(id, name),
          stops:route_stops(
            id, station_id, position, offset_minutes, cumulative_distance_km,
            station:station_id(id, name, city_id)
          )
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const sorted = (data || []).map((r: any) => ({
        ...r,
        stops: (r.stops || []).sort((a: RouteStop, b: RouteStop) => a.position - b.position),
      }));
      setRoutes(sorted);
    } catch (error: any) {
      toast.error('Erreur de chargement des itinéraires');
    }
  };

  const loadAvailableBuses = async () => {
    if (!formData.departure_datetime || !formData.arrival_datetime) return;
    setLoadingBuses(true);
    try {
      const result = await getAvailableBuses(formData.departure_datetime, formData.arrival_datetime);
      setBuses(result);
    } catch (err: any) {
      console.error('loadAvailableBuses error:', err);
      toast.error(`Erreur de chargement des bus: ${err?.message || err}`);
    } finally {
      setLoadingBuses(false);
    }
  };

  const loadAvailableDrivers = async () => {
    setLoadingDrivers(true);
    try {
      const result = await getAvailableDrivers(formData.departure_datetime, formData.arrival_datetime);
      setDrivers(result);
    } catch (_) {
      toast.error('Erreur de chargement des chauffeurs');
    } finally {
      setLoadingDrivers(false);
    }
  };

  const validateScheduleForm = async (): Promise<boolean> => {
    const result = await validateSchedule(
      formData.route_id,
      formData.bus_id,
      formData.driver_id,
      formData.copilot_id || null,
      formData.departure_datetime,
      formData.arrival_datetime
    );
    setValidationErrors(result.errors);
    if (result.warnings.length > 0) {
      result.warnings.forEach(w => toast(w, { duration: 5000 }));
    }
    return result.isValid;
  };

  const addTransitStop = () => {
    setTransitStops(prev => [
      ...prev,
      {
        station_id: '',
        station_name: '',
        arrival_offset_minutes: 60,
        departure_offset_minutes: 75,
        position: prev.length + 1,
      }
    ]);
  };

  const removeTransitStop = (index: number) => {
    setTransitStops(prev =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, position: i + 1 }))
    );
  };

  const updateTransitStop = (index: number, field: keyof TransitStop, value: any) => {
    setTransitStops(prev => {
      const updated = [...prev];
      if (field === 'station_id') {
        const st = allStations.find(s => s.id === value);
        updated[index] = { ...updated[index], station_id: value, station_name: st?.name || '' };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const isValid = await validateScheduleForm();
      if (!isValid) {
        toast.error('Veuillez corriger les erreurs avant de continuer');
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('schedules')
        .insert([{
          route_id: formData.route_id,
          bus_id: formData.bus_id,
          driver_id: formData.driver_id,
          copilot_id: formData.copilot_id || null,
          departure_station_id: formData.departure_station_id || null,
          arrival_station_id: formData.arrival_station_id || null,
          departure_datetime: formData.departure_datetime,
          arrival_datetime: formData.arrival_datetime,
          status: 'planifie',
          transit_stops: transitStops.filter(s => s.station_id).map(s => ({
            station_id: s.station_id,
            station_name: s.station_name,
            arrival_offset_minutes: s.arrival_offset_minutes,
            departure_offset_minutes: s.departure_offset_minutes,
            position: s.position,
          })),
        }]);

      if (error) throw error;
      toast.success('Voyage créé avec succès');
      navigate('/planificateur/calendar');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du voyage');
    } finally {
      setLoading(false);
    }
  };

  const stationsForDeparture = selectedRoute
    ? allStations.filter(s => s.city_id === selectedRoute.origin_city_id)
    : [];

  const stationsForArrival = selectedRoute
    ? allStations.filter(s => s.city_id === selectedRoute.destination_city_id)
    : [];

  const usedStationIds = new Set([
    formData.departure_station_id,
    formData.arrival_station_id,
    ...transitStops.map(s => s.station_id),
  ]);

  const renderStep1 = () => (
    <div>
      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        Étape 1 : Sélection de l'itinéraire
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Choisissez l'itinéraire — les gares de départ et d'arrivée seront proposées à l'étape suivante.
      </p>
      <div className="space-y-3">
        {routes.map(route => (
          <div
            key={route.id}
            onClick={() => setFormData(prev => ({ ...prev, route_id: route.id }))}
            className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
              formData.route_id === route.id
                ? 'border-primary bg-primary-light'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className="flex flex-col items-center mt-1 gap-1">
                  <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: 'var(--primary)', backgroundColor: 'var(--primary)' }} />
                  <div className="w-0.5 h-6" style={{ backgroundColor: 'var(--neutral-300)' }} />
                  <MapPin className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                      {route.origin_city?.name || '—'}
                    </span>
                    <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                      {route.destination_city?.name || '—'}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{route.name}</p>
                  <div className="flex gap-4 mt-2 text-sm flex-wrap" style={{ color: 'var(--text-secondary)' }}>
                    <span>{route.distance_km} km</span>
                    <span>{formatHours(route.estimated_duration_minutes / 60)} de trajet</span>
                    {(route.stops || []).length > 0 && (
                      <span className="flex items-center gap-1">
                        <Navigation className="w-3 h-3" />
                        {(route.stops || []).length} arrêt{(route.stops || []).length > 1 ? 's' : ''} intermédiaire{(route.stops || []).length > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="font-semibold" style={{ color: 'var(--primary)' }}>
                      {route.base_price?.toLocaleString()} FCFA
                    </span>
                  </div>
                </div>
              </div>
              {formData.route_id === route.id && (
                <CheckCircle className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--primary)' }} />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-6">
        <button
          onClick={() => setStep(2)}
          disabled={!formData.route_id}
          className="px-6 py-3 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Continuer
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        Étape 2 : Gares de départ et d'arrivée
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Sélectionnez les gares correspondant aux villes de l'itinéraire choisi.
      </p>

      {selectedRoute && (
        <div className="mb-6 p-4 rounded-xl border" style={{ backgroundColor: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Itinéraire</p>
              <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {selectedRoute.origin_city?.name} → {selectedRoute.destination_city?.name}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block mb-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
            Gare de départ ({selectedRoute?.origin_city?.name}) *
          </label>
          <select
            value={formData.departure_station_id}
            onChange={(e) => setFormData(prev => ({ ...prev, departure_station_id: e.target.value }))}
            className="w-full p-3 border rounded-xl"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
          >
            <option value="">Choisir une gare...</option>
            {stationsForDeparture.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            {stationsForDeparture.length === 0 && (
              <option disabled>Aucune gare dans cette ville</option>
            )}
          </select>
          {stationsForDeparture.length === 0 && (
            <p className="text-xs mt-1" style={{ color: 'var(--warning)' }}>
              Aucune gare enregistrée pour {selectedRoute?.origin_city?.name}. Ajoutez-en une dans Administration &gt; Gares.
            </p>
          )}
        </div>

        <div>
          <label className="block mb-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
            Gare d'arrivée ({selectedRoute?.destination_city?.name}) *
          </label>
          <select
            value={formData.arrival_station_id}
            onChange={(e) => setFormData(prev => ({ ...prev, arrival_station_id: e.target.value }))}
            className="w-full p-3 border rounded-xl"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
          >
            <option value="">Choisir une gare...</option>
            {stationsForArrival.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            {stationsForArrival.length === 0 && (
              <option disabled>Aucune gare dans cette ville</option>
            )}
          </select>
          {stationsForArrival.length === 0 && (
            <p className="text-xs mt-1" style={{ color: 'var(--warning)' }}>
              Aucune gare enregistrée pour {selectedRoute?.destination_city?.name}.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        <button onClick={() => setStep(1)} className="px-6 py-3 rounded-lg border">Retour</button>
        <button
          onClick={() => setStep(3)}
          disabled={!formData.departure_station_id || !formData.arrival_station_id}
          className="px-6 py-3 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Continuer
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        Étape 3 : Points de transit (optionnel)
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Ajoutez des arrêts intermédiaires entre le départ et l'arrivée. L'ordre définit la séquence réelle du voyage.
      </p>

      <div className="mb-4 p-3 rounded-xl flex items-center gap-3 border" style={{ backgroundColor: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {allStations.find(s => s.id === formData.departure_station_id)?.name || '—'}
          </span>
        </div>
        <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>transits...</span>
        <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {allStations.find(s => s.id === formData.arrival_station_id)?.name || '—'}
          </span>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {transitStops.map((stop, index) => (
          <div key={index} className="p-4 border rounded-xl" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: 'var(--primary)' }}>
                {index + 1}
              </div>
              <span className="font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>Arrêt intermédiaire</span>
              <button
                onClick={() => removeTransitStop(index)}
                className="ml-auto p-1 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 sm:col-span-1">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Gare</label>
                <select
                  value={stop.station_id}
                  onChange={(e) => updateTransitStop(index, 'station_id', e.target.value)}
                  className="w-full p-2 border rounded-lg text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                >
                  <option value="">Choisir une gare...</option>
                  {allStations
                    .filter(s => !usedStationIds.has(s.id) || s.id === stop.station_id)
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.city_name})</option>
                    ))
                  }
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Arrivée (min)</label>
                <input
                  type="number"
                  min={1}
                  value={stop.arrival_offset_minutes}
                  onChange={(e) => updateTransitStop(index, 'arrival_offset_minutes', parseInt(e.target.value))}
                  className="w-full p-2 border rounded-lg text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                />
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>après départ</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Départ (min)</label>
                <input
                  type="number"
                  min={1}
                  value={stop.departure_offset_minutes}
                  onChange={(e) => updateTransitStop(index, 'departure_offset_minutes', parseInt(e.target.value))}
                  className="w-full p-2 border rounded-lg text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                />
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>après départ</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addTransitStop}
        className="flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-xl text-sm font-medium transition-colors hover:bg-gray-50 w-full justify-center"
        style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
      >
        <Plus className="w-4 h-4" />
        Ajouter un point de transit
      </button>

      <div className="flex gap-4 mt-6">
        <button onClick={() => setStep(2)} className="px-6 py-3 rounded-lg border">Retour</button>
        <button
          onClick={() => setStep(4)}
          className="px-6 py-3 rounded-lg text-white font-medium"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Continuer
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div>
      <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        Étape 4 : Date et heure de départ
      </h2>
      <div className="space-y-6">
        <div>
          <label className="block mb-2 font-medium">Date et heure de départ *</label>
          <input
            type="datetime-local"
            value={formData.departure_datetime}
            onChange={(e) => setFormData(prev => ({ ...prev, departure_datetime: e.target.value }))}
            className="w-full p-3 border rounded-lg"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
            required
          />
        </div>

        {selectedRoute && formData.departure_datetime && (
          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--primary-light)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              <span className="font-semibold">Heure d'arrivée estimée</span>
            </div>
            <p className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
              {formData.arrival_datetime ? format(new Date(formData.arrival_datetime), 'dd/MM/yyyy à HH:mm') : '—'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Durée du trajet : {formatHours(selectedRoute.estimated_duration_minutes / 60)}
            </p>
            {transitStops.filter(s => s.station_id).length > 0 && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--primary)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--primary)' }}>Passages aux arrêts :</p>
                {transitStops.filter(s => s.station_id).map((s, i) => {
                  const dep = new Date(formData.departure_datetime);
                  const arrivalTime = addMinutes(dep, s.arrival_offset_minutes);
                  return (
                    <p key={i} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {s.station_name || '—'} — arrivée {format(arrivalTime, 'HH:mm')}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-4 mt-6">
        <button onClick={() => setStep(3)} className="px-6 py-3 rounded-lg border">Retour</button>
        <button
          onClick={() => setStep(5)}
          disabled={!formData.departure_datetime}
          className="px-6 py-3 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Continuer
        </button>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Étape 5 : Sélection du bus</h2>
        <button
          onClick={loadAvailableBuses}
          disabled={loadingBuses}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          <Clock className="w-4 h-4" />
          Rafraîchir
        </button>
      </div>

      {loadingBuses ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 rounded-full animate-spin"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <span className="ml-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Vérification des disponibilités...
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {buses.map(bus => (
            <div
              key={bus.id}
              onClick={() => bus.isAvailable && setFormData(prev => ({ ...prev, bus_id: bus.id }))}
              className={`p-4 border-2 rounded-xl transition-all ${
                !bus.isAvailable
                  ? 'opacity-50 cursor-not-allowed'
                  : formData.bus_id === bus.id
                  ? 'cursor-pointer'
                  : 'border-gray-200 hover:border-gray-300 cursor-pointer'
              }`}
              style={
                formData.bus_id === bus.id
                  ? { borderColor: 'var(--primary)', backgroundColor: 'var(--primary-light, #E8F5E9)' }
                  : !bus.isAvailable
                  ? { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }
                  : {}
              }
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Bus className="w-5 h-5 mt-1 flex-shrink-0"
                       style={{ color: bus.isAvailable ? 'var(--primary)' : '#9CA3AF' }} />
                  <div>
                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                      {bus.license_plate}
                    </p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {[bus.companies?.name, bus.capacity ? `${bus.capacity} places` : null, bus.model]
                        .filter(Boolean).join(' • ')}
                    </p>
                    <p className="text-sm mt-1 font-medium"
                       style={{ color: bus.isAvailable ? '#16A34A' : '#DC2626' }}>
                      {bus.isAvailable ? 'Disponible sur ce créneau' : bus.availabilityMessage || 'Non disponible'}
                    </p>
                  </div>
                </div>
                {formData.bus_id === bus.id && (
                  <CheckCircle className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                )}
              </div>
            </div>
          ))}

          {buses.length === 0 && (
            <div className="text-center py-10 rounded-xl border-2 border-dashed"
                 style={{ borderColor: 'var(--border)' }}>
              <Bus className="w-10 h-10 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                Aucun bus disponible pour ce créneau
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Vérifiez la date ou cliquez sur Rafraîchir
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4 mt-6">
        <button onClick={() => setStep(4)}
                className="px-6 py-3 rounded-lg border text-sm font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
          Retour
        </button>
        <button
          onClick={() => setStep(6)}
          disabled={!formData.bus_id}
          className="px-6 py-3 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Continuer
        </button>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Étape 6 : Chauffeur et confirmation</h2>
        <button
          onClick={loadAvailableDrivers}
          disabled={loadingDrivers}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          <Clock className="w-4 h-4" />
          Rafraîchir
        </button>
      </div>

      {loadingDrivers ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 rounded-full animate-spin"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <span className="ml-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Vérification des disponibilités...
          </span>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {drivers.map(driver => {
            const pct = Math.min(100, (driver.hoursRemainingToday / 9) * 100);
            const showWarning = driver.isAvailable && pct < 20;
            return (
              <div
                key={driver.id}
                onClick={() => driver.isAvailable && setFormData(prev => ({ ...prev, driver_id: driver.id }))}
                className={`p-4 border-2 rounded-xl transition-all ${
                  !driver.isAvailable ? 'opacity-50 cursor-not-allowed' :
                  formData.driver_id === driver.id ? 'cursor-pointer' :
                  'border-gray-200 hover:border-gray-300 cursor-pointer'
                }`}
                style={
                  formData.driver_id === driver.id
                    ? { borderColor: 'var(--primary)', backgroundColor: 'var(--primary-light, #E8F5E9)' }
                    : !driver.isAvailable
                    ? { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }
                    : {}
                }
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <User className="w-5 h-5 mt-1 flex-shrink-0"
                          style={{ color: driver.isAvailable ? 'var(--primary)' : '#9CA3AF' }} />
                    <div className="flex-1">
                      <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                        {driver.full_name}
                      </p>
                      {driver.isAvailable ? (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span style={{ color: 'var(--text-secondary)' }}>Aujourd'hui :</span>
                            <span className="font-semibold"
                                  style={{ color: driver.hoursRemainingToday < 2 ? '#DC2626' : '#16A34A' }}>
                              {formatHours(driver.hoursRemainingToday)} restantes
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                            <div className="h-full rounded-full"
                                 style={{
                                   width: `${pct}%`,
                                   backgroundColor: pct < 20 ? '#DC2626' : pct < 50 ? '#F59E0B' : '#16A34A',
                                 }} />
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span style={{ color: 'var(--text-secondary)' }}>Cette semaine :</span>
                            <span className="font-semibold"
                                  style={{ color: driver.hoursRemainingWeek < 10 ? '#DC2626' : '#16A34A' }}>
                              {formatHours(driver.hoursRemainingWeek)} restantes
                            </span>
                          </div>
                          {showWarning && (
                            <div className="flex items-center gap-1 text-xs font-medium mt-1"
                                 style={{ color: '#D97706' }}>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Moins de 20% des heures journalières disponibles
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm mt-1 font-medium" style={{ color: '#DC2626' }}>
                          {driver.availabilityMessage || 'Non disponible sur ce créneau'}
                        </p>
                      )}
                    </div>
                  </div>
                  {formData.driver_id === driver.id && (
                    <CheckCircle className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                  )}
                </div>
              </div>
            );
          })}

          {drivers.length === 0 && (
            <div className="text-center py-10 rounded-xl border-2 border-dashed"
                 style={{ borderColor: 'var(--border)' }}>
              <User className="w-10 h-10 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                Aucun chauffeur disponible pour ce créneau
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Vérifiez la date ou cliquez sur Rafraîchir
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mb-6">
        <label className="block mb-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Copilote (optionnel)
        </label>
        <select
          value={formData.copilot_id}
          onChange={(e) => setFormData(prev => ({ ...prev, copilot_id: e.target.value }))}
          className="w-full p-3 border rounded-lg text-sm"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
        >
          <option value="">Aucun copilote</option>
          {drivers.filter(d => d.isAvailable && d.id !== formData.driver_id).map(driver => (
            <option key={driver.id} value={driver.id}>
              {driver.full_name} — {formatHours(driver.hoursRemainingToday)} restantes
            </option>
          ))}
        </select>
      </div>

      {validationErrors.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border-2"
             style={{ backgroundColor: '#FEF2F2', borderColor: '#EF4444' }}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#EF4444' }} />
            <div>
              <p className="font-semibold mb-2 text-sm" style={{ color: '#EF4444' }}>Erreurs de validation :</p>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((err, idx) => (
                  <li key={idx} className="text-sm" style={{ color: '#DC2626' }}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 mt-6">
        <button onClick={() => setStep(5)}
                className="px-6 py-3 rounded-lg border text-sm font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
          Retour
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !formData.driver_id}
          className="flex-1 px-6 py-3 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          {loading ? 'Création en cours...' : 'Créer le voyage'}
        </button>
      </div>
    </div>
  );

  const STEPS = ['Itinéraire', 'Gares', 'Transits', 'Horaire', 'Bus', 'Chauffeur'];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/planificateur/calendar')}
        className="flex items-center gap-2 mb-6 text-sm hover:underline"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au calendrier
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Nouveau voyage
        </h1>
        <div className="flex gap-1 mt-4">
          {STEPS.map((label, i) => {
            const s = i + 1;
            const active = s === step;
            const done = s < step;
            return (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full h-2 rounded-full transition-all"
                  style={{ backgroundColor: done || active ? 'var(--primary)' : 'var(--neutral-200)' }}
                />
                <span className="text-xs hidden sm:block" style={{ color: active ? 'var(--primary)' : 'var(--text-muted)', fontWeight: active ? 700 : 400 }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-8 border shadow-sm">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
        {step === 6 && renderStep6()}
      </div>
    </div>
  );
}
