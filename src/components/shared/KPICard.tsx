import { Video as LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

export default function KPICard({ title, value, icon: Icon, trend, color = 'primary' }: KPICardProps) {
  const colorClasses = {
    primary: 'var(--primary)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
    info: 'var(--info)',
  };

  const bgClasses = {
    primary: 'var(--primary-light)',
    success: 'var(--success-light)',
    warning: 'var(--warning-light)',
    danger: 'var(--danger-light)',
    info: 'var(--info-light)',
  };

  return (
    <div className="rounded-lg p-6 shadow-sm border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            {title}
          </p>
          <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {value}
          </p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.isPositive ? (
                <TrendingUp className="w-4 h-4" style={{ color: 'var(--success)' }} />
              ) : (
                <TrendingDown className="w-4 h-4" style={{ color: 'var(--danger)' }} />
              )}
              <span
                className="text-sm font-medium"
                style={{ color: trend.isPositive ? 'var(--success)' : 'var(--danger)' }}
              >
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
            </div>
          )}
        </div>
        <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: bgClasses[color] }}>
          <Icon className="w-6 h-6" style={{ color: colorClasses[color] }} />
        </div>
      </div>
    </div>
  );
}
