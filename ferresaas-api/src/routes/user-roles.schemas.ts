import { z } from 'zod';

// Assign Roles to User
export const assignRolesSchema = z.object({
  roleIds: z.array(z.string().cuid()).min(0),
});

export type AssignRolesInput = z.infer<typeof assignRolesSchema>;

// Add Role to User
export const addRoleSchema = z.object({
  roleId: z.string().cuid(),
});

export type AddRoleInput = z.infer<typeof addRoleSchema>;

// Remove Role from User
export const removeRoleSchema = z.object({
  roleId: z.string().cuid(),
});

export type RemoveRoleInput = z.infer<typeof removeRoleSchema>;
