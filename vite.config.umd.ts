import { defineConfig } from "vite";
import { resolve } from "path";
// `with { type: "json" }` requires Node 20.10+. This Vite config is only executed
// at build time (CI/local dev), where we run Node 20.x+. The published package
// supports Node >=18 and does not execute this config at runtime.
import pkg from "./package.json" with { type: "json" };

/**
 * Separate Vite config for UMD build.
 *
 * Produces framework-agnostic bundle for CDN usage:
 *   dist/vue-privacy.umd.cjs  — CommonJS/AMD/global
 *
 * Run after the main ES build: `vite build --config vite.config.umd.ts`
 */
export default defineConfig({
  define: {
    __VUE_PRIVACY_VERSION__: JSON.stringify(pkg.version),
  },
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
