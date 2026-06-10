/*
  Installed from https://reactbits.dev/ts/tailwind/
*/

import { motion } from "framer-motion";
import { gsap } from "gsap";
import { useEffect, useRef, type FC } from "react";

import { cn, getRandFloat } from "@/lib/utils";

interface GridMotionProps {
  className?: string;
  items?: string[];
  gradientColor?: string;
}

const GridMotion: FC<GridMotionProps> = ({ className, items = [], gradientColor = "black" }) => {
  const rows = 4;
  const colsPerRow = 14;

  const gridRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mouseXRef = useRef<number>(window.innerWidth / 2);

  const totalItems = rows * colsPerRow;
  const gridWidth = colsPerRow * 280;

  const defaultItems = Array.from({ length: totalItems }, (_, index) => `Item ${index + 1}`);
  const combinedItems = items.length > 0 ? items.slice(0, totalItems) : defaultItems;

  useEffect(() => {
    gsap.ticker.lagSmoothing(0);

    const handleMouseMove = (e: MouseEvent): void => {
      mouseXRef.current = e.clientX;
    };

    const updateMotion = (): void => {
      const maxMoveAmount = 300;
      const baseDuration = 0.8;
      const inertiaFactors = [0.6, 0.4, 0.3, 0.2];

      rowRefs.current.forEach((row, index) => {
        if (row) {
          const direction = index % 2 === 0 ? 1 : -1;
          const moveAmount =
            ((mouseXRef.current / window.innerWidth) * maxMoveAmount - maxMoveAmount / 2) *
            direction;

          gsap.to(row, {
            x: moveAmount,
            duration: baseDuration + inertiaFactors[index % inertiaFactors.length],
            ease: "power3.out",
            overwrite: "auto",
          });
        }
      });
    };

    const removeAnimationLoop = gsap.ticker.add(updateMotion);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      removeAnimationLoop();
    };
  }, []);

  return (
    <div ref={gridRef} className={cn("h-full w-full overflow-hidden", className)}>
      <section className="relative flex h-screen w-full items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-[4] bg-[length:250px]"></div>
        <div
          className="relative z-[2] grid h-[150vh] flex-none origin-center rotate-[-15deg] grid-cols-1 gap-4"
          style={{
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            width: `${gridWidth}px`,
          }}
        >
          {Array.from({ length: rows }, (_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${colsPerRow}, 1fr)`,
                willChange: "transform, filter",
              }}
              ref={(el) => {
                if (el) rowRefs.current[rowIndex] = el;
              }}
            >
              {Array.from({ length: colsPerRow }, (_, itemIndex) => {
                const content = combinedItems[rowIndex * colsPerRow + itemIndex];
                return (
                  <div key={itemIndex} className="relative">
                    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[10px] text-[1.5rem] text-white duration-400 ease-out hover:scale-95">
                      {typeof content === "string" && content.startsWith("http") ? (
                        <motion.div
                          key={content}
                          className="absolute top-0 left-0 h-full w-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${content})` }}
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: getRandFloat(0, 1) }}
                        ></motion.div>
                      ) : (
                        <div className="z-1 p-4 text-center">{content}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="pointer-events-none relative top-0 left-0 h-full w-full"></div>
      </section>
    </div>
  );
};

export default GridMotion;
