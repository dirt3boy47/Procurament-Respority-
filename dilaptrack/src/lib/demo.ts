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
  { name: "TRC (Regional Council) - Roads", phone: "07 4000 5000", email: "roads@trc.example", postal_address: "Council Chambers, Main Street QLD 4005" },
  { name: "P & R Walsh", phone: "0400 111 205", email: null, postal_address: "2 Station Street QLD 4005" },
  { name: "Emma Clarke", phone: "0400 111 206", email: "emma.clarke@example.com", postal_address: "4 Station Street QLD 4005" },
  { name: "B Okafor", phone: "0400 111 207", email: null, postal_address: "6 Station Street QLD 4005" },
  { name: "Station Street Body Corporate", phone: null, email: "manager@stationst.example", postal_address: "9 Station Street QLD 4005" },
  { name: "L Rossi", phone: "0400 111 208", email: null, postal_address: "11 Station Street QLD 4005" },
];

/** A landholder on a lot: index into LANDHOLDERS, their role, and any damage to restore. */
type LinkPlan = { h: number; role: Enums<"landholder_role">; property?: string; damage?: string; accepted?: number };
/** A photo index, or [photo index, index into the lot's holders] for a photo of one landholder's property. */
type PhotoPlan = number | [number, number];
type SurveyPlan = { status: Enums<"survey_status">; date: number; surveyor?: string; notes?: string; photos?: PhotoPlan[]; report?: boolean };
type LotPlan = {
  n: string;
  address: string;
  holders: LinkPlan[];
  chainage: string;
  engineer: string;
  status?: "on_hold";
  notes?: string;
  pre?: SurveyPlan;
  post?: SurveyPlan;
  close?: boolean;
  /** Days ago a report was prepared on request after close-out. */
  issued?: number;
};

const PRE_NOTES =
  "External inspection of dwelling, outbuildings, fences, driveway and access. Existing hairline cracking noted to driveway crossover and dwelling render. Fences generally sound.";
const POST_NOTES = "Re-inspection after construction. No new damage attributable to the works observed. Conditions consistent with pre-construction record.";
const owner = (h: number): LinkPlan[] => [{ h, role: "owner" }];

const LOTS: LotPlan[] = [
  { n: "01", address: "120 Riverside Road", holders: owner(0), chainage: "0+150", engineer: "Alex Nguyen", close: true, issued: -4,
    pre: { status: "complete", date: -210, surveyor: "Alex Nguyen", notes: PRE_NOTES, photos: [0, 3, 5], report: true },
    post: { status: "complete", date: -24, surveyor: "Alex Nguyen", notes: POST_NOTES, photos: [0, 3], report: true } },
  { n: "02", address: "Riverside Road (paddock lot)", chainage: "0+620", engineer: "Alex Nguyen", close: true,
    holders: [{ h: 0, role: "owner", damage: "Paddock gate post knocked by excavator - replaced like for like.", accepted: -8 }],
    pre: { status: "complete", date: -205, surveyor: "Alex Nguyen", notes: PRE_NOTES, photos: [5, 3, 0], report: true },
    post: { status: "complete", date: -20, surveyor: "Sam Taylor", notes: "Gate post damaged during works and replaced. Otherwise consistent with pre-construction record.", photos: [5, 3], report: true } },
  { n: "03", address: "Riverside Road (river flats)", holders: owner(0), chainage: "1+040", engineer: "Alex Nguyen",
    pre: { status: "complete", date: -200, surveyor: "Alex Nguyen", notes: PRE_NOTES, photos: [4, 3, 0], report: true },
    post: { status: "complete", date: -15, surveyor: "Alex Nguyen", notes: POST_NOTES, photos: [4, 3] } },
  { n: "04", address: "14 Creek Road", chainage: "1+480", engineer: "Sam Taylor", notes: "Dog on property - call ahead.",
    holders: [{ h: 1, role: "owner", damage: "New crack to driveway crossover from truck turning - saw cut and patched." }],
    pre: { status: "complete", date: -190, surveyor: "Sam Taylor", notes: PRE_NOTES, photos: [1, 2, 0], report: true },
    post: { status: "complete", date: -9, surveyor: "Sam Taylor", notes: "Driveway crossover cracked by turning trucks; patched. Written acceptance requested from landholder.", photos: [1, 2] } },
  { n: "05", address: "22 Creek Road", holders: owner(2), chainage: "1+900", engineer: "Sam Taylor",
    pre: { status: "complete", date: -185, surveyor: "Sam Taylor", notes: PRE_NOTES, photos: [2, 6, 7], report: true },
    post: { status: "complete", date: -5, surveyor: "Sam Taylor", notes: POST_NOTES, photos: [2, 6] } },
  { n: "06", address: "Greenvale Road reserve (north)", holders: [{ h: 3, role: "road_authority" }], chainage: "2+350", engineer: "Alex Nguyen",
    pre: { status: "complete", date: -170, surveyor: "Alex Nguyen", notes: "Road reserve: kerb, channel and culvert headwalls recorded.", photos: [7, 4], report: true },
    post: { status: "scheduled", date: 5, surveyor: "Alex Nguyen" } },
  { n: "07", address: "Greenvale Road reserve (south)", holders: [{ h: 3, role: "road_authority" }], chainage: "2+900", engineer: "Alex Nguyen",
    pre: { status: "complete", date: -165, surveyor: "Alex Nguyen", notes: "Road reserve: kerb and channel recorded.", photos: [7, 3], report: true },
    post: { status: "in_progress", date: 0, surveyor: "Sam Taylor" } },
  { n: "08", address: "8 Wattle Lane", holders: owner(4), chainage: "3+420", engineer: "Sam Taylor",
    pre: { status: "complete", date: -150, surveyor: "Sam Taylor", notes: PRE_NOTES, photos: [2, 1, 6], report: true } },
  { n: "09", address: "Hilltop Station (east paddock)", holders: owner(5), chainage: "4+100", engineer: "Alex Nguyen", status: "on_hold",
    notes: "On hold - access negotiation for alternative alignment.",
    pre: { status: "complete", date: -140, surveyor: "Alex Nguyen", notes: PRE_NOTES, photos: [5, 3], report: true } },
  { n: "10", address: "Hilltop Station (west paddock)", holders: owner(5), chainage: "4+780", engineer: "Alex Nguyen",
    pre: { status: "scheduled", date: 3, surveyor: "Alex Nguyen" } },
  { n: "11", address: "31 Ridge Road", holders: owner(6), chainage: "5+600", engineer: "Sam Taylor", notes: "Landholder prefers morning visits.",
    pre: { status: "scheduled", date: -2, surveyor: "Sam Taylor" } },
  { n: "12", address: "20 Depot Street", holders: owner(7), chainage: "6+400", engineer: "Sam Taylor" },
  // Street sections: the road reserve belongs to the council, with residences along the frontage.
  { n: "SL04", address: "Station Street (west) - road reserve and frontages", chainage: "7+100", engineer: "Alex Nguyen",
    notes: "Works in TRC road reserve. Residences surveyed where works are adjacent to their boundary.",
    holders: [
      { h: 8, role: "road_authority", property: "Station Street road reserve" },
      { h: 9, role: "adjacent_resident", property: "2 Station Street", damage: "Front fence panel struck by plant - replaced to match.", accepted: -6 },
      { h: 10, role: "adjacent_resident", property: "4 Station Street", damage: "Lawn and garden edging disturbed at driveway - returfed and edging reinstated." },
      { h: 11, role: "adjacent_resident", property: "6 Station Street" },
    ],
    pre: { status: "complete", date: -120, surveyor: "Alex Nguyen", report: true,
      notes: "Road reserve kerb, channel and footpath recorded. Frontages of 2, 4 and 6 Station Street recorded from the boundary.",
      photos: [7, 4, [0, 1], [6, 1], [1, 2], [3, 2], [2, 3]] },
    post: { status: "complete", date: -10, surveyor: "Alex Nguyen",
      notes: "Fence at No. 2 replaced. Turf and edging at No. 4 reinstated - acceptance requested. No change at No. 6. Road reserve as recorded.",
      photos: [7, [0, 1], [1, 2], [2, 3]] } },
  { n: "SL05", address: "Station Street (east) - road reserve and frontages", chainage: "7+450", engineer: "Sam Taylor",
    holders: [
      { h: 8, role: "road_authority", property: "Station Street road reserve" },
      { h: 12, role: "owner", property: "9 Station Street (units)" },
      { h: 13, role: "adjacent_resident", property: "11 Station Street" },
    ],
    pre: { status: "complete", date: -95, surveyor: "Sam Taylor", notes: "Road reserve and frontages of 9 and 11 Station Street recorded.", report: true,
      photos: [7, 4, [2, 1], [1, 1], [0, 2]] },
    post: { status: "in_progress", date: 0, surveyor: "Sam Taylor" } },
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
          chainage: plan.chainage,
          assigned_engineer: plan.engineer,
          notes: plan.notes ?? null,
          status: plan.status ?? "not_started",
        })
        .select("id")
        .single(),
    );

    const links: string[] = [];
    for (const link of plan.holders) {
      const created = need(
        await supabase
          .from("lot_landholders")
          .insert({
            lot_id: lot.id,
            landholder_id: ownerIds[link.h],
            role: link.role,
            property: link.property ?? null,
            restoration_required: Boolean(link.damage),
            damage_notes: link.damage ?? null,
          })
          .select("id")
          .single(),
      );
      links.push(created.id);
    }

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
      for (const photo of s.photos ?? []) {
        const [p, holder] = typeof photo === "number" ? [photo, undefined] : photo;
        const link = holder === undefined ? undefined : plan.holders[holder];
        await uploadFile(supabase, photos[p], {
          lotId: lot.id,
          lotNumber,
          category: type,
          surveyId,
          landholderId: link ? ownerIds[link.h] : null,
          caption: link?.property ? `${link.property} - ${PHOTOS[p][1]}` : PHOTOS[p][1],
        });
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

    for (const [k, link] of plan.holders.entries()) {
      if (link.accepted === undefined) continue;
      const holder = LANDHOLDERS[link.h];
      done(
        await supabase
          .from("lot_landholders")
          .update({ acceptance_date: day(link.accepted), acceptance_name: holder.name, acceptance_notes: "Signed acceptance of restoration received." })
          .eq("id", links[k]),
      );
      await uploadFile(supabase, acceptance, {
        lotId: lot.id,
        lotNumber,
        category: "closeout",
        landholderId: ownerIds[link.h],
        caption: `Signed acceptance of restoration - ${holder.name}`,
      });
    }

    if (plan.close) done(await supabase.from("lots").update({ status: "closed" }).eq("id", lot.id));
    if (plan.issued !== undefined) {
      // A copy prepared for the Principal on request, after close-out.
      const title = `Condition Report - Lot ${lotNumber}`;
      const attachmentId = await uploadFile(supabase, report, {
        lotId: lot.id,
        lotNumber,
        category: "reports",
        caption: title,
      });
      done(
        await supabase.from("issued_reports").insert({
          lot_id: lot.id,
          attachment_id: attachmentId,
          title,
          issued_to: "Principal",
          notes: "Copy requested by the Principal after close-out.",
          photo_count: 5,
        }),
      );
    }
  }
  progress("Done");
}
