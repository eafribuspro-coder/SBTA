import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Fuel, TrendingUp, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { formatCurrency } from '../../utils/formatCurrency';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateVariancePercent } from '../../utils/fuelAnomaly';
import jsPDF from 'jspdf';

interface FuelVoucher {
  id: string;
  voucher_number: string;
  status: string;
  estimated_amount: number;
  actual_liters: number | null;
  actual_unit_price: number | null;
  actual_amount: number | null;
  fuel_station: string | null;
  fuel_city: string | null;
  created_at: string;
  validated_at: string | null;
  buses: {
    registration_number: string;
  };
  drivers: {
    profiles: {
      first_name: string;
      last_name: string;
    };
  };
}

export default function FuelReport() {
  const [vouchers, setVouchers] = useState<FuelVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  const [stats, setStats] = useState({
    total_cost: 0,
    total_volume: 0,
    anomaly_count: 0,
    pending_count: 0
  });

  useEffect(() => {
    loadReport();
  }, [dateRange]);

  const loadReport = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('fuel_vouchers')
        .select(`
          *,
          buses:bus_id (registration_number),
          drivers:driver_id (
            profiles:user_id (first_name, last_name)
          )
        `)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end + 'T23:59:59')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const vouchersData = data as FuelVoucher[];
      setVouchers(vouchersData);

      const totalCost = vouchersData
        .filter(v => v.actual_amount)
        .reduce((sum, v) => sum + (v.actual_amount || 0), 0);

      const totalVolume = vouchersData
        .filter(v => v.actual_liters)
        .reduce((sum, v) => sum + (v.actual_liters || 0), 0);

      const anomalyCount = vouchersData.filter(v => {
        if (!v.actual_amount) return false;
        const variance = calculateVariancePercent(v.estimated_amount, v.actual_amount);
        return variance > 15;
      }).length;

      const pendingCount = vouchersData.filter(v => v.status === 'pending_validation').length;

      setStats({
        total_cost: totalCost,
        total_volume: totalVolume,
        anomaly_count: anomalyCount,
        pending_count: pendingCount
      });
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const costByBus = vouchers
    .filter(v => v.actual_amount)
    .reduce((acc, v) => {
      const bus = v.buses.registration_number;
      if (!acc[bus]) {
        acc[bus] = { bus, total: 0 };
      }
      acc[bus].total += v.actual_amount || 0;
      return acc;
    }, {} as Record<string, { bus: string; total: number }>);

  const costByBusData = Object.values(costByBus)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const monthlyData = vouchers
    .filter(v => v.actual_amount)
    .reduce((acc, v) => {
      const month = format(new Date(v.created_at), 'MMM yyyy');
      if (!acc[month]) {
        acc[month] = { month, total: 0, volume: 0 };
      }
      acc[month].total += v.actual_amount || 0;
      acc[month].volume += v.actual_liters || 0;
      return acc;
    }, {} as Record<string, { month: string; total: number; volume: number }>);

  const monthlyChartData = Object.values(monthlyData);

  const anomalies = vouchers.filter(v => {
    if (!v.actual_amount) return false;
    const variance = calculateVariancePercent(v.estimated_amount, v.actual_amount);
    return variance > 15;
  });

  const generatePDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.setTextColor(11, 116, 57);
    doc.text('SBTA', 105, 20, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('RAPPORT DE RAVITAILLEMENT', 105, 35, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Période: ${format(new Date(dateRange.start), 'dd/MM/yyyy')} - ${format(new Date(dateRange.end), 'dd/MM/yyyy')}`, 105, 45, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(11, 116, 57);
    doc.text('INDICATEURS CLÉS', 20, 60);

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Coût total: ${formatCurrency(stats.total_cost)}`, 20, 70);
    doc.text(`Volume total: ${stats.total_volume.toFixed(1)} L`, 20, 77);
    doc.text(`Anomalies détectées: ${stats.anomaly_count}`, 20, 84);
    doc.text(`Bons en attente: ${stats.pending_count}`, 20, 91);

    doc.setFontSize(12);
    doc.setTextColor(11, 116, 57);
    doc.text('DÉTAIL DES RAVITAILLEMENTS', 20, 105);

    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);

    let yPos = 115;
    vouchers.filter(v => v.actual_amount).slice(0, 20).forEach((voucher) => {
      if (yPos > 270) return;

      const variance = calculateVariancePercent(voucher.estimated_amount, voucher.actual_amount || 0);
      const line = `${format(new Date(voucher.created_at), 'dd/MM')} | ${voucher.buses.registration_number} | ${voucher.drivers.profiles.first_name} ${voucher.drivers.profiles.last_name} | ${voucher.fuel_station} | ${voucher.actual_liters}L | ${formatCurrency(voucher.actual_amount || 0)} | ${variance > 0 ? '+' : ''}${variance.toFixed(1)}%`;

      doc.text(line, 20, yPos);
      yPos += 5;
    });

    if (vouchers.filter(v => v.actual_amount).length > 20) {
      doc.text(`... et ${vouchers.filter(v => v.actual_amount).length - 20} autres ravitaillements`, 20, yPos);
    }

    if (anomalies.length > 0) {
      yPos += 10;
      doc.setFontSize(12);
      doc.setTextColor(175, 48, 41);
      doc.text('ANOMALIES', 20, yPos);
      yPos += 8;

      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);

      anomalies.slice(0, 5).forEach((voucher) => {
        if (yPos > 280) return;

        const variance = calculateVariancePercent(voucher.estimated_amount, voucher.actual_amount || 0);
        const line = `${voucher.voucher_number} | ${voucher.buses.registration_number} | Écart: ${variance > 0 ? '+' : ''}${variance.toFixed(1)}% | ${formatCurrency(voucher.actual_amount || 0)}`;

        doc.text(line, 20, yPos);
        yPos += 5;
      });
    }

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Rapport généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm')}`, 105, 285, { align: 'center' });

    doc.save(`rapport-carburant-${dateRange.start}-${dateRange.end}.pdf`);
    toast.success('Rapport PDF généré');
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Rapport de ravitaillement
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Analyse des consommations de carburant
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadReport}
            className="px-4 py-2 rounded-lg border flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <button
            onClick={generatePDF}
            className="px-4 py-2 rounded-lg text-white flex items-center gap-2"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Download className="w-4 h-4" />
            Exporter PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block mb-2 font-medium">Date de début</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="w-full p-3 border rounded-lg"
          />
        </div>
        <div>
          <label className="block mb-2 font-medium">Date de fin</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="w-full p-3 border rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
                 style={{ backgroundColor: 'var(--primary-light)' }}>
              <TrendingUp className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Coût Total</p>
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
            {formatCurrency(stats.total_cost)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
                 style={{ backgroundColor: 'var(--info-light)' }}>
              <Fuel className="w-5 h-5" style={{ color: 'var(--info)' }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Volume Total</p>
            </div>
          </div>
          <p className="text-2xl font-bold">{stats.total_volume.toFixed(1)} L</p>
        </div>

        <div className="bg-white rounded-xl p-6 border">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
                 style={{ backgroundColor: 'var(--danger-light)' }}>
              <AlertTriangle className="w-5 h-5" style={{ color: 'var(--danger)' }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Anomalies</p>
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--danger)' }}>
            {stats.anomaly_count}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
                 style={{ backgroundColor: 'var(--warning-light)' }}>
              <Fuel className="w-5 h-5" style={{ color: 'var(--warning)' }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Bons en attente</p>
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--warning)' }}>
            {stats.pending_count}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 border">
              <h2 className="text-lg font-bold mb-4">Coût par bus (Top 10)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costByBusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bus" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="total" fill="#0B7439" name="Coût total" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl p-6 border">
              <h2 className="text-lg font-bold mb-4">Évolution mensuelle</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#0B7439" name="Coût" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border mb-8">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Détail des ravitaillements</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: 'var(--neutral-100)' }}>
                  <tr>
                    <th className="text-left p-4 font-semibold">Date</th>
                    <th className="text-left p-4 font-semibold">Bus</th>
                    <th className="text-left p-4 font-semibold">Chauffeur</th>
                    <th className="text-left p-4 font-semibold">Station</th>
                    <th className="text-left p-4 font-semibold">Qté (L)</th>
                    <th className="text-left p-4 font-semibold">Prix/L</th>
                    <th className="text-left p-4 font-semibold">Total</th>
                    <th className="text-left p-4 font-semibold">Écart</th>
                    <th className="text-left p-4 font-semibold">Anomalie</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.filter(v => v.actual_amount).map(voucher => {
                    const variance = calculateVariancePercent(voucher.estimated_amount, voucher.actual_amount || 0);
                    const hasAnomaly = variance > 15;

                    return (
                      <tr key={voucher.id} className="border-t hover:bg-gray-50">
                        <td className="p-4">
                          <p className="text-sm">{format(new Date(voucher.created_at), 'dd/MM/yyyy')}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-semibold">{voucher.buses.registration_number}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-medium">
                            {voucher.drivers.profiles.first_name} {voucher.drivers.profiles.last_name}
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm">{voucher.fuel_station}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-semibold">{voucher.actual_liters} L</p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm">{formatCurrency(voucher.actual_unit_price || 0)}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-bold" style={{ color: 'var(--primary)' }}>
                            {formatCurrency(voucher.actual_amount || 0)}
                          </p>
                        </td>
                        <td className="p-4">
                          <p className={`font-semibold ${variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                          </p>
                        </td>
                        <td className="p-4">
                          {hasAnomaly && (
                            <span
                              className="px-2 py-1 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: variance > 30 ? 'var(--danger-light)' : 'var(--warning-light)',
                                color: variance > 30 ? 'var(--danger)' : 'var(--warning)'
                              }}
                            >
                              {variance > 30 ? 'Grave' : 'Modérée'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {vouchers.filter(v => v.actual_amount).length === 0 && (
                <div className="text-center py-12">
                  <p style={{ color: 'var(--text-secondary)' }}>Aucun ravitaillement pour cette période</p>
                </div>
              )}
            </div>
          </div>

          {anomalies.length > 0 && (
            <div className="bg-white rounded-xl border">
              <div className="p-6 border-b flex items-center gap-3">
                <AlertTriangle className="w-6 h-6" style={{ color: 'var(--danger)' }} />
                <h2 className="text-xl font-bold">Anomalies détectées</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead style={{ backgroundColor: 'var(--danger-light)' }}>
                    <tr>
                      <th className="text-left p-4 font-semibold">N° Bon</th>
                      <th className="text-left p-4 font-semibold">Date</th>
                      <th className="text-left p-4 font-semibold">Bus</th>
                      <th className="text-left p-4 font-semibold">Estimé</th>
                      <th className="text-left p-4 font-semibold">Réel</th>
                      <th className="text-left p-4 font-semibold">Écart</th>
                      <th className="text-left p-4 font-semibold">Raison</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalies.map(voucher => {
                      const variance = calculateVariancePercent(voucher.estimated_amount, voucher.actual_amount || 0);

                      return (
                        <tr key={voucher.id} className="border-t">
                          <td className="p-4">
                            <p className="font-mono font-semibold">{voucher.voucher_number}</p>
                          </td>
                          <td className="p-4">
                            <p className="text-sm">{format(new Date(voucher.created_at), 'dd/MM/yyyy')}</p>
                          </td>
                          <td className="p-4">
                            <p className="font-semibold">{voucher.buses.registration_number}</p>
                          </td>
                          <td className="p-4">
                            <p className="text-sm">{formatCurrency(voucher.estimated_amount)}</p>
                          </td>
                          <td className="p-4">
                            <p className="font-semibold">{formatCurrency(voucher.actual_amount || 0)}</p>
                          </td>
                          <td className="p-4">
                            <span
                              className="px-3 py-1 rounded-full font-semibold"
                              style={{
                                backgroundColor: variance > 30 ? 'var(--danger-light)' : 'var(--warning-light)',
                                color: variance > 30 ? 'var(--danger)' : 'var(--warning)'
                              }}
                            >
                              +{variance.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-4">
                            <p className="text-sm">
                              {variance > 30 ? 'Écart critique' : 'Écart modéré'}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
