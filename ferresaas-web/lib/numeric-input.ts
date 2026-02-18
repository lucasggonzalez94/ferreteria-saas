/**
 * Utility para normalizar y parsear números desde inputs de texto
 * Soporta múltiples formatos de separadores decimales y de miles:
 * - 100.000,50 (formato europeo/argentino)
 * - 100,000.50 (formato estadounidense)
 * - 100000.50 (sin separadores)
 * - 100000,50 (variante)
 */

export function parseNumericInput(value: string | number): number {
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }

  if (!value || typeof value !== 'string') {
    return 0;
  }

  // Limpiar espacios
  let cleaned = value.trim();

  if (!cleaned) {
    return 0;
  }

  // Detectar el formato del número
  // Contar puntos y comas para determinar cuál es el separador decimal
  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;

  // Caso 1: Tiene tanto puntos como comas
  if (dotCount > 0 && commaCount > 0) {
    // El último separador es el decimal
    const lastDotIndex = cleaned.lastIndexOf('.');
    const lastCommaIndex = cleaned.lastIndexOf(',');

    if (lastDotIndex > lastCommaIndex) {
      // Formato: 100.000,50 o 100,000.50 (punto es decimal)
      // Remover comas (separadores de miles)
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // Formato: 100.000,50 (coma es decimal)
      // Remover puntos (separadores de miles)
      cleaned = cleaned.replace(/\./g, '');
      // Reemplazar coma por punto para parseFloat
      cleaned = cleaned.replace(',', '.');
    }
  } else if (dotCount > 1) {
    // Múltiples puntos: 100.000.50 (puntos son separadores de miles)
    cleaned = cleaned.replace(/\./g, '');
  } else if (commaCount > 1) {
    // Múltiples comas: 100,000,50 (comas son separadores de miles)
    cleaned = cleaned.replace(/,/g, '');
  } else if (commaCount === 1 && dotCount === 0) {
    // Una coma, sin puntos: podría ser 100,50 (decimal) o 100,000 (miles)
    // Si la coma está a 3 posiciones del final, probablemente es decimal
    const commaPosition = cleaned.indexOf(',');
    const digitsAfterComma = cleaned.length - commaPosition - 1;

    if (digitsAfterComma === 2) {
      // Probablemente es decimal (100,50)
      cleaned = cleaned.replace(',', '.');
    } else if (digitsAfterComma === 3) {
      // Probablemente es separador de miles (100,000)
      cleaned = cleaned.replace(',', '');
    } else {
      // Asumir que es decimal
      cleaned = cleaned.replace(',', '.');
    }
  } else if (dotCount === 1 && commaCount === 0) {
    // Un punto, sin comas: 100.50 (decimal)
    // No hacer nada, parseFloat lo maneja
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formatea un número para mostrar en UI
 * @param value - Número a formatear
 * @param decimals - Cantidad de decimales (default: 2)
 * @param locale - Locale para formato (default: 'es-AR')
 */
export function formatNumericDisplay(
  value: number | string,
  decimals: number = 2,
  locale: string = 'es-AR'
): string {
  const num = typeof value === 'string' ? parseNumericInput(value) : value;

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Valida si un string es un número válido
 */
export function isValidNumericInput(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const parsed = parseNumericInput(value);
  return !isNaN(parsed) && isFinite(parsed);
}

/**
 * Obtiene el número de decimales de un input
 */
export function getDecimalPlaces(value: string): number {
  if (!value) return 0;

  const parsed = parseNumericInput(value);
  const stringValue = parsed.toString();

  if (stringValue.includes('.')) {
    return stringValue.split('.')[1].length;
  }

  return 0;
}
