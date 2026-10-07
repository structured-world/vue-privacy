---
description: Implement Google Consent Mode v2 for GDPR compliance. Automatic consent signal propagation to Google Analytics, Ads, and Tag Manager.
---

# Google Consent Mode v2

## Overview

Google Consent Mode v2 is required since March 2024 for websites using Google Analytics or Google Ads in the European Economic Area (EEA).

This library automatically manages all four consent signals:

| Signal | Description |
|--------|-------------|
| `analytics_storage` | Controls Google Analytics cookies |
| `ad_storage` | Controls advertising cookies |
| `ad_user_data` | Controls sending user data to Google for ads |
| `ad_personalization` | Controls personalized advertising |

## How It Works

### 1. Default Denied State

Before any user interaction, the library sets all signals to `denied`:

```javascript
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500,
});
```

### 2. Load Google Analytics

After setting defaults, the gtag.js script loads:

```javascript
gtag('js', new Date());
gtag('config', 'G-XXXXXXXXXX');
```

A returning visitor's stored choice is known before the tag loads, so the single `default` carries it (for example `analytics_storage: 'granted'` with the ad signals `denied`) and the page needs no update. The same holds outside consent jurisdictions, where every signal defaults to `granted`. These defaults are final, so they carry no `wait_for_update` and the first page view is not held back; `wait_for_update: 500` is used only while the banner is still waiting for an answer.

If your page already loaded gtag.js before the library runs, the defaults come too late to apply, so the library follows them with an update carrying the same signals. Until the tag runs, the default is placed ahead of any measurement already queued, including the `gtm.js` event of a Google Tag Manager snippet.

The `default`, `js` and `config` commands run once per page; a consent change never repeats them. This holds across manager instances (two app roots, a remount): when the page already holds a `consent default`, including one your own snippet issued, the library sends its signals as an update.

If gtag.js fails to load (an ad blocker, a network error) or has not run within 10 seconds, the banner still shows and choices are still saved; `onGoogleAnalyticsError` receives the error and the next consent change retries the load.

### 3. Update on Consent

Each later choice (accept, reject, saved preferences) sends one update:

```javascript
gtag('consent', 'update', {
  analytics_storage: 'granted',
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
});
```

## Basic and Advanced Mode

The steps above are Google's **advanced** mode, the default: gtag.js loads for every visitor, and before any choice or after a refusal Google receives cookieless pings (no cookies, but the visitor's IP address and browser data), which lets it model conversions.

With `consentMode: 'basic'` nothing reaches Google (no script, no `dataLayer` entry, no request) until the visitor allows analytics. Then the single `consent default` carries the granted signals, gtag.js loads and `js` and `config` follow; later changes are updates as above. Withdrawing analytics sends `consent update` with `analytics_storage: 'denied'`, sets `window['ga-disable-<ID>']` so a tag already on the page stops measuring (a denied tag would otherwise keep sending cookieless pings), deletes the `_ga` and `_ga_<ID>` cookies (also under a `cookie_prefix` or `cookie_path`), and never loads or retries gtag.js. `trackEvent()` drops events until analytics is allowed; `trackPageView()` sends nothing either, but keeps the page view tracked last and sends it once on the grant (with `sendPageView: false`; otherwise the tag's own first page view covers the page); the tag also follows a choice made in another tab, loading after a grant there and stopping after a withdrawal. The consent cookie is the only state the tabs share, so a tab reads it again on the next tracking call and whenever it is shown again or regains focus; a tab that stays visible beside the other window without either keeps its state until then, and one on a route a cookie limited to `cookie.path` does not cover keeps its last known choice. Scripts gated by `data-consent-category` follow such a grant too, a banner the other tab answered closes, and a reset there shows the banner here, as a local reset does. A `window['ga-disable-<ID>']` opt-out the site set itself is kept: a grant lifts only the switch the library set.

```typescript
createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  consentMode: 'basic',
});
```

Basic mode requires `gaId`: the promise holds only for a tag the manager loads itself and can switch off. A site that loads gtag.js with its own snippet contacts Google before any choice, so the manager refuses `consentMode: 'basic'` without `gaId` (the constructor throws).

A withdrawal on the same page stops Google Analytics at once, but a script already running cannot be unloaded: products linked to the same Google tag in Google's tag settings (Google Ads, Floodlight) ignore `ga-disable` and keep sending cookieless pings until the page reloads. A site that links them and promises nothing is sent after a refusal sets `reloadOnWithdrawal: true`: when the visitor withdraws analytics after the tag loaded, the choice is saved and the page reloads. That includes a refusal an app remounted on the same page finds on start while the tag an earlier mount loaded still runs; a tag the site loads itself never triggers a reload, since it would come back with every load. It is off by default because the reload drops in-page state (a half-filled form, SPA state). While analytics stays allowed the tag loads, and linked advertising products follow the ad signals: with marketing refused they send cookieless pings. Keep them in a separate tag if refusing marketing must stop them entirely.

```typescript
createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  consentMode: 'basic',
  reloadOnWithdrawal: true,
});
```

Only the visitor's own choice counts in basic mode: a grant applied by jurisdiction (CCPA, outside consent jurisdictions) leaves analytics off, so it loads no Google tag and unblocks no `data-consent-category="analytics"` script. A site that promises "Google Analytics only with consent" needs basic mode, usually with `euDetection: 'always'` so every visitor is asked.

## Category Mapping

The library maps user-friendly categories to Google signals:

| Category | Google Signals |
|----------|----------------|
| `analytics` | `analytics_storage` |
| `marketing` | `ad_storage`, `ad_user_data`, `ad_personalization` |
| `functional` | (no Google signals) |
| `necessary` | (always allowed) |

## Manual Signal Control

For advanced use cases:

```typescript
import { updateConsent } from '@structured-world/vue-privacy';

// Update specific signals
updateConsent({
  analytics_storage: 'granted',
  ad_storage: 'denied',
});
```

## Verification

Check that Consent Mode is working:

1. Open Chrome DevTools
2. Go to Console
3. Type `dataLayer` and expand the array
4. Look for `consent` events with `default` and `update` commands

Or use [Google Tag Assistant](https://tagassistant.google.com/) for visual verification.

## Important Notes

::: warning Order Matters
Always set consent defaults BEFORE loading gtag.js. This library handles this automatically.
:::

::: tip Non-EU Users
For users outside the EU, the library can automatically grant consent without showing a banner. Configure with `euDetection: 'auto'`.
:::
