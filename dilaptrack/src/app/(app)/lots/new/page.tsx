import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireCapability } from "@/lib/auth";
import { teamNames } from "@/lib/data";
import { NewLotForm } from "./new-lot-form";

export const metadata: Metadata = { title: "New lot" };

export default async function NewLotPage() {
  await requireCapability("manage");
  return (
    <div className="max-w-3xl">
      <PageHeader title="New lot" description="Pre- and post-construction survey records are created automatically." />
      <Card>
        <CardContent>
          <NewLotForm engineers={await teamNames()} />
        </CardContent>
      </Card>
    </div>
  );
}
