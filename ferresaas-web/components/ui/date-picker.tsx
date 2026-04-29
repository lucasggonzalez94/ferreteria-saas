"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface DatePickerProps {
  value?: string
  onChange?: (date: string) => void
  placeholder?: string
  disabled?: boolean
  isDateDisabled?: (date: Date) => boolean
  className?: string
  label?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "DD/MM/YYYY",
  disabled = false,
  isDateDisabled,
  className,
  label,
}: DatePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>()
  const [inputValue, setInputValue] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)

  // Sincronizar estado interno con prop value
  React.useEffect(() => {
    if (value) {
      // Parsear YYYY-MM-DD a fecha local
      const [year, month, day] = value.split('-').map(Number)
      const newDate = new Date(year, month - 1, day)
      setDate(newDate)
      setInputValue(format(newDate, "dd/MM/yyyy"))
    } else {
      setDate(undefined)
      setInputValue("")
    }
  }, [value])

  const handleCalendarSelect = (newDate: Date | undefined) => {
    if (newDate) {
      setDate(newDate)
      setInputValue(format(newDate, "dd/MM/yyyy"))
      if (onChange) {
        onChange(format(newDate, "yyyy-MM-dd"))
      }
      setIsOpen(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)

    // Intentar parsear la fecha (formato DD/MM/YYYY)
    if (newValue.length === 10) {
      const parsedDate = parse(newValue, "dd/MM/yyyy", new Date())
      if (isValid(parsedDate) && (!isDateDisabled || !isDateDisabled(parsedDate))) {
        setDate(parsedDate)
        if (onChange) {
          onChange(format(parsedDate, "yyyy-MM-dd"))
        }
      }
    } else if (newValue === "") {
        setDate(undefined)
        if (onChange) onChange("")
    }
  }

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label className="text-sm font-medium block mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <Input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-10"
      />
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            disabled={disabled}
            aria-label="Abrir calendario"
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleCalendarSelect}
            disabled={isDateDisabled}
          />
        </PopoverContent>
      </Popover>
      </div>
    </div>
  )
}
