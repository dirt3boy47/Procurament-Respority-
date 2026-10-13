import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Kept as `middleware` (Edge runtime) rather than Next 16's `proxy` (Node.js
// runtime) because Edge middleware is what OpenNext supports on Cloudflare Workers.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static files and images.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
