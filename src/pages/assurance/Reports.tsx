import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  FileText, Printer, ShieldCheck, ShieldAlert, ShieldX,
  Building2, Briefcase, CalendarRange, Wallet,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/utils/formatCurrency'
import ExportButton from '@/components/shared/ExportButton'
import {
  fetchInsurances, effectiveStatus, daysUntil, STATUS_LABELS,
} from '@/services/insurance.service'
import type { VehicleInsurance, InsuranceStatus } from '@/types/insurance.types'

type ReportKey =
  | 'assures' | 'echeance' | 'expirees'
  | 'assureur' | 'societe' | 'periode' | 'financier'

const REPORTS: { key: ReportKey; label: string; desc: string; icon: typeof FileText; color: string; bg: string }[] = [
  { key: 'assures',   label: 'Véhicules assurés',     desc: 'Assurances en cours valides',        icon: ShieldCheck, color: '#0B7439', bg: '#E7F6EC' },
  { key: 'echeance',  label: 'Véhicules à échéance',  desc: 'Échéance dans 60 jours',             icon: ShieldAlert, color: '#B45309', bg: '#FEF3C7' },
  { key: 'expirees',  label: 'Assurances expirées',   desc: 'Polices dépassées',                  icon: ShieldX,     color: '#B91C1C', bg: '#FEE2E2' },
  { key: 'assureur',  label: 'Rapport par assureur',  desc: 'Regroupé par compagnie d\'assurance', icon: Briefcase,   color: '#1D4ED8', bg: '#DBEAFE' },
  { key: 'societe',   label: 'Rapport par société',   desc: 'Regroupé par société du groupe',     icon: Building2,   color: '#0B7439', bg: '#E7F6EC' },
  { key: 'periode',   label: 'Rapport par période',   desc: 'Filtré sur une plage de dates',      icon: CalendarRange, color: '#B45309', bg: '#FEF3C7' },
  { key: 'financier', label: 'Rapport financier',     desc: 'Montants assurés et totaux',         icon: Wallet,      color: '#1D4ED8', bg: '#DBEAFE' },
]

const inputCls =
  'px-3 py-2 rounded-xl border border-[#E2EAE5] bg-white text-sm text-[#1A2E22] ' +
  'focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30 focus:border-[#0B7439] transition'

interface Column { key: string; label: string; align?: 'right'; width?: string }
interface ReportData {
  title: string
  columns: Column[]
  rows: Record<string, string>[]
  groups?: { label: string; total?: string; rows: Record<string, string>[] }[]
  footer?: string
}

export default function AssuranceReports() {
  const [insurances, setInsurances] = useState<VehicleInsurance[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<ReportKey>('assures')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    fetchInsurances()
      .then(setInsurances)
      .catch(err => { console.error(err); toast.error('Erreur lors du chargement') })
      .finally(() => setLoading(false))
  }, [])

  const current = useMemo(() => insurances.filter(i => i.is_current), [insurances])

  const report: ReportData = useMemo(() => {
    const baseCols: Column[] = [
      { key: 'reg', label: 'Immatriculation', width: '15%' },
      { key: 'societe', label: 'Société', width: '13%' },
      { key: 'assureur', label: 'Assureur', width: '14%' },
      { key: 'police', label: 'N° police', width: '17%' },
      { key: 'effet', label: 'Effet', width: '12%' },
      { key: 'echeance', label: 'Échéance', width: '12%' },
      { key: 'montant', label: 'Montant', align: 'right', width: '11%' },
      { key: 'statut', label: 'Statut', width: '6%' },
    ]
    const toRow = (i: VehicleInsurance): Record<string, string> => ({
      reg: i.registration_number ?? '—',
      societe: i.company_name ?? '—',
      assureur: i.assureur,
      police: i.policy_number ?? '—',
      effet: new Date(i.effect_date).toLocaleDateString('fr-FR'),
      echeance: new Date(i.expiry_date).toLocaleDateString('fr-FR'),
      montant: formatCurrency(Number(i.amount ?? 0)),
      statut: STATUS_LABELS[effectiveStatus(i)],
    })
    const sum = (list: VehicleInsurance[]) => list.reduce((s, i) => s + Number(i.amount ?? 0), 0)

    switch (active) {
      case 'assures': {
        const list = current.filter(i => {
          const s = effectiveStatus(i)
          return s === 'actif' || s === 'proche_echeance'
        })
        return { title: 'Liste des véhicules assurés', columns: baseCols, rows: list.map(toRow), footer: `${list.length} véhicule(s) — Total assuré : ${formatCurrency(sum(list))}` }
      }
      case 'echeance': {
        const list = current
          .filter(i => { const d = daysUntil(i.expiry_date); return d >= 0 && d <= 60 })
          .sort((a, b) => daysUntil(a.expiry_date) - daysUntil(b.expiry_date))
        const cols: Column[] = [
          { key: 'reg', label: 'Immatriculation', width: '17%' },
          { key: 'societe', label: 'Société', width: '14%' },
          { key: 'assureur', label: 'Assureur', width: '15%' },
          { key: 'police', label: 'N° police', width: '19%' },
          { key: 'effet', label: 'Effet', width: '13%' },
          { key: 'echeance', label: 'Échéance', width: '13%' },
          { key: 'jours', label: 'Jours restants', align: 'right', width: '9%' },
        ]
        const rows = list.map(i => ({ ...toRow(i), jours: String(daysUntil(i.expiry_date)) + ' j' }))
        return { title: 'Véhicules à échéance (60 jours)', columns: cols, rows, footer: `${list.length} véhicule(s) à renouveler` }
      }
      case 'expirees': {
        const list = current.filter(i => effectiveStatus(i) === 'expire')
          .sort((a, b) => daysUntil(a.expiry_date) - daysUntil(b.expiry_date))
        const cols: Column[] = [
          { key: 'reg', label: 'Immatriculation', width: '17%' },
          { key: 'societe', label: 'Société', width: '14%' },
          { key: 'assureur', label: 'Assureur', width: '15%' },
          { key: 'police', label: 'N° police', width: '19%' },
          { key: 'effet', label: 'Effet', width: '13%' },
          { key: 'echeance', label: 'Échéance', width: '13%' },
          { key: 'retard', label: 'Retard', align: 'right', width: '9%' },
        ]
        const rows = list.map(i => ({ ...toRow(i), retard: Math.abs(daysUntil(i.expiry_date)) + ' j' }))
        return { title: 'Assurances expirées', columns: cols, rows, footer: `${list.length} assurance(s) expirée(s)` }
      }
      case 'assureur': {
        const map = new Map<string, VehicleInsurance[]>()
        current.forEach(i => { const k = i.assureur || '—'; map.set(k, [...(map.get(k) ?? []), i]) })
        const groups = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, list]) => ({
          label: `${label} (${list.length})`,
          total: formatCurrency(sum(list)),
          rows: list.map(toRow),
        }))
        return { title: 'Rapport par assureur', columns: baseCols, rows: current.map(toRow), groups, footer: `Total général : ${formatCurrency(sum(current))}` }
      }
      case 'societe': {
        const map = new Map<string, VehicleInsurance[]>()
        current.forEach(i => { const k = i.company_name ?? '—'; map.set(k, [...(map.get(k) ?? []), i]) })
        const groups = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, list]) => ({
          label: `${label} (${list.length})`,
          total: formatCurrency(sum(list)),
          rows: list.map(toRow),
        }))
        return { title: 'Rapport par société', columns: baseCols, rows: current.map(toRow), groups, footer: `Total général : ${formatCurrency(sum(current))}` }
      }
      case 'periode': {
        const f = from ? new Date(from) : null
        const t = to ? new Date(to) : null
        const list = current.filter(i => {
          const d = new Date(i.effect_date)
          if (f && d < f) return false
          if (t && d > t) return false
          return true
        })
        return { title: 'Rapport par période', columns: baseCols, rows: list.map(toRow), footer: `${list.length} assurance(s) — Total : ${formatCurrency(sum(list))}` }
      }
      case 'financier': {
        const byStatus = new Map<InsuranceStatus, VehicleInsurance[]>()
        current.forEach(i => { const s = effectiveStatus(i); byStatus.set(s, [...(byStatus.get(s) ?? []), i]) })
        const cols: Column[] = [
          { key: 'statut', label: 'Statut', width: '50%' },
          { key: 'count', label: 'Nb véhicules', align: 'right', width: '25%' },
          { key: 'montant', label: 'Montant total', align: 'right', width: '25%' },
        ]
        const rows = [...byStatus.entries()].map(([s, list]) => ({
          statut: STATUS_LABELS[s],
          count: String(list.length),
          montant: formatCurrency(sum(list)),
        }))
        return { title: 'Rapport financier', columns: cols, rows, footer: `Total assuré (toutes polices en cours) : ${formatCurrency(sum(current))}` }
      }
    }
  }, [active, current, from, to])

  const meta = REPORTS.find(r => r.key === active)!

  function buildReportHtml(): string {
    const esc = (s: string) => String(s ?? '—')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const printedAt = new Date().toLocaleString('fr-FR')
    const periodLine = active === 'periode' && (from || to)
      ? `<span>Période : ${from ? new Date(from).toLocaleDateString('fr-FR') : '…'} → ${to ? new Date(to).toLocaleDateString('fr-FR') : '…'}</span>`
      : ''

    const colgroup = `<colgroup>${report.columns.map(c => `<col style="width:${c.width ?? 'auto'}" />`).join('')}</colgroup>`
    const headCells = report.columns
      .map(c => `<th class="${c.align === 'right' ? 'r' : 'l'}">${esc(c.label)}</th>`).join('')
    const rowHtml = (r: Record<string, string>) =>
      `<tr>${report.columns.map(c => `<td class="${c.align === 'right' ? 'r' : 'l'}">${esc(r[c.key] ?? '—')}</td>`).join('')}</tr>`

    let body = ''
    if (report.groups) {
      for (const g of report.groups) {
        body += `<tr class="grp"><td class="grp-l" colspan="${report.columns.length - 1}">${esc(g.label)}</td><td class="grp-t r">${esc(g.total ?? '')}</td></tr>`
        body += g.rows.map(rowHtml).join('')
      }
    } else {
      body = report.rows.map(rowHtml).join('')
    }

    const footer = report.footer
      ? `<tr class="ft"><td colspan="${report.columns.length}" class="r">${esc(report.footer)}</td></tr>`
      : ''

    return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" />
<title>${esc(report.title)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #1A2E22; font-size: 11px; }
  .page { padding: 16px 20px; }
  .head { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #0B7439; padding-bottom: 12px; margin-bottom: 4px; }
  .brand { font-size: 20px; font-weight: 800; color: #0B7439; letter-spacing: .5px; }
  .brand small { display: block; font-size: 10px; font-weight: 500; color: #6B7280; letter-spacing: .3px; margin-top: 2px; }
  .title { font-size: 16px; font-weight: 700; margin: 0; text-align: right; }
  .meta { font-size: 10px; color: #6B7280; text-align: right; margin-top: 4px; display: flex; flex-direction: column; gap: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; table-layout: fixed; }
  th { background: #0B7439; color: #fff; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; padding: 7px 8px; }
  th.l, td.l { text-align: left; }
  th.r, td.r { text-align: right; }
  td { padding: 6px 8px; border-bottom: 1px solid #E2EAE5; word-break: break-word; }
  tbody tr:nth-child(even of :not(.grp):not(.ft)) td { background: #F7FAF8; }
  tr.grp td { background: #E7F6EC; border-top: 2px solid #0B7439; border-bottom: 1px solid #9CDAB6; }
  td.grp-l { font-weight: 800; color: #0B7439; font-size: 12px; letter-spacing: .3px; }
  td.grp-t { font-weight: 800; color: #0B7439; font-size: 12px; }
  tr.ft td { background: #1A2E22; color: #fff; font-weight: 800; font-size: 12px; padding: 9px 10px; }
  .foot-note { margin-top: 10px; font-size: 9px; color: #9CA3AF; text-align: center; }
  @page { size: A4 landscape; margin: 10mm; }
  @media print { .page { padding: 0; } }
</style></head>
<body><div class="page">
  <div class="head">
    <div class="brand">SBTA<small>Responsable Service Assurance</small></div>
    <div>
      <h1 class="title">${esc(report.title)}</h1>
      <div class="meta">${periodLine}<span>Édité le ${esc(printedAt)}</span></div>
    </div>
  </div>
  <table>${colgroup}<thead><tr>${headCells}</tr></thead><tbody>${body}${footer}</tbody></table>
  <p class="foot-note">Document généré automatiquement — SBTA · Service Assurance</p>
</div></body></html>`
  }

  function handlePrint() {
    const w = window.open('', '_blank', 'width=1200,height=800')
    if (!w) { toast.error('Veuillez autoriser les fenêtres pop-up pour imprimer.'); return }
    w.document.open()
    w.document.write(buildReportHtml())
    w.document.close()
    w.focus()
    setTimeout(() => { try { w.print() } catch { /* noop */ } }, 400)
  }

  async function exportExcel() {
    const { utils, writeFile } = await import('xlsx')
    const header = report.columns.map(c => c.label)
    const aoa: unknown[][] = [[report.title], [], header]
    if (report.groups) {
      for (const g of report.groups) {
        aoa.push([], [g.label, g.total ?? ''])
        g.rows.forEach(r => aoa.push(report.columns.map(c => r[c.key] ?? '')))
      }
    } else {
      report.rows.forEach(r => aoa.push(report.columns.map(c => r[c.key] ?? '')))
    }
    if (report.footer) aoa.push([], [report.footer])
    const ws = utils.aoa_to_sheet(aoa)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, meta.label.slice(0, 31))
    writeFile(wb, `assurance_${active}.xlsx`)
  }

  async function exportPdf() {
    const { default: jsPDF } = await import('jspdf')
    const { default: html2canvas } = await import('html2canvas')
    const holder = document.createElement('div')
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:1123px;background:#fff;'
    holder.innerHTML = buildReportHtml()
    document.body.appendChild(holder)
    try {
      const target = (holder.querySelector('.page') as HTMLElement) ?? holder
      const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = 297
      const pageH = 210
      const imgW = pageW
      const imgH = (canvas.height * imgW) / canvas.width
      let position = 0
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgW, imgH)
      let remaining = imgH - pageH
      while (remaining > 0) {
        position -= pageH
        pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgW, imgH)
        remaining -= pageH
      }
      pdf.save(`assurance_${active}.pdf`)
    } catch (err) {
      console.error(err)
      toast.error('Erreur lors de la génération du PDF')
    } finally {
      document.body.removeChild(holder)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const renderRows = (rows: Record<string, string>[]) => rows.map((r, idx) => (
    <tr key={idx} className="even:bg-[#F7FAF8] hover:bg-[#EEF6F1] transition-colors">
      {report.columns.map(c => (
        <td key={c.key} className={'px-3 py-2 text-[#1A2E22] whitespace-nowrap ' + (c.align === 'right' ? 'text-right tabular-nums font-medium' : '')}>
          {r[c.key] ?? '—'}
        </td>
      ))}
    </tr>
  ))

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E22]">Rapports d'assurance</h1>
          <p className="text-sm text-[#6B7280] mt-1">Génération et export des rapports</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E2EAE5] text-[#4A6B55] text-sm font-medium hover:bg-[#F8FAF8] transition-colors"
          >
            <Printer className="w-4 h-4" /> Imprimer
          </button>
          <ExportButton onExportPDF={exportPdf} onExportExcel={exportExcel} />
        </div>
      </div>

      {/* Report selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {REPORTS.map(r => {
          const Icon = r.icon
          const isActive = r.key === active
          return (
            <button
              key={r.key}
              onClick={() => setActive(r.key)}
              className={
                'flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ' +
                (isActive ? 'border-[#0B7439] ring-2 ring-[#0B7439]/20 bg-white' : 'border-[#E2EAE5] bg-white hover:bg-[#F8FAF8]')
              }
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: r.bg }}>
                <Icon className="w-5 h-5" style={{ color: r.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1A2E22]">{r.label}</p>
                <p className="text-xs text-[#6B7280] mt-0.5">{r.desc}</p>
              </div>
            </button>
          )
        })}
      </div>

      {active === 'periode' && (
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Du</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Au</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} />
          </div>
        </div>
      )}

      {/* Report content */}
      <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2EAE5] flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#0B7439]" />
          <h2 className="font-semibold text-[#1A2E22]">{report.title}</h2>
        </div>

        {report.rows.length === 0 && !report.groups?.some(g => g.rows.length) ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#6B7280]">
            <ShieldCheck className="w-10 h-10 text-[#9CDAB6] mb-2" />
            <p className="text-sm">Aucune donnée pour ce rapport.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                {report.columns.map(c => <col key={c.key} style={{ width: c.width ?? 'auto' }} />)}
              </colgroup>
              <thead>
                <tr className="bg-[#0B7439] text-left text-xs font-semibold text-white uppercase tracking-wide">
                  {report.columns.map(c => (
                    <th key={c.key} className={'px-3 py-3 ' + (c.align === 'right' ? 'text-right' : '')}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4F1]">
                {report.groups
                  ? report.groups.map(g => (
                      <Fragment key={g.label}>
                        <tr className="bg-[#E7F6EC] border-t-2 border-[#0B7439]">
                          <td colSpan={report.columns.length - 1} className="px-3 py-2.5 font-extrabold text-[#0B7439] text-[13px] tracking-wide">{g.label}</td>
                          <td className="px-3 py-2.5 text-right font-extrabold text-[#0B7439] text-[13px] tabular-nums">{g.total}</td>
                        </tr>
                        {renderRows(g.rows)}
                      </Fragment>
                    ))
                  : renderRows(report.rows)}
              </tbody>
            </table>
          </div>
        )}

        {report.footer && (
          <div className="px-5 py-3.5 bg-[#1A2E22] text-sm font-bold text-white text-right tracking-wide">
            {report.footer}
          </div>
        )}
      </div>
    </div>
  )
}
