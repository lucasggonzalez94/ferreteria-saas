import { useEffect, useRef, useCallback, useState } from 'react';

interface UseBarcodeScannerOptions {
  minLength?: number;
  maxTimeBetweenChars?: number;
  onBarcodeDetected?: (barcode: string) => void;
  enabled?: boolean;
  excludeInputs?: boolean;
}

interface UseBarcodeScannerReturn {
  inputBuffer: string;
  setInputBuffer: (value: string) => void;
  clearBuffer: () => void;
  isScanning: boolean;
}

/**
 * Hook reutilizable para detectar escaneos de código de barras.
 * 
 * Detecta escaneos por:
 * 1. Velocidad de entrada muy rápida (8+ caracteres en menos de maxTimeBetweenChars)
 * 2. Buffer acumulado que se procesa al presionar Enter
 * 
 * @example
 * const { inputBuffer, setInputBuffer, clearBuffer, isScanning } = useBarcodeScanner({
 *   minLength: 8,
 *   maxTimeBetweenChars: 300,
 *   onBarcodeDetected: (barcode) => console.log('Escaneado:', barcode),
 * });
 */
export function useBarcodeScanner({
  minLength = 8,
  maxTimeBetweenChars = 300,
  onBarcodeDetected,
  enabled = true,
  excludeInputs = true,
}: UseBarcodeScannerOptions = {}): UseBarcodeScannerReturn {
  const [inputBuffer, setInputBufferState] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const inputStartTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputBufferRef = useRef("");

  const clearBuffer = useCallback(() => {
    setInputBufferState("");
    inputStartTimeRef.current = null;
    inputBufferRef.current = "";
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const setInputBuffer = useCallback((value: string) => {
    const now = Date.now();
    
    if (value.length === 0) {
      clearBuffer();
      return;
    }
    
    // Primer carácter - iniciar timer
    if (inputBuffer.length === 0) {
      inputStartTimeRef.current = now;
    }
    
    // Verificar si es un escaneo por velocidad (dentro del input)
    if (value.length >= minLength && inputStartTimeRef.current) {
      const timeSinceStart = now - inputStartTimeRef.current;
      if (timeSinceStart < maxTimeBetweenChars) {
        setIsScanning(true);
        onBarcodeDetected?.(value);
        clearBuffer();
        setIsScanning(false);
        return;
      }
    }
    
    setInputBufferState(value);
  }, [inputBuffer.length, minLength, maxTimeBetweenChars, onBarcodeDetected, clearBuffer]);

  // Listener global para capturar escaneos cuando no hay input enfocado
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      
      // Ignorar si hay un input activo (a menos que excludeInputs sea false)
      if (excludeInputs) {
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      const now = Date.now();
      const key = event.key;

      if (key === "Enter") {
        if (inputBufferRef.current.length >= minLength && inputStartTimeRef.current) {
          const timeSinceStart = now - inputStartTimeRef.current;
          if (timeSinceStart < maxTimeBetweenChars) {
            setIsScanning(true);
            onBarcodeDetected?.(inputBufferRef.current);
            clearBuffer();
            setIsScanning(false);
          }
        }
        inputBufferRef.current = "";
        inputStartTimeRef.current = null;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        return;
      }

      if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (inputBufferRef.current.length === 0) {
          inputStartTimeRef.current = now;
        }

        inputBufferRef.current += key;

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          const timeSinceStart = now - (inputStartTimeRef.current || now);

          if (inputBufferRef.current.length >= minLength && timeSinceStart < maxTimeBetweenChars) {
            setIsScanning(true);
            onBarcodeDetected?.(inputBufferRef.current);
            clearBuffer();
            setIsScanning(false);
          }

          inputBufferRef.current = "";
          inputStartTimeRef.current = null;
        }, 100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, excludeInputs, minLength, maxTimeBetweenChars, onBarcodeDetected, clearBuffer]);

  return {
    inputBuffer,
    setInputBuffer,
    clearBuffer,
    isScanning,
  };
}