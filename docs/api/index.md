---
description: Framework-agnostic Vue Privacy API reference. ConsentManager methods, Google Tag functions, storage utilities, and KV storage with rate limiting.
---

# Core API Reference Guide

The core API is framework-agnostic and can be used without Vue.

## createConsentManager

Creates a consent manager instance.

```typescript
import { createConsentManager } from "@structured-world/vue-privacy";

const manager = createConsentManager({
  gaId: "G-XXXXXXXXXX",
  euDetection: "auto",
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

Reject every optional category (analytics, marketing and functional); only strictly necessary storage stays. The refusal is stored like a grant, for the consent cookie's lifetime (`cookie.expiry`, 365 days by default), and replaces an earlier grant; the banner does not ask again on every page.

```typescript
await manager.rejectAll();
```

The consent signals, the stored choice and the closed banner take effect at once, as for `acceptAll()` and `savePreferences()`. `config` is queued together with the first consent default, so events tracked at any later point follow it, even while gtag.js is still loading.

#### `savePreferences(categories): Promise<void>`

Save specific category preferences. Every choice is stored, a refusal included; a category not given is refused.

```typescript
await manager.savePreferences({
  analytics: true,
  marketing: false,
  functional: true,
});
```

#### `getConsent(): StoredConsent | null`

Get the visitor's choice (a grant or a refusal), or `null` while the visitor has not chosen. A choice made on this page is returned even if the browser blocks the consent cookie; a choice saved later in another tab replaces it, and a reset in another tab makes the visitor undecided again. With `consentMode: 'basic'`, a CCPA visitor or one outside consent jurisdictions who has not chosen gets the state the jurisdiction implies (analytics off, the other categories on), so the preference centre shows what is in effect; it is not stored and `hasConsent()` stays `false`.

```typescript
const consent = manager.getConsent();
if (consent) {
  console.log("Analytics:", consent.categories.analytics);
}
```

#### `hasConsent(): boolean`

Check if the visitor has chosen: `true` after a grant and after a refusal, whenever `getConsent()` returns a choice. Use `getConsent()` to see which categories it allows.

```typescript
if (manager.hasConsent()) {
  // The visitor has chosen
}
```

#### `isConsentRequired(): boolean | null`

Whether the visitor is in a consent jurisdiction (`consentJurisdictions`, EEA and UK by default), so the banner asks before anything is granted; `null` before detection ran. A failed lookup counts as `true` unless `geoFailure: 'grant'`.

```typescript
if (manager.isConsentRequired()) {
  // Show GDPR-specific content
}
```

#### `isEUUser(): boolean | null`

Alias of `isConsentRequired()`: "EU" here means every consent jurisdiction, the EEA and the UK included.

#### `trackPageView(path, title?): void`

Track a page view manually. Use this for SPA navigation with Vue Router or custom routing.

While the visitor has not chosen, the event is sent under the Consent Mode defaults (analytics denied), so Google receives it as a cookieless ping and stores no identifiers. Once the visitor's choice leaves analytics off, the manager sends nothing. With `consentMode: 'basic'` nothing is sent until the visitor allows analytics; the page view tracked last before that is then sent once, so the page the visitor consented on is counted. With `sendPageView` left on, the tag's own first page view covers it and nothing extra is sent.

```typescript
manager.trackPageView("/docs/guide");
manager.trackPageView("/docs/api", "API Reference");
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

Forget the stored choice and show the banner again. The consent signals go back to `denied` until the user chooses. An open preference centre closes first, and its pending `requestConsent()` calls answer `false`.

```typescript
manager.resetConsent();
```

#### `requestConsent(category, options?): Promise<boolean>`

Ask again for an optional category a feature needs, at the moment it is needed, with `options.reason` shown above the categories. A category in effect (granted by the visitor, or by the jurisdiction) resolves `true` at once and shows nothing. Otherwise the preference centre opens with the category highlighted, never pre-ticked, and the promise resolves whether the category is granted after the visitor's choice; closing the dialog resolves `false` and keeps the stored refusal. A call while the dialog is open joins it, and each caller gets its own answer. A call before `init()` settled waits for it; after `destroy()` it resolves `false`. Rejects for a category outside `usedCategories`, which no choice can grant. See [Asking again](/guide/preference-center#asking-again-when-a-feature-needs-a-category).

```typescript
const allowed = await manager.requestConsent("functional", {
  reason: "Sign-in needs functional cookies to keep you logged in.",
});
```

#### `getConsentRequest(): ConsentRequest | null`

What the open preference centre is asked for: the requested `categories` and the sites' `reasons`, for a custom dialog to show; `null` when no request is pending.

#### `hidePreferenceCenter(): void`

Close the preference centre without a choice (a custom dialog's close button, Escape, a click outside). The stored choice stands, and each pending `requestConsent()` call is answered from it. With nothing open it does nothing, and `onPreferenceCenterHide` does not fire.

## Google Tag Functions

### setConsentDefaults

Set initial consent state before loading gtag.js.

```typescript
import { setConsentDefaults } from "@structured-world/vue-privacy";

setConsentDefaults({
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
});
```

### updateConsent

Update consent signals after user choice.

```typescript
import { updateConsent } from "@structured-world/vue-privacy";

updateConsent({
  analytics_storage: "granted",
});
```

### trackPageView

Low-level function that always sends a `page_view` event to Google Analytics without checking consent state. Google Consent Mode controls whether data is stored. For consent-aware tracking that skips sending events when analytics is denied, use `ConsentManager.trackPageView()` or the `useConsent()` composable instead.

```typescript
import { trackPageView } from "@structured-world/vue-privacy";

trackPageView("/new-page");
trackPageView("/new-page", "Custom Title");
```

### initGoogleAnalytics

Initialize Google Analytics with Consent Mode: `consent default`, `js` and `config` are queued, then gtag.js loads and processes them.

```typescript
import { initGoogleAnalytics } from "@structured-world/vue-privacy";

// Args: gaId, defaults, sendPageView, waitForUpdate, options
await initGoogleAnalytics("G-XXXXXXXXXX", true, false);
```

`options` takes the same block as `ConsentConfig.googleAnalytics` ([GoogleAnalyticsOptions](./types#googleanalyticsoptions)): its `set` fields go out before `config`, its `config` fields into the `config` call.

```typescript
await initGoogleAnalytics("G-XXXXXXXXXX", true, true, 500, {
  config: { allow_google_signals: false, cookie_expires: 7776000 },
});
```

Or, instead of the call above, per-signal defaults, e.g. for a returning visitor who allowed analytics only. The choice is already final, so `waitForUpdate` is `0`:

```typescript
await initGoogleAnalytics(
  "G-XXXXXXXXXX",
  {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  },
  false,
  0
);
```

`defaults` is `true` (deny every signal), `false` (grant every signal) or the signals themselves.
Set `sendPageView` to `false` for SPA apps where you track navigation manually.
`waitForUpdate` (default `500`) is how long tags hold their first hits for a consent update; `0` omits `wait_for_update`. If gtag.js is already on the page, the defaults come too late to apply, so the same signals follow as an update.

Call it once per page. Every later change goes through `updateConsent()`: a second call issues another `consent default`, and Consent Mode applies defaults only before the tag loads, so once it has loaded that default changes nothing. `js` and `config` are queued once per measurement ID, so calling it again after a failed load retries the script without a second page view. `ConsentManager` does this for you.

## Storage Functions

### getStoredConsent

Read consent from cookie.

```typescript
import { getStoredConsent } from "@structured-world/vue-privacy";

const consent = getStoredConsent({ cookie: { name: "my_consent" } });
```

### storeConsent

Write consent to cookie.

```typescript
import { storeConsent } from "@structured-world/vue-privacy";

storeConsent({
  categories: { analytics: true, marketing: false, functional: true },
});
```

### clearConsent

Delete consent cookie.

```typescript
import { clearConsent } from "@structured-world/vue-privacy";

clearConsent();
```

### createKVStorage

Create a remote consent storage backed by a Cloudflare KV Worker (vue-privacy-worker compatible API).

```typescript
import { createConsentManager, createKVStorage } from "@structured-world/vue-privacy";

// Basic usage
const manager = createConsentManager({
  gaId: "G-XXXXXXXXXX",
  storage: createKVStorage("/api/consent"),
});

// With rate limiting options
const storage = createKVStorage("/api/consent", {
  maxRetries: 5,
  onRateLimited: (retryAfter, attempt) => {
    console.log(`Rate limited (attempt ${attempt}). Retry in ${retryAfter ?? "exponential"}s`);
  },
});
```

#### Options

| Option          | Type       | Default | Description                                           |
| --------------- | ---------- | ------- | ----------------------------------------------------- |
| `maxRetries`    | `number`   | `3`     | Total fetch attempts on 429 (1 initial + N-1 retries) |
| `onRateLimited` | `function` | -       | Callback invoked on each 429 response                 |

#### Rate Limiting Behavior

When the server returns a 429 (Too Many Requests) response:

1. **Retry with exponential backoff**: Delays between attempts are 1s, 2s, 4s, 8s... (2^0, 2^1, 2^2... seconds)
2. **Respect Retry-After header**: If the server sends a `Retry-After` header, that delay is used instead
3. **Graceful fallback**: After max retries, returns `null` (consent stored locally via cookie only)

The `onRateLimited` callback receives:

- `retryAfter` - Delay from server's Retry-After header (in seconds), or `null` if not provided
- `attempt` - Current attempt number (1-based)
