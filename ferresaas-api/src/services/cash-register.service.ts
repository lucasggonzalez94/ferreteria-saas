import { prisma } from '../config/database';
import { ExchangeRateService } from './exchange-rate.service';
import { logger } from '../config/logger';

export class CashRegisterService {
  private static exchangeRateService = new ExchangeRateService();
  /**
   * Calcular resumen de caja por medio de pago (con soporte USD)
   */
  static async calculateSummary(sessionId: string) {
    const session = await prisma.cashRegisterSession.findUnique({
      where: { id: sessionId },
      include: {
        sales: {
          where: { status: 'CONFIRMED' },
          include: { 
            payments: {
              include: {
                exchangeRate: true,
              },
            },
          },
        },
        movements: true,
        openingExchangeRate: true,
        closingExchangeRate: true,
      },
    });

    if (!session) {
      return null;
    }

    // Agrupar pagos por método
    const paymentsByMethod: Record<string, number> = {};
    let totalCashARS = 0;
    let totalCashUSD = 0;

    session.sales.forEach((sale) => {
      sale.payments.forEach((payment) => {
        const method = payment.method;
        if (!paymentsByMethod[method]) {
          paymentsByMethod[method] = 0;
        }
        paymentsByMethod[method] += payment.amount.toNumber();

        if (method === 'CASH_ARS') {
          totalCashARS += payment.amount.toNumber();
        } else if (method === 'CASH_USD' && payment.amountUSD) {
          totalCashUSD += payment.amountUSD.toNumber();
        }
      });
    });

    // Calcular monto esperado en ARS
    let expectedAmountARS = session.openingAmount.toNumber();
    expectedAmountARS += totalCashARS;

    // Calcular monto esperado en USD
    let expectedAmountUSD = session.openingAmountUSD?.toNumber() || 0;
    expectedAmountUSD += totalCashUSD;

    // Aplicar movimientos de caja (asumimos que son en ARS por ahora)
    session.movements.forEach((movement) => {
      if (movement.type === 'INCOME') {
        expectedAmountARS += movement.amount.toNumber();
      } else {
        expectedAmountARS -= movement.amount.toNumber();
      }
    });

    return {
      sessionId: session.id,
      openingAmount: session.openingAmount.toNumber(),
      openingAmountUSD: session.openingAmountUSD?.toNumber() || null,
      closingAmount: session.closingAmount?.toNumber() || null,
      closingAmountUSD: session.closingAmountUSD?.toNumber() || null,
      expectedAmount: expectedAmountARS,
      expectedAmountUSD,
      difference: session.difference?.toNumber() || null,
      differenceUSD: session.differenceUSD?.toNumber() || null,
      paymentsByMethod,
      totalSales: session.sales.length,
      totalMovements: session.movements.length,
      openingExchangeRate: session.openingExchangeRate ? {
        rate: session.openingExchangeRate.rate.toNumber(),
        dollarType: session.openingExchangeRate.dollarType,
        source: session.openingExchangeRate.source,
      } : null,
      closingExchangeRate: session.closingExchangeRate ? {
        rate: session.closingExchangeRate.rate.toNumber(),
        dollarType: session.closingExchangeRate.dollarType,
        source: session.closingExchangeRate.source,
      } : null,
      movements: session.movements.map((m) => ({
        id: m.id,
        type: m.type,
        amount: m.amount.toNumber(),
        reason: m.reason,
        createdAt: m.createdAt,
      })),
    };
  }

  /**
   * Guardar snapshot de tipo de cambio al abrir caja
   */
  static async saveOpeningExchangeRate(businessId: string): Promise<string | null> {
    try {
      const rate = await this.exchangeRateService.getRate(businessId);
      
      const snapshot = await prisma.exchangeRateSnapshot.create({
        data: {
          businessId,
          fromCurrency: 'USD',
          toCurrency: 'ARS',
          rate: rate.rate,
          buyRate: rate.buyRate,
          sellRate: rate.sellRate,
          dollarType: rate.dollarType,
          source: rate.source,
        },
      });

      logger.info({
        snapshotId: snapshot.id,
        rate: rate.rate,
        source: rate.source,
      }, 'Exchange rate snapshot saved for cash register opening');

      return snapshot.id;
    } catch (error) {
      logger.error({ error }, 'Failed to save opening exchange rate snapshot');
      return null;
    }
  }

  /**
   * Guardar snapshot de tipo de cambio al cerrar caja
   */
  static async saveClosingExchangeRate(businessId: string): Promise<string | null> {
    try {
      const rate = await this.exchangeRateService.getRate(businessId);
      
      const snapshot = await prisma.exchangeRateSnapshot.create({
        data: {
          businessId,
          fromCurrency: 'USD',
          toCurrency: 'ARS',
          rate: rate.rate,
          buyRate: rate.buyRate,
          sellRate: rate.sellRate,
          dollarType: rate.dollarType,
          source: rate.source,
        },
      });

      logger.info({
        snapshotId: snapshot.id,
        rate: rate.rate,
        source: rate.source,
      }, 'Exchange rate snapshot saved for cash register closing');

      return snapshot.id;
    } catch (error) {
      logger.error({ error }, 'Failed to save closing exchange rate snapshot');
      return null;
    }
  }
}
