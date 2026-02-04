# @structured-world/vue-privacy

GDPR-compliant cookie consent with **Google Consent Mode v2** support for Vue 3, Quasar, VitePress, and plain HTML.

[![npm version](https://img.shields.io/npm/v/@structured-world/vue-privacy.svg)](https://www.npmjs.com/package/@structured-world/vue-privacy)
[![npm downloads](https://img.shields.io/npm/dm/@structured-world/vue-privacy.svg)](https://www.npmjs.com/package/@structured-world/vue-privacy)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@structured-world/vue-privacy)](https://bundlephobia.com/package/@structured-world/vue-privacy)
[![CI](https://github.com/structured-world/vue-privacy/actions/workflows/ci.yml/badge.svg)](https://github.com/structured-world/vue-privacy/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**[Documentation](https://privacy.sw.foundation)** · [GitHub](https://github.com/structured-world/vue-privacy) · [npm](https://www.npmjs.com/package/@structured-world/vue-privacy)

## Features

- **Google Consent Mode v2** — Full support for `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`
- **EU Detection** — Auto-detect EU users via Cloudflare headers, IP API, or timezone heuristics
- **Consent Banner** — Customizable GDPR/CCPA banner with dark mode support
- **Preference Center** — OneTrust-style modal with category toggles (necessary, analytics, marketing, functional)
- **Script Blocking** — Block third-party scripts until consent is granted
- **i18n** — 13 built-in locales (en, de, fr, es, it, pt, nl, pl, ru, uk, ja, zh, ko)
- **Remote Storage** — Pluggable backend for cross-device consent sync
- **Framework Support** — Vue 3, Quasar, VitePress, Nuxt 3
- **UMD/CDN** — Use via `<script>` tag, no build tools needed
- **TypeScript** — Full type safety
- **Lightweight** — ~11kB gzip (UMD), no external dependencies
- **SSR Safe** — Works with server-side rendering
- **Accessible** — ARIA-compliant components with focus trap

## Installation

```bash
npm install @structured-world/vue-privacy
# or
yarn add @structured-world/vue-privacy
# or
pnpm add @structured-world/vue-privacy
```

## Quick Start

### Vue 3

```typescript
import { createApp } from 'vue';
import { createConsentPlugin } from '@structured-world/vue-privacy/vue';
import App from './App.vue';

const app = createApp(App);

app.use(createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  euDetection: 'auto',
}));

app.mount('#app');
```

```vue
<template>
  <div id="app">
    <ConsentBanner position="bottom" />
    <ConsentPreferenceModal />
  </div>
</template>
```

### VitePress

```typescript
// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import { enhanceWithConsent } from '@structured-world/vue-privacy/vitepress';

export default enhanceWithConsent(DefaultTheme, {
  gaId: 'G-XXXXXXXXXX',
});
```

### Quasar

```typescript
// src/boot/consent.ts
import { boot } from 'quasar/wrappers';
import { consentBoot } from '@structured-world/vue-privacy/quasar';

export default boot(consentBoot({
  gaId: 'G-XXXXXXXXXX',
}));
```

### CDN / Script Tag

```html
<script src="https://unpkg.com/@structured-world/vue-privacy"></script>
<script>
  const manager = VuePrivacy.createConsentManager({
    gaId: 'G-XXXXXXXXXX',
    euDetection: 'auto',
  });
  manager.init();
</script>
```

## Configuration

```typescript
interface ConsentConfig {
  // Google Analytics measurement ID
  gaId?: string;

  // Locale for UI text (auto-detected if not set)
  // Supported: en, de, fr, es, it, pt, nl, pl, ru, uk, ja, zh, ko
  locale?: SupportedLocale;

  // Consent categories
  categories?: {
    analytics?: boolean;  // Default: false
    marketing?: boolean;  // Default: false
    functional?: boolean; // Default: true
  };

  // Banner UI
  banner?: {
    title?: string;
    message?: string;
    acceptAll?: string;
    rejectAll?: string;
    customize?: string;
    privacyLink?: string;
    privacyLinkText?: string;
  };

  // Preference center UI
  preferenceCenter?: {
    title?: string;
    description?: string;
    savePreferences?: string;
    acceptAll?: string;
    categories?: {
      necessary?: { name?: string; description?: string };
      analytics?: { name?: string; description?: string };
      marketing?: { name?: string; description?: string };
      functional?: { name?: string; description?: string };
    };
  };

  // Cookie settings
  cookie?: {
    name?: string;    // Default: 'consent_preferences'
    expiry?: number;  // Days, default: 365
    domain?: string;
    path?: string;    // Default: '/'
  };

  // Remote consent storage (pluggable backend)
  storage?: ConsentStorage;

  // EU detection mode
  euDetection?: 'auto' | 'cloudflare' | 'api' | 'always' | 'never';

  // Consent version (changing resets all consents)
  version?: string;

  // Callbacks
  onConsentChange?: (consent: StoredConsent) => void;
  onBannerShow?: () => void;
  onBannerHide?: () => void;
  onPreferenceCenterShow?: () => void;
  onPreferenceCenterHide?: () => void;
}
```

## Composables

```vue
<script setup>
import { useConsent } from '@structured-world/vue-privacy/vue';

const {
  acceptAll,
  rejectAll,
  hasConsent,
  resetConsent,
  showPreferenceCenter,
} = useConsent();
</script>

<template>
  <button @click="showPreferenceCenter">Manage Cookies</button>
</template>
```

## Script Blocking

Block third-party scripts until consent is granted:

```html
<script type="text/plain" data-consent-category="analytics"
        src="https://example.com/analytics.js"></script>

<script type="text/plain" data-consent-category="marketing"
        src="https://example.com/ads.js"></script>
```

Scripts are automatically unblocked when the matching category is accepted.

## Remote Consent Storage

Sync consent across devices with a pluggable backend:

```typescript
import { createConsentManager, createKVStorage } from '@structured-world/vue-privacy';

// Built-in Cloudflare KV adapter
const manager = createConsentManager({
  gaId: 'G-XXXXXXXXXX',
  storage: createKVStorage('/api/consent'),
});

// Or implement your own
const manager = createConsentManager({
  storage: {
    get: (uid, version) => fetch(`/api/consent?id=${uid}`).then(r => r.json()),
    set: (uid, consent) => fetch('/api/consent', {
      method: 'POST',
      body: JSON.stringify({ id: uid, ...consent }),
    }).then(r => r.json()).then(d => d.id),
  },
});
```

## Core API (Framework-agnostic)

```typescript
import { createConsentManager } from '@structured-world/vue-privacy';

const manager = createConsentManager({
  gaId: 'G-XXXXXXXXXX',
});

await manager.init();

// Programmatic consent
await manager.acceptAll();
await manager.rejectAll();
await manager.savePreferences({ analytics: true, marketing: false });

// Preference center
manager.showPreferenceCenter();

// Check state
const consent = manager.getConsent();
const isEU = manager.isEUUser();

// Cleanup
manager.destroy();
```

## EU Detection

### Auto (Recommended)

```typescript
createConsentPlugin({ euDetection: 'auto' })
```

Tries in order:
1. Cloudflare `X-Is-EU-Country` header
2. IP API (ipapi.co)
3. Timezone heuristics fallback

## Styling

The banner and preference center use CSS custom properties:

```css
:root {
  --consent-bg: #ffffff;
  --consent-text: #1a1a1a;
  --consent-text-secondary: #666666;
  --consent-link: #0066cc;
  --consent-btn-accept-bg: #0066cc;
  --consent-btn-accept-text: #ffffff;
  --consent-btn-reject-bg: #e0e0e0;
  --consent-btn-reject-text: #1a1a1a;
  --consent-font: system-ui, -apple-system, sans-serif;
}
```

Dark mode is automatically supported via `prefers-color-scheme`.

## Current Features

| Feature | Status |
|---------|--------|
| Consent banner component | ✅ |
| Preference center modal | ✅ |
| Google Consent Mode v2 | ✅ |
| GA4 integration | ✅ |
| EU geo-detection | ✅ |
| Script blocking | ✅ |
| i18n (13 locales) | ✅ |
| Vue 3 / VitePress / Quasar / Nuxt 3 | ✅ |
| UMD/CDN build | ✅ |
| Remote consent storage | ✅ |
| Dark mode support | ✅ |

## Planned

| Feature | Description |
|---------|-------------|
| CCPA support | California Consumer Privacy Act compliance |
| Analytics dashboard | Opt-in rates, banner interactions (via [privacy.structured.world](https://privacy.structured.world)) |

## Related Projects

- [vue-privacy-worker](https://github.com/structured-world/vue-privacy-worker) — Cloudflare Worker for server-side consent storage

## License

Apache 2.0 — see [LICENSE](LICENSE)
