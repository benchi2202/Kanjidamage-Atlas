import type {
  AtlasData,
  ComponentGroup,
  Entry,
  OnyomiGroup,
  SearchResult,
  StrongGroup,
} from "./types";

export interface AtlasModel {
  data: AtlasData;
  entries: Entry[];
  kanjiEntries: Entry[];
  imageEntries: Entry[];
  byId: Map<number, Entry>;
  byKanji: Map<string, Entry>;
  onyomiByReading: Map<string, OnyomiGroup>;
  strongById: Map<string, StrongGroup>;
  componentByGlyph: Map<string, ComponentGroup>;
  tagsByName: Map<string, string>;
  kvgComponents: Record<string, string[]>;
  pixelBin: Uint8Array;
  getEmbedding: (glyph: string) => Uint8Array | null;
  getKvg: (glyph: string) => string[] | undefined;
  getKd: (entry: Entry) => Set<string>;
  getKeyword: (reading: string) => string | null;
  onyomiGroupsForEntry: (entryId: number) => OnyomiGroup[];
  strongGroupsForEntry: (entryId: number) => StrongGroup[];
  componentGroupsForEntry: (entryId: number) => ComponentGroup[];
  primaryComponentGroup: (entry: Entry) => ComponentGroup | null;
  search: (query: string, limit?: number) => SearchResult[];
  searchEntries: (query: string, limit?: number) => Entry[];
  membersOf: (group: OnyomiGroup | StrongGroup) => Entry[];
  noReadingEntries: () => Entry[];
  ungroupedEntries: () => Entry[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

export function createModel(data: AtlasData): AtlasModel {
  const byId = new Map(data.entries.map((entry) => [entry.id, entry]));
  const byKanji = new Map(
    data.entries.filter((entry) => entry.kanji).map((entry) => [entry.kanji!, entry]),
  );
  const kanjiEntries = data.entries.filter((entry) => entry.kanji);
  const imageEntries = data.entries.filter((entry) => !entry.kanji);
  const onyomiByReading = new Map(data.onyomiGroups.map((group) => [group.reading, group]));
  const strongById = new Map(data.strongGroups.map((group) => [group.id, group]));
  const componentByGlyph = new Map(data.componentGroups.map((group) => [group.component, group]));
  const tagsByName = new Map(data.tags.map((tag) => [tag.name, tag.description]));

  const readingsByEntry = new Map<number, OnyomiGroup[]>();
  for (const group of data.onyomiGroups) {
    for (const id of group.memberIds) {
      if (!readingsByEntry.has(id)) readingsByEntry.set(id, []);
      readingsByEntry.get(id)!.push(group);
    }
  }

  const strongByEntry = new Map<number, StrongGroup[]>();
  for (const group of data.strongGroups) {
    for (const member of group.members) {
      if (!strongByEntry.has(member.id)) strongByEntry.set(member.id, []);
      strongByEntry.get(member.id)!.push(group);
    }
  }

  const componentsByEntry = new Map<number, ComponentGroup[]>();
  for (const group of data.componentGroups) {
    for (const id of group.allIds) {
      if (!componentsByEntry.has(id)) componentsByEntry.set(id, []);
      componentsByEntry.get(id)!.push(group);
    }
  }

  const getEmbedding = (glyph: string): Uint8Array | null => {
    const index = data.pixel.index[glyph];
    if (index == null) return null;
    const size = data.pixel.size;
    const start = index * size * size;
    if (start + size * size > data.pixelBin.length) return null;
    return data.pixelBin.subarray(start, start + size * size);
  };

  const getKvg = (glyph: string): string[] | undefined => data.kvgComponents[glyph];

  const getKd = (entry: Entry): Set<string> => {
    const set = new Set<string>();
    for (const component of entry.components) {
      const key = component.kanji ?? component.image ?? component.label;
      if (key) set.add(key);
    }
    return set;
  };

  const getKeyword = (reading: string): string | null =>
    data.onyomiKeywords[reading.toLowerCase()] ?? null;

  const searchEntries = (query: string, limit = 12): Entry[] => {
    const q = normalize(query);
    if (!q) return [];
    const rows: Array<{ entry: Entry; score: number }> = [];
    for (const entry of kanjiEntries) {
      let score = 0;
      if (entry.kanji === query.trim()) score = 1200;
      else if (entry.kanji && q.length === 1 && entry.kanji === q) score = 1100;
      if (!score && normalize(entry.meaning) === q) score = 900;
      if (!score && normalize(entry.meaning).startsWith(q)) score = 750;
      if (!score && contains(entry.meaning, q)) score = 550;
      if (!score) {
        for (const reading of entry.readings) {
          if (reading.toLowerCase() === q) { score = 850; break; }
          if (reading.toLowerCase().startsWith(q)) { score = 700; break; }
          if (reading.toLowerCase().includes(q)) { score = 500; break; }
        }
      }
      if (!score && entry.components.some((component) => contains(component.kanji ?? component.label ?? "", q))) {
        score = 300;
      }
      if (!score && entry.tags.some((tag) => contains(tag, q))) score = 180;
      if (score) rows.push({ entry, score });
    }
    rows.sort((a, b) => b.score - a.score || a.entry.position! - b.entry.position!);
    return rows.slice(0, limit).map((row) => row.entry);
  };

  const search = (query: string, limit = 10): SearchResult[] => {
    const q = normalize(query);
    if (!q) return [];
    const results: Array<{ score: number; result: SearchResult }> = [];

    for (const entry of searchEntries(query, 20)) {
      let score = 500;
      if (entry.kanji === query.trim()) score = 1400;
      else if (normalize(entry.meaning) === q) score = 950;
      else if (contains(entry.meaning, q)) score = 650;
      results.push({
        score,
        result: {
          kind: "kanji",
          id: "entry:" + entry.id,
          label: entry.kanji ?? entry.meaning,
          sublabel:
            (entry.kanji ? entry.meaning : "image radical") +
            " · " +
            (entry.readings.length ? entry.readings.join(" · ") : "no onyomi data"),
          glyph: entry.kanji,
          entry,
        },
      });
    }

    for (const group of data.onyomiGroups) {
      let score = 0;
      if (group.reading.toLowerCase() === q) score = 1500;
      else if (group.reading.toLowerCase().startsWith(q)) score = 1000;
      else if (group.reading.toLowerCase().includes(q)) score = 650;
      else if (group.keyword && contains(group.keyword, q)) score = 450;
      if (score) {
        results.push({
          score,
          result: {
            kind: "reading",
            id: group.id,
            label: group.reading,
            sublabel: (group.keyword ?? "reading") + " · " + group.count + " kanji",
            glyph: null,
            readingGroup: group,
          },
        });
      }
    }

    for (const group of data.strongGroups) {
      let score = 0;
      if (group.glyph && group.glyph === query.trim()) score = 1500;
      else if (group.readings.some((reading) => reading.toLowerCase() === q)) score = 1200;
      else if (group.readings.some((reading) => reading.toLowerCase().startsWith(q))) score = 1000;
      else if (contains(group.meaning, q)) score = 500;
      if (score) {
        results.push({
          score,
          result: {
            kind: "strong",
            id: group.id,
            label: (group.glyph ?? group.meaning) + " strong family",
            sublabel: group.readings.join(" · ") + " · " + group.counts.kanji + " kanji",
            glyph: group.glyph,
            strongGroup: group,
          },
        });
      }
    }

    for (const group of data.componentGroups) {
      let score = 0;
      if (group.component === query.trim()) score = 1500;
      else if (group.meaning && contains(group.meaning, q)) score = 500;
      if (score) {
        results.push({
          score,
          result: {
            kind: "component",
            id: group.id,
            label: group.component + " component group",
            sublabel: (group.meaning ?? "component") + " · " + group.count + " kanji",
            glyph: group.component,
            componentGroup: group,
          },
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map((row) => row.result);
  };

  const membersOf = (group: OnyomiGroup | StrongGroup): Entry[] => {
    const ids = "memberIds" in group ? group.memberIds : [];
    return ids.map((id) => byId.get(id)).filter((entry): entry is Entry => Boolean(entry));
  };

  return {
    data,
    entries: data.entries,
    kanjiEntries,
    imageEntries,
    byId,
    byKanji,
    onyomiByReading,
    strongById,
    componentByGlyph,
    tagsByName,
    kvgComponents: data.kvgComponents,
    pixelBin: data.pixelBin,
    getEmbedding,
    getKvg,
    getKd,
    getKeyword,
    onyomiGroupsForEntry: (entryId) => readingsByEntry.get(entryId) ?? [],
    strongGroupsForEntry: (entryId) => strongByEntry.get(entryId) ?? [],
    componentGroupsForEntry: (entryId) => componentsByEntry.get(entryId) ?? [],
    primaryComponentGroup: (entry) =>
      entry.primaryComponent ? componentByGlyph.get(entry.primaryComponent) ?? null : null,
    search,
    searchEntries,
    membersOf,
    noReadingEntries: () => data.noReadingIds.map((id) => byId.get(id)).filter((entry): entry is Entry => Boolean(entry)),
    ungroupedEntries: () => data.ungroupedIds.map((id) => byId.get(id)).filter((entry): entry is Entry => Boolean(entry)),
  };
}
