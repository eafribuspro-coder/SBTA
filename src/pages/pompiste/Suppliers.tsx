import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Plus, Search, X, CreditCard as Edit2, EyeOff, Eye, Building2, Phone, Mail, MapPin } from 'lucide-react';

interface Supplier {
  id: string; name: string; phone: string | null; address: string | null;
  email: string | null; fuel_type: string; contact_name: string | null;
  is_active: boolean; observations: string | null; created_at: string;
}

const FUEL_TYPES = ['gasoil', 'essence', 'super', 'jet_a1', 'autre'];
const FUEL_LABELS: Record<string, string> = { gasoil: 'Gasoil', essence: 'Essence', super: 'Super', jet_a1: 'Jet A-1', autre: 'Autre' };

const EMPTY: Omit<Supplier, 'id' | 'created_at'> = {
  name: '', phone: '', address: '', email: '', fuel_type: 'gasoil',
  contact_name: '', is_active: true, observations: '',
};

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('fuel_suppliers').select('*').order('name');
    if (error) toast.error('Erreur de chargement');
    else setSuppliers(data || []);
    setLoading(false);
  };

  const openCreate = () => { setEditingId(null); setForm({ ...EMPTY }); setShowForm(true); };
  const openEdit = (s: Supplier) => {
    setEditingId(s.id);
    setForm({ name: s.name, phone: s.phone || '', address: s.address || '', email: s.email || '',
      fuel_type: s.fuel_type, contact_name: s.contact_name || '', is_active: s.is_active, observations: s.observations || '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Le nom est obligatoire'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...form, name: form.name.trim(), created_by: user?.id };
      if (editingId) {
        const { error } = await supabase.from('fuel_suppliers').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Fournisseur modifié');
      } else {
        const { error } = await supabase.from('fuel_suppliers').insert(payload);
        if (error) throw error;
        toast.success('Fournisseur créé');
      }
      setShowForm(false); load();
    } catch (e: any) { toast.error(e.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (s: Supplier) => {
    await supabase.from('fuel_suppliers').update({ is_active: !s.is_active }).eq('id', s.id);
    toast.success(s.is_active ? 'Désactivé' : 'Activé'); load();
  };

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase();
    const matchQ = !q || s.name.toLowerCase().includes(q) || (s.contact_name || '').toLowerCase().includes(q);
    const matchS = !filterStatus || (filterStatus === 'active' ? s.is_active : !s.is_active);
    return matchQ && matchS;
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Fournisseurs</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{suppliers.filter(s => s.is_active).length} actif(s) sur {suppliers.length}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
          style={{ backgroundColor: 'var(--primary)' }}>
          <Plus className="w-4 h-4" /> Nouveau fournisseur
        </button>
      </div>

      {/* search */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            className="w-full pl-9 py-2.5 border rounded-xl text-sm outline-none"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 border rounded-xl text-sm"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}>
          <option value="">Tous statuts</option>
          <option value="active">Actif</option>
          <option value="inactive">Inactif</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(s => (
            <div key={s.id} className="rounded-xl border p-5" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', opacity: s.is_active ? 1 : 0.65 }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>
                      {FUEL_LABELS[s.fuel_type] || s.fuel_type}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.is_active ? '#F0FDF4' : '#F9FAFB', color: s.is_active ? '#16A34A' : '#6B7280' }}>
                  {s.is_active ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <div className="space-y-1.5 text-sm mb-4">
                {s.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /><span style={{ color: 'var(--text-secondary)' }}>{s.phone}</span></div>}
                {s.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /><span style={{ color: 'var(--text-secondary)' }}>{s.email}</span></div>}
                {s.address && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /><span style={{ color: 'var(--text-secondary)' }}>{s.address}</span></div>}
                {s.contact_name && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Contact : {s.contact_name}</div>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(s)} className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border font-medium"
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                  <Edit2 className="w-3.5 h-3.5" /> Modifier
                </button>
                <button onClick={() => toggleActive(s)} className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  {s.is_active ? <><EyeOff className="w-3.5 h-3.5" /> Désactiver</> : <><Eye className="w-3.5 h-3.5" /> Activer</>}
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16 border-2 border-dashed rounded-2xl" style={{ borderColor: 'var(--border)' }}>
              <Building2 className="w-12 h-12 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Aucun fournisseur trouvé</p>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowForm(false)}>
          <div className="rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{editingId ? 'Modifier' : 'Nouveau fournisseur'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="px-7 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {[
                { label: 'Nom *', key: 'name', placeholder: 'Total Energies CI' },
                { label: 'Téléphone', key: 'phone', placeholder: '+225 07 00 00 00' },
                { label: 'Email', key: 'email', placeholder: 'contact@fournisseur.ci' },
                { label: 'Adresse', key: 'address', placeholder: 'Zone industrielle...' },
                { label: 'Contact principal', key: 'contact_name', placeholder: 'M. Kouassi' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                  <input type="text" value={(form as any)[f.key]} placeholder={f.placeholder}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Type carburant</label>
                <select value={form.fuel_type} onChange={e => setForm(p => ({ ...p, fuel_type: e.target.value }))}
                  className="w-full px-3 py-2.5 border rounded-xl text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}>
                  {FUEL_TYPES.map(t => <option key={t} value={t}>{FUEL_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Observations</label>
                <textarea value={form.observations || ''} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))}
                  rows={2} className="w-full px-3 py-2.5 border rounded-xl text-sm resize-none outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Statut</label>
                {[{ v: true, l: 'Actif' }, { v: false, l: 'Inactif' }].map(o => (
                  <label key={String(o.v)} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" checked={form.is_active === o.v} onChange={() => setForm(p => ({ ...p, is_active: o.v }))} className="w-4 h-4" />
                    {o.l}
                  </label>
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
