import { useModel } from "../data/context";
import { useAtlasStore } from "../state/store";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

export function InfoDialog() {
  const model = useModel();
  const open = useAtlasStore((state) => state.infoOpen);
  const setOpen = useAtlasStore((state) => state.setInfoOpen);
  const q = model.data.quality;

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="About this atlas" eyebrow="KanjiDamage Atlas" size="lg">
      <div className="about-intro">
        <span className="brand-seal" aria-hidden="true">漢</span>
        <p>
          A local, unofficial study tool for telling kanji apart. The atlas groups the KanjiDamage set by
          shape, component, and pronunciation, then lets you compare pinned kanji directly.
        </p>
      </div>

      <div className="about-grid">
        <section>
          <h3>Data at a glance</h3>
          <ul className="about-facts">
            <li><span>Kanji entries</span><strong>{q.kanjiEntries.toLocaleString()}</strong></li>
            <li><span>Image radicals</span><strong>{q.imageRadicals}</strong></li>
            <li><span>Onyomi groups</span><strong>{q.onyomiGroups2}</strong></li>
            <li><span>Strong families</span><strong>{q.strongGroups}</strong></li>
            <li><span>Shared components</span><strong>{q.sharedComponents}</strong></li>
            <li><span>Multi-reading kanji</span><strong>{q.multiReadingKanji}</strong></li>
          </ul>
        </section>
        <section>
          <h3>Sources & method</h3>
          <p>
            The GitHub <a className="text-link" href="https://github.com/benchi2202/Kanjidamage-dataset" target="_blank" rel="noreferrer">Kanjidamage-dataset</a> is
            canonical. The KanjiDamage site is read once, throttled, for tag 24, the kanji index, and 閥.
            <a className="text-link" href="https://kanjivg.tagaini.net/" target="_blank" rel="noreferrer">KanjiVG</a> supplies
            component labels and normalized bitmaps under CC BY-SA 3.0.
          </p>
          <p>
            Strong readings come from each entry's KanjiDamage note or its own onyomi, with a reviewed
            override table for ambiguous notes. No external dictionary readings are added.
          </p>
        </section>
      </div>

      <section className="about-section">
        <h3>Known gaps, kept visible</h3>
        <ul className="about-list">
          <li><strong>{q.noReadingKanji}</strong> kanji have no onyomi in KanjiDamage; they appear in the silent tray and count as strong-mode exceptions (for example 晴 in 青's family).</li>
          <li><strong>{q.strongGroupsEmpty}</strong> strong families (定, 倍, 傷) have no Used In entries; they render as empty families.</li>
          <li><strong>{q.ungroupedKanji}</strong> kanji have no shared character component in KanjiDamage's decomposition; they are not forced into a component group.</li>
          <li><strong>{q.kanjiVGMissing}</strong> dataset glyphs (￥ and &lt;) have no KanjiVG file and therefore no pixel embedding.</li>
          <li><strong>9</strong> site-only katakana radicals are catalogued but intentionally not mixed into kanji groups; 閥 is merged because 門's Used In references it.</li>
          <li><strong>{q.imageOnlyUsedInRefs}</strong> Used In references point to image radicals rather than kanji; strong groups show those separately.</li>
        </ul>
      </section>

      <section className="about-section">
        <h3>Interaction</h3>
        <div className="shortcut-grid">
          <span><kbd>⌘K</kbd> / <kbd>Ctrl K</kbd></span><span>global search</span>
          <span><kbd>Esc</kbd></span><span>close dialog or inspector</span>
          <span>scroll / pinch</span><span>zoom a map</span>
          <span>double-click a group</span><span>fly to it</span>
        </div>
      </section>

      <div className="about-footer">
        <span>Unofficial study tool. KanjiDamage content belongs to its author.</span>
        <a className="text-link" href="https://github.com/benchi2202/Kanjidamage-Atlas/blob/main/ATTRIBUTION.md" target="_blank" rel="noreferrer">
          Attribution <Icon name="external" size={13} />
        </a>
      </div>
    </Modal>
  );
}
