import { z } from 'zod';

// Crear proveedor
export const createSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  cuit: z.string().max(20).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  paymentTerms: z.string().max(100).optional(),
  paymentMethods: z.string().optional(), // JSON string
  creditLimit: z.number().positive().optional(),
  contactName: z.string().max(200).optional(),
  contactPhone: z.string().max(50).optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

// Actualizar proveedor
export const updateSupplierSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  cuit: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  paymentTerms: z.string().max(100).nullable().optional(),
  paymentMethods: z.string().nullable().optional(),
  creditLimit: z.number().positive().nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  contactPhone: z.string().max(50).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

// Crear compra
export const createPurchaseSchema = z.object({
  supplierId: z.string().cuid(),
  invoiceNumber: z.string().max(100).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: z.number().positive(),
        unitCost: z.number().positive(),
        taxRate: z.number().min(0).max(100).default(21),
      })
    )
    .min(1),
  notes: z.string().max(1000).optional(),
  amountPaid: z.number().min(0).optional(),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
