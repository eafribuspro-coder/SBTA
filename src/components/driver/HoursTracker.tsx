import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { MAX_DAILY_HOURS, MAX_WEEKLY_HOURS, formatHours, getHoursProgressColor } from '../../utils/driverHoursCalc';
import { Clock, AlertTriangle } from 'lucide-react';

interface HoursTrackerProps {
  driverId: string;
  showTitle?: boolean;
}

export default function HoursTracker({ driverId, showTitle = true }: HoursTrackerProps) {
  const [dailyHours, setDailyHours] = useState(0);
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHours();

    const subscription = supabase
      .channel(`driver_hours_${driverId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'driver_hours_log',
        filter: `driver_id=eq.${driverId}`
      }, () => {
        loadHours();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [driverId]);

  const loadHours = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('driver_hours_log')
        .select('daily_hours, weekly_hours')
        .eq('driver_id', driverId)
        .gte('date', today.toISOString())
        .maybeSingle();

      if (error) throw error;

      setDailyHours(data?.daily_hours || 0);
      setWeeklyHours(data?.weekly_hours || 0);
    } catch (error) {
      console.error('Error loading driver hours:', error);
    } finally {
      setLoading(false);
    }
  };

  const dailyPercentage = (dailyHours / MAX_DAILY_HOURS) * 100;
  const weeklyPercentage = (weeklyHours / MAX_WEEKLY_HOURS) * 100;

  const getDailyStatus = () => {
    if (dailyPercentage >= 100) return { text: 'Limite atteinte', color: 'var(--danger)', icon: true };
    if (dailyPercentage >= 80) return { text: 'Attention', color: 'var(--warning)', icon: true };
    return { text: 'Normal', color: 'var(--success)', icon: false };
  };

  const getWeeklyStatus = () => {
    if (weeklyPercentage >= 100) return { text: 'Limite atteinte', color: 'var(--danger)', icon: true };
    if (weeklyPercentage >= 80) return { text: 'Attention', color: 'var(--warning)', icon: true };
    return { text: 'Normal', color: 'var(--success)', icon: false };
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-xl border">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
          <div className="h-8 bg-gray-200 rounded mb-2" />
          <div className="h-8 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const dailyStatus = getDailyStatus();
  const weeklyStatus = getWeeklyStatus();

  return (
    <div className="p-6 bg-white rounded-xl border">
      {showTitle && (
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-5 h-5" style={{ color: 'var(--primary)' }} />
          <h3 className="text-lg font-semibold">Heures de conduite</h3>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Aujourd'hui
              </span>
              {dailyStatus.icon && (
                <AlertTriangle className="w-4 h-4" style={{ color: dailyStatus.color }} />
              )}
            </div>
            <span className="text-sm font-bold" style={{ color: dailyStatus.color }}>
              {dailyStatus.text}
            </span>
          </div>

          <div className="relative">
            <div className="h-8 rounded-lg bg-gray-200 overflow-hidden">
              <div
                className="h-full transition-all duration-500 flex items-center justify-center"
                style={{
                  width: `${Math.min(dailyPercentage, 100)}%`,
                  backgroundColor: getHoursProgressColor(dailyHours, MAX_DAILY_HOURS)
                }}
              >
                {dailyPercentage > 15 && (
                  <span className="text-xs font-bold text-white">
                    {Math.round(dailyPercentage)}%
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span>{formatHours(dailyHours)}</span>
              <span>{MAX_DAILY_HOURS}h max</span>
            </div>
          </div>

          <div className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Temps restant aujourd'hui : <span className="font-semibold">{formatHours(Math.max(0, MAX_DAILY_HOURS - dailyHours))}</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Cette semaine
              </span>
              {weeklyStatus.icon && (
                <AlertTriangle className="w-4 h-4" style={{ color: weeklyStatus.color }} />
              )}
            </div>
            <span className="text-sm font-bold" style={{ color: weeklyStatus.color }}>
              {weeklyStatus.text}
            </span>
          </div>

          <div className="relative">
            <div className="h-8 rounded-lg bg-gray-200 overflow-hidden">
              <div
                className="h-full transition-all duration-500 flex items-center justify-center"
                style={{
                  width: `${Math.min(weeklyPercentage, 100)}%`,
                  backgroundColor: getHoursProgressColor(weeklyHours, MAX_WEEKLY_HOURS)
                }}
              >
                {weeklyPercentage > 15 && (
                  <span className="text-xs font-bold text-white">
                    {Math.round(weeklyPercentage)}%
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span>{formatHours(weeklyHours)}</span>
              <span>{MAX_WEEKLY_HOURS}h max</span>
            </div>
          </div>

          <div className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Temps restant cette semaine : <span className="font-semibold">{formatHours(Math.max(0, MAX_WEEKLY_HOURS - weeklyHours))}</span>
          </div>
        </div>
      </div>

      {(dailyPercentage >= 100 || weeklyPercentage >= 100) && (
        <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--danger-light)', borderLeft: '4px solid var(--danger)' }}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--danger)' }}>
                Repos obligatoire
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Vous avez atteint la limite légale. Un repos de 11h est requis avant de reprendre la conduite.
              </p>
            </div>
          </div>
        </div>
      )}

      {(dailyPercentage >= 80 && dailyPercentage < 100) && (
        <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--warning-light)', borderLeft: '4px solid var(--warning)' }}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--warning)' }}>
                Alerte 80%
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Vous approchez de la limite journalière. Planifiez votre repos.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
