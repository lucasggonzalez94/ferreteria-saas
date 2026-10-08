import type { SignupRequest, TaxCondition } from './signup-types';

export const TAX_CONDITION_OPTIONS: Array<{ value: TaxCondition; label: string }> = [
  { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable inscripto' },
  { value: 'MONOTRIBUTO', label: 'Monotributo' },
  { value: 'EXENTO', label: 'Exento' },
];

export interface RegisterFormData {
  businessName: string;
  businessCuit: string;
  taxCondition: TaxCondition;
  phone: string;
  ownerFirstName: string;
  ownerLastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const initialRegisterForm: RegisterFormData = {
  businessName: '',
  businessCuit: '',
  taxCondition: 'MONOTRIBUTO',
  phone: '',
  ownerFirstName: '',
  ownerLastName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export type RegisterFormErrors = Partial<Record<keyof RegisterFormData, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getDigits(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Validación de forma (UX). El servidor vuelve a validar e impone las reglas
 * de negocio: dígito verificador de CUIT, unicidad, fortaleza real, etc.
 */
export function validateRegisterForm(data: RegisterFormData): RegisterFormErrors {
  const errors: RegisterFormErrors = {};
  const businessCuitDigits = getDigits(data.businessCuit);
  const phoneDigits = getDigits(data.phone);

  if (!data.businessName.trim()) {
    errors.businessName = 'Ingresá el nombre de tu ferretería.';
  }

  if (!data.businessCuit.trim()) {
    errors.businessCuit = 'Ingresá el CUIT de la ferretería.';
  } else if (businessCuitDigits.length !== 11) {
    errors.businessCuit = 'El CUIT debe tener 11 dígitos. Podés escribirlo con o sin guiones.';
  }

  if (!data.ownerFirstName.trim()) {
    errors.ownerFirstName = 'Ingresá tu nombre.';
  }

  if (!data.email.trim()) {
    errors.email = 'Ingresá tu correo.';
  } else if (!EMAIL_PATTERN.test(data.email.trim())) {
    errors.email = 'Ingresá un correo válido, por ejemplo nombre@ferreteria.com.';
  }

  if (data.phone.trim() && phoneDigits.length < 8) {
    errors.phone = 'El teléfono parece demasiado corto. Revisá el código de área y número.';
  }

  if (!data.password) {
    errors.password = 'Creá una contraseña.';
  } else if (data.password.length < 10) {
    errors.password = 'Usá al menos 10 caracteres.';
  }

  if (!data.confirmPassword) {
    errors.confirmPassword = 'Repetí la contraseña.';
  } else if (data.password && data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Las contraseñas no coinciden.';
  }

  return errors;
}

export function toSignupPayload(data: RegisterFormData): SignupRequest {
  return {
    businessName: data.businessName.trim(),
    businessCuit: data.businessCuit.trim(),
    taxCondition: data.taxCondition,
    phone: normalizeOptional(data.phone),
    ownerFirstName: data.ownerFirstName.trim(),
    ownerLastName: normalizeOptional(data.ownerLastName),
    email: data.email.trim(),
    password: data.password,
  };
}

/** Traducción de errores del contrato HTTP a mensajes humanos. */
export function signupErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'No pudimos crear la cuenta.';
  const text = error.message.toLowerCase();
  if (text.includes('failed to fetch') || text.includes('network')) {
    return 'No se pudo conectar con el servidor. Verificá tu conexión o el estado del backend.';
  }
  if (text.includes('email already')) return 'Ese correo ya está registrado.';
  if (text.includes('cuit')) return 'Ese CUIT ya está registrado o no es válido.';
  return error.message;
}
