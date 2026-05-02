export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface LegacyListResponse<T> {
  items: T[];
  meta: PaginatedMeta;
}

export function normalizePaginatedResponse<T>(
  response: any,
  fallback: { page?: number; limit?: number } = {}
): {
  data: T[];
  meta: PaginatedMeta;
} {
  const page = fallback.page ?? 1;
  const limit = fallback.limit ?? 20;

  if (Array.isArray(response.data)) {
    return {
      data: response.data,
      meta: {
        page,
        limit,
        total: response.data.length,
        totalPages: 1,
        hasMore: false,
      },
    };
  }

  if (response.data?.items) {
    return {
      data: response.data.items,
      meta: response.data.meta ?? {
        page,
        limit,
        total: response.data.items.length,
        totalPages: 1,
        hasMore: false,
      },
    };
  }

  return {
    data: [],
    meta: {
      page,
      limit,
      total: 0,
      totalPages: 1,
      hasMore: false,
    },
  };
}

export function getDefaultPaginationMeta(
  page = 1,
  limit = 20
): PaginatedMeta {
  return {
    page,
    limit,
    total: 0,
    totalPages: 1,
    hasMore: false,
  };
}