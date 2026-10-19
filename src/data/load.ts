import type { AppData, AtlasData } from "./types";

let cache: Promise<AtlasData> | null = null;

const base = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : import.meta.env.BASE_URL + "/";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error("Could not load " + path + " (HTTP " + response.status + ")");
  return (await response.json()) as T;
}

async function load(): Promise<AtlasData> {
  const [app, kvgComponents, pixelBuffer] = await Promise.all([
    fetchJson<AppData>("data/app-data.json"),
    fetchJson<Record<string, string[]>>("data/kanjivg-components.json"),
    fetch(base + "data/pixel-embeddings.bin").then((response) => {
      if (!response.ok) throw new Error("Could not load pixel embeddings (HTTP " + response.status + ")");
      return response.arrayBuffer();
    }),
  ]);
  return {
    ...app,
    kvgComponents,
    pixelBin: new Uint8Array(pixelBuffer),
  };
}

export function loadAtlas(): Promise<AtlasData> {
  if (!cache) cache = load();
  return cache;
}
