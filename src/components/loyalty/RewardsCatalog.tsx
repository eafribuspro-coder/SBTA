import React, { useState } from 'react';
import { Gift, X, Check, Calendar } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Reward {
  id: string;
  name: string;
  description: string;
  points_required: number;
  reward_type: string;
  reward_value: number;
  validity_days: number;
  image_url?: string;
}

interface Redemption {
  redemption_code: string;
  reward_name: string;
  expires_at: string;
  points_used: number;
}

interface Props {
  rewards: Reward[];
  userPoints: number;
  onRedeem: (rewardId: string) => Promise<Redemption>;
}

export default function RewardsCatalog({ rewards, userPoints, onRedeem }: Props) {
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [redemption, setRedemption] = useState<Redemption | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  const handleRedeemClick = (reward: Reward) => {
    setSelectedReward(reward);
    setShowConfirm(true);
  };

  const handleConfirmRedeem = async () => {
    if (!selectedReward) return;

    try {
      setRedeeming(true);
      const result = await onRedeem(selectedReward.id);
      setRedemption(result);
      setShowConfirm(false);
      setShowSuccess(true);
    } catch (error: any) {
      console.error('Erreur échange:', error);
    } finally {
      setRedeeming(false);
    }
  };

  const getRewardTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      discount: 'Réduction',
      free_trip: 'Voyage gratuit',
      upgrade: 'Surclassement',
      voucher: 'Bon d\'achat',
      gift: 'Cadeau'
    };
    return types[type] || type;
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rewards.map((reward) => {
          const canRedeem = userPoints >= reward.points_required;

          return (
            <div
              key={reward.id}
              className={`bg-white rounded-xl border overflow-hidden ${
                canRedeem ? 'shadow-lg' : 'opacity-75'
              }`}
            >
              <div className="aspect-video relative overflow-hidden"
                   style={{ backgroundColor: 'var(--neutral-100)' }}>
                {reward.image_url ? (
                  <img
                    src={reward.image_url}
                    alt={reward.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gift className="w-16 h-16" style={{ color: 'var(--neutral-400)' }} />
                  </div>
                )}

                {canRedeem && (
                  <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold shadow-lg"
                       style={{ backgroundColor: 'var(--success)', color: 'white' }}>
                    ✓ Vous pouvez échanger
                  </div>
                )}

                <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full text-xs font-bold"
                     style={{
                       backgroundColor: 'rgba(0,0,0,0.7)',
                       color: 'white'
                     }}>
                  {getRewardTypeLabel(reward.reward_type)}
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-bold text-lg mb-2">{reward.name}</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  {reward.description}
                </p>

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-2xl font-black" style={{ color: 'var(--primary)' }}>
                      {reward.points_required}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      points requis
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold">Validité</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {reward.validity_days} jours
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleRedeemClick(reward)}
                  disabled={!canRedeem}
                  className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${
                    canRedeem ? 'shadow-md' : 'cursor-not-allowed'
                  }`}
                  style={{
                    backgroundColor: canRedeem ? 'var(--primary)' : 'var(--neutral-300)',
                    color: 'white'
                  }}
                >
                  <Gift className="w-5 h-5" />
                  {canRedeem ? 'Échanger' : `${reward.points_required - userPoints} pts manquants`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showConfirm && selectedReward && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
             onClick={() => !redeeming && setShowConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full"
               onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-4">Confirmer l'échange</h2>

            <div className="mb-6">
              <p className="mb-4">Vous êtes sur le point d'échanger :</p>

              <div className="p-4 rounded-lg border mb-4">
                <p className="font-bold text-lg mb-2">{selectedReward.name}</p>
                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {selectedReward.description}
                </p>

                <div className="flex justify-between items-center">
                  <span className="font-bold" style={{ color: 'var(--primary)' }}>
                    -{selectedReward.points_required} points
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Nouveau solde: {userPoints - selectedReward.points_required} pts
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg"
                   style={{ backgroundColor: 'var(--info-light)' }}>
                <p className="text-sm" style={{ color: 'var(--info)' }}>
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Valable {selectedReward.validity_days} jours après l'échange
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={redeeming}
                className="flex-1 py-3 rounded-lg font-bold border-2"
                style={{ borderColor: 'var(--neutral-300)', color: 'var(--text-primary)' }}
              >
                Annuler
              </button>

              <button
                onClick={handleConfirmRedeem}
                disabled={redeeming}
                className="flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--primary)', color: 'white' }}
              >
                {redeeming ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Échange...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Confirmer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && redemption && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
             onClick={() => setShowSuccess(false)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full"
               onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                   style={{ backgroundColor: 'var(--success-light)' }}>
                <Check className="w-12 h-12" style={{ color: 'var(--success)' }} />
              </div>

              <h2 className="text-2xl font-bold mb-2">Échange réussi !</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Votre récompense a été activée
              </p>
            </div>

            <div className="p-6 rounded-xl border mb-6 text-center">
              <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                Code de rédemption
              </p>

              <p className="text-3xl font-black mb-4 tracking-wider"
                 style={{ color: 'var(--primary)' }}>
                {redemption.redemption_code}
              </p>

              <div className="flex justify-center mb-4">
                <div className="p-4 bg-white rounded-lg border">
                  <QRCodeSVG value={redemption.redemption_code} size={150} />
                </div>
              </div>

              <div className="p-3 rounded-lg"
                   style={{ backgroundColor: 'var(--warning-light)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--warning)' }}>
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Valable jusqu'au {format(new Date(redemption.expires_at), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg mb-6"
                 style={{ backgroundColor: 'var(--info-light)' }}>
              <p className="text-sm" style={{ color: 'var(--info)' }}>
                💡 Présentez ce code au guichet pour utiliser votre récompense.
                Vous pouvez également le retrouver dans votre historique.
              </p>
            </div>

            <button
              onClick={() => setShowSuccess(false)}
              className="w-full py-3 rounded-lg font-bold"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
