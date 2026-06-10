import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";

import { ScrollArea, ScrollBar } from "./scroll-area";

const snippetVariants = tv({
  base: "bg-background relative w-full max-w-full rounded-md border py-2.5 pr-12 pl-3",
  variants: {
    variant: {
      default: "border-border bg-card",
      secondary: "border-border bg-accent",
      destructive: "border-destructive bg-destructive text-destructive-foreground",
      primary: "border-primary bg-primary text-primary-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export type SnippetProps = React.HTMLAttributes<any> &
  VariantProps<typeof snippetVariants> & {
    text: string | string[];
    onCopy?: (status: "success" | "failure" | undefined) => void;
  };

const Snippet = React.forwardRef<HTMLDivElement, SnippetProps>(
  ({ className, variant, text, onCopy, ...props }, ref) => {
    const textToCopy = Array.isArray(text) ? text.join("\n") : text;

    return (
      <div ref={ref} className={cn(snippetVariants({ variant, className }))} {...props}>
        <ScrollArea>
          {Array.isArray(text) ? (
            text.map((line, i) => (
              <pre key={i} className="overflow-x-auto text-left font-mono text-sm font-light">
                {line}
              </pre>
            ))
          ) : (
            <pre className="overflow-x-auto text-left font-mono text-sm font-light">{text}</pre>
          )}
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <CopyButton
          className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-current transition-colors ease-in-out hover:bg-zinc-200 dark:hover:bg-zinc-700"
          text={textToCopy}
          onCopy={onCopy}
        />
      </div>
    );
  },
);
Snippet.displayName = "Snippet";

export { Snippet, snippetVariants };
