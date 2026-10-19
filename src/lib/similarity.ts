import type { Entry, PixelMetric } from "../data/types";

export interface LensMatch {
  entry: Entry;
  score: number;
  percentile: number;
  shared: string[];
  detail: string;
}

export interface LensContext {
  entries: Entry[];
  getKvg: (glyph: string) => string[] | undefined;
  getKd: (entry: Entry) => Set<string>;
  getEmbedding: (glyph: string) => Uint8Array | null;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection++;
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}

function percentile(index: number, total: number): number {
  if (total <= 1) return 1;
  return 1 - index / (total - 1);
}

function sharedValues(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((value) => b.has(value));
}

export function computeJaccardLens(
  context: LensContext,
  input: Entry,
  kind: "kvg" | "kd",
): LensMatch[] {
  if (!input.kanji) return [];
  const inputSet =
    kind === "kvg"
      ? new Set(context.getKvg(input.kanji) ?? [])
      : context.getKd(input);
  if (!inputSet.size) return [];

  const rows: Array<{ entry: Entry; score: number; shared: string[] }> = [];
  for (const entry of context.entries) {
    if (!entry.kanji || entry.id === input.id) continue;
    const set = kind === "kvg" ? new Set(context.getKvg(entry.kanji) ?? []) : context.getKd(entry);
    if (!set.size) continue;
    const score = jaccard(inputSet, set);
    if (score > 0) rows.push({ entry, score, shared: sharedValues(inputSet, set) });
  }
  rows.sort((a, b) => b.score - a.score || a.entry.kanji!.localeCompare(b.entry.kanji!));
  const total = rows.length;
  return rows.slice(0, 28).map((row, index) => ({
    entry: row.entry,
    score: row.score,
    percentile: percentile(index, total),
    shared: row.shared,
    detail: "Jaccard " + row.score.toFixed(3) + (row.shared.length ? " · " + row.shared.slice(0, 4).join(" ") : ""),
  }));
}

function inkWeightedRmse(a: Uint8Array, b: Uint8Array, dx: number, dy: number, size: number): number {
  let sum = 0;
  let weights = 0;
  for (let y = 0; y < size; y++) {
    const by = y + dy;
    for (let x = 0; x < size; x++) {
      const bx = x + dx;
      const A = (255 - a[y * size + x]) / 255;
      const B = bx >= 0 && bx < size && by >= 0 && by < size ? (255 - b[by * size + bx]) / 255 : 0;
      const w = Math.max(A, B);
      if (!w) continue;
      const diff = A - B;
      sum += w * diff * diff;
      weights += w;
    }
  }
  if (!weights) return 1;
  return Math.sqrt(sum / weights);
}

function inkCosine(a: Uint8Array, b: Uint8Array, size: number): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < size * size; i++) {
    const x = (255 - a[i]) / 255;
    const y = (255 - b[i]) / 255;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

function inkIou(a: Uint8Array, b: Uint8Array, size: number): number {
  let intersection = 0;
  let union = 0;
  for (let i = 0; i < size * size; i++) {
    const ai = a[i] < 170;
    const bi = b[i] < 170;
    if (ai || bi) union++;
    if (ai && bi) intersection++;
  }
  return union ? intersection / union : 0;
}

export function pixelSimilarity(a: Uint8Array, b: Uint8Array, metric: PixelMetric): number {
  const size = 64;
  if (metric === "weightedRmse") return 1 - inkWeightedRmse(a, b, 0, 0, size);
  if (metric === "cosine") return inkCosine(a, b, size);
  return inkIou(a, b, size);
}

export function computePixelLens(
  context: LensContext,
  input: Entry,
  metric: PixelMetric,
): LensMatch[] {
  if (!input.kanji) return [];
  const inputEmbedding = context.getEmbedding(input.kanji);
  if (!inputEmbedding) return [];
  const size = 64;

  const all: Array<{ entry: Entry; score: number }> = [];
  for (const entry of context.entries) {
    if (!entry.kanji || entry.id === input.id) continue;
    const embedding = context.getEmbedding(entry.kanji);
    if (!embedding) continue;
    let score =
      metric === "weightedRmse"
        ? 1 - inkWeightedRmse(inputEmbedding, embedding, 0, 0, size)
        : metric === "cosine"
          ? inkCosine(inputEmbedding, embedding, size)
          : inkIou(inputEmbedding, embedding, size);
    if (!Number.isFinite(score)) score = 0;
    all.push({ entry, score });
  }
  all.sort((a, b) => b.score - a.score);

  // Refine the top candidates with a small translation search. Pixel comparison is
  // notoriously shift-sensitive; searching ±2px keeps a slightly misplaced stroke from
  // dominating the ranking.
  if (metric === "weightedRmse" || metric === "iou") {
    for (const row of all.slice(0, 140)) {
      const embedding = context.getEmbedding(row.entry.kanji!);
      if (!embedding) continue;
      let best = row.score;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (!dx && !dy) continue;
          const score =
            metric === "weightedRmse"
              ? 1 - inkWeightedRmse(inputEmbedding, embedding, dx, dy, size)
              : inkIou(inputEmbedding, embedding, size);
          if (score > best) best = score;
        }
      }
      row.score = best;
    }
    all.sort((a, b) => b.score - a.score);
  }

  const total = all.length;
  return all.slice(0, 28).map((row, index) => ({
    entry: row.entry,
    score: row.score,
    percentile: percentile(index, total),
    shared: [],
    detail:
      metric === "weightedRmse"
        ? "pixel distance " + (1 - row.score).toFixed(3)
        : metric === "cosine"
          ? "ink cosine " + row.score.toFixed(3)
          : "ink IoU " + row.score.toFixed(3),
  }));
}

export function consensusGroups(
  lenses: Array<{ id: string; label: string; matches: LensMatch[] }>,
): Array<{ key: string; matches: Array<{ match: LensMatch; methods: string[] }> }> {
  const votes = new Map<number, { match: LensMatch; methods: string[] }>();
  for (const lens of lenses) {
    for (const match of lens.matches.slice(0, 12)) {
      const existing = votes.get(match.entry.id);
      if (existing) existing.methods.push(lens.label);
      else votes.set(match.entry.id, { match, methods: [lens.label] });
    }
  }
  const rows = [...votes.values()];
  const byCount = new Map<number, Array<{ match: LensMatch; methods: string[] }>>();
  for (const row of rows) {
    const count = row.methods.length;
    if (!byCount.has(count)) byCount.set(count, []);
    byCount.get(count)!.push(row);
  }
  for (const list of byCount.values()) {
    list.sort((a, b) => b.match.percentile - a.match.percentile || b.match.score - a.match.score);
  }
  return [3, 2, 1]
    .filter((count) => (byCount.get(count)?.length ?? 0) > 0)
    .map((count) => ({ key: String(count), matches: byCount.get(count)! }));
}
