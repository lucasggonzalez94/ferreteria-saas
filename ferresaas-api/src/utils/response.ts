import { Response } from 'express';
import { ApiResponse } from '../types';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const sendSuccess = <T>(res: Response, data: T, statusCode = 200): Response => {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): Response => {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
  return res.status(statusCode).json(response);
};

export const sendPaginated = <T>(
  res: Response,
  items: T[],
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
    hasMore?: boolean;
  }
): Response => {
  const totalPages = Math.ceil(meta.total / meta.limit);
  const response: ApiResponse<T[]> = {
    success: true,
    data: items,
    meta: {
      ...meta,
      totalPages: meta.totalPages ?? totalPages,
      hasMore: meta.hasMore ?? (meta.page < totalPages),
    },
  };
  return res.status(200).json(response);
};
