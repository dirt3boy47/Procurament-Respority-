import { describe, expect, it } from "vitest";
import { closeoutChecklist } from "@/lib/closeout";
import type { Views } from "@/lib/database.types";

const lot = (patch: Partial<Views<"lot_overview">> = {}) =>
  ({
    id: "00000000-0000-0000-0000-000000000001",
    lot_number: "LOT-1",
    pre_survey_status: "complete",
    post_survey_status: "complete",
    landholder_signoff_date: "2026-10-01",
    landholder_signoff_name: "J Smith",
    ...patch,
  }) as Views<"lot_overview">;

describe("closeoutChecklist", () => {
  it("is all done for a lot ready to close", () => {
    const items = closeoutChecklist(lot());
    expect(items.map((c) => c.key)).toEqual(["pre", "post", "acceptance"]);
    expect(items.every((c) => c.done)).toBe(true);
  });

  it("reports each unmet condition", () => {
    const items = closeoutChecklist(lot({ post_survey_status: "scheduled", landholder_signoff_date: null }));
    expect(items.filter((c) => !c.done).map((c) => c.key)).toEqual(["post", "acceptance"]);
    expect(items.find((c) => c.key === "acceptance")?.detail).toBe("Not recorded");
  });

  it("links each condition to the page that fixes it", () => {
    expect(closeoutChecklist(lot()).map((c) => c.href.split("/").slice(3).join("/"))).toEqual([
      "surveys/pre-construction",
      "surveys/post-construction",
      "closeout",
    ]);
  });
});
