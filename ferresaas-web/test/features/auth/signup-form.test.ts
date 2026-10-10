import {
  initialRegisterForm,
  signupErrorMessage,
  toSignupPayload,
  validateRegisterForm,
} from '@/features/auth/model/signup-form';

const validForm = {
  ...initialRegisterForm,
  businessName: 'Ferreteria Test',
  businessCuit: '20-11111111-1',
  taxCondition: 'MONOTRIBUTO' as const,
  ownerFirstName: 'Owner',
  email: 'owner@test.com',
  password: 'Password123!',
  confirmPassword: 'Password123!',
};

describe('signup-form model', () => {
  it('valid form passes', () => {
    expect(validateRegisterForm(validForm)).toEqual({});
  });

  it('rejects empty name, invalid CUIT length and weak password', () => {
    const errors = validateRegisterForm({
      ...initialRegisterForm,
      businessCuit: '123',
      password: 'short',
    });
    expect(errors.businessName).toBeDefined();
    expect(errors.businessCuit).toBeDefined();
    expect(errors.password).toBeDefined();
  });

  it('requires an explicit tax condition', () => {
    const errors = validateRegisterForm({ ...validForm, taxCondition: '' });
    expect(errors.taxCondition).toBeDefined();

    const payload = toSignupPayload(validForm);
    expect(payload.taxCondition).toBe('MONOTRIBUTO');
  });

  it('toSignupPayload normalizes optionals and never sends confirmPassword', () => {
    const payload = toSignupPayload({ ...validForm, phone: '  ', ownerLastName: '' });
    expect(payload).not.toHaveProperty('confirmPassword');
    expect(payload.phone).toBeUndefined();
    expect(payload.ownerLastName).toBeUndefined();
    expect(payload.email).toBe('owner@test.com');
  });

  it('maps contract errors to human messages', () => {
    expect(signupErrorMessage(new Error('Email already registered'))).toContain('correo');
    expect(signupErrorMessage(new Error('Business CUIT already registered'))).toContain('CUIT');
    expect(signupErrorMessage(new Error('Failed to fetch'))).toContain('servidor');
    expect(signupErrorMessage('x')).toBe('No pudimos crear la cuenta.');
  });
});
