import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Plus, Search, X, CreditCard as Edit2, EyeOff, Eye, Package } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';

interface Product {
  id: string; code: string; designation: string; product_type: string;
  unit: string; unit_price: number; min_stock: number; is_active: boolean; created_at: string;
}

const TYPES = ['gasoil', 'essence', 'super', 'huile_moteur', 'autre'];
const TYPE_LABELS: Record<string, string> = { gasoil: 'Gasoil', essence: 'Essence', super: 'Super', huile_moteur: 'Huile moteur', autre: 'Autre' };
const UNITS = ['litre', 'kg', 'bidon', 'baril'];

const EMPTY = { code: '', designation: '', product_type: 'gasoil', unit: 'litre', unit_price: '', min_stock: '', is_active: true };

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('fuel_products').select('*').order('designation');
    if (error) toast.error('Erreur de chargement');
    else setProducts(data || []);
    setLoading(false);
  };

  const openCreate = () => { setEditingId(null); setForm({ ...EMPTY }); setShowForm(true); };
  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({ code: p.code, designation: p.designation, product_type: p.product_type,
      unit: p.unit, unit_price: String(p.unit_price), min_stock: String(p.min_stock), is_active: p.is_active });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.designation.trim()) { toast.error('Code et désignation obligatoires'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { code: form.code.trim().toUpperCase(), designation: form.designation.trim(),
        product_type: form.product_type, unit: form.unit,
        unit_price: parseFloat(form.unit_price as any) || 0, min_stock: parseFloat(form.min_stock as any) || 0,
        is_active: form.is_active, created_by: user?.id };
      if (editingId) {
        const { error } = await supabase.from('fuel_products').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Produit modifié');
      } else {
        const { error } = await supabase.from('fuel_products').insert(payload);
        if (error) throw error;
        toast.success('Produit créé');
      }
      setShowForm(false); load();
    } catch (e: any) { toast.error(e.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (p: Product) => {
    await supabase.from('fuel_products').update({ is_active: !p.is_active }).eq('id', p.id);
    toast.success(p.is_active ? 'Désactivé' : 'Activé'); load();
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return !q || p.designation.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Produits carburant</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{products.filter(p => p.is_active).length} produit(s) actif(s)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
          style={{ backgroundColor: 'var(--primary)' }}>
          <Plus className="w-4 h-4" /> Nouveau produit
        </button>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
          className="w-full pl-9 py-2.5 border rounded-xl text-sm outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle, #F9FAFB)' }}>
                {['Code', 'Désignation', 'Type', 'Unité', 'Prix unitaire', 'Stock min.', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{p.code}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>{p.designation}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{TYPE_LABELS[p.product_type] || p.product_type}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.unit}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(p.unit_price)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.min_stock} {p.unit}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: p.is_active ? '#F0FDF4' : '#F9FAFB', color: p.is_active ? '#16A34A' : '#6B7280' }}>
                      {p.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-gray-100"><Edit2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} /></button>
                      <button onClick={() => toggleActive(p)} className="p-1.5 rounded-lg hover:bg-gray-100">
                        {p.is_active ? <EyeOff className="w-4 h-4" style={{ color: '#F59E0B' }} /> : <Eye className="w-4 h-4" style={{ color: '#16A34A' }} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>Aucun produit trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowForm(false)}>
          <div className="rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{editingId ? 'Modifier le produit' : 'Nouveau produit'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="px-7 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[{ label: 'Code *', key: 'code', placeholder: 'GAS-001' }, { label: 'Désignation *', key: 'designation', placeholder: 'Gasoil' }].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                    <input type="text" value={(form as any)[f.key]} placeholder={f.placeholder}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Type</label>
                  <select value={form.product_type} onChange={e => setForm(p => ({ ...p, product_type: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}>
                    {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Unité</label>
                  <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[{ label: 'Prix unitaire (FCFA)', key: 'unit_price' }, { label: 'Stock minimum', key: 'min_stock' }].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                    <input type="number" min={0} value={(form as any)[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 px-7 pb-7">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border font-semibold text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Annuler</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)' }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
