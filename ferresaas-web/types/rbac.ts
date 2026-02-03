// Tipos para Roles
export interface Role {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: Permission[];
  permissionCount: number;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

// Tipos para Permisos
export interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string;
  fullName: string;
  roleCount?: number;
  createdAt?: string;
}

// Tipos para Asignación de Roles
export interface UserRole {
  userId: string;
  roles: Role[];
}

// Tipos para Respuestas de API
export interface RolesListResponse {
  items: Role[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface PermissionsListResponse {
  items: Permission[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface ResourcesResponse {
  resources: string[];
}

export interface ActionsResponse {
  resource: string;
  actions: string[];
}

export interface RoleUsersResponse {
  roleId: string;
  roleName: string;
  userCount: number;
  users: Array<{
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    isActive: boolean;
    assignedAt: string;
  }>;
}
