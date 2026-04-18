import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onWheel, onWheelCapture, ...props }, ref) => {
    const handleWheel = React.useCallback<React.WheelEventHandler<HTMLInputElement>>(
      (event) => {
        if (type === "number") {
          event.preventDefault();
          event.currentTarget.blur();
          event.stopPropagation();
        }

        onWheel?.(event);
        onWheelCapture?.(event);
      },
      [onWheel, onWheelCapture, type],
    );

    return (
        <input
          type={type}
          className={cn(
            "flex h-11 w-full rounded-xl border border-input/80 bg-background/80 px-3.5 py-2.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-offset-0 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        onWheel={handleWheel}
        onWheelCapture={handleWheel}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
