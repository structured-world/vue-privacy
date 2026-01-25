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

### 3. Update on Consent

When the user gives consent:

```javascript
gtag('consent', 'update', {
  analytics_storage: 'granted',
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
});
```

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
import { updateConsent } from '@structured-world/consent';

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
