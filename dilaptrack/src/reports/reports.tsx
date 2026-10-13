// The PDF reports. Each takes plain data and returns a react-pdf document.
import { Text, View } from "@react-pdf/renderer";
import type { ChecklistItem } from "@/lib/closeout";
import { labelFor, LOT_STATUSES, SURVEY_STATUSES, SURVEY_TYPES } from "@/lib/constants";
import type { LotOverview } from "@/lib/data";
import type { Enums, Tables } from "@/lib/database.types";
import { formatDate } from "@/lib/format";
import { KeyValues, Notes, Photos, Report, Section, Stats, styles, Table, type PdfPhoto } from "./kit";

type Meta = { project: string; generatedBy: string };
type Survey = Tables<"surveys">;
type Landholder = Tables<"landholders">;

const surveyLabel = (t: Enums<"survey_type">) => SURVEY_TYPES.find((s) => s.value === t)?.label ?? t;

const surveyCell = (status: Enums<"survey_status">, date: string | null) =>
  `${labelFor(SURVEY_STATUSES, status)}${date ? `\n${formatDate(date)}` : ""}`;

function lotDetails(lot: LotOverview): [string, string | null][] {
  return [
    ["Lot number", lot.lot_number],
    ["Status", labelFor(LOT_STATUSES, lot.status)],
    ["Property address", lot.address],
    ["Chainage", lot.chainage],
    ["Landholder", lot.landholder_name],
    ["Landholder contact", [lot.landholder_phone, lot.landholder_email].filter(Boolean).join(" / ") || null],
    ["Assigned engineer", lot.assigned_engineer],
    ["Closed", lot.closed_at ? formatDate(lot.closed_at) : null],
  ];
}

function Acceptance({ lot }: { lot: LotOverview }) {
  return lot.landholder_signoff_date ? (
    <>
      <Text>
        Accepted by {lot.landholder_signoff_name ?? "the landholder"} on {formatDate(lot.landholder_signoff_date)}.
      </Text>
      <Notes text={lot.landholder_signoff_notes} />
    </>
  ) : (
    <Text style={styles.muted}>Not yet recorded.</Text>
  );
}

// ------------------------------------------------------------------ Lot report

type LotSectionProps = {
  lot: LotOverview;
  checklist: ChecklistItem[];
  surveys: (Survey & { fileCount: number })[];
  photos: { title: string; items: PdfPhoto[] }[];
};

/** Everything about one lot: shared by the Lot Report and the landholder pack. */
function LotSections({ lot, checklist, surveys, photos, heading }: LotSectionProps & { heading?: string }) {
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

      <Section title="Dilapidation surveys">
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
            String(s.fileCount),
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
      </Section>

      <Section title="Landholder acceptance">
        <Acceptance lot={lot} />
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
            ["Landholder", lot.landholder_name],
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
          ["Accepted", lots.filter((l) => l.landholder_signoff_date).length],
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
                { header: "Accepted", width: 15 },
                { header: "Status", width: 15 },
              ]}
              rows={lots.map((l) => [
                l.lot_number,
                l.address,
                surveyCell(l.pre_survey_status, l.pre_survey_date),
                surveyCell(l.post_survey_status, l.post_survey_date),
                l.landholder_signoff_date ? formatDate(l.landholder_signoff_date) : "No",
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
  const awaiting = lots.filter((l) => l.post_survey_status === "complete" && !l.landholder_signoff_date && l.status !== "closed");
  return (
    <Report title="Project Summary Report" landscape {...meta}>
      <Stats
        items={[
          ["Total lots", total],
          ["Pre-con surveys complete", pct(lots.filter((l) => l.pre_survey_status === "complete").length)],
          ["Post-con surveys complete", pct(lots.filter((l) => l.post_survey_status === "complete").length)],
          ["Awaiting acceptance", awaiting.length],
          ["Lots closed", pct(closed)],
          ["Lots outstanding", total - closed],
        ]}
      />
      <Section title="Lot register">
        <Table
          columns={[
            { header: "Lot", width: 8 },
            { header: "Address", width: 20 },
            { header: "Landholder", width: 15 },
            { header: "Chainage", width: 8 },
            { header: "Engineer", width: 11 },
            { header: "Pre-con", width: 10 },
            { header: "Post-con", width: 10 },
            { header: "Accepted", width: 9 },
            { header: "Status", width: 9 },
          ]}
          rows={lots.map((l) => [
            l.lot_number,
            l.address,
            l.landholder_name,
            l.chainage,
            l.assigned_engineer,
            surveyCell(l.pre_survey_status, l.pre_survey_date),
            surveyCell(l.post_survey_status, l.post_survey_date),
            l.landholder_signoff_date ? formatDate(l.landholder_signoff_date) : "No",
            labelFor(LOT_STATUSES, l.status),
          ])}
          empty="No lots."
        />
      </Section>
    </Report>
  );
}
