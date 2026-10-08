import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

const mockSignup = jest.fn() as any;
const mockLogin = jest.fn() as any;
const mockRefresh = jest.fn() as any;
const mockRestore = jest.fn() as any;
const mockLogout = jest.fn() as any;
const mockForgot = jest.fn() as any;
const mockReset = jest.fn() as any;
const mockChange = jest.fn() as any;
const mockRegister = jest.fn() as any;
const mockUpdateProfile = jest.fn() as any;

jest.mock('@/modules/identity/application/signup-business-owner', () => ({
  signupBusinessOwner: mockSignup,
}));
jest.mock('@/modules/identity/application/login', () => ({ login: mockLogin }));
jest.mock('@/modules/identity/application/refresh-session', () => ({
  refreshSession: mockRefresh,
}));
jest.mock('@/modules/identity/application/restore-session', () => ({
  restoreSession: mockRestore,
}));
jest.mock('@/modules/identity/application/logout', () => ({ logout: mockLogout }));
jest.mock('@/modules/identity/application/password', () => ({
  forgotPassword: mockForgot,
  resetPassword: mockReset,
  changePassword: mockChange,
}));
jest.mock('@/modules/identity/http/rate-limit', () => ({
  signupRateLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  loginRateLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  refreshRateLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  resetPasswordRateLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('@/platform/security/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { id: 'user-1', businessId: 'biz-1', roles: [], permissions: [] };
    (req as any).businessId = 'biz-1';
    next();
  },
  requirePermissions: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('@/middleware/rbac', () => ({
  requirePermissions: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('@/routes/auth.schemas', () => ({
  registerSchema: { parse: (v: unknown) => v },
}));
jest.mock('@/services/auth.service', () => ({
  AuthService: class {
    register = mockRegister;
    updateProfile = mockUpdateProfile;
  },
}));
jest.mock('@/config/env', () => ({
  env: {
    cookies: { secure: false, sameSite: 'lax' },
    app: { frontendUrl: 'http://localhost:3000' },
  },
}));

import authRouter from '@/routes/auth.routes';

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth', authRouter);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res
      .status(err?.statusCode || 500)
      .json({ success: false, error: { code: err?.code, message: err?.message } });
  });
  return app;
};

const origin = { Origin: 'http://localhost:3000' };

describe('auth.routes (aggregate router)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POST /auth/signup devuelve 201, setea cookie y no expone refresh en el JSON', async () => {
    mockSignup.mockResolvedValue({
      user: { id: 'user-1', roles: ['OWNER'], permissions: [] },
      business: { id: 'biz-1' },
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      csrfToken: 'csrf-1',
      csrfHash: 'hash-1',
    });

    const res = await request(createApp())
      .post('/auth/signup')
      .set(origin)
      .set('user-agent', 'jest')
      .send({
        businessName: 'Ferreteria Test',
        businessCuit: '20-11111111-1',
        taxCondition: 'MONOTRIBUTO',
        ownerFirstName: 'Owner',
        email: 'owner@test.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBe('access-1');
    expect(res.body.data.refreshToken).toBeUndefined();
    const cookies = res.headers['set-cookie'];
    expect(String(cookies)).toContain('refreshToken=refresh-1');
    expect(String(cookies)).toContain('HttpOnly');
    expect(mockSignup).toHaveBeenCalledWith(
      expect.objectContaining({ businessName: 'Ferreteria Test' }),
      expect.anything(),
      'jest',
    );
  });

  it('POST /auth/signup rechaza origen inválido', async () => {
    const res = await request(createApp())
      .post('/auth/signup')
      .set('Origin', 'https://evil.example')
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_ORIGIN');
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it('POST /auth/login devuelve tokens y cookie', async () => {
    mockLogin.mockResolvedValue({
      user: { id: 'user-1' },
      business: { id: 'biz-1' },
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      csrfToken: 'csrf-1',
      csrfHash: 'hash-1',
    });
    const res = await request(createApp())
      .post('/auth/login')
      .set(origin)
      .send({ email: 'a@b.com', password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('access-1');
    expect(String(res.headers['set-cookie'])).toContain('refreshToken=refresh-1');
  });

  it('POST /auth/refresh sin cookie responde 401', async () => {
    const res = await request(createApp()).post('/auth/refresh').set(origin).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_REFRESH_TOKEN');
  });

  it('POST /auth/refresh rota cookie y responde no-store', async () => {
    mockRefresh.mockResolvedValue({
      accessToken: 'a-2',
      refreshToken: 'r-2',
      csrfToken: 'c-2',
      csrfHash: 'h-2',
    });
    const res = await request(createApp())
      .post('/auth/refresh')
      .set(origin)
      .set('Cookie', ['refreshToken=r-1']);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('a-2');
    expect(String(res.headers['set-cookie'])).toContain('refreshToken=r-2');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(mockRefresh).toHaveBeenCalledWith('r-1', expect.anything(), undefined);
  });

  it('GET /auth/restore-session responde no-store y no rota refresh', async () => {
    mockRestore.mockResolvedValue({ user: { id: 'user-1' }, accessToken: 'a-3' });
    const res = await request(createApp())
      .get('/auth/restore-session')
      .set('Cookie', ['refreshToken=r-1']);
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe('user-1');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(String(res.headers['set-cookie'] ?? '')).not.toContain('refreshToken=');
  });

  it('POST /auth/logout limpia la cookie y responde éxito', async () => {
    mockLogout.mockResolvedValue({ message: 'Logged out successfully' });
    const res = await request(createApp())
      .post('/auth/logout')
      .set('Cookie', ['refreshToken=r-1'])
      .send({});
    expect(res.status).toBe(200);
    expect(mockLogout).toHaveBeenCalledWith('r-1', expect.anything(), undefined);
    expect(String(res.headers['set-cookie'])).toContain('refreshToken=;');
  });

  it('POST /auth/register (legacy admin) sigue operativo', async () => {
    mockRegister.mockResolvedValue({ id: 'u-9', email: 'n@x.com', firstName: 'N', lastName: null, businessId: 'biz-1' });
    const res = await request(createApp())
      .post('/auth/register')
      .send({ email: 'n@x.com', password: 'Password12345' });
    expect(res.status).toBe(201);
    expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({ businessId: 'biz-1' }));
  });

  it('GET /auth/me devuelve el usuario autenticado', async () => {
    const res = await request(createApp()).get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('user-1');
  });

  it('PUT /auth/profile actualiza el perfil', async () => {
    mockUpdateProfile.mockResolvedValue({ id: 'user-1', firstName: 'Maria' });
    const res = await request(createApp()).put('/auth/profile').send({ firstName: 'Maria' });
    expect(res.status).toBe(200);
    expect(mockUpdateProfile).toHaveBeenCalledWith('biz-1', 'user-1', 'Maria', undefined);
  });
});
