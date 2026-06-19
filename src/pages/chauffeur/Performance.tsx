import React from 'react';
import { useAuthStore } from '../../store/authStore';
import PerformanceBadge from '../../components/driver/PerformanceBadge';
import { Gauge } from 'lucide-react';

export default function ChauffeurPerformance() {
  const { user } = useAuthStore();

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
          <Gauge className="w-8 h-8" style={{ color: 'var(--primary)' }} />
          Ma performance
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Votre badge, vos points et les avis de vos passagers
        </p>
      </div>

      {user?.id && <PerformanceBadge driverId={user.id} />}
    </div>
  );
}
