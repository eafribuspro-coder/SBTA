import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Printer, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/utils/formatCurrency';
import { exportToCSV } from '@/utils/reportHelpers';
import ExportButton from '@/components/shared/ExportButton';
import { fetchBookings, type MobileBooking } from '@/services/agentReservation.service';
import { useRealtimeSync } from './shared';

type Period = 'today' | 'week' | 'month' | 'all';

function inPeriod(iso: string | null, period: Period): boolean {
  if (period === 'all') return true;
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  if (period === 'today') {
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }
  if (period === 'week') {
    const start = new Date(n);
    start.setDate(n.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return d >= start;
  }
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}

export default function SalesReports() {
  const [bookings, setBookings] = useState<MobileBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [company, setCompany] = useState('all');
  const [city, setCity] = useState('all');

  const load = () => {
    fetchBookings()
      .then(setBookings)
      .catch((e) => { console.error(e); toast.error('Erreur lors du chargement des rapports'); })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useRealtimeSync(['mobile_bookings'], load);

  const companies = useMemo(
    () => Array.from(new Set(bookings.map((b) => b.company_id).filter(Boolean))) as string[],
    [bookings],
  );
  const cities = useMemo(
    () => Array.from(new Set(bookings.map((b) => b.origin_city).filter(Boolean))) as string[],
    [bookings],
  );

  const rows = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === 'cancelled') return false;
      if (!inPeriod(b.created_at, period)) return false;
      if (company !== 'all' && b.company_id !== company) return false;
      if (city !== 'all' && b.origin_city !== city) return false;
      return true;
    });
  }, [bookings, period, company, city]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, b) => {
        const operator = b.unit_price * b.seats_count;
        acc.tickets += 1;
        acc.seats += b.seats_count;
        acc.serviceFees += b.service_fee;
        acc.operator += operator;
        acc.total += b.total;
        return acc;
      },
      { tickets: 0, seats: 0, serviceFees: 0, operator: 0, total: 0 },
    );
  }, [rows]);

  const periods: { key: Period; label: string }[] = [
    { key: 'today', label: "Aujourd'hui" },
    { key: 'week', label: '7 jours' },
    { key: 'month', label: 'Ce mois' },
    { key: 'all', label: 'Tout' },
  ];

  const exportRows = () =>
    rows.map((b) => ({
      'N° Billet': b.booking_ref,
      Client: b.customer_name ?? '—',
      Trajet: `${b.origin_city ?? ''} → ${b.destination_city ?? ''}`,
      Date: b.travel_date ?? '—',
      Bus: b.bus_label ?? '—',
      Places: b.seats_count,
      'Frais service': b.service_fee,
      Opérateur: b.unit_price * b.seats_count,
      Total: b.total,
      Paiement: b.payment_status,
      Statut: b.status,
    }));

  const handleCSV = () => {
    if (rows.length === 0) { toast.error('Aucune donnée à exporter'); return; }
    exportToCSV(exportRows(), `rapport_ventes_${period}`);
  };

  const exportExcel = async () => {
    if (rows.length === 0) { toast.error('Aucune donnée à exporter'); return; }
    const { utils, writeFile } = await import('xlsx');
    const ws = utils.json_to_sheet(exportRows());
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Ventes');
    writeFile(wb, `rapport_ventes_${period}.xlsx`);
  };

  function buildHtml(): string {
    const esc = (s: unknown) => String(s ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const printedAt = new Date().toLocaleString('fr-FR');
    const body = rows
      .map(
        (b) => `<tr>
        <td>${esc(b.booking_ref)}</td>
        <td>${esc(b.customer_name)}</td>
        <td>${esc(b.origin_city)} → ${esc(b.destination_city)}</td>
        <td>${esc(b.bus_label)}</td>
        <td class="r">${esc(b.seats_count)}</td>
        <td class="r">${esc(formatCurrency(b.service_fee))}</td>
        <td class="r">${esc(formatCurrency(b.unit_price * b.seats_count))}</td>
        <td class="r">${esc(formatCurrency(b.total))}</td>
      </tr>`,
      )
      .join('');
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" /><title>Rapport de ventes</title>
<style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  body{font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#1A2E22;font-size:11px;margin:0;}
  .page{padding:16px 20px;}
  .head{display:flex;justify-content:space-between;border-bottom:3px solid #0B7439;padding-bottom:12px;}
  .brand{font-size:20px;font-weight:800;color:#0B7439;}.brand small{display:block;font-size:10px;color:#6B7280;font-weight:500;}
  .title{font-size:16px;font-weight:700;margin:0;text-align:right;}.meta{font-size:10px;color:#6B7280;text-align:right;margin-top:4px;}
  table{width:100%;border-collapse:collapse;margin-top:14px;}
  th{background:#0B7439;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;padding:7px 8px;text-align:left;}
  td{padding:6px 8px;border-bottom:1px solid #E2EAE5;}.r{text-align:right;}
  tr.ft td{background:#1A2E22;color:#fff;font-weight:800;font-size:12px;}
  @page{size:A4 landscape;margin:10mm;}
</style></head>
<body><div class="page">
  <div class="head"><div class="brand">SBTA<small>Agent Réservation</small></div>
  <div><h1 class="title">Rapport de ventes</h1><div class="meta">Édité le ${esc(printedAt)}</div></div></div>
  <table><thead><tr>
    <th>N° Billet</th><th>Client</th><th>Trajet</th><th>Bus</th>
    <th class="r">Places</th><th class="r">Frais service</th><th class="r">Opérateur</th><th class="r">Total</th>
  </tr></thead><tbody>${body}
    <tr class="ft"><td colspan="4" class="r">${rows.length} billet(s)</td>
    <td class="r">${totals.seats}</td><td class="r">${esc(formatCurrency(totals.serviceFees))}</td>
    <td class="r">${esc(formatCurrency(totals.operator))}</td><td class="r">${esc(formatCurrency(totals.total))}</td></tr>
  </tbody></table>
  <p style="margin-top:10px;font-size:9px;color:#9CA3AF;text-align:center;">Document généré automatiquement — SBTA · Agent Réservation</p>
</div></body></html>`;
  }

  function handlePrint() {
    const w = window.open('', '_blank', 'width=1200,height=800');
    if (!w) { toast.error('Veuillez autoriser les fenêtres pop-up.'); return; }
    w.document.open(); w.document.write(buildHtml()); w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch { /* noop */ } }, 400);
  }

  async function exportPdf() {
    if (rows.length === 0) { toast.error('Aucune donnée à exporter'); return; }
    const { default: jsPDF } = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:1123px;background:#fff;';
    holder.innerHTML = buildHtml();
    document.body.appendChild(holder);
    try {
      const target = (holder.querySelector('.page') as HTMLElement) ?? holder;
      const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const imgW = 297, pageH = 210;
      const imgH = (canvas.height * imgW) / canvas.width;
      let position = 0;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgW, imgH);
      let remaining = imgH - pageH;
      while (remaining > 0) { position -= pageH; pdf.addPage(); pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgW, imgH); remaining -= pageH; }
      pdf.save(`rapport_ventes_${period}.pdf`);
    } catch (err) { console.error(err); toast.error('Erreur lors de la génération du PDF'); }
    finally { document.body.removeChild(holder); }
  }

  const summaryCards = [
    { label: 'Billets vendus', value: String(totals.tickets) },
    { label: 'Places', value: String(totals.seats) },
    { label: 'Frais de service', value: formatCurrency(totals.serviceFees) },
    { label: 'Revenu opérateur', value: formatCurrency(totals.operator) },
    { label: 'Total encaissé', value: formatCurrency(totals.total) },
  ];

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E22]">Rapports de ventes</h1>
          <p className="text-sm text-[#6B7280] mt-1">Détail des billets vendus depuis l'application mobile</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E2EAE5] text-[#4A6B55] text-sm font-medium hover:bg-[#F8FAF8] transition-colors">
            <Printer className="w-4 h-4" /> Imprimer
          </button>
          <button onClick={handleCSV} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E2EAE5] text-[#4A6B55] text-sm font-medium hover:bg-[#F8FAF8] transition-colors">
            CSV
          </button>
          <ExportButton onExportPDF={exportPdf} onExportExcel={exportExcel} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 bg-[#F1F5F2] rounded-xl p-1">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={period === p.key ? { backgroundColor: '#fff', color: '#0B7439', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } : { color: '#6B7280' }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="border border-[#E2EAE5] rounded-xl px-3 py-2 text-sm text-[#4A6B55] focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30"
        >
          <option value="all">Toutes les sociétés</option>
          {companies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="border border-[#E2EAE5] rounded-xl px-3 py-2 text-sm text-[#4A6B55] focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30"
        >
          <option value="all">Toutes les villes</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {summaryCards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
            <p className="text-xs text-[#6B7280] font-medium">{c.label}</p>
            <p className="text-lg font-bold text-[#1A2E22] mt-1 truncate">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-9 h-9 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#6B7280]">
            <BarChart3 className="w-10 h-10 mb-2 text-[#C5D6CC]" />
            <p className="text-sm">Aucune vente sur cette période.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[#8AA898] border-b border-[#E2EAE5]">
                  <th className="px-4 py-3 font-semibold">N° Billet</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Trajet</th>
                  <th className="px-4 py-3 font-semibold">Bus</th>
                  <th className="px-4 py-3 font-semibold text-center">Places</th>
                  <th className="px-4 py-3 font-semibold text-right">Frais service</th>
                  <th className="px-4 py-3 font-semibold text-right">Opérateur</th>
                  <th className="px-4 py-3 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4F1]">
                {rows.map((b) => (
                  <tr key={b.id} className="hover:bg-[#F8FAF8]">
                    <td className="px-4 py-3 font-medium text-[#1A2E22] whitespace-nowrap">{b.booking_ref}</td>
                    <td className="px-4 py-3 text-[#4A6B55]">{b.customer_name ?? '—'}</td>
                    <td className="px-4 py-3 text-[#4A6B55] whitespace-nowrap">{b.origin_city} → {b.destination_city}</td>
                    <td className="px-4 py-3 text-[#4A6B55]">{b.bus_label ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-[#4A6B55]">{b.seats_count}</td>
                    <td className="px-4 py-3 text-right text-[#4A6B55] whitespace-nowrap">{formatCurrency(b.service_fee)}</td>
                    <td className="px-4 py-3 text-right text-[#4A6B55] whitespace-nowrap">{formatCurrency(b.unit_price * b.seats_count)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#1A2E22] whitespace-nowrap">{formatCurrency(b.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#1A2E22] text-white text-sm font-bold">
                  <td className="px-4 py-3" colSpan={4}>{rows.length} billet(s)</td>
                  <td className="px-4 py-3 text-center">{totals.seats}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(totals.serviceFees)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(totals.operator)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
