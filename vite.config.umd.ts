import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * Separate Vite config for UMD build.
 *
 * Produces framework-agnostic bundle for CDN usage:
 *   dist/vue-privacy.umd.cjs  — CommonJS/AMD/global
 *
 * Run after the main ES build: `vite build --config vite.config.umd.ts`
 */
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/umd.ts"),
      name: "VuePrivacy",
      formats: ["umd"],
      fileName: () => "vue-privacy.umd.cjs",
    },
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: false,
    minify: "esbuild",
  },
});
