import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/lib/services/products";

type Params = {
  page: number;
  limit: number;
  search: string;
  categoryId: string;
  status: string;
  lowStockOnly: boolean;
  priceMin: string;
  priceMax: string;
  sort: string;
  enabled: boolean;
};

export function useProductsList<T>({
  page,
  limit,
  search,
  categoryId,
  status,
  lowStockOnly,
  priceMin,
  priceMax,
  sort,
  enabled,
}: Params) {
  return useQuery({
    queryKey: [
      "products",
      page,
      limit,
      search,
      categoryId,
      status,
      lowStockOnly,
      priceMin,
      priceMax,
      sort,
    ],
    queryFn: () =>
      listProducts<T>({
        page,
        limit,
        search,
        categoryId,
        status,
        lowStockOnly,
        priceMin,
        priceMax,
        sort,
      }),
    enabled,
  });
}
