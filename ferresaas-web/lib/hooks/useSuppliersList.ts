import { useQuery } from "@tanstack/react-query";
import { listSuppliers } from "@/lib/services/suppliers";

type Params = {
  page: number;
  limit: number;
  search: string;
  enabled: boolean;
};

export function useSuppliersList<T>({ page, limit, search, enabled }: Params) {
  return useQuery({
    queryKey: ["suppliers", search, page, limit],
    queryFn: () => listSuppliers<T>({ page, limit, search }),
    enabled,
  });
}
