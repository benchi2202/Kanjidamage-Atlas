/** Phonetic comparison for KanjiDamage's uppercase romaji onyomi. */

export function normalizeReading(reading) {
  return String(reading ?? "").toUpperCase().replace(/[^A-Z]/g, "");
}

export function levenshtein(a, b) {
  a = String(a);
  b = String(b);
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

function sequenceSimilarity(a, b) {
  const max = Math.max(a.length, b.length, 1);
  return 1 - levenshtein(a, b) / max;
}

/**
 * A deliberately simple, explainable phonetic score:
 *  - edit distance on the romaji (captures KYOU ~ KOU, SHOU ~ SHO)
 *  - same initial consonant (K... families)
 *  - same vowel sequence (KAKU ~ RAKU)
 *  - similar consonant skeleton
 */
export function phoneticSimilarity(a, b) {
  const A = normalizeReading(a);
  const B = normalizeReading(b);
  if (!A || !B) return 0;
  if (A === B) return 1;

  const max = Math.max(A.length, B.length);
  const edit = 1 - levenshtein(A, B) / max;
  const initial = A[0] === B[0] ? 1 : 0;
  const vowelsA = (A.match(/[AEIOU]+/g) ?? []).join("");
  const vowelsB = (B.match(/[AEIOU]+/g) ?? []).join("");
  const vowels = sequenceSimilarity(vowelsA, vowelsB);
  const consA = A.replace(/[AEIOU]/g, "");
  const consB = B.replace(/[AEIOU]/g, "");
  const consonants = sequenceSimilarity(consA, consB);

  return Math.max(0, Math.min(1, 0.5 * edit + 0.2 * initial + 0.2 * vowels + 0.1 * consonants));
}

export function maxReadingSimilarity(aReadings, bReadings) {
  let best = 0;
  for (const a of aReadings ?? []) {
    for (const b of bReadings ?? []) best = Math.max(best, phoneticSimilarity(a, b));
  }
  return best;
}

/**
 * Build a sparse undirected k-nearest-neighbour graph of reading groups.
 * Returns { edges, neighbours } with edges deduplicated by sorted pair.
 */
export function buildSimilarityEdges(groups, { topK = 4, minSimilarity = 0.48 } = {}) {
  const edges = [];
  for (let i = 0; i < groups.length; i++) {
    const a = groups[i];
    const scored = [];
    for (let j = 0; j < groups.length; j++) {
      if (i === j) continue;
      const b = groups[j];
      const similarity = maxReadingSimilarity(a.readings, b.readings);
      if (similarity >= minSimilarity) scored.push({ group: b, similarity });
    }
    scored.sort((x, y) => y.similarity - x.similarity || String(x.group.id).localeCompare(String(y.group.id)));
    for (const hit of scored.slice(0, topK)) {
      const key = [a.id, hit.group.id].sort().join("::");
      if (!edges.some((edge) => edge.key === key)) {
        edges.push({
          key,
          source: a.id,
          target: hit.group.id,
          similarity: Number(hit.similarity.toFixed(4)),
        });
      }
    }
  }
  const byId = new Map(groups.map((group) => [group.id, group]));
  const neighbours = new Map(groups.map((group) => [group.id, []]));
  for (const edge of edges) {
    neighbours.get(edge.source)?.push({ id: edge.target, similarity: edge.similarity });
    neighbours.get(edge.target)?.push({ id: edge.source, similarity: edge.similarity });
  }
  for (const list of neighbours.values()) list.sort((a, b) => b.similarity - a.similarity);
  return { edges, neighbours, byId };
}
