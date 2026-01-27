import { InvoiceProvider } from './invoice.provider.interface';
import { CreateVoucherInput, CreateVoucherResult, Voucher } from '../../types';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

/**
 * Provider de Facturante.com
 * Documentación: https://facturante.com/docs (ejemplo - ajustar según API real)
 *
 * TODO: Implementar según documentación oficial de Facturante
 * Esta es una implementación de ejemplo que debe ajustarse a la API real
 */
export class FacturanteProvider implements InvoiceProvider {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    if (!env.invoice.facturante.apiKey || !env.invoice.facturante.apiUrl) {
      throw new Error('Facturante API credentials not configured');
    }

    this.apiKey = env.invoice.facturante.apiKey;
    this.apiUrl = env.invoice.facturante.apiUrl;
  }

  async createVoucher(input: CreateVoucherInput): Promise<CreateVoucherResult> {
    try {
      // TODO: Ajustar según formato real de Facturante API
      const payload = {
        tipo_comprobante: input.voucherType,
        punto_venta: input.pointOfSale,
        cliente: input.customer
          ? {
              nombre: input.customer.name,
              cuit: input.customer.cuit,
              domicilio: input.customer.address,
            }
          : null,
        items: input.items.map((item) => ({
          descripcion: item.description,
          cantidad: item.quantity,
          precio_unitario: item.unitPrice,
          alicuota_iva: item.taxRate,
          importe: item.total,
        })),
        subtotal: input.subtotal,
        iva: input.taxAmount,
        total: input.total,
      };

      const response = await fetch(`${this.apiUrl}/comprobantes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error({ error, status: response.status }, 'Facturante API error');
        throw new Error(`Facturante API error: ${response.status}`);
      }

      const data = await response.json();

      // TODO: Ajustar según formato de respuesta real
      return {
        success: true,
        cae: data.cae,
        caeExpiry: new Date(data.cae_vencimiento),
        number: data.numero,
        qrData: data.qr_data,
        pdfUrl: data.pdf_url,
      };
    } catch (error) {
      logger.error({ error, input }, 'Failed to create voucher with Facturante');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getVoucher(voucherId: string): Promise<Voucher | null> {
    try {
      const response = await fetch(`${this.apiUrl}/comprobantes/${voucherId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      return {
        id: data.id,
        cae: data.cae,
        caeExpiry: new Date(data.cae_vencimiento),
        number: data.numero,
        pointOfSale: data.punto_venta,
        voucherType: data.tipo_comprobante,
        qrData: data.qr_data,
        pdfUrl: data.pdf_url,
      };
    } catch (error) {
      logger.error({ error, voucherId }, 'Failed to get voucher from Facturante');
      return null;
    }
  }

  async downloadPdf(voucherId: string): Promise<Buffer | null> {
    try {
      const response = await fetch(`${this.apiUrl}/comprobantes/${voucherId}/pdf`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error({ error, voucherId }, 'Failed to download PDF from Facturante');
      return null;
    }
  }
}
