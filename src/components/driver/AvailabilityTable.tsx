import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { MAX_DAILY_HOURS, MAX_WEEKLY_HOURS, formatHours, getHoursProgressColor } from '../../utils/driverHoursCalc';
import { Clock, AlertCircle } from 'lucide-react';

interface DriverHours {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  daily_hours: number;
  weekly_hours: number;
  next_available: Date | null;
}

interface AvailabilityTableProps {
  onDriverSelect?: (driverId: string) => void;
  selectedDriverId?: string;
  showOnlyAvailable?: boolean;
}

export default function AvailabilityTable({
  onDriverSelect,
  selectedDriverId,
  showOnlyAvailable = false
}: AvailabilityTableProps) {
  const [drivers, setDrivers] = useState<DriverHours[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDriversAvailability();

    const subscription = supabase
      .channel('driver_hours_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'driver_hours_log'
      }, () => {
        loadDriversAvailability();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadDriversAvailability = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: driversData, error: driversError } = await supabase
        .from('users')
        .select('id, first_name, last_name, status')
        .eq('role', 'chauffeur')
        .order('last_name');

      if (driversError) throw driversError;

      const driversWithHours = await Promise.all(
        driversData.map(async (driver) => {
          const { data: todayLog } = await supabase
            .from('driver_hours_log')
            .select('daily_hours, weekly_hours, last_rest_date')
            .eq('driver_id', driver.id)
            .gte('date', today.toISOString())
            .maybeSingle();

          let nextAvailable = null;
          if (driver.status === 'repos_obligatoire') {
            const { data: lastLog } = await supabase
              .from('driver_hours_log')
              .select('date, daily_hours')
              .eq('driver_id', driver.id)
              .order('date', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (lastLog) {
              nextAvailable = new Date(lastLog.date);
              nextAvailable.setDate(nextAvailable.getDate() + 1);
              nextAvailable.setHours(6, 0, 0, 0);
            }
          }

          return {
            id: driver.id,
            first_name: driver.first_name,
            last_name: driver.last_name,
            status: driver.status,
            daily_hours: todayLog?.daily_hours || 0,
            weekly_hours: todayLog?.weekly_hours || 0,
            next_available: nextAvailable
          };
        })
      );

      const filtered = showOnlyAvailable
        ? driversWithHours.filter(d => d.status !== 'repos_obligatoire' && d.daily_hours < MAX_DAILY_HOURS)
        : driversWithHours;

      setDrivers(filtered);
    } catch (error) {
      console.error('Error loading driver availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (driver: DriverHours) => {
    if (driver.status === 'repos_obligatoire' || driver.daily_hours >= MAX_DAILY_HOURS || driver.weekly_hours >= MAX_WEEKLY_HOURS) {
      return { icon: '🔴', text: 'Repos', color: 'var(--danger)' };
    }
    if (driver.daily_hours >= MAX_DAILY_HOURS * 0.8 || driver.weekly_hours >= MAX_WEEKLY_HOURS * 0.8) {
      return { icon: '🟡', text: 'Alerte', color: 'var(--warning)' };
    }
    return { icon: '🟢', text: 'Dispo', color: 'var(--success)' };
  };

  const getAvailabilityText = (driver: DriverHours) => {
    if (driver.status === 'repos_obligatoire' || driver.daily_hours >= MAX_DAILY_HOURS) {
      if (driver.next_available) {
        const now = new Date();
        const diff = driver.next_available.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 24) {
          return `Demain ${driver.next_available.getHours()}h`;
        } else if (hours > 0) {
          return `⚠️ ${hours}h${minutes.toString().padStart(2, '0')}`;
        }
      }
      return 'Demain 6h';
    }
    return 'Maintenant';
  };

  if (loading) {
    return <div className="p-4">Chargement...</div>;
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <table className="w-full">
        <thead style={{ backgroundColor: 'var(--neutral-100)' }}>
          <tr>
            <th className="text-left p-4 font-semibold">Chauffeur</th>
            <th className="text-left p-4 font-semibold">/Jour</th>
            <th className="text-left p-4 font-semibold">/Semaine</th>
            <th className="text-left p-4 font-semibold">Dispo à</th>
            <th className="text-left p-4 font-semibold">Statut</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((driver) => {
            const status = getStatusBadge(driver);
            const dailyPercentage = (driver.daily_hours / MAX_DAILY_HOURS) * 100;
            const weeklyPercentage = (driver.weekly_hours / MAX_WEEKLY_HOURS) * 100;
            const isSelected = selectedDriverId === driver.id;

            return (
              <tr
                key={driver.id}
                onClick={() => onDriverSelect?.(driver.id)}
                className={`border-t hover:bg-gray-50 ${onDriverSelect ? 'cursor-pointer' : ''} ${
                  isSelected ? 'bg-blue-50' : ''
                }`}
              >
                <td className="p-4">
                  <span className="font-medium">
                    {driver.last_name} {driver.first_name.charAt(0)}.
                  </span>
                </td>
                <td className="p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden" style={{ minWidth: '100px' }}>
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${Math.min(dailyPercentage, 100)}%`,
                            backgroundColor: getHoursProgressColor(driver.daily_hours, MAX_DAILY_HOURS)
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium" style={{ minWidth: '70px' }}>
                        {formatHours(driver.daily_hours)}/{MAX_DAILY_HOURS}h
                      </span>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden" style={{ minWidth: '100px' }}>
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${Math.min(weeklyPercentage, 100)}%`,
                            backgroundColor: getHoursProgressColor(driver.weekly_hours, MAX_WEEKLY_HOURS)
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium" style={{ minWidth: '70px' }}>
                        {formatHours(driver.weekly_hours)}/{MAX_WEEKLY_HOURS}h
                      </span>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-sm">{getAvailabilityText(driver)}</span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span>{status.icon}</span>
                    <span className="text-sm font-medium" style={{ color: status.color }}>
                      {status.text}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {drivers.length === 0 && (
        <div className="text-center py-12">
          <Clock className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--neutral-400)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>
            {showOnlyAvailable ? 'Aucun chauffeur disponible' : 'Aucun chauffeur'}
          </p>
        </div>
      )}
    </div>
  );
}
