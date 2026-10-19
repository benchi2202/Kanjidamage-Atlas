import { useMemo, useState } from "react";
import type { Entry } from "../data/types";
import { useModel } from "../data/context";
import { useAtlasStore } from "../state/store";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

export function ComponentBrowseDialog() {
  const model = useModel();
  const open = useAtlasStore((state) => state.browseOpen);
  const setOpen = useAtlasStore((state) => state.setBrowseOpen);
  const setCenter = useAtlasStore((state) => state.setComponentCenter);
  const selectGroup = useAtlasStore((state) => state.selectGroup);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...model.data.componentGroups]
      .filter((group) => !q || group.component === query.trim() || (group.meaning ?? "").toLowerCase().includes(q))
      .sort((a, b) => b.count - a.count || a.component.localeCompare(b.component));
  }, [model, query]);

  const choose = (component: string, id: string) => {
    setCenter(component);
    selectGroup(id);
    setOpen(false);
  };

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="All component groups" eyebrow="445 components" size="xl">
      <div className="browse-toolbar">
        <label className="picker-field">
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a component or its meaning…"
            autoFocus
          />
        </label>
        <span>{groups.length} groups</span>
      </div>
      <div className="component-browse-grid">
        {groups.map((group) => {
          const primary = new Set(group.primaryIds);
          const members = group.allIds
            .map((id) => model.byId.get(id))
            .filter((entry): entry is Entry => Boolean(entry?.kanji))
            .slice(0, 4);
          return (
            <button key={group.id} type="button" className="browse-card" onClick={() => choose(group.component, group.id)}>
              <div>
                <span className="browse-glyph" lang="ja">{group.component}</span>
                <span className="browse-count">{group.count}</span>
              </div>
              <strong>{group.meaning ?? "component"}</strong>
              <small>{group.primaryIds.length} primary</small>
              <div className="browse-members">
                {members.map((entry) => (
                  <span key={entry.id} className={primary.has(entry.id) ? "primary" : ""} lang="ja">{entry.kanji}</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
