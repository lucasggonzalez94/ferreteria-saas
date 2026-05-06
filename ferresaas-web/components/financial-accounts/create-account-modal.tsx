"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
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
import { Checkbox } from "@/components/ui/checkbox";
import { parseNumericInput } from "@/lib/numeric-input";

interface CreateAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCurrency?: string;
}

export function CreateAccountModal({ open, onOpenChange, initialCurrency }: CreateAccountModalProps) {
  const queryClient = useQueryClient();
  const [type, setType] = useState("CASH");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState(initialCurrency || "ARS");
  const [initialBalance, setInitialBalance] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [walletProvider, setWalletProvider] = useState("");

  // Actualizar currency cuando cambia initialCurrency o se abre el modal
  useEffect(() => {
    if (open && initialCurrency) {
      setCurrency(initialCurrency);
    }
  }, [open, initialCurrency]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<any>("/financial-accounts", {
        type,
        name,
        description: description || undefined,
        currency,
        initialBalance: initialBalance ? parseNumericInput(initialBalance) : 0,
        isDefault,
        bankName: type === "BANK" ? bankName : undefined,
        accountNumber: type === "BANK" ? accountNumber : undefined,
        walletProvider: type === "WALLET" ? walletProvider : undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register", "suggested-opening"] });
      toast.success("Cuenta creada exitosamente");
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || "Error al crear cuenta");
    },
  });

  const resetForm = () => {
    setType("CASH");
    setName("");
    setDescription("");
    setCurrency("ARS");
    setInitialBalance("");
    setIsDefault(false);
    setBankName("");
    setAccountNumber("");
    setWalletProvider("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    createMutation.mutate();
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Crear Nueva Cuenta Financiera"
      description="Agrega una nueva cuenta para gestionar tus finanzas"
      onSubmit={handleSubmit}
      isLoading={createMutation.isPending}
      submitText="Crear Cuenta"
      maxWidth="2xl"
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger label="Tipo de Cuenta *">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">💵 Efectivo</SelectItem>
                <SelectItem value="BANK">🏦 Cuenta Bancaria</SelectItem>
                <SelectItem value="WALLET">💳 Billetera Virtual</SelectItem>
                <SelectItem value="CREDIT_CARD">💳 Tarjeta de Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Input
              id="name"
              label="Nombre *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Caja Principal, Banco Nación, MercadoPago"
              required
            />
          </div>

          <div>
            <Textarea
              id="description"
              label="Descripción"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional de la cuenta"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger label="Moneda">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS (Pesos Argentinos)</SelectItem>
                  <SelectItem value="USD">USD (Dólares)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Input
                id="initialBalance"
                label="Balance Inicial"
                type="number"
                step="0.01"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isDefault"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked as boolean)}
            />
            <label htmlFor="isDefault" className="cursor-pointer text-sm font-medium leading-none">
              Marcar como cuenta por defecto para este tipo
            </label>
          </div>

          {type === "BANK" && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium">Información Bancaria</h3>
              <div>
                <Input
                  id="bankName"
                  label="Nombre del Banco"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Ej: Banco Nación, Banco Galicia"
                />
              </div>
              <div>
                <Input
                  id="accountNumber"
                  label="Número de Cuenta"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Ej: 1234567890"
                />
              </div>
            </div>
          )}

          {type === "WALLET" && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium">Información de Billetera Virtual</h3>
              <div>
                <Select value={walletProvider || undefined} onValueChange={setWalletProvider}>
                  <SelectTrigger label="Proveedor">
                    <SelectValue placeholder="Selecciona un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mercadopago">MercadoPago</SelectItem>
                    <SelectItem value="uala">Ualá</SelectItem>
                    <SelectItem value="naranja_x">Naranja X</SelectItem>
                    <SelectItem value="personal_pay">Personal Pay</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
      </div>
    </FormModal>
  );
}
