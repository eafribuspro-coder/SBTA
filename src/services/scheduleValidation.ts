import { supabase } from './supabase';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BusAvailability {
  isAvailable: boolean;
  conflictScheduleId?: string;
  message?: string;
}

export interface DriverAvailability {
  isAvailable: boolean;
  conflictScheduleId?: string;
  message?: string;
  hoursToday: number;
  hoursWeek: number;
  hoursRemainingToday: number;
  hoursRemainingWeek: number;
}

export async function checkBusAvailability(
  busId: string,
  departureDateTime: string,
  arrivalDateTime: string,
  scheduleId?: string
): Promise<BusAvailability> {
  try {
    const { data, error } = await supabase
      .rpc('check_bus_availability', {
        p_bus_id: busId,
        p_departure_datetime: departureDateTime,
        p_arrival_datetime: arrivalDateTime,
        p_schedule_id: scheduleId || null
      })
      .maybeSingle();

    if (error) throw error;

    return {
      isAvailable: data?.is_available || false,
      conflictScheduleId: data?.conflict_schedule_id,
      message: data?.conflict_message
    };
  } catch (error: any) {
    console.error('Error checking bus availability:', error);
    return {
      isAvailable: false,
      message: 'Erreur lors de la vérification de disponibilité du bus'
    };
  }
}

export async function checkDriverAvailability(
  driverId: string,
  departureDateTime: string,
  arrivalDateTime: string,
  scheduleId?: string
): Promise<DriverAvailability> {
  try {
    const { data, error } = await supabase
      .rpc('check_driver_availability', {
        p_driver_id: driverId,
        p_departure_datetime: departureDateTime,
        p_arrival_datetime: arrivalDateTime,
        p_schedule_id: scheduleId || null
      })
      .maybeSingle();

    if (error) throw error;

    return {
      isAvailable: data?.is_available || false,
      conflictScheduleId: data?.conflict_schedule_id,
      message: data?.conflict_message,
      hoursToday: data?.hours_today || 0,
      hoursWeek: data?.hours_week || 0,
      hoursRemainingToday: data?.hours_remaining_today || 0,
      hoursRemainingWeek: 48 - (data?.hours_week || 0)
    };
  } catch (error: any) {
    console.error('Error checking driver availability:', error);
    return {
      isAvailable: false,
      message: 'Erreur lors de la vérification de disponibilité du chauffeur',
      hoursToday: 0,
      hoursWeek: 0,
      hoursRemainingToday: 0,
      hoursRemainingWeek: 0
    };
  }
}

export async function validateSchedule(
  routeId: string,
  busId: string,
  driverId: string,
  copilotId: string | null,
  departureDateTime: string,
  arrivalDateTime: string,
  scheduleId?: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!routeId) errors.push('Route non sélectionnée');
  if (!busId) errors.push('Bus non sélectionné');
  if (!driverId) errors.push('Chauffeur non sélectionné');
  if (!departureDateTime) errors.push('Date de départ non définie');
  if (!arrivalDateTime) errors.push('Date d\'arrivée non définie');

  if (errors.length > 0) {
    return { isValid: false, errors, warnings };
  }

  if (new Date(arrivalDateTime) <= new Date(departureDateTime)) {
    errors.push('La date d\'arrivée doit être après la date de départ');
  }

  if (copilotId && copilotId === driverId) {
    errors.push('Le chauffeur et le copilote doivent être différents');
  }

  const busAvailability = await checkBusAvailability(
    busId,
    departureDateTime,
    arrivalDateTime,
    scheduleId
  );

  if (!busAvailability.isAvailable) {
    warnings.push(`Ce bus est déjà affecté sur ce créneau.`);
  }

  const driverAvailability = await checkDriverAvailability(
    driverId,
    departureDateTime,
    arrivalDateTime,
    scheduleId
  );

  if (!driverAvailability.isAvailable) {
    warnings.push(`Ce chauffeur est déjà affecté à un autre créneau.`);
  } else {
    if (driverAvailability.hoursRemainingToday < 2) {
      warnings.push(`Attention: Il reste moins de 2h au chauffeur aujourd'hui (${driverAvailability.hoursRemainingToday.toFixed(1)}h)`);
    }

    if (driverAvailability.hoursRemainingWeek < 10) {
      warnings.push(`Attention: Il reste moins de 10h au chauffeur cette semaine (${driverAvailability.hoursRemainingWeek.toFixed(1)}h)`);
    }
  }

  if (copilotId) {
    const copilotAvailability = await checkDriverAvailability(
      copilotId,
      departureDateTime,
      arrivalDateTime,
      scheduleId
    );

    if (!copilotAvailability.isAvailable) {
      warnings.push(`Ce copilote est déjà affecté à un autre créneau.`);
    } else {
      if (copilotAvailability.hoursRemainingToday < 2) {
        warnings.push(`Attention: Il reste moins de 2h au copilote aujourd'hui (${copilotAvailability.hoursRemainingToday.toFixed(1)}h)`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export async function getAvailableBuses(
  departureDateTime: string,
  arrivalDateTime: string
): Promise<any[]> {
  if (!departureDateTime || !arrivalDateTime) return [];

  const { data: allBuses, error: busError } = await supabase
    .from('buses')
    .select('id, registration_number, model, capacity, status, company_id, companies:company_id(name)')
    .in('status', ['disponible', 'en_service'])
    .eq('is_active', true)
    .order('registration_number');

  if (busError) {
    console.error('Error fetching buses:', busError);
    throw busError;
  }

  const { data: conflictingSchedules, error: schedError } = await supabase
    .from('schedules')
    .select('bus_id')
    .lt('departure_datetime', arrivalDateTime)
    .gt('arrival_datetime', departureDateTime)
    .not('status', 'eq', 'annule');

  if (schedError) {
    console.error('Error fetching conflicting schedules:', schedError);
    throw schedError;
  }

  const busyBusIds = new Set((conflictingSchedules || []).map((s: any) => s.bus_id));

  return (allBuses || []).map((bus: any) => ({
    ...bus,
    license_plate: bus.registration_number,
    isAvailable: !busyBusIds.has(bus.id),
    availabilityMessage: busyBusIds.has(bus.id) ? 'Déjà affecté sur ce créneau' : null,
  }));
}

export async function getAvailableDrivers(
  departureDateTime: string,
  arrivalDateTime: string
): Promise<any[]> {
  try {
    const [{ data: allDrivers, error: driverError }, { data: conflictingSchedules, error: schedError }] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, phone')
        .eq('role', 'chauffeur')
        .eq('is_active', true)
        .order('full_name'),
      supabase
        .from('schedules')
        .select('driver_id, copilot_id')
        .lt('departure_datetime', arrivalDateTime)
        .gt('arrival_datetime', departureDateTime)
    ]);

    if (driverError) throw driverError;
    if (schedError) throw schedError;

    const busyDriverIds = new Set<string>();
    (conflictingSchedules || []).forEach(s => {
      if (s.driver_id) busyDriverIds.add(s.driver_id);
      if (s.copilot_id) busyDriverIds.add(s.copilot_id);
    });

    const depDate = new Date(departureDateTime);
    const arrDate = new Date(arrivalDateTime);
    const tripHours = (arrDate.getTime() - depDate.getTime()) / 3_600_000;

    const dayStart = new Date(depDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(depDate);
    dayEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(depDate);
    weekStart.setDate(depDate.getDate() - depDate.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const [{ data: dailySchedules }, { data: weeklySchedules }] = await Promise.all([
      supabase
        .from('schedules')
        .select('driver_id, copilot_id, departure_datetime, arrival_datetime')
        .gte('departure_datetime', dayStart.toISOString())
        .lte('departure_datetime', dayEnd.toISOString()),
      supabase
        .from('schedules')
        .select('driver_id, copilot_id, departure_datetime, arrival_datetime')
        .gte('departure_datetime', weekStart.toISOString())
        .lte('departure_datetime', weekEnd.toISOString())
    ]);

    const calcHours = (schedules: any[], driverId: string) =>
      (schedules || [])
        .filter(s => s.driver_id === driverId || s.copilot_id === driverId)
        .reduce((sum, s) => {
          const h = (new Date(s.arrival_datetime).getTime() - new Date(s.departure_datetime).getTime()) / 3_600_000;
          return sum + h;
        }, 0);

    const MAX_DAILY = 9;
    const MAX_WEEKLY = 48;

    return (allDrivers || [])
      .map(driver => {
        const hoursToday = calcHours(dailySchedules || [], driver.id);
        const hoursWeek = calcHours(weeklySchedules || [], driver.id);
        const hoursRemainingToday = Math.max(0, MAX_DAILY - hoursToday);
        const hoursRemainingWeek = Math.max(0, MAX_WEEKLY - hoursWeek);

        let isAvailable = !busyDriverIds.has(driver.id);
        let availabilityMessage: string | null = null;

        if (busyDriverIds.has(driver.id)) {
          availabilityMessage = 'Déjà affecté sur ce créneau';
        } else if (hoursToday + tripHours > MAX_DAILY) {
          isAvailable = false;
          availabilityMessage = `Dépassement limite quotidienne (${(hoursToday + tripHours).toFixed(1)}h / ${MAX_DAILY}h)`;
        } else if (hoursWeek + tripHours > MAX_WEEKLY) {
          isAvailable = false;
          availabilityMessage = `Dépassement limite hebdomadaire (${(hoursWeek + tripHours).toFixed(1)}h / ${MAX_WEEKLY}h)`;
        }

        return {
          ...driver,
          isAvailable,
          availabilityMessage,
          hoursToday,
          hoursWeek,
          hoursRemainingToday,
          hoursRemainingWeek
        };
      })
      .sort((a, b) => {
        if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
        return b.hoursRemainingToday - a.hoursRemainingToday;
      });
  } catch (error: any) {
    console.error('Error getting available drivers:', error);
    return [];
  }
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export function getHoursColor(remaining: number, max: number): string {
  const percentage = (remaining / max) * 100;
  if (percentage <= 20) return 'var(--danger)';
  if (percentage <= 40) return 'var(--warning)';
  return 'var(--success)';
}
