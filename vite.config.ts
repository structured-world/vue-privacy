import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
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
