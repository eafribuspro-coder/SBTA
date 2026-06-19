import React, { useState, useEffect } from 'react';
import { Droplets, Plus, CreditCard as Edit2, Eye, EyeOff, Search, X, Filter, Phone, MapPin, User, Fuel, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

/* ─── types ─────────────────────────────────────────────────── */

interface FuelTank {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  region: string | null;
  phone: string | null;
  capacity_liters: number;
  current_level_liters: number;
  fuel_type: string;
  pompiste_id: string | null;
  is_active: boolean;
  observations: string | null;
  created_at: string;
  pompiste?: { id: string; full_name: string } | null;
}

interface Pompiste {
  id: string;
  full_name: string;
}

const FUEL_TYPES = ['gasoil', 'essence', 'super', 'jet_a1', 'autre'];

const FUEL_TYPE_LABELS: Record<string, string> = {
  gasoil: 'Gasoil',
  essence: 'Essence',
  super: 'Super',
  jet_a1: 'Jet A-1',
  autre: 'Autre',
};

const EMPTY_FORM = {
  name: '',
  code: '',
  address: '',
  city: '',
  region: '',
  phone: '',
  capacity_liters: '',
  current_level_liters: '',
  fuel_type: 'gasoil',
  pompiste_id: '',
  is_active: true,
  observations: '',
};

/* ─── helpers ────────────────────────────────────────────────── */

function fillPct(current: number, capacity: number) {
  if (!capacity) return 0;
  return Math.min(100, Math.round((current / capacity) * 100));
}

function fillColor(pct: number) {
  if (pct >= 60) return '#16A34A';
  if (pct >= 30) return '#F59E0B';
  return '#EF4444';
}

/* ─── component ─────────────────────────────────────────────── */

export default function FuelTanks() {
  const [tanks, setTanks] = useState<FuelTank[]>([]);
  const [pompistes, setPompistes] = useState<Pompiste[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailTank, setDetailTank] = useState<FuelTank | null>(null);

  // form
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // filters
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPompiste, setFilterPompiste] = useState('');

  useEffect(() => {
    loadTanks();
    loadPompistes();
  }, []);

  const loadTanks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fuel_tanks')
      .select('*, pompiste:pompiste_id(id, full_name)')
      .order('name');
    if (error) { toast.error('Erreur de chargement des cuves'); }
    else setTanks((data as FuelTank[]) || []);
    setLoading(false);
  };

  const loadPompistes = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'pompiste')
      .eq('is_active', true)
      .order('full_name');
    setPompistes(data || []);
  };

  /* ─── CRUD ─── */

  const openCreate = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (tank: FuelTank) => {
    setEditingId(tank.id);
    setFormData({
      name: tank.name,
      code: tank.code,
      address: tank.address || '',
      city: tank.city || '',
      region: tank.region || '',
      phone: tank.phone || '',
      capacity_liters: String(tank.capacity_liters),
      current_level_liters: String(tank.current_level_liters),
      fuel_type: tank.fuel_type,
      pompiste_id: tank.pompiste_id || '',
      is_active: tank.is_active,
      observations: tank.observations || '',
    });
    setShowForm(true);
    setDetailTank(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error('Le nom est obligatoire'); return; }
    if (!formData.code.trim()) { toast.error('Le code est obligatoire'); return; }
    const capacity = parseFloat(formData.capacity_liters) || 0;
    const current = parseFloat(formData.current_level_liters) || 0;
    if (current > capacity) { toast.error('Le niveau actuel ne peut pas dépasser la capacité totale'); return; }

    setSaving(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        region: formData.region.trim() || null,
        phone: formData.phone.trim() || null,
        capacity_liters: capacity,
        current_level_liters: current,
        fuel_type: formData.fuel_type,
        pompiste_id: formData.pompiste_id || null,
        is_active: formData.is_active,
        observations: formData.observations.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase.from('fuel_tanks').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Cuve mise à jour');
      } else {
        const { error } = await supabase.from('fuel_tanks').insert(payload);
        if (error) throw error;
        toast.success('Cuve créée');
      }

      setShowForm(false);
      loadTanks();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'enregistrement');
    } finally { setSaving(false); }
  };

  const toggleActive = async (tank: FuelTank) => {
    const { error } = await supabase
      .from('fuel_tanks')
      .update({ is_active: !tank.is_active })
      .eq('id', tank.id);
    if (error) { toast.error('Erreur'); return; }
    toast.success(tank.is_active ? 'Cuve désactivée' : 'Cuve activée');
    loadTanks();
    if (detailTank?.id === tank.id) setDetailTank(prev => prev ? { ...prev, is_active: !prev.is_active } : null);
  };

  /* ─── derived filters ─── */

  const cities = [...new Set(tanks.map(t => t.city).filter(Boolean))] as string[];
  const regions = [...new Set(tanks.map(t => t.region).filter(Boolean))] as string[];

  const filtered = tanks.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q) || (t.city || '').toLowerCase().includes(q);
    const matchCity = !filterCity || t.city === filterCity;
    const matchRegion = !filterRegion || t.region === filterRegion;
    const matchStatus = !filterStatus || (filterStatus === 'active' ? t.is_active : !t.is_active);
    const matchPompiste = !filterPompiste || t.pompiste_id === filterPompiste;
    return matchSearch && matchCity && matchRegion && matchStatus && matchPompiste;
  });

  const hasFilters = search || filterCity || filterRegion || filterStatus || filterPompiste;
  const clearFilters = () => { setSearch(''); setFilterCity(''); setFilterRegion(''); setFilterStatus(''); setFilterPompiste(''); };

  /* ─── render ─────────────────────────────────────────────── */

  return (
    <div className="p-8">
      {/* header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Gestion des Cuves</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {tanks.filter(t => t.is_active).length} cuve{tanks.filter(t => t.is_active).length !== 1 ? 's' : ''} active{tanks.filter(t => t.is_active).length !== 1 ? 's' : ''} sur {tanks.length} au total
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
          style={{ backgroundColor: 'var(--primary)' }}>
          <Plus className="w-4 h-4" /> Nouvelle cuve
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total cuves', value: tanks.length, color: '#3B82F6', icon: <Droplets className="w-5 h-5" /> },
          { label: 'Actives', value: tanks.filter(t => t.is_active).length, color: '#16A34A', icon: <CheckCircle className="w-5 h-5" /> },
          { label: 'Inactives', value: tanks.filter(t => !t.is_active).length, color: '#6B7280', icon: <XCircle className="w-5 h-5" /> },
          { label: 'Capacité totale (L)', value: tanks.reduce((s, t) => s + Number(t.capacity_liters), 0).toLocaleString(), color: '#F59E0B', icon: <Fuel className="w-5 h-5" /> },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl p-4 border flex items-center gap-3"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${kpi.color}18`, color: kpi.color }}>
              {kpi.icon}
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* search + filters */}
      <div className="rounded-xl border p-5 mb-6" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Recherche & Filtres</span>
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              <X className="w-3 h-3" /> Effacer
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Nom, code, ville…"
              className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
          </div>
          {[
            { value: filterCity, onChange: (v: string) => setFilterCity(v), label: 'Toutes villes', items: cities.map(c => ({ id: c, label: c })) },
            { value: filterRegion, onChange: (v: string) => setFilterRegion(v), label: 'Toutes régions', items: regions.map(r => ({ id: r, label: r })) },
            { value: filterStatus, onChange: (v: string) => setFilterStatus(v), label: 'Tous statuts', items: [{ id: 'active', label: 'Active' }, { id: 'inactive', label: 'Inactive' }] },
            { value: filterPompiste, onChange: (v: string) => setFilterPompiste(v), label: 'Tous pompistes', items: pompistes.map(p => ({ id: p.id, label: p.full_name })) },
          ].map((sel, idx) => (
            <select key={idx} value={sel.value} onChange={e => sel.onChange(e.target.value)}
              className="px-3 py-2.5 border rounded-lg text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}>
              <option value="">{sel.label}</option>
              {sel.items.map(it => <option key={it.id} value={it.id}>{it.label}</option>)}
            </select>
          ))}
        </div>
      </div>

      {/* table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-2xl" style={{ borderColor: 'var(--border)' }}>
          <Droplets className="w-12 h-12 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
          <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Aucune cuve trouvée</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Créez votre première cuve ou ajustez les filtres</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle, #F9FAFB)' }}>
                {['Cuve', 'Localisation', 'Type / Niveau', 'Pompiste', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((tank, idx) => {
                const pct = fillPct(tank.current_level_liters, tank.capacity_liters);
                return (
                  <tr key={tank.id}
                    className="border-t transition-colors hover:bg-gray-50 cursor-pointer"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() => setDetailTank(tank)}>
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{tank.name}</div>
                      <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>{tank.code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div style={{ color: 'var(--text-primary)' }}>{tank.city || '—'}</div>
                      {tank.region && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{tank.region}</div>}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                          {FUEL_TYPE_LABELS[tank.fuel_type] || tank.fuel_type}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
                        <span className="text-xs font-bold" style={{ color: fillColor(pct) }}>{pct}%</span>
                      </div>
                      <div className="w-28 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: fillColor(pct) }} />
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {Number(tank.current_level_liters).toLocaleString()} / {Number(tank.capacity_liters).toLocaleString()} L
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {tank.pompiste ? (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                          <span style={{ color: 'var(--text-primary)' }}>{tank.pompiste.full_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Non affecté</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: tank.is_active ? '#F0FDF4' : '#F9FAFB', color: tank.is_active ? '#16A34A' : '#6B7280' }}>
                        {tank.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(tank)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Modifier">
                          <Edit2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                        <button onClick={() => toggleActive(tank)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          title={tank.is_active ? 'Désactiver' : 'Activer'}>
                          {tank.is_active
                            ? <EyeOff className="w-4 h-4" style={{ color: '#F59E0B' }} />
                            : <Eye className="w-4 h-4" style={{ color: '#16A34A' }} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── DETAIL PANEL ─────────────────────────────────────── */}
      {detailTank && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setDetailTank(null)}>
          <div className="rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg mx-0 sm:mx-4 shadow-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--surface, white)' }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{detailTank.name}</h3>
                  <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{detailTank.code}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: detailTank.is_active ? '#F0FDF4' : '#F9FAFB', color: detailTank.is_active ? '#16A34A' : '#6B7280' }}>
                  {detailTank.is_active ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => setDetailTank(null)} className="p-2 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
            </div>

            <div className="px-7 py-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* fill level */}
              {(() => {
                const pct = fillPct(detailTank.current_level_liters, detailTank.capacity_liters);
                return (
                  <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Niveau de remplissage</span>
                      <span className="text-lg font-black" style={{ color: fillColor(pct) }}>{pct}%</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: fillColor(pct) }} />
                    </div>
                    <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>{Number(detailTank.current_level_liters).toLocaleString()} L actuels</span>
                      <span>Capacité : {Number(detailTank.capacity_liters).toLocaleString()} L</span>
                    </div>
                    {pct < 20 && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#DC2626' }}>
                        <AlertTriangle className="w-3.5 h-3.5" /> Niveau critique — réapprovisionnement nécessaire
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* details grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Type de carburant', value: FUEL_TYPE_LABELS[detailTank.fuel_type] || detailTank.fuel_type, icon: <Fuel className="w-4 h-4" /> },
                  { label: 'Ville', value: detailTank.city || '—', icon: <MapPin className="w-4 h-4" /> },
                  { label: 'Région', value: detailTank.region || '—', icon: <MapPin className="w-4 h-4" /> },
                  { label: 'Téléphone', value: detailTank.phone || '—', icon: <Phone className="w-4 h-4" /> },
                ].map(item => (
                  <div key={item.label} className="p-3 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span style={{ color: 'var(--text-muted)' }}>{item.icon}</span>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                    </div>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                  </div>
                ))}
              </div>

              {detailTank.address && (
                <div className="text-sm p-3 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Adresse</p>
                  <p style={{ color: 'var(--text-primary)' }}>{detailTank.address}</p>
                </div>
              )}

              {/* pompiste */}
              <div className="p-3 rounded-xl border flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Pompiste affecté</p>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {detailTank.pompiste?.full_name || 'Aucun pompiste affecté'}
                  </p>
                </div>
              </div>

              {detailTank.observations && (
                <div className="p-3 rounded-xl border text-sm" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Observations</p>
                  <p style={{ color: 'var(--text-primary)' }}>{detailTank.observations}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-7 pb-7 pt-2">
              <button onClick={() => openEdit(detailTank)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-semibold text-sm"
                style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                <Edit2 className="w-4 h-4" /> Modifier
              </button>
              <button onClick={() => toggleActive(detailTank)}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
                style={{ backgroundColor: detailTank.is_active ? '#EF4444' : '#16A34A' }}>
                {detailTank.is_active ? 'Désactiver' : 'Activer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FORM MODAL ────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowForm(false)}>
          <div className="rounded-2xl w-full max-w-2xl mx-4 shadow-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--surface, white)' }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-8 pt-8 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {editingId ? 'Modifier la cuve' : 'Nouvelle cuve'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            <div className="px-8 py-6 max-h-[70vh] overflow-y-auto space-y-5">

              {/* row 1 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Nom de la cuve <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Cuve principale Abidjan"
                    className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Code cuve <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={formData.code} onChange={e => setFormData(p => ({ ...p, code: e.target.value }))}
                    placeholder="CUV-001"
                    className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none font-mono"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
                </div>
              </div>

              {/* row 2 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Ville</label>
                  <input type="text" value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                    placeholder="Abidjan"
                    className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Région</label>
                  <input type="text" value={formData.region} onChange={e => setFormData(p => ({ ...p, region: e.target.value }))}
                    placeholder="Lagunes"
                    className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
                </div>
              </div>

              {/* row 3 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Adresse</label>
                  <input type="text" value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                    placeholder="Zone industrielle, lot 12"
                    className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Téléphone</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+225 07 00 00 00 00"
                    className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
                </div>
              </div>

              {/* row 4 – capacities */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Capacité totale (L) <span className="text-red-500">*</span>
                  </label>
                  <input type="number" min={0} value={formData.capacity_liters}
                    onChange={e => setFormData(p => ({ ...p, capacity_liters: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Niveau actuel (L)
                  </label>
                  <input type="number" min={0} value={formData.current_level_liters}
                    onChange={e => setFormData(p => ({ ...p, current_level_liters: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Type de carburant <span className="text-red-500">*</span>
                  </label>
                  <select value={formData.fuel_type} onChange={e => setFormData(p => ({ ...p, fuel_type: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}>
                    {FUEL_TYPES.map(ft => <option key={ft} value={ft}>{FUEL_TYPE_LABELS[ft]}</option>)}
                  </select>
                </div>
              </div>

              {/* row 5 – pompiste + status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Pompiste affecté
                  </label>
                  <select value={formData.pompiste_id} onChange={e => setFormData(p => ({ ...p, pompiste_id: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}>
                    <option value="">Aucun pompiste</option>
                    {pompistes.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                  {pompistes.length === 0 && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Aucun utilisateur avec le rôle "pompiste" actif.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Statut</label>
                  <div className="flex gap-3 mt-1">
                    {[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }].map(opt => (
                      <label key={String(opt.value)} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={formData.is_active === opt.value}
                          onChange={() => setFormData(p => ({ ...p, is_active: opt.value }))}
                          className="w-4 h-4" />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* observations */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Observations</label>
                <textarea value={formData.observations} onChange={e => setFormData(p => ({ ...p, observations: e.target.value }))}
                  rows={3} placeholder="Remarques, notes particulières…"
                  className="w-full px-3 py-2.5 border rounded-xl text-sm resize-none outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            <div className="flex gap-3 px-8 pb-8">
              <button onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border font-semibold text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)' }}>
                {saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Créer la cuve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
