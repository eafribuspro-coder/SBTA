export const SBTA = {
  green: '#008F39',
  greenDark: '#00772F',
  greenLight: '#E6F4EC',
  red: '#D61F26',
  redDark: '#B5171D',
  white: '#FFFFFF',
  ink: '#0F1B14',
  gray900: '#1A2420',
  gray600: '#5B6B63',
  gray400: '#9AA8A1',
  gray200: '#E4EAE7',
  gray100: '#F2F6F4',
  bg: '#F6F9F7',
};

export const SLOGAN = "L'aventure continue";

export type TimeSlot = {
  id: string;
  label: string;
  startHour: number;
  endHour: number;
};

export const TIME_SLOTS: TimeSlot[] = [
  { id: '05-07', label: '05h - 07h', startHour: 5, endHour: 7 },
  { id: '08-10', label: '08h - 10h', startHour: 8, endHour: 10 },
  { id: '11-13', label: '11h - 13h', startHour: 11, endHour: 13 },
  { id: '14-16', label: '14h - 16h', startHour: 14, endHour: 16 },
  { id: '17-19', label: '17h - 19h', startHour: 17, endHour: 19 },
  { id: '20-22', label: '20h - 22h', startHour: 20, endHour: 22 },
];

export const PAYMENT_METHODS = [
  { id: 'orange', label: 'Orange Money', color: '#FF7900' },
  { id: 'mtn', label: 'MTN Money', color: '#FFCC00' },
  { id: 'moov', label: 'Moov Money', color: '#0066CC' },
  { id: 'wave', label: 'Wave', color: '#1DC4FF' },
  { id: 'card', label: 'Carte bancaire', color: '#1A2420' },
];

export function formatXOF(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA';
}

export function minutesToDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor((total % (24 * 60)) / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}
