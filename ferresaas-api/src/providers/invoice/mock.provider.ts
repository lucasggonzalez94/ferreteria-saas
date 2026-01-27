import { InvoiceProvider } from './invoice.provider.interface';
import { CreateVoucherInput, CreateVoucherResult, Voucher } from '../../types';
import { logger } from '../../config/logger';

/**
 * Mock provider de facturación para desarrollo
 * Simula la emisión de facturas sin conectarse a servicios reales
 */
export class MockInvoiceProvider implements InvoiceProvider {
  async createVoucher(input: CreateVoucherInput): Promise<CreateVoucherResult> {
    logger.info(
      {
        businessId: input.businessId,
        saleId: input.saleId,
        voucherType: input.voucherType,
        total: input.total,
      },
      '📄 [MOCK] Factura emitida (desarrollo)'
    );

    // Simular CAE y datos
    const mockCae = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const mockNumber = Math.floor(Math.random() * 100000) + 1;
    const caeExpiry = new Date();
    caeExpiry.setDate(caeExpiry.getDate() + 10); // CAE válido por 10 días

    console.log('\n=== FACTURA MOCK ===');
    console.log(`Tipo: ${input.voucherType}`);
    console.log(`Punto de Venta: ${input.pointOfSale}`);
    console.log(`Número: ${mockNumber}`);
    console.log(`CAE: ${mockCae}`);
    console.log(`Vencimiento CAE: ${caeExpiry.toISOString()}`);
    console.log(`Total: $${input.total}`);
    console.log('====================\n');

    return {
      success: true,
      cae: mockCae,
      caeExpiry,
      number: mockNumber,
      qrData: `https://www.afip.gob.ar/fe/qr/?p=${mockCae}`,
      pdfUrl: `/invoices/mock/${input.saleId}.pdf`,
    };
  }

  async getVoucher(voucherId: string): Promise<Voucher | null> {
    logger.info({ voucherId }, '[MOCK] Get voucher');

    // Simular voucher
    return {
      id: voucherId,
      cae: `MOCK_CAE_${voucherId}`,
      caeExpiry: new Date(),
      number: 12345,
      pointOfSale: 1,
      voucherType: 'B',
      qrData: `https://www.afip.gob.ar/fe/qr/?p=MOCK_${voucherId}`,
      pdfUrl: `/invoices/mock/${voucherId}.pdf`,
    };
  }

  async downloadPdf(voucherId: string): Promise<Buffer | null> {
    logger.info({ voucherId }, '[MOCK] Download PDF');

    // Retornar PDF simple de ejemplo
    const mockPdf = Buffer.from(`Mock PDF for voucher ${voucherId}`);
    return mockPdf;
  }
}
