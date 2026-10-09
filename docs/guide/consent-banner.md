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

Banner text is automatically translated into the first of the visitor's preferred browser languages (`navigator.languages`, in order) that has a locale. 31 locales are built in:

- every official EU language: bg, cs, da, de, el, en, es, et, fi, fr, ga, hr, hu, it, lt, lv, mt, nl, pl, pt, ro, sk, sl, sv;
- the EEA's Norwegian (`nb`, also chosen for `no` and Nynorsk `nn`) and Icelandic (`is`);
- ja, ko, ru, uk, zh.

A regional tag resolves to its language (`ro-MD` to `ro`, `sv-FI` to `sv`). A visitor who reads none of them gets English. The "Do Not Sell My Personal Information" link text stays English in every locale, as the CCPA phrase.

To offer only the languages of your site, and choose the one shown to everyone else:

```typescript
createConsentPlugin({
  locales: ['ro', 'en', 'hu'], // detection picks only among these
  fallbackLocale: 'ro', // default: 'en' when offered, else the first of locales
});
```

To force a locale:

```typescript
createConsentPlugin({
  locale: 'de', // Force German
});
```

When the visitor changes language on your site, pass the new language to the manager; the banner and the preference centre re-render in it, within `locales`:

```typescript
consentManager.setLocale('ro-MD'); // shows 'ro'
```

The site keeps the visitor's language choice itself (its route or its own setting) and passes it again on the next page load, as `locale` or through `setLocale()`. The manager stores no language of its own, so it never disagrees with the page.

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
