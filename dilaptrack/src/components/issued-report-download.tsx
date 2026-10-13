"use client";

import { Download } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { downloadUrl } from "@/actions/records";
import { Button } from "@/components/ui/button";

/** Download a stored PDF (issued report) through a short-lived signed link. */
export function IssuedReportDownload({ attachmentId, label = "Download" }: { attachmentId: string; label?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await downloadUrl(attachmentId);
          if (res.url) window.location.href = res.url;
          else toast.error(res.error ?? "Download failed");
        })
      }
    >
      <Download /> {label}
    </Button>
  );
}
