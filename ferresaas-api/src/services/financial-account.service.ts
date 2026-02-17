import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { Decimal } from '@prisma/client/runtime/library';

export class FinancialAccountService {
  /**
   * Listar cuentas financieras
   */
  async list(
    businessId: string,
    filters?: {
      type?: string;
      isActive?: boolean;
    }
  ) {
    const where: Record<string, unknown> = { businessId };

    if (filters?.type) where.type = filters.type;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

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
  async getDefaultByType(businessId: string, type: string) {
    const account = await prisma.financialAccount.findFirst({
      where: {
        businessId,
        type,
        isDefault: true,
        isActive: true,
      },
    });

    if (!account) {
      throw new AppError(
        404,
        'DEFAULT_ACCOUNT_NOT_FOUND',
        `No default ${type} account found. Please configure one.`
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
    // Validar que no exista otra cuenta con el mismo nombre
    const existing = await prisma.financialAccount.findUnique({
      where: { businessId_name: { businessId, name: data.name } },
    });

    if (existing) {
      throw new AppError(400, 'ACCOUNT_EXISTS', 'An account with this name already exists');
    }

    // Si se marca como default, quitar default de otras cuentas del mismo tipo
    if (data.isDefault) {
      await prisma.financialAccount.updateMany({
        where: {
          businessId,
          type: data.type,
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
        currency: data.currency || 'ARS',
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
   * Validar fondos disponibles
   */
  async validateFunds(accountId: string, amount: number) {
    const account = await prisma.financialAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Financial account not found');
    }

    if (!account.isActive) {
      throw new AppError(400, 'ACCOUNT_INACTIVE', 'This account is inactive');
    }

    const currentBalance = account.balance.toNumber();
    if (currentBalance < amount) {
      throw new AppError(
        400,
        'INSUFFICIENT_FUNDS',
        `Insufficient funds. Available: $${currentBalance.toFixed(2)}, Required: $${amount.toFixed(2)}`
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
   * Obtener resumen de balance por tipo
   */
  async getBalanceSummary(businessId: string) {
    const accounts = await prisma.financialAccount.findMany({
      where: { businessId, isActive: true },
    });

    const summary: Record<
      string,
      { total: number; count: number; accounts: Array<{ id: string; name: string; balance: number }> }
    > = {};

    accounts.forEach((account) => {
      if (!summary[account.type]) {
        summary[account.type] = { total: 0, count: 0, accounts: [] };
      }
      summary[account.type].total += account.balance.toNumber();
      summary[account.type].count += 1;
      summary[account.type].accounts.push({
        id: account.id,
        name: account.name,
        balance: account.balance.toNumber(),
      });
    });

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance.toNumber(), 0);

    return {
      totalBalance,
      byType: summary,
    };
  }
}
