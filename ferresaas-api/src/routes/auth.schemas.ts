import { z } from 'zod';

const taxConditionSchema = z.enum(['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO']);

// Register
export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50).optional(),
  password: z.string().min(10),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  roleIds: z.array(z.string().cuid()).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// Public signup: creates a business and the owner user
export const signupSchema = z.object({
  businessName: z.string().trim().min(1).max(150),
  businessCuit: z.string().trim().min(8).max(20),
  taxCondition: taxConditionSchema,
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(200).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  ownerFirstName: z.string().trim().min(1).max(100),
  ownerLastName: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email(),
  password: z.string().min(10),
});

export type SignupInput = z.infer<typeof signupSchema>;

// Login
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type LoginInput = z.infer<typeof loginSchema>;

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
  newPassword: z.string().min(10),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
