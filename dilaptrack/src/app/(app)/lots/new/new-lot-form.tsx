"use client";

import { useRouter } from "next/navigation";
import { createLot } from "@/actions/lots";
import { LotForm } from "@/components/lots/lot-form";

export function NewLotForm({ engineers }: { engineers: string[] }) {
  const router = useRouter();
  return (
    <LotForm
      action={createLot}
      engineers={engineers}
      submitLabel="Create lot"
      onSuccess={(result) => result.ok && result.id && router.push(`/lots/${result.id}`)}
    />
  );
}
