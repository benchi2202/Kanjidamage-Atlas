import { describe, expect, it } from "vitest";
import { parseOnyomiExpression, parseOnyomiList } from "../scripts/lib/readings.mjs";

describe("KanjiDamage onyomi parser", () => {
  it("parses lists and slashes", () => {
    expect(parseOnyomiExpression("SEI, SHOU")).toEqual(["SEI", "SHOU"]);
    expect(parseOnyomiExpression("KYOU / KEI")).toEqual(["KYOU", "KEI"]);
    expect(parseOnyomiExpression("CHI or JI")).toEqual(["CHI", "JI"]);
    expect(parseOnyomiExpression("SAI or ZAI")).toEqual(["SAI", "ZAI"]);
  });

  it("keeps YOU as a real reading", () => {
    expect(parseOnyomiExpression("YOU")).toEqual(["YOU"]);
  });

  it("cuts prose after the reading expression", () => {
    expect(parseOnyomiExpression("BAI - you don't need this")).toEqual(["BAI"]);
    expect(parseOnyomiExpression("SHU. You won't use this.")).toEqual(["SHU"]);
    expect(parseOnyomiExpression("GE -People forget about \"GE.\"")).toEqual(["GE"]);
    expect(parseOnyomiExpression("ZOU (not so useful)")).toEqual(["ZOU"]);
    expect(parseOnyomiExpression("FUU - but half the time just FU.")).toEqual(["FUU"]);
  });

  it("does not invent a reading from a note", () => {
    expect(parseOnyomiExpression("none")).toEqual([]);
    expect(parseOnyomiExpression("but you don't need to learn it.")).toEqual([]);
    expect(parseOnyomiExpression("")).toEqual([]);
  });

  it("unions multiple onyomi objects", () => {
    expect(parseOnyomiList([{ reading: "SEI" }, { reading: "SHOU" }])).toEqual(["SEI", "SHOU"]);
  });
});
