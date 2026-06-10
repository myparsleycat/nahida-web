import { createContext, useContext } from "react";

interface ContextMenuContextType {
  itemId: string;
  navi?: (id: string) => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined);

export function useContextMenuData() {
  const context = useContext(ContextMenuContext);
  if (context === undefined) {
    throw new Error("useContextMenuData must be used within a ContextMenuProvider");
  }
  return context;
}

export { ContextMenuContext };
