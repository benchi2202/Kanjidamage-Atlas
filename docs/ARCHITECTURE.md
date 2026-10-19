# KanjiDamage Atlas — Architecture

**Status:** implemented · see §10 for implementation notes and deviations
**Working name:** *KanjiDamage Atlas* (a map of confusable kanji)  
**Deliverable:** a local, interactive web app (Vite + React + TypeScript + D3) with four grouping modes and a compare view.

---

## 1. Goal

Make it easy to see *why* kanji look or sound alike — and where the resemblance stops. The app groups the KanjiDamage kanji set by four lenses:

1. **Look-alikes** — visual similarity to a kanji you type (three independent methods).
2. **Same onyomi** — pronunciation families, with multi-reading kanji linked across groups.
3. **Same strong onyomi** — the 90 STRONG radicals/kanji from KanjiDamage tag 24, with phonetic exceptions highlighted in red.
4. **Kanji components** — groups sharing one component, with visually similar component groups placed side by side.

A persistent **compare drawer** (2–3 kanji) shows component overlap, onyomi overlap, and a pixel-difference heatmap, so the app answers “how do I tell these apart?” rather than only “these are similar.”

**Non-goals:** no runtime scraping of kanjidamage.com, no server backend, no generated readings, no account/cloud features.

---

## 2. What the data actually contains (verified)

| Fact | Value |
|---|---|
| KanjiDamage dataset entries | **1,757** (1,636 kanji + 121 image-only radicals) |
| Live /kanji index | **1,767** entries → **10 site-only**: 閥 + 9 katakana radicals |
| /tags/24 STRONG entries | **90** (matches dataset exactly) |
| Strong “Used In” references | **441** refs / **428** unique kanji; 3 groups empty (定, 倍, 傷) |
| Strong members with no reading | **26** refs (e.g. 晴) |
| Onyomi readings | **270** distinct; **199** groups with ≥2 kanji; **58** multi-reading kanji |
| Kanji with no parsed onyomi | **139** (KanjiDamage leaves them blank; 夕 literally says “none”) |
| Character components | **445**; **262** shared by ≥2; **179** kanji with no shared component |
| Component memberships | at most **4** per kanji |
| KanjiVG coverage | **1,634 / 1,636** (only ￥ and < missing); 6,703 SVGs available |
| Repo media | 2,029 files, incl. 21 strong-radical images and _NotoSansJP-Medium.otf |

### Data principles

- **GitHub dataset is canonical.** The site is fetched once, throttled, and cached only for the tag-24 snapshot, the /kanji index, and the one missing kanji 閥 (which is also the only unresolved used_in reference: 門 → 閥).
- **Do not invent readings.** 139 kanji have no onyomi in KanjiDamage. They stay blank and are treated as non-matching for strong groups (this is exactly why **晴 is red** in the 青 group). Strong-reading exceptions come from the entry descriptions and a reviewed override table, not from an external dictionary.
- **9 katakana site-only radicals** are catalogued in a data-quality appendix, not mixed into kanji groups.
- **Attribution:** KanjiDamage content and media; KanjiVG (CC BY-SA 3.0) for components and pixel bitmaps; Noto Sans JP (OFL) for display.

### Verified acceptance examples

- 青 group = 請 清 精 晴 情 静; **晴** (blank reading) and **情** (JOU) are red; 請/清/精/静 (SEI) are normal.
- 者 is strong for **SHO**, not its own SHA; used-in = 著 緒 諸 署 暑 煮 賭 都.
- 各 is strong for **KAKU + RAKU**; 格 and 絡 pass, **略** (RYAKU) is red.
- 兄 appears in both **KYOU** and **KEI** groups with a cross-group link; 教 and 強 share KYOU.
- 不 component group = **歪 杯 否**.
- KYOU and KOU reading groups are placed together.

---

## 3. Product shape

    ┌──────────────────────────────────────────────────────────────────────────┐
    │  KanjiDamage Atlas     [Look-alikes] [Onyomi] [Strong] [Components]  ◐  │
    ├───────────────┬──────────────────────────────────────────┬───────────────┤
    │ Search / input│                                          │  Inspector    │
    │ Filters       │             main diagram                 │  (glyph,      │
    │ Legend        │        pan · zoom · semantic LOD         │  readings,    │
    │ Data notes    │                                          │  components,  │
    │               │                                          │  why here,    │
    │               │                                          │  compare)     │
    ├───────────────┴──────────────────────────────────────────┴───────────────┤
    │ Compare tray:  [青] [晴] [情]  →  overlay + shared/different components   │
    └──────────────────────────────────────────────────────────────────────────┘

- **Modes** are top-level tabs. The input/search and filters adapt per mode.
- **Canvas** is the hero; left rail is collapsible; inspector is a right drawer (bottom sheet on mobile).
- **State is URL-encoded** (?mode=strong&group=466) so views are shareable and reload-safe.
- **Export** current diagram as PNG or SVG; copy link; export a group’s member list as JSON/CSV.
- **Theme** light “washi” and dark “night ink”; reduced-motion support.

---

## 4. Mode designs

### 4.1 Look-alikes (visual similarity)

Input: one kanji (searchable over 1,636; best-effort for outside kanji via KanjiVG/font with a notice).

Three **lenses** side by side, each computing a score against every kanji and showing the top ~24 in three bands:

| Lens | Source | Score |
|---|---|---|
| **KanjiVG + Jaccard** | kvg:element labels from KanjiVG SVG | intersection ÷ union |
| **KanjiDamage components** | components[] from the dataset | same Jaccard |
| **Pixel difference** | 64×64 normalized KanjiVG bitmap | weighted RMSE (default), with cosine/IoU options |

- **Bands:** *Core* (top 5 / highest similarity), *Family* (next 8), *Fringe* (next 11). Each band is a hull with a label; tiles are sized by score.
- **Pixel pipeline:** render SVG at 160px, strip stroke-number text, flatten white, bbox-trim, fit 56px into 64×64, grayscale; compare with ±2px translation search to reduce shift sensitivity; scores are shown as percentile as well as raw value.
- **Consensus strip** beneath the lenses: union of each lens’s top 12, grouped by agreement (3/3, 2/3, 1/3). This is the “all methods agree” vs “only pixels think so” view.
- **Why:** hovering a tile shows shared components/readings and the raw scores. A settings popover exposes thresholds and the pixel metric.

Alternative layouts considered: a ternary “method triangle” and method tabs. Recommendation: the three-lens triptych — it makes disagreement legible.

### 4.2 Same onyomi

- Groups = cleaned KanjiDamage onyomi readings (270; default only groups with ≥2 kanji, **199**).
- Island layout: each reading is an island labeled with the reading + KanjiDamage keyword; kanji orbit the label, sorted by usefulness/frequency. Island radius scales with sqrt(count); large groups (e.g. KOU 46) use a hex grid.
- **Multi-reading kanji** (58) appear once per reading; copies are connected by a dashed vermilion thread with a ×2 badge. Hovering one copy highlights all copies and the thread.
- **Phonetic proximity:** weighted Levenshtein on romaji + initial-consonant match + vowel-sequence similarity; top-k edges feed a force layout, so KYOU/KOU/KEI islands sit together. Faint “sound threads” connect similar groups.
- **No-reading tray:** 139 kanji with blank onyomi are listed in a muted tray, not silently dropped.
- Filters: min group size (2/3/5), usefulness, tags, search; semantic zoom shows bubbles at low zoom and glyphs at high zoom.

### 4.3 Same strong onyomi (tag 24)

- 90 groups, one per STRONG entry, center = kanji glyph or radical image (21 image radicals extracted from the repo’s media/).
- Members = the entry’s used_in list (441 refs; 閥 merged from the site supplement). The entry itself is the center, not necessarily a member.
- **Strong reading resolution** (reviewed table for all 90):
  1. explicit note in description (“STRONG for both かく and らく”, “pronounced SHO”), including kana via a small romanizer;
  2. otherwise the entry’s own onyomi (multiple = union);
  3. a curated override file for ambiguous notes (者→SHO, 各→KAKU+RAKU, 己→KI, 余→JO, 次→SHI, 氏→TEI, 専→HAKU/BAKU, 周→CHOU, 甚→KAN, 斉→ZAI/SAI, 尺→TAKU/YAKU, 申→SHIN, 曽→ZOU, 其→KI, 呉→GO, 瓜→KO, 頭→GAN, 兄→KYOU, 才→SAI/ZAI, 君→KUN/GUN).
- **Exception rule:** a member is red if its known onyomi set has no intersection with the group’s strong reading set. Multiple strong readings are a union, so 格 (KAKU) and 絡 (RAKU) both pass in 各. A member with **no reading data is red** (晴), with a tooltip explaining the missing data. If a strong reading itself is unknown (not expected after overrides), the group uses amber, not red.
- **Layout:** group cards/islands placed by strong-reading phonetic similarity; low zoom = glyph + reading + member/exception counts, high zoom = member rings. Empty groups (定/倍/傷) are muted cards with “no Used In listed”. A “KanjiDamage order” sort toggle is a nice-to-have.
- **Detail panel:** shows reading provenance (“from note”, “own onyomi”, “override”), member list with each member’s onyomi and pass/fail reason. This is essential for trusting the red highlights.

### 4.4 Kanji components

- Character components only; groups = 445 components, **262** shared by ≥2. Each kanji gets **one primary group = its rarest shared component** (smallest group), which yields exactly the requested **不 = 歪 杯 否**.
  - Why rarest? It is the most distinctive shared feature; common components (口 97, 水 98, 木 86) would swallow the map.
  - Tie-break: component order in KanjiDamage; then visual weight.
- **Adjacency:** component glyphs are embedded with the same pixel pipeline; top-k similarity edges feed a force layout. 日/月/早 component islands sit together, so the 明 (月 group) and 朝 (早 group) neighbourhoods are adjacent — the spirit of the 明/朝 example.
- **Focus:** clicking an island shows *all* kanji containing that component, including ones primarily grouped elsewhere, flagged “also contains”. This restores completeness without duplicate nodes.
- **Toggle:** “show every membership” (off by default) duplicates kanji across their ≤4 groups with dashed links.
- **179 ungrouped kanji** with no shared component go to a searchable “unshared” tray.
- Filters: min group size (2/3/5), character vs image radical, search by component/kanji.

### 4.5 Inspector and compare

- Inspector: large glyph, meaning, onyomi + keyword mnemonics, kunyomi, components, tags, usefulness, strokes, frequency, KanjiDamage link, lookalikes, and a mode-specific “why here?” explanation.
- Compare tray: pin 2–3 kanji → side-by-side glyphs, shared vs unique components (both sources), onyomi intersection, pixel difference heatmap (overlap/one-only/other-only), stroke count, and the dataset’s lookalike hints. This is the “tell them apart” payoff.

---

## 5. Data pipeline

    GitHub dataset JSON ─┐
    KanjiVG release zip ─┼─▶ fetch (cached, throttled) ─▶ normalize ─▶ enrich ─▶ derive groups ─▶ validate ─▶ public/data
    kanjidamage.com  ────┘        (only tag 24, /kanji, 閥)

1. **Fetch** (scripts/fetch-*, idempotent, cache under data/raw/):
   - dataset kanjidamage.json, tags.json, onyomi-keywords.json from GitHub raw;
   - KanjiVG kanjivg-*-main.zip (one request);
   - repo zip once for media/_NotoSansJP-Medium.otf + the 21 strong radical images;
   - site snapshots: /tags/24, /kanji, and /kanji/667-clique-閥, with 1 req/s and a “do not re-fetch if cached” rule.
2. **Normalize:** trim fields for the UI; split raw onyomi into tokens; strip ON-YOMI/KUN-YOMI; stopword + override cleanup (audited: 1,497 parsed, 139 blank, only 夕 = “none”); resolve used_in; merge 閥; mark image-only radicals.
3. **Enrich:**
   - KanjiVG component sets (kvg:element, nested groups included) for 1,634 kanji;
   - 64×64 pixel embeddings (sharp; stroke numbers stripped; bbox-normalized);
   - component glyph embeddings;
   - media for strong radical centers.
4. **Derive:**
   - 270 onyomi groups + phonetic similarity matrix;
   - 90 strong groups + curated strong-reading table + exception flags;
   - 262 component groups (primary + all-membership indexes);
   - precomputed seeded force-layout positions for onyomi/strong/component group maps (stable, good first render);
   - consensus scores are computed at runtime (input-dependent).
5. **Validate:** assert counts and all acceptance examples; fail the build on regressions.
6. **Output:** public/data/app-data.json, public/data/kanjivg-components.json, public/data/pixel-embeddings.bin, public/fonts/NotoSansJP-Medium.otf, public/media/strong/*, public/data/layouts.json.

**No runtime network calls.** The app works offline after npm run dev or a static build.

---

## 6. Technical architecture

- **Frontend:** React 19 + TypeScript + Vite 7; D3 modules (d3-force, d3-zoom, d3-drag, d3-shape, d3-hierarchy if needed); custom CSS with variables (no UI framework); Zustand or a typed reducer for state; URL sync; localStorage for theme/filters.
- **Build-time:** Node ESM scripts; sharp for SVG rasterization; cheerio for the small site snapshots; wanakana for kana→romaji in strong notes; d3-force for precomputed layouts.
- **No backend.** A tiny dependency-free scripts/serve.mjs can serve dist for a one-command demo.
- **Environment constraint:** npm’s default cache is outside the sandbox and is blocked. A workspace .npmrc sets cache=.npm-cache and logs-dir=.npm-logs; this is documented in the README.
- **Rendering:** SVG islands/links/labels; glyphs as text in Noto Sans JP; semantic LOD hides member nodes at low zoom; cull off-screen groups; direct <g> transform for pan/zoom; requestAnimationFrame batching.
- **Determinism:** seeded RNG for force layouts; pixel embeddings are font-independent (KanjiVG), so scores are stable on this machine and across runs.

### Proposed structure

    kanjidamageVisualizer/
      docs/ARCHITECTURE.md
      scripts/            fetch, build-data, validate, serve
      data/raw/           cached downloads (gitignored)
      data/curated/       strong-readings.json, site-supplement.json, overrides
      public/data/        generated app data
      src/
        app/              shell, routing, theme
        data/             types, loaders, indexes
        lib/              readings, jaccard, pixel, phonetic, layout, colors
        modes/            LookAlikes, OnyomiMap, StrongMap, ComponentMap
        components/       Canvas, Island, KanjiTile, Inspector, Compare, Filters, Legend
        state/            store, urlState
      tests/              unit + data fixtures
      README.md

---

## 7. Visual design

- **Concept:** a *sumi ink atlas* — warm paper (light) / charcoal (dark), ink-black type, vermilion accents, thin dashed threads, soft group islands, seal-like labels.
- **Method colors:** KanjiVG teal, KanjiDamage plum, pixel gold, onyomi indigo, components moss, exceptions vermilion. Always paired with a shape/pattern/badge so color is not the only signal.
- **Typography:** repo’s Noto Sans JP Medium for kanji and Japanese; a humanist sans for UI; a serif for the title. Kanji glyphs get generous size and lang=ja.
- **Texture:** CSS-only paper grain/dot grid; no heavy background images.
- **Motion:** islands settle once; hover lifts a tile; no looping animation; respects prefers-reduced-motion.
- **Accessibility:** keyboard search/tab/focus, ARIA labels, focus traps in drawers, 4.5:1 contrast, red exceptions also ringed + “!”.

---

## 8. Validation & testing

- **Unit (Vitest):** reading parser fixtures; strong-reading table; Jaccard; pixel metric; phonetic distance; primary-component assignment; exception classification; URL state.
- **Data validation:** exact exemplars from §2, plus counts, missing references, and image coverage.
- **Playwright (system Edge, no Chromium download):** load each mode, search 青/者/各, assert red sets and links, screenshot 1440×900 and 390×844, check no console errors/overflow.
- **Visual review:** screenshots inspected during the build; the first visual checkpoint will be shared before the remaining modes are polished.

### Acceptance tests (must pass)

1. 青 strong group contains 請清精晴情静; red = 晴, 情; normal = 請, 清, 精, 静.
2. 者 strong reading = SHO; group = 著緒諸署暑煮賭都; red includes 煮/賭/都.
3. 各 strong readings = KAKU, RAKU; 格/絡 pass; 略 red.
4. 兄 in KYOU and KEI, with a visible cross-group link; 教/強 in KYOU.
5. 不 component group = 歪, 杯, 否.
6. KYOU island is near KOU.
7. 139 blank-reading kanji appear in the no-reading tray, not fabricated.
8. 3 empty strong groups render as empty, not broken.
9. 179 unshared kanji appear in the component tray.
10. 閥 resolves the 門 used-in reference; no dangling IDs.

---

## 9. Build phases

| Phase | Content | Checkpoint |
|---|---|---|
| 0 | Scaffold, npm cache config, data fetch + normalize + validation, typed app data | data report |
| 1 | Shell, theme, canvas primitives, inspector, search/filters | screenshot |
| 2 | Look-alikes (3 lenses + consensus + pixel metrics) | screenshot |
| 3 | Onyomi map (islands, links, phonetic layout) | screenshot |
| 4 | Strong map (90 groups, curated readings, red exceptions) | screenshot |
| 5 | Component map (primary + focus + all-membership toggle) | screenshot |
| 6 | Compare drawer, export, a11y, tests, README, final visual pass | full app |

Each phase ends with typecheck, unit tests, and a screenshot for review; the plan can be adjusted after Phase 2 without redoing the data layer.

---

## 10. Implementation notes (post-build)

The plan above is the approved architecture. Visual QA led to a few deliberate changes:

- **Onyomi defaults to a focused constellation** (KYOU) instead of the full 200-island map. The focus
  includes phonetic neighbours plus the other readings of its multi-reading kanji, so 兄 links KYOU to
  KEI automatically. “Show all readings” restores the global map. Focus positions are a compact radial
  layout; the global map keeps the precomputed force layout.
- **Component mode is a focused neighbourhood + browser**, not a 445-node global force map. A global map
  of 445 components was unreadable at fit. The focus radar ranks neighbours by shape overlap (stretched,
  dilated IoU), containment, shared structural labels, and co-occurrence; “Browse all 445” remains.
  The primary-component policy is still used for the “primary” marker and the all-membership toggle.
- **Strong mode keeps the full 87-family map** (3 empty families are hidden by default) and **clicks zoom
  into a family**; quick chips also fly to 青/者/各/生/兄/etc. The full map is an overview; the family
  inspector is the detail surface.
- **Look-alikes shows the top 18 of 28 scored matches** per lens. The consensus strip uses the top 12.
- **Compare pins up to 3**, with pairwise tabs; the heatmap shows 64×64 overlap / only-A / only-B ink.
- **One-click PNG/SVG export is not shipped in this pass.** Every view is URL-encoded and shareable;
  browser print/screenshot is the current fallback.

### Actual counts in the build

| Fact | Value |
|---|---|
| Entries | 1,758 (1,637 kanji + 121 image radicals) |
| Onyomi | 270 groups; 200 with 2+; 47 multi-reading; 139 kanji with no onyomi |
| Strong | 90 families; 441 refs = 437 kanji + 4 image-radical members; 3 empty (定/倍/傷); 217 exceptions, 22 blank-reading |
| Components | 445 groups; 262 shared; 179 ungrouped |
| KanjiVG | 1,635 of 1,637 kanji covered (￥ and < missing) |
| Pixels | 1,641 glyphs at 64×64 (includes component glyphs); 6 MB binary |
| Site supplement | 閥 merged; 9 katakana radicals catalogued |

### Reproducible pipeline

- `npm run data:fetch` — cache dataset JSON, KanjiVG zip, repo font/images, tag-24/index/閥 snapshots.
- `npm run data:build` — normalize, parse readings, curate strong families, extract KanjiVG components,
  render pixel embeddings, derive groups/layouts, write `public/data`.
- `npm run data:validate` — independent acceptance checks (counts, 青/者/各, 兄/KYOU/KEI, 不, 明, 閥,
  pixel binary).
- `npm run test` — Vitest parser/phonetic/pixel/Jaccard tests.
- `npm run serve` — tiny static server for `dist`.

The generated `public/data`, `public/fonts`, and `public/media/strong` are gitignored; clone +
`npm run data:all` regenerates them.

### GitHub Pages

The site is published from the `gh-pages` branch at
https://benchi2202.github.io/Kanjidamage-Atlas/. The branch contains the built `dist/` output,
including generated data, font, radical images, and `.nojekyll`; `main` stays source-only. The build
uses `GITHUB_PAGES=true` so Vite emits the project-page base `/Kanjidamage-Atlas/` and the asset helper
prefixes media URLs correctly. The three one-time site snapshots in `data/site-cache/` keep local data
rebuilds off kanjidamage.com.

---

## 11. Decisions for approval

**Recommended defaults:**

- Three-lens triptych for Look-alikes (not a ternary plot or tabs).
- One primary component per kanji + focus expansion; all-membership toggle available.
- No external reading supplementation; blanks stay blanks; strong readings curated from KanjiDamage notes.
- Local web app (Vite dev server + static build), not a packaged desktop binary yet.
- English UI, KanjiDamage meanings/readings as-is.
- Sumi atlas visual direction.

Please confirm or change these. The main risks are data curation (mitigated by the 90-entry reviewed table and tests) and diagram density (mitigated by semantic zoom and filters).