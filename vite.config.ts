import { resolve } from "node:path";

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        tanstackRouter({ autoCodeSplitting: true }),
        react(),
        babel({
            presets: [reactCompilerPreset()],
        } as Parameters<typeof babel>[0]),
        tailwindcss(),
        visualizer({
            open: true,
            filename: "dist/stats.html",
        }),
    ],

    build: {
        sourcemap: false,

        rolldownOptions: {
            output: {
                entryFileNames: "entry/[hash].js",
                chunkFileNames: "chunks/[hash].js",
                assetFileNames: "assets/[hash][extname]",

                codeSplitting: {
                    groups: [
                        {
                            name: "vendor",
                            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                        },
                    ],
                },
            },
        },
    },

    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
            "@backend": resolve(__dirname, "../backend/src"),
            "@shared": resolve(__dirname, "../shared"),
        },
    },

    css: {
        lightningcss: {},
    },
});
