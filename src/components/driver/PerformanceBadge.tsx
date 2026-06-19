import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { Star, TrendingUp, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PerformanceData {
  current_badge: string;
  total_points: number;
  total_reviews: number;
  average_rating: number;
  phone_distraction_count: number;
  qualities_count: Record<string, number>;
}

interface RecentReview {
  rating: number;
  comment: string | null;
  created_at: string;
}

const BADGE_CONFIG: Record<string, { emoji: string; label: string; next: number; color: string }> = {
  bronze: { emoji: '🥉', label: 'Bronze', next: 150, color: '#CD7F32' },
  silver: { emoji: '🥈', label: 'Argent', next: 300, color: '#C0C0C0' },
  gold: { emoji: '🥇', label: 'Or', next: 500, color: '#FFD700' },
  platinum: { emoji: '💎', label: 'Platine', next: 600, color: '#E5E4E2' },
  diamond: { emoji: '💎', label: 'Diamant', next: 0, color: '#B9F2FF' }
};

interface Props {
  driverId: string;
}

export default function PerformanceBadge({ driverId }: Props) {
  const [loading, setLoading] = useState(true);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);

  useEffect(() => {
    if (driverId) {
      loadPerformanceData();
    }
  }, [driverId]);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);

      const [perfResult, reviewsResult] = await Promise.all([
        supabase
          .from('driver_performance_badges')
          .select('*')
          .eq('driver_id', driverId)
          .maybeSingle(),
        supabase
          .from('driver_reviews')
          .select('rating, comment, created_at')
          .eq('driver_id', driverId)
          .eq('token_used', true)
          .not('rating', 'is', null)
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      if (perfResult.data) {
        setPerformance({
          current_badge: perfResult.data.current_badge || 'bronze',
          total_points: perfResult.data.total_points || 0,
          total_reviews: perfResult.data.total_reviews || 0,
          average_rating: perfResult.data.average_rating || 0,
          phone_distraction_count: perfResult.data.phone_distraction_count || 0,
          qualities_count: perfResult.data.qualities_count || {}
        });
      }

      if (reviewsResult.data) {
        setRecentReviews(reviewsResult.data as RecentReview[]);
      }
    } catch (error: any) {
      console.error('Erreur chargement performance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 border">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!performance) {
    return (
      <div className="bg-white rounded-xl p-6 border text-center">
        <p style={{ color: 'var(--text-secondary)' }}>
          Aucune donnée de performance disponible
        </p>
      </div>
    );
  }

  const badgeConfig = BADGE_CONFIG[performance.current_badge] || BADGE_CONFIG.bronze;
  const nextBadgePoints = badgeConfig.next;
  const progressPercent = nextBadgePoints > 0
    ? (performance.total_points / nextBadgePoints) * 100
    : 100;
  const pointsToNext = nextBadgePoints > 0
    ? nextBadgePoints - performance.total_points
    : 0;

  const topQualities = Object.entries(performance.qualities_count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 border">
        <div className="flex items-center justify-center gap-4 mb-6 pb-6 border-b">
          <span className="text-6xl">{badgeConfig.emoji}</span>
          <div className="text-center">
            <p className="text-3xl font-black mb-1" style={{ color: badgeConfig.color }}>
              {badgeConfig.label}
            </p>
            <div className="flex items-center gap-2 justify-center">
              <Star className="w-6 h-6" style={{ color: '#F59E0B', fill: '#F59E0B' }} />
              <span className="text-2xl font-bold" style={{ color: '#F59E0B' }}>
                {performance.average_rating.toFixed(1)}
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black" style={{ color: 'var(--primary)' }}>
              {performance.total_points}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              pts
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black" style={{ color: 'var(--info)' }}>
              {performance.total_reviews}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              avis
            </p>
          </div>
        </div>

        {nextBadgePoints > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold">
                Progression vers {BADGE_CONFIG[getNextBadge(performance.current_badge)].emoji} {BADGE_CONFIG[getNextBadge(performance.current_badge)].label}
              </p>
              <p className="text-sm font-bold">
                {performance.total_points} / {nextBadgePoints} pts ({progressPercent.toFixed(0)}%)
              </p>
            </div>

            <div className="relative h-4 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="absolute h-full transition-all rounded-full"
                style={{
                  width: `${Math.min(progressPercent, 100)}%`,
                  backgroundColor: 'var(--primary)'
                }}
              />
            </div>

            <p className="text-sm mt-2 flex items-center gap-1" style={{ color: 'var(--primary)' }}>
              <TrendingUp className="w-4 h-4" />
              {pointsToNext} pts supplémentaires pour devenir {BADGE_CONFIG[getNextBadge(performance.current_badge)].label} !
            </p>
          </div>
        )}

        {performance.current_badge === 'diamond' && (
          <div className="p-4 rounded-lg mb-6"
               style={{ backgroundColor: 'var(--success-light)' }}>
            <p className="font-bold text-center" style={{ color: 'var(--success)' }}>
              🎉 Vous avez atteint le niveau maximum !
            </p>
          </div>
        )}

        {topQualities.length > 0 && (
          <div className="mb-6">
            <p className="font-semibold mb-3">Top qualités :</p>
            <div className="flex flex-wrap gap-2">
              {topQualities.map(([quality, count]) => (
                <div
                  key={quality}
                  className="px-4 py-2 rounded-full text-sm"
                  style={{
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary)'
                  }}
                >
                  {quality} ({count})
                </div>
              ))}
            </div>
          </div>
        )}

        {performance.phone_distraction_count > 0 && (
          <div className="p-3 rounded-lg flex items-center gap-2"
               style={{ backgroundColor: 'var(--warning-light)' }}>
            <AlertTriangle className="w-5 h-5" style={{ color: 'var(--warning)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--warning)' }}>
              ⚠️ Signalements téléphone : {performance.phone_distraction_count}
            </p>
          </div>
        )}
      </div>

      {recentReviews.length > 0 && (
        <div className="bg-white rounded-xl p-6 border">
          <h3 className="font-bold mb-4">Mes 5 derniers avis (anonymes)</h3>
          <div className="space-y-3">
            {recentReviews.map((review, index) => (
              <div key={index} className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className="w-4 h-4"
                        style={{
                          color: star <= review.rating ? '#F59E0B' : '#D1D5DB',
                          fill: star <= review.rating ? '#F59E0B' : 'none'
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {format(new Date(review.created_at), 'd MMM', { locale: fr })}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>
                    "{review.comment}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getNextBadge(currentBadge: string): string {
  const order = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const currentIndex = order.indexOf(currentBadge);
  return currentIndex < order.length - 1 ? order[currentIndex + 1] : 'diamond';
}
