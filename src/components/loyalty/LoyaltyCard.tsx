import React from 'react';
import { User } from '../../types';
import { Gift, History, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  user: User;
  pointsEarned: number;
  pointsRedeemed: number;
}

const TIER_CONFIG: Record<string, { emoji: string; label: string; next: number; color: string }> = {
  bronze: { emoji: '🥉', label: 'BRONZE', next: 500, color: '#CD7F32' },
  silver: { emoji: '🥈', label: 'ARGENT', next: 1000, color: '#C0C0C0' },
  gold: { emoji: '🥇', label: 'OR', next: 2000, color: '#FFD700' },
  platinum: { emoji: '💎', label: 'PLATINUM', next: 0, color: '#E5E4E2' }
};

export default function LoyaltyCard({ user, pointsEarned, pointsRedeemed }: Props) {
  const navigate = useNavigate();

  const tier = user.loyalty_tier || 'bronze';
  const points = user.loyalty_points || 0;
  const trips = user.total_trips || 0;

  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  const nextTierPoints = tierConfig.next;
  const progressPercent = nextTierPoints > 0 ? (points / nextTierPoints) * 100 : 100;
  const pointsToNext = nextTierPoints > 0 ? nextTierPoints - points : 0;

  const memberSince = user.created_at
    ? format(new Date(user.created_at), 'MMM yyyy', { locale: fr })
    : 'N/A';

  const loyaltyId = `SBTA-F-${String(user.id).slice(0, 8).toUpperCase()}`;

  return (
    <div className="bg-white rounded-xl border overflow-hidden shadow-lg">
      <div className="p-6 text-center"
           style={{
             background: 'linear-gradient(135deg, var(--primary) 0%, #0a5a2d 100%)',
             color: 'white'
           }}>
        <h2 className="text-2xl font-black mb-4">🚌 SBTA FIDÉLITÉ</h2>

        <div className="flex items-center justify-center gap-4 mb-2">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-white">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold"
                   style={{ color: 'var(--primary)' }}>
                {user.full_name.charAt(0)}
              </div>
            )}
          </div>
          <div className="text-left">
            <p className="text-xl font-bold">{user.full_name}</p>
            <p className="text-sm opacity-90">{loyaltyId}</p>
          </div>
        </div>

        <p className="text-sm opacity-75">Membre depuis {memberSince}</p>
      </div>

      <div className="p-6 border-b">
        <div className="text-center mb-4">
          <p className="text-4xl mb-2">{tierConfig.emoji}</p>
          <p className="text-2xl font-black" style={{ color: tierConfig.color }}>
            NIVEAU {tierConfig.label}
          </p>
        </div>

        <div className="text-center mb-4">
          <p className="text-4xl font-black mb-1" style={{ color: 'var(--primary)' }}>
            ⬡ {points.toLocaleString()} POINTS ⬡
          </p>
        </div>

        {nextTierPoints > 0 && (
          <div className="mb-2">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="font-semibold">Vers {TIER_CONFIG[getNextTier(tier)].label}</span>
              <span className="font-bold">
                {points.toLocaleString()} / {nextTierPoints.toLocaleString()} ({progressPercent.toFixed(0)}%)
              </span>
            </div>

            <div className="relative h-3 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="absolute h-full transition-all rounded-full"
                style={{
                  width: `${Math.min(progressPercent, 100)}%`,
                  background: 'linear-gradient(90deg, var(--primary) 0%, #0a5a2d 100%)'
                }}
              />
            </div>

            <p className="text-sm mt-2 text-center flex items-center justify-center gap-1"
               style={{ color: 'var(--primary)' }}>
              <TrendingUp className="w-4 h-4" />
              Plus que {pointsToNext.toLocaleString()} pts pour devenir {TIER_CONFIG[getNextTier(tier)].label} !
            </p>
          </div>
        )}

        {tier === 'platinum' && (
          <div className="p-3 rounded-lg text-center"
               style={{ backgroundColor: 'var(--success-light)' }}>
            <p className="font-bold" style={{ color: 'var(--success)' }}>
              🎉 Vous avez atteint le niveau maximum !
            </p>
          </div>
        )}
      </div>

      <div className="p-6 border-b">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-black" style={{ color: 'var(--info)' }}>
              {trips}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Voyages
            </p>
          </div>
          <div>
            <p className="text-2xl font-black" style={{ color: 'var(--success)' }}>
              {pointsEarned.toLocaleString()}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Points gagnés
            </p>
          </div>
          <div>
            <p className="text-2xl font-black" style={{ color: 'var(--warning)' }}>
              {pointsRedeemed.toLocaleString()}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Échangés
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/client/rewards')}
          className="px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-md"
          style={{ backgroundColor: 'var(--primary)', color: 'white' }}
        >
          <Gift className="w-5 h-5" />
          Voir récompenses
        </button>

        <button
          onClick={() => navigate('/client/loyalty/history')}
          className="px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 border-2"
          style={{
            borderColor: 'var(--primary)',
            color: 'var(--primary)',
            backgroundColor: 'white'
          }}
        >
          <History className="w-5 h-5" />
          Historique points
        </button>
      </div>
    </div>
  );
}

function getNextTier(currentTier: string): string {
  const order = ['bronze', 'silver', 'gold', 'platinum'];
  const currentIndex = order.indexOf(currentTier);
  return currentIndex < order.length - 1 ? order[currentIndex + 1] : 'platinum';
}
