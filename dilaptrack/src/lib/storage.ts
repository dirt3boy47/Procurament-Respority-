import type { Enums } from "@/lib/database.types";
import { FILE_CATEGORIES } from "@/lib/constants";

/** Make a string safe for a storage path segment. */
export function slugify(value: string, fallback = "file") {
  const s = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return s || fallback;
}

/**
 * Storage path for an uploaded file:
 *   LOT-001/pre-construction/20261013-041500-a1b2c3-front-fence.jpg
 * The lot folder uses the lot number so the bucket is easy to browse.
 */
export function buildStoragePath(
  lotNumber: string,
  category: Enums<"file_category">,
  fileName: string,
  now = new Date(),
  unique = Math.random().toString(36).slice(2, 8),
) {
  const folder = FILE_CATEGORIES.find((c) => c.value === category)?.slug ?? category;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const dot = fileName.lastIndexOf(".");
  const base = slugify(dot > 0 ? fileName.slice(0, dot) : fileName).slice(0, 60);
  const ext = dot > 0 ? slugify(fileName.slice(dot + 1), "").toLowerCase() : "";
  return `${slugify(lotNumber, "lot")}/${folder}/${stamp}-${unique}-${base}${ext ? `.${ext}` : ""}`;
}

/** Where the small preview image for a photo is stored. */
export function previewPathFor(storagePath: string) {
  return `${storagePath.replace(/\.[^./]+$/, "")}.preview.jpg`;
}
