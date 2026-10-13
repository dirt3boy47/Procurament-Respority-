import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth";
import { labelFor, ROLES } from "@/lib/constants";
import { NameForm, PasswordForm } from "./account-forms";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const { profile } = await requireSession();
  return (
    <div className="max-w-2xl">
      <PageHeader title="My account" description={`${profile.email} · ${labelFor(ROLES, profile.role)}`} />
      <div className="space-y-5">
        <Card>
          <CardHeader title="Your name" description="Shown on records you create and in the audit log." />
          <CardContent>
            <NameForm name={profile.full_name} />
          </CardContent>
        </Card>
        <Card id="password">
          <CardHeader title="Password" />
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
