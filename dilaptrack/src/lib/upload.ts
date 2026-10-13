// Browser-side upload of one file to Supabase Storage plus its `attachments` row.
// Used by the uploader component and the demo data loader.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/lib/database.types";
import { STORAGE_BUCKET } from "@/lib/env";
import { buildStoragePath, previewPathFor } from "@/lib/storage";

const PREVIEWABLE = /^image\/(jpeg|png|webp|gif|bmp|avif)$/;

/** Shrink a photo to a JPEG preview for galleries and PDF reports. The original is kept untouched. */
export async function makePreview(file: Blob, maxSize = 1280): Promise<Blob | null> {
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

export type UploadTarget = {
  lotId: string;
  lotNumber: string;
  category: Enums<"file_category">;
  surveyId?: string | null;
  caption?: string | null;
};

/** Upload a file and record it. Throws a readable Error; cleans up storage if the record can't be saved. */
export async function uploadFile(supabase: SupabaseClient<Database>, file: File, target: UploadTarget) {
  const bucket = supabase.storage.from(STORAGE_BUCKET);
  const path = buildStoragePath(target.lotNumber, target.category, file.name);
  const uploaded: string[] = [];
  try {
    const { error } = await bucket.upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
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
      lot_id: target.lotId,
      category: target.category,
      survey_id: target.surveyId ?? null,
      storage_path: path,
      preview_path: previewPath,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      caption: target.caption ?? null,
    });
    if (rowError) throw rowError;
  } catch (e) {
    if (uploaded.length) await bucket.remove(uploaded);
    const message = (e as { message?: string }).message ?? "Upload failed";
    throw new Error(
      /row-level security|not authorized|unauthorized/i.test(message)
        ? "You don't have permission to upload here"
        : /closed/i.test(message)
          ? "This lot is closed"
          : message,
    );
  }
}
