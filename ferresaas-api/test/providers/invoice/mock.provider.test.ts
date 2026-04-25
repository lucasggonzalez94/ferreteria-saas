import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockLogger = {
  info: jest.fn() as any,
  warn: jest.fn() as any,
  error: jest.fn() as any,
};

jest.mock('@/config/logger', () => ({ logger: mockLogger }));

import { MockInvoiceProvider } from '@/providers/invoice/mock.provider';

describe('MockInvoiceProvider', () => {
  let provider: MockInvoiceProvider;
  let dateNowSpy: jest.SpiedFunction<typeof Date.now>;
  let randomSpy: jest.SpiedFunction<typeof Math.random>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new MockInvoiceProvider();
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.1234);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    randomSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('createVoucher devuelve comprobante mock exitoso', async () => {
    const result = await provider.createVoucher({
      businessId: 'biz-1',
      saleId: 'sale-1',
      voucherType: 'B',
      pointOfSale: 1,
      subtotal: 100,
      taxAmount: 21,
      total: 121,
      customer: null,
      items: [
        {
          description: 'Martillo',
          quantity: 1,
          unitPrice: 121,
          taxRate: 21,
          subtotal: 100,
          taxAmount: 21,
          total: 121,
        },
      ],
    } as any);

    expect(result.success).toBe(true);
    expect(result.cae).toContain('1700000000000');
    expect(result.number).toBeGreaterThan(0);
    expect(result.qrData).toContain('afip.gob.ar/fe/qr');
    expect(result.pdfUrl).toBe('/invoices/mock/sale-1.pdf');
    expect(mockLogger.info).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('getVoucher devuelve datos mock del comprobante', async () => {
    const voucher = await provider.getVoucher('voucher-1');

    expect(voucher).toEqual(
      expect.objectContaining({
        id: 'voucher-1',
        cae: 'MOCK_CAE_voucher-1',
        number: 12345,
        voucherType: 'B',
      })
    );
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('downloadPdf retorna un buffer mock', async () => {
    const buffer = await provider.downloadPdf('voucher-2');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer?.toString()).toContain('Mock PDF for voucher voucher-2');
    expect(mockLogger.info).toHaveBeenCalled();
  });
});
