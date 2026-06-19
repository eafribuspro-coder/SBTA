import { useState } from 'react';
import { Wrench } from 'lucide-react';
import BreakdownRevenueReport from '../reports/BreakdownRevenueReport';
import BreakdownDistributions from './BreakdownDistributions';

const TABS = [
  { id: 'pannes', label: 'Rapport pannes' },
  { id: 'repartitions', label: 'Repartitions recettes' },
] as const;

type Tab = (typeof TABS)[number]['id'];

export default function BreakdownReport() {
  const [tab, setTab] = useState<Tab>('pannes');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Wrench className="w-6 h-6" style={{ color: '#DC2626' }} />
          Pannes & Repartitions
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Suivi consolide des pannes et repartition inter-societes
        </p>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={{
              borderBottomColor: tab === t.id ? '#DC2626' : 'transparent',
              color: tab === t.id ? '#DC2626' : 'var(--text-secondary)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="-mx-6 -mt-6">
        {tab === 'pannes' && <BreakdownRevenueReport />}
        {tab === 'repartitions' && <BreakdownDistributions />}
      </div>
    </div>
  );
}
