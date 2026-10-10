export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

/** Política aprobada (AUTH-06): 8+ con minúscula, mayúscula, número y especial. */
export const PASSWORD_MIN_LENGTH = 8;

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) errors.push('Password must be at least 8 characters long');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must contain at least one special character');
  return { valid: errors.length === 0, errors };
}
