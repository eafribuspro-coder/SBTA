import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Fuel, Camera, Upload, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency } from '../../utils/formatCurrency';
import { useAuthStore } from '../../store/authStore';

interface FuelVoucher {
  id: string;
  voucher_number: string;
  status: string;
  estimated_liters: number;
  estimated_amount: number;
  estimated_unit_price: number;
  fuel_price_per_liter: number;
  departure_mileage: number;
  actual_liters: number | null;
  actual_unit_price: number | null;
  actual_amount: number | null;
  current_mileage: number | null;
  fuel_station: string | null;
  fuel_city: string | null;
  receipt_photo_url: string | null;
  notes: string | null;
  created_at: string;
  submitted_at: string | null;
  schedules: {
    departure_datetime: string;
    route_name: string;
    departure_station: { name: string } | null;
    arrival_station: { name: string } | null;
  } | null;
  buses: {
    registration_number: string;
    brand: string;
    model: string;
    mileage: number | null;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending_refuel: { label: 'En attente de ravitaillement', color: 'var(--warning)', bg: 'var(--warning-light)', icon: <Clock className="w-4 h-4" /> },
  genere: { label: 'Bon généré', color: 'var(--warning)', bg: 'var(--warning-light)', icon: <Clock className="w-4 h-4" /> },
  pending_validation: { label: 'En attente de validation', color: '#3B82F6', bg: '#EFF6FF', icon: <AlertCircle className="w-4 h-4" /> },
  validated: { label: 'Validé', color: 'var(--success)', bg: 'var(--success-light)', icon: <CheckCircle className="w-4 h-4" /> },
  rejected: { label: 'Rejeté', color: 'var(--danger)', bg: 'var(--danger-light)', icon: <XCircle className="w-4 h-4" /> },
};

export default function FuelVouchers() {
  const { user } = useAuthStore();
  const [vouchers, setVouchers] = useState<FuelVoucher[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<FuelVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    actual_liters: '',
    actual_unit_price: '',
    fuel_station: '',
    fuel_city: '',
    current_mileage: '',
    notes: ''
  });

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  useEffect(() => {
    loadVouchers();
  }, []);

  const loadVouchers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fuel_vouchers')
        .select(`
          *,
          schedules:schedule_id (
            departure_datetime,
            route_name,
            departure_station:departure_station_id (name),
            arrival_station:arrival_station_id (name)
          ),
          buses:bus_id (
            registration_number,
            brand,
            model,
            mileage
          )
        `)
        .eq('driver_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVouchers((data || []) as FuelVoucher[]);
    } catch (error: any) {
      toast.error('Erreur de chargement des bons de carburant');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 5MB)');
      return;
    }
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setReceiptPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!selectedVoucher) return;
    if (!formData.actual_liters || !formData.actual_unit_price) {
      toast.error('Veuillez remplir la quantité et le prix unitaire');
      return;
    }
    if (!formData.fuel_station || !formData.fuel_city) {
      toast.error('Veuillez indiquer la station-service et la ville');
      return;
    }
    if (!formData.current_mileage) {
      toast.error('Veuillez indiquer le kilométrage actuel');
      return;
    }
    if (!receiptFile && !selectedVoucher.receipt_photo_url) {
      toast.error('La photo du reçu est obligatoire');
      return;
    }

    try {
      setSubmitting(true);
      let receiptUrl = selectedVoucher.receipt_photo_url;

      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const filePath = `fuel-receipts/${selectedVoucher.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, receiptFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
        receiptUrl = urlData.publicUrl;
      }

      const actualLiters = parseFloat(formData.actual_liters);
      const actualUnitPrice = parseFloat(formData.actual_unit_price);
      const actualAmount = actualLiters * actualUnitPrice;
      const currentMileage = parseFloat(formData.current_mileage);

      const { error } = await supabase
        .from('fuel_vouchers')
        .update({
          actual_liters: actualLiters,
          actual_unit_price: actualUnitPrice,
          actual_amount: actualAmount,
          current_mileage: currentMileage,
          fuel_station: formData.fuel_station,
          fuel_city: formData.fuel_city,
          receipt_photo_url: receiptUrl,
          notes: formData.notes || null,
          status: 'pending_validation',
          submitted_at: new Date().toISOString()
        })
        .eq('id', selectedVoucher.id);

      if (error) throw error;

      toast.success('Bon de carburant envoyé à la comptabilité');
      resetForm();
      loadVouchers();
    } catch (error: any) {
      toast.error("Erreur lors de l'envoi");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedVoucher(null);
    setFormData({ actual_liters: '', actual_unit_price: '', fuel_station: '', fuel_city: '', current_mileage: '', notes: '' });
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const isPending = (status: string) => ['pending_refuel', 'genere'].includes(status);

  const actualAmount = formData.actual_liters && formData.actual_unit_price
    ? parseFloat(formData.actual_liters) * parseFloat(formData.actual_unit_price)
    : 0;

  const pendingCount = vouchers.filter(v => isPending(v.status)).length;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Mes bons de carburant
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {vouchers.length} bon{vouchers.length > 1 ? 's' : ''} au total
            {pendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}>
                {pendingCount} en attente
              </span>
            )}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
        </div>
      ) : vouchers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <Fuel className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>Aucun bon de carburant</p>
        </div>
      ) : (
        <div className="space-y-4">
          {vouchers.map(voucher => {
            const cfg = STATUS_CONFIG[voucher.status] || STATUS_CONFIG.genere;
            const isSelected = selectedVoucher?.id === voucher.id;

            return (
              <div key={voucher.id} className="bg-white rounded-xl border overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                           style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                        {cfg.icon}
                      </div>
                      <div>
                        <p className="font-bold text-lg">{voucher.voucher_number}</p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {format(new Date(voucher.created_at), 'd MMM yyyy', { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"
                          style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 rounded-lg"
                       style={{ backgroundColor: 'var(--neutral-50)' }}>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Trajet</p>
                      <p className="text-sm font-semibold">
                        {voucher.schedules?.route_name || 'N/A'}
                      </p>
                      {voucher.schedules?.departure_datetime && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {format(new Date(voucher.schedules.departure_datetime), 'dd/MM/yyyy HH:mm')}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Bus</p>
                      <p className="text-sm font-semibold">{voucher.buses?.registration_number || 'N/A'}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {voucher.buses?.brand} {voucher.buses?.model}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Qté estimée</p>
                      <p className="text-sm font-bold">{voucher.estimated_liters ?? '—'} L</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatCurrency(voucher.estimated_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Km départ</p>
                      <p className="text-sm font-bold">
                        {voucher.departure_mileage ? `${voucher.departure_mileage.toLocaleString()} km` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Submitted details */}
                  {!isPending(voucher.status) && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg border"
                         style={{ backgroundColor: 'var(--success-light)' }}>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--success)' }}>Qté réelle</p>
                        <p className="text-sm font-bold">{voucher.actual_liters} L</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--success)' }}>Prix/L</p>
                        <p className="text-sm font-bold">{formatCurrency(voucher.actual_unit_price || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--success)' }}>Total réel</p>
                        <p className="text-sm font-bold">{formatCurrency(voucher.actual_amount || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--success)' }}>Station</p>
                        <p className="text-sm font-bold">{voucher.fuel_station || '—'}</p>
                        <p className="text-xs" style={{ color: 'var(--success)' }}>{voucher.fuel_city}</p>
                      </div>
                    </div>
                  )}

                  {/* Fill form */}
                  {isPending(voucher.status) && (
                    <div className="border-t pt-4 mt-2">
                      {!isSelected ? (
                        <button
                          onClick={() => {
                            setSelectedVoucher(voucher);
                            setFormData({
                              actual_liters: '',
                              actual_unit_price: String(voucher.estimated_unit_price || voucher.fuel_price_per_liter || ''),
                              fuel_station: '',
                              fuel_city: '',
                              current_mileage: '',
                              notes: ''
                            });
                          }}
                          className="w-full py-3 rounded-lg text-white font-semibold flex items-center justify-center gap-2"
                          style={{ backgroundColor: 'var(--primary)' }}
                        >
                          <Fuel className="w-5 h-5" />
                          Remplir ce bon de carburant
                        </button>
                      ) : (
                        <div className="space-y-5">
                          {/* Estimation recap */}
                          <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
                            <p className="font-semibold mb-2 text-sm" style={{ color: 'var(--primary)' }}>
                              Estimation système
                            </p>
                            <div className="grid grid-cols-3 gap-3 text-sm">
                              <div>
                                <p style={{ color: 'var(--text-secondary)' }}>Qté estimée</p>
                                <p className="font-bold">{voucher.estimated_liters} L</p>
                              </div>
                              <div>
                                <p style={{ color: 'var(--text-secondary)' }}>Prix référence</p>
                                <p className="font-bold">{formatCurrency(voucher.estimated_unit_price || voucher.fuel_price_per_liter)}/L</p>
                              </div>
                              <div>
                                <p style={{ color: 'var(--text-secondary)' }}>Montant estimé</p>
                                <p className="font-bold">{formatCurrency(voucher.estimated_amount)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block mb-1.5 font-medium text-sm">Quantité réelle (L) *</label>
                              <input type="number" step="0.1" value={formData.actual_liters}
                                onChange={e => setFormData({ ...formData, actual_liters: e.target.value })}
                                className="w-full p-3 border rounded-lg" placeholder="Ex: 145.5" />
                            </div>
                            <div>
                              <label className="block mb-1.5 font-medium text-sm">Prix unitaire (FCFA/L) *</label>
                              <input type="number" step="1" value={formData.actual_unit_price}
                                onChange={e => setFormData({ ...formData, actual_unit_price: e.target.value })}
                                className="w-full p-3 border rounded-lg" placeholder="Ex: 695" />
                            </div>
                            <div>
                              <label className="block mb-1.5 font-medium text-sm">Station-service *</label>
                              <input type="text" value={formData.fuel_station}
                                onChange={e => setFormData({ ...formData, fuel_station: e.target.value })}
                                className="w-full p-3 border rounded-lg" placeholder="Ex: Total Energies" />
                            </div>
                            <div>
                              <label className="block mb-1.5 font-medium text-sm">Ville *</label>
                              <input type="text" value={formData.fuel_city}
                                onChange={e => setFormData({ ...formData, fuel_city: e.target.value })}
                                className="w-full p-3 border rounded-lg" placeholder="Ex: Bouaké" />
                            </div>
                            <div>
                              <label className="block mb-1.5 font-medium text-sm">Kilométrage actuel *</label>
                              <input type="number" step="1" value={formData.current_mileage}
                                onChange={e => setFormData({ ...formData, current_mileage: e.target.value })}
                                className="w-full p-3 border rounded-lg" placeholder="Ex: 125430" />
                            </div>
                            <div>
                              <label className="block mb-1.5 font-medium text-sm">Montant total</label>
                              <div className="p-3 rounded-lg font-bold text-xl border"
                                   style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
                                {formatCurrency(actualAmount)}
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block mb-1.5 font-medium text-sm">Notes (optionnel)</label>
                            <textarea value={formData.notes}
                              onChange={e => setFormData({ ...formData, notes: e.target.value })}
                              className="w-full p-3 border rounded-lg" rows={2}
                              placeholder="Observations particulières..." />
                          </div>

                          <div>
                            <label className="block mb-1.5 font-medium text-sm">Photo du reçu *</label>
                            <div className="border-2 border-dashed rounded-xl p-6">
                              {receiptPreview ? (
                                <div className="text-center">
                                  <img src={receiptPreview} alt="Reçu" className="max-h-48 mx-auto mb-3 rounded-lg" />
                                  <button onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                                    className="text-sm underline" style={{ color: 'var(--danger)' }}>
                                    Supprimer la photo
                                  </button>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
                                  <input type="file" accept="image/*" onChange={handleFileChange}
                                    className="hidden" id="receipt-upload" />
                                  <label htmlFor="receipt-upload"
                                    className="px-4 py-2 rounded-lg border cursor-pointer inline-flex items-center gap-2 font-medium text-sm"
                                    style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                                    <Camera className="w-4 h-4" />
                                    Prendre photo / Importer
                                  </label>
                                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Max 5MB</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <button onClick={resetForm}
                              className="flex-1 py-3 rounded-lg border font-medium">
                              Annuler
                            </button>
                            <button onClick={handleSubmit} disabled={submitting}
                              className="flex-1 py-3 rounded-lg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                              style={{ backgroundColor: 'var(--success)' }}>
                              <CheckCircle className="w-5 h-5" />
                              {submitting ? 'Envoi...' : 'Envoyer à la comptabilité'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
