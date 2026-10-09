---
description: Configure the GDPR consent banner appearance, position, and behavior. Customize text, colors, and cookie preferences for your Vue application.
---

# Consent Banner Configuration

The consent banner is the primary UI component that asks users for cookie consent. It appears automatically for EU users and can be dismissed by accepting, rejecting, or customizing preferences.

## Basic Usage

### Vue 3

```vue
<template>
  <ConsentBanner />
</template>
```

The `ConsentBanner` component is registered globally when using `createConsentPlugin`. It automatically:

- Shows for EU users who haven't given consent
- Hides for non-EU users (consent is granted silently)
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

### i18n

Banner text is automatically translated based on the user's browser locale. 31 locales are built in:

- every official EU language: bg, cs, da, de, el, en, es, et, fi, fr, ga, hr, hu, it, lt, lv, mt, nl, pl, pt, ro, sk, sl, sv;
- the EEA's Norwegian (`nb`, also chosen for `no` and Nynorsk `nn`) and Icelandic (`is`);
- ja, ko, ru, uk, zh.

A regional tag resolves to its language (`ro-MD` to `ro`, `sv-FI` to `sv`); any other language falls back to English. The "Do Not Sell My Personal Information" link text stays English in every locale, as the CCPA phrase.

To override the locale:

```typescript
createConsentPlugin({
  locale: 'de', // Force German
});
```

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
