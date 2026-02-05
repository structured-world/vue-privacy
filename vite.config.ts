import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import { resolve } from "path";
// `with { type: "json" }` requires Node 20.10+. This Vite config is only run
// at build time (in CI and local development), where Node 20.x+ is available.
// The published package itself is compatible with and supports Node >=18.
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  define: {
    __VUE_PRIVACY_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    vue(),
    dts({
      include: ["src/**/*"],
      exclude: ["src/__tests__/**"],
      outDir: "dist",
      rollupTypes: false,
      tsconfigPath: "./tsconfig.build.json",
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "vue/index": resolve(__dirname, "src/vue/index.ts"),
        "vitepress/index": resolve(__dirname, "src/vitepress/index.ts"),
        "quasar/index": resolve(__dirname, "src/quasar/index.ts"),
        "vanilla/index": resolve(__dirname, "src/vanilla/index.ts"),
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
