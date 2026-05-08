import { api } from "@/lib/api";
import { normalizePaginatedResponse } from "@/lib/pagination";

type ListCustomersParams = {
  page: number;
  limit: number;
  search?: string;
  sort?: string;
};

export async function listCustomers<T>({ page, limit, search, sort }: ListCustomersParams) {
  const response = await api.get<T[]>("/customers", {
    params: {
      page,
      limit,
      q: search || undefined,
      sort: sort || undefined,
    },
  });

  return normalizePaginatedResponse<T>(response, { page, limit });
}

export async function createCustomer(payload: Record<string, unknown>) {
  const response = await api.post("/customers", payload);
  return response.data;
}

export async function deleteCustomer(customerId: string) {
  await api.delete(`/customers/${customerId}`);
}
