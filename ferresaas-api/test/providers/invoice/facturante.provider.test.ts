import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEnv = {
  invoice: {
    facturante: {
      apiKey: 'fact-key',
      apiUrl: 'https://facturante.test',
    },
  },
};

const mockLogger = {
  info: jest.fn() as any,
  warn: jest.fn() as any,
  error: jest.fn() as any,
};

jest.mock('@/config/env', () => ({ env: mockEnv }));
jest.mock('@/config/logger', () => ({ logger: mockLogger }));

import { FacturanteProvider } from '@/providers/invoice/facturante.provider';

describe('FacturanteProvider', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSpy = jest.spyOn(global, 'fetch' as any);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    mockEnv.invoice.facturante.apiKey = 'fact-key';
    mockEnv.invoice.facturante.apiUrl = 'https://facturante.test';
  });

  it('constructor exige credenciales configuradas', () => {
    mockEnv.invoice.facturante.apiKey = '';
    expect(() => new FacturanteProvider()).toThrow('Facturante API credentials not configured');
  });

  it('createVoucher retorna success cuando API responde ok', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        cae: '12345',
        cae_vencimiento: '2026-06-01T00:00:00.000Z',
        numero: 321,
        qr_data: 'qr-data',
        pdf_url: '/pdf/321',
      }),
    } as any);

    const provider = new FacturanteProvider();
    const out = await provider.createVoucher({
      businessId: 'biz-1',
      saleId: 'sale-1',
      voucherType: 'A',
      pointOfSale: 1,
      subtotal: 100,
      taxAmount: 21,
      total: 121,
      customer: { name: 'Cliente', cuit: '20123456789', address: 'Av 1' },
      items: [
        {
          description: 'Producto',
          quantity: 1,
          unitPrice: 121,
          taxRate: 21,
          subtotal: 100,
          taxAmount: 21,
          total: 121,
        },
      ],
    } as any);

    expect(out).toEqual(
      expect.objectContaining({ success: true, cae: '12345', number: 321, pdfUrl: '/pdf/321' })
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://facturante.test/comprobantes',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('createVoucher retorna error fiscal para 4xx', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    } as any);

    const provider = new FacturanteProvider();
    const out = await provider.createVoucher({ items: [], total: 0 } as any);

    expect(out.success).toBe(false);
    expect(out.errorCategory).toBe('fiscal');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('createVoucher retorna error tecnico para excepcion de red', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));

    const provider = new FacturanteProvider();
    const out = await provider.createVoucher({ items: [], total: 0 } as any);

    expect(out.success).toBe(false);
    expect(out.errorCategory).toBe('technical');
  });

  it('getVoucher devuelve null si no existe o si falla', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false } as any);

    const provider = new FacturanteProvider();
    const notFound = await provider.getVoucher('v-1');
    expect(notFound).toBeNull();

    fetchSpy.mockRejectedValueOnce(new Error('boom'));
    const failed = await provider.getVoucher('v-2');
    expect(failed).toBeNull();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('getVoucher mapea respuesta valida', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'v-3',
        cae: '888',
        cae_vencimiento: '2026-08-01T00:00:00.000Z',
        numero: 999,
        punto_venta: 2,
        tipo_comprobante: 'B',
        qr_data: 'qr',
        pdf_url: '/pdf/v-3',
      }),
    } as any);

    const provider = new FacturanteProvider();
    const voucher = await provider.getVoucher('v-3');

    expect(voucher).toEqual(
      expect.objectContaining({ id: 'v-3', cae: '888', number: 999, pointOfSale: 2 })
    );
  });

  it('downloadPdf devuelve buffer o null', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('PDF').buffer,
    } as any);

    const provider = new FacturanteProvider();
    const buffer = await provider.downloadPdf('v-1');
    expect(buffer).toBeInstanceOf(Buffer);

    fetchSpy.mockResolvedValueOnce({ ok: false } as any);
    const noPdf = await provider.downloadPdf('v-1');
    expect(noPdf).toBeNull();

    fetchSpy.mockRejectedValueOnce(new Error('download failed'));
    const failed = await provider.downloadPdf('v-1');
    expect(failed).toBeNull();
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
