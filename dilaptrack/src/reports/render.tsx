// Draws a report PDF in the browser. Loaded on demand (dynamic import) so
// react-pdf is only downloaded when someone asks for a report.
import { pdf } from "@react-pdf/renderer";
import type { PdfPhoto } from "./kit";
import { LotReport, ReinstatementReport, SummaryReport, SurveyReport } from "./reports";
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
      case "reinstatement":
        doc = <ReinstatementReport {...data} photos={data.photos && (await localise(data.photos, objectUrls))} />;
        break;
      case "summary":
        doc = <SummaryReport {...data} />;
        break;
    }
    return await pdf(doc).toBlob();
  } finally {
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
  }
}
