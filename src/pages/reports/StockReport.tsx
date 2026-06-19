import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Package, Download, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/formatCurrency';
import { exportToCSV } from '../../utils/reportHelpers';
import { format } from 'date-fns';

export default function StockReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ totalValue: 0, lowStock: 0, movements: 0 });
  const [parts, setParts] = useState<any[]>([]);
  const [topParts, setTopParts] = useState<any[]>([]);

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    try {
      setLoading(true);

      const [partsRes, movementsRes] = await Promise.all([
        supabase.from('parts').select('*'),
        supabase.from('stock_movements').select('*')
      ]);

      const partsData = partsRes.data || [];
      const totalValue = partsData.reduce((sum, p) => sum + (p.current_stock * p.unit_price), 0);
      const lowStock = partsData.filter(p => p.current_stock <= p.minimum_stock).length;

      setKpis({ totalValue, lowStock, movements: movementsRes.data?.length || 0 });

      const tableData = partsData.map(p => ({
        name: p.name,
        reference: p.reference,
        currentStock: p.current_stock,
        minimumStock: p.minimum_stock,
        unitPrice: p.unit_price,
        value: p.current_stock * p.unit_price,
        status: p.current_stock <= p.minimum_stock ? 'Sous minimum' : 'OK'
      }));

      setParts(tableData);

      const movementsByPart: Record<string, number> = {};
      (movementsRes.data || []).forEach(m => {
        if (m.movement_type === 'sortie') {
          movementsByPart[m.part_id] = (movementsByPart[m.part_id] || 0) + m.quantity;
        }
      });

      const topPartsData = Object.entries(movementsByPart)
        .map(([partId, qty]) => {
          const part = partsData.find(p => p.id === partId);
          return { name: part?.name || partId, quantity: qty };
        })
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      setTopParts(topPartsData);
    } catch (error: any) {
      console.error('Erreur chargement rapport:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    exportToCSV(parts, `stock-${format(new Date(), 'yyyy-MM-dd')}`);
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
              <Package className="w-8 h-8" style={{ color: '#ec4899' }} />
              Rapport Stock Pièces
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Valeur stock, ruptures et consommations
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-6 border">
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Valeur totale stock</p>
          <p className="text-3xl font-black" style={{ color: 'var(--primary)' }}>
            {formatCurrency(kpis.totalValue)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border">
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Pièces sous minimum</p>
          <p className="text-3xl font-black" style={{ color: 'var(--danger)' }}>
            {kpis.lowStock}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border">
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Mouvements (mois)</p>
          <p className="text-3xl font-black" style={{ color: 'var(--info)' }}>
            {kpis.movements}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 mb-6">
        <h3 className="font-bold text-lg mb-4">Top pièces consommées</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topParts}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="quantity" fill="#ec4899" name="Quantité consommée" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="font-bold text-lg">État du stock</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--neutral-100)' }}>
              <tr>
                <th className="text-left p-4 font-semibold">Pièce</th>
                <th className="text-left p-4 font-semibold">Référence</th>
                <th className="text-center p-4 font-semibold">Stock actuel</th>
                <th className="text-center p-4 font-semibold">Stock min</th>
                <th className="text-right p-4 font-semibold">Prix unitaire</th>
                <th className="text-right p-4 font-semibold">Valeur</th>
                <th className="text-center p-4 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((part, index) => (
                <tr key={index} className="border-t hover:bg-gray-50">
                  <td className="p-4 font-semibold">{part.name}</td>
                  <td className="p-4 font-mono text-sm">{part.reference}</td>
                  <td className="p-4 text-center font-bold">{part.currentStock}</td>
                  <td className="p-4 text-center">{part.minimumStock}</td>
                  <td className="p-4 text-right">{formatCurrency(part.unitPrice)}</td>
                  <td className="p-4 text-right font-bold">{formatCurrency(part.value)}</td>
                  <td className="p-4 text-center">
                    {part.status === 'Sous minimum' ? (
                      <span className="px-3 py-1 rounded-full text-sm font-bold"
                            style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
                        ⚠️ Sous minimum
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-sm font-bold"
                            style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
                        ✓ OK
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
