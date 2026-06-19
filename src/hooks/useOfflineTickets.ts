import { useState, useEffect, useCallback } from 'react';
import { offlineStore, OfflineTicket } from '../services/offlineStore';
import { offlineSyncService } from '../services/offlineSync';

export function useOfflineTickets() {
  const [tickets, setTickets] = useState<OfflineTicket[]>([]);
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(async () => {
    const all = await offlineStore.getAllTickets();
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setTickets(all);
  }, []);

  useEffect(() => {
    reload();
    const unsub = offlineSyncService.onTicketSynced(() => reload());
    return unsub;
  }, [reload]);

  const pendingCount = tickets.filter(t => t.status === 'pending' || t.status === 'error').length;
  const syncedCount = tickets.filter(t => t.status === 'synced').length;
  const errorCount = tickets.filter(t => t.status === 'error').length;

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      await offlineSyncService.syncAll();
      await reload();
    } finally {
      setSyncing(false);
    }
  }, [reload]);

  const deleteTicket = useCallback(async (localId: string) => {
    await offlineStore.deleteTicket(localId);
    await reload();
  }, [reload]);

  return {
    tickets,
    pendingCount,
    syncedCount,
    errorCount,
    syncing,
    syncNow,
    deleteTicket,
    reload,
  };
}
