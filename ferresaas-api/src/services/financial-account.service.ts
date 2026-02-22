import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { ExchangeRateService } from './exchange-rate.service';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../config/logger';

export class FinancialAccountService {
  private exchangeRateService = new ExchangeRateService();
  /**
   * Listar cuentas financieras
   */
  async list(
    businessId: string,
    filters?: {
      type?: string;
      isActive?: boolean;
      currency?: string;
    }
  ) {
    const where: Record<string, unknown> = { businessId };

    if (filters?.type) where.type = filters.type;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.currency) where.currency = filters.currency;

    const accounts = await prisma.financialAccount.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return accounts;
  }

  /**
   * Obtener cuenta por ID
   */
  async getById(businessId: string, accountId: string) {
    const account = await prisma.financialAccount.findUnique({
      where: { id: accountId },
      include: {
        _count: {
          select: { movements: true },
        },
      },
    });

    if (!account) {
      throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Financial account not found');
    }

    if (account.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    return account;
  }

  /**
   * Obtener cuenta por defecto de un tipo
   */
  async getDefaultByType(businessId: string, type: string, currency?: string) {
    const where: Record<string, unknown> = {
      businessId,
      type,
      isDefault: true,
      isActive: true,
    };

    if (currency) {
      where.currency = currency;
    }

    const account = await prisma.financialAccount.findFirst({
      where,
    });

    if (!account) {
      const currencyMsg = currency ? ` in ${currency}` : '';
      throw new AppError(
        404,
        'DEFAULT_ACCOUNT_NOT_FOUND',
        `No default ${type} account${currencyMsg} found. Please configure one.`
      );
    }

    return account;
  }

  /**
   * Crear cuenta financiera
   */
  async create(
    businessId: string,
    userId: string,
    data: {
      type: string;
      name: string;
      description?: string;
      currency?: string;
      initialBalance?: number;
      isDefault?: boolean;
      bankName?: string;
      accountNumber?: string;
      walletProvider?: string;
    }
  ) {
    // Validar moneda
    const currency = data.currency || 'ARS';
    if (!['ARS', 'USD'].includes(currency)) {
      throw new AppError(400, 'INVALID_CURRENCY', 'Currency must be ARS or USD');
    }

    // Validar que no exista otra cuenta con el mismo nombre
    const existing = await prisma.financialAccount.findUnique({
      where: { businessId_name: { businessId, name: data.name } },
    });

    if (existing) {
      throw new AppError(400, 'ACCOUNT_EXISTS', 'An account with this name already exists');
    }

    // Si se marca como default, quitar default de otras cuentas del mismo tipo y moneda
    if (data.isDefault) {
      await prisma.financialAccount.updateMany({
        where: {
          businessId,
          type: data.type,
          currency,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const account = await prisma.financialAccount.create({
      data: {
        businessId,
        type: data.type,
        name: data.name,
        description: data.description,
        currency,
        balance: data.initialBalance || 0,
        isDefault: data.isDefault || false,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        walletProvider: data.walletProvider,
      },
    });

    await AuditService.logCreate(businessId, userId, 'financial_accounts', account.id, {
      type: data.type,
      name: data.name,
      currency,
      initialBalance: data.initialBalance,
    });

    return account;
  }

  /**
   * Actualizar cuenta financiera
   */
  async update(
    businessId: string,
    userId: string,
    accountId: string,
    data: {
      name?: string;
      description?: string;
      isDefault?: boolean;
      isActive?: boolean;
      bankName?: string;
      accountNumber?: string;
      walletProvider?: string;
    }
  ) {
    const account = await this.getById(businessId, accountId);

    // Si se marca como default, quitar default de otras cuentas del mismo tipo
    if (data.isDefault && !account.isDefault) {
      await prisma.financialAccount.updateMany({
        where: {
          businessId,
          type: account.type,
          isDefault: true,
          id: { not: accountId },
        },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.financialAccount.update({
      where: { id: accountId },
      data,
    });

    await AuditService.logUpdate(
      businessId,
      userId,
      'financial_accounts',
      accountId,
      account,
      updated
    );

    return updated;
  }

  /**
   * Validar fondos disponibles (con soporte para conversión de moneda)
   */
  async validateFunds(
    accountId: string,
    amount: number,
    currency?: string
  ) {
    const account = await prisma.financialAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Financial account not found');
    }

    if (!account.isActive) {
      throw new AppError(400, 'ACCOUNT_INACTIVE', 'This account is inactive');
    }

    let requiredAmount = amount;

    // Si la moneda es diferente, convertir
    if (currency && currency !== account.currency) {
      if (currency === 'USD' && account.currency === 'ARS') {
        // Necesitamos USD pero la cuenta es ARS: convertir USD a ARS
        const conversion = await this.exchangeRateService.convertUsdToArs(
          account.businessId,
          amount
        );
        requiredAmount = conversion.amountArs;
      } else if (currency === 'ARS' && account.currency === 'USD') {
        // Necesitamos ARS pero la cuenta es USD: convertir ARS a USD
        const conversion = await this.exchangeRateService.convertArsToUsd(
          account.businessId,
          amount
        );
        requiredAmount = conversion.amountUsd;
      }
    }

    const currentBalance = account.balance.toNumber();
    if (currentBalance < requiredAmount) {
      throw new AppError(
        400,
        'INSUFFICIENT_FUNDS',
        `Insufficient funds. Available: ${currentBalance.toFixed(2)} ${account.currency}, Required: ${requiredAmount.toFixed(2)} ${account.currency}`
      );
    }

    return account;
  }

  /**
   * Actualizar balance de cuenta
   */
  async updateBalance(
    accountId: string,
    amount: number,
    operation: 'add' | 'subtract'
  ): Promise<Decimal> {
    const account = await prisma.financialAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Financial account not found');
    }

    const currentBalance = account.balance.toNumber();
    const newBalance = operation === 'add' ? currentBalance + amount : currentBalance - amount;

    if (newBalance < 0) {
      throw new AppError(
        400,
        'NEGATIVE_BALANCE',
        'Operation would result in negative balance'
      );
    }

    const updated = await prisma.financialAccount.update({
      where: { id: accountId },
      data: { balance: new Decimal(newBalance) },
    });

    return updated.balance;
  }

  /**
   * Obtener resumen de balance por tipo (con conversión a ARS)
   */
  async getBalanceSummary(businessId: string) {
    const accounts = await prisma.financialAccount.findMany({
      where: { businessId, isActive: true },
    });

    const summary: Record<
      string,
      { 
        total: number; 
        totalARS: number;
        count: number; 
        accounts: Array<{ 
          id: string; 
          name: string; 
          balance: number;
          currency: string;
          balanceARS: number;
        }> 
      }
    > = {};

    let exchangeRate: number | null = null;

    // Obtener tipo de cambio una sola vez si hay cuentas en USD
    const hasUsdAccounts = accounts.some(acc => acc.currency === 'USD');
    if (hasUsdAccounts) {
      try {
        const rate = await this.exchangeRateService.getRate(businessId);
        exchangeRate = rate.rate;
      } catch (error) {
        logger.warn('Could not get exchange rate for balance summary');
      }
    }

    let totalBalanceARS = 0;

    accounts.forEach((account) => {
      const balance = account.balance.toNumber();
      let balanceARS = balance;

      // Convertir a ARS si es USD
      if (account.currency === 'USD' && exchangeRate) {
        balanceARS = balance * exchangeRate;
      }

      if (!summary[account.type]) {
        summary[account.type] = { total: 0, totalARS: 0, count: 0, accounts: [] };
      }

      summary[account.type].total += balance;
      summary[account.type].totalARS += balanceARS;
      summary[account.type].count += 1;
      summary[account.type].accounts.push({
        id: account.id,
        name: account.name,
        balance,
        currency: account.currency,
        balanceARS,
      });

      totalBalanceARS += balanceARS;
    });

    return {
      totalBalance: totalBalanceARS, // Total en ARS
      byType: summary,
      exchangeRate,
    };
  }

  /**
   * Convertir monto entre cuentas de diferentes monedas
   */
  async convertAmount(
    businessId: string,
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<{ amount: number; rate: number; source: string }> {
    if (fromCurrency === toCurrency) {
      return { amount, rate: 1, source: 'same_currency' };
    }

    if (fromCurrency === 'USD' && toCurrency === 'ARS') {
      const conversion = await this.exchangeRateService.convertUsdToArs(businessId, amount);
      return {
        amount: conversion.amountArs,
        rate: conversion.rate,
        source: conversion.source,
      };
    }

    if (fromCurrency === 'ARS' && toCurrency === 'USD') {
      const conversion = await this.exchangeRateService.convertArsToUsd(businessId, amount);
      return {
        amount: conversion.amountUsd,
        rate: conversion.rate,
        source: conversion.source,
      };
    }

    throw new AppError(
      400,
      'UNSUPPORTED_CONVERSION',
      `Conversion from ${fromCurrency} to ${toCurrency} is not supported`
    );
  }
}
