import PDFDocument from 'pdfkit';

interface InvoicePdfBusiness {
  name: string;
  cuit: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface InvoicePdfCustomer {
  type: 'PERSON' | 'COMPANY';
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  cuit?: string | null;
  address?: string | null;
}

interface InvoicePdfItem {
  quantity: number;
  unitPrice: number;
  subtotal: number;
  taxRate: number;
  productName: string;
}

interface InvoicePdfInvoice {
  id: string;
  voucherType: string;
  pointOfSale: number | null;
  number: number | null;
  cae: string | null;
  caeExpiry?: Date | null;
  issuedAt?: Date | null;
  adjustmentKind?: string | null;
  adjustmentReason?: string | null;
  relatedInvoice?: {
    voucherType: string;
    pointOfSale: number | null;
    number: number | null;
  } | null;
}

interface InvoicePdfSale {
  id: string;
  createdAt: Date;
  subtotal: number;
  taxAmount: number;
  total: number;
}

interface GenerateInvoicePdfInput {
  business: InvoicePdfBusiness;
  sale: InvoicePdfSale;
  invoice: InvoicePdfInvoice;
  customer?: InvoicePdfCustomer | null;
  items: InvoicePdfItem[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value?: Date | null): string {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function getCustomerName(customer?: InvoicePdfCustomer | null): string {
  if (!customer) {
    return 'Consumidor Final';
  }

  if (customer.type === 'COMPANY') {
    return customer.companyName || 'Cliente empresa';
  }

  const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
  return fullName || 'Cliente';
}

export class InvoicePdfService {
  async generateInvoicePdf(input: GenerateInvoicePdfInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { business, sale, invoice, customer, items } = input;

      doc.fontSize(18).text('Comprobante Fiscal', { align: 'left' });
      doc.moveDown(0.5);

      doc.fontSize(12).text(business.name, { continued: false });
      doc.fontSize(9).fillColor('#4B5563').text(`CUIT: ${business.cuit}`);
      if (business.address) doc.text(`Dirección: ${business.address}`);
      if (business.phone) doc.text(`Tel: ${business.phone}`);
      if (business.email) doc.text(`Email: ${business.email}`);

      doc.fillColor('#111827').moveDown(0.8);

      doc.fontSize(11).text(`Tipo: ${invoice.voucherType}`);
      doc.text(`Punto de venta: ${invoice.pointOfSale ?? '-'}`);
      doc.text(`Número: ${invoice.number ?? '-'}`);
      doc.text(`Fecha emisión: ${formatDate(invoice.issuedAt || sale.createdAt)}`);
      doc.text(`CAE: ${invoice.cae || '-'}`);
      doc.text(`Vto. CAE: ${formatDate(invoice.caeExpiry)}`);

      if (invoice.relatedInvoice) {
        doc.moveDown(0.4);
        doc.fontSize(10).fillColor('#374151').text('Comprobante asociado:');
        doc
          .fontSize(10)
          .text(
            `${invoice.relatedInvoice.voucherType} ${invoice.relatedInvoice.pointOfSale ?? '-'}-${invoice.relatedInvoice.number ?? '-'}`
          );

        if (invoice.adjustmentReason) {
          doc.text(`Motivo: ${invoice.adjustmentReason}`);
        }
      }

      doc.fillColor('#111827').moveDown(1);
      doc.fontSize(11).text(`Cliente: ${getCustomerName(customer)}`);
      doc.text(`CUIT/DNI: ${customer?.cuit || 'Consumidor Final'}`);
      if (customer?.address) {
        doc.text(`Dirección: ${customer.address}`);
      }

      doc.moveDown(1);

      const tableStartX = 40;
      const descriptionX = tableStartX;
      const qtyX = 320;
      const unitPriceX = 380;
      const subtotalX = 470;

      doc.fontSize(10).fillColor('#111827');
      doc.text('Descripción', descriptionX, doc.y, { width: 260 });
      doc.text('Cant.', qtyX, doc.y - 12, { width: 50, align: 'right' });
      doc.text('Unitario', unitPriceX, doc.y - 12, { width: 80, align: 'right' });
      doc.text('Subtotal', subtotalX, doc.y - 12, { width: 80, align: 'right' });
      doc.moveDown(0.3);

      doc.moveTo(tableStartX, doc.y).lineTo(555, doc.y).strokeColor('#E5E7EB').stroke();
      doc.moveDown(0.4);

      for (const item of items) {
        const y = doc.y;
        doc.fillColor('#111827').fontSize(9);
        doc.text(item.productName, descriptionX, y, { width: 260 });
        doc.text(`${item.quantity}`, qtyX, y, { width: 50, align: 'right' });
        doc.text(formatCurrency(item.unitPrice), unitPriceX, y, { width: 80, align: 'right' });
        doc.text(formatCurrency(item.subtotal), subtotalX, y, { width: 80, align: 'right' });

        doc.fillColor('#6B7280').fontSize(8).text(`IVA ${item.taxRate}%`, descriptionX, y + 12);
        doc.moveDown(1.2);
      }

      doc.moveDown(0.6);
      doc.moveTo(360, doc.y).lineTo(555, doc.y).strokeColor('#E5E7EB').stroke();
      doc.moveDown(0.6);

      doc.fillColor('#111827').fontSize(10);
      doc.text(`Subtotal: ${formatCurrency(sale.subtotal)}`, 360, doc.y, { width: 195, align: 'right' });
      doc.moveDown(0.4);
      doc.text(`IVA: ${formatCurrency(sale.taxAmount)}`, 360, doc.y, { width: 195, align: 'right' });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Total: ${formatCurrency(sale.total)}`, 360, doc.y, { width: 195, align: 'right' });

      doc.moveDown(1);
      doc.fillColor('#6B7280').fontSize(8).text(`Venta: ${sale.id}`);
      doc.text(`Comprobante ID: ${invoice.id}`);

      doc.end();
    });
  }
}
