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
    totalPages?: number;
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
export type VoucherType =
  | 'A'
  | 'B'
  | 'C'
  | 'NC_A'
  | 'NC_B'
  | 'NC_C'
  | 'ND_A'
  | 'ND_B'
  | 'ND_C';

export interface CreateVoucherInput {
  businessId: string;
  saleId: string;
  voucherType: VoucherType;
  pointOfSale: number;
  customer?: {
    name: string;
    cuit?: string;
    address?: string;
    taxCondition?:
      | 'RESPONSABLE_INSCRIPTO'
      | 'MONOTRIBUTO'
      | 'EXENTO'
      | 'CONSUMIDOR_FINAL'
      | 'NO_CATEGORIZADO'
      | 'IVA_NO_ALCANZADO';
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
  relatedVoucher?: {
    pointOfSale: number;
    number: number;
    voucherType: 'A' | 'B' | 'C';
  };
}

export interface CreateVoucherResult {
  success: boolean;
  cae?: string;
  caeExpiry?: Date;
  number?: number;
  qrData?: string;
  pdfUrl?: string;
  error?: string;
  errorCategory?: 'technical' | 'fiscal';
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
