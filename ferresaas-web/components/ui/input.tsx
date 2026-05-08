"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Tooltip } from "@/components/ui/tooltip"
import { CircleHelp } from "lucide-react"

import { cn } from "@/lib/utils"

export interface FormFieldProps {
  label?: string
  htmlFor?: string
  className?: string
 children: React.ReactNode
}

export function FormField({ label, htmlFor, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
        </Label>
      )}
      {children}
    </div>
  )
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  htmlFor?: string
  labelTooltip?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onWheel, onWheelCapture, label, htmlFor, id, labelTooltip, ...props }, ref) => {
    const handleWheel = React.useCallback<React.WheelEventHandler<HTMLInputElement>>(
      (event) => {
        if (type === "number") {
          event.preventDefault()
          event.currentTarget.blur()
          event.stopPropagation()
        }

        onWheel?.(event)
        onWheelCapture?.(event)
      },
      [onWheel, onWheelCapture, type],
    )

    const inputId = id || htmlFor

    if (label) {
      return (
        <div className="space-y-2">
          <div className="flex h-5 items-center gap-1.5">
            <Label htmlFor={inputId}>
              {label}
            </Label>
            {labelTooltip && (
              <Tooltip content={labelTooltip} placement="top">
                <button
                  type="button"
                  aria-label={`Informacion sobre ${label}`}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CircleHelp className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            )}
          </div>
          <input
            id={inputId}
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
        </div>
      )
    }

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
        id={id}
        {...props}
      />
    )
  },
)
Input.displayName = "Input"

export { Input }
