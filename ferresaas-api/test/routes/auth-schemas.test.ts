import { describe, it, expect } from '@jest/globals';
import {
  registerSchema,
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '@/routes/auth.schemas';

describe('auth schemas', () => {
  describe('registerSchema', () => {
    it('should validate correct register input', () => {
      const input = {
        email: 'test@test.com',
        password: 'password123456',
      };
      const result = registerSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate with optional fields', () => {
      const input = {
        email: 'test@test.com',
        username: 'testuser',
        password: 'password123456',
        firstName: 'John',
        lastName: 'Doe',
      };
      const result = registerSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const input = {
        email: 'invalid-email',
        password: 'password123456',
      };
      const result = registerSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const input = {
        email: 'test@test.com',
        password: 'short',
      };
      const result = registerSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject long username', () => {
      const input = {
        email: 'test@test.com',
        username: 'a'.repeat(51),
        password: 'password123456',
      };
      const result = registerSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('signupSchema', () => {
    it('should validate public signup input', () => {
      const input = {
        businessName: 'Ferreteria Test',
        businessCuit: '20-11111111-1',
        taxCondition: 'MONOTRIBUTO',
        ownerFirstName: 'Owner',
        email: 'owner@test.com',
        password: 'Password123!',
      };

      const result = signupSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it('should reject invalid tax condition', () => {
      const input = {
        businessName: 'Ferreteria Test',
        businessCuit: '20-11111111-1',
        taxCondition: 'INVALID',
        ownerFirstName: 'Owner',
        email: 'owner@test.com',
        password: 'Password123!',
      };

      const result = signupSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should validate correct login input', () => {
      const input = {
        email: 'test@test.com',
        password: 'password123',
      };
      const result = loginSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const input = {
        email: 'invalid-email',
        password: 'password123',
      };
      const result = loginSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const input = {
        email: 'test@test.com',
      };
      const result = loginSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should validate correct email', () => {
      const input = {
        email: 'test@test.com',
      };
      const result = forgotPasswordSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const input = {
        email: 'invalid',
      };
      const result = forgotPasswordSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('should validate with token and new password', () => {
      const input = {
        token: 'reset-token',
        newPassword: 'newpassword123',
      };
      const result = resetPasswordSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject short new password', () => {
      const input = {
        token: 'reset-token',
        newPassword: 'short',
      };
      const result = resetPasswordSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('should validate with current and new password', () => {
      const input = {
        currentPassword: 'current123',
        newPassword: 'newpassword123',
      };
      const result = changePasswordSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject short new password', () => {
      const input = {
        currentPassword: 'current123',
        newPassword: 'short',
      };
      const result = changePasswordSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
