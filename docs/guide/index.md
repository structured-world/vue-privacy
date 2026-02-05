---
description: Learn how to add GDPR-compliant Google Analytics to Vue 3, Nuxt, VitePress, and Quasar with automatic consent management and Google Consent Mode v2.
---

# Getting Started Guide

**@structured-world/vue-privacy** adds Google Analytics (GA4) to your Vue 3, VitePress, Nuxt 3, or Quasar app with GDPR-compliant consent built in.

## The Problem

Since March 2024, Google requires **Consent Mode v2** for all websites using Google Analytics or Google Ads in the EU. Setting this up correctly means:

- Loading `gtag.js` with the right consent defaults **before** any tracking
- Showing a cookie consent banner to EU users
- Updating consent signals when the user makes a choice
- Handling SPA navigation (Vue Router, VitePress) so page views are tracked correctly

That's a lot of boilerplate for "I just want Google Analytics on my site".

## The Solution

One line for VitePress:

```typescript
// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import { enhanceWithConsent } from '@structured-world/vue-privacy/vitepress';

export default enhanceWithConsent(DefaultTheme, {
  gaId: 'G-XXXXXXXXXX',
});
```

Three lines for Vue 3:

```typescript
import { createConsentPlugin } from '@structured-world/vue-privacy/vue';

app.use(createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
}));
```

This handles: gtag.js loading, Consent Mode v2 defaults, EU detection, consent banner, and consent persistence. For SPA page tracking, VitePress and Quasar include automatic router integration; Vue Router requires simple route watching via `trackPageView()` (see [Quick Start](/guide/quick-start#spa-page-tracking-vue-router)).

## What It Does

1. **Loads Google Analytics** with proper Consent Mode v2 defaults (`denied` for EU)
2. **Detects EU users** via Cloudflare headers, IP API, or timezone heuristics
3. **Shows consent banner** only to users who need it (EU without prior consent)
4. **Stores consent** in a cookie (365 days) and updates Google Consent Mode signals
5. **Tracks SPA navigation** automatically (VitePress, Quasar) or via simple route watching (Vue Router)

Non-EU users get analytics enabled silently without seeing a banner.

## Key Features

### Google Consent Mode v2

All four consent signals, configured automatically:

- `analytics_storage` — controls Google Analytics cookies
- `ad_storage` — controls advertising cookies
- `ad_user_data` — controls sending user data to Google for ads
- `ad_personalization` — controls personalized advertising

### EU Detection

Multiple detection methods with automatic fallback:

1. **Cloudflare Headers** — fastest, uses `CF-IPCountry` header
2. **IP API** — fallback using ipapi.co
3. **Timezone Heuristics** — last resort based on browser timezone

### SPA Page Tracking

For single-page apps, VitePress and Quasar provide automatic page view tracking on navigation. Vue Router requires simple route watching via `trackPageView()` (see [Quick Start](/guide/quick-start#spa-page-tracking-vue-router)). No manual `gtag` calls required — the adapters send `page_view` events with correct `page_path` and `page_title` after each navigation.

### Framework Agnostic Core

The core library works without any framework:

```typescript
import { createConsentManager } from '@structured-world/vue-privacy';

const manager = createConsentManager({ gaId: 'G-XXXXXXXXXX' });
await manager.init();
```

## Next Steps

- [Installation](/guide/installation) — install the package
- [Quick Start](/guide/quick-start) — get running in 2 minutes
- [VitePress Integration](/guide/vitepress) — one-line setup for docs sites
- [Vue 3 Integration](/guide/vue) — plugin, composables, components
