import { prisma } from '../config/database';
import { AppError } from '../utils/response';

export class SupplierService {
  /**
   * Listar proveedores con paginación y búsqueda
   */
  async list(
    businessId: string,
    filters: {
      search?: string;
      isActive?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      businessId,
    };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { cuit: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: { purchases: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.supplier.count({ where }),
    ]);

    return {
      items: suppliers,
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
   * Obtener resumen de proveedor (KPIs)
   */
  async getSummary(businessId: string, supplierId: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
    }

    if (supplier.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    const [purchases, payables, lastPurchase] = await Promise.all([
      prisma.purchase.findMany({
        where: { supplierId, businessId },
        select: { total: true },
      }),
      prisma.supplierPayable.findMany({
        where: { supplierId, businessId },
        select: { amount: true, paidAmount: true, status: true },
      }),
      prisma.purchase.findFirst({
        where: { supplierId, businessId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.total), 0);
    const totalPayable = payables.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalPaid = payables.reduce((sum, p) => sum + Number(p.paidAmount), 0);
    const pendingPayment = totalPayable - totalPaid;

    return {
      supplier,
      stats: {
        totalPurchases: purchases.length,
        totalAmount: totalPurchases,
        totalPayable,
        totalPaid,
        pendingPayment,
        lastPurchaseDate: lastPurchase?.createdAt || null,
      },
    };
  }
}
