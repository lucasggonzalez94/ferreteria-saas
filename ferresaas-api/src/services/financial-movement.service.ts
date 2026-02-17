import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { FinancialAccountService } from './financial-account.service';
import { Decimal } from '@prisma/client/runtime/library';

export class FinancialMovementService {
  private accountService: FinancialAccountService;

  constructor() {
    this.accountService = new FinancialAccountService();
  }

  /**
   * Crear movimiento financiero (INCOME o EXPENSE)
   */
  async createMovement(
    businessId: string,
    userId: string,
    data: {
      accountId: string;
      type: 'INCOME' | 'EXPENSE';
      amount: number;
      sourceType?: string;
      sourceId?: string;
      description?: string;
      notes?: string;
    }
  ) {
    // Validar cuenta
    await this.accountService.getById(businessId, data.accountId);

    // Si es EXPENSE, validar fondos
    if (data.type === 'EXPENSE') {
      await this.accountService.validateFunds(data.accountId, data.amount);
    }

    // Actualizar balance
    const operation = data.type === 'INCOME' ? 'add' : 'subtract';
    const newBalance = await this.accountService.updateBalance(
      data.accountId,
      data.amount,
      operation
    );

    // Crear movimiento
    const movement = await prisma.financialMovement.create({
      data: {
        businessId,
        accountId: data.accountId,
        type: data.type,
        amount: new Decimal(data.amount),
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        description: data.description,
        notes: data.notes,
        balanceAfter: newBalance,
        createdBy: userId,
      },
    });

    await AuditService.logCreate(businessId, userId, 'financial_movements', movement.id, {
      accountId: data.accountId,
      type: data.type,
      amount: data.amount,
      sourceType: data.sourceType,
    });

    return movement;
  }

  /**
   * Crear transferencia entre cuentas
   */
  async createTransfer(
    businessId: string,
    userId: string,
    data: {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      description?: string;
      notes?: string;
    }
  ) {
    if (data.fromAccountId === data.toAccountId) {
      throw new AppError(400, 'SAME_ACCOUNT', 'Cannot transfer to the same account');
    }

    // Validar cuentas
    const fromAccount = await this.accountService.getById(businessId, data.fromAccountId);
    const toAccount = await this.accountService.getById(businessId, data.toAccountId);

    // Validar fondos en cuenta origen
    await this.accountService.validateFunds(data.fromAccountId, data.amount);

    // Crear movimientos en transacción
    const movements = await prisma.$transaction(async (tx) => {
      // Actualizar balances
      const fromBalance = await this.accountService.updateBalance(
        data.fromAccountId,
        data.amount,
        'subtract'
      );
      const toBalance = await this.accountService.updateBalance(
        data.toAccountId,
        data.amount,
        'add'
      );

      // Crear movimiento de salida (EXPENSE en cuenta origen)
      const expenseMovement = await tx.financialMovement.create({
        data: {
          businessId,
          accountId: data.fromAccountId,
          type: 'TRANSFER',
          amount: new Decimal(data.amount),
          transferFromAccountId: data.fromAccountId,
          transferToAccountId: data.toAccountId,
          description: data.description || `Transferencia a ${toAccount.name}`,
          notes: data.notes,
          balanceAfter: fromBalance,
          createdBy: userId,
        },
      });

      // Crear movimiento de entrada (INCOME en cuenta destino)
      const incomeMovement = await tx.financialMovement.create({
        data: {
          businessId,
          accountId: data.toAccountId,
          type: 'TRANSFER',
          amount: new Decimal(data.amount),
          transferFromAccountId: data.fromAccountId,
          transferToAccountId: data.toAccountId,
          description: data.description || `Transferencia desde ${fromAccount.name}`,
          notes: data.notes,
          balanceAfter: toBalance,
          createdBy: userId,
        },
      });

      return { expenseMovement, incomeMovement };
    });

    await AuditService.log({
      businessId,
      userId,
      action: 'TRANSFER_CREATE',
      entity: 'financial_movements',
      entityId: movements.expenseMovement.id,
      after: {
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount: data.amount,
      },
    });

    return movements;
  }

  /**
   * Listar movimientos de una cuenta
   */
  async listByAccount(
    businessId: string,
    accountId: string,
    filters?: {
      type?: string;
      sourceType?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    }
  ) {
    // Validar cuenta
    await this.accountService.getById(businessId, accountId);

    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId, accountId };

    if (filters?.type) where.type = filters.type;
    if (filters?.sourceType) where.sourceType = filters.sourceType;

    if (filters?.startDate || filters?.endDate) {
      const createdAtFilter: Record<string, Date> = {};
      if (filters.startDate) createdAtFilter.gte = filters.startDate;
      if (filters.endDate) createdAtFilter.lte = filters.endDate;
      where.createdAt = createdAtFilter;
    }

    const [movements, total] = await Promise.all([
      prisma.financialMovement.findMany({
        where,
        skip,
        take: limit,
        include: {
          account: { select: { id: true, name: true, type: true } },
          transferFrom: { select: { id: true, name: true } },
          transferTo: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.financialMovement.count({ where }),
    ]);

    return {
      items: movements,
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
   * Obtener resumen de movimientos por período
   */
  async getSummary(
    businessId: string,
    accountId: string,
    startDate: Date,
    endDate: Date
  ) {
    // Validar cuenta
    await this.accountService.getById(businessId, accountId);

    const movements = await prisma.financialMovement.findMany({
      where: {
        businessId,
        accountId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    let totalIncome = 0;
    let totalExpense = 0;
    let totalTransferIn = 0;
    let totalTransferOut = 0;

    movements.forEach((movement) => {
      const amount = movement.amount.toNumber();
      
      if (movement.type === 'INCOME') {
        totalIncome += amount;
      } else if (movement.type === 'EXPENSE') {
        totalExpense += amount;
      } else if (movement.type === 'TRANSFER') {
        if (movement.transferToAccountId === accountId) {
          totalTransferIn += amount;
        } else {
          totalTransferOut += amount;
        }
      }
    });

    const netChange = totalIncome + totalTransferIn - totalExpense - totalTransferOut;

    return {
      totalIncome,
      totalExpense,
      totalTransferIn,
      totalTransferOut,
      netChange,
      movementCount: movements.length,
    };
  }

  /**
   * Mapear método de pago a tipo de cuenta
   */
  static getAccountTypeByPaymentMethod(method: string): string {
    const mapping: Record<string, string> = {
      CASH_ARS: 'CASH',
      CASH_USD: 'CASH',
      TRANSFER: 'BANK',
      CARD: 'BANK',
      QR: 'WALLET',
    };

    return mapping[method] || 'BANK';
  }
}
