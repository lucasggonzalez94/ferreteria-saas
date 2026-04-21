"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePermissionGuard, usePermissions } from "@/lib/hooks/usePermissionGuard";
import Header from "@/components/ui/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { parseNumericInput } from "@/lib/numeric-input";
import { toast } from "sonner";

interface FinancialAccount {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  bankName?: string;
}

interface CreateCheckResponse {
  id: string;
}

export default function NewCheckPage() {
  usePermissionGuard("checks:manage");

  const { canManage } = usePermissions({
    canManage: "checks:manage",
  });

  const router = useRouter();
  const queryClient = useQueryClient();

  const [accountId, setAccountId] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [dueDate, setDueDate] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");

  const { data: accounts = [] } = useQuery<FinancialAccount[]>({
    queryKey: ["financial-accounts", "checks-new"],
    queryFn: async () => {
      const response = await api.get<FinancialAccount[]>("/financial-accounts", {
        params: { type: "BANK", isActive: true },
      });
      return response.data || [];
    },
    enabled: canManage,
  });

  const bankAccounts = useMemo(
    () => accounts.filter((account) => account.type === "BANK" && account.isActive),
    [accounts],
  );

  const createCheckMutation = useMutation({
    mutationFn: async () => {
      const parsedAmount = parseNumericInput(amount);
      if (!parsedAmount || parsedAmount <= 0) {
        throw new Error("Ingresa un monto valido");
      }

      const response = await api.post<CreateCheckResponse>("/checks", {
        accountId,
        checkNumber: checkNumber.trim(),
        amount: parsedAmount,
        currency,
        dueDate: new Date(dueDate).toISOString(),
        recipientName: recipientName.trim(),
        notes: notes.trim() || undefined,
      });

      return response.data as CreateCheckResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["checks"] });
      queryClient.invalidateQueries({ queryKey: ["checks-summary"] });
      queryClient.invalidateQueries({ queryKey: ["payables"] });
      queryClient.invalidateQueries({ queryKey: ["payables-summary"] });
      toast.success("Cheque emitido correctamente");
      router.push(`/dashboard/checks/${data.id}`);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "No se pudo emitir el cheque";
      toast.error(message);
    },
  });

  if (!canManage) {
    return null;
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
      <Header
        title="Emitir cheque"
        description="Carga operativa de cheque con validaciones y registro auditado."
        link="/dashboard/checks"
        linkLabel="Volver a cheques"
      />

      <Card>
        <CardContent className="pt-6">
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              createCheckMutation.mutate();
            }}
          >
            <div>
              <Label htmlFor="accountId">Cuenta bancaria *</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="accountId" className="mt-1">
                  <SelectValue placeholder="Selecciona cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                      {account.bankName ? ` - ${account.bankName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="checkNumber">Numero de cheque *</Label>
              <Input
                id="checkNumber"
                value={checkNumber}
                onChange={(event) => setCheckNumber(event.target.value)}
                placeholder="Ej: 00012345"
                maxLength={100}
                required
              />
            </div>

            <div>
              <Label htmlFor="amount">Monto *</Label>
              <Input
                id="amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                required
              />
            </div>

            <div>
              <Label htmlFor="currency">Moneda *</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dueDate">Vencimiento *</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="recipientName">Librador / Tercero *</Label>
              <Input
                id="recipientName"
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
                placeholder="Nombre del librador o tercero"
                maxLength={200}
                required
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="notes">Observaciones</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notas operativas del cheque"
                rows={3}
                maxLength={1000}
              />
            </div>

            <div className="md:col-span-2 flex gap-3 justify-end pt-2">
              <Link href="/dashboard/checks">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={
                  createCheckMutation.isPending ||
                  !accountId ||
                  !checkNumber.trim() ||
                  !amount.trim() ||
                  !dueDate ||
                  !recipientName.trim()
                }
              >
                {createCheckMutation.isPending ? "Guardando..." : "Emitir cheque"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
