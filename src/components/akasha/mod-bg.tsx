import { useMemo } from "react";

import { useModContext, type AkashaMod } from "@/context/ModContext";

export function ModBackground() {
  const { modQuery } = useModContext();

  const bg = useMemo(() => {
    if (modQuery?.mod.preview) {
      return modQuery?.mod.preview;
    }
  }, [modQuery]);

  if (bg) {
    return (
      <div className="pointer-events-none absolute top-0 left-0 -z-10 h-full w-full backdrop-blur">
        {bg.mime.startsWith("image") ? (
          <img className="size-full object-cover" src={bg.url} />
        ) : (
          <video className="size-full object-cover" src={bg.url} autoPlay muted loop />
        )}

        <div className="absolute top-0 left-0 h-full w-full bg-white/85 backdrop-blur-xl dark:bg-black/85" />
      </div>
    );
  }
}
