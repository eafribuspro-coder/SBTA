import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { History, ArrowLeft, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';

interface PointsLog {
  id: string;
  points_change: number;
  reason: string;
  created_at: string;
  balance_after?: number;
}

interface MonthGroup {
  month: string;
  logs: PointsLog[];
  totalEarned: number;
  totalSpent: number;
}

export default function LoyaltyHistory() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<PointsLog[]>([]);
  const [groupedLogs, setGroupedLogs] = useState<MonthGroup[]>([]);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('loyalty_points_log')
        .select('*')
        .eq('customer_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        let runningBalance = user?.loyalty_points || 0;
        const logsWithBalance = data.map((log) => {
          const balance = runningBalance;
          runningBalance -= log.points_change;
          return {
            ...log,
            balance_after: balance
          };
        });

        setLogs(logsWithBalance);

        const grouped = logsWithBalance.reduce((acc, log) => {
          const monthKey = format(new Date(log.created_at), 'MMMM yyyy', { locale: fr });

          let group = acc.find(g => g.month === monthKey);
          if (!group) {
            group = {
              month: monthKey,
              logs: [],
              totalEarned: 0,
              totalSpent: 0
            };
            acc.push(group);
          }

          group.logs.push(log);

          if (log.points_change > 0) {
            group.totalEarned += log.points_change;
          } else {
            group.totalSpent += Math.abs(log.points_change);
          }

          return acc;
        }, [] as MonthGroup[]);

        setGroupedLogs(grouped);
      }
    } catch (error: any) {
      console.error('Erreur chargement historique:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text('Historique des Points de Fidélité', 20, 20);

      doc.setFontSize(12);
      doc.text(`Client: ${user?.full_name}`, 20, 30);
      doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}`, 20, 37);
      doc.text(`Solde actuel: ${(user?.loyalty_points || 0).toLocaleString()} points`, 20, 44);

      let y = 60;

      groupedLogs.forEach((group) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(group.month, 20, y);
        y += 7;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Gagné: +${group.totalEarned} pts | Dépensé: -${group.totalSpent} pts`, 20, y);
        y += 10;

        doc.setFontSize(9);

        group.logs.forEach((log) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }

          const date = format(new Date(log.created_at), 'dd/MM/yyyy HH:mm');
          const points = log.points_change > 0 ? `+${log.points_change}` : `${log.points_change}`;
          const balance = log.balance_after?.toLocaleString() || '-';

          doc.text(`${date} - ${log.reason}`, 20, y);
          doc.text(points, 120, y);
          doc.text(`Solde: ${balance}`, 150, y);
          y += 6;
        });

        y += 5;
      });

      doc.save(`historique-fidelite-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Export PDF réussi');
    } catch (error: any) {
      console.error('Erreur export PDF:', error);
      toast.error('Erreur lors de l\'export');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <button
          onClick={() => navigate('/client/loyalty')}
          className="mb-4 flex items-center gap-2 text-sm font-semibold"
          style={{ color: 'var(--primary)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à ma carte
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <History className="w-8 h-8" style={{ color: 'var(--primary)' }} />
              Historique des Points
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Consultez toutes vos transactions de points
            </p>
          </div>

          <button
            onClick={exportToPDF}
            className="px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-md"
            style={{ backgroundColor: 'var(--primary)', color: 'white' }}
          >
            <Download className="w-5 h-5" />
            Export PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Chargement de l'historique...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border">
          <History className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--neutral-400)' }} />
          <p className="text-xl font-bold mb-2">Aucun historique</p>
          <p style={{ color: 'var(--text-secondary)' }}>
            Votre historique de points apparaîtra ici
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedLogs.map((group) => (
            <div key={group.month} className="bg-white rounded-xl border overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between"
                   style={{ backgroundColor: 'var(--neutral-50)' }}>
                <h2 className="font-bold text-lg capitalize">{group.month}</h2>
                <div className="flex gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" style={{ color: 'var(--success)' }} />
                    <span className="font-semibold" style={{ color: 'var(--success)' }}>
                      +{group.totalEarned.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" style={{ color: 'var(--danger)' }} />
                    <span className="font-semibold" style={{ color: 'var(--danger)' }}>
                      -{group.totalSpent.toLocaleString()} pts
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead style={{ backgroundColor: 'var(--neutral-100)' }}>
                    <tr>
                      <th className="text-left p-4 font-semibold">Date</th>
                      <th className="text-left p-4 font-semibold">Raison</th>
                      <th className="text-right p-4 font-semibold">Points</th>
                      <th className="text-right p-4 font-semibold">Solde après</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.logs.map((log) => (
                      <tr key={log.id} className="border-t hover:bg-gray-50">
                        <td className="p-4" style={{ color: 'var(--text-secondary)' }}>
                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </td>
                        <td className="p-4">{log.reason}</td>
                        <td className="p-4 text-right">
                          <span
                            className={`font-bold ${
                              log.points_change > 0 ? '' : ''
                            }`}
                            style={{
                              color: log.points_change > 0 ? 'var(--success)' : 'var(--danger)'
                            }}
                          >
                            {log.points_change > 0 ? '+' : ''}
                            {log.points_change.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-4 text-right font-semibold">
                          {log.balance_after?.toLocaleString() || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
