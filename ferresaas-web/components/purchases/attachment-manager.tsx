"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  FileText,
  Upload,
  Trash2,
  Download,
  Paperclip,
  Loader2,
} from "lucide-react";

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

export type { Attachment };

interface AttachmentManagerProps {
  purchaseId?: string;
  attachments: Attachment[];
  canUpload: boolean;
  canDelete: boolean;
}

const FILE_TYPE_OPTIONS = [
  { value: "INVOICE", label: "Factura" },
  { value: "RECEIPT", label: "Remito" },
  { value: "NOTE", label: "Nota" },
  { value: "OTHER", label: "Otro" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  return <Paperclip className="h-5 w-5" />;
}

export function AttachmentManager({
  purchaseId,
  attachments,
  canUpload,
  canDelete,
}: AttachmentManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [fileType, setFileType] = useState("INVOICE");
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!purchaseId) throw new Error("Purchase ID required");
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", fileType);
      const response = await api.upload<Attachment>(
        `/purchases/${purchaseId}/attachments`,
        formData
      );
      if (!response.success) throw new Error(response.error?.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase", purchaseId] });
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const response = await api.delete<{ message: string }>(
        `/attachments/${attachmentId}`
      );
      if (!response.success) throw new Error(response.error?.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase", purchaseId] });
      setDeleteTarget(null);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Documentos Adjuntos
          </CardTitle>
          {canUpload && purchaseId && (
            <div className="flex items-center gap-2">
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value)}
                className="text-sm border rounded px-2 py-1"
              >
                {FILE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span className="ml-1">Subir</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay documentos adjuntos
          </p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 text-muted-foreground">
                    {getFileIcon(attachment.fileType)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{attachment.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.fileSize)} •{" "}
                      {FILE_TYPE_OPTIONS.find(
                        (t) => t.value === attachment.fileType
                      )?.label || attachment.fileType}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={attachment.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="ghost">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(attachment)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Eliminar documento"
        description={`¿Eliminar "${deleteTarget?.fileName}"? Esta acción no se puede deshacer.`}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        confirmText="Eliminar"
      />
    </Card>
  );
}