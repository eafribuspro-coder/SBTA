import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Fuel, Building2, MapPin, Phone, Mail, User, ChevronDown, ChevronUp, CreditCard as Edit2, PowerOff, Power, X, Save, Users, CheckCircle, XCircle, Clock, Layers, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../services/supabase'
import { buildCompanyGroups } from '../../utils/companyGroups'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Company { id: string; name: string; code: string; parent_id?: string | null; is_group?: boolean }
interface FuelService {
  id: string; name: string; code: string; company_id: string | null
  address: string; city: string; region: string; phone: string; email: string
  manager_name: string; description: string; is_active: boolean
  created_at: string; updated_at: string
  company?: Company
}
interface Employee {
  id: string; first_name: string; last_name: string; phone: string
  personal_email: string; professional_email: string; role: string
  company_id: string | null; is_active?: boolean; company?: Company
}
interface AgentAssignment {
  id: string; fuel_service_id: string; employee_id: string
  assigned_at: string; is_active: boolean; assigned_by?: string
  employee?: Employee
}

type Tab = 'list' | 'detail'

const EMPTY_FORM = {
  name: '', code: '', company_id: '', address: '', city: '',
  region: '', phone: '', email: '', manager_name: '', description: '', is_active: true,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Badge({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={active
        ? { backgroundColor: '#d4edda', color: '#0B7439' }
        : { backgroundColor: '#fee2e2', color: '#DC2626' }}
    >
      {active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {active ? 'Actif' : 'Inactif'}
    </span>
  )
}

const inputCls = 'w-full border border-[#E2EAE5] rounded-xl px-3 py-2.5 text-sm text-[#374151] focus:outline-none focus:border-[#0B7439] transition-colors bg-white'
const selectCls = inputCls + ' appearance-none'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#4A6B55] mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-[#AF3029] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FuelServices() {
  const [services, setServices]         = useState<FuelService[]>([])
  const [companies, setCompanies]       = useState<Company[]>([])
  const [agents, setAgents]             = useState<Employee[]>([])      // all carburant employees
  const [assignments, setAssignments]   = useState<AgentAssignment[]>([])
  const [loading, setLoading]           = useState(true)

  const [search, setSearch]             = useState('')
  const [filterCity, setFilterCity]     = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')

  const [tab, setTab]                   = useState<Tab>('list')
  const [selected, setSelected]         = useState<FuelService | null>(null)
  const [expandedId, setExpandedId]     = useState<string | null>(null)

  const [showForm, setShowForm]         = useState(false)
  const [editing, setEditing]           = useState<FuelService | null>(null)
  const [form, setForm]                 = useState({ ...EMPTY_FORM })
  const [saving, setSaving]             = useState(false)

  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignServiceId, setAssignServiceId] = useState<string | null>(null)
  const [assignEmployeeId, setAssignEmployeeId] = useState('')

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [svcRes, coRes, empRes, asgRes] = await Promise.all([
        supabase.from('fuel_services').select('*, company:companies(id,name,code)').order('name'),
        supabase.from('companies').select('id,name,code,parent_id,is_group').order('name'),
        supabase.from('employees').select('id,first_name,last_name,phone,personal_email,professional_email,role,company_id,is_active,company:companies(id,name,code)').eq('role', 'carburant').eq('is_active', true),
        supabase.from('fuel_service_agents').select('*, employee:employees(id,first_name,last_name,phone,personal_email,professional_email,role,company_id,is_active)').eq('is_active', true),
      ])
      if (svcRes.data) setServices(svcRes.data as unknown as FuelService[])
      if (coRes.data)  setCompanies(coRes.data)
      if (empRes.data) setAgents(empRes.data as unknown as Employee[])
      if (asgRes.data) setAssignments(asgRes.data as unknown as AgentAssignment[])
    } catch {
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Derived ────────────────────────────────────────────────────────────────

  const cities   = [...new Set(services.map(s => s.city).filter(Boolean))].sort()
  const regions  = [...new Set(services.map(s => s.region).filter(Boolean))].sort()
  const { groups, standalone } = buildCompanyGroups(companies)

  const filtered = services.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.city.toLowerCase().includes(q)
    const matchCity    = !filterCity    || s.city === filterCity
    const matchRegion  = !filterRegion  || s.region === filterRegion
    const matchCompany = !filterCompany || s.company_id === filterCompany
    const matchStatus  = filterStatus === 'all' || (filterStatus === 'active' ? s.is_active : !s.is_active)
    return matchSearch && matchCity && matchRegion && matchCompany && matchStatus
  })

  const getServiceAgents = (svcId: string) =>
    assignments.filter(a => a.fuel_service_id === svcId && a.is_active)

  const unassignedAgents = (svcId: string) => {
    const assigned = new Set(assignments.filter(a => a.fuel_service_id === svcId && a.is_active).map(a => a.employee_id))
    return agents.filter(e => !assigned.has(e.id))
  }

  // ── Audit log helper ───────────────────────────────────────────────────────

  const logAction = async (
    svcId: string | null,
    action: string,
    oldVal?: object,
    newVal?: object,
  ) => {
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('fuel_service_audit_logs').insert({
      fuel_service_id: svcId,
      action,
      performed_by: session?.user?.id ?? null,
      old_value: oldVal ?? null,
      new_value: newVal ?? null,
    })
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowForm(true)
  }

  const openEdit = (svc: FuelService) => {
    setEditing(svc)
    setForm({
      name: svc.name, code: svc.code, company_id: svc.company_id ?? '',
      address: svc.address, city: svc.city, region: svc.region,
      phone: svc.phone, email: svc.email, manager_name: svc.manager_name,
      description: svc.description, is_active: svc.is_active,
    })
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Le nom est obligatoire'); return }
    if (!form.code.trim()) { toast.error('Le code est obligatoire'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(), code: form.code.trim().toUpperCase(),
        company_id: form.company_id || null,
        address: form.address, city: form.city, region: form.region,
        phone: form.phone, email: form.email,
        manager_name: form.manager_name, description: form.description,
        is_active: form.is_active,
      }
      if (editing) {
        const { error } = await supabase.from('fuel_services').update(payload).eq('id', editing.id)
        if (error) throw error
        await logAction(editing.id, 'modification', editing as unknown as object, payload)
        toast.success('Service mis à jour')
        if (selected?.id === editing.id) {
          setSelected(s => s ? { ...s, ...payload } : s)
        }
      } else {
        const { data, error } = await supabase.from('fuel_services').insert(payload).select().single()
        if (error) throw error
        await logAction(data.id, 'création', undefined, payload)
        toast.success('Service créé')
      }
      setShowForm(false)
      await loadAll()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (svc: FuelService) => {
    const newVal = !svc.is_active
    const { error } = await supabase.from('fuel_services').update({ is_active: newVal }).eq('id', svc.id)
    if (error) { toast.error('Erreur lors de la mise à jour'); return }
    await logAction(svc.id, newVal ? 'réactivation' : 'désactivation',
      { is_active: svc.is_active }, { is_active: newVal })
    toast.success(newVal ? 'Service réactivé' : 'Service désactivé')
    await loadAll()
    if (selected?.id === svc.id) setSelected(s => s ? { ...s, is_active: newVal } : s)
  }

  // ── Agent assignment ───────────────────────────────────────────────────────

  const handleAssign = async () => {
    if (!assignServiceId || !assignEmployeeId) return
    const { data: { session } } = await supabase.auth.getSession()
    const { error } = await supabase.from('fuel_service_agents').upsert({
      fuel_service_id: assignServiceId,
      employee_id: assignEmployeeId,
      assigned_at: new Date().toISOString(),
      assigned_by: session?.user?.id ?? null,
      is_active: true,
    }, { onConflict: 'fuel_service_id,employee_id' })
    if (error) { toast.error("Erreur lors de l'affectation"); return }
    const emp = agents.find(e => e.id === assignEmployeeId)
    await logAction(assignServiceId, 'affectation_agent', undefined, { employee_id: assignEmployeeId, name: emp ? `${emp.first_name} ${emp.last_name}` : '' })
    toast.success('Agent affecté')
    setAssignEmployeeId('')
    setShowAssignModal(false)
    await loadAll()
  }

  const handleRemoveAgent = async (asg: AgentAssignment) => {
    const { error } = await supabase.from('fuel_service_agents').update({ is_active: false }).eq('id', asg.id)
    if (error) { toast.error('Erreur lors du retrait'); return }
    const emp = asg.employee
    await logAction(asg.fuel_service_id, 'retrait_agent', { employee_id: asg.employee_id, name: emp ? `${emp.first_name} ${emp.last_name}` : '' }, undefined)
    toast.success('Agent retiré')
    await loadAll()
  }

  // ── Views ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const activeCount = services.filter(s => s.is_active).length

  return (
    <div className="space-y-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Service Carburant
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {services.length} service{services.length > 1 ? 's' : ''} — {activeCount} actif{activeCount > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: '#0B7439' }}
        >
          <Plus className="w-4 h-4" />
          Nouveau service
        </button>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total services',  value: services.length, icon: <Fuel className="w-5 h-5" />, color: '#0B7439' },
          { label: 'Actifs',          value: activeCount,     icon: <CheckCircle className="w-5 h-5" />, color: '#0B7439' },
          { label: 'Inactifs',        value: services.length - activeCount, icon: <XCircle className="w-5 h-5" />, color: '#DC2626' },
          { label: 'Agents affectés', value: new Set(assignments.filter(a => a.is_active).map(a => a.employee_id)).size, icon: <Users className="w-5 h-5" />, color: '#1D6FA4' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: k.color }}>{k.icon}</span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{k.label}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <div className="rounded-xl p-4 border space-y-3" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Filtres</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Nom, code, ville…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:border-[#0B7439]"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            />
          </div>
          <select value={filterCity} onChange={e => setFilterCity(e.target.value)} className="px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: 'var(--border)' }}>
            <option value="">Toutes les villes</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} className="px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: 'var(--border)' }}>
            <option value="">Toutes les régions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')} className="px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: 'var(--border)' }}>
            <option value="all">Tous statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
        </div>
        {(search || filterCity || filterRegion || filterCompany || filterStatus !== 'all') && (
          <button
            onClick={() => { setSearch(''); setFilterCity(''); setFilterRegion(''); setFilterCompany(''); setFilterStatus('all') }}
            className="text-xs underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* ── Service list ──────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <Fuel className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun service trouvé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(svc => {
            const svcAgents = getServiceAgents(svc.id)
            const isExpanded = expandedId === svc.id
            return (
              <div
                key={svc.id}
                className="rounded-xl border overflow-hidden transition-shadow hover:shadow-md"
                style={{ backgroundColor: 'var(--surface)', borderColor: svc.is_active ? 'var(--border)' : '#FECACA' }}
              >
                {/* Card header */}
                <div className="flex items-center gap-3 px-4 py-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: svc.is_active ? '#d4edda' : '#fee2e2' }}
                  >
                    <Fuel className="w-5 h-5" style={{ color: svc.is_active ? '#0B7439' : '#DC2626' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{svc.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>{svc.code}</span>
                      <Badge active={svc.is_active} />
                      {svcAgents.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: '#dbeafe', color: '#1D6FA4' }}>
                          <Users className="w-3 h-3" />{svcAgents.length} agent{svcAgents.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {svc.city && (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <MapPin className="w-3 h-3" />{svc.city}{svc.region ? `, ${svc.region}` : ''}
                        </span>
                      )}
                      {svc.company && (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <Building2 className="w-3 h-3" />{svc.company.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setSelected(svc); setTab('detail') }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-xs font-medium px-2.5 py-1.5"
                      style={{ color: '#1D6FA4' }}
                      title="Détails"
                    >
                      Détails
                    </button>
                    <button
                      onClick={() => openEdit(svc)}
                      className="p-1.5 rounded-lg hover:bg-gray-100"
                      style={{ color: 'var(--primary)' }}
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleStatus(svc)}
                      className="p-1.5 rounded-lg hover:bg-gray-100"
                      style={{ color: svc.is_active ? '#DC2626' : '#0B7439' }}
                      title={svc.is_active ? 'Désactiver' : 'Réactiver'}
                    >
                      {svc.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : svc.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded: agents */}
                {isExpanded && (
                  <div className="border-t px-4 py-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        Agents affectés ({svcAgents.length})
                      </span>
                      <button
                        onClick={() => { setAssignServiceId(svc.id); setAssignEmployeeId(''); setShowAssignModal(true) }}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                        style={{ backgroundColor: '#0B7439' }}
                      >
                        <Plus className="w-3 h-3" />Affecter un agent
                      </button>
                    </div>
                    {svcAgents.length === 0 ? (
                      <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Aucun agent affecté</p>
                    ) : (
                      <div className="space-y-2">
                        {svcAgents.map(asg => {
                          const emp = asg.employee
                          if (!emp) return null
                          return (
                            <div key={asg.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white border" style={{ borderColor: 'var(--border)' }}>
                              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#d4edda' }}>
                                <User className="w-4 h-4" style={{ color: '#0B7439' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                  {emp.first_name} {emp.last_name}
                                </p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                  {emp.phone || emp.professional_email || emp.personal_email || '—'}
                                </p>
                              </div>
                              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                <Clock className="w-3 h-3" />
                                {new Date(asg.assigned_at).toLocaleDateString('fr-CI')}
                              </span>
                              <button onClick={() => handleRemoveAgent(asg)} className="p-1 rounded hover:bg-red-50" style={{ color: '#DC2626' }} title="Retirer">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Detail panel ─────────────────────────────────────────────── */}
      {tab === 'detail' && selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface)' }}>
            {/* Detail header */}
            <div className="sticky top-0 border-b px-6 py-4 flex items-center justify-between" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: selected.is_active ? '#d4edda' : '#fee2e2' }}>
                  <Fuel className="w-5 h-5" style={{ color: selected.is_active ? '#0B7439' : '#DC2626' }} />
                </div>
                <div>
                  <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{selected.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>{selected.code}</span>
                    <Badge active={selected.is_active} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(selected)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--border)' }}>
                  <Edit2 className="w-4 h-4" />Modifier
                </button>
                <button onClick={() => toggleStatus(selected)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: selected.is_active ? '#fee2e2' : '#d4edda', color: selected.is_active ? '#DC2626' : '#0B7439' }}>
                  {selected.is_active ? <><PowerOff className="w-4 h-4" />Désactiver</> : <><Power className="w-4 h-4" />Réactiver</>}
                </button>
                <button onClick={() => { setTab('list'); setSelected(null) }} className="p-2 rounded-lg hover:bg-gray-100" style={{ color: 'var(--text-muted)' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Info grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: <Building2 className="w-4 h-4" />, label: 'Société', value: selected.company?.name ?? '—' },
                  { icon: <User className="w-4 h-4" />,      label: 'Responsable', value: selected.manager_name || '—' },
                  { icon: <MapPin className="w-4 h-4" />,    label: 'Ville', value: selected.city || '—' },
                  { icon: <Layers className="w-4 h-4" />,    label: 'Région', value: selected.region || '—' },
                  { icon: <MapPin className="w-4 h-4" />,    label: 'Adresse', value: selected.address || '—' },
                  { icon: <Phone className="w-4 h-4" />,     label: 'Téléphone', value: selected.phone || '—' },
                  { icon: <Mail className="w-4 h-4" />,      label: 'Email', value: selected.email || '—' },
                  { icon: <Clock className="w-4 h-4" />,     label: 'Créé le', value: new Date(selected.created_at).toLocaleDateString('fr-CI', { day: '2-digit', month: 'long', year: 'numeric' }) },
                ].map(row => (
                  <div key={row.label} className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                    <span className="mt-0.5 flex-shrink-0" style={{ color: '#0B7439' }}>{row.icon}</span>
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{row.label}</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              {selected.description && (
                <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Description</p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selected.description}</p>
                </div>
              )}

              {/* Agents section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    Agents carburant affectés ({getServiceAgents(selected.id).length})
                  </h3>
                  <button
                    onClick={() => { setAssignServiceId(selected.id); setAssignEmployeeId(''); setShowAssignModal(true) }}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                    style={{ backgroundColor: '#0B7439' }}
                  >
                    <Plus className="w-3 h-3" />Affecter un agent
                  </button>
                </div>
                {getServiceAgents(selected.id).length === 0 ? (
                  <div className="text-center py-6 rounded-xl border border-dashed" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    <Users className="w-7 h-7 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Aucun agent affecté</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getServiceAgents(selected.id).map(asg => {
                      const emp = asg.employee
                      if (!emp) return null
                      const email = emp.professional_email || emp.personal_email || ''
                      return (
                        <div key={asg.id} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold" style={{ backgroundColor: '#0B7439' }}>
                            {emp.first_name[0]}{emp.last_name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                              {emp.first_name} {emp.last_name}
                            </p>
                            <div className="flex items-center gap-3 flex-wrap mt-0.5">
                              {emp.phone && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Phone className="w-3 h-3" />{emp.phone}</span>}
                              {email && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Mail className="w-3 h-3" />{email}</span>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>Depuis le</span>
                            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{new Date(asg.assigned_at).toLocaleDateString('fr-CI')}</span>
                          </div>
                          <button onClick={() => handleRemoveAgent(asg)} className="p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0" style={{ color: '#DC2626' }} title="Retirer">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit modal ───────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="sticky top-0 border-b px-6 py-4 flex items-center justify-between" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                {editing ? 'Modifier le service' : 'Nouveau service carburant'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-gray-100" style={{ color: 'var(--text-muted)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nom du service" required>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="Service Carburant Abidjan Nord" required />
                </Field>
                <Field label="Code service" required>
                  <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} className={inputCls} placeholder="SC-ABJ-N" required />
                </Field>
              </div>

              <Field label="Société rattachée">
                <select value={form.company_id} onChange={e => setForm(p => ({ ...p, company_id: e.target.value }))} className={selectCls}>
                  <option value="">— Aucune société —</option>
                  {groups.map(({ group, subsidiaries }) => (
                    <optgroup key={group.id} label={`${group.name} — Groupe (${subsidiaries.length} filiales)`}>
                      {subsidiaries.map(sub => (
                        <option key={sub.id} value={sub.id}>↳ {sub.name} ({sub.code})</option>
                      ))}
                    </optgroup>
                  ))}
                  {standalone.length > 0 && (
                    <optgroup label="Sociétés autonomes">
                      {standalone.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                    </optgroup>
                  )}
                </select>
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Ville">
                  <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className={inputCls} placeholder="Abidjan" />
                </Field>
                <Field label="Région">
                  <input value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} className={inputCls} placeholder="Lagunes" />
                </Field>
              </div>

              <Field label="Adresse">
                <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={inputCls} placeholder="Zone industrielle, Yopougon" />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Téléphone">
                  <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={inputCls} placeholder="+225 07 00 00 00" />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputCls} placeholder="carburant@sbta.ci" />
                </Field>
              </div>

              <Field label="Responsable du service">
                <input value={form.manager_name} onChange={e => setForm(p => ({ ...p, manager_name: e.target.value }))} className={inputCls} placeholder="Kouadio Jean" />
              </Field>

              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className={inputCls}
                  rows={3}
                  placeholder="Description du service carburant…"
                />
              </Field>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="svc_active" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="rounded" style={{ accentColor: '#0B7439' }} />
                <label htmlFor="svc_active" className="text-sm" style={{ color: 'var(--text-secondary)' }}>Service actif</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border text-sm" style={{ borderColor: 'var(--border)' }}>
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#0B7439' }}>
                  <Save className="w-4 h-4" />
                  {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign agent modal ────────────────────────────────────────── */}
      {showAssignModal && assignServiceId && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
          <div className="rounded-2xl max-w-md w-full p-6" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Affecter un agent carburant</h3>
              <button onClick={() => setShowAssignModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ color: 'var(--text-muted)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            {unassignedAgents(assignServiceId).length === 0 ? (
              <div className="text-center py-6" style={{ color: 'var(--text-muted)' }}>
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Tous les agents carburant sont déjà affectés à ce service.</p>
                <p className="text-xs mt-1">Créez de nouveaux employés avec le rôle "Carburant" dans le module RH.</p>
              </div>
            ) : (
              <>
                <Field label="Sélectionner un agent" required>
                  <select value={assignEmployeeId} onChange={e => setAssignEmployeeId(e.target.value)} className={selectCls}>
                    <option value="">— Choisir un agent —</option>
                    {unassignedAgents(assignServiceId).map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}{emp.phone ? ` — ${emp.phone}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <p className="text-xs mt-2 mb-4" style={{ color: 'var(--text-muted)' }}>
                  Seuls les employés avec le rôle "Carburant" sont proposés.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowAssignModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border text-sm" style={{ borderColor: 'var(--border)' }}>
                    Annuler
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={!assignEmployeeId}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                    style={{ backgroundColor: '#0B7439' }}
                  >
                    <Users className="w-4 h-4" />Affecter
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
