import { z } from 'zod';

// Create Role
export const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string().cuid()).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

// Update Role
export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string().cuid()).optional(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

// Update Role Permissions
export const updateRolePermissionsSchema = z.object({
  permissionIds: z.array(z.string().cuid()),
});

export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;

// List Roles Filters
export const listRolesSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListRolesInput = z.infer<typeof listRolesSchema>;
