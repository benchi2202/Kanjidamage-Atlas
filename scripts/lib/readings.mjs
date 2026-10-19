/**
 * Extract onyomi readings from KanjiDamage's free-text onyomi field.
 *
 * The field is usually a reading expression ("SEI, SHOU", "KYOU / KEI",
 * "SAI or ZAI"), sometimes followed by a note ("BAI - you don't need this").
 * We take the leading reading expression and discard prose. We deliberately do
 * not use an external dictionary: if KanjiDamage leaves the field blank, the
 * result is blank.
 */

const PRACTICAL_STOP = new Set([
  "OR", "AND", "ALSO", "NONE", "BUT", "T", "DONT", "DON'T", "NEED", "THIS",
  "THE", "THAT", "YOUR", "SAME", "OTHER", "FLOWER", "KANJI", "USEFUL",
  "HALF", "TIME", "JUST", "PEOPLE", "FORGET", "ABOUT", "LEARN", "BOTHER",
  "WAY", "WITH", "FROM", "HAVE", "WILL", "THAN", "THEN", "THEY", "ARE", "FOR",
  "CAN", "GET", "GOT", "HER", "HIS", "HOW", "ITS", "MAY", "NEW", "NOW", "OLD",
  "ONE", "OUR", "OUT", "OWN", "SAY", "SHE", "TOO", "USE", "WHO", "WHY", "YES",
  "YET", "REALLY", "WON", "AS", "IT",
]);

const NOTE_STARTERS = new Set(["BUT", "NONE", "ALSO", "THE", "THIS", "THAT"]);

export function parseOnyomiExpression(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return [];

  // "also FUU" / "Also, FUU" -> FUU
  s = s.replace(/^also[\s,]+/i, "");

  // Stop at the first sentence/annotation boundary.
  s = s.split(/[.;()\[\]\n]/)[0];
  // "BAI - you don't need this" / "GE -People forget..."
  s = s.split(/\s+-\s*|\s*-\s+/)[0];
  // "KA, but you don't need to learn it."
  s = s.split(/\s+but\s+/i)[0];

  const rawTokens = s.toUpperCase().match(/[A-Z]{1,6}/g) ?? [];
  if (!rawTokens.length) return [];

  if (NOTE_STARTERS.has(rawTokens[0])) return [];

  const tokens = rawTokens.filter((t) => !PRACTICAL_STOP.has(t) && !t.includes("'"));
  if (!tokens.length) return [];

  // If this is clearly an English sentence rather than a reading expression,
  // discard it. (A real reading expression is short and/or separated by / , or "or".)
  if (tokens.length > 4 && tokens.some((t) => PRACTICAL_STOP.has(t))) return [];

  return [...new Set(tokens)];
}

export function parseOnyomiList(onyomi) {
  const out = [];
  for (const item of onyomi ?? []) {
    for (const reading of parseOnyomiExpression(item?.reading)) {
      if (!out.includes(reading)) out.push(reading);
    }
  }
  return out;
}

export function applyReadingOverrides(kanji, readings, overrides) {
  const extra = overrides?.[kanji];
  if (!Array.isArray(extra)) return readings;
  const out = [...readings];
  for (const reading of extra) if (!out.includes(reading)) out.push(reading);
  return out;
}
