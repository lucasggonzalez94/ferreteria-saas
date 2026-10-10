import type { AuthenticatedUser } from '../../../platform/security/authenticate';
import { AppError } from '../../../platform/errors';

/** Proyección de la identidad confiable ya resuelta por authenticate. No realiza IO. */
export function getCurrentIdentity(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) throw AppError.unauthorized('UNAUTHORIZED', 'User not authenticated');
  return {
    id: user.id,
    businessId: user.businessId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: [...user.roles],
    permissions: [...user.permissions],
  };
}
