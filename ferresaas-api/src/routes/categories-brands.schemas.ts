import { z } from 'zod';

// Crear categoría
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  parentId: z.string().cuid().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

// Actualizar categoría
export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  parentId: z.string().cuid().nullable().optional(),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// Crear marca
export const createBrandSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;

// Actualizar marca
export const updateBrandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
