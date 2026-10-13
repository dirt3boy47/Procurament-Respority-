"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Completes sign-in from an email link (invite, password reset, magic link).
 * Handles all three link styles Supabase can send:
 *   ?token_hash=…&type=…   (recommended email templates, see README)
 *   ?code=…                (PKCE, same browser that asked for the link)
 *   #access_token=…        (default invite emails)
 */
export function ConfirmLink() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_KEY, {
      isSingleton: false,
      auth: { detectSessionInUrl: false },
    });
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const type = (query.get("type") ?? hash.get("type")) as EmailOtpType | null;
    const nextParam = query.get("next");
    const next =
      type === "invite" || type === "recovery"
        ? "/account/password"
        : nextParam?.startsWith("/") && !nextParam.startsWith("//")
          ? nextParam
          : "/";

    async function run() {
      const tokenHash = query.get("token_hash");
      const code = query.get("code");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const linkError = query.get("error_description") ?? hash.get("error_description");

      if (linkError) return linkError;
      if (tokenHash && type) return (await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error?.message;
      if (code) return (await supabase.auth.exchangeCodeForSession(code)).error?.message;
      if (accessToken && refreshToken) {
        return (await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })).error?.message;
      }
      return "This link is incomplete.";
    }

    run().then((message) => {
      if (message) setError(message);
      else window.location.replace(next);
    });
  }, []);

  if (!error) return <p className="text-sm text-muted-fg">Please wait a moment.</p>;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-red-600 dark:text-red-400">{error}</p>
      <p>The link may have expired or already been used.</p>
      <p>
        <Link href="/forgot-password" className="text-primary hover:underline">
          Request a new link
        </Link>{" "}
        or{" "}
        <Link href="/login" className="text-primary hover:underline">
          sign in
        </Link>
        .
      </p>
    </div>
  );
}
