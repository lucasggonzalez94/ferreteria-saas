import { ApiError } from '@/lib/api';

export interface LoginFormErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginForm(email: string, password: string): LoginFormErrors {
  const errors: LoginFormErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = 'Ingresá tu correo.';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'Ingresá un correo válido, por ejemplo nombre@ferreteria.com.';
  }

  if (!password) {
    errors.password = 'Ingresá tu contraseña.';
  }

  return errors;
}

/**
 * Traducción de errores del contrato HTTP a mensajes humanos.
 * El backend expone `error.code` (AppError): se mapea por código, no por texto.
 */
export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_CREDENTIALS' || error.status === 401) {
      return 'El correo o la contraseña no son correctos.';
    }
    if (error.code === 'LOGIN_RATE_LIMIT_EXCEEDED' || error.status === 429) {
      return 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.';
    }
    return 'No pudimos iniciar sesión. Revisá los datos e intentá de nuevo.';
  }

  if (error instanceof Error) {
    const text = error.message.toLowerCase();
    if (text.includes('failed to fetch') || text.includes('network')) {
      return 'No se pudo conectar con el servidor. Verificá tu conexión a internet e intentá de nuevo.';
    }
  }

  return 'No pudimos iniciar sesión. Intentá de nuevo en unos minutos.';
}
