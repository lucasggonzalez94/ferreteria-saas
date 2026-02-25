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

export interface ArgentinaDatosQuote {
  casa: string;      // "oficial", "blue", "mayorista", etc.
  compra: number;
  venta: number;
  fecha: string;     // Formato: "YYYY-MM-DD"
}

export interface ExchangeRateConfigData {
  usdEnabled: boolean;
  dollarType: string;
  marginPercent: number;
  autoUpdate: boolean;
  updateIntervalMinutes: number;
  manualRate?: number;
  useManualRate: boolean;
}

export interface ConversionResult {
  amountArs: number;
  amountUsd: number;
  rate: number;
  source: string;
  dollarType: string;
}
