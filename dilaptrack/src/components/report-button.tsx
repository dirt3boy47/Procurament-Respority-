"use client";

import { Download, FileDown, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ReportData } from "@/reports/types";

type Variant = "primary" | "secondary" | "ghost";

/**
 * Builds a PDF report in the browser: fetches the report data (permission-checked
 * on the server), then draws the PDF with react-pdf and opens or downloads it.
 */
export function ReportButton({
  type,
  params = {},
  mode = "open",
  variant = "secondary",
  size = "md",
  disabled,
  className,
  children,
}: {
  type: "lot" | "survey" | "reinstatement" | "summary";
  params?: Record<string, string>;
  mode?: "open" | "download";
  variant?: Variant;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  async function run() {
    // Open the tab straight away (inside the click) so pop-up blockers allow it.
    const tab = mode === "open" ? window.open("", "_blank") : null;
    tab?.document.write("<p style='font:16px system-ui;padding:24px'>Preparing report…</p>");
    setBusy(true);
    try {
      const res = await fetch(`/api/reports/${type}?${new URLSearchParams(params)}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't load the report");
      const data = body as ReportData;
      const { renderReport } = await import("@/reports/render");
      const blob = await renderReport(data);
      const url = URL.createObjectURL(blob);
      if (tab) {
        tab.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = data.fileName;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      tab?.close();
      toast.error((e as Error).message || "Couldn't create the report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} size={size} onClick={run} disabled={busy || disabled} className={className}>
      {busy ? <Loader2 className="animate-spin" /> : mode === "open" ? <FileDown /> : <Download />}
      {busy ? "Preparing…" : children}
    </Button>
  );
}
