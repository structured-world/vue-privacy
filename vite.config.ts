import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import { resolve } from "path";
import { copyFileSync, mkdirSync } from "fs";
// `with { type: "json" }` requires Node 20.10+ (aligned with package.json engines).
import pkg from "./package.json" with { type: "json" };

/**
 * Copies the vanilla CSS files that package.json exports (`./banner.css`, `./modal.css`) for
 * CDN usage. Runs in this build because it emits output; a build without output does not
 * reach `closeBundle`.
 */
function copyVanillaCss(): Plugin {
  return {
    name: "copy-vanilla-css",
    closeBundle() {
      const root = import.meta.dirname;
      const distDir = resolve(root, "dist");
      mkdirSync(distDir, { recursive: true });
      copyFileSync(
        resolve(root, "src/vanilla/banner.css"),
        resolve(distDir, "vue-privacy-banner.css")
      );
      copyFileSync(
        resolve(root, "src/vanilla/modal.css"),
        resolve(distDir, "vue-privacy-modal.css")
      );
    },
  };
}

export default defineConfig({
  define: {
    __VUE_PRIVACY_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    vue(),
    dts({
      // The Vue processor resolves `.vue` imports; the TS one reports them as missing modules.
      processor: "vue",
      include: ["src/**/*"],
      exclude: ["src/__tests__/**"],
      outDir: "dist",
      rollupTypes: false,
      tsconfigPath: "./tsconfig.build.json",
    }),
    copyVanillaCss(),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "src/index.ts"),
        "vue/index": resolve(import.meta.dirname, "src/vue/index.ts"),
        "vitepress/index": resolve(import.meta.dirname, "src/vitepress/index.ts"),
        "quasar/index": resolve(import.meta.dirname, "src/quasar/index.ts"),
        "vanilla/index": resolve(import.meta.dirname, "src/vanilla/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: ["vue", "vitepress", "quasar"],
      output: {
        preserveModules: false,
        entryFileNames: "[name].js",
      },
    },
    sourcemap: false,
    minify: "esbuild",
  },
});
