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
  marginPercent: z.number().min(0).max(100).refine(val => val > 0 && val < 100, {
    message: "El margen debe estar entre 0 y 100 (exclusivo)"
  }).nullable().optional(),
  minStock: z.number().min(0).nullable().optional(),
  initialStock: z.number().min(0).optional(),
  pricingMode: z.enum(['fixed', 'margin', 'markup', 'suggest']).default('margin').optional(),
  targetMargin: z.number().refine(val => val > 0 && val < 100, {
    message: "El margen objetivo debe estar entre 0 y 100 (exclusivo)"
  }).nullable().optional(),
  targetMarkup: z.number().refine(val => val > 0, {
    message: "El markup objetivo debe ser mayor a 0"
  }).nullable().optional(),
  priceLocked: z.boolean().default(false).optional(),
  roundingStep: z.number().int().positive().default(10).optional(),
  costMethod: z.enum(['avg_weighted', 'last_cost']).default('avg_weighted').optional(),
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
  marginPercent: z.number().min(0).max(100).refine(val => val > 0 && val < 100, {
    message: "El margen debe estar entre 0 y 100 (exclusivo)"
  }).nullable().optional(),
  minStock: z.number().min(0).nullable().optional(),
  stockQuantity: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  pricingMode: z.enum(['fixed', 'margin', 'markup', 'suggest']).optional(),
  targetMargin: z.number().refine(val => val > 0 && val < 100, {
    message: "El margen objetivo debe estar entre 0 y 100 (exclusivo)"
  }).nullable().optional(),
  targetMarkup: z.number().refine(val => val > 0, {
    message: "El markup objetivo debe ser mayor a 0"
  }).nullable().optional(),
  priceLocked: z.boolean().optional(),
  roundingStep: z.number().int().positive().optional(),
  costMethod: z.enum(['avg_weighted', 'last_cost']).optional(),
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
  priceMin: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  priceMax: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  sort: z
    .enum(['name-asc', 'name-desc', 'price-asc', 'price-desc', 'stock-asc', 'stock-desc', 'created-desc'])
    .optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export type ProductFilters = z.infer<typeof productFiltersSchema>;

// Calcular precio sugerido
export const calculateSuggestedPriceSchema = z.object({
  cost: z.number().positive(),
  taxRate: z.number().min(0).max(100),
  marginPercent: z.number().min(0).max(1000),
});

export type CalculateSuggestedPriceInput = z.infer<typeof calculateSuggestedPriceSchema>;
