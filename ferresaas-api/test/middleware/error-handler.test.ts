import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { z } from 'zod';

const mockLogger = {
  error: jest.fn() as any,
};

const mockEnv = {
  app: {
    isDevelopment: true,
    isProduction: false,
  },
};

jest.mock('@/config/logger', () => ({ logger: mockLogger }));
jest.mock('@/config/env', () => ({ env: mockEnv }));

import { AppError } from '@/utils/response';
import { errorHandler } from '@/middleware/error-handler';

describe('error-handler middleware', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.app.isDevelopment = true;
    mockEnv.app.isProduction = false;

    req = {
      requestId: 'req-1',
      path: '/products',
      method: 'POST',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it('handles zod validation errors as 400', () => {
    const schema = z.object({ name: z.string().min(3) });
    const result = schema.safeParse({ name: 'x' });
    expect(result.success).toBe(false);

    errorHandler((result as any).error, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'VALIDATION_ERROR', details: expect.any(Array) }),
      })
    );
  });

  it('handles AppError with custom status and code', () => {
    errorHandler(new AppError(403, 'FORBIDDEN', 'No access'), req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'No access',
        details: undefined,
      },
    });
  });

  it('maps prisma duplicate errors to 409 response', () => {
    const prismaError = {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      meta: { target: ['email'] },
    } as any;

    errorHandler(prismaError, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'DUPLICATE_ERROR' }),
      })
    );
  });

  it('hides unexpected error message in production', () => {
    mockEnv.app.isDevelopment = false;
    mockEnv.app.isProduction = true;

    errorHandler(new Error('db connection leaked'), req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor. Intenta nuevamente.',
        details: undefined,
      },
    });
  });

  it('keeps error stack in development for unexpected errors', () => {
    const err = new Error('unexpected issue');

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'unexpected issue',
          details: expect.any(String),
        }),
      })
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
