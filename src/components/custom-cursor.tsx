import { useEffect, useRef, useState } from "react";

import { useSettingsStore } from "@/stores/setting.store";

export function CustomCursor({ isAppWorking }: { isAppWorking: boolean }) {
  const { gifCursor } = useSettingsStore();
  const cursorRef = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  const [cursorType, setCursorType] = useState<"normal" | "link" | "text" | "help" | "working">(
    "normal",
  );
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const cursorImages = {
    normal: "/img/cursor/normal.gif",
    link: "/img/cursor/link.gif",
    text: "/img/cursor/text.gif",
    help: "/img/cursor/help.gif",
    working: "/img/cursor/working.gif",
  };

  useEffect(() => {
    if (!gifCursor) return;

    const mediaQuery = window.matchMedia("(pointer: coarse)");
    setIsMobile(mediaQuery.matches);
    if (mediaQuery.matches) return;

    const updatePosition = () => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${mousePos.current.x}px, ${mousePos.current.y}px, 0)`;
      }
      rafId.current = requestAnimationFrame(updatePosition);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const style = window.getComputedStyle(target);

      if (isAppWorking) {
        setCursorType("working");
      } else if (
        target.tagName === "A" ||
        target.tagName === "BUTTON" ||
        target.closest("button") ||
        style.cursor === "pointer"
      ) {
        setCursorType("link");
      } else if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        setCursorType("text");
      } else if (style.cursor === "help") {
        setCursorType("help");
      } else {
        setCursorType("normal");
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseover", handleMouseOver);
    rafId.current = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [isAppWorking, isVisible, gifCursor]);

  if (!gifCursor || isMobile) return null;

  return (
    <>
      <style>{`
                @media (pointer: fine) {
                    * { 
                        cursor: none !important; 
                    }
                    input, textarea, [contenteditable="true"], a, button {
                        cursor: none !important;
                    }
                }

                .ccc {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 36px;
                    height: 36px;
                    z-index: 999999;
                    pointer-events: none;
                    will-change: transform;
                    transition: opacity 0.15s ease-in-out;
                    display: none;
                }

                @media (pointer: fine) {
                    .ccc {
                        display: block;
                    }
                }
            `}</style>
      <div ref={cursorRef} className="ccc" style={{ opacity: isVisible ? 1 : 0 }}>
        <img
          src={isAppWorking ? cursorImages.working : cursorImages[cursorType]}
          alt="cursor"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </>
  );
}
