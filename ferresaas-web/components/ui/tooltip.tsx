import { ReactNode } from "react";

interface TooltipProps {
  content: string;
  children: ReactNode;
  placement?: "top" | "bottom";
}

export function Tooltip({ content, children, placement = "bottom" }: TooltipProps) {
  const positionClasses =
    placement === "top"
      ? "bottom-full mb-2"
      : "top-full mt-2";

  return (
    <div className="relative inline-flex group">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[hsl(var(--surface-strong))] px-3 py-1.5 text-[11px] font-medium tracking-[0.01em] text-white opacity-0 shadow-[0_18px_34px_-18px_rgba(3,12,20,0.75)] transition duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100 ${positionClasses}`}
      >
        {content}
      </span>
    </div>
  );
}
