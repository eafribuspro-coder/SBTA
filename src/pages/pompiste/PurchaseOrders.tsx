import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Plus, Search, X, FileText, CheckCircle, XCircle, Truck } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';
import { format } from 'date-fns';

interface PO {
  id: string; order_number: string; order_date: string; quantity: number;
  unit_price: number; total_amount: number; status: string; observations: string | null;
  created_at: string;
  fuel_suppliers?: { name: string };
  fuel_products?: { designation: string; unit: string };
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:     { label: 'Brouillon',          color: '#6B7280', bg: '#F9FAFB' },
  valide:        { label: 'Validé',             color: '#3B82F6', bg: '#EFF6FF' },
  livre_partiel: { label: 'Livré partiellement', color: '#F59E0B', bg: '#FFFBEB' },
  livre_total:   { label: 'Livré totalement',   color: '#16A34A', bg: '#F0FDF4' },
  annule:        { label: 'Annulé',             color: '#EF4444', bg: '#FEF2F2' },
};

const EMPTY = { supplier_id: '', product_id: '', order_date: new Date().toISOString().split('T')[0], quantity: '', unit_price: '', observations: '' };

export default function PurchaseOrders() {
  const [orders, setOrders] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { load(); loadRefs(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('fuel_purchase_orders')
      .select('*, fuel_suppliers:supplier_id(name), fuel_products:product_id(designation, unit)')
      .order('created_at', { ascending: false });
    if (error) toast.error('Erreur de chargement');
    else setOrders((data as PO[]) || []);
    setLoading(false);
  };

  const loadRefs = async () => {
    const [s, p] = await Promise.all([
      supabase.from('fuel_suppliers').select('id, name').eq('is_active', true).order('name'),
      supabase.from('fuel_products').select('id, designation, unit_price, unit').eq('is_active', true).order('designation'),
    ]);
    setSuppliers(s.data || []);
    setProducts(p.data || []);
  };

  const handleProductChange = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    setForm(f => ({ ...f, product_id: productId, unit_price: prod ? String(prod.unit_price) : '' }));
  };

  const handleSave = async () => {
    if (!form.supplier_id || !form.product_id || !form.quantity) { toast.error('Fournisseur, produit et quantité obligatoires'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('fuel_purchase_orders').insert({
        order_number: '',
        order_date: form.order_date,
        supplier_id: form.supplier_id,
        product_id: form.product_id,
        quantity: parseFloat(form.quantity),
        unit_price: parseFloat(form.unit_price) || 0,
        status: 'brouillon',
        observations: form.observations.trim() || null,
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success('Bon de commande créé');
      setShowForm(false); load();
    } catch (e: any) { toast.error(e.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const changeStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('fuel_purchase_orders').update({ status: newStatus }).eq('id', id);
    if (error) toast.error('Erreur');
    else { toast.success('Statut mis à jour'); load(); }
  };

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchQ = !q || o.order_number.toLowerCase().includes(q) || ((o.fuel_suppliers as any)?.name || '').toLowerCase().includes(q);
    const matchS = !filterStatus || o.status === filterStatus;
    return matchQ && matchS;
  });

  const qty = parseFloat(form.quantity) || 0;
  const up = parseFloat(form.unit_price) || 0;
  const totalCalc = qty * up;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Bons de commande</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{orders.length} bon(s) au total</p>
        </div>
        <button onClick={() => { setForm({ ...EMPTY }); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
          style={{ backgroundColor: 'var(--primary)' }}>
          <Plus className="w-4 h-4" /> Nouveau bon
        </button>
      </div>

      {/* filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="N° bon, fournisseur…"
            className="w-full pl-9 py-2.5 border rounded-xl text-sm outline-none"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 border rounded-xl text-sm"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}>
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle, #F9FAFB)' }}>
                {['N° Bon', 'Date', 'Fournisseur', 'Produit', 'Quantité', 'Prix unit.', 'Montant total', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const cfg = STATUS_CFG[o.status] || STATUS_CFG.brouillon;
                return (
                  <tr key={o.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{o.order_number}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{format(new Date(o.order_date), 'dd/MM/yyyy')}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>{(o.fuel_suppliers as any)?.name || '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{(o.fuel_products as any)?.designation || '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{Number(o.quantity).toLocaleString()} {(o.fuel_products as any)?.unit || 'L'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(o.unit_price)}</td>
                    <td className="px-4 py-3 font-bold" style={{ color: 'var(--primary)' }}>{formatCurrency(o.total_amount)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {o.status === 'brouillon' && (
                        <button onClick={() => changeStatus(o.id, 'valide')}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium"
                          style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>
                          <CheckCircle className="w-3.5 h-3.5" /> Valider
                        </button>
                      )}
                      {o.status === 'valide' && (
                        <button onClick={() => changeStatus(o.id, 'livre_total')}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium"
                          style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>
                          <Truck className="w-3.5 h-3.5" /> Livré
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                  <FileText className="w-10 h-10 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
                  Aucun bon de commande
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowForm(false)}>
          <div className="rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Nouveau bon de commande</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="px-7 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Date</label>
                <input type="date" value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))}
                  className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Fournisseur *</label>
                <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                  className="w-full px-3 py-2.5 border rounded-xl text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}>
                  <option value="">— Sélectionner —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Produit *</label>
                <select value={form.product_id} onChange={e => handleProductChange(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-xl text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}>
                  <option value="">— Sélectionner —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.designation} ({p.unit})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Quantité *</label>
                  <input type="number" min={0} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Prix unitaire (FCFA)</label>
                  <input type="number" min={0} value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              {totalCalc > 0 && (
                <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: 'var(--primary-light)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Montant total calculé</p>
                  <p className="text-2xl font-black" style={{ color: 'var(--primary)' }}>{formatCurrency(totalCalc)}</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Observations</label>
                <textarea value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
                  rows={2} className="w-full px-3 py-2.5 border rounded-xl text-sm resize-none outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="flex gap-3 px-7 pb-7">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border font-semibold text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Annuler</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)' }}>{saving ? 'Enregistrement…' : 'Créer le bon'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
