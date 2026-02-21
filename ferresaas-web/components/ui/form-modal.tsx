"use client";

import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
  submitText?: string;
  cancelText?: string;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

/**
 * Componente modal genérico para formularios.
 * Encapsula la estructura común de Dialog + Form + Footer.
 * 
 * @example
 * <FormModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Crear Producto"
 *   description="Completa los datos del producto"
 *   onSubmit={handleSubmit}
 *   isLoading={mutation.isPending}
 * >
 *   <div className="space-y-4">
 *     <div>
 *       <Label>Nombre</Label>
 *       <Input value={name} onChange={(e) => setName(e.target.value)} />
 *     </div>
 *   </div>
 * </FormModal>
 */
export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  isLoading = false,
  submitText = "Guardar",
  cancelText = "Cancelar",
  children,
  maxWidth = "md",
}: FormModalProps) {
  const maxWidthClasses = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={maxWidthClasses[maxWidth]}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form onSubmit={onSubmit}>
          {children}

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {cancelText}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Guardando..." : submitText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
