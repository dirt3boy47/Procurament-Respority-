import { describe, expect, it } from "vitest";
import { closeoutChecklist } from "@/lib/closeout";
import type { Views } from "@/lib/database.types";

const lot = (patch: Partial<Views<"lot_overview">> = {}) =>
  ({
    id: "00000000-0000-0000-0000-000000000001",
    lot_number: "LOT-1",
    pre_survey_status: "complete",
    post_survey_status: "complete",
    open_defects: 0,
    total_defects: 2,
    open_reinstatement: 0,
    total_reinstatement: 1,
    landholder_signoff_date: "2026-10-01",
    landholder_signoff_name: "J Smith",
    ...patch,
  }) as Views<"lot_overview">;

describe("closeoutChecklist", () => {
  it("is all done for a lot ready to close", () => {
    expect(closeoutChecklist(lot()).every((c) => c.done)).toBe(true);
  });

  it("reports each unmet condition", () => {
    const items = closeoutChecklist(
      lot({ post_survey_status: "scheduled", open_defects: 1, open_reinstatement: 1, landholder_signoff_date: null }),
    );
    expect(items.filter((c) => !c.done).map((c) => c.key)).toEqual(["post", "defects", "reinstatement", "acceptance"]);
    expect(items.find((c) => c.key === "defects")?.detail).toBe("1 of 2 open");
  });

  it("treats a lot with no defects or reinstatement as clear", () => {
    const items = closeoutChecklist(lot({ total_defects: 0, total_reinstatement: 0 }));
    expect(items.find((c) => c.key === "defects")?.detail).toBe("No defects recorded");
    expect(items.find((c) => c.key === "reinstatement")?.done).toBe(true);
  });
});
