import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/shell/auth-card";
import { getProfile } from "@/lib/auth";
import { safeNext } from "@/lib/site-url";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  if (await getProfile()) redirect(next);

  return (
    <AuthCard title="Sign in" description="Property dilapidation surveys and close-out.">
      {params.error === "link" && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          That sign-in link has expired or was already used. Sign in, or request a new password reset link.
        </p>
      )}
      <LoginForm next={next} />
      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className="text-primary hover:underline">
          Forgot your password?
        </Link>
      </p>
      <p className="mt-6 text-center text-xs text-muted-fg">Accounts are created by your project administrator.</p>
    </AuthCard>
  );
}
