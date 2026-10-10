"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
  const errorId = `${id}-error`

  return (
    <div className="space-y-2">
      <div className="flex h-5 items-center">
        <Label htmlFor={id}>{label}</Label>
      </div>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          error={error}
          className="w-full pr-12"
          {...props}
        />
        <button
          type="button"
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={showPassword}
          onClick={() => setShowPassword((current) => !current)}
          disabled={disabled}
          className="absolute right-2 bottom-0 inline-flex h-11 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <p id={errorId} className="text-xs font-medium leading-5 text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
