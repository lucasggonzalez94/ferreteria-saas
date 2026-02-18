"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { parseNumericInput } from "@/lib/numeric-input";

interface FinancialAccount {
  id: string;
  type: string;
  name: string;
  balance: number;
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

  const transferMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<any>("/financial-accounts/transfers", {
        fromAccountId,
        toAccountId,
        amount: parseNumericInput(amount),
        description: description || undefined,
        notes: notes || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts-summary"] });
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

    const amountNum = parseNumericInput(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    if (fromAccount && amountNum > fromAccount.balance) {
      toast.error("Fondos insuficientes en la cuenta origen");
      return;
    }

    transferMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Transferir Dinero</DialogTitle>
          <DialogDescription>
            Transfiere dinero entre tus cuentas financieras
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fromAccount">Cuenta Origen *</Label>
            <Select value={fromAccountId || undefined} onValueChange={setFromAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona cuenta origen" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} - ${account.balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fromAccount && (
              <p className="text-xs text-muted-foreground mt-1">
                💡 Disponible: ${fromAccount.balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
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
                      {account.name} - ${account.balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="amount">Monto *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

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

          {fromAccount && toAccount && amount && parseFloat(amount) > 0 && (
            <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
              <p className="text-sm font-medium text-blue-900 mb-2">Resumen de Transferencia</p>
              <div className="space-y-1 text-sm text-blue-700">
                <div className="flex justify-between">
                  <span>Desde:</span>
                  <span className="font-medium">{fromAccount.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hacia:</span>
                  <span className="font-medium">{toAccount.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monto:</span>
                  <span className="font-medium">${parseFloat(amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-blue-300 my-2 pt-2">
                  <div className="flex justify-between">
                    <span>Nuevo balance origen:</span>
                    <span className="font-medium">${(fromAccount.balance - parseFloat(amount)).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Nuevo balance destino:</span>
                    <span className="font-medium">${(toAccount.balance + parseFloat(amount)).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={transferMutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={transferMutation.isPending}>
              {transferMutation.isPending ? "Transfiriendo..." : "Transferir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
