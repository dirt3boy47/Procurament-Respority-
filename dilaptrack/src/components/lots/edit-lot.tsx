"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateLot } from "@/actions/lots";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { LandholderOption } from "@/components/landholders/landholder-picker";
import type { Tables } from "@/lib/database.types";
import { LotForm } from "./lot-form";

export function EditLotButton({
  lot,
  engineers,
  landholders,
}: {
  lot: Tables<"lots">;
  engineers: string[];
  landholders: LandholderOption[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil /> Edit
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Edit lot ${lot.lot_number}`} className="max-w-2xl">
        <LotForm
          action={(fd) => updateLot(lot.id, fd)}
          lot={lot}
          engineers={engineers}
          landholders={landholders}
          canAddLandholder
          submitLabel="Save changes"
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </Dialog>
    </>
  );
}
