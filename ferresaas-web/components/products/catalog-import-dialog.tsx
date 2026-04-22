"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, CircleCheck, Download, HelpCircle, Upload, Info } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ImportIssue {
  row: number;
  field: string;
  code: string;
  message: string;
  value?: string;
  severity: "error" | "warning";
  blocking: boolean;
}

interface ImportRow {
  row: number;
  raw: Record<string, string>;
  issues: ImportIssue[];
  importable: boolean;
}

interface ImportSummary {
  totalRows: number;
  validRows: number;
  rowsWithWarnings: number;
  rowsWithErrors: number;
  importableRows: number;
  blockingRows: number;
}

interface PreviewResponse {
  summary: ImportSummary;
  rows: ImportRow[];
}

interface ExecuteResponse {
  summary: ImportSummary;
  createdProducts: number;
  createdCategories: number;
  createdBrands: number;
  rejectedRows: Array<{
    row: number;
    reasons: string[];
  }>;
}

const CSV_TEMPLATE = `name,barcode,description,category,brand,unit,cost,price,taxRate,minStock,initialStock,isFractional,pricingMode,targetMargin,targetMarkup,priceLocked,roundingStep,costMethod
"Taladro Inalambrico 18V",7791234567890,"Taladro percutor con bateria",Herramientas Electricas,Bosch,u,85000,119900,21,2,4,false,margin,35,,false,10,avg_weighted
"Disco de corte 4.5","","Disco para amoladora",Accesorios,Stanley,u,2800,4200,21,10,20,false,fixed,,,false,10,avg_weighted`;

interface CatalogImportDialogProps {
  triggerClassName?: string;
  triggerIcon?: React.ReactNode;
  onImported: () => void;
}

export function CatalogImportDialog({
  triggerClassName,
  triggerIcon,
  onImported,
}: CatalogImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rowsWithIssues = useMemo(() => {
    if (!preview) {
      return [] as ImportRow[];
    }
    return preview.rows.filter((row) => row.issues.length > 0);
  }, [preview]);

  const previewMutation = useMutation({
    mutationFn: async (selectedFile: File) => {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await api.upload<PreviewResponse>("/products/import/preview", formData);
      return response.data;
    },
    onSuccess: (data) => {
      if (!data) {
        toast.error("No se pudo analizar el archivo");
        return;
      }
      setPreview(data);
      if (data.summary.importableRows === 0) {
        toast.error("Ninguna fila se puede importar. Revisá los errores en la tabla.");
      } else if (data.summary.rowsWithErrors > 0 || data.summary.rowsWithWarnings > 0) {
        toast.success(`${data.summary.importableRows} productos listos para importar.`);
      } else {
        toast.success(`Perfecto: ${data.summary.importableRows} productos listos para importar.`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al analizar el archivo");
      setPreview(null);
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (selectedFile: File) => {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await api.upload<ExecuteResponse>("/products/import/execute", formData);
      return response.data;
    },
    onSuccess: (result) => {
      if (!result) {
        toast.error("Error en la importación");
        return;
      }
      
      const productText = result.createdProducts === 1 ? "1 producto" : `${result.createdProducts} productos`;
      const categoryText = result.createdCategories > 0 
        ? (result.createdCategories === 1 ? ", 1 categoría nueva" : `, ${result.createdCategories} categorías nuevas`) 
        : "";
      const brandText = result.createdBrands > 0 
        ? (result.createdBrands === 1 ? ", 1 marca nueva" : `, ${result.createdBrands} marcas nuevas`) 
        : "";
      
      toast.success(`Se importaron ${productText}${categoryText}${brandText}.`);

      if (result.rejectedRows.length > 0) {
        const rejectText = result.rejectedRows.length === 1 
          ? "1 fila fue omitida" 
          : `${result.rejectedRows.length} filas fueron omitidas`;
        toast.info(`${rejectText} por tener duplicados o errores.`);
      }

      onImported();
      setOpen(false);
      setFile(null);
      setPreview(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al importar los productos");
    },
  });

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla-importacion-catalogo.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }
    setFile(selectedFile);
    setPreview(null);
    previewMutation.mutate(selectedFile);
  };

  const handleExecute = () => {
    if (!file) {
      toast.error("Seleccioná un archivo primero");
      return;
    }
    executeMutation.mutate(file);
  };

  return (
    <>
      <Button variant="outline" className={triggerClassName} onClick={() => setOpen(true)}>
        {triggerIcon}
        Importar CSV
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Importar productos desde CSV</DialogTitle>
            <DialogDescription>
              Cargá un archivo CSV con tu catálogo de productos. Te mostramos una vista previa para que puedas revisar los datos antes de importar.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto space-y-5">
            {/* Ayuda / Tips */}
            <details className="rounded-xl border border-border/70 bg-muted/30 p-4">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                <HelpCircle className="h-4 w-4" />
                Instrucciones
              </summary>
              <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground">📋 Formato del archivo</p>
                  <ul className="mt-1 list-inside list-disc space-y-1">
                    <li>Archivo CSV con encoding UTF-8</li>
                    <li>Separador: coma (,)</li>
                    <li>Decimales con punto (ej: 1000.50)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground">⚠️ Cuando una fila no se importa</p>
                  <ul className="mt-1 space-y-2">
                    <li>
                      <span className="text-amber-600 font-medium">Producto duplicado:</span>
                      <span className="ml-1">Ya existe un producto con ese barcode o con ese nombre + marca. Cambiá el barcode o el nombre en el CSV.</span>
                    </li>
                    <li>
                      <span className="text-red-600 font-medium">Campo obligatorio vacío:</span>
                      <span className="ml-1">Completá los campos: nombre, categoría, marca, unidad, costo, precio e IVA.</span>
                    </li>
                    <li>
                      <span className="text-red-600 font-medium">Valor inválido:</span>
                      <span className="ml-1">El costo, precio o IVA tienen que ser números válidos.</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground">💡 Tips útiles</p>
                  <ul className="mt-1 list-inside list-disc space-y-1">
                    <li>Las categorías y marcas que no existen se crean automáticamente</li>
                    <li>Si no ponés barcode, el sistema detecta duplicados por nombre + marca</li>
                    <li>Una fila con error no afecta a las demás</li>
                    <li>Descargá la plantilla para mantener el formato correcto</li>
                  </ul>
                </div>
              </div>
            </details>

<div className="brand-accent-panel rounded-2xl p-4">
              <p className="text-sm font-semibold text-foreground">1. Seleccionar archivo</p>
              <p className="mt-1 text-sm brand-accent-subtle">
                Descargá la plantilla, completá tus productos y subí el archivo. Solo se acepta CSV en esta versión.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar plantilla
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Seleccionar CSV
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleSelectFile}
                />
                {file ? (
                  <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-foreground">
                    {file.name}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">No hay archivo seleccionado</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">2. Revisar datos</p>
                  <p className="text-sm text-muted-foreground">
                    Revisá los datos antes de importar. Las filas con problema se marcan en color.
                  </p>
                </div>
              </div>

              {preview && (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-border/70 bg-background p-3">
                      <p className="text-xs text-muted-foreground">Total de filas</p>
                      <p className="mt-1 text-2xl font-semibold">{preview.summary.totalRows}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background p-3">
                      <p className="text-xs text-muted-foreground">Listos para importar</p>
                      <p className="mt-1 text-2xl font-semibold text-green-600">{preview.summary.importableRows}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background p-3">
                      <p className="text-xs text-muted-foreground">Revisar</p>
                      <p className="mt-1 text-2xl font-semibold text-amber-600">{preview.summary.rowsWithWarnings}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background p-3">
                      <p className="text-xs text-muted-foreground">Con error</p>
                      <p className="mt-1 text-2xl font-semibold text-red-600">{preview.summary.rowsWithErrors}</p>
                    </div>
                  </div>

                  {preview.rows.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-border/70">
                      <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-12 shrink-0">#</th>
                              {Object.keys(preview.rows[0].raw).map((col) => (
                                <th key={col} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                                  {col}
                                </th>
                              ))}
                              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-20 shrink-0">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.rows.map((row) => {
                              const hasError = row.issues.some((issue) => issue.severity === "error");
                              const hasWarning = row.issues.some((issue) => issue.severity === "warning");
                              let rowClass = "";
                              if (hasError) {
                                rowClass = "bg-red-500/10";
                              } else if (hasWarning) {
                                rowClass = "bg-amber-500/10";
                              }
                              return (
                                <tr key={row.row} className={`border-t border-border/50 ${rowClass}`}>
                                  <td className="px-3 py-2 text-muted-foreground font-medium shrink-0">{row.row}</td>
                                  {Object.entries(row.raw).map(([col, value]) => (
                                    <td key={col} className="px-3 py-2 text-foreground whitespace-nowrap" title={value}>
                                      {value}
                                    </td>
                                  ))}
                                  <td className="px-3 py-2">
                                    {hasError ? (
                                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                        Error
                                      </span>
                                    ) : hasWarning ? (
                                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                        Revisar
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                        OK
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Solo se importan las filas marcadas como OK. Las filas con error o duplicados se omitirán.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleExecute}
                disabled={!file || !preview || preview.summary.importableRows === 0 || executeMutation.isPending}
              >
                {executeMutation.isPending ? "Importando..." : "Importar productos"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
