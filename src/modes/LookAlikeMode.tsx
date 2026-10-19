import { useMemo, useState } from "react";
import type { Entry } from "../data/types";
import { useModel } from "../data/context";
import { useAtlasStore } from "../state/store";
import { consensusGroups, computeJaccardLens, computePixelLens, type LensContext, type LensMatch } from "../lib/similarity";
import { Icon } from "../components/Icon";

const lensMeta = {
  kvg: {
    title: "KanjiVG + Jaccard",
    short: "structural annotation",
    color: "teal",
    description: "Hand-annotated KanjiVG components; Jaccard intersection over union.",
  },
  kd: {
    title: "KanjiDamage components",
    short: "dictionary decomposition",
    color: "plum",
    description: "The components KanjiDamage itself lists for each kanji.",
  },
  pixel: {
    title: "Pixel difference",
    short: "shape only",
    color: "gold",
    description: "Normalized 64×64 bitmaps; weighted RMSE with a small shift search.",
  },
} as const;

type LensId = keyof typeof lensMeta;

function LensPanel({
  lens,
  input,
  onSelect,
  onUseAsInput,
}: {
  lens: LensId;
  input: Entry;
  onSelect: (id: number) => void;
  onUseAsInput: (kanji: string) => void;
}) {
  const model = useModel();
  const inputKanji = useAtlasStore((state) => state.inputKanji);
  const pixelMetric = useAtlasStore((state) => state.pixelMetric);
  const [hovered, setHovered] = useState<LensMatch | null>(null);
  const meta = lensMeta[lens];

  const matches = useMemo(() => {
    const context: LensContext = {
      entries: model.kanjiEntries,
      getKvg: model.getKvg,
      getKd: model.getKd,
      getEmbedding: model.getEmbedding,
    };
    if (lens === "kvg" || lens === "kd") return computeJaccardLens(context, input, lens);
    return computePixelLens(context, input, pixelMetric);
  }, [lens, model, input, pixelMetric]);

  const bands = [matches.slice(0, 5), matches.slice(5, 11), matches.slice(11, 18)];
  const radii = [92, 134, 172];
  const bandNames = ["core", "family", "fringe"];

  return (
    <section className={"lens-panel " + meta.color} aria-label={meta.title}>
      <div className="lens-heading">
        <div>
          <h2>{meta.title}</h2>
          <p>{meta.short}</p>
        </div>
        <span className="lens-count">
          {matches.length ? (matches.length > 18 ? "top 18 of " + matches.length : matches.length + " matches") : "no matches"}
        </span>
      </div>

      {matches.length ? (
        <>
          <svg className="lens-svg" viewBox="0 0 400 400" role="img" aria-label={meta.title + " matches for " + input.kanji}>
            {radii.map((radius, index) => (
              <circle
                key={radius}
                className={"lens-ring ring-" + index}
                cx="200"
                cy="200"
                r={radius}
              />
            ))}
            <circle className="lens-center-circle" cx="200" cy="200" r="47" />
            <text className="lens-input-glyph" x="200" y="200" textAnchor="middle" dominantBaseline="central" lang="ja">
              {input.kanji}
            </text>
            <text className="lens-input-label" x="200" y="258" textAnchor="middle">input</text>

            <g className="lens-spokes" aria-hidden="true">
              {bands.flatMap((band, bandIndex) =>
                band.map((_, index) => {
                  const count = band.length;
                  const angle = -Math.PI / 2 + ((index + 0.5) / count) * Math.PI * 2 + bandIndex * 0.18;
                  const x = 200 + Math.cos(angle) * radii[bandIndex];
                  const y = 200 + Math.sin(angle) * radii[bandIndex];
                  return <line key={bandIndex + ":" + index} className="lens-spoke" x1="200" y1="200" x2={x} y2={y} />;
                }),
              )}
            </g>
            {bands.flatMap((band, bandIndex) =>
              band.map((match, index) => {
                const count = band.length;
                const angle = -Math.PI / 2 + ((index + 0.5) / count) * Math.PI * 2 + bandIndex * 0.18;
                const radius = radii[bandIndex];
                const x = 200 + Math.cos(angle) * radius;
                const y = 200 + Math.sin(angle) * radius;
                const active = hovered?.entry.id === match.entry.id;
                return (
                  <g
                    key={match.entry.id}
                    className={"lens-node " + (active ? "active" : "")}
                    transform={"translate(" + x + "," + y + ")"}
                    role="button"
                    tabIndex={0}
                    aria-label={(match.entry.kanji ?? "") + " " + match.entry.meaning + ", " + match.detail}
                    onMouseEnter={() => setHovered(match)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(match)}
                    onBlur={() => setHovered(null)}
                    onClick={() => onSelect(match.entry.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(match.entry.id);
                      }
                    }}
                  >
                    <rect x="-18" y="-18" width="36" height="36" rx="7" />
                    <text x="0" y="1" textAnchor="middle" dominantBaseline="central" lang="ja">
                      {match.entry.kanji}
                    </text>
                  </g>
                );
              }),
            )}
          </svg>
          <div className="lens-legend" aria-hidden="true">
            {bands.map((band, index) => (
              <span key={bandNames[index]}><i className={"dot band-" + index} />{bandNames[index]} <b>{band.length}</b></span>
            ))}
          </div>
          <div className="lens-footer">
            {hovered ? (
              <>
                <div>
                  <strong>{hovered.entry.kanji}</strong>
                  <span>{hovered.entry.meaning}</span>
                </div>
                <small>{hovered.detail}{hovered.shared.length ? " · " + hovered.shared.join(" ") : ""}</small>
                <button type="button" className="text-button" onClick={() => onUseAsInput(hovered.entry.kanji!)}>
                  Use as input <Icon name="arrow-right" size={12} />
                </button>
              </>
            ) : (
              <small>{meta.description}</small>
            )}
          </div>
        </>
      ) : (
        <div className="lens-empty">
          <Icon name="layers" size={26} />
          <p>{lens === "pixel" ? "No pixel embedding for this input." : "No shared components found in this source."}</p>
          <small>{input.kanji ? "The dataset may not cover this glyph." : "Choose a kanji first."}</small>
        </div>
      )}
      {inputKanji === input.kanji && lens === "pixel" ? <span className="lens-metric">{pixelMetric}</span> : null}
    </section>
  );
}

function Consensus({
  groups,
  onSelect,
}: {
  groups: Array<{ key: string; matches: Array<{ match: LensMatch; methods: string[] }> }>;
  onSelect: (id: number) => void;
}) {
  const labels: Record<string, string> = { "3": "All three lenses", "2": "Two lenses", "1": "One lens only" };
  return (
    <section className="consensus" aria-label="Consensus across the three lenses">
      <div className="consensus-heading">
        <div>
          <p className="eyebrow">Consensus</p>
          <h2>Where the lenses agree — and where they don't.</h2>
        </div>
        <p>Each lens contributes its top twelve. A kanji can be a strong match in one lens and absent from another; that disagreement is the interesting part.</p>
      </div>
      <div className="consensus-rows">
        {groups.map((group) => (
          <div className={"consensus-row votes-" + group.key} key={group.key}>
            <div className="consensus-label">
              <strong>{labels[group.key]}</strong>
              <span>{group.matches.length} kanji</span>
            </div>
            <div className="consensus-chips">
              {group.matches.slice(0, 16).map(({ match, methods }) => (
                <button
                  key={match.entry.id}
                  type="button"
                  className="consensus-chip"
                  onClick={() => onSelect(match.entry.id)}
                  title={match.entry.meaning + " · found by " + methods.join(", ")}
                >
                  <span lang="ja">{match.entry.kanji}</span>
                  <i className="vote-dots">
                    {(["kvg", "kd", "pixel"] as LensId[]).map((lens) => (
                      <b key={lens} className={lens + (methods.includes(lensMeta[lens].title) ? " on" : "")} />
                    ))}
                  </i>
                </button>
              ))}
              {group.matches.length > 16 ? <span className="consensus-more">+{group.matches.length - 16}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LookAlikeMode() {
  const model = useModel();
  const inputKanji = useAtlasStore((state) => state.inputKanji);
  const setInputKanji = useAtlasStore((state) => state.setInputKanji);
  const selectEntry = useAtlasStore((state) => state.selectEntry);
  const pixelMetric = useAtlasStore((state) => state.pixelMetric);
  const input = model.byKanji.get(inputKanji) ?? model.kanjiEntries[0];

  const lenses = useMemo(() => {
    if (!input) return [];
    const context: LensContext = {
      entries: model.kanjiEntries,
      getKvg: model.getKvg,
      getKd: model.getKd,
      getEmbedding: model.getEmbedding,
    };
    return [
      { id: "kvg" as const, label: lensMeta.kvg.title, matches: computeJaccardLens(context, input, "kvg") },
      { id: "kd" as const, label: lensMeta.kd.title, matches: computeJaccardLens(context, input, "kd") },
      { id: "pixel" as const, label: lensMeta.pixel.title, matches: computePixelLens(context, input, pixelMetric) },
    ];
  }, [input, model, pixelMetric]);

  const consensus = useMemo(() => consensusGroups(lenses), [lenses]);

  if (!input) {
    return <div className="mode-page"><p>No kanji dataset loaded.</p></div>;
  }

  return (
    <div className="mode-page look-page">
      <header className="mode-heading look-heading">
        <div className="look-heading-copy">
          <p className="eyebrow">Visual similarity · three independent lenses</p>
          <h1>
            What does <span className="kanji-inline" lang="ja">{input.kanji}</span> look like?
          </h1>
          <p>
            {input.meaning}. Three methods look at the same kanji from different angles. The point is not
            that one is right; it is seeing which neighbours survive the change of lens.
          </p>
          <div className="heading-stats">
            <span><b>{input.readings.length ? input.readings.join(" · ") : "no onyomi"}</b> reading</span>
            <span><b>{input.components.length}</b> components</span>
            <span><b>{input.strokeCount ?? "—"}</b> strokes</span>
            <span><b>{input.usefulness ?? "—"}/5</b> usefulness</span>
          </div>
        </div>
        <div className="look-heading-glyph" aria-hidden="true">
          <span lang="ja">{input.kanji}</span>
          <small>compared against {model.kanjiEntries.length.toLocaleString()} kanji</small>
        </div>
      </header>

      <div className="lens-grid">
        {(["kvg", "kd", "pixel"] as LensId[]).map((lens) => (
          <LensPanel
            key={lens}
            lens={lens}
            input={input}
            onSelect={selectEntry}
            onUseAsInput={setInputKanji}
          />
        ))}
      </div>

      <Consensus groups={consensus} onSelect={selectEntry} />

      <p className="mode-footnote">
        A note on the pixel lens: the KanjiVG glyph is normalized and compared with a small shift search.
        It is deliberately blind to components, so it can find look-alikes the symbolic lenses miss — and
        miss a shared component when the whole glyph is crowded.
      </p>
    </div>
  );
}
