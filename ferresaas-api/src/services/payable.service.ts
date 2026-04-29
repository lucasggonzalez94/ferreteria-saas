import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { FinancialAccountService } from './financial-account.service';
import { FinancialMovementService } from './financial-movement.service';
import { Decimal } from '@prisma/client/runtime/library';

export class PayableService {
  private financialAccountService: FinancialAccountService;
  private financialMovementService: FinancialMovementService;

  constructor() {
    this.financialAccountService = new FinancialAccountService();
    this.financialMovementService = new FinancialMovementService();
  }
  /**
   * Crear cuenta por pagar desde una compra
   */
  async createFromPurchase(
    businessId: string,
    userId: string,
    purchaseId: string,
    dueDate?: Date
  ) {
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { supplier: true },
    });

    if (!purchase) {
      throw new AppError(404, 'PURCHASE_NOT_FOUND', 'Purchase not found');
    }

    if (purchase.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    const payable = await prisma.supplierPayable.create({
      data: {
        businessId,
        supplierId: purchase.supplierId,
        purchaseId,
        amount: purchase.total,
        dueDate,
        status: 'PENDING',
      },
    });

    await AuditService.logCreate(businessId, userId, 'supplier_payables', payable.id, {
      supplierId: purchase.supplierId,
      purchaseId,
      amount: purchase.total,
    });

    return payable;
  }

  /**
   * Listar cuentas por pagar
   */
  async list(
    businessId: string,
    filters: {
      supplierId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
      dueDateFrom?: Date;
      dueDateTo?: Date;
      search?: string;
      minAmount?: number;
      maxAmount?: number;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId };

    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.status) {
      // Soportar múltiples estados separados por coma
      const statuses = filters.status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else if (statuses.length > 1) {
        where.status = { in: statuses };
      }
    }

    if (filters.startDate || filters.endDate) {
      const createdAtFilter: Record<string, Date> = {};
      if (filters.startDate) createdAtFilter.gte = filters.startDate;
      if (filters.endDate) createdAtFilter.lte = filters.endDate;
      where.createdAt = createdAtFilter;
    }

    if (filters.dueDateFrom || filters.dueDateTo) {
      const dueDateFilter: Record<string, Date> = {};
      if (filters.dueDateFrom) dueDateFilter.gte = filters.dueDateFrom;
      if (filters.dueDateTo) dueDateFilter.lte = filters.dueDateTo;
      where.dueDate = dueDateFilter;
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      const amountFilter: Record<string, number> = {};
      if (filters.minAmount !== undefined) amountFilter.gte = filters.minAmount;
      if (filters.maxAmount !== undefined) amountFilter.lte = filters.maxAmount;
      where.amount = amountFilter;
    }

    if (filters.search) {
      where.supplier = {
        name: { contains: filters.search, mode: 'insensitive' },
      };
    }

    const [payables, total] = await Promise.all([
      prisma.supplierPayable.findMany({
        where,
        skip,
        take: limit,
        include: {
          supplier: { select: { id: true, name: true } },
          purchase: { select: { id: true, invoiceNumber: true } },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.supplierPayable.count({ where }),
    ]);

    return {
      items: payables,
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
   * Registrar pago a proveedor
   */
  async recordPayment(
    businessId: string,
    userId: string,
    payableId: string,
    amount: number,
    method: string,
    reference?: string,
    notes?: string,
    checkNumber?: string,
    checkAccountId?: string
  ) {
    const payable = await prisma.supplierPayable.findUnique({
      where: { id: payableId },
    });

    if (!payable) {
      throw new AppError(404, 'PAYABLE_NOT_FOUND', 'Payable not found');
    }

    if (payable.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    if (amount <= 0) {
      throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be positive');
    }

    const newPaidAmount = Number(payable.paidAmount) + amount;
    if (newPaidAmount > Number(payable.amount)) {
      throw new AppError(400, 'OVERPAYMENT', 'Payment exceeds payable amount');
    }

    // Validar fondos disponibles antes de registrar el pago (excepto para CHECK)
    if (method === 'CHECK') {
      // Validar parámetros específicos para cheques
      if (!checkNumber) {
        throw new AppError(400, 'CHECK_NUMBER_REQUIRED', 'Check number is required for check payments');
      }
      if (!checkAccountId) {
        throw new AppError(400, 'CHECK_ACCOUNT_REQUIRED', 'Bank account is required for check payments');
      }
    } else {
      const accountType = FinancialMovementService.getAccountTypeByPaymentMethod(method);
      const account = await this.financialAccountService.getDefaultByType(businessId, accountType);
      await this.financialAccountService.validateFunds(account.id, amount);
    }

    const payment = await prisma.$transaction(async (tx) => {
      // Crear registro de pago
      const newPayment = await tx.supplierPayment.create({
        data: {
          businessId,
          payableId,
          amount: new Decimal(amount),
          method,
          reference,
          notes,
          recordedBy: userId,
        },
      });

      // Actualizar monto pagado en cuenta por pagar
      const newStatus =
        newPaidAmount >= Number(payable.amount)
          ? 'PAID'
          : newPaidAmount > 0
          ? 'PARTIAL'
          : 'PENDING';

      await tx.supplierPayable.update({
        where: { id: payableId },
        data: {
          paidAmount: new Decimal(newPaidAmount),
          status: newStatus,
        },
      });

      // Actualizar saldo del proveedor
      const supplier = await tx.supplier.findUnique({
        where: { id: payable.supplierId },
      });

      if (supplier) {
        const newBalance = Math.max(0, Number(supplier.currentBalance) - amount);
        await tx.supplier.update({
          where: { id: payable.supplierId },
          data: { currentBalance: new Decimal(newBalance) },
        });
      }

      // Crear movimiento financiero o registrar cheque
      if (method === 'CHECK') {
        // Registrar cheque sin descontar fondos inmediatos
        const supplier = await tx.supplier.findUnique({
          where: { id: payable.supplierId },
        });

        await tx.checkRegister.create({
          data: {
            businessId,
            accountId: checkAccountId!,
            checkNumber: checkNumber!,
            amount: new Decimal(amount),
            currency: payable.currency,
            dueDate: payable.dueDate,
            payableId,
            paymentId: newPayment.id,
            recipientName: supplier?.name,
            notes: notes || `Pago a proveedor`,
            status: 'ISSUED',
          },
        });
      } else {
        // Para otros métodos, descontar inmediatamente
        const accountType = FinancialMovementService.getAccountTypeByPaymentMethod(method);
        const account = await tx.financialAccount.findFirst({
          where: {
            businessId,
            type: accountType,
            isDefault: true,
            isActive: true,
          },
        });

        if (account) {
          // Actualizar balance de cuenta
          const currentBalance = account.balance.toNumber();
          const newAccountBalance = currentBalance - amount;

          await tx.financialAccount.update({
            where: { id: account.id },
            data: { balance: newAccountBalance },
          });

          // Crear movimiento financiero
          await tx.financialMovement.create({
            data: {
              businessId,
              accountId: account.id,
              type: 'EXPENSE',
              amount: new Decimal(amount),
              sourceType: 'SUPPLIER_PAYMENT',
              sourceId: newPayment.id,
              description: `Pago a proveedor - ${method}`,
              balanceAfter: newAccountBalance,
              createdBy: userId,
              createdAt: new Date(),
            },
          });
        }
      }

      return newPayment;
    });

    await AuditService.logCreate(businessId, userId, 'supplier_payments', payment.id, {
      payableId,
      amount,
      method,
    });

    return payment;
  }

  /**
   * Obtener resumen de cuentas por pagar
   */
  async getSummary(businessId: string) {
    const payables = await prisma.supplierPayable.findMany({
      where: { businessId },
      select: {
        amount: true,
        paidAmount: true,
        status: true,
        dueDate: true,
      },
    });

    const totalOriginal = payables.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalPaid = payables.reduce((sum, p) => sum + Number(p.paidAmount), 0);
    const totalPending = totalOriginal - totalPaid;

    const now = new Date();
    const overdue = payables.filter(
      (p) => p.dueDate && p.dueDate < now && p.status !== 'PAID'
    ).length;

    return {
      totalPayable: totalPending,
      totalPending,
      totalPaid,
      overdue,
      byStatus: {
        pending: payables.filter((p) => p.status === 'PENDING').length,
        partial: payables.filter((p) => p.status === 'PARTIAL').length,
        paid: payables.filter((p) => p.status === 'PAID').length,
      },
    };
  }
}
