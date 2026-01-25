# Installation

## Package Manager

::: code-group

```bash [npm]
npm install @structured-world/consent
```

```bash [yarn]
yarn add @structured-world/consent
```

```bash [pnpm]
pnpm add @structured-world/consent
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
| `@structured-world/consent` | Core (framework-agnostic) |
| `@structured-world/consent/vue` | Vue 3 plugin & components |
| `@structured-world/consent/vitepress` | VitePress theme enhancement |
| `@structured-world/consent/quasar` | Quasar boot file |

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

The library uses modern JavaScript features. For older browsers, ensure your build tool includes appropriate polyfills.
