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
  casa: string;      // "oficial", "blue", "tarjeta", etc.
  nombre: string;    // "Oficial", "Blue", etc.
  compra: number;
  venta: number;
  fechaActualizacion: string;
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
