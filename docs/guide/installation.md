---
description: Install Vue Privacy via npm, yarn, or pnpm. Set up Google Analytics with GDPR consent in under 5 minutes for Vue 3, Nuxt 3, or VitePress.
---

# Installation & Setup

## Package Manager

::: code-group

```bash [npm]
npm install @structured-world/vue-privacy
```

```bash [yarn]
yarn add @structured-world/vue-privacy
```

```bash [pnpm]
pnpm add @structured-world/vue-privacy
```

:::

## Peer Dependencies

The library has Vue 3 as an optional peer dependency. If you're using the Vue integration:

```bash
npm install vue
```

For VitePress or Quasar projects, Vue is already included.

## TypeScript

Full TypeScript support is included. No additional `@types` packages needed.

## Module Exports

The package provides multiple entry points:

| Import | Description |
|--------|-------------|
| `@structured-world/vue-privacy` | Core (framework-agnostic) |
| `@structured-world/vue-privacy/vue` | Vue 3 plugin & components |
| `@structured-world/vue-privacy/vitepress` | VitePress theme enhancement |
| `@structured-world/vue-privacy/quasar` | Quasar boot file |

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

The library uses modern JavaScript features. For older browsers, ensure your build tool includes appropriate polyfills.
