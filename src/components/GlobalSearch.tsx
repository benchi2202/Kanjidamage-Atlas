import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { SearchResult } from "../data/types";
import { useModel } from "../data/context";
import { Icon } from "./Icon";

interface GlobalSearchProps {
  onSelect: (result: SearchResult) => void;
}

const kindLabel: Record<SearchResult["kind"], string> = {
  kanji: "kanji",
  reading: "reading",
  strong: "strong",
  component: "component",
};

export function GlobalSearch({ onSelect }: GlobalSearchProps) {
  const model = useModel();
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = query.trim() ? model.search(query, 9) : [];

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const choose = (result: SearchResult) => {
    setQuery("");
    setOpen(false);
    setActive(0);
    onSelect(result);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => Math.min(results.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="global-search" ref={rootRef}>
      <label className="search-field" htmlFor={id}>
        <Icon name="search" size={16} />
        <input
          ref={inputRef}
          id={id}
          value={query}
          placeholder="Search kanji, reading, strong family, component…"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={id + "-list"}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <kbd>⌘K</kbd>
      </label>
      {open && query.trim() ? (
        <div className="search-results" id={id + "-list"} role="listbox">
          {results.length ? (
            results.map((result, index) => (
              <button
                key={result.kind + ":" + result.id}
                type="button"
                role="option"
                aria-selected={index === active}
                className={"search-result " + (index === active ? "active" : "")}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(result)}
              >
                <span className={"search-glyph kind-" + result.kind}>{result.glyph ?? "音"}</span>
                <span className="search-copy">
                  <strong>{result.label}</strong>
                  <small>{result.sublabel}</small>
                </span>
                <span className="search-kind">{kindLabel[result.kind]}</span>
              </button>
            ))
          ) : (
            <p className="search-empty">No matches in the atlas.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
