import { describe, expect, it } from "vitest";
import { jaccard, pixelSimilarity } from "../src/lib/similarity.ts";

function blank() {
  return new Uint8Array(64 * 64).fill(255);
}

describe("Jaccard", () => {
  it("computes intersection over union", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3);
  });
  it("returns 0 for empty sets", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
});

describe("pixel similarity", () => {
  it("returns 1 for identical bitmaps", () => {
    const a = blank();
    a[100] = 0;
    a[101] = 0;
    expect(pixelSimilarity(a, a, "cosine")).toBeCloseTo(1);
    expect(pixelSimilarity(a, a, "weightedRmse")).toBeCloseTo(1);
  });

  it("returns less than 1 for different ink", () => {
    const a = blank();
    const b = blank();
    for (let i = 100; i < 140; i++) a[i] = 0;
    for (let i = 300; i < 340; i++) b[i] = 0;
    expect(pixelSimilarity(a, b, "cosine")).toBeLessThan(0.1);
    expect(pixelSimilarity(a, b, "iou")).toBe(0);
  });
});
