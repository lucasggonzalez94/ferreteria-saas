import { useRef, useCallback } from 'react';

interface BarcodeDetectionResult {
  isBarcodeScan: boolean;
  value: string;
}

/**
 * Hook para detectar si una entrada es un escaneo de código de barras
 * o una entrada manual del usuario.
 * 
 * Detecta escaneos por:
 * 1. Velocidad de entrada muy rápida (8+ caracteres en menos de 300ms)
 * 2. Patrón consistente de entrada sin pausas
 */
export function useBarcodeDetection() {
  const inputStartTimeRef = useRef<number | null>(null);
  const charCountRef = useRef<number>(0);
  const lastCharTimeRef = useRef<number | null>(null);
  const charTimingsRef = useRef<number[]>([]);

  const handleInputChange = useCallback(
    (value: string): BarcodeDetectionResult => {
      const now = Date.now();
      const currentCharCount = value.length;
      const previousCharCount = charCountRef.current;

      // Inicializar si es el primer carácter
      if (previousCharCount === 0) {
        inputStartTimeRef.current = now;
        charCountRef.current = currentCharCount;
        lastCharTimeRef.current = now;
        charTimingsRef.current = [0];
        return { isBarcodeScan: false, value };
      }

      // Si se borraron caracteres, resetear
      if (currentCharCount < previousCharCount) {
        inputStartTimeRef.current = now;
        charCountRef.current = currentCharCount;
        lastCharTimeRef.current = now;
        charTimingsRef.current = [0];
        return { isBarcodeScan: false, value };
      }

      // Registrar tiempo entre caracteres
      const timeSinceLastChar = now - (lastCharTimeRef.current || now);
      charTimingsRef.current.push(timeSinceLastChar);

      charCountRef.current = currentCharCount;
      lastCharTimeRef.current = now;

      // Detectar escaneo: 8+ caracteres en menos de 300ms
      const timeSinceStart = now - (inputStartTimeRef.current || now);
      const isBarcodeScan = currentCharCount >= 8 && timeSinceStart < 300;

      return { isBarcodeScan, value };
    },
    []
  );

  const reset = useCallback(() => {
    inputStartTimeRef.current = null;
    charCountRef.current = 0;
    lastCharTimeRef.current = null;
    charTimingsRef.current = [];
  }, []);

  return { handleInputChange, reset };
}
