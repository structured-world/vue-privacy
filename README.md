# @structured-world/consent

GDPR-compliant cookie consent with **Google Consent Mode v2** support for Vue 3, Quasar, and VitePress.

[![npm version](https://img.shields.io/npm/v/@structured-world/consent.svg)](https://www.npmjs.com/package/@structured-world/consent)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Features

- **Google Consent Mode v2** - Full support for `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`
- **EU Detection** - Auto-detect EU users via Cloudflare headers or IP API
- **Framework Support** - Vue 3, Quasar, VitePress out of the box
- **TypeScript** - Full type safety
- **Lightweight** - No external dependencies for core functionality
- **Customizable** - Fully configurable UI and behavior
- **SSR Safe** - Works with server-side rendering
- **Accessible** - ARIA-compliant banner component

## Installation

```bash
npm install @structured-world/consent
# or
yarn add @structured-world/consent
# or
pnpm add @structured-world/consent
```

## Quick Start

### Vue 3

```typescript
import { createApp } from 'vue';
import { createConsentPlugin } from '@structured-world/consent/vue';
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
    <!-- Your app content -->
    <ConsentBanner position="bottom" />
  </div>
</template>
```

### VitePress

```typescript
// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import { enhanceWithConsent } from '@structured-world/consent/vitepress';

export default enhanceWithConsent(DefaultTheme, {
  gaId: 'G-XXXXXXXXXX',
});
```

### Quasar

```typescript
// src/boot/consent.ts
import { boot } from 'quasar/wrappers';
import { consentBoot } from '@structured-world/consent/quasar';

export default boot(consentBoot({
  gaId: 'G-XXXXXXXXXX',
}));
```

## Configuration

```typescript
interface ConsentConfig {
  // Google Analytics measurement ID
  gaId?: string;

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

  // Cookie settings
  cookie?: {
    name?: string;    // Default: 'consent_preferences'
    expiry?: number;  // Days, default: 365
    domain?: string;
    path?: string;    // Default: '/'
  };

  // EU detection mode
  euDetection?: 'auto' | 'cloudflare' | 'api' | 'always' | 'never';

  // Consent version (changing resets all consents)
  version?: string;

  // Callbacks
  onConsentChange?: (consent: StoredConsent) => void;
  onBannerShow?: () => void;
  onBannerHide?: () => void;
}
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

### Cloudflare Setup

Add a Transform Rule in Cloudflare Dashboard:

**Rules > Transform Rules > Modify Request Header**

- Header name: `X-Is-EU-Country`
- Value: `ip.geoip.is_in_european_union`

Or use a Worker:

```typescript
export default {
  async fetch(request) {
    const isEU = request.cf?.isEUCountry === true;
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Is-EU-Country', isEU ? 'true' : 'false');
    return newResponse;
  }
}
```

## Composables

```vue
<script setup>
import { useConsent } from '@structured-world/consent/vue';

const { acceptAll, rejectAll, hasConsent, resetConsent } = useConsent();
</script>

<template>
  <button @click="resetConsent">Manage Cookies</button>
</template>
```

## Core API (Framework-agnostic)

```typescript
import { createConsentManager } from '@structured-world/consent';

const manager = createConsentManager({
  gaId: 'G-XXXXXXXXXX',
});

// Initialize (shows banner for EU users)
await manager.init();

// Programmatic consent
await manager.acceptAll();
await manager.rejectAll();
await manager.savePreferences({ analytics: true, marketing: false });

// Check consent
const consent = manager.getConsent();
const hasConsent = manager.hasConsent();
const isEU = manager.isEUUser();
```

## Styling

The banner uses CSS custom properties for theming:

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

## License

Apache 2.0 - see [LICENSE](LICENSE)

## Links

- [Documentation](https://consent.sw.foundation)
- [GitHub](https://github.com/structured-world/consent)
- [npm](https://www.npmjs.com/package/@structured-world/consent)
