"use client";

import { useBarcodeModal } from "@/lib/contexts/barcode-context";
import { UnknownBarcodeModal } from "@/components/pos/unknown-barcode-modal";
import type { Product } from "@/types";

export function GlobalUnknownBarcodeModal() {
  const {
    unknownBarcode,
    isUnknownBarcodeOpen,
    closeUnknownBarcodeModal,
    openModal,
  } = useBarcodeModal();

  const handleProductResolved = (product: Product) => {
    closeUnknownBarcodeModal();
    openModal(product);
  };

  return (
    <UnknownBarcodeModal
      isOpen={isUnknownBarcodeOpen}
      barcode={unknownBarcode}
      onClose={closeUnknownBarcodeModal}
      onProductCreated={handleProductResolved}
      onProductAssigned={handleProductResolved}
    />
  );
}
