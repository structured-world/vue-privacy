---
description: Add a GDPR cookie consent banner and Google Analytics 4 with Consent Mode v2 in minutes. Copy-paste examples for VitePress, Vue 3, Nuxt, Quasar and plain JavaScript.
---

# Quick Start in 5 Minutes

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
  geoDetection: 'auto',
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

That's it! The banner automatically shows for visitors in a [consent jurisdiction](/guide/consent-jurisdictions) (EEA and UK by default) who haven't chosen yet.

### 3. SPA Page Tracking (Vue Router)

Add `router` to the plugin registration from step 1 (install the plugin once): each client-side navigation then sends a page view, with `ga4Title` from the route meta as its title, and a route's `ga4Event` is sent as a separate event:

```typescript
// main.ts: step 1's registration, with the router
import router from './router'; // your Vue Router instance

app.use(router);
app.use(createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  geoDetection: 'auto',
  router,
}));
```

For custom logic, leave `router` out and track navigations yourself with `trackPageView`:

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

## Nuxt

Nuxt 4 and Nuxt 3 use the standard Vue plugin. Create a client plugin file:

```typescript
// app/plugins/consent.client.ts (Nuxt 3 without the app/ directory: plugins/consent.client.ts)
import { createConsentPlugin } from '@structured-world/vue-privacy/vue';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(createConsentPlugin({
    gaId: 'G-XXXXXXXXXX',
    router: nuxtApp.$router, // page views on every client-side navigation
  }));
});
```

Then add the `ConsentBanner` component to your layout. [Full Nuxt guide](/guide/nuxt)

## Framework-Agnostic

```typescript
import { createConsentManager } from '@structured-world/vue-privacy';

const manager = createConsentManager({
  gaId: 'G-XXXXXXXXXX',
  geoDetection: 'auto',
});

// Initialize (loads GA, shows the banner in consent jurisdictions)
await manager.init();

// Track page views manually (for SPAs)
manager.trackPageView('/new-page');

// Programmatic consent
await manager.acceptAll();
await manager.rejectAll();
```

## What Happens

1. **Google Analytics loads** — `gtag.js` injected with Consent Mode v2 defaults
2. **Region detection** — finds the visitor's country (Cloudflare → IP API → timezone) and whether it is a [consent jurisdiction](/guide/consent-jurisdictions) (EEA and UK by default)
3. **Consent defaults** — visitors there (or whose lookup failed) start with `denied`, others with `granted`
4. **Banner display** — shows only for visitors in consent jurisdictions without stored consent
5. **User choice** — consent stored in cookie, Google Consent Mode signals updated
6. **Page tracking**: automatic in VitePress and Quasar, and in Vue 3 and Nuxt once the router is passed to the plugin; `trackPageView()` is only for an app that tracks navigations itself instead (use one or the other, not both, or each navigation is counted twice)

Visitors elsewhere get analytics enabled without seeing the banner.
