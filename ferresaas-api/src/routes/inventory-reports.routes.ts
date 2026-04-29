import { Router, Request, Response, NextFunction } from 'express';
import { InventoryReportsService } from '../services/inventory-reports.service';
import { PDFGeneratorService } from '../services/pdf-generator.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { z } from 'zod';
import { prisma } from '../config/database';
import { formatInTimezone } from '../utils/timezone';

const router = Router();
const reportsService = new InventoryReportsService();
const pdfService = new PDFGeneratorService();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

// Schemas de validación
const reportFiltersSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'La fecha de inicio debe ser menor o igual a la fecha de fin' }
);

const rotationFiltersSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'La fecha de inicio debe ser menor o igual a la fecha de fin' }
);

const returnsFiltersSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  customerId: z.string().cuid().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
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
 * GET /inventory-reports/movements
 * Reporte de Movimientos de Inventario
 */
router.get(
  '/movements',
  requirePermissions('reports:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = reportFiltersSchema.parse(req.query);

      const result = await reportsService.getMovementsReport(authReq.businessId!, {
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        page: filters.page,
        limit: filters.limit,
      });

      sendSuccess(res, {
        items: result.items,
        meta: result.meta,
        totals: result.totals,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /inventory-reports/stock-alerts
 * Reporte de Stock Bajo & Alertas (con paginación)
 */
router.get(
  '/stock-alerts',
  requirePermissions('reports:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const skip = (page - 1) * limit;

      const result = await reportsService.getStockAlertsReport(authReq.businessId!);

      const allItems = result.items || [];
      const total = allItems.length;
      const totalPages = Math.ceil(total / limit);
      const paginatedItems = allItems.slice(skip, skip + limit);

      const meta = {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      };

      res.status(200).json({
        success: true,
        data: {
          items: paginatedItems,
          summary: result.summary,
        },
        meta,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /inventory-reports/rotation
 * Reporte de Rotación de Inventario
 */
router.get(
  '/rotation',
  requirePermissions('reports:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = rotationFiltersSchema.parse(req.query);

      const result = await reportsService.getRotationReport(authReq.businessId!, {
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        limit: filters.limit,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /inventory-reports/returns
 * Reporte de Devoluciones
 */
router.get(
  '/returns',
  requirePermissions('reports:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = returnsFiltersSchema.parse(req.query);

      const result = await reportsService.getReturnsReport(authReq.businessId!, {
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        customerId: filters.customerId,
        page: filters.page,
        limit: filters.limit,
      });

      sendSuccess(res, {
        items: result.items,
        meta: result.meta,
        byProduct: result.byProduct,
        byCustomer: result.byCustomer,
        summary: result.summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /inventory-reports/movements/pdf
 * Exportar movimientos de inventario a PDF
 */
router.get(
  '/movements/pdf',
  requirePermissions('reports:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = reportFiltersSchema.parse(req.query);

      const [result, business] = await Promise.all([
        reportsService.getMovementsReport(authReq.businessId!, {
          startDate: filters.startDate ? new Date(filters.startDate) : undefined,
          endDate: filters.endDate ? new Date(filters.endDate) : undefined,
          page: filters.page,
          limit: filters.limit,
        }),
        prisma.business.findUnique({
          where: { id: authReq.businessId! },
          select: { name: true, cuit: true, address: true, phone: true },
        }),
      ]);

      if (!business) {
        return res.status(404).json({ success: false, error: { code: 'BUSINESS_NOT_FOUND', message: 'Negocio no encontrado' } });
      }

      const pdf = await pdfService.generateMovementsPDF(
        {
          name: business.name,
          cuit: business.cuit,
          address: business.address ?? undefined,
          phone: business.phone ?? undefined,
        },
        { items: result.items, totals: result.totals },
        {
          startDate: filters.startDate ? new Date(filters.startDate) : undefined,
          endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        }
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="movimientos-inventario-${formatInTimezone(new Date(), 'yyyy-MM-dd', authReq.timezone)}.pdf"`
      );
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /inventory-reports/stock-alerts/pdf
 * Exportar alertas de stock a PDF
 */
router.get(
  '/stock-alerts/pdf',
  requirePermissions('reports:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      const [result, business] = await Promise.all([
        reportsService.getStockAlertsReport(authReq.businessId!),
        prisma.business.findUnique({
          where: { id: authReq.businessId! },
          select: { name: true, cuit: true, address: true, phone: true },
        }),
      ]);

      if (!business) {
        return res.status(404).json({ success: false, error: { code: 'BUSINESS_NOT_FOUND', message: 'Negocio no encontrado' } });
      }

      const pdf = await pdfService.generateStockAlertsPDF(
        {
          name: business.name,
          cuit: business.cuit,
          address: business.address ?? undefined,
          phone: business.phone ?? undefined,
        },
        {
          items: result.items,
          summary: result.summary,
        }
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="alertas-stock-${formatInTimezone(new Date(), 'yyyy-MM-dd', authReq.timezone)}.pdf"`
      );
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /inventory-reports/rotation/pdf
 * Exportar rotación de inventario a PDF
 */
router.get(
  '/rotation/pdf',
  requirePermissions('reports:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = rotationFiltersSchema.parse(req.query);

      const [result, business] = await Promise.all([
        reportsService.getRotationReport(authReq.businessId!, {
          startDate: filters.startDate ? new Date(filters.startDate) : undefined,
          endDate: filters.endDate ? new Date(filters.endDate) : undefined,
          limit: filters.limit,
        }),
        prisma.business.findUnique({
          where: { id: authReq.businessId! },
          select: { name: true, cuit: true, address: true, phone: true },
        }),
      ]);

      if (!business) {
        return res.status(404).json({ success: false, error: { code: 'BUSINESS_NOT_FOUND', message: 'Negocio no encontrado' } });
      }

      const pdf = await pdfService.generateRotationPDF(
        {
          name: business.name,
          cuit: business.cuit,
          address: business.address ?? undefined,
          phone: business.phone ?? undefined,
        },
        { items: result.items, summary: result.summary },
        {
          startDate: filters.startDate ? new Date(filters.startDate) : undefined,
          endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        }
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="rotacion-inventario-${formatInTimezone(new Date(), 'yyyy-MM-dd', authReq.timezone)}.pdf"`
      );
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /inventory-reports/returns/pdf
 * Exportar devoluciones a PDF
 */
router.get(
  '/returns/pdf',
  requirePermissions('reports:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = returnsFiltersSchema.parse(req.query);

      const [result, business] = await Promise.all([
        reportsService.getReturnsReport(authReq.businessId!, {
          startDate: filters.startDate ? new Date(filters.startDate) : undefined,
          endDate: filters.endDate ? new Date(filters.endDate) : undefined,
          customerId: filters.customerId,
          page: filters.page,
          limit: filters.limit,
        }),
        prisma.business.findUnique({
          where: { id: authReq.businessId! },
          select: { name: true, cuit: true, address: true, phone: true },
        }),
      ]);

      if (!business) {
        return res.status(404).json({ success: false, error: { code: 'BUSINESS_NOT_FOUND', message: 'Negocio no encontrado' } });
      }

      const pdf = await pdfService.generateReturnsPDF(
        {
          name: business.name,
          cuit: business.cuit,
          address: business.address ?? undefined,
          phone: business.phone ?? undefined,
        },
        { items: result.items, summary: result.summary },
        {
          startDate: filters.startDate ? new Date(filters.startDate) : undefined,
          endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        }
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="devoluciones-${formatInTimezone(new Date(), 'yyyy-MM-dd', authReq.timezone)}.pdf"`
      );
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
