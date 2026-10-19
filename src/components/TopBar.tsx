import type { Mode, SearchResult } from "../data/types";
import { useModel } from "../data/context";
import { useAtlasStore } from "../state/store";
import { GlobalSearch } from "./GlobalSearch";
import { Icon } from "./Icon";

interface TopBarProps {
  onSearchSelect: (result: SearchResult) => void;
  onToggleSidebar: () => void;
}

const modes: Array<{ id: Mode; label: string }> = [
  { id: "lookalikes", label: "Look-alikes" },
  { id: "onyomi", label: "Onyomi" },
  { id: "strong", label: "Strong" },
  { id: "components", label: "Components" },
];

export function TopBar({ onSearchSelect, onToggleSidebar }: TopBarProps) {
  const model = useModel();
  const mode = useAtlasStore((state) => state.mode);
  const setMode = useAtlasStore((state) => state.setMode);
  const theme = useAtlasStore((state) => state.theme);
  const setTheme = useAtlasStore((state) => state.setTheme);
  const setInfoOpen = useAtlasStore((state) => state.setInfoOpen);

  const badges: Record<Mode, string> = {
    lookalikes: "3 lenses",
    onyomi: model.data.quality.onyomiGroups2 + " readings",
    strong: model.data.quality.strongGroups + " families",
    components: model.data.quality.sharedComponents + " shared",
  };

  return (
    <header className="topbar">
      <a className="brand" href="https://github.com/benchi2202/Kanjidamage-Atlas" target="_blank" rel="noreferrer">
        <span className="brand-seal" aria-hidden="true">漢</span>
        <span className="brand-copy">
          <strong>KanjiDamage Atlas</strong>
          <small>shape · sound · story</small>
        </span>
      </a>

      <nav className="mode-tabs" aria-label="Visualization modes">
        {modes.map((item) => (
          <button
            key={item.id}
            type="button"
            className={"mode-tab " + (mode === item.id ? "active" : "")}
            onClick={() => setMode(item.id)}
            aria-current={mode === item.id ? "page" : undefined}
          >
            <span>{item.label}</span>
            <small>{badges[item.id]}</small>
          </button>
        ))}
      </nav>

      <div className="topbar-actions">
        <GlobalSearch onSelect={onSearchSelect} />
        <button type="button" className="icon-button sidebar-toggle" onClick={onToggleSidebar} aria-label="Toggle controls" title="Controls">
          <Icon name="layers" />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          title={theme === "light" ? "Dark theme" : "Light theme"}
        >
          <Icon name={theme === "light" ? "moon" : "sun"} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => setInfoOpen(true)}
          aria-label="About the atlas"
          title="About and data notes"
        >
          <Icon name="info" />
        </button>
      </div>
    </header>
  );
}
