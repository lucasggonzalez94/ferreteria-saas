"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { Product } from '@/types';

interface BarcodeContextState {
  isOpen: boolean;
  product: Product | null;
  unknownBarcode: string;
  isUnknownBarcodeOpen: boolean;
  isLoading: boolean;
  openModal: (product: Product) => void;
  closeModal: () => void;
  openUnknownBarcodeModal: (barcode: string) => void;
  closeUnknownBarcodeModal: () => void;
  setLoading: (loading: boolean) => void;
}

const BarcodeContext = createContext<BarcodeContextState | undefined>(undefined);

export function BarcodeProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState('');
  const [isUnknownBarcodeOpen, setIsUnknownBarcodeOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const openModal = (product: Product) => {
    setIsUnknownBarcodeOpen(false);
    setUnknownBarcode('');
    setProduct(product);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setTimeout(() => setProduct(null), 300);
  };

  const openUnknownBarcodeModal = (barcode: string) => {
    setIsOpen(false);
    setProduct(null);
    setUnknownBarcode(barcode);
    setIsUnknownBarcodeOpen(true);
  };

  const closeUnknownBarcodeModal = () => {
    setIsUnknownBarcodeOpen(false);
    setUnknownBarcode('');
  };

  const setLoading = (loading: boolean) => {
    setIsLoading(loading);
  };

  return (
    <BarcodeContext.Provider
      value={{
        isOpen,
        product,
        unknownBarcode,
        isUnknownBarcodeOpen,
        isLoading,
        openModal,
        closeModal,
        openUnknownBarcodeModal,
        closeUnknownBarcodeModal,
        setLoading,
      }}
    >
      {children}
    </BarcodeContext.Provider>
  );
}

export function useBarcodeModal() {
  const context = useContext(BarcodeContext);
  if (context === undefined) {
    throw new Error('useBarcodeModal must be used within a BarcodeProvider');
  }
  return context;
}
