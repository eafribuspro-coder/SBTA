import React from 'react';
import { Calendar } from 'lucide-react';
import { PeriodFilter as PeriodType } from '../../utils/reportHelpers';

interface Props {
  value: PeriodType;
  onChange: (period: PeriodType) => void;
  customStart?: string;
  customEnd?: string;
  onCustomStartChange?: (date: string) => void;
  onCustomEndChange?: (date: string) => void;
}

export default function PeriodFilter({
  value,
  onChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange
}: Props) {
  const periods: { value: PeriodType; label: string }[] = [
    { value: 'today', label: "Aujourd'hui" },
    { value: 'week', label: 'Cette semaine' },
    { value: 'month', label: 'Ce mois' },
    { value: 'quarter', label: 'Ce trimestre' },
    { value: 'year', label: 'Cette année' },
    { value: 'custom', label: 'Personnalisé' }
  ];

  return (
    <div className="bg-white rounded-xl p-4 border">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-5 h-5" style={{ color: 'var(--primary)' }} />
        <span className="font-semibold">Période</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {periods.map((period) => (
          <button
            key={period.value}
            onClick={() => onChange(period.value)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              value === period.value
                ? 'shadow-md'
                : 'border'
            }`}
            style={{
              backgroundColor: value === period.value ? 'var(--primary)' : 'white',
              color: value === period.value ? 'white' : 'var(--text-primary)',
              borderColor: value === period.value ? 'var(--primary)' : 'var(--neutral-300)'
            }}
          >
            {period.label}
          </button>
        ))}
      </div>

      {value === 'custom' && onCustomStartChange && onCustomEndChange && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold mb-2">Date début</label>
            <input
              type="date"
              value={customStart || ''}
              onChange={(e) => onCustomStartChange(e.target.value)}
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Date fin</label>
            <input
              type="date"
              value={customEnd || ''}
              onChange={(e) => onCustomEndChange(e.target.value)}
              className="w-full p-2 border rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
