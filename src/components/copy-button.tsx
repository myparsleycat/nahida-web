import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Close as X } from "pixelarticons/react";
import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useClipboard } from "@/hooks/use-clipboard";
import { cn } from "@/lib/utils";

type ClipboardStatus = "success" | "failure" | undefined;

export type CopyButtonProps = Omit<ButtonProps, "onCopy"> & {
  text: string;
  icon?: React.ReactNode;
  animationDuration?: number;
  onCopy?: (status: ClipboardStatus) => void;
};

const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      text,
      icon,
      animationDuration = 200,
      variant = "ghost",
      size = "icon",
      onCopy,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const finalSize = size === "icon" && children ? "default" : size;

    const { copy, status } = useClipboard({ delay: 2000 });

    const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const resultStatus = await copy(text);
      onCopy?.(resultStatus);
    };

    const motionProps = {
      initial: { scale: 0.85, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 0.85, opacity: 0 },
      transition: { duration: animationDuration / 1000 },
    };

    return (
      <Button
        ref={ref}
        variant={variant}
        size={finalSize}
        className={cn("flex items-center gap-2", className)}
        type="button"
        name="copy"
        onClick={handleCopy}
        {...props}
      >
        <AnimatePresence mode="wait" initial={false}>
          {status === "success" && (
            <motion.div key="success" {...motionProps}>
              <Check className="size-4" />
              <span className="sr-only">Copied</span>
            </motion.div>
          )}

          {status === "failure" && (
            <motion.div key="failure" {...motionProps}>
              <X className="size-4" />
              <span className="sr-only">Failed to copy</span>
            </motion.div>
          )}

          {status === undefined && (
            <motion.div key="default" {...motionProps}>
              {icon ?? <Copy className="size-4" />}
              <span className="sr-only">Copy</span>
            </motion.div>
          )}
        </AnimatePresence>
        {children}
      </Button>
    );
  },
);
CopyButton.displayName = "CopyButton";

export { CopyButton };
