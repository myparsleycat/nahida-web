import { useLocation } from "@tanstack/react-router";
import { MenuIcon } from "lucide-react";
import { useState } from "react";

import { SidePanelContent } from "@/components/layout/SidePanel";
import { DriveInnerNav } from "@/components/page/akasha/DriveInnerNav";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function MobileSidePanel() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isDriveRoute = location.pathname.startsWith("/akasha/drive");

  const closeOnNavigate = (e: React.MouseEvent) => {
    if (e.target instanceof Element && e.target.closest("a")) setOpen(false);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-2 left-2 z-50 h-9 w-9 shadow-lg md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <MenuIcon />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-2">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-full flex-col gap-2 overflow-y-auto p-1" onClick={closeOnNavigate}>
            {isDriveRoute && (
              <>
                <div className="flex flex-col">
                  <DriveInnerNav labeled />
                </div>
                <Separator />
              </>
            )}

            <div className={cn("flex flex-col items-stretch gap-1")}>
              <SidePanelContent labeled />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
