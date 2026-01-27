// Tipos compartidos con el backend (duplicados manualmente)

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  businessId: string;
}

export interface Product {
  id: string;
  businessId: string;
  internalSku: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  unit: string;
  isFractional: boolean;
  cost: number;
  price: number;
  taxRate: number;
  stockQuantity: number;
  minStock?: number;
  isActive: boolean;
}

export interface Category {
  id: string;
  businessId: string;
  name: string;
  description?: string;
}

export interface Brand {
  id: string;
  businessId: string;
  name: string;
  description?: string;
}

export interface Sale {
  id: string;
  businessId: string;
  customerId?: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  invoiceStatus: "PENDING_INVOICE" | "INVOICED" | "FAILED";
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  createdAt: string;
  confirmedAt?: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
  discountPercent: number;
  subtotal: number;
}

export interface Customer {
  id: string;
  businessId: string;
  type: "PERSON" | "COMPANY";
  firstName?: string;
  lastName?: string;
  companyName?: string;
  cuit?: string;
  email?: string;
  phone?: string;
  address?: string;
  creditLimit?: number;
  currentBalance: number;
  isActive: boolean;
}

// Tipos de respuesta API
export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ExchangeRateResponse {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
  timestamp: string;
}
