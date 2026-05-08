import { api } from "@/lib/api";
import { normalizePaginatedResponse } from "@/lib/pagination";

type ListSuppliersParams = {
  page: number;
  limit: number;
  search?: string;
};

export async function listSuppliers<T>({ page, limit, search }: ListSuppliersParams) {
  const response = await api.get<T[]>("/suppliers", {
    params: {
      search: search || undefined,
      page,
      limit,
    },
  });

  return normalizePaginatedResponse<T>(response, { page, limit });
}

export async function createSupplier<TPayload extends object>(payload: TPayload) {
  const response = await api.post("/suppliers", payload);
  return response.data;
}

export async function updateSupplier<TPayload extends object>(id: string, payload: TPayload) {
  const response = await api.put(`/suppliers/${id}`, payload);
  return response.data;
}

export async function deleteSupplier(id: string) {
  await api.delete(`/suppliers/${id}`);
}

export async function updateSupplierStatus(id: string, isActive: boolean) {
  const response = await api.patch(`/suppliers/${id}/status`, { isActive });
  return response.data;
}
