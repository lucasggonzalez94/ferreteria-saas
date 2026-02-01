import { prisma } from '../config/database';

export class CashRegisterService {
  /**
   * Calcular resumen de caja por medio de pago
   */
  static async calculateSummary(sessionId: string) {
    const session = await prisma.cashRegisterSession.findUnique({
      where: { id: sessionId },
      include: {
        sales: {
          where: { status: 'CONFIRMED' },
          include: { payments: true },
        },
        movements: true,
      },
    });

    if (!session) {
      return null;
    }

    // Agrupar pagos por método
    const paymentsByMethod: Record<string, number> = {};
    let totalCash = 0;

    session.sales.forEach((sale) => {
      sale.payments.forEach((payment) => {
        const method = payment.method;
        if (!paymentsByMethod[method]) {
          paymentsByMethod[method] = 0;
        }
        paymentsByMethod[method] += payment.amount.toNumber();

        if (method === 'CASH_ARS') {
          totalCash += payment.amount.toNumber();
        }
      });
    });

    // Calcular monto esperado
    let expectedAmount = session.openingAmount.toNumber();
    expectedAmount += totalCash;

    session.movements.forEach((movement) => {
      if (movement.type === 'INCOME') {
        expectedAmount += movement.amount.toNumber();
      } else {
        expectedAmount -= movement.amount.toNumber();
      }
    });

    return {
      sessionId: session.id,
      openingAmount: session.openingAmount.toNumber(),
      closingAmount: session.closingAmount?.toNumber() || null,
      expectedAmount,
      difference: session.difference?.toNumber() || null,
      paymentsByMethod,
      totalSales: session.sales.length,
      totalMovements: session.movements.length,
      movements: session.movements.map((m) => ({
        id: m.id,
        type: m.type,
        amount: m.amount.toNumber(),
        reason: m.reason,
        createdAt: m.createdAt,
      })),
    };
  }
}
