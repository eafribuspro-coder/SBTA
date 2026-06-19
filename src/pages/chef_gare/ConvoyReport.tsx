import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Truck, RefreshCw, Printer, Calendar, TrendingUp, Banknote, Bus, MapPin, User, Clock, FileText } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency, formatNumber } from '../../utils/formatCurrency';

interface ConvoyRow {
  id: string;
  amount: number;
  observation: string | null;
  created_at: string;
  created_by_name: string;
  schedule_id: string;
  departure_datetime: string;
  route_name: string;
  origin_city: string;
  destination_city: string;
  registration_number: string;
  driver_name: string;
  bus_capacity: number;
}

type PeriodPreset = 'today' | 'week' | 'month' | 'custom';

export default function ConvoyReport() {
  const [convoys, setConvoys] = useState<ConvoyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stationName, setStationName] = useState('');
  const [preset, setPreset] = useState<PeriodPreset>('today');
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const applyPreset = useCallback((p: PeriodPreset) => {
    setPreset(p);
    const now = new Date();
    if (p === 'today') {
      const d = format(now, 'yyyy-MM-dd');
      setDateFrom(d);
      setDateTo(d);
    } else if (p === 'week') {
      setDateFrom(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      setDateTo(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    } else if (p === 'month') {
      setDateFrom(format(startOfMonth(now), 'yyyy-MM-dd'));
      setDateTo(format(endOfMonth(now), 'yyyy-MM-dd'));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: stationId } = await supabase.rpc('get_my_station_id');
      if (!stationId) { toast.error('Impossible de recuperer votre gare'); return; }

      const { data: stRow } = await supabase.from('stations').select('name').eq('id', stationId).maybeSingle();
      setStationName((stRow as any)?.name || 'Gare');

      const { data, error } = await supabase
        .from('convoys')
        .select(`
          id, amount, observation, created_at, created_by,
          schedule:schedule_id (
            id, departure_datetime, departure_station_id,
            bus:bus_id ( registration_number, capacity, total_seats ),
            route:route_id (
              name,
              origin_city:origin_city_id ( name ),
              destination_city:destination_city_id ( name )
            ),
            driver:driver_id ( first_name, last_name )
          )
        `)
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: creatorIds } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', (data ?? []).map((c: any) => c.created_by).filter(Boolean));
      const creatorMap: Record<string, string> = {};
      (creatorIds ?? []).forEach((u: any) => { creatorMap[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim(); });

      const rows: ConvoyRow[] = (data ?? [])
        .filter((c: any) => {
          const sched = c.schedule;
          return sched && sched.departure_station_id === stationId;
        })
        .map((c: any) => {
          const sched = c.schedule;
          const route = sched?.route;
          const bus = sched?.bus;
          const driver = sched?.driver;
          return {
            id: c.id,
            amount: Number(c.amount),
            observation: c.observation,
            created_at: c.created_at,
            created_by_name: creatorMap[c.created_by] || '—',
            schedule_id: sched?.id,
            departure_datetime: sched?.departure_datetime,
            route_name: route?.name || '—',
            origin_city: route?.origin_city?.name || '—',
            destination_city: route?.destination_city?.name || '—',
            registration_number: bus?.registration_number || '—',
            bus_capacity: bus?.capacity || bus?.total_seats || 0,
            driver_name: driver ? `${driver.first_name || ''} ${driver.last_name || ''}`.trim() : '—',
          };
        });

      setConvoys(rows);
    } catch (err: any) {
      toast.error('Erreur de chargement des convois');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const totalAmount = convoys.reduce((s, c) => s + c.amount, 0);
  const totalConvoys = convoys.length;
  const avgAmount = totalConvoys > 0 ? totalAmount / totalConvoys : 0;

  const routeBreakdown: Record<string, { count: number; amount: number }> = {};
  convoys.forEach(c => {
    const key = `${c.origin_city} - ${c.destination_city}`;
    if (!routeBreakdown[key]) routeBreakdown[key] = { count: 0, amount: 0 };
    routeBreakdown[key].count += 1;
    routeBreakdown[key].amount += c.amount;
  });
  const routeStats = Object.entries(routeBreakdown)
    .sort((a, b) => b[1].amount - a[1].amount);

  const busBreakdown: Record<string, { count: number; amount: number }> = {};
  convoys.forEach(c => {
    const key = c.registration_number;
    if (!busBreakdown[key]) busBreakdown[key] = { count: 0, amount: 0 };
    busBreakdown[key].count += 1;
    busBreakdown[key].amount += c.amount;
  });
  const busStats = Object.entries(busBreakdown)
    .sort((a, b) => b[1].amount - a[1].amount);

  const handlePrint = () => window.print();

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Rapport Convois
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {stationName} — Suivi des departs en convoi
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['today', 'week', 'month', 'custom'] as PeriodPreset[]).map(p => (
            <button key={p} onClick={() => applyPreset(p)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
              style={{
                backgroundColor: preset === p ? 'var(--primary)' : 'var(--surface)',
                color: preset === p ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${preset === p ? 'var(--primary)' : 'var(--border)'}`,
              }}>
              {p === 'today' ? "Aujourd'hui" : p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Personnalise'}
            </button>
          ))}
        </div>
      </div>

      {/* Date range (visible for custom or always for context) */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Du</label>
          <input type="date" value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPreset('custom'); }}
            className="px-3 py-1.5 border rounded-lg text-sm"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Au</label>
          <input type="date" value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPreset('custom'); }}
            className="px-3 py-1.5 border rounded-lg text-sm"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
        <button onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--primary)' }}>
          <Printer className="w-4 h-4" /> Imprimer
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total convois', value: formatNumber(totalConvoys), icon: <Truck className="w-5 h-5" />, color: '#0369A1' },
          { label: 'Montant total', value: formatCurrency(totalAmount), icon: <Banknote className="w-5 h-5" />, color: '#16A34A' },
          { label: 'Montant moyen', value: formatCurrency(Math.round(avgAmount)), icon: <TrendingUp className="w-5 h-5" />, color: '#D97706' },
        ].map((kpi, i) => (
          <div key={i} className="rounded-xl border p-5 flex items-center gap-4"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${kpi.color}15`, color: kpi.color }}>
              {kpi.icon}
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
              <p className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {convoys.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--border)' }}>
          <Truck className="w-12 h-12 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>Aucun convoi sur cette periode</p>
        </div>
      ) : (
        <>
          {/* Breakdown by Route and Bus side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By route */}
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
                <MapPin className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Par ligne</span>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {routeStats.map(([route, stat]) => (
                  <div key={route} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{route}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.count} convoi{stat.count > 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-sm font-bold" style={{ color: '#16A34A' }}>{formatCurrency(stat.amount)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* By bus */}
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
                <Bus className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Par bus</span>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {busStats.map(([reg, stat]) => (
                  <div key={reg} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{reg}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.count} convoi{stat.count > 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-sm font-bold" style={{ color: '#16A34A' }}>{formatCurrency(stat.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed table */}
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
              <FileText className="w-4 h-4" style={{ color: 'var(--primary)' }} />
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Detail des convois</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                    {['Date', 'Heure', 'Ligne', 'Bus', 'Chauffeur', 'Montant', 'Enregistre par', 'Observation'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {convoys.map(c => (
                    <tr key={c.id} className="hover:opacity-80 transition-opacity">
                      <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: 'var(--text-primary)' }}>
                        {format(new Date(c.departure_datetime || c.created_at), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                        {format(new Date(c.departure_datetime || c.created_at), 'HH:mm')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        {c.origin_city} → {c.destination_city}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: 'var(--text-primary)' }}>
                        {c.registration_number}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                        {c.driver_name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-bold" style={{ color: '#16A34A' }}>
                        {formatCurrency(c.amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                        {c.created_by_name}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }}
                        title={c.observation || ''}>
                        {c.observation || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--primary-light)' }}>
                    <td colSpan={5} className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--primary)' }}>
                      TOTAL ({totalConvoys} convoi{totalConvoys > 1 ? 's' : ''})
                    </td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: '#16A34A' }}>
                      {formatCurrency(totalAmount)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
