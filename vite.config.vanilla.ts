import { defineConfig } from "vite";
import { resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

/**
 * Separate Vite config for vanilla CSS files.
 *
 * Copies CSS files for CDN usage:
 *   dist/vue-privacy-banner.css  — Banner styles
 *   dist/vue-privacy-modal.css   — Modal styles
 *
 * Run after the main ES build: `vite build --config vite.config.vanilla.ts`
 */
export default defineConfig({
  plugins: [
    {
      name: "copy-vanilla-css",
      closeBundle() {
        const distDir = resolve(__dirname, "dist");
        mkdirSync(distDir, { recursive: true });

        // Copy banner CSS
        const bannerCss = readFileSync(resolve(__dirname, "src/vanilla/banner.css"), "utf-8");
        writeFileSync(resolve(distDir, "vue-privacy-banner.css"), bannerCss);

        // Copy modal CSS
        const modalCss = readFileSync(resolve(__dirname, "src/vanilla/modal.css"), "utf-8");
        writeFileSync(resolve(distDir, "vue-privacy-modal.css"), modalCss);

        console.log("Vanilla CSS files copied to dist/");
      },
    },
  ],
  build: {
    // Empty build just to trigger the plugin
    lib: {
      entry: resolve(__dirname, "src/vanilla/index.ts"),
      formats: [],
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
