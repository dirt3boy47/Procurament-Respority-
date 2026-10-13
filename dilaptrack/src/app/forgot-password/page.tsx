import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/shell/auth-card";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password" description="We'll email you a link to choose a new password.">
      <ResetForm />
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
