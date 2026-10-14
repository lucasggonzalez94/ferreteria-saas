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
}
