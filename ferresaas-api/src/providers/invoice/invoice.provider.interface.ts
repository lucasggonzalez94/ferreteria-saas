import { CreateVoucherInput, CreateVoucherResult, Voucher } from '../../types';

export interface InvoiceProvider {
  /**
   * Crear comprobante (factura/nota)
   */
  createVoucher(input: CreateVoucherInput): Promise<CreateVoucherResult>;

  /**
   * Obtener comprobante por ID
   */
  getVoucher(voucherId: string): Promise<Voucher | null>;

  /**
   * Descargar PDF del comprobante
   */
  downloadPdf(voucherId: string): Promise<Buffer | null>;
}
