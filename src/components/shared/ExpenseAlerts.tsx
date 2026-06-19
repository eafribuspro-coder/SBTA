import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { AlertTriangle, Calendar, Bell } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface ExpiringExpense {
  id: string;
  bus_id: string;
  expense_type: string;
  expiry_date: string;
  description: string;
  buses: {
    registration_number: string;
    model: string;
  };
}

const EXPENSE_TYPES: Record<string, string> = {
  assurance: 'Assurance',
  vignette: 'Vignette',
  visite_technique: 'Visite technique'
};

interface ExpenseAlertsProps {
  showInDashboard?: boolean;
  maxItems?: number;
}

export default function ExpenseAlerts({ showInDashboard = false, maxItems = 10 }: ExpenseAlertsProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [expiringExpenses, setExpiringExpenses] = useState<ExpiringExpense[]>([]);

  useEffect(() => {
    loadExpiringExpenses();
  }, []);

  const loadExpiringExpenses = async () => {
    try {
      setLoading(true);

      const today = new Date();
      const inThirtyDays = new Date();
      inThirtyDays.setDate(today.getDate() + 30);

      const { data: buses, error: busesError } = await supabase
        .from('buses')
        .select('id, registration_number, model, insurance_expiry, vignette_expiry, technical_inspection_expiry')
        .eq('is_active', true);

      if (busesError) throw busesError;

      const expiringItems: ExpiringExpense[] = [];

      buses?.forEach(bus => {
        if (bus.insurance_expiry) {
          const expiryDate = new Date(bus.insurance_expiry);
          if (expiryDate <= inThirtyDays) {
            expiringItems.push({
              id: bus.id,
              bus_id: bus.id,
              expense_type: 'assurance',
              expiry_date: bus.insurance_expiry,
              description: 'Assurance',
              buses: {
                registration_number: bus.registration_number,
                model: bus.model
              }
            });
          }
        }

        if (bus.vignette_expiry) {
          const expiryDate = new Date(bus.vignette_expiry);
          if (expiryDate <= inThirtyDays) {
            expiringItems.push({
              id: bus.id + '_vignette',
              bus_id: bus.id,
              expense_type: 'vignette',
              expiry_date: bus.vignette_expiry,
              description: 'Vignette',
              buses: {
                registration_number: bus.registration_number,
                model: bus.model
              }
            });
          }
        }

        if (bus.technical_inspection_expiry) {
          const expiryDate = new Date(bus.technical_inspection_expiry);
          if (expiryDate <= inThirtyDays) {
            expiringItems.push({
              id: bus.id + '_tech',
              bus_id: bus.id,
              expense_type: 'visite_technique',
              expiry_date: bus.technical_inspection_expiry,
              description: 'Visite technique',
              buses: {
                registration_number: bus.registration_number,
                model: bus.model
              }
            });
          }
        }
      });

      expiringItems.sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
      const data = expiringItems;

      setExpiringExpenses((data || []).slice(0, maxItems));
    } catch (error: any) {
      console.error('Erreur de chargement des alertes expiration:', error);
    } finally {
      setLoading(false);
    }
  };

  const getExpiryAlert = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = differenceInDays(expiry, today);

    if (daysUntilExpiry < 0) {
      return {
        level: 'expired',
        color: '#7F1D1D',
        bg: '#FEE2E2',
        icon: '🔴',
        label: 'EXPIRÉ',
        message: `Expiré depuis ${Math.abs(daysUntilExpiry)} jour(s)`
      };
    }
    if (daysUntilExpiry <= 7) {
      return {
        level: 'urgent',
        color: 'var(--danger)',
        bg: 'var(--danger-light)',
        icon: '🔴',
        label: 'URGENT',
        message: `Expire dans ${daysUntilExpiry} jour(s)`
      };
    }
    if (daysUntilExpiry <= 30) {
      return {
        level: 'warning',
        color: 'var(--warning)',
        bg: 'var(--warning-light)',
        icon: '🟠',
        label: 'Renouvellement',
        message: `Expire dans ${daysUntilExpiry} jour(s)`
      };
    }

    return null;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 border">
        <div className="text-center py-4">
          <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        </div>
      </div>
    );
  }

  if (expiringExpenses.length === 0) {
    return showInDashboard ? (
      <div className="bg-white rounded-xl p-6 border">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-6 h-6" style={{ color: 'var(--success)' }} />
          <h3 className="font-bold">Alertes expiration</h3>
        </div>
        <div className="text-center py-4">
          <p className="text-sm" style={{ color: 'var(--success)' }}>
            ✓ Aucune charge proche de l'expiration
          </p>
        </div>
      </div>
    ) : null;
  }

  const expiredCount = expiringExpenses.filter(
    exp => differenceInDays(new Date(exp.expiry_date), new Date()) < 0
  ).length;

  const urgentCount = expiringExpenses.filter(
    exp => {
      const days = differenceInDays(new Date(exp.expiry_date), new Date());
      return days >= 0 && days <= 7;
    }
  ).length;

  const warningCount = expiringExpenses.filter(
    exp => {
      const days = differenceInDays(new Date(exp.expiry_date), new Date());
      return days > 7 && days <= 30;
    }
  ).length;

  return (
    <div className="bg-white rounded-xl p-6 border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6" style={{ color: 'var(--danger)' }} />
          <h3 className="font-bold">Alertes expiration</h3>
        </div>
        <div className="flex gap-2">
          {expiredCount > 0 && (
            <span
              className="px-2 py-1 rounded text-xs font-bold"
              style={{ backgroundColor: '#7F1D1D', color: '#FEE2E2' }}
            >
              {expiredCount} expiré(s)
            </span>
          )}
          {urgentCount > 0 && (
            <span
              className="px-2 py-1 rounded text-xs font-bold"
              style={{ backgroundColor: 'var(--danger)', color: 'white' }}
            >
              {urgentCount} urgent(s)
            </span>
          )}
          {warningCount > 0 && (
            <span
              className="px-2 py-1 rounded text-xs font-medium"
              style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}
            >
              {warningCount} à renouveler
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {expiringExpenses.map(expense => {
          const alert = getExpiryAlert(expense.expiry_date);
          if (!alert) return null;

          return (
            <div
              key={expense.id}
              className="p-4 rounded-lg border-l-4"
              style={{ borderColor: alert.color, backgroundColor: alert.bg + '40' }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold">{expense.buses.registration_number}</p>
                    <span
                      className="px-2 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: alert.bg, color: alert.color }}
                    >
                      {alert.icon} {alert.label}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {expense.buses.model}
                  </p>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100">
                    {EXPENSE_TYPES[expense.expense_type] || expense.expense_type}
                  </span>
                </div>
                <p className="text-sm mt-1">{expense.description}</p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" style={{ color: alert.color }} />
                  <span className="font-semibold" style={{ color: alert.color }}>
                    {alert.message}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {format(new Date(expense.expiry_date), 'dd/MM/yyyy')}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {!showInDashboard && (
        <div className="mt-4 pt-4 border-t">
          <button
            onClick={() => navigate('/admin/expenses')}
            className="w-full px-4 py-2 rounded-lg border font-medium hover:bg-gray-50"
          >
            Voir toutes les charges
          </button>
        </div>
      )}
    </div>
  );
}
