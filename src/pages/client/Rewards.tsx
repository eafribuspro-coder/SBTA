import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import RewardsCatalog from '../../components/loyalty/RewardsCatalog';
import { Gift, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Rewards() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState<any[]>([]);
  const [userPoints, setUserPoints] = useState(0);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [rewardsResult, userResult] = await Promise.all([
        supabase
          .from('loyalty_rewards_catalog')
          .select('*')
          .eq('is_active', true)
          .order('points_required', { ascending: true }),
        supabase
          .from('users')
          .select('loyalty_points')
          .eq('id', user?.id)
          .single()
      ]);

      if (rewardsResult.data) {
        setRewards(rewardsResult.data);
      }

      if (userResult.data) {
        setUserPoints(userResult.data.loyalty_points || 0);
      }
    } catch (error: any) {
      console.error('Erreur chargement récompenses:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (rewardId: string) => {
    try {
      const reward = rewards.find(r => r.id === rewardId);
      if (!reward) throw new Error('Récompense introuvable');

      if (userPoints < reward.points_required) {
        toast.error('Points insuffisants');
        throw new Error('Points insuffisants');
      }

      const { data, error } = await supabase
        .from('loyalty_redemptions')
        .insert({
          customer_id: user?.id,
          reward_id: rewardId,
          points_used: reward.points_required,
          status: 'en_attente'
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('users')
        .update({
          loyalty_points: userPoints - reward.points_required
        })
        .eq('id', user?.id);

      await supabase
        .from('loyalty_points_log')
        .insert({
          customer_id: user?.id,
          points_change: -reward.points_required,
          reason: `Échange: ${reward.name}`
        });

      setUserPoints(prev => prev - reward.points_required);

      toast.success('Récompense échangée avec succès !');

      return {
        redemption_code: data.redemption_code,
        reward_name: reward.name,
        expires_at: data.expires_at,
        points_used: reward.points_required
      };
    } catch (error: any) {
      console.error('Erreur échange:', error);
      toast.error(error.message || 'Erreur lors de l\'échange');
      throw error;
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
              <Gift className="w-8 h-8" style={{ color: 'var(--primary)' }} />
              Catalogue de Récompenses
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Échangez vos points contre des récompenses exclusives
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
              Vos points disponibles
            </p>
            <p className="text-4xl font-black" style={{ color: 'var(--primary)' }}>
              {userPoints.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Chargement des récompenses...</p>
        </div>
      ) : rewards.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border">
          <Gift className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--neutral-400)' }} />
          <p className="text-xl font-bold mb-2">Aucune récompense disponible</p>
          <p style={{ color: 'var(--text-secondary)' }}>
            Revenez plus tard pour découvrir de nouvelles récompenses
          </p>
        </div>
      ) : (
        <RewardsCatalog
          rewards={rewards}
          userPoints={userPoints}
          onRedeem={handleRedeem}
        />
      )}
    </div>
  );
}
