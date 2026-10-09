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
}
