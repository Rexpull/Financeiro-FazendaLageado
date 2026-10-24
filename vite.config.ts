import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
    // Never inject the whole build environment into the public bundle (it leaked PATH, CF_PAGES_*,
    // npm_* and would leak any secret set in Pages). Frontend config comes from import.meta.env.VITE_*.
    define: {
        "process.env": { NODE_ENV: process.env.NODE_ENV ?? (mode === "production" ? "production" : "development") },
    },
}));
