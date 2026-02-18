import { useState, useCallback } from 'react';
import { parseNumericInput, formatNumericDisplay } from '@/lib/numeric-input';

interface UseNumericInputOptions {
  initialValue?: number | string;
  decimals?: number;
  min?: number;
  max?: number;
  onValidChange?: (value: number) => void;
  allowNegative?: boolean;
}

/**
 * Hook personalizado para manejar inputs numéricos con normalización automática
 * Soporta múltiples formatos de separadores decimales
 */
export function useNumericInput(options: UseNumericInputOptions = {}) {
  const {
    initialValue = '',
    decimals = 2,
    min,
    max,
    onValidChange,
    allowNegative = false,
  } = options;

  const [displayValue, setDisplayValue] = useState<string>(
    initialValue ? String(initialValue) : ''
  );

  const getParsedValue = useCallback((): number => {
    return parseNumericInput(displayValue);
  }, [displayValue]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      setDisplayValue(inputValue);
    },
    []
  );

  const handleBlur = useCallback(() => {
    const parsed = parseNumericInput(displayValue);

    // Validar rango
    let finalValue = parsed;

    if (!allowNegative && finalValue < 0) {
      finalValue = 0;
    }

    if (min !== undefined && finalValue < min) {
      finalValue = min;
    }

    if (max !== undefined && finalValue > max) {
      finalValue = max;
    }

    // Redondear a los decimales especificados
    finalValue = Math.round(finalValue * Math.pow(10, decimals)) / Math.pow(10, decimals);

    // Actualizar display con el valor normalizado
    setDisplayValue(finalValue.toString());

    // Llamar callback si el valor es válido
    if (onValidChange && !isNaN(finalValue)) {
      onValidChange(finalValue);
    }
  }, [displayValue, decimals, min, max, allowNegative, onValidChange]);

  const setValue = useCallback((value: number | string) => {
    if (typeof value === 'number') {
      setDisplayValue(value.toString());
    } else {
      setDisplayValue(value);
    }
  }, []);

  const reset = useCallback(() => {
    setDisplayValue(initialValue ? String(initialValue) : '');
  }, [initialValue]);

  return {
    displayValue,
    parsedValue: getParsedValue(),
    handleChange,
    handleBlur,
    setValue,
    reset,
    isValid: !isNaN(getParsedValue()),
  };
}
