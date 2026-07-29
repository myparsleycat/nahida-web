import type { Treaty } from "@elysiajs/eden";
import type { UseQueryResult } from "@tanstack/react-query";
import { createContext, useContext } from "react";

import { eden } from "@/lib/eden";

const $modQuery = eden.akasha.mod({ modId: "" }).get;
const $modItem = eden.akasha.mod.item({ itemId: "" }).get;
export type AkashaMod = Treaty.Data<typeof $modQuery>;
export type AkashaModItem = Treaty.Data<typeof $modItem>;

export interface ModContextType {
  modId?: string;
  collectionId?: string;
  setCollectionId: (v: string) => void;
  itemId?: string;
  setItemId: (v: string) => void;
  sig?: string;
  accessToken?: string;
  isOpenInfo: boolean;
  setOpenInfo: React.Dispatch<React.SetStateAction<boolean>>;
  modQuery?: AkashaMod | null;
  itemQuery?: AkashaModItem | null;
}

const ModContext = createContext<ModContextType | null>(null);

export function useModContext() {
  const context = useContext(ModContext);
  if (!context) {
    throw new Error("useModContext must be used within a ModProvider");
  }
  return context;
}

export default ModContext;
