import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';

const mockPrisma = {
  business: {
    findUnique: jest.fn() as any,
    update: jest.fn() as any,
  },
  businessArcaCredential: {
    findUnique: jest.fn() as any,
  },
};

const mockAuditService = {
  logUpdate: jest.fn() as any,
};

const mockArcaCredentialsService = {
  upsertTenantCredentials: jest.fn() as any,
  refreshTenantCredentialsIfNeeded: jest.fn() as any,
};

const mockIsValidTimezone = jest.fn() as any;

const authState = {
  user: { id: 'user-1', businessId: 'biz-1' },
  businessId: 'biz-1',
  timezone: 'America/Argentina/Buenos_Aires',
};

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/services/audit.service', () => ({ AuditService: mockAuditService }));
jest.mock('@/services/arca-credentials.service', () => ({ ArcaCredentialsService: mockArcaCredentialsService }));
jest.mock('@/services/cloudinary.service', () => ({
  CloudinaryService: {
    uploadImage: jest.fn() as any,
    deleteImage: jest.fn() as any,
  },
}));
jest.mock('@/utils/timezone', () => ({
  isValidTimezone: mockIsValidTimezone,
  COMMON_TIMEZONES: ['America/Argentina/Buenos_Aires', 'UTC'],
}));
jest.mock('@/middleware/auth', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = authState.user;
    (req as any).businessId = authState.businessId;
    (req as any).timezone = authState.timezone;
    next();
  },
}));
jest.mock('@/middleware/multi-tenant', () => ({
  multiTenant: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).businessId = authState.businessId;
    next();
  },
}));
jest.mock('@/middleware/rbac', () => ({
  requirePermissions:
    () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import businessRouter from '@/routes/business.routes';

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/business', businessRouter);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err?.statusCode || 500).json({ success: false, error: { code: err?.code, message: err?.message } });
  });
  return app;
};

describe('business.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState.businessId = 'biz-1';
    authState.user = { id: 'user-1', businessId: 'biz-1' };
    mockIsValidTimezone.mockReturnValue(true);
  });

  it('GET /business devuelve negocio y 404 cuando no existe', async () => {
    mockPrisma.business.findUnique.mockResolvedValueOnce({ id: 'biz-1', name: 'Ferreteria' });

    const app = createApp();
    const ok = await request(app).get('/business');
    expect(ok.status).toBe(200);
    expect(ok.body.data.id).toBe('biz-1');

    mockPrisma.business.findUnique.mockResolvedValueOnce(null);
    const fail = await request(app).get('/business');
    expect(fail.status).toBe(404);
  });

  it('PATCH /business valida timezone y actualiza datos', async () => {
    mockIsValidTimezone.mockReturnValueOnce(false);

    const app = createApp();
    const invalid = await request(app).patch('/business').send({ timezone: 'Mars/Phobos' });
    expect(invalid.status).toBe(400);

    mockIsValidTimezone.mockReturnValueOnce(true);
    mockPrisma.business.update.mockResolvedValue({ id: 'biz-1', timezone: 'UTC' });

    const ok = await request(app).patch('/business').send({ timezone: 'UTC', name: 'Nueva' });
    expect(ok.status).toBe(200);
    expect(mockAuditService.logUpdate).toHaveBeenCalled();
  });

  it('GET /business/invoicing/arca-credentials devuelve configured false/true', async () => {
    const app = createApp();

    mockPrisma.businessArcaCredential.findUnique.mockResolvedValueOnce(null);
    const empty = await request(app).get('/business/invoicing/arca-credentials');
    expect(empty.status).toBe(200);
    expect(empty.body.data.configured).toBe(false);

    mockPrisma.businessArcaCredential.findUnique.mockResolvedValueOnce({
      tokenEncrypted: 'enc-token',
      signEncrypted: 'enc-sign',
      cuit: '20123456789',
      environment: 'homo',
      wsfeUrl: 'https://wsfe',
      wsaaUrl: 'https://wsaa',
      isEnabled: true,
      tokenExpiresAt: null,
      certificatePemEncrypted: null,
      privateKeyPemEncrypted: null,
      updatedAt: new Date(),
    });

    const configured = await request(app).get('/business/invoicing/arca-credentials');
    expect(configured.status).toBe(200);
    expect(configured.body.data.configured).toBe(true);
  });

  it('GET /business/timezones devuelve lista de zonas disponibles', async () => {
    const app = createApp();
    const res = await request(app).get('/business/timezones');

    expect(res.status).toBe(200);
    expect(res.body.data).toContain('UTC');
  });
});
