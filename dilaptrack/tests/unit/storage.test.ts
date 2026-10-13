import { describe, expect, it } from "vitest";
import { buildStoragePath, previewPathFor, slugify } from "@/lib/storage";

describe("storage paths", () => {
  it("organises files by lot and folder", () => {
    const path = buildStoragePath("Lot 12/A", "pre_construction", "Front Fence (1).JPG", new Date("2026-10-13T04:15:00Z"), "abc123");
    expect(path).toBe("Lot-12-A/pre-construction/20261013-041500-abc123-Front-Fence-1.jpg");
    expect(previewPathFor(path)).toBe("Lot-12-A/pre-construction/20261013-041500-abc123-Front-Fence-1.preview.jpg");
  });

  it("handles names without extensions or safe characters", () => {
    expect(buildStoragePath("L1", "closeout", "Ünïcödé", new Date("2026-01-01T00:00:00Z"), "x")).toBe(
      "L1/closeout/20260101-000000-x-Unicode",
    );
    expect(slugify("***")).toBe("file");
  });
});
