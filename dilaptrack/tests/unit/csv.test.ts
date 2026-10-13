import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("quotes and escapes values", () => {
    expect(toCsv(["A", "B"], [["x,y", 'say "hi"'], [null, 3]])).toBe('A,B\r\n"x,y","say ""hi"""\r\n,3');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(toCsv(["A"], [["=HYPERLINK(1)"], ["-5"]])).toBe("A\r\n'=HYPERLINK(1)\r\n'-5");
  });
});
