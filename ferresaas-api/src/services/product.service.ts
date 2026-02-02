import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { Prisma } from '@prisma/client';
import bwipjs from 'bwip-js';
import PDFDocument from 'pdfkit';

export class ProductService {
  /**
   * Generar internal SKU único
   */
  private async generateInternalSku(businessId: string): Promise<string> {
    // Obtener el último producto del negocio
    const lastProduct = await prisma.product.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      select: { internalSku: true },
    });

    let nextNumber = 1;

    if (lastProduct && lastProduct.internalSku.startsWith('FER-')) {
      const lastNumber = parseInt(lastProduct.internalSku.replace('FER-', ''));
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `FER-${String(nextNumber).padStart(5, '0')}`;
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
      minStock?: number;
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
        minStock: data.minStock,
        stockQuantity: 0, // Stock inicial en 0
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
        orderBy: { createdAt: 'desc' },
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
      minStock?: number | null;
      isActive: boolean;
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

    // Actualizar
    const updated = await prisma.product.update({
      where: { id: productId },
      data,
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
