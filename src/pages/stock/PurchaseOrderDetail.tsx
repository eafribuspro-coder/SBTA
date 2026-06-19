import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Send, Package, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatCurrency';

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  total_amount: number;
  status: string;
  notes: string;
  ordered_at: string | null;
  received_at: string | null;
  created_at: string;
  spare_parts_suppliers: {
    name: string;
    code: string;
    contact_person: string;
    phone: string;
    email: string;
  };
  purchase_order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    received_quantity: number;
    parts_inventory: {
      id: string;
      reference: string;
      name: string;
      unit: string;
      stock_quantity: number;
    };
  }[];
}

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    loadPurchaseOrder();
  }, [id]);

  const loadPurchaseOrder = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('spare_parts_purchase_orders')
        .select(`
          *,
          spare_parts_suppliers:supplier_id (
            name,
            code,
            contact_person,
            phone,
            email
          ),
          purchase_order_items:spare_parts_purchase_order_items (
            id,
            quantity,
            unit_price,
            total_price,
            received_quantity,
            parts_inventory:part_id (
              id,
              reference,
              name,
              unit,
              stock_quantity
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setPurchaseOrder(data as PurchaseOrder);

      const quantities: Record<string, number> = {};
      data.purchase_order_items.forEach((item: any) => {
        quantities[item.id] = item.quantity - item.received_quantity;
      });
      setReceivedQuantities(quantities);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkOrdered = async () => {
    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('spare_parts_purchase_orders')
        .update({
          status: 'ordered',
          ordered_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Bon de commande marqué comme commandé');
      loadPurchaseOrder();
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async () => {
    try {
      setSubmitting(true);

      for (const [itemId, qty] of Object.entries(receivedQuantities)) {
        if (qty <= 0) continue;

        const item = purchaseOrder?.purchase_order_items.find(i => i.id === itemId);
        if (!item) continue;

        const newReceivedQty = item.received_quantity + qty;

        const { error: itemError } = await supabase
          .from('spare_parts_purchase_order_items')
          .update({
            received_quantity: newReceivedQty,
            updated_at: new Date().toISOString()
          })
          .eq('id', itemId);

        if (itemError) throw itemError;

        const { error: stockError } = await supabase
          .from('spare_parts_stock_movements')
          .insert({
            part_id: item.parts_inventory.id,
            movement_type: 'in',
            quantity: qty,
            reference_type: 'purchase_order',
            reference_id: id,
            notes: `Réception BC ${purchaseOrder?.po_number}`,
            created_at: new Date().toISOString()
          });

        if (stockError) throw stockError;

        const { error: updateStockError } = await supabase
          .from('parts_inventory')
          .update({
            stock_quantity: item.parts_inventory.stock_quantity + qty,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.parts_inventory.id);

        if (updateStockError) throw updateStockError;
      }

      const allReceived = purchaseOrder?.purchase_order_items.every(
        item => item.received_quantity + (receivedQuantities[item.id] || 0) >= item.quantity
      );

      const someReceived = purchaseOrder?.purchase_order_items.some(
        item => (item.received_quantity + (receivedQuantities[item.id] || 0)) > 0
      );

      const newStatus = allReceived ? 'completed' : someReceived ? 'partial' : 'ordered';

      const { error: poError } = await supabase
        .from('spare_parts_purchase_orders')
        .update({
          status: newStatus,
          received_at: allReceived ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (poError) throw poError;

      toast.success(
        allReceived ? 'Réception complète effectuée' : 'Réception partielle effectuée'
      );
      navigate('/stock/purchase-orders');
    } catch (error: any) {
      toast.error('Erreur lors de la réception');
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

  if (!purchaseOrder) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p>Bon de commande introuvable</p>
        </div>
      </div>
    );
  }

  const canOrder = purchaseOrder.status === 'draft';
  const canReceive = purchaseOrder.status === 'ordered' || purchaseOrder.status === 'partial';

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {purchaseOrder.po_number}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Créé le {format(new Date(purchaseOrder.created_at), 'dd/MM/yyyy à HH:mm')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-bold mb-4">Fournisseur</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>Nom</p>
                  <p className="font-bold">{purchaseOrder.spare_parts_suppliers.name}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>Code</p>
                  <p className="font-mono font-semibold">{purchaseOrder.spare_parts_suppliers.code}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>Contact</p>
                  <p className="font-semibold">{purchaseOrder.spare_parts_suppliers.contact_person}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>Téléphone</p>
                  <p className="font-semibold">{purchaseOrder.spare_parts_suppliers.phone}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-bold mb-4">Articles commandés</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ backgroundColor: 'var(--neutral-100)' }}>
                    <tr>
                      <th className="text-left p-2">Réf</th>
                      <th className="text-left p-2">Désignation</th>
                      <th className="text-left p-2">Qté cmd</th>
                      <th className="text-left p-2">Qté reçue</th>
                      {canReceive && <th className="text-left p-2">À recevoir</th>}
                      <th className="text-left p-2">Prix/U</th>
                      <th className="text-left p-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrder.purchase_order_items.map(item => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2 font-mono">{item.parts_inventory.reference}</td>
                        <td className="p-2 font-semibold">{item.parts_inventory.name}</td>
                        <td className="p-2">{item.quantity} {item.parts_inventory.unit}</td>
                        <td className="p-2">
                          <span className="font-semibold">{item.received_quantity}</span>
                          {item.received_quantity >= item.quantity && (
                            <CheckCircle className="inline w-4 h-4 ml-1 text-green-600" />
                          )}
                        </td>
                        {canReceive && (
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              max={item.quantity - item.received_quantity}
                              value={receivedQuantities[item.id] || 0}
                              onChange={(e) =>
                                setReceivedQuantities({
                                  ...receivedQuantities,
                                  [item.id]: parseInt(e.target.value) || 0
                                })
                              }
                              className="w-20 p-1 border rounded"
                            />
                          </td>
                        )}
                        <td className="p-2">{formatCurrency(item.unit_price)}</td>
                        <td className="p-2 font-bold">{formatCurrency(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot style={{ backgroundColor: 'var(--neutral-100)' }}>
                    <tr>
                      <td colSpan={canReceive ? 6 : 5} className="p-2 font-semibold text-right">
                        TOTAL
                      </td>
                      <td className="p-2 font-bold text-lg" style={{ color: 'var(--primary)' }}>
                        {formatCurrency(purchaseOrder.total_amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {purchaseOrder.notes && (
              <div className="bg-white rounded-xl p-6 border">
                <h3 className="font-bold mb-4">Notes</h3>
                <p className="text-sm">{purchaseOrder.notes}</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border sticky top-8">
              <h3 className="font-bold mb-4">Actions</h3>

              {canOrder && (
                <button
                  onClick={handleMarkOrdered}
                  disabled={submitting}
                  className="w-full px-6 py-3 rounded-lg text-white font-bold flex items-center justify-center gap-2 mb-3 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <Send className="w-5 h-5" />
                  {submitting ? 'Envoi...' : 'Marquer comme commandé'}
                </button>
              )}

              {canReceive && (
                <button
                  onClick={handleReceive}
                  disabled={
                    submitting ||
                    Object.values(receivedQuantities).every(qty => qty === 0)
                  }
                  className="w-full px-6 py-3 rounded-lg text-white font-bold flex items-center justify-center gap-2 mb-3 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--success)' }}
                >
                  <Package className="w-5 h-5" />
                  {submitting ? 'Réception...' : 'Enregistrer la réception'}
                </button>
              )}

              <button
                onClick={() => navigate('/stock/purchase-orders')}
                className="w-full px-6 py-3 rounded-lg border font-medium"
              >
                Retour à la liste
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
