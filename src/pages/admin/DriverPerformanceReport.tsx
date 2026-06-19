import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Star, TrendingUp, AlertTriangle, Eye } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subMonths, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DriverPerformance {
  id: string;
  full_name: string;
  driver_id: string;
  average_rating: number;
  total_points: number;
  current_badge: string;
  total_reviews: number;
  phone_distraction_count: number;
}

interface BadgeDistribution {
  badge: string;
  count: number;
}

interface MonthlyRating {
  month: string;
  average: number;
}

interface DriverDetails {
  driver_id: string;
  driver_name: string;
  reviews: Array<{
    rating: number;
    comment: string | null;
    created_at: string;
    qualities: string[];
  }>;
  pointsHistory: Array<{
    month: string;
    points: number;
  }>;
}

const BADGE_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  bronze: { emoji: '🥉', label: 'Bronze', color: '#CD7F32' },
  silver: { emoji: '🥈', label: 'Argent', color: '#C0C0C0' },
  gold: { emoji: '🥇', label: 'Or', color: '#FFD700' },
  platinum: { emoji: '💎', label: 'Platine', color: '#E5E4E2' },
  diamond: { emoji: '💎', label: 'Diamant', color: '#B9F2FF' }
};

const COLORS = ['#CD7F32', '#C0C0C0', '#FFD700', '#E5E4E2', '#B9F2FF'];

export default function DriverPerformanceReport() {
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<DriverPerformance[]>([]);
  const [badgeDistribution, setBadgeDistribution] = useState<BadgeDistribution[]>([]);
  const [monthlyRatings, setMonthlyRatings] = useState<MonthlyRating[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadPerformanceData();
  }, []);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);

      const { data: performanceData, error: perfError } = await supabase
        .from('driver_performance_badges')
        .select(`
          *,
          users:driver_id (
            full_name
          )
        `)
        .order('total_points', { ascending: false });

      if (perfError) throw perfError;

      const formattedDrivers: DriverPerformance[] = (performanceData || []).map((perf: any) => ({
        id: perf.id,
        full_name: perf.users?.full_name || 'N/A',
        driver_id: perf.driver_id,
        average_rating: perf.average_rating || 0,
        total_points: perf.total_points || 0,
        current_badge: perf.current_badge || 'bronze',
        total_reviews: perf.total_reviews || 0,
        phone_distraction_count: perf.phone_distraction_count || 0
      }));

      setDrivers(formattedDrivers);

      const badgeCounts = formattedDrivers.reduce((acc, driver) => {
        const badge = driver.current_badge;
        acc[badge] = (acc[badge] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const badgeDistData: BadgeDistribution[] = Object.entries(badgeCounts).map(([badge, count]) => ({
        badge: BADGE_CONFIG[badge]?.label || badge,
        count
      }));

      setBadgeDistribution(badgeDistData);

      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(new Date(), 5 - i);
        return startOfMonth(date);
      });

      const monthlyData = await Promise.all(
        last6Months.map(async (monthStart) => {
          const monthEnd = new Date(monthStart);
          monthEnd.setMonth(monthEnd.getMonth() + 1);

          const { data: reviews } = await supabase
            .from('driver_reviews')
            .select('rating')
            .gte('created_at', monthStart.toISOString())
            .lt('created_at', monthEnd.toISOString())
            .eq('token_used', true)
            .not('rating', 'is', null);

          const avgRating = reviews && reviews.length > 0
            ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
            : 0;

          return {
            month: format(monthStart, 'MMM', { locale: fr }),
            average: parseFloat(avgRating.toFixed(2))
          };
        })
      );

      setMonthlyRatings(monthlyData);
    } catch (error: any) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const loadDriverDetails = async (driverId: string, driverName: string) => {
    try {
      const { data: reviews, error: reviewsError } = await supabase
        .from('driver_reviews')
        .select('rating, comment, created_at, qualities')
        .eq('driver_id', driverId)
        .eq('token_used', true)
        .not('rating', 'is', null)
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(new Date(), 5 - i);
        return startOfMonth(date);
      });

      const pointsHistory = last6Months.map((monthStart) => {
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        const monthReviews = (reviews || []).filter(r => {
          const reviewDate = new Date(r.created_at);
          return reviewDate >= monthStart && reviewDate < monthEnd;
        });

        const points = monthReviews.reduce((sum, r) => {
          let p = (r.rating || 0) * 10;
          p += ((r.qualities || []).length * 2);
          if (r.rating === 5) p += 5;
          return sum + p;
        }, 0);

        return {
          month: format(monthStart, 'MMM', { locale: fr }),
          points
        };
      });

      setSelectedDriver({
        driver_id: driverId,
        driver_name: driverName,
        reviews: reviews || [],
        pointsHistory
      });

      setShowDetails(true);
    } catch (error: any) {
      console.error('Erreur chargement détails:', error);
      toast.error('Erreur de chargement des détails');
    }
  };

  const topDriversData = drivers.slice(0, 10).map(d => ({
    name: d.full_name.split(' ')[0],
    points: d.total_points,
    rating: d.average_rating
  }));

  const phoneDistractionData = drivers
    .filter(d => d.phone_distraction_count > 0)
    .sort((a, b) => b.phone_distraction_count - a.phone_distraction_count)
    .slice(0, 10)
    .map(d => ({
      name: d.full_name.split(' ')[0],
      count: d.phone_distraction_count
    }));

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Rapport de Performance Chauffeurs
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Vue d'ensemble et analyse détaillée
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border mb-6">
            <div className="p-6 border-b">
              <h2 className="font-bold text-lg">Classement des chauffeurs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: 'var(--neutral-100)' }}>
                  <tr>
                    <th className="text-center p-4 font-semibold">#</th>
                    <th className="text-left p-4 font-semibold">Chauffeur</th>
                    <th className="text-center p-4 font-semibold">Note</th>
                    <th className="text-center p-4 font-semibold">Points</th>
                    <th className="text-center p-4 font-semibold">Niveau</th>
                    <th className="text-center p-4 font-semibold">Avis</th>
                    <th className="text-center p-4 font-semibold">Signalements</th>
                    <th className="text-center p-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driver, index) => {
                    const badgeConfig = BADGE_CONFIG[driver.current_badge] || BADGE_CONFIG.bronze;
                    return (
                      <tr key={driver.id} className="border-t hover:bg-gray-50">
                        <td className="p-4 text-center font-bold text-lg">
                          {index + 1}
                        </td>
                        <td className="p-4 font-medium">{driver.full_name}</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Star className="w-4 h-4" style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                            <span className="font-bold">{driver.average_rating.toFixed(1)}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center font-bold" style={{ color: 'var(--primary)' }}>
                          {driver.total_points} pts
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-2xl mr-2">{badgeConfig.emoji}</span>
                          <span className="font-semibold" style={{ color: badgeConfig.color }}>
                            {badgeConfig.label}
                          </span>
                        </td>
                        <td className="p-4 text-center font-medium">
                          {driver.total_reviews}
                        </td>
                        <td className="p-4 text-center">
                          {driver.phone_distraction_count > 0 ? (
                            <span className="px-3 py-1 rounded-full text-sm font-bold"
                                  style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
                              {driver.phone_distraction_count}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>-</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => loadDriverDetails(driver.driver_id, driver.full_name)}
                            className="px-4 py-2 rounded-lg font-medium flex items-center gap-2 mx-auto"
                            style={{ backgroundColor: 'var(--info)', color: 'white' }}
                          >
                            <Eye className="w-4 h-4" />
                            Détails
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                Top 10 chauffeurs
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topDriversData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="points" fill="#0B7439" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-bold mb-4">Répartition des niveaux</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={badgeDistribution}
                    dataKey="count"
                    nameKey="badge"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {badgeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-bold mb-4">Évolution notes moyennes (6 mois)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyRatings}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="average" stroke="#0B7439" strokeWidth={2} name="Note moyenne" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" style={{ color: 'var(--danger)' }} />
                Signalements téléphone (Top 10)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={phoneDistractionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#AF3029" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {showDetails && selectedDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
             onClick={() => setShowDetails(false)}>
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 pb-4 border-b">
              <h2 className="text-2xl font-bold">{selectedDriver.driver_name}</h2>
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--neutral-200)' }}
              >
                Fermer
              </button>
            </div>

            <div className="mb-6">
              <h3 className="font-bold mb-4">Progression des points (6 mois)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={selectedDriver.pointsHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="points" stroke="#0B7439" strokeWidth={2} name="Points" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="font-bold mb-4">Historique complet des avis</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {selectedDriver.reviews.map((review, index) => (
                  <div key={index} className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
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
                        {format(new Date(review.created_at), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </div>

                    {review.qualities && review.qualities.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {review.qualities.map((quality, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 rounded text-xs"
                            style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                          >
                            {quality}
                          </span>
                        ))}
                      </div>
                    )}

                    {review.comment && (
                      <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>
                        "{review.comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
