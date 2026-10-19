import { useModel } from "../data/context";
import { useAtlasStore } from "../state/store";
import { Icon } from "./Icon";

export function CompareTray() {
  const model = useModel();
  const pinned = useAtlasStore((state) => state.pinned);
  const togglePinned = useAtlasStore((state) => state.togglePinned);
  const clearPinned = useAtlasStore((state) => state.clearPinned);
  const selectEntry = useAtlasStore((state) => state.selectEntry);
  const setCompareOpen = useAtlasStore((state) => state.setCompareOpen);

  if (!pinned.length) return null;
  const entries = pinned.map((id) => model.byId.get(id)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return (
    <div className="compare-tray" role="region" aria-label="Compare tray">
      <span className="compare-label"><Icon name="compare" size={15} /> Compare</span>
      <div className="compare-pins">
        {entries.map((entry) => (
          <div className="compare-pin" key={entry.id}>
            <button type="button" className="compare-pin-main" onClick={() => selectEntry(entry.id)} title={entry.meaning}>
              <span lang="ja">{entry.kanji ?? "部"}</span>
              <small>{entry.meaning}</small>
            </button>
            <button type="button" className="pin-remove" onClick={() => togglePinned(entry.id)} aria-label={"Remove " + entry.meaning}>
              <Icon name="close" size={11} />
            </button>
          </div>
        ))}
        {pinned.length < 2 ? <span className="compare-hint">pin one more kanji</span> : null}
      </div>
      <button type="button" className="button primary small" disabled={pinned.length < 2} onClick={() => setCompareOpen(true)}>
        Tell them apart
      </button>
      <button type="button" className="text-button" onClick={clearPinned}>Clear</button>
    </div>
  );
}
