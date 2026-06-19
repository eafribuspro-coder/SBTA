import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { Search, Plus, Trash2, AlertTriangle, Send, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatCurrency';

interface DiagnosticData {
  id: string;
  diagnosis_summary: string | null;
  estimated_duration_hours: number | null;
  estimated_cost: number | null;
  bus_id: string | null;
  bus: {
    id: string;
    registration_number: string;
    manufacturer: string | null;
    brand: string | null;
    model: string | null;
    mileage: number | null;
  } | null;
  breakdown_report: {
    id: string;
    title: string | null;
    severity: string;
  } | null;
}

interface SparePart {
  id: string;
  part_number: string;
  name: string;
  category: string;
  unit_price: number;
  stock_quantity: number;
}

interface SelectedPart {
  id: string;
  part_id: string;
  part_number: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  stock_quantity: number;
}

export default function WorkOrderNew() {
  const { diagnosticId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [workDescription, setWorkDescription] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [priority, setPriority] = useState('moyenne');

  useEffect(() => { loadData(); }, [diagnosticId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [diagRes, partsRes] = await Promise.all([
        supabase
          .from('maintenance_diagnostics')
          .select(`
            id, diagnosis_summary, estimated_duration_hours, estimated_cost, bus_id,
            bus:bus_id(id, registration_number, manufacturer, brand, model, mileage),
            breakdown_report:breakdown_report_id(id, title, severity)
          `)
          .eq('id', diagnosticId)
          .maybeSingle(),
        supabase
          .from('spare_parts')
          .select('id, part_number, name, category, unit_price, stock_quantity')
          .order('name'),
      ]);

      if (diagRes.error) throw diagRes.error;
      if (!diagRes.data) {
        toast.error('Diagnostic introuvable');
        navigate('/mecanicien/dashboard');
        return;
      }

      setDiagnostic(diagRes.data as DiagnosticData);
      setParts((partsRes.data as SparePart[]) || []);

      if (diagRes.data.estimated_duration_hours) {
        setEstimatedHours(diagRes.data.estimated_duration_hours.toString());
      }
      if (diagRes.data.diagnosis_summary) {
        setWorkDescription(diagRes.data.diagnosis_summary.split('\n')[0] || '');
      }
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredParts = parts.filter(part =>
    part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addPart = (part: SparePart) => {
    if (selectedParts.find(sp => sp.part_id === part.id)) {
      toast.error('Cette pièce est déjà ajoutée');
      return;
    }
    setSelectedParts(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        part_id: part.id,
        part_number: part.part_number,
        name: part.name,
        quantity: 1,
        unit_price: part.unit_price,
        total: part.unit_price,
        stock_quantity: part.stock_quantity,
      }
    ]);
    setSearchTerm('');
  };

  const updatePartQuantity = (id: string, quantity: number) => {
    setSelectedParts(prev => prev.map(sp =>
      sp.id === id ? { ...sp, quantity, total: quantity * sp.unit_price } : sp
    ));
  };

  const updatePartPrice = (id: string, price: number) => {
    setSelectedParts(prev => prev.map(sp =>
      sp.id === id ? { ...sp, unit_price: price, total: sp.quantity * price } : sp
    ));
  };

  const removePart = (id: string) => {
    setSelectedParts(prev => prev.filter(sp => sp.id !== id));
  };

  const partsSubtotal = selectedParts.reduce((sum, p) => sum + p.total, 0);
  const diagEstimatedCost = diagnostic?.estimated_cost || 0;
  const totalEstimated = partsSubtotal || diagEstimatedCost;

  const outOfStockParts = selectedParts.filter(sp => sp.stock_quantity < sp.quantity);

  const handleSubmit = async () => {
    if (!workDescription.trim()) {
      toast.error('Veuillez décrire les travaux à effectuer');
      return;
    }

    try {
      setSubmitting(true);

      const woNumber = `OT-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      const sparePartsUsed = selectedParts.map(p => ({
        part_id: p.part_id,
        part_number: p.part_number,
        name: p.name,
        quantity: p.quantity,
        unit_price: p.unit_price,
        total: p.total,
      }));

      const { error: woError } = await supabase
        .from('maintenance_work_orders')
        .insert({
          work_order_number: woNumber,
          bus_id: diagnostic?.bus?.id,
          diagnostic_id: diagnosticId,
          assigned_to: user?.id,
          work_description: workDescription,
          estimated_cost: totalEstimated || null,
          estimated_hours: parseFloat(estimatedHours) || null,
          spare_parts_used: sparePartsUsed,
          priority: priority,
          status: 'attente_validation',
          created_by: user?.id,
        });

      if (woError) throw woError;

      await supabase
        .from('maintenance_diagnostics')
        .update({ status: 'termine' })
        .eq('id', diagnosticId);

      if (diagnostic?.bus?.id) {
        await supabase.from('buses')
          .update({ status: 'maintenance', updated_at: new Date().toISOString() })
          .eq('id', diagnostic.bus.id);
      }

      toast.success('Ordre de travail créé et envoyé pour validation');
      navigate('/mecanicien/dashboard');
    } catch (error: any) {
      toast.error('Erreur lors de la création');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center py-12">
        <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
             style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
      </div>
    );
  }

  if (!diagnostic) {
    return (
      <div className="p-8 text-center py-12">
        <p style={{ color: 'var(--text-secondary)' }}>Diagnostic introuvable</p>
      </div>
    );
  }

  const bus = diagnostic.bus;
  const busMake = bus?.manufacturer || bus?.brand || '';

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/mecanicien/dashboard')}
                  className="p-2 rounded-lg border"
                  style={{ borderColor: 'var(--border)' }}>
            <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <div>
            <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Créer un ordre de travail
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              {bus?.registration_number} {busMake || bus?.model ? `— ${[busMake, bus?.model].filter(Boolean).join(' ')}` : ''}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {diagnostic.diagnosis_summary && (
              <div className="rounded-xl p-5 border"
                   style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
                <p className="text-sm font-semibold mb-2" style={{ color: '#1D4ED8' }}>
                  Résumé du diagnostic
                </p>
                <p className="text-sm whitespace-pre-line" style={{ color: '#1E40AF' }}>
                  {diagnostic.diagnosis_summary}
                </p>
              </div>
            )}

            <div className="rounded-xl p-6 border"
                 style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Description des travaux *
              </h3>
              <textarea value={workDescription}
                        onChange={e => setWorkDescription(e.target.value)}
                        className="w-full p-3 border rounded-lg text-sm"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                        rows={4}
                        placeholder="Décrivez les travaux à réaliser..."
                        required />

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block mb-2 text-sm font-medium"
                         style={{ color: 'var(--text-secondary)' }}>
                    Heures estimées
                  </label>
                  <input type="number" step="0.5" value={estimatedHours}
                         onChange={e => setEstimatedHours(e.target.value)}
                         className="w-full p-3 border rounded-lg text-sm"
                         style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                         placeholder="0" />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium"
                         style={{ color: 'var(--text-secondary)' }}>
                    Priorité
                  </label>
                  <select value={priority} onChange={e => setPriority(e.target.value)}
                          className="w-full p-3 border rounded-lg text-sm"
                          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
                    <option value="faible">Faible</option>
                    <option value="moyenne">Moyenne</option>
                    <option value="haute">Haute</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl p-6 border"
                 style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Pièces détachées
              </h3>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-5 h-5"
                          style={{ color: 'var(--text-secondary)' }} />
                  <input type="text" value={searchTerm}
                         onChange={e => setSearchTerm(e.target.value)}
                         className="w-full pl-10 pr-4 py-3 border rounded-lg text-sm"
                         style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                         placeholder="Rechercher par nom, référence ou catégorie..." />
                </div>

                {searchTerm && (
                  <div className="mt-2 border rounded-lg max-h-60 overflow-y-auto shadow-lg"
                       style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                    {filteredParts.slice(0, 10).map(part => (
                      <button key={part.id} type="button" onClick={() => addPart(part)}
                              className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0 flex items-center justify-between gap-4"
                              style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                            {part.name}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            Réf: {part.part_number} — {part.category}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-sm" style={{ color: 'var(--primary)' }}>
                            {formatCurrency(part.unit_price)}
                          </p>
                          <p className={`text-xs font-medium ${part.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            Stock: {part.stock_quantity}
                          </p>
                        </div>
                      </button>
                    ))}
                    {filteredParts.length === 0 && (
                      <p className="p-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Aucune pièce trouvée
                      </p>
                    )}
                  </div>
                )}
              </div>

              {selectedParts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                        <th className="text-left p-3 font-semibold rounded-tl-lg">Réf</th>
                        <th className="text-left p-3 font-semibold">Désignation</th>
                        <th className="text-left p-3 font-semibold">Qté</th>
                        <th className="text-left p-3 font-semibold">Prix/U</th>
                        <th className="text-left p-3 font-semibold">Total</th>
                        <th className="text-left p-3 font-semibold">Stock</th>
                        <th className="p-3 rounded-tr-lg"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedParts.map(part => (
                        <tr key={part.id} className="border-t"
                            style={{ borderColor: 'var(--border)' }}>
                          <td className="p-3 font-mono text-xs">{part.part_number}</td>
                          <td className="p-3 font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {part.name}
                          </td>
                          <td className="p-3">
                            <input type="number" min="1" value={part.quantity}
                                   onChange={e => updatePartQuantity(part.id, parseInt(e.target.value) || 1)}
                                   className="w-20 p-2 border rounded-lg text-sm"
                                   style={{ borderColor: 'var(--border)' }} />
                          </td>
                          <td className="p-3">
                            <input type="number" step="100" value={part.unit_price}
                                   onChange={e => updatePartPrice(part.id, parseFloat(e.target.value) || 0)}
                                   className="w-28 p-2 border rounded-lg text-sm"
                                   style={{ borderColor: 'var(--border)' }} />
                          </td>
                          <td className="p-3 font-bold" style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency(part.total)}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              part.stock_quantity >= part.quantity
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {part.stock_quantity >= part.quantity ? `✓ ${part.stock_quantity}` : `✗ ${part.stock_quantity}`}
                            </span>
                          </td>
                          <td className="p-3">
                            <button type="button" onClick={() => removePart(part.id)}
                                    className="p-1.5 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed rounded-lg"
                     style={{ borderColor: 'var(--border)' }}>
                  <Plus className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Recherchez et ajoutez des pièces ci-dessus
                  </p>
                </div>
              )}

              {outOfStockParts.length > 0 && (
                <div className="mt-4 p-4 rounded-lg border-2 border-red-300 bg-red-50">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-500" />
                    <div>
                      <p className="font-semibold text-sm text-red-700">
                        {outOfStockParts.length} pièce{outOfStockParts.length > 1 ? 's' : ''} en stock insuffisant
                      </p>
                      <p className="text-xs text-red-600 mt-0.5">
                        {outOfStockParts.map(p => p.name).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="rounded-xl p-6 border sticky top-8 space-y-6"
                 style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div>
                <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                  Informations bus
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <p style={{ color: 'var(--text-secondary)' }}>Immatriculation</p>
                    <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                      {bus?.registration_number || '—'}
                    </p>
                  </div>
                  {(busMake || bus?.model) && (
                    <div>
                      <p style={{ color: 'var(--text-secondary)' }}>Modèle</p>
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {[busMake, bus?.model].filter(Boolean).join(' ')}
                      </p>
                    </div>
                  )}
                  {bus?.mileage != null && (
                    <div>
                      <p style={{ color: 'var(--text-secondary)' }}>Kilométrage</p>
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {bus.mileage.toLocaleString()} km
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                  Récapitulatif
                </h3>
                <div className="space-y-2 text-sm">
                  {diagEstimatedCost > 0 && (
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Coût diagnostic estimé</span>
                      <span className="font-semibold">{formatCurrency(diagEstimatedCost)}</span>
                    </div>
                  )}
                  {selectedParts.length > 0 && (
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Sous-total pièces</span>
                      <span className="font-semibold">{formatCurrency(partsSubtotal)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex justify-between">
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                        TOTAL ESTIMÉ
                      </span>
                      <span className="font-bold text-xl" style={{ color: 'var(--primary)' }}>
                        {formatCurrency(totalEstimated)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button type="button" onClick={() => navigate('/mecanicien/dashboard')}
                        className="w-full px-4 py-2.5 rounded-lg border font-medium text-sm"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  Annuler
                </button>
                <button type="button" onClick={handleSubmit}
                        disabled={submitting || !workDescription.trim()}
                        className="w-full px-4 py-3 rounded-lg text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                        style={{ backgroundColor: 'var(--success)' }}>
                  <Send className="w-4 h-4" />
                  {submitting ? 'Envoi...' : 'Valider et envoyer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
