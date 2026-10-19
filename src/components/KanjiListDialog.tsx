import { useMemo, useState, type ReactNode } from "react";
import type { Entry } from "../data/types";
import { useAtlasStore } from "../state/store";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

export function KanjiListDialog({
  open,
  onClose,
  title,
  eyebrow,
  note,
  entries,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow: string;
  note: ReactNode;
  entries: Entry[];
}) {
  const selectEntry = useAtlasStore((state) => state.selectEntry);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (entry) =>
        entry.kanji === query.trim() ||
        entry.meaning.toLowerCase().includes(q) ||
        entry.readings.some((reading) => reading.toLowerCase().includes(q)),
    );
  }, [entries, query]);

  return (
    <Modal open={open} onClose={onClose} title={title} eyebrow={eyebrow} size="lg">
      <p className="dialog-note">{note}</p>
      <label className="picker-field">
        <Icon name="search" size={15} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by kanji, meaning, or reading…" />
      </label>
      <div className="kanji-list-grid">
        {filtered.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => {
              selectEntry(entry.id);
              onClose();
            }}
          >
            <span lang="ja">{entry.kanji ?? "—"}</span>
            <small>{entry.meaning}</small>
          </button>
        ))}
      </div>
      {!filtered.length ? <p className="search-empty">No matches.</p> : null}
    </Modal>
  );
}
