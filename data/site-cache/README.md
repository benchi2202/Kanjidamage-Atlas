# Cached site snapshots

These three one-time snapshots from kanjidamage.com are committed so local and CI builds do not
need to contact the site:

- `tag-24.html` — the STRONG tag page (90 entries; validation)
- `kanji-index.html` — the /kanji index (1,767 entries; site-only diff)
- `kanji-667.html` — 閥, the one used_in entry missing from the GitHub dataset

They were captured on 2026-10-19 and are used only by `scripts/fetch-data.mjs` and
`scripts/build-data.mjs`. If the files are absent, the fetch script falls back to a throttled
one-time request. The site content remains KanjiDamage's work; see ATTRIBUTION.md.
