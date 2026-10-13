import "server-only";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import type { Profile } from "@/lib/auth";
import { closeoutChecklist } from "@/lib/closeout";
import { FILE_CATEGORIES } from "@/lib/constants";
import { compareLotNumbers, type LotOverview } from "@/lib/data";
import type { Enums } from "@/lib/database.types";
import { formatDate } from "@/lib/format";
import { slugify } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { loadPhotos } from "./data";
import { LotReport, ReinstatementReport, SummaryReport, SurveyReport } from "./reports";

type Built = { fileName: string; document: ReactElement<DocumentProps> } | { error: string; status: number };

const PROJECT = process.env.NEXT_PUBLIC_PROJECT_NAME || "DilapTrack";
const stamp = () => new Date().toISOString().slice(0, 10);

async function getLot(supabase: Awaited<ReturnType<typeof createClient>>, id: string | null) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase.from("lot_overview").select("*").eq("id", id).maybeSingle();
  return data;
}

/** Load the data for a report and build its PDF document. RLS applies (runs as the user). */
export async function buildReport(type: string, params: URLSearchParams, profile: Profile): Promise<Built> {
  const supabase = await createClient();
  const meta = { project: PROJECT, generatedBy: profile.full_name || profile.email };

  if (type === "lot") {
    const lot = await getLot(supabase, params.get("lot"));
    if (!lot) return { error: "Lot not found", status: 404 };
    const [surveys, defects, reinstatement, attachments] = await Promise.all([
      supabase.from("surveys").select("*").eq("lot_id", lot.id).order("survey_type"),
      supabase.from("defects").select("*").eq("lot_id", lot.id).order("ref"),
      supabase.from("reinstatement_items").select("*").eq("lot_id", lot.id).order("ref"),
      supabase.from("attachments").select("*").eq("lot_id", lot.id).order("created_at"),
    ]);
    const files = attachments.data ?? [];
    const photos = await Promise.all(
      FILE_CATEGORIES.map(async (c) => ({
        title: `${c.label} photos`,
        items: await loadPhotos(supabase, files.filter((f) => f.category === c.value), 9),
      })),
    );
    return {
      fileName: `Lot-${slugify(lot.lot_number)}-report-${stamp()}.pdf`,
      document: createElement(LotReport, {
        meta,
        lot,
        checklist: closeoutChecklist(lot),
        surveys: (surveys.data ?? []).map((s) => ({ ...s, fileCount: files.filter((f) => f.category === s.survey_type).length })),
        defects: defects.data ?? [],
        reinstatement: reinstatement.data ?? [],
        photos,
      }) as ReactElement<DocumentProps>,
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
          photos: await loadPhotos(supabase, files, 120),
          otherFiles: files
            .filter((f) => f.kind !== "photo")
            .map((f) => ({ name: f.caption ? `${f.file_name} - ${f.caption}` : f.file_name, kind: f.kind, date: formatDate(f.created_at) })),
        };
      }),
    );
    return {
      fileName: `Lot-${slugify(lot.lot_number)}-dilapidation-survey-${stamp()}.pdf`,
      document: createElement(SurveyReport, { meta, lot, stages }) as ReactElement<DocumentProps>,
    };
  }

  if (type === "reinstatement") {
    const lotId = params.get("lot");
    const status = params.get("status");
    let query = supabase.from("reinstatement_items").select("*").order("ref");
    if (lotId) query = query.eq("lot_id", lotId);
    if (status === "outstanding") query = query.neq("status", "complete");
    const [{ data: items }, { data: lots }] = await Promise.all([query, supabase.from("lot_overview").select("*")]);
    const byLot = new Map<string, LotOverview>((lots ?? []).map((l) => [l.id, l]));
    const groups = [...new Set((items ?? []).map((i) => i.lot_id))]
      .map((id) => ({ lot: byLot.get(id)!, items: (items ?? []).filter((i) => i.lot_id === id) }))
      .filter((g) => g.lot)
      .sort((a, b) => compareLotNumbers(a.lot.lot_number, b.lot.lot_number));
    let photos;
    if (lotId) {
      const { data: files } = await supabase
        .from("attachments")
        .select("*")
        .eq("lot_id", lotId)
        .eq("category", "reinstatement")
        .order("created_at");
      photos = await loadPhotos(supabase, files ?? [], 60);
    }
    const lotPart = lotId && groups[0] ? `Lot-${slugify(groups[0].lot.lot_number)}-` : "";
    return {
      fileName: `${lotPart}reinstatement-report-${stamp()}.pdf`,
      document: createElement(ReinstatementReport, { meta, groups, photos }) as ReactElement<DocumentProps>,
    };
  }

  if (type === "summary") {
    const [{ data: lots }, { data: defects }] = await Promise.all([
      supabase.from("lot_overview").select("*"),
      supabase.from("defects").select("*").neq("status", "closed").order("ref"),
    ]);
    const sorted = (lots ?? []).sort((a, b) => compareLotNumbers(a.lot_number, b.lot_number));
    return {
      fileName: `project-summary-${stamp()}.pdf`,
      document: createElement(SummaryReport, { meta, lots: sorted, openDefects: defects ?? [] }) as ReactElement<DocumentProps>,
    };
  }

  return { error: "Unknown report", status: 404 };
}
