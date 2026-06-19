import { useState, useEffect } from 'react'
import { Plus, CreditCard as Edit2, ToggleLeft, ToggleRight, Save, X, Settings } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/services/supabase'
import type { FixedExpenseType } from '@/types/chargeAchat.types'

const ICONS = ['⚡', '💧', '🏠', '🌐', '📞', '📺', '🛡️', '🧹', '📄', '📎', '📦', '🔧', '🚗', '💰', '📋', '🏢', '🔌']
const COLORS = ['#F59E0B', '#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#EF4444', '#6366F1', '#D97706', '#64748B', '#0EA5E9', '#9CA3AF', '#0B7439', '#DC2626', '#F97316']

export default function FixedExpenseTypes() {
  const [types, setTypes] = useState<FixedExpenseType[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', icon: '📋', color: '#6B7280' })

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('fixed_expense_types').select('*').order('sort_order')
    if (data) setTypes(data as FixedExpenseType[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openEdit = (t: FixedExpenseType) => {
    setEditId(t.id)
    setForm({ name: t.name, icon: t.icon, color: t.color })
    setShowNew(false)
  }

  const openNew = () => {
    setEditId(null)
    setForm({ name: '', icon: '📋', color: '#6B7280' })
    setShowNew(true)
  }

  const cancel = () => { setEditId(null); setShowNew(false) }

  const saveType = async () => {
    if (!form.name.trim()) { toast.error('Le nom est obligatoire'); return }

    if (editId) {
      const { error } = await supabase.from('fixed_expense_types')
        .update({ name: form.name.trim(), icon: form.icon, color: form.color, updated_at: new Date().toISOString() })
        .eq('id', editId)
      if (error) { toast.error(error.message); return }
      toast.success('Type mis a jour')
    } else {
      const maxOrder = types.reduce((m, t) => Math.max(m, t.sort_order), 0)
      const { error } = await supabase.from('fixed_expense_types')
        .insert({ name: form.name.trim(), icon: form.icon, color: form.color, sort_order: maxOrder + 1 })
      if (error) { toast.error(error.message); return }
      toast.success('Type cree')
    }
    cancel()
    load()
  }

  const toggleActive = async (t: FixedExpenseType) => {
    const { error } = await supabase.from('fixed_expense_types')
      .update({ is_active: !t.is_active, updated_at: new Date().toISOString() })
      .eq('id', t.id)
    if (error) { toast.error(error.message); return }
    toast.success(t.is_active ? 'Type desactive' : 'Type active')
    load()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]">
      <div className="w-8 h-8 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
    </div>
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#0B743915' }}>
            <Settings className="w-5 h-5" style={{ color: '#0B7439' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Types de charges fixes</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Gerer les categories de depenses fixes</p>
          </div>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: '#0B7439' }}>
          <Plus className="w-4 h-4" />Ajouter
        </button>
      </div>

      {/* New/Edit form */}
      {(showNew || editId) && (
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: 'var(--surface)', border: '2px solid #0B743940' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {editId ? 'Modifier le type' : 'Nouveau type de depense'}
          </h3>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
              Nom <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="ex: Electricite (CIE)" autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
              style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Icone</label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map(icon => (
                <button key={icon} type="button" onClick={() => setForm(f => ({ ...f, icon }))}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all"
                  style={{
                    backgroundColor: form.icon === icon ? form.color + '20' : 'var(--bg-subtle)',
                    border: `2px solid ${form.icon === icon ? form.color : 'transparent'}`,
                  }}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Couleur</label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  className="w-8 h-8 rounded-lg transition-all"
                  style={{
                    backgroundColor: c,
                    border: `3px solid ${form.color === c ? '#1A2E22' : 'transparent'}`,
                    opacity: form.color === c ? 1 : 0.6,
                  }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={saveType} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: '#0B7439' }}>
              <Save className="w-4 h-4" />Enregistrer
            </button>
            <button onClick={cancel} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}>
              <X className="w-4 h-4" />Annuler
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {types.map(t => (
          <div key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${!t.is_active ? 'opacity-50' : ''}`}
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ backgroundColor: t.color + '18' }}>
              {t.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t.is_active ? 'Actif' : 'Desactive'}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => openEdit(t)} className="p-2 rounded-lg hover:bg-blue-50 transition-colors" title="Modifier">
                <Edit2 className="w-4 h-4" style={{ color: '#1D6FA4' }} />
              </button>
              <button onClick={() => toggleActive(t)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title={t.is_active ? 'Desactiver' : 'Activer'}>
                {t.is_active
                  ? <ToggleRight className="w-5 h-5" style={{ color: '#0B7439' }} />
                  : <ToggleLeft className="w-5 h-5" style={{ color: '#9CA3AF' }} />
                }
              </button>
            </div>
          </div>
        ))}
        {types.length === 0 && (
          <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>Aucun type de depense</p>
        )}
      </div>
    </div>
  )
}
