import { useEffect, useMemo, useRef, useState } from "react";
import type { Entry } from "../data/types";
import { useModel } from "../data/context";
import { useAtlasStore } from "../state/store";
import { MapView, type MapApi, type MapBounds } from "../components/MapView";
import { Icon } from "../components/Icon";

function positions(count: number, radius: number) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
    out.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return out;
}

function limitFor(k: number, selected: boolean, count: number): number {
  if (selected) return Math.min(10, count);
  if (k < 0.42) return 0;
  if (k < 0.72) return Math.min(4, count);
  if (k < 1.15) return Math.min(6, count);
  return Math.min(8, count);
}

export function StrongMode() {
  const model = useModel();
  const mapApi = useRef<MapApi>(null);
  const selectedGroupId = useAtlasStore((state) => state.selectedGroupId);
  const selectedEntryId = useAtlasStore((state) => state.selectedEntryId);
  const selectGroup = useAtlasStore((state) => state.selectGroup);
  const selectEntry = useAtlasStore((state) => state.selectEntry);
  const clearSelection = useAtlasStore((state) => state.clearSelection);
  const onlyExceptions = useAtlasStore((state) => state.strongOnlyExceptions);
  const showEmpty = useAtlasStore((state) => state.strongShowEmpty);
  const focusGroupId = useAtlasStore((state) => state.focusGroupId);
  const focusRequest = useAtlasStore((state) => state.focusRequest);
  const [hoverGroupId, setHoverGroupId] = useState<string | null>(null);
  const [hoverEntryId, setHoverEntryId] = useState<number | null>(null);

  const visibleGroups = useMemo(
    () =>
      model.data.strongGroups.filter((group) => {
        if (!showEmpty && group.empty) return false;
        if (onlyExceptions && group.counts.exception === 0) return false;
        return true;
      }),
    [model, onlyExceptions, showEmpty],
  );
  const visibleIds = useMemo(() => new Set(visibleGroups.map((group) => group.id)), [visibleGroups]);
  const byId = useMemo(() => new Map(visibleGroups.map((group) => [group.id, group])), [visibleGroups]);

  const bounds = useMemo<MapBounds>(() => {
    if (!visibleGroups.length) return { minX: -100, maxX: 100, minY: -100, maxY: 100 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const group of visibleGroups) {
      minX = Math.min(minX, group.layout.x - group.layout.r);
      maxX = Math.max(maxX, group.layout.x + group.layout.r);
      minY = Math.min(minY, group.layout.y - group.layout.r);
      maxY = Math.max(maxY, group.layout.y + group.layout.r);
    }
    return { minX, maxX, minY, maxY };
  }, [visibleGroups]);

  const members = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const group of visibleGroups) {
      const list = group.members
        .map((member) => model.byId.get(member.id))
        .filter((entry): entry is Entry => Boolean(entry?.kanji))
        .sort((a, b) => (b.usefulness ?? 0) - (a.usefulness ?? 0) || (a.position ?? 1e9) - (b.position ?? 1e9));
      map.set(group.id, list);
    }
    return map;
  }, [model, visibleGroups]);

  const links = useMemo(
    () => model.data.strongLinks.filter((link) => visibleIds.has(link.source) && visibleIds.has(link.target) && link.similarity >= 0.58),
    [model, visibleIds],
  );

  useEffect(() => {
    if (!focusRequest || !focusGroupId) return;
    const group = byId.get(focusGroupId);
    if (group) mapApi.current?.focusOn(group.layout.x, group.layout.y, 1.15);
  }, [focusRequest, focusGroupId, byId]);

  const activeGroupId = hoverGroupId ?? selectedGroupId;
  const activeEntryId = hoverEntryId ?? selectedEntryId;
  const hoveredGroup = hoverGroupId ? byId.get(hoverGroupId) ?? null : null;

  if (!visibleGroups.length) {
    return <div className="map-empty"><Icon name="layers" size={28} /><h2>No families match</h2><p>Turn off the exception filter or show empty families.</p></div>;
  }

  return (
    <div className="map-stage">
      <MapView
        ref={mapApi}
        bounds={bounds}
        label="Strong onyomi families"
        onBackgroundClick={clearSelection}
        render={(k) => (
          <g>
            <g className="map-links">
              {links.map((link) => {
                const a = byId.get(link.source);
                const b = byId.get(link.target);
                if (!a || !b) return null;
                const active = activeGroupId === a.id || activeGroupId === b.id;
                const mx = (a.layout.x + b.layout.x) / 2;
                const my = (a.layout.y + b.layout.y) / 2 + 26;
                return (
                  <path
                    key={link.source + link.target}
                    className={"strong-link" + (active ? " active" : "")}
                    d={"M" + a.layout.x + "," + a.layout.y + " Q" + mx + "," + my + " " + b.layout.x + "," + b.layout.y}
                    style={{ opacity: active ? 0.42 : 0.07 + link.similarity * 0.06 }}
                  />
                );
              })}
            </g>

            {visibleGroups.map((group) => {
              const selected = selectedGroupId === group.id;
              const hovered = hoverGroupId === group.id;
              const list = members.get(group.id) ?? [];
              const limit = limitFor(k, selected || hovered, list.length);
              const shown = list.slice(0, limit);
              const chips = positions(shown.length, group.layout.r * 0.7);
              const showLabel = selected || hovered || group.layout.r * k > 22;
              const clipId = "clip-strong-" + group.entryId;
              const r = group.layout.r;
              const readingSize = Math.max(8.5, Math.min(13, r * 0.12));
              const glyphSize = Math.max(20, Math.min(48, r * 0.46));
              return (
                <g
                  key={group.id}
                  className={"strong-family" + (selected ? " selected" : "") + (hovered ? " hovered" : "") + (group.empty ? " empty" : "")}
                  transform={"translate(" + group.layout.x + "," + group.layout.y + ")"}
                  onMouseEnter={() => setHoverGroupId(group.id)}
                  onMouseLeave={() => setHoverGroupId(null)}
                  onClick={(event) => {
                    event.stopPropagation();
                    selectGroup(group.id);
                    mapApi.current?.focusOn(group.layout.x, group.layout.y, 1.0);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    mapApi.current?.focusOn(group.layout.x, group.layout.y, 1.2);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={(group.glyph ?? group.meaning) + " strong family, " + group.readings.join(" and ") + ", " + group.counts.exception + " exceptions"}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectGroup(group.id);
                    }
                  }}
                >
                  <circle className="strong-disc" r={r} />
                  <circle className="strong-ring" r={r} />
                  {group.image ? (
                    <>
                      <defs>
                        <clipPath id={clipId}>
                          <circle r={r * 0.4} />
                        </clipPath>
                      </defs>
                      <image
                        href={"/media/strong/" + group.image}
                        x={-r * 0.4}
                        y={-r * 0.4}
                        width={r * 0.8}
                        height={r * 0.8}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={"url(#" + clipId + ")"}
                      />
                    </>
                  ) : (
                    <text className="strong-glyph" y={-r * 0.05} textAnchor="middle" dominantBaseline="central" lang="ja" style={{ fontSize: glyphSize }}>
                      {group.glyph}
                    </text>
                  )}
                  {showLabel ? (
                    <text className="strong-reading" y={r * 0.34} textAnchor="middle" style={{ fontSize: readingSize }}>
                      {group.readings.join(" / ") || "reading unknown"}
                    </text>
                  ) : null}
                  <g className="strong-badges">
                    {group.counts.exception > 0 ? (
                      <g transform={"translate(" + r * 0.66 + "," + -r * 0.66 + ")"}>
                        <circle className="exception-badge" r={Math.max(7, r * 0.12)} />
                        <text y={1} textAnchor="middle" dominantBaseline="central" style={{ fontSize: Math.max(8, r * 0.11) }}>
                          !{group.counts.exception}
                        </text>
                      </g>
                    ) : (
                      <g transform={"translate(" + r * 0.66 + "," + -r * 0.66 + ")"}>
                        <circle className="pass-badge" r={Math.max(6, r * 0.09)} />
                        <text y={1} textAnchor="middle" dominantBaseline="central" style={{ fontSize: Math.max(7, r * 0.085) }}>
                          {group.counts.pass}
                        </text>
                      </g>
                    )}
                  </g>
                  {shown.map((entry, index) => {
                    const chip = chips[index];
                    const member = group.members.find((item) => item.id === entry.id);
                    const exception = member?.status === "exception";
                    const noReading = member?.reason === "no-reading";
                    const active = activeEntryId === entry.id;
                    return (
                      <g
                        key={entry.id}
                        className={"kanji-chip strong-member" + (exception ? " exception" : "") + (noReading ? " no-reading" : "") + (active ? " active" : "")}
                        transform={"translate(" + chip.x + "," + chip.y + ")"}
                        onMouseEnter={(event) => { event.stopPropagation(); setHoverEntryId(entry.id); }}
                        onMouseLeave={(event) => { event.stopPropagation(); setHoverEntryId(null); }}
                        onClick={(event) => { event.stopPropagation(); selectEntry(entry.id); }}
                        role="button"
                        tabIndex={0}
                        aria-label={(entry.kanji ?? "") + " " + (exception ? "exception" : "matches") + " in " + group.readings.join(" and ")}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectEntry(entry.id);
                          }
                        }}
                      >
                        <circle r={Math.max(8, r * 0.095)} />
                        <text y={1} textAnchor="middle" dominantBaseline="central" lang="ja" style={{ fontSize: Math.max(10, r * 0.13) }}>
                          {entry.kanji}
                        </text>
                        {exception ? <circle className="chip-alert" cx={r * 0.065} cy={-r * 0.065} r={2.2} /> : null}
                      </g>
                    );
                  })}
                  {list.length > shown.length && shown.length > 0 ? (
                    <text className="island-more" y={r * 0.86} textAnchor="middle">+{list.length - shown.length}</text>
                  ) : null}
                  {group.empty ? <text className="empty-label" y={r * 0.58} textAnchor="middle">no Used In</text> : null}
                </g>
              );
            })}
          </g>
        )}
      />

      <div className="map-overlay map-overlay-top-left">
        <p className="eyebrow">Same strong onyomi · tag 24</p>
        <h1>Strong families</h1>
        <p>{visibleGroups.length} families · red members do not share the strong reading</p>
      </div>

      <div className="map-overlay map-overlay-top-right">
        {hoveredGroup ? (
          <div className="hover-card">
            <span className="hover-reading">{hoveredGroup.glyph ?? hoveredGroup.meaning}</span>
            <span>{hoveredGroup.readings.join(" / ")}</span>
            <strong>{hoveredGroup.counts.pass} pass · {hoveredGroup.counts.exception} exception</strong>
          </div>
        ) : null}
      </div>

      <div className="map-legend map-legend-bottom">
        <span><i className="legend-pass" /> matching onyomi</span>
        <span><i className="legend-exception" /> exception</span>
        <span><i className="legend-noreading" /> blank reading</span>
        <span><i className="legend-radical" /> radical member</span>
        <span className="map-hint">click a family for provenance and the full member list</span>
      </div>
    </div>
  );
}
