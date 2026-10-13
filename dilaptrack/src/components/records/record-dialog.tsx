"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { FileUploader } from "@/components/files/file-uploader";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Enums } from "@/lib/database.types";

/**
 * Add / edit dialog for defects and reinstatement items. After adding, the
 * dialog offers to upload photos for the new record straight away.
 */
export function RecordDialog({
  mode,
  title,
  lotId,
  lotNumber,
  category,
  renderForm,
}: {
  mode: "add" | "edit";
  title: string;
  lotId: string;
  lotNumber: string;
  category: Extract<Enums<"file_category">, "defects" | "reinstatement">;
  renderForm: (onSaved: (id?: string) => void) => ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setCreatedId(null);
    router.refresh();
  };

  return (
    <>
      {mode === "add" ? (
        <Button onClick={() => setOpen(true)}>
          <Plus /> {title}
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Pencil /> Edit
        </Button>
      )}
      <Dialog open={open} onClose={close} title={createdId ? "Add photos" : title} className="max-w-xl">
        {createdId ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-fg">Saved. Add photos now, or close and add them later.</p>
            <FileUploader
              lotId={lotId}
              lotNumber={lotNumber}
              category={category}
              defectId={category === "defects" ? createdId : undefined}
              reinstatementId={category === "reinstatement" ? createdId : undefined}
              accept="image/*,video/*,application/pdf"
              label="Drop photos here"
            />
            <div className="flex justify-end">
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          renderForm((id) => {
            if (mode === "add" && id) setCreatedId(id);
            else close();
          })
        )}
      </Dialog>
    </>
  );
}
