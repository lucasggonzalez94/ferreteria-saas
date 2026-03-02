import { Request } from 'express';

// Extender Request de Express con datos de autenticación
export interface AuthRequest extends Request {
  user?: {
    id: string;
    businessId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    roles: string[];
    permissions: string[];
  };
  businessId?: string;
  timezone?: string; // IANA timezone del negocio (ej: "America/Buenos_Aires")
  requestId?: string;
}

// Respuestas API
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

// Paginación
export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// JWT Payload
export interface JwtPayload {
  userId: string;
  businessId: string;
  email: string;
  type: 'access' | 'refresh';
  tokenFamily?: string;
  iat?: number; // Issued at
  exp?: number; // Expiration time
}

// Filtros comunes
export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

export interface SearchFilter {
  q?: string;
}

// Tipo de cambio
export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  buyRate?: number;
  sellRate?: number;
  source: string;
  dollarType: string;
  timestamp: Date;
}

// Re-exportar tipos de exchange-rate
export * from './exchange-rate.types';

// Facturación
export interface CreateVoucherInput {
  businessId: string;
  saleId: string;
  voucherType: 'A' | 'B' | 'C';
  pointOfSale: number;
  customer?: {
    name: string;
    cuit?: string;
    address?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    total: number;
  }>;
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface CreateVoucherResult {
  success: boolean;
  cae?: string;
  caeExpiry?: Date;
  number?: number;
  qrData?: string;
  pdfUrl?: string;
  error?: string;
}

export interface Voucher {
  id: string;
  cae: string;
  caeExpiry: Date;
  number: number;
  pointOfSale: number;
  voucherType: string;
  pdfUrl?: string;
  qrData?: string;
}
