#!/usr/bin/env node
/**
 * Build the atlas data from cached sources.
 *
 * Stage 1: normalize entries and derive the onyomi, strong, and component groups.
 * Stage 2 (next in this file): KanjiVG component sets, pixel embeddings, layouts.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseOnyomiList, applyReadingOverrides } from "./lib/readings.mjs";
import { PIXEL_BYTES, PIXEL_SIZE, renderGlyphTo64 } from "./lib/pixel.mjs";
import { buildSimilarityEdges } from "./lib/phonetic.mjs";
import { forceLayout } from "./lib/layout.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "data", "raw");
const CURATED = path.join(ROOT, "data", "curated");
const PUBLIC_DATA = path.join(ROOT, "public", "data");
const KVG_DIR = path.join(RAW, "kanjivg", "kanji");

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value) + "\n");
};
const byPosition = (a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || a.id - b.id;
const unique = (list) => [...new Set(list)];

function decodeSlug(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeEntry(raw, { supplement = false } = {}) {
  const onyomi = (raw.onyomi ?? []).map((item) => ({
    reading: item?.reading ?? "",
    mnemonic: item?.mnemonic ?? null,
  }));
  return {
    id: Number(raw.id),
    position: raw.position ?? null,
    slug: raw.slug ?? null,
    url: raw.url ?? null,
    kanji: raw.kanji ?? null,
    image: raw.image ?? null,
    meaning: raw.meaning ?? "",
    usefulness: raw.usefulness ?? null,
    strokeCount: raw.stroke_count ?? raw.strokeCount ?? null,
    frequencyRank: raw.frequency_ranking ?? raw.frequencyRank ?? null,
    tags: raw.tags ?? [],
    description: raw.description ?? null,
    mnemonic: raw.mnemonic ?? null,
    components: (raw.components ?? []).map((c) => ({
      id: c?.id ?? null,
      kanji: c?.kanji ?? null,
      image: c?.image ?? null,
      label: c?.label ?? null,
    })),
    onyomi,
    readings: [],
    kunyomi: (raw.kunyomi ?? []).map((k) => ({
      reading: k?.reading ?? "",
      meaning: k?.meaning ?? null,
      usefulness: k?.usefulness ?? null,
      tags: k?.tags ?? [],
    })),
    jukugo: (raw.jukugo ?? []).slice(0, 4).map((j) => ({
      word: j?.word ?? "",
      reading: j?.reading ?? "",
      meaning: j?.meaning ?? null,
      usefulness: j?.usefulness ?? null,
    })),
    lookalikes: (raw.lookalikes ?? []).map((l) => ({
      kanji: l?.kanji ?? null,
      id: l?.id ?? null,
      meaning: l?.meaning ?? null,
      hint: l?.hint ?? null,
      radical: l?.radical ?? null,
      radicalId: l?.radical_id ?? null,
      radicalImage: l?.radical_image ?? null,
    })),
    usedIn: (raw.used_in ?? []).map((u) => ({
      id: Number(u?.id),
      kanji: u?.kanji ?? null,
      image: u?.image ?? null,
    })),
    isSupplement: supplement,
    primaryComponent: null,
  };
}

function parseSiteIndex(html) {
  const out = new Map();
  for (const match of html.matchAll(/href="\/kanji\/(\d+)-([^"]+)"/g)) {
    const id = Number(match[1]);
    if (!out.has(id)) out.set(id, { id, slug: decodeSlug(match[2]) });
  }
  return [...out.values()];
}

function parseTagPage(html) {
  const ids = new Set();
  for (const match of html.matchAll(/href="\/kanji\/(\d+)-/g)) ids.add(Number(match[1]));
  return [...ids];
}

function componentIndexFor(entry) {
  return (entry.components ?? []).filter((c) => c.kanji && c.kanji !== entry.kanji);
}

function buildOnyomi(entries, keywords) {
  const groups = new Map();
  for (const entry of entries) {
    if (!entry.kanji) continue;
    for (const reading of entry.readings) {
      if (!groups.has(reading)) groups.set(reading, []);
      groups.get(reading).push(entry);
    }
  }
  return [...groups.entries()]
    .map(([reading, members]) => ({
      id: "onyomi:" + reading,
      reading,
      keyword: keywords[reading.toLowerCase()] ?? null,
      count: members.length,
      memberIds: members.sort(byPosition).map((entry) => entry.id),
    }))
    .sort((a, b) => b.count - a.count || a.reading.localeCompare(b.reading));
}

function buildStrong(entries, byId, curated) {
  const strongEntries = entries.filter((entry) => (entry.tags ?? []).includes("STRONG"));
  const issues = [];
  const groups = strongEntries.map((entry) => {
    const record = curated.entries[String(entry.id)];
    if (!record) throw new Error("Missing curated strong readings for " + entry.id + " " + (entry.kanji || entry.image));
    const refs = entry.usedIn ?? [];
    const kanjiRefs = refs.filter((ref) => ref.kanji);
    const radicalRefs = refs.filter((ref) => !ref.kanji);
    const members = [];
    const radicals = [];
    for (const ref of kanjiRefs) {
      const member = byId.get(String(ref.id));
      if (!member) {
        issues.push({ group: entry.id, ref, reason: "missing" });
        continue;
      }
      if (!member.kanji) {
        issues.push({ group: entry.id, ref, reason: "image-only-target" });
        radicals.push({ id: member.id, image: member.image, meaning: member.meaning });
        continue;
      }
      const readings = member.readings;
      let status = "unknown";
      let reason = null;
      if (record.readings.length === 0) {
        status = "unknown";
        reason = "strong-reading-unknown";
      } else if (readings.length === 0) {
        status = "exception";
        reason = "no-reading";
      } else if (readings.some((reading) => record.readings.includes(reading))) {
        status = "pass";
      } else {
        status = "exception";
        reason = "reading-mismatch";
      }
      members.push({ id: member.id, readings, status, reason });
    }
    for (const ref of radicalRefs) {
      const hit = byId.get(String(ref.id));
      radicals.push({
        id: ref.id,
        image: hit?.image ?? ref.image ?? null,
        meaning: hit?.meaning ?? null,
      });
    }
    const pass = members.filter((m) => m.status === "pass").length;
    const exceptions = members.filter((m) => m.status === "exception").length;
    const noReading = members.filter((m) => m.reason === "no-reading").length;
    return {
      id: "strong:" + entry.id,
      entryId: entry.id,
      glyph: entry.kanji,
      image: entry.image,
      meaning: entry.meaning,
      readings: record.readings,
      source: record.source,
      note: record.note,
      memberIds: members.map((m) => m.id),
      members,
      radicalMembers: radicals,
      counts: {
        kanji: members.length,
        pass,
        exception: exceptions,
        noReading,
        radical: radicals.length,
        unknown: members.filter((m) => m.status === "unknown").length,
      },
      empty: members.length === 0,
      status: record.readings.length === 0 ? "unknown" : "ready",
    };
  });
  return { groups, issues };
}

function buildComponents(entries) {
  const membership = new Map();
  const labels = new Map();
  for (const entry of entries) {
    if (!entry.kanji) continue;
    for (const comp of componentIndexFor(entry)) {
      if (!membership.has(comp.kanji)) membership.set(comp.kanji, new Set());
      membership.get(comp.kanji).add(entry.id);
      if (!labels.has(comp.kanji) && comp.label) labels.set(comp.kanji, comp.label);
    }
  }
  const byKanji = new Map(entries.filter((e) => e.kanji).map((e) => [e.kanji, e]));
  const allGroups = [...membership.entries()]
    .map(([component, ids]) => {
      const allIds = [...ids];
      const meaning = byKanji.get(component)?.meaning ?? labels.get(component) ?? null;
      return {
        id: "component:" + component,
        component,
        meaning,
        count: allIds.length,
        allIds,
        primaryIds: [],
      };
    })
    .sort((a, b) => b.count - a.count || a.component.localeCompare(b.component));
  const groupByComponent = new Map(allGroups.map((group) => [group.component, group]));

  let ungrouped = 0;
  for (const entry of entries) {
    if (!entry.kanji) continue;
    const shared = componentIndexFor(entry)
      .map((comp, order) => ({ comp, order, group: groupByComponent.get(comp.kanji) }))
      .filter((item) => item.group && item.group.count >= 2);
    if (!shared.length) {
      entry.primaryComponent = null;
      ungrouped++;
      continue;
    }
    shared.sort((a, b) => a.group.count - b.group.count || a.order - b.order);
    const chosen = shared[0];
    entry.primaryComponent = chosen.comp.kanji;
    chosen.group.primaryIds.push(entry.id);
  }

  return {
    groups: allGroups,
    ungrouped,
    sharedComponents: allGroups.filter((group) => group.count >= 2).length,
  };
}

function deriveQuality(entries, onyomiGroups, strongGroups, componentResult, site) {
  const kanjiEntries = entries.filter((entry) => entry.kanji);
  const noReading = kanjiEntries.filter((entry) => entry.readings.length === 0);
  const multiReading = kanjiEntries.filter((entry) => entry.readings.length > 1);
  const allUsedIn = entries.flatMap((entry) => entry.usedIn ?? []);
  const unresolved = allUsedIn.filter((ref) => !entries.some((entry) => entry.id === ref.id));
  return {
    datasetEntries: 1757,
    supplementEntries: entries.filter((entry) => entry.isSupplement).length,
    totalEntries: entries.length,
    kanjiEntries: kanjiEntries.length,
    imageRadicals: entries.filter((entry) => !entry.kanji).length,
    strongGroups: strongGroups.length,
    strongGroupsEmpty: strongGroups.filter((group) => group.empty).length,
    strongMemberRefs: strongGroups.reduce((sum, group) => sum + group.memberIds.length + group.radicalMembers.length, 0),
    strongKanjiMembers: strongGroups.reduce((sum, group) => sum + group.memberIds.length, 0),
    strongRadicalMembers: strongGroups.reduce((sum, group) => sum + group.radicalMembers.length, 0),
    strongPass: strongGroups.reduce((sum, group) => sum + group.counts.pass, 0),
    strongExceptions: strongGroups.reduce((sum, group) => sum + group.counts.exception, 0),
    strongNoReading: strongGroups.reduce((sum, group) => sum + group.counts.noReading, 0),
    onyomiReadings: onyomiGroups.length,
    onyomiGroups2: onyomiGroups.filter((group) => group.count >= 2).length,
    multiReadingKanji: multiReading.length,
    noReadingKanji: noReading.length,
    componentGroups: componentResult.groups.length,
    sharedComponents: componentResult.sharedComponents,
    ungroupedKanji: componentResult.ungrouped,
    siteEntries: site.siteEntries,
    siteOnly: site.siteOnly.length,
    mergedSupplement: site.mergedSupplement,
    unresolvedUsedIn: unresolved.length,
    imageOnlyUsedInRefs: allUsedIn.filter((ref) => !ref.kanji).length,
  };
}

function assertAcceptance(data) {
  const { entries, onyomiGroups, strongGroups, componentGroups } = data;
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const byKanji = new Map(entries.filter((entry) => entry.kanji).map((entry) => [entry.kanji, entry]));
  const byReading = new Map(onyomiGroups.map((group) => [group.reading, group]));

  const qing = strongGroups.find((group) => group.glyph === "青");
  if (!qing) throw new Error("Missing 青 strong group");
  const qingMembers = qing.members.map((member) => ({ glyph: byId.get(member.id)?.kanji, ...member }));
  const expectQing = {
    "請": "pass", "清": "pass", "精": "pass", "晴": "exception", "情": "exception", "静": "pass",
  };
  for (const [glyph, status] of Object.entries(expectQing)) {
    const member = qingMembers.find((m) => m.glyph === glyph);
    if (!member) throw new Error("青 group missing " + glyph);
    if (member.status !== status) throw new Error("青/" + glyph + " expected " + status + ", got " + member.status);
  }

  const sha = strongGroups.find((group) => group.glyph === "者");
  if (!sha) throw new Error("Missing 者 strong group");
  if (sha.readings.join(",") !== "SHO") throw new Error("者 strong reading expected SHO, got " + sha.readings);
  for (const glyph of ["著", "緒", "諸", "署", "暑", "煮", "賭", "都"]) {
    if (!sha.memberIds.includes(byKanji.get(glyph)?.id)) throw new Error("者 group missing " + glyph);
  }

  const kaku = strongGroups.find((group) => group.glyph === "各");
  if (!kaku) throw new Error("Missing 各 strong group");
  if (kaku.readings.join(",") !== "KAKU,RAKU") throw new Error("各 strong readings expected KAKU,RAKU, got " + kaku.readings);
  for (const [glyph, status] of [["格", "pass"], ["絡", "pass"], ["略", "exception"]]) {
    const member = kaku.members.find((m) => byId.get(m.id)?.kanji === glyph);
    if (!member) throw new Error("各 group missing " + glyph);
    if (member.status !== status) throw new Error("各/" + glyph + " expected " + status + ", got " + member.status);
  }

  const kyo = byReading.get("KYOU");
  const kei = byReading.get("KEI");
  const kou = byReading.get("KOU");
  const ani = byKanji.get("兄");
  if (!kyo?.memberIds.includes(ani?.id)) throw new Error("兄 missing from KYOU");
  if (!kei?.memberIds.includes(ani?.id)) throw new Error("兄 missing from KEI");
  if (!kyo?.memberIds.includes(byKanji.get("教")?.id)) throw new Error("教 missing from KYOU");
  if (!kyo?.memberIds.includes(byKanji.get("強")?.id)) throw new Error("強 missing from KYOU");
  if (!kou) throw new Error("Missing KOU group");

  const fu = componentGroups.find((group) => group.component === "不");
  if (!fu) throw new Error("Missing 不 component group");
  const fuGlyphs = new Set(fu.primaryIds.map((id) => byId.get(id)?.kanji));
  if (fuGlyphs.size !== 3 || !["否", "歪", "杯"].every((glyph) => fuGlyphs.has(glyph))) {
    throw new Error("不 primary group expected 否歪杯, got " + [...fuGlyphs].join(""));
  }

  if (data.quality.unresolvedUsedIn !== 0) throw new Error("Unresolved used_in references: " + data.quality.unresolvedUsedIn);
  if (data.quality.strongGroups !== 90) throw new Error("Expected 90 strong groups, got " + data.quality.strongGroups);
  if (data.quality.strongGroupsEmpty !== 3) throw new Error("Expected 3 empty strong groups, got " + data.quality.strongGroupsEmpty);

  console.log("Acceptance checks: 青, 者, 各, 兄/KYOU/KEI, 不, used_in all pass");
}

function buildComponentFocus(groups, tiles, kvgMap, entries) {
  const masks = new Map();
  for (const [glyph, tile] of tiles) {
    const mask = stretchDilate32(tile);
    if (mask) masks.set(glyph, mask);
  }
  const sets = new Map(groups.map((group) => [group.component, new Set(kvgMap[group.component] ?? [])]));
  const groupByComponent = new Map(groups.map((group) => [group.component, group]));
  const co = new Map();
  for (const entry of entries) {
    const comps = [...new Set(componentIndexFor(entry).map((item) => item.kanji).filter((item) => groupByComponent.has(item)))];
    for (let i = 0; i < comps.length; i++) {
      for (let j = i + 1; j < comps.length; j++) {
        const key = [comps[i], comps[j]].sort().join("::");
        co.set(key, (co.get(key) ?? 0) + 1);
      }
    }
  }
  for (const a of groups) {
    const maskA = masks.get(a.component);
    const setA = sets.get(a.component) ?? new Set();
    const candidates = [];
    for (const b of groups) {
      if (a.id === b.id) continue;
      const maskB = masks.get(b.component);
      const setB = sets.get(b.component) ?? new Set();
      const pixel = maskA && maskB ? maskIoU(maskA, maskB) : 0;
      const containment = setA.has(b.component) || setB.has(a.component) ? 1 : 0;
      let shared = 0;
      for (const element of setA) {
        if (element !== a.component && element !== b.component && setB.has(element)) shared++;
      }
      const cooccurrence = co.get([a.component, b.component].sort().join("::")) ?? 0;
      const score = 0.55 * pixel + 0.25 * containment + 0.12 * Math.min(shared, 2) / 2 + 0.08 * Math.min(cooccurrence, 3) / 3;
      if (score > 0.08) {
        candidates.push({
          id: b.id,
          component: b.component,
          similarity: Number(score.toFixed(4)),
          pixel: Number(pixel.toFixed(4)),
          containment: Boolean(containment),
          shared,
          cooccurrence,
        });
      }
    }
    candidates.sort((x, y) => y.similarity - x.similarity || y.pixel - x.pixel);
    a.focusNeighbors = candidates.slice(0, 8);
  }
  const special = ["日", "月", "早", "明", "朝"];
  for (const component of special) {
    const group = groupByComponent.get(component);
    console.log("  focus " + component + ": " + (group?.focusNeighbors ?? []).slice(0, 6).map((n) => n.component + "(" + n.similarity + ")").join(" "));
  }
}

function buildComponentOrder(groups, links) {
  const similarity = new Map();
  for (const link of links) {
    const key = [link.source, link.target].sort().join("::");
    similarity.set(key, Math.max(similarity.get(key) ?? 0, link.similarity));
  }
  const simOf = (a, b) => similarity.get([a, b].sort().join("::")) ?? 0;
  const score = (order) => order.reduce((sum, group, i) => (i ? sum + simOf(order[i - 1].id, group.id) : sum), 0);

  function nearestPath(start) {
    const used = new Set([start.id]);
    const order = [start];
    while (order.length < groups.length) {
      const last = order[order.length - 1];
      let best = null;
      let bestSim = -1;
      for (const candidate of groups) {
        if (used.has(candidate.id)) continue;
        const sim = simOf(last.id, candidate.id);
        if (sim > bestSim || (sim === bestSim && candidate.count > (best?.count ?? -1))) {
          best = candidate;
          bestSim = sim;
        }
      }
      if (!best) break;
      used.add(best.id);
      order.push(best);
    }
    return order;
  }

  function twoOpt(order) {
    let improved = true;
    let passes = 0;
    while (improved && passes < 3) {
      improved = false;
      passes++;
      for (let i = 1; i < order.length - 1; i++) {
        for (let j = i + 1; j < order.length; j++) {
          const prev = order[i - 1];
          const a = order[i];
          const b = order[j];
          const next = order[j + 1] ?? null;
          const before = simOf(prev.id, a.id) + (next ? simOf(b.id, next.id) : 0);
          const after = simOf(prev.id, b.id) + (next ? simOf(a.id, next.id) : 0);
          if (after > before + 1e-6) {
            const segment = order.slice(i, j + 1).reverse();
            order.splice(i, j - i + 1, ...segment);
            improved = true;
          }
        }
      }
    }
    return order;
  }

  const starts = [...groups].sort((a, b) => b.count - a.count || a.component.localeCompare(b.component)).slice(0, 12);
  let best = null;
  let bestScore = -1;
  for (const start of starts) {
    const order = twoOpt(nearestPath(start));
    const value = score(order);
    if (value > bestScore) {
      bestScore = value;
      best = order;
    }
  }
  best.forEach((group, index) => {
    group.order = index;
  });

  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const group of groups) {
    group.neighbors = links
      .filter((link) => link.source === group.id || link.target === group.id)
      .map((link) => ({
        id: link.source === group.id ? link.target : link.source,
        similarity: link.similarity,
        kind: link.kind,
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }

  const orderOf = new Map(best.map((group, index) => [group.component, index]));
  const special = ["日", "月", "早", "明", "朝"].map((component) => component + ":" + (orderOf.get(component) ?? "?"));
  console.log("Component seriation: score " + Math.round(bestScore) + " | " + special.join(" "));
  const specialEdges = [];
  for (let i = 1; i < best.length; i++) {
    if (special.some((entry) => entry.startsWith(best[i - 1].component + ":")) && special.some((entry) => entry.startsWith(best[i].component + ":"))) {
      specialEdges.push(best[i - 1].component + "~" + best[i].component + " " + simOf(best[i - 1].id, best[i].id).toFixed(2));
    }
  }
  console.log("  special adjacent pairs: " + (specialEdges.join(", ") || "none"));
  return bestScore;
}

async function mapLimit(items, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

function glyphFile(glyph) {
  const codePoint = glyph.codePointAt(0);
  if (codePoint === undefined) return null;
  return path.join(KVG_DIR, codePoint.toString(16).padStart(5, "0") + ".svg");
}

function collectGlyphs(entries) {
  const glyphs = new Set();
  for (const entry of entries) {
    if (entry.kanji) glyphs.add(entry.kanji);
    for (const component of entry.components ?? []) {
      if (component.kanji) glyphs.add(component.kanji);
    }
  }
  return [...glyphs].sort();
}

function buildKanjiVG(entries) {
  const glyphs = collectGlyphs(entries);
  const map = {};
  const files = new Map();
  const missing = [];
  for (const glyph of glyphs) {
    const file = glyphFile(glyph);
    if (!file || !fs.existsSync(file)) {
      missing.push(glyph);
      continue;
    }
    const svg = fs.readFileSync(file, "utf8");
    const elements = [...new Set([...svg.matchAll(/kvg:element="([^"]+)"/g)].map((match) => match[1]))];
    map[glyph] = elements;
    files.set(glyph, file);
  }
  const entryGlyphs = entries.filter((entry) => entry.kanji).map((entry) => entry.kanji);
  const missingEntries = entryGlyphs.filter((glyph) => !map[glyph]);
  console.log("KanjiVG: " + entryGlyphs.length + " entry glyphs, " + (entryGlyphs.length - missingEntries.length) + " covered; " + missingEntries.length + " missing");
  console.log("KanjiVG: " + files.size + " renderable glyphs (entries + components)");
  return { glyphs, map, files, missing, missingEntries };
}

async function buildPixels(kvg) {
  const glyphs = [...kvg.files.keys()].sort();
  const tiles = new Map();
  let rendered = 0;
  await mapLimit(glyphs, 6, async (glyph) => {
    const tile = await renderGlyphTo64(kvg.files.get(glyph));
    if (tile) tiles.set(glyph, tile);
    rendered++;
    if (rendered % 250 === 0) console.log("  rendered " + rendered + "/" + glyphs.length + " glyphs");
  });
  const order = [...tiles.keys()].sort();
  const index = {};
  const bin = Buffer.alloc(order.length * PIXEL_BYTES, 255);
  order.forEach((glyph, i) => {
    index[glyph] = i;
    tiles.get(glyph).copy(bin, i * PIXEL_BYTES);
  });
  fs.writeFileSync(path.join(PUBLIC_DATA, "pixel-embeddings.bin"), bin);
  console.log("Pixels: " + order.length + " embeddings, " + Math.round(bin.length / 1024 / 1024) + " MB");
  return { tiles, index, order, bytes: bin.length };
}

/** Stretch a 64x64 normalized glyph into a 32x32 ink mask, then dilate it. */
function stretchDilate32(tile) {
  let minX = 64, minY = 64, maxX = -1, maxY = -1;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (tile[y * 64 + x] < 245) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const mask = new Uint8Array(32 * 32);
  for (let y = 0; y < 32; y++) {
    const sy = minY + Math.min(h - 1, Math.floor(((y + 0.5) / 32) * h));
    for (let x = 0; x < 32; x++) {
      const sx = minX + Math.min(w - 1, Math.floor(((x + 0.5) / 32) * w));
      mask[y * 32 + x] = tile[sy * 64 + sx] < 160 ? 1 : 0;
    }
  }
  // Dilate by 2 pixels so small stroke shifts do not dominate the comparison.
  const out = new Uint8Array(32 * 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      let on = 0;
      for (let dy = -2; dy <= 2 && !on; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < 32 && yy < 32 && mask[yy * 32 + xx]) {
            on = 1;
            break;
          }
        }
      }
      out[y * 32 + x] = on;
    }
  }
  return out;
}

function maskIoU(a, b) {
  let intersection = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) union++;
    if (a[i] && b[i]) intersection++;
  }
  return intersection / (union || 1);
}

function buildOnyomiLayout(groups) {
  const forEdges = groups.map((group) => ({ id: group.id, readings: [group.reading] }));
  const graph = buildSimilarityEdges(forEdges, { topK: 4, minSimilarity: 0.45 });
  const nodes = groups.map((group) => ({
    id: group.id,
    r: 36 + Math.sqrt(group.count) * 12,
  }));
  const positions = forceLayout(nodes, graph.edges, { ticks: 460, charge: -140, linkGap: 30 });
  const byId = new Map(positions.map((position) => [position.id, position]));
  for (const group of groups) {
    const position = byId.get(group.id);
    group.layout = { x: position.x, y: position.y, r: position.r };
  }
  const links = graph.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    similarity: edge.similarity,
  }));
  const byGroup = new Map(groups.map((group) => [group.id, group.reading]));
  const top = [...links].sort((a, b) => b.similarity - a.similarity).slice(0, 6);
  console.log("Onyomi layout: " + groups.length + " groups, " + links.length + " sound edges");
  console.log("  closest readings: " + top.map((e) => byGroup.get(e.source) + "~" + byGroup.get(e.target) + " " + e.similarity).join(", "));
  return links;
}

function buildStrongLayout(groups) {
  const graph = buildSimilarityEdges(groups, { topK: 3, minSimilarity: 0.5 });
  const nodes = groups.map((group) => ({
    id: group.id,
    r: 44 + Math.sqrt(Math.max(group.memberIds.length + group.radicalMembers.length * 0.5, 1)) * 12,
  }));
  const positions = forceLayout(nodes, graph.edges, { ticks: 380, charge: -120, linkGap: 34 });
  const byId = new Map(positions.map((position) => [position.id, position]));
  for (const group of groups) {
    const position = byId.get(group.id);
    group.layout = { x: position.x, y: position.y, r: position.r };
  }
  const links = graph.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    similarity: edge.similarity,
  }));
  console.log("Strong layout: " + groups.length + " groups, " + links.length + " phonetic edges");
  return links;
}

function buildComponentLayout(groups, tiles, kvgMap, entries) {
  const dilated = new Map();
  for (const [glyph, tile] of tiles) {
    const mask = stretchDilate32(tile);
    if (mask) dilated.set(glyph, mask);
  }
  const sets = new Map();
  const getSet = (component) => {
    if (!sets.has(component)) sets.set(component, new Set(kvgMap[component] ?? []));
    return sets.get(component);
  };
  const groupByComponent = new Map(groups.map((group) => [group.component, group]));
  const edgeMap = new Map();
  const addEdge = (a, b, similarity, kind) => {
    if (a === b) return;
    const key = [a, b].sort().join("::");
    const value = Number(Math.min(1, similarity).toFixed(4));
    const existing = edgeMap.get(key);
    if (!existing || value > existing.similarity) {
      edgeMap.set(key, { source: a, target: b, similarity: value, kind });
    }
  };

  // 1. Pixel-neighbour edges.
  const pixelAdj = groups.map(() => []);
  let pixelPairs = 0;
  for (let i = 0; i < groups.length; i++) {
    const a = groups[i];
    const maskA = dilated.get(a.component);
    for (let j = i + 1; j < groups.length; j++) {
      const b = groups[j];
      const maskB = dilated.get(b.component);
      if (!maskA || !maskB) continue;
      const similarity = maskIoU(maskA, maskB);
      if (similarity >= 0.36) {
        pixelAdj[i].push({ index: j, similarity });
        pixelAdj[j].push({ index: i, similarity });
        pixelPairs++;
      }
    }
  }
  for (let i = 0; i < groups.length; i++) {
    pixelAdj[i].sort((a, b) => b.similarity - a.similarity);
    for (const hit of pixelAdj[i].slice(0, 8)) {
      addEdge(groups[i].id, groups[hit.index].id, hit.similarity, "pixel");
    }
  }

  // 2. Containment: one component glyph is a structural part of the other.
  for (const a of groups) {
    const setA = getSet(a.component);
    for (const element of setA) {
      if (element === a.component) continue;
      const b = groupByComponent.get(element);
      if (b) addEdge(a.id, b.id, 0.92, "containment");
    }
  }

  // 3. Shared decomposition: 明 and 朝 share 日 + 月 even though neither contains the other.
  for (let i = 0; i < groups.length; i++) {
    const setA = getSet(groups[i].component);
    for (let j = i + 1; j < groups.length; j++) {
      const setB = getSet(groups[j].component);
      let shared = 0;
      for (const element of setA) {
        if (element !== groups[i].component && element !== groups[j].component && setB.has(element)) shared++;
      }
      if (shared >= 1) {
        addEdge(groups[i].id, groups[j].id, 0.55 + Math.min(0.3, shared * 0.07), "shared");
      }
    }
  }

  // 4. Co-occurrence: components used together inside the same kanji.
  const co = new Map();
  for (const entry of entries) {
    const comps = [...new Set(componentIndexFor(entry).map((item) => item.kanji).filter((item) => groupByComponent.has(item)))];
    for (let i = 0; i < comps.length; i++) {
      for (let j = i + 1; j < comps.length; j++) {
        const key = [comps[i], comps[j]].sort().join("::");
        const current = co.get(key);
        if (current) current.count++;
        else co.set(key, { a: comps[i], b: comps[j], count: 1 });
      }
    }
  }
  const coAdj = new Map(groups.map((group) => [group.component, []]));
  for (const item of co.values()) {
    const ga = groupByComponent.get(item.a);
    const gb = groupByComponent.get(item.b);
    if (!ga || !gb) continue;
    coAdj.get(item.a).push({ other: gb, count: item.count });
    coAdj.get(item.b).push({ other: ga, count: item.count });
  }
  for (const [component, neighbours] of coAdj) {
    neighbours.sort((a, b) => b.count - a.count);
    const ga = groupByComponent.get(component);
    for (const hit of neighbours.slice(0, 2)) {
      addEdge(ga.id, hit.other.id, 0.5 + Math.min(0.25, hit.count * 0.03), "cooccurrence");
    }
  }

  // Keep the strongest six edges per node.
  const nodeEdges = new Map(groups.map((group) => [group.id, []]));
  for (const edge of edgeMap.values()) {
    nodeEdges.get(edge.source)?.push(edge);
    nodeEdges.get(edge.target)?.push(edge);
  }
  const keep = new Set();
  for (const list of nodeEdges.values()) {
    list.sort((a, b) => b.similarity - a.similarity);
    for (const edge of list.slice(0, 8)) keep.add([edge.source, edge.target].sort().join("::"));
  }
  const links = [...edgeMap.entries()]
    .filter(([key]) => keep.has(key))
    .map(([, edge]) => edge);

  const nodes = groups.map((group) => ({ id: group.id, r: 38 + Math.sqrt(group.count) * 11 }));
  const positions = forceLayout(nodes, links, { ticks: 520, charge: -125, linkGap: 30 });
  const byId = new Map(positions.map((position) => [position.id, position]));
  for (const group of groups) {
    const position = byId.get(group.id);
    group.layout = { x: position.x, y: position.y, r: position.r };
  }

  const byGroup = new Map(groups.map((group) => [group.id, group.component]));
  const top = [...links].sort((a, b) => b.similarity - a.similarity).slice(0, 8);
  const kinds = links.reduce((acc, link) => ({ ...acc, [link.kind]: (acc[link.kind] ?? 0) + 1 }), {});
  console.log("Component layout: " + groups.length + " groups, " + links.length + " shape edges (" + pixelPairs + " pixel pairs; " + JSON.stringify(kinds) + ")");
  console.log("  closest components: " + top.map((e) => byGroup.get(e.source) + "~" + byGroup.get(e.target) + " " + e.similarity).join(", "));
  const specialNames = new Set(["日", "月", "早", "明", "朝"]);
  const special = links.filter((link) => specialNames.has(byGroup.get(link.source)) && specialNames.has(byGroup.get(link.target)));
  console.log("  日/月/早/明/朝 links: " + special.map((e) => byGroup.get(e.source) + "~" + byGroup.get(e.target) + "(" + e.kind + " " + e.similarity + ")").join(", "));
  return links;
}

function assertLayouts(groups, links, label) {
  const ids = new Set(groups.map((group) => group.id));
  for (const group of groups) {
    if (!group.layout || !Number.isFinite(group.layout.x) || !Number.isFinite(group.layout.y)) {
      throw new Error(label + " group missing layout: " + group.id);
    }
  }
  for (const link of links) {
    if (!ids.has(link.source) || !ids.has(link.target)) throw new Error(label + " link has unknown endpoint");
  }
}

async function main() {
  await fsp.mkdir(PUBLIC_DATA, { recursive: true });
  const dataset = readJson(path.join(RAW, "kanjidamage.json"));
  const tagsRaw = readJson(path.join(RAW, "tags.json"));
  const keywords = readJson(path.join(RAW, "onyomi-keywords.json"));
  const strongCurated = readJson(path.join(CURATED, "strong-readings.json"));
  const overrides = readJson(path.join(CURATED, "reading-overrides.json")).entries ?? {};
  const siteSupplement = readJson(path.join(CURATED, "site-supplement.json"));
  const siteIndexHtml = fs.readFileSync(path.join(RAW, "site", "kanji-index.html"), "utf8");
  const tag24Html = fs.readFileSync(path.join(RAW, "site", "tag-24.html"), "utf8");

  const entries = dataset.map((raw) => normalizeEntry(raw));
  const supplement = siteSupplement.entries.map((raw) => normalizeEntry(raw, { supplement: true }));
  const allEntries = [...entries, ...supplement];
  for (const entry of allEntries) {
    entry.readings = applyReadingOverrides(
      entry.kanji,
      parseOnyomiList(entry.onyomi),
      overrides,
    );
  }
  const byId = new Map(allEntries.map((entry) => [String(entry.id), entry]));
  if (byId.size !== allEntries.length) throw new Error("Duplicate entry ids");

  const site = parseSiteIndex(siteIndexHtml);
  const siteIds = new Set(site.map((item) => item.id));
  const datasetIds = new Set(entries.map((entry) => entry.id));
  const missingSite = site.filter((item) => !datasetIds.has(item.id));
  const tag24Ids = parseTagPage(tag24Html);
  const strongEntries = entries.filter((entry) => (entry.tags ?? []).includes("STRONG"));
  if (tag24Ids.length !== 90) throw new Error("tag-24 page expected 90 ids, got " + tag24Ids.length);
  for (const id of tag24Ids) if (!datasetIds.has(id)) throw new Error("tag-24 id missing from dataset: " + id);
  if (missingSite.length !== 10) throw new Error("Expected 10 site-only entries, got " + missingSite.length);
  if (!missingSite.some((item) => item.id === 667)) throw new Error("Site-only 閥 missing from index");

  const onyomiGroups = buildOnyomi(allEntries, keywords);
  const strong = buildStrong(allEntries, byId, strongCurated);
  const components = buildComponents(allEntries);

  const kvg = buildKanjiVG(allEntries);
  const pixel = await buildPixels(kvg);
  const onyomiLinks = buildOnyomiLayout(onyomiGroups);
  const strongLinks = buildStrongLayout(strong.groups);
  const componentLinks = buildComponentLayout(components.groups, pixel.tiles, kvg.map, allEntries);
  buildComponentFocus(components.groups, pixel.tiles, kvg.map, allEntries);
  const componentOrderScore = buildComponentOrder(components.groups, componentLinks);
  assertLayouts(onyomiGroups, onyomiLinks, "onyomi");
  assertLayouts(strong.groups, strongLinks, "strong");
  for (const group of components.groups) {
    if (!Number.isInteger(group.order)) throw new Error("component group missing seriation order: " + group.id);
  }
  const kyouKou = onyomiLinks.find(
    (link) =>
      (link.source === "onyomi:KYOU" && link.target === "onyomi:KOU") ||
      (link.source === "onyomi:KOU" && link.target === "onyomi:KYOU"),
  );
  if (!kyouKou) console.warn("WARNING: KYOU and KOU are not directly linked");
  else console.log("KYOU~KOU similarity", kyouKou.similarity);

  const tags = Object.entries(tagsRaw).map(([id, tag]) => ({
    id: Number(id),
    name: tag.name,
    description: tag.description,
    count: tag.count,
  })).sort((a, b) => a.id - b.id);

  const data = {
    version: 1,
    generatedAt: new Date().toISOString(),
    tags,
    onyomiKeywords: keywords,
    entries: allEntries.sort(byPosition),
    onyomiGroups,
    strongGroups: strong.groups,
    componentGroups: components.groups,
    onyomiLinks,
    strongLinks,
    componentLinks,
    kvg: {
      entryGlyphs: allEntries.filter((entry) => entry.kanji).length,
      covered: allEntries.filter((entry) => entry.kanji && kvg.map[entry.kanji]).length,
      missing: kvg.missingEntries,
      renderable: kvg.files.size,
    },
    pixel: {
      size: PIXEL_SIZE,
      count: pixel.order.length,
      index: pixel.index,
    },
    ungroupedIds: allEntries.filter((entry) => entry.kanji && !entry.primaryComponent).map((entry) => entry.id),
    noReadingIds: allEntries.filter((entry) => entry.kanji && entry.readings.length === 0).map((entry) => entry.id),
    siteOnly: {
      entries: missingSite.map((item) => ({
        ...item,
        merged: item.id === 667,
        char: item.id === 667 ? "閥" : siteSupplement.radicals.find((r) => r.id === item.id)?.char ?? null,
        label: siteSupplement.radicals.find((r) => r.id === item.id)?.label ?? item.slug,
      })),
      radicals: siteSupplement.radicals,
    },
    quality: deriveQuality(allEntries, onyomiGroups, strong.groups, components, {
      siteEntries: site.length,
      siteOnly: missingSite,
      mergedSupplement: 1,
    }),
    build: {
      strongIssues: strong.issues,
    },
  };
  data.quality.pixelGlyphs = pixel.order.length;
  data.quality.kanjiVGCovered = data.kvg.covered;
  data.quality.kanjiVGMissing = kvg.missingEntries.length;
  data.quality.onyomiLinks = onyomiLinks.length;
  data.quality.strongLinks = strongLinks.length;
  data.quality.componentLinks = componentLinks.length;
  data.quality.componentOrderScore = Math.round(componentOrderScore);
  assertAcceptance(data);

  writeJson(path.join(PUBLIC_DATA, "app-data.json"), data);
  writeJson(path.join(PUBLIC_DATA, "kanjivg-components.json"), kvg.map);
  const appBytes = fs.statSync(path.join(PUBLIC_DATA, "app-data.json")).size;
  const kvgBytes = fs.statSync(path.join(PUBLIC_DATA, "kanjivg-components.json")).size;
  console.log("\nWrote public/data/app-data.json (" + Math.round(appBytes / 1024) + " KB)");
  console.log("Wrote public/data/kanjivg-components.json (" + Math.round(kvgBytes / 1024) + " KB)");
  console.log("Wrote public/data/pixel-embeddings.bin (" + Math.round(pixel.bytes / 1024 / 1024) + " MB)");
  console.log(JSON.stringify(data.quality, null, 2));
  console.log("entry kb", Math.round(Buffer.byteLength(JSON.stringify(data.entries)) / 1024));
}

main().catch((error) => {
  console.error("\nBuild failed:", error);
  process.exitCode = 1;
});
