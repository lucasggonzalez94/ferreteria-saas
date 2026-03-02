import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useBarcodeModal } from '@/lib/contexts/barcode-context';
import type { Product } from '@/types';

/**
 * Hook para escuchar escaneos de código de barras globalmente
 * Solo activo cuando NO estamos en la página de POS
 */
export function useGlobalBarcodeListener() {
  const pathname = usePathname();
  const { openModal, setLoading } = useBarcodeModal();
  const inputBufferRef = useRef<string>('');
  const inputStartTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isInPOS = pathname === '/dashboard/pos';

  const searchProduct = useCallback(
    async (barcode: string) => {
      try {
        setLoading(true);
        const response = await api.get<Product[]>('/products', {
          params: {
            q: barcode,
            active: true,
          },
        });

        const products = response.data || [];
        
        if (products.length === 1) {
          openModal(products[0]);
        }
      } catch (error) {
        console.error('Error searching product:', error);
      } finally {
        setLoading(false);
      }
    },
    [openModal, setLoading]
  );

  useEffect(() => {
    if (isInPOS) {
      return;
    }

    const handleKeyPress = (event: KeyboardEvent) => {
      const now = Date.now();
      const key = event.key;

      if (key === 'Enter') {
        if (inputBufferRef.current.length >= 8) {
          const barcode = inputBufferRef.current;
          searchProduct(barcode);
        }
        inputBufferRef.current = '';
        inputStartTimeRef.current = null;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        return;
      }

      if (key.length === 1) {
        if (inputBufferRef.current.length === 0) {
          inputStartTimeRef.current = now;
        }

        inputBufferRef.current += key;

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          const timeSinceStart = now - (inputStartTimeRef.current || now);
          
          if (inputBufferRef.current.length >= 8 && timeSinceStart < 500) {
            const barcode = inputBufferRef.current;
            searchProduct(barcode);
          }
          
          inputBufferRef.current = '';
          inputStartTimeRef.current = null;
        }, 100);
      }
    };

    window.addEventListener('keypress', handleKeyPress);

    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isInPOS, searchProduct]);
}
