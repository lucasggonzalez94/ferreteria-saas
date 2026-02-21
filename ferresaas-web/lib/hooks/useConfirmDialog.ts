"use client";

import { useState } from "react";

interface ConfirmDialogState<T = any> {
  open: boolean;
  data: T | null;
}

interface UseConfirmDialogReturn<T = any> {
  isOpen: boolean;
  data: T | null;
  open: (data: T) => void;
  close: () => void;
  reset: () => void;
}

/**
 * Hook para manejar diálogos de confirmación con datos asociados.
 * Simplifica el manejo de estado para modales de confirmación.
 * 
 * @example
 * const deleteDialog = useConfirmDialog<{ id: string; name: string }>();
 * 
 * // Abrir diálogo
 * deleteDialog.open({ id: "123", name: "Producto X" });
 * 
 * // En el componente
 * <ConfirmDialog
 *   open={deleteDialog.isOpen}
 *   onOpenChange={(open) => !open && deleteDialog.close()}
 *   onConfirm={() => handleDelete(deleteDialog.data?.id)}
 *   title="Eliminar Producto"
 *   description={`¿Eliminar "${deleteDialog.data?.name}"?`}
 * />
 */
export function useConfirmDialog<T = any>(): UseConfirmDialogReturn<T> {
  const [state, setState] = useState<ConfirmDialogState<T>>({
    open: false,
    data: null,
  });

  const open = (data: T) => {
    setState({ open: true, data });
  };

  const close = () => {
    setState((prev) => ({ ...prev, open: false }));
  };

  const reset = () => {
    setState({ open: false, data: null });
  };

  return {
    isOpen: state.open,
    data: state.data,
    open,
    close,
    reset,
  };
}
