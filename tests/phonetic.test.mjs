import { describe, expect, it } from "vitest";
import { phoneticSimilarity } from "../scripts/lib/phonetic.mjs";

describe("phonetic similarity", () => {
  it("is 1 for identical readings", () => {
    expect(phoneticSimilarity("KYOU", "KYOU")).toBe(1);
  });

  it("puts KYOU closer to KOU than to KEI", () => {
    expect(phoneticSimilarity("KYOU", "KOU")).toBeGreaterThan(0.7);
    expect(phoneticSimilarity("KYOU", "KOU")).toBeGreaterThan(phoneticSimilarity("KYOU", "KEI"));
  });

  it("keeps KAKU and RAKU in the same sound family", () => {
    expect(phoneticSimilarity("KAKU", "RAKU")).toBeGreaterThan(0.55);
  });

  it("handles short and long vowels", () => {
    expect(phoneticSimilarity("SHOU", "SHO")).toBeGreaterThan(0.7);
    expect(phoneticSimilarity("KOU", "SEI")).toBeLessThan(0.5);
  });
});
