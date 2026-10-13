"use client";

import { Download, ExternalLink } from "lucide-react";
import { useState, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox, Field, Select } from "@/components/ui/input";

export function ReportCard({
  type,
  icon,
  title,
  description,
  lots,
  needsLot,
  optionalLot,
  stages,
  outstandingFilter,
}: {
  type: string;
  icon: ReactNode;
  title: string;
  description: string;
  lots: { id: string; label: string }[];
  needsLot?: boolean;
  optionalLot?: boolean;
  stages?: boolean;
  outstandingFilter?: boolean;
}) {
  const [lot, setLot] = useState("");
  const [stage, setStage] = useState("");
  const [outstanding, setOutstanding] = useState(false);

  const params = new URLSearchParams();
  if (lot) params.set("lot", lot);
  if (stage) params.set("stage", stage);
  if (outstanding) params.set("status", "outstanding");
  const href = `/api/reports/${type}?${params}`;
  const disabled = needsLot && !lot;

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex gap-3">
          <div className="h-fit rounded-lg bg-primary/10 p-2 text-primary [&_svg]:size-5">
            {icon}
          </div>
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-fg">{description}</p>
          </div>
        </div>
        {(needsLot || optionalLot) && (
          <Field label="Lot" htmlFor={`${type}-lot`}>
            <Select id={`${type}-lot`} value={lot} onChange={(e) => setLot(e.target.value)}>
              <option value="">{needsLot ? "Choose a lot…" : "All lots"}</option>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {stages && (
          <Field label="Survey" htmlFor={`${type}-stage`}>
            <Select id={`${type}-stage`} value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">Pre- and post-construction</option>
              <option value="pre_construction">Pre-construction only</option>
              <option value="post_construction">Post-construction only</option>
            </Select>
          </Field>
        )}
        {outstandingFilter && (
          <Checkbox checked={outstanding} onChange={(e) => setOutstanding(e.target.checked)} label="Outstanding items only" />
        )}
        <div className="mt-auto flex flex-wrap gap-2">
          <a
            href={disabled ? undefined : href}
            target="_blank"
            rel="noopener"
            aria-disabled={disabled}
            className={buttonClasses("primary", "md", disabled ? "pointer-events-none opacity-50" : undefined)}
          >
            <ExternalLink /> Open PDF
          </a>
          <a
            href={disabled ? undefined : `${href}&download=1`}
            aria-disabled={disabled}
            className={buttonClasses("secondary", "md", disabled ? "pointer-events-none opacity-50" : undefined)}
          >
            <Download /> Download
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
