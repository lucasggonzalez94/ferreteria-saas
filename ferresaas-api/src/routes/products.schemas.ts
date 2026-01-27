import { z } from 'zod';

// Crear producto
export const createProductSchema = z.object({
  barcode: z.string().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  categoryId: z.string().cuid().optional(),
  brandId: z.string().cuid().optional(),
  unit: z.enum(['u', 'mt', 'kg', 'lt']),
  isFractional: z.boolean().default(false),
  cost: z.number().positive(),
  price: z.number().positive(),
  taxRate: z.number().min(0).max(100).default(21),
  minStock: z.number().min(0).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// Actualizar producto
export const updateProductSchema = z.object({
  barcode: z.string().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  categoryId: z.string().cuid().nullable().optional(),
  brandId: z.string().cuid().nullable().optional(),
  unit: z.enum(['u', 'mt', 'kg', 'lt']).optional(),
  isFractional: z.boolean().optional(),
  cost: z.number().positive().optional(),
  price: z.number().positive().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  minStock: z.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Actualizar precio
export const updatePriceSchema = z.object({
  newCost: z.number().positive(),
  newPrice: z.number().positive(),
  reason: z.string().max(500).optional(),
});

export type UpdatePriceInput = z.infer<typeof updatePriceSchema>;

// Filtros de búsqueda
export const productFiltersSchema = z.object({
  q: z.string().optional(), // Búsqueda por nombre, SKU o barcode
  categoryId: z.string().cuid().optional(),
  brandId: z.string().cuid().optional(),
  active: z.enum(['true', 'false']).optional(),
  lowStock: z.enum(['true', 'false']).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export type ProductFilters = z.infer<typeof productFiltersSchema>;
