// Mapeo de estados de compra a español
export const purchaseStatusMap: Record<string, { label: string; color: string }> = {
  PENDING: {
    label: "Pendiente",
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  PARTIAL: {
    label: "Parcialmente Pagada",
    color: "bg-blue-100 text-blue-800 border-blue-300",
  },
  PAID: {
    label: "Pagada",
    color: "bg-green-100 text-green-800 border-green-300",
  },
  CONFIRMED: {
    label: "Confirmada",
    color: "bg-gray-100 text-gray-800 border-gray-300",
  },
  CANCELLED: {
    label: "Cancelada",
    color: "bg-red-100 text-red-800 border-red-300",
  },
};

export function getPurchaseStatusLabel(status: string): string {
  return purchaseStatusMap[status]?.label || status;
}

export function getPurchaseStatusColor(status: string): string {
  return purchaseStatusMap[status]?.color || "bg-gray-100 text-gray-800 border-gray-300";
}
