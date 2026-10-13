import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { SetPassword } from "./set-password";

export const metadata: Metadata = { title: "Choose a password" };

/** Landing page after accepting an invite or a password-reset link. */
export default async function SetPasswordPage() {
  const { profile } = await requireSession();
  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader title="Choose a password" description={`Signed in as ${profile.email}. Set a password for next time.`} />
        <CardContent>
          <SetPassword />
        </CardContent>
      </Card>
    </div>
  );
}
