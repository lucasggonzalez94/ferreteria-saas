/**
 * Utilidades para cálculo de precios
 */

/**
 * Calcula el precio sugerido basado en costo, IVA y margen
 * Fórmula: Precio = Costo × (1 + Margen%) × (1 + IVA%)
 * 
 * @param cost - Costo del producto (sin IVA)
 * @param taxRate - Alícuota de IVA (ej: 21 para 21%)
 * @param marginPercent - Margen de ganancia deseado (ej: 30 para 30%)
 * @returns Precio sugerido con IVA incluido
 */
export function calculateSuggestedPrice(
  cost: number,
  taxRate: number,
  marginPercent: number
): number {
  // Precio sin IVA = Costo × (1 + Margen%)
  const priceWithoutVat = cost * (1 + marginPercent / 100);
  
  // Precio final = Precio sin IVA × (1 + IVA%)
  const finalPrice = priceWithoutVat * (1 + taxRate / 100);
  
  // Redondear a 2 decimales
  return Math.round(finalPrice * 100) / 100;
}

/**
 * Calcula el precio sugerido con redondeo comercial
 * 
 * @param cost - Costo del producto (sin IVA)
 * @param taxRate - Alícuota de IVA
 * @param marginPercent - Margen de ganancia deseado
 * @param roundTo - Múltiplo para redondear (ej: 10 para redondear a $10)
 * @returns Precio sugerido redondeado
 */
export function calculateSuggestedPriceWithRounding(
  cost: number,
  taxRate: number,
  marginPercent: number,
  roundTo: number = 10
): number {
  const basePrice = calculateSuggestedPrice(cost, taxRate, marginPercent);
  
  // Redondear hacia arriba al múltiplo más cercano
  return Math.ceil(basePrice / roundTo) * roundTo;
}

/**
 * Calcula el margen real obtenido dado un costo y precio final
 * 
 * @param cost - Costo del producto (sin IVA)
 * @param price - Precio de venta final (con IVA)
 * @param taxRate - Alícuota de IVA
 * @returns Margen real en porcentaje
 */
export function calculateActualMargin(
  cost: number,
  price: number,
  taxRate: number
): number {
  // Precio sin IVA = Precio final / (1 + IVA%)
  const priceWithoutVat = price / (1 + taxRate / 100);
  
  // Margen = ((Precio sin IVA - Costo) / Costo) × 100
  const margin = ((priceWithoutVat - cost) / cost) * 100;
  
  return Math.round(margin * 100) / 100;
}

/**
 * Calcula la ganancia neta por unidad
 * 
 * @param cost - Costo del producto (sin IVA)
 * @param price - Precio de venta final (con IVA)
 * @param taxRate - Alícuota de IVA
 * @returns Ganancia neta por unidad
 */
export function calculateProfit(
  cost: number,
  price: number,
  taxRate: number
): number {
  const priceWithoutVat = price / (1 + taxRate / 100);
  return Math.round((priceWithoutVat - cost) * 100) / 100;
}
