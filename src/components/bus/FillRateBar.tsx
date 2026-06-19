import React from 'react';

interface FillRateBarProps {
  current: number;
  total: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function FillRateBar({ current, total, showLabel = true, size = 'md' }: FillRateBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  const getColor = () => {
    if (percentage <= 40) return { bg: 'var(--danger)', text: 'Sous-rempli' };
    if (percentage <= 70) return { bg: 'var(--warning)', text: 'Acceptable' };
    if (percentage <= 90) return { bg: 'var(--success)', text: 'Bon' };
    return { bg: 'var(--primary-dark)', text: 'COMPLET' };
  };

  const { bg, text } = getColor();

  const heights = {
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem'
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-1">
        <div className="flex-1 rounded-full overflow-hidden" style={{
          backgroundColor: 'var(--neutral-200)',
          height: heights[size]
        }}>
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${percentage}%`,
              backgroundColor: bg
            }}
          />
        </div>
        <span className="font-bold text-sm" style={{ color: 'var(--text-primary)', minWidth: '3rem' }}>
          {percentage}%
        </span>
      </div>
      {showLabel && (
        <div className="flex justify-between items-center text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span>{current}/{total} sièges</span>
          <span className="font-medium" style={{ color: bg }}>
            {text}
          </span>
        </div>
      )}
    </div>
  );
}
