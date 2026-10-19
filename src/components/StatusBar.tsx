import { useModel } from "../data/context";
import { useAtlasStore } from "../state/store";

export function StatusBar() {
  const model = useModel();
  const setInfoOpen = useAtlasStore((state) => state.setInfoOpen);
  const q = model.data.quality;
  const generated = new Date(model.data.generatedAt);
  const dateLabel = Number.isNaN(generated.getTime())
    ? "local build"
    : generated.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  return (
    <footer className="statusbar">
      <span>
        {q.kanjiEntries.toLocaleString()} kanji · {q.onyomiReadings} readings · {q.strongGroups} strong families ·{" "}
        {q.sharedComponents} shared components
      </span>
      <span className="statusbar-center">
        KanjiDamage dataset + KanjiVG · local build {dateLabel}
      </span>
      <button type="button" className="text-button" onClick={() => setInfoOpen(true)}>
        Data notes & attribution
      </button>
    </footer>
  );
}
