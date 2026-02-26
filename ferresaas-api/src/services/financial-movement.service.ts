import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { FinancialAccountService } from './financial-account.service';
import { ExchangeRateService } from './exchange-rate.service';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../config/logger';

// Obtener fecha actual ajustada a zona horaria local (UTC-3)
function getLocalDateTime(): Date {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000; // offset en ms
  return new Date(now.getTime() - offset);
}

export class FinancialMovementService {
  private accountService: FinancialAccountService;
  private exchangeRateService: ExchangeRateService;

  constructor() {
    this.accountService = new FinancialAccountService();
    this.exchangeRateService = new ExchangeRateService();
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
        createdAt: getLocalDateTime(),
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
   * Crear transferencia entre cuentas (con soporte para conversión de moneda)
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

    // Determinar si necesitamos conversión de moneda
    const needsConversion = fromAccount.currency !== toAccount.currency;
    let convertedAmount = data.amount;
    let exchangeRateSnapshot: any = null;

    if (needsConversion) {
      logger.info({
        fromCurrency: fromAccount.currency,
        toCurrency: toAccount.currency,
        amount: data.amount,
      }, 'Transfer requires currency conversion');

      // Obtener tipo de cambio y convertir
      const conversion = await this.accountService.convertAmount(
        businessId,
        data.amount,
        fromAccount.currency,
        toAccount.currency
      );

      convertedAmount = conversion.amount;

      // Guardar snapshot del tipo de cambio usado
      const rate = await this.exchangeRateService.getRate(businessId);
      exchangeRateSnapshot = await prisma.exchangeRateSnapshot.create({
        data: {
          businessId,
          fromCurrency: fromAccount.currency,
          toCurrency: toAccount.currency,
          rate: conversion.rate,
          buyRate: rate.buyRate,
          sellRate: rate.sellRate,
          dollarType: rate.dollarType,
          source: conversion.source,
        },
      });

      logger.info({
        originalAmount: data.amount,
        convertedAmount,
        rate: conversion.rate,
        snapshotId: exchangeRateSnapshot.id,
      }, 'Currency conversion completed for transfer');
    }

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
        convertedAmount,
        'add'
      );

      const baseDescription = data.description || '';
      const conversionNote = needsConversion
        ? ` (${data.amount.toFixed(2)} ${fromAccount.currency} → ${convertedAmount.toFixed(2)} ${toAccount.currency})`
        : '';
      const now = getLocalDateTime();

      // Crear movimiento de salida en cuenta origen
      const expenseMovement = await tx.financialMovement.create({
        data: {
          businessId,
          accountId: data.fromAccountId,
          type: 'TRANSFER',
          amount: new Decimal(data.amount),
          transferFromAccountId: data.fromAccountId,
          transferToAccountId: data.toAccountId,
          description: baseDescription || `Transferencia a ${toAccount.name}${conversionNote}`,
          notes: data.notes,
          balanceAfter: fromBalance,
          createdBy: userId,
          createdAt: now,
        },
      });

      // Crear movimiento de entrada en cuenta destino
      const incomeMovement = await tx.financialMovement.create({
        data: {
          businessId,
          accountId: data.toAccountId,
          type: 'TRANSFER',
          amount: new Decimal(convertedAmount),
          transferFromAccountId: data.fromAccountId,
          transferToAccountId: data.toAccountId,
          description: baseDescription || `Transferencia desde ${fromAccount.name}${conversionNote}`,
          notes: data.notes,
          balanceAfter: toBalance,
          createdBy: userId,
          createdAt: now,
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
   * Listar movimientos por fecha (todas las cuentas)
   */
  async listByDate(
    businessId: string,
    date: Date,
    filters?: {
      type?: string;
      sourceType?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 50, 100);
    const skip = (page - 1) * limit;

    // Crear rango de fecha (inicio del día a fin del día)
    // Usar UTC para evitar problemas de zona horaria
    const dateObj = new Date(date);
    const year = dateObj.getUTCFullYear();
    const month = dateObj.getUTCMonth();
    const day = dateObj.getUTCDate();

    const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

    const where: Record<string, unknown> = {
      businessId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    if (filters?.type) where.type = filters.type;
    if (filters?.sourceType) where.sourceType = filters.sourceType;

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
   * Mapear método de pago a tipo de cuenta
   */
  static getAccountTypeByPaymentMethod(method: string): string {
    const mapping: Record<string, string> = {
      CASH: 'CASH',
      CASH_ARS: 'CASH',
      CASH_USD: 'CASH',
      TRANSFER: 'BANK',
      CARD: 'BANK',
      CHECK: 'BANK',
      QR: 'WALLET',
    };

    return mapping[method] || 'BANK';
  }
}
