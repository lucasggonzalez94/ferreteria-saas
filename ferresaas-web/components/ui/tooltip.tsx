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
        className={`pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-sm transition duration-150 ease-out group-hover:opacity-100 ${positionClasses}`}
      >
        {content}
      </span>
    </div>
  );
}
