const stats = [
  { value: "1,757", label: "KanjiDamage entries" },
  { value: "90", label: "STRONG groups" },
  { value: "262", label: "shared components" },
  { value: "3", label: "visual-similarity lenses" },
];

const modes = [
  {
    index: "01",
    title: "Look-alikes",
    tone: "teal",
    body: "KanjiVG + Jaccard, KanjiDamage components, and normalized pixel difference — three lenses on the same kanji, plus a consensus strip where the methods agree.",
    status: "next",
  },
  {
    index: "02",
    title: "Same onyomi",
    tone: "indigo",
    body: "Pronunciation islands, with KYOU placed near KOU and dashed threads linking every copy of a multi-reading kanji.",
    status: "planned",
  },
  {
    index: "03",
    title: "Strong onyomi",
    tone: "vermilion",
    body: "All 90 tag-24 strong radicals and kanji, their Used In families, and red phonetic exceptions such as 晴, 情, and 略.",
    status: "planned",
  },
  {
    index: "04",
    title: "Kanji components",
    tone: "moss",
    body: "A component archipelago where 不 gathers 歪, 杯, and 否, and visually similar components sit side by side.",
    status: "planned",
  },
];

export default function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="wordmark" href="https://github.com/benchi2202/Kanjidamage-Atlas" target="_blank" rel="noreferrer">
          <span className="wordmark-seal" aria-hidden="true">漢</span>
          <span>
            <strong>KanjiDamage Atlas</strong>
            <small>shape · sound · story</small>
          </span>
        </a>
        <span className="status">Phase 0 · scaffold</span>
      </header>

      <section className="hero">
        <div className="hero-mark" aria-hidden="true">
          <span>漢</span>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">An interactive field guide to confusable kanji</p>
          <h1>See what makes a kanji <em>itself</em>.</h1>
          <p className="lede">
            Group the KanjiDamage set by the way kanji look, the onyomi they share, and the strong
            radicals that try to predict their sound — then compare any two to see exactly where the
            resemblance ends.
          </p>
          <div className="hero-actions">
            <a
              className="button primary"
              href="https://github.com/benchi2202/Kanjidamage-Atlas/blob/main/docs/ARCHITECTURE.md"
              target="_blank"
              rel="noreferrer"
            >
              Read the architecture
            </a>
            <a
              className="button ghost"
              href="https://github.com/benchi2202/Kanjidamage-Atlas"
              target="_blank"
              rel="noreferrer"
            >
              Repository
            </a>
          </div>
        </div>
      </section>

      <section className="stats" aria-label="Dataset at a glance">
        {stats.map((stat) => (
          <div className="stat" key={stat.label}>
            <span className="stat-value">{stat.value}</span>
            <span className="stat-label">{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="modes" aria-label="Planned visualization modes">
        {modes.map((mode) => (
          <article className={"mode " + mode.tone} key={mode.title}>
            <div className="mode-head">
              <span className="mode-index">{mode.index}</span>
              <span className={"mode-status " + mode.status}>{mode.status}</span>
            </div>
            <h2>{mode.title}</h2>
            <p>{mode.body}</p>
          </article>
        ))}
      </section>

      <section className="note">
        <div>
          <p className="eyebrow">Data policy</p>
          <h2>The dataset comes first.</h2>
        </div>
        <p>
          The GitHub dataset is canonical. The KanjiDamage site is read once for the tag-24 snapshot,
          the kanji index, and 閥 — then cached. Missing readings stay missing: if KanjiDamage does
          not list an onyomi, this atlas will not invent one.
        </p>
      </section>

      <footer>
        <span>Unofficial study tool. KanjiDamage content belongs to its author.</span>
        <a href="https://github.com/benchi2202/Kanjidamage-Atlas/blob/main/ATTRIBUTION.md" target="_blank" rel="noreferrer">
          Attribution
        </a>
      </footer>
    </main>
  );
}
