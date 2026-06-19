import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

export type SeatType = 'normal' | 'vip' | 'handicape' | 'hors_service';

export interface SeatV2 {
  id: string;
  label: string;
  side: 'left' | 'right' | 'back';
  type: SeatType;
  position: { row: number; col: number };
}

export interface RowV2 {
  row: number;
  seats: SeatV2[];
}

interface BusSeatConfig {
  id: string;
  name: string;
  rows: number;
  left_columns: number;
  right_columns: number;
  back_row: boolean;
  back_row_seats: number;
  total_capacity: number;
  seat_layout_v2: RowV2[] | null;
  seat_layout: any;
}

export interface BusSeatMapProps {
  scheduleId: string;
  busId?: string;
  maxSeats: number;
  onSelectionChange: (selectedLabels: string[]) => void;
  selectedSeats?: string[];
  readOnly?: boolean;
}

type SeatStatus = 'available' | 'reserved' | 'selected' | 'hors_service' | 'vip' | 'handicape';

const COLUMN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function generateLayoutV2(config: {
  rows: number;
  left_columns: number;
  right_columns: number;
  back_row: boolean;
  back_row_seats: number;
  seat_layout_v2?: RowV2[] | null;
  seat_layout?: any;
}): RowV2[] {
  if (config.seat_layout_v2 && config.seat_layout_v2.length > 0) {
    return config.seat_layout_v2;
  }

  const oldLayout = config.seat_layout;
  const oldTypeMap: Record<string, SeatType> = {};
  if (Array.isArray(oldLayout)) {
    for (const row of oldLayout) {
      if (Array.isArray(row)) {
        for (const cell of row) {
          if (cell?.label && cell?.type && cell.type !== 'disabled') {
            oldTypeMap[cell.label] = cell.type as SeatType;
          }
        }
      }
    }
  }

  const rows: RowV2[] = [];
  let seatNum = 1;
  const leftCols = config.left_columns;
  const rightCols = config.right_columns;

  for (let r = 1; r <= config.rows; r++) {
    const seats: SeatV2[] = [];
    for (let c = 0; c < leftCols; c++) {
      const label = `${seatNum}${COLUMN_LETTERS[c]}`;
      seats.push({
        id: label,
        label,
        side: 'left',
        type: oldTypeMap[String(seatNum)] || 'normal',
        position: { row: r, col: c + 1 },
      });
    }
    for (let c = 0; c < rightCols; c++) {
      const colIdx = leftCols + c;
      const label = `${seatNum + leftCols - 1 + c + 1}${COLUMN_LETTERS[leftCols + c]}`;
      seats.push({
        id: label,
        label: `${seatNum + c + leftCols - 1 + 1 - 1}${COLUMN_LETTERS[leftCols + c]}`,
        side: 'right',
        type: 'normal',
        position: { row: r, col: leftCols + 1 + c + 1 },
      });
    }
    seatNum += leftCols + rightCols;
    rows.push({ row: r, seats: rebuildRowSeats(r, leftCols, rightCols, seatNum - leftCols - rightCols, oldTypeMap) });
  }

  if (config.back_row && config.back_row_seats > 0) {
    const backSeats: SeatV2[] = [];
    for (let i = 0; i < config.back_row_seats; i++) {
      const label = `${seatNum}${COLUMN_LETTERS[i] || String(i + 1)}`;
      backSeats.push({
        id: label,
        label,
        side: 'back',
        type: 'normal',
        position: { row: config.rows + 1, col: i + 1 },
      });
      seatNum++;
    }
    rows[rows.length - 1] && rows.push({ row: config.rows + 1, seats: backSeats });
  }

  return rows;
}

function rebuildRowSeats(
  rowNum: number,
  leftCols: number,
  rightCols: number,
  startSeat: number,
  typeMap: Record<string, SeatType>
): SeatV2[] {
  const seats: SeatV2[] = [];
  let n = startSeat;
  for (let c = 0; c < leftCols; c++) {
    const label = `${n}${COLUMN_LETTERS[c]}`;
    seats.push({ id: label, label, side: 'left', type: typeMap[String(n)] || 'normal', position: { row: rowNum, col: c + 1 } });
    n++;
  }
  for (let c = 0; c < rightCols; c++) {
    const label = `${n}${COLUMN_LETTERS[leftCols + c]}`;
    seats.push({ id: label, label, side: 'right', type: typeMap[String(n)] || 'normal', position: { row: rowNum, col: leftCols + 1 + c + 1 } });
    n++;
  }
  return seats;
}

export function buildLayoutV2(config: {
  rows: number;
  left_columns: number;
  right_columns: number;
  back_row: boolean;
  back_row_seats: number;
}): RowV2[] {
  const rows: RowV2[] = [];
  let n = 1;
  const L = config.left_columns;
  const R = config.right_columns;

  for (let r = 1; r <= config.rows; r++) {
    const seats: SeatV2[] = [];
    for (let c = 0; c < L; c++) {
      const label = `${n}${COLUMN_LETTERS[c]}`;
      seats.push({ id: label, label, side: 'left', type: 'normal', position: { row: r, col: c + 1 } });
      n++;
    }
    for (let c = 0; c < R; c++) {
      const label = `${n}${COLUMN_LETTERS[L + c]}`;
      seats.push({ id: label, label, side: 'right', type: 'normal', position: { row: r, col: L + 1 + c + 1 } });
      n++;
    }
    rows.push({ row: r, seats });
  }

  if (config.back_row && config.back_row_seats > 0) {
    const backSeats: SeatV2[] = [];
    for (let i = 0; i < config.back_row_seats; i++) {
      const label = `${n}${COLUMN_LETTERS[i] || String(i + 1)}`;
      backSeats.push({ id: label, label, side: 'back', type: 'normal', position: { row: config.rows + 1, col: i + 1 } });
      n++;
    }
    rows.push({ row: config.rows + 1, seats: backSeats });
  }

  return rows;
}

export default function BusSeatMap({
  scheduleId,
  maxSeats,
  onSelectionChange,
  selectedSeats = [],
  readOnly = false,
}: BusSeatMapProps) {
  const [config, setConfig] = useState<BusSeatConfig | null>(null);
  const [lowerConfig, setLowerConfig] = useState<BusSeatConfig | null>(null);
  const [upperConfig, setUpperConfig] = useState<BusSeatConfig | null>(null);
  const [isImperial, setIsImperial] = useState(false);
  const [activeDeck, setActiveDeck] = useState<'lower' | 'upper'>('lower');
  const [layout, setLayout] = useState<RowV2[]>([]);
  const [reservedLabels, setReservedLabels] = useState<Set<string>>(new Set());
  const [localSelected, setLocalSelected] = useState<string[]>(selectedSeats);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    loadSeatData();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [scheduleId]);

  useEffect(() => {
    setLocalSelected(selectedSeats);
  }, [selectedSeats]);

  useEffect(() => {
    if (!isImperial) return;
    const cfg = activeDeck === 'lower' ? lowerConfig : upperConfig;
    if (cfg) {
      setConfig(cfg);
      setLayout(resolveLayout(cfg));
    }
  }, [activeDeck, isImperial, lowerConfig, upperConfig]);

  const loadSeatData = async () => {
    try {
      setLoading(true);

      const { data: schedule, error: schedErr } = await supabase
        .from('schedules')
        .select(`
          id,
          bus_id,
          buses:bus_id (
            bus_deck_type,
            seat_config_id,
            lower_deck_config_id,
            upper_deck_config_id,
            bus_seat_config!buses_seat_config_id_fkey (
              id, name, rows, left_columns, right_columns,
              back_row, back_row_seats, total_capacity, seat_layout, seat_layout_v2
            )
          )
        `)
        .eq('id', scheduleId)
        .maybeSingle();

      if (schedErr) throw schedErr;

      const bus = (schedule as any)?.buses;
      const deckType = bus?.bus_deck_type;

      if (deckType === 'imperial') {
        setIsImperial(true);
        const lowerConfigId = bus?.lower_deck_config_id;
        const upperConfigId = bus?.upper_deck_config_id;

        const configFields = 'id, name, rows, left_columns, right_columns, back_row, back_row_seats, total_capacity, seat_layout, seat_layout_v2';

        const [lowerRes, upperRes] = await Promise.all([
          lowerConfigId
            ? supabase.from('bus_seat_config').select(configFields).eq('id', lowerConfigId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          upperConfigId
            ? supabase.from('bus_seat_config').select(configFields).eq('id', upperConfigId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        setLowerConfig(lowerRes.data as BusSeatConfig | null);
        setUpperConfig(upperRes.data as BusSeatConfig | null);

        const initialConfig = lowerRes.data ?? upperRes.data;
        if (initialConfig) {
          setConfig(initialConfig as BusSeatConfig);
          setLayout(resolveLayout(initialConfig as BusSeatConfig));
        }
      } else {
        setIsImperial(false);
        const busConfig = bus?.bus_seat_config;
        if (!busConfig) {
          setConfig(null);
          setLoading(false);
          return;
        }
        setConfig(busConfig);
        setLayout(resolveLayout(busConfig));
      }

      await loadReservations();
      subscribeRealtime();
    } catch (err: any) {
      console.error(err);
      toast.error('Erreur chargement plan des sièges');
    } finally {
      setLoading(false);
    }
  };

  const loadReservations = async () => {
    const { data: reservations } = await supabase
      .from('reservations')
      .select('seat_numbers')
      .eq('schedule_id', scheduleId)
      .in('status', ['confirmee', 'embarquee', 'terminee']);

    const reserved = new Set<string>();
    (reservations || []).forEach((r: any) => {
      (r.seat_numbers || []).forEach((s: string) => reserved.add(s));
    });
    setReservedLabels(reserved);
  };

  const subscribeRealtime = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    const channel = supabase
      .channel(`seat-map-${scheduleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations', filter: `schedule_id=eq.${scheduleId}` },
        () => { loadReservations(); }
      )
      .subscribe();
    channelRef.current = channel;
  };

  const resolveLayout = (cfg: BusSeatConfig): RowV2[] => {
    if (cfg.seat_layout_v2 && cfg.seat_layout_v2.length > 0) {
      return cfg.seat_layout_v2;
    }
    return buildLayoutV2({
      rows: cfg.rows,
      left_columns: cfg.left_columns,
      right_columns: cfg.right_columns,
      back_row: cfg.back_row,
      back_row_seats: cfg.back_row_seats,
    });
  };

  const getSeatStatus = (seat: SeatV2): SeatStatus => {
    if (seat.type === 'hors_service') return 'hors_service';
    if (reservedLabels.has(seat.label)) return 'reserved';
    if (localSelected.includes(seat.label)) return 'selected';
    if (seat.type === 'vip') return 'vip';
    if (seat.type === 'handicape') return 'handicape';
    return 'available';
  };

  const handleSeatClick = (seat: SeatV2) => {
    if (readOnly) return;
    const status = getSeatStatus(seat);
    if (status === 'hors_service' || status === 'reserved') return;

    let next: string[];
    if (status === 'selected') {
      next = localSelected.filter(s => s !== seat.label);
    } else {
      if (localSelected.length >= maxSeats) {
        toast.error(`Maximum ${maxSeats} siège${maxSeats > 1 ? 's' : ''} sélectionnable${maxSeats > 1 ? 's' : ''}`);
        return;
      }
      next = [...localSelected, seat.label];
    }

    setLocalSelected(next);
    onSelectionChange(next);
  };

  const getSeatStyle = (status: SeatStatus, type: SeatType): React.CSSProperties => {
    switch (status) {
      case 'selected':
        return { backgroundColor: '#F59E0B', borderColor: '#D97706', color: 'white' };
      case 'reserved':
        return { backgroundColor: '#EF4444', borderColor: '#DC2626', color: 'white', cursor: 'not-allowed' };
      case 'hors_service':
        return { backgroundColor: '#E5E7EB', borderColor: '#D1D5DB', color: '#9CA3AF', cursor: 'not-allowed' };
      case 'vip':
        return { backgroundColor: '#1D4ED8', borderColor: '#1E40AF', color: 'white' };
      case 'handicape':
        return { backgroundColor: '#7C3AED', borderColor: '#6D28D9', color: 'white' };
      default:
        return { backgroundColor: '#DCFCE7', borderColor: '#16A34A', color: '#15803D' };
    }
  };

  const getSeatTooltip = (seat: SeatV2, status: SeatStatus): string => {
    const typeLabels: Record<SeatType, string> = {
      normal: '',
      vip: ' — VIP',
      handicape: ' — PMR',
      hors_service: ' — Hors service',
    };
    if (status === 'reserved') return `Siège ${seat.label} — Occupé`;
    if (status === 'selected') return `Siège ${seat.label} — Sélectionné (cliquer pour désélectionner)`;
    return `Siège ${seat.label}${typeLabels[seat.type]}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-3">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Chargement du plan du bus...</span>
      </div>
    );
  }

  if (!config || layout.length === 0) {
    return (
      <div className="text-center py-8 rounded-xl border border-dashed" style={{ borderColor: 'var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Plan de sièges non disponible pour ce bus</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>La sélection sera assignée automatiquement</p>
      </div>
    );
  }

  const allSeats = layout.flatMap(r => r.seats);
  const availableCount = allSeats.filter(s => s.type !== 'hors_service' && !reservedLabels.has(s.label)).length;
  const reservedCount = allSeats.filter(s => reservedLabels.has(s.label)).length;
  const leftCols = config.left_columns;
  const rightCols = config.right_columns;
  const totalCols = leftCols + rightCols + 1;

  return (
    <div className="space-y-4">
      {isImperial && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveDeck('lower')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border-2 transition-colors ${
              activeDeck === 'lower'
                ? 'bg-[#0B7439] border-[#0B7439] text-white'
                : 'bg-white border-[#E2EAE5] text-[#4A6B55] hover:border-[#0B7439]'
            }`}
          >
            Niveau inférieur
            {lowerConfig ? ` (${lowerConfig.total_capacity} places)` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveDeck('upper')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border-2 transition-colors ${
              activeDeck === 'upper'
                ? 'bg-[#0B7439] border-[#0B7439] text-white'
                : 'bg-white border-[#E2EAE5] text-[#4A6B55] hover:border-[#0B7439]'
            }`}
          >
            Niveau supérieur
            {upperConfig ? ` (${upperConfig.total_capacity} places)` : ''}
          </button>
        </div>
      )}

      <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
        <div className="px-4 py-2.5 flex items-center justify-between text-xs"
          style={{ backgroundColor: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {config.name} — {config.total_capacity} places
          </span>
          <div className="flex items-center gap-3">
            <span style={{ color: '#16A34A' }}>
              <span className="font-bold">{availableCount}</span> libres
            </span>
            <span style={{ color: '#EF4444' }}>
              <span className="font-bold">{reservedCount}</span> occupées
            </span>
          </div>
        </div>

        <div className="p-4 overflow-x-auto">
          <div className="inline-block min-w-full">
            <div
              className="text-white text-xs font-bold text-center py-2 rounded-lg mb-5"
              style={{ backgroundColor: '#1F2937', minWidth: totalCols * 52 + 28 }}
            >
              AVANT DU BUS / CONDUCTEUR
            </div>

            <div className="flex flex-col gap-2.5" style={{ alignItems: 'center' }}>
              {layout.map((row) => {
                const isBackRow = row.row > config.rows;
                const leftSeats = isBackRow ? [] : row.seats.filter(s => s.side === 'left');
                const rightSeats = isBackRow ? [] : row.seats.filter(s => s.side === 'right');
                const backSeats = isBackRow ? row.seats : [];

                return (
                  <div key={row.row} className="flex items-center gap-1.5">
                    <div className="w-6 text-right text-xs font-semibold flex-shrink-0"
                      style={{ color: 'var(--text-muted)' }}>
                      {isBackRow ? '▼' : row.row}
                    </div>

                    {isBackRow ? (
                      <div className="flex gap-1.5">
                        {backSeats.map(seat => (
                          <SeatButton key={seat.id} seat={seat} status={getSeatStatus(seat)}
                            style={getSeatStyle(getSeatStatus(seat), seat.type)}
                            tooltip={getSeatTooltip(seat, getSeatStatus(seat))}
                            onClick={() => handleSeatClick(seat)} />
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-1.5">
                          {leftSeats.map(seat => (
                            <SeatButton key={seat.id} seat={seat} status={getSeatStatus(seat)}
                              style={getSeatStyle(getSeatStatus(seat), seat.type)}
                              tooltip={getSeatTooltip(seat, getSeatStatus(seat))}
                              onClick={() => handleSeatClick(seat)} />
                          ))}
                        </div>
                        <div className="w-5 flex-shrink-0" />
                        <div className="flex gap-1.5">
                          {rightSeats.map(seat => (
                            <SeatButton key={seat.id} seat={seat} status={getSeatStatus(seat)}
                              style={getSeatStyle(getSeatStatus(seat), seat.type)}
                              tooltip={getSeatTooltip(seat, getSeatStatus(seat))}
                              onClick={() => handleSeatClick(seat)} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              className="text-white text-xs font-bold text-center py-2 rounded-lg mt-5"
              style={{ backgroundColor: '#374151', minWidth: totalCols * 52 + 28 }}
            >
              ARRIÈRE DU BUS
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-raised)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>LÉGENDE</p>
        <div className="flex flex-wrap gap-4">
          {[
            { bg: '#DCFCE7', border: '#16A34A', color: '#15803D', label: 'Disponible' },
            { bg: '#EF4444', border: '#DC2626', color: 'white', label: 'Occupé' },
            { bg: '#F59E0B', border: '#D97706', color: 'white', label: 'Sélectionné' },
            { bg: '#1D4ED8', border: '#1E40AF', color: 'white', label: 'VIP' },
            { bg: '#7C3AED', border: '#6D28D9', color: 'white', label: 'PMR' },
            { bg: '#E5E7EB', border: '#D1D5DB', color: '#9CA3AF', label: 'Hors service' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="rounded border-2 flex items-center justify-center"
                style={{ width: 24, height: 24, backgroundColor: item.bg, borderColor: item.border }}>
                <SeatIconSmall color={item.color} />
              </div>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {!readOnly && localSelected.length > 0 && (
        <div className="rounded-xl border-2 p-4 flex items-center justify-between gap-4"
          style={{ borderColor: '#F59E0B', backgroundColor: '#FFFBEB' }}>
          <div>
            <p className="text-sm font-bold" style={{ color: '#92400E' }}>
              {localSelected.length} siège{localSelected.length > 1 ? 's' : ''} sélectionné{localSelected.length > 1 ? 's' : ''}
              {maxSeats > 1 && <span className="font-normal"> / {maxSeats}</span>}
            </p>
            <p className="text-xs mt-0.5 font-mono font-semibold" style={{ color: '#B45309' }}>
              {localSelected.join(', ')}
            </p>
          </div>
          {localSelected.length < maxSeats && (
            <p className="text-xs" style={{ color: '#92400E' }}>
              Encore {maxSeats - localSelected.length} siège{maxSeats - localSelected.length > 1 ? 's' : ''} à choisir
            </p>
          )}
          {localSelected.length === maxSeats && (
            <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: '#D97706', color: 'white' }}>
              Complet
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface SeatButtonProps {
  seat: SeatV2;
  status: SeatStatus;
  style: React.CSSProperties;
  tooltip: string;
  onClick: () => void;
}

function SeatButton({ seat, status, style, tooltip, onClick }: SeatButtonProps) {
  const isClickable = status !== 'hors_service' && status !== 'reserved';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      title={tooltip}
      className="rounded-lg border-2 flex flex-col items-center justify-center transition-all select-none"
      style={{
        width: 46,
        height: 46,
        fontSize: 10,
        fontWeight: 700,
        flexShrink: 0,
        transform: status === 'selected' ? 'scale(1.1)' : undefined,
        boxShadow: status === 'selected' ? '0 0 0 3px rgba(245,158,11,0.35)' : undefined,
        cursor: isClickable ? 'pointer' : 'not-allowed',
        ...style,
      }}
    >
      <SeatIcon status={status} />
      <span style={{ marginTop: 1, lineHeight: 1 }}>{seat.label}</span>
    </button>
  );
}

function SeatIcon({ status }: { status: SeatStatus }) {
  const color = status === 'selected' || status === 'reserved' || status === 'vip' || status === 'handicape'
    ? 'white'
    : status === 'hors_service'
    ? '#9CA3AF'
    : '#15803D';
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <rect x="4" y="3" width="16" height="11" rx="3" fill={color} opacity="0.9" />
      <rect x="2" y="14" width="20" height="4" rx="2" fill={color} opacity="0.7" />
      <rect x="4" y="18" width="3" height="3" rx="1" fill={color} opacity="0.6" />
      <rect x="17" y="18" width="3" height="3" rx="1" fill={color} opacity="0.6" />
    </svg>
  );
}

function SeatIconSmall({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="11" rx="3" fill={color} opacity="0.9" />
      <rect x="2" y="14" width="20" height="4" rx="2" fill={color} opacity="0.7" />
      <rect x="4" y="18" width="3" height="3" rx="1" fill={color} opacity="0.6" />
      <rect x="17" y="18" width="3" height="3" rx="1" fill={color} opacity="0.6" />
    </svg>
  );
}
