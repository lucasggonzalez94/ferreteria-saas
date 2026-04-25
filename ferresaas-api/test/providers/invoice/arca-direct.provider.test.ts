import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockLogger = {
  info: jest.fn() as any,
  warn: jest.fn() as any,
  error: jest.fn() as any,
};

jest.mock('@/config/logger', () => ({ logger: mockLogger }));

import { ArcaDirectProvider } from '@/providers/invoice/arca-direct.provider';

describe('ArcaDirectProvider', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSpy = jest.spyOn(global, 'fetch' as any);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('constructor exige credenciales obligatorias', () => {
    expect(
      () =>
        new ArcaDirectProvider({
          cuit: '',
          token: 'token',
          sign: 'sign',
          wsfeUrl: 'https://wsfe.test',
          wsaaUrl: 'https://wsaa.test',
          environment: 'homo',
        } as any)
    ).toThrow('ARCA credentials not configured');
  });

  it('createVoucher retorna error fiscal para tipo no soportado', async () => {
    const provider = new ArcaDirectProvider({
      cuit: '20123456789',
      token: 'token',
      sign: 'sign',
      wsfeUrl: 'https://wsfe.test',
      wsaaUrl: 'https://wsaa.test',
      environment: 'homo',
    } as any);

    const out = await provider.createVoucher({ voucherType: 'INVALID', items: [] } as any);
    expect(out.success).toBe(false);
    expect(out.errorCategory).toBe('fiscal');
  });

  it('createVoucher emite CAE correctamente cuando ARCA aprueba', async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<CbteNro>10</CbteNro>',
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<Resultado>A</Resultado><CAE>12345678901234</CAE><CAEFchVto>20261231</CAEFchVto>',
      } as any);

    const provider = new ArcaDirectProvider({
      cuit: '20123456789',
      token: 'token',
      sign: 'sign',
      wsfeUrl: 'https://wsfe.test',
      wsaaUrl: 'https://wsaa.test',
      environment: 'homo',
    } as any);

    const out = await provider.createVoucher({
      businessId: 'biz-1',
      saleId: 'sale-1',
      voucherType: 'B',
      pointOfSale: 1,
      subtotal: 100,
      taxAmount: 21,
      total: 121,
      customer: { name: 'Cliente', cuit: '20123456789', taxCondition: 'RESPONSABLE_INSCRIPTO' },
      items: [
        {
          description: 'Producto 1',
          quantity: 1,
          unitPrice: 121,
          taxRate: 21,
          subtotal: 100,
          taxAmount: 21,
          total: 100,
        },
      ],
    } as any);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(out.success).toBe(true);
    expect(out.cae).toBe('12345678901234');
    expect(out.number).toBe(11);
    expect(out.qrData).toContain('afip.gob.ar/fe/qr');
  });

  it('createVoucher retorna error fiscal cuando ARCA rechaza', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: true, text: async () => '<CbteNro>1</CbteNro>' } as any)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<Resultado>R</Resultado><ErrMsg>Comprobante rechazado</ErrMsg>',
      } as any);

    const provider = new ArcaDirectProvider({
      cuit: '20123456789',
      token: 'token',
      sign: 'sign',
      wsfeUrl: 'https://wsfe.test',
      wsaaUrl: 'https://wsaa.test',
      environment: 'homo',
    } as any);

    const out = await provider.createVoucher({
      voucherType: 'B',
      pointOfSale: 1,
      subtotal: 10,
      taxAmount: 0,
      total: 10,
      customer: null,
      items: [{ description: 'x', quantity: 1, unitPrice: 10, taxRate: 0, subtotal: 10, taxAmount: 0, total: 10 }],
    } as any);

    expect(out.success).toBe(false);
    expect(out.errorCategory).toBe('fiscal');
    expect(out.error).toContain('Comprobante rechazado');
  });

  it('createVoucher retorna error tecnico cuando falla request SOAP', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '<faultstring>Internal error</faultstring>',
    } as any);

    const provider = new ArcaDirectProvider({
      cuit: '20123456789',
      token: 'token',
      sign: 'sign',
      wsfeUrl: 'https://wsfe.test',
      wsaaUrl: 'https://wsaa.test',
      environment: 'homo',
    } as any);

    const out = await provider.createVoucher({
      voucherType: 'B',
      pointOfSale: 1,
      subtotal: 10,
      taxAmount: 0,
      total: 10,
      customer: null,
      items: [{ description: 'x', quantity: 1, unitPrice: 10, taxRate: 0, subtotal: 10, taxAmount: 0, total: 10 }],
    } as any);

    expect(out.success).toBe(false);
    expect(out.errorCategory).toBe('technical');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('getVoucher y downloadPdf devuelven null', async () => {
    const provider = new ArcaDirectProvider({
      cuit: '20123456789',
      token: 'token',
      sign: 'sign',
      wsfeUrl: 'https://wsfe.test',
      wsaaUrl: 'https://wsaa.test',
      environment: 'homo',
    } as any);

    await expect(provider.getVoucher('v-1')).resolves.toBeNull();
    await expect(provider.downloadPdf('v-1')).resolves.toBeNull();
  });
});
