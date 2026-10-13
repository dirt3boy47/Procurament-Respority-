"use client";

import { useRouter } from "next/navigation";
import { createLot } from "@/actions/lots";
import type { LandholderOption } from "@/components/landholders/landholder-picker";
import { LotForm } from "@/components/lots/lot-form";

export function NewLotForm({ engineers, landholders }: { engineers: string[]; landholders: LandholderOption[] }) {
  const router = useRouter();
  return (
    <LotForm
      action={createLot}
      engineers={engineers}
      landholders={landholders}
      canAddLandholder
      submitLabel="Create lot"
      onSuccess={(result) => result.ok && result.id && router.push(`/lots/${result.id}`)}
    />
  );
}
