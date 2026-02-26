"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormModal } from "@/components/ui/form-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowRight, RefreshCw } from "lucide-react";
import { parseNumericInput } from "@/lib/numeric-input";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ConversionData {
  amountUsd?: number;
  amountArs?: number;
  rate: number;
  source: string;
  dollarType: string;
}

interface FinancialAccount {
  id: string;
  type: string;
  name: string;
  balance: number;
  currency: string;
}

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: FinancialAccount[];
}

export function TransferModal({ open, onOpenChange, accounts }: TransferModalProps) {
  const queryClient = useQueryClient();
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const fromAccount = accounts.find((acc) => acc.id === fromAccountId);
  const toAccount = accounts.find((acc) => acc.id === toAccountId);

  // Valores numéricos parseados para evitar operaciones con strings
  const transferAmount = parseNumericInput(amount);
  const fromBalance = parseNumericInput(fromAccount?.balance ?? 0);
  const toBalance = parseNumericInput(toAccount?.balance ?? 0);

  // Detectar si necesita conversión
  const needsConversion = fromAccount && toAccount && fromAccount.currency !== toAccount.currency;

  // Obtener tipo de cambio si necesita conversión
  const { data: conversionData, isLoading: isLoadingConversion } = useQuery<ConversionData>({
    queryKey: ['exchange-rate-conversion', fromAccount?.currency, toAccount?.currency, amount],
    queryFn: async (): Promise<ConversionData> => {
      if (!needsConversion || !amount || transferAmount <= 0) {
        throw new Error('Invalid conversion request');
      }
      
      const response = await api.post('/exchange-rate/convert', {
        amount: transferAmount,
        from: fromAccount!.currency,
        to: toAccount!.currency,
      });
      return response.data as ConversionData;
    },
    enabled: !!needsConversion && !!amount && transferAmount > 0,
    staleTime: 60 * 1000, // 1 minuto
  });

  const convertedAmount = conversionData?.amountUsd ?? conversionData?.amountArs ?? transferAmount;
  const receivedAmount = parseNumericInput(convertedAmount);

  const transferMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<any>("/financial-accounts/transfers", {
        fromAccountId,
        toAccountId,
        amount: transferAmount,
        description: description || undefined,
        notes: notes || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts-summary"] });
      queryClient.invalidateQueries({ queryKey: ["financial-movements"] });
      toast.success("Transferencia realizada exitosamente");
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || "Error al realizar transferencia");
    },
  });

  const resetForm = () => {
    setFromAccountId("");
    setToAccountId("");
    setAmount("");
    setDescription("");
    setNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromAccountId || !toAccountId) {
      toast.error("Selecciona las cuentas de origen y destino");
      return;
    }

    if (fromAccountId === toAccountId) {
      toast.error("No puedes transferir a la misma cuenta");
      return;
    }

    if (!transferAmount || transferAmount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    if (fromAccount && transferAmount > fromBalance) {
      toast.error("Fondos insuficientes en la cuenta origen");
      return;
    }

    transferMutation.mutate();
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Transferencia entre Cuentas"
      description="Transfiere dinero entre tus cuentas financieras"
      onSubmit={handleSubmit}
      isLoading={transferMutation.isPending}
      submitText="Realizar Transferencia"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="fromAccount">Cuenta Origen *</Label>
          <Select value={fromAccountId || undefined} onValueChange={setFromAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona cuenta origen" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} ({account.currency}) - ${account.balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fromAccount && (
            <p className="text-xs text-muted-foreground mt-1">
              💡 Disponible: ${fromAccount.balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })} {fromAccount.currency}
            </p>
          )}
        </div>

        <div className="flex justify-center">
          <ArrowRight className="h-6 w-6 text-muted-foreground" />
        </div>

        <div>
          <Label htmlFor="toAccount">Cuenta Destino *</Label>
          <Select value={toAccountId || undefined} onValueChange={setToAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona cuenta destino" />
            </SelectTrigger>
            <SelectContent>
              {accounts
                .filter((acc) => acc.id !== fromAccountId)
                .map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.currency}) - ${account.balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="amount">Monto ({fromAccount?.currency || 'ARS'}) *</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            required
          />
          {needsConversion && isLoadingConversion && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Calculando conversión...
            </p>
          )}
        </div>

        {needsConversion && conversionData && (
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertDescription>
              <div className="space-y-1 text-sm">
                <p className="font-medium text-yellow-900">💱 Conversión de Moneda</p>
                <div className="flex justify-between text-yellow-700">
                  <span>Monto a transferir:</span>
                  <span className="font-medium">{transferAmount.toFixed(2)} {fromAccount?.currency}</span>
                </div>
                <div className="flex justify-between text-yellow-700">
                  <span>Monto a recibir:</span>
                  <span className="font-medium">{receivedAmount.toFixed(2)} {toAccount?.currency}</span>
                </div>
                <div className="flex justify-between text-xs text-yellow-600 mt-2 pt-2 border-t border-yellow-300">
                  <span>Tipo de cambio:</span>
                  <span>1 {fromAccount?.currency} = {parseNumericInput(conversionData.rate).toFixed(4)} {toAccount?.currency}</span>
                </div>
                <div className="flex justify-between text-xs text-yellow-600">
                  <span>Fuente:</span>
                  <span>{conversionData.source === 'argentinadatos' ? 'ArgentinaDatos' : conversionData.source}</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div>
          <Label htmlFor="description">Descripción</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Transferencia para caja"
          />
        </div>

        <div>
          <Label htmlFor="notes">Notas</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas adicionales (opcional)"
            rows={2}
          />
        </div>

        {fromAccount && toAccount && amount && transferAmount > 0 && (
          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Resumen de Transferencia</p>
            <div className="space-y-1 text-sm text-blue-700 dark:text-blue-200">
              <div className="flex justify-between">
                <span>Desde:</span>
                <span className="font-medium">{fromAccount.name} ({fromAccount.currency})</span>
              </div>
              <div className="flex justify-between">
                <span>Hacia:</span>
                <span className="font-medium">{toAccount.name} ({toAccount.currency})</span>
              </div>
              <div className="flex justify-between">
                <span>Monto a transferir:</span>
                <span className="font-medium">{transferAmount.toFixed(2)} {fromAccount.currency}</span>
              </div>
              {needsConversion && (
                <div className="flex justify-between">
                  <span>Monto a recibir:</span>
                  <span className="font-medium">{receivedAmount.toFixed(2)} {toAccount.currency}</span>
                </div>
              )}
              <div className="border-t border-blue-300 dark:border-blue-800 my-2 pt-2">
                <div className="flex justify-between">
                  <span>Nuevo balance origen:</span>
                  <span className="font-medium">{(fromBalance - transferAmount).toFixed(2)} {fromAccount.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span>Nuevo balance destino:</span>
                  <span className="font-medium">{(toBalance + receivedAmount).toFixed(2)} {toAccount.currency}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </FormModal>
  );
}
