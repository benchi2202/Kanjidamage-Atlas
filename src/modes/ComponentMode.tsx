import { useMemo } from "react";
import type { ComponentGroup, Entry, FocusNeighbor } from "../data/types";
import { useModel } from "../data/context";
import { useAtlasStore } from "../state/store";
import { Icon } from "../components/Icon";

const CENTER_X = 500;
const CENTER_Y = 350;
const RX = 360;
const RY = 215;

function neighbourPosition(index: number, count: number) {
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  return { x: CENTER_X + Math.cos(angle) * RX, y: CENTER_Y + Math.sin(angle) * RY };
}

function reason(n: FocusNeighbor, center: ComponentGroup, centerSet: Set<string>, otherSet: Set<string>): string {
  const bits: string[] = [];
  if (centerSet.has(n.component)) bits.push("contains " + n.component);
  else if (otherSet.has(center.component)) bits.push("part of " + n.component);
  if (n.shared > 0) {
    const shared = [...centerSet].filter((value) => value !== center.component && value !== n.component && otherSet.has(value));
    if (shared.length) bits.push("shares " + shared.slice(0, 3).join(" "));
  }
  if (n.pixel >= 0.35) bits.push(Math.round(n.pixel * 100) + "% shape");
  if (n.cooccurrence > 1) bits.push("used together " + n.cooccurrence + "×");
  return bits.slice(0, 3).join(" · ") || "structural neighbour";
}

function MemberChips({
  ids,
  limit,
  primary,
  onSelect,
}: {
  ids: number[];
  limit: number;
  primary: Set<number>;
  onSelect: (id: number) => void;
}) {
  const model = useModel();
  const entries = useMemo(
    () =>
      ids
        .map((id) => model.byId.get(id))
        .filter((entry): entry is Entry => Boolean(entry?.kanji))
        .sort((a, b) => (b.usefulness ?? 0) - (a.usefulness ?? 0) || (a.position ?? 1e9) - (b.position ?? 1e9)),
    [ids, model],
  );
  const shown = entries.slice(0, limit);

  return (
    <div className="member-chips">
      {shown.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={"member-chip" + (primary.has(entry.id) ? " primary" : "")}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(entry.id);
          }}
          title={entry.meaning + (primary.has(entry.id) ? " · primary component" : "")}
          lang="ja"
        >
          {entry.kanji}
        </button>
      ))}
      {entries.length > shown.length ? <span className="member-more">+{entries.length - shown.length}</span> : null}
      {!entries.length ? <span className="member-none">no kanji</span> : null}
    </div>
  );
}

export function ComponentMode() {
  const model = useModel();
  const centerName = useAtlasStore((state) => state.componentCenter);
  const setCenter = useAtlasStore((state) => state.setComponentCenter);
  const selectGroup = useAtlasStore((state) => state.selectGroup);
  const selectEntry = useAtlasStore((state) => state.selectEntry);
  const showAll = useAtlasStore((state) => state.componentShowAll);
  const setBrowseOpen = useAtlasStore((state) => state.setBrowseOpen);

  const center = model.componentByGlyph.get(centerName) ?? model.componentByGlyph.get("不") ?? null;
  if (!center) {
    return <div className="map-empty"><Icon name="grid" size={28} /><h2>No component data</h2></div>;
  }

  const neighbors = center.focusNeighbors
    .slice(0, 6)
    .map((neighbor) => ({ neighbor, group: model.data.componentGroups.find((group) => group.id === neighbor.id) }))
    .filter((item): item is { neighbor: FocusNeighbor; group: ComponentGroup } => Boolean(item.group));

  const centerSet = new Set(model.getKvg(center.component) ?? []);
  const primary = new Set(center.primaryIds);
  const memberIds = showAll ? center.allIds : center.primaryIds.length ? center.primaryIds : center.allIds;

  const focus = (component: string, groupId?: string) => {
    setCenter(component);
    if (groupId) selectGroup(groupId);
  };

  return (
    <div className="mode-page component-page">
      <header className="mode-heading component-heading">
        <div>
          <p className="eyebrow">Kanji components · one shared component</p>
          <h1>Component neighbourhood</h1>
          <p>
            The center is one shared component. The six surrounding groups are the closest component
            neighbourhoods by shape, containment, shared structure, and co-occurrence.
          </p>
        </div>
        <div className="component-heading-badge">
          <span lang="ja">{center.component}</span>
          <div>
            <strong>{center.meaning ?? "component"}</strong>
            <small>{center.count} kanji contain it · {center.primaryIds.length} primary</small>
          </div>
        </div>
      </header>

      <div className="component-focus">
        <svg className="focus-links" viewBox="0 0 1000 700" aria-hidden="true">
          <ellipse className="focus-orbit" cx={CENTER_X} cy={CENTER_Y} rx={RX} ry={RY} />
          {neighbors.map(({ neighbor, group }, index) => {
            const position = neighbourPosition(index, neighbors.length);
            return (
              <line
                key={group.id}
                x1={CENTER_X}
                y1={CENTER_Y}
                x2={position.x}
                y2={position.y}
                className="focus-link"
                style={{ opacity: 0.16 + neighbor.similarity * 0.55 }}
              />
            );
          })}
        </svg>

        <article className="focus-center" onClick={() => selectGroup(center.id)}>
          <span className="focus-kicker">Center component</span>
          <div className="focus-center-glyph" lang="ja">{center.component}</div>
          <h2>{center.meaning ?? "component"}</h2>
          <p>{center.count} kanji contain it · {center.primaryIds.length} primary assignment{center.primaryIds.length === 1 ? "" : "s"}</p>
          <MemberChips ids={memberIds} limit={10} primary={primary} onSelect={selectEntry} />
          {center.allIds.length > 10 ? (
            <button type="button" className="text-button" onClick={(event) => { event.stopPropagation(); selectGroup(center.id); }}>
              View all {center.allIds.length} <Icon name="arrow-right" size={12} />
            </button>
          ) : null}
        </article>

        {neighbors.map(({ neighbor, group }, index) => {
          const position = neighbourPosition(index, neighbors.length);
          const otherSet = new Set(model.getKvg(group.component) ?? []);
          const groupPrimary = new Set(group.primaryIds);
          return (
            <article
              key={group.id}
              className="focus-card"
              style={{ left: (position.x / 1000) * 100 + "%", top: (position.y / 700) * 100 + "%" }}
              onClick={() => focus(group.component, group.id)}
            >
              <div className="focus-card-head">
                <span className="focus-card-glyph" lang="ja">{group.component}</span>
                <span className="focus-count">{group.count}</span>
                <button
                  type="button"
                  className="text-button focus-action"
                  aria-label={"Focus " + group.component + " component group"}
                  onClick={(event) => {
                    event.stopPropagation();
                    focus(group.component, group.id);
                  }}
                >
                  focus
                </button>
              </div>
              <strong>{group.meaning ?? "component"}</strong>
              <span className="focus-similarity">
                <i style={{ width: Math.round(neighbor.similarity * 100) + "%" }} />
                {Math.round(neighbor.similarity * 100)}
              </span>
              <MemberChips ids={group.allIds} limit={5} primary={groupPrimary} onSelect={selectEntry} />
              <small>{reason(neighbor, center, centerSet, otherSet)}</small>
            </article>
          );
        })}
      </div>

      <div className="component-foot">
        <p>
          <strong>Primary group</strong> = the rarest shared component of a kanji. A component card can show
          every containing kanji, including ones assigned elsewhere. The browser groups by one component;
          this neighbourhood makes the edges between those groups visible.
        </p>
        <button type="button" className="button ghost" onClick={() => setBrowseOpen(true)}>
          <Icon name="grid" size={14} /> Browse all 445 components
        </button>
      </div>
    </div>
  );
}
