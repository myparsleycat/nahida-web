import { useState, useRef, useEffect, useCallback } from "react";

type Options = {
    delay: number;
};

type Status = "success" | "failure" | undefined;

export function useClipboard({ delay = 500 }: Partial<Options> = {}) {
    const [status, setStatus] = useState<Status>(undefined);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const copy = useCallback(
        async (text: string): Promise<"success" | "failure"> => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            try {
                await navigator.clipboard.writeText(text);
                setStatus("success");

                timeoutRef.current = setTimeout(() => {
                    setStatus(undefined);
                }, delay);

                return "success";
            } catch (error) {
                setStatus("failure");

                timeoutRef.current = setTimeout(() => {
                    setStatus(undefined);
                }, delay);

                return "failure";
            }
        },
        [delay],
    );

    return {
        copy,
        status,
        copied: status === "success",
    };
}
