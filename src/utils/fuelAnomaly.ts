export interface FuelAnomaly {
  type: 'variance' | 'price' | 'capacity';
  severity: 'low' | 'moderate' | 'critical';
  message: string;
  blockValidation: boolean;
}

export interface FuelVoucherData {
  estimated_liters: number;
  estimated_unit_price: number;
  estimated_amount: number;
  actual_liters?: number;
  actual_unit_price?: number;
  actual_amount?: number;
  bus_tank_capacity?: number;
}

export function detectFuelAnomalies(voucher: FuelVoucherData): FuelAnomaly[] {
  const anomalies: FuelAnomaly[] = [];

  if (!voucher.actual_liters || !voucher.actual_unit_price || !voucher.actual_amount) {
    return anomalies;
  }

  const variancePercent = ((voucher.actual_amount - voucher.estimated_amount) / voucher.estimated_amount) * 100;
  const priceVariancePercent = ((voucher.actual_unit_price - voucher.estimated_unit_price) / voucher.estimated_unit_price) * 100;

  if (variancePercent > 30) {
    anomalies.push({
      type: 'variance',
      severity: 'critical',
      message: `Écart critique de ${variancePercent.toFixed(1)}% par rapport à l'estimation`,
      blockValidation: true
    });
  } else if (variancePercent > 15) {
    anomalies.push({
      type: 'variance',
      severity: 'moderate',
      message: `Écart modéré de ${variancePercent.toFixed(1)}% par rapport à l'estimation`,
      blockValidation: false
    });
  }

  if (priceVariancePercent > 10) {
    anomalies.push({
      type: 'price',
      severity: 'moderate',
      message: `Prix unitaire anormal : ${priceVariancePercent.toFixed(1)}% au-dessus du prix de référence`,
      blockValidation: false
    });
  }

  if (voucher.bus_tank_capacity && voucher.actual_liters > voucher.bus_tank_capacity) {
    anomalies.push({
      type: 'capacity',
      severity: 'critical',
      message: `Quantité supérieure à la capacité du réservoir (${voucher.bus_tank_capacity}L)`,
      blockValidation: true
    });
  }

  return anomalies;
}

export function getAnomalySeverityColor(severity: FuelAnomaly['severity']): string {
  switch (severity) {
    case 'critical':
      return 'var(--danger)';
    case 'moderate':
      return 'var(--warning)';
    case 'low':
      return 'var(--info)';
    default:
      return 'var(--text-secondary)';
  }
}

export function getAnomalySeverityBg(severity: FuelAnomaly['severity']): string {
  switch (severity) {
    case 'critical':
      return 'var(--danger-light)';
    case 'moderate':
      return 'var(--warning-light)';
    case 'low':
      return 'var(--info-light)';
    default:
      return 'var(--neutral-100)';
  }
}

export function getAnomalySeverityLabel(severity: FuelAnomaly['severity']): string {
  switch (severity) {
    case 'critical':
      return 'Anomalie grave';
    case 'moderate':
      return 'Anomalie modérée';
    case 'low':
      return 'Attention';
    default:
      return 'Info';
  }
}

export function calculateVariancePercent(estimated: number, actual: number): number {
  if (estimated === 0) return 0;
  return ((actual - estimated) / estimated) * 100;
}
