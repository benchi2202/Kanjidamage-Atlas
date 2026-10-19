import { useEffect, useMemo, useRef, useState } from "react";
import type { Mode, SearchResult } from "./data/types";
import { loadAtlas } from "./data/load";
import { createModel, type AtlasModel } from "./data/model";
import { ModelProvider } from "./data/context";
import { useAtlasStore } from "./state/store";
import { TopBar } from "./components/TopBar";
import { StatusBar } from "./components/StatusBar";
import { Inspector } from "./components/Inspector";
import { CompareTray } from "./components/CompareTray";
import { CompareDialog } from "./components/CompareDialog";
import { ComponentBrowseDialog } from "./components/ComponentBrowseDialog";
import { InfoDialog } from "./components/InfoDialog";
import { KanjiListDialog } from "./components/KanjiListDialog";
import { LookAlikeMode } from "./modes/LookAlikeMode";
import { OnyomiMode } from "./modes/OnyomiMode";
import { StrongMode } from "./modes/StrongMode";
import { ComponentMode } from "./modes/ComponentMode";
import { LookAlikeControls } from "./components/controls/LookAlikeControls";
import { OnyomiControls } from "./components/controls/OnyomiControls";
import { StrongControls } from "./components/controls/StrongControls";
import { ComponentControls } from "./components/controls/ComponentControls";
import { Icon } from "./components/Icon";

const modeMeta: Record<Mode, { number: string; title: string; blurb: string }> = {
  lookalikes: {
    number: "01",
    title: "Look-alikes",
    blurb: "Three independent lenses on visual similarity, plus where they agree.",
  },
  onyomi: {
    number: "02",
    title: "Onyomi",
    blurb: "Pronunciation families, linked across multi-reading kanji.",
  },
  strong: {
    number: "03",
    title: "Strong onyomi",
    blurb: "The 90 tag-24 strong radicals and the Used In families they predict.",
  },
  components: {
    number: "04",
    title: "Components",
    blurb: "One shared component, its neighbourhood, and every kanji that contains it.",
  },
};

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-seal" aria-hidden="true">漢</div>
      <p className="eyebrow">KanjiDamage Atlas</p>
      <h1>Building the field guide.</h1>
      <p>Reading 1,757 entries, 270 readings, 90 strong families, and 445 components.</p>
      <span className="loading-line"><i /></span>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="loading-screen error-screen">
      <div className="loading-seal" aria-hidden="true">!</div>
      <p className="eyebrow">Atlas unavailable</p>
      <h1>Could not load the data.</h1>
      <p>{message}</p>
      <button type="button" className="button primary" onClick={onRetry}>
        <Icon name="refresh" size={15} /> Try again
      </button>
      <small>Run <code>npm run data:build</code> if the generated files are missing.</small>
    </div>
  );
}

export default function App() {
  const [model, setModel] = useState<AtlasModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 980,
  );
  const hydrated = useRef(false);

  const mode = useAtlasStore((state) => state.mode);
  const inputKanji = useAtlasStore((state) => state.inputKanji);
  const selectedEntryId = useAtlasStore((state) => state.selectedEntryId);
  const selectedGroupId = useAtlasStore((state) => state.selectedGroupId);
  const componentCenter = useAtlasStore((state) => state.componentCenter);
  const onyomiFocusReading = useAtlasStore((state) => state.onyomiFocusReading);
  const onyomiShowAll = useAtlasStore((state) => state.onyomiShowAll);
  const noReadingOpen = useAtlasStore((state) => state.noReadingOpen);
  const ungroupedOpen = useAtlasStore((state) => state.ungroupedOpen);
  const pinnedCount = useAtlasStore((state) => state.pinned.length);
  const setNoReadingOpen = useAtlasStore((state) => state.setNoReadingOpen);
  const setUngroupedOpen = useAtlasStore((state) => state.setUngroupedOpen);

  useEffect(() => {
    let active = true;
    loadAtlas()
      .then((data) => {
        if (active) setModel(createModel(data));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => { active = false; };
  }, []);

  // Restore a shareable view once the data is available.
  useEffect(() => {
    if (!model || hydrated.current) return;
    const store = useAtlasStore.getState();
    const params = new URLSearchParams(window.location.search);
    const nextMode = params.get("mode");
    if (nextMode && ["lookalikes", "onyomi", "strong", "components"].includes(nextMode)) {
      store.setMode(nextMode as Mode);
    }
    const kanji = params.get("kanji");
    if (kanji && model.byKanji.has(kanji)) store.setInputKanji(kanji);
    const component = params.get("component");
    if (component && model.componentByGlyph.has(component)) store.setComponentCenter(component);
    const reading = params.get("reading");
    if (reading && model.onyomiByReading.has(reading)) store.setOnyomiFocusReading(reading);
    if (params.get("all") === "1") store.setOnyomiShowAll(true);
    const group = params.get("group");
    const entry = Number(params.get("entry"));
    if (group && (model.onyomiByReading.has(group.replace("onyomi:", "")) || model.strongById.has(group) || model.data.componentGroups.some((item) => item.id === group))) {
      store.selectGroup(group);
      if (group.startsWith("component:")) {
        const componentName = group.replace("component:", "");
        if (model.componentByGlyph.has(componentName)) store.setComponentCenter(componentName);
      }
      if (group.startsWith("onyomi:")) store.setOnyomiFocusReading(group.slice("onyomi:".length));
    } else if (Number.isFinite(entry) && model.byId.has(entry)) {
      store.selectEntry(entry);
    }
    hydrated.current = true;
  }, [model]);

  // Keep the URL shareable.
  useEffect(() => {
    if (window.innerWidth < 980) setSidebarOpen(false);
  }, [mode]);

  useEffect(() => {
    if (!hydrated.current) return;
    const params = new URLSearchParams();
    params.set("mode", mode);
    if (mode === "lookalikes" && inputKanji) params.set("kanji", inputKanji);
    if (mode === "components" && componentCenter) params.set("component", componentCenter);
    if (mode === "onyomi") {
      params.set("reading", onyomiFocusReading);
      if (onyomiShowAll) params.set("all", "1");
    }
    if (selectedGroupId) params.set("group", selectedGroupId);
    else if (selectedEntryId) params.set("entry", String(selectedEntryId));
    const next = window.location.pathname + "?" + params.toString();
    window.history.replaceState(null, "", next);
  }, [mode, inputKanji, componentCenter, onyomiFocusReading, onyomiShowAll, selectedGroupId, selectedEntryId]);

  const handleSearch = (result: SearchResult) => {
    const store = useAtlasStore.getState();
    if (result.kind === "kanji" && result.entry) {
      if (store.mode === "lookalikes" && result.entry.kanji) store.setInputKanji(result.entry.kanji);
      else {
        if (store.mode === "components" && result.entry.primaryComponent) store.setComponentCenter(result.entry.primaryComponent);
        store.selectEntry(result.entry.id);
      }
    } else if (result.kind === "reading" && result.readingGroup) {
      store.setMode("onyomi");
      store.requestGroupFocus(result.readingGroup.id);
    } else if (result.kind === "strong" && result.strongGroup) {
      store.setMode("strong");
      store.requestGroupFocus(result.strongGroup.id);
    } else if (result.kind === "component" && result.componentGroup) {
      store.setMode("components");
      store.setComponentCenter(result.componentGroup.component);
      store.selectGroup(result.componentGroup.id);
    }
    if (window.innerWidth < 980) setSidebarOpen(false);
  };

  const controls = useMemo(() => {
    if (!model) return null;
    if (mode === "lookalikes") return <LookAlikeControls />;
    if (mode === "onyomi") return <OnyomiControls />;
    if (mode === "strong") return <StrongControls />;
    return <ComponentControls />;
  }, [mode, model]);

  if (error) return <ErrorScreen message={error} onRetry={() => window.location.reload()} />;
  if (!model) return <LoadingScreen />;

  const meta = modeMeta[mode];

  return (
    <ModelProvider model={model}>
      <div className={"app" + (sidebarOpen ? " sidebar-open" : "") + (pinnedCount ? " has-pins" : "")} data-mode={mode}>
        <TopBar onSearchSelect={handleSearch} onToggleSidebar={() => setSidebarOpen((open) => !open)} />

        <div className="workspace">
          {sidebarOpen ? <button type="button" className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close controls" /> : null}
          <aside className="sidebar" aria-label="Mode controls">
            <div className="sidebar-inner">
              <header className="sidebar-header">
                <div className="sidebar-header-top">
                  <p className="eyebrow">Mode {meta.number}</p>
                  <button type="button" className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close controls">
                    <Icon name="close" size={16} />
                  </button>
                </div>
                <h2>{meta.title}</h2>
                <p>{meta.blurb}</p>
              </header>
              {controls}
              <div className="sidebar-footer">
                <span>{model.data.quality.totalEntries.toLocaleString()} entries · built locally</span>
                <a href="https://github.com/benchi2202/Kanjidamage-Atlas" target="_blank" rel="noreferrer">
                  repository <Icon name="external" size={12} />
                </a>
              </div>
            </div>
          </aside>

          <main className={"stage stage-" + mode}>
            {mode === "lookalikes" ? <LookAlikeMode /> : null}
            {mode === "onyomi" ? <OnyomiMode /> : null}
            {mode === "strong" ? <StrongMode /> : null}
            {mode === "components" ? <ComponentMode /> : null}
          </main>

          <Inspector />
        </div>

        <CompareTray />
        <StatusBar />
      </div>

      <CompareDialog />
      <ComponentBrowseDialog />
      <InfoDialog />
      <KanjiListDialog
        open={noReadingOpen}
        onClose={() => setNoReadingOpen(false)}
        title="The silent tray"
        eyebrow={model.data.quality.noReadingKanji + " kanji without onyomi"}
        entries={model.noReadingEntries()}
        note={<>These kanji have no onyomi in KanjiDamage. They are not filled in from another dictionary. 晴 is one of them, which is why it is a red no-reading exception in 青's strong family.</>}
      />
      <KanjiListDialog
        open={ungroupedOpen}
        onClose={() => setUngroupedOpen(false)}
        title="Ungrouped kanji"
        eyebrow={model.data.quality.ungroupedKanji + " without a shared character component"}
        entries={model.ungroupedEntries()}
        note={<>These kanji have no shared character component in KanjiDamage's decomposition (image-only radical components do not count). They are not forced into a group just to fill the map.</>}
      />
    </ModelProvider>
  );
}
