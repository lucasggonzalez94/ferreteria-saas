import { z } from 'zod';

// Abrir caja
export const openCashRegisterSchema = z.object({
  openingAmount: z.number().min(0),
});

export type OpenCashRegisterInput = z.infer<typeof openCashRegisterSchema>;

// Movimiento de caja
export const cashMovementSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive(),
  reason: z.string().min(1).max(500),
});

export type CashMovementInput = z.infer<typeof cashMovementSchema>;

// Cerrar caja
export const closeCashRegisterSchema = z.object({
  closingAmount: z.number().min(0),
  notes: z.string().max(1000).optional(),
});

export type CloseCashRegisterInput = z.infer<typeof closeCashRegisterSchema>;
