import React from 'react';
import { X, CheckCircle, Clock, AlertCircle, RefreshCw, Trash2, WifiOff } from 'lucide-react';
import { OfflineTicket } from '../../services/offlineStore';
import { offlineSyncService } from '../../services/offlineSync';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency } from '../../utils/formatCurrency';

interface Props {
  tickets: OfflineTicket[];
  syncing: boolean;
  isOnline: boolean;
  onClose: () => void;
  onSyncNow: () => void;
  onDelete: (localId: string) => void;
}

const STATUS_CFG = {
  pending: { label: 'En attente', color: '#D97706', bg: '#FEF3C7', icon: <Clock className="w-4 h-4" /> },
  syncing: { label: 'Synchronisation...', color: '#2563EB', bg: '#EFF6FF', icon: <RefreshCw className="w-4 h-4 animate-spin" /> },
  synced: { label: 'Synchronisé', color: '#16A34A', bg: '#DCFCE7', icon: <CheckCircle className="w-4 h-4" /> },
  error: { label: 'Erreur', color: '#DC2626', bg: '#FEF2F2', icon: <AlertCircle className="w-4 h-4" /> },
};

export default function OfflineQueue({ tickets, syncing, isOnline, onClose, onSyncNow, onDelete }: Props) {
  const pending = tickets.filter(t => ['pending', 'error', 'syncing'].includes(t.status));
  const synced = tickets.filter(t => t.status === 'synced');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
              <WifiOff className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                File d'attente hors-ligne
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {pending.length} en attente · {synced.length} synchronisé{synced.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOnline && pending.length > 0 && (
              <button onClick={onSyncNow} disabled={syncing}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-all"
                      style={{ backgroundColor: '#1D4ED8' }}>
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'En cours...' : 'Tout synchroniser'}
              </button>
            )}
            <button onClick={onClose}
                    className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tickets.length === 0 && (
            <div className="py-16 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p style={{ color: 'var(--text-secondary)' }}>Aucun billet hors-ligne</p>
            </div>
          )}

          {tickets.map(ticket => {
            const cfg = STATUS_CFG[ticket.status] || STATUS_CFG.pending;
            return (
              <div key={ticket.localId}
                   className="border rounded-xl p-4 hover:border-blue-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {ticket.bookingReference}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </div>

                    <p className="text-sm font-semibold truncate">{ticket.passengerName}</p>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {ticket.passengerPhone}
                    </p>

                    <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
                      <span>{ticket.scheduleSnapshot.route_name}</span>
                      <span>·</span>
                      <span>
                        {format(new Date(ticket.scheduleSnapshot.departure_datetime), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </span>
                      <span>·</span>
                      <span>{ticket.totalSeats} place{ticket.totalSeats > 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(ticket.totalPrice)}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>Sauvegardé le {format(new Date(ticket.createdAt), 'dd/MM HH:mm', { locale: fr })}</span>
                      {ticket.syncedAt && (
                        <span className="text-green-600">
                          · Sync {format(new Date(ticket.syncedAt), 'HH:mm')}
                        </span>
                      )}
                    </div>

                    {ticket.status === 'error' && ticket.errorMessage && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{ticket.errorMessage}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {ticket.status === 'error' && isOnline && (
                      <button
                        onClick={async () => {
                          await offlineSyncService.syncOne(ticket);
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Réessayer"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                    {ticket.status !== 'syncing' && (
                      <button
                        onClick={() => onDelete(ticket.localId)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!isOnline && (
          <div className="p-4 border-t">
            <div className="flex items-center gap-2 text-sm" style={{ color: '#D97706' }}>
              <WifiOff className="w-4 h-4" />
              <span>Hors-ligne — la synchronisation reprendra automatiquement à la reconnexion</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
