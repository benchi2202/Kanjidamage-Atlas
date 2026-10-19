import { useState } from "react";
import { useModel } from "../../data/context";
import { useAtlasStore } from "../../state/store";
import { Note, Section, Segmented, Toggle } from "../Controls";
import { Icon } from "../Icon";

export function OnyomiControls() {
  const model = useModel();
  const minGroupSize = useAtlasStore((state) => state.onyomiMinGroupSize);
  const setMinGroupSize = useAtlasStore((state) => state.setOnyomiMinGroupSize);
  const showAll = useAtlasStore((state) => state.onyomiShowAll);
  const setShowAll = useAtlasStore((state) => state.setOnyomiShowAll);
  const focusReading = useAtlasStore((state) => state.onyomiFocusReading);
  const requestGroupFocus = useAtlasStore((state) => state.requestGroupFocus);
  const selectEntry = useAtlasStore((state) => state.selectEntry);
  const setNoReadingOpen = useAtlasStore((state) => state.setNoReadingOpen);
  const [query, setQuery] = useState("");

  const results = query.trim() ? model.search(query, 8).filter((result) => result.kind === "reading" || result.kind === "kanji") : [];
  const top = model.data.onyomiGroups.filter((group) => group.count >= minGroupSize).slice(0, 10);
  const max = top[0]?.count ?? 1;

  return (
    <div className="controls">
      <Section title="Find a sound" hint="reading or kanji">
        <label className="picker-field">
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="KYOU, 兄, 教…"
            aria-label="Search onyomi readings or kanji"
          />
        </label>
        {query.trim() ? (
          <div className="inline-results">
            {results.length ? results.map((result) => (
              <button
                key={result.kind + result.id}
                type="button"
                onClick={() => {
                  if (result.readingGroup) requestGroupFocus(result.readingGroup.id);
                  if (result.entry) selectEntry(result.entry.id);
                  setQuery("");
                }}
              >
                <span className="inline-glyph" lang="ja">{result.glyph ?? "音"}</span>
                <span><strong>{result.label}</strong><small>{result.sublabel}</small></span>
              </button>
            )) : <p className="search-empty">No reading or kanji match.</p>}
          </div>
        ) : null}
      </Section>

      <Section title="View" hint={showAll ? "full map" : "focused"}>
        <Toggle
          checked={showAll}
          onChange={setShowAll}
          label="Show all readings"
          hint="Off: the current reading's phonetic neighbourhood"
        />
        <div className="focus-reading-line">
          <span>focused reading</span>
          <strong>{focusReading}</strong>
        </div>
      </Section>

      <Section title="Full-map group size" hint="fewer islands, less noise">
        <Segmented
          label="Minimum onyomi group size"
          value={minGroupSize}
          onChange={setMinGroupSize}
          options={[
            { value: 2, label: "2+" },
            { value: 3, label: "3+" },
            { value: 5, label: "5+" },
          ]}
        />
      </Section>

      <Section title="Largest sound families" hint={model.data.quality.onyomiGroups2 + " with 2+"}>
        <div className="reading-list">
          {top.map((group) => (
            <button key={group.id} type="button" onClick={() => requestGroupFocus(group.id)}>
              <span className="reading-name">{group.reading}</span>
              <span className="reading-bar"><i style={{ width: Math.max(8, (group.count / max) * 100) + "%" }} /></span>
              <span className="reading-count">{group.count}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="No reading data" hint={model.data.quality.noReadingKanji + " kanji"}>
        <button type="button" className="wide-button" onClick={() => setNoReadingOpen(true)}>
          <span><Icon name="alert" size={15} /> Open the silent tray</span>
          <Icon name="chevron-right" size={14} />
        </button>
        <Note>
          These kanji have no onyomi in KanjiDamage. They are not guessed or filled from another dictionary.
        </Note>
      </Section>

      <div className="sidebar-note">
        <strong>Reading the map</strong>
        <p>Islands are readings. Faint indigo threads connect similar sounds; dashed vermilion threads connect copies of a multi-reading kanji. Turn on “Show all readings” for the full 200-island map.</p>
      </div>
    </div>
  );
}
