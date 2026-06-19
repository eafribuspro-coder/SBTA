import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Filter, TrendingDown, TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Movement {
  id: string;
  part_id: string;
  movement_type: 'in' | 'out';
  quantity: number;
  reference_type: string;
  reference_id: string;
  notes: string;
  stock_before: number;
  stock_after: number;
  created_at: string;
  parts_inventory: {
    reference: string;
    name: string;
    unit: string;
  };
}

const MOVEMENT_TYPES = [
  { value: 'in', label: 'Entrées', icon: TrendingUp, color: 'var(--success)' },
  { value: 'out', label: 'Sorties', icon: TrendingDown, color: 'var(--danger)' }
];

const REFERENCE_TYPES: Record<string, string> = {
  purchase_order: 'Bon de commande',
  work_order: 'Ordre de travail',
  return: 'Retour',
  loss: 'Perte',
  inventory: 'Inventaire',
  adjustment: 'Ajustement'
};

export default function Movements() {
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<Movement[]>([]);
  const [filterType, setFilterType] = useState('');
  const [filterRefType, setFilterRefType] = useState('');
  const [filterPart, setFilterPart] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [parts, setParts] = useState<{ id: string; reference: string; name: string }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [movements, filterType, filterRefType, filterPart, dateFrom, dateTo]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [movementsRes, partsRes] = await Promise.all([
        supabase
          .from('spare_parts_stock_movements')
          .select(`
            *,
            parts_inventory:part_id (
              reference,
              name,
              unit
            )
          `)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('parts_inventory')
          .select('id, reference, name')
          .order('name', { ascending: true })
      ]);

      if (movementsRes.error) throw movementsRes.error;
      if (partsRes.error) throw partsRes.error;

      setMovements(movementsRes.data || []);
      setParts(partsRes.data || []);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...movements];

    if (filterType) {
      filtered = filtered.filter(m => m.movement_type === filterType);
    }

    if (filterRefType) {
      filtered = filtered.filter(m => m.reference_type === filterRefType);
    }

    if (filterPart) {
      filtered = filtered.filter(m => m.part_id === filterPart);
    }

    if (dateFrom) {
      filtered = filtered.filter(
        m => new Date(m.created_at) >= new Date(dateFrom)
      );
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        m => new Date(m.created_at) <= endDate
      );
    }

    setFilteredMovements(filtered);
  };

  const getMovementIcon = (type: 'in' | 'out') => {
    const config = MOVEMENT_TYPES.find(t => t.value === type);
    if (!config) return null;
    const Icon = config.icon;
    return <Icon className="w-4 h-4" style={{ color: config.color }} />;
  };

  const getMovementLabel = (type: 'in' | 'out') => {
    return type === 'in' ? 'Entrée' : 'Sortie';
  };

  const totalIn = filteredMovements
    .filter(m => m.movement_type === 'in')
    .reduce((sum, m) => sum + m.quantity, 0);

  const totalOut = filteredMovements
    .filter(m => m.movement_type === 'out')
    .reduce((sum, m) => sum + m.quantity, 0);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Mouvements de stock
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Historique de tous les mouvements</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl p-6 border">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-6 h-6" style={{ color: 'var(--success)' }} />
            <h3 className="font-semibold">Total Entrées</h3>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--success)' }}>
            {totalIn}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border">
          <div className="flex items-center gap-3 mb-2">
            <TrendingDown className="w-6 h-6" style={{ color: 'var(--danger)' }} />
            <h3 className="font-semibold">Total Sorties</h3>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--danger)' }}>
            {totalOut}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border">
          <div className="flex items-center gap-3 mb-2">
            <Filter className="w-6 h-6" style={{ color: 'var(--primary)' }} />
            <h3 className="font-semibold">Mouvements filtrés</h3>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
            {filteredMovements.length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">Tous types</option>
            <option value="in">Entrées</option>
            <option value="out">Sorties</option>
          </select>

          <select
            value={filterRefType}
            onChange={(e) => setFilterRefType(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">Toutes références</option>
            {Object.entries(REFERENCE_TYPES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={filterPart}
            onChange={(e) => setFilterPart(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">Toutes pièces</option>
            {parts.map(part => (
              <option key={part.id} value={part.id}>
                {part.reference} - {part.name}
              </option>
            ))}
          </select>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
              placeholder="Du"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
              placeholder="Au"
            />
          </div>
        </div>

        {(filterType || filterRefType || filterPart || dateFrom || dateTo) && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setFilterType('');
                setFilterRefType('');
                setFilterPart('');
                setDateFrom('');
                setDateTo('');
              }}
              className="px-4 py-2 rounded-lg border font-medium text-sm hover:bg-gray-50"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ backgroundColor: 'var(--neutral-100)' }}>
                <tr>
                  <th className="text-left p-4 font-semibold">Date</th>
                  <th className="text-left p-4 font-semibold">Type</th>
                  <th className="text-left p-4 font-semibold">Pièce</th>
                  <th className="text-left p-4 font-semibold">Quantité</th>
                  <th className="text-left p-4 font-semibold">Stock avant</th>
                  <th className="text-left p-4 font-semibold">Stock après</th>
                  <th className="text-left p-4 font-semibold">Référence</th>
                  <th className="text-left p-4 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map(movement => (
                  <tr key={movement.id} className="border-t hover:bg-gray-50">
                    <td className="p-4">
                      <p className="text-sm">{format(new Date(movement.created_at), 'dd/MM/yyyy')}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {format(new Date(movement.created_at), 'HH:mm')}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getMovementIcon(movement.movement_type)}
                        <span
                          className="font-semibold"
                          style={{
                            color: movement.movement_type === 'in' ? 'var(--success)' : 'var(--danger)'
                          }}
                        >
                          {getMovementLabel(movement.movement_type)}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold">{movement.parts_inventory.name}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {movement.parts_inventory.reference}
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-lg">
                        {movement.movement_type === 'in' ? '+' : '-'}{movement.quantity}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {movement.parts_inventory.unit}
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold">{movement.stock_before || '-'}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold">{movement.stock_after || '-'}</p>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100">
                        {REFERENCE_TYPES[movement.reference_type] || movement.reference_type}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-sm max-w-xs truncate">{movement.notes || '-'}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredMovements.length === 0 && (
              <div className="p-12 text-center">
                <Filter className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-secondary)' }} />
                <p className="font-semibold mb-1">Aucun mouvement trouvé</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {movements.length === 0
                    ? 'Aucun mouvement enregistré'
                    : 'Aucun résultat ne correspond aux filtres'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
