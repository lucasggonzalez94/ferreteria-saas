import { generateRefreshToken, generateCsrfToken, hashOpaqueToken } from '../platform/security/jwt';

/**
 * Utilidades de tokens opacos. La emisión/verificación JWT vive en
 * platform/security/jwt. Este módulo queda sólo para consumidores legacy
 * que aún no migraron (user.service), hasta su refactor en módulos.
 */
export const TokenService = {
  generateRefreshToken,
  generateCsrfToken,
  hashToken: hashOpaqueToken,
  generateResetToken(): string {
    return generateRefreshToken();
  },
};
