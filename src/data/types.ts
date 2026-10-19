export type Mode = "lookalikes" | "onyomi" | "strong" | "components";
export type PixelMetric = "weightedRmse" | "cosine" | "iou";
export type Theme = "light" | "dark";

export interface Layout {
  x: number;
  y: number;
  r: number;
}

export interface ComponentRef {
  id: number | null;
  kanji: string | null;
  image: string | null;
  label: string | null;
}

export interface Onyomi {
  reading: string;
  mnemonic: string | null;
}

export interface Kunyomi {
  reading: string;
  meaning: string | null;
  usefulness: number | null;
  tags: string[];
}

export interface Jukugo {
  word: string;
  reading: string;
  meaning: string | null;
  usefulness: number | null;
}

export interface Lookalike {
  kanji: string | null;
  id: number | null;
  meaning: string | null;
  hint: string | null;
  radical: string | null;
  radicalId: number | null;
  radicalImage: string | null;
}

export interface UsedIn {
  id: number;
  kanji: string | null;
  image: string | null;
}

export interface Entry {
  id: number;
  position: number | null;
  slug: string | null;
  url: string | null;
  kanji: string | null;
  image: string | null;
  meaning: string;
  usefulness: number | null;
  strokeCount: number | null;
  frequencyRank: number | null;
  tags: string[];
  description: string | null;
  mnemonic: string | null;
  components: ComponentRef[];
  onyomi: Onyomi[];
  readings: string[];
  kunyomi: Kunyomi[];
  jukugo: Jukugo[];
  lookalikes: Lookalike[];
  usedIn: UsedIn[];
  isSupplement: boolean;
  primaryComponent: string | null;
}

export interface Tag {
  id: number;
  name: string;
  description: string;
  count: number;
}

export interface OnyomiGroup {
  id: string;
  reading: string;
  keyword: string | null;
  count: number;
  memberIds: number[];
  layout: Layout;
}

export type StrongMemberStatus = "pass" | "exception" | "unknown";

export interface StrongMember {
  id: number;
  readings: string[];
  status: StrongMemberStatus;
  reason: string | null;
}

export interface StrongRadicalMember {
  id: number;
  image: string | null;
  meaning: string | null;
}

export interface StrongGroupCounts {
  kanji: number;
  pass: number;
  exception: number;
  noReading: number;
  radical: number;
  unknown: number;
}

export interface StrongGroup {
  id: string;
  entryId: number;
  glyph: string | null;
  image: string | null;
  meaning: string;
  readings: string[];
  source: "note" | "own" | "override" | string;
  note: string;
  memberIds: number[];
  members: StrongMember[];
  radicalMembers: StrongRadicalMember[];
  counts: StrongGroupCounts;
  empty: boolean;
  status: "ready" | "unknown";
  layout: Layout;
}

export interface FocusNeighbor {
  id: string;
  component: string;
  similarity: number;
  pixel: number;
  containment: boolean;
  shared: number;
  cooccurrence: number;
}

export interface ComponentGroup {
  id: string;
  component: string;
  meaning: string | null;
  count: number;
  allIds: number[];
  primaryIds: number[];
  layout?: Layout;
  order: number;
  neighbors: Array<{ id: string; similarity: number; kind: string }>;
  focusNeighbors: FocusNeighbor[];
}

export interface Link {
  source: string;
  target: string;
  similarity: number;
  kind?: string;
}

export interface SiteOnlyEntry {
  id: number;
  slug: string;
  merged: boolean;
  char: string | null;
  label: string;
}

export interface Quality {
  [key: string]: number;
}

export interface AppData {
  version: number;
  generatedAt: string;
  tags: Tag[];
  onyomiKeywords: Record<string, string>;
  entries: Entry[];
  onyomiGroups: OnyomiGroup[];
  strongGroups: StrongGroup[];
  componentGroups: ComponentGroup[];
  onyomiLinks: Link[];
  strongLinks: Link[];
  componentLinks: Link[];
  kvg: {
    entryGlyphs: number;
    covered: number;
    missing: string[];
    renderable: number;
  };
  pixel: {
    size: number;
    count: number;
    index: Record<string, number>;
  };
  ungroupedIds: number[];
  noReadingIds: number[];
  siteOnly: {
    entries: SiteOnlyEntry[];
    radicals: Array<{ id: number; char: string; label: string }>;
  };
  quality: Quality;
  build: {
    strongIssues: Array<{ group: number; ref: UsedIn; reason: string }>;
  };
}

export interface AtlasData extends AppData {
  kvgComponents: Record<string, string[]>;
  pixelBin: Uint8Array;
}

export interface SearchResult {
  kind: "kanji" | "reading" | "strong" | "component";
  id: string;
  label: string;
  sublabel: string;
  glyph: string | null;
  entry?: Entry;
  readingGroup?: OnyomiGroup;
  strongGroup?: StrongGroup;
  componentGroup?: ComponentGroup;
}
