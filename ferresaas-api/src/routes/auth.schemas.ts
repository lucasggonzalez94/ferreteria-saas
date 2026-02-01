import { z } from 'zod';

// Register
export const registerSchema = z.object({
  businessId: z.string().cuid(),
  email: z.string().email(),
  username: z.string().min(3).max(50).optional(),
  password: z.string().min(10),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  roleIds: z.array(z.string().cuid()).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// Login
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Refresh
export const refreshSchema = z.object({
  refreshToken: z.string(),
});

export type RefreshInput = z.infer<typeof refreshSchema>;

// Forgot password
export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// Reset password
export const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(10),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// Change password
export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
