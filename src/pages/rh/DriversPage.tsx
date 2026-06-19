import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Eye, Pencil, AlertTriangle, Star, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/services/supabase'
import { resolveCompanyIds } from '@/utils/companyGroups'
import type { Employee, ContractType } from '@/types/hr.types'

interface Company { id: string; name: string; code: string; parent_id?: string | null; is_group?: boolean }

const WARNING_DAYS = 30

function isExpiringSoon(expiry: string | null) {
  if (!expiry) return false
  return (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24) < WARNING_DAYS
}

async function fetchAllDrivers(): Promise<Employee[]> {
  const { data, error } = await supabase.rpc('get_all_drivers')
  if (error) throw error
  return (data ?? []).map((d: any) => ({
    ...d,
    full_name: `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || d.email,
    years_of_service: d.hire_date
      ? Math.floor((Date.now() - new Date(d.hire_date).getTime()) / (1000 * 60 * 60 * 24 * 365))
      : null,
    seniority_text: null,
  })) as Employee[]
}

export default function DriversPage() {
  const navigate = useNavigate()

  const [allDrivers, setAllDrivers] = useState<Employee[]>([])
  const [drivers,    setDrivers]    = useState<Employee[]>([])
  const [companies,  setCompanies]  = useState<Company[]>([])
  const [statusFilter,   setStatusFilter]   = useState<string>('')
  const [companyTab,     setCompanyTab]     = useState<string>('all')
  const [contractFilter, setContractFilter] = useState<ContractType | 'all'>('all')
  const [search,   setSearch]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('companies').select('id, name, code, parent_id, is_group').order('name')
      .then(({ data }) => setCompanies(data ?? []))
  }, [])

  const loadDrivers = useCallback(() => {
    setLoading(true)
    fetchAllDrivers()
      .then(setAllDrivers)
      .catch((err) => { console.error(err); toast.error('Erreur lors du chargement') })
      .finally(() => setLoading(false))
  }, [])

  // Filtrage côté client
  useEffect(() => {
    let result = allDrivers
    if (statusFilter)               result = result.filter(d => d.status === statusFilter)
    if (companyTab !== 'all') {
      const ids = resolveCompanyIds(companyTab, companies)
      result = result.filter(d => d.company_id != null && ids.includes(d.company_id))
    }
    if (contractFilter !== 'all')   result = result.filter(d => d.contract_type === contractFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(d =>
        (d.full_name ?? '').toLowerCase().includes(q) ||
        (d.employee_id ?? '').toLowerCase().includes(q) ||
        (d.email ?? '').toLowerCase().includes(q) ||
        (d.bus_registration ?? '').toLowerCase().includes(q)
      )
    }
    setDrivers(result)
  }, [allDrivers, statusFilter, companyTab, contractFilter, search, companies])

  useEffect(() => { loadDrivers() }, [loadDrivers])

  const avgRating = allDrivers.length
    ? allDrivers.reduce((s, d) => s + Number(d.driver_average_rating ?? 0), 0) / allDrivers.length
    : 0

  const expiringLicenses = allDrivers.filter(d => isExpiringSoon(d.license_expiry)).length
  const titulairesCount  = allDrivers.filter(d => d.contract_type === 'titulaire').length
  const contractuelsCount = allDrivers.filter(d => d.contract_type === 'contractuel').length

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E22]">Chauffeurs</h1>
          <p className="text-sm text-[#6B7280] mt-1">Gestion du personnel de conduite</p>
        </div>
      </div>

      {/* KPI mini bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: allDrivers.length, color: '#0B7439' },
          { label: 'Titulaires', value: titulairesCount, color: '#1D6FA4' },
          { label: 'Contractuels', value: contractuelsCount, color: '#D97706' },
          {
            label: expiringLicenses > 0 ? `Permis < ${WARNING_DAYS}j` : 'Note moy.',
            value: expiringLicenses > 0
              ? `⚠ ${expiringLicenses}`
              : avgRating.toFixed(1),
            color: expiringLicenses > 0 ? '#AF3029' : '#059669',
          },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-[#E2EAE5] p-4 flex items-center gap-3">
            <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: kpi.color }} />
            <div>
              <p className="text-xs text-[#6B7280] font-medium">{kpi.label}</p>
              <p className="text-xl font-bold text-[#1A2E22]">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full border border-[#E2EAE5] rounded-lg px-3 py-2 text-sm appearance-none text-[#374151] bg-white pr-8"
            >
              <option value="">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
            </select>
            <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={contractFilter}
              onChange={e => setContractFilter(e.target.value as ContractType | 'all')}
              className="w-full border border-[#E2EAE5] rounded-lg px-3 py-2 text-sm appearance-none text-[#374151] bg-white pr-8"
            >
              <option value="all">Tous les contrats</option>
              <option value="titulaire">Titulaires</option>
              <option value="contractuel">Contractuels</option>
            </select>
            <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
          </div>
          <div className="relative col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#9CA3AF]" />
            <input
              placeholder="Nom, matricule, immatr..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-[#E2EAE5] rounded-lg pl-9 pr-3 py-2 text-sm text-[#374151]"
            />
          </div>
        </div>
      </div>

      {/* Company tabs */}
      <div className="flex gap-2 flex-wrap">
        {[{ id: 'all', code: 'Tous', name: 'Toutes les sociétés', is_group: false }, ...companies.map(c => ({ id: c.id, code: c.code, name: c.name, is_group: c.is_group }))].map(c => {
          const ids = c.id === 'all' ? [] : resolveCompanyIds(c.id, companies)
          const count = c.id === 'all'
            ? allDrivers.length
            : allDrivers.filter(d => d.company_id != null && ids.includes(d.company_id)).length
          const subCount = c.is_group ? ids.filter(id => id !== c.id).length : 0
          return (
            <button
              key={c.id}
              onClick={() => setCompanyTab(c.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                companyTab === c.id
                  ? 'bg-[#0B7439] text-white'
                  : 'bg-white border border-[#E2EAE5] text-[#4A6B55] hover:bg-[#F8FAF8]'
              }`}
              title={c.is_group ? `${c.name} (groupe + ${subCount} sous-sociétés)` : c.name}
            >
              {c.code}
              {subCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  companyTab === c.id ? 'bg-white/25 text-white' : 'bg-[#FEF3C7] text-[#B45309]'
                }`}>
                  {subCount} entités
                </span>
              )}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                companyTab === c.id ? 'bg-white/20 text-white' : 'bg-[#F4F7F5] text-[#6B7280]'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
        {/* Contract type tabs */}
        <div className="h-px w-px mx-2" />
        {(['titulaire', 'contractuel'] as ContractType[]).map(ct => (
          <button
            key={ct}
            onClick={() => setContractFilter(prev => prev === ct ? 'all' : ct)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              contractFilter === ct
                ? ct === 'titulaire' ? 'bg-[#0B7439] text-white' : 'bg-[#1D6FA4] text-white'
                : 'bg-white border border-[#E2EAE5] text-[#4A6B55] hover:bg-[#F8FAF8]'
            }`}
          >
            {ct === 'titulaire' ? 'Titulaires' : 'Contractuels'}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              contractFilter === ct ? 'bg-white/20' : 'bg-[#F4F7F5] text-[#6B7280]'
            }`}>
              {ct === 'titulaire' ? titulairesCount : contractuelsCount}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : drivers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-[#6B7280]">
            <p className="text-sm">Aucun chauffeur trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAF8]">
                <tr>
                  <th className="text-left px-4 py-3 text-[#4A6B55] font-semibold w-14">Photo</th>
                  <th className="text-left px-4 py-3 text-[#4A6B55] font-semibold">Chauffeur</th>
                  <th className="text-left px-4 py-3 text-[#4A6B55] font-semibold">Société</th>
                  <th className="text-left px-4 py-3 text-[#4A6B55] font-semibold">Car affecté</th>
                  <th className="text-left px-4 py-3 text-[#4A6B55] font-semibold">Type car</th>
                  <th className="text-left px-4 py-3 text-[#4A6B55] font-semibold">Contrat</th>
                  <th className="text-left px-4 py-3 text-[#4A6B55] font-semibold">Permis</th>
                  <th className="text-left px-4 py-3 text-[#4A6B55] font-semibold">Note</th>
                  <th className="text-left px-4 py-3 text-[#4A6B55] font-semibold">Statut</th>
                  <th className="text-center px-4 py-3 text-[#4A6B55] font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(driver => {
                  const expiring = isExpiringSoon(driver.license_expiry)
                  return (
                    <tr key={driver.id} className="border-t border-[#E2EAE5] hover:bg-[#F8FAF8] transition-colors">
                      <td className="px-4 py-3">
                        {driver.avatar_url ? (
                          <img src={driver.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#D4EDDA] flex items-center justify-center text-[#0B7439] font-bold text-sm">
                            {driver.first_name?.[0]?.toUpperCase() ?? driver.email?.[0]?.toUpperCase() ?? '?'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#1A2E22]">
                          {driver.full_name || <span className="text-[#9CA3AF] italic font-normal">{driver.email}</span>}
                        </div>
                        <div className="text-xs text-[#8AA898]">{driver.employee_id ?? driver.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#1A2E22]">{driver.company_code ?? '—'}</div>
                        <div className="text-xs text-[#8AA898]">{driver.company_name ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-[#0B7439]">
                        {driver.bus_registration ?? <span className="text-[#9CA3AF] font-normal">Non affecté</span>}
                      </td>
                      <td className="px-4 py-3 text-[#4A6B55]">{driver.bus_class ?? '—'}</td>
                      <td className="px-4 py-3">
                        {driver.contract_type ? (
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            driver.contract_type === 'titulaire'
                              ? 'bg-[#D4EDDA] text-[#0B7439]'
                              : 'bg-[#DBEAFE] text-[#1D6FA4]'
                          }`}>
                            {driver.contract_type === 'titulaire' ? 'Titulaire' : 'Contractuel'}
                          </span>
                        ) : <span className="text-[#9CA3AF]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-medium ${expiring ? 'text-[#D97706]' : 'text-[#4A6B55]'}`}>
                            {driver.license_expiry
                              ? new Date(driver.license_expiry).toLocaleDateString('fr-FR')
                              : '—'}
                          </span>
                          {expiring && <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />}
                        </div>
                        {driver.license_category && (
                          <div className="text-xs text-[#8AA898]">Cat. {driver.license_category}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B]" />
                          <span className="text-sm font-semibold text-[#1A2E22]">
                            {Number(driver.driver_average_rating ?? 0).toFixed(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          driver.status === 'active'
                            ? 'bg-[#D4EDDA] text-[#0B7439]'
                            : 'bg-[#F3F4F6] text-[#6B7280]'
                        }`}>
                          {driver.status === 'active' ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => navigate(`/rh/employees/${driver.id}`)}
                            className="p-1.5 rounded-lg hover:bg-[#D4EDDA] text-[#0B7439] transition-colors"
                            title="Voir"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/rh/employees/${driver.id}/edit`)}
                            className="p-1.5 rounded-lg hover:bg-[#FEF3C7] text-[#D97706] transition-colors"
                            title="Modifier"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
