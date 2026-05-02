import { Response } from 'express';
import { sendSuccess, sendPaginated } from './response';

export interface PaginationParams {
  page?: number | string;
  limit?: number | string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(
  input: PaginationParams,
  options: {
    defaultLimit?: number;
    maxLimit?: number;
  } = {}
): {
  page: number;
  limit: number;
  skip: number;
} {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_LIMIT;

  const pageRaw = Number(input.page) || DEFAULT_PAGE;
  const limitRaw = Number(input.limit) || defaultLimit;

  const page = Math.max(DEFAULT_PAGE, pageRaw);
  const limit = Math.min(maxLimit, Math.max(1, limitRaw));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

export function sendPaginatedResult<T>(
  res: Response,
  items: T[],
  meta: PaginationMeta
): Response {
  return sendPaginated(res, items, meta);
}

export function sendPaginatedList<T>(
  res: Response,
  items: T[],
  total: number,
  page: number,
  limit: number
): Response {
  const meta = buildPaginationMeta(total, page, limit);
  return sendPaginated(res, items, meta);
}

export const paginationSchema = {
  page: (defaultValue = DEFAULT_PAGE) =>
    typeof defaultValue === 'number'
      ? ({ value }: { value?: number | string }) =>
          Math.max(1, Number(value) || defaultValue)
      : 1,

  limit: (defaultValue = DEFAULT_LIMIT, maxValue = MAX_LIMIT) =>
    ({ value }: { value?: number | string }) =>
      Math.min(maxValue, Math.max(1, Number(value) || defaultValue)),
};