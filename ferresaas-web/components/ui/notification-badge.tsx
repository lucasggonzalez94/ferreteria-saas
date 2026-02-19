import { cn } from "@/lib/utils";

interface NotificationBadgeProps {
  count: number;
  className?: string;
  max?: number;
}

/**
 * Badge de notificación para mostrar conteos
 * Se oculta automáticamente cuando count es 0
 */
export function NotificationBadge({ 
  count, 
  className,
  max = 99 
}: NotificationBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <span
      className={cn(
        "absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white shadow-sm",
        className
      )}
    >
      {displayCount}
    </span>
  );
}
