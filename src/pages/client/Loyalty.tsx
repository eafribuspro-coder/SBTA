import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import LoyaltyCard from '../../components/loyalty/LoyaltyCard';
import { Award, TrendingUp } from 'lucide-react';

export default function Loyalty() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(user);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [pointsRedeemed, setPointsRedeemed] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadLoyaltyData();
    }
  }, [user]);

  const loadLoyaltyData = async () => {
    try {
      setLoading(true);

      const [userResult, earnedResult, redeemedResult, activityResult] = await Promise.all([
        supabase
          .from('users')
          .select('*')
          .eq('id', user?.id)
          .single(),
        supabase
          .from('loyalty_points_log')
          .select('points_change')
          .eq('customer_id', user?.id)
          .gt('points_change', 0),
        supabase
          .from('loyalty_redemptions')
          .select('points_used')
          .eq('customer_id', user?.id)
          .in('status', ['validee', 'utilisee']),
        supabase
          .from('loyalty_points_log')
          .select('*')
          .eq('customer_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      if (userResult.data) {
        setUserData(userResult.data);
      }

      if (earnedResult.data) {
        const total = earnedResult.data.reduce((sum, log) => sum + (log.points_change || 0), 0);
        setPointsEarned(total);
      }

      if (redeemedResult.data) {
        const total = redeemedResult.data.reduce((sum, r) => sum + (r.points_used || 0), 0);
        setPointsRedeemed(total);
      }

      if (activityResult.data) {
        setRecentActivity(activityResult.data);
      }
    } catch (error: any) {
      console.error('Erreur chargement données fidélité:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-xl p-8 text-center border">
          <p>Erreur de chargement des données</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Award className="w-8 h-8" style={{ color: 'var(--primary)' }} />
          Ma Carte de Fidélité
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Gagnez des points et profitez de récompenses exclusives
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <LoyaltyCard
            user={userData}
            pointsEarned={pointsEarned}
            pointsRedeemed={pointsRedeemed}
          />
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              Comment gagner des points ?
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between p-3 rounded-lg"
                   style={{ backgroundColor: 'var(--neutral-50)' }}>
                <span>Par 100 km parcouru</span>
                <span className="font-bold" style={{ color: 'var(--primary)' }}>+10 pts</span>
              </div>

              <div className="flex justify-between p-3 rounded-lg"
                   style={{ backgroundColor: 'var(--neutral-50)' }}>
                <span>Réservation en ligne</span>
                <span className="font-bold" style={{ color: 'var(--primary)' }}>+3 pts</span>
              </div>

              <div className="flex justify-between p-3 rounded-lg"
                   style={{ backgroundColor: 'var(--neutral-50)' }}>
                <span>Évaluation chauffeur</span>
                <span className="font-bold" style={{ color: 'var(--primary)' }}>+5 pts</span>
              </div>

              <div className="flex justify-between p-3 rounded-lg"
                   style={{ backgroundColor: 'var(--neutral-50)' }}>
                <span>Classe VIP</span>
                <span className="font-bold" style={{ color: 'var(--primary)' }}>+5 pts</span>
              </div>

              <div className="flex justify-between p-3 rounded-lg"
                   style={{ backgroundColor: 'var(--neutral-50)' }}>
                <span>Classe Executive</span>
                <span className="font-bold" style={{ color: 'var(--primary)' }}>+15 pts</span>
              </div>

              <div className="flex justify-between p-3 rounded-lg"
                   style={{ backgroundColor: 'var(--success-light)' }}>
                <span className="font-bold">Premier voyage</span>
                <span className="font-bold" style={{ color: 'var(--success)' }}>+50 pts</span>
              </div>

              <div className="flex justify-between p-3 rounded-lg"
                   style={{ backgroundColor: 'var(--warning-light)' }}>
                <span className="font-bold">Tous les 10 voyages</span>
                <span className="font-bold" style={{ color: 'var(--warning)' }}>Voyage gratuit 🎁</span>
              </div>
            </div>
          </div>

          {recentActivity.length > 0 && (
            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-bold mb-4">Activité récente</h3>
              <div className="space-y-2">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex justify-between text-sm p-2 border-b last:border-0">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {activity.reason}
                    </span>
                    <span
                      className="font-bold"
                      style={{
                        color: activity.points_change > 0 ? 'var(--success)' : 'var(--danger)'
                      }}
                    >
                      {activity.points_change > 0 ? '+' : ''}{activity.points_change}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
