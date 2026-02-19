import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { Prisma } from '@prisma/client';
import bwipjs from 'bwip-js';
import PDFDocument from 'pdfkit';
import { calculateSuggestedPrice } from '../utils/pricing';
import { CloudinaryService } from './cloudinary.service';

export class ProductService {
  /**
   * Generar internal SKU único
   */
  private async generateInternalSku(businessId: string): Promise<string> {
    // Obtener todos los productos del negocio y encontrar el número más alto
    const allProducts = await prisma.product.findMany({
      where: { businessId },
      select: { internalSku: true },
      orderBy: { internalSku: 'desc' },
      take: 1,
    });

    let nextNumber = 1;

    if (allProducts.length > 0) {
      const lastSku = allProducts[0].internalSku;
      if (lastSku.startsWith('FER-')) {
        const lastNumber = parseInt(lastSku.replace('FER-', ''));
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
    }

    // Generar SKU candidato
    let sku = `FER-${String(nextNumber).padStart(5, '0')}`;
    
    // Verificar que no exista (en caso de conflicto, incrementar)
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.product.findUnique({
        where: { internalSku: sku },
      });
      
      if (!existing) {
        return sku;
      }
      
      // Si existe, incrementar y reintentar
      nextNumber++;
      sku = `FER-${String(nextNumber).padStart(5, '0')}`;
      attempts++;
    }

    throw new AppError(500, 'SKU_GENERATION_FAILED', 'Unable to generate unique SKU after multiple attempts');
  }

  /**
   * Crear producto
   */
  async create(
    businessId: string,
    userId: string,
    data: {
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
      marginPercent?: number | null;
      minStock?: number | null;
      pricingMode?: string;
      targetMargin?: number | null;
      targetMarkup?: number | null;
      priceLocked?: boolean;
      roundingStep?: number;
      costMethod?: string;
    }
  ) {
    // Generar SKU interno
    const internalSku = await this.generateInternalSku(businessId);

    // Verificar si el barcode ya existe (si se proporcionó)
    if (data.barcode) {
      const existing = await prisma.product.findUnique({
        where: { barcode: data.barcode },
      });

      if (existing) {
        throw new AppError(409, 'BARCODE_EXISTS', 'Barcode already exists');
      }
    }

    // Calcular precio sugerido si se proporcionó margen
    let suggestedPrice: number | undefined;
    if (data.marginPercent !== undefined && data.marginPercent !== null) {
      suggestedPrice = calculateSuggestedPrice(
        data.cost,
        data.taxRate,
        data.marginPercent
      );
    }

    // Crear producto
    const product = await prisma.product.create({
      data: {
        businessId,
        internalSku,
        barcode: data.barcode,
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        brandId: data.brandId,
        unit: data.unit,
        isFractional: data.isFractional,
        cost: data.cost,
        price: data.price,
        taxRate: data.taxRate,
        marginPercent: data.marginPercent,
        suggestedPrice,
        minStock: data.minStock,
        stockQuantity: 0, // Stock inicial en 0
        pricingMode: data.pricingMode || 'margin',
        targetMargin: data.targetMargin,
        targetMarkup: data.targetMarkup,
        priceLocked: data.priceLocked || false,
        roundingStep: data.roundingStep || 10,
        costMethod: data.costMethod || 'avg_weighted',
      },
      include: {
        category: true,
        brand: true,
      },
    });

    // Auditoría
    await AuditService.logCreate(businessId, userId, 'products', product.id, {
      name: product.name,
      internalSku: product.internalSku,
      barcode: product.barcode,
    });

    return product;
  }

  /**
   * Listar productos con filtros
   */
  async list(
    businessId: string,
    filters: {
      q?: string;
      categoryId?: string;
      brandId?: string;
      active?: boolean;
      lowStock?: boolean;
      priceMin?: number;
      priceMax?: number;
      sort?: 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'stock-asc' | 'stock-desc' | 'created-desc';
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      businessId,
    };

    // Filtro de búsqueda
    if (filters.q) {
      where.OR = [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { internalSku: { contains: filters.q, mode: 'insensitive' } },
        { barcode: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    // Filtro por categoría
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    // Filtro por marca
    if (filters.brandId) {
      where.brandId = filters.brandId;
    }

    // Filtro por activo
    if (filters.active !== undefined) {
      where.isActive = filters.active;
    }

    // Filtro por stock bajo
    if (filters.lowStock) {
      where.AND = [
        { minStock: { not: null } },
        {
          stockQuantity: {
            lte: prisma.product.fields.minStock,
          },
        },
      ];
    }

    // Filtro por precio
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      where.price = {
        ...(filters.priceMin !== undefined ? { gte: filters.priceMin } : {}),
        ...(filters.priceMax !== undefined ? { lte: filters.priceMax } : {}),
      };
    }

    // Ordenamiento
    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    switch (filters.sort) {
      case 'name-asc':
        orderBy = { name: 'asc' };
        break;
      case 'name-desc':
        orderBy = { name: 'desc' };
        break;
      case 'price-asc':
        orderBy = { price: 'asc' };
        break;
      case 'price-desc':
        orderBy = { price: 'desc' };
        break;
      case 'stock-asc':
        orderBy = { stockQuantity: 'asc' };
        break;
      case 'stock-desc':
        orderBy = { stockQuantity: 'desc' };
        break;
      case 'created-desc':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Ejecutar queries en paralelo
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: true,
          brand: true,
        },
        orderBy,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items: products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  }

  /**
   * Obtener producto por ID
   */
  async getById(businessId: string, productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        brand: true,
        priceHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }

    if (product.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    return product;
  }

  /**
   * Actualizar producto
   */
  async update(
    businessId: string,
    userId: string,
    productId: string,
    data: Partial<{
      barcode?: string;
      name: string;
      description?: string;
      categoryId?: string | null;
      brandId?: string | null;
      unit: string;
      isFractional: boolean;
      cost: number;
      price: number;
      taxRate: number;
      marginPercent?: number | null;
      minStock?: number | null;
      isActive: boolean;
      pricingMode?: string;
      targetMargin?: number | null;
      targetMarkup?: number | null;
      priceLocked?: boolean;
      roundingStep?: number;
      costMethod?: string;
    }>
  ) {
    // Obtener producto actual
    const current = await this.getById(businessId, productId);

    // Si se actualiza el barcode, verificar que no exista
    if (data.barcode && data.barcode !== current.barcode) {
      const existing = await prisma.product.findUnique({
        where: { barcode: data.barcode },
      });

      if (existing && existing.id !== productId) {
        throw new AppError(409, 'BARCODE_EXISTS', 'Barcode already exists');
      }
    }

    // Recalcular precio sugerido si cambiaron cost, taxRate o marginPercent
    let suggestedPrice: number | undefined;
    const finalCost = data.cost ?? Number(current.cost);
    const finalTaxRate = data.taxRate ?? Number(current.taxRate);
    const finalMarginPercent = data.marginPercent !== undefined 
      ? data.marginPercent 
      : (current.marginPercent ? Number(current.marginPercent) : undefined);

    if (finalMarginPercent !== undefined && finalMarginPercent !== null) {
      suggestedPrice = calculateSuggestedPrice(
        finalCost,
        finalTaxRate,
        finalMarginPercent
      );
    }

    // Registrar cambio de precio en historial si cambió cost o price
    const oldCost = Number(current.cost);
    const oldPrice = Number(current.price);
    const newCost = data.cost ?? oldCost;
    const newPrice = data.price ?? oldPrice;

    if (newCost !== oldCost || newPrice !== oldPrice) {
      await prisma.priceHistory.create({
        data: {
          businessId,
          productId,
          oldCost: oldCost,
          newCost: newCost,
          oldPrice: oldPrice,
          newPrice: newPrice,
          reason: 'Actualización de producto',
          changedBy: userId,
        },
      });
    }

    // Actualizar
    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        ...data,
        suggestedPrice,
      },
      include: {
        category: true,
        brand: true,
      },
    });

    // Auditoría
    await AuditService.logUpdate(businessId, userId, 'products', productId, current, updated);

    return updated;
  }

  /**
   * Actualizar precio (crea historial)
   */
  async updatePrice(
    businessId: string,
    userId: string,
    productId: string,
    newCost: number,
    newPrice: number,
    reason?: string
  ) {
    const product = await this.getById(businessId, productId);

    // Crear registro en historial
    await prisma.priceHistory.create({
      data: {
        businessId,
        productId,
        oldCost: product.cost,
        newCost,
        oldPrice: product.price,
        newPrice,
        reason,
        changedBy: userId,
      },
    });

    // Actualizar producto
    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        cost: newCost,
        price: newPrice,
      },
    });

    // Auditoría
    await AuditService.log({
      businessId,
      userId,
      action: 'PRICE_UPDATE',
      entity: 'products',
      entityId: productId,
      before: { cost: product.cost, price: product.price },
      after: { cost: newCost, price: newPrice },
    });

    return updated;
  }

  /**
   * Eliminar producto (soft delete)
   */
  async delete(businessId: string, userId: string, productId: string) {
    const product = await this.getById(businessId, productId);

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });

    // Auditoría
    await AuditService.logDelete(businessId, userId, 'products', productId, product);

    return updated;
  }

  /**
   * Obtener historial de precios con filtro de rango de fechas
   */
  async getPriceHistory(
    businessId: string,
    productId: string,
    filters: {
      from?: Date;
      to?: Date;
    }
  ) {
    // Verificar que el producto existe y pertenece al negocio
    await this.getById(businessId, productId);

    const where: Prisma.PriceHistoryWhereInput = {
      businessId,
      productId,
    };

    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) {
        where.createdAt.gte = filters.from;
      }
      if (filters.to) {
        where.createdAt.lte = filters.to;
      }
    }

    const history = await prisma.priceHistory.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return history;
  }

  /**
   * Obtener resumen de ventas de un producto con filtro de rango de fechas
   */
  async getSalesSummary(
    businessId: string,
    productId: string,
    filters: {
      from?: Date;
      to?: Date;
    }
  ) {
    // Verificar que el producto existe y pertenece al negocio
    await this.getById(businessId, productId);

    const saleItemWhere: Prisma.SaleItemWhereInput = {
      productId,
      sale: {
        businessId,
        status: 'CONFIRMED',
      },
    };

    if (filters.from || filters.to) {
      saleItemWhere.sale = {
        ...saleItemWhere.sale as object,
        confirmedAt: {
          ...(filters.from ? { gte: filters.from } : {}),
          ...(filters.to ? { lte: filters.to } : {}),
        },
      };
    }

    // Obtener todos los items de venta del producto en el rango
    const saleItems = await prisma.saleItem.findMany({
      where: saleItemWhere,
      include: {
        sale: {
          select: {
            confirmedAt: true,
          },
        },
      },
      orderBy: {
        sale: {
          confirmedAt: 'asc',
        },
      },
    });

    // Calcular totales
    let totalUnits = 0;
    let totalRevenue = 0;

    // Agrupar por día para el gráfico
    const dailyMap = new Map<string, { units: number; revenue: number }>();

    for (const item of saleItems) {
      const qty = Number(item.quantity);
      const sub = Number(item.subtotal);
      totalUnits += qty;
      totalRevenue += sub;

      const dateKey = item.sale.confirmedAt
        ? item.sale.confirmedAt.toISOString().split('T')[0]
        : 'unknown';

      if (dateKey !== 'unknown') {
        const existing = dailyMap.get(dateKey) || { units: 0, revenue: 0 };
        existing.units += qty;
        existing.revenue += sub;
        dailyMap.set(dateKey, existing);
      }
    }

    // Convertir mapa a array ordenado
    const points = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        units: data.units,
        revenue: Math.round(data.revenue * 100) / 100,
      }));

    return {
      totalUnits,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalTransactions: saleItems.length,
      points,
    };
  }

  /**
   * Obtener movimientos de stock de un producto con filtro de rango de fechas
   */
  async getStockMovements(
    businessId: string,
    productId: string,
    filters: {
      from?: Date;
      to?: Date;
      limit?: number;
    }
  ) {
    // Verificar que el producto existe y pertenece al negocio
    await this.getById(businessId, productId);

    const where: Prisma.InventoryMovementWhereInput = {
      businessId,
      productId,
    };

    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) {
        where.createdAt.gte = filters.from;
      }
      if (filters.to) {
        where.createdAt.lte = filters.to;
      }
    }

    const movements = await prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
    });

    return movements;
  }

  /**
   * Subir imagen de producto a Cloudinary
   */
  async uploadImage(
    businessId: string,
    userId: string,
    productId: string,
    file: Express.Multer.File
  ) {
    const product = await this.getById(businessId, productId);

    // Eliminar imagen anterior si existe en Cloudinary
    if (product.imagePublicId) {
      try {
        await CloudinaryService.deleteImage(product.imagePublicId);
      } catch (error) {
        console.warn('⚠️ Error deleting old image from Cloudinary:', error);
      }
    }

    // Subir nueva imagen a Cloudinary
    const uploadResult = await CloudinaryService.uploadImage(file) as any;

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        imageUrl: uploadResult.secure_url,
        imagePublicId: uploadResult.public_id,
      },
      include: {
        category: true,
        brand: true,
      },
    });

    // Auditoría
    await AuditService.log({
      businessId,
      userId,
      action: 'PRODUCT_IMAGE_UPLOAD',
      entity: 'products',
      entityId: productId,
      after: { imageUrl: uploadResult.secure_url },
    });

    return updated;
  }

  /**
   * Eliminar imagen de producto de Cloudinary
   */
  async deleteImage(
    businessId: string,
    userId: string,
    productId: string
  ) {
    const product = await this.getById(businessId, productId);

    if (!product.imageUrl) {
      throw new AppError(404, 'IMAGE_NOT_FOUND', 'Product has no image');
    }

    // Eliminar imagen de Cloudinary
    if (product.imagePublicId) {
      try {
        await CloudinaryService.deleteImage(product.imagePublicId);
      } catch (error) {
        console.warn('⚠️ Error deleting image from Cloudinary:', error);
      }
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { 
        imageUrl: null,
        imagePublicId: null,
      },
      include: {
        category: true,
        brand: true,
      },
    });

    // Auditoría
    await AuditService.log({
      businessId,
      userId,
      action: 'PRODUCT_IMAGE_DELETE',
      entity: 'products',
      entityId: productId,
      before: { imageUrl: product.imageUrl },
    });

    return updated;
  }

  /**
   * Generar etiqueta en PDF con código de barras
   */
  async generateLabelPdf(
    businessId: string,
    productId: string,
    format: 'a4' | 'label' = 'label'
  ): Promise<{ buffer: Buffer; filename: string }> {
    const product = await this.getById(businessId, productId);

    const codeValue = product.barcode || product.internalSku;

    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: 'code128',
      text: codeValue,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: 'center',
    });

    const pageOptions =
      format === 'a4'
        ? { size: 'A4' as const, margin: 48 }
        : { size: [360, 220] as [number, number], margin: 20 };

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument(pageOptions);
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      doc.fontSize(18).text(product.name, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`SKU interno: ${product.internalSku}`, { align: 'center' });

      if (product.barcode) {
        doc.text(`Código de barras: ${product.barcode}`, { align: 'center' });
      }

      const priceValue = Number(product.price);
      const taxValue = Number(product.taxRate);

      doc.text(`Precio: $${priceValue.toFixed(2)}`, { align: 'center' });
      doc.text(`IVA: ${taxValue.toFixed(2)}%`, { align: 'center' });

      doc.moveDown(0.5);

      const barcodeWidth = availableWidth - (format === 'a4' ? 60 : 30);
      const barcodeX = doc.page.margins.left + (availableWidth - barcodeWidth) / 2;

      doc.image(barcodeBuffer, barcodeX, doc.y, {
        fit: [barcodeWidth, format === 'a4' ? 140 : 100],
        align: 'center',
      });

      doc.end();
    });

    const safeName = product.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

    return {
      buffer: pdfBuffer,
      filename: `${product.internalSku}-${safeName}-etiqueta.pdf`,
    };
  }
}
