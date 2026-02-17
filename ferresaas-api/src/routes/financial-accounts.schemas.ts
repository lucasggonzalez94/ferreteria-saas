import { z } from 'zod';

// Crear cuenta financiera
export const createFinancialAccountSchema = z.object({
  type: z.enum(['CASH', 'BANK', 'WALLET', 'CREDIT_CARD']),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  currency: z.string().length(3).default('ARS'),
  initialBalance: z.number().min(0).default(0),
  isDefault: z.boolean().default(false),
  bankName: z.string().max(100).optional(),
  accountNumber: z.string().max(50).optional(),
  walletProvider: z.string().max(50).optional(),
});

// Actualizar cuenta financiera
export const updateFinancialAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  bankName: z.string().max(100).optional(),
  accountNumber: z.string().max(50).optional(),
  walletProvider: z.string().max(50).optional(),
});

// Crear transferencia entre cuentas
export const createTransferSchema = z.object({
  fromAccountId: z.string().cuid(),
  toAccountId: z.string().cuid(),
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

// Crear movimiento manual
export const createMovementSchema = z.object({
  accountId: z.string().cuid(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});
