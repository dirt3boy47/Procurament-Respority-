// The PDF reports. Each takes plain data and returns a react-pdf document.
import { Text, View } from "@react-pdf/renderer";
import type { ChecklistItem } from "@/lib/closeout";
import { LANDHOLDER_ROLES, labelFor, LOT_STATUSES, SURVEY_STATUSES, SURVEY_TYPES } from "@/lib/constants";
import type { LotOverview } from "@/lib/data";
import type { Enums, Tables } from "@/lib/database.types";
import { formatDate } from "@/lib/format";
import { KeyValues, Notes, Photos, Report, Section, Stats, styles, Table, type PdfPhoto } from "./kit";

type Meta = { project: string; generatedBy: string };
type Survey = Tables<"surveys">;
type Landholder = Tables<"landholders">;

/** A landholder's part in a lot, for reports. */
export type ReportLandholder = {
  name: string;
  role: Enums<"landholder_role">;
  property: string | null;
  phone: string | null;
  email: string | null;
  restoration_required: boolean;
  damage_notes: string | null;
  acceptance_date: string | null;
  acceptance_name: string | null;
  acceptance_notes: string | null;
};

const surveyLabel = (t: Enums<"survey_type">) => SURVEY_TYPES.find((s) => s.value === t)?.label ?? t;

const surveyCell = (status: Enums<"survey_status">, date: string | null) =>
  `${labelFor(SURVEY_STATUSES, status)}${date ? `\n${formatDate(date)}` : ""}`;

/** "None", "1 of 2 accepted"... for a lot's restoration hold points. */
const holdPointCell = (l: LotOverview) =>
  l.restorations === 0 ? "None" : `${l.restorations - l.acceptances_outstanding} of ${l.restorations} accepted`;

function lotDetails(lot: LotOverview): [string, string | null][] {
  return [
    ["Lot number", lot.lot_number],
    ["Status", labelFor(LOT_STATUSES, lot.status)],
    ["Property address", lot.address],
    ["Chainage", lot.chainage],
    ["Landholders", lot.landholder_names],
    ["Assigned engineer", lot.assigned_engineer],
    ["Closed", lot.closed_at ? formatDate(lot.closed_at) : null],
  ];
}

const acceptanceCell = (l: ReportLandholder) =>
  l.acceptance_date
    ? `Accepted ${formatDate(l.acceptance_date)}${l.acceptance_name ? `\nby ${l.acceptance_name}` : ""}`
    : l.restoration_required
      ? "OUTSTANDING (hold point)"
      : "Not required";

/** Landholders on a lot with the damage recorded and the written acceptance (hold point) status. */
function LandholdersTable({ landholders }: { landholders: ReportLandholder[] }) {
  return (
    <>
      <Table
        columns={[
          { header: "Landholder", width: 24 },
          { header: "Role", width: 14 },
          { header: "Property", width: 18 },
          { header: "Contact", width: 20 },
          { header: "Written acceptance", width: 24 },
        ]}
        rows={landholders.map((l) => [
          l.name,
          labelFor(LANDHOLDER_ROLES, l.role),
          l.property,
          [l.phone, l.email].filter(Boolean).join("\n"),
          acceptanceCell(l),
        ])}
        empty="No landholders linked."
      />
      {landholders
        .filter((l) => l.restoration_required && l.damage_notes)
        .map((l) => (
          <View key={l.name} style={{ marginTop: 6 }} wrap={false}>
            <Text style={styles.kvLabel}>Damage restored - {l.name}</Text>
            <Notes text={l.damage_notes} />
          </View>
        ))}
    </>
  );
}

function SurveysTable({ surveys }: { surveys: (Survey & { fileCount?: number })[] }) {
  return (
    <>
      <Table
        columns={[
          { header: "Survey", width: 30 },
          { header: "Status", width: 15 },
          { header: "Date", width: 15 },
          { header: "Surveyor", width: 25 },
          { header: "Files", width: 15 },
        ]}
        rows={surveys.map((s) => [
          surveyLabel(s.survey_type),
          labelFor(SURVEY_STATUSES, s.status),
          formatDate(s.survey_date),
          s.surveyor,
          s.fileCount === undefined ? "" : String(s.fileCount),
        ])}
      />
      {surveys
        .filter((s) => s.notes)
        .map((s) => (
          <View key={s.id} style={{ marginTop: 6 }}>
            <Text style={styles.kvLabel}>{surveyLabel(s.survey_type)} notes</Text>
            <Notes text={s.notes} />
          </View>
        ))}
    </>
  );
}

// ------------------------------------------------------------------ Lot report

type LotSectionProps = {
  lot: LotOverview;
  checklist: ChecklistItem[];
  landholders: ReportLandholder[];
  surveys: (Survey & { fileCount: number })[];
  photos: { title: string; items: PdfPhoto[] }[];
};

/** Everything about one lot: shared by the Lot Report and the landholder pack. */
function LotSections({ lot, checklist, landholders, surveys, photos, heading }: LotSectionProps & { heading?: string }) {
  return (
    <>
      <Section title={heading ?? "Lot details"}>
        <KeyValues items={lotDetails(lot)} />
        <Notes text={lot.notes} />
      </Section>

      <Section title="Close-out status">
        <Table
          columns={[
            { header: "Condition", width: 50 },
            { header: "Result", width: 15 },
            { header: "Detail", width: 35 },
          ]}
          rows={checklist.map((c) => [c.label, c.done ? "Met" : "Outstanding", c.detail])}
        />
      </Section>

      <Section title="Landholders and written acceptance">
        <LandholdersTable landholders={landholders} />
      </Section>

      <Section title="Dilapidation surveys">
        <SurveysTable surveys={surveys} />
      </Section>

      {photos
        .filter((g) => g.items.length)
        .map((g) => (
          <Section key={g.title} title={g.title}>
            <Photos photos={g.items} perRow={3} />
          </Section>
        ))}
    </>
  );
}

export function LotReport({ meta, ...lot }: LotSectionProps & { meta: Meta }) {
  return (
    <Report title={`Lot Report - Lot ${lot.lot.lot_number}`} subtitle={lot.lot.address ?? undefined} {...meta}>
      <LotSections {...lot} />
    </Report>
  );
}

// ------------------------------------------------------------------ Dilapidation survey report

export function SurveyReport({
  meta,
  lot,
  stages,
}: {
  meta: Meta;
  lot: LotOverview;
  stages: { survey: Survey; photos: PdfPhoto[]; photoCount: number; otherFiles: { name: string; kind: string; date: string }[] }[];
}) {
  return (
    <Report
      title={`Dilapidation Survey Report - Lot ${lot.lot_number}`}
      subtitle={stages.map((s) => surveyLabel(s.survey.survey_type)).join(" and ")}
      {...meta}
    >
      <Section title="Property">
        <KeyValues
          items={[
            ["Lot number", lot.lot_number],
            ["Chainage", lot.chainage],
            ["Property address", lot.address],
            ["Landholders", lot.landholder_names],
          ]}
        />
      </Section>
      {stages.map(({ survey, photos, photoCount, otherFiles }, i) => (
        <View key={survey.id} break={i > 0}>
          <Section title={surveyLabel(survey.survey_type)}>
            <KeyValues
              items={[
                ["Status", labelFor(SURVEY_STATUSES, survey.status)],
                ["Survey date", formatDate(survey.survey_date)],
                ["Surveyor", survey.surveyor],
                ["Photos", String(photoCount)],
              ]}
            />
            <Notes text={survey.notes} />
          </Section>
          {otherFiles.length > 0 && (
            <Section title="Videos and documents">
              <Table
                columns={[
                  { header: "File", width: 60 },
                  { header: "Type", width: 20 },
                  { header: "Uploaded", width: 20 },
                ]}
                rows={otherFiles.map((f) => [f.name, f.kind, f.date])}
              />
            </Section>
          )}
          <Section title="Photographic record">
            <Photos photos={photos} perRow={2} />
            {photoCount > photos.length && (
              <Text style={[styles.muted, { marginTop: 4 }]}>
                Showing {photos.length} of {photoCount} photos. All originals are held in DilapTrack.
              </Text>
            )}
          </Section>
        </View>
      ))}
    </Report>
  );
}

// ------------------------------------------------------------------ Landholder report

/** A PDF uploaded to one of the landholder's lots, appended to the pack. */
export type PackDocument = { src: string; lotNumber: string; folder: string; fileName: string; caption: string | null };

export function LandholderReport({
  meta,
  groups,
  pack,
}: {
  meta: Meta;
  groups: { landholder: Landholder; lots: LotOverview[] }[];
  /** For a single landholder: every lot in full, plus the uploaded PDFs appended after this document. */
  pack?: { lots: LotSectionProps[]; documents: PackDocument[] };
}) {
  const lots = groups.flatMap((g) => g.lots);
  return (
    <Report title="Landholder Report" subtitle={groups.length === 1 ? groups[0].landholder.name : undefined} {...meta}>
      <Stats
        items={[
          ["Landholders", groups.length],
          ["Lots", lots.length],
          ["Awaiting acceptance", lots.filter((l) => l.acceptances_outstanding > 0).length],
          ["Closed", lots.filter((l) => l.status === "closed").length],
        ]}
      />
      {groups.length === 0 && <Text style={styles.muted}>No landholders.</Text>}
      {groups.map(({ landholder, lots }) => (
        <Section key={landholder.id} title={landholder.name}>
          <KeyValues
            items={[
              ["Phone", landholder.phone],
              ["Email", landholder.email],
              ["Postal address", landholder.postal_address],
              ["Lots", String(lots.length)],
            ]}
          />
          <Notes text={landholder.notes} />
          <View style={{ marginTop: 6 }}>
            <Table
              columns={[
                { header: "Lot", width: 12 },
                { header: "Address", width: 28 },
                { header: "Pre-con", width: 15 },
                { header: "Post-con", width: 15 },
                { header: "Hold points", width: 15 },
                { header: "Status", width: 15 },
              ]}
              rows={lots.map((l) => [
                l.lot_number,
                l.address,
                surveyCell(l.pre_survey_status, l.pre_survey_date),
                surveyCell(l.post_survey_status, l.post_survey_date),
                holdPointCell(l),
                labelFor(LOT_STATUSES, l.status),
              ])}
              empty="No lots."
            />
          </View>
        </Section>
      ))}

      {pack?.lots.map((l) => (
        <View key={l.lot.id} break>
          <LotSections {...l} heading={`Lot ${l.lot.lot_number}${l.lot.address ? ` - ${l.lot.address}` : ""}`} />
        </View>
      ))}

      {pack && pack.documents.length > 0 && (
        <View break>
          <Section title="Appendix - attached documents">
            <Text style={[styles.muted, { marginBottom: 6 }]}>
              The following documents uploaded to these lots are attached after this page, in this order.
            </Text>
            <Table
              columns={[
                { header: "Ref", width: 8 },
                { header: "Lot", width: 14 },
                { header: "Folder", width: 20 },
                { header: "Document", width: 58 },
              ]}
              rows={pack.documents.map((d, i) => [
                `A${i + 1}`,
                d.lotNumber,
                d.folder,
                d.caption ? `${d.caption} (${d.fileName})` : d.fileName,
              ])}
            />
          </Section>
        </View>
      )}
    </Report>
  );
}

// ------------------------------------------------------------------ Project summary

export function SummaryReport({ meta, lots }: { meta: Meta; lots: LotOverview[] }) {
  const total = lots.length;
  const pct = (n: number) => (total ? `${n} (${Math.round((n / total) * 100)}%)` : "0");
  const closed = lots.filter((l) => l.status === "closed").length;
  const awaiting = lots.filter((l) => l.acceptances_outstanding > 0 && l.status !== "closed");
  return (
    <Report title="Project Summary Report" landscape {...meta}>
      <Stats
        items={[
          ["Total lots", total],
          ["Pre-con surveys complete", pct(lots.filter((l) => l.pre_survey_status === "complete").length)],
          ["Post-con surveys complete", pct(lots.filter((l) => l.post_survey_status === "complete").length)],
          ["Lots awaiting acceptance", awaiting.length],
          ["Lots closed", pct(closed)],
          ["Lots outstanding", total - closed],
        ]}
      />
      <Section title="Lot register">
        <Table
          columns={[
            { header: "Lot", width: 8 },
            { header: "Address", width: 20 },
            { header: "Landholders", width: 15 },
            { header: "Chainage", width: 8 },
            { header: "Engineer", width: 11 },
            { header: "Pre-con", width: 10 },
            { header: "Post-con", width: 10 },
            { header: "Hold points", width: 9 },
            { header: "Status", width: 9 },
          ]}
          rows={lots.map((l) => [
            l.lot_number,
            l.address,
            l.landholder_names,
            l.chainage,
            l.assigned_engineer,
            surveyCell(l.pre_survey_status, l.pre_survey_date),
            surveyCell(l.post_survey_status, l.post_survey_date),
            holdPointCell(l),
            labelFor(LOT_STATUSES, l.status),
          ])}
          empty="No lots."
        />
      </Section>
    </Report>
  );
}

// ------------------------------------------------------------------ Custom condition report

export type CustomReportProps = {
  meta: Meta;
  title: string;
  issuedTo: string | null;
  introduction: string | null;
  lot: LotOverview;
  /** Landholder the report is about (null = the whole lot). */
  landholder: ReportLandholder | null;
  include: { details: boolean; landholders: boolean; surveys: boolean };
  landholders: ReportLandholder[];
  surveys: Survey[];
  photos: (PdfPhoto & { group: string })[];
};

/** A report put together on request, with hand-picked photos. */
export function CustomReport({ meta, title, issuedTo, introduction, lot, landholder, include, landholders, surveys, photos }: CustomReportProps) {
  const groups = [...new Set(photos.map((p) => p.group))];
  return (
    <Report
      title={title}
      subtitle={[`Lot ${lot.lot_number}`, lot.address, landholder?.name].filter(Boolean).join(" - ")}
      {...meta}
    >
      <Section title="Report">
        <KeyValues
          items={[
            ["Prepared for", issuedTo],
            ["Lot", `${lot.lot_number}${lot.chainage ? ` (CH ${lot.chainage})` : ""}`],
            ["Landholder", landholder ? `${landholder.name}${landholder.property ? ` - ${landholder.property}` : ""}` : "Whole lot"],
            ["Photographs", String(photos.length)],
          ]}
        />
        <Notes text={introduction} />
      </Section>

      {include.details && (
        <Section title="Lot details">
          {/* A report for one landholder doesn't name the lot's other landholders. */}
          <KeyValues items={landholder ? lotDetails(lot).filter(([k]) => k !== "Landholders") : lotDetails(lot)} />
          <Notes text={lot.notes} />
        </Section>
      )}

      {include.landholders && (
        <Section title={landholder ? "Landholder and written acceptance" : "Landholders and written acceptance"}>
          <LandholdersTable landholders={landholder ? [landholder] : landholders} />
        </Section>
      )}

      {include.surveys && (
        <Section title="Dilapidation surveys">
          <SurveysTable surveys={surveys} />
        </Section>
      )}

      {groups.map((g, i) => (
        <Section key={g} title={g} breakBefore={i === 0 && (include.details || include.landholders || include.surveys)}>
          <Photos photos={photos.filter((p) => p.group === g)} perRow={2} />
        </Section>
      ))}
    </Report>
  );
}
