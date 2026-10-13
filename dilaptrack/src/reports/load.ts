import "server-only";
import type { Profile } from "@/lib/auth";
import { closeoutChecklist } from "@/lib/closeout";
import { FILE_CATEGORIES } from "@/lib/constants";
import { compareLotNumbers } from "@/lib/data";
import type { Enums, Tables } from "@/lib/database.types";
import { STORAGE_BUCKET } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { slugify } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import type { PdfPhoto } from "./kit";
import type { ReportData } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Attachment = Tables<"attachments">;
type Loaded = { data: ReportData } | { error: string; status: number };

const PROJECT = process.env.NEXT_PUBLIC_PROJECT_NAME || "DilapTrack";
const URL_SECONDS = 10 * 60;
const stamp = () => new Date().toISOString().slice(0, 10);

/** Which stored image to embed: the JPEG preview, or a JPEG/PNG original (react-pdf supports only those). */
function embeddablePath(a: Attachment) {
  if (a.kind !== "photo") return null;
  if (a.preview_path) return a.preview_path;
  return a.mime_type === "image/jpeg" || a.mime_type === "image/png" ? a.storage_path : null;
}

/** Short-lived signed URLs for up to `limit` photos; the browser downloads them while drawing the PDF. */
async function photoRefs(supabase: Supabase, attachments: Attachment[], limit: number): Promise<PdfPhoto[]> {
  const chosen = attachments
    .map((a) => ({ a, path: embeddablePath(a) }))
    .filter((x): x is { a: Attachment; path: string } => x.path !== null)
    .slice(0, limit);
  if (chosen.length === 0) return [];
  const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrls(
    chosen.map((c) => c.path),
    URL_SECONDS,
  );
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return chosen.flatMap(({ a, path }) => {
    const src = urls.get(path);
    return src ? [{ src, caption: [a.caption || a.file_name, formatDate(a.created_at)].join(" - ") }] : [];
  });
}

async function getLot(supabase: Supabase, id: string | null) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase.from("lot_overview").select("*").eq("id", id).maybeSingle();
  return data;
}

/** Load a report's data as the signed-in user (Row Level Security applies). */
export async function loadReport(type: string, params: URLSearchParams, profile: Profile): Promise<Loaded> {
  const supabase = await createClient();
  const meta = { project: PROJECT, generatedBy: profile.full_name || profile.email };

  if (type === "lot") {
    const lot = await getLot(supabase, params.get("lot"));
    if (!lot) return { error: "Lot not found", status: 404 };
    const [surveys, attachments] = await Promise.all([
      supabase.from("surveys").select("*").eq("lot_id", lot.id).order("survey_type"),
      supabase.from("attachments").select("*").eq("lot_id", lot.id).order("created_at"),
    ]);
    const files = attachments.data ?? [];
    const photos = await Promise.all(
      FILE_CATEGORIES.map(async (c) => ({
        title: `${c.label} photos`,
        items: await photoRefs(supabase, files.filter((f) => f.category === c.value), 9),
      })),
    );
    return {
      data: {
        type: "lot",
        fileName: `Lot-${slugify(lot.lot_number)}-report-${stamp()}.pdf`,
        meta,
        lot,
        checklist: closeoutChecklist(lot),
        surveys: (surveys.data ?? []).map((s) => ({ ...s, fileCount: files.filter((f) => f.category === s.survey_type).length })),
        photos,
      },
    };
  }

  if (type === "survey") {
    const lot = await getLot(supabase, params.get("lot"));
    if (!lot) return { error: "Lot not found", status: 404 };
    const stage = params.get("stage");
    const types: Enums<"survey_type">[] =
      stage === "pre_construction" || stage === "post_construction" ? [stage] : ["pre_construction", "post_construction"];
    const [{ data: surveys }, { data: attachments }] = await Promise.all([
      supabase.from("surveys").select("*").eq("lot_id", lot.id).in("survey_type", types).order("survey_type"),
      supabase.from("attachments").select("*").eq("lot_id", lot.id).in("category", types).order("created_at"),
    ]);
    const stages = await Promise.all(
      (surveys ?? []).map(async (survey) => {
        const files = (attachments ?? []).filter((a) => a.category === survey.survey_type);
        return {
          survey,
          photoCount: files.filter((f) => f.kind === "photo").length,
          photos: await photoRefs(supabase, files, 120),
          otherFiles: files
            .filter((f) => f.kind !== "photo")
            .map((f) => ({ name: f.caption ? `${f.file_name} - ${f.caption}` : f.file_name, kind: f.kind, date: formatDate(f.created_at) })),
        };
      }),
    );
    return {
      data: { type: "survey", fileName: `Lot-${slugify(lot.lot_number)}-dilapidation-survey-${stamp()}.pdf`, meta, lot, stages },
    };
  }

  if (type === "landholder") {
    const landholderId = params.get("landholder");
    let query = supabase.from("landholders").select("*").order("name");
    if (landholderId) query = query.eq("id", landholderId);
    const [{ data: landholders }, { data: lots }] = await Promise.all([query, supabase.from("lot_overview").select("*")]);
    const sorted = (lots ?? []).sort((a, b) => compareLotNumbers(a.lot_number, b.lot_number));
    const groups = (landholders ?? []).map((landholder) => ({
      landholder,
      lots: sorted.filter((l) => l.landholder_id === landholder.id),
    }));
    if (landholderId && groups.length === 0) return { error: "Landholder not found", status: 404 };
    const part = landholderId ? `${slugify(groups[0].landholder.name)}-` : "";
    return { data: { type: "landholder", fileName: `${part}landholder-report-${stamp()}.pdf`, meta, groups } };
  }

  if (type === "summary") {
    const { data: lots } = await supabase.from("lot_overview").select("*");
    const sorted = (lots ?? []).sort((a, b) => compareLotNumbers(a.lot_number, b.lot_number));
    return { data: { type: "summary", fileName: `project-summary-${stamp()}.pdf`, meta, lots: sorted } };
  }

  return { error: "Unknown report", status: 404 };
}
