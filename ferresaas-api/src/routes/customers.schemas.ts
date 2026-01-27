import { z } from 'zod';

// Crear cliente
export const createCustomerSchema = z.object({
  type: z.enum(['PERSON', 'COMPANY']),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  companyName: z.string().min(1).max(200).optional(),
  cuit: z.string().max(20).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  creditLimit: z.number().min(0).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

// Actualizar cliente
export const updateCustomerSchema = z.object({
  type: z.enum(['PERSON', 'COMPANY']).optional(),
  firstName: z.string().min(1).max(100).nullable().optional(),
  lastName: z.string().min(1).max(100).nullable().optional(),
  companyName: z.string().min(1).max(200).nullable().optional(),
  cuit: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  creditLimit: z.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

// Registrar pago
export const createPaymentSchema = z.object({
  amount: z.number().positive(),
  notes: z.string().max(500).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
