import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Plus, CreditCard as Edit2, Trash2, Search, FileText, AlertTriangle, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/formatCurrency';

interface Expense {
  id: string;
  bus_id: string;
  expense_type: string;
  amount: number;
  description: string;
  expense_date: string;
  expiry_date: string | null;
  schedule_id: string | null;
  document_url: string | null;
  status: string;
  validated_by: string | null;
  validated_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  buses: {
    registration_number: string;
    model: string;
  };
}

interface Bus {
  id: string;
  registration_number: string;
  model: string;
}

interface Schedule {
  id: string;
  route_name: string;
  departure_datetime: string;
}

const EXPENSE_TYPES = [
  { value: 'assurance', label: 'Assurance', hasExpiry: true },
  { value: 'peage', label: 'Péage', hasExpiry: false },
  { value: 'vignette', label: 'Vignette', hasExpiry: true },
  { value: 'visite_technique', label: 'Visite technique', hasExpiry: true },
  { value: 'lavage', label: 'Lavage', hasExpiry: false },
  { value: 'parking', label: 'Parking', hasExpiry: false },
  { value: 'amende', label: 'Amende', hasExpiry: false },
  { value: 'taxe_route', label: 'Taxe route', hasExpiry: false },
  { value: 'autre', label: 'Autre', hasExpiry: false }
];

export default function Expenses() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [formData, setFormData] = useState({
    bus_id: '',
    expense_type: '',
    amount: 0,
    description: '',
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    expiry_date: '',
    schedule_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [expenses, searchQuery, filterType, filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [expensesRes, busesRes, schedulesRes] = await Promise.all([
        supabase
          .from('bus_expenses')
          .select(`
            *,
            buses:bus_id (
              registration_number,
              model
            )
          `)
          .order('expense_date', { ascending: false }),
        supabase
          .from('buses')
          .select('id, registration_number, model')
          .eq('is_active', true)
          .order('registration_number', { ascending: true }),
        supabase
          .from('schedules')
          .select('id, route_name, departure_datetime')
          .gte('departure_datetime', new Date().toISOString())
          .order('departure_datetime', { ascending: true })
          .limit(50)
      ]);

      if (expensesRes.error) throw expensesRes.error;
      if (busesRes.error) throw busesRes.error;
      if (schedulesRes.error) throw schedulesRes.error;

      setExpenses(expensesRes.data || []);
      setBuses(busesRes.data || []);
      setSchedules(schedulesRes.data || []);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...expenses];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        expense =>
          expense.buses.registration_number.toLowerCase().includes(query) ||
          expense.description.toLowerCase().includes(query)
      );
    }

    if (filterType) {
      filtered = filtered.filter(expense => expense.expense_type === filterType);
    }

    if (filterStatus) {
      filtered = filtered.filter(expense => expense.status === filterStatus);
    }

    setFilteredExpenses(filtered);
  };

  const openModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        bus_id: expense.bus_id,
        expense_type: expense.expense_type,
        amount: expense.amount,
        description: expense.description,
        expense_date: expense.expense_date,
        expiry_date: expense.expiry_date || '',
        schedule_id: expense.schedule_id || ''
      });
    } else {
      setEditingExpense(null);
      setFormData({
        bus_id: '',
        expense_type: '',
        amount: 0,
        description: '',
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        expiry_date: '',
        schedule_id: ''
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.bus_id || !formData.expense_type || formData.amount <= 0) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      const expenseData = {
        bus_id: formData.bus_id,
        expense_type: formData.expense_type,
        amount: formData.amount,
        description: formData.description,
        expense_date: formData.expense_date,
        expiry_date: formData.expiry_date || null,
        schedule_id: formData.schedule_id || null,
        status: 'pending'
      };

      if (editingExpense) {
        const { error } = await supabase
          .from('bus_expenses')
          .update({ ...expenseData, updated_at: new Date().toISOString() })
          .eq('id', editingExpense.id);

        if (error) throw error;
        toast.success('Charge modifiée');
      } else {
        const { error } = await supabase
          .from('bus_expenses')
          .insert({
            ...expenseData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
        toast.success('Charge ajoutée');
      }

      setShowModal(false);
      loadData();
    } catch (error: any) {
      toast.error("Erreur lors de l'enregistrement");
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette charge ?')) return;

    try {
      const { error } = await supabase.from('bus_expenses').delete().eq('id', id);

      if (error) throw error;
      toast.success('Charge supprimée');
      loadData();
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      pending: { bg: 'var(--warning-light)', color: 'var(--warning)', label: 'En attente' },
      validated: { bg: 'var(--success-light)', color: 'var(--success)', label: 'Validée' },
      rejected: { bg: 'var(--danger-light)', color: 'var(--danger)', label: 'Rejetée' }
    };

    const style = styles[status] || styles.pending;

    return (
      <span
        className="px-3 py-1 rounded-full text-xs font-medium"
        style={{ backgroundColor: style.bg, color: style.color }}
      >
        {style.label}
      </span>
    );
  };

  const getExpiryAlert = (expiryDate: string | null) => {
    if (!expiryDate) return null;

    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      return (
        <span className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: '#7F1D1D', color: '#FEE2E2' }}>
          EXPIRÉ
        </span>
      );
    }
    if (daysUntilExpiry <= 7) {
      return (
        <span className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: 'var(--danger)', color: 'white' }}>
          URGENT - expire dans {daysUntilExpiry}j
        </span>
      );
    }
    if (daysUntilExpiry <= 30) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}>
          Renouvellement dans {daysUntilExpiry}j
        </span>
      );
    }

    return null;
  };

  const selectedTypeConfig = EXPENSE_TYPES.find(t => t.value === formData.expense_type);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Charges bus
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Gestion des charges et dépenses des bus</p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-6 py-3 rounded-lg text-white font-bold flex items-center gap-2"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Plus className="w-5 h-5" />
          Nouvelle charge
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">Tous types</option>
            {EXPENSE_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">Tous statuts</option>
            <option value="pending">En attente</option>
            <option value="validated">Validée</option>
            <option value="rejected">Rejetée</option>
          </select>
        </div>
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
                  <th className="text-left p-4 font-semibold">Bus</th>
                  <th className="text-left p-4 font-semibold">Type</th>
                  <th className="text-left p-4 font-semibold">Description</th>
                  <th className="text-left p-4 font-semibold">Montant</th>
                  <th className="text-left p-4 font-semibold">Expiration</th>
                  <th className="text-left p-4 font-semibold">Statut</th>
                  <th className="text-left p-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(expense => {
                  const typeConfig = EXPENSE_TYPES.find(t => t.value === expense.expense_type);
                  const expiryAlert = getExpiryAlert(expense.expiry_date);

                  return (
                    <tr key={expense.id} className="border-t hover:bg-gray-50">
                      <td className="p-4">
                        <p className="text-sm">{format(new Date(expense.expense_date), 'dd/MM/yyyy')}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold">{expense.buses.registration_number}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {expense.buses.model}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100">
                          {typeConfig?.label || expense.expense_type}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="text-sm">{expense.description}</p>
                        {expense.schedule_id && (
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            Voyage lié
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-lg" style={{ color: 'var(--primary)' }}>
                          {formatCurrency(expense.amount)}
                        </p>
                      </td>
                      <td className="p-4">
                        {expense.expiry_date ? (
                          <div>
                            <p className="text-sm mb-1">{format(new Date(expense.expiry_date), 'dd/MM/yyyy')}</p>
                            {expiryAlert}
                          </div>
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>-</span>
                        )}
                      </td>
                      <td className="p-4">
                        {getStatusBadge(expense.status)}
                        {expense.status === 'rejected' && expense.rejection_reason && (
                          <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>
                            {expense.rejection_reason}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {expense.status === 'pending' && (
                            <>
                              <button
                                onClick={() => openModal(expense)}
                                className="p-2 rounded-lg border hover:bg-gray-50"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(expense.id)}
                                className="p-2 rounded-lg border hover:bg-red-50"
                                style={{ color: 'var(--danger)' }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredExpenses.length === 0 && (
              <div className="p-12 text-center">
                <DollarSign className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-secondary)' }} />
                <p className="font-semibold mb-1">Aucune charge trouvée</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {expenses.length === 0 ? 'Ajoutez votre première charge' : 'Aucun résultat ne correspond aux filtres'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-xl mb-6">
              {editingExpense ? 'Modifier la charge' : 'Nouvelle charge'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block mb-2 font-medium">Bus *</label>
                  <select
                    value={formData.bus_id}
                    onChange={(e) => setFormData({ ...formData, bus_id: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    required
                  >
                    <option value="">Sélectionner un bus</option>
                    {buses.map(bus => (
                      <option key={bus.id} value={bus.id}>
                        {bus.registration_number} - {bus.model}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-medium">Type de charge *</label>
                  <select
                    value={formData.expense_type}
                    onChange={(e) => setFormData({ ...formData, expense_type: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    required
                  >
                    <option value="">Sélectionner un type</option>
                    {EXPENSE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-medium">Montant (FCFA) *</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full p-3 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Date de la charge *</label>
                  <input
                    type="date"
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    required
                  />
                </div>

                {selectedTypeConfig?.hasExpiry && (
                  <div>
                    <label className="block mb-2 font-medium">Date d'expiration</label>
                    <input
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                    />
                  </div>
                )}

                {formData.expense_type === 'peage' && (
                  <div>
                    <label className="block mb-2 font-medium">Voyage associé (optionnel)</label>
                    <select
                      value={formData.schedule_id}
                      onChange={(e) => setFormData({ ...formData, schedule_id: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                    >
                      <option value="">Aucun</option>
                      {schedules.map(schedule => (
                        <option key={schedule.id} value={schedule.id}>
                          {schedule.route_name} - {format(new Date(schedule.departure_datetime), 'dd/MM/yyyy HH:mm')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block mb-2 font-medium">Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    rows={3}
                    required
                    placeholder="Détails de la charge..."
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 rounded-lg border font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-lg text-white font-bold"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {editingExpense ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
