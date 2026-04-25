export type InvoiceStatus = "PENDING" | "ISSUED" | "FAILED";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  PENDING: "Pendiente",
  ISSUED: "Emitido",
  FAILED: "Fallido",
};

export const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ISSUED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
};