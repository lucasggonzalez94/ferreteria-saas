"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"

export interface InputPasswordProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  type?: "password" | "text"
  error?: string
}

export function InputPassword({
  id,
  label,
  placeholder,
  value,
  onChange,
  disabled,
  type = "password",
  error = '',
  ...props
}: InputPasswordProps) {
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <>
      <div className="relative w-full">
        <Input
          id={id}
          type={showPassword ? "text" : type}
          label={label}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={props["aria-invalid"]}
          aria-describedby={props["aria-describedby"]}
          className="w-full"
          {...props}
        />
        <button
          type="button"
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={showPassword}
          onClick={() => setShowPassword((current) => !current)}
          disabled={disabled}
          className="absolute right-2 bottom-0 inline-flex h-11 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium leading-5 text-destructive">
          {error}
        </p>
      )}
    </>
  )
}