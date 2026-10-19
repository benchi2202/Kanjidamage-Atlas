import { createContext, useContext, type ReactNode } from "react";
import type { AtlasModel } from "./model";

const ModelContext = createContext<AtlasModel | null>(null);

export function ModelProvider({ model, children }: { model: AtlasModel; children: ReactNode }) {
  return <ModelContext.Provider value={model}>{children}</ModelContext.Provider>;
}

export function useModel(): AtlasModel {
  const model = useContext(ModelContext);
  if (!model) throw new Error("useModel must be used inside ModelProvider");
  return model;
}
