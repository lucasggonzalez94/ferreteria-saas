import type { Transaction } from '../../../platform/tenancy/unit-of-work';

export interface UserWithAccess {
  id: string;
  email: string;
  password: string;
  businessId: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  securityVersion: number;
  business: {
    id: string;
    name: string;
    timezone: string;
    logoUrl: string | null;
    authorizationVersion: number;
  };
  roles: Array<{ role: { name: string; permissions: Array<{ permission: { resource: string; action: string } }> } }>;
}

const userAccessInclude = {
  business: {
    select: { id: true, name: true, timezone: true, logoUrl: true, authorizationVersion: true },
  },
  roles: {
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  },
} as const;

export class IdentityStore {
  constructor(private readonly tx: Transaction) {}

  findUserByIdWithAccess(userId: string): Promise<UserWithAccess | null> {
    return this.tx.user.findUnique({ where: { id: userId }, include: userAccessInclude });
  }

  /** Pre-chequeos de unicidad: RLS los confina al tenant; la constraint global decide lo demás. */
  findUserIdByEmail(email: string): Promise<{ id: string } | null> {
    return this.tx.user.findFirst({ where: { email }, select: { id: true } });
  }

  findUserIdByUsername(username: string): Promise<{ id: string } | null> {
    return this.tx.user.findFirst({ where: { username }, select: { id: true } });
  }

  /** RLS oculta roles de otros tenants: un ID ajeno simplemente falta en el resultado. */
  findExistingRoleIds(roleIds: string[]): Promise<string[]> {
    return this.tx.role
      .findMany({ where: { id: { in: roleIds } }, select: { id: true } })
      .then(rows => rows.map(r => r.id));
  }

  createUser(data: {
    id: string;
    businessId: string;
    email: string;
    username: string | null;
    password: string;
    firstName: string | null;
    lastName: string | null;
  }) {
    return this.tx.user.create({ data });
  }

  createUserRoles(entries: Array<{ businessId: string; userId: string; roleId: string }>) {
    return this.tx.userRole.createMany({ data: entries });
  }

  /** Relectura tenant-scoped tras el bootstrap: exige activo (no confiar en el bootstrap). */
  findActiveUser(userId: string) {
    return this.tx.user.findFirst({ where: { id: userId, isActive: true } });
  }

  /**
   * Programa un reset de contraseña. El predicado repite `isActive` en el
   * propio write: un usuario desactivado tras la lectura no recibe token.
   */
  setResetToken(userId: string, tokenHash: string, expiry: Date) {
    return this.tx.user.update({
      where: { id: userId, isActive: true },
      data: { resetToken: tokenHash, resetTokenExpiry: expiry },
    });
  }

  findUserByResetToken(tokenHash: string, now: Date) {
    return this.tx.user.findFirst({
      where: { resetToken: tokenHash, resetTokenExpiry: { gt: now }, isActive: true },
    });
  }

  /**
   * Consumo atómico del reset (R1 compare-and-set): un solo request reemplaza
   * el hash por null; expiración y actividad se repiten en el predicado.
   */
  async consumeResetToken(userId: string, tokenHash: string, newPasswordHash: string, now: Date): Promise<boolean> {
    const updated = await this.tx.user.updateMany({
      where: { id: userId, resetToken: tokenHash, resetTokenExpiry: { gt: now }, isActive: true },
      data: { password: newPasswordHash, resetToken: null, resetTokenExpiry: null },
    });
    return updated.count === 1;
  }

  /** Fase de lectura del cambio de contraseña (verificación fuera de tx, R2). */
  findUserForPasswordChange(userId: string) {
    return this.tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, password: true, businessId: true },
    });
  }

  /**
   * Cambio de contraseña con compare-and-set (R1): si otra request cambió el
   * hash entre la lectura y este write, la que pierde recibe conflicto.
   */
  async updatePasswordIfHashMatches(userId: string, expectedHash: string, newHash: string): Promise<boolean> {
    const updated = await this.tx.user.updateMany({
      where: { id: userId, password: expectedHash },
      data: { password: newHash },
    });
    return updated.count === 1;
  }
}
