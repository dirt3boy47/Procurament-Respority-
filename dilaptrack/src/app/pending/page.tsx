import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOut } from "@/actions/auth";
import { AuthCard } from "@/components/shell/auth-card";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Awaiting access" };

export default async function PendingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.active) redirect("/");
  return (
    <AuthCard title="Awaiting access">
      <p className="text-sm">
        You&apos;re signed in as <strong>{profile.email}</strong>, but your account hasn&apos;t been given access yet. Ask
        your project administrator to activate it.
      </p>
      <form action={signOut} className="mt-5">
        <Button type="submit" variant="secondary" className="w-full">
          Sign out
        </Button>
      </form>
    </AuthCard>
  );
}
