import { useState, useEffect, useCallback } from 'react'
import { Printer, Download, ChevronLeft, ChevronRight, Calendar, Layers } from 'lucide-react'
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/services/supabase'
import type { VehicleExpense } from '@/types/chargeAchat.types'
import { buildCompanyGroups } from '@/utils/companyGroups'
import type { CompanyWithHierarchy } from '@/utils/companyGroups'

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' XOF'

interface VehicleGroup {
  reg: string
  expenses: VehicleExpense[]
  total: number
}

interface CompanySection {
  company: CompanyWithHierarchy
  vehicles: VehicleGroup[]
  total: number
}

// A display section: either a group (G-OUMÉ with subsections) or a standalone company
interface GroupSection {
  groupId: string
  groupCode: string
  groupName: string
  isGroup: boolean
  subsections: CompanySection[]   // one per subsidiary (or single company if standalone)
  total: number
}

export default function WeeklyReport() {
  const [weekOffset,   setWeekOffset]   = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [groupSections, setGroupSections] = useState<GroupSection[]>([])
  const [grandTotal,   setGrandTotal]   = useState(0)

  const base      = subWeeks(new Date(), weekOffset < 0 ? -weekOffset : weekOffset)
  const weekStart = startOfWeek(base, { weekStartsOn: 1 })
  const weekEnd   = endOfWeek(base,   { weekStartsOn: 1 })
  const startStr  = format(weekStart, 'yyyy-MM-dd')
  const endStr    = format(weekEnd,   'yyyy-MM-dd')
  const weekLabel = `Semaine du ${format(weekStart, 'dd/MM', { locale: fr })} au ${format(weekEnd, 'dd/MM/yyyy', { locale: fr })}`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: companiesData }, { data: expensesData }] = await Promise.all([
        supabase.from('companies').select('id,name,code,parent_id,is_group').order('name'),
        supabase.from('vehicle_expenses')
          .select('*, company:companies(name,code), category:expense_categories(name,icon,color)')
          .eq('source', 'charge_achat')
          .gte('expense_date', startStr)
          .lte('expense_date', endStr)
          .order('company_id')
          .order('registration_number')
          .order('expense_date'),
      ])

      const cos = (companiesData ?? []) as CompanyWithHierarchy[]
      const exps = (expensesData ?? []) as VehicleExpense[]

      const { groups: companyGroups, standalone } = buildCompanyGroups(cos)

      // Build per-company sections
      const buildSection = (c: CompanyWithHierarchy): CompanySection => {
        const cExps = exps.filter(e => e.company_id === c.id)
        const byVehicle: Record<string, VehicleGroup> = {}
        for (const e of cExps) {
          if (!byVehicle[e.registration_number]) byVehicle[e.registration_number] = { reg: e.registration_number, expenses: [], total: 0 }
          byVehicle[e.registration_number].expenses.push(e)
          byVehicle[e.registration_number].total += Number(e.amount)
        }
        const vehicles = Object.values(byVehicle).sort((a, b) => a.reg.localeCompare(b.reg))
        return { company: c, vehicles, total: vehicles.reduce((a, b) => a + b.total, 0) }
      }

      // Group sections
      const built: GroupSection[] = [
        ...companyGroups.map(({ group, subsidiaries }) => {
          const subsections = subsidiaries.map(buildSection)
          return {
            groupId:   group.id,
            groupCode: group.code,
            groupName: group.name,
            isGroup:   true,
            subsections,
            total: subsections.reduce((a, b) => a + b.total, 0),
          }
        }),
        ...standalone.map(c => {
          const section = buildSection(c)
          return {
            groupId:   c.id,
            groupCode: c.code,
            groupName: c.name,
            isGroup:   false,
            subsections: [section],
            total: section.total,
          }
        }),
      ]

      setGroupSections(built)
      setGrandTotal(built.reduce((a, b) => a + b.total, 0))
    } finally {
      setLoading(false)
    }
  }, [startStr, endStr])

  useEffect(() => { load() }, [load])

  const handlePrint = () => window.print()

  const exportPdf = async () => {
    const { default: jsPDF } = await import('jspdf')
    const { default: html2canvas } = await import('html2canvas')
    const el = document.getElementById('report-content')
    if (!el) return
    const canvas = await html2canvas(el, { scale: 1.5, useCORS: true })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const imgW = 210
    const imgH = (canvas.height * imgW) / canvas.width
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, imgH)
    pdf.save(`rapport_hebdo_${startStr}.pdf`)
  }

  const exportExcel = async () => {
    const { utils, writeFile } = await import('xlsx')
    const wb = utils.book_new()

    for (const gs of groupSections) {
      for (const section of gs.subsections) {
        if (section.vehicles.length === 0) continue
        const sheetName = gs.isGroup ? `${gs.groupCode}-${section.company.code}` : section.company.code

        const rows: unknown[][] = [
          [`DÉPENSES DU ${startStr} AU ${endStr}`, '', '', '', '', `TOTAL : ${section.total.toLocaleString('fr-FR')} XOF`],
          [],
          ['IMMATRICULATION', 'DESCRIPTION', 'MONTANT', 'FOURNISSEUR / DATE'],
        ]
        for (const v of section.vehicles) {
          rows.push([v.reg, '', '', ''])
          for (const e of v.expenses) {
            rows.push(['', e.description, Number(e.amount), `${e.supplier ?? ''} — ${format(new Date(e.expense_date), 'dd/MM/yyyy', { locale: fr })}`])
          }
          rows.push(['', 'TOTAL VÉHICULE', v.total, ''])
          rows.push([])
        }

        const ws = utils.aoa_to_sheet(rows)
        utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
      }
    }

    // Récapitulatif
    const recap: unknown[][] = [
      ['RÉCAPITULATIF', weekLabel],
      [],
      ['SOCIÉTÉ', 'TOTAL (XOF)'],
    ]
    for (const gs of groupSections) {
      if (gs.isGroup) {
        recap.push([`${gs.groupCode} (GROUPE)`, gs.total])
        for (const s of gs.subsections) {
          recap.push([`  ${s.company.code} — ${s.company.name}`, s.total])
        }
      } else {
        recap.push([gs.groupCode + ' — ' + gs.groupName, gs.total])
      }
    }
    recap.push([], ['TOTAL GÉNÉRAL', grandTotal])
    utils.book_append_sheet(wb, utils.aoa_to_sheet(recap), 'RÉCAPITULATIF')
    writeFile(wb, `rapport_hebdo_${startStr}.xlsx`)
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Rapport hebdomadaire</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Récapitulatif par société et par véhicule</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <Printer className="w-3.5 h-3.5" /> Imprimer
          </button>
          <button onClick={exportPdf} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#DC2626', color: '#fff' }}>
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#1D6FA4', color: '#fff' }}>
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-center gap-4 no-print">
        <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Calendar className="w-4 h-4" style={{ color: '#0B7439' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{weekLabel}</span>
        </div>
        <button
          onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
          disabled={weekOffset === 0}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      {/* Report content */}
      <div id="report-content" className="space-y-4">

        {/* Summary header */}
        <div className="rounded-xl p-5" style={{ backgroundColor: '#0B7439', color: '#fff' }}>
          <p className="text-sm opacity-80">S.B.T.A — RAPPORT HEBDOMADAIRE</p>
          <p className="text-lg font-bold mt-1">{weekLabel}</p>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {groupSections.filter(gs => gs.total > 0).slice(0, 4).map(gs => (
              <div key={gs.groupId} className="text-center">
                <p className="text-xs opacity-70">{gs.groupCode}</p>
                <p className="text-base font-bold">{new Intl.NumberFormat('fr-FR').format(gs.total)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-green-600 flex justify-between">
            <span className="text-sm opacity-80">TOTAL GROUPE</span>
            <span className="text-lg font-bold">{fmt(grandTotal)}</span>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-7 h-7 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0B7439', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="space-y-4">
            {groupSections.map(gs => (
              <div key={gs.groupId}>
                {/* Group wrapper for G-OUMÉ */}
                {gs.isGroup ? (
                  <div className="rounded-xl overflow-hidden" style={{ border: '2px solid #059669' }}>
                    {/* Group header */}
                    <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#059669' }}>
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-white opacity-80" />
                        <span className="font-bold text-white">{gs.groupCode}</span>
                        <span className="text-green-100 text-sm ml-1">{gs.groupName}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded text-green-100" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                          {gs.subsections.filter(s => s.total > 0).length} filiale{gs.subsections.filter(s => s.total > 0).length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="font-bold text-white text-base">{fmt(gs.total)}</span>
                    </div>

                    {/* Subsidiaries */}
                    <div className="divide-y" style={{ borderColor: '#d1fae5', backgroundColor: 'var(--surface)' }}>
                      {gs.subsections.map(section => (
                        <div key={section.company.id}>
                          {/* Subsidiary header */}
                          <div className="px-4 py-2.5 flex items-center justify-between pl-8" style={{ backgroundColor: '#f0fdf4', borderLeft: '3px solid #059669' }}>
                            <div>
                              <span className="font-semibold text-sm" style={{ color: '#065f46' }}>{section.company.code}</span>
                              <span className="text-xs ml-2" style={{ color: '#6B7280' }}>{section.company.name}</span>
                            </div>
                            <span className="text-sm font-bold" style={{ color: section.total > 0 ? '#065f46' : 'var(--text-muted)' }}>
                              {fmt(section.total)}
                            </span>
                          </div>

                          {section.vehicles.length === 0 ? (
                            <div className="px-4 pl-8 py-3 text-xs italic" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-subtle)' }}>
                              Aucune dépense cette semaine
                            </div>
                          ) : (
                            <VehicleTable section={section} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Standalone company
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: 'var(--surface)', borderBottom: '2px solid #0B7439' }}>
                      <div>
                        <span className="font-bold text-base" style={{ color: '#0B7439' }}>{gs.groupCode}</span>
                        <span className="text-sm ml-2" style={{ color: 'var(--text-secondary)' }}>{gs.groupName}</span>
                      </div>
                      <span className="font-bold text-base" style={{ color: gs.total > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {fmt(gs.total)}
                      </span>
                    </div>

                    {gs.subsections[0].vehicles.length === 0 ? (
                      <div className="px-4 py-4 text-sm italic" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-subtle)' }}>
                        Aucune dépense cette semaine
                      </div>
                    ) : (
                      <VehicleTable section={gs.subsections[0]} />
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Grand total */}
            <div className="rounded-xl p-4 flex items-center justify-between" style={{ backgroundColor: '#1A2E22', color: '#fff' }}>
              <span className="font-bold">TOTAL GÉNÉRAL — {weekLabel}</span>
              <span className="text-2xl font-bold">{fmt(grandTotal)}</span>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

function VehicleTable({ section }: { section: CompanySection }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
          <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Immatriculation</th>
          <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Description de la dépense</th>
          <th className="px-3 py-2 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Montant</th>
          <th className="px-3 py-2 text-left text-xs font-semibold hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Fournisseur / Date</th>
        </tr>
      </thead>
      <tbody style={{ backgroundColor: 'var(--surface)' }}>
        {section.vehicles.map(v => (
          <>
            {v.expenses.map((e, ei) => (
              <tr key={e.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="px-3 py-2 font-mono font-bold text-xs" style={{ color: '#0B7439' }}>
                  {ei === 0 ? v.reg : ''}
                </td>
                <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-primary)' }}>
                  <span className="mr-1">{(e as any).category?.icon ?? ''}</span>
                  {e.description}
                </td>
                <td className="px-3 py-2 text-right text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {new Intl.NumberFormat('fr-FR').format(Number(e.amount))}
                </td>
                <td className="px-3 py-2 text-xs hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>
                  {[e.supplier, format(new Date(e.expense_date), 'dd/MM/yy', { locale: fr })].filter(Boolean).join(' — ')}
                </td>
              </tr>
            ))}
            {/* Vehicle subtotal */}
            <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
              <td className="px-3 py-1.5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{v.reg}</td>
              <td className="px-3 py-1.5 text-xs font-semibold text-right" style={{ color: 'var(--text-secondary)' }}>
                Sous-total :
              </td>
              <td className="px-3 py-1.5 text-right text-xs font-bold" style={{ color: '#0B7439' }}>
                {new Intl.NumberFormat('fr-FR').format(v.total)}
              </td>
              <td className="hidden sm:table-cell" />
            </tr>
          </>
        ))}
      </tbody>
      <tfoot>
        <tr style={{ backgroundColor: '#0B7439' }}>
          <td colSpan={2} className="px-3 py-2 text-xs font-bold text-right text-white">
            TOTAL {section.company.code}
          </td>
          <td className="px-3 py-2 text-right text-sm font-bold text-white">
            {new Intl.NumberFormat('fr-FR').format(section.total)}
          </td>
          <td className="hidden sm:table-cell" />
        </tr>
      </tfoot>
    </table>
  )
}
