# @structured-world/vue-privacy

GDPR cookie consent banner and Google Analytics (GA4) with **Google Consent Mode v2** for Vue 3, Nuxt, VitePress, Quasar and plain HTML, in 31 languages.

[![npm version](https://img.shields.io/npm/v/@structured-world/vue-privacy.svg)](https://www.npmjs.com/package/@structured-world/vue-privacy)
[![npm downloads](https://img.shields.io/npm/dm/@structured-world/vue-privacy.svg)](https://www.npmjs.com/package/@structured-world/vue-privacy)
[![npm total downloads](https://img.shields.io/npm/dt/@structured-world/vue-privacy.svg?label=total%20downloads)](https://www.npmjs.com/package/@structured-world/vue-privacy)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@structured-world/vue-privacy)](https://bundlephobia.com/package/@structured-world/vue-privacy)
[![CI](https://github.com/structured-world/vue-privacy/actions/workflows/ci.yml/badge.svg)](https://github.com/structured-world/vue-privacy/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**[Documentation](https://privacy.sw.foundation)** · [GitHub](https://github.com/structured-world/vue-privacy) · [npm](https://www.npmjs.com/package/@structured-world/vue-privacy)

## Features

- **Google Consent Mode v2** — Full support for `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`
- **GDPR & CCPA** — Compliant with EU GDPR and California Consumer Privacy Act
- **GDPR Roaming Protection** — Ask again when a choice made outside consent jurisdictions meets a visitor now inside one
- **[Consent Jurisdictions](https://privacy.sw.foundation/guide/consent-jurisdictions)** — Ask visitors in the EEA and the UK (Switzerland on request), detected by country via Cloudflare headers, a Worker, IP API, or timezone; a failed lookup asks too
- **Consent Banner** — Customizable GDPR/CCPA banner; follows the system's dark mode or a pinned light or dark theme
- **Preference Center** — OneTrust-style modal with category toggles (necessary, analytics, marketing, functional)
- **Ask Again When Needed** — A feature that needs a refused category (sign-in, an embedded video) asks for it again, saying why
- **Script Blocking** — Block third-party scripts until consent is granted
- **[31 Languages](https://privacy.sw.foundation/guide/languages)** — every official EU language, Norwegian and Icelandic, plus ja, ko, ru, uk, zh; follows the browser's preferred languages and the site's language switcher
- **Remote Storage** — Pluggable backend for cross-device consent sync with retry support
- **GA4 Event Tracking** — Typed helpers for ecommerce and conversion events
- **Framework Support** — Vue 3, Quasar, VitePress, Nuxt 3
- **Vanilla JS** — Framework-agnostic entry point (`/vanilla`) for non-Vue projects
- **UMD/CDN** — Use via `<script>` tag, no build tools needed
- **TypeScript** — Full type safety
- **No runtime dependencies** — ~31 kB gzip (UMD, all 31 locales included)
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
import router from './router';
import App from './App.vue';

const app = createApp(App);

app.use(router);
app.use(createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  geoDetection: 'auto',
  router: router,  // Enables automatic SPA page tracking
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

> **TypeScript users:** Add `vue-router` as a dev dependency for type resolution:
> `npm i -D vue-router` (not needed at runtime)

```typescript
// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import { enhanceWithConsent } from '@structured-world/vue-privacy/vitepress';

export default enhanceWithConsent(DefaultTheme, {
  gaId: 'G-XXXXXXXXXX',
});
```

Fire GA4 events from frontmatter:

```md
---
ga4Title: Pricing Page
ga4Event:
  name: view_pricing
  params:
    page_type: pricing
---
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
    geoDetection: 'auto',
  });
  manager.init();
</script>
```

### Vanilla JS (Non-Vue Projects)

For projects without Vue, use the `/vanilla` entry point with pre-built CSS:

```typescript
import { createConsentManager } from '@structured-world/vue-privacy';
import { createBanner, createModal } from '@structured-world/vue-privacy/vanilla';
import '@structured-world/vue-privacy/banner.css';
import '@structured-world/vue-privacy/modal.css';

const manager = createConsentManager({ gaId: 'G-XXXXXXXXXX' });
await manager.init();

createBanner({ manager, position: 'bottom' });
createModal({ manager });
```

## Configuration

```typescript
interface ConsentConfig {
  // Google Analytics measurement ID
  gaId?: string;

  // Automatic page_view from the tag's config call (false for SPAs). Default: true
  sendPageView?: boolean;

  // Google tag configuration, see "Data minimisation" below
  googleAnalytics?: {
    config?: GoogleAnalyticsConfigFields;       // fields of gtag('config', gaId, ...)
    customParameters?: Record<string, unknown>; // custom fields merged into that call
    set?: GoogleAnalyticsFields;                // gtag('set', ...) before config
    adsDataRedaction?: boolean;                 // gtag('set', 'ads_data_redaction', ...)
    urlPassthrough?: boolean;                   // gtag('set', 'url_passthrough', ...)
  };

  // 'advanced' (default): gtag.js loads for every visitor with denied defaults and Google
  //   receives cookieless pings before any choice and after a refusal.
  // 'basic': nothing reaches Google until the visitor allows analytics. Requires gaId.
  consentMode?: 'advanced' | 'basic';

  // Basic mode: reload the page when analytics is withdrawn after the Google tag loaded, so
  // products linked to that tag (Google Ads, Floodlight) stop too. Default: false
  reloadOnWithdrawal?: boolean;

  // Locale for UI text. When not set: the first of the browser's preferred languages
  // (navigator.languages) among `locales`. consentManager.setLocale(tag) switches it later
  // (see the Languages guide).
  // Supported: bg, cs, da, de, el, en, es, et, fi, fr, ga, hr, hu, is, it, ja, ko, lt, lv,
  // mt, nb, nl, pl, pt, ro, ru, sk, sl, sv, uk, zh
  locale?: SupportedLocale;

  // The locales the site offers (default: all built-in)
  locales?: SupportedLocale[];

  // Shown when none of the visitor's languages is offered
  // Default: 'en' when offered, else the first of `locales`
  fallbackLocale?: SupportedLocale;

  // Colour palette of the banner and preference centre. 'auto' (default) follows the
  // system's colour scheme; 'light' and 'dark' pin one whatever the system prefers.
  theme?: 'auto' | 'light' | 'dark';

  // Optional categories the site actually uses (default: all three). The preference centre
  // shows only these, unticked until the visitor ticks one (a pre-ticked box is no consent:
  // CJEU C-673/17 Planet49); every other category is always refused, so e.g. ['analytics']
  // keeps ad_storage, ad_user_data and ad_personalization denied even after "Accept all".
  usedCategories?: ('analytics' | 'marketing' | 'functional')[];

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
    rejectAll?: string;
    categories?: {
      necessary?: { name?: string; description?: string };
      analytics?: { name?: string; description?: string };
      marketing?: { name?: string; description?: string };
      functional?: { name?: string; description?: string };
    };
  };

  // Consent cookie (strictly necessary: holds the categories, the time and version of the
  // choice, and whether it was made in a consent jurisdiction; never the location)
  cookie?: {
    name?: string;    // Default: 'consent_preferences'
    expiry?: number;  // Days, default: 365
    domain?: string;
    path?: string;    // Default: '/'
  };

  // Remote consent storage (pluggable backend)
  storage?: ConsentStorage;

  // How the visitor's country is found. Default: 'auto'
  geoDetection?: 'auto' | 'cloudflare' | 'worker' | 'api' | 'always' | 'never';

  // Worker geo endpoint (e.g. '/api/geo'), used by 'worker' and 'auto'
  geoUrl?: string;

  // Custom geo-detection provider, in place of geoDetection
  geoDetector?: GeoDetector;

  // Jurisdictions whose visitors are asked for consent. Default: ['EEA', 'UK']
  consentJurisdictions?: ('EEA' | 'UK' | 'CH')[];

  // A failed geo lookup: ask for consent (default) or treat as outside
  geoFailure?: 'require-consent' | 'grant';

  // Consent version (changing resets all consents)
  version?: string;

  // CCPA mode: visitors in covered US states see no banner and opt out through your own
  // "Do Not Sell" link (isCCPAUser(), doNotSellText). Default: false
  ccpaEnabled?: boolean;
  doNotSellText?: string;

  // Callbacks
  onConsentChange?: (consent: StoredConsent) => void;
  onBannerShow?: () => void;
  onBannerHide?: () => void;
  onPreferenceCenterShow?: () => void;
  onPreferenceCenterHide?: () => void;
  onCCPAUser?: () => void;
  onGoogleAnalyticsError?: (error: unknown) => void; // gtag.js failed to load; consent still works
}
```

### Basic or advanced Consent Mode

| | `'advanced'` (default) | `'basic'` |
|---|---|---|
| gtag.js before a choice | loaded, all signals denied | not loaded |
| Page views and events before a choice | sent as cookieless pings | not sent; events are dropped, the page view tracked last is sent once analytics is allowed (with `sendPageView: false`; otherwise the tag's own page view covers it) |
| After a refusal | cookieless pings continue | nothing is sent: a loaded tag is switched off (`ga-disable-<ID>`), `_ga` cookies are deleted; products linked to the same tag (Google Ads, Floodlight) stop only on reload, see `reloadOnWithdrawal` |
| After analytics is allowed | full measurement | gtag.js loads, full measurement |
| Google's conversion modelling | available | not available for visitors who did not consent |

Cookieless pings still carry the visitor's IP address and browser data to Google, and several European regulators treat loading the tag and sending them as processing that needs consent. A site that promises "Google Analytics only with consent" needs `consentMode: 'basic'`.

In basic mode only the visitor's own choice counts: a grant the library applies by jurisdiction (CCPA, outside consent jurisdictions) leaves analytics off (no Google tag, no `data-consent-category="analytics"` scripts unblocked, `analytics: false` in `onConsentChange`) and is not stored, so such visitors are measured only after they allow analytics in the preference centre. Use `geoDetection: 'always'` to ask every visitor. A consent cookie that an earlier version stored for a CCPA visitor without a choice counts as a choice; changing `version` asks those visitors again.

### Data minimisation

`googleAnalytics` configures the Google tag inside the consent flow, so a site does not have to call `gtag()` itself before the manager runs:

```typescript
createConsentManager({
  gaId: 'G-XXXXXXXXXX',
  googleAnalytics: {
    config: {
      allow_google_signals: false,             // no reporting on advertising identifiers
      allow_ad_personalization_signals: false, // no ad personalisation
      cookie_expires: 60 * 60 * 24 * 90,       // _ga cookies live 90 days (seconds)
      cookie_update: false,                    // counted from the first visit
    },
    adsDataRedaction: true, // strip ad click IDs while ad_storage is denied
  },
});
```

The `set` fields, `ads_data_redaction` and `url_passthrough` go out in one `gtag('set', ...)` after the consent default and before `config`; every `config` field and custom parameter goes into the single `config` call, with `send_page_view` taken from `sendPageView`. The documented fields are typed, so a misspelt or mistyped one fails to compile; `debug_mode` accepts only `true`, because Google keeps debug mode on for `false` as well. In basic mode none of this is sent before the visitor allows analytics; the cookie settings still tell the manager where to delete the `_ga` cookies after a refusal.

## Composables

```vue
<script setup>
import { useConsent } from '@structured-world/vue-privacy/vue';

const {
  // Consent management
  acceptAll,
  rejectAll,
  hasConsent,
  resetConsent,
  showPreferenceCenter,
  requestConsent, // ask again for a refused category a feature needs, saying why
  // GA4 event tracking
  trackEvent,
  trackPurchase,
  trackAddToCart,
  trackViewItem,
  trackSignUp,
  trackLogin,
} = useConsent();

// Track custom event
trackEvent('button_click', { button_id: 'hero-cta' });

// Track purchase
trackPurchase({
  transaction_id: 'T12345',
  value: 99.99,
  currency: 'USD',
  items: [{ item_id: 'SKU123', item_name: 'Product', price: 99.99 }],
});
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

// Built-in Cloudflare KV adapter with retry on rate limit
const manager = createConsentManager({
  gaId: 'G-XXXXXXXXXX',
  storage: createKVStorage('/api/consent', {
    maxRetries: 3,  // Retry up to 3 times on 429 responses
    onRateLimited: (retryAfter, attempt) => {
      console.log(`Rate limited, attempt ${attempt}`);
    },
  }),
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
import { createConsentManager, VERSION } from '@structured-world/vue-privacy';

console.log('Vue Privacy version:', VERSION); // e.g., "1.10.0"

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

// A feature that needs a refused category asks again, saying why; true once granted
const allowed = await manager.requestConsent('functional', {
  reason: 'Sign-in needs functional cookies to keep you logged in.',
});

// Check state
const consent = manager.getConsent();
const asked = manager.isConsentRequired(); // in a consent jurisdiction?

// Language switcher
manager.setLocale('ro'); // the banner and preference centre re-render in Romanian

// Cleanup
manager.destroy();
```

## Consent Jurisdictions

The banner is shown to visitors in a jurisdiction whose law requires consent before non-essential cookies, decided from the visitor's country:

| Jurisdiction | Countries | Default |
|---|---|---|
| `'EEA'` | the 27 EU member states, including the outermost regions and Åland (AX, GF, GP, MQ, RE, YT, MF); Iceland, Liechtenstein, Norway | on |
| `'UK'` | United Kingdom (UK GDPR, PECR) | on |
| `'CH'` | Switzerland | off |

```typescript
createConsentPlugin({ consentJurisdictions: ['EEA', 'UK', 'CH'] })
```

Everywhere else every category is granted without a banner (CCPA states: see `ccpaEnabled`). A failed lookup (a blocked IP API, a browser reporting UTC) asks for consent; `geoFailure: 'grant'` treats it as outside instead. `isConsentRequired()` tells which applies. See [Consent Jurisdictions](https://privacy.sw.foundation/guide/consent-jurisdictions) for the details.

### Detection (`geoDetection: 'auto'`, recommended)

Tries in order:
1. Cloudflare `CF-IPCountry` (and `X-Is-EU-Country`) response headers
2. Worker `/api/geo` (when `geoUrl` is set)
3. IP API (ipapi.co)
4. Browser time zone, mapped to its country from the IANA tz database

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
  /* Unset by default: "Reject all" then takes the accept colours */
  /* --consent-btn-reject-bg, --consent-btn-reject-text */
  --consent-font: system-ui, -apple-system, sans-serif;
}
```

Dark mode follows the system's `prefers-color-scheme` by default. `theme: 'light'` or `theme: 'dark'` in the config pins one palette (a light-only site keeps a light dialog for visitors in dark mode); a component's own `theme` prop or option outranks it.

Refusing is as easy and as visible as accepting by default: "Accept all" and "Reject all" on the banner share one style (same size, weight and colours), and the preference centre offers "Reject all" beside "Accept all". The EDPB Cookie Banner Taskforce report (January 2023, points 9-14) and the CNIL guidance treat a less visible refusal as a deceptive design. A site that sets `--consent-btn-reject-bg` / `--consent-btn-reject-text` keeps its own colours.

## Current Features

| Feature | Status |
|---------|--------|
| Consent banner component | ✅ |
| Preference center modal | ✅ |
| Google Consent Mode v2 | ✅ |
| GDPR compliance | ✅ |
| CCPA compliance | ✅ |
| GDPR roaming protection | ✅ |
| GA4 integration | ✅ |
| GA4 event tracking (ecommerce, conversions) | ✅ |
| Consent jurisdiction detection (EEA, UK, optional CH) | ✅ |
| Script blocking | ✅ |
| Only the categories the site uses | ✅ |
| Ask again for a refused category a feature needs | ✅ |
| i18n (31 locales, every EU and EEA language) | ✅ |
| Language switching at run time | ✅ |
| Vue 3 / VitePress / Quasar / Nuxt 3 | ✅ |
| Vanilla JS entry point | ✅ |
| UMD/CDN build | ✅ |
| Remote consent storage | ✅ |
| Retry on rate limit (KV storage) | ✅ |
| Dark mode, pinned light or dark theme | ✅ |

## Planned

| Feature | Description |
|---------|-------------|
| Analytics dashboard | Opt-in rates, banner interactions (via [privacy.structured.world](https://privacy.structured.world)) |

## Related Projects

- [vue-privacy-worker](https://github.com/structured-world/vue-privacy-worker) — Cloudflare Worker for server-side consent storage

## License

Apache 2.0 — see [LICENSE](LICENSE)

Contributions are accepted under the [Structured World Contributor License Agreement](https://sw.foundation/cla); see [CONTRIBUTING.md](CONTRIBUTING.md).
