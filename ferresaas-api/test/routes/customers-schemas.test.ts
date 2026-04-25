import { describe, it, expect } from '@jest/globals';
import {
  createCustomerSchema,
  updateCustomerSchema,
} from '@/routes/customers.schemas';

describe('customers schemas', () => {
  const validCuid = 'cia3ae12e000000000000000000';

  describe('createCustomerSchema', () => {
    it('should validate person type', () => {
      const input = {
        type: 'PERSON',
        firstName: 'John',
        lastName: 'Doe',
      };
      const result = createCustomerSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate company type', () => {
      const input = {
        type: 'COMPANY',
        companyName: 'Acme Corp',
        cuit: '30-12345678-9',
      };
      const result = createCustomerSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept tax condition', () => {
      const input = {
        type: 'PERSON',
        firstName: 'John',
        taxCondition: 'RESPONSABLE_INSCRIPTO',
      };
      const result = createCustomerSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept valid email', () => {
      const input = {
        type: 'PERSON',
        firstName: 'John',
        email: 'john@test.com',
      };
      const result = createCustomerSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const input = {
        type: 'PERSON',
        firstName: 'John',
        email: 'invalid-email',
      };
      const result = createCustomerSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept creditLimit', () => {
      const input = {
        type: 'PERSON',
        firstName: 'John',
        creditLimit: 10000,
      };
      const result = createCustomerSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject creditLimit < 0', () => {
      const input = {
        type: 'PERSON',
        firstName: 'John',
        creditLimit: -100,
      };
      const result = createCustomerSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateCustomerSchema', () => {
    it('should validate partial update', () => {
      const input = { firstName: 'Jane' };
      const result = updateCustomerSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept null for nullable fields', () => {
      const input = { firstName: null };
      const result = updateCustomerSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all tax conditions', () => {
      const conditions = ['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO', 'CONSUMIDOR_FINAL', 'NO_CATEGORIZADO', 'IVA_NO_ALCANZADO'];
      for (const condition of conditions) {
        const input = { taxCondition: condition };
        const result = updateCustomerSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });
  });
});
