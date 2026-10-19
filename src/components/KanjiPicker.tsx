import { useEffect, useRef, useState } from "react";
import { useModel } from "../data/context";
import { Icon } from "./Icon";

const featured = ["青", "明", "朝", "不", "日", "月", "木", "水", "人", "心", "言", "金", "糸", "手", "刀", "火", "土", "女", "子", "学"];

export function KanjiPicker({ value, onChange }: { value: string; onChange: (kanji: string) => void }) {
  const model = useModel();
  const entry = model.byKanji.get(value) ?? null;
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const suggestions = model.searchEntries(query, 7);
  const showSuggestions = open && query.trim() && query.trim() !== value;

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  const choose = (kanji: string) => {
    onChange(kanji);
    setQuery(kanji);
    setOpen(false);
    setActive(0);
  };

  const random = () => {
    const pool = featured.filter((kanji) => model.byKanji.has(kanji));
    choose(pool[Math.floor(Math.random() * pool.length)] ?? "青");
  };

  return (
    <div className="kanji-picker" ref={rootRef}>
      {entry ? (
        <div className="input-kanji-card">
          <span className="input-kanji" lang="ja">{entry.kanji}</span>
          <div>
            <strong>{entry.meaning}</strong>
            <small>{entry.readings.length ? entry.readings.join(" · ") : "no onyomi data"}</small>
          </div>
          <button type="button" className="icon-button tiny" onClick={random} aria-label="Choose a random kanji" title="Random kanji">
            <Icon name="sparkles" size={15} />
          </button>
        </div>
      ) : null}
      <label className="picker-field">
        <Icon name="search" size={15} />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((current) => Math.min(suggestions.length - 1, current + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((current) => Math.max(0, current - 1));
            } else if (event.key === "Enter") {
              if (suggestions[active]) {
                event.preventDefault();
                choose(suggestions[active].kanji!);
              } else if (query.trim().length === 1 && model.byKanji.has(query.trim())) {
                choose(query.trim());
              }
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Type a kanji, meaning, or reading…"
          aria-label="Choose the kanji to compare"
          autoComplete="off"
        />
      </label>
      {showSuggestions ? (
        <div className="picker-results" role="listbox">
          {suggestions.length ? (
            suggestions.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={index === active}
                className={index === active ? "active" : ""}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item.kanji!)}
              >
                <span className="picker-glyph" lang="ja">{item.kanji}</span>
                <span>
                  <strong>{item.meaning}</strong>
                  <small>{item.readings.length ? item.readings.join(" · ") : "no onyomi data"}</small>
                </span>
              </button>
            ))
          ) : (
            <p className="search-empty">No dataset kanji matches.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
