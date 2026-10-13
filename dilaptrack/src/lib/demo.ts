// Demo data: landholders and lots at every stage of the dilapidation workflow,
// with sample photos and documents. Loaded from the browser by an administrator
// (Users page), through the same permission-checked paths the app uses.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/lib/database.types";
import { uploadFile } from "@/lib/upload";

export const DEMO_PREFIX = "DEMO-";
export const DEMO_NOTE = "Demo data - safe to remove from Users > Demo data.";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const PHOTOS = [
  ["photo-1.jpg", "Front boundary fence - posts and wires"],
  ["photo-2.jpg", "Driveway crossover - existing hairline crack"],
  ["photo-3.jpg", "Dwelling north wall - minor render cracking"],
  ["photo-4.jpg", "Access track from road reserve"],
  ["photo-5.jpg", "Culvert headwall at table drain"],
  ["photo-6.jpg", "Paddock gate at construction access"],
  ["photo-7.jpg", "Shed slab - corner crack"],
  ["photo-8.jpg", "Kerb and channel along frontage"],
] as const;

const LANDHOLDERS = [
  { name: "Riverside Farming Pty Ltd", phone: "07 4000 1001", email: "admin@riversidefarming.example", postal_address: "PO Box 12, Riverside QLD 4000" },
  { name: "J & K Thompson", phone: "0400 111 201", email: null, postal_address: "14 Creek Road, Riverside QLD 4000" },
  { name: "M Patel", phone: "0400 111 202", email: "m.patel@example.com", postal_address: null },
  { name: "Greenvale Regional Council", phone: "07 4000 2000", email: "works@greenvale.example", postal_address: "1 Civic Place, Greenvale QLD 4001" },
  { name: "Sarah O'Connor", phone: "0400 111 203", email: null, postal_address: null },
  { name: "Hilltop Grazing Co", phone: "07 4000 3000", email: "office@hilltopgrazing.example", postal_address: "Hilltop Station, Ridge Road QLD 4002" },
  { name: "David & Lee Nguyen", phone: "0400 111 204", email: "nguyen.family@example.com", postal_address: null },
  { name: "Northside Logistics", phone: null, email: "property@northside.example", postal_address: "Unit 4, 20 Depot Street, Northside QLD 4003" },
];

type SurveyPlan = { status: Enums<"survey_status">; date: number; surveyor?: string; notes?: string; photos?: number[]; report?: boolean };
type LotPlan = {
  n: string;
  address: string;
  owner: number;
  chainage: string;
  engineer: string;
  status?: "on_hold";
  notes?: string;
  pre?: SurveyPlan;
  post?: SurveyPlan;
  signoff?: number;
  close?: boolean;
};

const PRE_NOTES =
  "External inspection of dwelling, outbuildings, fences, driveway and access. Existing hairline cracking noted to driveway crossover and dwelling render. Fences generally sound.";
const POST_NOTES = "Re-inspection after construction. No new damage attributable to the works observed. Conditions consistent with pre-construction record.";

const LOTS: LotPlan[] = [
  { n: "01", address: "120 Riverside Road", owner: 0, chainage: "0+150", engineer: "Alex Nguyen",
    pre: { status: "complete", date: -210, surveyor: "Alex Nguyen", notes: PRE_NOTES, photos: [0, 3, 5], report: true },
    post: { status: "complete", date: -24, surveyor: "Alex Nguyen", notes: POST_NOTES, photos: [0, 3], report: true }, signoff: -12, close: true },
  { n: "02", address: "Riverside Road (paddock lot)", owner: 0, chainage: "0+620", engineer: "Alex Nguyen",
    pre: { status: "complete", date: -205, surveyor: "Alex Nguyen", notes: PRE_NOTES, photos: [5, 3, 0], report: true },
    post: { status: "complete", date: -20, surveyor: "Sam Taylor", notes: POST_NOTES, photos: [5, 3], report: true }, signoff: -8, close: true },
  { n: "03", address: "Riverside Road (river flats)", owner: 0, chainage: "1+040", engineer: "Alex Nguyen",
    pre: { status: "complete", date: -200, surveyor: "Alex Nguyen", notes: PRE_NOTES, photos: [4, 3, 0], report: true },
    post: { status: "complete", date: -15, surveyor: "Alex Nguyen", notes: POST_NOTES, photos: [4, 3] }, signoff: -3 },
  { n: "04", address: "14 Creek Road", owner: 1, chainage: "1+480", engineer: "Sam Taylor", notes: "Dog on property - call ahead.",
    pre: { status: "complete", date: -190, surveyor: "Sam Taylor", notes: PRE_NOTES, photos: [1, 2, 0], report: true },
    post: { status: "complete", date: -9, surveyor: "Sam Taylor", notes: "Re-inspection complete. Landholder raised concern about driveway crack; compared with pre-construction photos - unchanged.", photos: [1, 2] } },
  { n: "05", address: "22 Creek Road", owner: 2, chainage: "1+900", engineer: "Sam Taylor",
    pre: { status: "complete", date: -185, surveyor: "Sam Taylor", notes: PRE_NOTES, photos: [2, 6, 7], report: true },
    post: { status: "complete", date: -5, surveyor: "Sam Taylor", notes: POST_NOTES, photos: [2, 6] } },
  { n: "06", address: "Greenvale Road reserve (north)", owner: 3, chainage: "2+350", engineer: "Alex Nguyen",
    pre: { status: "complete", date: -170, surveyor: "Alex Nguyen", notes: "Road reserve: kerb, channel and culvert headwalls recorded.", photos: [7, 4], report: true },
    post: { status: "scheduled", date: 5, surveyor: "Alex Nguyen" } },
  { n: "07", address: "Greenvale Road reserve (south)", owner: 3, chainage: "2+900", engineer: "Alex Nguyen",
    pre: { status: "complete", date: -165, surveyor: "Alex Nguyen", notes: "Road reserve: kerb and channel recorded.", photos: [7, 3], report: true },
    post: { status: "in_progress", date: 0, surveyor: "Sam Taylor" } },
  { n: "08", address: "8 Wattle Lane", owner: 4, chainage: "3+420", engineer: "Sam Taylor",
    pre: { status: "complete", date: -150, surveyor: "Sam Taylor", notes: PRE_NOTES, photos: [2, 1, 6], report: true } },
  { n: "09", address: "Hilltop Station (east paddock)", owner: 5, chainage: "4+100", engineer: "Alex Nguyen", status: "on_hold",
    notes: "On hold - access negotiation for alternative alignment.",
    pre: { status: "complete", date: -140, surveyor: "Alex Nguyen", notes: PRE_NOTES, photos: [5, 3], report: true } },
  { n: "10", address: "Hilltop Station (west paddock)", owner: 5, chainage: "4+780", engineer: "Alex Nguyen",
    pre: { status: "scheduled", date: 3, surveyor: "Alex Nguyen" } },
  { n: "11", address: "31 Ridge Road", owner: 6, chainage: "5+600", engineer: "Sam Taylor", notes: "Landholder prefers morning visits.",
    pre: { status: "scheduled", date: -2, surveyor: "Sam Taylor" } },
  { n: "12", address: "20 Depot Street", owner: 7, chainage: "6+400", engineer: "Sam Taylor" },
];

async function fetchFile(name: string, type: string) {
  const res = await fetch(`/demo/${name}`);
  if (!res.ok) throw new Error(`Couldn't load demo file ${name}`);
  return new File([await res.blob()], name, { type });
}

/** Result of a select: throw on error or no data. */
function need<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("Unexpected empty result");
  return result.data;
}

/** Result of an insert/update without a select: throw on error. */
function done(result: { error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
}

/** Create the demo landholders and lots. Calls `progress` with a short status message. */
export async function loadDemoData(supabase: SupabaseClient<Database>, progress: (message: string) => void) {
  const existing = need(await supabase.from("lots").select("id").like("lot_number", `${DEMO_PREFIX}%`).limit(1));
  if (existing.length) throw new Error("Demo data is already loaded. Remove it first.");

  progress("Loading sample photos…");
  const photos = await Promise.all(PHOTOS.map(([name]) => fetchFile(name, "image/jpeg")));
  const report = await fetchFile("sample-survey-report.pdf", "application/pdf");
  const acceptance = await fetchFile("sample-signed-acceptance.pdf", "application/pdf");

  progress("Adding landholders…");
  const ownerIds: string[] = [];
  for (const h of LANDHOLDERS) {
    const found = await supabase.from("landholders").select("id").ilike("name", h.name).maybeSingle();
    if (found.error) throw new Error(found.error.message);
    ownerIds.push(found.data?.id ?? need(await supabase.from("landholders").insert({ ...h, notes: DEMO_NOTE }).select("id").single()).id);
  }

  for (const [i, plan] of LOTS.entries()) {
    const lotNumber = `${DEMO_PREFIX}${plan.n}`;
    progress(`Lot ${i + 1} of ${LOTS.length}: ${lotNumber}…`);
    const lot = need(
      await supabase
        .from("lots")
        .insert({
          lot_number: lotNumber,
          address: plan.address,
          landholder_id: ownerIds[plan.owner],
          chainage: plan.chainage,
          assigned_engineer: plan.engineer,
          notes: plan.notes ?? null,
          status: plan.status ?? "not_started",
        })
        .select("id")
        .single(),
    );
    const surveys = need(await supabase.from("surveys").select("id, survey_type").eq("lot_id", lot.id));

    for (const [type, s] of [["pre_construction", plan.pre], ["post_construction", plan.post]] as const) {
      if (!s) continue;
      const surveyId = surveys.find((x) => x.survey_type === type)!.id;
      done(
        await supabase
          .from("surveys")
          .update({ status: s.status, survey_date: day(s.date), surveyor: s.surveyor ?? null, notes: s.notes ?? null })
          .eq("id", surveyId),
      );
      for (const p of s.photos ?? []) {
        await uploadFile(supabase, photos[p], { lotId: lot.id, lotNumber, category: type, surveyId, caption: PHOTOS[p][1] });
      }
      if (s.report) {
        await uploadFile(supabase, report, {
          lotId: lot.id,
          lotNumber,
          category: type,
          surveyId,
          caption: `${type === "pre_construction" ? "Pre" : "Post"}-construction survey report`,
        });
      }
    }

    if (plan.signoff !== undefined) {
      done(
        await supabase
          .from("lots")
          .update({
            landholder_signoff_date: day(plan.signoff),
            landholder_signoff_name: LANDHOLDERS[plan.owner].name,
            landholder_signoff_notes: "Signed acceptance form received.",
          })
          .eq("id", lot.id),
      );
      await uploadFile(supabase, acceptance, { lotId: lot.id, lotNumber, category: "closeout", caption: "Signed landholder acceptance" });
    }
    if (plan.close) done(await supabase.from("lots").update({ status: "closed" }).eq("id", lot.id));
  }
  progress("Done");
}
