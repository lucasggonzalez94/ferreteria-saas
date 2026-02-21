import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Business {
  name: string;
  cuit: string;
  address?: string;
  phone?: string;
}

interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
}

const UNIT_LABELS: Record<string, string> = {
  u: 'unidades',
  mt: 'metros',
  kg: 'kilogramos',
  lt: 'litros',
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  SALE: 'Ventas',
  PURCHASE_RECEIPT: 'Compras',
  RETURN: 'Devoluciones',
  ADJUSTMENT: 'Ajustes',
};

export class PDFGeneratorService {
  /**
   * Genera PDF de reporte de movimientos de inventario
   */
  async generateMovementsPDF(
    business: Business,
    data: {
      items: any[];
      totals: Record<string, Record<string, number>>;
    },
    filters: ReportFilters
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: 'Reporte de Movimientos de Inventario',
            Author: business.name,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc, business, 'Reporte de Movimientos de Inventario', filters);

        // Totales por tipo y unidad
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold').text('Resumen de Movimientos', { underline: true });
        doc.moveDown(0.5);

        let hasData = false;
        Object.entries(data.totals).forEach(([type, unitTotals]) => {
          hasData = true;
          doc.fontSize(11).font('Helvetica-Bold').fillColor('#2563eb').text(MOVEMENT_TYPE_LABELS[type] || type);
          doc.moveDown(0.3);

          Object.entries(unitTotals).forEach(([unit, quantity]) => {
            doc
              .fontSize(10)
              .font('Helvetica')
              .fillColor('#000000')
              .text(`  • ${Number(quantity).toFixed(2)} ${UNIT_LABELS[unit] || unit}`, { indent: 20 });
          });
          doc.moveDown(0.5);
        });

        if (!hasData) {
          doc.fontSize(10).fillColor('#666666').text('No hay movimientos en el período seleccionado');
        }

        // Tabla de movimientos
        if (data.items.length > 0) {
          doc.moveDown(1);
          doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Detalle de Movimientos', { underline: true });
          doc.moveDown(0.5);

          this.addMovementsTable(doc, data.items);
        }

        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Genera PDF de reporte de alertas de stock
   */
  async generateStockAlertsPDF(
    business: Business,
    data: {
      items: any[];
      summary: { total: number; critical: number; warning: number };
    }
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: 'Reporte de Alertas de Stock',
            Author: business.name,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc, business, 'Reporte de Alertas de Stock');

        // Resumen
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold').text('Resumen', { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).font('Helvetica');
        doc.fillColor('#dc2626').text(`Críticas: ${data.summary.critical}`);
        doc.fillColor('#ca8a04').text(`Advertencias: ${data.summary.warning}`);
        doc.fillColor('#2563eb').text(`Total: ${data.summary.total}`);

        // Tabla de alertas
        if (data.items.length > 0) {
          doc.moveDown(1);
          doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Detalle de Alertas', { underline: true });
          doc.moveDown(0.5);

          this.addAlertsTable(doc, data.items);
        } else {
          doc.moveDown(1);
          doc.fontSize(10).fillColor('#666666').text('No hay alertas de stock');
        }

        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Genera PDF de reporte de rotación de inventario
   */
  async generateRotationPDF(
    business: Business,
    data: {
      items: any[];
      summary: { total: number; fast: number; normal: number; slow: number; totalStockValue: number };
    },
    filters: ReportFilters
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: 'Reporte de Rotación de Inventario',
            Author: business.name,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc, business, 'Reporte de Rotación de Inventario', filters);

        // Resumen
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold').text('Resumen', { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).font('Helvetica').fillColor('#000000');
        doc.text(`Productos de rotación rápida: ${data.summary.fast}`);
        doc.text(`Productos de rotación normal: ${data.summary.normal}`);
        doc.text(`Productos de rotación lenta: ${data.summary.slow}`);
        doc.text(`Valor total en stock: $${data.summary.totalStockValue.toFixed(2)}`);

        // Tabla de rotación
        if (data.items.length > 0) {
          doc.moveDown(1);
          doc.fontSize(12).font('Helvetica-Bold').text('Detalle de Productos', { underline: true });
          doc.moveDown(0.5);

          this.addRotationTable(doc, data.items);
        }

        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Genera PDF de reporte de devoluciones
   */
  async generateReturnsPDF(
    business: Business,
    data: {
      items: any[];
      summary: { total: number; totalQuantity: number; totalReturnValue: number; averageReturnValue: number };
    },
    filters: ReportFilters
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: 'Reporte de Devoluciones',
            Author: business.name,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc, business, 'Reporte de Devoluciones', filters);

        // Resumen
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold').text('Resumen', { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).font('Helvetica').fillColor('#000000');
        doc.text(`Total de devoluciones: ${data.summary.total}`);
        doc.text(`Cantidad total: ${data.summary.totalQuantity.toFixed(2)}`);
        doc.text(`Valor total: $${data.summary.totalReturnValue.toFixed(2)}`);
        doc.text(`Valor promedio: $${data.summary.averageReturnValue.toFixed(2)}`);

        // Tabla de devoluciones
        if (data.items.length > 0) {
          doc.moveDown(1);
          doc.fontSize(12).font('Helvetica-Bold').text('Detalle de Devoluciones', { underline: true });
          doc.moveDown(0.5);

          this.addReturnsTable(doc, data.items);
        }

        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Genera PDF de resumen de ventas
   */
  async generateSalesSummaryPDF(
    business: Business,
    data: {
      period: { start: Date; end: Date };
      metrics: { totalRevenue: number; totalSales: number; avgTicket: number; totalItems: number };
      comparison?: any;
      topProducts: any[];
      topCategories: any[];
    },
    filters: ReportFilters
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: 'Resumen de Ventas',
            Author: business.name,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc, business, 'Resumen de Ventas', filters);

        // Métricas principales
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold').text('Métricas Principales', { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).font('Helvetica').fillColor('#000000');
        doc.text(`Ingresos totales: $${data.metrics.totalRevenue.toFixed(2)}`);
        doc.text(`Cantidad de ventas: ${data.metrics.totalSales}`);
        doc.text(`Ticket promedio: $${data.metrics.avgTicket.toFixed(2)}`);
        doc.text(`Items vendidos: ${data.metrics.totalItems.toFixed(2)}`);

        // Comparación con período anterior
        if (data.comparison) {
          doc.moveDown(1);
          doc.fontSize(12).font('Helvetica-Bold').text('Comparación con Período Anterior', { underline: true });
          doc.moveDown(0.5);

          doc.fontSize(10).font('Helvetica');
          const revenueChange = data.comparison.revenuePercentChange >= 0 ? '+' : '';
          doc.fillColor(data.comparison.revenuePercentChange >= 0 ? '#16a34a' : '#dc2626');
          doc.text(`Ingresos: ${revenueChange}${data.comparison.revenuePercentChange.toFixed(1)}% ($${data.comparison.revenueDelta.toFixed(2)})`);
          
          const salesChange = data.comparison.salesPercentChange >= 0 ? '+' : '';
          doc.fillColor(data.comparison.salesPercentChange >= 0 ? '#16a34a' : '#dc2626');
          doc.text(`Ventas: ${salesChange}${data.comparison.salesPercentChange.toFixed(1)}% (${data.comparison.salesDelta})`);
          
          doc.fillColor('#000000');
        }

        // Top productos
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Top 10 Productos', { underline: true });
        doc.moveDown(0.5);
        
        if (data.topProducts && data.topProducts.length > 0) {
          this.addTopProductsTable(doc, data.topProducts.slice(0, 10));
        } else {
          doc.fontSize(10).font('Helvetica').fillColor('#666666');
          doc.text('No hay datos de productos en el período seleccionado.', { align: 'center' });
          doc.fillColor('#000000');
        }

        // Top categorías
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold').text('Top 10 Categorías', { underline: true });
        doc.moveDown(0.5);
        
        if (data.topCategories && data.topCategories.length > 0) {
          this.addTopCategoriesTable(doc, data.topCategories.slice(0, 10));
        } else {
          doc.fontSize(10).font('Helvetica').fillColor('#666666');
          doc.text('No hay datos de categorías en el período seleccionado.', { align: 'center' });
          doc.fillColor('#000000');
        }

        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // ========== Métodos auxiliares ==========

  private addHeader(doc: PDFKit.PDFDocument, business: Business, title: string, filters?: ReportFilters) {
    // Título del negocio
    doc.fontSize(16).font('Helvetica-Bold').text(business.name, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`CUIT: ${business.cuit}`, { align: 'center' });
    if (business.address) {
      doc.text(business.address, { align: 'center' });
    }

    doc.moveDown(1);

    // Título del reporte
    doc.fontSize(14).font('Helvetica-Bold').text(title, { align: 'center' });

    // Período
    if (filters?.startDate && filters?.endDate) {
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#666666');
      const periodText = `Período: ${format(filters.startDate, 'dd/MM/yyyy', { locale: es })} - ${format(filters.endDate, 'dd/MM/yyyy', { locale: es })}`;
      doc.text(periodText, { align: 'center' });
    }

    // Fecha de generación
    doc.fontSize(9).fillColor('#999999');
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, { align: 'center' });

    doc.fillColor('#000000'); // Reset color
    doc.moveDown(0.5);

    // Línea separadora
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  }

  private addFooter(doc: PDFKit.PDFDocument) {
    const pageCount = doc.bufferedPageRange().count;
    
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      
      // Línea separadora
      doc.moveTo(50, 750).lineTo(545, 750).stroke();
      
      // Texto del footer
      doc.fontSize(8).fillColor('#999999');
      doc.text(
        `Página ${i + 1} de ${pageCount}`,
        50,
        760,
        { align: 'center', width: 495 }
      );
      doc.text(
        'Documento generado automáticamente',
        50,
        770,
        { align: 'center', width: 495 }
      );
    }
  }

  private addMovementsTable(doc: PDFKit.PDFDocument, items: any[]) {
    const tableTop = doc.y;
    const colWidths = [80, 80, 150, 70, 80, 80];
    const headers = ['Fecha', 'Tipo', 'Producto', 'Cantidad', 'Unidad', 'Motivo'];

    // Headers
    doc.fontSize(9).font('Helvetica-Bold');
    let xPos = 50;
    headers.forEach((header, i) => {
      doc.text(header, xPos, tableTop, { width: colWidths[i], align: i === 3 ? 'right' : 'left' });
      xPos += colWidths[i];
    });

    // Línea debajo de headers
    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    // Rows
    let yPos = tableTop + 20;
    doc.fontSize(8).font('Helvetica');

    items.slice(0, 50).forEach((item) => {
      // Check si necesitamos nueva página
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }

      xPos = 50;
      const rowData = [
        format(new Date(item.createdAt), 'dd/MM/yyyy', { locale: es }),
        item.type === 'SALE' ? 'Venta' : item.type === 'PURCHASE_RECEIPT' ? 'Compra' : item.type === 'RETURN' ? 'Devolución' : 'Ajuste',
        item.product.name.substring(0, 25),
        `${item.quantity > 0 ? '+' : ''}${Number(item.quantity).toFixed(2)}`,
        UNIT_LABELS[item.product.unit] || item.product.unit,
        (item.reason || '-').substring(0, 15),
      ];

      rowData.forEach((text, i) => {
        doc.text(text, xPos, yPos, { width: colWidths[i], align: i === 3 ? 'right' : 'left' });
        xPos += colWidths[i];
      });

      yPos += 15;
    });

    if (items.length > 50) {
      doc.moveDown(1);
      doc.fontSize(9).fillColor('#666666').text(`Mostrando primeros 50 de ${items.length} movimientos`, { align: 'center' });
      doc.fillColor('#000000');
    }
  }

  private addAlertsTable(doc: PDFKit.PDFDocument, items: any[]) {
    const tableTop = doc.y;
    const colWidths = [100, 200, 80, 150];
    const headers = ['SKU', 'Producto', 'Stock', 'Alerta'];

    // Headers
    doc.fontSize(9).font('Helvetica-Bold');
    let xPos = 50;
    headers.forEach((header, i) => {
      doc.text(header, xPos, tableTop, { width: colWidths[i], align: i === 2 ? 'right' : 'left' });
      xPos += colWidths[i];
    });

    // Línea debajo de headers
    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    // Rows
    let yPos = tableTop + 20;
    doc.fontSize(8).font('Helvetica');

    items.forEach((item) => {
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }

      xPos = 50;
      const rowData = [
        item.internalSku,
        item.name.substring(0, 30),
        `${Number(item.stockQuantity).toFixed(2)} ${UNIT_LABELS[item.unit] || item.unit}`,
        item.alertMessage,
      ];

      // Color según nivel
      if (item.alertLevel === 'CRITICAL') {
        doc.fillColor('#dc2626');
      } else {
        doc.fillColor('#ca8a04');
      }

      rowData.forEach((text, i) => {
        doc.text(text, xPos, yPos, { width: colWidths[i], align: i === 2 ? 'right' : 'left' });
        xPos += colWidths[i];
      });

      doc.fillColor('#000000');
      yPos += 15;
    });
  }

  private addRotationTable(doc: PDFKit.PDFDocument, items: any[]) {
    const tableTop = doc.y;
    const colWidths = [80, 150, 70, 80, 90, 70];
    const headers = ['SKU', 'Producto', 'Stock', 'Rotación', 'Clasificación', 'Valor'];

    // Headers
    doc.fontSize(9).font('Helvetica-Bold');
    let xPos = 50;
    headers.forEach((header, i) => {
      doc.text(header, xPos, tableTop, { width: colWidths[i], align: [2, 3, 5].includes(i) ? 'right' : 'left' });
      xPos += colWidths[i];
    });

    // Línea debajo de headers
    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    // Rows
    let yPos = tableTop + 20;
    doc.fontSize(8).font('Helvetica');

    items.slice(0, 40).forEach((item) => {
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }

      xPos = 50;
      const rowData = [
        item.internalSku,
        item.name.substring(0, 25),
        item.currentStock.toFixed(2),
        `${item.rotationSpeed.toFixed(2)}x`,
        item.classification === 'FAST' ? 'Rápido' : item.classification === 'NORMAL' ? 'Normal' : 'Lento',
        `$${item.stockValue.toFixed(2)}`,
      ];

      rowData.forEach((text, i) => {
        doc.text(text, xPos, yPos, { width: colWidths[i], align: [2, 3, 5].includes(i) ? 'right' : 'left' });
        xPos += colWidths[i];
      });

      yPos += 15;
    });

    if (items.length > 40) {
      doc.moveDown(1);
      doc.fontSize(9).fillColor('#666666').text(`Mostrando primeros 40 de ${items.length} productos`, { align: 'center' });
      doc.fillColor('#000000');
    }
  }

  private addTopProductsTable(doc: PDFKit.PDFDocument, items: any[]) {
    const tableTop = doc.y;
    const colWidths = [40, 250, 120, 120];
    const headers = ['#', 'Producto', 'Ingresos', 'Unidades'];

    // Headers
    doc.fontSize(9).font('Helvetica-Bold');
    let xPos = 50;
    headers.forEach((header, i) => {
      doc.text(header, xPos, tableTop, { width: colWidths[i], align: i > 1 ? 'right' : 'left' });
      xPos += colWidths[i];
    });

    // Línea debajo de headers
    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    // Rows
    let yPos = tableTop + 20;
    doc.fontSize(8).font('Helvetica');

    items.forEach((item, index) => {
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }

      xPos = 50;
      const rowData = [
        (index + 1).toString(),
        item.productName.substring(0, 40),
        `$${item.totalRevenue.toFixed(2)}`,
        item.totalUnits.toFixed(2),
      ];

      rowData.forEach((text, i) => {
        doc.text(text, xPos, yPos, { width: colWidths[i], align: i > 1 ? 'right' : 'left' });
        xPos += colWidths[i];
      });

      yPos += 15;
    });
  }

  private addTopCategoriesTable(doc: PDFKit.PDFDocument, items: any[]) {
    const tableTop = doc.y;
    const colWidths = [40, 280, 120, 90];
    const headers = ['#', 'Categoría', 'Ingresos', '%'];

    // Headers
    doc.fontSize(9).font('Helvetica-Bold');
    let xPos = 50;
    headers.forEach((header, i) => {
      doc.text(header, xPos, tableTop, { width: colWidths[i], align: i > 1 ? 'right' : 'left' });
      xPos += colWidths[i];
    });

    // Línea debajo de headers
    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    // Rows
    let yPos = tableTop + 20;
    doc.fontSize(8).font('Helvetica');

    items.forEach((item, index) => {
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }

      xPos = 50;
      const rowData = [
        (index + 1).toString(),
        item.categoryName.substring(0, 45),
        `$${item.totalRevenue.toFixed(2)}`,
        `${item.percentage.toFixed(1)}%`,
      ];

      rowData.forEach((text, i) => {
        doc.text(text, xPos, yPos, { width: colWidths[i], align: i > 1 ? 'right' : 'left' });
        xPos += colWidths[i];
      });

      yPos += 15;
    });
  }

  private addReturnsTable(doc: PDFKit.PDFDocument, items: any[]) {
    const tableTop = doc.y;
    const colWidths = [80, 150, 80, 80, 150];
    const headers = ['Fecha', 'Producto', 'Cantidad', 'Valor', 'Cliente'];

    // Headers
    doc.fontSize(9).font('Helvetica-Bold');
    let xPos = 50;
    headers.forEach((header, i) => {
      doc.text(header, xPos, tableTop, { width: colWidths[i], align: [2, 3].includes(i) ? 'right' : 'left' });
      xPos += colWidths[i];
    });

    // Línea debajo de headers
    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    // Rows
    let yPos = tableTop + 20;
    doc.fontSize(8).font('Helvetica');

    items.slice(0, 40).forEach((item) => {
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }

      xPos = 50;
      const customerName = item.customer
        ? `${item.customer.firstName || ''} ${item.customer.lastName || ''}`.trim() || item.customer.companyName || 'Sin cliente'
        : 'Sin cliente';

      const rowData = [
        format(new Date(item.createdAt), 'dd/MM/yyyy', { locale: es }),
        item.product.name.substring(0, 25),
        item.quantity.toFixed(2),
        `$${item.returnValue.toFixed(2)}`,
        customerName.substring(0, 25),
      ];

      rowData.forEach((text, i) => {
        doc.text(text, xPos, yPos, { width: colWidths[i], align: [2, 3].includes(i) ? 'right' : 'left' });
        xPos += colWidths[i];
      });

      yPos += 15;
    });

    if (items.length > 40) {
      doc.moveDown(1);
      doc.fontSize(9).fillColor('#666666').text(`Mostrando primeras 40 de ${items.length} devoluciones`, { align: 'center' });
      doc.fillColor('#000000');
    }
  }
}
