import { z } from 'zod';

// Crear ajuste de inventario
export const createAdjustmentSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number(),
  reason: z.string().min(1).max(500),
});

export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;

// Procesar devolución de cliente
export const processReturnSchema = z.object({
  saleId: z.string().cuid(),
  items: z.array(
    z.object({
      productId: z.string().cuid(),
      quantity: z.number().positive(),
    })
  ).min(1),
  reason: z.string().max(500).optional(),
});

export type ProcessReturnInput = z.infer<typeof processReturnSchema>;

// Filtros de movimientos
export const movementFiltersSchema = z.object({
  productId: z.string().cuid().optional(),
  type: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export type MovementFilters = z.infer<typeof movementFiltersSchema>;
