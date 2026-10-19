import { useState } from "react";
import { useModel } from "../../data/context";
import { useAtlasStore } from "../../state/store";
import { Note, Section, Toggle } from "../Controls";
import { Icon } from "../Icon";

const quick = ["青", "者", "各", "生", "兄", "才", "専", "君"];

export function StrongControls() {
  const model = useModel();
  const requestGroupFocus = useAtlasStore((state) => state.requestGroupFocus);
  const selectEntry = useAtlasStore((state) => state.selectEntry);
  const onlyExceptions = useAtlasStore((state) => state.strongOnlyExceptions);
  const setOnlyExceptions = useAtlasStore((state) => state.setStrongOnlyExceptions);
  const showEmpty = useAtlasStore((state) => state.strongShowEmpty);
  const setShowEmpty = useAtlasStore((state) => state.setStrongShowEmpty);
  const [query, setQuery] = useState("");

  const results = query.trim()
    ? model.search(query, 8).filter((result) => result.kind === "strong" || result.kind === "kanji")
    : [];
  const quality = model.data.quality;

  return (
    <div className="controls">
      <Section title="Find a strong family" hint="glyph or reading">
        <label className="picker-field">
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="青, 者, SHO, KAKU…"
            aria-label="Search strong families"
          />
        </label>
        {query.trim() ? (
          <div className="inline-results">
            {results.length ? results.map((result) => (
              <button
                key={result.kind + result.id}
                type="button"
                onClick={() => {
                  if (result.strongGroup) requestGroupFocus(result.strongGroup.id);
                  if (result.entry) selectEntry(result.entry.id);
                  setQuery("");
                }}
              >
                <span className="inline-glyph" lang="ja">{result.glyph ?? "強"}</span>
                <span><strong>{result.label}</strong><small>{result.sublabel}</small></span>
              </button>
            )) : <p className="search-empty">No strong family matches.</p>}
          </div>
        ) : null}
      </Section>

      <Section title="Jump to a family">
        <div className="quick-chips">
          {quick.map((glyph) => {
            const entry = model.byKanji.get(glyph);
            const group = entry ? model.data.strongGroups.find((item) => item.entryId === entry.id) ?? null : null;
            return (
              <button
                key={glyph}
                type="button"
                lang="ja"
                disabled={!group}
                onClick={() => group && requestGroupFocus(group.id)}
                title={entry?.meaning}
              >
                {glyph}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Exceptions" hint={quality.strongExceptions + " red members"}>
        <Toggle
          checked={onlyExceptions}
          onChange={setOnlyExceptions}
          label="Only families with exceptions"
          hint="Hide fully matching families"
        />
        <Toggle
          checked={showEmpty}
          onChange={setShowEmpty}
          label="Show empty families"
          hint="The 3 entries with no Used In"
        />
        <div className="mini-stats">
          <span><b>{quality.strongPass}</b> pass</span>
          <span className="danger"><b>{quality.strongExceptions}</b> exceptions</span>
          <span><b>{quality.strongNoReading}</b> blank readings</span>
        </div>
      </Section>

      <Section title="Reading the red">
        <ul className="strong-legend">
          <li><i className="legend-pass" /> onyomi intersects the strong reading</li>
          <li><i className="legend-exception" /> known onyomi, but no match</li>
          <li><i className="legend-noreading" /> no KanjiDamage onyomi — counted as exception</li>
          <li><i className="legend-radical" /> image radical member, not a kanji</li>
        </ul>
        <Note tone="warn">
          Multiple strong readings are a union: 各 is strong for KAKU and RAKU, so 格 and 絡 pass while 略 does not.
        </Note>
      </Section>

      <div className="sidebar-note">
        <strong>Provenance</strong>
        <p>Strong readings come from each entry's KanjiDamage note where present, otherwise its own onyomi. Ambiguous notes are curated in <em>strong-readings.json</em>; no external readings are added.</p>
      </div>
    </div>
  );
}
