import { z } from 'zod';

// Item de venta
const saleItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  taxRate: z.number().min(0).max(100),
  discountAmount: z.number().min(0).default(0),
  discountPercent: z.number().min(0).max(100).default(0),
  // Descuentos a ojo
  discountedPrice: z.number().positive().optional(), // Precio final con descuento
  discountReason: z.string().max(500).optional(), // Motivo del descuento
  discountApprovedBy: z.string().cuid().optional(), // userId de quien aprobó
});

// Pago
const paymentSchema = z.object({
  method: z.enum(['CASH_ARS', 'CASH_USD', 'CARD', 'TRANSFER', 'QR', 'ACCOUNT']),
  amount: z.number().positive(),
  amountUSD: z.number().positive().optional(),
  cardBrand: z.string().max(50).optional(),
  financialCost: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

const refundPaymentSchema = z.object({
  method: z.enum(['CASH_ARS', 'CASH_USD', 'CARD', 'TRANSFER', 'QR', 'ACCOUNT']),
  amount: z.number().positive(),
  notes: z.string().max(500).optional(),
});

// Crear venta (borrador)
export const createSaleSchema = z.object({
  customerId: z.string().cuid().optional(),
  items: z.array(saleItemSchema).min(1),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().max(1000).optional(),
  clientOperationId: z.string().optional(), // Para idempotencia offline
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

// Confirmar venta
export const confirmSaleSchema = z.object({
  payments: z.array(paymentSchema).min(1),
  changeGiven: z.number().min(0).optional(), // Vuelto entregado (solo para efectivo)
  invoiceType: z.enum(['A', 'B', 'C']).optional(),
  clientOperationId: z.string().optional(),
});

// Solicitar aprobación de descuento
export const requestDiscountApprovalSchema = z.object({
  saleId: z.string().cuid(),
  productId: z.string().cuid(),
  originalPrice: z.number().positive(),
  discountedPrice: z.number().positive(),
  discountReason: z.string().max(500),
});

// Aprobar descuento
export const approveDiscountSchema = z.object({
  discountApprovalId: z.string().cuid(),
  approverPassword: z.string(), // Contraseña del aprobador para validación rápida
});

// Rechazar descuento
export const rejectDiscountSchema = z.object({
  discountApprovalId: z.string().cuid(),
  rejectionReason: z.string().max(500).optional(),
});

export type ConfirmSaleInput = z.infer<typeof confirmSaleSchema>;

// Filtros de ventas
export const salesFiltersSchema = z.object({
  customerId: z.string().cuid().optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
  invoiceStatus: z.enum(['PENDING_INVOICE', 'INVOICED', 'FAILED']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export type SalesFilters = z.infer<typeof salesFiltersSchema>;

export const invoiceJobFiltersSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'RETRYING', 'COMPLETED', 'FAILED']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export const invoiceJobParamsSchema = z.object({
  jobId: z.string().cuid(),
});

export const createAdjustmentNoteSchema = z.object({
  kind: z.enum(['CREDIT', 'DEBIT']),
  letter: z.enum(['A', 'B', 'C']),
  reason: z.string().trim().min(3).max(500),
  clientOperationId: z.string().optional(),
});

export const refundSaleSchema = z.object({
  items: z
    .array(
      z.object({
        saleItemId: z.string().cuid(),
        quantity: z.number().positive(),
      })
    )
    .min(1),
  refundPayments: z.array(refundPaymentSchema).min(1),
  reason: z.string().trim().min(3).max(500),
  notes: z.string().max(1000).optional(),
  maxDaysSinceConfirmation: z.number().int().min(1).max(365).optional(),
  clientOperationId: z.string().optional(),
});

export const invoiceFiltersSchema = z.object({
  status: z.enum(['PENDING', 'ISSUED', 'FAILED']).optional(),
  voucherType: z
    .enum(['A', 'B', 'C', 'NC_A', 'NC_B', 'NC_C', 'ND_A', 'ND_B', 'ND_C'])
    .optional(),
  saleId: z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export const invoiceParamsSchema = z.object({
  invoiceId: z.string().cuid(),
});
