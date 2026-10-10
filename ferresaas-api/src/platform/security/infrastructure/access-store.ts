import type { Transaction } from '../../tenancy/unit-of-work';
import type { AccessTokenPayload } from '../jwt';
import { AppError } from '../../errors';

export class AccessStore {
  constructor(private readonly tx: Transaction) {}

  async sessionTenant(sessionId: string): Promise<string | null> {
    const rows = await this.tx.$queryRaw<Array<{ business_id: string }>>`
      SELECT * FROM private.session_tenant_by_id(${sessionId})`;
    return rows[0]?.business_id ?? null;
  }

  findActiveSession(payload: AccessTokenPayload) {
    const now = new Date();
    return this.tx.authSession.findFirst({
      where: {
        id: payload.sid, userId: payload.sub, businessId: payload.tid,
        revokedAt: null, expiresAt: { gt: now }, absoluteExpiresAt: { gt: now },
      },
      select: {
        id: true, userId: true, businessId: true, securityVersion: true,
        user: { select: {
          email: true, firstName: true, lastName: true, isActive: true, securityVersion: true,
          business: { select: { authorizationVersion: true, timezone: true } },
        } },
      },
    });
  }

  async authorization(userId: string) {
    const user = await this.tx.user.findFirst({
      where: { id: userId },
      select: {
        isActive: true,
        roles: { select: { role: { select: {
          name: true,
          permissions: { select: { permission: { select: { resource: true, action: true } } } },
        } } } },
      },
    });
    if (!user) throw AppError.unauthorized('USER_NOT_FOUND', 'User not found or inactive');
    if (!user.isActive) throw AppError.unauthorized('USER_INACTIVE', 'User is inactive');
    const permissions = new Set<string>();
    const roles: string[] = [];
    for (const { role } of user.roles) {
      roles.push(role.name);
      for (const { permission } of role.permissions) {
        permissions.add(`${permission.resource}:${permission.action}`);
      }
    }
    return { roles, permissions: [...permissions] };
  }
}
