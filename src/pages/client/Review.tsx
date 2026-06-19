import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Star, CheckCircle, TrendingUp } from 'lucide-react';

interface ReviewData {
  driver_id: string;
  schedule_id: string;
  driver_name: string;
  driver_avatar?: string;
  bus_license: string;
  current_rating: number;
  token_valid: boolean;
}

const QUALITY_OPTIONS = [
  'Conducteur serviable',
  'Conducteur poli',
  'Qualité conversationnelle',
  'Musique agréable',
  'Intérieur propre',
  'Conduite agréable'
];

export default function Review() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedQualities, setSelectedQualities] = useState<string[]>([]);
  const [phoneDistraction, setPhoneDistraction] = useState(false);
  const [comment, setComment] = useState('');
  const [pointsAwarded, setPointsAwarded] = useState(0);

  useEffect(() => {
    if (token) {
      loadReviewData();
    }
  }, [token]);

  const loadReviewData = async () => {
    try {
      setLoading(true);

      const { data: reviewRecord, error: reviewError } = await supabase
        .from('driver_reviews')
        .select('driver_id, schedule_id, token_used, customer_id')
        .eq('token', token)
        .maybeSingle();

      if (reviewError) throw reviewError;

      if (!reviewRecord) {
        toast.error('Lien de révision invalide');
        return;
      }

      if (reviewRecord.token_used) {
        toast.error('Ce lien a déjà été utilisé');
        return;
      }

      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select(`
          driver:driver_id (
            id,
            full_name,
            avatar_url,
            driver_avg_rating
          ),
          bus:bus_id (
            registration_number
          )
        `)
        .eq('id', reviewRecord.schedule_id)
        .single();

      if (scheduleError) throw scheduleError;

      setReviewData({
        driver_id: reviewRecord.driver_id,
        schedule_id: reviewRecord.schedule_id,
        driver_name: scheduleData.driver?.full_name || 'Chauffeur',
        driver_avatar: scheduleData.driver?.avatar_url,
        bus_license: scheduleData.bus?.registration_number || 'N/A',
        current_rating: scheduleData.driver?.driver_avg_rating || 0,
        token_valid: !reviewRecord.token_used
      });
    } catch (error: any) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const calculatePoints = (stars: number, qualities: string[], distracted: boolean) => {
    let points = stars * 10;
    points += qualities.length * 2;
    if (distracted) points -= 10;
    if (stars === 5) points += 5;
    return Math.max(0, points);
  };

  const handleQualityToggle = (quality: string) => {
    setSelectedQualities(prev => {
      if (prev.includes(quality)) {
        return prev.filter(q => q !== quality);
      } else {
        return [...prev, quality];
      }
    });
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Veuillez sélectionner une note');
      return;
    }

    try {
      setSubmitting(true);

      const points = calculatePoints(rating, selectedQualities, phoneDistraction);

      const { error: updateError } = await supabase
        .from('driver_reviews')
        .update({
          rating,
          qualities: selectedQualities,
          phone_distraction: phoneDistraction,
          comment: comment.trim() || null,
          points_awarded: points,
          token_used: true
        })
        .eq('token', token);

      if (updateError) throw updateError;

      setPointsAwarded(points);
      setSubmitted(true);
      toast.success('Merci pour votre évaluation !');
    } catch (error: any) {
      console.error('Erreur soumission:', error);
      toast.error('Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAF8' }}>
        <div className="w-12 h-12 border-4 rounded-full animate-spin"
             style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!reviewData || !reviewData.token_valid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F8FAF8' }}>
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center border">
          <p className="text-xl font-bold mb-2">Lien invalide</p>
          <p style={{ color: 'var(--text-secondary)' }}>
            Ce lien d'évaluation n'est plus valide ou a déjà été utilisé.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F8FAF8' }}>
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center border">
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
               style={{ backgroundColor: 'var(--success-light)' }}>
            <CheckCircle className="w-12 h-12" style={{ color: 'var(--success)' }} />
          </div>

          <h1 className="text-2xl font-bold mb-2">Merci !</h1>
          <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
            Votre évaluation a été enregistrée avec succès.
          </p>

          <div className="p-4 rounded-lg mb-6 animate-pulse"
               style={{ backgroundColor: 'var(--primary-light)' }}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              <p className="font-bold" style={{ color: 'var(--primary)' }}>
                Taux de succès augmenté +2
              </p>
            </div>
            <p className="text-sm" style={{ color: 'var(--primary)' }}>
              {pointsAwarded} points attribués au chauffeur
            </p>
          </div>

          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Votre avis nous aide à améliorer nos services.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: '#F8FAF8' }}>
      <div className="max-w-md mx-auto py-8">
        <div className="bg-white rounded-xl p-6 border mb-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-24 h-24 rounded-full mb-4 overflow-hidden"
                 style={{ backgroundColor: 'var(--neutral-200)' }}>
              {reviewData.driver_avatar ? (
                <img src={reviewData.driver_avatar} alt={reviewData.driver_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold"
                     style={{ color: 'var(--primary)' }}>
                  {reviewData.driver_name.charAt(0)}
                </div>
              )}
            </div>

            <h2 className="text-2xl font-bold mb-1">{reviewData.driver_name}</h2>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              Bus: {reviewData.bus_license}
            </p>

            <div className="flex items-center gap-2">
              <Star className="w-5 h-5" style={{ color: '#F59E0B', fill: '#F59E0B' }} />
              <span className="text-xl font-bold" style={{ color: '#F59E0B' }}>
                {reviewData.current_rating.toFixed(1)}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Note actuelle
              </span>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-bold mb-4 text-center">NOTER VOTRE VOYAGE</h3>

            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-all transform hover:scale-110"
                >
                  <Star
                    className="w-12 h-12 md:w-14 md:h-14"
                    style={{
                      color: (hoverRating || rating) >= star ? '#F59E0B' : '#D1D5DB',
                      fill: (hoverRating || rating) >= star ? '#F59E0B' : 'none',
                      cursor: 'pointer'
                    }}
                  />
                </button>
              ))}
            </div>

            <h3 className="font-bold mb-3">QU'EST-CE QUI VOUS A PLU ?</h3>
            <div className="flex flex-wrap gap-2 mb-6">
              {QUALITY_OPTIONS.map((quality) => (
                <button
                  key={quality}
                  onClick={() => handleQualityToggle(quality)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedQualities.includes(quality)
                      ? 'shadow-md'
                      : 'border'
                  }`}
                  style={{
                    backgroundColor: selectedQualities.includes(quality)
                      ? 'var(--primary)'
                      : 'white',
                    color: selectedQualities.includes(quality)
                      ? 'white'
                      : 'var(--text-primary)',
                    borderColor: selectedQualities.includes(quality)
                      ? 'var(--primary)'
                      : 'var(--border)'
                  }}
                >
                  {quality}
                </button>
              ))}
            </div>

            <h3 className="font-bold mb-3">QUESTION DE SÉCURITÉ</h3>
            <p className="mb-3" style={{ color: 'var(--text-secondary)' }}>
              Le conducteur était-il distrait par son téléphone ?
            </p>

            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setPhoneDistraction(false)}
                className={`flex-1 py-3 rounded-lg font-semibold border-2 transition-all ${
                  !phoneDistraction ? 'shadow-md' : ''
                }`}
                style={{
                  backgroundColor: !phoneDistraction ? 'var(--success)' : 'white',
                  color: !phoneDistraction ? 'white' : 'var(--text-primary)',
                  borderColor: !phoneDistraction ? 'var(--success)' : 'var(--border)'
                }}
              >
                ● Non
              </button>

              <button
                onClick={() => setPhoneDistraction(true)}
                className={`flex-1 py-3 rounded-lg font-semibold border-2 transition-all ${
                  phoneDistraction ? 'shadow-md' : ''
                }`}
                style={{
                  backgroundColor: phoneDistraction ? 'var(--danger)' : 'white',
                  color: phoneDistraction ? 'white' : 'var(--text-primary)',
                  borderColor: phoneDistraction ? 'var(--danger)' : 'var(--border)'
                }}
              >
                ● Oui
              </button>
            </div>

            {phoneDistraction && rating > 0 && (
              <div className="p-3 rounded-lg mb-6 animate-pulse"
                   style={{ backgroundColor: 'var(--warning-light)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--warning)' }}>
                  📈 Taux de succès réduit -10 points
                </p>
              </div>
            )}

            {!phoneDistraction && rating > 0 && (
              <div className="p-3 rounded-lg mb-6 animate-pulse"
                   style={{ backgroundColor: 'var(--success-light)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
                  📈 Taux de succès augmenté +2
                </p>
              </div>
            )}

            <h3 className="font-bold mb-2 flex items-center gap-2">
              📝 Votre commentaire reste anonyme
            </h3>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Partagez votre expérience... (optionnel)"
              className="w-full p-3 border rounded-lg resize-none"
              rows={4}
              style={{ backgroundColor: 'var(--neutral-50)' }}
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          style={{
            backgroundColor: rating === 0 ? 'var(--neutral-300)' : 'var(--primary)',
            color: 'white'
          }}
        >
          {submitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Envoi en cours...
            </>
          ) : (
            <>
              <CheckCircle className="w-6 h-6" />
              TERMINER
            </>
          )}
        </button>

        <p className="text-center text-sm mt-4" style={{ color: 'var(--text-secondary)' }}>
          Merci de prendre le temps d'évaluer votre voyage
        </p>
      </div>
    </div>
  );
}
