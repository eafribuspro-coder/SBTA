import { useRef, useCallback, useMemo } from 'react'
import { Printer, Download, X } from 'lucide-react'
import type { PaySlip, MaritalStatus } from '@/types/hr.types'
import { computePayroll } from '@/utils/ivorianPayroll'
import { seniorityLabel } from '@/utils/employeePrimes'

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const MARITAL_LABEL: Record<string, string> = {
  celibataire: 'Célibataire',
  marie: 'Marié(e)',
  divorce: 'Divorcé(e)',
  veuf: 'Veuf(ve)',
}

interface Props {
  slip: PaySlip
  onClose: () => void
}

const ACCENT = '#0B7439'

const printStyles = `
  @page { size: A4; margin: 10mm 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 10px; color: #1a1a1a; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; line-height: 1.45; }
  .sheet { width: 100%; }
  table { border-collapse: collapse; width: 100%; }

  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${ACCENT}; padding-bottom: 10px; }
  .brand { display: flex; flex-direction: column; }
  .brand .logo { font-size: 22px; font-weight: 800; color: ${ACCENT}; letter-spacing: 1px; }
  .brand .sub { font-size: 9px; color: #666; margin-top: 2px; max-width: 230px; }
  .doc { text-align: right; }
  .doc .t { font-size: 18px; font-weight: 800; color: #1a1a1a; letter-spacing: 0.5px; }
  .doc .p { font-size: 11px; font-weight: 600; color: ${ACCENT}; margin-top: 2px; }
  .doc .d { font-size: 9px; color: #777; margin-top: 1px; }

  .parties { display: flex; gap: 10px; margin-top: 12px; }
  .card { flex: 1; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; }
  .card .ttl { background: ${ACCENT}; color: #fff; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; padding: 4px 8px; }
  .card .body { padding: 7px 9px; }
  .row { display: flex; justify-content: space-between; gap: 8px; padding: 1.5px 0; }
  .row .k { color: #777; font-size: 9px; }
  .row .v { color: #1a1a1a; font-size: 9px; font-weight: 600; text-align: right; }
  .empname { font-size: 13px; font-weight: 800; color: #1a1a1a; }

  .lines { margin-top: 14px; border: 1px solid #d8d8d8; border-radius: 6px; overflow: hidden; }
  .lines thead th { background: #f3f4f6; color: #374151; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; padding: 6px 8px; border-bottom: 1px solid #d8d8d8; text-align: left; }
  .lines td { padding: 4px 8px; font-size: 9.5px; border-bottom: 1px solid #f0f0f0; }
  .lines .r { text-align: right; }
  .lines .c { text-align: center; }
  .lines .code { color: #999; font-size: 8.5px; }
  .lines .sec td { background: #fafafa; font-weight: 700; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.5px; color: ${ACCENT}; padding: 4px 8px; }
  .lines .sec.ded td { color: #b91c1c; }
  .lines .sub td { font-weight: 700; border-top: 1px solid #cfcfcf; }
  .lines .sub .r { color: #1a1a1a; }
  .gain { color: ${ACCENT}; }
  .ded { color: #b91c1c; }

  .totals { display: flex; gap: 10px; margin-top: 12px; align-items: stretch; }
  .patronal { flex: 1.3; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; }
  .patronal .ttl { background: #f3f4f6; color: #374151; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 8px; border-bottom: 1px solid #e0e0e0; }
  .patronal td { padding: 2.5px 8px; font-size: 9px; border-bottom: 1px solid #f4f4f4; }
  .patronal .r { text-align: right; }
  .patronal .tot td { font-weight: 700; border-top: 1px solid #ddd; }

  .net { flex: 1; border: 2px solid ${ACCENT}; border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; justify-content: center; }
  .net .sum { display: flex; justify-content: space-between; font-size: 9px; color: #555; padding: 1.5px 0; }
  .net .sum b { color: #1a1a1a; font-weight: 600; }
  .net .label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.6px; margin-top: 6px; }
  .net .val { font-size: 24px; font-weight: 800; color: ${ACCENT}; letter-spacing: 0.5px; }

  .cumuls { margin-top: 14px; }
  .cumuls .ttl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; margin-bottom: 4px; }
  .cumuls th { background: #f3f4f6; font-size: 8px; font-weight: 600; color: #555; padding: 3px 6px; border: 1px solid #e5e5e5; text-align: center; }
  .cumuls td { font-size: 9px; padding: 3px 6px; border: 1px solid #eee; text-align: center; }

  .foot { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e5e5e5; display: flex; justify-content: space-between; font-size: 8px; color: #999; }
`

function buildBulletinHTML(slip: PaySlip): string {
  const base = Number(slip.base_salary) || 0
  const sursalaire = Number(slip.sursalaire) || 0
  const primes = Number(slip.primes) || 0
  const indemnites = Number(slip.indemnites) || 0
  const avantages = Number(slip.avantages) || 0
  const transport = Number(slip.transport_allowance) || 0
  const primesNonImposables = Number(slip.primes_non_imposables) || 0
  const retenuesDiverses = Number(slip.retenues) || 0
  const loanDed = Number(slip.loan_deductions) || 0

  const pr = computePayroll({
    baseSalary: base,
    sursalaire,
    primes,
    indemnites,
    avantages,
    transport,
    primesNonImposables,
    maritalStatus: (slip.employee_marital_status as MaritalStatus) ?? null,
    childrenCount: Number(slip.employee_children_count) || 0,
    otherDeductions: retenuesDiverses,
    loanDeductions: loanDed,
  })

  const periodLabel = `${MONTHS[slip.period_month - 1]} ${slip.period_year}`
  const lastDay = new Date(slip.period_year, slip.period_month, 0).getDate()
  const periodStart = `01/${String(slip.period_month).padStart(2, '0')}/${slip.period_year}`
  const periodEnd = `${lastDay}/${String(slip.period_month).padStart(2, '0')}/${slip.period_year}`
  const payDate = slip.paid_at ? new Date(slip.paid_at).toLocaleDateString('fr-FR') : periodEnd
  const companyName = slip.company?.name || 'SBTA'

  const gainRow = (code: string, label: string, baseVal: number | '', taux: string, amount: number) =>
    `<tr><td class="code">${code}</td><td>${label}</td><td class="r">${baseVal !== '' ? fmt(baseVal) : ''}</td><td class="c">${taux}</td><td class="r gain">${fmt(amount)}</td><td class="r"></td></tr>`

  const dedRow = (code: string, label: string, baseVal: number | '', taux: string, amount: number) =>
    `<tr><td class="code">${code}</td><td>${label}</td><td class="r">${baseVal !== '' ? fmt(baseVal) : ''}</td><td class="c">${taux}</td><td class="r"></td><td class="r ded">${fmt(amount)}</td></tr>`

  const gains: string[] = [gainRow('100', 'Salaire de base', base, '', base)]
  if (sursalaire > 0) gains.push(gainRow('101', 'Sursalaire', sursalaire, '', sursalaire))
  if (indemnites > 0) gains.push(gainRow('110', 'Indemnités', indemnites, '', indemnites))
  if (primes > 0) gains.push(gainRow('120', 'Primes', primes, '', primes))
  if (avantages > 0) gains.push(gainRow('130', 'Avantages en nature', avantages, '', avantages))
  if (pr.transportNonImposable > 0)
    gains.push(gainRow('140', 'Prime de transport (non imposable)', pr.transportNonImposable, '', pr.transportNonImposable))
  const primesNonImpHorsTransport = primesNonImposables
  if (primesNonImpHorsTransport > 0)
    gains.push(gainRow('141', 'Primes non imposables', primesNonImpHorsTransport, '', primesNonImpHorsTransport))

  const deds: string[] = []
  if (pr.is > 0) deds.push(dedRow('300', 'Impôt sur Salaires (IS)', pr.taxableGross, '1,2%', pr.is))
  if (pr.cn > 0) deds.push(dedRow('301', 'Contribution Nationale (CN)', pr.netImposable, '', pr.cn))
  if (pr.igr > 0) deds.push(dedRow('302', 'Impôt Général sur le Revenu (IGR)', pr.netImposable, '', pr.igr))
  deds.push(dedRow('310', 'Retraite CNPS', pr.socialGross, '6,3%', pr.cnpsEmployee))
  deds.push(dedRow('320', 'Couverture Maladie Universelle (CMU)', 1000, '50%', pr.cmuEmployee))

  let code = 400
  for (const d of slip.deduction_details ?? []) {
    deds.push(dedRow(String(code), d.label, d.amount, '', d.amount))
    code++
  }
  if ((slip.deduction_details ?? []).length === 0) {
    if (retenuesDiverses > 0) deds.push(dedRow('400', 'Retenues diverses', retenuesDiverses, '', retenuesDiverses))
    if (loanDed > 0) deds.push(dedRow('401', 'Remb. emprunts / avances', loanDed, '', loanDed))
  }

  const patronalRows = [
    ['Retraite CNPS', '7,7%', pr.cnpsEmployer],
    ['Prestations familiales', '5,75%', pr.prestationFamiliale],
    ['Accident du travail', '5%', pr.accidentTravail],
    ['Impôt employeur (IS)', '1,2%', pr.isEmployer],
    ['FDFP - Taxe apprentissage', '0,4%', pr.fdfpTa],
    ['FDFP - Form. continue', '1,2%', pr.fdfpFpc],
    ['CMU employeur', '50%', pr.cmuEmployer],
  ]
    .map(([l, t, v]) => `<tr><td>${l}</td><td class="r">${t}</td><td class="r">${fmt(v as number)}</td></tr>`)
    .join('')

  const situation = MARITAL_LABEL[slip.employee_marital_status ?? ''] || '—'

  const hireDate = slip.employee_hire_date
  const hireDateLabel = hireDate ? new Date(hireDate).toLocaleDateString('fr-FR') : 'Non renseignée'
  const ancienneteLabel = seniorityLabel(hireDate, slip.period_year, slip.period_month)

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Bulletin de paie - ${slip.employee_name}</title><style>${printStyles}</style></head><body>
<div class="sheet">
  <div class="top">
    <div class="brand">
      <div class="logo">${companyName.toUpperCase()}</div>
      <div class="sub">Société Bus Transport Abidjan — Bulletin de paie établi conformément à la réglementation sociale et fiscale ivoirienne.</div>
    </div>
    <div class="doc">
      <div class="t">BULLETIN DE PAIE</div>
      <div class="p">${periodLabel}</div>
      <div class="d">Période : ${periodStart} au ${periodEnd}</div>
      <div class="d">Date de paiement : ${payDate}</div>
    </div>
  </div>

  <div class="parties">
    <div class="card">
      <div class="ttl">Employeur</div>
      <div class="body">
        <div class="row"><span class="k">Raison sociale</span><span class="v">${companyName}</span></div>
        <div class="row"><span class="k">Code société</span><span class="v">${slip.company?.code || '—'}</span></div>
        <div class="row"><span class="k">Régime</span><span class="v">CNPS / DGI - Côte d'Ivoire</span></div>
      </div>
    </div>
    <div class="card">
      <div class="ttl">Salarié</div>
      <div class="body">
        <div class="row"><span class="k">Nom &amp; prénoms</span><span class="v empname">${slip.employee_name}</span></div>
        <div class="row"><span class="k">Matricule</span><span class="v">${slip.employee_matricule || '—'}</span></div>
        <div class="row"><span class="k">Emploi</span><span class="v">${slip.employee_role || '—'}</span></div>
        <div class="row"><span class="k">Nationalité</span><span class="v">${slip.employee_nationality || '—'}</span></div>
        <div class="row"><span class="k">N° CNPS</span><span class="v">${slip.employee_cnps || '—'}</span></div>
        <div class="row"><span class="k">Date entrée</span><span class="v">${hireDateLabel}</span></div>
        <div class="row"><span class="k">Ancienneté</span><span class="v">${ancienneteLabel}</span></div>
        <div class="row"><span class="k">Situation / Parts</span><span class="v">${situation} — ${pr.parts.toLocaleString('fr-FR')} part(s)</span></div>
      </div>
    </div>
  </div>

  <table class="lines">
    <thead>
      <tr>
        <th style="width:42px">Code</th>
        <th>Désignation</th>
        <th class="r" style="width:90px">Base</th>
        <th class="c" style="width:50px">Taux</th>
        <th class="r" style="width:90px">Gains</th>
        <th class="r" style="width:90px">Retenues</th>
      </tr>
    </thead>
    <tbody>
      <tr class="sec"><td colspan="6">Éléments de rémunération</td></tr>
      ${gains.join('')}
      <tr class="sub"><td></td><td>Salaire brut</td><td></td><td></td><td class="r gain">${fmt(pr.totalGains)}</td><td class="r"></td></tr>
      <tr class="sec ded"><td colspan="6">Retenues salariales</td></tr>
      ${deds.join('')}
      <tr class="sub"><td></td><td>Total des retenues</td><td></td><td></td><td class="r"></td><td class="r ded">${fmt(pr.totalRetenues)}</td></tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="patronal">
      <div class="ttl">Charges patronales (à la charge de l'employeur)</div>
      <table>
        <tbody>
          ${patronalRows}
          <tr class="tot"><td>Total charges patronales</td><td></td><td class="r">${fmt(pr.totalChargesPatronales)}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="net">
      <div class="sum"><span>Salaire brut imposable</span><b>${fmt(pr.taxableGross)}</b></div>
      <div class="sum"><span>Net imposable (80%)</span><b>${fmt(pr.netImposable)}</b></div>
      <div class="sum"><span>Total retenues</span><b>- ${fmt(pr.totalRetenues)}</b></div>
      <div class="label">Net à payer</div>
      <div class="val">${fmt(pr.netSalary)} F</div>
    </div>
  </div>

  <div class="cumuls">
    <div class="ttl">Récapitulatif fiscal &amp; social</div>
    <table>
      <thead>
        <tr><th>Brut imposable</th><th>IS</th><th>CN</th><th>IGR</th><th>CNPS salarié</th><th>CMU</th><th>Net à payer</th></tr>
      </thead>
      <tbody>
        <tr><td>${fmt(pr.taxableGross)}</td><td>${fmt(pr.is)}</td><td>${fmt(pr.cn)}</td><td>${fmt(pr.igr)}</td><td>${fmt(pr.cnpsEmployee)}</td><td>${fmt(pr.cmuEmployee)}</td><td>${fmt(pr.netSalary)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="foot">
    <span>${companyName} — Document généré le ${new Date().toLocaleDateString('fr-FR')}</span>
    <span>Bulletin conforme CNPS / DGI Côte d'Ivoire</span>
  </div>
</div>
</body></html>`
}

export default function BulletinPrint({ slip, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const html = useMemo(() => buildBulletinHTML(slip), [slip])

  const triggerPrint = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const win = iframe.contentWindow
    if (!win) return
    win.focus()
    win.print()
  }, [])

  const triggerDownload = useCallback(() => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bulletin_paie_${slip.employee_name.replace(/\s+/g, '_')}_${slip.period_year}_${String(slip.period_month).padStart(2, '0')}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [html, slip])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-[60] p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-[56rem] w-full my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-bold text-gray-900">Aperçu du bulletin de paie</h3>
          <div className="flex gap-2">
            <button onClick={triggerPrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:shadow-md active:scale-95"
              style={{ backgroundColor: ACCENT }}>
              <Printer className="w-4 h-4" />Imprimer
            </button>
            <button onClick={triggerDownload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:shadow-md active:scale-95"
              style={{ backgroundColor: '#1D6FA4' }}>
              <Download className="w-4 h-4" />Télécharger
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-4 bg-gray-100 rounded-b-2xl">
          <iframe
            ref={iframeRef}
            title="bulletin-preview"
            srcDoc={html}
            className="w-full bg-white rounded-lg shadow-sm border border-gray-200"
            style={{ height: '75vh' }}
          />
        </div>
      </div>
    </div>
  )
}
