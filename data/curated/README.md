# Curated data

These files encode the few human decisions the atlas needs on top of the public KanjiDamage
dataset. They are tracked in git so builds are reproducible.

## `strong-readings.json`

One record per KanjiDamage **STRONG** entry (tag 24). The reading(s) are what the strong
radical/kanji actually controls, taken from the entry's own `description` note when present and
from its `onyomi` field otherwise.

The reviewed exceptions include:

| Entry | Strong reading(s) | Why |
|---|---|---|
| 者 | SHO | its description says it is strong for SHO, even though its own onyomi is SHA |
| 各 | KAKU, RAKU | its description names both かく and らく |
| 兄 | KYOU | its description narrows the strong reading to KYOU (KEI is handled by the onyomi map) |
| 己 | KI | strong for KI, not its own KO |
| 余 | JO | strong for JO, not its own YO |
| 次 | SHI | strong for SHI, not its own JI |
| 氏 | TEI | strong for TEI, not its own SHI |
| 専 | HAKU, BAKU | strong for both, not its own SEN |
| 周 | CHOU | strong for CHOU, not its own SHUU |
| 甚 | KAN | strong for KAN, not its own JIN |
| 斉 | ZAI, SAI | its description names both |
| 尺 | TAKU, YAKU | its description names both |
| 才 | SAI, ZAI | its description names both |
| 君 | KUN, GUN | its description names both |
| 申 / 曽 / 其 / 呉 / 瓜 | SHIN / ZOU / KI / GO / KO | image/blank-onyomi entries whose notes carry the reading |
| 頭 | GAN | the head mutant radical is strong for GAN; TOU is the kanji's own onyomi |
| 羊 | YOU | no note; the dataset's own onyomi is YOU (do not drop it) |

No reading is added from an external dictionary. If a member of a group has no KanjiDamage
onyomi, it is treated as a **no-reading exception** (for example 晴 in 青's group).

## `reading-overrides.json`

Readings that a note explicitly names in addition to the leading reading expression. Only 風
("FUU - but half the time just FU") needs one so far.

## `site-supplement.json`

閥 (id 667) is present on kanjidamage.com and appears in 門's Used In list, but is missing from
the GitHub dataset. It is merged as a first-class entry. The nine site-only katakana radicals are
recorded for the data-quality panel and deliberately not mixed into kanji groups.
