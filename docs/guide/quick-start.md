---
description: Get started with Vue Privacy in 2 minutes. Copy-paste examples for VitePress, Vue 3, Nuxt 3, and Quasar with GDPR-compliant Google Analytics.
---

# Quick Start Guide

## VitePress

One line — Google Analytics with GDPR consent and SPA page tracking:

```typescript
// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import { enhanceWithConsent } from '@structured-world/vue-privacy/vitepress';

export default enhanceWithConsent(DefaultTheme, {
  gaId: 'G-XXXXXXXXXX', // Your GA4 measurement ID
});
```

Page views are tracked automatically on every navigation. [Full VitePress guide](/guide/vitepress)

## Vue 3

### 1. Install the Plugin

```typescript
// main.ts
import { createApp } from 'vue';
import { createConsentPlugin } from '@structured-world/vue-privacy/vue';
import App from './App.vue';

const app = createApp(App);

app.use(createConsentPlugin({
  gaId: 'G-XXXXXXXXXX', // Your GA4 measurement ID
  euDetection: 'auto',
}));

app.mount('#app');
```

### 2. Add the Banner

```vue
<!-- App.vue -->
<script setup>
import { ConsentBanner } from '@structured-world/vue-privacy/vue';
</script>

<template>
  <div id="app">
    <!-- Your app content -->
    <ConsentBanner position="bottom" />
  </div>
</template>
```

That's it! The banner automatically shows for EU users who haven't given consent.

### 3. SPA Page Tracking (Vue Router)

For single-page apps with Vue Router, use `trackPageView` to track navigations:

```vue
<!-- App.vue or a layout component -->
<script setup>
import { useConsent } from '@structured-world/vue-privacy/vue';
import { watch } from 'vue';
import { useRoute } from 'vue-router';

const { trackPageView } = useConsent();
const route = useRoute();

// Initial page view is sent automatically by gtag (sendPageView defaults to true).
// Watch fires only on subsequent navigations — no duplicate tracking.
watch(() => route.path, (path) => {
  trackPageView(path);
});
</script>
```

## Quasar

```typescript
// src/boot/consent.ts
import { boot } from 'quasar/wrappers';
import { consentBoot } from '@structured-world/vue-privacy/quasar';

export default boot(consentBoot({
  gaId: 'G-XXXXXXXXXX',
}));
```

Don't forget to add the boot file to `quasar.config.js`:

```javascript
boot: ['consent'],
```

## Nuxt 3

Nuxt 3 uses the standard Vue plugin. Create a Nuxt plugin file:

```typescript
// plugins/consent.client.ts
import { createConsentPlugin } from '@structured-world/vue-privacy/vue';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(createConsentPlugin({
    gaId: 'G-XXXXXXXXXX',
  }));
});
```

Then add the `ConsentBanner` component to your layout. [Full Nuxt guide](/guide/nuxt)

## Framework-Agnostic

```typescript
import { createConsentManager } from '@structured-world/vue-privacy';

const manager = createConsentManager({
  gaId: 'G-XXXXXXXXXX',
  euDetection: 'auto',
});

// Initialize (loads GA, shows banner for EU users)
await manager.init();

// Track page views manually (for SPAs)
manager.trackPageView('/new-page');

// Programmatic consent
await manager.acceptAll();
await manager.rejectAll();
```

## What Happens

1. **Google Analytics loads** — `gtag.js` injected with Consent Mode v2 defaults
2. **EU detection** — checks if user is in the EU (Cloudflare → IP API → timezone)
3. **Consent defaults** — EU users start with `denied`, non-EU with `granted`
4. **Banner display** — shows only for EU users without stored consent
5. **User choice** — consent stored in cookie, Google Consent Mode signals updated
6. **Page tracking** — automatic in VitePress and Quasar; use `trackPageView()` with Vue Router (see example above)

Non-EU users automatically get analytics enabled without seeing the banner.
