import { api } from "@/lib/api";
import { normalizePaginatedResponse } from "@/lib/pagination";

type ListProductsParams = {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  status?: string;
  lowStockOnly?: boolean;
  priceMin?: string;
  priceMax?: string;
  sort?: string;
};

export async function listProducts<T>({
  page,
  limit,
  search,
  categoryId,
  status,
  lowStockOnly,
  priceMin,
  priceMax,
  sort,
}: ListProductsParams) {
  const response = await api.get<T[]>("/products", {
    params: {
      page,
      limit,
      q: search || undefined,
      categoryId: categoryId || undefined,
      active: status === "active" ? true : status === "inactive" ? false : undefined,
      lowStock: lowStockOnly || undefined,
      priceMin: priceMin || undefined,
      priceMax: priceMax || undefined,
      sort: sort || undefined,
    },
  });

  return normalizePaginatedResponse<T>(response, { page, limit });
}

export async function getLowStockCount() {
  const response = await api.get<unknown[]>("/products", {
    params: { page: 1, limit: 1, lowStock: true },
  });

  const { meta } = normalizePaginatedResponse<unknown>(response, { page: 1, limit: 1 });
  return meta.total;
}

export async function deleteProduct(id: string) {
  await api.delete(`/products/${id}`);
}

export async function updateProductStatus(id: string, isActive: boolean) {
  await api.put(`/products/${id}`, { isActive });
}
