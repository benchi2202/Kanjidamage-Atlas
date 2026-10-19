import type { ComponentRef, Entry, StrongMemberStatus } from "../data/types";

export function stars(value: number | null | undefined): string {
  if (value == null) return "—";
  return "★".repeat(Math.max(0, value)) + "☆".repeat(Math.max(0, 5 - value));
}

export function readingList(readings: string[]): string {
  return readings.length ? readings.join(" · ") : "no onyomi data";
}

export function componentLabel(component: ComponentRef): string {
  return component.kanji ?? component.label ?? component.image ?? "?";
}

export function componentKey(component: ComponentRef): string {
  return component.kanji ?? component.image ?? component.label ?? String(component.id ?? "?");
}

export function entryTitle(entry: Entry): string {
  return entry.kanji ?? entry.meaning;
}

export function entrySubtitle(entry: Entry): string {
  return entry.kanji ? entry.meaning : entry.meaning + (entry.image ? " · radical" : "");
}

export function statusLabel(status: StrongMemberStatus): string {
  if (status === "pass") return "matches strong reading";
  if (status === "exception") return "exception";
  return "unknown";
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return count + " " + (count === 1 ? singular : pluralForm ?? singular + "s");
}

export function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return items[0] + " and " + items[1];
  return items.slice(0, -1).join(", ") + ", and " + items[items.length - 1];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
