---
description: Build a cookie preference center for granular consent control. Let users choose analytics, marketing, and functional cookie categories.
---

# Cookie Preference Center

The preference center is a modal dialog that lets users choose which cookie categories to allow. It opens when the user clicks "Customize" on the consent banner.

## Basic Usage

### Vue 3

Add `ConsentPreferenceModal` to your app alongside the banner:

```vue
<template>
  <ConsentBanner />
  <ConsentPreferenceModal />
</template>
```

Both components are registered globally by `createConsentPlugin`.

### VitePress

If using `enhanceWithConsent`, add the modal to your layout:

```typescript
import { h } from 'vue';
import DefaultTheme from 'vitepress/theme';
import { enhanceWithConsent, ConsentBanner } from '@structured-world/vue-privacy/vitepress';
import { ConsentPreferenceModal } from '@structured-world/vue-privacy/vue';

const consentTheme = enhanceWithConsent(DefaultTheme, {
  gaId: 'G-XXXXXXXXXX',
});

export default {
  ...consentTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => [h(ConsentBanner), h(ConsentPreferenceModal)],
    });
  },
};
```

## Categories

The modal displays four cookie categories:

| Category | Default | User can toggle |
|----------|---------|-----------------|
| **Necessary** | Always on | No (disabled) |
| **Analytics** | Off | Yes |
| **Marketing** | Off | Yes |
| **Functional** | On | Yes |

Each category shows a name and description, translated to the user's locale.

### Only the categories your site uses

A site that runs analytics only should not offer a "Marketing" toggle that controls nothing. List the optional categories the site uses:

```typescript
createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  usedCategories: ['analytics'],
});
```

The preference centre then shows "Necessary" and "Analytics" only. Every other category is always refused: "Accept all", saved preferences, the grant implied outside consent jurisdictions and a consent stored earlier never turn it on, so its Google signals (`ad_storage`, `ad_user_data`, `ad_personalization` for marketing) stay `denied`. Turning analytics off later is then a full refusal: it is stored like any other choice, replaces the earlier grant and clears `consent_uid`.

The footer offers "Reject all" beside "Accept all", styled the same: refusing every optional category takes one click, as accepting does. "Save preferences" stores the toggles as set.

## Opening Programmatically

Use the `useConsent` composable:

```vue
<script setup>
import { useConsent } from '@structured-world/vue-privacy/vue';

const { showPreferenceCenter } = useConsent();
</script>

<template>
  <button @click="showPreferenceCenter">Cookie Settings</button>
</template>
```

Or via the core API:

```typescript
const manager = createConsentManager({ gaId: 'G-XXX' });
await manager.init();
manager.showPreferenceCenter();
```

## Customizing Text

Override preference center text via config:

```typescript
createConsentPlugin({
  preferenceCenter: {
    title: 'Cookie Preferences',
    description: 'Choose which cookies you want to allow.',
    savePreferences: 'Save My Choices',
    acceptAll: 'Accept Everything',
    rejectAll: 'Refuse Everything',
    categories: {
      analytics: {
        name: 'Performance Cookies',
        description: 'Help us understand how visitors use our site.',
      },
      marketing: {
        name: 'Advertising Cookies',
        description: 'Used to show relevant ads.',
      },
    },
  },
});
```

Text not explicitly overridden falls back to the built-in i18n translations for the active locale.

## Accessibility

The preference center includes:

- `role="dialog"` and `aria-modal="true"`
- `aria-labelledby` pointing to the modal title
- `aria-label` on all toggle checkboxes
- Focus trap (Tab cycles within the modal)
- Focus moves to the modal container on open
- Escape key closes the modal

## Callbacks

```typescript
createConsentPlugin({
  onPreferenceCenterShow: () => console.log('Preference center opened'),
  onPreferenceCenterHide: () => console.log('Preference center closed'),
});
```

## Styling

The modal uses CSS-in-JS (auto-injected, SSR-safe). It supports:

- Dark mode via `prefers-color-scheme`, or a palette pinned with `theme` (see [Customization](/guide/customization#dark-mode))
- Mobile-responsive layout (full-width on small screens)
- CSS custom properties for theming (same as banner)
