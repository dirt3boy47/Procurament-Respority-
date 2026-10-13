import type { Metadata } from "next";
import { AuthCard } from "@/components/shell/auth-card";
import { ConfirmLink } from "./confirm-link";

export const metadata: Metadata = { title: "Signing in" };

export default function ConfirmPage() {
  return (
    <AuthCard title="Signing you in…">
      <ConfirmLink />
    </AuthCard>
  );
}
