import { create } from "zustand";
import type { Mode, PixelMetric, Theme } from "../data/types";

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("atlas-theme");
  if (stored === "light" || stored === "dark") return stored;
  return "light";
}

const theme = initialTheme();
if (typeof document !== "undefined") {
  document.documentElement.dataset.theme = theme;
}

interface AtlasState {
  mode: Mode;
  inputKanji: string;
  pixelMetric: PixelMetric;
  selectedEntryId: number | null;
  selectedGroupId: string | null;
  focusGroupId: string | null;
  focusRequest: number;
  pinned: number[];
  theme: Theme;

  onyomiMinGroupSize: number;
  onyomiShowAll: boolean;
  onyomiFocusReading: string;
  strongOnlyExceptions: boolean;
  strongShowEmpty: boolean;
  componentCenter: string;
  componentShowAll: boolean;

  infoOpen: boolean;
  compareOpen: boolean;
  browseOpen: boolean;
  noReadingOpen: boolean;
  ungroupedOpen: boolean;

  setMode: (mode: Mode) => void;
  setInputKanji: (kanji: string) => void;
  setPixelMetric: (metric: PixelMetric) => void;
  selectEntry: (id: number | null) => void;
  selectGroup: (id: string | null) => void;
  requestGroupFocus: (id: string) => void;
  clearSelection: () => void;
  togglePinned: (id: number) => void;
  clearPinned: () => void;
  setTheme: (theme: Theme) => void;
  setOnyomiMinGroupSize: (size: number) => void;
  setOnyomiShowAll: (value: boolean) => void;
  setOnyomiFocusReading: (reading: string) => void;
  setStrongOnlyExceptions: (value: boolean) => void;
  setStrongShowEmpty: (value: boolean) => void;
  setComponentCenter: (component: string) => void;
  setComponentShowAll: (value: boolean) => void;
  setInfoOpen: (open: boolean) => void;
  setCompareOpen: (open: boolean) => void;
  setBrowseOpen: (open: boolean) => void;
  setNoReadingOpen: (open: boolean) => void;
  setUngroupedOpen: (open: boolean) => void;
}

export const useAtlasStore = create<AtlasState>((set) => ({
  mode: "lookalikes",
  inputKanji: "青",
  pixelMetric: "weightedRmse",
  selectedEntryId: null,
  selectedGroupId: null,
  focusGroupId: null,
  focusRequest: 0,
  pinned: [],
  theme,

  onyomiMinGroupSize: 2,
  onyomiShowAll: false,
  onyomiFocusReading: "KYOU",
  strongOnlyExceptions: false,
  strongShowEmpty: false,
  componentCenter: "不",
  componentShowAll: true,

  infoOpen: false,
  compareOpen: false,
  browseOpen: false,
  noReadingOpen: false,
  ungroupedOpen: false,

  setMode: (mode) => set({ mode, selectedGroupId: null }),
  setInputKanji: (inputKanji) => set({ inputKanji }),
  setPixelMetric: (pixelMetric) => set({ pixelMetric }),
  selectEntry: (selectedEntryId) => set({ selectedEntryId, selectedGroupId: null }),
  selectGroup: (selectedGroupId) => set({ selectedGroupId, selectedEntryId: null }),
  requestGroupFocus: (id) => set((state) => ({
    focusGroupId: id,
    focusRequest: state.focusRequest + 1,
    selectedGroupId: id,
    selectedEntryId: null,
    onyomiFocusReading: id.startsWith("onyomi:") ? id.slice("onyomi:".length) : state.onyomiFocusReading,
  })),
  clearSelection: () => set({ selectedEntryId: null, selectedGroupId: null }),
  togglePinned: (id) =>
    set((state) => {
      if (state.pinned.includes(id)) return { pinned: state.pinned.filter((item) => item !== id) };
      return { pinned: [...state.pinned, id].slice(-3) };
    }),
  clearPinned: () => set({ pinned: [] }),
  setTheme: (next) => {
    if (typeof document !== "undefined") document.documentElement.dataset.theme = next;
    if (typeof window !== "undefined") window.localStorage.setItem("atlas-theme", next);
    set({ theme: next });
  },
  setOnyomiMinGroupSize: (onyomiMinGroupSize) => set({ onyomiMinGroupSize }),
  setOnyomiShowAll: (onyomiShowAll) => set({ onyomiShowAll }),
  setOnyomiFocusReading: (onyomiFocusReading) => set({ onyomiFocusReading }),
  setStrongOnlyExceptions: (strongOnlyExceptions) => set({ strongOnlyExceptions }),
  setStrongShowEmpty: (strongShowEmpty) => set({ strongShowEmpty }),
  setComponentCenter: (componentCenter) => set({ componentCenter }),
  setComponentShowAll: (componentShowAll) => set({ componentShowAll }),
  setInfoOpen: (infoOpen) => set({ infoOpen }),
  setCompareOpen: (compareOpen) => set({ compareOpen }),
  setBrowseOpen: (browseOpen) => set({ browseOpen }),
  setNoReadingOpen: (noReadingOpen) => set({ noReadingOpen }),
  setUngroupedOpen: (ungroupedOpen) => set({ ungroupedOpen }),
}));
