import { z } from 'zod';

// Create/Invite User
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  roleIds: z.array(z.string().cuid()).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// Update User
export const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// Toggle User Status
export const toggleUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export type ToggleUserStatusInput = z.infer<typeof toggleUserStatusSchema>;

// List Users Query
export const listUsersQuerySchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  q: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  roleId: z.string().cuid().optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
