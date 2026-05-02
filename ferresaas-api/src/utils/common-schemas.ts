import { z } from 'zod';

export const cuidSchema = z.string().cuid();

export const emailSchema = z.string().email().optional().or(z.literal(''));

export const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s\-()]*$/)
  .optional()
  .or(z.literal(''));

export const paginationQuerySchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional(),
  q: z.string().optional(),
});

export const dateStringSchema = z.string().datetime().optional();

export const dateRangeSchema = z
  .object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'startDate debe ser menor o igual a endDate',
    }
  );

export const currencySchema = z.enum(['ARS', 'USD']);

export const positiveNumberSchema = z
  .number()
  .positive()
  .optional();

export const nonNegativeNumberSchema = z
  .number()
  .min(0)
  .optional();

export const percentSchema = z
  .number()
  .min(0)
  .max(100)
  .optional();

export const booleanSchema = z
  .enum(['true', 'false'])
  .transform((val) => val === 'true')
  .optional();

export const sortSchema = z
  .enum([
    'name-asc',
    'name-desc',
    'created-asc',
    'created-desc',
    'updated-asc',
    'updated-desc',
  ])
  .optional();

export const idParamSchema = z.object({
  id: cuidSchema,
});

export function parsePageLimit(
  page?: number | string,
  limit?: number | string,
  defaults: { page?: number; limit?: number } = {}
) {
  const pageNum = Math.max(1, Number(page) || defaults.page || 1);
  const limitNum = Math.min(
    100,
    Math.max(1, Number(limit) || defaults.limit || 20)
  );

  return { page: pageNum, limit: limitNum, skip: (pageNum - 1) * limitNum };
}