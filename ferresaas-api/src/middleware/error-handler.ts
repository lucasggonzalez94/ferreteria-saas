import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/response';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error
  logger.error(
    {
      err,
      requestId: (req as any).requestId,
      path: req.path,
      method: req.method,
    },
    'Error occurred'
  );

  // Zod validation error
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors,
      },
    });
    return;
  }

  // App error (custom)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    if (prismaError.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: 'A record with this value already exists',
          details: prismaError.meta,
        },
      });
      return;
    }
  }

  // Default error
  const statusCode = (err as any).statusCode || 500;
  const message = env.app.isProduction ? 'Internal server error' : err.message;

  res.status(statusCode).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
      details: env.app.isDevelopment ? err.stack : undefined,
    },
  });
};
