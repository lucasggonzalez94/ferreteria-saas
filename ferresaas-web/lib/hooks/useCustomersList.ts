import { useQuery } from "@tanstack/react-query";
import { listCustomers } from "@/lib/services/customers";

type Params = {
  page: number;
  limit: number;
  search: string;
  sort: string;
  enabled: boolean;
};

export function useCustomersList<T>({ page, limit, search, sort, enabled }: Params) {
  return useQuery({
    queryKey: ["customers", page, limit, search, sort],
    queryFn: () => listCustomers<T>({ page, limit, search, sort }),
    enabled,
  });
}
