import { Moon, MoonIcon, Sun, SunIcon } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ModeToggle({ className, size }: { className?: string; size?: number }) {
  const { toggleTheme } = useTheme();

  return (
    <button
      className={cn(
        // "inline-flex items-center justify-center whitespace-nowrap",
        // "text-sm font-medium ring-offset-background",
        // "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        // "focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        "flex",
        className,
        // outline && "border border-input rounded-full",
        // hoverFill && "hover:bg-accent hover:text-accent-foreground"
      )}
      onClick={toggleTheme}
    >
      <MoonIcon
        className={cn(
          "transition-all duration-500 ease-in-out",
          "scale-0 rotate-90 dark:scale-100 dark:rotate-0",
        )}
        size={size}
      />
      <SunIcon
        className={cn(
          "absolute transition-transform duration-500 ease-in-out",
          "scale-100 rotate-0 dark:scale-0 dark:-rotate-90",
        )}
        size={size}
      />
    </button>
  );
}
