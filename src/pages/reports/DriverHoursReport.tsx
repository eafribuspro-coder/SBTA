import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Clock, Download, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PeriodFilter from '../../components/shared/PeriodFilter';
import { getDateRangeFromPeriod, PeriodFilter as PeriodType, exportToCSV } from '../../utils/reportHelpers';
import { format, differenceInHours } from 'date-fns';

const MAX_WEEKLY_HOURS = 56;

export default function DriverHoursReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [driverHours, setDriverHours] = useState<any[]>([]);

  useEffect(() => {
    loadReportData();
  }, [period, customStart, customEnd]);

  const loadReportData = async () => {
    try {
      setLoading(true);

      const dateRange = getDateRangeFromPeriod(
        period,
        customStart ? new Date(customStart) : undefined,
        customEnd ? new Date(customEnd) : undefined
      );

      const { data, error } = await supabase
        .from('schedules')
        .select('driver_id, driver:driver_id(full_name), departure_datetime, arrival_datetime')
        .gte('departure_datetime', dateRange.start.toISOString())
        .lte('departure_datetime', dateRange.end.toISOString())
        .not('driver_id', 'is', null);

      if (error) throw error;

      const driverHoursMap: Record<string, { name: string; hours: number; trips: number }> = {};

      (data || []).forEach(schedule => {
        const hours = schedule.arrival_datetime
          ? differenceInHours(new Date(schedule.arrival_datetime), new Date(schedule.departure_datetime))
          : 0;

        if (!driverHoursMap[schedule.driver_id]) {
          driverHoursMap[schedule.driver_id] = {
            name: schedule.driver?.full_name || 'Inconnu',
            hours: 0,
            trips: 0
          };
        }

        driverHoursMap[schedule.driver_id].hours += hours;
        driverHoursMap[schedule.driver_id].trips += 1;
      });

      const driverData = Object.values(driverHoursMap).map(driver => ({
        ...driver,
        alert: driver.hours > MAX_WEEKLY_HOURS
      }));

      setDriverHours(driverData);
    } catch (error: any) {
      console.error('Erreur chargement rapport:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    exportToCSV(driverHours, `heures-chauffeurs-${format(new Date(), 'yyyy-MM-dd')}`);
    toast.success('Export Excel réussi');
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <button
          onClick={() => navigate('/reports')}
          className="mb-4 flex items-center gap-2 text-sm font-semibold"
          style={{ color: 'var(--primary)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux rapports
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Clock className="w-8 h-8" style={{ color: '#8b5cf6' }} />
              Rapport Heures Chauffeurs
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Suivi du temps de travail et alertes dépassements
            </p>
          </div>

          <button
            onClick={exportExcel}
            className="px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-md"
            style={{ backgroundColor: 'var(--success)', color: 'white' }}
          >
            <Download className="w-5 h-5" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="mb-6">
        <PeriodFilter
          value={period}
          onChange={setPeriod}
          customStart={customStart}
          customEnd={customEnd}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
        />
      </div>

      <div className="bg-white rounded-xl border p-6 mb-6">
        <h3 className="font-bold text-lg mb-4">Heures par chauffeur vs limite réglementaire ({MAX_WEEKLY_HOURS}h)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={driverHours}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="hours" fill="#8b5cf6" name="Heures travaillées" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="font-bold text-lg">Détail par chauffeur</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--neutral-100)' }}>
              <tr>
                <th className="text-left p-4 font-semibold">Chauffeur</th>
                <th className="text-center p-4 font-semibold">Heures/semaine</th>
                <th className="text-center p-4 font-semibold">Voyages</th>
                <th className="text-center p-4 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {driverHours.map((driver, index) => (
                <tr key={index} className="border-t hover:bg-gray-50">
                  <td className="p-4 font-semibold">{driver.name}</td>
                  <td className="p-4 text-center font-bold text-xl">
                    {driver.hours.toFixed(1)}h
                  </td>
                  <td className="p-4 text-center">{driver.trips}</td>
                  <td className="p-4 text-center">
                    {driver.alert ? (
                      <span className="px-3 py-1 rounded-full text-sm font-bold"
                            style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
                        ⚠️ Dépassement
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-sm font-bold"
                            style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
                        ✓ Conforme
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
