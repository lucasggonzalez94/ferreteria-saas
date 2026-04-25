import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

const mockAuthService = {
  register: jest.fn() as any,
  login: jest.fn() as any,
  refresh: jest.fn() as any,
  logout: jest.fn() as any,
  forgotPassword: jest.fn() as any,
  resetPassword: jest.fn() as any,
  changePassword: jest.fn() as any,
};

const mockPrisma = {
  user: { update: jest.fn() as any, findUnique: jest.fn() as any },
  refreshTokenSession: { findUnique: jest.fn() as any },
};

const mockAuditService = {
  log: jest.fn() as any,
};

const mockTokenService = {
  verifyRefreshToken: jest.fn() as any,
  hashToken: jest.fn() as any,
  generateAccessToken: jest.fn() as any,
  generateCsrfToken: jest.fn() as any,
};

const authState = {
  user: { id: 'user-1', businessId: 'biz-1' },
  businessId: 'biz-1',
};

const mockEnv = {
  cookies: {
    secure: false,
    sameSite: 'lax',
  },
};

jest.mock('@/services/auth.service', () => ({
  AuthService: class AuthService {
    register = mockAuthService.register;
    login = mockAuthService.login;
    refresh = mockAuthService.refresh;
    logout = mockAuthService.logout;
    forgotPassword = mockAuthService.forgotPassword;
    resetPassword = mockAuthService.resetPassword;
    changePassword = mockAuthService.changePassword;
  },
}));
jest.mock('@/services/token.service', () => ({ TokenService: mockTokenService }));
jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/services/audit.service', () => ({ AuditService: mockAuditService }));
jest.mock('@/config/env', () => ({ env: mockEnv }));
jest.mock('@/middleware/rate-limit', () => ({
  authLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  resetPasswordLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  refreshLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('@/middleware/auth', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = authState.user;
    (req as any).businessId = authState.businessId;
    next();
  },
}));
jest.mock('@/middleware/rbac', () => ({
  requirePermissions:
    () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('@/routes/auth.schemas', () => ({
  registerSchema: { parse: (v: unknown) => v },
  loginSchema: { parse: (v: unknown) => v },
  forgotPasswordSchema: { parse: (v: unknown) => v },
  resetPasswordSchema: { parse: (v: unknown) => v },
  changePasswordSchema: { parse: (v: unknown) => v },
}));

import authRouter from '@/routes/auth.routes';

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth', authRouter);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err?.statusCode || 500).json({ success: false, error: { code: err?.code, message: err?.message } });
  });
  return app;
};

describe('auth.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState.user = { id: 'user-1', businessId: 'biz-1' };
    authState.businessId = 'biz-1';
  });

  it('POST /auth/login setea cookie y retorna tokens', async () => {
    mockAuthService.login.mockResolvedValue({
      user: { id: 'user-1' },
      business: { id: 'biz-1' },
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      csrfToken: 'csrf-1',
      csrfHash: 'hash-1',
    });

    const app = createApp();
    const res = await request(app)
      .post('/auth/login')
      .set('user-agent', 'jest')
      .send({ email: 'admin@ferreteria-demo.com', password: 'Admin123456' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe('access-1');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /auth/refresh falla sin cookie y funciona con cookie', async () => {
    const app = createApp();
    const fail = await request(app).post('/auth/refresh').send({});
    expect(fail.status).toBe(401);

    mockAuthService.refresh.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      csrfToken: 'new-csrf',
      csrfHash: 'new-hash',
    });

    const ok = await request(app)
      .post('/auth/refresh')
      .set('Cookie', ['refreshToken=valid-token'])
      .set('user-agent', 'jest');

    expect(ok.status).toBe(200);
    expect(ok.body.data.accessToken).toBe('new-access');
  });

  it('POST /auth/logout limpia cookie aun sin refresh token', async () => {
    const app = createApp();
    const res = await request(app).post('/auth/logout').send({ accessToken: 'acc' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Logged out successfully');
  });

  it('GET /auth/me retorna usuario autenticado y cubre rama UNAUTHORIZED', async () => {
    const app = createApp();
    const ok = await request(app).get('/auth/me');
    expect(ok.status).toBe(200);
    expect(ok.body.data.id).toBe('user-1');

    authState.user = null as any;
    const fail = await request(app).get('/auth/me');
    expect(fail.status).toBe(401);
  });
});
