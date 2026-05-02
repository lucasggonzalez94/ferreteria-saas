import { cn } from '@/lib/utils';

export interface StatusConfig {
  label: string;
  className: string;
}

interface StatusBadgeProps {
  status: string;
  config: Record<string, StatusConfig>;
  className?: string;
}

export function StatusBadge({
  status,
  config,
  className,
}: StatusBadgeProps) {
  const item =
    config[status] ?? {
      label: status,
      className: 'border border-slate-300 text-slate-700',
    };

  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        item.className,
        className
      )}
    >
      {item.label}
    </span>
  );
}

export const SALE_STATUS_CONFIG: Record<string, StatusConfig> = {
  DRAFT: { label: 'Borrador', className: 'bg-slate-100 text-slate-700' },
  CONFIRMED: { label: 'Confirmada', className: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelada', className: 'bg-red-100 text-red-800' },
};

export const INVOICE_STATUS_CONFIG: Record<string, StatusConfig> = {
  PENDING: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
  INVOICED: { label: 'Facturada', className: 'bg-blue-100 text-blue-800' },
  FAILED: { label: 'Factura fallida', className: 'bg-red-100 text-red-800' },
  CANCELLED: { label: 'Cancelada', className: 'bg-slate-100 text-slate-700' },
};

export const CHECK_STATUS_CONFIG: Record<string, StatusConfig> = {
  ISSUED: { label: 'Emitido', className: 'border border-slate-300 text-slate-700' },
  CLEARED: { label: 'Pagado', className: 'bg-emerald-100 text-emerald-800' },
  BOUNCED: { label: 'Rebotado', className: 'bg-red-100 text-red-800' },
  CANCELLED: { label: 'Cancelado', className: 'bg-slate-100 text-slate-700' },
};

export const PURCHASE_STATUS_CONFIG: Record<string, StatusConfig> = {
  PENDING: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
  RECEIVED: { label: 'Recibido', className: 'bg-emerald-100 text-emerald-800' },
  CANCELLED: { label: 'Cancelado', className: 'bg-slate-100 text-slate-700' },
};

export const APPROVAL_STATUS_CONFIG: Record<string, StatusConfig> = {
  PENDING: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Aprobado', className: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rechazado', className: 'bg-red-100 text-red-800' },
  EXPIRED: { label: 'Expirado', className: 'bg-slate-100 text-slate-700' },
};