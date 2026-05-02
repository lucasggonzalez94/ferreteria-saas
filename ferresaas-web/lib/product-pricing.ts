export interface PricingValidationError {
  field: 'targetMargin' | 'targetMarkup' | 'marginPercent';
  message: string;
}

export function validateTargetMargin(
  value: string,
  mode: 'margin' | 'markup'
): PricingValidationError | null {
  if (!value) {
    return {
      field: mode === 'margin' ? 'targetMargin' : 'targetMarkup',
      message: mode === 'margin'
        ? 'El Margen Objetivo es requerido'
        : 'El Markup Objetivo es requerido',
    };
  }

  const numValue = Number(value);

  if (Number.isNaN(numValue)) {
    return {
      field: mode === 'margin' ? 'targetMargin' : 'targetMarkup',
      message: 'Ingresa un número válido',
    };
  }

  if (mode === 'margin') {
    if (numValue <= 0) {
      return {
        field: 'targetMargin',
        message: 'El margen debe ser mayor a 0% (ej: 37.5)',
      };
    }
    if (numValue >= 100) {
      return {
        field: 'targetMargin',
        message: 'El margen debe ser menor a 100%. Máximo 99.9%',
      };
    }
  } else {
    if (numValue <= 0) {
      return {
        field: 'targetMarkup',
        message: 'El markup debe ser mayor a 0% (ej: 60)',
      };
    }
  }

  return null;
}

export function validateMarginPercent(value: string): PricingValidationError | null {
  if (!value) return null;

  const numValue = Number(value);

  if (Number.isNaN(numValue)) {
    return {
      field: 'marginPercent',
      message: 'Ingresa un número válido',
    };
  }

  if (numValue < 0 || numValue >= 100) {
    return {
      field: 'marginPercent',
      message: 'El margen debe estar entre 0 y 100 (exclusivo)',
    };
  }

  return null;
}

export function calculateEquivalentMargin(markup: number): number {
  if (markup <= 0) return 0;
  return (markup / (markup + 100)) * 100;
}

export function calculateEquivalentMarkup(margin: number): number {
  if (margin >= 100) return Infinity;
  if (margin <= 0) return 0;
  return (margin / (100 - margin)) * 100;
}

export const PRICING_MODE_OPTIONS = [
  { value: 'margin', label: 'Margen (%)' },
  { value: 'markup', label: 'Markup (%)' },
] as const;

export const TAX_RATE_OPTIONS = [
  { value: '21', label: '21%' },
  { value: '10.5', label: '10.5%' },
  { value: '27', label: '27%' },
  { value: '0', label: '0%' },
] as const;

export const UNIT_OPTIONS = [
  { value: 'u', label: 'Unidad' },
  { value: 'kg', label: 'Kilogramo' },
  { value: 'g', label: 'Gramo' },
  { value: 'l', label: 'Litro' },
  { value: 'ml', label: 'Mililitro' },
  { value: 'm', label: 'Metro' },
  { value: 'cm', label: 'Centímetro' },
] as const;

export const ROUNDING_STEP_OPTIONS = [
  { value: '1', label: '1' },
  { value: '10', label: '10' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
] as const;

export const COST_METHOD_OPTIONS = [
  { value: 'avg_weighted', label: 'Promedio Ponderado' },
  { value: 'fifo', label: 'FIFO' },
  { value: 'lifo', label: 'LIFO' },
] as const;