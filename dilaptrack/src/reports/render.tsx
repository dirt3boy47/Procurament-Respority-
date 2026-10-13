// Draws a report PDF in the browser. Loaded on demand (dynamic import) so
// react-pdf is only downloaded when someone asks for a report.
import { pdf } from "@react-pdf/renderer";
import type { PdfPhoto } from "./kit";
import type { PackDocument } from "./reports";
import { LandholderReport, LotReport, SummaryReport, SurveyReport } from "./reports";
import type { ReportData } from "./types";

/** Download photos up front (6 at a time). Photos that fail to load are left out. */
async function localise(photos: PdfPhoto[], objectUrls: string[]): Promise<PdfPhoto[]> {
  const out: (PdfPhoto | null)[] = new Array(photos.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < photos.length) {
      const i = next++;
      try {
        const res = await fetch(photos[i].src);
        if (!res.ok) continue;
        const url = URL.createObjectURL(await res.blob());
        objectUrls.push(url);
        out[i] = { ...photos[i], src: url };
      } catch {
        // skip this photo
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  return out.filter((p): p is PdfPhoto => p !== null);
}

export async function renderReport(data: ReportData): Promise<Blob> {
  const objectUrls: string[] = [];
  try {
    let doc;
    switch (data.type) {
      case "lot": {
        const photos = await Promise.all(data.photos.map(async (g) => ({ ...g, items: await localise(g.items, objectUrls) })));
        doc = <LotReport {...data} photos={photos} />;
        break;
      }
      case "survey": {
        const stages = await Promise.all(data.stages.map(async (s) => ({ ...s, photos: await localise(s.photos, objectUrls) })));
        doc = <SurveyReport {...data} stages={stages} />;
        break;
      }
      case "landholder": {
        const pack = data.pack && {
          ...data.pack,
          lots: await Promise.all(
            data.pack.lots.map(async (l) => ({
              ...l,
              photos: await Promise.all(l.photos.map(async (g) => ({ ...g, items: await localise(g.items, objectUrls) }))),
            })),
          ),
        };
        doc = <LandholderReport {...data} pack={pack} />;
        break;
      }
      case "summary":
        doc = <SummaryReport {...data} />;
        break;
    }
    const blob = await pdf(doc).toBlob();
    if (data.type === "landholder" && data.pack?.documents.length) {
      return await appendDocuments(blob, data.pack.documents);
    }
    return blob;
  } finally {
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
  }
}

/**
 * Append uploaded PDFs (survey reports, signed forms) to a report, labelling each
 * appended page with its appendix reference. Documents that can't be read are
 * listed on a final page instead of failing the whole report.
 */
async function appendDocuments(report: Blob, documents: PackDocument[]): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const merged = await PDFDocument.load(await report.arrayBuffer());
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const skipped: string[] = [];

  for (const [i, doc] of documents.entries()) {
    const label = `Appendix A${i + 1} - Lot ${doc.lotNumber} - ${doc.folder} - ${doc.fileName}`;
    try {
      const res = await fetch(doc.src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const source = await PDFDocument.load(await res.arrayBuffer(), { ignoreEncryption: true });
      const pages = await merged.copyPages(source, source.getPageIndices());
      for (const page of pages) {
        merged.addPage(page);
        const { width, height } = page.getSize();
        page.drawRectangle({ x: 0, y: height - 18, width, height: 18, color: rgb(1, 1, 1), opacity: 0.85 });
        page.drawText(label.replace(/[^\x20-\x7e]/g, "?").slice(0, 120), {
          x: 12,
          y: height - 13,
          size: 8,
          font,
          color: rgb(0.06, 0.42, 0.74),
        });
      }
    } catch {
      skipped.push(label);
    }
  }

  if (skipped.length) {
    const page = merged.addPage();
    const { height } = page.getSize();
    page.drawText("Documents that could not be attached", { x: 40, y: height - 60, size: 14, font });
    skipped.forEach((line, i) =>
      page.drawText(line.replace(/[^\x20-\x7e]/g, "?").slice(0, 110), { x: 40, y: height - 90 - i * 16, size: 9, font }),
    );
  }

  return new Blob([new Uint8Array(await merged.save())], { type: "application/pdf" });
}
