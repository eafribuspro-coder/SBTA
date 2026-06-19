import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Plus, CreditCard as Edit2, Trash2, Search, AlertTriangle, Package } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';

interface Part {
  id: string;
  reference: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  stock_quantity: number;
  min_stock: number;
  max_stock: number;
  purchase_price: number;
  selling_price: number;
  location: string;
  compatible_models: string[];
  image_url: string | null;
  created_at: string;
}

const CATEGORIES = [
  'Moteur',
  'Transmission',
  'Freinage',
  'Suspension',
  'Électrique',
  'Carrosserie',
  'Pneumatiques',
  'Climatisation',
  'Autre'
];

const UNITS = ['Unité', 'Lot', 'Paire', 'Litre', 'Kg', 'Mètre'];

const BRANDS = [
  'Bosch',
  'Valeo',
  'Mann',
  'Febi',
  'TRW',
  'Continental',
  'Michelin',
  'Autre'
];

export default function Parts() {
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState<Part[]>([]);
  const [filteredParts, setFilteredParts] = useState<Part[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [formData, setFormData] = useState({
    reference: '',
    name: '',
    category: '',
    brand: '',
    unit: 'Unité',
    stock_quantity: 0,
    min_stock: 5,
    max_stock: 50,
    purchase_price: 0,
    selling_price: 0,
    location: '',
    compatible_models: ''
  });

  useEffect(() => {
    loadParts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [parts, searchQuery, filterCategory, filterBrand, filterStatus]);

  const loadParts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('parts_inventory')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setParts(data || []);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...parts];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        part =>
          part.reference.toLowerCase().includes(query) ||
          part.name.toLowerCase().includes(query) ||
          part.brand.toLowerCase().includes(query)
      );
    }

    if (filterCategory) {
      filtered = filtered.filter(part => part.category === filterCategory);
    }

    if (filterBrand) {
      filtered = filtered.filter(part => part.brand === filterBrand);
    }

    if (filterStatus) {
      filtered = filtered.filter(part => {
        if (filterStatus === 'low') return part.stock_quantity < part.min_stock;
        if (filterStatus === 'warning')
          return part.stock_quantity >= part.min_stock && part.stock_quantity <= part.min_stock * 1.2;
        if (filterStatus === 'ok') return part.stock_quantity > part.min_stock * 1.2;
        return true;
      });
    }

    setFilteredParts(filtered);
  };

  const getStockStatus = (part: Part) => {
    if (part.stock_quantity < part.min_stock) {
      return { color: 'var(--danger)', bg: 'var(--danger-light)', label: 'Critique', icon: '🔴' };
    }
    if (part.stock_quantity <= part.min_stock * 1.2) {
      return { color: 'var(--warning)', bg: 'var(--warning-light)', label: 'Bas', icon: '🟠' };
    }
    return { color: 'var(--success)', bg: 'var(--success-light)', label: 'OK', icon: '🟢' };
  };

  const openModal = (part?: Part) => {
    if (part) {
      setEditingPart(part);
      setFormData({
        reference: part.reference,
        name: part.name,
        category: part.category,
        brand: part.brand,
        unit: part.unit,
        stock_quantity: part.stock_quantity,
        min_stock: part.min_stock,
        max_stock: part.max_stock,
        purchase_price: part.purchase_price,
        selling_price: part.selling_price,
        location: part.location,
        compatible_models: part.compatible_models?.join(', ') || ''
      });
    } else {
      setEditingPart(null);
      setFormData({
        reference: '',
        name: '',
        category: '',
        brand: '',
        unit: 'Unité',
        stock_quantity: 0,
        min_stock: 5,
        max_stock: 50,
        purchase_price: 0,
        selling_price: 0,
        location: '',
        compatible_models: ''
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.reference || !formData.name || !formData.category) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      const compatibleModelsArray = formData.compatible_models
        .split(',')
        .map(m => m.trim())
        .filter(m => m);

      const partData = {
        reference: formData.reference,
        name: formData.name,
        category: formData.category,
        brand: formData.brand,
        unit: formData.unit,
        stock_quantity: formData.stock_quantity,
        min_stock: formData.min_stock,
        max_stock: formData.max_stock,
        purchase_price: formData.purchase_price,
        selling_price: formData.selling_price,
        location: formData.location,
        compatible_models: compatibleModelsArray
      };

      if (editingPart) {
        const { error } = await supabase
          .from('parts_inventory')
          .update({ ...partData, updated_at: new Date().toISOString() })
          .eq('id', editingPart.id);

        if (error) throw error;
        toast.success('Pièce modifiée');
      } else {
        const { error } = await supabase
          .from('parts_inventory')
          .insert({
            ...partData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
        toast.success('Pièce ajoutée');
      }

      setShowModal(false);
      loadParts();
    } catch (error: any) {
      toast.error("Erreur lors de l'enregistrement");
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette pièce ?')) return;

    try {
      const { error } = await supabase.from('parts_inventory').delete().eq('id', id);

      if (error) throw error;
      toast.success('Pièce supprimée');
      loadParts();
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Pièces détachées
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Gestion du stock de pièces</p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-6 py-3 rounded-lg text-white font-bold flex items-center gap-2"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Plus className="w-5 h-5" />
          Nouvelle pièce
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par référence, nom ou marque..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">Toutes catégories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">Toutes marques</option>
            {BRANDS.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">Tous statuts</option>
            <option value="low">🔴 Critique</option>
            <option value="warning">🟠 Bas</option>
            <option value="ok">🟢 OK</option>
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
                  <th className="text-left p-4 font-semibold">Référence</th>
                  <th className="text-left p-4 font-semibold">Désignation</th>
                  <th className="text-left p-4 font-semibold">Catégorie</th>
                  <th className="text-left p-4 font-semibold">Marque</th>
                  <th className="text-left p-4 font-semibold">Stock</th>
                  <th className="text-left p-4 font-semibold">Min/Max</th>
                  <th className="text-left p-4 font-semibold">Prix achat</th>
                  <th className="text-left p-4 font-semibold">Prix vente</th>
                  <th className="text-left p-4 font-semibold">Statut</th>
                  <th className="text-left p-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredParts.map(part => {
                  const status = getStockStatus(part);
                  return (
                    <tr key={part.id} className="border-t hover:bg-gray-50">
                      <td className="p-4">
                        <p className="font-mono font-bold">{part.reference}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold">{part.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {part.location}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100">
                          {part.category}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="font-medium">{part.brand}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-lg">{part.stock_quantity}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {part.unit}
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm">
                          Min: <span className="font-semibold">{part.min_stock}</span>
                        </p>
                        <p className="text-sm">
                          Max: <span className="font-semibold">{part.max_stock}</span>
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold">{formatCurrency(part.purchase_price)}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold" style={{ color: 'var(--primary)' }}>
                          {formatCurrency(part.selling_price)}
                        </p>
                      </td>
                      <td className="p-4">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-bold"
                          style={{ backgroundColor: status.bg, color: status.color }}
                        >
                          {status.icon} {status.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openModal(part)}
                            className="p-2 rounded-lg border hover:bg-gray-50"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(part.id)}
                            className="p-2 rounded-lg border hover:bg-red-50"
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredParts.length === 0 && (
              <div className="p-12 text-center">
                <Package className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-secondary)' }} />
                <p className="font-semibold mb-1">Aucune pièce trouvée</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {parts.length === 0 ? 'Ajoutez votre première pièce' : 'Aucun résultat ne correspond aux filtres'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-xl mb-6">
              {editingPart ? 'Modifier la pièce' : 'Nouvelle pièce'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block mb-2 font-medium">Référence *</label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Nom *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Catégorie *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    required
                  >
                    <option value="">Sélectionner</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-medium">Marque</label>
                  <select
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                  >
                    <option value="">Sélectionner</option>
                    {BRANDS.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-medium">Unité</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                  >
                    {UNITS.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-medium">Stock actuel</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Stock minimum</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Stock maximum</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.max_stock}
                    onChange={(e) => setFormData({ ...formData, max_stock: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Prix d'achat (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Prix de vente (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Emplacement</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    placeholder="Ex: Étagère A-12"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Modèles compatibles</label>
                  <input
                    type="text"
                    value={formData.compatible_models}
                    onChange={(e) => setFormData({ ...formData, compatible_models: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    placeholder="Ex: Mercedes Sprinter, Iveco Daily"
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Séparer par des virgules
                  </p>
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
                  {editingPart ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
