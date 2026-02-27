// Tipos compartidos con el backend (duplicados manualmente)

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  businessId: string;
  isActive?: boolean;
  roles?: string[];
  permissions?: string[];
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
  marginPercent?: number;
  suggestedPrice?: number;
  stockQuantity: number;
  minStock?: number;
  imageUrl?: string;
  isActive: boolean;
  category?: Category;
  brand?: Brand;
  createdAt?: string;
  updatedAt?: string;
}

export interface PriceHistoryEntry {
  id: string;
  businessId: string;
  productId: string;
  purchaseId?: string;
  oldCost: number;
  newCost: number;
  oldPrice: number;
  newPrice: number;
  oldMargin?: number;
  newMargin?: number;
  reason?: string;
  changedBy?: string;
  createdAt: string;
}

export interface InventoryMovementEntry {
  id: string;
  businessId: string;
  productId: string;
  type: string;
  quantity: number;
  reason?: string;
  referenceId?: string;
  userId?: string;
  createdAt: string;
}

export interface SalesSummary {
  totalUnits: number;
  totalRevenue: number;
  totalTransactions: number;
  points: Array<{
    date: string;
    units: number;
    revenue: number;
  }>;
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
export interface BusinessInfo {
  id: string;
  name: string;
  timezone: string;
}

export interface LoginResponse {
  user: User;
  business: BusinessInfo;
  accessToken: string;
  csrfToken: string;
  csrfHash: string;
}

export interface ExchangeRateResponse {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
  timestamp: string;
}
