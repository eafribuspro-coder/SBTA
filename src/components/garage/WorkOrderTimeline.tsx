import React from 'react';
import { format } from 'date-fns';
import { CheckCircle } from 'lucide-react';

interface TimelineEvent {
  status: string;
  timestamp: string;
  actor?: string;
  description: string;
}

interface WorkOrderTimelineProps {
  events: TimelineEvent[];
}

const STATUS_CONFIG: Record<string, { color: string; emoji: string; label: string }> = {
  reported: { color: '#DC2626', emoji: '🔴', label: 'En panne route' },
  received: { color: '#F59E0B', emoji: '🟠', label: 'Réception garage' },
  in_diagnostic: { color: '#EAB308', emoji: '🟡', label: 'En diagnostic' },
  awaiting_work_order: { color: '#EAB308', emoji: '🟡', label: 'En attente OT' },
  in_maintenance: { color: '#3B82F6', emoji: '🔵', label: 'En maintenance' },
  quality_control: { color: '#8B5CF6', emoji: '🟣', label: 'Contrôle qualité' },
  disponible: { color: '#10B981', emoji: '🟢', label: 'Disponible' }
};

export default function WorkOrderTimeline({ events }: WorkOrderTimelineProps) {
  return (
    <div className="bg-white rounded-xl p-6 border">
      <h3 className="font-bold mb-6">Timeline du workflow</h3>

      <div className="relative">
        {events.map((event, index) => {
          const config = STATUS_CONFIG[event.status] || {
            color: '#6B7280',
            emoji: '⚪',
            label: event.status
          };

          const isLast = index === events.length - 1;

          return (
            <div key={index} className="relative pb-8 last:pb-0">
              {!isLast && (
                <div
                  className="absolute left-6 top-12 w-0.5 h-full -ml-px"
                  style={{ backgroundColor: '#E5E7EB' }}
                />
              )}

              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0 relative z-10"
                  style={{ backgroundColor: config.color + '20' }}
                >
                  <span>{config.emoji}</span>
                </div>

                <div className="flex-1 pt-1">
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="font-bold" style={{ color: config.color }}>
                      {config.label}
                    </h4>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {format(new Date(event.timestamp), 'dd MMM HH:mm')}
                    </span>
                  </div>

                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {event.description}
                  </p>

                  {event.actor && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      Par: {event.actor}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {events.length === 0 && (
        <div className="text-center py-8">
          <p style={{ color: 'var(--text-secondary)' }}>Aucun événement</p>
        </div>
      )}
    </div>
  );
}
