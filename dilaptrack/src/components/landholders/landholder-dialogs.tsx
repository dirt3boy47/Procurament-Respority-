"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Tables } from "@/lib/database.types";
import { LandholderForm } from "./landholder-form";

export function AddLandholderButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Add landholder
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add landholder">
        <LandholderForm
          onSaved={(saved) => {
            setOpen(false);
            router.push(`/landholders/${saved.id}`);
          }}
        />
      </Dialog>
    </>
  );
}

export function EditLandholderButton({ landholder }: { landholder: Tables<"landholders"> }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil /> Edit
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Edit ${landholder.name}`}>
        <LandholderForm
          landholder={landholder}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </Dialog>
    </>
  );
}
