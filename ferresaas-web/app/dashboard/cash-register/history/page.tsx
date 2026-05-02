"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Eye } from "lucide-react";
import Header from "@/components/ui/header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CashRegisterSession {
  id: string;
  status: string;
  openedAt: string;
  closedAt?: string;
  openingAmount: number;
  closingAmount?: number;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
  _count: {
    sales: number;
    movements: number;
  };
}

interface SessionsResponse {
  data: CashRegisterSession[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function CashRegisterHistoryPage() {
  const [selectedSession, setSelectedSession] = useState<CashRegisterSession | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data: sessionsData, isLoading } = useQuery<SessionsResponse>({
    queryKey: ["cash-register", "history", page, limit],
    queryFn: async () => {
      const response = await api.get<SessionsResponse>("/cash-register/history", {
        params: { page, limit },
      });
      return response.data as SessionsResponse;
    },
  });

  const sessions = sessionsData?.data || [];
  const meta = sessionsData?.meta || {
    page: 1,
    limit: limit,
    total: 0,
    totalPages: 1,
    hasMore: false,
  };

  const startIndex = sessions.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const endIndex = Math.min(meta.page * meta.limit, meta.total);

  const { data: sessionSummary } = useQuery({
    queryKey: ["cash-register", selectedSession?.id, "summary"],
    queryFn: async () => {
      if (!selectedSession?.id) return null;
      const response = await api.get<any>(
        `/cash-register/${selectedSession.id}/summary`
      );
      return response.data;
    },
    enabled: !!selectedSession?.id && showDetails,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  if (isLoading && !sessionsData) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto text-center">
          <LoadingSpinner text="Cargando historial de caja..." />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <Header title="Historial de Caja" />

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No hay sesiones de caja</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Listado</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cajero</TableHead>
                    <TableHead>Abierta</TableHead>
                    <TableHead>Monto Inicial</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session: CashRegisterSession) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">
                        {session.user.firstName} {session.user.lastName}
                      </TableCell>
                      <TableCell>{formatDate(session.openedAt)}</TableCell>
                      <TableCell>{formatCurrency(Number(session.openingAmount))}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          session.status === "OPEN"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {session.status === "OPEN" ? "Abierta" : "Cerrada"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog open={showDetails && selectedSession?.id === session.id} onOpenChange={setShowDetails}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedSession(session)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Detalles
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Detalles de Sesión de Caja</DialogTitle>
                              <DialogDescription>
                                {formatDate(session.openedAt)}
                              </DialogDescription>
                            </DialogHeader>

                            {sessionSummary && (
                              <div className="space-y-6">
                                <div>
                                  <h3 className="font-semibold mb-3">
                                    Información General
                                  </h3>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">
                                        Monto Inicial
                                      </p>
                                      <p className="font-semibold">
                                        {formatCurrency(Number(session.openingAmount))}
                                      </p>
                                    </div>
                                    {session.closingAmount && (
                                      <div>
                                        <p className="text-muted-foreground">
                                          Monto Final
                                        </p>
                                        <p className="font-semibold">
                                          {formatCurrency(Number(session.closingAmount))}
                                        </p>
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-muted-foreground">
                                        Ventas
                                      </p>
                                      <p className="font-semibold">
                                        {session._count.sales}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">
                                        Movimientos
                                      </p>
                                      <p className="font-semibold">
                                        {session._count.movements}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {sessionSummary.summary && (
                                  <div>
                                    <h3 className="font-semibold mb-3">
                                      Resumen por Método de Pago
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      {Object.entries(sessionSummary.summary).map(
                                        ([method, data]: [string, any]) => (
                                          <div key={method}>
                                            <p className="text-muted-foreground">
                                              {method}
                                            </p>
                                            <p className="font-semibold">
                                              {formatCurrency(Number(data.total || 0))}
                                            </p>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Pagination
          setPage={setPage}
          currentPage={page}
          totalPages={meta.totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          total={meta.total}
          limit={limit}
          onLimitChange={setLimit}
          hasMore={meta.hasMore}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}