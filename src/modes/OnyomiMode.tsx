import { useEffect, useMemo, useRef, useState } from "react";
import type { Entry } from "../data/types";
import { useModel } from "../data/context";
import { useAtlasStore } from "../state/store";
import { MapView, type MapApi, type MapBounds } from "../components/MapView";
import { Icon } from "../components/Icon";

function chipPositions(count: number, radius: number): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  const positions = [];
  const start = -Math.PI / 2;
  for (let i = 0; i < count; i++) {
    const angle = start + (i / count) * Math.PI * 2;
    positions.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return positions;
}

function memberLimit(k: number, selected: boolean, count: number): number {
  if (selected) return Math.min(8, count);
  if (k < 0.42) return 0;
  if (k < 0.72) return Math.min(4, count);
  if (k < 1.15) return Math.min(6, count);
  return Math.min(8, count);
}

export function OnyomiMode() {
  const model = useModel();
  const mapApi = useRef<MapApi>(null);
  const minGroupSize = useAtlasStore((state) => state.onyomiMinGroupSize);
  const showAll = useAtlasStore((state) => state.onyomiShowAll);
  const setShowAll = useAtlasStore((state) => state.setOnyomiShowAll);
  const focusReading = useAtlasStore((state) => state.onyomiFocusReading);
  const setFocusReading = useAtlasStore((state) => state.setOnyomiFocusReading);
  const selectedGroupId = useAtlasStore((state) => state.selectedGroupId);
  const selectedEntryId = useAtlasStore((state) => state.selectedEntryId);
  const selectGroup = useAtlasStore((state) => state.selectGroup);
  const selectEntry = useAtlasStore((state) => state.selectEntry);
  const clearSelection = useAtlasStore((state) => state.clearSelection);
  const focusGroupId = useAtlasStore((state) => state.focusGroupId);
  const focusRequest = useAtlasStore((state) => state.focusRequest);
  const [hoverGroupId, setHoverGroupId] = useState<string | null>(null);
  const [hoverEntryId, setHoverEntryId] = useState<number | null>(null);

  const allVisible = useMemo(
    () => model.data.onyomiGroups.filter((group) => group.count >= minGroupSize),
    [model, minGroupSize],
  );
  const groupByIdAll = useMemo(
    () => new Map(model.data.onyomiGroups.map((group) => [group.id, group])),
    [model],
  );
  const focusCenter =
    model.onyomiByReading.get(focusReading) ?? allVisible[0] ?? model.data.onyomiGroups[0] ?? null;

  const focusNeighbours = useMemo(() => {
    if (!focusCenter) return [];
    const ranked = model.data.onyomiLinks
      .filter((link) => link.source === focusCenter.id || link.target === focusCenter.id)
      .map((link) => ({
        id: link.source === focusCenter.id ? link.target : link.source,
        similarity: link.similarity,
      }))
      .sort((a, b) => b.similarity - a.similarity);
    const seen = new Set<string>([focusCenter.id]);
    const result = [];
    for (const item of ranked) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const group = groupByIdAll.get(item.id);
      if (group) result.push(group);
      if (result.length >= 8) break;
    }
    // A focus island should also reveal the other readings of its own multi-reading
    // kanji (e.g. 兄 links KYOU to KEI even when the phonetic edge is weak).
    for (const id of focusCenter.memberIds) {
      const entry = model.byId.get(id);
      if (!entry) continue;
      for (const reading of entry.readings) {
        if (reading === focusCenter.reading) continue;
        const group = model.onyomiByReading.get(reading);
        if (group && group.count >= 2 && !seen.has(group.id)) {
          seen.add(group.id);
          result.push(group);
        }
        if (result.length >= 10) break;
      }
      if (result.length >= 10) break;
    }
    return result;
  }, [model, focusCenter, groupByIdAll]);

  const visibleGroups = useMemo(() => {
    if (showAll) return allVisible;
    if (!focusCenter) return [];
    const selected = [focusCenter, ...focusNeighbours].filter(
      (group) => group && (group.id === focusCenter.id || group.count >= 2),
    );
    if (!selected.length) return [];
    const n = Math.max(1, selected.length - 1);
    const maxRadius = Math.max(...selected.map((group) => group.layout.r));
    const ring = Math.max(
      300,
      focusCenter.layout.r + maxRadius + 120,
      (maxRadius * 2 + 80) / (2 * Math.sin(Math.PI / Math.max(2, n))),
    );
    return selected.map((group, index) => {
      if (index === 0) return { ...group, layout: { ...group.layout, x: 0, y: 0 } };
      const angle = -Math.PI / 2 + ((index - 1) / n) * Math.PI * 2;
      return {
        ...group,
        layout: {
          ...group.layout,
          x: Math.cos(angle) * ring,
          y: Math.sin(angle) * ring,
        },
      };
    });
  }, [showAll, allVisible, focusCenter, focusNeighbours]);
  const visibleIds = useMemo(() => new Set(visibleGroups.map((group) => group.id)), [visibleGroups]);

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
      const list = group.memberIds
        .map((id) => model.byId.get(id))
        .filter((entry): entry is Entry => Boolean(entry?.kanji))
        .sort((a, b) => (b.usefulness ?? 0) - (a.usefulness ?? 0) || (a.position ?? 1e9) - (b.position ?? 1e9));
      map.set(group.id, list);
    }
    return map;
  }, [model, visibleGroups]);

  const soundLinks = useMemo(
    () => model.data.onyomiLinks.filter((link) => visibleIds.has(link.source) && visibleIds.has(link.target) && link.similarity >= 0.55),
    [model, visibleIds],
  );

  const multiLinks = useMemo(() => {
    const map = new Map<string, { source: string; target: string; entryIds: Set<number> }>();
    for (const entry of model.kanjiEntries) {
      if (entry.readings.length < 2) continue;
      const groups = model.onyomiGroupsForEntry(entry.id).filter((group) => visibleIds.has(group.id));
      for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          const source = groups[i].id;
          const target = groups[j].id;
          const key = [source, target].sort().join("::");
          if (!map.has(key)) map.set(key, { source, target, entryIds: new Set() });
          map.get(key)!.entryIds.add(entry.id);
        }
      }
    }
    return [...map.values()];
  }, [model, visibleIds]);

  const byGroupId = useMemo(() => new Map(visibleGroups.map((group) => [group.id, group])), [visibleGroups]);

  useEffect(() => {
    if (!showAll || !focusRequest || !focusGroupId) return;
    const group = byGroupId.get(focusGroupId);
    if (group) mapApi.current?.focusOn(group.layout.x, group.layout.y, 1.25);
  }, [showAll, focusRequest, focusGroupId, byGroupId]);

  const activeGroupId = hoverGroupId ?? selectedGroupId;
  const activeEntryId = hoverEntryId ?? selectedEntryId;
  const hoveredGroup = hoverGroupId ? byGroupId.get(hoverGroupId) ?? null : null;

  if (!visibleGroups.length) {
    return <div className="map-empty"><Icon name="layers" size={28} /><h2>No groups at this size</h2><p>Lower the minimum group size.</p></div>;
  }

  return (
    <div className="map-stage">
      <MapView
        ref={mapApi}
        bounds={bounds}
        label="Onyomi sound constellation"
        onBackgroundClick={clearSelection}
        render={(k) => (
          <g>
            <g className="map-links">
              {soundLinks.map((link) => {
                const a = byGroupId.get(link.source);
                const b = byGroupId.get(link.target);
                if (!a || !b) return null;
                const mx = (a.layout.x + b.layout.x) / 2;
                const my = (a.layout.y + b.layout.y) / 2 + 30;
                const active = activeGroupId === a.id || activeGroupId === b.id;
                return (
                  <path
                    key={"sound:" + link.source + link.target}
                    className={"sound-link" + (active ? " active" : "")}
                    d={"M" + a.layout.x + "," + a.layout.y + " Q" + mx + "," + my + " " + b.layout.x + "," + b.layout.y}
                    style={{ opacity: active ? 0.5 : 0.08 + link.similarity * 0.08 }}
                  />
                );
              })}
              {multiLinks.map((link) => {
                const a = byGroupId.get(link.source);
                const b = byGroupId.get(link.target);
                if (!a || !b) return null;
                const mx = (a.layout.x + b.layout.x) / 2;
                const my = (a.layout.y + b.layout.y) / 2 - 42;
                const active =
                  (activeEntryId != null && link.entryIds.has(activeEntryId)) ||
                  (activeGroupId != null && (activeGroupId === a.id || activeGroupId === b.id));
                return (
                  <path
                    key={"multi:" + link.source + link.target}
                    className={"multi-link" + (active ? " active" : "")}
                    d={"M" + a.layout.x + "," + a.layout.y + " Q" + mx + "," + my + " " + b.layout.x + "," + b.layout.y}
                  />
                );
              })}
            </g>

            {visibleGroups.map((group) => {
              const selected = selectedGroupId === group.id;
              const hovered = hoverGroupId === group.id;
              const list = members.get(group.id) ?? [];
              const limit = memberLimit(k, selected || hovered, list.length);
              const shown = list.slice(0, limit);
              const positions = chipPositions(shown.length, group.layout.r * 0.68);
              const showLabel = selected || hovered || group.layout.r * k > 23;
              const readingSize = Math.max(11, Math.min(24, group.layout.r * 0.24));
              const keywordSize = Math.max(7.5, Math.min(11, group.layout.r * 0.12));
              return (
                <g
                  key={group.id}
                  className={"reading-island" + (selected ? " selected" : "") + (hovered ? " hovered" : "")}
                  transform={"translate(" + group.layout.x + "," + group.layout.y + ")"}
                  onMouseEnter={() => setHoverGroupId(group.id)}
                  onMouseLeave={() => setHoverGroupId(null)}
                  onClick={(event) => {
                    event.stopPropagation();
                    selectGroup(group.id);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    setShowAll(false);
                    setFocusReading(group.reading);
                    selectGroup(group.id);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={group.reading + " reading group, " + group.count + " kanji"}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectGroup(group.id);
                    }
                  }}
                >
                  <circle className="island-disc" r={group.layout.r} />
                  <circle className="island-ring" r={group.layout.r} />
                  <circle className="island-core" r={group.layout.r * 0.5} />
                  {showLabel ? (
                    <>
                      <text className="island-reading" y={group.keyword ? -2 : 2} textAnchor="middle" dominantBaseline="central" style={{ fontSize: readingSize }}>
                        {group.reading}
                      </text>
                      {group.keyword ? (
                        <text className="island-keyword" y={readingSize * 0.72} textAnchor="middle" style={{ fontSize: keywordSize }}>
                          {group.keyword.length > 28 ? group.keyword.slice(0, 27) + "…" : group.keyword}
                        </text>
                      ) : null}
                    </>
                  ) : null}
                  <g className="island-count">
                    <circle cx={group.layout.r * 0.68} cy={-group.layout.r * 0.68} r={group.layout.r * 0.14} />
                    <text x={group.layout.r * 0.68} y={-group.layout.r * 0.68 + 1} textAnchor="middle" dominantBaseline="central" style={{ fontSize: Math.max(9, group.layout.r * 0.12) }}>
                      {group.count}
                    </text>
                  </g>
                  {shown.map((entry, index) => {
                    const position = positions[index];
                    const active = activeEntryId === entry.id;
                    const multi = entry.readings.length > 1;
                    return (
                      <g
                        key={entry.id}
                        className={"kanji-chip" + (active ? " active" : "")}
                        transform={"translate(" + position.x + "," + position.y + ")"}
                        onMouseEnter={(event) => {
                          event.stopPropagation();
                          setHoverEntryId(entry.id);
                        }}
                        onMouseLeave={(event) => {
                          event.stopPropagation();
                          setHoverEntryId(null);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          selectEntry(entry.id);
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={(entry.kanji ?? "") + " " + entry.meaning}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectEntry(entry.id);
                          }
                        }}
                      >
                        <circle r={Math.max(8, group.layout.r * 0.095)} />
                        <text y={1} textAnchor="middle" dominantBaseline="central" lang="ja" style={{ fontSize: Math.max(10, group.layout.r * 0.13) }}>
                          {entry.kanji}
                        </text>
                        {multi ? <circle className="multi-dot" cx={group.layout.r * 0.07} cy={-group.layout.r * 0.07} r={2.4} /> : null}
                      </g>
                    );
                  })}
                  {list.length > shown.length && shown.length > 0 ? (
                    <text className="island-more" y={group.layout.r * 0.82} textAnchor="middle">
                      +{list.length - shown.length}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        )}
      />

      <div className="map-overlay map-overlay-top-left">
        <p className="eyebrow">{showAll ? "Same onyomi" : "Same onyomi · focused"}</p>
        <h1>{showAll ? "Sound constellations" : (focusCenter?.reading ?? focusReading) + " constellation"}</h1>
        <p>
          {showAll
            ? visibleGroups.length + " reading islands · " + model.data.quality.multiReadingKanji + " multi-reading kanji"
            : visibleGroups.length + " readings around " + (focusCenter?.reading ?? focusReading) + " · double-click an island to re-center"}
        </p>
        <button type="button" className="map-overlay-button" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Back to focus" : "Show all " + model.data.quality.onyomiGroups2 + " readings"}
        </button>
      </div>

      <div className="map-overlay map-overlay-top-right">
        {hoveredGroup ? (
          <div className="hover-card">
            <span className="hover-reading">{hoveredGroup.reading}</span>
            <span>{hoveredGroup.keyword ?? "reading"}</span>
            <strong>{hoveredGroup.count} kanji</strong>
          </div>
        ) : null}
      </div>

      <div className="map-legend map-legend-bottom">
        <span><i className="legend-island" /> reading island</span>
        <span><i className="legend-thread" /> similar sound</span>
        <span><i className="legend-multi" /> multi-reading kanji</span>
        <span className="map-hint">scroll to zoom · drag to pan · double-click to re-center</span>
      </div>
    </div>
  );
}
