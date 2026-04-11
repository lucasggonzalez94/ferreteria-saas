// Constantes del dominio

export const USER_ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  CASHIER: 'CASHIER',
  STOCKER: 'STOCKER',
  MANAGER: 'MANAGER',
} as const;

export const PERMISSIONS = {
  // Productos
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_READ: 'products:read',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_DELETE: 'products:delete',
  PRODUCTS_MANAGE: 'products:manage',

  // Inventario
  INVENTORY_READ: 'inventory:read',
  INVENTORY_ADJUST: 'inventory:adjust',
  INVENTORY_RETURN: 'inventory:return',
  INVENTORY_MANAGE: 'inventory:manage',

  // Ventas
  SALES_CREATE: 'sales:create',
  SALES_READ: 'sales:read',
  SALES_APPROVE_DISCOUNT: 'sales:approve_discount',
  SALES_REFUND: 'sales:refund',
  SALES_MANAGE: 'sales:manage',

  // Compras
  PURCHASES_CREATE: 'purchases:create',
  PURCHASES_READ: 'purchases:read',
  PURCHASES_UPDATE: 'purchases:update',
  PURCHASES_DELETE: 'purchases:delete',
  PURCHASES_MANAGE: 'purchases:manage',

  // Caja
  CASH_REGISTER_OPEN: 'cash_register:open',
  CASH_REGISTER_CLOSE: 'cash_register:close',
  CASH_REGISTER_READ: 'cash_register:read',
  CASH_REGISTER_MANAGE: 'cash_register:manage',

  // Clientes
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_UPDATE: 'customers:update',
  CUSTOMERS_DELETE: 'customers:delete',
  CUSTOMERS_MANAGE: 'customers:manage',

  // Reportes
  REPORTS_READ: 'reports:read',

  // Configuración
  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',

  // Usuarios
  USERS_CREATE: 'users:create',
  USERS_READ: 'users:read',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE: 'users:manage',

  // Roles
  ROLES_CREATE: 'roles:create',
  ROLES_READ: 'roles:read',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',
  ROLES_MANAGE: 'roles:manage',

  // Pricing
  PRICING_APPROVE: 'pricing:approve',
  PRICING_VIEW_SUGGESTIONS: 'pricing:view_suggestions',

  // Cuentas financieras
  FINANCIAL_ACCOUNTS_CREATE: 'financial_accounts:create',
  FINANCIAL_ACCOUNTS_READ: 'financial_accounts:read',
  FINANCIAL_ACCOUNTS_UPDATE: 'financial_accounts:update',
  FINANCIAL_ACCOUNTS_DELETE: 'financial_accounts:delete',
  FINANCIAL_ACCOUNTS_MANAGE: 'financial_accounts:manage',

  // Cheques
  CHECKS_READ: 'checks:read',
  CHECKS_MANAGE: 'checks:manage',

  // Auditoría
  AUDIT_READ: 'audit:read',
} as const;

export const TAX_CONDITIONS = {
  RESPONSABLE_INSCRIPTO: 'RESPONSABLE_INSCRIPTO',
  MONOTRIBUTO: 'MONOTRIBUTO',
  EXENTO: 'EXENTO',
} as const;

export const INVOICE_TYPES = {
  A: 'A',
  B: 'B',
  C: 'C',
} as const;

export const PAYMENT_METHODS = {
  CASH_ARS: 'CASH_ARS',
  CASH_USD: 'CASH_USD',
  CARD: 'CARD',
  TRANSFER: 'TRANSFER',
  QR: 'QR',
} as const;

export const SALE_STATUS = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
} as const;

export const INVOICE_STATUS = {
  PENDING_INVOICE: 'PENDING_INVOICE',
  INVOICED: 'INVOICED',
  FAILED: 'FAILED',
} as const;

export const INVENTORY_MOVEMENT_TYPES = {
  PURCHASE_RECEIPT: 'PURCHASE_RECEIPT',
  SALE: 'SALE',
  RETURN: 'RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
  TRANSFER: 'TRANSFER',
} as const;

export const CASH_REGISTER_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;

export const CUSTOMER_TYPES = {
  PERSON: 'PERSON',
  COMPANY: 'COMPANY',
} as const;

export const ACCOUNT_MOVEMENT_TYPES = {
  SALE: 'SALE',
  PAYMENT: 'PAYMENT',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;

export const PRODUCT_UNITS = {
  UNIT: 'u',
  METER: 'mt',
  KILOGRAM: 'kg',
  LITER: 'lt',
} as const;
