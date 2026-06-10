import { defineConfig } from "vite";

export default defineConfig({
    build: {
        emptyOutDir: false,
        rollupOptions: {
            input: "src/sw.ts",
            output: {
                entryFileNames: "sw.js",
                dir: "dist",
                format: "es",
            },
        },
    },
});
