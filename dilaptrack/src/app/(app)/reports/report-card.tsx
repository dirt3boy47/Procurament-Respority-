"use client";

import { useState, type ReactNode } from "react";
import { ReportButton } from "@/components/report-button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/input";

export function ReportCard({
  type,
  icon,
  title,
  description,
  lots,
  needsLot,
  optionalLot,
  stages,
  lotLabel = "Lot",
  lotParam = "lot",
}: {
  type: "lot" | "survey" | "landholder" | "summary";
  icon: ReactNode;
  title: string;
  description: string;
  lots: { id: string; label: string }[];
  needsLot?: boolean;
  optionalLot?: boolean;
  stages?: boolean;
  lotLabel?: string;
  lotParam?: string;
}) {
  const [lot, setLot] = useState("");
  const [stage, setStage] = useState("");

  const params: Record<string, string> = {};
  if (lot) params[lotParam] = lot;
  if (stage) params.stage = stage;
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
          <Field label={lotLabel} htmlFor={`${type}-lot`}>
            <Select id={`${type}-lot`} value={lot} onChange={(e) => setLot(e.target.value)}>
              <option value="">{needsLot ? `Choose a ${lotLabel.toLowerCase()}…` : `All ${lotLabel.toLowerCase()}s`}</option>
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
        <div className="mt-auto flex flex-wrap gap-2">
          <ReportButton type={type} params={params} variant="primary" disabled={disabled}>
            Open PDF
          </ReportButton>
          <ReportButton type={type} params={params} mode="download" disabled={disabled}>
            Download
          </ReportButton>
        </div>
      </CardContent>
    </Card>
  );
}
