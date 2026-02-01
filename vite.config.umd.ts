import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * Separate Vite config for UMD/IIFE build.
 *
 * Produces framework-agnostic bundles for CDN usage:
 *   dist/vue-privacy.umd.js   — CommonJS/AMD/global
 *   dist/vue-privacy.iife.js  — self-executing script
 *
 * Run after the main ES build: `vite build --config vite.config.umd.ts`
 */
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/umd.ts"),
      name: "VuePrivacy",
      formats: ["umd", "iife"],
      fileName: (format) => {
        if (format === "umd") return "vue-privacy.umd.cjs";
        return `vue-privacy.${format}.js`;
      },
    },
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    minify: "esbuild",
  },
});
