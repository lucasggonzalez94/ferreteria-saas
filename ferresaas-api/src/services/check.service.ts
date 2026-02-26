import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { FinancialAccountService } from './financial-account.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface CheckSummaryItem {
  accountId: string;
  accountName: string;
  totalPending: number;
  count: number;
  currency: string;
}

export class CheckService {
  private financialAccountService: FinancialAccountService;

  constructor() {
    this.financialAccountService = new FinancialAccountService();
  }

  /**
   * Registrar emisión de cheque
   */
  async issueCheck(
    businessId: string,
    userId: string,
    data: {
      accountId: string;
      checkNumber: string;
      amount: number;
      currency?: string;
      payableId?: string;
      paymentId?: string;
      recipientName?: string;
      notes?: string;
    }
  ) {
    // Validar que la cuenta existe y pertenece al negocio
    const account = await prisma.financialAccount.findUnique({
      where: { id: data.accountId },
    });

    if (!account) {
      throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Financial account not found');
    }

    if (account.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    if (account.type !== 'BANK') {
      throw new AppError(400, 'INVALID_ACCOUNT_TYPE', 'Only BANK accounts can issue checks');
    }

    // Validar que el número de cheque no exista
    const existingCheck = await prisma.checkRegister.findUnique({
      where: {
        businessId_checkNumber: {
          businessId,
          checkNumber: data.checkNumber,
        },
      },
    });

    if (existingCheck) {
      throw new AppError(400, 'CHECK_NUMBER_EXISTS', 'Check number already exists');
    }

    const currency = data.currency || account.currency || 'ARS';

    // Crear registro de cheque
    const check = await prisma.checkRegister.create({
      data: {
        businessId,
        accountId: data.accountId,
        checkNumber: data.checkNumber,
        amount: new Decimal(data.amount),
        currency,
        payableId: data.payableId,
        paymentId: data.paymentId,
        recipientName: data.recipientName,
        notes: data.notes,
        status: 'ISSUED',
      },
      include: {
        account: true,
        payable: {
          include: {
            supplier: true,
          },
        },
      },
    });

    await AuditService.logCreate(businessId, userId, 'check_register', check.id, {
      checkNumber: data.checkNumber,
      amount: data.amount,
      accountId: data.accountId,
    });

    return check;
  }

  /**
   * Marcar cheque como cobrado
   */
  async clearCheck(businessId: string, userId: string, checkId: string) {
    const check = await prisma.checkRegister.findUnique({
      where: { id: checkId },
      include: {
        account: true,
      },
    });

    if (!check) {
      throw new AppError(404, 'CHECK_NOT_FOUND', 'Check not found');
    }

    if (check.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    if (check.status !== 'ISSUED') {
      throw new AppError(400, 'INVALID_STATUS', `Check is already ${check.status}`);
    }

    // Validar fondos disponibles en la cuenta
    await this.financialAccountService.validateFunds(
      check.accountId,
      check.amount.toNumber()
    );

    // Actualizar cheque y descontar de cuenta en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Marcar cheque como cobrado
      const updatedCheck = await tx.checkRegister.update({
        where: { id: checkId },
        data: {
          status: 'CLEARED',
          clearedAt: new Date(),
        },
        include: {
          account: true,
          payable: {
            include: {
              supplier: true,
            },
          },
        },
      });

      // Descontar de cuenta bancaria
      const currentBalance = check.account.balance.toNumber();
      const newBalance = currentBalance - check.amount.toNumber();

      await tx.financialAccount.update({
        where: { id: check.accountId },
        data: { balance: newBalance },
      });

      // Crear movimiento financiero
      await tx.financialMovement.create({
        data: {
          businessId,
          accountId: check.accountId,
          type: 'EXPENSE',
          amount: check.amount,
          sourceType: 'CHECK_CLEARED',
          sourceId: checkId,
          description: `Cheque #${check.checkNumber} cobrado`,
          balanceAfter: newBalance,
          createdBy: userId,
        },
      });

      return updatedCheck;
    });

    await AuditService.logUpdate(
      businessId,
      userId,
      'check_register',
      checkId,
      { status: check.status },
      { status: 'CLEARED', clearedAt: new Date() }
    );

    return result;
  }

  /**
   * Marcar cheque como rebotado
   */
  async bounceCheck(businessId: string, userId: string, checkId: string, reason?: string) {
    const check = await prisma.checkRegister.findUnique({
      where: { id: checkId },
    });

    if (!check) {
      throw new AppError(404, 'CHECK_NOT_FOUND', 'Check not found');
    }

    if (check.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    if (check.status !== 'ISSUED' && check.status !== 'CLEARED') {
      throw new AppError(400, 'INVALID_STATUS', 'Check cannot be bounced');
    }

    const updatedCheck = await prisma.checkRegister.update({
      where: { id: checkId },
      data: {
        status: 'BOUNCED',
        bouncedAt: new Date(),
        notes: reason ? `${check.notes || ''}\nRebotado: ${reason}`.trim() : check.notes,
      },
      include: {
        account: true,
        payable: {
          include: {
            supplier: true,
          },
        },
      },
    });

    await AuditService.logUpdate(
      businessId,
      userId,
      'check_register',
      checkId,
      { status: check.status },
      { status: 'BOUNCED', bouncedAt: new Date(), reason }
    );

    return updatedCheck;
  }

  /**
   * Cancelar cheque
   */
  async cancelCheck(businessId: string, userId: string, checkId: string, reason?: string) {
    const check = await prisma.checkRegister.findUnique({
      where: { id: checkId },
    });

    if (!check) {
      throw new AppError(404, 'CHECK_NOT_FOUND', 'Check not found');
    }

    if (check.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    if (check.status !== 'ISSUED') {
      throw new AppError(400, 'INVALID_STATUS', 'Only issued checks can be cancelled');
    }

    const updatedCheck = await prisma.checkRegister.update({
      where: { id: checkId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        notes: reason ? `${check.notes || ''}\nCancelado: ${reason}`.trim() : check.notes,
      },
      include: {
        account: true,
        payable: {
          include: {
            supplier: true,
          },
        },
      },
    });

    await AuditService.logUpdate(
      businessId,
      userId,
      'check_register',
      checkId,
      { status: check.status },
      { status: 'CANCELLED', cancelledAt: new Date(), reason }
    );

    return updatedCheck;
  }

  /**
   * Listar cheques con filtros
   */
  async list(
    businessId: string,
    filters: {
      accountId?: string;
      status?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const skip = (page - 1) * limit;

    interface WhereInput {
      businessId: string;
      accountId?: string;
      status?: string;
    }

    const where: WhereInput = {
      businessId,
    };

    if (filters.accountId) {
      where.accountId = filters.accountId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const [checks, total] = await Promise.all([
      prisma.checkRegister.findMany({
        where,
        skip,
        take: limit,
        include: {
          account: {
            select: {
              id: true,
              name: true,
              type: true,
              bankName: true,
              accountNumber: true,
            },
          },
          payable: {
            include: {
              supplier: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { issuedAt: 'desc' },
      }),
      prisma.checkRegister.count({ where }),
    ]);

    return {
      items: checks,
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
   * Obtener cheque por ID
   */
  async getById(businessId: string, checkId: string) {
    const check = await prisma.checkRegister.findUnique({
      where: { id: checkId },
      include: {
        account: true,
        payable: {
          include: {
            supplier: true,
          },
        },
        payment: true,
      },
    });

    if (!check) {
      throw new AppError(404, 'CHECK_NOT_FOUND', 'Check not found');
    }

    if (check.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    return check;
  }

  /**
   * Obtener resumen de cheques pendientes por cuenta
   */
  async getSummaryByAccount(businessId: string, accountId?: string) {
    interface WhereInput {
      businessId: string;
      status: string;
      accountId?: string;
    }

    const where: WhereInput = {
      businessId,
      status: 'ISSUED',
    };

    if (accountId) {
      where.accountId = accountId;
    }

    const checks = await prisma.checkRegister.findMany({
      where,
      select: {
        accountId: true,
        amount: true,
        currency: true,
        account: {
          select: {
            name: true,
          },
        },
      },
    });

    // Agrupar por cuenta
    const summary = checks.reduce((acc: Record<string, CheckSummaryItem>, check) => {
      const key = check.accountId;
      if (!acc[key]) {
        acc[key] = {
          accountId: check.accountId,
          accountName: check.account.name,
          totalPending: 0,
          count: 0,
          currency: check.currency,
        };
      }
      acc[key].totalPending += Number(check.amount);
      acc[key].count += 1;
      return acc;
    }, {});

    return Object.values(summary);
  }
}
