import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Tables, Views } from "@/lib/database.types";
import { STORAGE_BUCKET } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type LotOverview = Views<"lot_overview">;
export type Attachment = Tables<"attachments">;
/** An attachment with short-lived signed URLs for viewing. */
export type AttachmentView = Attachment & { url: string | null; previewUrl: string | null };

const SIGNED_URL_SECONDS = 60 * 60;

/** Natural sort for lot numbers: LOT-2 before LOT-10. */
export function compareLotNumbers(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export const listLots = cache(async (): Promise<LotOverview[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lot_overview").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).sort((a, b) => compareLotNumbers(a.lot_number, b.lot_number));
});

/** One lot with its progress, or a 404. */
export const getLot = cache(async (id: string): Promise<LotOverview> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from("lot_overview").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  return data;
});

/** Lot id -> lot number, for registers that link back to lots. */
export const lotNumbers = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("lots").select("id, lot_number, address, status");
  return new Map((data ?? []).map((l) => [l.id, l]));
});

/** Names of team members, used as suggestions for "assigned to" fields. */
export const teamNames = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name, role").eq("active", true).order("full_name");
  return (data ?? []).map((p) => p.full_name).filter(Boolean);
});

/** Add signed URLs (and preview URLs for photos) to attachment rows. */
export async function withUrls(rows: Attachment[]): Promise<AttachmentView[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const paths = [...new Set(rows.flatMap((r) => [r.storage_path, r.preview_path].filter((p): p is string => Boolean(p))))];
  const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  const urls = new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl]));
  return rows.map((r) => ({
    ...r,
    url: urls.get(r.storage_path) ?? null,
    previewUrl: (r.preview_path && urls.get(r.preview_path)) || (r.kind === "photo" ? (urls.get(r.storage_path) ?? null) : null),
  }));
}

type AttachmentFilter = Partial<Pick<Attachment, "lot_id" | "category" | "survey_id">>;

export async function getAttachments(filter: AttachmentFilter): Promise<AttachmentView[]> {
  const supabase = await createClient();
  let query = supabase.from("attachments").select("*").order("created_at", { ascending: true });
  if (filter.lot_id) query = query.eq("lot_id", filter.lot_id);
  if (filter.category) query = query.eq("category", filter.category);
  if (filter.survey_id) query = query.eq("survey_id", filter.survey_id);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return withUrls(data ?? []);
}
