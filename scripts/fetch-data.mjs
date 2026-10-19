#!/usr/bin/env node
/**
 * Fetch and cache all external inputs for KanjiDamage Atlas.
 *
 *   - KanjiDamage dataset JSON (GitHub, canonical)
 *   - KanjiVG release SVGs (one zip)
 *   - the repository's Noto Sans JP font + 21 strong-radical images
 *   - three one-time site snapshots (tag 24, /kanji index, 閥)
 *
 * The script is idempotent. If a cached file is present it is not fetched again.
 * It never runs during application startup.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "data", "raw");
const SITE = path.join(RAW, "site");
const SITE_CACHE = path.join(ROOT, "data", "site-cache");
const KVG_ZIP = path.join(RAW, "kanjivg-main.zip");
const KVG_DIR = path.join(RAW, "kanjivg");
const REPO_ZIP = path.join(RAW, "kanjidamage-repo.zip");
const PUBLIC = path.join(ROOT, "public");
const FONT_DEST = path.join(PUBLIC, "fonts", "NotoSansJP-Medium.otf");
const STRONG_MEDIA = path.join(PUBLIC, "media", "strong");
const USER_AGENT = "kanjidamage-atlas/0.1 (local study tool)";

const DATASET_BASE = "https://raw.githubusercontent.com/benchi2202/Kanjidamage-dataset/main";
const KVG_URL = "https://github.com/KanjiVG/kanjivg/releases/download/r20260714/kanjivg-20260714-main.zip";
const REPO_URL = "https://codeload.github.com/benchi2202/Kanjidamage-dataset/zip/refs/heads/main";
const SITE_URLS = {
  "tag-24.html": "https://www.kanjidamage.com/tags/24",
  "kanji-index.html": "https://www.kanjidamage.com/kanji",
  "kanji-667.html": "https://www.kanjidamage.com/kanji/667-clique-%E9%96%A5",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function exists(file) {
  try {
    await fsp.access(file);
    return true;
  } catch {
    return false;
  }
}

async function download(url, dest, label = url) {
  if (await exists(dest)) {
    const stat = await fsp.stat(dest);
    if (stat.size > 0) {
      console.log("cached  " + label + " (" + stat.size + " bytes)");
      return;
    }
  }
  console.log("fetch   " + label);
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
  const buf = Buffer.from(await res.arrayBuffer());
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.writeFile(dest, buf);
  console.log("wrote   " + path.relative(ROOT, dest) + " (" + buf.length + " bytes)");
}

async function countFiles(dir, suffix) {
  if (!(await exists(dir))) return 0;
  let n = 0;
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(suffix)) n++;
  }
  return n;
}

async function fetchDataset() {
  await fsp.mkdir(RAW, { recursive: true });
  for (const file of ["kanjidamage.json", "tags.json", "onyomi-keywords.json"]) {
    await download(DATASET_BASE + "/" + file, path.join(RAW, file), "dataset/" + file);
  }
}

async function fetchKanjiVG() {
  const have = await countFiles(path.join(KVG_DIR, "kanji"), ".svg");
  if (have > 6000) {
    console.log("cached  KanjiVG (" + have + " SVGs)");
    return;
  }
  await download(KVG_URL, KVG_ZIP, "KanjiVG release zip");
  const zip = new Uint8Array(await fsp.readFile(KVG_ZIP));
  const files = unzipSync(zip, {
    filter: (f) => f.name.startsWith("kanji/") && f.name.endsWith(".svg"),
  });
  const outDir = path.join(KVG_DIR, "kanji");
  await fsp.mkdir(outDir, { recursive: true });
  let n = 0;
  for (const [name, data] of Object.entries(files)) {
    await fsp.writeFile(path.join(KVG_DIR, name), Buffer.from(data));
    n++;
  }
  console.log("wrote   KanjiVG " + n + " SVGs");
}

function strongImages() {
  const file = path.join(RAW, "kanjidamage.json");
  if (!fs.existsSync(file)) return [];
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const strong = data.filter((entry) => (entry.tags || []).includes("STRONG"));
  const direct = strong.map((entry) => entry.image).filter(Boolean);
  const memberIds = new Set(strong.flatMap((entry) => (entry.used_in || []).map((ref) => Number(ref.id))));
  const viaUsedIn = data
    .filter((entry) => memberIds.has(Number(entry.id)) && entry.image)
    .map((entry) => entry.image);
  return [...new Set([...direct, ...viaUsedIn])].sort();
}

async function fetchRepoMedia() {
  const images = strongImages();
  const haveFont = await exists(FONT_DEST);
  const haveImages = (
    await Promise.all(images.map((image) => exists(path.join(STRONG_MEDIA, image))))
  ).every(Boolean);
  if (haveFont && haveImages) {
    console.log("cached  font + " + images.length + " strong-radical images");
    return;
  }
  await download(REPO_URL, REPO_ZIP, "dataset repository zip (font + radical images)");
  const zip = new Uint8Array(await fsp.readFile(REPO_ZIP));
  const wanted = new Set(images.map((image) => "/media/" + image));
  const files = unzipSync(zip, {
    filter: (f) =>
      f.name.endsWith("/media/_NotoSansJP-Medium.otf") ||
      [...wanted].some((suffix) => f.name.endsWith(suffix)),
  });
  await fsp.mkdir(path.dirname(FONT_DEST), { recursive: true });
  await fsp.mkdir(STRONG_MEDIA, { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    if (name.endsWith("_NotoSansJP-Medium.otf")) {
      await fsp.writeFile(FONT_DEST, Buffer.from(data));
    } else {
      const base = name.split("/").pop();
      if (base) await fsp.writeFile(path.join(STRONG_MEDIA, base), Buffer.from(data));
    }
  }
  console.log("wrote   font + " + images.length + " strong-radical images");
}

async function fetchSite() {
  await fsp.mkdir(SITE, { recursive: true });
  // Preserve the earlier research snapshots if they exist.
  const legacy = [
    ["tag-24.html", path.join(RAW, "tag-24.html")],
    ["kanji-index.html", path.join(RAW, "kanji-index.html")],
  ];
  for (const [name, from] of legacy) {
    const to = path.join(SITE, name);
    if (!(await exists(to)) && (await exists(from))) {
      await fsp.copyFile(from, to);
      console.log("copied  " + name + " from earlier snapshot");
    }
  }
  let first = true;
  for (const [name, url] of Object.entries(SITE_URLS)) {
    const dest = path.join(SITE, name);
    if (await exists(dest)) {
      const stat = await fsp.stat(dest);
      if (stat.size > 0) {
        console.log("cached  site/" + name);
        continue;
      }
    }
    const trackedSnapshot = path.join(SITE_CACHE, name);
    if (await exists(trackedSnapshot)) {
      await fsp.copyFile(trackedSnapshot, dest);
      console.log("cached  site/" + name + " from data/site-cache (no network)");
      continue;
    }
    if (!first) await sleep(1300);
    first = false;
    await download(url, dest, "site/" + name);
  }
}

async function main() {
  console.log("KanjiDamage Atlas data fetch");
  console.log("root: " + ROOT + "\n");
  await fetchDataset();
  await fetchKanjiVG();
  await fetchRepoMedia();
  await fetchSite();
  console.log("\nAll external inputs are cached under data/raw.");
}

main().catch((error) => {
  console.error("\nFetch failed:", error.message);
  process.exitCode = 1;
});
