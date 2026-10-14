import type { Transaction } from '../../../platform/tenancy/unit-of-work';

/**
 * Persistencia del alta de negocio (AUTH-01). El caso de uso orquesta; este
 * Store ejecuta las escrituras sobre el `tx` tenant-scoped (RLS exige que el
 * contexto ya esté fijado al businessId nuevo antes de insertar).
 */
export class SignupStore {
  constructor(private readonly tx: Transaction) {}

  createBusiness(data: {
    id: string;
    name: string;
    cuit: string;
    taxCondition: 'RESPONSABLE_INSCRIPTO' | 'MONOTRIBUTO' | 'EXENTO';
    phone?: string;
    address?: string;
    email: string;
    timezone: string;
  }) {
    return this.tx.business.create({ data });
  }

  createRole(data: { id: string; businessId: string; name: string; description: string; isSystem: boolean }) {
    return this.tx.role.create({ data });
  }

  /** Catálogo global de permisos (RLS no aplica: es global, runtime sólo lee). */
  listPermissions() {
    return this.tx.permission.findMany();
  }

  createRolePermissions(entries: Array<{ businessId: string; roleId: string; permissionId: string }>) {
    return this.tx.rolePermission.createMany({ data: entries, skipDuplicates: true });
  }

  createUser(data: {
    id: string;
    businessId: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string | null;
    isActive: boolean;
  }) {
    return this.tx.user.create({ data });
  }

  createUserRole(data: { businessId: string; userId: string; roleId: string }) {
    return this.tx.userRole.create({ data });
  }

  /** Versión de autorización tras los grants: los triggers ya la actualizaron. */
  readAuthorizationVersion(businessId: string): Promise<number> {
    return this.tx.business
      .findUniqueOrThrow({ where: { id: businessId }, select: { authorizationVersion: true } })
      .then(b => b.authorizationVersion);
  }
}
