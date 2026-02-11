import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "dist/",
      "node_modules/",
      "coverage/",
      "docs/.vitepress/dist/",
      "docs/.vitepress/cache/",
    ],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
        sourceType: "module",
      },
      globals: {
        document: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        KeyboardEvent: "readonly",
        navigator: "readonly",
      },
    },
    plugins: {
      vue: pluginVue,
    },
    rules: {
      ...pluginVue.configs["flat/recommended"].rules,
      "vue/multi-word-component-names": "off",
      // no-useless-assignment doesn't understand Vue SFC <script setup> —
      // it can't see that variables are used in <template>
      "no-useless-assignment": "off",
    },
  }
);
