import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireCapability } from "@/lib/auth";
import { hasAdminKey } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { InviteForm, UserRow } from "./user-forms";

export const metadata: Metadata = { title: "Users" };

const ROLE_HELP = [
  ["Administrator", "Everything, including managing users."],
  ["Project Manager", "View and manage all records: lot register, import, landholder acceptance, close-out, deletions."],
  ["Site Engineer", "Fill in surveys, upload photos and documents, record and update defects and reinstatement."],
  ["Read Only", "View everything and download reports."],
];

export default async function UsersPage() {
  const { profile: me } = await requireCapability("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("active").order("full_name");
  const users = data ?? [];
  const pending = users.filter((u) => !u.active).length;

  return (
    <>
      <PageHeader
        title="Users"
        description={pending ? `${pending} account${pending === 1 ? "" : "s"} without access.` : "Who can use DilapTrack, and what they can do."}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Team" />
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <UserRow key={u.id} user={u} isMe={u.id === me.id} />
            ))}
          </ul>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Invite someone" description="They'll get an email to set a password." />
            <CardContent>
              {hasAdminKey() ? (
                <InviteForm />
              ) : (
                <p className="text-sm text-muted-fg">
                  To invite from here, set <code className="text-xs">SUPABASE_SECRET_KEY</code> in the server environment.
                  Meanwhile, invite people from Supabase → Authentication → Users, then give them access on this page.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Roles" />
            <CardContent>
              <dl className="space-y-3 text-sm">
                {ROLE_HELP.map(([role, help]) => (
                  <div key={role}>
                    <dt className="font-medium">{role}</dt>
                    <dd className="text-muted-fg">{help}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
