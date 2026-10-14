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
  /** Vigencia absoluta de la sesión: el controller la usa para acotar la cookie. */
  sessionAbsoluteExpiresAt: Date;
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

  // Hashing fuera de la transacción (R2): no depende de la base y una tx
  // abierta durante Argon2 mantiene conexión y locks ocupados sin beneficio.
  const passwordHash = await hashPassword(command.password);

  // eslint-disable-next-line max-lines-per-function
  const data = await unitOfWork.runPublic(async tx => {
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
        password: passwordHash,
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
    const createdSession = await sessions.create({
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

    // Los triggers de roles/user_roles/role_permissions ya subieron la versión:
    // el claim av debe reflejar el valor FINAL, no el del objeto creado antes.
    const businessFresh = await tx.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { authorizationVersion: true },
    });

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
      sessionId,
      refreshToken,
      sessionAbsoluteExpiresAt: createdSession.absoluteExpiresAt,
      authorizationVersion: businessFresh.authorizationVersion,
    };
  });

  // Emisión fuera de la transacción (R2).
  const accessToken = issueAccessToken(
    { sub: data.user.id, sid: data.sessionId, tid: data.user.businessId, sv: 1, av: data.authorizationVersion, typ: 'access' },
    sessionPolicy.accessTokenSeconds,
  );
  const csrf = generateCsrfToken(data.refreshToken);

  return {
    user: data.user,
    business: data.business,
    accessToken,
    refreshToken: data.refreshToken,
    sessionAbsoluteExpiresAt: data.sessionAbsoluteExpiresAt,
    csrfToken: csrf.token,
    csrfHash: csrf.hash,
  };
}
