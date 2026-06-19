import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { Download, Package, Truck, CheckCircle, Archive, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { format, subDays } from 'date-fns';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const fmtN = (n: number) => new Intl.NumberFormat('fr-CI', { maximumFractionDigits: 0 }).format(n);
const fmt  = (n: number) => fmtN(n) + ' FCFA';

interface AgencyRow {
  station_id: string;
  station_name: string;
  total_registered: number;
  total_mis_en_paquet: number;
  total_expedie: number;
  total_arrive: number;
  total_livre: number;
  total_retourne: number;
  total_perdu: number;
  ca_periode: number;
}

interface Station { id: string; name: string; }

const PERIODS = [
  { label: "Aujourd'hui", id: 'today',  days: 0 },
  { label: '7 jours',     id: '7d',     days: 7 },
  { label: '30 jours',    id: '30d',    days: 30 },
  { label: '90 jours',    id: '90d',    days: 90 },
  { label: '6 mois',      id: '180d',   days: 180 },
];

const STATUSES = [
  { value: 'enregistre',    label: 'Enregistré',    color: '#10B981' },
  { value: 'mis_en_paquet', label: 'Mis en paquet', color: '#3B82F6' },
  { value: 'expedie',       label: 'Expédié',       color: '#F59E0B' },
  { value: 'arrive',        label: 'Arrivé',        color: '#06B6D4' },
  { value: 'livre',         label: 'Retiré',        color: '#0B7439' },
  { value: 'retourne',      label: 'Retourné',      color: '#92400E' },
  { value: 'perdu',         label: 'Perdu',         color: '#EF4444' },
];

function getRange(id: string, cf: string, ct: string) {
  const today = new Date();
  if (id === 'custom') return { from: cf || format(today, 'yyyy-MM-dd'), to: ct || format(today, 'yyyy-MM-dd') };
  if (id === 'today')  return { from: format(today, 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
  const days = PERIODS.find(p => p.id === id)?.days ?? 30;
  return { from: format(subDays(today, days), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
}

export default function DAFParcelReport() {
  const [periodId,    setPeriodId]    = useState('30d');
  const [customFrom,  setCustomFrom]  = useState('');
  const [customTo,    setCustomTo]    = useState('');
  const [filterSt,    setFilterSt]    = useState<string>('all');
  const [filterStatus,setFilterStatus]= useState<string>('all');
  const [stations,    setStations]    = useState<Station[]>([]);
  const [rows,        setRows]        = useState<AgencyRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const { from: dateFrom, to: dateTo } = getRange(periodId, customFrom, customTo);

  // Load station list once
  useEffect(() => {
    supabase.from('stations').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setStations(data); });
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);

    const params: Record<string, unknown> = {
      p_date_from: dateFrom,
      p_date_to:   dateTo,
    };
    if (filterSt !== 'all')     params.p_station_ids = [filterSt];
    if (filterStatus !== 'all') params.p_statuses    = [filterStatus];

    const { data } = await supabase.rpc('get_daf_parcel_report_by_agency', params);
    if (data) setRows(data as AgencyRow[]);

    setLoading(false);
    setRefreshing(false);
  }, [dateFrom, dateTo, filterSt, filterStatus]);

  useEffect(() => { load(); }, [load]);

  // Totals
  const totals = rows.reduce((acc, r) => ({
    registered:    acc.registered    + Number(r.total_registered),
    mis_en_paquet: acc.mis_en_paquet + Number(r.total_mis_en_paquet),
    expedie:       acc.expedie       + Number(r.total_expedie),
    arrive:        acc.arrive        + Number(r.total_arrive),
    livre:         acc.livre         + Number(r.total_livre),
    retourne:      acc.retourne      + Number(r.total_retourne),
    perdu:         acc.perdu         + Number(r.total_perdu),
    ca:            acc.ca            + Number(r.ca_periode),
  }), { registered: 0, mis_en_paquet: 0, expedie: 0, arrive: 0, livre: 0, retourne: 0, perdu: 0, ca: 0 });

  // Chart data — top agencies by CA
  const chartData = [...rows]
    .sort((a, b) => b.ca_periode - a.ca_periode)
    .slice(0, 12)
    .map(r => ({
      name: r.station_name.length > 14 ? r.station_name.slice(0, 12) + '…' : r.station_name,
      fullName: r.station_name,
      Enregistrés: Number(r.total_registered),
      Expédiés:    Number(r.total_expedie),
      Arrivés:     Number(r.total_arrive),
      CA:          Number(r.ca_periode),
    }));

  // Export Excel
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const sheetRows = [
      ...rows.map(r => ({
        'Agence':               r.station_name,
        'Courriers enregistrés':    r.total_registered,
        'En paquet':            r.total_mis_en_paquet,
        'Expédiés':             r.total_expedie,
        'Arrivés':              r.total_arrive,
        'Retirés':               r.total_livre,
        'Retournés':            r.total_retourne,
        'Perdus':               r.total_perdu,
        'CA période (FCFA)':    r.ca_periode,
      })),
      {
        'Agence':               'TOTAL GÉNÉRAL',
        'Courriers enregistrés':    totals.registered,
        'En paquet':            totals.mis_en_paquet,
        'Expédiés':             totals.expedie,
        'Arrivés':              totals.arrive,
        'Retirés':               totals.livre,
        'Retournés':            totals.retourne,
        'Perdus':               totals.perdu,
        'CA période (FCFA)':    totals.ca,
      },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), 'Rapport courrier');

    // Info sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
      'Période':  `${dateFrom} → ${dateTo}`,
      'Agence':   filterSt === 'all' ? 'Toutes' : stations.find(s => s.id === filterSt)?.name ?? filterSt,
      'Statut':   filterStatus === 'all' ? 'Tous' : STATUSES.find(s => s.value === filterStatus)?.label ?? filterStatus,
      'Exporté le': format(new Date(), 'dd/MM/yyyy HH:mm'),
    }]), 'Paramètres');

    XLSX.writeFile(wb, `daf_rapport_courrier_${dateFrom}_${dateTo}.xlsx`);
  };

  // Export PDF
  const exportPDF = async () => {
    if (!tableRef.current) return;
    const canvas = await html2canvas(tableRef.current, { scale: 1.5, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / canvas.height;
    const imgH = Math.min(pageH - 20, (pageW - 20) / ratio);
    pdf.setFontSize(13);
    pdf.text(`Rapport courrier par agence — ${dateFrom} → ${dateTo}`, 10, 12);
    pdf.addImage(imgData, 'PNG', 10, 18, pageW - 20, imgH);
    pdf.save(`daf_rapport_courrier_${dateFrom}_${dateTo}.pdf`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Rapport courrier par agence</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Activité courrier consolidée — {dateFrom} → {dateTo}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={refreshing}
            className="p-2 rounded-xl border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button onClick={exportPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ backgroundColor: '#EF4444', color: '#fff' }}>
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={exportExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ backgroundColor: '#16A34A', color: '#fff' }}>
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border p-4 flex flex-wrap gap-3 items-center"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriodId(p.id)}
              className="px-3 py-1.5 text-sm font-medium transition-colors"
              style={{ backgroundColor: periodId === p.id ? '#0B7439' : 'var(--surface)', color: periodId === p.id ? '#fff' : 'var(--text-secondary)' }}>
              {p.label}
            </button>
          ))}
          <button onClick={() => setPeriodId('custom')}
            className="px-3 py-1.5 text-sm font-medium transition-colors"
            style={{ backgroundColor: periodId === 'custom' ? '#0B7439' : 'var(--surface)', color: periodId === 'custom' ? '#fff' : 'var(--text-secondary)' }}>
            Personnalisé
          </button>
        </div>
        {periodId === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }} />
          </>
        )}
        <select value={filterSt} onChange={e => setFilterSt(e.target.value)}
          className="px-3 py-1.5 border rounded-xl text-sm"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}>
          <option value="all">Toutes les agences</option>
          {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 border rounded-xl text-sm"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}>
          <option value="all">Tous les statuts</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#0B7439', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Courriers enregistrés', val: totals.registered,    color: '#10B981', icon: <Package className="w-5 h-5" /> },
              { label: 'En paquet',         val: totals.mis_en_paquet, color: '#3B82F6', icon: <Archive className="w-5 h-5" /> },
              { label: 'Expédiés',          val: totals.expedie,       color: '#F59E0B', icon: <Truck className="w-5 h-5" /> },
              { label: 'Arrivés',           val: totals.arrive,        color: '#06B6D4', icon: <CheckCircle className="w-5 h-5" /> },
              { label: 'CA période',        val: totals.ca,            color: '#0B7439', icon: <Download className="w-5 h-5" />, isCA: true },
            ].map(k => (
              <div key={k.label} className="rounded-xl border p-4" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{k.label}</p>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: k.color + '20', color: k.color }}>
                    {k.icon}
                  </div>
                </div>
                <p className="text-lg font-bold truncate" style={{ color: k.color }}>
                  {(k as any).isCA ? fmt(k.val) : fmtN(k.val)}
                </p>
              </div>
            ))}
          </div>

          {/* Status breakdown mini-cards */}
          <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
            {STATUSES.map(s => {
              const val = s.value === 'enregistre'    ? totals.registered
                        : s.value === 'mis_en_paquet' ? totals.mis_en_paquet
                        : s.value === 'expedie'       ? totals.expedie
                        : s.value === 'arrive'        ? totals.arrive
                        : s.value === 'livre'         ? totals.livre
                        : s.value === 'retourne'      ? totals.retourne
                        : totals.perdu;
              const total = totals.registered + totals.mis_en_paquet + totals.expedie + totals.arrive + totals.livre + totals.retourne + totals.perdu;
              return (
                <div key={s.value} className="rounded-xl border p-3 text-center"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
                  <p className="text-base font-bold" style={{ color: s.color }}>{fmtN(val)}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '—'}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Chart */}
          {chartData.length > 1 && (
            <div className="rounded-2xl border p-5" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Activité par agence — Top {Math.min(chartData.length, 12)} agences
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} width={35} />
                  <Tooltip
                    labelFormatter={(l, p) => p[0]?.payload?.fullName ?? l}
                    formatter={(v: number, name: string) => name === 'CA' ? [fmt(v), name] : [fmtN(v), name]}
                  />
                  <Bar dataKey="Enregistrés" fill="#10B981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Expédiés"    fill="#F59E0B" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Arrivés"     fill="#06B6D4" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* CA chart */}
          {chartData.length > 1 && (
            <div className="rounded-2xl border p-5" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                CA par agence (FCFA)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 90 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                    tickFormatter={v => fmtN(v as number)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-primary)' }} />
                  <Tooltip labelFormatter={(l, p) => p[0]?.payload?.fullName ?? l} formatter={(v: number) => [fmt(v), 'CA']} />
                  <Bar dataKey="CA" name="CA" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={`hsl(${140 + i * 12}, 60%, ${40 + i * 2}%)`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detail table */}
          <div ref={tableRef} className="rounded-2xl border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
            <div className="px-4 py-3 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Détail par agence
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {rows.length} agence(s) · {dateFrom} → {dateTo}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  {[
                    'Agence',
                    'Courriers enregistrés',
                    'En paquet',
                    'Expédiés',
                    'Arrivés',
                    'Retirés',
                    'Retournés',
                    'Perdus',
                    'CA période',
                  ].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-xs font-semibold whitespace-nowrap"
                      style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.station_id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                      {r.station_name}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: '#10B981' }}>
                      {fmtN(r.total_registered)}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#3B82F6' }}>
                      {fmtN(r.total_mis_en_paquet)}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#F59E0B' }}>
                      {fmtN(r.total_expedie)}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#06B6D4' }}>
                      {fmtN(r.total_arrive)}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#0B7439' }}>
                      {fmtN(r.total_livre)}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#92400E' }}>
                      {fmtN(r.total_retourne)}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#EF4444' }}>
                      {fmtN(r.total_perdu)}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: '#0B7439' }}>
                      {fmt(r.ca_periode)}
                    </td>
                  </tr>
                ))}

                {/* Total row */}
                {rows.length > 0 && (
                  <tr className="border-t-2"
                    style={{ borderColor: 'var(--border)', fontWeight: 700, backgroundColor: 'var(--bg-subtle)' }}>
                    <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-primary)' }}>
                      TOTAL GÉNÉRAL
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#10B981' }}>{fmtN(totals.registered)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#3B82F6' }}>{fmtN(totals.mis_en_paquet)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#F59E0B' }}>{fmtN(totals.expedie)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#06B6D4' }}>{fmtN(totals.arrive)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#0B7439' }}>{fmtN(totals.livre)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#92400E' }}>{fmtN(totals.retourne)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#EF4444' }}>{fmtN(totals.perdu)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#0B7439' }}>{fmt(totals.ca)}</td>
                  </tr>
                )}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
                      Aucune donnée courrier pour la période sélectionnée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
