import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Wrench, Download, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PeriodFilter from '../../components/shared/PeriodFilter';
import { getDateRangeFromPeriod, PeriodFilter as PeriodType, exportToCSV } from '../../utils/reportHelpers';
import { formatCurrency } from '../../utils/formatCurrency';
import { format, differenceInDays } from 'date-fns';

export default function MaintenanceReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [kpis, setKpis] = useState({
    totalCost: 0,
    interventions: 0,
    avgDowntime: 0
  });

  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [topIssues, setTopIssues] = useState<any[]>([]);

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
        .from('maintenance_work_orders')
        .select(`
          *,
          bus:bus_id(registration_number),
          mechanic:assigned_to(full_name)
        `)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());

      if (error) throw error;

      const totalCost = (data || []).reduce((sum, wo) => sum + (wo.actual_cost || wo.estimated_cost || 0), 0);
      const interventions = data?.length || 0;

      const downtimes = (data || [])
        .filter(wo => wo.completed_at)
        .map(wo => differenceInDays(new Date(wo.completed_at), new Date(wo.created_at)));

      const avgDowntime = downtimes.length > 0
        ? downtimes.reduce((sum, d) => sum + d, 0) / downtimes.length
        : 0;

      setKpis({ totalCost, interventions, avgDowntime });

      const issueTypes: Record<string, number> = {};
      (data || []).forEach(wo => {
        const issue = wo.priority || 'Normale';
        issueTypes[issue] = (issueTypes[issue] || 0) + 1;
      });

      const topIssuesData = Object.entries(issueTypes)
        .map(([issue, count]) => ({ issue, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setTopIssues(topIssuesData);

      const tableData = (data || []).map(wo => ({
        orderNumber: wo.work_order_number,
        bus: wo.bus?.registration_number || 'N/A',
        type: wo.priority || 'N/A',
        mechanic: wo.mechanic?.full_name || 'N/A',
        duration: wo.completed_at ? differenceInDays(new Date(wo.completed_at), new Date(wo.created_at)) : 0,
        estimatedCost: wo.estimated_cost || 0,
        actualCost: wo.actual_cost || 0,
        variance: ((wo.actual_cost || 0) - (wo.estimated_cost || 0))
      }));

      setWorkOrders(tableData);
    } catch (error: any) {
      console.error('Erreur chargement rapport:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    exportToCSV(workOrders, `maintenance-${format(new Date(), 'yyyy-MM-dd')}`);
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
              <Wrench className="w-8 h-8" style={{ color: '#f59e0b' }} />
              Rapport Maintenance
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Suivi des interventions et coûts de maintenance
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-6 border">
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Coût total</p>
          <p className="text-3xl font-black" style={{ color: 'var(--danger)' }}>
            {formatCurrency(kpis.totalCost)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border">
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Interventions</p>
          <p className="text-3xl font-black" style={{ color: 'var(--info)' }}>
            {kpis.interventions}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border">
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Immobilisation moyenne</p>
          <p className="text-3xl font-black" style={{ color: 'var(--warning)' }}>
            {kpis.avgDowntime.toFixed(1)} j
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 mb-6">
        <h3 className="font-bold text-lg mb-4">Top pannes fréquentes</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topIssues}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="issue" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#f59e0b" name="Nombre de pannes" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="font-bold text-lg">Détail des interventions</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--neutral-100)' }}>
              <tr>
                <th className="text-left p-4 font-semibold">N° OT</th>
                <th className="text-left p-4 font-semibold">Bus</th>
                <th className="text-left p-4 font-semibold">Type</th>
                <th className="text-left p-4 font-semibold">Mécanicien</th>
                <th className="text-center p-4 font-semibold">Durée (j)</th>
                <th className="text-right p-4 font-semibold">Coût estimé</th>
                <th className="text-right p-4 font-semibold">Coût réel</th>
                <th className="text-right p-4 font-semibold">Écart</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((wo, index) => (
                <tr key={index} className="border-t hover:bg-gray-50">
                  <td className="p-4 font-mono">{wo.orderNumber}</td>
                  <td className="p-4 font-mono">{wo.bus}</td>
                  <td className="p-4">{wo.type}</td>
                  <td className="p-4">{wo.mechanic}</td>
                  <td className="p-4 text-center">{wo.duration}</td>
                  <td className="p-4 text-right">{formatCurrency(wo.estimatedCost)}</td>
                  <td className="p-4 text-right font-bold">{formatCurrency(wo.actualCost)}</td>
                  <td className="p-4 text-right font-bold" style={{ color: wo.variance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {formatCurrency(wo.variance)}
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
