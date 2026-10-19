import { useState } from "react";
import { useModel } from "../../data/context";
import { useAtlasStore } from "../../state/store";
import { Note, Section, Toggle } from "../Controls";
import { Icon } from "../Icon";

const quick = ["不", "明", "日", "青", "水", "木", "早", "月"];

export function ComponentControls() {
  const model = useModel();
  const center = useAtlasStore((state) => state.componentCenter);
  const setCenter = useAtlasStore((state) => state.setComponentCenter);
  const selectGroup = useAtlasStore((state) => state.selectGroup);
  const selectEntry = useAtlasStore((state) => state.selectEntry);
  const showAll = useAtlasStore((state) => state.componentShowAll);
  const setShowAll = useAtlasStore((state) => state.setComponentShowAll);
  const setBrowseOpen = useAtlasStore((state) => state.setBrowseOpen);
  const setUngroupedOpen = useAtlasStore((state) => state.setUngroupedOpen);
  const [query, setQuery] = useState("");

  const group = model.componentByGlyph.get(center) ?? model.componentByGlyph.get("不") ?? null;
  const results = query.trim()
    ? model.search(query, 8).filter((result) => result.kind === "component" || result.kind === "kanji")
    : [];

  const chooseComponent = (component: string) => {
    setCenter(component);
    const hit = model.componentByGlyph.get(component);
    if (hit) selectGroup(hit.id);
  };

  return (
    <div className="controls">
      <Section title="Focus component" hint="one component at a time">
        <div className="component-current">
          <span className="component-current-glyph" lang="ja">{group?.component ?? "?"}</span>
          <div>
            <strong>{group?.meaning ?? "component"}</strong>
            <small>{group ? group.count + " kanji contain it · " + group.primaryIds.length + " primary" : "not found"}</small>
          </div>
        </div>
        <label className="picker-field">
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="日, 不, light, 晴…"
            aria-label="Search component groups"
          />
        </label>
        {query.trim() ? (
          <div className="inline-results">
            {results.length ? results.map((result) => (
              <button
                key={result.kind + result.id}
                type="button"
                onClick={() => {
                  if (result.componentGroup) {
                    chooseComponent(result.componentGroup.component);
                  } else if (result.entry) {
                    const primary = result.entry.primaryComponent;
                    if (primary) chooseComponent(primary);
                    selectEntry(result.entry.id);
                  }
                  setQuery("");
                }}
              >
                <span className="inline-glyph" lang="ja">{result.glyph ?? "部"}</span>
                <span><strong>{result.label}</strong><small>{result.sublabel}</small></span>
              </button>
            )) : <p className="search-empty">No component or kanji match.</p>}
          </div>
        ) : null}
        <div className="quick-chips component-chips">
          {quick.map((component) => (
            <button
              key={component}
              type="button"
              lang="ja"
              className={component === center ? "active" : ""}
              onClick={() => chooseComponent(component)}
            >
              {component}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Membership" hint="focus card">
        <Toggle
          checked={showAll}
          onChange={setShowAll}
          label="Show every containing kanji"
          hint="Off: only kanji whose primary component is this one"
        />
        <Note>
          The primary group is a kanji's rarest shared component. The focus card can show every kanji that
          contains the component, even if its primary group is elsewhere.
        </Note>
      </Section>

      <Section title="Browse">
        <button type="button" className="wide-button" onClick={() => setBrowseOpen(true)}>
          <span><Icon name="grid" size={15} /> All 445 component groups</span>
          <Icon name="chevron-right" size={14} />
        </button>
        <button type="button" className="wide-button" onClick={() => setUngroupedOpen(true)}>
          <span><Icon name="layers" size={15} /> Ungrouped kanji</span>
          <span className="subtle-count">{model.data.ungroupedIds.length}</span>
        </button>
      </Section>

      <div className="sidebar-note">
        <strong>Neighbourhood, not hierarchy</strong>
        <p>Selecting a component shows its most similar component groups. A neighbour can be visually similar, structurally contained, or used alongside the center component.</p>
      </div>
    </div>
  );
}
