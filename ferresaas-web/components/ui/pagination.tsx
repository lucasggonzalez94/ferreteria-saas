"use client";

import { Button } from "@/components/ui/button";
import { Label } from "./label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

interface PaginationProps {
  setPage: (page: number) => void;
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  total: number;
  limit: number;
  onLimitChange: (limit: number) => void;
  hasMore?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  setPage,
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  total,
  limit,
  onLimitChange,
  hasMore = false,
  onPageChange,
  className = "",
}: PaginationProps) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-muted-foreground">
        Mostrando {startIndex}-{endIndex} de {total}
      </p>
      {totalPages > 1 && <div className={`flex justify-center gap-2 ${className}`}>
        <Button
          variant="outline"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Anterior
        </Button>
        <span className="flex items-center px-4">
          Página {currentPage} de {totalPages}
        </span>
        <Button
          variant="outline"
          disabled={!hasMore && currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Siguiente
        </Button>
      </div>}
      <div className="flex items-center gap-2">
        <Label className="text-sm">Filas por pagina</Label>
        <Select
          value={String(limit)}
          onValueChange={(value) => {
            onLimitChange(Number(value));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}