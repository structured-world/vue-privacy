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

With `consentMode: 'basic'` nothing reaches Google (no script, no `dataLayer` entry, no request) until the visitor allows analytics. Then the single `consent default` carries the granted signals, gtag.js loads and `js` and `config` follow; later changes are updates as above. Withdrawing analytics sends `consent update` with `analytics_storage: 'denied'` and deletes the `_ga` and `_ga_<ID>` cookies. `trackPageView()` and `trackEvent()` drop events until analytics is allowed.

```typescript
createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  consentMode: 'basic',
});
```

Only the visitor's own choice counts in basic mode: a grant applied by jurisdiction (CCPA, outside consent jurisdictions) loads no Google tag. A site that promises "Google Analytics only with consent" needs basic mode, usually with `euDetection: 'always'` so every visitor is asked.

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
