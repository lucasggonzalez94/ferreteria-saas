"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { 
  getDateRangePreset, 
  rangeForLocalDays, 
  todayLocal 
} from "@/lib/timezone";

type DatePreset = "7d" | "30d" | "thisMonth" | "lastMonth" | "thisYear" | "lastYear" | "custom";

interface ReportFiltersProps {
  onFilterChange: (filters: { startDate: string; endDate: string }) => void;
  defaultPreset?: DatePreset;
}

export function ReportFilters({ onFilterChange, defaultPreset = "30d" }: ReportFiltersProps) {
  const [preset, setPreset] = useState<DatePreset>(defaultPreset);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    if (preset !== "custom") {
      // Obtener rango de fechas locales usando timezone del negocio
      const localRange = getDateRangePreset(preset as "7d" | "30d" | "thisMonth" | "lastMonth" | "thisYear" | "lastYear");
      // Convertir a UTC para enviar al backend
      const utcRange = rangeForLocalDays(localRange.start, localRange.end);
      onFilterChange(utcRange);
    }
  }, [preset, onFilterChange]);

  useEffect(() => {
    if (preset === "custom" && customStart && customEnd) {
      if (customStart <= customEnd) {
        // Convertir fechas locales a UTC para enviar al backend
        const utcRange = rangeForLocalDays(customStart, customEnd);
        onFilterChange(utcRange);
      }
    }
  }, [preset, customStart, customEnd, onFilterChange]);

  const presets: Array<{ value: DatePreset; label: string }> = [
    { value: "7d", label: "Últimos 7 días" },
    { value: "30d", label: "Últimos 30 días" },
    { value: "thisMonth", label: "Este mes" },
    { value: "lastMonth", label: "Mes anterior" },
    { value: "thisYear", label: "Este año" },
    { value: "lastYear", label: "Año anterior" },
    { value: "custom", label: "Personalizado" },
  ];

  return (
    <Card className="mb-6 overflow-hidden">
      <CardContent>
        <div className="space-y-4">
          <div>
            <span className="app-kicker">
              <span className="app-brand-dot" aria-hidden="true" />
              Periodo de análisis
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button
                key={p.value}
                variant={preset === p.value ? "default" : "outline"}
                size="sm"
                onClick={() => setPreset(p.value)}
                className={preset === p.value ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent)/0.92)]" : undefined}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Desde:
                </label>
                <div className="w-48">
                  <DatePicker
                    value={customStart}
                    onChange={(value) => setCustomStart(value)}
                    placeholder="Selecciona inicio"
                    isDateDisabled={(date) => {
                      const max = customEnd || todayLocal();
                      return format(date, "yyyy-MM-dd") > max;
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Hasta:
                </label>
                <div className="w-48">
                  <DatePicker
                    value={customEnd}
                    onChange={(value) => setCustomEnd(value)}
                    placeholder="Selecciona fin"
                    isDateDisabled={(date) => {
                      const max = todayLocal();
                      const min = customStart || undefined;
                      const current = format(date, "yyyy-MM-dd");
                      if (min && current < min) return true;
                      if (current > max) return true;
                      return false;
                    }}
                  />
                </div>
              </div>
              {customStart && customEnd && new Date(customStart) > new Date(customEnd) && (
                <p className="text-sm text-red-600">
                  La fecha de inicio debe ser anterior a la fecha de fin
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
