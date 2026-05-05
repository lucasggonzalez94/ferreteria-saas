import * as React from "react"
import { Label } from "@/components/ui/label"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  htmlFor?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, htmlFor, id, ...props }, ref) => {
    const textareaId = id || htmlFor

    if (label) {
      return (
        <div className="space-y-2">
          <Label htmlFor={textareaId}>{label}</Label>
          <textarea
            id={textareaId}
            className={cn(
              "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
      )
    }

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        id={id}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }