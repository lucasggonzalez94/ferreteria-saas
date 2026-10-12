export interface ForgotPasswordFormErrors {
  email?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateForgotPasswordForm(email: string): ForgotPasswordFormErrors {
  const errors: ForgotPasswordFormErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = 'Ingresá tu correo.';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'Ingresá un correo válido, por ejemplo nombre@ferreteria.com.';
  }

  return errors;
}
