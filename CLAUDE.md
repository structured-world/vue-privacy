# @structured-world/vue-privacy - Project Instructions

## Project Overview

GDPR-compliant cookie consent library with Google Consent Mode v2 support for Vue 3, Quasar, and VitePress.

- **npm**: `@structured-world/vue-privacy`
- **License**: Apache 2.0
- **Website**: https://privacy.sw.foundation

## Architecture

```
src/
├── core/              # Framework-agnostic core
│   ├── types.ts       # TypeScript interfaces
│   ├── storage.ts     # Cookie read/write
│   ├── gtag.ts        # Google Consent Mode v2
│   └── consent-manager.ts
├── geo/               # EU detection
│   └── index.ts       # Cloudflare, IP API, timezone fallback
├── vue/               # Vue 3 integration
│   ├── index.ts       # Plugin, composables
│   └── ConsentBanner.vue
├── vitepress/         # VitePress theme enhancement
│   └── index.ts
├── quasar/            # Quasar boot file
│   └── index.ts
└── index.ts           # Core exports
```

## Key Design Decisions

1. **Core is framework-agnostic** - Can be used without Vue
2. **Vue plugin provides DX** - Auto-init, injection, composables
3. **EU detection is pluggable** - Custom detectors supported
4. **Google Consent Mode v2 first** - All 4 signals supported
5. **SSR-safe** - Guards for `window`/`document`

## Development

```bash
yarn install
yarn build      # Build library
yarn dev        # Watch mode
yarn test       # Run tests
yarn lint       # Lint code

yarn docs:dev   # VitePress dev
yarn docs:build # Build docs
```

## Code Quality Standards

Same as gitlab-mcp:
- TypeScript strict mode
- No `any` types
- ESLint + Prettier
- Conventional commits
- Semantic release

## Testing

- Unit tests with Vitest
- Test coverage required for core modules
- Mock `document`/`window` for SSR testing

## Release Process

Uses semantic-release with conventional commits:
- `feat:` → minor version
- `fix:` → patch version
- `BREAKING CHANGE:` → major version

## Important Notes

1. **NEVER load gtag.js before consent defaults** - Order matters!
2. **EU detection fallback chain** - Cloudflare → IP API → Timezone
3. **Cookie version** - Changing `version` config resets all consents
4. **SSR** - Always check `typeof window !== 'undefined'`
