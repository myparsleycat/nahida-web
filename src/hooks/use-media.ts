import { useState, useEffect } from "react";

// This type definition can be used as is.
export type Breakpoints<K extends string> = Record<K, string>;

/** Based on the default Tailwind CSS breakpoints https://tailwindcss.com/docs/responsive-design. */
export const TAILWIND_BREAKPOINTS: Breakpoints<"sm" | "md" | "lg" | "xl" | "2xl"> = {
    sm: "40rem", // 640px
    md: "48rem", // 768px
    lg: "64rem", // 1024px
    xl: "80rem", // 1280px
    "2xl": "96rem", // 1536px
};

/**
 * A React hook that tracks the state of CSS media queries.
 *
 * @param breakpoints - An object where keys are breakpoint names and values are screen widths.
 * @returns An object with boolean values indicating if the media query is active.
 */
export function useMedia<K extends string = keyof typeof TAILWIND_BREAKPOINTS>(
    breakpoints: Breakpoints<K> = TAILWIND_BREAKPOINTS as Breakpoints<K>,
): Record<K, boolean> {
    const [matches, setMatches] = useState<Record<K, boolean>>(() => {
        // Set initial state without causing hydration mismatch issues.
        // On the server, this will be an empty object.
        // On the client, it will be populated by the useEffect.
        return {} as Record<K, boolean>;
    });

    useEffect(() => {
        // This effect runs only on the client side.
        const mediaQueryLists = Object.entries(breakpoints).map(([key, value]) => ({
            key: key as K,
            mql: window.matchMedia(`(min-width: ${value})`),
        }));

        // Handler to update the state.
        const handleResize = () => {
            const newMatches = mediaQueryLists.reduce(
                (acc, { key, mql }) => {
                    acc[key] = mql.matches;
                    return acc;
                },
                {} as Record<K, boolean>,
            );
            setMatches(newMatches);
        };

        // Set the initial state on mount.
        handleResize();

        // Add listeners for each media query.
        mediaQueryLists.forEach(({ mql }) => {
            mql.addEventListener("change", handleResize);
        });

        // Cleanup function to remove listeners on unmount.
        return () => {
            mediaQueryLists.forEach(({ mql }) => {
                mql.removeEventListener("change", handleResize);
            });
        };
    }, [breakpoints]); // Re-run the effect if the breakpoints object changes.

    return matches;
}
