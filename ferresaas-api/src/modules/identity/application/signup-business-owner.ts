import crypto from 'node:crypto';
import { unitOfWork } from '../../../platform/tenancy/unit-of-work';
import { AppError } from '../../../platform/errors';
import { hashPassword } from '../../../platform/security/passwords';
import {
  issueAccessToken,
  generateRefreshToken,
  generateCsrfToken,
  hashOpaqueToken,
} from '../../../platform/security/jwt';
import { sessionPolicy } from '../domain/session-policy';
import { validatePassword } from '../domain/password-policy';
import { ADMIN, CASHIER, CASHIER_PERMISSION_KEYS, OWNER, SYSTEM_ROLES } from '../domain/initial-roles';
import { canonicalCuit, validCuit, validTimezone } from '../../tenant';
import { SessionStore } from '../infrastructure/session-store';
import { BootstrapStore } from '../infrastructure/bootstrap-store';
import { EmailJobStore } from '../../notifications';
import { AuditStore } from '../../audit';

export interface SignupCommand {
  businessName: string;
  businessCuit: string;
  taxCondition: 'RESPONSABLE_INSCRIPTO' | 'MONOTRIBUTO' | 'EXENTO';
  phone?: string;
  address?: string;
  timezone?: string;
  ownerFirstName: string;
  ownerLastName?: string;
  email: string;
  password: string;
}

export interface SignupResult {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    businessId: string;
    roles: string[];
    permissions: string[];
  };
  business: { id: string; name: string; timezone: string; logoUrl: string | null };
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  csrfHash: string;
}

const DEFAULT_TIMEZONE = 'America/Buenos_Aires';

// eslint-disable-next-line max-lines-per-function
export async function signupBusinessOwner(
  command: SignupCommand,
  ip?: string,
  userAgent?: string,
): Promise<SignupResult> {
  const validation = validatePassword(command.password);
  if (!validation.valid) {
    throw AppError.badRequest('INVALID_PASSWORD', 'Password does not meet requirements', {
      errors: validation.errors,
    });
  }

  const cuit = canonicalCuit(command.businessCuit);
  if (!validCuit(cuit)) {
    throw AppError.badRequest('INVALID_CUIT', 'CUIT is not valid');
  }
  const email = command.email.trim().toLowerCase();
  const timezone = command.timezone ?? DEFAULT_TIMEZONE;
  if (!validTimezone(timezone)) {
    throw AppError.badRequest('INVALID_TIMEZONE', 'Timezone is not valid');
  }

  // eslint-disable-next-line max-lines-per-function
  return unitOfWork.runPublic(async tx => {
    // Reserva global: CUIT y email son únicos globales por decisión de negocio.
    const conflicts = await new BootstrapStore(tx).conflicts(email, cuit);
    if (conflicts.email_exists) throw AppError.conflict('EMAIL_EXISTS', 'Email already registered');
    if (conflicts.cuit_exists) throw AppError.conflict('CUIT_EXISTS', 'Business CUIT already registered');

    const businessId = crypto.randomUUID();
    // Bootstrap: el contexto se fija al tenant nuevo dentro de la transacción;
    // RLS exige que las inserciones dependientes coincidan con este contexto.
    await unitOfWork.setTenant(tx, businessId);

    const business = await tx.business.create({
      data: {
        id: businessId,
        name: command.businessName.trim(),
        cuit,
        taxCondition: command.taxCondition,
        phone: command.phone,
        address: command.address,
        email,
        timezone,
      },
    });

    const roleIds = new Map<string, string>();
    for (const role of SYSTEM_ROLES) {
      const created = await tx.role.create({
        data: { id: crypto.randomUUID(), businessId, name: role.name, description: role.description, isSystem: true },
      });
      roleIds.set(role.name, created.id);
    }

    const permissions = await tx.permission.findMany();
    const permissionKeys = permissions.map(p => `${p.resource}:${p.action}`);
    const permissionIdByKey = new Map(permissions.map(p => [`${p.resource}:${p.action}`, p.id]));

    const grantAll = (roleId: string) =>
      permissions.map(p => ({
        businessId,
        roleId,
        permissionId: p.id,
      }));
    const grantCashier = CASHIER_PERMISSION_KEYS
      .map(key => permissionIdByKey.get(key))
      .filter((id): id is string => Boolean(id))
      .map(permissionId => ({ businessId, roleId: roleIds.get(CASHIER)!, permissionId }));

    await tx.rolePermission.createMany({
      data: [
        ...grantAll(roleIds.get(OWNER)!),
        ...grantAll(roleIds.get(ADMIN)!),
        ...grantCashier,
      ],
      skipDuplicates: true,
    });

    const user = await tx.user.create({
      data: {
        id: crypto.randomUUID(),
        businessId,
        email,
        password: await hashPassword(command.password),
        firstName: command.ownerFirstName.trim(),
        lastName: command.ownerLastName?.trim() ?? null,
        isActive: true,
      },
    });

    await tx.userRole.create({
      data: { businessId, userId: user.id, roleId: roleIds.get(OWNER)! },
    });

    // Primera sesión dentro de la misma transacción.
    const sessionId = crypto.randomUUID();
    const refreshToken = generateRefreshToken();
    const sessions = new SessionStore(tx);
    await sessions.create({
      id: sessionId,
      businessId,
      userId: user.id,
      tokenHash: hashOpaqueToken(refreshToken),
      securityVersion: 1,
      ip,
      userAgent,
    });

    // Auditorías obligatorias de negocio (CREATE business + CREATE user)
    const audit = new AuditStore(tx);
    await audit.logCreate(businessId, user.id, 'businesses', businessId, {
      name: business.name,
      cuit: business.cuit,
    });
    await audit.logCreate(businessId, user.id, 'users', user.id, { email: user.email });

    // Bienvenida durable: queda programada aunque el proceso muera luego.
    const emailJobs = new EmailJobStore(tx);
    await emailJobs.enqueue({
      id: crypto.randomUUID(),
      businessId,
      recipient: email,
      firstName: user.firstName ?? 'Usuario',
    });

    const businessInfo = business as { authorizationVersion: number };
    const accessToken = issueAccessToken(
      { sub: user.id, sid: sessionId, tid: businessId, sv: 1, av: businessInfo.authorizationVersion, typ: 'access' },
      sessionPolicy.accessTokenSeconds,
    );
    const csrf = generateCsrfToken();

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        businessId,
        roles: [OWNER],
        permissions: permissionKeys,
      },
      business: {
        id: businessId,
        name: business.name,
        timezone: business.timezone,
        logoUrl: null,
      },
      accessToken,
      refreshToken,
      csrfToken: csrf.token,
      csrfHash: csrf.hash,
    };
  });
}
