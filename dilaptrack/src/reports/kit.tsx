// Building blocks shared by every PDF report (A4, Helvetica, no external fonts).
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";

export type PdfPhoto = { data: Buffer; format: "jpg" | "png"; caption: string };

const C = { ink: "#0f172a", muted: "#64748b", line: "#e2e8f0", soft: "#f1f5f9", brand: "#0f6cbd", ok: "#047857", bad: "#b91c1c" };

export const styles = StyleSheet.create({
  page: { paddingTop: 84, paddingBottom: 48, paddingHorizontal: 36, fontSize: 9, color: C.ink, fontFamily: "Helvetica" },
  header: { position: "absolute", top: 24, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 2, borderBottomColor: C.brand, paddingBottom: 6 },
  brand: { fontSize: 8, color: C.brand, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", lineHeight: 1.25 },
  headerMeta: { fontSize: 8, color: C.muted, textAlign: "right" },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 5 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6, color: C.brand },
  kvGrid: { flexDirection: "row", flexWrap: "wrap" },
  kv: { width: "50%", paddingRight: 8, marginBottom: 5 },
  kvLabel: { fontSize: 7, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  kvValue: { fontSize: 9.5, lineHeight: 1.35 },
  table: { borderTopWidth: 0.5, borderTopColor: C.line },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line },
  th: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: C.muted, backgroundColor: C.soft, paddingVertical: 4, paddingHorizontal: 4 },
  td: { paddingVertical: 4, paddingHorizontal: 4, fontSize: 8.5, lineHeight: 1.3 },
  note: { fontSize: 9, lineHeight: 1.4, color: C.ink, backgroundColor: C.soft, padding: 6, borderRadius: 3 },
  muted: { color: C.muted },
  ok: { color: C.ok, fontFamily: "Helvetica-Bold" },
  bad: { color: C.bad, fontFamily: "Helvetica-Bold" },
  photos: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  stat: { flexGrow: 1, flexBasis: 0, borderWidth: 0.5, borderColor: C.line, borderRadius: 4, padding: 8, marginRight: 6 },
  statValue: { fontSize: 18, fontFamily: "Helvetica-Bold", lineHeight: 1.2, marginBottom: 2 },
  statLabel: { fontSize: 7.5, color: C.muted, lineHeight: 1.3 },
});

export function Report({
  title,
  subtitle,
  project,
  generatedBy,
  landscape,
  children,
}: {
  title: string;
  subtitle?: string;
  project: string;
  generatedBy: string;
  landscape?: boolean;
  children: ReactNode;
}) {
  const generated = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
  return (
    <Document title={`${title}${subtitle ? ` - ${subtitle}` : ""}`} author={generatedBy} creator="DilapTrack" producer="DilapTrack">
      <Page size="A4" orientation={landscape ? "landscape" : "portrait"} style={styles.page}>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.brand}>{project.toUpperCase()}</Text>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={{ fontSize: 9, color: C.muted, lineHeight: 1.3 }}>{subtitle}</Text> : null}
          </View>
          <View>
            <Text style={styles.headerMeta}>Generated {generated}</Text>
            <Text style={styles.headerMeta}>by {generatedBy}</Text>
          </View>
        </View>
        {children}
        <View style={styles.footer} fixed>
          <Text>DilapTrack - {title}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export function Section({ title, children, breakBefore }: { title: string; children: ReactNode; breakBefore?: boolean }) {
  return (
    <View style={styles.section} break={breakBefore}>
      <Text style={styles.sectionTitle} minPresenceAhead={40}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function KeyValues({ items }: { items: [string, string | null | undefined][] }) {
  return (
    <View style={styles.kvGrid}>
      {items.map(([label, value]) => (
        <View key={label} style={styles.kv} wrap={false}>
          <Text style={styles.kvLabel}>{label}</Text>
          <Text style={styles.kvValue}>{value || "-"}</Text>
        </View>
      ))}
    </View>
  );
}

export type Column = { header: string; width: number };

/** Simple table; widths are relative weights. Rows never split across pages. */
export function Table({ columns, rows, empty = "None" }: { columns: Column[]; rows: (string | null | undefined)[][]; empty?: string }) {
  if (rows.length === 0) return <Text style={styles.muted}>{empty}</Text>;
  const total = columns.reduce((s, c) => s + c.width, 0);
  const w = (c: Column) => `${(c.width / total) * 100}%`;
  return (
    <View style={styles.table}>
      <View style={styles.tr} fixed>
        {columns.map((c) => (
          <Text key={c.header} style={[styles.th, { width: w(c) }]}>
            {c.header}
          </Text>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={styles.tr} wrap={false}>
          {columns.map((c, j) => (
            <Text key={c.header} style={[styles.td, { width: w(c) }]}>
              {row[j] || "-"}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function Photos({ photos, perRow = 3 }: { photos: PdfPhoto[]; perRow?: 2 | 3 | 4 }) {
  if (photos.length === 0) return <Text style={styles.muted}>No photos.</Text>;
  const width = `${100 / perRow}%`;
  const height = perRow === 2 ? 190 : perRow === 3 ? 125 : 92;
  return (
    <View style={styles.photos}>
      {photos.map((p, i) => (
        <View key={i} style={{ width, padding: 4 }} wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          <Image src={{ data: p.data, format: p.format }} style={{ width: "100%", height, objectFit: "contain", backgroundColor: C.soft }} />
          <Text style={{ fontSize: 7, color: C.muted, marginTop: 2 }}>{p.caption}</Text>
        </View>
      ))}
    </View>
  );
}

export function Stats({ items }: { items: [string, string | number][] }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 14 }}>
      {items.map(([label, value]) => (
        <View key={label} style={styles.stat}>
          <Text style={styles.statValue}>{String(value)}</Text>
          <Text style={styles.statLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

export function Notes({ text }: { text: string | null | undefined }) {
  return text ? <Text style={styles.note}>{text}</Text> : null;
}
