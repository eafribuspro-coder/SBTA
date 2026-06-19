import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import {
  ArrowLeft, MapPin, ChevronRight, Bus, Clock, User, Mail,
  Phone, CreditCard, CheckCircle, Download, Banknote, Smartphone,
  RefreshCw, Shield, Wifi, AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency } from '../../utils/formatCurrency';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import { useSeatMap } from '../../hooks/useSeatMap';
import { SeatMap } from '../../components/bus/SeatMap';
import { SeatSelectionSummary } from '../../components/bus/SeatSelectionSummary';
import { isSeatStillAvailable } from '../../services/seatMap.service';

interface Schedule {
  id: string;
  departure_datetime: string;
  arrival_datetime: string;
  seats_available: number;
  price: number;
  buses: {
    id: string;
    registration_number: string;
    class: string;
    seat_config_id: string | null;
  };
  routes: {
    id: string;
    base_price: number;
    vip_price: number | null;
    name: string;
    origin_city_id: string;
    destination_city_id: string;
  };
  origin_city_name: string;
  destination_city_name: string;
}

type Step = 'seat' | 'passenger' | 'payment' | 'confirm';

const STEPS: { id: Step; label: string }[] = [
  { id: 'seat', label: 'Siège' },
  { id: 'passenger', label: 'Passager' },
  { id: 'payment', label: 'Paiement' },
  { id: 'confirm', label: 'Confirmation' },
];

const PAYMENT_METHODS = [
  { value: 'especes', label: 'Espèces', icon: Banknote },
  { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
  { value: 'carte', label: 'Carte bancaire', icon: CreditCard },
  { value: 'virement', label: 'Virement', icon: RefreshCw },
];

export default function Booking() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [step, setStep] = useState<Step>('seat');
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  const [bookingReference, setBookingReference] = useState('');
  const [confirmedSeats, setConfirmedSeats] = useState<string[]>([]);
  const [confirmedPrice, setConfirmedPrice] = useState(0);

  const [passengerInfo, setPassengerInfo] = useState({
    full_name: '',
    phone: '',
    email: '',
    id_number: '',
  });

  const [paymentInfo, setPaymentInfo] = useState({
    method: '',
    mobile_provider: '',
    mobile_number: '',
    transaction_ref: '',
    amount_received: 0,
  });

  const [processingPayment, setProcessingPayment] = useState(false);

  const {
    seatMap,
    isLoading: seatMapLoading,
    error: seatMapError,
    selectedSeats,
    toggleSeat,
    clearSelection,
    totalSelectedPrice,
    refresh: refreshSeatMap,
  } = useSeatMap({ scheduleId: scheduleId ?? null, enableRealtime: true });

  useEffect(() => {
    loadSchedule();
  }, [scheduleId]);

  const loadSchedule = async () => {
    try {
      setLoadingSchedule(true);
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          id,
          seats_available,
          price,
          departure_datetime,
          arrival_datetime,
          route_id,
          buses:bus_id (
            id,
            registration_number,
            class,
            seat_config_id
          ),
          routes:route_id (
            id,
            base_price,
            vip_price,
            name,
            origin_city_id,
            destination_city_id
          )
        `)
        .eq('id', scheduleId)
        .single();

      if (error) throw error;

      const s = data as any;
      const route = s.routes;
      const { data: cities } = await supabase
        .from('cities')
        .select('id, name')
        .in('id', [route.origin_city_id, route.destination_city_id]);

      const cityMap = Object.fromEntries((cities ?? []).map((c: any) => [c.id, c.name]));

      setSchedule({
        ...s,
        origin_city_name: cityMap[route.origin_city_id] ?? '',
        destination_city_name: cityMap[route.destination_city_id] ?? '',
        price: s.price ?? route.base_price,
      });
    } catch {
      toast.error('Voyage non trouvé');
      navigate(-1);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleSeatStepNext = () => {
    if (selectedSeats.length === 0) {
      toast.error('Sélectionnez au moins un siège');
      return;
    }
    setStep('passenger');
  };

  const handlePassengerSubmit = () => {
    if (!passengerInfo.full_name.trim()) { toast.error('Le nom complet est requis'); return; }
    if (!passengerInfo.phone.trim()) { toast.error('Le téléphone est requis'); return; }
    setStep('payment');
  };

  const effectivePrice = totalSelectedPrice > 0 ? totalSelectedPrice : selectedSeats.length * (schedule?.price ?? 0);
  const changeAmount = paymentInfo.method === 'especes'
    ? Math.max(0, paymentInfo.amount_received - effectivePrice)
    : 0;

  const handlePayment = async () => {
    if (!paymentInfo.method) { toast.error('Sélectionnez un mode de paiement'); return; }
    if (paymentInfo.method === 'especes' && paymentInfo.amount_received < effectivePrice) {
      toast.error('Le montant reçu est insuffisant'); return;
    }
    if (!schedule) return;

    setProcessingPayment(true);
    try {
      const availChecks = await Promise.all(
        selectedSeats.map(s => isSeatStillAvailable(schedule.id, s.id))
      );
      const conflictIndex = availChecks.findIndex(ok => !ok);
      if (conflictIndex !== -1) {
        const taken = selectedSeats[conflictIndex];
        toast.error(`Le siège ${taken.label} vient d'être réservé. Veuillez en choisir un autre.`);
        await refreshSeatMap();
        setStep('seat');
        return;
      }

      const reference = `SBTA-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
      const seatLabels = selectedSeats.map(s => s.label);

      const { error: resError } = await supabase
        .from('reservations')
        .insert({
          schedule_id: schedule.id,
          customer_id: user?.id ?? null,
          seat_numbers: selectedSeats.map(s => s.id),
          total_seats: selectedSeats.length,
          total_price: effectivePrice,
          passenger_name: passengerInfo.full_name,
          passenger_phone: passengerInfo.phone,
          status: 'confirmee',
          payment_status: paymentInfo.method === 'especes' || paymentInfo.method === 'carte' ? 'payee' : 'en_attente',
          booking_reference: reference,
          qr_code: reference,
          booked_by: user?.id ?? null,
        });

      if (resError) throw resError;

      await supabase
        .from('schedules')
        .update({
          seats_available: Math.max(0, (schedule.seats_available ?? 0) - selectedSeats.length),
          seats_reserved: selectedSeats.length,
        })
        .eq('id', schedule.id);

      setBookingReference(reference);
      setConfirmedSeats(seatLabels);
      setConfirmedPrice(effectivePrice);
      setStep('confirm');
      toast.success('Réservation confirmée !');
    } catch (err: any) {
      toast.error(err?.message ?? 'Erreur lors de la confirmation');
    } finally {
      setProcessingPayment(false);
    }
  };

  const generatePDF = async () => {
    if (!schedule) return;
    const doc = new jsPDF({ unit: 'mm', format: [80, 200] });

    // ── HEADER ──────────────────────────────────────────────
    // Logo image left side
    try {
      const resp = await fetch('/logo_sbta02.JPG');
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      doc.addImage(dataUrl, 'JPEG', 3, 3, 18, 16);
    } catch {
      // Fallback if image fails
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      doc.text('S.B.T.A', 12, 9, { align: 'center' });
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.5);
      doc.text("L'Aventure continue", 12, 13, { align: 'center' });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text('SBTA', 76, 11, { align: 'right' });
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Societe Bonkoungou Transport de L\'Agneby', 76, 15, { align: 'right' });
    doc.text('Tel 01 14 34 60 / 01 14 34 87', 76, 18.5, { align: 'right' });

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(4, 21, 76, 21);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Référence', 5, 30);
    doc.setTextColor(11, 116, 57);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(bookingReference, 5, 36);
    doc.line(5, 39, 75, 39);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('ITINÉRAIRE', 5, 45);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${schedule.origin_city_name} → ${schedule.destination_city_name}`, 5, 51);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(format(new Date(schedule.departure_datetime), 'dd/MM/yyyy à HH:mm'), 5, 57);
    doc.line(5, 60, 75, 60);

    doc.setFontSize(7);
    doc.text('Passager', 5, 66);
    doc.text('Siège(s)', 45, 66);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(passengerInfo.full_name, 5, 72);
    doc.text(confirmedSeats.join(', '), 45, 72);
    doc.line(5, 76, 75, 76);

    doc.setTextColor(11, 116, 57);
    doc.setFontSize(13);
    doc.text(formatCurrency(confirmedPrice), 5, 85);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Présentez ce billet et votre pièce d\'identité à l\'embarquement', 40, 110, { align: 'center' });

    doc.save(`billet-${bookingReference}.pdf`);
    toast.success('Billet téléchargé');
  };

  if (loadingSchedule || !schedule) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-10 h-10 border-4 rounded-full animate-spin"
          style={{ borderColor: '#0B7439', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const dep = new Date(schedule.departure_datetime);
  const arr = new Date(schedule.arrival_datetime);
  const durationMs = arr.getTime() - dep.getTime();
  const durationH = Math.floor(durationMs / 3600000);
  const durationM = Math.floor((durationMs % 3600000) / 60000);
  const durationLabel = durationH > 0 ? `${durationH}h${durationM > 0 ? durationM + 'min' : ''}` : `${durationM}min`;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Réservation de billet</h1>
          <p className="text-xs text-slate-500">
            {schedule.origin_city_name} → {schedule.destination_city_name}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-4">
          <div className="text-center flex-shrink-0">
            <p className="text-2xl font-black text-slate-900">{format(dep, 'HH:mm')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{format(dep, 'dd MMM', { locale: fr })}</p>
            <p className="text-xs font-semibold text-[#0B7439]">{schedule.origin_city_name}</p>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-center gap-2">
              <div className="flex-1 h-px bg-slate-200" />
              <div className="flex flex-col items-center">
                <Bus className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] text-slate-400">{durationLabel}</span>
              </div>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <p className="text-[10px] text-slate-400">{schedule.routes.name}</p>
          </div>
          <div className="text-center flex-shrink-0">
            <p className="text-2xl font-black text-slate-900">{format(arr, 'HH:mm')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{format(arr, 'dd MMM', { locale: fr })}</p>
            <p className="text-xs font-semibold text-[#0B7439]">{schedule.destination_city_name}</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-sm text-slate-500">À partir de</p>
            <p className="text-xl font-black text-[#0B7439]">{formatCurrency(schedule.price)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                i < stepIndex ? 'bg-[#0B7439] text-white' :
                i === stepIndex ? 'bg-[#0B7439] text-white ring-4 ring-[#0B7439]/20' :
                'bg-slate-100 text-slate-400',
              ].join(' ')}>
                {i < stepIndex ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-[10px] font-semibold ${i <= stepIndex ? 'text-[#0B7439]' : 'text-slate-400'}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 mb-4 transition-colors ${i < stepIndex ? 'bg-[#0B7439]' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {step === 'seat' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-800 text-lg">Choisissez votre siège</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {seatMap ? `${seatMap.available_count} sièges disponibles sur ${seatMap.total_seats}` : 'Chargement...'}
              </p>
            </div>
          </div>

          {seatMapLoading && (
            <div className="flex flex-col items-center py-16 gap-3 bg-white rounded-2xl border border-slate-200">
              <div className="w-8 h-8 rounded-full animate-spin"
                style={{ borderColor: '#0B7439', borderTopColor: 'transparent', borderWidth: 3 }} />
              <p className="text-sm text-slate-500">Chargement du plan de sièges...</p>
            </div>
          )}

          {!seatMapLoading && seatMapError && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Plan de sièges non disponible</p>
                  <p className="text-xs text-amber-700 mt-1">{seatMapError}</p>
                </div>
              </div>
            </div>
          )}

          {!seatMapLoading && seatMap && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl">
                <span className="w-2 h-2 rounded-full bg-[#0B7439] animate-pulse inline-block" />
                <Wifi className="w-3.5 h-3.5 text-[#0B7439]" />
                <p className="text-xs text-[#166534] font-medium">
                  <span className="font-bold">{seatMap.available_count} sièges disponibles</span>
                  {' · '}Disponibilité mise à jour en temps réel
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                <div className="lg:col-span-3">
                  <SeatMap
                    seatMap={seatMap}
                    selectedSeats={selectedSeats}
                    onSeatToggle={toggleSeat}
                    showPassengerNames={false}
                    maxSelectableSeats={schedule.seats_available}
                  />
                </div>
                <div className="lg:col-span-2">
                  <SeatSelectionSummary
                    selectedSeats={selectedSeats}
                    totalPrice={effectivePrice}
                    pricePerSeat={schedule.price}
                    tripLabel={`${schedule.origin_city_name} → ${schedule.destination_city_name}`}
                    onRemoveSeat={(id) => {
                      const seat = selectedSeats.find(s => s.id === id);
                      if (seat) toggleSeat(seat);
                    }}
                    onConfirm={handleSeatStepNext}
                    onClear={clearSelection}
                  />
                </div>
              </div>
            </>
          )}

          {!seatMapLoading && !seatMap && !seatMapError && (
            <div className="flex flex-col items-center py-16 gap-3 bg-white rounded-2xl border border-slate-200">
              <AlertCircle className="w-8 h-8 text-slate-400" />
              <p className="text-sm text-slate-500">Aucune donnée disponible</p>
            </div>
          )}
        </div>
      )}

      {step === 'passenger' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Informations passager</h2>
              <div className="flex items-center gap-2 text-xs text-[#0B7439] bg-[#F0FDF4] px-2.5 py-1 rounded-full">
                <span className="font-bold">{selectedSeats.length > 1 ? `${selectedSeats.length} sièges` : `Siège ${selectedSeats[0]?.label}`}</span>
                <span className="text-slate-500">·</span>
                <span className="font-bold">{formatCurrency(effectivePrice)}</span>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <User className="w-3.5 h-3.5 inline mr-1" />
                  Nom complet *
                </label>
                <input
                  type="text"
                  value={passengerInfo.full_name}
                  onChange={e => setPassengerInfo({ ...passengerInfo, full_name: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20 focus:border-[#0B7439]"
                  placeholder="Ex: KOUASSI Jean"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <Phone className="w-3.5 h-3.5 inline mr-1" />
                  Téléphone *
                </label>
                <input
                  type="tel"
                  value={passengerInfo.phone}
                  onChange={e => setPassengerInfo({ ...passengerInfo, phone: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20 focus:border-[#0B7439]"
                  placeholder="+225 07 XX XX XX XX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <Shield className="w-3.5 h-3.5 inline mr-1" />
                  N° CNI / Passeport
                </label>
                <input
                  type="text"
                  value={passengerInfo.id_number}
                  onChange={e => setPassengerInfo({ ...passengerInfo, id_number: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20 focus:border-[#0B7439]"
                  placeholder="CI123456789"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <Mail className="w-3.5 h-3.5 inline mr-1" />
                  Email (optionnel)
                </label>
                <input
                  type="email"
                  value={passengerInfo.email}
                  onChange={e => setPassengerInfo({ ...passengerInfo, email: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20 focus:border-[#0B7439]"
                  placeholder="exemple@email.com"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={() => setStep('seat')}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour
              </button>
              <button
                onClick={handlePassengerSubmit}
                className="px-6 py-2.5 rounded-xl font-bold text-white text-sm bg-[#0B7439] hover:bg-[#085c2d] transition-colors"
              >
                Continuer vers le paiement
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'payment' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
            <h2 className="font-bold text-slate-800">Paiement</h2>
          </div>

          <div className="p-5 space-y-5">
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Récapitulatif</p>
              <div className="flex justify-between">
                <span className="text-slate-600">Passager</span>
                <span className="font-semibold text-slate-800">{passengerInfo.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Trajet</span>
                <span className="font-semibold text-slate-800">
                  {schedule.origin_city_name} → {schedule.destination_city_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Départ</span>
                <span className="font-semibold text-slate-800">
                  {format(dep, 'dd MMM yyyy à HH:mm', { locale: fr })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">
                  {selectedSeats.length > 1 ? `Sièges (${selectedSeats.length})` : 'Siège'}
                </span>
                <span className="font-bold font-mono text-[#0B7439]">
                  {selectedSeats.map(s => s.label).join(', ')}
                </span>
              </div>
              <div className="h-px bg-slate-200 my-1" />
              <div className="flex justify-between">
                <span className="font-bold text-slate-800">Total</span>
                <span className="text-xl font-black text-[#0B7439]">{formatCurrency(effectivePrice)}</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Mode de paiement</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => {
                  const Icon = m.icon;
                  const isActive = paymentInfo.method === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setPaymentInfo({ ...paymentInfo, method: m.value })}
                      className={[
                        'p-3 rounded-xl border-2 transition-all flex items-center gap-2.5 text-sm font-semibold',
                        isActive
                          ? 'border-[#0B7439] bg-[#F0FDF4] text-[#0B7439]'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300',
                      ].join(' ')}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {paymentInfo.method === 'especes' && (
              <div className="space-y-3 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Montant reçu (FCFA) *</label>
                  <input
                    type="number"
                    value={paymentInfo.amount_received || ''}
                    onChange={e => setPaymentInfo({ ...paymentInfo, amount_received: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20 focus:border-[#0B7439]"
                    placeholder="0"
                    autoFocus
                  />
                </div>
                {paymentInfo.amount_received > 0 && (
                  <div className={`flex justify-between items-center p-3 rounded-xl ${changeAmount >= 0 ? 'bg-[#F0FDF4]' : 'bg-red-50'}`}>
                    <span className="text-sm font-semibold text-slate-700">Monnaie à rendre</span>
                    <span className={`text-xl font-black ${changeAmount >= 0 ? 'text-[#0B7439]' : 'text-red-500'}`}>
                      {formatCurrency(changeAmount)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {paymentInfo.method === 'mobile_money' && (
              <div className="space-y-3 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Opérateur *</label>
                  <select
                    value={paymentInfo.mobile_provider}
                    onChange={e => setPaymentInfo({ ...paymentInfo, mobile_provider: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="orange_money">Orange Money</option>
                    <option value="mtn_momo">MTN MoMo</option>
                    <option value="wave">Wave</option>
                    <option value="moov">Moov Money</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Référence transaction</label>
                  <input
                    type="text"
                    value={paymentInfo.transaction_ref}
                    onChange={e => setPaymentInfo({ ...paymentInfo, transaction_ref: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
                    placeholder="MP240115XXXX"
                  />
                </div>
              </div>
            )}

            {(paymentInfo.method === 'carte' || paymentInfo.method === 'virement') && (
              <div className="space-y-3 p-4 rounded-xl border border-slate-200">
                {paymentInfo.method === 'virement' && (
                  <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                    La réservation sera en attente jusqu'à validation du virement.
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Référence</label>
                  <input
                    type="text"
                    value={paymentInfo.transaction_ref}
                    onChange={e => setPaymentInfo({ ...paymentInfo, transaction_ref: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
                    placeholder={paymentInfo.method === 'carte' ? 'CP240115XXXX' : 'VIR240115XXXX'}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={() => setStep('passenger')}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour
              </button>
              <button
                onClick={handlePayment}
                disabled={processingPayment || !paymentInfo.method || (paymentInfo.method === 'especes' && paymentInfo.amount_received < effectivePrice)}
                className="px-6 py-2.5 rounded-xl font-bold text-white text-sm bg-[#0B7439] hover:bg-[#085c2d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {processingPayment ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Vérification et confirmation...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirmer — {formatCurrency(effectivePrice)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 bg-[#0B7439] flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Réservation confirmée !</h2>
                <p className="text-white/80 text-sm">Votre billet a été enregistré avec succès</p>
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Référence</p>
                  <p className="text-2xl font-black font-mono text-[#0B7439]">{bookingReference}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Passager</p>
                    <p className="font-bold text-sm text-slate-800">{passengerInfo.full_name}</p>
                    <p className="text-xs text-slate-500">{passengerInfo.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">
                      {confirmedSeats.length > 1 ? 'Sièges' : 'Siège'}
                    </p>
                    <p className="font-bold text-base text-[#0B7439] font-mono">{confirmedSeats.join(', ')}</p>
                    <p className="text-xs text-slate-500">{confirmedSeats.length} place{confirmedSeats.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Trajet</p>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0B7439]" />
                    <span className="font-semibold text-sm">{schedule.origin_city_name}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-sm">{schedule.destination_city_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-600">{format(dep, 'dd MMMM yyyy à HH:mm', { locale: fr })}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Montant payé</p>
                  <p className="text-xl font-black text-[#0B7439]">{formatCurrency(confirmedPrice)}</p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <QRCodeSVG
                    value={bookingReference}
                    size={160}
                    level="H"
                    includeMargin
                  />
                </div>
                <p className="text-xs text-center text-slate-500">
                  Scanner à l'embarquement
                </p>
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={generatePDF}
                className="flex-1 py-3 rounded-xl font-bold border-2 border-[#0B7439] text-[#0B7439] flex items-center justify-center gap-2 hover:bg-[#F0FDF4] transition-colors"
              >
                <Download className="w-4 h-4" />
                Télécharger le billet
              </button>
              <button
                onClick={() => navigate('/client/reservations')}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-[#0B7439] hover:bg-[#085c2d] flex items-center justify-center gap-2 transition-colors"
              >
                Mes réservations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
