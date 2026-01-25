# Core API

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

### initGoogleAnalytics

Initialize Google Analytics with Consent Mode.

```typescript
import { initGoogleAnalytics } from '@structured-world/vue-privacy';

await initGoogleAnalytics('G-XXXXXXXXXX', true); // true = default denied
```

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
