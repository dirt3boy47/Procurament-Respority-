"use client";

import type { Tables } from "@/lib/database.types";
import { DefectForm } from "./defect-form";
import { RecordDialog } from "./record-dialog";
import { ReinstatementForm } from "./reinstatement-form";

type LotRef = { lotId: string; lotNumber: string };

export function DefectDialog({ lotId, lotNumber, defect, names }: LotRef & { defect?: Tables<"defects">; names: string[] }) {
  return (
    <RecordDialog
      mode={defect ? "edit" : "add"}
      title={defect ? "Edit defect" : "Add defect"}
      lotId={lotId}
      lotNumber={lotNumber}
      category="defects"
      renderForm={(onSaved) => <DefectForm lotId={lotId} defect={defect} names={names} onSaved={onSaved} />}
    />
  );
}

export function ReinstatementDialog({ lotId, lotNumber, item }: LotRef & { item?: Tables<"reinstatement_items"> }) {
  return (
    <RecordDialog
      mode={item ? "edit" : "add"}
      title={item ? "Edit reinstatement item" : "Add reinstatement item"}
      lotId={lotId}
      lotNumber={lotNumber}
      category="reinstatement"
      renderForm={(onSaved) => <ReinstatementForm lotId={lotId} item={item} onSaved={onSaved} />}
    />
  );
}
