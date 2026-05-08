"use client";

import { ReactNode, useState, useRef } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  placement?: "top" | "bottom";
  maxWidthClassName?: string;
}

export function Tooltip({
  content,
  children,
  placement = "bottom",
  maxWidthClassName = "max-w-[260px]",
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [hasClicked, setHasClicked] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!hasClicked) setVisible(true);
  };

  const handleMouseLeave = () => {
    setVisible(false);
  };

  const handleClick = () => {
    setHasClicked(true);
    setVisible(false);
    setTimeout(() => setHasClicked(false), 100);
  };

  const positionClasses =
    placement === "top"
      ? "bottom-full mb-2"
      : "top-full mt-2";

  return (
    <div
      ref={containerRef}
      className="relative inline-flex group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={() => !hasClicked && setVisible(true)}
      onBlur={() => setVisible(false)}
      onClick={handleClick}
    >
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 w-max min-w-[180px] -translate-x-1/2 rounded-xl border border-white/10 bg-[hsl(var(--surface-strong))] px-3 py-2 text-left text-[11px] leading-4 font-medium tracking-[0.01em] text-white whitespace-normal break-words opacity-0 shadow-[0_18px_34px_-18px_rgba(3,12,20,0.75)] transition duration-150 ease-out ${maxWidthClassName} ${visible ? "opacity-100" : ""} ${positionClasses}`}
      >
        {content}
      </span>
    </div>
  );
}
