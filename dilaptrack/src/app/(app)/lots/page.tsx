import type { Metadata } from "next";
import { MapPinned, Plus, Upload } from "lucide-react";
import { LotRegister, type LotFilters } from "@/components/lots/lot-register";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth";
import { listLots } from "@/lib/data";

export const metadata: Metadata = { title: "Lots" };

export default async function LotsPage({ searchParams }: PageProps<"/lots">) {
  const { can } = await requireSession();
  const [lots, params] = await Promise.all([listLots(), searchParams]);
  const param = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const initial: LotFilters = {
    q: param("q"),
    status: param("status"),
    engineer: param("engineer"),
    pre: param("pre"),
    post: param("post"),
    sort: param("sort"),
  };

  const actions = can.manage && (
    <>
      <ButtonLink href="/lots/import" variant="secondary">
        <Upload /> Import
      </ButtonLink>
      <ButtonLink href="/lots/new">
        <Plus /> New lot
      </ButtonLink>
    </>
  );

  return (
    <>
      <PageHeader title="Lot register" description="Every property lot on the project and where it's up to." actions={actions} />
      {lots.length === 0 ? (
        <Card>
          <EmptyState icon={MapPinned} title="No lots yet" action={actions}>
            {can.manage ? "Import the lot register from Excel or CSV, or add lots one at a time." : "No lots have been added yet."}
          </EmptyState>
        </Card>
      ) : (
        // Re-mount when the URL filters change (e.g. a dashboard link) so the inputs reflect them.
        <LotRegister key={JSON.stringify(initial)} lots={lots} initial={initial} />
      )}
    </>
  );
}
