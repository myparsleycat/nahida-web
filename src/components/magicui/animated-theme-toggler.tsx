"use client";

import { Moon, SunDim } from "lucide-react";
import { useState, useRef } from "react";
import { flushSync } from "react-dom";

import { cn } from "@/lib/utils";

import { useTheme } from "../theme-provider";

type props = {
  className?: string;
  size?: number;
};

export const AnimatedThemeToggler = ({ className, size }: props) => {
  const { toggleTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const changeTheme = async () => {
    if (!document.startViewTransition) {
      toggleTheme();
      return;
    }

    if (!buttonRef.current) return;

    await document.startViewTransition(() => {
      flushSync(() => {
        toggleTheme();
      });
    }).ready;

    const { top, left, width, height } = buttonRef.current.getBoundingClientRect();
    const y = top + height / 2;
    const x = left + width / 2;

    const right = window.innerWidth - left;
    const bottom = window.innerHeight - top;
    const maxRad = Math.hypot(Math.max(left, right), Math.max(top, bottom));

    document.documentElement.animate(
      {
        clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRad}px at ${x}px ${y}px)`],
      },
      {
        duration: 700,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)",
      },
    );
  };

  return (
    <button ref={buttonRef} onClick={changeTheme} className={cn("flex", className)}>
      <Moon
        className="scale-0 rotate-90 transition-all duration-500 ease-in-out dark:scale-100 dark:rotate-0"
        size={size}
      />
      <SunDim
        className="absolute scale-100 rotate-0 transition-transform duration-500 ease-in-out dark:scale-0 dark:-rotate-90"
        size={size}
      />
    </button>
  );
};
