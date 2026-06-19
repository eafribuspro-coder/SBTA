import { supabase } from '../services/supabase';

export const MAX_DAILY_HOURS = 9;
export const MAX_WEEKLY_HOURS = 48;
export const ALERT_THRESHOLD = 0.8;
export const REST_REQUIRED_HOURS = 11;

interface DriverAvailabilityResult {
  available: boolean;
  reason?: 'limite_journaliere' | 'limite_hebdomadaire' | 'conflits_horaires';
  warning?: 'alerte_80_pourcent';
  remainingHours?: number;
  restUntil?: Date;
  currentDaily?: number;
  currentWeekly?: number;
}

export async function checkDriverAvailability(
  driverId: string,
  scheduleDuration: number,
  departureDate: Date
): Promise<DriverAvailabilityResult> {
  try {
    const today = new Date(departureDate);
    today.setHours(0, 0, 0, 0);

    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const { data: dailyLog, error: dailyError } = await supabase
      .from('driver_hours_log')
      .select('daily_hours, weekly_hours, last_rest_date')
      .eq('driver_id', driverId)
      .gte('date', today.toISOString())
      .lte('date', endOfDay.toISOString())
      .maybeSingle();

    if (dailyError) throw dailyError;

    const { data: weeklyLogs, error: weeklyError } = await supabase
      .from('driver_hours_log')
      .select('daily_hours')
      .eq('driver_id', driverId)
      .gte('date', startOfWeek.toISOString())
      .lte('date', endOfWeek.toISOString());

    if (weeklyError) throw weeklyError;

    const cumulDaily = dailyLog?.daily_hours || 0;
    const cumulWeekly = weeklyLogs?.reduce((sum, log) => sum + log.daily_hours, 0) || 0;

    if (cumulDaily + scheduleDuration > MAX_DAILY_HOURS) {
      const restUntil = new Date(today);
      restUntil.setHours(restUntil.getHours() + REST_REQUIRED_HOURS);

      return {
        available: false,
        reason: 'limite_journaliere',
        restUntil,
        currentDaily: cumulDaily,
        currentWeekly: cumulWeekly
      };
    }

    if (cumulWeekly + scheduleDuration > MAX_WEEKLY_HOURS) {
      const restUntil = new Date(endOfWeek);
      restUntil.setDate(restUntil.getDate() + 1);
      restUntil.setHours(0, 0, 0, 0);

      return {
        available: false,
        reason: 'limite_hebdomadaire',
        restUntil,
        currentDaily: cumulDaily,
        currentWeekly: cumulWeekly
      };
    }

    if ((cumulDaily + scheduleDuration) / MAX_DAILY_HOURS >= ALERT_THRESHOLD) {
      return {
        available: true,
        warning: 'alerte_80_pourcent',
        remainingHours: MAX_DAILY_HOURS - (cumulDaily + scheduleDuration),
        currentDaily: cumulDaily,
        currentWeekly: cumulWeekly
      };
    }

    return {
      available: true,
      currentDaily: cumulDaily,
      currentWeekly: cumulWeekly,
      remainingHours: MAX_DAILY_HOURS - cumulDaily
    };

  } catch (error) {
    console.error('Error checking driver availability:', error);
    return {
      available: false,
      reason: 'conflits_horaires'
    };
  }
}

export async function updateDriverHours(
  driverId: string,
  scheduleDate: Date,
  hoursWorked: number
): Promise<void> {
  try {
    const today = new Date(scheduleDate);
    today.setHours(0, 0, 0, 0);

    const { data: existingLog, error: fetchError } = await supabase
      .from('driver_hours_log')
      .select('*')
      .eq('driver_id', driverId)
      .eq('date', today.toISOString())
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existingLog) {
      const { error: updateError } = await supabase
        .from('driver_hours_log')
        .update({
          daily_hours: existingLog.daily_hours + hoursWorked,
          weekly_hours: existingLog.weekly_hours + hoursWorked
        })
        .eq('id', existingLog.id);

      if (updateError) throw updateError;
    } else {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const { data: weeklyLogs, error: weeklyError } = await supabase
        .from('driver_hours_log')
        .select('daily_hours')
        .eq('driver_id', driverId)
        .gte('date', startOfWeek.toISOString())
        .lte('date', endOfWeek.toISOString());

      if (weeklyError) throw weeklyError;

      const weeklyTotal = weeklyLogs?.reduce((sum, log) => sum + log.daily_hours, 0) || 0;

      const { error: insertError } = await supabase
        .from('driver_hours_log')
        .insert([{
          driver_id: driverId,
          date: today.toISOString(),
          daily_hours: hoursWorked,
          weekly_hours: weeklyTotal + hoursWorked
        }]);

      if (insertError) throw insertError;
    }

    const { data: logs } = await supabase
      .from('driver_hours_log')
      .select('daily_hours, weekly_hours')
      .eq('driver_id', driverId)
      .eq('date', today.toISOString())
      .single();

    if (logs && (logs.daily_hours >= MAX_DAILY_HOURS || logs.weekly_hours >= MAX_WEEKLY_HOURS)) {
      await supabase
        .from('users')
        .update({ status: 'repos_obligatoire' })
        .eq('id', driverId);
    }

  } catch (error) {
    console.error('Error updating driver hours:', error);
    throw error;
  }
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export function getHoursProgressColor(current: number, max: number): string {
  const percentage = (current / max) * 100;
  if (percentage >= 100) return 'var(--danger)';
  if (percentage >= 80) return 'var(--warning)';
  return 'var(--success)';
}

export async function calculateDriverHours(driverId: string): Promise<{
  todayHours: number;
  todayMax: number;
  weekHours: number;
  weekMax: number;
}> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const { data: dailyLog } = await supabase
      .from('driver_hours_log')
      .select('daily_hours')
      .eq('driver_id', driverId)
      .gte('date', today.toISOString())
      .lte('date', endOfDay.toISOString())
      .maybeSingle();

    const { data: weeklyLogs } = await supabase
      .from('driver_hours_log')
      .select('daily_hours')
      .eq('driver_id', driverId)
      .gte('date', startOfWeek.toISOString())
      .lte('date', endOfWeek.toISOString());

    const todayHours = dailyLog?.daily_hours || 0;
    const weekHours = weeklyLogs?.reduce((sum, log) => sum + log.daily_hours, 0) || 0;

    return {
      todayHours,
      todayMax: MAX_DAILY_HOURS,
      weekHours,
      weekMax: MAX_WEEKLY_HOURS
    };
  } catch (error) {
    console.error('Error calculating driver hours:', error);
    return {
      todayHours: 0,
      todayMax: MAX_DAILY_HOURS,
      weekHours: 0,
      weekMax: MAX_WEEKLY_HOURS
    };
  }
}
