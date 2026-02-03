import { z } from 'zod';

// Create Permission
export const createPermissionSchema = z.object({
  resource: z.string().min(1).max(100),
  action: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;

// Update Permission Description
export const updatePermissionSchema = z.object({
  description: z.string().max(500).optional(),
});

export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;

// List Permissions Filters
export const listPermissionsSchema = z.object({
  q: z.string().optional(),
  resource: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListPermissionsInput = z.infer<typeof listPermissionsSchema>;
