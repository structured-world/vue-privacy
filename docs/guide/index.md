---
description: Cookie consent for Vue 3, Nuxt, VitePress and Quasar where the visitor's choice controls Google Analytics 4. Google Consent Mode v2, a basic mode that sends nothing before consent, region detection and 31 languages.
---

# Getting Started Guide

**@structured-world/vue-privacy** manages cookie consent in Vue 3, VitePress, Nuxt and Quasar apps so that the visitor's choice decides what tracking runs, and adds Google Analytics (GA4) under that choice.

## The Problem

A consent banner on its own controls nothing. The usual failures are in what happens around it:

- The Google tag loads before the visitor chooses, or keeps sending requests after a refusal
- A refusal is lost on a client-side navigation, a reload or in a second tab
- Withdrawing consent leaves the analytics tag running and its cookies in place
- Google requires **Consent Mode v2** signals for visitors in the EEA and the UK (since March 2024), and they have to follow every change of mind

Getting all of this right by hand is a lot of code for "I want Google Analytics, but only with consent".

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

A few lines for Vue 3:

```typescript
import { createConsentPlugin } from '@structured-world/vue-privacy/vue';

app.use(createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  router, // page views on every client-side navigation
}));
```

This handles: gtag.js loading, Consent Mode v2 signals, region detection, the consent banner in 31 languages, and consent persistence. VitePress and Quasar track page views on navigation by themselves; a Vue 3 or Nuxt app passes its router.

For the strictest promise, nothing sent to Google before the visitor allows analytics, add `consentMode: 'basic'` (and `geoDetection: 'always'` to ask every visitor). This site runs that setup. [Basic and Advanced Mode](/guide/consent-mode#basic-and-advanced-mode) explains the difference.

## What It Does

1. **Loads Google Analytics under the choice**: in advanced mode (the default) with every signal `denied` until consent; in basic mode only after the visitor allows analytics
2. **Detects the visitor's country** via Cloudflare headers, a Worker endpoint, IP API, or the browser time zone, unless every visitor is asked
3. **Shows the consent banner** to visitors who need it (EEA and UK by default, without prior consent; also when the lookup fails)
4. **Stores the choice** in a cookie (365 days) and keeps Google Consent Mode signals in step with every change
5. **Tracks SPA navigation** automatically (VitePress, Quasar) or through the router you pass (Vue 3, Nuxt)

Visitors outside consent jurisdictions get analytics enabled without a banner in advanced mode; in basic mode they are measured only after they allow analytics themselves. What the library does not do is listed under [Limits](/guide/limits).

## Key Features

### Google Consent Mode v2

All four consent signals, configured automatically:

- `analytics_storage` — controls Google Analytics cookies
- `ad_storage` — controls advertising cookies
- `ad_user_data` — controls sending user data to Google for ads
- `ad_personalization` — controls personalized advertising

### Region Detection

Multiple detection methods with automatic fallback, each giving the visitor's country, which decides against the [consent jurisdictions](/guide/consent-jurisdictions#consent-jurisdictions):

1. **Cloudflare Headers** — fastest, uses `CF-IPCountry` header
2. **Worker Endpoint** — `/api/geo` when `geoUrl` is set
3. **IP API** — fallback using ipapi.co
4. **Timezone Heuristics** — last resort based on browser timezone

### Fair Consent

- **Refusing is as easy as accepting**: "Reject all" sits beside "Accept all" on the banner and in the preference centre, styled the same.
- **Nothing pre-ticked**: optional categories start unticked, so only the visitor's own tick grants one (CJEU, Planet49).
- **Asking again when needed**: a feature that needs a refused category asks at that moment, saying why, with [`requestConsent()`](/guide/preference-center#asking-again-when-a-feature-needs-a-category).
- **31 languages**, chosen from the browser's languages or your site's language switcher ([Languages](/guide/languages)).

### SPA Page Tracking

VitePress and Quasar track page views on navigation by themselves; a Vue 3 or Nuxt app passes its router to `createConsentPlugin` ([Quick Start](/guide/quick-start#_3-spa-page-tracking-vue-router)). No manual `gtag` calls are needed: a `page_view` with the right `page_path` and `page_title` follows each navigation, and nothing is sent while analytics is not allowed.

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
- [Limits](/guide/limits) — what the library does not cover
