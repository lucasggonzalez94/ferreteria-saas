import { z } from 'zod';

// Item de venta
const saleItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  taxRate: z.number().min(0).max(100),
  discountAmount: z.number().min(0).default(0),
  discountPercent: z.number().min(0).max(100).default(0),
});

// Pago
const paymentSchema = z.object({
  method: z.enum(['CASH_ARS', 'CASH_USD', 'CARD', 'TRANSFER', 'QR']),
  amount: z.number().positive(),
  amountUSD: z.number().positive().optional(),
  cardBrand: z.string().max(50).optional(),
  financialCost: z.number().min(0).optional(),
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
  invoiceType: z.enum(['A', 'B', 'C']).optional(),
  clientOperationId: z.string().optional(),
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
