import { FileUploader } from "@/components/files/file-uploader";
import { Gallery } from "@/components/files/gallery";
import type { Session } from "@/lib/auth";
import type { AttachmentView } from "@/lib/data";
import type { Enums } from "@/lib/database.types";

/** Upload area plus files grouped into photos, videos and documents. */
export function FileSection({
  session,
  files,
  lotId,
  lotNumber,
  category,
  surveyId,
  locked,
}: {
  session: Session;
  files: AttachmentView[];
  lotId: string;
  lotNumber: string;
  category: Enums<"file_category">;
  surveyId?: string;
  locked: boolean;
}) {
  const permissions = { userId: session.profile.id, canEdit: session.can.editRecords && !locked, canManage: session.can.manage && !locked };
  const groups = [
    { title: "Photos", items: files.filter((f) => f.kind === "photo") },
    { title: "Videos", items: files.filter((f) => f.kind === "video") },
    { title: "Reports & documents", items: files.filter((f) => f.kind === "document") },
  ];
  return (
    <div className="space-y-5">
      {session.can.editRecords && !locked && (
        <FileUploader lotId={lotId} lotNumber={lotNumber} category={category} surveyId={surveyId} />
      )}
      {files.length === 0 ? (
        <p className="text-sm text-muted-fg">No files uploaded yet.</p>
      ) : (
        groups
          .filter((g) => g.items.length)
          .map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-sm font-semibold">
                {g.title} <span className="font-normal text-muted-fg">({g.items.length})</span>
              </h3>
              <Gallery items={g.items} permissions={permissions} />
            </div>
          ))
      )}
    </div>
  );
}
