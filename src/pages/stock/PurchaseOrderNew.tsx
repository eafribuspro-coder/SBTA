import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatCurrency';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface Part {
  id: string;
  reference: string;
  name: string;
  purchase_price: number;
  unit: string;
}

interface OrderItem {
  id: string;
  part_id: string;
  part_name: string;
  part_reference: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export default function PurchaseOrderNew() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [suppliersRes, partsRes] = await Promise.all([
        supabase
          .from('spare_parts_suppliers')
          .select('id, code, name')
          .order('name', { ascending: true }),
        supabase
          .from('parts_inventory')
          .select('id, reference, name, purchase_price, unit')
          .order('name', { ascending: true })
      ]);

      if (suppliersRes.error) throw suppliersRes.error;
      if (partsRes.error) throw partsRes.error;

      setSuppliers(suppliersRes.data || []);
      setParts(partsRes.data || []);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const generatePONumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(10000 + Math.random() * 90000);
    return `BC-${year}-${random}`;
  };

  const addItem = () => {
    setOrderItems([
      ...orderItems,
      {
        id: Date.now().toString(),
        part_id: '',
        part_name: '',
        part_reference: '',
        unit: '',
        quantity: 1,
        unit_price: 0,
        total_price: 0
      }
    ]);
  };

  const removeItem = (id: string) => {
    setOrderItems(orderItems.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof OrderItem, value: any) => {
    setOrderItems(
      orderItems.map(item => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        if (field === 'part_id') {
          const part = parts.find(p => p.id === value);
          if (part) {
            updated.part_name = part.name;
            updated.part_reference = part.reference;
            updated.unit = part.unit;
            updated.unit_price = part.purchase_price;
          }
        }

        if (field === 'quantity' || field === 'unit_price') {
          updated.total_price = updated.quantity * updated.unit_price;
        }

        return updated;
      })
    );
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.total_price, 0);
  };

  const handleSubmit = async (status: 'draft' | 'ordered') => {
    if (!selectedSupplier) {
      toast.error('Veuillez sélectionner un fournisseur');
      return;
    }

    if (orderItems.length === 0) {
      toast.error('Veuillez ajouter au moins un article');
      return;
    }

    const invalidItems = orderItems.filter(item => !item.part_id || item.quantity <= 0);
    if (invalidItems.length > 0) {
      toast.error('Veuillez remplir tous les articles correctement');
      return;
    }

    try {
      setSubmitting(true);

      const poNumber = generatePONumber();
      const totalAmount = calculateTotal();

      const { data: poData, error: poError } = await supabase
        .from('spare_parts_purchase_orders')
        .insert({
          po_number: poNumber,
          supplier_id: selectedSupplier,
          total_amount: totalAmount,
          status: status,
          notes: notes,
          ordered_at: status === 'ordered' ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (poError) throw poError;

      const items = orderItems.map(item => ({
        purchase_order_id: poData.id,
        part_id: item.part_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        received_quantity: 0,
        created_at: new Date().toISOString()
      }));

      const { error: itemsError } = await supabase
        .from('spare_parts_purchase_order_items')
        .insert(items);

      if (itemsError) throw itemsError;

      toast.success(
        status === 'draft'
          ? 'Bon de commande créé en brouillon'
          : 'Bon de commande créé et envoyé'
      );
      navigate('/stock/purchase-orders');
    } catch (error: any) {
      toast.error('Erreur lors de la création');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Nouveau bon de commande
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Créer un bon de commande de pièces</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-bold mb-4">Fournisseur</h3>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full p-3 border rounded-lg"
                required
              >
                <option value="">Sélectionner un fournisseur</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} ({supplier.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-xl p-6 border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Articles</h3>
                <button
                  onClick={addItem}
                  className="px-4 py-2 rounded-lg border flex items-center gap-2 hover:bg-gray-50"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un article
                </button>
              </div>

              {orderItems.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Cliquez sur "Ajouter un article" pour commencer
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orderItems.map((item, index) => (
                    <div key={item.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-semibold">Article #{index + 1}</p>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-2 rounded-lg hover:bg-red-50"
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                          <label className="block mb-2 text-sm font-medium">Pièce *</label>
                          <select
                            value={item.part_id}
                            onChange={(e) => updateItem(item.id, 'part_id', e.target.value)}
                            className="w-full p-2 border rounded-lg"
                            required
                          >
                            <option value="">Sélectionner une pièce</option>
                            {parts.map(part => (
                              <option key={part.id} value={part.id}>
                                {part.reference} - {part.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block mb-2 text-sm font-medium">Quantité *</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)
                            }
                            className="w-full p-2 border rounded-lg"
                            required
                          />
                        </div>

                        <div>
                          <label className="block mb-2 text-sm font-medium">Prix unitaire (FCFA) *</label>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={item.unit_price}
                            onChange={(e) =>
                              updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)
                            }
                            className="w-full p-2 border rounded-lg"
                            required
                          />
                        </div>

                        <div className="md:col-span-2">
                          <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--neutral-100)' }}>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">Total article:</span>
                              <span className="font-bold text-lg" style={{ color: 'var(--primary)' }}>
                                {formatCurrency(item.total_price)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-bold mb-4">Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 border rounded-lg"
                rows={4}
                placeholder="Notes ou instructions particulières..."
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border sticky top-8">
              <h3 className="font-bold mb-4">Récapitulatif</h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Articles</span>
                  <span className="font-semibold">{orderItems.length}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Quantité totale</span>
                  <span className="font-semibold">
                    {orderItems.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>

                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">TOTAL</span>
                    <span className="font-bold text-2xl" style={{ color: 'var(--primary)' }}>
                      {formatCurrency(calculateTotal())}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleSubmit('draft')}
                  disabled={submitting || !selectedSupplier || orderItems.length === 0}
                  className="w-full px-6 py-3 rounded-lg border-2 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                >
                  <Save className="w-5 h-5" />
                  {submitting ? 'Enregistrement...' : 'Enregistrer brouillon'}
                </button>

                <button
                  onClick={() => handleSubmit('ordered')}
                  disabled={submitting || !selectedSupplier || orderItems.length === 0}
                  className="w-full px-6 py-3 rounded-lg text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <Send className="w-5 h-5" />
                  {submitting ? 'Envoi...' : 'Créer et commander'}
                </button>

                <button
                  onClick={() => navigate('/stock/purchase-orders')}
                  className="w-full px-6 py-3 rounded-lg border font-medium"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
