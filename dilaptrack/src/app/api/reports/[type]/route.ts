import type { NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { loadReport } from "@/reports/load";

/** Report data as JSON. The PDF itself is drawn in the browser (src/reports/render.tsx). */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/reports/[type]">) {
  const profile = await getProfile();
  if (!profile?.active) return Response.json({ error: "Please sign in to download reports." }, { status: 401 });

  const { type } = await ctx.params;
  const result = await loadReport(type, request.nextUrl.searchParams, profile);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.data, { headers: { "Cache-Control": "private, no-store" } });
}
