import type { Treaty } from "@elysiajs/eden";
import { createContext, useContext } from "react";

import { eden } from "@/lib/eden";

const $linkQuery = eden.akasha.link({ linkId: "" }).post;
const $linkContent = eden.akasha.link.content({ id: "" }).get;
type LinkQuery = Treaty.Data<typeof $linkQuery>;
type LinkContent = Treaty.Data<typeof $linkContent>;

interface LinkContext {
  linkId?: string;
  cntId?: string;
  setCntId: (id: string) => void;
  linkQuery?: LinkQuery | null;
  linkCnt?: LinkContent | null;
}

const linkCtx = createContext<LinkContent | null>(null);

function useLinkContext() {
  const ctx = useContext(linkCtx);
  if (!ctx) {
    throw new Error("useLinkContext must be used within a LinkProvider");
  }
  return ctx;
}

export type { LinkQuery, LinkContent, LinkContext };

export { linkCtx, useLinkContext };
