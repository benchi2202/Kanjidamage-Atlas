# KanjiDamage Atlas

An interactive field guide to confusable kanji: group the KanjiDamage set by shape, component, and
pronunciation, then compare any two to see exactly where the resemblance ends.

> **Status:** Phase 0 — architecture approved, repository scaffolded. The data pipeline and the four
> visualization modes are next. The current page is a design/status placeholder, not the atlas yet.

## What it will do

| Mode | What it groups | How |
|---|---|---|
| **Look-alikes** | kanji visually similar to one you choose | KanjiVG component Jaccard, KanjiDamage component Jaccard, and normalized pixel difference, with a consensus strip |
| **Same onyomi** | kanji sharing an onyomi | pronunciation islands; similar-sounding readings sit together; multi-reading kanji are linked across groups |
| **Strong onyomi** | the 90 `STRONG` entries from KanjiDamage tag 24 | the entry's *Used In* family; members whose onyomi does not match the strong reading are highlighted in red |
| **Kanji components** | kanji sharing one component | component archipelago; the rarest shared component is each kanji's primary group; similar components are placed side by side |

A compare drawer (2–3 pinned kanji) adds a pixel-difference heatmap, shared/unique components, and
onyomi overlap — the "tell them apart" payoff.

The full design, data findings, algorithms, and acceptance tests are in
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Quick start

Requires Node **20.19+** or **22.12+** (Vite 7).

```bash
npm install
npm run dev
```

Then open the printed local URL (default `http://127.0.0.1:5173`).

Other scripts:

```bash
npm run build      # typecheck + production build
npm run preview    # preview the production build
npm run typecheck
npm run test
```

### npm cache in this environment

The default npm cache lives outside the writable workspace, so `.npmrc` redirects it to
`.npm-cache/` (ignored by git). If you move this project to another machine, npm will simply create
its cache inside the project. This is a sandbox accommodation, not a publishing choice.

## Data policy

- The **GitHub dataset** ([benchi2202/Kanjidamage-dataset](https://github.com/benchi2202/Kanjidamage-dataset))
  is canonical.
- The KanjiDamage site is read **once**, throttled, and cached only for the tag-24 snapshot, the
  `/kanji` index, and the one missing entry 閥 (which resolves the only dangling `used_in` reference).
- **No runtime scraping.** The built app is fully local and offline.
- **Readings are not invented.** If a KanjiDamage entry has no onyomi, the atlas leaves it blank.
  This is why 晴 is correctly treated as an exception in the 青 strong group.
- Raw downloads and generated assets are not committed; the build scripts fetch and derive them.

Verified starting numbers: 1,757 dataset entries (1,636 kanji + 121 image radicals), 90 strong
groups, 270 onyomi readings (199 with ≥2 kanji), 262 shared character components, and 1,634/1,636
KanjiVG coverage.

## Repository layout

```
docs/ARCHITECTURE.md   approved plan, data notes, acceptance tests
src/                   React app (placeholder in Phase 0)
public/                static assets
scripts/               data fetch/build/validate/serve scripts (coming in Phase 0/1)
data/raw/              cached downloads (gitignored)
data/curated/          reviewed strong readings and overrides (tracked)
```

## Roadmap

- [x] Architecture and data-source audit
- [ ] Data fetch + normalize + validation pipeline
- [ ] App shell, design system, inspector
- [ ] Look-alikes, onyomi, strong, and component modes
- [ ] Compare drawer, export, accessibility, tests

## Attribution

This is an unofficial study tool, not affiliated with or endorsed by KanjiDamage. KanjiDamage
content and media belong to their author. KanjiVG is used under CC BY-SA 3.0. See
**[ATTRIBUTION.md](ATTRIBUTION.md)** for details.
