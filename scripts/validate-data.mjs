#!/usr/bin/env node
/**
 * Independent acceptance check for the generated atlas data.
 * Run after: npm run data:build
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "public", "data");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const data = readJson("app-data.json");
  const kvg = readJson("kanjivg-components.json");
  const pixelPath = path.join(DATA_DIR, "pixel-embeddings.bin");
  check(fs.existsSync(pixelPath), "pixel-embeddings.bin is missing");
  const pixel = fs.readFileSync(pixelPath);
  const byId = new Map(data.entries.map((entry) => [entry.id, entry]));
  const byKanji = new Map(data.entries.filter((entry) => entry.kanji).map((entry) => [entry.kanji, entry]));
  const onyomi = new Map(data.onyomiGroups.map((group) => [group.reading, group]));
  const strongByGlyph = new Map(data.strongGroups.map((group) => [group.glyph, group]));
  const component = new Map(data.componentGroups.map((group) => [group.component, group]));
  const quality = data.quality;

  check(data.entries.length === 1758, "expected 1,758 entries incl. 閥");
  check(quality.kanjiEntries === 1637, "expected 1,637 kanji entries");
  check(quality.imageRadicals === 121, "expected 121 image radicals");
  check(data.strongGroups.length === 90, "expected 90 strong groups");
  check(quality.strongGroupsEmpty === 3, "expected 3 empty strong groups");
  check(data.onyomiGroups.length === 270, "expected 270 onyomi groups");
  check(quality.onyomiGroups2 === 200, "expected 200 onyomi groups with 2+");
  check(quality.multiReadingKanji === 47, "expected 47 multi-reading kanji");
  check(quality.noReadingKanji === 139, "expected 139 kanji without onyomi");
  check(data.componentGroups.length === 445, "expected 445 component groups");
  check(quality.sharedComponents === 262, "expected 262 shared components");
  check(quality.ungroupedKanji === 179, "expected 179 ungrouped kanji");
  check(quality.unresolvedUsedIn === 0, "expected no unresolved used_in references");
  check(data.kvg.covered === 1635, "expected 1,635 KanjiVG-covered entries");
  check(quality.pixelGlyphs === 1641, "expected 1,641 pixel glyphs");
  check(pixel.length === quality.pixelGlyphs * data.pixel.size * data.pixel.size, "pixel binary size mismatch");
  check(Object.keys(data.pixel.index).length === quality.pixelGlyphs, "pixel index size mismatch");
  check(kvg["青"]?.length > 0, "KanjiVG components missing for 青");
  check(data.siteOnly.entries.length === 10, "expected 10 site-only entries");
  check(data.siteOnly.entries.find((entry) => entry.id === 667)?.merged === true, "閥 should be merged");

  const qing = strongByGlyph.get("青");
  check(qing && qing.readings.join(",") === "SEI", "青 strong reading should be SEI");
  const qingMembers = new Map(qing.members.map((member) => [byId.get(member.id)?.kanji, member.status]));
  for (const [glyph, status] of [["請", "pass"], ["清", "pass"], ["精", "pass"], ["晴", "exception"], ["情", "exception"], ["静", "pass"]]) {
    check(qingMembers.get(glyph) === status, "青/" + glyph + " should be " + status);
  }
  check(byKanji.get("晴").readings.length === 0, "晴 must stay without an onyomi");
  check(byKanji.get("情").readings.includes("JOU"), "情 should have JOU");

  const sha = strongByGlyph.get("者");
  check(sha && sha.readings.join(",") === "SHO", "者 strong reading should be SHO");
  for (const glyph of ["著", "緒", "諸", "署", "暑", "煮", "賭", "都"]) {
    check(sha.memberIds.includes(byKanji.get(glyph).id), "者 group missing " + glyph);
  }

  const kaku = strongByGlyph.get("各");
  check(kaku && kaku.readings.join(",") === "KAKU,RAKU", "各 strong readings should be KAKU,RAKU");
  const kakuMembers = new Map(kaku.members.map((member) => [byId.get(member.id)?.kanji, member.status]));
  check(kakuMembers.get("格") === "pass", "格 should pass");
  check(kakuMembers.get("絡") === "pass", "絡 should pass");
  check(kakuMembers.get("略") === "exception", "略 should be an exception");
  check(kaku.radicalMembers.length === 1, "各 should expose its 1 image-radical member");

  const ani = byKanji.get("兄");
  check(onyomi.get("KYOU").memberIds.includes(ani.id), "兄 missing from KYOU");
  check(onyomi.get("KEI").memberIds.includes(ani.id), "兄 missing from KEI");
  check(onyomi.get("KYOU").memberIds.includes(byKanji.get("教").id), "教 missing from KYOU");
  check(onyomi.get("KYOU").memberIds.includes(byKanji.get("強").id), "強 missing from KYOU");
  check(data.onyomiLinks.some((link) => [link.source, link.target].sort().join("::") === "onyomi:KOU::onyomi:KYOU"), "KYOU~KOU sound edge missing");

  const fu = component.get("不");
  const fuNames = new Set(fu.primaryIds.map((id) => byId.get(id)?.kanji));
  check(fuNames.size === 3 && ["否", "歪", "杯"].every((glyph) => fuNames.has(glyph)), "不 primary group should be 否歪杯");
  const ming = component.get("明");
  const mingNeighbours = ming.focusNeighbors.map((neighbor) => neighbor.component);
  check(["月", "日", "朝"].every((name) => mingNeighbours.includes(name)), "明 neighbourhood should include 月, 日, 朝");
  const qingComponent = component.get("青");
  check(qingComponent && qingComponent.count === 6, "青 component group should contain 6 kanji");

  const emptyNames = new Set(data.strongGroups.filter((group) => group.empty).map((group) => group.glyph ?? group.meaning));
  check(emptyNames.size === 3 && ["定", "倍", "傷"].every((glyph) => emptyNames.has(glyph)), "unexpected empty strong groups: " + [...emptyNames].join(","));

  const mon = byKanji.get("門");
  check(mon.usedIn.some((ref) => ref.id === 667), "門 should reference 閥");
  check(byKanji.get("閥"), "閥 supplement should be indexed");

  console.log("Data validation passed.");
  console.log("  entries: " + data.entries.length + " (" + quality.kanjiEntries + " kanji, " + quality.imageRadicals + " radicals)");
  console.log("  onyomi: " + data.onyomiGroups.length + " groups, " + quality.onyomiGroups2 + " with 2+, " + quality.multiReadingKanji + " multi-reading");
  console.log("  strong: " + data.strongGroups.length + " families, " + quality.strongExceptions + " exceptions, " + quality.strongGroupsEmpty + " empty");
  console.log("  components: " + data.componentGroups.length + " groups, " + quality.sharedComponents + " shared, " + quality.ungroupedKanji + " ungrouped");
  console.log("  pixels: " + quality.pixelGlyphs + " x " + data.pixel.size + "x" + data.pixel.size + " (" + Math.round(pixel.length / 1024 / 1024) + " MB)");
}

try {
  main();
} catch (error) {
  console.error("Data validation FAILED:", error.message);
  process.exitCode = 1;
}
