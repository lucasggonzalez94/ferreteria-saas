"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  eachDayOfInterval,
  addDays,
  setMonth,
  setYear,
  getYear,
  getMonth
} from "date-fns"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type CalendarProps = {
  mode?: "single"
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  className?: string
  disabled?: (date: Date) => boolean
}

export function Calendar({
  mode = "single",
  selected,
  onSelect,
  className,
  disabled,
  ...props
}: CalendarProps) {
  // Inicializar con la fecha seleccionada o la fecha actual
  const [currentMonth, setCurrentMonth] = React.useState(() => selected || new Date())

  // Sincronizar el mes visual si cambia la fecha seleccionada externamente
  React.useEffect(() => {
    if (selected) {
      setCurrentMonth(selected)
    }
  }, [selected])

  const onNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const onPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  const handleMonthChange = (monthIndex: string) => {
    const newDate = setMonth(currentMonth, parseInt(monthIndex))
    setCurrentMonth(newDate)
  }

  const handleYearChange = (year: string) => {
    const newDate = setYear(currentMonth, parseInt(year))
    setCurrentMonth(newDate)
  }

  // Cálculos para la cuadrícula del calendario
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  
  // Semana empieza en Domingo (0)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  })

  // Generar encabezados de días dinámicamente basados en el locale
  const weekDays = React.useMemo(() => {
    // Empezar en domingo
    const start = startOfWeek(new Date(), { weekStartsOn: 0 })
    return Array.from({ length: 7 }).map((_, i) => {
      const day = addDays(start, i)
      // Capitalizar primera letra: "lun" -> "Lun"
      const name = format(day, "eee", { locale: es })
      return name.charAt(0).toUpperCase() + name.slice(1)
    })
  }, [])

  // Generar lista de años (1900 - 2100)
  const years = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    const startYear = 1900
    const endYear = 2100
    return Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i)
  }, [])

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ]

  return (
    <div className={cn("p-3 w-[320px]", className)} {...props}>
      {/* Header: Mes y Navegación */}
      <div className="flex flex-col space-y-2 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Select
              value={getMonth(currentMonth).toString()}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month, index) => (
                  <SelectItem key={month} value={index.toString()} className="text-xs">
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={getYear(currentMonth).toString()}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="h-8 w-[80px] text-xs">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent className="h-[200px]">
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()} className="text-xs">
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
              onClick={onPrevMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
              onClick={onNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Grid: Días de la semana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-[0.8rem] font-medium text-muted-foreground text-center"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid: Días del mes */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, dayIdx) => {
          const isSelected = selected ? isSameDay(day, selected) : false
          const isToday = isSameDay(day, new Date())
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isDisabled = disabled ? disabled(day) : false

          return (
            <div key={day.toString()} className="relative p-0 text-center text-sm focus-within:relative focus-within:z-20">
              <Button
                variant="ghost"
                className={cn(
                  "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
                  !isCurrentMonth && "text-muted-foreground opacity-50",
                  isSelected &&
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  isToday && !isSelected && "bg-accent text-accent-foreground",
                  isDisabled && "opacity-50 pointer-events-none"
                )}
                disabled={isDisabled}
                onClick={() => onSelect?.(day)}
              >
                <time dateTime={format(day, "yyyy-MM-dd")}>
                  {format(day, "d")}
                </time>
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
