"use client";

import { Database, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removeDemoData } from "@/actions/demo";
import { Button } from "@/components/ui/button";
import { loadDemoData } from "@/lib/demo";
import { createClient } from "@/lib/supabase/client";

/** Load or remove demo data (administrators). */
export function DemoData({ loaded }: { loaded: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();
  const busy = status !== null || removing;

  async function load() {
    if (!confirm("Add 12 demo lots (DEMO-01 to DEMO-12) and 8 demo landholders, with sample photos and documents?")) return;
    setStatus("Starting…");
    try {
      await loadDemoData(createClient(), setStatus);
      toast.success("Demo data loaded");
      router.push("/");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message || "Couldn't load demo data");
    } finally {
      setStatus(null);
    }
  }

  function remove() {
    if (!confirm("Remove all DEMO- lots, their files, and the demo landholders?")) return;
    startRemove(async () => {
      const res = await removeDemoData();
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-fg">
        Twelve lots (DEMO-01 to DEMO-12) at every stage, from not started to closed. They include landholders, survey
        notes, sample photos, survey reports and signed acceptance forms, so you can try the workflow and the PDF
        reports.
      </p>
      {status && (
        <p className="flex items-center gap-2 text-primary" aria-live="polite">
          <Loader2 className="size-4 animate-spin" /> {status}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={load} disabled={busy || loaded}>
          <Database /> Load demo data
        </Button>
        <Button variant="secondary" onClick={remove} disabled={busy || !loaded}>
          {removing ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove demo data
        </Button>
      </div>
      {loaded && <p className="text-xs text-muted-fg">Demo data is loaded.</p>}
    </div>
  );
}
