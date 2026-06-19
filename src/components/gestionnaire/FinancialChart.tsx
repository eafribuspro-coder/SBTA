import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

export interface MonthlyDataPoint {
  month: string;
  recettes: number;
  depenses: number;
  resultat: number;
}

export interface ExpenseByType {
  type: string;
  amount: number;
  color: string;
}

interface Props {
  monthlyData: MonthlyDataPoint[];
  expenseByType: ExpenseByType[];
}

const formatK = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return `${v}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-xl shadow-lg p-3 text-sm min-w-[180px]">
      <p className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
          </span>
          <span className="font-semibold tabular-nums" style={{ color: entry.color }}>
            {Number(entry.value).toLocaleString('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function FinancialChart({ monthlyData, expenseByType }: Props) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 bg-white rounded-xl border shadow-sm p-5">
        <h2 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
          Evolution Recettes vs Depenses
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>12 derniers mois</p>
        {monthlyData.length === 0 ? (
          <div className="h-56 flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucune donnee disponible</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRecettes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradDepenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradResultat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16A34A" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatK} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              <Area type="monotone" dataKey="recettes" name="Recettes" stroke="#1D4ED8" strokeWidth={2} fill="url(#gradRecettes)" dot={false} activeDot={{ r: 5 }} />
              <Area type="monotone" dataKey="depenses" name="Depenses" stroke="#DC2626" strokeWidth={2} fill="url(#gradDepenses)" dot={false} activeDot={{ r: 5 }} />
              <Area type="monotone" dataKey="resultat" name="Resultat net" stroke="#16A34A" strokeWidth={2} fill="url(#gradResultat)" dot={false} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h2 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
          Repartition des charges
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Mois en cours — par categorie</p>
        {expenseByType.length === 0 ? (
          <div className="h-56 flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucune charge ce mois</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={expenseByType} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <XAxis type="number" tickFormatter={formatK} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip
                  formatter={(v: number) => [v.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }), 'Montant']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={16}>
                  {expenseByType.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-2">
              {expenseByType.map((e, i) => {
                const total = expenseByType.reduce((s, x) => s + x.amount, 0);
                const pct = total > 0 ? (e.amount / total) * 100 : 0;
                return (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{e.type}</span>
                    </div>
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
