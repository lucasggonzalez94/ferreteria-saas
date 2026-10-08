export function canonicalCuit(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

/** CUIT/CUIL argentino con dígito verificador (módulo 11). */
export function validCuit(value: string): boolean {
  const digits = canonicalCuit(value);
  if (!/^\d{11}$/.test(digits)) return false;
  if (!/^(20|23|24|27|30|33|34)/.test(digits)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  const check = (11 - (sum % 11)) % 11;
  return check < 10 && check === Number(digits[10]);
}

export function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
