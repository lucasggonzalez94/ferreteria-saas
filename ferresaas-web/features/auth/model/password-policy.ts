/**
 * Política de contraseña aprobada en AUTH-06: mínimo 8 caracteres con
 * minúscula, mayúscula, número y carácter especial. Espejo de
 * `modules/identity/domain/password-policy.ts` (la autoridad es el backend).
 */
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_REQUIREMENTS = [
  { regex: /.{8,}/, label: "Mínimo 8 caracteres" },
  { regex: /[a-z]/, label: "Una minúscula" },
  { regex: /[A-Z]/, label: "Una mayúscula" },
  { regex: /[0-9]/, label: "Un número" },
  { regex: /[^A-Za-z0-9]/, label: "Un carácter especial" },
];

export function isPasswordPolicyCompliant(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((req) => req.regex.test(password));
}
