import { useEffect, useMemo, useRef, useState } from "react";
import type { Entry } from "../data/types";
import { useModel } from "../data/context";
import { useAtlasStore } from "../state/store";
import { jaccard, pixelSimilarity } from "../lib/similarity";
import { Modal } from "./Modal";
import { Stars } from "./Controls";

function DiffCanvas({ a, b }: { a: Entry; b: Entry }) {
  const model = useModel();
  const ref = useRef<HTMLCanvasElement>(null);
  const embA = a.kanji ? model.getEmbedding(a.kanji) : null;
  const embB = b.kanji ? model.getEmbedding(b.kanji) : null;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 64, 64);
    if (!embA || !embB) return;
    const image = ctx.createImageData(64, 64);
    for (let i = 0; i < 64 * 64; i++) {
      const ia = embA[i] < 160;
      const ib = embB[i] < 160;
      let color: [number, number, number, number] = [0, 0, 0, 0];
      if (ia && ib) color = [28, 26, 22, 230];
      else if (ia) color = [183, 67, 47, 220];
      else if (ib) color = [60, 90, 128, 220];
      image.data[i * 4] = color[0];
      image.data[i * 4 + 1] = color[1];
      image.data[i * 4 + 2] = color[2];
      image.data[i * 4 + 3] = color[3];
    }
    ctx.putImageData(image, 0, 0);
  }, [embA, embB]);

  if (!embA || !embB) {
    return <div className="diff-missing">No pixel embedding for one of these glyphs.</div>;
  }
  return (
    <div className="diff-wrap">
      <canvas ref={ref} width={64} height={64} className="diff-canvas" aria-label="Pixel difference heatmap" />
      <div className="diff-legend">
        <span><i className="diff-both" /> overlap</span>
        <span><i className="diff-a" /> {a.kanji} only</span>
        <span><i className="diff-b" /> {b.kanji} only</span>
      </div>
    </div>
  );
}

function ComponentDiff({ a, b }: { a: Entry; b: Entry }) {
  const model = useModel();
  const kvgA = new Set(a.kanji ? model.getKvg(a.kanji) ?? [] : []);
  const kvgB = new Set(b.kanji ? model.getKvg(b.kanji) ?? [] : []);
  const kdA = model.getKd(a);
  const kdB = model.getKd(b);
  const sharedKvg = [...kvgA].filter((item) => kvgB.has(item));
  const sharedKd = [...kdA].filter((item) => kdB.has(item));
  const onlyA = [...kdA].filter((item) => !kdB.has(item));
  const onlyB = [...kdB].filter((item) => !kdA.has(item));

  return (
    <div className="diff-columns">
      <div>
        <h4>Shared components</h4>
        <div className="chip-wrap">
          {[...new Set([...sharedKvg, ...sharedKd])].slice(0, 16).map((item) => <span className="tag-chip" key={item}>{item}</span>)}
          {!sharedKvg.length && !sharedKd.length ? <span className="inspector-empty">None.</span> : null}
        </div>
      </div>
      <div>
        <h4>{a.kanji} only</h4>
        <div className="chip-wrap">
          {onlyA.slice(0, 10).map((item) => <span className="tag-chip" key={item}>{item}</span>)}
          {!onlyA.length ? <span className="inspector-empty">None.</span> : null}
        </div>
      </div>
      <div>
        <h4>{b.kanji} only</h4>
        <div className="chip-wrap">
          {onlyB.slice(0, 10).map((item) => <span className="tag-chip" key={item}>{item}</span>)}
          {!onlyB.length ? <span className="inspector-empty">None.</span> : null}
        </div>
      </div>
    </div>
  );
}

export function CompareDialog() {
  const model = useModel();
  const open = useAtlasStore((state) => state.compareOpen);
  const setOpen = useAtlasStore((state) => state.setCompareOpen);
  const pinned = useAtlasStore((state) => state.pinned);
  const [pairIndex, setPairIndex] = useState(0);
  const entries = pinned.map((id) => model.byId.get(id)).filter((entry): entry is Entry => Boolean(entry));
  const pairs = useMemo(() => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) out.push([i, j]);
    return out;
  }, [entries.length]);
  const pair = pairs[Math.min(pairIndex, pairs.length - 1)] ?? null;
  const a = pair ? entries[pair[0]] : null;
  const b = pair ? entries[pair[1]] : null;

  const metrics = useMemo(() => {
    if (!a || !b) return null;
    const kvgA = new Set(a.kanji ? model.getKvg(a.kanji) ?? [] : []);
    const kvgB = new Set(b.kanji ? model.getKvg(b.kanji) ?? [] : []);
    const kdA = model.getKd(a);
    const kdB = model.getKd(b);
    const embA = a.kanji ? model.getEmbedding(a.kanji) : null;
    const embB = b.kanji ? model.getEmbedding(b.kanji) : null;
    const pixel = embA && embB ? pixelSimilarity(embA, embB, "weightedRmse") : null;
    const onyomi = a.readings.filter((reading) => b.readings.includes(reading));
    return {
      kvg: jaccard(kvgA, kvgB),
      kd: jaccard(kdA, kdB),
      pixel,
      onyomi,
      sharedKvg: [...kvgA].filter((item) => kvgB.has(item)),
      sharedKd: [...kdA].filter((item) => kdB.has(item)),
    };
  }, [a, b, model]);

  if (!open) return null;

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Tell them apart" eyebrow="Pair comparison" size="xl">
      {entries.length < 2 ? (
        <p className="inspector-empty">Pin at least two kanji to compare.</p>
      ) : (
        <>
          <div className="compare-cards">
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={"compare-card" + (a?.id === entry.id || b?.id === entry.id ? " active" : "")}
                onClick={() => {
                  const index = entries.indexOf(entry);
                  const next = pairs.findIndex(([x, y]) => x === index || y === index);
                  if (next >= 0) setPairIndex(next);
                }}
              >
                <span className="compare-glyph" lang="ja">{entry.kanji ?? "部"}</span>
                <strong>{entry.meaning}</strong>
                <small>{entry.readings.length ? entry.readings.join(" · ") : "no onyomi"}</small>
                <Stars value={entry.usefulness} />
              </button>
            ))}
          </div>

          {entries.length > 2 ? (
            <div className="pair-tabs" role="tablist" aria-label="Comparison pairs">
              {pairs.map(([x, y], index) => (
                <button
                  key={x + "-" + y}
                  type="button"
                  role="tab"
                  aria-selected={pairIndex === index}
                  className={pairIndex === index ? "active" : ""}
                  onClick={() => setPairIndex(index)}
                >
                  {entries[x].kanji} / {entries[y].kanji}
                </button>
              ))}
            </div>
          ) : null}

          {a && b && metrics ? (
            <>
              <div className="compare-main">
                <div className="compare-sides">
                  <div className="compare-side">
                    <span lang="ja">{a.kanji}</span>
                    <h3>{a.meaning}</h3>
                    <p>{a.readings.length ? a.readings.join(" · ") : "no onyomi data"}</p>
                  </div>
                  <div className="compare-scores">
                    <div><span>KanjiVG Jaccard</span><strong>{metrics.kvg.toFixed(3)}</strong></div>
                    <div><span>KanjiDamage Jaccard</span><strong>{metrics.kd.toFixed(3)}</strong></div>
                    <div><span>Pixel similarity</span><strong>{metrics.pixel == null ? "—" : metrics.pixel.toFixed(3)}</strong></div>
                    <div><span>Shared onyomi</span><strong>{metrics.onyomi.length ? metrics.onyomi.join(", ") : "none"}</strong></div>
                  </div>
                  <div className="compare-side">
                    <span lang="ja">{b.kanji}</span>
                    <h3>{b.meaning}</h3>
                    <p>{b.readings.length ? b.readings.join(" · ") : "no onyomi data"}</p>
                  </div>
                </div>
                <div className="compare-heat">
                  <DiffCanvas a={a} b={b} />
                </div>
              </div>
              <ComponentDiff a={a} b={b} />
              <div className="compare-note">
                The pixel heatmap is deliberately literal: black strokes overlap, vermilion strokes belong to {a.kanji} only,
                indigo strokes to {b.kanji} only. Symbolic components may agree while the pixels disagree — that is the point.
              </div>
            </>
          ) : null}
        </>
      )}
    </Modal>
  );
}
