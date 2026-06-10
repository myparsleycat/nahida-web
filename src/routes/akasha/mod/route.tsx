import { createFileRoute, Outlet } from "@tanstack/react-router";

import { TransferDialog } from "@/components/akasha/mod-transfer-status";
import Threads from "@/components/blocks/Backgrounds/Threads/Threads";
import DarkVeil from "@/components/effects/DarkVeil";
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { cn } from "@/lib/utils";
import { useModStore } from "@/stores/akasha-mod.store";

export const Route = createFileRoute("/akasha/mod")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-0 h-full w-full">
        {/* <Threads
          amplitude={2}
          distance={0}
          enableMouseInteraction={false}
        /> */}

        {/* <DarkVeil hueShift={100} /> */}

        {/* <AnimatedGridPattern
          numSquares={30}
          maxOpacity={0.3}
          duration={2}
          repeatDelay={1}
          className={cn(
            "[mask-image:radial-gradient(700px_circle_at_center,white,transparent)]",
            "inset-x-0 inset-y-[-30%] h-[200%] skew-y-12",
          )}
        /> */}
      </div>

      <Outlet />

      <TransferDialog />
    </div>
  );
}
