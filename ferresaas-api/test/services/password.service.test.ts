import { describe, it, expect } from '@jest/globals';
import { PasswordService } from '@/services/password.service';

describe('PasswordService', () => {
  describe('hash', () => {
    it('should hash a password', async () => {
      const hash = await PasswordService.hash('TestPassword123');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('TestPassword123');
      expect(hash.startsWith('$argon2')).toBe(true);
    });

    it('should return different hashes for same password', async () => {
      const hash1 = await PasswordService.hash('TestPassword123');
      const hash2 = await PasswordService.hash('TestPassword123');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verify', () => {
    it('should verify correct password', async () => {
      const hash = await PasswordService.hash('TestPassword123');
      const isValid = await PasswordService.verify(hash, 'TestPassword123');
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const hash = await PasswordService.hash('TestPassword123');
      const isValid = await PasswordService.verify(hash, 'WrongPassword456');
      expect(isValid).toBe(false);
    });

    it('should return false for invalid hash', async () => {
      const isValid = await PasswordService.verify('invalid-hash', 'TestPassword123');
      expect(isValid).toBe(false);
    });
  });

  describe('validate', () => {
    it('should validate strong password', () => {
      const result = PasswordService.validate('StrongPass123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short password', () => {
      const result = PasswordService.validate('weak');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 10 characters long');
    });

    it('should reject password without lowercase', () => {
      const result = PasswordService.validate('STRONGPASS123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without uppercase', () => {
      const result = PasswordService.validate('strongpass123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without numbers', () => {
      const result = PasswordService.validate('StrongPassword');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should return multiple errors for weak password', () => {
      const result = PasswordService.validate('weak');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
