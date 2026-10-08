export const OWNER = 'OWNER';
export const ADMIN = 'ADMIN';
export const CASHIER = 'CASHIER';

export const SYSTEM_ROLES = [
  { name: OWNER, description: 'Dueño del negocio - acceso total' },
  { name: ADMIN, description: 'Administrador - acceso casi total' },
  { name: CASHIER, description: 'Cajero - ventas y caja' },
] as const;

export const CASHIER_PERMISSION_KEYS = [
  'products:read',
  'sales:create',
  'sales:read',
  'sales:refund',
  'inventory:read',
  'inventory:return',
  'cash_register:read',
  'cash_register:open',
  'cash_register:close',
  'cash_register:manage',
] as const;
