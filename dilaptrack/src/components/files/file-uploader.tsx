"use client";

import { Camera, CheckCircle2, Loader2, UploadCloud, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import type { Enums } from "@/lib/database.types";
import { STORAGE_BUCKET } from "@/lib/env";
import { formatBytes } from "@/lib/format";
import { buildStoragePath, previewPathFor } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 50);
const DEFAULT_ACCEPT = "image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt";
const PREVIEWABLE = /^image\/(jpeg|png|webp|gif|bmp|avif)$/;
const CONCURRENCY = 3;

type Item = { key: string; name: string; size: number; state: "queued" | "uploading" | "done" | "error"; error?: string };

/** Shrink a photo to a JPEG preview for galleries and PDF reports. The original is kept untouched. */
async function makePreview(file: File, maxSize = 1280): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  } catch {
    return null;
  }
}

export function FileUploader({
  lotId,
  lotNumber,
  category,
  surveyId,
  defectId,
  reinstatementId,
  accept = DEFAULT_ACCEPT,
  label = "Drop photos, videos or documents here",
  compact = false,
}: {
  lotId: string;
  lotNumber: string;
  category: Enums<"file_category">;
  surveyId?: string;
  defectId?: string;
  reinstatementId?: string;
  accept?: string;
  label?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const busy = items.some((i) => i.state === "queued" || i.state === "uploading");

  const update = (key: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function uploadOne(file: File, key: string) {
    if (file.size > MAX_MB * 1024 * 1024) {
      update(key, { state: "error", error: `Larger than ${MAX_MB} MB` });
      return false;
    }
    update(key, { state: "uploading" });
    const supabase = createClient();
    const bucket = supabase.storage.from(STORAGE_BUCKET);
    const path = buildStoragePath(lotNumber, category, file.name);
    const uploaded: string[] = [];
    try {
      const { error } = await bucket.upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (error) throw error;
      uploaded.push(path);

      let previewPath: string | null = null;
      if (PREVIEWABLE.test(file.type)) {
        const preview = await makePreview(file);
        if (preview) {
          const { error: previewError } = await bucket.upload(previewPathFor(path), preview, {
            contentType: "image/jpeg",
            upsert: false,
          });
          if (!previewError) {
            previewPath = previewPathFor(path);
            uploaded.push(previewPath);
          }
        }
      }

      const { error: rowError } = await supabase.from("attachments").insert({
        lot_id: lotId,
        category,
        survey_id: surveyId ?? null,
        defect_id: defectId ?? null,
        reinstatement_id: reinstatementId ?? null,
        storage_path: path,
        preview_path: previewPath,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (rowError) throw rowError;
      update(key, { state: "done" });
      return true;
    } catch (e) {
      if (uploaded.length) await bucket.remove(uploaded);
      const message = (e as { message?: string }).message ?? "Upload failed";
      update(key, {
        state: "error",
        error: /row-level security|not authorized|unauthorized/i.test(message)
          ? "You don't have permission to upload here"
          : /closed/i.test(message)
            ? "This lot is closed"
            : message,
      });
      return false;
    }
  }

  async function handleFiles(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    const batch = files.map((file) => ({ file, key: `${Date.now()}-${Math.random().toString(36).slice(2)}` }));
    setItems((prev) => [
      ...prev.filter((i) => i.state !== "done"),
      ...batch.map(({ file, key }) => ({ key, name: file.name, size: file.size, state: "queued" as const })),
    ]);

    let succeeded = 0;
    const queue = [...batch];
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          if (await uploadOne(next.file, next.key)) succeeded++;
        }
      }),
    );

    if (succeeded) {
      toast.success(`Uploaded ${succeeded} file${succeeded === 1 ? "" : "s"}`);
      router.refresh();
    }
    if (succeeded < batch.length) toast.error(`${batch.length - succeeded} file(s) could not be uploaded`);
    if (fileInput.current) fileInput.current.value = "";
    if (cameraInput.current) cameraInput.current.value = "";
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="no-print space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-center transition-colors",
          compact ? "px-3 py-3 sm:flex-row sm:justify-between sm:text-left" : "px-4 py-6",
          dragging && "border-primary bg-primary/5",
        )}
      >
        <div className={cn("flex items-center gap-2 text-sm text-muted-fg", !compact && "flex-col")}>
          <UploadCloud className={compact ? "size-5" : "size-8"} aria-hidden />
          <span>
            <span className="hidden sm:inline">{label} or </span>
            <label htmlFor={inputId} className="cursor-pointer font-medium text-primary hover:underline">
              <span className="sm:hidden">Choose files</span>
              <span className="hidden sm:inline">browse</span>
            </label>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cameraInput.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted sm:hidden"
          >
            <Camera className="size-4" /> Take photo
          </button>
          {!compact && <span className="hidden text-xs text-muted-fg sm:inline">Up to {MAX_MB} MB per file</span>}
        </div>
        <input
          id={inputId}
          ref={fileInput}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          disabled={busy}
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <ul className="space-y-1 text-sm" aria-live="polite">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-2">
              {item.state === "done" ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-label="Uploaded" />
              ) : item.state === "error" ? (
                <XCircle className="size-4 shrink-0 text-red-600" aria-label="Failed" />
              ) : (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-fg" aria-label="Uploading" />
              )}
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="shrink-0 text-xs text-muted-fg">{item.error ?? formatBytes(item.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
