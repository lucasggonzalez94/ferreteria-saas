"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { subDays, startOfMonth, startOfYear, endOfMonth, endOfYear, subMonths, format } from "date-fns";

type DatePreset = "7d" | "30d" | "thisMonth" | "lastMonth" | "thisYear" | "lastYear" | "custom";

interface ReportFiltersProps {
  onFilterChange: (filters: { startDate: string; endDate: string }) => void;
  defaultPreset?: DatePreset;
}

function getDateRange(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case "7d":
      return { start: subDays(now, 7), end: endOfToday };
    case "30d":
      return { start: subDays(now, 30), end: endOfToday };
    case "thisMonth":
      return { start: startOfMonth(now), end: endOfToday };
    case "lastMonth": {
      const lastMonth = subMonths(now, 1);
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
      };
    }
    case "thisYear":
      return { start: startOfYear(now), end: endOfToday };
    case "lastYear": {
      const lastYear = new Date(now.getFullYear() - 1, 0, 1);
      return {
        start: startOfYear(lastYear),
        end: endOfYear(lastYear),
      };
    }
    default:
      return { start: subDays(now, 30), end: endOfToday };
  }
}

export function ReportFilters({ onFilterChange, defaultPreset = "30d" }: ReportFiltersProps) {
  const [preset, setPreset] = useState<DatePreset>(defaultPreset);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    if (preset !== "custom") {
      const range = getDateRange(preset);
      onFilterChange({
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      });
    }
  }, [preset, onFilterChange]);

  useEffect(() => {
    if (preset === "custom" && customStart && customEnd) {
      const startDate = new Date(customStart);
      const endDate = new Date(customEnd + "T23:59:59.999");
      
      if (startDate <= endDate) {
        onFilterChange({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });
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
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button
                key={p.value}
                variant={preset === p.value ? "default" : "outline"}
                size="sm"
                onClick={() => setPreset(p.value)}
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
                      const max = customEnd || format(new Date(), "yyyy-MM-dd");
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
                      const max = format(new Date(), "yyyy-MM-dd");
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
