import { renderToBuffer } from "@react-pdf/renderer";
import type { NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { buildReport } from "@/reports/build";

// Photo-heavy survey reports can take a while to assemble.
export const maxDuration = 60;

export async function GET(request: NextRequest, ctx: RouteContext<"/api/reports/[type]">) {
  const profile = await getProfile();
  if (!profile?.active) return new Response("Please sign in to download reports.", { status: 401 });

  const { type } = await ctx.params;
  const built = await buildReport(type, request.nextUrl.searchParams, profile);
  if ("error" in built) return new Response(built.error, { status: built.status });

  const pdf = await renderToBuffer(built.document);
  const download = request.nextUrl.searchParams.get("download") === "1";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${built.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
