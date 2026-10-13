import { describe, expect, it } from "vitest";
import { autoMapColumns, cellToString, rowsToImport, splitHeader, validateRows } from "@/lib/import";

describe("autoMapColumns", () => {
  it("recognises common headings", () => {
    expect(
      autoMapColumns(["Lot No.", "Property Address", "Land Owner", "Phone", "CH", "Status", "Site Engineer", "Comments", "Other"]),
    ).toEqual(["lot_number", "address", "landholder", "landholder_contact", "chainage", "status", "assigned_engineer", "notes", null]);
  });

  it("matches headings that contain a known word and never maps a field twice", () => {
    expect(autoMapColumns(["Lot Number", "Lot", "Chainage (m)"])).toEqual(["lot_number", null, "chainage"]);
  });
});

describe("validateRows", () => {
  const mapping = autoMapColumns(["Lot", "Address", "Status"]);

  it("flags missing, duplicate, existing and invalid rows", () => {
    const rows = validateRows(
      [
        ["L1", "1 Main St", ""],
        ["", "No lot", ""],
        ["l1 ", "Duplicate", ""],
        ["L2", "Exists", "In Progress"],
        ["L3", "Bad status", "Finished"],
        ["L4", "Closed", "Closed"],
        ["", "", ""],
        ["L5", "On hold", "on hold"],
      ],
      mapping,
      ["l2"],
    );
    expect(rows.map((r) => [r.rowNumber, r.state])).toEqual([
      [2, "ready"],
      [3, "error"],
      [4, "error"],
      [5, "exists"],
      [6, "error"],
      [7, "error"],
      [9, "ready"],
    ]);
    expect(rows[2].messages).toEqual(["Duplicate of row 2 in this file"]);
    expect(rowsToImport(rows).map((r) => [r.lot_number, r.status])).toEqual([
      ["L1", "not_started"],
      ["L5", "on_hold"],
    ]);
  });
});

describe("cells and headers", () => {
  it("converts Excel values to text", () => {
    expect(cellToString(new Date("2026-03-04T00:00:00Z"))).toBe("2026-03-04");
    expect(cellToString(12345)).toBe("12345");
    expect(cellToString(0.1 + 0.2)).toBe("0.3");
    expect(cellToString("  a \n b ")).toBe("a b");
    expect(cellToString(null)).toBe("");
  });

  it("uses the first non-blank row as the header", () => {
    expect(splitHeader([[], ["", null], ["Lot", "Address"], ["L1", "x"]])).toEqual({
      headers: ["Lot", "Address"],
      body: [["L1", "x"]],
      headerRowNumber: 3,
    });
  });
});
