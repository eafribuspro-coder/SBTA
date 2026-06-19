import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Award, Users, TrendingUp, Gift, Settings, BarChart3, Plus, CreditCard as Edit2, Trash2, Eye } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subMonths, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

type Tab = 'members' | 'catalog' | 'redemptions' | 'stats';

const COLORS = ['#CD7F32', '#C0C0C0', '#FFD700', '#E5E4E2'];

export default function Loyalty() {
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [loading, setLoading] = useState(true);

  const [kpis, setKpis] = useState({
    activeMembers: 0,
    pointsIssuedMonth: 0,
    pointsRedeemedMonth: 0,
    engagementRate: 0
  });

  const [members, setMembers] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [tierDistribution, setTierDistribution] = useState<any[]>([]);
  const [monthlyPoints, setMonthlyPoints] = useState<any[]>([]);

  const [showRewardModal, setShowRewardModal] = useState(false);
  const [editingReward, setEditingReward] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [membersResult, rewardsResult, redemptionsResult, pointsResult] = await Promise.all([
        supabase
          .from('users')
          .select('*')
          .eq('role', 'client')
          .order('loyalty_points', { ascending: false }),
        supabase
          .from('loyalty_rewards_catalog')
          .select('*')
          .order('points_required', { ascending: true }),
        supabase
          .from('loyalty_redemptions')
          .select(`
            *,
            customer:customer_id (full_name, email),
            reward:reward_id (name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('loyalty_points_log')
          .select('points_change, created_at')
      ]);

      if (membersResult.data) {
        setMembers(membersResult.data);

        const active = membersResult.data.filter(m => (m.loyalty_points || 0) > 0).length;
        setKpis(prev => ({ ...prev, activeMembers: active }));

        const tierCounts = membersResult.data.reduce((acc, member) => {
          const tier = member.loyalty_tier || 'bronze';
          acc[tier] = (acc[tier] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const tierData = Object.entries(tierCounts).map(([tier, count]) => ({
          name: tier.charAt(0).toUpperCase() + tier.slice(1),
          value: count
        }));
        setTierDistribution(tierData);
      }

      if (rewardsResult.data) {
        setRewards(rewardsResult.data);
      }

      if (redemptionsResult.data) {
        setRedemptions(redemptionsResult.data);
      }

      if (pointsResult.data) {
        const now = new Date();
        const monthStart = startOfMonth(now);

        const thisMonthPoints = pointsResult.data.filter(log => {
          const logDate = new Date(log.created_at);
          return logDate >= monthStart;
        });

        const issued = thisMonthPoints
          .filter(log => log.points_change > 0)
          .reduce((sum, log) => sum + log.points_change, 0);

        const redeemed = thisMonthPoints
          .filter(log => log.points_change < 0)
          .reduce((sum, log) => sum + Math.abs(log.points_change), 0);

        setKpis(prev => ({
          ...prev,
          pointsIssuedMonth: issued,
          pointsRedeemedMonth: redeemed,
          engagementRate: membersResult.data ? (active / membersResult.data.length) * 100 : 0
        }));

        const last6Months = Array.from({ length: 6 }, (_, i) => {
          const date = subMonths(now, 5 - i);
          return startOfMonth(date);
        });

        const monthlyData = last6Months.map(monthStart => {
          const monthEnd = new Date(monthStart);
          monthEnd.setMonth(monthEnd.getMonth() + 1);

          const monthLogs = pointsResult.data.filter(log => {
            const logDate = new Date(log.created_at);
            return logDate >= monthStart && logDate < monthEnd;
          });

          const earned = monthLogs
            .filter(log => log.points_change > 0)
            .reduce((sum, log) => sum + log.points_change, 0);

          const spent = monthLogs
            .filter(log => log.points_change < 0)
            .reduce((sum, log) => sum + Math.abs(log.points_change), 0);

          return {
            month: format(monthStart, 'MMM', { locale: fr }),
            earned,
            spent
          };
        });

        setMonthlyPoints(monthlyData);
      }
    } catch (error: any) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReward = async (formData: any) => {
    try {
      if (editingReward) {
        const { error } = await supabase
          .from('loyalty_rewards_catalog')
          .update(formData)
          .eq('id', editingReward.id);

        if (error) throw error;
        toast.success('Récompense mise à jour');
      } else {
        const { error } = await supabase
          .from('loyalty_rewards_catalog')
          .insert(formData);

        if (error) throw error;
        toast.success('Récompense créée');
      }

      setShowRewardModal(false);
      setEditingReward(null);
      loadData();
    } catch (error: any) {
      console.error('Erreur sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteReward = async (id: string) => {
    if (!confirm('Supprimer cette récompense ?')) return;

    try {
      const { error } = await supabase
        .from('loyalty_rewards_catalog')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Récompense supprimée');
      loadData();
    } catch (error: any) {
      console.error('Erreur suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Award className="w-8 h-8" style={{ color: 'var(--primary)' }} />
          Gestion Programme Fidélité
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Pilotage et administration du programme de fidélité
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 border">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8" style={{ color: 'var(--info)' }} />
          </div>
          <p className="text-3xl font-black mb-1" style={{ color: 'var(--info)' }}>
            {kpis.activeMembers}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Membres actifs
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8" style={{ color: 'var(--success)' }} />
          </div>
          <p className="text-3xl font-black mb-1" style={{ color: 'var(--success)' }}>
            {kpis.pointsIssuedMonth.toLocaleString()}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Points émis (ce mois)
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border">
          <div className="flex items-center justify-between mb-2">
            <Gift className="w-8 h-8" style={{ color: 'var(--warning)' }} />
          </div>
          <p className="text-3xl font-black mb-1" style={{ color: 'var(--warning)' }}>
            {kpis.pointsRedeemedMonth.toLocaleString()}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Points échangés (ce mois)
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="w-8 h-8" style={{ color: 'var(--primary)' }} />
          </div>
          <p className="text-3xl font-black mb-1" style={{ color: 'var(--primary)' }}>
            {kpis.engagementRate.toFixed(0)}%
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Taux d'engagement
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border mb-6">
        <div className="border-b flex">
          {[
            { id: 'members', label: 'Membres', icon: Users },
            { id: 'catalog', label: 'Catalogue', icon: Gift },
            { id: 'redemptions', label: 'Rédemptions', icon: Award },
            { id: 'stats', label: 'Statistiques', icon: BarChart3 }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`px-6 py-4 font-semibold flex items-center gap-2 ${
                activeTab === tab.id ? 'border-b-2' : ''
              }`}
              style={{
                borderColor: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)'
              }}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'members' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: 'var(--neutral-100)' }}>
                  <tr>
                    <th className="text-left p-4 font-semibold">Client</th>
                    <th className="text-center p-4 font-semibold">Points</th>
                    <th className="text-center p-4 font-semibold">Niveau</th>
                    <th className="text-center p-4 font-semibold">Voyages</th>
                    <th className="text-center p-4 font-semibold">Dernière activité</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-t hover:bg-gray-50">
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{member.full_name}</p>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {member.email}
                          </p>
                        </div>
                      </td>
                      <td className="p-4 text-center font-bold" style={{ color: 'var(--primary)' }}>
                        {(member.loyalty_points || 0).toLocaleString()}
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-3 py-1 rounded-full text-sm font-bold capitalize"
                              style={{
                                backgroundColor: 'var(--primary-light)',
                                color: 'var(--primary)'
                              }}>
                          {member.loyalty_tier || 'bronze'}
                        </span>
                      </td>
                      <td className="p-4 text-center font-medium">
                        {member.total_trips || 0}
                      </td>
                      <td className="p-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                        {member.updated_at ? format(new Date(member.updated_at), 'dd/MM/yyyy') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'catalog' && (
            <div>
              <div className="mb-6 flex justify-end">
                <button
                  onClick={() => {
                    setEditingReward(null);
                    setShowRewardModal(true);
                  }}
                  className="px-6 py-3 rounded-lg font-bold flex items-center gap-2"
                  style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                >
                  <Plus className="w-5 h-5" />
                  Nouvelle récompense
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rewards.map((reward) => (
                  <div key={reward.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold">{reward.name}</h3>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {reward.description}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          reward.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {reward.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </div>

                    <div className="mb-4">
                      <p className="text-2xl font-black" style={{ color: 'var(--primary)' }}>
                        {reward.points_required} pts
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Valable {reward.validity_days} jours
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingReward(reward);
                          setShowRewardModal(true);
                        }}
                        className="flex-1 py-2 rounded-lg border flex items-center justify-center gap-2"
                        style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                      >
                        <Edit2 className="w-4 h-4" />
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDeleteReward(reward.id)}
                        className="px-4 py-2 rounded-lg border border-red-300 text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'redemptions' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: 'var(--neutral-100)' }}>
                  <tr>
                    <th className="text-left p-4 font-semibold">Code</th>
                    <th className="text-left p-4 font-semibold">Client</th>
                    <th className="text-left p-4 font-semibold">Récompense</th>
                    <th className="text-center p-4 font-semibold">Points</th>
                    <th className="text-center p-4 font-semibold">Statut</th>
                    <th className="text-center p-4 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {redemptions.map((redemption) => (
                    <tr key={redemption.id} className="border-t hover:bg-gray-50">
                      <td className="p-4 font-mono text-sm">{redemption.redemption_code}</td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{redemption.customer?.full_name}</p>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {redemption.customer?.email}
                          </p>
                        </div>
                      </td>
                      <td className="p-4">{redemption.reward?.name}</td>
                      <td className="p-4 text-center font-bold" style={{ color: 'var(--primary)' }}>
                        {redemption.points_used}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className="px-3 py-1 rounded-full text-sm font-bold"
                          style={{
                            backgroundColor:
                              redemption.status === 'utilisee'
                                ? 'var(--success-light)'
                                : redemption.status === 'validee'
                                ? 'var(--info-light)'
                                : 'var(--neutral-200)',
                            color:
                              redemption.status === 'utilisee'
                                ? 'var(--success)'
                                : redemption.status === 'validee'
                                ? 'var(--info)'
                                : 'var(--text-secondary)'
                          }}
                        >
                          {redemption.status}
                        </span>
                      </td>
                      <td className="p-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                        {format(new Date(redemption.created_at), 'dd/MM/yyyy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold mb-4">Répartition par niveau</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={tierDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {tierDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="font-bold mb-4">Évolution des points (6 mois)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyPoints}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="earned" stroke="#0B7439" strokeWidth={2} name="Gagnés" />
                    <Line type="monotone" dataKey="spent" stroke="#AF3029" strokeWidth={2} name="Dépensés" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {showRewardModal && (
        <RewardModal
          reward={editingReward}
          onSave={handleSaveReward}
          onClose={() => {
            setShowRewardModal(false);
            setEditingReward(null);
          }}
        />
      )}
    </div>
  );
}

interface RewardModalProps {
  reward: any;
  onSave: (data: any) => void;
  onClose: () => void;
}

function RewardModal({ reward, onSave, onClose }: RewardModalProps) {
  const [formData, setFormData] = useState({
    name: reward?.name || '',
    description: reward?.description || '',
    points_required: reward?.points_required || 0,
    reward_type: reward?.reward_type || 'discount',
    reward_value: reward?.reward_value || 0,
    validity_days: reward?.validity_days || 30,
    is_active: reward?.is_active ?? true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-6">
          {reward ? 'Modifier la récompense' : 'Nouvelle récompense'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Nom</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-3 border rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Type</label>
              <select
                value={formData.reward_type}
                onChange={(e) => setFormData({ ...formData, reward_type: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="discount">Réduction</option>
                <option value="free_trip">Voyage gratuit</option>
                <option value="upgrade">Surclassement</option>
                <option value="voucher">Bon d'achat</option>
                <option value="gift">Cadeau</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-3 border rounded-lg"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Points requis</label>
              <input
                type="number"
                value={formData.points_required}
                onChange={(e) => setFormData({ ...formData, points_required: parseInt(e.target.value) })}
                className="w-full p-3 border rounded-lg"
                min="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Valeur</label>
              <input
                type="number"
                value={formData.reward_value}
                onChange={(e) => setFormData({ ...formData, reward_value: parseFloat(e.target.value) })}
                className="w-full p-3 border rounded-lg"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Validité (jours)</label>
              <input
                type="number"
                value={formData.validity_days}
                onChange={(e) => setFormData({ ...formData, validity_days: parseInt(e.target.value) })}
                className="w-full p-3 border rounded-lg"
                min="1"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              id="is_active"
              className="w-5 h-5"
            />
            <label htmlFor="is_active" className="font-semibold">Récompense active</label>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg font-bold border-2"
              style={{ borderColor: 'var(--neutral-300)' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-lg font-bold"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
