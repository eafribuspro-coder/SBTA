export function generateSecurePassword(length = 10): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const symbols = '@#$%&!';
  const all     = upper + lower + digits + symbols;

  const mandatory = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  const rest = Array.from(
    { length: length - mandatory.length },
    () => all[Math.floor(Math.random() * all.length)]
  );

  return [...mandatory, ...rest]
    .sort(() => Math.random() - 0.5)
    .join('');
}
