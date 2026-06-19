import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Plus, CreditCard as Edit2, Trash2, Search, Star, Building2 } from 'lucide-react';

interface Supplier {
  id: string;
  code: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  country: string;
  payment_terms: string;
  is_preferred: boolean;
  created_at: string;
}

const COUNTRIES = [
  'Côte d\'Ivoire',
  'Sénégal',
  'Mali',
  'Burkina Faso',
  'Ghana',
  'Nigeria',
  'France',
  'Autre'
];

const PAYMENT_TERMS = [
  'Comptant',
  '15 jours',
  '30 jours',
  '45 jours',
  '60 jours',
  '90 jours'
];

export default function Suppliers() {
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    country: 'Côte d\'Ivoire',
    payment_terms: '30 jours',
    is_preferred: false
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [suppliers, searchQuery]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('spare_parts_suppliers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...suppliers];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        supplier =>
          supplier.code.toLowerCase().includes(query) ||
          supplier.name.toLowerCase().includes(query) ||
          supplier.contact_person.toLowerCase().includes(query) ||
          supplier.email.toLowerCase().includes(query)
      );
    }

    setFilteredSuppliers(filtered);
  };

  const generateCode = () => {
    const prefix = 'FRNSR';
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${timestamp}`;
  };

  const openModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        code: supplier.code,
        name: supplier.name,
        contact_person: supplier.contact_person,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        country: supplier.country,
        payment_terms: supplier.payment_terms,
        is_preferred: supplier.is_preferred
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        code: generateCode(),
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        country: 'Côte d\'Ivoire',
        payment_terms: '30 jours',
        is_preferred: false
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.contact_person) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from('spare_parts_suppliers')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', editingSupplier.id);

        if (error) throw error;
        toast.success('Fournisseur modifié');
      } else {
        const { error } = await supabase
          .from('spare_parts_suppliers')
          .insert({
            ...formData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
        toast.success('Fournisseur ajouté');
      }

      setShowModal(false);
      loadSuppliers();
    } catch (error: any) {
      toast.error("Erreur lors de l'enregistrement");
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) return;

    try {
      const { error } = await supabase
        .from('spare_parts_suppliers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Fournisseur supprimé');
      loadSuppliers();
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    }
  };

  const togglePreferred = async (supplier: Supplier) => {
    try {
      const { error } = await supabase
        .from('spare_parts_suppliers')
        .update({
          is_preferred: !supplier.is_preferred,
          updated_at: new Date().toISOString()
        })
        .eq('id', supplier.id);

      if (error) throw error;
      toast.success(supplier.is_preferred ? 'Retrait fournisseur préféré' : 'Fournisseur préféré ajouté');
      loadSuppliers();
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Fournisseurs
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Gestion des fournisseurs de pièces détachées</p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-6 py-3 rounded-lg text-white font-bold flex items-center gap-2"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Plus className="w-5 h-5" />
          Nouveau fournisseur
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 border mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un fournisseur..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map(supplier => (
            <div key={supplier.id} className="bg-white rounded-xl p-6 border hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg">{supplier.name}</h3>
                    {supplier.is_preferred && (
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    )}
                  </div>
                  <p className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {supplier.code}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openModal(supplier)}
                    className="p-2 rounded-lg border hover:bg-gray-50"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(supplier.id)}
                    className="p-2 rounded-lg border hover:bg-red-50"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">Contact:</span>
                  <span>{supplier.contact_person}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">Téléphone:</span>
                  <a href={`tel:${supplier.phone}`} className="hover:underline" style={{ color: 'var(--primary)' }}>
                    {supplier.phone}
                  </a>
                </div>

                {supplier.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">Email:</span>
                    <a href={`mailto:${supplier.email}`} className="hover:underline" style={{ color: 'var(--primary)' }}>
                      {supplier.email}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">Pays:</span>
                  <span>{supplier.country}</span>
                </div>

                {supplier.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="font-semibold">Adresse:</span>
                    <span className="flex-1">{supplier.address}</span>
                  </div>
                )}

                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">Conditions:</span>
                    <span className="px-2 py-1 rounded bg-gray-100 text-xs font-medium">
                      {supplier.payment_terms}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => togglePreferred(supplier)}
                className={`w-full px-4 py-2 rounded-lg border-2 font-medium flex items-center justify-center gap-2 transition-colors ${
                  supplier.is_preferred
                    ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Star className={`w-4 h-4 ${supplier.is_preferred ? 'fill-yellow-400' : ''}`} />
                {supplier.is_preferred ? 'Fournisseur préféré' : 'Marquer comme préféré'}
              </button>
            </div>
          ))}
        </div>
      )}

      {filteredSuppliers.length === 0 && !loading && (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Building2 className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-secondary)' }} />
          <p className="font-semibold mb-1">Aucun fournisseur trouvé</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {suppliers.length === 0 ? 'Ajoutez votre premier fournisseur' : 'Aucun résultat ne correspond à votre recherche'}
          </p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-xl mb-6">
              {editingSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block mb-2 font-medium">Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full p-3 border rounded-lg bg-gray-50"
                    readOnly
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
                  <label className="block mb-2 font-medium">Personne de contact *</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Téléphone *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Pays</label>
                  <select
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                  >
                    {COUNTRIES.map(country => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block mb-2 font-medium">Adresse</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Conditions de paiement</label>
                  <select
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                  >
                    {PAYMENT_TERMS.map(term => (
                      <option key={term} value={term}>{term}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-medium">Fournisseur préféré</label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.is_preferred}
                      onChange={(e) => setFormData({ ...formData, is_preferred: e.target.checked })}
                      className="w-5 h-5"
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <span className="flex items-center gap-2">
                      <Star className={`w-4 h-4 ${formData.is_preferred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      Marquer comme préféré
                    </span>
                  </label>
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
                  {editingSupplier ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
