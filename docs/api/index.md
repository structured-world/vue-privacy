---
description: Framework-agnostic Vue Privacy API reference. ConsentManager methods, Google Tag functions, storage utilities, and KV storage with rate limiting.
---

# Core API Reference Guide

The core API is framework-agnostic and can be used without Vue.

## createConsentManager

Creates a consent manager instance.

```typescript
import { createConsentManager } from '@structured-world/vue-privacy';

const manager = createConsentManager({
  gaId: 'G-XXXXXXXXXX',
  euDetection: 'auto',
});
```

### Methods

#### `init(): Promise<void>`

Initialize the consent manager. Detects EU status, loads stored consent, and shows banner if needed.

```typescript
await manager.init();
```

#### `acceptAll(): Promise<void>`

Accept all consent categories.

```typescript
await manager.acceptAll();
```

#### `rejectAll(): Promise<void>`

Reject all non-essential categories.

```typescript
await manager.rejectAll();
```

#### `savePreferences(categories): Promise<void>`

Save specific category preferences.

```typescript
await manager.savePreferences({
  analytics: true,
  marketing: false,
  functional: true,
});
```

#### `getConsent(): StoredConsent | null`

Get current stored consent.

```typescript
const consent = manager.getConsent();
if (consent) {
  console.log('Analytics:', consent.categories.analytics);
}
```

#### `hasConsent(): boolean`

Check if user has given consent.

```typescript
if (manager.hasConsent()) {
  // User has made a choice
}
```

#### `isEUUser(): boolean`

Check if user is detected as EU.

```typescript
if (manager.isEUUser()) {
  // Show GDPR-specific content
}
```

#### `trackPageView(path, title?): void`

Track a page view manually. Use this for SPA navigation with Vue Router or custom routing.

Events are always sent to Google Analytics. When analytics consent is denied, Google Consent Mode prevents the data from being stored. If a user has explicitly denied analytics consent (stored in cookie), the event is not sent at all.

```typescript
manager.trackPageView('/docs/guide');
manager.trackPageView('/docs/api', 'API Reference');
```

::: tip
The VitePress `enhanceWithConsent` adapter calls this automatically on every navigation. You only need this for custom SPA setups.
:::

#### `isInitialized(): boolean`

Check if the consent manager has been initialized.

```typescript
if (manager.isInitialized()) {
  // Manager is ready
}
```

#### `resetConsent(): void`

Clear stored consent and show banner again.

```typescript
manager.resetConsent();
```

## Google Tag Functions

### setConsentDefaults

Set initial consent state before loading gtag.js.

```typescript
import { setConsentDefaults } from '@structured-world/vue-privacy';

setConsentDefaults({
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
});
```

### updateConsent

Update consent signals after user choice.

```typescript
import { updateConsent } from '@structured-world/vue-privacy';

updateConsent({
  analytics_storage: 'granted',
});
```

### trackPageView

Low-level function that always sends a `page_view` event to Google Analytics without checking consent state. Google Consent Mode controls whether data is stored. For consent-aware tracking that skips sending events when analytics is denied, use `ConsentManager.trackPageView()` or the `useConsent()` composable instead.

```typescript
import { trackPageView } from '@structured-world/vue-privacy';

trackPageView('/new-page');
trackPageView('/new-page', 'Custom Title');
```

### initGoogleAnalytics

Initialize Google Analytics with Consent Mode.

```typescript
import { initGoogleAnalytics } from '@structured-world/vue-privacy';

// Args: gaId, defaultDenied, sendPageView
await initGoogleAnalytics('G-XXXXXXXXXX', true, false);
```

Set `sendPageView` to `false` for SPA apps where you track navigation manually.

## Storage Functions

### getStoredConsent

Read consent from cookie.

```typescript
import { getStoredConsent } from '@structured-world/vue-privacy';

const consent = getStoredConsent({ cookie: { name: 'my_consent' } });
```

### storeConsent

Write consent to cookie.

```typescript
import { storeConsent } from '@structured-world/vue-privacy';

storeConsent({
  categories: { analytics: true, marketing: false, functional: true },
});
```

### clearConsent

Delete consent cookie.

```typescript
import { clearConsent } from '@structured-world/vue-privacy';

clearConsent();
```

### createKVStorage

Create a remote consent storage backed by a Cloudflare KV Worker (vue-privacy-worker compatible API).

```typescript
import { createConsentManager, createKVStorage } from '@structured-world/vue-privacy';

// Basic usage
const manager = createConsentManager({
  gaId: 'G-XXXXXXXXXX',
  storage: createKVStorage('/api/consent'),
});

// With rate limiting options
const storage = createKVStorage('/api/consent', {
  maxRetries: 5,
  onRateLimited: (retryAfter, attempt) => {
    console.log(`Rate limited (attempt ${attempt}). Retry in ${retryAfter ?? 'exponential'}s`);
  },
});
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRetries` | `number` | `3` | Total fetch attempts on 429 (1 initial + N-1 retries) |
| `onRateLimited` | `function` | - | Callback invoked on each 429 response |

#### Rate Limiting Behavior

When the server returns a 429 (Too Many Requests) response:

1. **Retry with exponential backoff**: Delays between attempts are 1s, 2s, 4s, 8s... (2^0, 2^1, 2^2... seconds)
2. **Respect Retry-After header**: If the server sends a `Retry-After` header, that delay is used instead
3. **Graceful fallback**: After max retries, returns `null` (consent stored locally via cookie only)

The `onRateLimited` callback receives:
- `retryAfter` - Delay from server's Retry-After header (in seconds), or `null` if not provided
- `attempt` - Current attempt number (1-based)
