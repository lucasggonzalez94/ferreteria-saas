import { Router, Request, Response, NextFunction } from 'express';
import { SalesReportsService } from '../services/sales-reports.service';
import { PDFGeneratorService } from '../services/pdf-generator.service';
import { sendSuccess } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { z } from 'zod';
import { prisma } from '../config/database';
import { formatInTimezone } from '../utils/timezone';

const router = Router();
const salesReportsService = new SalesReportsService();
const pdfService = new PDFGeneratorService();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

// Schema de validación
const salesSummaryFiltersSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  compareWithPrevious: z.string().optional().transform((val) => val === 'true'),
  customerId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'La fecha de inicio debe ser menor o igual a la fecha de fin' }
);

/**
 * GET /sales-reports/summary
 * Resumen general de ventas con comparación vs período anterior
 */
router.get(
  '/summary',
  requirePermissions('reports:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = salesSummaryFiltersSchema.parse(req.query);

      const result = await salesReportsService.getSummary(authReq.businessId!, {
        startDate: new Date(filters.startDate),
        endDate: new Date(filters.endDate),
        compareWithPrevious: filters.compareWithPrevious,
        customerId: filters.customerId,
        categoryId: filters.categoryId,
        timezone: authReq.timezone,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /sales-reports/summary/pdf
 * Exportar resumen de ventas a PDF
 */
router.get(
  '/summary/pdf',
  requirePermissions('reports:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = salesSummaryFiltersSchema.parse(req.query);

      const [result, business] = await Promise.all([
        salesReportsService.getSummary(authReq.businessId!, {
          startDate: new Date(filters.startDate),
          endDate: new Date(filters.endDate),
          compareWithPrevious: filters.compareWithPrevious,
          customerId: filters.customerId,
          categoryId: filters.categoryId,
          timezone: authReq.timezone,
        }),
        prisma.business.findUnique({
          where: { id: authReq.businessId! },
          select: { name: true, cuit: true, address: true, phone: true },
        }),
      ]);

      if (!business) {
        return res.status(404).json({ success: false, error: { code: 'BUSINESS_NOT_FOUND', message: 'Negocio no encontrado' } });
      }

      const pdf = await pdfService.generateSalesSummaryPDF(
        {
          name: business.name,
          cuit: business.cuit,
          address: business.address ?? undefined,
          phone: business.phone ?? undefined,
        },
        {
          period: result.period,
          metrics: result.metrics,
          comparison: result.comparison,
          topProducts: result.topProducts,
          topCategories: result.topCategories,
        },
        {
          startDate: new Date(filters.startDate),
          endDate: new Date(filters.endDate),
        }
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="reporte-ventas-${formatInTimezone(new Date(), 'yyyy-MM-dd', authReq.timezone)}.pdf"`
      );
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
