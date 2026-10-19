import { useAtlasStore } from "../../state/store";
import { KanjiPicker } from "../KanjiPicker";
import { Note, Section, Segmented } from "../Controls";

export function LookAlikeControls() {
  const inputKanji = useAtlasStore((state) => state.inputKanji);
  const setInputKanji = useAtlasStore((state) => state.setInputKanji);
  const pixelMetric = useAtlasStore((state) => state.pixelMetric);
  const setPixelMetric = useAtlasStore((state) => state.setPixelMetric);

  return (
    <div className="controls">
      <Section title="Input kanji" hint="1,637 kanji">
        <KanjiPicker value={inputKanji} onChange={setInputKanji} />
      </Section>

      <Section title="Pixel metric" hint="pixel lens">
        <Segmented
          label="Pixel similarity metric"
          value={pixelMetric}
          onChange={setPixelMetric}
          options={[
            { value: "weightedRmse", label: "RMSE", title: "Translation-tolerant weighted root mean squared error" },
            { value: "cosine", label: "Cosine", title: "Cosine similarity of normalized ink" },
            { value: "iou", label: "IoU", title: "Overlap of binarized ink after a translation search" },
          ]}
        />
        <Note>
          The pixel lens uses 64×64 KanjiVG bitmaps, bbox-normalized and compared with a ±2px translation
          search. It sees shape only — no components, readings, or stroke order.
        </Note>
      </Section>

      <Section title="The three lenses">
        <ul className="method-list">
          <li className="teal">
            <span className="method-dot" />
            <div><strong>KanjiVG + Jaccard</strong><small>shared labeled structural components in KanjiVG</small></div>
          </li>
          <li className="plum">
            <span className="method-dot" />
            <div><strong>KanjiDamage components</strong><small>shared components as KanjiDamage decomposes them</small></div>
          </li>
          <li className="gold">
            <span className="method-dot" />
            <div><strong>Pixel difference</strong><small>normalized bitmap distance; no symbolic knowledge</small></div>
          </li>
        </ul>
      </Section>

      <div className="sidebar-note">
        <strong>Reading the lenses</strong>
        <p>Core = the closest matches, Family = clearly related, Fringe = the long tail. The consensus strip shows which methods agree.</p>
      </div>
    </div>
  );
}
