export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '— FCFA';
  }
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount)) + ' FCFA';
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('fr-FR').format(num);
}
