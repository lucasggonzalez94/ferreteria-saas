"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { TrendingUp, TrendingDown } from "lucide-react";
import { parseNumericInput } from "@/lib/numeric-input";

interface FinancialAccount {
  id: string;
  type: string;
  name: string;
  balance: number;
}

interface MovementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: FinancialAccount[];
}

export function MovementModal({ open, onOpenChange, accounts }: MovementModalProps) {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const selectedAccount = accounts.find((acc) => acc.id === accountId);
  const amountValue = parseNumericInput(amount);
  const balanceValue = selectedAccount ? Number(selectedAccount.balance) || 0 : 0;

  const movementMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<any>("/financial-accounts/movements", {
        accountId,
        type,
        amount: parseNumericInput(amount),
        description,
        notes: notes || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts-summary"] });
      toast.success("Movimiento registrado exitosamente");
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || "Error al registrar movimiento");
    },
  });

  const resetForm = () => {
    setAccountId("");
    setType("INCOME");
    setAmount("");
    setDescription("");
    setNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!accountId) {
      toast.error("Selecciona una cuenta");
      return;
    }

    const amountNum = parseNumericInput(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    if (!description.trim()) {
      toast.error("La descripción es requerida");
      return;
    }

    if (type === "EXPENSE" && selectedAccount && amountNum > selectedAccount.balance) {
      toast.error("Fondos insuficientes en la cuenta");
      return;
    }

    movementMutation.mutate();
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar Movimiento Manual"
      description="Registra un ingreso o egreso manual en una cuenta"
      onSubmit={handleSubmit}
      isLoading={movementMutation.isPending}
      submitText="Registrar Movimiento"
      maxWidth="lg"
    >
      <div className="space-y-4">
          <div>
            <Label htmlFor="account">Cuenta *</Label>
            <Select value={accountId || undefined} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} - ${account.balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccount && (
              <p className="text-xs text-muted-foreground mt-1">
                💡 Balance actual: ${selectedAccount.balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          <div>
            <Label>Tipo de Movimiento *</Label>
            <RadioGroup value={type} onValueChange={(value) => setType(value as "INCOME" | "EXPENSE")}>
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent">
                <RadioGroupItem value="INCOME" id="income" />
                <Label htmlFor="income" className="flex items-center gap-2 cursor-pointer flex-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="font-medium">Ingreso</p>
                    <p className="text-xs text-muted-foreground">Agregar dinero a la cuenta</p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent">
                <RadioGroupItem value="EXPENSE" id="expense" />
                <Label htmlFor="expense" className="flex items-center gap-2 cursor-pointer flex-1">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="font-medium">Egreso</p>
                    <p className="text-xs text-muted-foreground">Retirar dinero de la cuenta</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="amount">Monto *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción *</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Ajuste de balance, Corrección de error"
              required
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

          {selectedAccount && amount && amountValue > 0 && (
            <div className={`p-3 rounded-md border ${type === "INCOME" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <p className={`text-sm font-medium mb-2 ${type === "INCOME" ? "text-green-900" : "text-red-900"}`}>
                Resumen del Movimiento
              </p>
              <div className={`space-y-1 text-sm ${type === "INCOME" ? "text-green-700" : "text-red-700"}`}>
                <div className="flex justify-between">
                  <span>Cuenta:</span>
                  <span className="font-medium">{selectedAccount.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tipo:</span>
                  <span className="font-medium">{type === "INCOME" ? "Ingreso" : "Egreso"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monto:</span>
                  <span className="font-medium">{type === "INCOME" ? "+" : "-"}${amountValue.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className={`border-t ${type === "INCOME" ? "border-green-300" : "border-red-300"} my-2 pt-2`}>
                  <div className="flex justify-between">
                    <span>Nuevo balance:</span>
                    <span className="font-medium">
                      ${(type === "INCOME"
                        ? balanceValue + amountValue
                        : balanceValue - amountValue
                      ).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>
    </FormModal>
  );
}
