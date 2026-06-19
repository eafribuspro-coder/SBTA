import React from 'react';
import { WifiOff, Wifi, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

interface Props {
  isOnline: boolean;
  wasOffline: boolean;
  pendingCount: number;
  syncing: boolean;
  onSyncNow: () => void;
  onShowQueue: () => void;
}

export default function OfflineBanner({
  isOnline, wasOffline, pendingCount, syncing, onSyncNow, onShowQueue,
}: Props) {
  if (isOnline && !wasOffline && pendingCount === 0) return null;

  if (!isOnline) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 mb-4"
           style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }}>
        <WifiOff className="w-5 h-5 flex-shrink-0 text-amber-600" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-amber-800 text-sm">Mode hors-ligne actif</p>
          <p className="text-xs text-amber-700">
            Les billets vendus seront sauvegardés localement et synchronisés automatiquement au retour du réseau.
          </p>
        </div>
        {pendingCount > 0 && (
          <button onClick={onShowQueue}
                  className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-200 text-amber-800 hover:bg-amber-300 transition-colors">
            {pendingCount} en attente
          </button>
        )}
      </div>
    );
  }

  if (wasOffline && pendingCount === 0) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 mb-4"
           style={{ backgroundColor: '#DCFCE7', borderColor: '#22C55E' }}>
        <CheckCircle className="w-5 h-5 flex-shrink-0 text-green-600" />
        <p className="font-bold text-green-800 text-sm flex-1">Connexion rétablie — tous les billets synchronisés</p>
      </div>
    );
  }

  if (isOnline && pendingCount > 0) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 mb-4"
           style={{ backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }}>
        <Wifi className="w-5 h-5 flex-shrink-0 text-blue-600" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-blue-800 text-sm">
            {pendingCount} billet{pendingCount > 1 ? 's' : ''} hors-ligne en attente de synchronisation
          </p>
          <p className="text-xs text-blue-600">Cliquer sur "Synchroniser" pour les envoyer au serveur maintenant.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onShowQueue}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
            Voir
          </button>
          <button onClick={onSyncNow} disabled={syncing}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sync...' : 'Synchroniser'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
