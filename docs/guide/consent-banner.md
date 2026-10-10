---
description: Configure the GDPR cookie consent banner for Vue 3, Nuxt, VitePress and Quasar. Text, position, callbacks and the visitors it asks, with refusing as easy as accepting.
---

# Consent Banner Configuration

The consent banner is the primary UI component that asks visitors for cookie consent. It appears automatically for visitors in a [consent jurisdiction](/guide/consent-jurisdictions) (EEA and UK by default) and is dismissed by accepting, rejecting, or customizing preferences.

## Basic Usage

### Vue 3

```vue
<template>
  <ConsentBanner />
</template>
```

The `ConsentBanner` component is registered globally when using `createConsentPlugin`. It automatically:

- Shows for visitors in a consent jurisdiction who haven't chosen yet
- Stays hidden elsewhere (consent is granted silently)
- Hides after the user makes a choice
- Persists the choice in a cookie for 365 days

### VitePress

The banner is included automatically with `enhanceWithConsent`:

```typescript
import DefaultTheme from 'vitepress/theme';
import { enhanceWithConsent } from '@structured-world/vue-privacy/vitepress';

export default enhanceWithConsent(DefaultTheme, {
  gaId: 'G-XXXXXXXXXX',
});
```

## Customizing Text

Override banner text via configuration:

```typescript
createConsentPlugin({
  banner: {
    title: 'Cookie Settings',
    message: 'We use cookies to enhance your browsing experience.',
    acceptAll: 'Accept All Cookies',
    rejectAll: 'Reject Non-Essential',
    customize: 'Manage Preferences',
    privacyLink: '/privacy-policy',
    privacyLinkText: 'Read our Privacy Policy',
  },
});
```

### Languages

Banner text is translated into the visitor's language: 31 locales are built in, chosen from the browser's preferred languages. See [Languages](/guide/languages) to limit them to your site's languages, set a fallback, or switch language at runtime.

## Positioning

The banner appears at the bottom of the viewport by default.

```vue
<ConsentBanner position="bottom" />
```

## Styling

See [Customization](/guide/customization) for CSS custom properties and dark mode support.

## Events

The banner emits events when the user interacts:

```vue
<ConsentBanner
  @accept="handleAccept"
  @reject="handleReject"
  @customize="handleCustomize"
/>
```

## Callbacks

```typescript
createConsentPlugin({
  onBannerShow: () => console.log('Banner shown'),
  onBannerHide: () => console.log('Banner hidden'),
  onConsentChange: (consent) => console.log('Consent:', consent),
});
```

## Programmatic Control

Use the `useConsent` composable to control the banner programmatically:

```vue
<script setup>
import { useConsent } from '@structured-world/vue-privacy/vue';

const { resetConsent } = useConsent();
</script>

<template>
  <button @click="resetConsent">Manage Cookie Settings</button>
</template>
```

Calling `resetConsent()` clears stored consent and shows the banner again.
