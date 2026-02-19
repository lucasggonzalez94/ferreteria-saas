import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class PricingService {
  /**
   * Redondea un precio al múltiplo especificado
   */
  static roundToStep(price: number, step: number): number {
    return Math.round(price / step) * step;
  }

  /**
   * Calcula el margen efectivo entre costo y precio
   */
  static calculateMargin(cost: number, price: number): number {
    if (cost === 0) return 0;
    return ((price - cost) / price) * 100;
  }

  /**
   * Calcula el markup entre costo y precio
   */
  static calculateMarkup(cost: number, price: number): number {
    if (cost === 0) return 0;
    return ((price - cost) / cost) * 100;
  }

  /**
   * Calcula el precio sugerido basado en el modo de pricing
   */
  static calculateSuggestedPrice(
    cost: number,
    pricingMode: string,
    targetMargin?: number | null,
    targetMarkup?: number | null,
    roundingStep: number = 10
  ): number {
    let basePrice: number;

    switch (pricingMode) {
      case 'margin':
        if (!targetMargin || targetMargin <= 0 || targetMargin >= 100) {
          throw new Error('Target margin debe estar entre 0 y 100');
        }
        // Precio = Costo / (1 - Margen%)
        basePrice = cost / (1 - targetMargin / 100);
        break;

      case 'markup':
        if (!targetMarkup || targetMarkup <= 0) {
          throw new Error('Target markup debe ser mayor a 0');
        }
        // Precio = Costo * (1 + Markup%)
        basePrice = cost * (1 + targetMarkup / 100);
        break;

      case 'fixed':
      case 'suggest':
        // No calcular precio automáticamente
        return 0;

      default:
        throw new Error(`Pricing mode no válido: ${pricingMode}`);
    }

    return this.roundToStep(basePrice, roundingStep);
  }

  /**
   * Calcula el nuevo costo usando promedio ponderado
   */
  static calculateWeightedAverageCost(
    currentCost: number,
    currentStock: number,
    purchaseCost: number,
    purchaseQuantity: number
  ): number {
    if (currentStock <= 0) {
      return purchaseCost;
    }

    const totalValue = currentCost * currentStock + purchaseCost * purchaseQuantity;
    const totalQuantity = currentStock + purchaseQuantity;

    return totalValue / totalQuantity;
  }

  /**
   * Crea una sugerencia de cambio de precio
   */
  static async createPriceSuggestion(params: {
    businessId: string;
    productId: string;
    purchaseId?: string;
    oldCost: number;
    newCost: number;
    oldPrice: number;
    suggestedPrice: number;
    pricingMode: string;
    reason?: string;
    requestedBy: string;
  }) {
    const oldMargin = this.calculateMargin(params.oldCost, params.oldPrice);
    const newMargin = this.calculateMargin(params.newCost, params.suggestedPrice);

    return await prisma.priceSuggestion.create({
      data: {
        businessId: params.businessId,
        productId: params.productId,
        purchaseId: params.purchaseId,
        oldCost: new Prisma.Decimal(params.oldCost),
        newCost: new Prisma.Decimal(params.newCost),
        oldPrice: new Prisma.Decimal(params.oldPrice),
        suggestedPrice: new Prisma.Decimal(params.suggestedPrice),
        oldMargin: new Prisma.Decimal(oldMargin),
        newMargin: new Prisma.Decimal(newMargin),
        pricingMode: params.pricingMode,
        reason: params.reason,
        requestedBy: params.requestedBy,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            internalSku: true,
          },
        },
      },
    });
  }

  /**
   * Obtiene sugerencias pendientes
   */
  static async getPendingSuggestions(businessId: string, filters?: {
    productId?: string;
    status?: string;
    limit?: number;
  }) {
    return await prisma.priceSuggestion.findMany({
      where: {
        businessId,
        productId: filters?.productId,
        status: filters?.status || 'PENDING',
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            internalSku: true,
            barcode: true,
            price: true,
            cost: true,
          },
        },
        purchase: {
          select: {
            id: true,
            invoiceNumber: true,
            supplier: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        requestedAt: 'desc',
      },
      take: filters?.limit || 50,
    });
  }

  /**
   * Aprueba una sugerencia de precio y actualiza el producto
   */
  static async approvePriceSuggestion(
    suggestionId: string,
    approvedBy: string,
    businessId: string
  ) {
    const suggestion = await prisma.priceSuggestion.findFirst({
      where: {
        id: suggestionId,
        businessId,
        status: 'PENDING',
      },
      include: {
        product: true,
      },
    });

    if (!suggestion) {
      throw new Error('Sugerencia no encontrada o ya procesada');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Actualizar el precio del producto
      const updatedProduct = await tx.product.update({
        where: { id: suggestion.productId },
        data: {
          price: suggestion.suggestedPrice,
        },
      });

      // 2. Marcar la sugerencia como aprobada
      const approvedSuggestion = await tx.priceSuggestion.update({
        where: { id: suggestionId },
        data: {
          status: 'APPROVED',
          approvedBy,
          approvedAt: new Date(),
        },
      });

      // 3. Registrar en historial de precios
      await tx.priceHistory.create({
        data: {
          businessId,
          productId: suggestion.productId,
          purchaseId: suggestion.purchaseId,
          oldCost: suggestion.oldCost,
          newCost: suggestion.newCost,
          oldPrice: suggestion.oldPrice,
          newPrice: suggestion.suggestedPrice,
          oldMargin: suggestion.oldMargin,
          newMargin: suggestion.newMargin,
          reason: 'approved_suggestion',
          changedBy: approvedBy,
        },
      });

      return {
        suggestion: approvedSuggestion,
        product: updatedProduct,
      };
    });
  }

  /**
   * Rechaza una sugerencia de precio
   */
  static async rejectPriceSuggestion(
    suggestionId: string,
    rejectedBy: string,
    businessId: string,
    rejectionReason?: string
  ) {
    const suggestion = await prisma.priceSuggestion.findFirst({
      where: {
        id: suggestionId,
        businessId,
        status: 'PENDING',
      },
    });

    if (!suggestion) {
      throw new Error('Sugerencia no encontrada o ya procesada');
    }

    return await prisma.priceSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'REJECTED',
        rejectedBy,
        rejectedAt: new Date(),
        rejectionReason,
      },
    });
  }

  /**
   * Registra un cambio manual de precio en el historial
   */
  static async recordManualPriceChange(params: {
    businessId: string;
    productId: string;
    oldCost: number;
    newCost: number;
    oldPrice: number;
    newPrice: number;
    changedBy: string;
  }) {
    const oldMargin = this.calculateMargin(params.oldCost, params.oldPrice);
    const newMargin = this.calculateMargin(params.newCost, params.newPrice);

    return await prisma.priceHistory.create({
      data: {
        businessId: params.businessId,
        productId: params.productId,
        oldCost: new Prisma.Decimal(params.oldCost),
        newCost: new Prisma.Decimal(params.newCost),
        oldPrice: new Prisma.Decimal(params.oldPrice),
        newPrice: new Prisma.Decimal(params.newPrice),
        oldMargin: new Prisma.Decimal(oldMargin),
        newMargin: new Prisma.Decimal(newMargin),
        reason: 'manual_adjustment',
        changedBy: params.changedBy,
      },
    });
  }

  /**
   * Obtiene el historial de precios de un producto
   */
  static async getPriceHistory(productId: string, businessId: string, limit: number = 50) {
    return await prisma.priceHistory.findMany({
      where: {
        productId,
        businessId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Procesa el cambio de costo de un producto tras una compra
   * Genera sugerencia de precio si corresponde
   */
  static async processCostChange(params: {
    businessId: string;
    productId: string;
    purchaseId: string;
    purchaseCost: number;
    purchaseQuantity: number;
    requestedBy: string;
    oldCost?: number;
    newCost?: number;
  }) {
    const product = await prisma.product.findUnique({
      where: { id: params.productId },
    });

    if (!product) {
      throw new Error('Producto no encontrado');
    }

    console.log('🔍 [PricingService] Procesando cambio de costo para producto:', {
      productId: product.id,
      productName: product.name,
      pricingMode: product.pricingMode,
      targetMargin: product.targetMargin,
      targetMarkup: product.targetMarkup,
      priceLocked: product.priceLocked,
      roundingStep: product.roundingStep,
      costMethod: product.costMethod,
      paramsOldCost: params.oldCost,
      paramsNewCost: params.newCost,
    });

    // Usar oldCost y newCost proporcionados, o calcularlos
    let oldCost: number;
    let newCost: number;

    if (params.oldCost !== undefined && params.newCost !== undefined) {
      // Usar valores proporcionados desde purchase.service
      oldCost = params.oldCost;
      newCost = params.newCost;
      console.log('✅ [PricingService] Usando costos proporcionados:', { oldCost, newCost });
    } else {
      // Calcular costos (fallback)
      oldCost = Number(product.cost);
      const currentStock = Number(product.stockQuantity);

      // Calcular nuevo costo según el método configurado
      if (product.costMethod === 'last_cost') {
        newCost = params.purchaseCost;
      } else {
        // avg_weighted (por defecto)
        newCost = this.calculateWeightedAverageCost(
          oldCost,
          currentStock,
          params.purchaseCost,
          params.purchaseQuantity
        );
      }
      console.log('⚠️ [PricingService] Calculando costos (fallback):', { oldCost, newCost });
    }

    // Registrar cambio de costo en historial (aunque no cambie el precio)
    const oldPrice = Number(product.price);
    const oldMargin = this.calculateMargin(oldCost, oldPrice);
    const newMargin = this.calculateMargin(newCost, oldPrice);

    await prisma.priceHistory.create({
      data: {
        businessId: params.businessId,
        productId: params.productId,
        purchaseId: params.purchaseId,
        oldCost: new Prisma.Decimal(oldCost),
        newCost: new Prisma.Decimal(newCost),
        oldPrice: new Prisma.Decimal(oldPrice),
        newPrice: new Prisma.Decimal(oldPrice), // Precio no cambia aún
        oldMargin: new Prisma.Decimal(oldMargin),
        newMargin: new Prisma.Decimal(newMargin),
        reason: 'purchase',
        changedBy: params.requestedBy,
      },
    });

    // Verificar si debe generar sugerencia de precio
    const hasTargetMargin = product.targetMargin && Number(product.targetMargin) > 0;
    const hasTargetMarkup = product.targetMarkup && Number(product.targetMarkup) > 0;
    const costChanged = Math.abs(newCost - oldCost) > 0.01;
    
    console.log('📊 [PricingService] Validación de sugerencia:', {
      priceLocked: product.priceLocked,
      pricingMode: product.pricingMode,
      hasTargetMargin,
      hasTargetMarkup,
      costChanged,
      oldCost,
      newCost,
      costDifference: newCost - oldCost,
    });
    
    const shouldSuggestPrice =
      !product.priceLocked &&
      product.pricingMode &&
      ['margin', 'markup'].includes(product.pricingMode) &&
      ((product.pricingMode === 'margin' && hasTargetMargin) ||
       (product.pricingMode === 'markup' && hasTargetMarkup)) &&
      costChanged;

    console.log('✅ shouldSuggestPrice:', shouldSuggestPrice);

    if (shouldSuggestPrice && product.pricingMode) {
      try {
        const suggestedPrice = this.calculateSuggestedPrice(
          newCost,
          product.pricingMode,
          hasTargetMargin ? Number(product.targetMargin) : undefined,
          hasTargetMarkup ? Number(product.targetMarkup) : undefined,
          product.roundingStep || 10
        );

        console.log('💰 [PricingService] Precio sugerido calculado:', {
          suggestedPrice,
          oldPrice,
          difference: suggestedPrice - oldPrice,
        });

        // Solo crear sugerencia si el precio sugerido es diferente al actual
        if (Math.abs(suggestedPrice - oldPrice) > 0.01) {
          console.log('📝 [PricingService] Creando sugerencia de precio...');
          await this.createPriceSuggestion({
            businessId: params.businessId,
            productId: params.productId,
            purchaseId: params.purchaseId,
            oldCost,
            newCost,
            oldPrice,
            suggestedPrice,
            pricingMode: product.pricingMode,
            reason: `Cambio de costo por compra (${oldCost.toFixed(2)} → ${newCost.toFixed(2)})`,
            requestedBy: params.requestedBy,
          });
          console.log('✅ [PricingService] Sugerencia creada exitosamente');
        } else {
          console.log('⚠️ [PricingService] Precio sugerido igual al actual, no se crea sugerencia');
        }
      } catch (error) {
        console.error('❌ [PricingService] Error al calcular/crear sugerencia:', error);
        throw error;
      }
    } else {
      console.log('⚠️ [PricingService] No se generará sugerencia. Razones:', {
        priceLocked: product.priceLocked,
        pricingMode: product.pricingMode,
        validMode: product.pricingMode && ['margin', 'markup'].includes(product.pricingMode),
        hasTargetMargin,
        hasTargetMarkup,
        costChanged,
      });
    }

    return {
      oldCost,
      newCost,
      oldPrice,
      newMargin,
      suggestionCreated: shouldSuggestPrice,
    };
  }
}
